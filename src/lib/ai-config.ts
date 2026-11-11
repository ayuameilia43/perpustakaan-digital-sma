import crypto from "node:crypto";
import { db } from "@/lib/db";

export type AiProvider = "nvidia" | "openai" | "gemini" | "custom";

export interface ProviderPreset {
  id: AiProvider;
  name: string;
  defaultBaseUrl: string;
  description: string;
  defaultModel: string;
  recommendedModels: string[];
}

export const PROVIDER_PRESETS: Record<AiProvider, ProviderPreset> = {
  nvidia: {
    id: "nvidia",
    name: "NVIDIA NIM",
    defaultBaseUrl: "https://integrate.api.nvidia.com/v1",
    description: "Infrastruktur inferensi NVIDIA NIM berkecapatan tinggi untuk model LLM open source.",
    defaultModel: "meta/llama-3.2-11b-vision-instruct",
    recommendedModels: [
      "meta/llama-3.2-11b-vision-instruct",
      "meta/llama-3.2-3b-instruct",
      "meta/llama-3.2-1b-instruct",
      "meta/llama-3.1-8b-instruct",
      "meta/llama-3.1-70b-instruct",
      "meta/llama-3.3-70b-instruct",
      "deepseek-ai/deepseek-r1",
      "mistralai/mistral-large-2-instruct",
      "nvidia/nemotron-4-340b-instruct",
    ],
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    defaultBaseUrl: "https://api.openai.com/v1",
    description: "Layanan model bahasa OpenAI standar industri (GPT-4o, GPT-4o-mini).",
    defaultModel: "gpt-4o-mini",
    recommendedModels: [
      "gpt-4o-mini",
      "gpt-4o",
      "gpt-4-turbo",
      "gpt-3.5-turbo",
    ],
  },
  gemini: {
    id: "gemini",
    name: "Google Gemini",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    description: "Model multimodal Google Gemini melalui endpoint OpenAI-compatible resmi.",
    defaultModel: "gemini-2.5-flash",
    recommendedModels: [
      "gemini-2.5-flash",
      "gemini-2.5-pro",
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
      "gemini-1.5-flash",
      "gemini-1.5-flash-8b",
      "gemini-1.5-pro",
    ],
  },
  custom: {
    id: "custom",
    name: "Custom OpenAI-Compatible API",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    description: "Endpoint kustom yang kompatibel dengan format OpenAI (Groq, Together, Ollama, vLLM).",
    defaultModel: "llama-3.3-70b-versatile",
    recommendedModels: [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "mixtral-8x7b-32768",
    ],
  },
};

export interface AiRuntimeConfig {
  provider: AiProvider;
  baseUrl: string;
  model: string;
  apiKey: string;
  source: "database" | "env_fallback";
  maskedApiKey: string;
  updatedAt?: string;
  updatedBy?: string;
  isActive: boolean;
}

export interface MaskedAiConfigResponse {
  provider: AiProvider;
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
  maskedApiKey: string;
  source: "database" | "env_fallback";
  updatedAt: string | null;
  updatedBy: string | null;
  isActive: boolean;
  availableProviders: ProviderPreset[];
}

const SETTING_KEY_PROVIDER = "ai_provider";
const SETTING_KEY_BASE_URL = "ai_base_url";
const SETTING_KEY_MODEL = "ai_model";
const SETTING_KEY_API_KEY_ENC = "ai_api_key_encrypted";
const SETTING_KEY_API_KEY_MASKED = "ai_api_key_masked";
const SETTING_KEY_IS_ACTIVE = "ai_is_active";
const SETTING_KEY_UPDATED_AT = "ai_updated_at";
const SETTING_KEY_UPDATED_BY = "ai_updated_by";

const ENCRYPTION_SALT = "perpustakaan-digital-sma-ai-encryption-salt-v1";

/**
 * Derives a 32-byte key for AES-256-GCM from the server-side NEXTAUTH_SECRET.
 */
function getDerivedKey(): Buffer {
  const secret = process.env.AI_CONFIG_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET || "default-local-fallback-secret-key-32";
  return crypto.scryptSync(secret, ENCRYPTION_SALT, 32);
}

