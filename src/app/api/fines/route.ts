import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { FINE_INCLUDE, getFinePaymentDeadlineDays, serializeFine } from "@/lib/fine";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

const VALID_STATUSES = ["UNPAID", "PENDING_VERIFICATION", "PAID", "REJECTED"] as const;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isStaff = ["ADMIN", "LIBRARIAN"].includes(session.user.role);
  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (!isStaff) where.borrowing = { user_id: session.user.id };
  if (VALID_STATUSES.includes(statusParam as (typeof VALID_STATUSES)[number])) {
    where.status = statusParam;
  }

  const deadlineDays = await getFinePaymentDeadlineDays();
  const [fines, total, summary] = await Promise.all([
    db.fine.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: FINE_INCLUDE,
    }),
    db.fine.count({ where }),
    isStaff
      ? db.fine.groupBy({ by: ["status"], _sum: { amount: true }, _count: { _all: true } })
      : db.fine.groupBy({
          by: ["status"],
          where: { borrowing: { user_id: session.user.id } },
          _sum: { amount: true },
          _count: { _all: true },
        }),
  ]);

  const byStatus = Object.fromEntries(
    summary.map((s) => [s.status, { total: s._sum.amount ?? 0, count: s._count._all }])
  ) as Record<string, { total: number; count: number }>;

  const allTotal = Object.values(byStatus).reduce((acc, v) => acc + v.total, 0);
  const stats = {
    total_all: allTotal,
    total_unpaid: byStatus.UNPAID?.total ?? 0,
    unpaid_count: byStatus.UNPAID?.count ?? 0,
    total_pending: byStatus.PENDING_VERIFICATION?.total ?? 0,
    pending_count: byStatus.PENDING_VERIFICATION?.count ?? 0,
    total_paid: byStatus.PAID?.total ?? 0,
    paid_count: byStatus.PAID?.count ?? 0,
    total_rejected: byStatus.REJECTED?.total ?? 0,
    rejected_count: byStatus.REJECTED?.count ?? 0,
    payment_deadline_days: deadlineDays,
  };

  return NextResponse.json({
    data: await Promise.all(fines.map((f) => serializeFine(f, deadlineDays))),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    stats,
    payment_deadline_days: deadlineDays,
  });
}
