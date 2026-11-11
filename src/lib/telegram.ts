import { db } from "@/lib/db";
import crypto from "crypto";

type BorrowRequestData = {
  borrow_code: string;
  book_title: string;
  user_name: string | null | undefined;
  user_role: string | null | undefined;
  notes?: string | null;
};

type BorrowActionData = {
  borrow_code: string;
  book_title: string;
  user_name: string | null | undefined;
  due_date?: Date;
  fine_amount?: number;
  late_days?: number;
  copy_code?: string;
};

type UserCreatedData = {
  user_name: string;
  user_email: string;
  user_role: string;
  created_by: string | null | undefined;
};

type NotificationData =
  | { type: "BORROW_REQUEST"; data: BorrowRequestData }
  | { type: "BORROW_APPROVED"; data: BorrowActionData }
  | { type: "BORROW_REJECTED"; data: BorrowActionData }
  | { type: "BOOK_RETURNED"; data: BorrowActionData }
  | { type: "USER_CREATED"; data: UserCreatedData };

const TELEGRAM_API_BASE = "https://api.telegram.org";
const TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1_500;

function getBotToken(): string | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  return token && token.trim() !== "" ? token : null;
}

function getChatId(): string | null {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  return chatId && chatId.trim() !== "" ? chatId : null;
}

function isValidChatId(chatId: string): boolean {
  return /^-?\d+$/.test(chatId) || /^@[A-Za-z0-9_]{5,}$/.test(chatId);
}

function isRetryableError(result: { ok: boolean; httpStatus?: number; error?: string }): boolean {
  if (result.ok) return false;
  if (result.httpStatus !== undefined && result.httpStatus >= 500) return true;
  if (result.httpStatus !== undefined && result.httpStatus >= 400 && result.httpStatus < 500) return false;
  const err = result.error ?? "";
  if (err.includes("Request timeout")) return true;
  if (err.includes("fetch failed") || err.includes("ECONNRESET") || err.includes("ENOTFOUND") || err.includes("ECONNREFUSED")) return true;
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isTelegramConfigured(): boolean {
  return getBotToken() !== null && getChatId() !== null;
}

function formatDate(date?: Date): string {
  if (!date) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function buildMessage(notif: NotificationData): string {
  const timestamp = new Date().toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  switch (notif.type) {
    case "BORROW_REQUEST": {
      const d = notif.data;
      return [
        "📚 *Peminjaman Baru*",
        "",
        `Kode: ${d.borrow_code}`,
        `Buku: ${d.book_title}`,
        `Peminjam: ${d.user_name ?? "-"} (${d.user_role ?? "-"})`,
        d.notes ? `Catatan: ${d.notes}` : "",
        "",
        `Waktu: ${timestamp}`,
      ]
        .filter(Boolean)
        .join("\n");
    }
    case "BORROW_APPROVED": {
      const d = notif.data;
      return [
        "✅ *Peminjaman Disetujui*",
        "",
        `Kode: ${d.borrow_code}`,
        `Buku: ${d.book_title}`,
        `Peminjam: ${d.user_name ?? "-"}`,
        `Eksemplar: ${d.copy_code ?? "-"}`,
        `Jatuh tempo: ${formatDate(d.due_date)}`,
        "",
        `Waktu: ${timestamp}`,
      ]
        .filter(Boolean)
        .join("\n");
    }
    case "BORROW_REJECTED": {
      const d = notif.data;
      return [
        "❌ *Peminjaman Ditolak*",
        "",
        `Kode: ${d.borrow_code}`,
        `Buku: ${d.book_title}`,
        `Peminjam: ${d.user_name ?? "-"}`,
        "",
        `Waktu: ${timestamp}`,
      ]
        .filter(Boolean)
        .join("\n");
    }
    case "BOOK_RETURNED": {
      const d = notif.data;
      const hasFine = d.fine_amount && d.fine_amount > 0;
      return [
        "📖 *Buku Dikembalikan*",
        "",
        `Kode: ${d.borrow_code}`,
        `Buku: ${d.book_title}`,
        `Peminjam: ${d.user_name ?? "-"}`,
        hasFine
          ? `Keterlambatan: ${d.late_days} hari`
          : "Status: Tepat waktu",
        hasFine ? `Denda: ${formatRupiah(d.fine_amount!)}` : "",
        "",
        `Waktu: ${timestamp}`,
      ]
        .filter(Boolean)
        .join("\n");
    }
    case "USER_CREATED": {
      const d = notif.data;
      return [
        "👤 *User Baru*",
        "",
        `Nama: ${d.user_name}`,
        `Email: ${d.user_email}`,
        `Role: ${d.user_role}`,
        `Dibuat oleh: ${d.created_by ?? "-"}`,
        "",
        `Waktu: ${timestamp}`,
      ]
        .filter(Boolean)
        .join("\n");
    }
  }
}

export async function sendTelegramMessage(
  chatId: string,
  text: string
): Promise<{ ok: boolean; httpStatus?: number; error?: string }> {
  const token = getBotToken();
  if (!token) {
    return { ok: false, error: "Bot token not configured" };
  }

  const url = `${TELEGRAM_API_BASE}/bot${token}/sendMessage`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const parseFailed =
        res.status === 400 &&
        /parse entities|unsupported start entity|can't be found/i.test(body);
      if (parseFailed) {
        const fallback = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text }),
          signal: controller.signal,
        });
        if (fallback.ok) {
          const json = (await fallback.json()) as { ok: boolean; description?: string };
          if (json.ok) return { ok: true, httpStatus: fallback.status };
          return { ok: false, httpStatus: fallback.status, error: json.description ?? "Telegram API error" };
        }
        return { ok: false, httpStatus: fallback.status, error: `HTTP ${fallback.status}` };
      }
      return { ok: false, httpStatus: res.status, error: `HTTP ${res.status}: ${body}` };
    }

    const json = (await res.json()) as { ok: boolean; description?: string };
    if (!json.ok) {
      return { ok: false, httpStatus: res.status, error: json.description ?? "Telegram API error" };
    }

    return { ok: true, httpStatus: res.status };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, error: "Request timeout" };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  } finally {
    clearTimeout(timeout);
  }
}

