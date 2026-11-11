import { db } from "@/lib/db";
import { calcLateDays, getBorrowPolicy } from "@/lib/borrowing";

/** Kunci SystemSetting: tenggat pembayaran denda dalam hari sejak denda diterbitkan. */
export const FINE_DEADLINE_SETTING_KEY = "fine_payment_deadline_days";
/** Nilai cadangan bila setting belum ada di DB (tetap dapat diubah admin lewat System Settings). */
export const DEFAULT_FINE_DEADLINE_DAYS = 7;

export async function getFinePaymentDeadlineDays(): Promise<number> {
  try {
    const setting = await db.systemSetting.findUnique({
      where: { key: FINE_DEADLINE_SETTING_KEY },
    });
    const n = parseInt(setting?.value ?? "", 10);
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_FINE_DEADLINE_DAYS;
  } catch {
    return DEFAULT_FINE_DEADLINE_DAYS;
  }
}

/** Batas pembayaran: snapshot `due_at` bila ada, jika tidak createdAt + tenggat dari setting. */
export function calcFineDueAt(
  fine: { due_at: Date | null; createdAt: Date },
  deadlineDays: number
): Date {
  if (fine.due_at) return new Date(fine.due_at);
  const d = new Date(fine.createdAt);
  d.setDate(d.getDate() + deadlineDays);
  return d;
}

export function calcFineDueAtFrom(createdAt: Date, deadlineDays: number): Date {
  const d = new Date(createdAt);
  d.setDate(d.getDate() + deadlineDays);
  return d;
}

/** Urai "Terlambat 5 hari (Rp2.000/hari)" -> { lateDays, finePerDay } untuk denda lama tanpa snapshot. */
export function parseFineReason(reason: string): { lateDays: number; finePerDay: number } {
  const m = /Terlambat\s+(\d+)\s+hari\s*\(Rp([\d.]+)\/hari\)/i.exec(reason ?? "");
  if (!m) return { lateDays: 0, finePerDay: 0 };
  return {
    lateDays: parseInt(m[1], 10) || 0,
    finePerDay: parseInt(m[2].replace(/\./g, ""), 10) || 0,
  };
}

export function generateFineCode(): string {
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate()
  ).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `DN-${ymd}-${rand}`;
}

export type FineWithBorrowing = {
  id: string;
  fine_code: string | null;
  amount: number;
  reason: string;
  status: string;
  late_days: number;
  fine_per_day: number;
  due_at: Date | null;
  paid_at: Date | null;
  confirmed_at: Date | null;
  payment_method: string | null;
  payment_note: string | null;
  proof_url: string | null;
  proof_name: string | null;
  rejection_reason: string | null;
  verified_at: Date | null;
  createdAt: Date;
  updatedAt: Date;
  borrowing: {
    id: string;
    borrow_code: string;
    request_date: Date;
    borrow_date: Date | null;
    due_date: Date | null;
    return_date: Date | null;
    fine_amount: number;
    is_fine_paid: boolean;
    book: { id: string; title: string; isbn: string; cover_image: string | null; author: { name: string } };
    user: { id: string; name: string; email: string; role: string; class_or_dept: string | null };
  };
  verified_by: { id: string; name: string } | null;
};

/** Bentuk respons detail/listing denda yang dipakai halaman siswa & admin. */
export async function serializeFine(fine: FineWithBorrowing, deadlineDays: number) {
  const parsed = parseFineReason(fine.reason);
  let lateDays = fine.late_days;
  let finePerDay = fine.fine_per_day;
  if ((!lateDays && parsed.lateDays) || (!finePerDay && parsed.finePerDay)) {
    lateDays = lateDays || parsed.lateDays;
    finePerDay = finePerDay || parsed.finePerDay;
  }
  if (!finePerDay) {
    try {
      const policy = await getBorrowPolicy(fine.borrowing.user.role);
      finePerDay = policy.finePerDay;
    } catch {
      finePerDay = 0;
    }
  }
  if (!lateDays && fine.borrowing.due_date && fine.borrowing.return_date) {
    lateDays = calcLateDays(fine.borrowing.due_date, new Date(fine.borrowing.return_date));
  }
  const dueAt = calcFineDueAt(fine, deadlineDays);
  const now = new Date();
  const remainingDays = Math.ceil((dueAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  const isOverduePayment = fine.status !== "PAID" && remainingDays < 0;
  const isDueSoon = fine.status !== "PAID" && remainingDays >= 0 && remainingDays <= 3;

  return {
    id: fine.id,
    fine_code: fine.fine_code ?? `DN-${fine.borrowing.borrow_code}`,
    amount: fine.amount,
    reason: fine.reason,
    status: fine.status,
    late_days: lateDays,
    fine_per_day: finePerDay,
    issued_at: fine.createdAt,
    due_at: dueAt,
    payment_deadline_days: deadlineDays,
    remaining_days: remainingDays,
    is_overdue_payment: isOverduePayment,
    is_due_soon: isDueSoon,
    paid_at: fine.paid_at,
    confirmed_at: fine.confirmed_at,
    payment_method: fine.payment_method,
    payment_note: fine.payment_note,
    proof_name: fine.proof_name,
    proof_available: Boolean(fine.proof_url),
    proof_url: fine.proof_url ? `/api/fines/${fine.id}/proof` : null,
    rejection_reason: fine.rejection_reason,
    verified_at: fine.verified_at,
    verified_by: fine.verified_by,
    borrowing: fine.borrowing,
  };
}

export const FINE_INCLUDE = {
  borrowing: {
    include: {
      book: {
        select: {
          id: true,
          title: true,
          isbn: true,
          cover_image: true,
          author: { select: { name: true } },
        },
      },
      user: {
        select: { id: true, name: true, email: true, role: true, class_or_dept: true },
      },
    },
  },
  verified_by: { select: { id: true, name: true } },
} as const;
