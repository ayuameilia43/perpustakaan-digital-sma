import type { Role } from "@prisma/client";
import { db } from "@/lib/db";

export type BorrowPolicy = {
  maxBorrow: number;
  durationDays: number;
  finePerDay: number;
};

const DEFAULTS: Record<string, BorrowPolicy> = {
  STUDENT: { maxBorrow: 3, durationDays: 7, finePerDay: 2000 },
  TEACHER: { maxBorrow: 7, durationDays: 14, finePerDay: 1000 },
  STAFF: { maxBorrow: 5, durationDays: 10, finePerDay: 1000 },
  LIBRARIAN: { maxBorrow: 7, durationDays: 14, finePerDay: 1000 },
  ADMIN: { maxBorrow: 7, durationDays: 14, finePerDay: 1000 },
};

function roleSuffix(role: string): string {
  if (role === "TEACHER") return "teacher";
  if (role === "STAFF") return "staff";
  return "student";
}

/** Ambil kebijakan peminjaman untuk suatu role dari SystemSetting (fallback ke default). */
export async function getBorrowPolicy(role: Role | string): Promise<BorrowPolicy> {
  const suffix = roleSuffix(role);
  const fallback = DEFAULTS[role] ?? DEFAULTS.STUDENT;
  try {
    const settings = await db.systemSetting.findMany({
      where: {
        key: {
          in: [`max_borrow_${suffix}`, `borrow_duration_${suffix}`, `fine_per_day_${suffix}`],
        },
      },
    });
    const get = (key: string) => settings.find((s) => s.key === key)?.value;
    const num = (v: string | undefined, d: number) => {
      const n = parseInt(v ?? "", 10);
      return Number.isFinite(n) && n >= 0 ? n : d;
    };
    return {
      maxBorrow: num(get(`max_borrow_${suffix}`), fallback.maxBorrow),
      durationDays: num(get(`borrow_duration_${suffix}`), fallback.durationDays),
      finePerDay: num(get(`fine_per_day_${suffix}`), fallback.finePerDay),
    };
  } catch {
    return fallback;
  }
}

export function calcDueDate(from: Date, durationDays: number): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + durationDays);
  return d;
}

/** Hitung hari keterlambatan (pembulatan ke atas, 0 jika belum lewat tempo). */
export function calcLateDays(dueDate: Date | null, returnedAt: Date = new Date()): number {
  if (!dueDate) return 0;
  const diffMs = returnedAt.getTime() - new Date(dueDate).getTime();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

export function calcFine(lateDays: number, finePerDay: number): number {
  return Math.max(0, lateDays) * Math.max(0, finePerDay);
}

export function generateBorrowCode(): string {
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate()
  ).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `BRW-${ymd}-${rand}`;
}
