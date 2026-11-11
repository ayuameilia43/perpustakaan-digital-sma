import { db } from "@/lib/db";
import {
  buildAdminWorkflowGuide,
  buildStaffWorkflowGuide,
  buildWorkflowGuide,
} from "@/lib/ai-workflows";

export const MAX_CONTEXT_CHARS = 11000;

const CATALOG_CACHE_TTL = 5 * 60_000;
const CATALOG_CACHE_REFRESH_LEAD = 60_000;
const MAX_CATALOG_BOOKS = 15;
const MAX_SEARCH_BOOKS = 8;
const MAX_DESCRIPTION = 180;

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrator",
  LIBRARIAN: "Pustakawan",
  STUDENT: "Peserta Didik",
  TEACHER: "Guru",
  STAFF: "Staff Sekolah",
};

const STAFF_ROLES = ["ADMIN", "LIBRARIAN"];

const STOPWORDS = new Set([
  "ada",
  "adalah",
  "apa",
  "apakah",
  "atau",
  "bagi",
  "bisa",
  "boleh",
  "buku",
  "cari",
  "carikan",
  "dalam",
  "dari",
  "dengan",
  "di",
  "dan",
  "dong",
  "hari",
  "ini",
  "itu",
  "kasih",
  "kamu",
  "mohon",
  "paling",
  "saya",
  "tahu",
  "tentang",
  "tolong",
  "yang",
  "rekomendasi",
  "rekomendasikan",
  "recommend",
]);

const BOOK_INCLUDE = {
  author: { select: { name: true, bio: true } },
  publisher: { select: { name: true } },
  category: { select: { name: true, code: true } },
} as const;

type BookWithRelations = {
  title: string;
  isbn: string;
  publish_year: number;
  stock_total: number;
  stock_available: number;
  location_rack: string;
  description: string | null;
  is_ebook: boolean;
  ebook_format: string | null;
  tags: string | null;
  total_borrowed: number;
  rating_avg: number;
  author: { name: string; bio: string | null };
  publisher: { name: string };
  category: { name: string; code: string };
};

type GeneralContextCache = {
  data: string;
  expiresAt: number;
  refreshing?: boolean;
};

