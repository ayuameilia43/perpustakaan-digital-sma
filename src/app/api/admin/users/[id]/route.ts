import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  role: z.enum(["ADMIN", "LIBRARIAN", "STUDENT", "TEACHER", "STAFF"]).optional(),
  nisn_nip: z.string().optional().nullable(),
  class_or_dept: z.string().optional().nullable(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  is_active: z.boolean().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true, name: true, email: true, role: true, nisn_nip: true,
      class_or_dept: true, status: true, createdAt: true,
    },
  });

  if (!user) return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
  return NextResponse.json({ data: user });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validasi gagal", issues: parsed.error.issues }, { status: 400 });
  }

  const existing = await db.user.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });

  const { password, is_active, ...rest } = parsed.data;
  const updateData: Record<string, unknown> = { ...rest };

  if (typeof is_active === "boolean") {
    updateData.status = is_active ? "ACTIVE" : "SUSPENDED";
  }

  if (password) {
    updateData.password_hash = await bcrypt.hash(password, 12);
  }

  const updated = await db.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true, name: true, email: true, role: true, status: true,
    },
  });

  await db.auditLog.create({
    data: {
      user_id: session.user.id,
      action: "UPDATE",
      entity: "USER",
      entity_id: id,
      details: `[ADMIN] Memperbarui user: ${updated.name} | sebelumnya: ${existing.name} (${existing.role})`,
    },
  });

  return NextResponse.json({ data: { ...updated, is_active: updated.status === "ACTIVE" } });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (id === session.user.id) {
    return NextResponse.json({ error: "Tidak dapat menonaktifkan akun sendiri" }, { status: 400 });
  }

  const existing = await db.user.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });

  // Soft-delete: SUSPENDED
  await db.user.update({ where: { id }, data: { status: "SUSPENDED" } });

  await db.auditLog.create({
    data: {
      user_id: session.user.id,
      action: "DELETE",
      entity: "USER",
      entity_id: id,
      details: `[ADMIN] Menonaktifkan user: ${existing.name} (${existing.role})`,
    },
  });

  return NextResponse.json({ message: "User berhasil dinonaktifkan" });
}
