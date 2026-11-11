"use client";

import {
  FineBadge,
  formatDateTime,
  formatDateTimeFull,
  formatRupiahShort,
} from "@/components/fines/FineBadge";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  Wallet,
  XCircle,
} from "lucide-react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

type FineDetail = {
  id: string;
  fine_code: string;
  amount: number;
  reason: string;
  status: string;
  late_days: number;
  fine_per_day: number;
  issued_at: string;
  due_at: string;
  payment_deadline_days: number;
  remaining_days: number;
  is_overdue_payment: boolean;
  is_due_soon: boolean;
  paid_at: string | null;
  confirmed_at: string | null;
  payment_method: string | null;
  payment_note: string | null;
  proof_name: string | null;
  proof_available: boolean;
  proof_url: string | null;
  rejection_reason: string | null;
  verified_at: string | null;
  verified_by: { id: string; name: string } | null;
  borrowing: {
    id: string;
    borrow_code: string;
    borrow_date: string | null;
    due_date: string | null;
    return_date: string | null;
    book: { id: string; title: string; isbn: string; cover_image: string | null; author: { name: string } };
    user: { id: string; name: string; email: string; role: string; class_or_dept: string | null };
  };
  histories: Array<{
    id: string;
    from_status: string | null;
    to_status: string;
    actor_name: string | null;
    reason: string | null;
    createdAt: string;
  }>;
};

