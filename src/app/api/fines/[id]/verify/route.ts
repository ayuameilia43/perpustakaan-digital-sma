import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { FINE_INCLUDE, getFinePaymentDeadlineDays, serializeFine } from "@/lib/fine";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const verifySchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().max(1000).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "LIBRARIAN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validasi gagal", issues: parsed.error.issues }, { status: 400 });
  }
  const { action, reason } = parsed.data;
  if (action === "reject" && !reason?.trim()) {
    return NextResponse.json({ error: "Alasan penolakan wajib diisi" }, { status: 400 });
  }

  const fine = await db.fine.findUnique({
    where: { id },
    include: {
      borrowing: {
        select: {
          id: true,
          borrow_code: true,
          user_id: true,
          book: { select: { title: true } },
          user: { select: { name: true } },
        },
      },
    },
  });
  if (!fine) {
    return NextResponse.json({ error: "Data denda tidak ditemukan" }, { status: 404 });
  }
  if (fine.status !== "PENDING_VERIFICATION") {
    return NextResponse.json({ error: "Hanya konfirmasi menunggu verifikasi yang bisa diverifikasi" }, { status: 409 });
  }

  const now = new Date();
  const isApprove = action === "approve";
  const nextStatus = isApprove ? "PAID" : "REJECTED";

  const updated = await db.$transaction(async (tx) => {
    const f = await tx.fine.update({
      where: { id },
      data: isApprove
        ? {
            status: "PAID",
            paid_at: now,
            verified_by_id: session.user.id,
            verified_at: now,
            rejection_reason: null,
          }
        : {
            status: "REJECTED",
            rejection_reason: reason!.trim(),
            verified_by_id: session.user.id,
            verified_at: now,
          },
    });
    if (isApprove) {
      await tx.borrowing.update({
        where: { id: fine.borrowing.id },
        data: { is_fine_paid: true, fine_amount: f.amount },
      });
    }
    return f;
  });

  await Promise.allSettled([
    db.fineStatusHistory.create({
      data: {
        fine_id: id,
        from_status: fine.status,
        to_status: nextStatus,
        actor_id: session.user.id,
        actor_name: session.user.name,
        reason: isApprove ? `Pembayaran disetujui. ${reason?.trim() ?? ""}`.trim() : reason!.trim(),
      },
    }),
    db.auditLog.create({
      data: {
        user_id: session.user.id,
        action: isApprove ? "VERIFY_FINE_PAID" : "VERIFY_FINE_REJECTED",
        entity: "Fine",
        entity_id: fine.fine_code ?? fine.id,
        details: `${session.user.name} ${isApprove ? "menyetujui" : "menolak"} pembayaran denda ${fine.fine_code ?? fine.id} (${fine.borrowing.borrow_code}) milik ${fine.borrowing.user.name}${reason?.trim() ? `: ${reason.trim()}` : ""}`,
      },
    }),
    db.notification.create({
      data: {
        user_id: fine.borrowing.user_id,
        title: isApprove ? "Pembayaran denda lunas" : "Konfirmasi pembayaran ditolak",
        message: isApprove
          ? `Pembayaran denda Rp${fine.amount.toLocaleString("id-ID")} untuk "${fine.borrowing.book.title}" telah disetujui. Terima kasih!`
          : `Konfirmasi pembayaran denda untuk "${fine.borrowing.book.title}" ditolak. Alasan: ${reason!.trim()} Silakan kirim konfirmasi kembali.`,
        type: "INFO",
      },
    }),
  ]);

  const full = await db.fine.findUnique({ where: { id }, include: FINE_INCLUDE });
  const deadlineDays = await getFinePaymentDeadlineDays();
  return NextResponse.json({
    message: isApprove ? "Pembayaran disetujui, status denda menjadi Lunas." : "Pembayaran ditolak, siswa dapat mengirim konfirmasi kembali.",
    data: full ? await serializeFine(full, deadlineDays) : updated,
  });
}
