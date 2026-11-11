import { AuthProvider } from "@/components/providers/AuthProvider";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Perpustakaan Digital SMA - Sistem Informasi Perpustakaan",
  description: "Sistem perpustakaan digital terintegrasi untuk Sekolah Menengah Atas dengan fitur Katalog, E-Book Reader, Peminjaman, dan AI Library Assistant.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="antialiased bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