function DetailContent() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data: session } = useSession();
  const isStaff = ["ADMIN", "LIBRARIAN"].includes(session?.user?.role ?? "");

  const [fine, setFine] = useState<FineDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("Tunai di perpustakaan");
  const [paymentNote, setPaymentNote] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/fines/${id}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Gagal memuat detail denda");
        return;
      }
      setFine(json.data);
    } catch {
      setError("Gagal memuat detail denda. Periksa koneksi Anda.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
  // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDetail();
  }, [fetchDetail]);

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fine) return;
    setSubmitting(true);
    setToast("");
    setError("");
    try {
      const form = new FormData();
      form.set("payment_method", paymentMethod);
      if (paymentNote.trim()) form.set("payment_note", paymentNote.trim());
      if (proofFile) form.set("proof", proofFile);
      const res = await fetch(`/api/fines/${fine.id}/confirm`, { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Gagal mengirim konfirmasi");
        return;
      }
      setToast(json.message ?? "Konfirmasi pembayaran berhasil dikirim. Menunggu verifikasi pustakawan.");
      setPaymentNote("");
      setProofFile(null);
      await fetchDetail();
    } catch {
      setError("Gagal mengirim konfirmasi. Periksa koneksi Anda.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (action: "approve" | "reject") => {
    if (!fine) return;
    if (action === "reject" && !rejectReason.trim()) {
      setError("Alasan penolakan wajib diisi");
      return;
    }
    if (action === "approve" && !confirm("Setujui pembayaran ini? Status akan berubah menjadi Lunas.")) return;
    setVerifying(true);
    setError("");
    setToast("");
    try {
      const res = await fetch(`/api/fines/${fine.id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: rejectReason.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Gagal memverifikasi pembayaran");
        return;
      }
      setToast(json.message ?? "Verifikasi tersimpan.");
      setRejectReason("");
      await fetchDetail();
    } catch {
      setError("Gagal memverifikasi pembayaran. Periksa koneksi Anda.");
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!fine) {
    return (
      <div className="py-20 text-center text-slate-500">
        <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>{error || "Data denda tidak ditemukan"}</p>
        <Link href="/fines" className="text-emerald-600 underline text-sm mt-2 inline-block">
          Kembali ke daftar denda
        </Link>
      </div>
    );
  }

  const b = fine.borrowing;
  const canConfirm = !isStaff && (fine.status === "UNPAID" || fine.status === "REJECTED");
  const canVerify = isStaff && fine.status === "PENDING_VERIFICATION";

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Link href="/fines" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
        <ArrowLeft className="w-4 h-4" /> Kembali ke daftar denda
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Wallet className="w-7 h-7 text-amber-500" />
            Detail Denda
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            No. Transaksi <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{fine.fine_code}</span>
            {" · "}{b.borrow_code}
          </p>
        </div>
        <FineBadge status={fine.status} className="self-start" />
      </div>

      {toast && (
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-4 py-3 rounded-2xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {toast}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-4 py-3 rounded-2xl flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Denda</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{formatRupiahShort(fine.amount)}</p>
          <p className="text-xs text-slate-400 mt-1">Diterbitkan {formatDateTime(fine.issued_at)}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <CalendarDays className="w-3.5 h-3.5" /> Batas Pembayaran
          </p>
          <p className="text-lg font-black text-slate-900 dark:text-white mt-1">{formatDateTime(fine.due_at)}</p>
          <p className={`text-xs font-bold mt-1 ${fine.status === "PAID" ? "text-emerald-500" : fine.is_overdue_payment ? "text-red-500" : "text-slate-500"}`}>
            {fine.status === "PAID"
              ? `Lunas ${fine.paid_at ? formatDateTime(fine.paid_at) : ""}`
              : fine.is_overdue_payment
                ? `Lewat ${Math.abs(fine.remaining_days)} hari — segera bayar`
                : fine.remaining_days === 0
                  ? "Jatuh tempo hari ini"
                  : `Sisa ${fine.remaining_days} hari lagi`}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Keterlambatan
          </p>
          <p className="text-lg font-black text-slate-900 dark:text-white mt-1">
            {fine.late_days} hari <span className="text-sm font-bold text-slate-500">× {formatRupiahShort(fine.fine_per_day)}</span>
          </p>
          <p className="text-xs text-slate-400 mt-1">{fine.reason}</p>
        </div>
      </div>

      {fine.is_overdue_payment && (
        <p className="text-sm font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-4 py-3 rounded-2xl">
          Pembayaran sudah melewati batas waktu ({formatDateTime(fine.due_at)}). Segera selesaikan untuk dapat meminjam kembali.
        </p>
      )}
      {fine.status === "REJECTED" && fine.rejection_reason && (
        <p className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-4 py-3 rounded-2xl">
          <strong>Alasan penolakan:</strong> {fine.rejection_reason}
        </p>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-black uppercase tracking-wider text-slate-500">Informasi Peminjaman</h2>
        <div className="flex items-start gap-4">
          <div className="relative w-14 h-20 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0 overflow-hidden">
            {b.book.cover_image ? (
              <Image src={b.book.cover_image} alt={b.book.title} fill sizes="56px" className="object-cover" />
            ) : (
              <FileText className="w-6 h-6 m-auto mt-7 text-slate-400" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-slate-900 dark:text-white">{b.book.title}</p>
            <p className="text-xs text-slate-500">oleh {b.book.author.name} · ISBN {b.book.isbn}</p>
            <p className="text-xs text-slate-500 mt-1">
              Peminjam: <strong className="text-slate-700 dark:text-slate-300">{b.user.name}</strong>
              {b.user.class_or_dept ? ` · ${b.user.class_or_dept}` : ""} · {b.user.role}
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm border-t border-slate-100 dark:border-slate-800 pt-4">
          <div>
            <dt className="text-[11px] uppercase font-bold text-slate-400">Tgl Peminjaman</dt>
            <dd className="text-slate-700 dark:text-slate-200 mt-0.5">{formatDateTime(b.borrow_date)}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase font-bold text-slate-400">Jatuh Tempo Kembali</dt>
            <dd className="text-slate-700 dark:text-slate-200 mt-0.5">{formatDateTime(b.due_date)}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase font-bold text-slate-400">Tgl Pengembalian</dt>
            <dd className="text-slate-700 dark:text-slate-200 mt-0.5">{formatDateTime(b.return_date)}</dd>
          </div>
        </dl>
      </div>

      {(fine.confirmed_at || fine.payment_method) && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-500">Konfirmasi Pembayaran</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-[11px] uppercase font-bold text-slate-400">Dikonfirmasi</dt>
              <dd className="text-slate-700 dark:text-slate-200 mt-0.5">{formatDateTimeFull(fine.confirmed_at)}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase font-bold text-slate-400">Metode</dt>
              <dd className="text-slate-700 dark:text-slate-200 mt-0.5">{fine.payment_method ?? "—"}</dd>
            </div>
            {fine.payment_note && (
              <div className="col-span-2">
                <dt className="text-[11px] uppercase font-bold text-slate-400">Catatan</dt>
                <dd className="text-slate-700 dark:text-slate-200 mt-0.5">{fine.payment_note}</dd>
              </div>
            )}
          </dl>
          {fine.proof_available && fine.proof_url ? (
            <div>
              <p className="text-[11px] uppercase font-bold text-slate-400 mb-1.5">Bukti Pembayaran{fine.proof_name ? ` (${fine.proof_name})` : ""}</p>
              {/\.(jpe?g|png|webp)$/i.test(fine.proof_name ?? "") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fine.proof_url} alt="Bukti pembayaran" className="max-h-64 rounded-xl border border-slate-200 dark:border-slate-700" />
              ) : (
                <a href={fine.proof_url} target="_blank" rel="noreferrer" className="text-sm font-bold text-emerald-600 hover:underline">
                  Lihat bukti pembayaran
                </a>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-400">Tidak ada bukti pembayaran terlampir.</p>
          )}
          {fine.verified_at && fine.verified_by && (
            <p className="text-xs text-slate-400">
              Diverifikasi oleh {fine.verified_by.name} · {formatDateTimeFull(fine.verified_at)}
            </p>
          )}
        </div>
      )}

      {canConfirm && (
        <form onSubmit={handleConfirm} className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-5 space-y-4">
          <h2 className="font-black text-slate-900 dark:text-white">Konfirmasi Pembayaran</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Setelah konfirmasi, status menjadi <strong>Menunggu Verifikasi</strong> — denda belum lunas sampai pustakawan menyetujui.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Metode pembayaran *</span>
              <input
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                required
                maxLength={100}
                className="mt-1 w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-emerald-500"
                placeholder="cth. Tunai di perpustakaan, transfer bank, QRIS"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Bukti pembayaran (JPG/PNG/PDF, maks 2 MB)</span>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                className="mt-1 w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-emerald-600 file:text-white file:text-xs file:font-bold"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Catatan (opsional)</span>
            <textarea
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              maxLength={1000}
              rows={2}
              className="mt-1 w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-emerald-500"
            />
          </label>
          <button
            type="submit"
            disabled={submitting || !paymentMethod.trim()}
            className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl disabled:opacity-50"
          >
            {submitting ? "Mengirim..." : "Konfirmasi Pembayaran"}
          </button>
        </form>
      )}

      {fine.status === "PENDING_VERIFICATION" && !isStaff && (
        <p className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-4 py-3 rounded-2xl">
          Konfirmasi sudah dikirim pada {formatDateTimeFull(fine.confirmed_at)} dan sedang menunggu verifikasi pustakawan. Anda tidak dapat mengirim konfirmasi baru selama status ini.
        </p>
      )}

      {canVerify && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <h2 className="font-black text-slate-900 dark:text-white">Verifikasi Pembayaran</h2>
          <label className="block">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Alasan penolakan (wajib jika menolak)</span>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              maxLength={1000}
              rows={2}
              placeholder="Contoh: Bukti tidak terbaca, nominal tidak sesuai..."
              className="mt-1 w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-emerald-500"
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => handleVerify("approve")}
              disabled={verifying}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl disabled:opacity-50 inline-flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" /> Setujui (Lunas)
            </button>
            <button
              onClick={() => handleVerify("reject")}
              disabled={verifying}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl disabled:opacity-50 inline-flex items-center gap-2"
            >
              <XCircle className="w-4 h-4" /> Tolak
            </button>
          </div>
        </div>
      )}

      {fine.histories.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-500 mb-4">Riwayat Perubahan Status</h2>
          <ol className="relative border-l border-slate-200 dark:border-slate-700 ml-2 space-y-5">
            {fine.histories.map((h) => (
              <li key={h.id} className="ml-4">
                <span className="absolute -left-1.5 mt-1 w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-white dark:ring-slate-900" />
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {h.from_status ? `${h.from_status} → ` : ""}{h.to_status}
                </p>
                <p className="text-xs text-slate-400">
                  {formatDateTimeFull(h.createdAt)}
                  {h.actor_name ? ` · oleh ${h.actor_name}` : ""}
                </p>
                {h.reason && <p className="text-xs text-slate-500 mt-0.5">{h.reason}</p>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

export default function FineDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <DetailContent />
    </Suspense>
  );
}
