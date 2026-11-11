import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return session;
}

// GET /api/ebooks/[id]/progress -> ambil progres baca user + metadata ebook
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await requireUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const book = await db.book.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      is_ebook: true,
      ebook_file_url: true,
      ebook_format: true,
      ebook_size_mb: true,
      author: { select: { id: true, name: true } },
      category: { select: { id: true, name: true, code: true } },
    },
  });

  if (!book) return NextResponse.json({ error: "Buku tidak ditemukan" }, { status: 404 });
  if (!book.is_ebook) {
    return NextResponse.json({ error: "Buku ini bukan e-book" }, { status: 400 });
  }

  const progress = await db.ebookProgress.findUnique({
    where: { user_id_book_id: { user_id: session.user.id, book_id: id } },
  });

  return NextResponse.json({ data: { book, progress } });
}

// PUT /api/ebooks/[id]/progress -> simpan progres { last_page, total_pages }
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await requireUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const book = await db.book.findUnique({
    where: { id },
    select: { id: true, is_ebook: true },
  });
  if (!book) return NextResponse.json({ error: "Buku tidak ditemukan" }, { status: 404 });
  if (!book.is_ebook) {
    return NextResponse.json({ error: "Buku ini bukan e-book" }, { status: 400 });
  }

  let body: { last_page?: number; total_pages?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid" }, { status: 400 });
  }

  const total_pages = Math.max(1, Math.floor(Number(body.total_pages) || 1));
  const last_page = Math.min(
    total_pages,
    Math.max(1, Math.floor(Number(body.last_page) || 1))
  );

  const progress = await db.ebookProgress.upsert({
    where: { user_id_book_id: { user_id: session.user.id, book_id: id } },
    update: { last_page, total_pages, last_read_at: new Date() },
    create: {
      user_id: session.user.id,
      book_id: id,
      last_page,
      total_pages,
    },
  });

  return NextResponse.json({ data: progress });
}
