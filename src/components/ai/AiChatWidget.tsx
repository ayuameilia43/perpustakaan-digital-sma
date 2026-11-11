"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Bot, MessageCircle, Send, ShieldAlert, Trash2, User, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Event global agar tombol di halaman lain bisa membuka popup chat. */
export const AI_CHAT_OPEN_EVENT = "ai-chat:open";

export function openAiChat() {
  window.dispatchEvent(new CustomEvent(AI_CHAT_OPEN_EVENT));
}

interface Message {
  role: "user" | "assistant";
  content: string;
  outOfScope?: boolean;
}

const SUGGESTIONS = [
  "Siapa saya?",
  "Buku apa saja yang sedang saya pinjam?",
  "Buku apa yang sudah selesai saya pinjam?",
  "Aturan pinjam untuk siswa",
];

const STREAM_FLUSH_MS = 60;

/**
 * Widget obrolan AI mengambang (pojok kanan bawah).
 * Logika chat identik dengan halaman /ai-assistant lama:
 * POST /api/ai/chat dengan body { messages }, flag outOfScope,
 * Enter untuk kirim, tombol hapus riwayat tampilan.
 * Respons AI di-stream (SSE) lalu dirender progresif; respons non-stream
 * (mis. penolakan di luar konteks) tetap didukung sebagai fallback JSON.
 */
export function AiChatWidget() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener(AI_CHAT_OPEN_EVENT, handler);
    return () => window.removeEventListener(AI_CHAT_OPEN_EVENT, handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Batalkan permintaan AI yang masih berjalan saat komponen dilepas.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMessage: Message = { role: "user", content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const appendAssistant = (message: Message) => {
      setMessages([...newMessages, message]);
    };

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
        signal: controller.signal,
      });

      const contentType = res.headers.get("content-type") ?? "";

      // Respons non-stream: validasi error, atau penolakan di luar konteks (JSON).
      if (!res.ok || !contentType.includes("text/event-stream") || !res.body) {
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          appendAssistant({
            role: "assistant",
            content: `Error: ${data?.error || "Unknown error"}`,
          });
        } else {
          appendAssistant({
            role: "assistant",
            content:
              data?.response ||
              "Maaf, saya tidak dapat memproses permintaan Anda saat ini.",
            outOfScope: Boolean(data?.outOfScope),
          });
        }
        return;
      }

      appendAssistant({ role: "assistant", content: "" });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";
      let flushTimer: number | null = null;

      const flush = () => {
        const content = accumulated;
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const next = [...prev];
          next[next.length - 1] = { ...next[next.length - 1], content };
          return next;
        });
      };

      const scheduleFlush = () => {
        if (flushTimer !== null) return;
        flushTimer = window.setTimeout(() => {
          flushTimer = null;
          flush();
        }, STREAM_FLUSH_MS);
      };

      const handleEvent = (payload: Record<string, unknown>): boolean => {
        if (typeof payload.delta === "string") {
          accumulated += payload.delta;
          scheduleFlush();
          return true;
        }
        if (typeof payload.error === "string") {
          accumulated = `Error: ${payload.error}`;
          return false;
        }
        return typeof payload.done !== "boolean" || !payload.done;
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        let keepReading = true;
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;

          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(payload);
          } catch {
            continue;
          }
          if (!handleEvent(parsed)) {
            keepReading = false;
            break;
          }
        }
        if (!keepReading) break;
      }

      if (flushTimer !== null) window.clearTimeout(flushTimer);
      flush();

      if (!accumulated) {
        appendAssistant({
          role: "assistant",
          content: "Maaf, saya tidak dapat memproses permintaan Anda saat ini.",
        });
      }
    } catch {
      if (!controller.signal.aborted) {
        appendAssistant({
          role: "assistant",
          content: "Maaf, terjadi kesalahan. Silakan coba lagi.",
        });
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setIsLoading(false);
    }
  }, [input, isLoading, messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Hanya untuk pengguna yang sudah login (sama seperti menu sidebar lama:
  // semua role yang terautentikasi boleh memakai AI Assistant).
  if (!session?.user) return null;

  return (
    <>
      {/* Tombol mengambang */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Tutup AI Assistant" : "Buka AI Assistant"}
        title="AI Assistant"
        className={cn(
          "fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all hover:scale-105 active:scale-95",
          open
            ? "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
            : "bg-gradient-to-tr from-purple-600 to-indigo-500 hover:from-purple-500 hover:to-indigo-400 text-white shadow-purple-900/40"
        )}
      >
        {open ? <X className="w-6 h-6" /> : <Bot className="w-7 h-7" />}
        {!open && (
          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-slate-950" />
        )}
      </button>

      {/* Panel popup */}
      {open && (
        <div className="fixed bottom-21 right-5 z-50 w-[min(92vw,380px)] h-[min(70vh,560px)] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-500 text-white shrink-0">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm leading-tight">AI Library Assistant</p>
              <p className="text-[11px] text-purple-100 truncate">
                Tanya buku, pinjaman & layanan perpus
              </p>
            </div>
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="p-1.5 rounded-lg hover:bg-white/20 transition"
                title="Hapus percakapan"
                aria-label="Hapus percakapan"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/20 transition"
              title="Tutup"
              aria-label="Tutup chat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Daftar pesan */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-3 py-6">
                <div className="w-14 h-14 rounded-2xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <Bot className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    Halo! Saya AI Assistant
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-[260px]">
                    Saya mempelajari seluruh data perpustakaan: katalog buku, stok,
                    aturan peminjaman, sampai data pinjaman Anda.
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setInput(suggestion)}
                      className="px-2.5 py-1 text-[11px] rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}
              >
                {msg.role === "assistant" && (
                  <div
                    className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                      msg.outOfScope
                        ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                        : "bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400"
                    )}
                  >
                    {msg.outOfScope ? <ShieldAlert className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap",
                    msg.role === "user"
                      ? "bg-emerald-600 text-white rounded-br-md"
                      : msg.outOfScope
                        ? "bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-900 rounded-bl-md"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-md"
                  )}
                >
                  {msg.content}
                </div>
                {msg.role === "user" && (
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-2 justify-start">
                <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-slate-200 dark:border-slate-800 p-3 shrink-0">
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Tulis pertanyaan..."
                rows={1}
                className="flex-1 resize-none rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-[13px] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                aria-label="Kirim pesan"
                className="shrink-0 w-9 h-9 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white flex items-center justify-center transition"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-slate-400 flex items-center gap-1">
              <MessageCircle className="w-3 h-3 shrink-0" />
              Menjawab sesuai data sistem perpustakaan.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
