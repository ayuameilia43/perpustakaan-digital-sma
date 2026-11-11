import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const categories = await db.category.findMany({
    select: { id: true, name: true, code: true, description: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ data: categories });
}
