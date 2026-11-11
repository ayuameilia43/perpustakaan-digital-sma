"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSession } from "next-auth/react";
import { BookOpen, Clock, ChevronLeft, ChevronRight, Wallet, XCircle } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

type Borrowing = {
  id: string;
  borrow_code: string;
  request_date: string;
  borrow_date: string | null;
  due_date: string | null;
  return_date: string | null;
  status: "PENDING" | "BORROWED" | "RETURNED" | "OVERDUE" | "REJECTED";
  fine_amount: number;
  is_fine_paid: boolean;
  notes: string | null;
  fine: { id: string; fine_code?: string | null; amount: number; reason: string; status: string; late_days?: number; fine_per_day?: number; due_at?: string | null; createdAt?: string } | null;
  book: {
    id: string;
    title: string;
    isbn: string;
    cover_image: string | null;
    author: { name: string };
  };
};

type Meta = { page: number; limit: number; total: number; totalPages: number };

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-900/60 text-amber-300 border border-amber-700/50",
  BORROWED: "bg-blue-900/60 text-blue-300 border border-blue-700/50",
  RETURNED: "bg-emerald-900/60 text-emerald-300 border border-emerald-700/50",
  OVERDUE: "bg-red-900/60 text-red-300 border border-red-700/50",
  REJECTED: "bg-slate-800 text-slate-400 border border-slate-700",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Menunggu",
  BORROWED: "Dipinjam",
  RETURNED: "Dikembalikan",
  OVERDUE: "Terlambat",
  REJECTED: "Ditolak",
};

function HistoryContent() {
  const { data: session } = useSession();
  const [borrowings, setBorrowings] = useState<Borrowing[]>([]);
  const [meta, setMeta] = useState<Meta>({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const fetchHistory = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "10" });
      const res = await fetch(`/api/borrowings?${params}`);
      const json = await res.json();
      setBorrowings(json.data ?? []);
      setMeta(json.meta ?? { page: 1, limit: 10, total: 0, totalPages: 0 });
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [page, session?.user?.id]);

  useEffect(() => {
  // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchHistory();
  }, [fetchHistory]);

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  };

  const daysLeft = (due: string | null) => {
    if (!due) return null;
    return Math.ceil((new Date(due).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Batalkan pengajuan peminjaman ini?")) return;
    setCancelling(id);
    setActionError("");
    try {
      const res = await fetch(`/api/borrowings/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        setActionError(json.error ?? "Gagal membatalkan pengajuan");
        return;
      }
      setBorrowings((prev) =>
        prev.map((b) => (b.id === id ? { ...b, status: "REJECTED" as const } : b))
      );
    } catch {
      setActionError("Gagal membatalkan pengajuan. Periksa koneksi Anda.");
    } finally {
      setCancelling(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <Clock className="w-7 h-7 text-amber-400" />
          Riwayat Peminjaman
        </h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Riwayat peminjaman buku Anda
        </p>
      </div>

      {actionError && (
        <p className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 px-3 py-2 rounded-xl">
          {actionError}
        </p>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider">
                <th className="text-left px-5 py-3.5">Buku</th>
                <th className="text-left px-5 py-3.5 hidden md:table-cell">Kode</th>
                <th className="text-left px-5 py-3.5 hidden lg:table-cell">Tgl Pinjam</th>
                <th className="text-left px-5 py-3.5 hidden lg:table-cell">Jatuh Tempo</th>
                <th className="text-left px-5 py-3.5">Status</th>
                <th className="text-right px-5 py-3.5">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-5 py-3.5">
                        <div className="h-4 bg-slate-800 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : borrowings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                    <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p>Belum ada riwayat peminjaman</p>
                  </td>
                </tr>
              ) : (
                borrowings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="relative w-10 h-12 rounded-lg bg-slate-800 shrink-0 overflow-hidden">
                          {b.book.cover_image ? (
                            <Image src={b.book.cover_image} alt={b.book.title} fill sizes="40px" className="object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <BookOpen className="w-5 h-5 text-slate-600" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-100 line-clamp-1">{b.book.title}</p>
                          <p className="text-xs text-slate-400">{b.book.author.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell text-slate-400 text-xs font-mono">{b.borrow_code}</td>
                    <td className="px-5 py-3.5 hidden lg:table-cell text-slate-400 text-xs">{formatDate(b.borrow_date)}</td>
                    <td className="px-5 py-3.5 hidden lg:table-cell text-xs">
                      <span className="text-slate-400">{formatDate(b.due_date)}</span>
                      {(b.status === "BORROWED" || b.status === "OVERDUE") && (() => {
                        const left = daysLeft(b.due_date);
                        if (left === null) return null;
                        return (
                          <span className={`block mt-0.5 font-bold ${left < 0 ? "text-red-400" : left <= 2 ? "text-amber-300" : "text-slate-500"}`}>
                            {left < 0 ? `Terlambat ${Math.abs(left)} hari` : left === 0 ? "Jatuh tempo hari ini" : `${left} hari lagi`}
                          </span>
                        );
                      })()}
                      {b.fine_amount > 0 && (
                        <span className="block mt-0.5 font-bold text-red-400">
                          Denda Rp{b.fine_amount.toLocaleString("id-ID")}
                          {b.is_fine_paid ? " (lunas)" : " (belum bayar)"}
                        </span>
                      )}
                      {b.fine_amount > 0 && b.fine && (
                        <Link href={`/fines/${b.fine.id}`} className="inline-flex items-center gap-1 mt-1 text-[11px] font-bold text-amber-400 hover:underline">
                          <Wallet className="w-3 h-3" /> Detail denda
                        </Link>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${STATUS_STYLES[b.status]}`}>
                        {STATUS_LABELS[b.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        {b.status === "PENDING" && (
                          <button
                            onClick={() => handleCancel(b.id)}
                            disabled={cancelling === b.id}
                            className="p-1.5 rounded-lg hover:bg-red-900/40 text-slate-400 hover:text-red-300 transition disabled:opacity-50"
                            title="Batalkan pengajuan"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                        <Link
                          href={`/books/${b.book.id}`}
                          className="p-1.5 rounded-lg hover:bg-emerald-900/40 text-slate-400 hover:text-emerald-300 transition"
                          title="Detail"
                        >
                          <BookOpen className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {meta.totalPages > 1 && (
          <div className="px-5 py-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>Menampilkan {borrowings.length} dari {meta.total} peminjaman</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-slate-800 disabled:opacity-30 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-bold text-slate-300">{page} / {meta.totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                disabled={page === meta.totalPages}
                className="p-1.5 rounded-lg hover:bg-slate-800 disabled:opacity-30 transition"
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

export default function HistoryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <HistoryContent />
    </Suspense>
  );
}
