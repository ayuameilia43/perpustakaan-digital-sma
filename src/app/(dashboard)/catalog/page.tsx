"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { BookOpen, Search, BookMarked, Tablet, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

type Book = {
  id: string;
  title: string;
  isbn: string;
  publish_year: number;
  cover_image: string | null;
  stock_available: number;
  stock_total: number;
  location_rack: string | null;
  is_ebook: boolean;
  language: string;
  pages: number | null;
  author: { id: string; name: string };
  category: { id: string; name: string; code: string };
  publisher: { id: string; name: string };
  _count: { copies: number };
};

type Category = { id: string; name: string; code: string };
type Meta = { page: number; limit: number; total: number; totalPages: number };

function CatalogContent() {
  const searchParams = useSearchParams();

  const [books, setBooks] = useState<Book[]>([]);
  const [meta, setMeta] = useState<Meta>({ page: 1, limit: 12, total: 0, totalPages: 0 });
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [category, setCategory] = useState(searchParams.get("category") ?? "");
  const [isEbook, setIsEbook] = useState(searchParams.get("is_ebook") ?? "");
  const [page, setPage] = useState(parseInt(searchParams.get("page") ?? "1"));

  const fetchCategories = useCallback(async () => {
    const res = await fetch("/api/categories");
    const json = await res.json();
    setCategories(json.data ?? []);
  }, []);

  const fetchBooks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page), limit: "12",
        ...(search && { search }),
        ...(category && { category }),
        ...(isEbook && { is_ebook: isEbook }),
      });
      const res = await fetch(`/api/books?${params}`);
      const json = await res.json();
      setBooks(json.data ?? []);
      setMeta(json.meta ?? { page: 1, limit: 12, total: 0, totalPages: 0 });
    } finally {
      setLoading(false);
    }
  }, [page, search, category, isEbook]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchCategories(); }, [fetchCategories]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchBooks(); }, [fetchBooks]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchBooks();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <BookOpen className="w-7 h-7 text-emerald-400" />
          Katalog Buku Perpustakaan
        </h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Jelajahi {meta.total} koleksi buku tersedia — {categories.length} kategori
        </p>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearch} className="relative flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id="catalog-search"
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari judul, ISBN, pengarang..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>
          <button
            type="submit"
            id="btn-catalog-search"
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl transition"
          >
            Cari
          </button>
        </form>
        <div className="flex gap-2">
          <select
            id="filter-category"
            value={category}
            onChange={e => { setCategory(e.target.value); setPage(1); }}
            className="px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="">Semua Kategori</option>
            {categories.map(c => <option key={c.id} value={c.code}>{c.name}</option>)}
          </select>
          <select
            id="filter-ebook"
            value={isEbook}
            onChange={e => { setIsEbook(e.target.value); setPage(1); }}
            className="px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="">Semua Format</option>
            <option value="false">Buku Fisik</option>
            <option value="true">E-Book</option>
          </select>
        </div>
      </div>

      {/* Category Chips */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => { setCategory(""); setPage(1); }}
          className={`px-3 py-1 rounded-full text-xs font-bold transition ${!category ? "bg-emerald-600 text-white" : "bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200"}`}
        >
          Semua
        </button>
        {categories.map(c => (
          <button
            key={c.id}
            onClick={() => { setCategory(c.code); setPage(1); }}
            className={`px-3 py-1 rounded-full text-xs font-bold transition ${category === c.code ? "bg-emerald-600 text-white" : "bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200"}`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Book Grid */}
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
          <p className="text-lg font-bold">Buku tidak ditemukan</p>
          <p className="text-sm">Coba kata kunci atau filter yang berbeda</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {books.map(b => (
            <Link
              key={b.id}
              href={`/books/${b.id}`}
              id={`book-card-${b.id}`}
              className="group rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-700/60 overflow-hidden transition-all hover:shadow-lg hover:shadow-emerald-900/20 hover:-translate-y-0.5 flex flex-col"
            >
              <div className="relative h-48 bg-slate-800 overflow-hidden">
                {b.cover_image ? (
                  <Image src={b.cover_image} alt={b.title} fill sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 200px" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <BookMarked className="w-12 h-12 text-slate-600" />
                  </div>
                )}
                {b.is_ebook && (
                  <span className="absolute top-2 right-2 bg-teal-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Tablet className="w-3 h-3" />E-Book
                  </span>
                )}
                {b.stock_available === 0 && !b.is_ebook && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="text-xs font-black text-red-300 bg-red-950/80 px-2 py-1 rounded-full">Tidak Tersedia</span>
                  </div>
                )}
              </div>
              <div className="p-3 flex flex-col flex-1 justify-between space-y-1.5">
                <div>
                  <span className="text-[10px] font-bold uppercase text-emerald-400">{b.category.name}</span>
                  <h3 className="font-bold text-xs text-slate-100 line-clamp-2 leading-snug mt-0.5">{b.title}</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">{b.author.name}</p>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-800/80 pt-1.5">
                  <span>{b.publish_year}</span>
                  <span className={`font-semibold ${b.stock_available > 0 || b.is_ebook ? "text-emerald-400" : "text-red-400"}`}>
                    {b.is_ebook ? "Digital" : `${b.stock_available}/${b.stock_total}`}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
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
            onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
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

export default function CatalogPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <CatalogContent />
    </Suspense>
  );
}
