"use client";
import React from "react";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  BookOpen, Plus, Search, RefreshCw, Edit, Trash2,
  ChevronLeft, ChevronRight, BookMarked, Tablet
} from "lucide-react";
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
  ebook_file_url: string | null;
  language: string;
  author: { id: string; name: string };
  category: { id: string; name: string; code: string };
  publisher: { id: string; name: string };
  _count: { copies: number };
};

type Author = { id: string; name: string };
type Publisher = { id: string; name: string };
type Category = { id: string; name: string; code: string };
type Meta = { page: number; limit: number; total: number; totalPages: number };

type FormData = {
  title: string; isbn: string; author_id: string; publisher_id: string;
  category_id: string; publish_year: string; description: string;
  language: string; pages: string; cover_image: string;
  stock_total: string; location_rack: string; is_ebook: boolean;
  ebook_file_url: string;
};

const EMPTY_FORM: FormData = {
  title: "", isbn: "", author_id: "", publisher_id: "", category_id: "",
  publish_year: String(new Date().getFullYear()), description: "",
  language: "Indonesia", pages: "", cover_image: "", stock_total: "1",
  location_rack: "", is_ebook: false, ebook_file_url: "",
};


// FormField dan INPUT_CLS di module scope agar tidak di-recreate tiap render
// (fixes react-hooks/static-components eslint rule)
function FormField({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="text-xs text-slate-400 font-semibold block mb-1">{label}</label>
      {children}
    </div>
  );
}

const INPUT_CLS = "w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-blue-500 transition";

