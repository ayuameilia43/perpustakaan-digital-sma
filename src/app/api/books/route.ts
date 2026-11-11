import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "12");
  const search = searchParams.get("search") ?? "";
  const category = searchParams.get("category") ?? "";
  const author = searchParams.get("author") ?? "";
  const isEbook = searchParams.get("is_ebook");

  const skip = (page - 1) * limit;
  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { title: { contains: search } },
      { isbn: { contains: search } },
      { author: { name: { contains: search } } },
    ];
  }

  if (category) where.category = { code: category };
  if (author) where.author_id = author;
  if (isEbook === "true") where.is_ebook = true;
  if (isEbook === "false") where.is_ebook = false;

  const [books, total] = await Promise.all([
    db.book.findMany({
      where,
      skip,
      take: limit,
      include: {
        category: { select: { id: true, name: true, code: true } },
        author: { select: { id: true, name: true } },
        publisher: { select: { id: true, name: true } },
        _count: { select: { copies: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.book.count({ where }),
  ]);

  return NextResponse.json({
    data: books,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
