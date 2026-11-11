"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { BookUp, Loader2, CheckCircle } from "lucide-react";

type Props = {
  bookId: string;
  bookTitle: string;
  stockAvailable: number;
};

/**
 * Tombol + dialog "Ajukan Peminjaman" untuk buku fisik.
 * Alur: klik → isi catatan (opsional) → POST /api/borrowings → PENDING → pantau di /history.
 */
export function BorrowAction({ bookId, bookTitle, stockAvailable }: Props) {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successCode, setSuccessCode] = useState("");

  if (status === "loading") {
    return (
      <div className="h-11 rounded-xl bg-slate-800 animate-pulse" aria-label="Memuat status peminjaman" />
    );
  }

  if (!session) {
    return (
      <Link
        href={`/login?callbackUrl=/books/${bookId}`}
        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl transition"
      >
        <BookUp className="w-4 h-4" /> Login untuk Meminjam
      </Link>
    );
  }

  const outOfStock = stockAvailable <= 0;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/borrowings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ book_id: bookId, notes: notes || undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Gagal mengajukan peminjaman");
        return;
      }
      setSuccessCode(json.data.borrow_code);
      setOpen(false);
      setNotes("");
    } catch {
      setError("Gagal mengajukan peminjaman. Periksa koneksi Anda.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-2">
      {successCode ? (
        <div className="rounded-xl bg-emerald-950/50 border border-emerald-800/50 p-3 text-center">
          <CheckCircle className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
          <p className="text-xs font-bold text-emerald-300">Pengajuan terkirim! ({successCode})</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Tunggu persetujuan pustakawan, pantau di{" "}
            <Link href="/history" className="text-emerald-400 font-bold hover:underline">
              Riwayat Peminjaman
            </Link>
          </p>
        </div>
      ) : (
        <button
          onClick={() => {
            setError("");
            setOpen(true);
          }}
          disabled={outOfStock}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition"
          title={outOfStock ? "Stok habis" : `Ajukan peminjaman "${bookTitle}"`}
        >
          <BookUp className="w-4 h-4" />
          {outOfStock ? "Stok Habis" : "Ajukan Peminjaman"}
        </button>
      )}

      {error && !open && (
        <p className="text-[11px] text-red-400 bg-red-950/40 border border-red-800/50 px-3 py-2 rounded-lg">
          {error}
        </p>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="font-black text-white">Ajukan Peminjaman</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-200 transition text-xl leading-none"
                aria-label="Tutup"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-slate-300">
                Buku: <span className="font-bold text-white">{bookTitle}</span>
              </p>
              <p className="text-[11px] text-slate-500">
                Pengajuan berstatus <strong className="text-amber-300">PENDING</strong> dan perlu
                disetujui pustakawan. Ambil buku fisik di perpustakaan setelah disetujui.
              </p>
              {error && (
                <p className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 px-3 py-2 rounded-lg">
                  {error}
                </p>
              )}
              <div>
                <label htmlFor="borrow-notes" className="text-xs text-slate-400 font-semibold block mb-1">
                  Catatan (opsional)
                </label>
                <textarea
                  id="borrow-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Contoh: untuk tugas Biologi kelas XI..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition resize-none"
                />
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl transition disabled:opacity-60"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {submitting ? "Mengirim..." : "Kirim Pengajuan"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