function BooksManagementContent() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  const [books, setBooks] = useState<Book[]>([]);
  const [meta, setMeta] = useState<Meta>({ page: 1, limit: 15, total: 0, totalPages: 0 });
  const [authors, setAuthors] = useState<Author[]>([]);
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(1);

  const [modalMode, setModalMode] = useState<"create" | "edit" | "delete" | null>(null);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchMeta = useCallback(async () => {
    const [authRes, pubRes, catRes] = await Promise.all([
      fetch("/api/authors"), fetch("/api/publishers"), fetch("/api/categories"),
    ]);
    const [a, p, c] = await Promise.all([authRes.json(), pubRes.json(), catRes.json()]);
    setAuthors(a.data ?? []);
    setPublishers(p.data ?? []);
    setCategories(c.data ?? []);
  }, []);

  const fetchBooks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page), limit: "15",
        ...(search && { search }),
        ...(categoryFilter && { category: categoryFilter }),
      });
      const res = await fetch(`/api/books?${params}`);
      const json = await res.json();
      setBooks(json.data ?? []);
      setMeta(json.meta ?? { page: 1, limit: 15, total: 0, totalPages: 0 });
    } finally {
      setLoading(false);
    }
  }, [page, search, categoryFilter]);

  useEffect(() => {
    if (session && !["ADMIN", "LIBRARIAN"].includes(session.user.role)) {
      router.push("/dashboard");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchMeta();
  }, [session, router, fetchMeta]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchBooks(); }, [fetchBooks]);

  if (sessionStatus === "loading") {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setSelectedBook(null);
    setError("");
    setModalMode("create");
  };

  const openEdit = (b: Book) => {
    setForm({
      title: b.title, isbn: b.isbn, author_id: b.author.id,
      publisher_id: b.publisher.id, category_id: b.category.id,
      publish_year: String(b.publish_year), description: "",
      language: b.language, pages: "", cover_image: b.cover_image ?? "",
      stock_total: String(b.stock_total),       location_rack: b.location_rack ?? "",
      is_ebook: b.is_ebook, ebook_file_url: b.ebook_file_url ?? "",
    });
    setSelectedBook(b);
    setError("");
    setModalMode("edit");
  };

  const openDelete = (b: Book) => {
    setSelectedBook(b);
    setError("");
    setModalMode("delete");
  };

  const closeModal = () => { setModalMode(null); setSelectedBook(null); setError(""); };

  const handleCreate = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/librarian/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          publish_year: parseInt(form.publish_year),
          pages: form.pages ? parseInt(form.pages) : undefined,
          stock_total: parseInt(form.stock_total),
          cover_image: form.cover_image || null,
          ebook_file_url: form.ebook_file_url || null,
          location_rack: form.location_rack || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Gagal menambahkan buku"); return; }
      closeModal();
      fetchBooks();
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedBook) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/librarian/books/${selectedBook.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title, language: form.language,
          cover_image: form.cover_image || null,
          location_rack: form.location_rack || null,
          is_ebook: form.is_ebook,
          ebook_file_url: form.ebook_file_url || null,
          category_id: form.category_id,
          author_id: form.author_id,
          publisher_id: form.publisher_id,
          publish_year: parseInt(form.publish_year),
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Gagal memperbarui buku"); return; }
      closeModal();
      fetchBooks();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedBook) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/librarian/books/${selectedBook.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Gagal menonaktifkan buku"); return; }
      closeModal();
      fetchBooks();
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = INPUT_CLS;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-blue-400" />
            Manajemen Buku
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">Kelola koleksi, inventaris, dan metadata buku perpustakaan</p>
        </div>
        <div className="flex gap-2">
          <Link href="/catalog" className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition">
            <BookMarked className="w-4 h-4" />Lihat Katalog
          </Link>
          <button
            id="btn-add-book"
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl transition shadow-lg shadow-blue-900/30"
          >
            <Plus className="w-4 h-4" />Tambah Buku
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            id="book-search"
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Cari judul, ISBN, pengarang..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
          />
        </div>
        <select
          id="book-filter-category"
          value={categoryFilter}
          onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}
          className="px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500"
        >
          <option value="">Semua Kategori</option>
          {categories.map(c => <option key={c.id} value={c.code}>{c.name}</option>)}
        </select>
        <button onClick={() => { setSearch(""); setCategoryFilter(""); setPage(1); }}
          className="p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-400 hover:text-slate-200 transition">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider">
                <th className="text-left px-5 py-3.5">Buku</th>
                <th className="text-left px-5 py-3.5 hidden md:table-cell">Pengarang</th>
                <th className="text-left px-5 py-3.5 hidden lg:table-cell">Kategori</th>
                <th className="text-left px-5 py-3.5 hidden lg:table-cell">ISBN</th>
                <th className="text-left px-5 py-3.5">Stok</th>
                <th className="text-right px-5 py-3.5">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-5 py-3.5">
                        <div className="h-4 bg-slate-800 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : books.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                    <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p>Tidak ada buku ditemukan</p>
                  </td>
                </tr>
              ) : (
                books.map(b => (
                  <tr key={b.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="relative w-10 h-12 rounded-lg bg-slate-800 shrink-0 overflow-hidden">
                          {b.cover_image ? (
                            <Image src={b.cover_image} alt={b.title} fill sizes="40px" className="object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <BookMarked className="w-5 h-5 text-slate-600" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-100 line-clamp-1">{b.title}</p>
                          <p className="text-xs text-slate-400">{b.publish_year}</p>
                          {b.is_ebook && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-teal-400 font-bold">
                              <Tablet className="w-3 h-3" />E-Book
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell text-slate-400 text-xs">{b.author.name}</td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-800 border border-slate-700 text-slate-300 rounded-full">
                        {b.category.name}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell text-slate-400 text-xs font-mono">{b.isbn}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-bold ${b.stock_available > 0 || b.is_ebook ? "text-emerald-400" : "text-red-400"}`}>
                        {b.is_ebook ? "Digital" : `${b.stock_available}/${b.stock_total}`}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link href={`/books/${b.id}`}
                          className="p-1.5 rounded-lg hover:bg-emerald-900/40 text-slate-400 hover:text-emerald-300 transition"
                          title="Detail"
                        >
                          <BookMarked className="w-4 h-4" />
                        </Link>
                        <button
                          id={`btn-edit-book-${b.id}`}
                          onClick={() => openEdit(b)}
                          className="p-1.5 rounded-lg hover:bg-blue-900/40 text-slate-400 hover:text-blue-300 transition"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          id={`btn-delete-book-${b.id}`}
                          onClick={() => openDelete(b)}
                          className="p-1.5 rounded-lg hover:bg-red-900/40 text-slate-400 hover:text-red-300 transition"
                          title="Nonaktifkan"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {meta.totalPages > 1 && (
          <div className="px-5 py-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>{meta.total} buku total</span>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-slate-800 disabled:opacity-30 transition">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-bold text-slate-300">{page} / {meta.totalPages}</span>
              <button onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))} disabled={page === meta.totalPages}
                className="p-1.5 rounded-lg hover:bg-slate-800 disabled:opacity-30 transition">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
              <h2 className="font-black text-lg text-white">
                {modalMode === "create" && "Tambah Buku Baru"}
                {modalMode === "edit" && `Edit: ${selectedBook?.title}`}
                {modalMode === "delete" && "Konfirmasi Nonaktifkan"}
              </h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-200 transition text-xl leading-none">✕</button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {error && <p className="text-red-400 text-xs bg-red-950/40 border border-red-800/50 px-3 py-2 rounded-lg">{error}</p>}

              {modalMode === "delete" ? (
                <div className="space-y-4">
                  <p className="text-slate-300 text-sm">
                    Yakin ingin menonaktifkan semua eksemplar buku <span className="font-bold text-white">{selectedBook?.title}</span>?
                    Data tidak akan dihapus permanen.
                  </p>
                  <div className="flex gap-3 justify-end">
                    <button onClick={closeModal} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-xl transition">Batal</button>
                    <button id="btn-confirm-delete-book" onClick={handleDelete} disabled={submitting}
                      className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-sm font-bold rounded-xl transition disabled:opacity-60">
                      {submitting ? "Memproses..." : "Nonaktifkan"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <FormField id="input-book-title" label="Judul Buku *">
                      <input id="input-book-title" type="text" value={form.title}
                        onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                        className={`${inputCls} col-span-2`} placeholder="Judul lengkap buku" />
                    </FormField>
                    <FormField id="input-book-isbn" label="ISBN *">
                      <input id="input-book-isbn" type="text" value={form.isbn}
                        onChange={e => setForm(f => ({ ...f, isbn: e.target.value }))}
                        className={inputCls} placeholder="978-xxx-xxx" disabled={modalMode === "edit"} />
                    </FormField>
                    <FormField id="input-book-year" label="Tahun Terbit *">
                      <input id="input-book-year" type="number" value={form.publish_year}
                        onChange={e => setForm(f => ({ ...f, publish_year: e.target.value }))}
                        className={inputCls} min="1900" max="2100" />
                    </FormField>
                    <FormField id="select-book-author" label="Pengarang *">
                      <select id="select-book-author" value={form.author_id}
                        onChange={e => setForm(f => ({ ...f, author_id: e.target.value }))}
                        className={inputCls}>
                        <option value="">Pilih Pengarang</option>
                        {authors.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </FormField>
                    <FormField id="select-book-publisher" label="Penerbit *">
                      <select id="select-book-publisher" value={form.publisher_id}
                        onChange={e => setForm(f => ({ ...f, publisher_id: e.target.value }))}
                        className={inputCls}>
                        <option value="">Pilih Penerbit</option>
                        {publishers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </FormField>
                    <FormField id="select-book-category" label="Kategori *">
                      <select id="select-book-category" value={form.category_id}
                        onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                        className={inputCls}>
                        <option value="">Pilih Kategori</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </FormField>
                    <FormField id="input-book-language" label="Bahasa">
                      <input id="input-book-language" type="text" value={form.language}
                        onChange={e => setForm(f => ({ ...f, language: e.target.value }))}
                        className={inputCls} placeholder="Indonesia" />
                    </FormField>
                    {modalMode === "create" && (
                      <FormField id="input-book-stock" label="Jumlah Stok *">
                        <input id="input-book-stock" type="number" value={form.stock_total}
                          onChange={e => setForm(f => ({ ...f, stock_total: e.target.value }))}
                          className={inputCls} min="0" />
                      </FormField>
                    )}
                    <FormField id="input-book-rack" label="Lokasi Rak">
                      <input id="input-book-rack" type="text" value={form.location_rack}
                        onChange={e => setForm(f => ({ ...f, location_rack: e.target.value }))}
                        className={inputCls} placeholder="A1, B2, ..." />
                    </FormField>
                    <FormField id="input-book-cover" label="URL Cover (opsional)">
                      <input id="input-book-cover" type="text" value={form.cover_image}
                        onChange={e => setForm(f => ({ ...f, cover_image: e.target.value }))}
                        className={inputCls} placeholder="https://..." />
                    </FormField>
                    <div className="col-span-2 flex items-center gap-3">
                      <input type="checkbox" id="input-book-ebook" checked={form.is_ebook}
                        onChange={e => setForm(f => ({ ...f, is_ebook: e.target.checked }))}
                        className="w-4 h-4 accent-teal-500" />
                      <label htmlFor="input-book-ebook" className="text-sm text-slate-300 font-semibold cursor-pointer">
                        Tersedia sebagai E-Book
                      </label>
                    </div>
                    {form.is_ebook && (
                      <div className="col-span-2">
                        <FormField id="input-book-ebook-url" label="URL File E-Book">
                          <input id="input-book-ebook-url" type="text" value={form.ebook_file_url}
                            onChange={e => setForm(f => ({ ...f, ebook_file_url: e.target.value }))}
                            className={inputCls} placeholder="https://..." />
                        </FormField>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3 justify-end pt-2">
                    <button onClick={closeModal} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-xl transition">Batal</button>
                    <button
                      id={`btn-submit-book-${modalMode}`}
                      onClick={modalMode === "create" ? handleCreate : handleEdit}
                      disabled={submitting}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition disabled:opacity-60"
                    >
                      {submitting ? "Menyimpan..." : modalMode === "create" ? "Simpan Buku" : "Perbarui"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BooksManagementPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>}>
      <BooksManagementContent />
    </Suspense>
  );
}
