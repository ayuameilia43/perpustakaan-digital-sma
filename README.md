# Perpustakaan Digital SMA

Sistem manajemen perpustakaan digital untuk Sekolah Menengah Atas (SMA) dengan fitur peminjaman buku, manajemen user, e-book, dan asisten AI.

## Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19
- **Language**: TypeScript
- **ORM**: Prisma 6 dengan SQLite
- **Authentication**: NextAuth.js v4 (Credentials Provider, JWT)
- **Validation**: Zod
- **Styling**: Tailwind CSS 4

## Getting Started

### Prerequisites

- Node.js 18+
- npm/yarn/pnpm

### Installation

```bash
npm install
cp .env.example .env
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

### Default Login (Seed Data)

> **PERINGATAN KEAMANAN:**
> - Akun di bawah ini adalah akun **demo/development** dengan password `Password123!`.
> - Akun demo **BUKAN akun produksi** dan **tidak boleh digunakan untuk penggunaan nyata**.
> - **Ganti seluruh password** sebelum sistem digunakan secara operasional.
> - Password ini dipublikasikan untuk keperluan pengembangan dan pengujian saja.

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@sma.sch.id | Password123! |
| Librarian | pustakawan@sma.sch.id | Password123! |
| Student | ahmad.fauzi@siswa.sma.sch.id | Password123! |
| Teacher | heru.prasetyo@guru.sma.sch.id | Password123! |
| Staff | dewi.lestari@staff.sma.sch.id | Password123! |

## Telegram Notification

### Overview

Sistem ini terintegrasi dengan Telegram Bot API untuk mengirim notifikasi real-time kepada administrator dan pustakawan.

### Jenis Notifikasi

| Notifikasi | Trigger | Target |
|-----------|---------|--------|
| Peminjaman Baru | `POST /api/borrowings` | Admin (global chat) |
| Peminjaman Disetujui | `PUT /api/borrowings/[id]` (approve) | User (linked Telegram) |
| Peminjaman Ditolak | `PUT /api/borrowings/[id]` (reject) | User (linked Telegram) |
| Buku Dikembalikan | `PUT /api/borrowings/[id]` (return) | User (linked Telegram) |
| User Baru | `POST /api/admin/users` | Admin (global chat) |

### Konfigurasi

```env
TELEGRAM_BOT_TOKEN="your-bot-token"
TELEGRAM_CHAT_ID="your-admin-chat-id"
TELEGRAM_BOT_USERNAME="your_bot_username"
```

### Menghubungkan Akun Telegram

1. Login ke aplikasi → Pengaturan Akun → Integrasi Telegram
2. Klik "Hubungkan Telegram"
3. Salin kode pengaitan atau klik "Buka Bot Telegram"
4. Kirim `/start <kode>` ke bot di Telegram
5. Status berubah menjadi "Terhubung"

### Menjalankan Polling

Polling **otomatis** berjalan bersama server Next.js — tidak perlu langkah tambahan:

```bash
npm run dev   # polling Telegram ikut start otomatis via src/instrumentation.ts
```

Cek log server untuk memastikan polling aktif:

```
[Poll] Memulai Telegram polling...
[Poll] Telegram polling aktif (long-polling, timeout 30s)
```

Alternatif (hanya jika menjalankan polling **tanpa** server Next.js):

```bash
npm run telegram:poll
```

**Penting:** jangan jalankan `telegram:poll` bersamaan dengan `npm run dev` — cukup satu consumer polling per token bot (Telegram akan melempar error 409 konflik jika dua instance berjalan).

### Distribusi Notifikasi

- **Admin**: Notifikasi operasional (peminjaman baru, user baru) dikirim ke `TELEGRAM_CHAT_ID` global
- **Siswa/Guru**: Notifikasi pribadi (disetujui, ditolak, dikembalikan) dikirim ke Telegram Chat ID masing-masing
- Pengguna yang belum menghubungkan Telegram tetap menggunakan aplikasi normal

### Memutuskan Hubungan

Pengaturan Akun → Integrasi Telegram → "Putuskan" → Konfirmasi

### Best Practices

- **Jangan pernah** menampilkan token bot di source code, log, atau dokumentasi
- **Jangan pernah** meng-commit file `.env` ke repository
- Jika token terpapar, segera rotasi melalui BotFather (`/revoke`)
- Notifikasi dikirim secara best-effort — kegagalan Telegram tidak membatalkan transaksi bisnis

## Project Structure

```
src/
├── app/
│   ├── api/              # API routes
│   │   ├── admin/        # Admin endpoints (users, settings)
│   │   ├── auth/         # Authentication endpoints
│   │   ├── borrowings/   # Peminjaman endpoints
│   │   ├── books/        # Book management
│   │   ├── telegram/     # Telegram linking endpoints
│   │   └── reports/      # Reporting endpoints
│   ├── components/       # React components
│   ├── lib/              # Business logic & utilities
│   │   ├── auth.ts       # NextAuth configuration
│   │   ├── borrowing.ts  # Borrowing business logic
│   │   ├── db.ts         # Prisma client
│   │   ├── telegram.ts   # Telegram notification & linking service
│   │   ├── telegram-poller.ts # Long polling loop (single consumer)
│   │   └── utils.ts      # Helper functions
│   ├── instrumentation.ts # Auto-start polling saat server start
│   └── middleware.ts     # Route protection
├── scripts/
│   └── telegram-poll.ts  # Telegram polling script
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── seed.ts           # Seed data
└── types/                # TypeScript type definitions
```

## API Endpoints

### Authentication
- `POST /api/auth/login` — Login
- `POST /api/auth/logout` — Logout
- `GET /api/auth/profile` — Get user profile
- `PUT /api/auth/change-password` — Change password

### Books
- `GET /api/books` — List books (with pagination, search, filter)
- `POST /api/books` — Create book
- `GET /api/books/[id]` — Get book detail
- `PUT /api/books/[id]` — Update book
- `DELETE /api/books/[id]` — Delete book

### Borrowings
- `GET /api/borrowings` — List borrowings
- `POST /api/borrowings` — Create borrowing request
- `PUT /api/borrowings/[id]` — Approve/Reject/Return borrowing
- `DELETE /api/borrowings/[id]` — Cancel borrowing

### Admin
- `GET /api/admin/users` — List users
- `POST /api/admin/users` — Create user
- `PUT /api/admin/users/[id]` — Update user
- `DELETE /api/admin/users/[id]` — Deactivate user
- `GET /api/admin/settings` — Get system settings
- `POST /api/admin/settings` — Update system setting

### Telegram
- `GET /api/telegram/link` — Check link status
- `POST /api/telegram/link` — Generate link token
- `DELETE /api/telegram/unlink` — Disconnect Telegram

### Reports
- `GET /api/reports` — Dashboard statistics

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn more about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
- [Prisma Documentation](https://www.prisma.io/docs) - learn more about Prisma ORM.
- [NextAuth.js Documentation](https://next-auth.js.org/) - learn more about authentication.

## Deploy on Vercel

The easiest way to deploy your app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=nextjs&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
