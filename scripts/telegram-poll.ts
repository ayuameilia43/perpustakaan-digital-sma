import fs from "node:fs";
import path from "node:path";
import { db } from "../src/lib/db";
import { startTelegramPoller } from "../src/lib/telegram-poller";

function loadEnvFile(): void {
  if (process.env.TELEGRAM_BOT_TOKEN) return;
  try {
    const envPath = path.join(__dirname, "..", ".env");
    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const key = m[1];
      const value = m[2].replace(/^["']|["']$/g, "");
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // .env tidak ada — biarkan kosong, akan dicek di bawah
  }
}

async function main() {
  loadEnvFile();

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.error("[Poll] TELEGRAM_BOT_TOKEN tidak dikonfigurasi");
    process.exit(1);
  }

  try {
    await db.$connect();
    console.log("[Poll] Database connected");
  } catch (err: unknown) {
    console.error("[Poll] Database connection failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  }

  const shutdown = async () => {
    console.log("\n[Poll] Shutting down...");
    await db.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  startTelegramPoller();
}

main().catch((err) => {
  console.error("[Poll] Fatal error:", err);
  process.exit(1);
});
