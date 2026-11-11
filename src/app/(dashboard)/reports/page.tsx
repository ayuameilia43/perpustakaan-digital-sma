"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { BarChart3, BookOpen, Users, Clock, TrendingUp, AlertCircle } from "lucide-react";

type ReportData = {
  totalBooks: number;
  totalEbooks: number;
  totalUsers: number;
  activeBorrowings: number;
  overdueBorrowings: number;
  totalFines: number;
  unpaidFines: number;
  recentBorrowings: Array<{
    id: string;
    borrow_code: string;
    status: string;
    request_date: string;
    book: { title: string };
    user: { name: string };
  }>;
  popularBooks: Array<{
    id: string;
    title: string;
    total_borrowed: number;
    author: { name: string };
  }>;
};

function ReportsContent() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reports");
      const json = await res.json();
      setReport(json.data ?? null);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session && !["ADMIN", "LIBRARIAN"].includes(session.user.role)) {
      router.push("/dashboard");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchReport();
  }, [session, router, fetchReport]);

  if (sessionStatus === "loading") {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <AlertCircle className="w-16 h-16 mb-3 opacity-20" />
        <p className="text-lg font-bold">Gagal memuat laporan</p>
      </div>
    );
  }

  const stats = [
    { label: "Total Buku", value: report.totalBooks, icon: BookOpen, color: "text-emerald-400" },
    { label: "E-Book", value: report.totalEbooks, icon: BookOpen, color: "text-teal-400" },
    { label: "Total Pengguna", value: report.totalUsers, icon: Users, color: "text-purple-400" },
    { label: "Peminjaman Aktif", value: report.activeBorrowings, icon: Clock, color: "text-blue-400" },
    { label: "Terlambat", value: report.overdueBorrowings, icon: AlertCircle, color: "text-red-400" },
    { label: "Total Denda", value: `Rp ${report.totalFines.toLocaleString("id-ID")}`, icon: TrendingUp, color: "text-amber-400" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <BarChart3 className="w-7 h-7 text-indigo-400" />
          Laporan Sirkulasi
        </h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Statistik dan laporan sirkulasi perpustakaan
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
              <Icon className={`w-5 h-5 ${s.color}`} />
              <p className="text-2xl font-black text-white">{s.value}</p>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{s.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-4">Buku Terpopuler</h3>
          <div className="space-y-3">
            {report.popularBooks.length === 0 ? (
              <p className="text-sm text-slate-500">Belum ada data</p>
            ) : (
              report.popularBooks.map((b, i) => (
                <div key={b.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-500 w-6">#{i + 1}</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-200 line-clamp-1">{b.title}</p>
                      <p className="text-[10px] text-slate-500">{b.author.name}</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-400">{b.total_borrowed}x</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-4">Peminjaman Terbaru</h3>
          <div className="space-y-3">
            {report.recentBorrowings.length === 0 ? (
              <p className="text-sm text-slate-500">Belum ada data</p>
            ) : (
              report.recentBorrowings.map((b) => (
                <div key={b.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-200 line-clamp-1">{b.book.title}</p>
                    <p className="text-[10px] text-slate-500">{b.user.name}</p>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">{b.borrow_code}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ReportsContent />
    </Suspense>
  );
}
