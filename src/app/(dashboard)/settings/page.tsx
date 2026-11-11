"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { User, Shield, Save, CheckCircle, Send, Link, Unlink, ExternalLink } from "lucide-react";

interface TelegramStatus {
  linked: boolean;
  linkedAt: string | null;
  botConfigured: boolean;
}

interface LinkTokenData {
  token: string;
  expiresAt: string;
  deepLink: string | null;
  instructions: string[];
}

export default function SettingsPage() {
  const { data: session, update } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [tgStatus, setTgStatus] = useState<TelegramStatus | null>(null);
  const [tgLoading, setTgLoading] = useState(false);
  const [tgMessage, setTgMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [linkData, setLinkData] = useState<LinkTokenData | null>(null);
  const [showDisconnect, setShowDisconnect] = useState(false);

  useEffect(() => {
    if (session?.user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(session.user.name ?? "");
      setEmail(session.user.email ?? "");
    }
  }, [session]);

  const fetchTelegramStatus = async () => {
    try {
      const res = await fetch("/api/telegram/link");
      if (res.ok) {
        const json = await res.json();
        setTgStatus(json.data);
      }
    } catch {
      // silent
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTelegramStatus();
  }, []);

  useEffect(() => {
    if (!linkData) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/telegram/link");
        if (res.ok) {
          const json = await res.json();
          if (json.data.linked) {
            setTgStatus(json.data);
            setLinkData(null);
            setTgMessage({ type: "success", text: "Telegram berhasil dihubungkan!" });
            clearInterval(interval);
          }
        }
      } catch {
        // silent — lanjut polling
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [linkData]);

  const handleConnectTelegram = async () => {
    setTgLoading(true);
    setTgMessage(null);
    setLinkData(null);
    try {
      const res = await fetch("/api/telegram/link", { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        setLinkData(json.data);
      } else {
        setTgMessage({ type: "error", text: json.error || "Gagal membuat kode pengaitan" });
      }
    } catch {
      setTgMessage({ type: "error", text: "Terjadi kesalahan" });
    } finally {
      setTgLoading(false);
    }
  };

  const handleCheckStatus = async () => {
    setTgLoading(true);
    setTgMessage(null);
    try {
      await fetchTelegramStatus();
      setTgMessage({ type: "success", text: "Status diperbarui" });
    } catch {
      setTgMessage({ type: "error", text: "Gagal memeriksa status" });
    } finally {
      setTgLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setTgLoading(true);
    setTgMessage(null);
    try {
      const res = await fetch("/api/telegram/unlink", { method: "DELETE" });
      if (res.ok) {
        setTgMessage({ type: "success", text: "Telegram berhasil diputuskan" });
        setTgStatus({ linked: false, linkedAt: null, botConfigured: tgStatus?.botConfigured ?? false });
        setLinkData(null);
        setShowDisconnect(false);
      } else {
        const json = await res.json();
        setTgMessage({ type: "error", text: json.error || "Gagal memutuskan hubungan" });
      }
    } catch {
      setTgMessage({ type: "error", text: "Terjadi kesalahan" });
    } finally {
      setTgLoading(false);
    }
  };

  const copyToken = () => {
    if (linkData) {
      navigator.clipboard.writeText(linkData.token);
      setTgMessage({ type: "success", text: "Kode disalin!" });
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Profil berhasil diperbarui" });
        await update();
      } else {
        const err = await res.json();
        setMessage({ type: "error", text: err.error || "Gagal memperbarui profil" });
      }
    } catch {
      setMessage({ type: "error", text: "Terjadi kesalahan" });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Password berhasil diubah" });
        setCurrentPassword("");
        setNewPassword("");
      } else {
        const err = await res.json();
        setMessage({ type: "error", text: err.error || "Gagal mengubah password" });
      }
    } catch {
      setMessage({ type: "error", text: "Terjadi kesalahan" });
    } finally {
      setSaving(false);
    }
  };

  if (!session) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
          <User className="w-7 h-7 text-emerald-600" />
          Pengaturan Akun
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">Kelola profil dan keamanan akun Anda</p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-2xl text-xs font-medium flex items-center gap-2.5 ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
              : "bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle className="w-4 h-4 shrink-0" />
          ) : (
            <Shield className="w-4 h-4 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <div className="glass-card rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
        <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <User className="w-4 h-4 text-emerald-600" />
          Informasi Profil
        </h2>
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className="text-xs text-slate-500 font-semibold block mb-1">Nama Lengkap</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 font-semibold block mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 font-semibold block mb-1">Role</label>
            <input
              type="text"
              value={session.user.role}
              disabled
              className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-500 dark:text-slate-400"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl transition disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? "Menyimpan..." : "Simpan Profil"}
          </button>
        </form>
      </div>

      <div className="glass-card rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
        <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-600" />
          Ubah Password
        </h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="text-xs text-slate-500 font-semibold block mb-1">Password Saat Ini</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 font-semibold block mb-1">Password Baru</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition"
              placeholder="Min. 8 karakter"
            />
          </div>
          <button
            type="submit"
            disabled={saving || !currentPassword || !newPassword}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl transition disabled:opacity-50 flex items-center gap-2"
          >
            <Shield className="w-4 h-4" />
            {saving ? "Mengubah..." : "Ubah Password"}
          </button>
        </form>
      </div>

      <div className="glass-card rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
        <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Send className="w-4 h-4 text-emerald-600" />
          Integrasi Telegram
        </h2>

        {tgMessage && (
          <div
            className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
              tgMessage.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                : "bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800"
            }`}
          >
            {tgMessage.type === "success" ? (
              <CheckCircle className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <Shield className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>{tgMessage.text}</span>
          </div>
        )}

        {tgStatus === null ? (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            Memeriksa status...
          </div>
        ) : !tgStatus.botConfigured ? (
          <div className="p-3 rounded-xl text-xs bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
            Telegram bot belum dikonfigurasi di server. Hubungi administrator.
          </div>
        ) : tgStatus.linked ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/60 dark:border-emerald-800">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="text-xs">
                <span className="font-bold text-emerald-800 dark:text-emerald-300">Terhubung</span>
                {tgStatus.linkedAt && (
                  <span className="text-emerald-600 dark:text-emerald-400 ml-2">
                    sejak {new Date(tgStatus.linkedAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCheckStatus}
                disabled={tgLoading}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition disabled:opacity-50 flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                Periksa Status
              </button>
              <button
                onClick={() => setShowDisconnect(true)}
                disabled={tgLoading}
                className="px-3.5 py-2 bg-red-100 hover:bg-red-200 dark:bg-red-950/60 dark:hover:bg-red-900/60 text-red-700 dark:text-red-400 font-bold text-xs rounded-xl transition disabled:opacity-50 flex items-center gap-1.5"
              >
                <Unlink className="w-3.5 h-3.5" />
                Putuskan
              </button>
            </div>

            {showDisconnect && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 dark:bg-red-950/60 dark:border-red-800 space-y-2">
                <p className="text-xs text-red-800 dark:text-red-300 font-medium">
                  Yakin ingin memutuskan hubungan Telegram? Anda tidak akan menerima notifikasi lagi.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDisconnect}
                    disabled={tgLoading}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-lg transition disabled:opacity-50"
                  >
                    {tgLoading ? "Memutuskan..." : "Ya, Putuskan"}
                  </button>
                  <button
                    onClick={() => setShowDisconnect(false)}
                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-lg transition"
                  >
                    Batal
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 dark:bg-slate-800/60 dark:border-slate-700">
              <div className="w-2 h-2 rounded-full bg-slate-400" />
              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Belum terhubung</span>
            </div>

            {!linkData ? (
              <button
                onClick={handleConnectTelegram}
                disabled={tgLoading}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl transition disabled:opacity-50 flex items-center gap-2"
              >
                <Link className="w-4 h-4" />
                {tgLoading ? "Membuat kode..." : "Hubungkan Telegram"}
              </button>
            ) : (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 dark:bg-blue-950/60 dark:border-blue-800 space-y-2">
                  <p className="text-xs text-blue-800 dark:text-blue-300 font-medium">
                    Kode pengaitan berhasil dibuat. Gunakan kode ini di bot Telegram:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-200 break-all">
                      {linkData.token}
                    </code>
                    <button
                      onClick={copyToken}
                      className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg transition shrink-0"
                    >
                      Salin
                    </button>
                  </div>
                </div>

                {linkData.deepLink && (
                  <a
                    href={linkData.deepLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-white font-bold text-sm rounded-xl transition"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Buka Bot Telegram
                  </a>
                )}

                <div className="text-xs text-slate-500 space-y-1">
                  <p className="font-semibold">Cara menghubungkan:</p>
                  <ol className="list-decimal list-inside space-y-0.5">
                    {linkData.instructions.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>

                <p className="text-xs text-slate-400">
                  Kode berlaku sampai {new Date(linkData.expiresAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                </p>

                <button
                  onClick={() => setLinkData(null)}
                  className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline"
                >
                  Buat kode baru
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
