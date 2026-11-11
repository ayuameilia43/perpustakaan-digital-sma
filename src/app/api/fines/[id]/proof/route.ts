import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fine = await db.fine.findUnique({
    where: { id },
    include: { borrowing: { select: { user_id: true } } },
  });
  if (!fine) {
    return NextResponse.json({ error: "Data denda tidak ditemukan" }, { status: 404 });
  }
  const isStaff = ["ADMIN", "LIBRARIAN"].includes(session.user.role);
  if (!isStaff && fine.borrowing.user_id !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!fine.proof_url) {
    return NextResponse.json({ error: "Bukti pembayaran tidak tersedia" }, { status: 404 });
  }

  const filePath = path.join(process.cwd(), "public", fine.proof_url);
  const ext = path.extname(filePath).toLowerCase();
  try {
    const buf = await readFile(filePath);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Content-Disposition": `inline; filename="${fine.proof_name ?? `bukti-denda${ext}`}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "File bukti tidak ditemukan" }, { status: 404 });
  }
}
