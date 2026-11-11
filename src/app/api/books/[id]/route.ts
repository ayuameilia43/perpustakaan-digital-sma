import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const book = await db.book.findUnique({
    where: { id },
    include: {
      category: true,
      author: true,
      publisher: true,
      copies: {
        select: { id: true, copy_code: true, condition: true, status: true },
        orderBy: { copy_code: "asc" },
      },
      reviews: {
        select: {
          id: true, rating: true, comment: true, createdAt: true,
          user: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      _count: { select: { copies: true, reviews: true } },
    },
  });

  if (!book) return NextResponse.json({ error: "Buku tidak ditemukan" }, { status: 404 });

  return NextResponse.json({ data: book });
}
