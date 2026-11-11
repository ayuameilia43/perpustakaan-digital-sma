"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { BookOpen, CheckCircle, XCircle, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
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
  fine: { id: string; amount: number; reason: string; status: string } | null;
  user: { id: string; name: string; email: string; role: string; class_or_dept: string | null };
  book: { id: string; title: string; isbn: string; cover_image: string | null; author: { name: string } };
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

function BorrowingsContent() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [borrowings, setBorrowings] = useState<Borrowing[]>([]);
  const [meta, setMeta] = useState<Meta>({ page: 1, limit: 15, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [processing, setProcessing] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const fetchBorrowings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "15",
        ...(statusFilter && { status: statusFilter }),
      });
      const res = await fetch(`/api/borrowings?${params}`);
      const json = await res.json();
      setBorrowings(json.data ?? []);
      setMeta(json.meta ?? { page: 1, limit: 15, total: 0, totalPages: 0 });
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    if (session && !["ADMIN", "LIBRARIAN"].includes(session.user.role)) {
      router.push("/dashboard");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBorrowings();
  }, [session, router, fetchBorrowings]);

  if (sessionStatus === "loading") {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handleAction = async (b: Borrowing, action: "approve" | "reject" | "return") => {
    const labels = {
      approve: `Setujui peminjaman "${b.book.title}" oleh ${b.user.name}?`,
      reject: `Tolak pengajuan "${b.book.title}" oleh ${b.user.name}?`,
      return: `Catat pengembalian "${b.book.title}" oleh ${b.user.name}? Denda keterlambatan (jika ada) dihitung otomatis.`,
    };
    if (!confirm(labels[action])) return;
    setProcessing(b.id);
    setActionError("");
    try {
      const res = await fetch(`/api/borrowings/${b.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) {
        setActionError(json.error ?? "Gagal memproses peminjaman");
        return;
      }
      fetchBorrowings();
    } catch {
      setActionError("Gagal memproses peminjaman. Periksa koneksi Anda.");
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  };

  const isLate = (b: Borrowing) =>
    (b.status === "BORROWED" || b.status === "OVERDUE") &&
    b.due_date !== null &&
    new Date(b.due_date).getTime() < Date.now();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-amber-400" />
            Proses Peminjaman
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">Kelola pengajuan peminjaman dan pengembalian buku</p>
        </div>
        <button
          onClick={() => { setPage(1); fetchBorrowings(); }}
          className="p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-400 hover:text-slate-200 transition"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex gap-2">
        {["", "PENDING", "BORROWED", "RETURNED", "OVERDUE"].map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
              statusFilter === s
                ? "bg-amber-600 text-white"
                : "bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200"
            }`}
          >
            {s === "" ? "Semua" : STATUS_LABELS[s]}
          </button>
        ))}
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
                <th className="text-left px-5 py-3.5 hidden md:table-cell">Peminjam</th>
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
                    <p>Tidak ada data peminjaman</p>
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
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">{b.borrow_code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <p className="text-slate-300 text-xs font-semibold">{b.user.name}</p>
                      <p className="text-[10px] text-slate-500">{b.user.class_or_dept || b.user.role}</p>
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell text-slate-400 text-xs">{formatDate(b.borrow_date)}</td>
                    <td className="px-5 py-3.5 hidden lg:table-cell text-xs">
                      <span className={isLate(b) ? "text-red-400 font-bold" : "text-slate-400"}>
                        {formatDate(b.due_date)}
                      </span>
                      {isLate(b) && (
                        <span className="block text-[10px] font-bold text-red-400">LEWAT TEMPO</span>
                      )}
                      {b.fine_amount > 0 && (
                        <span className="block text-[10px] font-bold text-amber-300">
                          Denda Rp{b.fine_amount.toLocaleString("id-ID")}
                          {b.is_fine_paid ? " (lunas)" : ""}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${STATUS_STYLES[b.status]}`}>
                        {STATUS_LABELS[b.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        {b.status === "PENDING" && (
                          <>
                            <button
                              onClick={() => handleAction(b, "approve")}
                              disabled={processing === b.id}
                              className="p-1.5 rounded-lg hover:bg-emerald-900/40 text-slate-400 hover:text-emerald-300 transition disabled:opacity-50"
                              title="Setujui"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleAction(b, "reject")}
                              disabled={processing === b.id}
                              className="p-1.5 rounded-lg hover:bg-red-900/40 text-slate-400 hover:text-red-300 transition disabled:opacity-50"
                              title="Tolak"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {(b.status === "BORROWED" || b.status === "OVERDUE") && (
                          <button
                            onClick={() => handleAction(b, "return")}
                            disabled={processing === b.id}
                            className="p-1.5 rounded-lg hover:bg-blue-900/40 text-slate-400 hover:text-blue-300 transition disabled:opacity-50"
                            title="Kembalikan"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        <Link
                          href={`/books/${b.book.id}`}
                          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
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

export default function BorrowingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <BorrowingsContent />
    </Suspense>
  );
}
