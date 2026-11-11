import { redirect } from "next/navigation";

/**
 * Halaman /ai-assistant dipindahkan menjadi popup mengambang
 * (AiChatWidget) yang tersedia di semua halaman dashboard.
 * Route ini dipertahankan dan dialihkan agar tautan/bookmark lama
 * tetap berfungsi tanpa halaman kosong.
 */
export default function AiAssistantRedirect() {
  redirect("/dashboard");
}
