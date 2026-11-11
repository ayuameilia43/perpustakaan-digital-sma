import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { calcDueDate, calcFine, calcLateDays, getBorrowPolicy } from "@/lib/borrowing";
import { getFinePaymentDeadlineDays, generateFineCode } from "@/lib/fine";
import { sendToUser } from "@/lib/telegram";

const updateBorrowSchema = z.object({
  action: z.enum(["approve", "reject", "return"]),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "LIBRARIAN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateBorrowSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validasi gagal", issues: parsed.error.issues }, { status: 400 });
  }

  const borrowing = await db.borrowing.findUnique({
    where: { id },
    include: { book: true, bookCopy: true, user: true },
  });

  if (!borrowing) {
    return NextResponse.json({ error: "Peminjaman tidak ditemukan" }, { status: 404 });
  }

  const { action } = parsed.data;
  let auditAction = "";
  let auditDetails = "";

  if (action === "approve") {
    if (borrowing.status !== "PENDING") {
      return NextResponse.json({ error: "Hanya peminjaman PENDING yang bisa disetujui" }, { status: 400 });
    }

    const book = await db.book.findUnique({ where: { id: borrowing.book_id } });
    if (!book || book.stock_available <= 0) {
      return NextResponse.json({ error: "Stok buku tidak tersedia" }, { status: 400 });
    }

    const availableCopy = await db.bookCopy.findFirst({
      where: { book_id: borrowing.book_id, status: "AVAILABLE" },
      orderBy: { copy_code: "asc" },
    });
    if (!availableCopy) {
      return NextResponse.json({ error: "Tidak ada eksemplar tersedia untuk dipinjamkan" }, { status: 400 });
    }

    // Durasi mengikuti kebijakan role peminjam
    const policy = await getBorrowPolicy(borrowing.user.role);
    const now = new Date();
    const dueDate = calcDueDate(now, policy.durationDays);

    await db.$transaction([
      db.borrowing.update({
        where: { id },
        data: {
          status: "BORROWED",
          borrow_date: now,
          due_date: dueDate,
          approved_by: session.user.id,
          book_copy_id: availableCopy.id,
        },
      }),
      db.book.update({
        where: { id: borrowing.book_id },
        data: { stock_available: { decrement: 1 }, total_borrowed: { increment: 1 } },
      }),
      db.bookCopy.update({
        where: { id: availableCopy.id },
        data: { status: "BORROWED" },
      }),
    ]);

    await Promise.allSettled([
      db.notification.create({
        data: {
          user_id: borrowing.user_id,
          title: "Peminjaman disetujui",
          message: `Peminjaman "${borrowing.book.title}" (${borrowing.borrow_code}) disetujui. Jatuh tempo ${dueDate.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}. Eksemplar: ${availableCopy.copy_code}.`,
          type: "BORROW_APPROVED",
        },
      }),
      db.auditLog.create({
        data: {
          user_id: session.user.id,
          action: "APPROVE_BORROW",
          entity: "Borrowing",
          entity_id: borrowing.borrow_code,
          details: `${session.user.name} menyetujui ${borrowing.borrow_code} (${availableCopy.copy_code}, tempo ${policy.durationDays} hari)`,
        },
      }),
      sendToUser(borrowing.user_id, {
        type: "BORROW_APPROVED",
        data: {
          borrow_code: borrowing.borrow_code,
          book_title: borrowing.book.title,
          user_name: borrowing.user.name,
          due_date: dueDate,
          copy_code: availableCopy.copy_code,
        },
      }),
    ]);
    auditAction = "APPROVE_BORROW";
    auditDetails = borrowing.borrow_code;
  } else if (action === "reject") {
    if (borrowing.status !== "PENDING") {
      return NextResponse.json({ error: "Hanya peminjaman PENDING yang bisa ditolak" }, { status: 400 });
    }

    await db.borrowing.update({
      where: { id },
      data: { status: "REJECTED" },
    });

    await Promise.allSettled([
      db.notification.create({
        data: {
          user_id: borrowing.user_id,
          title: "Peminjaman ditolak",
          message: `Pengajuan peminjaman "${borrowing.book.title}" (${borrowing.borrow_code}) ditolak pustakawan.`,
          type: "BORROW_REJECTED",
        },
      }),
      db.auditLog.create({
        data: {
          user_id: session.user.id,
          action: "REJECT_BORROW",
          entity: "Borrowing",
          entity_id: borrowing.borrow_code,
          details: `${session.user.name} menolak ${borrowing.borrow_code}`,
        },
      }),
      sendToUser(borrowing.user_id, {
        type: "BORROW_REJECTED",
        data: {
          borrow_code: borrowing.borrow_code,
          book_title: borrowing.book.title,
          user_name: borrowing.user.name,
        },
      }),
    ]);
    auditAction = "REJECT_BORROW";
    auditDetails = borrowing.borrow_code;
  } else if (action === "return") {
    if (borrowing.status !== "BORROWED" && borrowing.status !== "OVERDUE") {
      return NextResponse.json({ error: "Hanya peminjaman BORROWED/OVERDUE yang bisa dikembalikan" }, { status: 400 });
    }

    // Hitung denda keterlambatan berdasarkan kebijakan role peminjam
    const policy = await getBorrowPolicy(borrowing.user.role);
    const now = new Date();
    const lateDays = calcLateDays(borrowing.due_date, now);
    const fineAmount = calcFine(lateDays, policy.finePerDay);
    const fineDeadlineDays = await getFinePaymentDeadlineDays();
    const fineDueAt = new Date(now);
    fineDueAt.setDate(fineDueAt.getDate() + fineDeadlineDays);

    await db.$transaction([
      db.borrowing.update({
        where: { id },
        data: {
          status: "RETURNED",
          return_date: now,
          fine_amount: fineAmount,
          is_fine_paid: fineAmount === 0,
        },
      }),
      db.book.update({
        where: { id: borrowing.book_id },
        data: { stock_available: { increment: 1 } },
      }),
      ...(borrowing.book_copy_id
        ? [
            db.bookCopy.update({
              where: { id: borrowing.book_copy_id },
              data: { status: "AVAILABLE" },
            }),
          ]
        : []),
      ...(fineAmount > 0
        ? [
            db.fine.upsert({
              where: { borrowing_id: id },
              update: {
                amount: fineAmount,
                reason: `Terlambat ${lateDays} hari (Rp${policy.finePerDay.toLocaleString("id-ID")}/hari)`,
                late_days: lateDays,
                fine_per_day: policy.finePerDay,
                due_at: fineDueAt,
                status: "UNPAID",
                fine_code: generateFineCode(),
              },
              create: {
                borrowing_id: id,
                fine_code: generateFineCode(),
                amount: fineAmount,
                reason: `Terlambat ${lateDays} hari (Rp${policy.finePerDay.toLocaleString("id-ID")}/hari)`,
                late_days: lateDays,
                fine_per_day: policy.finePerDay,
                due_at: fineDueAt,
                status: "UNPAID",
              },
            }),
          ]
        : []),
    ]);

    await Promise.allSettled([
      db.notification.create({
        data: {
          user_id: borrowing.user_id,
          title: fineAmount > 0 ? "Buku dikembalikan dengan denda" : "Buku berhasil dikembalikan",
          message:
            fineAmount > 0
              ? `Pengembalian "${borrowing.book.title}" terlambat ${lateDays} hari. Denda Rp${fineAmount.toLocaleString("id-ID")} perlu dibayar.`
              : `Pengembalian "${borrowing.book.title}" (${borrowing.borrow_code}) tercatat. Terima kasih!`,
          type: "INFO",
        },
      }),
      db.auditLog.create({
        data: {
          user_id: session.user.id,
          action: "RETURN_BOOK",
          entity: "Borrowing",
          entity_id: borrowing.borrow_code,
          details: `${session.user.name} memproses pengembalian ${borrowing.borrow_code}${fineAmount > 0 ? `, denda Rp${fineAmount}` : ", tepat waktu"}`,
        },
      }),
      sendToUser(borrowing.user_id, {
        type: "BOOK_RETURNED",
        data: {
          borrow_code: borrowing.borrow_code,
          book_title: borrowing.book.title,
          user_name: borrowing.user.name,
          fine_amount: fineAmount,
          late_days: lateDays,
        },
      }),
    ]);
    auditAction = "RETURN_BOOK";
    auditDetails = borrowing.borrow_code;
  }

  void auditAction;
  void auditDetails;

  const updated = await db.borrowing.findUnique({
    where: { id },
    include: {
      book: { select: { id: true, title: true, isbn: true, cover_image: true, author: { select: { name: true } } } },
      user: { select: { id: true, name: true, email: true, role: true, class_or_dept: true } },
      fine: { select: { id: true, fine_code: true, amount: true, reason: true, status: true, late_days: true, fine_per_day: true, due_at: true, createdAt: true } },
    },
  });

  return NextResponse.json({ data: updated });
}