async function sendWithRetry(
  chatId: string,
  text: string
): Promise<{ ok: boolean; httpStatus?: number; error?: string }> {
  let lastResult = await sendTelegramMessage(chatId, text);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    if (lastResult.ok || !isRetryableError(lastResult)) break;
    await sleep(RETRY_DELAY_MS * attempt);
    lastResult = await sendTelegramMessage(chatId, text);
  }

  return lastResult;
}

export async function sendNotification(
  notif: NotificationData
): Promise<{ ok: boolean; error?: string }> {
  const chatId = getChatId();
  if (!chatId) {
    return { ok: false, error: "Chat ID not configured" };
  }

  if (!isValidChatId(chatId)) {
    return { ok: false, error: "Chat ID format invalid (expected numeric or @channel)" };
  }

  const text = buildMessage(notif);
  const result = await sendWithRetry(chatId, text);

  if (!result.ok) {
    console.error(`[Telegram] Failed to send ${notif.type}: ${result.error}`);
  } else {
    console.log(`[Telegram] Sent ${notif.type} notification`);
  }

  return result;
}

export function buildUserMessage(notif: NotificationData): string {
  return buildMessage(notif);
}

const LINK_TOKEN_TTL_MS = 15 * 60 * 1000;

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function getBotUsername(): string | null {
  return process.env.TELEGRAM_BOT_USERNAME ?? null;
}

