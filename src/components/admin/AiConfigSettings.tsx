"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bot,
  Key,
  Cpu,
  Server,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Save,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Activity,
  Clock,
  Lock,
} from "lucide-react";
import {
  AiProvider,
  MaskedAiConfigResponse,
  PROVIDER_PRESETS,
} from "@/lib/ai-config";

interface AuditLogItem {
  id: string;
  action: string;
  details: {
    provider?: string;
    baseUrl?: string;
    model?: string;
    apiKeyUpdated?: boolean;
    updatedAt?: string;
  } | null;
  createdAt: string;
  userName: string;
}

export function AiConfigSettings() {
  const [config, setConfig] = useState<MaskedAiConfigResponse | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [provider, setProvider] = useState<AiProvider>("nvidia");
  const [baseUrl, setBaseUrl] = useState("");
  const [manualEndpoint, setManualEndpoint] = useState(false);
  const [model, setModel] = useState("");
  const [customModel, setCustomModel] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);

  // Dynamic models state
  const [availableModels, setAvailableModels] = useState<string[]>(
    PROVIDER_PRESETS.nvidia.recommendedModels
  );
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsFetchMessage, setModelsFetchMessage] = useState<string | null>(null);

  // Action states
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    latencyMs?: number;
    message: string;
  } | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/ai-config");
      if (res.ok) {
        const data = await res.json();
        const conf: MaskedAiConfigResponse = data.config;
        setConfig(conf);
        setAuditLogs(data.auditLogs || []);

        // Populate form
        setProvider(conf.provider);
        setBaseUrl(conf.baseUrl);
        setModel(conf.model);
        setApiKey(""); // Keep blank initially

        const preset = PROVIDER_PRESETS[conf.provider] || PROVIDER_PRESETS.nvidia;
        const models = preset.recommendedModels;
        setAvailableModels(models);
        setManualEndpoint(conf.baseUrl !== preset.defaultBaseUrl);
        if (!models.includes(conf.model)) {
          setCustomModel(true);
        } else {
          setCustomModel(false);
        }
      } else {
        const err = await res.json();
        setNotification({
          type: "error",
          text: err.error || "Gagal memuat konfigurasi AI dari server.",
        });
      }
    } catch {
      setNotification({
        type: "error",
        text: "Terjadi kesalahan jaringan saat mengambil konfigurasi AI.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchConfig();
  }, [fetchConfig]);

  // Handle provider switch
  const handleProviderChange = (newProvider: AiProvider) => {
    setProvider(newProvider);
    const preset = PROVIDER_PRESETS[newProvider];
    if (!manualEndpoint) {
      setBaseUrl(preset.defaultBaseUrl);
    }
    setAvailableModels(preset.recommendedModels);
    setModel(preset.defaultModel);
    setCustomModel(false);
    setModelsFetchMessage(null);
    setTestResult(null);
  };

  // Fetch dynamic models from provider
  const handleFetchModels = async () => {
    setLoadingModels(true);
    setModelsFetchMessage(null);
    try {
      const res = await fetch("/api/admin/ai-config/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          baseUrl,
          apiKey: apiKey.trim() || undefined,
          useStoredKey: !apiKey.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && Array.isArray(data.models) && data.models.length > 0) {
        setAvailableModels(data.models);
        setModelsFetchMessage(
          data.isDynamic
            ? `Berhasil memuat ${data.models.length} model langsung dari provider.`
            : data.message || "Daftar model rekomendasi dimuat."
        );
        if (!data.models.includes(model)) {
          setModel(data.models[0]);
        }
      } else {
        setModelsFetchMessage(data.error || "Gagal memuat model dari provider.");
      }
    } catch {
      setModelsFetchMessage("Gagal menghubungi server untuk memuat model.");
    } finally {
      setLoadingModels(false);
    }
  };

  // Test connection
  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    setNotification(null);

    const testPayload = {
      provider,
      baseUrl: baseUrl.trim(),
      model: model.trim(),
      apiKey: apiKey.trim() || undefined,
      useStoredKey: !apiKey.trim(),
    };

    try {
      const res = await fetch("/api/admin/ai-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testPayload),
      });

      const data = await res.json();
      setTestResult({
        ok: res.ok && data.ok,
        latencyMs: data.latencyMs,
        message: data.message || (res.ok ? "Koneksi berhasil!" : "Koneksi gagal."),
      });
    } catch {
      setTestResult({
        ok: false,
        message: "Gagal melakukan pengujian koneksi karena kesalahan jaringan.",
      });
    } finally {
      setTesting(false);
    }
  };

  // Save configuration
  const handleSaveConfig = async () => {
    setSaving(true);
    setNotification(null);

    try {
      const res = await fetch("/api/admin/ai-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          baseUrl: baseUrl.trim() || undefined,
          model: model.trim(),
          apiKey: apiKey.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setNotification({
          type: "success",
          text: data.message || "Konfigurasi AI berhasil disimpan dan langsung aktif!",
        });
        setConfig(data.config);
        setApiKey(""); // clear input after save
        setShowApiKey(false);
        // Refresh audit logs
        void fetchConfig();
      } else {
        setNotification({
          type: "error",
          text: data.error || "Gagal menyimpan konfigurasi AI.",
        });
      }
    } catch {
      setNotification({
        type: "error",
        text: "Terjadi kesalahan jaringan saat menyimpan konfigurasi.",
      });
    } finally {
      setSaving(false);
    }
  };

  // Reset form to current saved config
  const handleReset = () => {
    if (!config) return;
    setProvider(config.provider);
    setBaseUrl(config.baseUrl);
    setModel(config.model);
    setApiKey("");
    setShowApiKey(false);
    setTestResult(null);
    setNotification({
      type: "info",
      text: "Formulir telah dikembalikan ke konfigurasi aktif yang tersimpan.",
    });

    const preset = PROVIDER_PRESETS[config.provider] || PROVIDER_PRESETS.nvidia;
    setAvailableModels(preset.recommendedModels);
    setManualEndpoint(config.baseUrl !== preset.defaultBaseUrl);
    if (!preset.recommendedModels.includes(config.model)) {
      setCustomModel(true);
    } else {
      setCustomModel(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 text-sm flex flex-col items-center gap-3">
        <RefreshCw className="w-5 h-5 animate-spin text-indigo-500" />
        <span>Memuat data konfigurasi AI Assistant...</span>
      </div>
    );
  }

  const isFormDirty =
    Boolean(config) &&
    (provider !== config?.provider ||
      baseUrl !== config?.baseUrl ||
      model !== config?.model ||
      apiKey.trim().length > 0);

  return (
    <div className="space-y-6">
      {/* Active Status Overview Banner */}
      <div className="glass-card p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 shrink-0">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Status AI Assistant Saat Ini
                </h2>
                {config?.source === "database" ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    <CheckCircle2 className="w-3 h-3" />
                    Konfigurasi Dinamis (Database Aktif)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                    <AlertCircle className="w-3 h-3" />
                    Fallback Bawaan (.env Aktif)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Setiap perubahan API Key atau model yang disimpan akan langsung diterapkan pada semua pengguna tanpa perlu merestart server.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs">
              <span className="text-slate-400 mr-1.5">Provider:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">
                {PROVIDER_PRESETS[config?.provider || "nvidia"]?.name || config?.provider}
              </span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-mono">
              <span className="text-slate-400 mr-1.5 font-sans">Model:</span>
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                {config?.model}
              </span>
            </div>
            {config?.updatedAt && (
              <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-500 flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                <span>Diperbarui {new Date(config.updatedAt).toLocaleDateString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Notification Toast/Alert */}
      {notification && (
        <div
          className={`p-4 rounded-2xl text-xs font-medium flex items-center gap-2.5 animate-in fade-in ${
            notification.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
              : notification.type === "error"
                ? "bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800"
                : "bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
          )}
          <span>{notification.text}</span>
        </div>
      )}

      {/* Main Configuration Card */}
      <div className="glass-card p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-6 bg-white dark:bg-slate-900 shadow-sm">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            Pengaturan Parameter & Provider AI Assistant
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Pilih provider, atur API Key terenkripsi, dan tentukan model LLM yang akan digunakan untuk asisten cerdas perpustakaan.
          </p>
        </div>

        {/* Section A: Provider Selection */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-indigo-500" />
            1. Pilihan Provider AI
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {(Object.keys(PROVIDER_PRESETS) as AiProvider[]).map((provKey) => {
              const p = PROVIDER_PRESETS[provKey];
              const isSelected = provider === provKey;
              return (
                <button
                  key={provKey}
                  type="button"
                  onClick={() => handleProviderChange(provKey)}
                  className={`p-4 rounded-xl border text-left transition-all relative ${
                    isSelected
                      ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 dark:border-indigo-500 ring-2 ring-indigo-500/20"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      {p.name}
                    </span>
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400"></span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {p.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Endpoint Base URL */}
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-indigo-500" />
              Endpoint API (Base URL)
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-[11px] font-semibold text-slate-600 dark:text-slate-300 select-none">
              <input
                type="checkbox"
                checked={manualEndpoint}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setManualEndpoint(checked);
                  if (!checked) {
                    setBaseUrl(PROVIDER_PRESETS[provider].defaultBaseUrl);
                  }
                }}
                className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Gunakan endpoint manual
            </label>
          </div>
          <div className="flex items-stretch gap-2">
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => {
                setBaseUrl(e.target.value);
                setManualEndpoint(true);
              }}
              placeholder={PROVIDER_PRESETS[provider].defaultBaseUrl}
              className="flex-1 min-w-0 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-indigo-500 rounded-xl text-xs font-mono text-slate-900 dark:text-white outline-none"
            />
            <button
              type="button"
              onClick={() => {
                setBaseUrl(PROVIDER_PRESETS[provider].defaultBaseUrl);
                setManualEndpoint(false);
              }}
              className="shrink-0 px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 font-semibold text-[11px] text-slate-700 dark:text-slate-200 transition"
              title="Isi otomatis dengan endpoint default provider terpilih"
            >
              Default Provider
            </button>
          </div>
          <p className="text-[10px] text-slate-400">
            {manualEndpoint
              ? "Mode endpoint manual aktif. Endpoint ini dipakai apa adanya dan tidak berubah saat provider diganti."
              : "Endpoint terisi otomatis dari provider terpilih, atau centang endpoint manual untuk memasukkan URL kustom."}
          </p>
        </div>

        {/* Section B: API Key Input */}
        <div className="space-y-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-indigo-500" />
              2. Kunci Akses (API Key)
            </label>
            {config?.hasApiKey && (
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                <Lock className="w-3 h-3" />
                <span>Tersimpan: {config.maskedApiKey}</span>
              </div>
            )}
          </div>

          <div className="relative">
            <input
              type={showApiKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                config?.hasApiKey
                  ? "•••••••••••••••••••• (Biarkan kosong jika tidak ingin mengubah)"
                  : "Masukkan API Key baru..."
              }
              className="w-full pr-10 px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:border-indigo-500 rounded-xl text-xs font-mono text-slate-900 dark:text-white outline-none"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
              title={showApiKey ? "Sembunyikan" : "Tampilkan"}
            >
              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>
              {apiKey.trim().length > 0 ? (
                <span className="text-amber-600 dark:text-amber-400 font-semibold">
                  * API Key baru telah dimasukkan (akan dienkripsi dengan AES-256-GCM saat disimpan).
                </span>
              ) : config?.hasApiKey ? (
                "API Key tersimpan aman di server dengan enkripsi AES-256-GCM."
              ) : (
                <span className="text-red-500 font-semibold">
                  * Belum ada API Key yang dikonfigurasi.
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Section C: Model Selection */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5 text-indigo-500" />
              3. Pemilihan Model AI
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCustomModel(!customModel)}
                className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
              >
                {customModel ? "Pilih dari Daftar Rekomendasi" : "Ketik Model Kustom"}
              </button>
              <button
                type="button"
                onClick={handleFetchModels}
                disabled={loadingModels}
                className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 font-semibold disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${loadingModels ? "animate-spin" : ""}`} />
                <span>Muat dari Provider</span>
              </button>
            </div>
          </div>

          {modelsFetchMessage && (
            <div className="p-2.5 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/40 text-[11px] text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              {modelsFetchMessage}
            </div>
          )}

          {customModel ? (
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Contoh: meta/llama-3.3-70b-instruct"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-indigo-500 rounded-xl text-xs font-mono text-slate-900 dark:text-white outline-none"
            />
          ) : (
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-indigo-500 rounded-xl text-xs font-mono text-slate-900 dark:text-white outline-none cursor-pointer"
            >
              {availableModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span>Model aktif saat ini:</span>
            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
              {model}
            </span>
          </div>
        </div>

        {/* Test Result Box */}
        {testResult && (
          <div
            className={`p-4 rounded-xl border text-xs animate-in fade-in flex items-start gap-3 ${
              testResult.ok
                ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
                : "bg-red-50 dark:bg-red-950/50 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200"
            }`}
          >
            {testResult.ok ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm">
                  {testResult.ok ? "Koneksi Berhasil Diuji" : "Pengujian Koneksi Gagal"}
                </span>
                {testResult.latencyMs !== undefined && (
                  <span className="px-2 py-0.5 rounded-md bg-white/60 dark:bg-black/30 font-mono text-[10px] font-bold">
                    Latency: {testResult.latencyMs}ms
                  </span>
                )}
              </div>
              <p className="text-xs leading-relaxed opacity-90">{testResult.message}</p>
            </div>
          </div>
        )}

        {/* Section D: Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing || saving}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-xs text-slate-800 dark:text-slate-200 transition flex items-center justify-center space-x-1.5 disabled:opacity-50"
            >
              {testing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Memeriksa Koneksi...</span>
                </>
              ) : (
                <>
                  <Activity className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Uji Koneksi</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleReset}
              disabled={!isFormDirty || saving || testing}
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-xs font-semibold transition flex items-center gap-1 disabled:opacity-30"
              title="Kembalikan form ke nilai tersimpan"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleSaveConfig}
            disabled={saving || testing}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Menyimpan & Menerapkan...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Simpan Konfigurasi</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Audit Log / History of Configuration Changes */}
      <div className="glass-card p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Riwayat Perubahan Konfigurasi AI (Audit Log)
            </h3>
          </div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {auditLogs.length} Aktivitas Tercatat
          </span>
        </div>

        {auditLogs.length === 0 ? (
          <p className="text-xs text-slate-400 py-3 text-center">
            Belum ada riwayat perubahan konfigurasi yang tercatat di sistem.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {auditLogs.map((log) => {
              const dateStr = new Date(log.createdAt).toLocaleString("id-ID", {
                dateStyle: "medium",
                timeStyle: "short",
              });
              return (
                <div key={log.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {log.userName}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-mono text-[10px]">
                        {log.details?.provider?.toUpperCase() || "AI"} &bull; {log.details?.model || "model"}
                      </span>
                      {log.details?.apiKeyUpdated && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold">
                          API Key Diperbarui
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono">
                      Endpoint: {log.details?.baseUrl || "-"}
                    </p>
                  </div>
                  <span className="text-[11px] text-slate-400 shrink-0">{dateStr}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
