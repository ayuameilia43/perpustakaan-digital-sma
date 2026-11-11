import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateSettingSchema = z.object({
  key: z.string().min(1),
  value: z.string().min(1),
});

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Akses ditolak. Membutuhkan role Administrator." }, { status: 403 });
  }

  const settings = await db.systemSetting.findMany({
    orderBy: { key: "asc" },
  });

  return NextResponse.json(settings);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Akses ditolak. Membutuhkan role Administrator." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = updateSettingSchema.parse(body);

    const existing = await db.systemSetting.findUnique({ where: { key: parsed.key } });
    if (!existing && parsed.key !== "fine_payment_deadline_days") {
      return NextResponse.json({ error: "Pengaturan tidak ditemukan" }, { status: 404 });
    }
    if (!existing) {
      const created = await db.systemSetting.create({
        data: {
          key: parsed.key,
          value: parsed.value,
          description: "Tenggat pembayaran denda dalam hari sejak denda diterbitkan (dapat diubah admin)",
        },
      });
      return NextResponse.json(created);
    }

    const updated = await db.systemSetting.update({
      where: { key: parsed.key },
      data: { value: parsed.value },
    });

    return NextResponse.json(updated);
  } catch (err: unknown) {
    return NextResponse.json({ error: "Gagal memperbarui pengaturan: " + String(err) }, { status: 400 });
  }
}
