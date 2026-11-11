import { processTelegramUpdate } from "@/lib/telegram";

const TELEGRAM_API_BASE = "https://api.telegram.org";
const POLL_TIMEOUT_S = 30;
const RETRY_DELAY_MS = 5_000;
const CONFLICT_DELAY_MS = 10_000;

type PollUpdate = {
  update_id: number;
  message?: {
    from?: { id: number; first_name?: string; username?: string };
    chat?: { id: number; type?: string };
    text?: string;
  };
};

async function getUpdates(
  offset: number,
  token: string
): Promise<{ ok: boolean; conflict?: boolean; result?: PollUpdate[]; error?: string }> {
  const url = `${TELEGRAM_API_BASE}/bot${token}/getUpdates?offset=${offset}&timeout=${POLL_TIMEOUT_S}&allowed_updates=["message"]`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), (POLL_TIMEOUT_S + 10) * 1000);

  try {
    const res = await fetch(url, { method: "GET", signal: controller.signal });
    const json = (await res.json()) as {
      ok: boolean;
      result?: PollUpdate[];
      description?: string;
    };

    if (!json.ok) {
      const desc = json.description ?? "";
      return {
        ok: false,
        conflict: res.status === 409 || desc.includes("getUpdates"),
        error: desc || `HTTP ${res.status}`,
      };
    }
    return { ok: true, result: json.result ?? [] };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, error: "poll timeout" };
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

export async function runTelegramPollLoop(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("[Poll] TELEGRAM_BOT_TOKEN tidak dikonfigurasi — polling tidak dimulai");
    return;
  }

  let offset = 0;
  let firstRun = true;

  for (;;) {
    const result = await getUpdates(offset, token);

    if (result.ok) {
      if (firstRun) {
        console.log("[Poll] Telegram polling aktif (long-polling, timeout 30s)");
        firstRun = false;
      }
      for (const update of result.result ?? []) {
        offset = update.update_id + 1;
        try {
          const outcome = await processTelegramUpdate(update);
          console.log(`[Poll] Update ${update.update_id}: ${outcome.action}`);
        } catch (err: unknown) {
          console.error(
            `[Poll] Gagal proses update ${update.update_id}:`,
            err instanceof Error ? err.message : err
          );
        }
      }
    } else if (result.error) {
      if (result.conflict) {
        console.error(
          "[Poll] Konflik getUpdates — kemungkinan ada instance polling lain yang berjalan " +
            "(hanya boleh satu proses polling per token). Mengulang dalam 10 detik..."
        );
      } else {
        console.error(`[Poll] getUpdates gagal: ${result.error} — mengulang dalam 5 detik`);
      }
      await new Promise((r) => setTimeout(r, result.conflict ? CONFLICT_DELAY_MS : RETRY_DELAY_MS));
    }
  }
}

type PollerGlobal = typeof globalThis & { __telegramPollerStarted?: boolean };

export function startTelegramPoller(): void {
  const g = globalThis as PollerGlobal;

  if (g.__telegramPollerStarted) {
    console.log("[Poll] Polling sudah berjalan — instance lain dilewati (single consumer)");
    return;
  }

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.warn("[Poll] TELEGRAM_BOT_TOKEN tidak ada di environment — polling TIDAK dimulai");
    return;
  }

  g.__telegramPollerStarted = true;
  console.log("[Poll] Memulai Telegram polling...");

  runTelegramPollLoop().catch((err) => {
    console.error("[Poll] Fatal error — polling berhenti:", err);
    g.__telegramPollerStarted = false;
  });
}