const globalForCache = globalThis as unknown as {
  libraryKnowledgeCache?: GeneralContextCache;
};

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function clamp(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit).trimEnd()}\n[Data dipotong karena terlalu panjang]` : text;
}

function rupiah(amount: number): string {
  return `Rp${new Intl.NumberFormat("id-ID").format(Math.round(amount))}`;
}

function formatDate(value: Date | null): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(value);
}

function truncate(text: string, limit: number): string {
  const value = clean(text);
  return value.length > limit ? `${value.slice(0, limit).trimEnd()}...` : value;
}

const RULE_LABELS: Record<string, (value: string) => string> = {
  max_borrow: (value) => `maksimal pinjam ${value} buku`,
  borrow_duration: (value) => `durasi pinjam ${value} hari`,
  fine_per_day: (value) => `denda keterlambatan ${rupiah(Number(value))}/hari`,
};

function formatBook(book: BookWithRelations, index?: number): string {
  const parts = [
    `${index !== undefined ? `${index}. ` : ""}"${book.title}"`,
    `oleh ${book.author.name}`,
    `kategori ${book.category.name}`,
    `penerbit ${book.publisher.name} (${book.publish_year})`,
    `ISBN ${book.isbn}`,
    `stok ${book.stock_available}/${book.stock_total} tersedia`,
    `lokasi ${book.location_rack}`,
    `rating ${book.rating_avg.toFixed(1)} dari ${book.total_borrowed} kali dipinjam`,
    book.is_ebook ? `e-book${book.ebook_format ? ` (${book.ebook_format})` : ""}` : "cetak",
  ];

  if (book.tags) parts.push(`tag: ${book.tags}`);
  if (book.description) parts.push(`ringkasan: ${truncate(book.description, MAX_DESCRIPTION)}`);

  return `- ${parts.join(" | ")}`;
}

function tokenize(query: string): string[] {
  return clean(query)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token))
    .slice(0, 6);
}

async function buildProfileSection(): Promise<string> {
  const [bookCount, stockSum, ebookCount, categories, userGroups] =
    await Promise.all([
      db.book.count(),
      db.book.aggregate({
        _sum: { stock_total: true, stock_available: true },
      }),
      db.book.count({ where: { is_ebook: true } }),
      db.category.findMany({
        include: { _count: { select: { books: true } } },
        orderBy: { code: "asc" },
      }),
      db.user.groupBy({ by: ["role"], _count: { _all: true } }),
    ]);

  const totalCopies = stockSum._sum.stock_total ?? 0;
  const availableCopies = stockSum._sum.stock_available ?? 0;
  const totalMembers = userGroups.reduce((sum, group) => sum + group._count._all, 0);

  const lines = [
    "- Total judul buku: " + bookCount,
    `- Total eksemplar: ${totalCopies} (tersedia ${availableCopies}, dipinjam ${totalCopies - availableCopies})`,
    `- Buku e-book: ${ebookCount} judul`,
    `- Anggota terdaftar: ${totalMembers} (${userGroups
      .map((group) => `${ROLE_LABELS[group.role] ?? group.role}: ${group._count._all}`)
      .join(", ")})`,
    "- Kategori koleksi:",
    ...categories.map(
      (category) =>
        `  - ${category.name} (kode ${category.code}): ${category._count.books} judul${
          category.description ? ` - ${truncate(category.description, 120)}` : ""
        }`
    ),
  ];

  return ["PROFIL KOLEKSI", ...lines].join("\n");
}

async function buildRulesSection(): Promise<string> {
  const settings = await db.systemSetting.findMany({ orderBy: { key: "asc" } });
  const grouped = new Map<string, Record<string, string>>();
  const general: { key: string; value: string; description: string | null }[] = [];

  for (const setting of settings) {
    const match = setting.key.match(/^(.*)_(student|teacher|staff)$/);
    if (match) {
      const [, base, audience] = match;
      grouped.set(audience, {
        ...(grouped.get(audience) ?? {}),
        [base]: setting.value,
      });
    } else {
      general.push(setting);
    }
  }

  const lines: string[] = [];

  for (const [audience, rules] of grouped) {
    const details = Object.entries(rules)
      .map(([key, value]) => RULE_LABELS[key]?.(value) ?? `${key.replace(/_/g, " ")} = ${value}`)
      .join(", ");
    lines.push(`- ${ROLE_LABELS[audience] ?? audience}: ${details}`);
  }

  if (general.length > 0) {
    lines.push(
      "- Pengaturan lain:",
      ...general.map(
        (setting) =>
          `  - ${setting.key}: ${setting.value}${setting.description ? ` (${truncate(setting.description, 120)})` : ""}`
      )
    );
  }

  if (lines.length === 0) return "";

  return ["ATURAN LAYANAN & PEMINJAMAN", ...lines].join("\n");
}

async function buildCatalogSection(): Promise<string> {
  const books = await db.book.findMany({
    include: BOOK_INCLUDE,
    orderBy: [{ total_borrowed: "desc" }, { rating_avg: "desc" }],
    take: MAX_CATALOG_BOOKS,
  });

  if (books.length === 0) return "";

  const lines = books.map((book, index) => formatBook(book, index + 1));

  return [
    `DAFTAR BUKU YANG TERSEDIA (${books.length} dari total katalog)`,
    ...lines,
  ].join("\n");
}

async function buildRelevantSection(query: string): Promise<string> {
  const tokens = tokenize(query);
  if (tokens.length === 0) return "";

  const books = await db.book.findMany({
    where: {
      OR: tokens.flatMap((token) => [
        { title: { contains: token } },
        { isbn: { contains: token } },
        { tags: { contains: token } },
        { description: { contains: token } },
        { author: { name: { contains: token } } },
        { category: { name: { contains: token } } },
        { publisher: { name: { contains: token } } },
      ]),
    },
    include: BOOK_INCLUDE,
    orderBy: [{ total_borrowed: "desc" }, { rating_avg: "desc" }],
    take: MAX_SEARCH_BOOKS,
  });

  if (books.length === 0) {
    return [
      `BUKU YANG COCOK DENGAN PERTANYAAN (kata kunci: ${tokens.join(", ")})`,
      "- Tidak ada buku di katalog yang cocok dengan kata kunci tersebut. Jangan pernah memaksa menyebut judul buku yang tidak ada di daftar.",
      "- Kalau pengguna hanya meminta rekomendasi umum, pakai daftar buku di atas yang diurutkan dari yang paling banyak dipinjam.",
    ].join("\n");
  }

  return [
    `BUKU YANG PALING RELEVAN DENGAN PERTANYAAN (kata kunci: ${tokens.join(", ")})`,
    ...books.map((book) => formatBook(book)),
  ].join("\n");
}

const MAX_USER_ACTIVE = 15;
const MAX_USER_RETURNED = 8;
const MAX_USER_NOTIFICATIONS = 3;

type UserSectionCacheEntry = {
  data: string;
  expiresAt: number;
  pending?: Promise<string>;
};

const globalForUserCache = globalThis as unknown as {
  libraryUserSectionCache?: Map<string, UserSectionCacheEntry>;
};

function getUserSectionCache(): Map<string, UserSectionCacheEntry> {
  if (!globalForUserCache.libraryUserSectionCache) {
    globalForUserCache.libraryUserSectionCache = new Map();
  }
  return globalForUserCache.libraryUserSectionCache;
}

async function fetchUserSection(userId: string): Promise<string> {
  const [
    user,
    activeBorrowings,
    returnedBorrowings,
    statusCounts,
    ebookProgress,
    unreadNotifications,
    latestUnread,
    unpaidFines,
    paidFines,
  ] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        role: true,
        class_or_dept: true,
        email: true,
        nisn_nip: true,
        status: true,
        createdAt: true,
      },
    }),
    db.borrowing.findMany({
      where: { user_id: userId, status: { in: ["BORROWED", "OVERDUE", "PENDING"] } },
      include: { book: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
      take: MAX_USER_ACTIVE,
    }),
    db.borrowing.findMany({
      where: { user_id: userId, status: "RETURNED" },
      include: { book: { select: { title: true } } },
      orderBy: [{ return_date: "desc" }, { updatedAt: "desc" }],
      take: MAX_USER_RETURNED,
    }),
    db.borrowing.groupBy({ by: ["status"], where: { user_id: userId }, _count: { _all: true } }),
    db.ebookProgress.findMany({
      where: { user_id: userId },
      include: { book: { select: { title: true } } },
      orderBy: { last_read_at: "desc" },
      take: 5,
    }),
    db.notification.count({ where: { user_id: userId, is_read: false } }),
    db.notification.findMany({
      where: { user_id: userId, is_read: false },
      orderBy: { createdAt: "desc" },
      take: MAX_USER_NOTIFICATIONS,
      select: { title: true, message: true, type: true },
    }),
    db.fine.findMany({
      where: { status: { not: "PAID" }, borrowing: { user_id: userId } },
      select: { amount: true, reason: true, status: true },
    }),
    db.fine.aggregate({
      where: { status: "PAID", borrowing: { user_id: userId } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  const counts = new Map<string, number>(
    statusCounts.map((group) => [group.status as string, group._count._all])
  );
  const countOf = (status: string) => counts.get(status) ?? 0;
  const totalBorrowings = statusCounts.reduce((sum, group) => sum + group._count._all, 0);

  const overdue = activeBorrowings.filter((item) => item.status === "OVERDUE");
  const active = activeBorrowings.filter((item) => item.status === "BORROWED");
  const pending = activeBorrowings.filter((item) => item.status === "PENDING");

  const lines = [
    `- Nama: ${user?.name ?? "-"} | NISN/NIP: ${user?.nisn_nip ?? "-"} | Email: ${user?.email ?? "-"}`,
    `- Role: ${ROLE_LABELS[user?.role ?? ""] ?? user?.role ?? "-"}${
      user?.class_or_dept ? ` | Kelas/Departemen: ${user.class_or_dept}` : ""
    } | Status akun: ${user?.status ?? "-"} | Anggota sejak: ${formatDate(user?.createdAt ?? null)}`,
    `- Ringkasan riwayat peminjaman: ${totalBorrowings} transaksi (selesai ${countOf(
      "RETURNED"
    )}, sedang dipinjam ${countOf("BORROWED")}, menunggu persetujuan ${countOf(
      "PENDING"
    )}, terlambat ${countOf("OVERDUE")}, ditolak ${countOf("REJECTED")})`,
    `- Total peminjaman sepanjang waktu: ${totalBorrowings} (selesai ${countOf(
      "RETURNED"
    )}, sedang dipinjam ${countOf("BORROWED")}, menunggu persetujuan ${countOf(
      "PENDING"
    )}, terlambat ${countOf("OVERDUE")}, ditolak ${countOf("REJECTED")})`,
    `- Denda belum dibayar: ${rupiah(unpaidFines.reduce((sum, fine) => sum + fine.amount, 0))} (${unpaidFines.length} tagihan) | Denda sudah dibayar: ${rupiah(
      paidFines._sum.amount ?? 0
    )} (${paidFines._count._all} tagihan)`,
    `- Notifikasi belum dibaca: ${unreadNotifications}`,
  ];

  if (latestUnread.length > 0) {
    lines.push("- Notifikasi terbaru yang belum dibaca:");
    for (const notification of latestUnread) {
      lines.push(
        `  - [${notification.type}] ${truncate(notification.title, 80)} — ${truncate(
          notification.message,
          100
        )}`
      );
    }
  }

  if (active.length + pending.length + overdue.length > 0) {
    lines.push(
      `- Status aktif: sedang dipinjam ${active.length} buku | menunggu persetujuan ${pending.length} buku | terlambat ${overdue.length} buku`
    );
  }

  if (active.length > 0) {
    lines.push("- Rincian buku yang sedang dipinjam:");
    for (const borrowing of active) {
      lines.push(
        `  - "${borrowing.book.title}" | jatuh tempo ${formatDate(
          borrowing.due_date
        )}${borrowing.fine_amount > 0 ? ` | denda ${rupiah(borrowing.fine_amount)}` : ""}`
      );
    }
  }

  if (pending.length > 0) {
    lines.push("- Rincian pengajuan menunggu persetujuan:");
    for (const borrowing of pending) {
      lines.push(`  - "${borrowing.book.title}" | status ${borrowing.status}`);
    }
  }

  if (overdue.length > 0) {
    lines.push("- Rincian buku yang terlambat:");
    for (const borrowing of overdue) {
      lines.push(
        `  - "${borrowing.book.title}" | jatuh tempo ${formatDate(
          borrowing.due_date
        )} | denda ${rupiah(borrowing.fine_amount)}`
      );
    }
  }

  if (returnedBorrowings.length > 0) {
    lines.push(
      `- Riwayat buku yang sudah dikembalikan (terakhir ${returnedBorrowings.length}):`
    );
    for (const borrowing of returnedBorrowings) {
      lines.push(
        `  - "${borrowing.book.title}" | dipinjam ${formatDate(
          borrowing.borrow_date ?? borrowing.request_date
        )} | dikembalikan ${formatDate(borrowing.return_date)}${
          borrowing.fine_amount > 0 ? ` | denda ${rupiah(borrowing.fine_amount)}` : ""
        }`
      );
    }
  }

  if (ebookProgress.length > 0) {
    lines.push("- E-book yang sedang dibaca:");
    for (const progress of ebookProgress) {
      lines.push(
        `  - "${progress.book.title}" halaman ${progress.last_page}/${progress.total_pages}`
      );
    }
  }

  if (totalBorrowings === 0 && ebookProgress.length === 0) {
    lines.push(
      "- Belum ada riwayat peminjaman atau progres baca sama sekali untuk akun ini."
    );
  }

  return ["DATA PENGGUNA (milik pengguna yang sedang chat, satu-satunya sumber jawaban personal)", ...lines].join("\n");
}

const USER_SECTION_TTL = 30_000;
const USER_SECTION_CACHE_MAX = 200;

/**
 * DATA PENGGUNA di-cache singkat per user (30 detik) agar chat beruntun
 * tidak mengulang 9 query yang sama; permintaan paralel berbagi satu promise.
 */
async function buildUserSection(userId: string): Promise<string> {
  const cache = getUserSectionCache();
  const cached = cache.get(userId);
  const now = Date.now();

  if (cached) {
    if (cached.expiresAt > now) return cached.data;
    if (cached.pending) return cached.pending;
  }

  const pending = fetchUserSection(userId)
    .then((data) => {
      cache.set(userId, { data, expiresAt: Date.now() + USER_SECTION_TTL });
      return data;
    })
    .catch((error) => {
      cache.delete(userId);
      throw error;
    });

  if (cache.size >= USER_SECTION_CACHE_MAX) cache.clear();
  cache.set(userId, { data: cached?.data ?? "", expiresAt: 0, pending });

  return pending;
}

async function buildOperationsSection(): Promise<string> {
  const [statusGroups, unpaidFines, topBorrowed] = await Promise.all([
    db.borrowing.groupBy({ by: ["status"], _count: { _all: true } }),
    db.fine.aggregate({
      where: { status: "UNPAID" },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    db.book.findMany({
      orderBy: { total_borrowed: "desc" },
      take: 5,
      select: {
        title: true,
        total_borrowed: true,
        rating_avg: true,
        author: { select: { name: true } },
        publisher: { select: { name: true } },
        category: { select: { name: true } },
      },
    }),
  ]);

  const lines = [
    `- Total transaksi peminjaman: ${statusGroups
      .map((group) => `${group.status}: ${group._count._all}`)
      .join(", ")}`,
    `- Denda belum dibayar seluruh pengguna: ${rupiah(unpaidFines._sum.amount ?? 0)} dari ${unpaidFines._count._all} tagihan`,
    "- Buku paling banyak dipinjam:",
    ...topBorrowed.map(
      (book) =>
        `  - "${book.title}" (${book.author.name}) - ${book.total_borrowed} kali, rating ${book.rating_avg.toFixed(1)}`
    ),
  ];

  return ["STATISTIK SISTEM (data agregat)", ...lines].join("\n");
}

async function buildGeneralContext(): Promise<string> {
  const cached = globalForCache.libraryKnowledgeCache;
  const now = Date.now();

  if (cached) {
    if (cached.expiresAt > now) {
      // Stale-while-revalidate: segarkan di latar belakang sebelum kedaluwarsa
      // agar request berikutnya tidak membayar biaya query dingin.
      if (now >= cached.expiresAt - CATALOG_CACHE_REFRESH_LEAD && !cached.refreshing) {
        cached.refreshing = true;
        void refreshGeneralContext().catch(() => {
          cached.refreshing = false;
        });
      }
      return cached.data;
    }

    if (!cached.refreshing) {
      // Cache kedaluwarsa: tunggu hasil baru sekali, request lain menunggu di belakang.
      cached.refreshing = true;
      try {
        return await refreshGeneralContext();
      } catch (error) {
        cached.refreshing = false;
        throw error;
      }
    }

    // Sudah ada yang me-refresh; pakai data basi sambil menunggu (lebih baik daripada memblokir).
    return cached.data;
  }

  return refreshGeneralContext();
}

async function refreshGeneralContext(): Promise<string> {
  const [profile, rules, catalog] = await Promise.all([
    buildProfileSection(),
    buildRulesSection(),
    buildCatalogSection(),
  ]);

  const data = [profile, rules, catalog].filter(Boolean).join("\n\n");
  const value = clamp(data, MAX_CONTEXT_CHARS);

  globalForCache.libraryKnowledgeCache = {
    data: value,
    expiresAt: Date.now() + CATALOG_CACHE_TTL,
    refreshing: false,
  };

  return value;
}

/** Hangatkan cache umum perpustakaan agar chat pertama tidak lambat. */
export async function warmLibraryKnowledgeCache(): Promise<void> {
  await buildGeneralContext();
}

function buildGuidesForRole(role?: string): string[] {
  const guides = [buildWorkflowGuide()];
  if (role && STAFF_ROLES.includes(role)) guides.push(buildStaffWorkflowGuide());
  if (role === "ADMIN") guides.push(buildAdminWorkflowGuide());
  return guides;
}

export async function buildLibraryKnowledge({
  query,
  userId,
  role,
  personalOnly = false,
  includeGuides = true,
}: {
  query: string;
  userId?: string;
  role?: string;
  /** true = pertanyaan murni personal; lewati katalog & pencarian agar respons lebih cepat. */
  personalOnly?: boolean;
  /** false = pertanyaan personal tanpa konteks alur; lewati panduan statis (~4k char). */
  includeGuides?: boolean;
}): Promise<string> {
  const today = new Intl.DateTimeFormat("id-ID", {
    dateStyle: "full",
    timeZone: "Asia/Jakarta",
  }).format(new Date());

  const guides = includeGuides ? buildGuidesForRole(role) : [];

  if (personalOnly) {
    // Fast path: hanya data pengguna + aturan layanan (kuota/denda) yang relevan.
    const [rules, userData] = await Promise.all([
      buildRulesSection(),
      userId ? buildUserSection(userId) : "",
    ]);

    return clamp(
      [`HARI INI: ${today}`, ...guides, userData, rules].filter(Boolean).join("\n\n"),
      MAX_CONTEXT_CHARS
    );
  }

  const [general, relevant, userData, operations] = await Promise.all([
    buildGeneralContext(),
    buildRelevantSection(query),
    userId ? buildUserSection(userId) : "",
    role && STAFF_ROLES.includes(role) ? buildOperationsSection() : "",
  ]);

  // Panduan dulu agar tidak pernah terpotong clamp; data perpustakaan menyusul.
  return clamp(
    [
      `HARI INI: ${today}`,
      ...guides,
      userData,
      operations,
      relevant,
      general,
    ]
      .filter(Boolean)
      .join("\n\n"),
    MAX_CONTEXT_CHARS
  );
}

// Hangatkan cache umum begitu modul dimuat di server (bukan saat build),
// sehingga chat pertama tidak membayar biaya query dingin.
if (process.env.NEXT_PHASE !== "phase-production-build") {
  void warmLibraryKnowledgeCache().catch(() => {});
}