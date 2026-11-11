import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { BookOpen, LogIn, Sparkles } from "lucide-react";
import { getServerSession } from "next-auth";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (session?.user) {
    redirect("/dashboard");
  }

  // Fetch sample featured books with author relation
  const books = await db.book.findMany({
    take: 4,
    include: { category: true, author: true },
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-emerald-500/20">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <span className="font-black text-lg tracking-tight text-white">
                Perpustakaan<span className="text-emerald-400">Digital SMA</span>
              </span>
              <span className="block text-[10px] uppercase font-bold tracking-widest text-slate-400 -mt-1">
                SMA NEGERI DEMO
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              href="/login"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-900/30 transition flex items-center space-x-1.5"
            >
              <LogIn className="w-4 h-4" />
              <span>Masuk Sistem</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center space-y-8">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-800/60 text-emerald-300 text-xs font-semibold">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>Sistem Perpustakaan Masa Depan Berbasis AI & RBAC</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white max-w-4xl mx-auto leading-tight">
          Mendigitalisasi Pengelolaan Perpustakaan Sekolah dengan{" "}
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
            AI Assistant & 5 Role Access
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Platform terpadu untuk Peserta Didik, Guru, Staff, Pustakawan, dan Administrator dalam mengelola sirkulasi buku, E-Book digital, serta rekomendasi buku cerdas.
        </p>

        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="/login"
            className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-900/40 transition flex items-center space-x-2"
          >
            <span>Masuk & Uji Coba Demo (5 Role)</span>
            <LogIn className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* 5 Roles Section */}
      <section className="py-12 bg-slate-900/60 border-y border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-black text-white">Didukung 5 Peran Pengguna (RBAC)</h2>
            <p className="text-xs text-slate-400">Hak akses terspesialisasi sesuai kebutuhan ekosistem sekolah</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="p-4 rounded-2xl bg-purple-950/40 border border-purple-800/40 space-y-2">
              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-purple-900 text-purple-200">1. Admin</span>
              <h3 className="font-bold text-sm text-purple-300">Administrator</h3>
              <p className="text-xs text-slate-400">System settings, user management, audit logs, backup & full config.</p>
            </div>

            <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-800/40 space-y-2">
              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-900 text-blue-200">2. Pustakawan</span>
              <h3 className="font-bold text-sm text-blue-300">Librarian</h3>
              <p className="text-xs text-slate-400">Kelola katalog, persetujuan pinjam/kembali, denda, & laporan sirkulasi.</p>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-800/40 space-y-2">
              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-900 text-emerald-200">3. Siswa</span>
              <h3 className="font-bold text-sm text-emerald-300">Peserta Didik</h3>
              <p className="text-xs text-slate-400">Cari buku, ajukan pinjaman, baca e-book, & konsultasi AI assistant.</p>
            </div>

            <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-800/40 space-y-2">
              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-900 text-amber-200">4. Guru</span>
              <h3 className="font-bold text-sm text-amber-300">Tenaga Pengajar</h3>
              <p className="text-xs text-slate-400">Kuota pinjam diperluas, akses referensi mata pelajaran, & e-book.</p>
            </div>

            <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-800/40 space-y-2">
              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-indigo-900 text-indigo-200">5. Staff</span>
              <h3 className="font-bold text-sm text-indigo-300">Staff Sekolah</h3>
              <p className="text-xs text-slate-400">Peminjaman buku umum, akses e-book, & riwayat sirkulasi personal.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Catalog Preview */}
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-white">Sampel Katalog Buku Demo</h2>
            <p className="text-xs text-slate-400 mt-1">Data contoh berlabel [SEED DATA] sesuai prinsip pengembangan bersih</p>
          </div>
          <Link href="/login" className="text-xs font-bold text-emerald-400 hover:text-emerald-300">
            Masuk untuk Akses Penuh →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {books.map((b) => (
            <div key={b.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="h-44 rounded-xl bg-slate-800 overflow-hidden relative">
                  {b.cover_image ? (
                    <Image src={b.cover_image} alt={b.title} fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600">No Cover</div>
                  )}
                  {b.is_ebook && (
                    <span className="absolute top-2 right-2 bg-teal-500 text-slate-950 font-black text-[10px] uppercase px-2 py-0.5 rounded-full">
                      E-Book
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-emerald-400">{b.category.name}</span>
                  <h3 className="font-bold text-sm text-slate-100 line-clamp-1">{b.title}</h3>
                  <p className="text-xs text-slate-400">{b.author.name} ({b.publish_year})</p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span>Stok: {b.stock_available}/{b.stock_total}</span>
                <span className="font-semibold text-emerald-400">{b.location_rack}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
        <p>© 2026 Perpustakaan Digital SMA Negeri • Sistem Informasi Perpustakaan Sekolah</p>
      </footer>
    </div>
  );
}
