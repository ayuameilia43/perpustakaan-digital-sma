import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const authors = await db.author.findMany({
    select: { id: true, name: true, bio: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ data: authors });
}
