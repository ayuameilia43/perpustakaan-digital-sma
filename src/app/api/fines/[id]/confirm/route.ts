import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { FINE_INCLUDE, getFinePaymentDeadlineDays, serializeFine } from "@/lib/fine";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { z } from "zod";

const MAX_PROOF_BYTES = 2 * 1024 * 1024;
const ALLOWED_EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

const metaSchema = z.object({
  payment_method: z.string().min(1, "Metode pembayaran wajib diisi").max(100),
  payment_note: z.string().max(1000).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isStaff = ["ADMIN", "LIBRARIAN"].includes(session.user.role);
  if (isStaff) {
    return NextResponse.json({ error: "Konfirmasi pembayaran dilakukan oleh siswa/peminjam" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Body harus berupa form-data" }, { status: 400 });
  }

  const parsed = metaSchema.safeParse({
    payment_method: form.get("payment_method"),
    payment_note: form.get("payment_note") || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Validasi gagal", issues: parsed.error.issues }, { status: 400 });
  }

  const fine = await db.fine.findUnique({
    where: { id },
    include: { borrowing: { select: { user_id: true, borrow_code: true, book_id: true, book: { select: { title: true } } } } },
  });
  if (!fine) {
    return NextResponse.json({ error: "Data denda tidak ditemukan" }, { status: 404 });
  }
  if (fine.borrowing.user_id !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (fine.status === "PENDING_VERIFICATION") {
    return NextResponse.json(
      { error: "Konfirmasi Anda sudah dikirim dan sedang menunggu verifikasi. Mohon tunggu hasil verifikasi." },
      { status: 409 }
    );
  }
  if (fine.status === "PAID") {
    return NextResponse.json({ error: "Denda ini sudah lunas" }, { status: 409 });
  }

  const previousStatus = fine.status;
  const proofFile = form.get("proof");
  let proofUrl: string | null = fine.proof_url;
  let proofName: string | null = fine.proof_name;

  if (proofFile instanceof File && proofFile.size > 0) {
    const ext = ALLOWED_EXTENSIONS[proofFile.type];
    if (!ext) {
      return NextResponse.json(
        { error: "Bukti pembayaran harus berupa JPG, PNG, WebP, atau PDF" },
        { status: 400 }
      );
    }
    if (proofFile.size > MAX_PROOF_BYTES) {
      return NextResponse.json({ error: "Ukuran bukti pembayaran maksimal 2 MB" }, { status: 400 });
    }
    const safeName = `${fine.id}-${Date.now()}${ext}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "payment-proofs");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, safeName), Buffer.from(await proofFile.arrayBuffer()));
    proofUrl = `uploads/payment-proofs/${safeName}`;
    proofName = proofFile.name.slice(0, 255);
  }

  const now = new Date();
  const updated = await db.fine.update({
    where: { id },
    data: {
      status: "PENDING_VERIFICATION",
      confirmed_at: now,
      payment_method: parsed.data.payment_method,
      payment_note: parsed.data.payment_note ?? null,
      proof_url: proofUrl,
      proof_name: proofName,
      rejection_reason: null,
      verified_by_id: null,
      verified_at: null,
      paid_at: null,
    },
  });

  await Promise.allSettled([
    db.fineStatusHistory.create({
      data: {
        fine_id: id,
        from_status: previousStatus,
        to_status: "PENDING_VERIFICATION",
        actor_id: session.user.id,
        actor_name: session.user.name,
        reason: `Konfirmasi pembayaran via ${parsed.data.payment_method}${proofName ? ` (bukti: ${proofName})` : ""}`,
      },
    }),
    db.notification.create({
      data: {
        user_id: session.user.id,
        title: "Konfirmasi pembayaran denda dikirim",
        message: `Konfirmasi pembayaran denda Rp${updated.amount.toLocaleString("id-ID")} untuk "${fine.borrowing.book.title}" telah diterima. Menunggu verifikasi pustakawan.`,
        type: "INFO",
      },
    }),
    db.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "CONFIRM_FINE_PAYMENT",
        entity: "Fine",
        entity_id: fine.fine_code ?? fine.id,
        details: `${session.user.name} mengonfirmasi pembayaran denda ${fine.fine_code ?? fine.id} (${fine.borrowing.borrow_code}) via ${parsed.data.payment_method}`,
      },
    }),
  ]);

  const full = await db.fine.findUnique({ where: { id }, include: FINE_INCLUDE });
  const deadlineDays = await getFinePaymentDeadlineDays();
  return NextResponse.json({
    message: "Konfirmasi pembayaran berhasil dikirim. Menunggu verifikasi pustakawan.",
    data: full ? await serializeFine(full, deadlineDays) : updated,
  });
}
