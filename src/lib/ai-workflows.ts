export function buildWorkflowGuide(): string {
  return [
    "PANDUAN ALUR SISTEM (satu-satunya acuan untuk menjawab cara memakai aplikasi):",
    "MENU UTAMA (semua role):",
    "- Dashboard (/dashboard): ringkasan koleksi, kuota peminjaman sesuai role, dan akses cepat.",
    "- Katalog Buku (/catalog): kolom pencarian judul/ISBN/pengarang, filter kategori, badge E-Book, klik kartu untuk detail (/books/:id).",
    "- E-Book Reader (/ebook): daftar e-book, kolom pencarian, tombol Cari, klik kartu untuk detail.",
    "- Riwayat Peminjaman (/history): daftar pinjaman milik sendiri + tautan Detail tiap baris.",
    "- AI Assistant Chat (/ai-assistant) dan Rekomendasi AI (/recommendations).",
    "MASUK (LOGIN) di /login:",
    '- Isi "Email / NISN / NIP" + Password, tekan "Masuk ke Dashboard".',
    '- Akun SUSPENDED tidak bisa login ("Akun Anda sedang dinonaktifkan. Hubungi Administrator.").',
    "MENCARI BUKU:",
    "- Buka Katalog Buku (/catalog), ketik di kolom pencarian, tekan Cari; gunakan filter kategori bila perlu.",
    '- Stok tampil "tersedia/total" atau "Tidak Tersedia"; label "Digital" untuk e-book.',
    "- Klik kartu buku untuk detail: metadata (pengarang, penerbit, tahun, ISBN), lokasi rak, daftar eksemplar (Tersedia/Dipinjam), ulasan pembaca.",
    "MEMINJAM BUKU FISIK:",
    "1. Pastikan stok tersedia lebih dari 0 dan buku tersebut bukan e-book.",
    "2. Pengajuan peminjaman tercatat dengan status PENDING (menunggu persetujuan pustakawan).",
    "3. Syarat pengajuan: belum punya pengajuan PENDING atau pinjaman BORROWED untuk buku yang sama.",
    "4. Pustakawan memproses di menu Proses Peminjaman: disetujui jadi BORROWED (jatuh tempo 7 hari setelah disetujui, satu eksemplar ditetapkan, stok berkurang 1) atau ditolak jadi REJECTED.",
    "STATUS PINJAMAN: PENDING (menunggu) -> BORROWED (sedang dipinjam) -> RETURNED (sudah kembali); REJECTED (ditolak).",
    "PENGEMBALIAN BUKU:",
    "- Serahkan buku fisik ke pustakawan; pengembalian dicatat pustakawan di Proses Peminjaman lewat tombol Kembalikan; status jadi RETURNED dan stok bertambah 1.",
    "- Di Riwayat Peminjaman (/history) tidak ada tombol kembali mandiri; hanya ada tautan Detail.",
    "DENDA & KUOTA:",
    '- Kuota dan durasi per role tampil di Dashboard ("Kebijakan Peminjaman Role Anda"); angka rinciannya ada di DATA PERPUSTAKAAN.',
    "- Nominal denda tercatat pada data peminjaman masing-masing (lihat DATA PENGGUNA).",
    "E-BOOK:",
    "- E-book tidak perlu dipinjam dan pengajuannya otomatis ditolak sistem.",
    "- Buka E-Book Reader (/ebook), cari judul, klik kartu untuk membuka halaman detail digitalnya (badge E-Book, format PDF).",
    "PROFIL & PASSWORD di Pengaturan (/settings):",
    '- Ubah "Nama Lengkap" dan "Email", tekan "Simpan Profil" ("Profil berhasil diperbarui"); kolom Role tidak bisa diubah.',
    '- Ubah Password: isi "Password Saat Ini" + "Password Baru" (minimal 8 karakter), tekan "Ubah Password".',
    "REKOMENDASI di /recommendations:",
    "- Daftar buku populer berdasarkan rating dan jumlah dipinjam; tekan ikon refresh untuk memuat ulang.",
    "BATASAN SISTEM YANG WAJIB DIJELASKAN JUJUR:",
    "- Kuota pinjam tampil di Dashboard sebagai info; penegakan otomatis saat pengajuan tidak ada.",
    "- Di Katalog dan Detail Buku tidak ada tombol pinjam; alur peminjaman berjalan lewat pengajuan yang diproses pustakawan.",
    "- Status OVERDUE dan denda tidak dihitung otomatis oleh sistem; pakai angka dari DATA PENGGUNA.",
    "- Halaman Rekomendasi memakai data popularitas, bukan AI generatif.",
    "- Tidak ada pembaca e-book dan perekam progres di aplikasi; E-Book Reader hanya daftar dan detail.",
  ].join("\n");
}

export function buildStaffWorkflowGuide(): string {
  return [
    "PANDUAN PUSTAKAWAN (role LIBRARIAN dan ADMIN):",
    "PROSES PEMINJAMAN (/librarian/borrowings):",
    "- Filter status PENDING/BORROWED/RETURNED/OVERDUE; baris PENDING punya tombol Setujui dan Tolak; baris BORROWED punya tombol Kembalikan; tiap baris ada tautan Detail.",
    "- Setujui: hanya untuk PENDING dengan stok tersedia; jatuh tempo 7 hari; eksemplar AVAILABLE otomatis ditetapkan; stok berkurang 1.",
    "- Tolak: hanya untuk PENDING; status jadi REJECTED; stok tidak berubah.",
    "- Kembalikan: hanya untuk BORROWED; status jadi RETURNED beserta tanggal kembali; stok bertambah 1.",
    "KELOLA KOLEKSI (/librarian/books):",
    "- Tambah Buku: isi judul, ISBN unik (minimal 5 karakter), pengarang, penerbit, kategori, tahun 1900-2100, stok awal; eksemplar otomatis dibuat berkode dengan status AVAILABLE; rak default Rak Umum; format e-book default PDF.",
    "- Edit: judul, lokasi rak, kategori, pengarang, penerbit, info e-book; ISBN dan stok tidak bisa diubah dari form edit.",
    "- Nonaktifkan: eksemplar jadi MAINTENANCE dan data tidak dihapus; ditolak bila buku masih punya peminjaman PENDING/BORROWED.",
    "LAPORAN (/reports):",
    "- Kartu Total Buku, E-Book, Total Pengguna, Peminjaman Aktif, Terlambat, Total Denda; panel Buku Terpopuler dan Peminjaman Terbaru.",
  ].join("\n");
}

export function buildAdminWorkflowGuide(): string {
  return [
    "PANDUAN ADMIN (role ADMIN):",
    "KELOLA PENGGUNA (/admin/users):",
    "- Tambah Pengguna: Nama Lengkap (minimal 2 karakter), Email valid dan belum terdaftar, Password (minimal 8 karakter), Role, NISN/NIP (otomatis bila kosong), Kelas/Departemen.",
    "- Edit: nama, email, role, NISN/NIP, kelas; Password Baru opsional (minimal 8 karakter bila diisi).",
    "- Nonaktifkan: tombol Nonaktifkan mengubah status jadi SUSPENDED (tidak bisa login, riwayat tersimpan); tidak bisa menonaktifkan akun sendiri; tersedia juga toggle cepat Aktif/Suspend.",
    "PENGATURAN SISTEM (/admin/system-settings):",
    "- Ubah nilai tiap kunci (batas pinjam, durasi, denda per role) lewat tombol Simpan per baris; hanya kunci yang sudah ada yang bisa diubah.",
  ].join("\n");
}
