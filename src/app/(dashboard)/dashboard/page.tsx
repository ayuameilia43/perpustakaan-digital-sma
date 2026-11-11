import { RoleBadge } from "@/components/ui/Badge";
import { AiChatTrigger } from "@/components/ai/AiChatTrigger";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatRupiah } from "@/lib/utils";
import {
  AlertCircle,
  BookOpen,
  Bot,
  Clock,
  Compass,
  FileCheck,
  History,
  Library,
  Settings,
  ShieldCheck,
  Sparkles,
  Users
} from "lucide-react";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const role = session.user.role;

  // Fetch real counts from DB
  const [totalBooks, totalEbooks, activeLoansCount, systemSettingsCount, totalBorrowingsCount] = await Promise.all([
    db.book.count(),
    db.book.count({ where: { is_ebook: true } }),
    db.borrowing.count({ where: { status: "BORROWED" } }),
    db.systemSetting.count(),
    db.borrowing.count(),
  ]);

  const myActiveLoans = await db.borrowing.count({
    where: { user_id: session.user.id, status: { in: ["PENDING", "BORROWED", "OVERDUE"] } },
  });
  const myFines = await db.fine.aggregate({
    where: { borrowing: { user_id: session.user.id }, status: { not: "PAID" } },
    _sum: { amount: true },
  });

  const unpaidFinesTotal = myFines._sum.amount ?? 0;
  const isStaff = role === "ADMIN" || role === "LIBRARIAN";
  const fineByStatus = isStaff
    ? await db.fine.groupBy({ by: ["status"], _sum: { amount: true }, _count: { _all: true } })
    : [];
  const fineTotals = Object.fromEntries(
    fineByStatus.map((s) => [s.status, { total: s._sum.amount ?? 0, count: s._count._all }])
  ) as Record<string, { total: number; count: number }>;
  const pendingFinesCount = fineTotals.PENDING_VERIFICATION?.count ?? 0;
  const loansShown = isStaff ? activeLoansCount : myActiveLoans;

  // Fetch quota config from DB settings
  const quotaSetting = await db.systemSetting.findUnique({
    where: {
      key:
        role === "TEACHER"
          ? "max_borrow_teacher"
          : role === "STAFF"
          ? "max_borrow_staff"
          : "max_borrow_student",
    },
  });

  const durationSetting = await db.systemSetting.findUnique({
    where: {
      key:
        role === "TEACHER"
          ? "borrow_duration_teacher"
          : role === "STAFF"
          ? "borrow_duration_staff"
          : "borrow_duration_student",
    },
  });

  const maxBorrowQuota = quotaSetting ? parseInt(quotaSetting.value) : 3;
  const maxBorrowDays = durationSetting ? parseInt(durationSetting.value) : 7;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-700 via-teal-800 to-slate-900 text-white p-6 sm:p-8 shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-3 max-w-2xl">
          <div className="flex items-center space-x-2">
            <RoleBadge role={role} className="bg-white/20 text-white border-white/30" />
            <span className="text-xs text-emerald-200 font-mono flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Sesi Terverifikasi
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Selamat Datang, {session.user.name}! 👋
          </h1>
          <p className="text-sm text-emerald-100/90 leading-relaxed">
            Anda masuk sebagai <strong className="text-white font-bold">{session.user.role}</strong> ({session.user.class_or_dept || "SMA Negeri"}). Selamat menjelajahi koleksi buku dan layanan perpustakaan digital sekolah.
          </p>

          <div className="pt-2 flex flex-wrap gap-3">
            <Link
              href="/catalog"
              className="inline-flex items-center space-x-2 px-4 py-2 bg-white text-emerald-800 hover:bg-emerald-50 font-bold text-xs rounded-xl shadow-md transition"
            >
              <Library className="w-4 h-4" />
              <span>Jelajahi Katalog Buku</span>
            </Link>

            <AiChatTrigger
              title="Buka AI Assistant"
              className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-600/80 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl border border-emerald-400/40 backdrop-blur-xs transition"
            >
              <Bot className="w-4 h-4 text-emerald-200" />
              <span>Tanya AI Assistant</span>
            </AiChatTrigger>
          </div>
        </div>
      </div>

      {/* Quota Policy Banner */}
      <div className="bg-slate-900 text-slate-200 rounded-2xl p-4 sm:p-5 border border-slate-800 flex items-start sm:items-center justify-between flex-col sm:flex-row gap-4 shadow-sm">
        <div className="flex items-start space-x-3">
          <div className="p-2.5 bg-emerald-950 text-emerald-400 rounded-xl border border-emerald-800/60 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-100">Kebijakan Peminjaman Role Anda ({role})</h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Kuota Peminjaman: <strong className="text-emerald-400 font-semibold">{maxBorrowQuota} Buku</strong> • Durasi Maksimal: <strong className="text-emerald-400 font-semibold">{maxBorrowDays} Hari</strong>
            </p>
          </div>
        </div>
        <Link
          href="/history"
          className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 underline underline-offset-4 shrink-0"
        >
          Lihat Status Peminjaman Saya →
        </Link>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5 rounded-2xl space-y-2 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Total Koleksi Buku</span>
            <Library className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">{totalBooks} Judul</div>
          <p className="text-[11px] text-slate-500">Tersedia untuk dipinjam</p>
        </div>

        <div className="glass-card p-5 rounded-2xl space-y-2 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Koleksi E-Book</span>
            <BookOpen className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">{totalEbooks} Judul</div>
          <p className="text-[11px] text-slate-500">Bisa dibaca langsung online</p>
        </div>

        <div className="glass-card p-5 rounded-2xl space-y-2 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Peminjaman Aktif</span>
            <FileCheck className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">{loansShown} Transaksi</div>
          <p className="text-[11px] text-slate-500">{isStaff ? "Buku sedang dipinjam" : "Pinjaman aktif milik Anda"}</p>
        </div>

        <div className="glass-card p-5 rounded-2xl space-y-2 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Denda & Sanksi</span>
            <AlertCircle className="w-5 h-5 text-slate-400" />
          </div>
          <Link href="/fines" className="text-2xl font-black text-slate-900 dark:text-white hover:text-emerald-600 transition">{formatRupiah(unpaidFinesTotal)}</Link>
          <p className={`text-[11px] font-semibold ${unpaidFinesTotal > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
            {unpaidFinesTotal > 0 ? "Ada tunggakan denda — lihat detail" : "Tidak ada tunggakan denda"}
          </p>
        </div>

        <div className="glass-card p-5 rounded-2xl space-y-2 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Total Riwayat Peminjaman</span>
            <History className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">{totalBorrowingsCount} Transaksi</div>
          <p className="text-[11px] text-slate-500">Seluruh peminjaman aktif dan selesai</p>
        </div>
      </div>

      {isStaff && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Manajemen Denda</span>
              {pendingFinesCount > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-black bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 rounded-full">
                  {pendingFinesCount} menunggu verifikasi
                </span>
              )}
            </h3>
            <Link href="/fines?status=PENDING_VERIFICATION" className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline shrink-0">
              Verifikasi pembayaran →
            </Link>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/fines" className="glass-card p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 transition">
              <p className="text-xl font-black text-slate-900 dark:text-white">{formatRupiah(Object.values(fineTotals).reduce((acc, v) => acc + v.total, 0))}</p>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mt-1">Total Seluruh Denda</p>
            </Link>
            <Link href="/fines?status=UNPAID" className="glass-card p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-red-500 transition">
              <p className="text-xl font-black text-red-600 dark:text-red-400">{formatRupiah(fineTotals.UNPAID?.total ?? 0)}</p>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mt-1">Belum Dibayar</p>
            </Link>
            <Link href="/fines?status=PENDING_VERIFICATION" className="glass-card p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-amber-500 transition">
              <p className="text-xl font-black text-amber-600 dark:text-amber-400">{formatRupiah(fineTotals.PENDING_VERIFICATION?.total ?? 0)}</p>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mt-1">Menunggu Verifikasi</p>
            </Link>
            <Link href="/fines?status=PAID" className="glass-card p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 transition">
              <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{formatRupiah(fineTotals.PAID?.total ?? 0)}</p>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mt-1">Sudah Lunas</p>
            </Link>
          </div>
        </div>
      )}

      {/* Role-based Quick Modules */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-600" />
          <span>Akses Cepat Modul Utama</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/catalog"
            className="p-5 rounded-2xl glass-card border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 transition group space-y-2"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold group-hover:scale-105 transition-transform">
              <Library className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 transition">
              Katalog & Pencarian Buku
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Cari koleksi buku sekolah berdasarkan kategori, judul, pengarang, ISBN, atau lokasi rak.
            </p>
          </Link>

          <Link
            href="/ebook"
            className="p-5 rounded-2xl glass-card border border-slate-200 dark:border-slate-800 hover:border-teal-500 dark:hover:border-teal-500 transition group space-y-2"
          >
            <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 flex items-center justify-center font-bold group-hover:scale-105 transition-transform">
              <BookOpen className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-teal-600 transition">
              Perpustakaan E-Book
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Baca e-book pelajaran dan sastra digital secara fleksibel langsung di browser Anda.
            </p>
          </Link>

          <AiChatTrigger
            title="Buka AI Assistant"
            className="p-5 rounded-2xl glass-card border border-slate-200 dark:border-slate-800 hover:border-purple-500 dark:hover:border-purple-500 transition group space-y-2 text-left w-full"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold group-hover:scale-105 transition-transform">
              <Bot className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-purple-600 transition">
              AI Library Assistant
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Asisten AI cerdas untuk tanya jawab rekomendasi buku, ringkasan, dan pencarian cepat.
            </p>
          </AiChatTrigger>

          {(role === "ADMIN" || role === "LIBRARIAN") && (
            <Link
              href="/librarian/borrowings"
              className="p-5 rounded-2xl glass-card border border-slate-200 dark:border-slate-800 hover:border-amber-500 dark:hover:border-amber-500 transition group space-y-2"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold group-hover:scale-105 transition-transform">
                <Compass className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-amber-600 transition">
                Sirkulasi & Peminjaman (Pustakawan)
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Proses pengajuan peminjaman, pengembalian buku, dan kelola sanksi denda.
              </p>
            </Link>
          )}

          {role === "ADMIN" && (
            <>
              <Link
                href="/admin/system-settings"
                className="p-5 rounded-2xl glass-card border border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 transition group space-y-2"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold group-hover:scale-105 transition-transform">
                  <Settings className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 transition">
                  Pengaturan Sistem (System Settings)
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Konfigurasi denda per hari, durasi peminjaman, dan kuota maks per role. ({systemSettingsCount} config aktif)
                </p>
              </Link>

              <Link
                href="/admin/users"
                className="p-5 rounded-2xl glass-card border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 transition group space-y-2"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold group-hover:scale-105 transition-transform">
                  <Users className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 transition">
                  User & RBAC Management
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Kelola akun pengguna, reset password, dan pengutak-atikan role 5 peranan.
                </p>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
