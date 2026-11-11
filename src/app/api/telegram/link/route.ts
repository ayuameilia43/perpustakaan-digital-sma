import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { generateLinkToken, getLinkStatus, isTelegramConfigured } from "@/lib/telegram";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = await getLinkStatus(session.user.id);
  const botConfigured = isTelegramConfigured();

  return NextResponse.json({
    data: {
      linked: status.linked,
      linkedAt: status.linkedAt ?? null,
      botConfigured,
    },
  });
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isTelegramConfigured()) {
    return NextResponse.json(
      { error: "Telegram bot belum dikonfigurasi di server" },
      { status: 400 }
    );
  }

  const status = await getLinkStatus(session.user.id);
  if (status.linked) {
    return NextResponse.json(
      { error: "Akun sudah terhubung. Putuskan hubungan terlebih dahulu." },
      { status: 400 }
    );
  }

  const result = await generateLinkToken(session.user.id);
  if (!result) {
    return NextResponse.json(
      { error: "Gagal membuat kode pengaitan" },
      { status: 500 }
    );
  }

  const botUsername = process.env.TELEGRAM_BOT_USERNAME ?? "";
  const deepLink = botUsername
    ? `https://t.me/${botUsername}?start=${result.token}`
    : null;

  return NextResponse.json({
    data: {
      token: result.token,
      expiresAt: result.expiresAt,
      deepLink,
      instructions: [
        "Buka bot Telegram Anda",
        "Klik Start atau kirim /start " + result.token,
        "Tunggu konfirmasi koneksi",
      ],
    },
  });
}
