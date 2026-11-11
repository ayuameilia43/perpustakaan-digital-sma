import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { FINE_INCLUDE, getFinePaymentDeadlineDays, serializeFine } from "@/lib/fine";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fine = await db.fine.findUnique({ where: { id }, include: FINE_INCLUDE });
  if (!fine) {
    return NextResponse.json({ error: "Data denda tidak ditemukan" }, { status: 404 });
  }

  const isStaff = ["ADMIN", "LIBRARIAN"].includes(session.user.role);
  if (!isStaff && fine.borrowing.user_id !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const histories = await db.fineStatusHistory.findMany({
    where: { fine_id: id },
    orderBy: { createdAt: "asc" },
    include: { actor: { select: { id: true, name: true } } },
  });

  const deadlineDays = await getFinePaymentDeadlineDays();
  const data = await serializeFine(fine, deadlineDays);

  return NextResponse.json({
    data: {
      ...data,
      histories: histories.map((h) => ({
        id: h.id,
        from_status: h.from_status,
        to_status: h.to_status,
        actor_name: h.actor_name ?? h.actor?.name ?? null,
        reason: h.reason,
        createdAt: h.createdAt,
      })),
    },
  });
}
