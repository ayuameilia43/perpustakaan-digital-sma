"use client";

import { cn } from "@/lib/utils";
import {
  BookOpen,
  Bot,
  Compass,
  FileText,
  History,
  LayoutDashboard,
  Library,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet
} from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role;

  const navItems = [
    {
      title: "UTAMA",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["ADMIN", "LIBRARIAN", "STUDENT", "TEACHER", "STAFF"] },
        { label: "Katalog Buku", href: "/catalog", icon: Library, roles: ["ADMIN", "LIBRARIAN", "STUDENT", "TEACHER", "STAFF"] },
        { label: "E-Book Reader", href: "/ebook", icon: BookOpen, roles: ["ADMIN", "LIBRARIAN", "STUDENT", "TEACHER", "STAFF"] },
        { label: "Riwayat Peminjaman", href: "/history", icon: History, roles: ["ADMIN", "LIBRARIAN", "STUDENT", "TEACHER", "STAFF"] },
        { label: "Denda Saya", href: "/fines", icon: Wallet, roles: ["ADMIN", "LIBRARIAN", "STUDENT", "TEACHER", "STAFF"] },
      ],
    },
    {
      title: "FITUR AI",
      items: [
        { label: "Rekomendasi AI", href: "/recommendations", icon: Sparkles, roles: ["ADMIN", "LIBRARIAN", "STUDENT", "TEACHER", "STAFF"] },
      ],
    },
    {
      title: "OPERASIONAL PUSTAKAWAN",
      items: [
        { label: "Proses Peminjaman", href: "/librarian/borrowings", icon: Compass, roles: ["LIBRARIAN", "ADMIN"] },
        { label: "Kelola Koleksi Buku", href: "/librarian/books", icon: Library, roles: ["LIBRARIAN", "ADMIN"] },
        { label: "Laporan Sirkulasi", href: "/reports", icon: FileText, roles: ["LIBRARIAN", "ADMIN"] },
        { label: "Verifikasi Denda", href: "/fines?status=PENDING_VERIFICATION", icon: ShieldCheck, roles: ["LIBRARIAN", "ADMIN"] },
      ],
    },
    {
      title: "ADMINISTRASI SISTEM",
      items: [
        { label: "User Management", href: "/admin/users", icon: Users, roles: ["ADMIN"] },
        { label: "System Settings", href: "/admin/system-settings", icon: Settings, roles: ["ADMIN"] },
        { label: "Konfigurasi AI", href: "/admin/system-settings?tab=ai", icon: Bot, roles: ["ADMIN"] },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed lg:static top-16 left-0 bottom-0 z-30 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between transition-transform duration-200 ease-in-out overflow-y-auto",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="p-4 space-y-6">
          {navItems.map((group, idx) => {
            // Filter items by role
            const visibleItems = group.items.filter((item) =>
              role ? item.roles.includes(role) : false
            );

            if (visibleItems.length === 0) return null;

            return (
              <div key={idx} className="space-y-2">
                <h3 className="px-3 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  {group.title}
                </h3>
                <div className="space-y-1">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const itemPath = item.href.split("?")[0];
                    const isActive = pathname === itemPath || pathname.startsWith(itemPath + "/");

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onClose}
                        className={cn(
                          "flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                          isActive
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold shadow-xs"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                        )}
                      >
                        <Icon
                          className={cn(
                            "w-5 h-5 transition-colors",
                            isActive ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"
                          )}
                        />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer info in sidebar */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400">
          <p className="font-semibold text-slate-600 dark:text-slate-400">SMA Perpustakaan v1.0</p>
          <p>Lingkungan SMA Digital</p>
        </div>
      </aside>
    </>
  );
}
