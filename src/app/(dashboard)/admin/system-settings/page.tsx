"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { formatRupiah } from "@/lib/utils";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Save,
  ShieldCheck,
  Sliders,
  Sparkles,
} from "lucide-react";
import { AiConfigSettings } from "@/components/admin/AiConfigSettings";

interface SettingItem {
  id: string;
  key: string;
  value: string;
  description: string | null;
}

function SystemSettingsContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "ai" ? "ai" : "general";
  const [activeTab, setActiveTab] = useState<"general" | "ai">(initialTab);

  const [settings, setSettings] = useState<SettingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "ai" || tabParam === "general") {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      } else {
        setMessage({ type: "error", text: "Gagal memuat pengaturan sistem." });
      }
    } catch {
      setMessage({ type: "error", text: "Terjadi kesalahan jaringan." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchSettings();
  }, []);

  const handleUpdate = async (key: string, newValue: string) => {
    setSavingKey(key);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: newValue }),
      });

      if (res.ok) {
        setMessage({ type: "success", text: `Pengaturan [${key}] berhasil diperbarui.` });
        void fetchSettings();
      } else {
        const err = await res.json();
        setMessage({ type: "error", text: err.error || "Gagal menyimpan pengaturan." });
      }
    } catch {
      setMessage({ type: "error", text: "Terjadi kesalahan koneksi server." });
    } finally {
      setSavingKey(null);
    }
  };

  const handleInputChange = (key: string, val: string) => {
    setSettings((prev) =>
      prev.map((item) => (item.key === key ? { ...item, value: val } : item))
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
            <Sliders className="w-4 h-4" />
            <span>Modul Administrator</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-1">
            System Settings & Konfigurasi
          </h1>
          <p className="text-sm text-slate-500">
            Kelola parameter kebijakan sirkulasi perpustakaan dan konfigurasi dinamis AI Assistant.
          </p>
        </div>

        <div className="flex items-center space-x-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-3.5 py-2 rounded-xl text-xs font-bold border border-indigo-200 dark:border-indigo-800 shrink-0">
          <ShieldCheck className="w-4 h-4" />
          <span>Role: Administrator Only</span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 pb-px">
        <button
          type="button"
          onClick={() => setActiveTab("general")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 -mb-px ${
            activeTab === "general"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-500 bg-white dark:bg-slate-900 shadow-xs"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Kebijakan Perpustakaan</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("ai")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 -mb-px ${
            activeTab === "ai"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-500 bg-white dark:bg-slate-900 shadow-xs"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Bot className="w-4 h-4 text-indigo-500" />
          <span>Konfigurasi AI Assistant</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 font-extrabold">
            Dinamis
          </span>
        </button>
      </div>

      {/* Tab: General Settings (Kebijakan Perpustakaan) */}
      {activeTab === "general" && (
        <div className="space-y-6">
          {message && (
            <div
              className={`p-4 rounded-2xl text-xs font-medium flex items-center gap-2.5 animate-in fade-in ${
                message.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                  : "bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800"
              }`}
            >
              {message.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          {loading ? (
            <div className="p-12 text-center text-slate-400 text-sm">Memuat konfigurasi sistem...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {settings.map((item) => (
                <div
                  key={item.id}
                  className="glass-card p-5 rounded-2xl space-y-4 border border-slate-200 dark:border-slate-800 hover:shadow-md transition bg-white dark:bg-slate-900"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 font-mono">
                        {item.key}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {item.description || "Konfigurasi parameter sistem perpustakaan."}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-1 rounded-md">
                      Active Config
                    </span>
                  </div>

                  <div className="flex items-center space-x-3 pt-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={item.value}
                        onChange={(e) => handleInputChange(item.key, e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-indigo-500 rounded-xl text-sm font-semibold text-slate-900 dark:text-white outline-none"
                      />
                      {item.key.includes("fine_per_day") && (
                        <span className="absolute right-3 top-2 text-xs font-semibold text-slate-400">
                          ({formatRupiah(parseInt(item.value) || 0)})
                        </span>
                      )}
                      {item.key === "fine_payment_deadline_days" && (
                        <span className="absolute right-3 top-2 text-xs font-semibold text-slate-400">
                          (hari sejak denda diterbitkan)
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleUpdate(item.key, item.value)}
                      disabled={savingKey === item.key}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center space-x-1.5 disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{savingKey === item.key ? "Menyimpan..." : "Simpan"}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: AI Assistant Dynamic Configuration */}
      {activeTab === "ai" && <AiConfigSettings />}
    </div>
  );
}

export default function SystemSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-slate-400 text-sm">
          Memuat halaman pengaturan...
        </div>
      }
    >
      <SystemSettingsContent />
    </Suspense>
  );
}
