import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const publishers = await db.publisher.findMany({
    select: { id: true, name: true, address: true, phone: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ data: publishers });
}
