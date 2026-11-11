"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Download,
  ExternalLink,
  Maximize,
  Minimize,
  Minus,
  Plus,
  Save,
  CheckCircle,
  FileWarning,
} from "lucide-react";

type EbookInfo = {
  id: string;
  title: string;
  is_ebook: boolean;
  ebook_file_url: string | null;
  ebook_format: string | null;
  ebook_size_mb: number | null;
  author: { id: string; name: string };
  category: { id: string; name: string; code: string };
};

type Progress = {
  id: string;
  last_page: number;
  total_pages: number;
  last_read_at: string;
};

function isPdf(book: EbookInfo | null): boolean {
  if (!book?.ebook_file_url) return false;
  const fmt = (book.ebook_format ?? "").toUpperCase();
  if (fmt.includes("PDF")) return true;
  return book.ebook_file_url.toLowerCase().split("?")[0].endsWith(".pdf");
}

export default function EbookReaderPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [book, setBook] = useState<EbookInfo | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [zoom, setZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lastPage, setLastPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const viewerRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/ebooks/${id}/progress`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Gagal memuat e-book");
        return;
      }
      setBook(json.data.book);
      setProgress(json.data.progress);
      if (json.data.progress) {
        setLastPage(json.data.progress.last_page);
        setTotalPages(json.data.progress.total_pages);
      }
    } catch {
      setError("Gagal memuat e-book. Periksa koneksi Anda.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const saveProgress = async (nextLast?: number, nextTotal?: number) => {
    setSaving(true);
    setSavedMsg("");
    try {
      const res = await fetch(`/api/ebooks/${id}/progress`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          last_page: nextLast ?? lastPage,
          total_pages: nextTotal ?? totalPages,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSavedMsg(json.error ?? "Gagal menyimpan progres");
        return;
      }
      setProgress(json.data);
      setLastPage(json.data.last_page);
      setTotalPages(json.data.total_pages);
      setSavedMsg("Progres tersimpan");
      setTimeout(() => setSavedMsg(""), 2500);
    } catch {
      setSavedMsg("Gagal menyimpan progres");
    } finally {
      setSaving(false);
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement && viewerRef.current) {
        await viewerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      // abaikan - browser tidak mendukung
    }
  };

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const pdf = isPdf(book);
  const fileUrl = book?.ebook_file_url ?? null;
  // Pertahankan halaman terakhir saat zoom berubah (hanya untuk PDF lokal/remote)
  const viewerSrc = pdf && fileUrl ? `${fileUrl}#page=${lastPage}&zoom=${zoom}` : null;
  const percent =
    totalPages > 0 ? Math.min(100, Math.round((lastPage / totalPages) * 100)) : 0;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-48 bg-slate-800 rounded animate-pulse" />
        <div className="rounded-2xl bg-slate-900 border border-slate-800 h-[70vh] animate-pulse" />
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <FileWarning className="w-14 h-14 text-slate-600 mb-3" />
        <h1 className="text-lg font-black text-white">E-book tidak dapat dibuka</h1>
        <p className="text-sm text-slate-400 mt-1">{error || "Data buku tidak ditemukan"}</p>
        <Link
          href="/ebook"
          className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold rounded-xl transition"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke E-Book
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <Link
            href="/ebook"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-teal-300 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Semua E-Book
          </Link>
          <h1 className="text-xl font-black text-white mt-1 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-teal-400 shrink-0" />
            <span className="line-clamp-2">{book.title}</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {book.author.name} • {book.category.name} • {book.ebook_format ?? "PDF"}
            {book.ebook_size_mb ? ` • ${book.ebook_size_mb} MB` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {fileUrl && (
            <>
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold rounded-xl transition"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Tab Baru
              </a>
              <a
                href={fileUrl}
                download
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl transition"
              >
                <Download className="w-3.5 h-3.5" /> Unduh
              </a>
            </>
          )}
        </div>
      </div>

      {!fileUrl ? (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-10 text-center">
          <FileWarning className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h2 className="font-bold text-slate-200">File e-book belum tersedia</h2>
          <p className="text-sm text-slate-400 mt-1">
            Pustakawan belum mengunggah file untuk judul ini. Silakan hubungi perpustakaan
            atau baca versi fisiknya.
          </p>
          <Link
            href={`/books/${book.id}`}
            className="mt-4 inline-block px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-xl transition"
          >
            Lihat Detail Buku
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Viewer */}
          <div className="xl:col-span-2 space-y-3">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2">
              <span className="text-[11px] font-bold uppercase text-slate-500 mr-1">Zoom</span>
              <button
                onClick={() => setZoom((z) => Math.max(50, z - 10))}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                title="Perkecil"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-slate-200 w-12 text-center">{zoom}%</span>
              <button
                onClick={() => setZoom((z) => Math.min(200, z + 10))}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                title="Perbesar"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoom(100)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Reset
              </button>
              <div className="w-px h-5 bg-slate-800 mx-1" />
              <button
                onClick={toggleFullscreen}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                {isFullscreen ? "Keluar" : "Layar Penuh"}
              </button>
              <span className="ml-auto text-[11px] text-slate-500 hidden sm:block">
                Hal. {lastPage}/{totalPages} • {percent}%
              </span>
            </div>

            <div ref={viewerRef} className="rounded-2xl overflow-hidden bg-slate-950 border border-slate-800">
              {pdf && viewerSrc ? (
                <iframe
                  key={viewerSrc}
                  src={viewerSrc}
                  title={`Baca ${book.title}`}
                  className="w-full h-[70vh] bg-white"
                />
              ) : (
                <div className="p-10 text-center">
                  <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <h2 className="font-bold text-slate-200">
                    Format {(book.ebook_format ?? "file").toUpperCase()} tidak bisa pratinjau langsung
                  </h2>
                  <p className="text-sm text-slate-400 mt-1">
                    Unduh file atau buka di tab baru untuk membaca.
                  </p>
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold rounded-xl transition"
                    >
                      <ExternalLink className="w-4 h-4" /> Buka di Tab Baru
                    </a>
                    <a
                      href={fileUrl}
                      download
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold rounded-xl transition"
                    >
                      <Download className="w-4 h-4" /> Unduh File
                    </a>
                  </div>
                </div>
              )}
            </div>
            {pdf && (
              <p className="text-[11px] text-slate-500">
                Tips: gunakan kontrol bawaan PDF (scroll/cari) untuk navigasi. Perbarui nomor
                halaman di panel progres agar bacaan tersimpan.
              </p>
            )}
          </div>

          {/* Progress panel */}
          <div className="space-y-3">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">
                Progres Bacaan Saya
              </h2>
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-slate-400">
                    Halaman <span className="font-bold text-white">{lastPage}</span> dari {totalPages}
                  </span>
                  <span className="font-bold text-teal-400">{percent}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2.5">
                  <div
                    className="h-2.5 rounded-full bg-teal-500 transition-all"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="last-page" className="text-xs text-slate-400 font-semibold block mb-1">
                    Halaman saat ini
                  </label>
                  <input
                    id="last-page"
                    type="number"
                    min={1}
                    max={totalPages}
                    value={lastPage}
                    onChange={(e) => setLastPage(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-teal-500 transition"
                  />
                </div>
                <div>
                  <label htmlFor="total-pages" className="text-xs text-slate-400 font-semibold block mb-1">
                    Total halaman
                  </label>
                  <input
                    id="total-pages"
                    type="number"
                    min={1}
                    value={totalPages}
                    onChange={(e) => setTotalPages(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-teal-500 transition"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => saveProgress()}
                  disabled={saving}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold rounded-xl transition disabled:opacity-60"
                >
                  <Save className="w-4 h-4" /> {saving ? "Menyimpan..." : "Simpan Progres"}
                </button>
                <button
                  onClick={() => saveProgress(totalPages, totalPages)}
                  disabled={saving}
                  title="Tandai sudah selesai dibaca"
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-semibold rounded-xl transition disabled:opacity-60"
                >
                  <CheckCircle className="w-4 h-4" /> Selesai
                </button>
              </div>
              {savedMsg && <p className="text-xs text-teal-400 font-semibold">{savedMsg}</p>}
              {progress && (
                <p className="text-[11px] text-slate-500">
                  Terakhir dibaca: {new Date(progress.last_read_at).toLocaleString("id-ID")}
                </p>
              )}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
                Informasi File
              </h2>
              <dl className="text-xs space-y-1.5">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Format</dt>
                  <dd className="font-semibold text-slate-200">{book.ebook_format ?? "PDF"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Ukuran</dt>
                  <dd className="font-semibold text-slate-200">
                    {book.ebook_size_mb ? `${book.ebook_size_mb} MB` : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500 shrink-0">Sumber</dt>
                  <dd className="font-mono text-slate-400 text-[10px] break-all text-right">
                    {book.ebook_file_url}
                  </dd>
                </div>
              </dl>
              <Link
                href={`/books/${book.id}`}
                className="mt-3 block text-center px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition"
              >
                Lihat Detail Buku
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