/**
 * DELETE /api/borrowings/[id] — batalkan pengajuan PENDING.
 * Peminjam hanya bisa membatalkan miliknya sendiri; pustakawan/admin bisa membatalkan milik siapa pun.
 * Status diubah ke REJECTED agar jejak audit tetap ada (bukan hapus permanen).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const borrowing = await db.borrowing.findUnique({
    where: { id },
    include: { book: { select: { title: true } } },
  });
  if (!borrowing) {
    return NextResponse.json({ error: "Peminjaman tidak ditemukan" }, { status: 404 });
  }

  const isOwner = borrowing.user_id === session.user.id;
  const isStaff = ["ADMIN", "LIBRARIAN"].includes(session.user.role);
  if (!isOwner && !isStaff) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (borrowing.status !== "PENDING") {
    return NextResponse.json({ error: "Hanya pengajuan PENDING yang bisa dibatalkan" }, { status: 400 });
  }

  const updated = await db.borrowing.update({
    where: { id },
    data: { status: "REJECTED", notes: borrowing.notes ? `${borrowing.notes} [Dibatalkan]` : "[Dibatalkan]" },
  });

  await Promise.allSettled([
    db.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "CANCEL_BORROW",
        entity: "Borrowing",
        entity_id: borrowing.borrow_code,
        details: `${session.user.name} membatalkan pengajuan ${borrowing.borrow_code} ("${borrowing.book.title}")`,
      },
    }),
  ]);

  return NextResponse.json({ data: updated });
}