export async function generateLinkToken(userId: string): Promise<{ token: string; expiresAt: Date } | null> {
  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + LINK_TOKEN_TTL_MS);

  await db.telegramLinkToken.deleteMany({ where: { user_id: userId } });

  await db.telegramLinkToken.create({
    data: {
      user_id: userId,
      token_hash: hashToken(token),
      expires_at: expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function getLinkStatus(userId: string): Promise<{
  linked: boolean;
  chatId?: string;
  linkedAt?: Date;
}> {
  const link = await db.telegramLink.findUnique({ where: { user_id: userId } });
  if (!link) return { linked: false };
  return {
    linked: true,
    chatId: link.telegram_chat_id,
    linkedAt: link.linked_at,
  };
}

export async function unlinkTelegram(userId: string): Promise<boolean> {
  const deleted = await db.telegramLink.deleteMany({ where: { user_id: userId } });
  await db.telegramLinkToken.deleteMany({ where: { user_id: userId } });
  return deleted.count > 0;
}

export type ProcessUpdateResult =
  | { action: "linked"; userId: string }
  | { action: "help" }
  | { action: "ignored" }
  | { action: "error"; message: string };

async function reply(chatId: string, text: string): Promise<void> {
  const result = await sendTelegramMessage(chatId, text);
  if (!result.ok) {
    console.error(`[Telegram] Gagal kirim balasan ke chat ${chatId}: ${result.error}`);
  }
}

async function linkWithToken(chatId: string, linkToken: string): Promise<ProcessUpdateResult> {
  const tokenHash = hashToken(linkToken);
  const tokenRecord = await db.telegramLinkToken.findUnique({
    where: { token_hash: tokenHash },
  });

  if (!tokenRecord) {
    await reply(
      chatId,
      "⚠️ *Kode Pengaitan Tidak Valid*\n\n" +
        "Kode yang kamu masukkan tidak dapat diverifikasi. " +
        "Silakan buka Settings di Perpustakaan Digital SMA dan buat kode pengaitan yang baru."
    );
    return { action: "error", message: "invalid_token" };
  }

  if (tokenRecord.used_at) {
    await reply(
      chatId,
      "ℹ️ *Kode Sudah Digunakan*\n\n" +
        "Kode ini sudah pernah dipakai dan tidak dapat digunakan kembali. " +
        "Periksa status koneksi di aplikasi atau buat kode baru jika diperlukan."
    );
    return { action: "error", message: "token_used" };
  }

  if (tokenRecord.expires_at < new Date()) {
    await reply(
      chatId,
      "⌛ *Kode Pengaitan Kedaluwarsa*\n\n" +
        "Masa berlaku kode sudah habis. " +
        "Silakan buat kode baru melalui halaman Settings aplikasi."
    );
    return { action: "error", message: "token_expired" };
  }

  const existingLink = await db.telegramLink.findUnique({
    where: { telegram_chat_id: chatId },
  });
  if (existingLink && existingLink.user_id !== tokenRecord.user_id) {
    await reply(
      chatId,
      "⚠️ *Akun Telegram Sudah Terhubung*\n\n" +
        "Akun Telegram ini sudah terhubung dengan akun lain. " +
        "Silakan putuskan hubungan terlebih dahulu dari akun sebelumnya, atau hubungi administrator."
    );
    return { action: "error", message: "chat_already_linked" };
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.telegramLink.upsert({
        where: { user_id: tokenRecord.user_id },
        update: { telegram_chat_id: chatId },
        create: {
          user_id: tokenRecord.user_id,
          telegram_chat_id: chatId,
        },
      });
      await tx.telegramLinkToken.update({
        where: { id: tokenRecord.id },
        data: { used_at: new Date() },
      });
    });
  } catch (err) {
    console.error("[Telegram] DB error saat pengaitan:", err instanceof Error ? err.message : err);
    await reply(
      chatId,
      "❌ *Pengaitan Belum Berhasil*\n\n" +
        "Terjadi kendala saat menghubungkan akun. " +
        "Silakan coba kembali beberapa saat lagi. " +
        "Jika masalah berlanjut, periksa status koneksi di aplikasi."
    );
    return { action: "error", message: "db_error" };
  }

  const user = await db.user.findUnique({
    where: { id: tokenRecord.user_id },
    select: { name: true, role: true },
  });

  const roleLabel =
    user?.role === "TEACHER" ? "Guru" : user?.role === "STUDENT" ? "Siswa" : (user?.role ?? "-");

  await reply(
    chatId,
    "🎉 *Akun Berhasil Dihubungkan!*\n\n" +
      `Halo, ${user?.name ?? "-"}.\n\n` +
      "Akun Telegram kamu berhasil dihubungkan dengan Perpustakaan Digital SMA.\n\n" +
      `👤 Nama: ${user?.name ?? "-"}\n` +
      `🎓 Peran: ${roleLabel}\n\n` +
      "Mulai sekarang, kamu dapat menerima notifikasi aktivitas perpustakaan " +
      "melalui Telegram sesuai pengaturan akunmu.\n\n" +
      "Silakan kembali ke aplikasi Perpustakaan Digital SMA untuk memeriksa status koneksi."
  );

  return { action: "linked", userId: tokenRecord.user_id };
}

export async function processTelegramUpdate(update: {
  message?: {
    from?: { id: number; first_name?: string; username?: string };
    chat?: { id: number; type?: string };
    text?: string;
  };
}): Promise<ProcessUpdateResult> {
  const msg = update.message;
  if (!msg || !msg.from || !msg.chat) return { action: "ignored" };

  const chatId = String(msg.chat.id);
  const text = (msg.text ?? "").trim();

  if (text.startsWith("/start")) {
    const parts = text.split(/\s+/);
    const linkToken = parts[1];

    if (!linkToken || linkToken.length < 10) {
      await reply(
        chatId,
        "Halo! Saya bot Perpustakaan Digital SMA.\n\n" +
          "Untuk menghubungkan akun Anda:\n" +
          "1. Buka aplikasi Perpustakaan Digital\n" +
          "2. Masuk ke Pengaturan Akun\n" +
          "3. Klik tombol \"Hubungkan Telegram\"\n" +
          "4. Buka link bot yang diberikan atau kirim kode pengaitan\n\n" +
          "Atau gunakan perintah /start <kode> jika Anda sudah mendapatkan kode pengaitan."
      );
      return { action: "help" };
    }

    return linkWithToken(chatId, linkToken);
  }

  if (!text.startsWith("/") && /^[a-f0-9]{32,}$/.test(text)) {
    return linkWithToken(chatId, text);
  }

  if (text.startsWith("/")) {
    await reply(chatId, "Perintah tidak dikenali. Gunakan /start untuk informasi.");
  }

  return { action: "ignored" };
}

export async function sendToUser(
  userId: string,
  notif: NotificationData
): Promise<{ ok: boolean; error?: string }> {
  const link = await db.telegramLink.findUnique({ where: { user_id: userId } });
  if (!link) {
    return { ok: false, error: "User Telegram not linked" };
  }

  const chatId = link.telegram_chat_id;
  if (!isValidChatId(chatId)) {
    return { ok: false, error: "Linked chat ID format invalid" };
  }

  const text = buildMessage(notif);
  const result = await sendWithRetry(chatId, text);

  if (!result.ok) {
    console.error(`[Telegram] Failed to send ${notif.type} to user: ${result.error}`);
  } else {
    console.log(`[Telegram] Sent ${notif.type} to user ${userId}`);
  }

  return result;
}

export async function sendToAdmins(
  notif: NotificationData
): Promise<{ ok: boolean; error?: string }> {
  const admins = await db.user.findMany({
    where: { role: { in: ["ADMIN", "LIBRARIAN"] }, status: "ACTIVE" },
    select: { id: true },
  });

  const adminIds = admins.map((a) => a.id);
  const links = await db.telegramLink.findMany({
    where: { user_id: { in: adminIds } },
    select: { user_id: true, telegram_chat_id: true },
  });

  const results = await Promise.allSettled(
    links.map((link) => sendToUser(link.user_id, notif))
  );

  const globalChatId = getChatId();
  if (globalChatId && isValidChatId(globalChatId)) {
    const linkedChatIds = new Set(links.map((l) => l.telegram_chat_id));
    if (!linkedChatIds.has(globalChatId)) {
      const text = buildMessage(notif);
      await sendWithRetry(globalChatId, text);
    }
  }

  const sentCount = results.filter(
    (r) => r.status === "fulfilled" && r.value.ok
  ).length;

  return { ok: sentCount > 0 || !!globalChatId };
}
