import { BookOpen, Compass, Home } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Blobs */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full text-center space-y-6 z-10">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-slate-900 border border-slate-800 text-emerald-400 shadow-xl mb-2">
          <Compass className="w-10 h-10 animate-spin-slow" />
        </div>

        <div className="space-y-2">
          <span className="px-3 py-1 bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 rounded-full text-xs font-mono font-bold">
            ERROR 404
          </span>
          <h1 className="text-3xl font-black text-white tracking-tight">Halaman Tidak Ditemukan</h1>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            Maaf, halaman perpustakaan digital yang Anda cari tidak ditemukan atau alamat URL telah dipindahkan.
          </p>
        </div>

        <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard"
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center justify-center space-x-2"
          >
            <Home className="w-4 h-4" />
            <span>Kembali ke Dashboard</span>
          </Link>

          <Link
            href="/catalog"
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold text-xs rounded-xl transition flex items-center justify-center space-x-2"
          >
            <BookOpen className="w-4 h-4 text-emerald-400" />
            <span>Jelajahi Katalog Buku</span>
          </Link>
        </div>

        <p className="text-[11px] text-slate-600 pt-6">
          Perpustakaan Digital SMA Negeri • System Error 404
        </p>
      </div>
    </div>
  );
}
