import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const createBookSchema = z.object({
  title: z.string().min(2, "Judul minimal 2 karakter"),
  isbn: z.string().min(5, "ISBN minimal 5 karakter"),
  author_id: z.string().min(1, "Author wajib dipilih"),
  publisher_id: z.string().min(1, "Publisher wajib dipilih"),
  category_id: z.string().min(1, "Kategori wajib dipilih"),
  publish_year: z.number().int().min(1900).max(2100),
  description: z.string().optional(),
  tags: z.string().optional(),
  cover_image: z.string().optional().nullable(),
  stock_total: z.number().int().min(0).default(1),
  location_rack: z.string().optional(),
  is_ebook: z.boolean().default(false),
  ebook_file_url: z.string().optional().nullable(),
  ebook_size_mb: z.number().optional().nullable(),
  ebook_format: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "LIBRARIAN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createBookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validasi gagal", issues: parsed.error.issues }, { status: 400 });
  }

  const data = parsed.data;

  // Cek ISBN duplikat
  const existing = await db.book.findUnique({ where: { isbn: data.isbn } });
  if (existing) {
    return NextResponse.json({ error: "ISBN sudah terdaftar" }, { status: 409 });
  }

  const book = await db.book.create({
    data: {
      title: data.title,
      isbn: data.isbn,
      author_id: data.author_id,
      publisher_id: data.publisher_id,
      category_id: data.category_id,
      publish_year: data.publish_year,
      description: data.description,
      tags: data.tags,
      cover_image: data.cover_image,
      stock_total: data.stock_total,
      stock_available: data.stock_total,
      location_rack: data.location_rack ?? "Rak Umum",
      is_ebook: data.is_ebook,
      ebook_file_url: data.ebook_file_url,
      ebook_size_mb: data.ebook_size_mb,
      ebook_format: data.ebook_format ?? "PDF",
    },
    include: {
      author: { select: { name: true } },
      category: { select: { name: true } },
    },
  });

  // Auto-create BookCopy entries
  if (data.stock_total > 0) {
    const copies = Array.from({ length: data.stock_total }, (_, i) => ({
      book_id: book.id,
      copy_code: `BC-${book.isbn.slice(-4)}-${String(i + 1).padStart(3, "0")}`,
      condition: "Baik",
      status: "AVAILABLE" as const,
    }));
    await db.bookCopy.createMany({ data: copies });
  }

  await db.auditLog.create({
    data: {
      user_id: session.user.id,
      action: "CREATE",
      entity: "BOOK",
      entity_id: book.id,
      details: `[LIBRARIAN] Menambahkan buku baru: ${book.title} (ISBN: ${book.isbn})`,
    },
  });

  return NextResponse.json({ data: book }, { status: 201 });
}
