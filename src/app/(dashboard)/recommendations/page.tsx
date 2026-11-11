"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { Sparkles, BookOpen, RefreshCw, Star } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

type Book = {
  id: string;
  title: string;
  isbn: string;
  cover_image: string | null;
  is_ebook: boolean;
  total_borrowed: number;
  rating_avg: number;
  author: { id: string; name: string };
  category: { id: string; name: string; code: string };
};

function RecommendationsContent() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecommendations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/books?limit=12&sort=popular");
      const json = await res.json();
      setBooks(json.data ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
  // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRecommendations();
  }, [fetchRecommendations]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Sparkles className="w-7 h-7 text-purple-400" />
            Rekomendasi AI
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Rekomendasi buku berdasarkan popularitas dan rating
          </p>
        </div>
        <button
          onClick={fetchRecommendations}
          className="p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-400 hover:text-slate-200 transition"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
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
          <Sparkles className="w-16 h-16 mb-3 opacity-20" />
          <p className="text-lg font-bold">Belum ada rekomendasi</p>
          <p className="text-sm">Data rekomendasi akan muncul setelah ada aktivitas peminjaman</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {books.map((b) => (
            <Link
              key={b.id}
              href={`/books/${b.id}`}
              className="group rounded-2xl bg-slate-900 border border-slate-800 hover:border-purple-700/60 overflow-hidden transition-all hover:shadow-lg hover:shadow-purple-900/20 hover:-translate-y-0.5 flex flex-col"
            >
              <div className="relative h-48 bg-slate-800 overflow-hidden">
                {b.cover_image ? (
                  <Image src={b.cover_image} alt={b.title} fill sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 200px" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <BookOpen className="w-12 h-12 text-slate-600" />
                  </div>
                )}
                {b.is_ebook && (
                  <span className="absolute top-2 right-2 bg-teal-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full">
                    E-Book
                  </span>
                )}
              </div>
              <div className="p-3 flex flex-col flex-1 justify-between space-y-1.5">
                <div>
                  <span className="text-[10px] font-bold uppercase text-purple-400">{b.category.name}</span>
                  <h3 className="font-bold text-xs text-slate-100 line-clamp-2 leading-snug mt-0.5">{b.title}</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">{b.author.name}</p>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-800/80 pt-1.5">
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    <span>{b.rating_avg > 0 ? b.rating_avg.toFixed(1) : "—"}</span>
                  </div>
                  <span className="font-semibold text-purple-400">{b.total_borrowed}x dipinjam</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RecommendationsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <RecommendationsContent />
    </Suspense>
  );
}
