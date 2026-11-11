import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const updateBookSchema = z.object({
  title: z.string().min(2).optional(),
  description: z.string().optional().nullable(),
  publish_year: z.number().int().min(1900).max(2100).optional(),
  cover_image: z.string().optional().nullable(),
  location_rack: z.string().optional().nullable(),
  is_ebook: z.boolean().optional(),
  ebook_file_url: z.string().optional().nullable(),
  ebook_size_mb: z.number().optional().nullable(),
  ebook_format: z.string().optional().nullable(),
  tags: z.string().optional().nullable(),
  category_id: z.string().optional(),
  author_id: z.string().optional(),
  publisher_id: z.string().optional(),
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
  const parsed = updateBookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validasi gagal", issues: parsed.error.issues }, { status: 400 });
  }

  const existing = await db.book.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Buku tidak ditemukan" }, { status: 404 });

  // Handle relational updates separately
  const { author_id, publisher_id, category_id, ...scalarData } = parsed.data;
  const updatePayload: Record<string, unknown> = { ...scalarData };

  if (author_id) updatePayload.author = { connect: { id: author_id } };
  if (publisher_id) updatePayload.publisher = { connect: { id: publisher_id } };
  if (category_id) updatePayload.category = { connect: { id: category_id } };

  const updated = await db.book.update({
    where: { id },
    data: updatePayload,
    include: {
      author: { select: { name: true } },
      category: { select: { name: true } },
    },
  });

  await db.auditLog.create({
    data: {
      user_id: session.user.id,
      action: "UPDATE",
      entity: "BOOK",
      entity_id: id,
      details: `[LIBRARIAN] Memperbarui buku: ${updated.title} (sebelumnya: ${existing.title})`,
    },
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "LIBRARIAN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await db.book.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Buku tidak ditemukan" }, { status: 404 });

  // Cek apakah ada peminjaman aktif
  const activeBorrowing = await db.borrowing.findFirst({
    where: { book_id: id, status: { in: ["PENDING", "BORROWED"] } },
  });

  if (activeBorrowing) {
    return NextResponse.json({ error: "Buku memiliki peminjaman aktif, tidak dapat dinonaktifkan" }, { status: 400 });
  }

  // Soft-delete semua copies → MAINTENANCE status
  await db.bookCopy.updateMany({
    where: { book_id: id },
    data: { status: "MAINTENANCE" },
  });

  await db.auditLog.create({
    data: {
      user_id: session.user.id,
      action: "DELETE",
      entity: "BOOK",
      entity_id: id,
      details: `[LIBRARIAN] Menonaktifkan semua eksemplar buku: ${existing.title}`,
    },
  });

  return NextResponse.json({ message: "Buku berhasil dinonaktifkan" });
}
