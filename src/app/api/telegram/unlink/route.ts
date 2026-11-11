import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { unlinkTelegram } from "@/lib/telegram";

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await unlinkTelegram(session.user.id);

  if (!result) {
    return NextResponse.json(
      { error: "Akun tidak sedang terhubung" },
      { status: 400 }
    );
  }

  return NextResponse.json({ data: { unlinked: true } });
}