/**
 * Encrypts an API key using AES-256-GCM with a unique 16-byte IV.
 * Format: iv:authTag:ciphertext (hex)
 */
export function encryptApiKey(plainKey: string): string {
  const key = getDerivedKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(plainKey, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an encrypted API key. Returns null if decryption fails or tag does not match.
 */
export function decryptApiKey(encryptedPayload: string): string | null {
  try {
    const parts = encryptedPayload.split(":");
    if (parts.length !== 3) return null;

    const [ivHex, authTagHex, cipherHex] = parts;
    const key = getDerivedKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(cipherHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error("Gagal melakukan dekripsi AI API Key:", error);
    return null;
  }
}

/**
 * Masks an API key for safe UI display (e.g., nvapi-••••••••68At).
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey) return "";
  const trimmed = apiKey.trim();
  if (trimmed.length <= 8) {
    return "••••••••";
  }

  // Preserve prefix like "nvapi-" or "sk-"
  let prefix = "";
  let remainder = trimmed;
  if (trimmed.startsWith("nvapi-")) {
    prefix = "nvapi-";
    remainder = trimmed.slice(6);
  } else if (trimmed.startsWith("sk-")) {
    prefix = "sk-";
    remainder = trimmed.slice(3);
  } else if (trimmed.startsWith("AIza")) {
    prefix = "AIza";
    remainder = trimmed.slice(4);
  } else {
    prefix = trimmed.slice(0, 3);
    remainder = trimmed.slice(3);
  }

  const suffix = remainder.slice(-4);
  return `${prefix}••••••••${suffix}`;
}

// In-memory cache for ultra-fast access in chat stream, invalidated immediately on config update.
let inMemoryCache: {
  config: AiRuntimeConfig;
  fetchedAt: number;
} | null = null;

const CACHE_TTL_MS = 5000; // 5 seconds max cache TTL to ensure multi-instance sync

export function invalidateAiConfigCache() {
  inMemoryCache = null;
}

/**
 * Retrieves the currently active runtime configuration.
 * Priority:
 * 1. Database runtime configuration (system_settings)
 * 2. Fallback to environment variables (.env: NVIDIA_API_KEY, NVIDIA_BASE_URL)
 */
export async function getAiRuntimeConfig(): Promise<AiRuntimeConfig> {
  const now = Date.now();
  if (inMemoryCache && now - inMemoryCache.fetchedAt < CACHE_TTL_MS) {
    return inMemoryCache.config;
  }

  try {
    const settings = await db.systemSetting.findMany({
      where: {
        key: {
          in: [
            SETTING_KEY_PROVIDER,
            SETTING_KEY_BASE_URL,
            SETTING_KEY_MODEL,
            SETTING_KEY_API_KEY_ENC,
            SETTING_KEY_API_KEY_MASKED,
            SETTING_KEY_IS_ACTIVE,
            SETTING_KEY_UPDATED_AT,
            SETTING_KEY_UPDATED_BY,
          ],
        },
      },
    });

    const settingMap = new Map<string, string>();
    for (const s of settings) {
      settingMap.set(s.key, s.value);
    }

    const encKey = settingMap.get(SETTING_KEY_API_KEY_ENC);
    const dbModel = settingMap.get(SETTING_KEY_MODEL);
    const dbProvider = (settingMap.get(SETTING_KEY_PROVIDER) as AiProvider) || "nvidia";
    const dbBaseUrl = settingMap.get(SETTING_KEY_BASE_URL);
    const dbMasked = settingMap.get(SETTING_KEY_API_KEY_MASKED) || "";
    const isActiveStr = settingMap.get(SETTING_KEY_IS_ACTIVE);
    const isActive = isActiveStr === undefined ? true : isActiveStr === "true";

    if (encKey && dbModel) {
      const decryptedKey = decryptApiKey(encKey);
      if (decryptedKey) {
        const preset = PROVIDER_PRESETS[dbProvider] || PROVIDER_PRESETS.nvidia;
        const config: AiRuntimeConfig = {
          provider: dbProvider,
          baseUrl: dbBaseUrl || preset.defaultBaseUrl,
          model: dbModel,
          apiKey: decryptedKey,
          source: "database",
          maskedApiKey: dbMasked || maskApiKey(decryptedKey),
          updatedAt: settingMap.get(SETTING_KEY_UPDATED_AT),
          updatedBy: settingMap.get(SETTING_KEY_UPDATED_BY),
          isActive,
        };

        inMemoryCache = { config, fetchedAt: now };
        return config;
      }
    }
  } catch (error) {
    console.error("Error membaca konfigurasi AI dari database:", error);
  }

  // Fallback to .env configuration
  const envKey = process.env.NVIDIA_API_KEY || "";
  const envBaseUrl = process.env.NVIDIA_BASE_URL || PROVIDER_PRESETS.nvidia.defaultBaseUrl;
  const envModel = PROVIDER_PRESETS.nvidia.defaultModel;

  const fallbackConfig: AiRuntimeConfig = {
    provider: "nvidia",
    baseUrl: envBaseUrl,
    model: envModel,
    apiKey: envKey,
    source: "env_fallback",
    maskedApiKey: maskApiKey(envKey),
    isActive: true,
  };

  inMemoryCache = { config: fallbackConfig, fetchedAt: now };
  return fallbackConfig;
}

/**
 * Returns a masked configuration object safe to send to the admin frontend UI.
 */
export async function getMaskedAiConfig(): Promise<MaskedAiConfigResponse> {
  const runtime = await getAiRuntimeConfig();
  const availableProviders = Object.values(PROVIDER_PRESETS);

  return {
    provider: runtime.provider,
    baseUrl: runtime.baseUrl,
    model: runtime.model,
    hasApiKey: !!runtime.apiKey,
    maskedApiKey: runtime.maskedApiKey,
    source: runtime.source,
    updatedAt: runtime.updatedAt || null,
    updatedBy: runtime.updatedBy || null,
    isActive: runtime.isActive,
    availableProviders,
  };
}

/**
 * Saves a new AI configuration atomically to system_settings.
 * If newApiKey is not provided, the existing stored encrypted key is retained.
 */
export async function saveAiConfig(params: {
  provider: AiProvider;
  baseUrl?: string;
  model: string;
  newApiKey?: string;
  adminUserId: string;
  adminUserName?: string;
}): Promise<{ ok: boolean; maskedConfig: MaskedAiConfigResponse }> {
  const { provider, model, newApiKey, adminUserId, adminUserName } = params;

  const preset = PROVIDER_PRESETS[provider] || PROVIDER_PRESETS.nvidia;
  const resolvedBaseUrl = (params.baseUrl?.trim() || preset.defaultBaseUrl).replace(/\/+$/, "");

  let keyEncryptedToSave: string | null = null;
  let keyMaskedToSave: string | null = null;

  if (newApiKey && newApiKey.trim().length > 0) {
    const rawKey = newApiKey.trim();
    keyEncryptedToSave = encryptApiKey(rawKey);
    keyMaskedToSave = maskApiKey(rawKey);
  } else {
    // Retain existing key from DB
    const existingEnc = await db.systemSetting.findUnique({
      where: { key: SETTING_KEY_API_KEY_ENC },
    });
    if (existingEnc) {
      keyEncryptedToSave = existingEnc.value;
      const existingMasked = await db.systemSetting.findUnique({
        where: { key: SETTING_KEY_API_KEY_MASKED },
      });
      keyMaskedToSave = existingMasked?.value || "••••••••";
    } else {
      // If DB has no key, check if env has fallback key and save that
      const envKey = process.env.NVIDIA_API_KEY;
      if (envKey) {
        keyEncryptedToSave = encryptApiKey(envKey);
        keyMaskedToSave = maskApiKey(envKey);
      } else {
        throw new Error("API Key wajib diisi untuk konfigurasi AI pertama kali.");
      }
    }
  }

  const nowIso = new Date().toISOString();
  const updaterName = adminUserName || adminUserId;

  const upserts = [
    { key: SETTING_KEY_PROVIDER, value: provider, description: "AI Provider aktif (nvidia/openai/gemini/custom)" },
    { key: SETTING_KEY_BASE_URL, value: resolvedBaseUrl, description: "AI Base API URL endpoint" },
    { key: SETTING_KEY_MODEL, value: model.trim(), description: "Model AI Assistant aktif" },
    { key: SETTING_KEY_API_KEY_ENC, value: keyEncryptedToSave, description: "Encrypted AI API Key (AES-256-GCM)" },
    { key: SETTING_KEY_API_KEY_MASKED, value: keyMaskedToSave, description: "Masked AI API Key untuk UI" },
    { key: SETTING_KEY_IS_ACTIVE, value: "true", description: "Status aktif konfigurasi AI" },
    { key: SETTING_KEY_UPDATED_AT, value: nowIso, description: "Waktu pembaruan konfigurasi AI" },
    { key: SETTING_KEY_UPDATED_BY, value: updaterName, description: "Pengguna yang memperbarui konfigurasi AI" },
  ];

  // Atomic database update using Prisma interactive transaction
  await db.$transaction(
    upserts.map((item) =>
      db.systemSetting.upsert({
        where: { key: item.key },
        update: { value: item.value, description: item.description },
        create: item,
      })
    )
  );

  // Invalidate cache immediately
  invalidateAiConfigCache();

  // Audit log entry
  try {
    await db.auditLog.create({
      data: {
        user_id: adminUserId,
        action: "UPDATE_AI_CONFIG",
        entity: "SYSTEM_SETTING",
        entity_id: "AI_CONFIGURATION",
        details: JSON.stringify({
          provider,
          baseUrl: resolvedBaseUrl,
          model,
          apiKeyUpdated: Boolean(newApiKey && newApiKey.trim().length > 0),
          updatedAt: nowIso,
        }),
      },
    });
  } catch (err) {
    console.error("Gagal mencatat audit log konfigurasi AI:", err);
  }

  const maskedConfig = await getMaskedAiConfig();
  return { ok: true, maskedConfig };
}

/**
 * Validates a base URL to prevent Server-Side Request Forgery (SSRF).
 */
export function validateEndpointUrl(urlString: string): { valid: boolean; error?: string } {
  try {
    const url = new URL(urlString);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return { valid: false, error: "Protokol endpoint harus berupa HTTP atau HTTPS." };
    }

    const hostname = url.hostname.toLowerCase();

    // Prevent access to internal/private addresses in production
    const isPrivate =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.16.") ||
      hostname.endsWith(".internal") ||
      hostname.endsWith(".local");

    if (process.env.NODE_ENV === "production" && isPrivate) {
      return { valid: false, error: "Endpoint tidak boleh mengarah ke alamat internal/lokal (SSRF protection)." };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: "Format URL endpoint tidak valid." };
  }
}

/**
 * Tests an AI provider connection by issuing a lightweight non-streaming completion.
 * Timeout: 12 seconds.
 */
export async function testAiConnection(params: {
  provider: AiProvider;
  baseUrl?: string;
  model: string;
  apiKey?: string;
  useStoredKey?: boolean;
}): Promise<{
  ok: boolean;
  latencyMs: number;
  message: string;
  statusCode?: number;
  errorCode?: string;
}> {
  const { provider, model, apiKey, useStoredKey } = params;
  const preset = PROVIDER_PRESETS[provider] || PROVIDER_PRESETS.nvidia;
  const baseUrl = (params.baseUrl?.trim() || preset.defaultBaseUrl).replace(/\/+$/, "");

  const urlCheck = validateEndpointUrl(baseUrl);
  if (!urlCheck.valid) {
    return {
      ok: false,
      latencyMs: 0,
      message: urlCheck.error || "URL endpoint tidak valid.",
      errorCode: "INVALID_URL",
    };
  }

  let effectiveApiKey = apiKey?.trim();
  if (!effectiveApiKey && useStoredKey) {
    const runtime = await getAiRuntimeConfig();
    effectiveApiKey = runtime.apiKey;
  }

  if (!effectiveApiKey) {
    return {
      ok: false,
      latencyMs: 0,
      message: "API Key belum dimasukkan atau belum tersimpan.",
      errorCode: "MISSING_API_KEY",
    };
  }

  const endpoint = `${baseUrl}/chat/completions`;
  const startTime = Date.now();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${effectiveApiKey}`,
      },
      body: JSON.stringify({
        model: model.trim(),
        messages: [{ role: "user", content: "Halo" }],
        max_tokens: 5,
        temperature: 0.1,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;

    if (res.ok) {
      return {
        ok: true,
        latencyMs,
        message: `Koneksi berhasil! Model [${model}] merespons dalam ${latencyMs}ms.`,
        statusCode: res.status,
      };
    }

    const errorBody = await res.text().catch(() => "");
    let friendlyMessage = `Gagal terhubung (${res.status} ${res.statusText}).`;

    if (res.status === 401) {
      friendlyMessage = "API Key tidak valid, tidak memiliki hak akses, atau sudah kedaluwarsa.";
    } else if (res.status === 404) {
      friendlyMessage = `Model [${model}] tidak ditemukan pada provider atau URL endpoint salah.`;
    } else if (res.status === 403) {
      friendlyMessage = "Akses ditolak oleh provider untuk model atau token yang digunakan.";
    } else if (res.status === 429) {
      friendlyMessage = "Rate limit tercapai atau kuota penggunaan API habis.";
    } else if (res.status >= 500) {
      friendlyMessage = "Server provider AI sedang mengalami gangguan sementara.";
    } else if (errorBody) {
      try {
        const parsed = JSON.parse(errorBody);
        if (parsed?.error?.message) {
          friendlyMessage = `Provider Error: ${parsed.error.message}`;
        }
      } catch {
        // use default friendly message
      }
    }

    return {
      ok: false,
      latencyMs,
      message: friendlyMessage,
      statusCode: res.status,
      errorCode: `HTTP_${res.status}`,
    };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;
    const isAbort = (err as Error)?.name === "AbortError";

    return {
      ok: false,
      latencyMs,
      message: isAbort
        ? "Waktu tunggu habis (timeout 12s). Provider tidak merespons tepat waktu."
        : "Gagal menghubungkan ke server provider AI. Periksa koneksi internet atau alamat endpoint.",
      errorCode: isAbort ? "TIMEOUT" : "NETWORK_ERROR",
    };
  }
}

/**
 * Fetches models dynamically from the provider endpoint (${baseUrl}/models).
 * Falls back to preset recommended models if dynamic fetch fails.
 */
export async function fetchProviderModels(params: {
  provider: AiProvider;
  baseUrl?: string;
  apiKey?: string;
  useStoredKey?: boolean;
}): Promise<{ models: string[]; isDynamic: boolean; message?: string }> {
  const { provider, apiKey, useStoredKey } = params;
  const preset = PROVIDER_PRESETS[provider] || PROVIDER_PRESETS.nvidia;
  const baseUrl = (params.baseUrl?.trim() || preset.defaultBaseUrl).replace(/\/+$/, "");

  let effectiveApiKey = apiKey?.trim();
  if (!effectiveApiKey && useStoredKey) {
    const runtime = await getAiRuntimeConfig();
    effectiveApiKey = runtime.apiKey;
  }

  if (!effectiveApiKey) {
    return {
      models: preset.recommendedModels,
      isDynamic: false,
      message: "Menggunakan daftar model rekomendasi bawaan (API Key belum tersedia).",
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${baseUrl}/models`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${effectiveApiKey}`,
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const rawList: Array<{ id?: string }> = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data)
          ? data
          : [];

      const modelIds = rawList
        .map((m) => m?.id)
        .filter((id): id is string => typeof id === "string" && id.length > 0);

      if (modelIds.length > 0) {
        // Sort and prioritize recommended models or alphabetically
        modelIds.sort((a, b) => a.localeCompare(b));
        return {
          models: modelIds,
          isDynamic: true,
          message: `Berhasil memuat ${modelIds.length} model langsung dari provider.`,
        };
      }
    }
  } catch (err) {
    console.warn("Gagal memuat daftar model dinamis dari provider:", err);
  }

  return {
    models: preset.recommendedModels,
    isDynamic: false,
    message: "Menggunakan daftar model rekomendasi (gagal memuat daftar dinamis dari endpoint provider).",
  };
}
