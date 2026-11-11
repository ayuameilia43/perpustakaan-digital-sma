import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateBorrowCode, getBorrowPolicy } from "@/lib/borrowing";
import { sendToAdmins, sendToUser } from "@/lib/telegram";

const createBorrowSchema = z.object({
  book_id: z.string().min(1),
  notes: z.string().max(500).optional(),
});

/** Tandai peminjaman yang lewat tempo sebagai OVERDUE (idempoten). */
async function syncOverdue() {
  const now = new Date();
  const overdue = await db.borrowing.findMany({
    where: { status: "BORROWED", due_date: { lt: now } },
    select: { id: true, user_id: true, book_id: true },
  });
  if (overdue.length === 0) return;
  await db.borrowing.updateMany({
    where: { id: { in: overdue.map((o) => o.id) } },
    data: { status: "OVERDUE" },
  });
  await db.notification.createMany({
    data: overdue.map((o) => ({
      user_id: o.user_id,
      title: "Buku lewat jatuh tempo",
      message: "Salah satu buku pinjaman Anda telah melewati jatuh tempo. Segera kembalikan untuk menghindari denda.",
      type: "OVERDUE_ALERT" as const,
    })),
  });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "10");
  const status = searchParams.get("status") ?? "";
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (["ADMIN", "LIBRARIAN"].includes(session.user.role)) {
    // Sinkronisasi overdue saat pustakawan memuat data sirkulasi
    await syncOverdue();
    if (status) where.status = status;
  } else {
    where.user_id = session.user.id;
    if (status) where.status = status;
  }

  const [borrowings, total] = await Promise.all([
    db.borrowing.findMany({
      where,
      skip,
      take: limit,
      include: {
        book: { select: { id: true, title: true, isbn: true, cover_image: true, author: { select: { name: true } } } },
        user: { select: { id: true, name: true, email: true, role: true, class_or_dept: true } },
        fine: { select: { id: true, fine_code: true, amount: true, reason: true, status: true, late_days: true, fine_per_day: true, due_at: true, createdAt: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.borrowing.count({ where }),
  ]);

  return NextResponse.json({
    data: borrowings,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createBorrowSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validasi gagal", issues: parsed.error.issues }, { status: 400 });
  }

  const book = await db.book.findUnique({ where: { id: parsed.data.book_id } });
  if (!book) {
    return NextResponse.json({ error: "Buku tidak ditemukan" }, { status: 404 });
  }

  if (book.is_ebook) {
    return NextResponse.json({ error: "E-book tidak perlu dipinjam, bisa dibaca langsung" }, { status: 400 });
  }

  if (book.stock_available <= 0) {
    return NextResponse.json({ error: "Stok buku tidak tersedia" }, { status: 400 });
  }

  // 1. Cegah pengajuan ganda untuk buku yang sama
  const existing = await db.borrowing.findFirst({
    where: {
      user_id: session.user.id,
      book_id: book.id,
      status: { in: ["PENDING", "BORROWED", "OVERDUE"] },
    },
  });
  if (existing) {
    const msg =
      existing.status === "PENDING"
        ? "Pengajuan Anda untuk buku ini masih menunggu persetujuan"
        : "Anda masih meminjam buku ini";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // 2. Tegakkan kuota peminjaman aktif per role
  const policy = await getBorrowPolicy(session.user.role);
  const activeCount = await db.borrowing.count({
    where: { user_id: session.user.id, status: { in: ["PENDING", "BORROWED", "OVERDUE"] } },
  });
  if (activeCount >= policy.maxBorrow) {
    return NextResponse.json(
      { error: `Kuota peminjaman Anda penuh (${policy.maxBorrow} buku). Kembalikan buku lain terlebih dahulu.` },
      { status: 400 }
    );
  }

  // 3. Blokir jika ada tunggakan (overdue aktif / denda belum dibayar)
  const [hasOverdue, unpaidFine] = await Promise.all([
    db.borrowing.findFirst({
      where: { user_id: session.user.id, status: "OVERDUE" },
      select: { id: true },
    }),
    db.fine.findFirst({
      where: { borrowing: { user_id: session.user.id }, status: { not: "PAID" } },
      select: { id: true },
    }),
  ]);
  if (hasOverdue) {
    return NextResponse.json(
      { error: "Anda memiliki pinjaman yang lewat tempo. Kembalikan terlebih dahulu sebelum meminjam lagi." },
      { status: 400 }
    );
  }
  if (unpaidFine) {
    return NextResponse.json(
      { error: "Anda memiliki denda yang belum dibayar. Selesaikan pembayaran denda terlebih dahulu." },
      { status: 400 }
    );
  }

  const borrowing = await db.borrowing.create({
    data: {
      borrow_code: generateBorrowCode(),
      user_id: session.user.id,
      book_id: book.id,
      notes: parsed.data.notes,
      status: "PENDING",
    },
    include: {
      book: { select: { id: true, title: true, isbn: true, cover_image: true, author: { select: { name: true } } } },
      user: { select: { id: true, name: true, email: true, role: true, class_or_dept: true } },
    },
  });

  // Notifikasi + audit (best-effort, jangan gagalkan pengajuan)
  await Promise.allSettled([
    db.notification.create({
      data: {
        user_id: session.user.id,
        title: "Pengajuan peminjaman diterima",
        message: `Pengajuan peminjaman "${book.title}" (${borrowing.borrow_code}) menunggu persetujuan pustakawan.`,
        type: "INFO",
      },
    }),
    db.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "REQUEST_BORROW",
        entity: "Borrowing",
        entity_id: borrowing.borrow_code,
        details: `Pengajuan pinjam "${book.title}" oleh ${session.user.name}`,
      },
    }),
    sendToUser(session.user.id, {
      type: "BORROW_REQUEST",
      data: {
        borrow_code: borrowing.borrow_code,
        book_title: book.title,
        user_name: session.user.name,
        user_role: session.user.role,
        notes: parsed.data.notes,
      },
    }),
    sendToAdmins({
      type: "BORROW_REQUEST",
      data: {
        borrow_code: borrowing.borrow_code,
        book_title: book.title,
        user_name: session.user.name,
        user_role: session.user.role,
        notes: parsed.data.notes,
      },
    }),
  ]);

  return NextResponse.json({ data: borrowing }, { status: 201 });
}
