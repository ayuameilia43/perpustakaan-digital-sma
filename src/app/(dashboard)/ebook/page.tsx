"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { BookOpen, Search, Tablet, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

type Book = {
  id: string;
  title: string;
  isbn: string;
  cover_image: string | null;
  is_ebook: boolean;
  author: { id: string; name: string };
  category: { id: string; name: string; code: string };
  ebook_format: string | null;
  ebook_size_mb: number | null;
};

type Meta = { page: number; limit: number; total: number; totalPages: number };

function EbookContent() {
  const [books, setBooks] = useState<Book[]>([]);
  const [meta, setMeta] = useState<Meta>({ page: 1, limit: 12, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const fetchBooks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "12",
        is_ebook: "true",
        ...(search && { search }),
      });
      const res = await fetch(`/api/books?${params}`);
      const json = await res.json();
      setBooks(json.data ?? []);
      setMeta(json.meta ?? { page: 1, limit: 12, total: 0, totalPages: 0 });
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
  // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBooks();
  }, [fetchBooks]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchBooks();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <BookOpen className="w-7 h-7 text-teal-400" />
          E-Book Reader
        </h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Baca e-book pelajaran dan sastra digital secara online
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearch} className="relative flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari judul, ISBN, pengarang..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500 transition"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm rounded-xl transition"
          >
            Cari
          </button>
        </form>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden animate-pulse">
              <div className="h-48 bg-slate-800" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-slate-800 rounded w-3/4" />
                <div className="h-3 bg-slate-800 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : books.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <BookOpen className="w-16 h-16 mb-3 opacity-20" />
          <p className="text-lg font-bold">E-book tidak ditemukan</p>
          <p className="text-sm">Coba kata kunci yang berbeda</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {books.map((b) => (
            <Link
              key={b.id}
              href={`/ebook/${b.id}`}
              className="group rounded-2xl bg-slate-900 border border-slate-800 hover:border-teal-700/60 overflow-hidden transition-all hover:shadow-lg hover:shadow-teal-900/20 hover:-translate-y-0.5 flex flex-col"
            >
              <div className="relative h-48 bg-slate-800 overflow-hidden">
                {b.cover_image ? (
                  <Image src={b.cover_image} alt={b.title} fill sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 200px" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Tablet className="w-12 h-12 text-slate-600" />
                  </div>
                )}
                <span className="absolute top-2 right-2 bg-teal-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Tablet className="w-3 h-3" />E-Book
                </span>
              </div>
              <div className="p-3 flex flex-col flex-1 justify-between space-y-1.5">
                <div>
                  <span className="text-[10px] font-bold uppercase text-teal-400">{b.category.name}</span>
                  <h3 className="font-bold text-xs text-slate-100 line-clamp-2 leading-snug mt-0.5">{b.title}</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">{b.author.name}</p>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-800/80 pt-1.5">
                  <span>{b.ebook_format ?? "PDF"}</span>
                  <span className="font-semibold text-teal-400">Digital</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm text-slate-400">
            Halaman <span className="font-bold text-white">{page}</span> dari {meta.totalPages}
            <span className="ml-2 text-xs">({meta.total} buku)</span>
          </span>
          <button
            onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
            disabled={page === meta.totalPages}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 transition"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function EbookPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <EbookContent />
    </Suspense>
  );
}
