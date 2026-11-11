import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { sendToAdmins } from "@/lib/telegram";

const createUserSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter"),
  email: z.string().email("Email tidak valid"),
  password: z.string().min(8, "Password minimal 8 karakter"),
  role: z.enum(["ADMIN", "LIBRARIAN", "STUDENT", "TEACHER", "STAFF"]),
  nisn_nip: z.string().optional(),
  class_or_dept: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "15");
  const search = searchParams.get("search") ?? "";
  const role = searchParams.get("role") ?? "";
  const status = searchParams.get("status") ?? "";

  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
      { nisn_nip: { contains: search } },
    ];
  }

  if (role && ["ADMIN", "LIBRARIAN", "STUDENT", "TEACHER", "STAFF"].includes(role)) {
    where.role = role;
  }

  if (status === "active") where.status = "ACTIVE";
  if (status === "inactive") where.status = "SUSPENDED";

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        nisn_nip: true,
        class_or_dept: true,
        status: true,
        createdAt: true,
        _count: { select: { borrowings: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.user.count({ where }),
  ]);

  // Map to frontend-friendly shape
  const data = users.map(u => ({
    ...u,
    is_active: u.status === "ACTIVE",
    created_at: u.createdAt,
    last_login: null,
    nisn: u.nisn_nip,
    nip: u.nisn_nip,
    phone: null,
    class_name: u.class_or_dept,
  }));

  return NextResponse.json({
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validasi gagal", issues: parsed.error.issues }, { status: 400 });
  }

  const { password, name, email, role, nisn_nip, class_or_dept } = parsed.data;

  // Check duplicate email
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 12);

  const user = await db.user.create({
    data: {
      name,
      email,
      password_hash: hashed,
      role,
      nisn_nip: nisn_nip ?? `AUTO-${Date.now()}`,
      class_or_dept: class_or_dept,
      status: "ACTIVE",
    },
    select: {
      id: true, name: true, email: true, role: true, createdAt: true,
    },
  });

  // Audit log + Telegram notification (best-effort)
  await Promise.allSettled([
    db.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "CREATE",
        entity: "USER",
        entity_id: user.id,
        details: `[ADMIN] Membuat user baru: ${user.name} (${user.role})`,
      },
    }),
    sendToAdmins({
      type: "USER_CREATED",
      data: {
        user_name: user.name,
        user_email: user.email,
        user_role: user.role,
        created_by: session.user.name,
      },
    }),
  ]);

  return NextResponse.json({ data: user }, { status: 201 });
}
