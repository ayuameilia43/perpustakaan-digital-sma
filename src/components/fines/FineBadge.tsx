import { cn } from "@/lib/utils";

export const FINE_STATUS_LABELS: Record<string, string> = {
  UNPAID: "Belum Dibayar",
  PENDING_VERIFICATION: "Menunggu Verifikasi",
  PAID: "Lunas",
  REJECTED: "Ditolak",
};

export const FINE_STATUS_STYLES: Record<string, string> = {
  UNPAID: "bg-red-900/60 text-red-300 border border-red-700/50",
  PENDING_VERIFICATION: "bg-amber-900/60 text-amber-300 border border-amber-700/50",
  PAID: "bg-emerald-900/60 text-emerald-300 border border-emerald-700/50",
  REJECTED: "bg-slate-800 text-slate-300 border border-slate-600",
};

export function FineBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "px-2 py-0.5 text-[10px] font-bold uppercase rounded-full",
        FINE_STATUS_STYLES[status] ?? FINE_STATUS_STYLES.REJECTED,
        className
      )}
    >
      {FINE_STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function formatRupiahShort(amount: number): string {
  return `Rp${amount.toLocaleString("id-ID")}`;
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTimeFull(date: string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
