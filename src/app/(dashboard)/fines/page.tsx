"use client";

import { FineBadge, formatDateTime, formatRupiahShort } from "@/components/fines/FineBadge";
import { AlertTriangle, CheckCircle2, Clock, Wallet, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

type FineItem = {
  id: string;
  fine_code: string;
  amount: number;
  status: string;
  late_days: number;
  fine_per_day: number;
  issued_at: string;
  due_at: string;
  remaining_days: number;
  is_overdue_payment: boolean;
  is_due_soon: boolean;
  confirmed_at: string | null;
  rejection_reason: string | null;
  borrowing: {
    id: string;
    borrow_code: string;
    borrow_date: string | null;
    due_date: string | null;
    return_date: string | null;
    book: { id: string; title: string; author: { name: string } };
    user: { name: string; role: string; class_or_dept: string | null };
  };
};

type Stats = {
  total_all: number;
  total_unpaid: number;
  unpaid_count: number;
  total_pending: number;
  pending_count: number;
  total_paid: number;
  paid_count: number;
  total_rejected: number;
  rejected_count: number;
  payment_deadline_days: number;
};

const FILTERS = [
  { value: "", label: "Semua" },
  { value: "UNPAID", label: "Belum Dibayar" },
  { value: "PENDING_VERIFICATION", label: "Menunggu Verifikasi" },
  { value: "PAID", label: "Lunas" },
  { value: "REJECTED", label: "Ditolak" },
] as const;

function FinesContent() {
  const { data: session } = useSession();
  const isStaffView = ["ADMIN", "LIBRARIAN"].includes(session?.user?.role ?? "");
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status") ?? "";
  const [fines, setFines] = useState<FineItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [status, setStatus] = useState(initialStatus);

  const fetchFines = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (status) params.set("status", status);
      const res = await fetch(`/api/fines?${params}`);
      const json = await res.json();
      if (res.ok) {
        setFines(json.data ?? []);
        setStats(json.stats ?? null);
        const meta = json.meta ?? { totalPages: 0 };
        setTotalPages(meta.totalPages ?? 0);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
  // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFines();
  }, [fetchFines]);

  const summaryCards = stats
    ? [
        { label: "Total Denda", value: formatRupiahShort(stats.total_all), icon: Wallet, color: "text-slate-300", sub: "Semua tagihan" },
        { label: "Belum Dibayar", value: formatRupiahShort(stats.total_unpaid), icon: AlertTriangle, color: "text-red-400", sub: `${stats.unpaid_count} tagihan` },
        { label: "Menunggu Verifikasi", value: formatRupiahShort(stats.total_pending), icon: Clock, color: "text-amber-400", sub: `${stats.pending_count} konfirmasi` },
        { label: "Sudah Lunas", value: formatRupiahShort(stats.total_paid), icon: CheckCircle2, color: "text-emerald-400", sub: `${stats.paid_count} tagihan` },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Wallet className="w-7 h-7 text-amber-500" />
            Manajemen Denda
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {isStaffView
              ? "Pantau dan verifikasi pembayaran denda semua siswa"
              : "Lihat ringkasan, batas pembayaran, dan konfirmasi pembayaran denda Anda"}
          </p>
        </div>
        {stats && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Tenggat pembayaran: <strong className="text-slate-800 dark:text-slate-200">{stats.payment_deadline_days} hari</strong> sejak denda diterbitkan (dapat diatur admin)
          </p>
        )}
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {summaryCards.map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-1.5">
                <Icon className={`w-5 h-5 ${c.color}`} />
                <p className="text-xl font-black text-slate-900 dark:text-white">{c.value}</p>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{c.label}</p>
                <p className="text-[11px] text-slate-400">{c.sub}</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value || "all"}
            onClick={() => {
              setStatus(f.value);
              setPage(1);
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-full border transition ${
              status === f.value
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-500"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="text-left px-5 py-3.5">Kode Denda</th>
                <th className="text-left px-5 py-3.5">Buku / Peminjam</th>
                <th className="text-left px-5 py-3.5 hidden lg:table-cell">Keterlambatan</th>
                <th className="text-left px-5 py-3.5 hidden md:table-cell">Batas Bayar</th>
                <th className="text-right px-5 py-3.5">Jumlah</th>
                <th className="text-left px-5 py-3.5">Status</th>
                <th className="text-right px-5 py-3.5">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-5 py-3.5">
                        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : fines.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                    <Wallet className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p>Belum ada data denda</p>
                  </td>
                </tr>
              ) : (
                fines.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="px-5 py-3.5">
                      <p className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">{f.fine_code}</p>
                      <p className="text-[11px] text-slate-400">{f.borrowing.borrow_code}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-800 dark:text-slate-100 line-clamp-1">{f.borrowing.book.title}</p>
                      <p className="text-[11px] text-slate-400">
                        {f.borrowing.user.name} · {f.borrowing.user.role}
                        {f.borrowing.user.class_or_dept ? ` · ${f.borrowing.user.class_or_dept}` : ""}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell text-xs text-slate-500 dark:text-slate-400">
                      {f.late_days} hari × {formatRupiahShort(f.fine_per_day)}
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell text-xs">
                      <span className="text-slate-600 dark:text-slate-300">{formatDateTime(f.due_at)}</span>
                      {f.status !== "PAID" && (
                        <span
                          className={`block mt-0.5 font-bold ${
                            f.is_overdue_payment ? "text-red-500" : f.is_due_soon ? "text-amber-500" : "text-slate-400"
                          }`}
                        >
                          {f.is_overdue_payment
                            ? `Lewat ${Math.abs(f.remaining_days)} hari`
                            : f.remaining_days === 0
                              ? "Jatuh tempo hari ini"
                              : `Sisa ${f.remaining_days} hari`}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold text-slate-900 dark:text-white">
                      {formatRupiahShort(f.amount)}
                    </td>
                    <td className="px-5 py-3.5">
                      <FineBadge status={f.status} />
                      {f.status === "REJECTED" && f.rejection_reason && (
                        <span className="block mt-1 text-[11px] text-red-400 line-clamp-1" title={f.rejection_reason}>
                          {f.rejection_reason}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/fines/${f.id}`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        Detail <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Menampilkan {fines.length} denda</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-bold text-slate-700 dark:text-slate-300">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function FinesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <FinesContent />
    </Suspense>
  );
}
