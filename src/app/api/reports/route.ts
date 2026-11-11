import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "LIBRARIAN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [
    totalBooks,
    totalEbooks,
    totalUsers,
    activeBorrowings,
    overdueBorrowings,
    totalFines,
    unpaidFines,
    pendingFines,
    rejectedFines,
    paidFinesTotal,
    recentBorrowings,
    popularBooks,
  ] = await Promise.all([
    db.book.count(),
    db.book.count({ where: { is_ebook: true } }),
    db.user.count(),
    db.borrowing.count({ where: { status: "BORROWED" } }),
    db.borrowing.count({ where: { status: "OVERDUE" } }),
    db.borrowing.aggregate({ _sum: { fine_amount: true } }).then((r) => r._sum.fine_amount ?? 0),
    db.borrowing.count({ where: { is_fine_paid: false, fine_amount: { gt: 0 } } }),
    db.fine.count({ where: { status: "PENDING_VERIFICATION" } }),
    db.fine.count({ where: { status: "REJECTED" } }),
    db.fine.aggregate({ where: { status: "PAID" }, _sum: { amount: true } }).then((r) => r._sum.amount ?? 0),
    db.borrowing.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        book: { select: { title: true } },
        user: { select: { name: true } },
      },
    }),
    db.book.findMany({
      take: 10,
      orderBy: { total_borrowed: "desc" },
      select: {
        id: true,
        title: true,
        total_borrowed: true,
        author: { select: { name: true } },
      },
    }),
  ]);

  return NextResponse.json({
    data: {
      totalBooks,
      totalEbooks,
      totalUsers,
      activeBorrowings,
      overdueBorrowings,
      totalFines,
      unpaidFines,
      pendingFines,
      rejectedFines,
      paidFinesTotal,
      recentBorrowings,
      popularBooks,
    },
  });
}
