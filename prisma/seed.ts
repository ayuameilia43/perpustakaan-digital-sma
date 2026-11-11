import { BorrowStatus, CopyStatus, NotificationType, PrismaClient, Role, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("====================================================");
  console.log("Seeding Database Tahap 2: Perpustakaan Digital SMA");
  console.log("====================================================");

  // 1. System Settings
  const settings = [
    { key: "max_borrow_student", value: "3", description: "Batas maksimal pinjam buku peserta didik [DEMO CONFIG]" },
    { key: "borrow_duration_student", value: "7", description: "Durasi pinjam peserta didik dalam hari [DEMO CONFIG]" },
    { key: "fine_per_day_student", value: "2000", description: "Denda keterlambatan peserta didik per hari (Rp) [DEMO CONFIG]" },
    { key: "max_borrow_teacher", value: "7", description: "Batas maksimal pinjam buku guru [DEMO CONFIG]" },
    { key: "borrow_duration_teacher", value: "14", description: "Durasi pinjam guru dalam hari [DEMO CONFIG]" },
    { key: "fine_per_day_teacher", value: "1000", description: "Denda keterlambatan guru per hari (Rp) [DEMO CONFIG]" },
    { key: "max_borrow_staff", value: "5", description: "Batas maksimal pinjam buku staff [DEMO CONFIG]" },
    { key: "borrow_duration_staff", value: "10", description: "Durasi pinjam staff dalam hari [DEMO CONFIG]" },
    { key: "fine_per_day_staff", value: "1000", description: "Denda keterlambatan staff per hari (Rp) [DEMO CONFIG]" },
    { key: "fine_payment_deadline_days", value: "7", description: "Tenggat pembayaran denda dalam hari sejak denda diterbitkan (dapat diubah admin)" },
  ];

  for (const s of settings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: { value: s.value, description: s.description },
      create: s,
    });
  }
  console.log("✓ 1. System Settings seeded.");

  // 2. Users (5 Roles) - No production passwords used, only test password hash
  const defaultPasswordHash = bcrypt.hashSync("Password123!", 10);

  const usersData = [
    {
      nisn_nip: "198501012010011001",
      name: "Budi Santoso, S.Kom [SEED]",
      email: "admin@sma.sch.id",
      password_hash: defaultPasswordHash,
      role: Role.ADMIN,
      class_or_dept: "TUK / IT",
      status: UserStatus.ACTIVE,
    },
    {
      nisn_nip: "199002152015022002",
      name: "Siti Rahmawati, S.IP [SEED]",
      email: "pustakawan@sma.sch.id",
      password_hash: defaultPasswordHash,
      role: Role.LIBRARIAN,
      class_or_dept: "Perpustakaan Utama",
      status: UserStatus.ACTIVE,
    },
    {
      nisn_nip: "0061234567",
      name: "Ahmad Fauzi [SEED]",
      email: "ahmad.fauzi@siswa.sma.sch.id",
      password_hash: defaultPasswordHash,
      role: Role.STUDENT,
      class_or_dept: "XI IPA 1",
      status: UserStatus.ACTIVE,
    },
    {
      nisn_nip: "197805102005011003",
      name: "Drs. Heru Prasetyo [SEED]",
      email: "heru.prasetyo@guru.sma.sch.id",
      password_hash: defaultPasswordHash,
      role: Role.TEACHER,
      class_or_dept: "Guru Fisika",
      status: UserStatus.ACTIVE,
    },
    {
      nisn_nip: "198811202012031004",
      name: "Dewi Lestari [SEED]",
      email: "dewi.lestari@staff.sma.sch.id",
      password_hash: defaultPasswordHash,
      role: Role.STAFF,
      class_or_dept: "Tata Usaha",
      status: UserStatus.ACTIVE,
    },
  ];

  const userMap: Record<string, string> = {};
  for (const u of usersData) {
    const usr = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, class_or_dept: u.class_or_dept },
      create: u,
    });
    userMap[u.role] = usr.id;
  }
  console.log("✓ 2. 5 Seed Users created.");

  // 3. Authors & Publishers
  const authorsData = [
    { name: "Drs. Supriyadi", bio: "Penulis buku teks Fisika SMA berpengalaman 20 tahun. [SEED]" },
    { name: "Rizky Ramadhan", bio: "Software Engineer & Penulis Rekayasa Perangkat Lunak. [SEED]" },
    { name: "Andrea Hirata", bio: "Sastrawan dan Penulis Novel Best Seller Indonesia. [SEED]" },
    { name: "Prof. Sartono Kartodirdjo", bio: "Sejarawan terkemuka Indonesia. [SEED]" },
  ];

  const authorMap: Record<string, string> = {};
  for (const a of authorsData) {
    const existing = await prisma.author.findFirst({ where: { name: a.name } });
    if (existing) {
      authorMap[a.name] = existing.id;
    } else {
      const created = await prisma.author.create({ data: a });
      authorMap[a.name] = created.id;
    }
  }
  console.log("✓ 3. Authors seeded.");

  const publishersData = [
    { name: "Penerbit Erlangga", address: "Jakarta", phone: "021-8717006", email: "info@erlangga.co.id" },
    { name: "Penerbit Informatika", address: "Bandung", phone: "022-7304690", email: "info@informatika.co.id" },
    { name: "Bentang Pustaka", address: "Yogyakarta", phone: "0274-886603", email: "bentang@mizan.com" },
    { name: "Gramedia Pustaka Utama", address: "Jakarta", phone: "021-53650110", email: "redaksi@gramedia.com" },
  ];

  const publisherMap: Record<string, string> = {};
  for (const p of publishersData) {
    const existing = await prisma.publisher.findFirst({ where: { name: p.name } });
    if (existing) {
      publisherMap[p.name] = existing.id;
    } else {
      const created = await prisma.publisher.create({ data: p });
      publisherMap[p.name] = created.id;
    }
  }
  console.log("✓ 4. Publishers seeded.");

  // 4. Categories
  const categoriesData = [
    { code: "500", name: "Sains & Matematika", description: "Buku pelajaran IPA, Fisika, Kimia, Biologi [SEED]" },
    { code: "600", name: "Teknologi & Komputer", description: "Pemrograman, Informatika, Robotika & Digital Art [SEED]" },
    { code: "800", name: "Sastra & Bahasa", description: "Novel, Puisi, Bahasa Indonesia & Inggris [SEED]" },
    { code: "900", name: "Sejarah & Geografi", description: "Sejarah Indonesia, Peradaban Dunia & Geografi [SEED]" },
  ];

  const categoryMap: Record<string, string> = {};
  for (const c of categoriesData) {
    const cat = await prisma.category.upsert({
      where: { code: c.code },
      update: { name: c.name, description: c.description },
      create: c,
    });
    categoryMap[c.code] = cat.id;
  }
  console.log("✓ 5. Categories seeded.");

  // 5. Books & Inventory Copies
  const booksData = [
    {
      isbn: "978-602-01-0001-1",
      title: "Fisika Dasar untuk SMA/MA Kelas XI [SEED DATA]",
      publish_year: 2023,
      author_id: authorMap["Drs. Supriyadi"],
      publisher_id: publisherMap["Penerbit Erlangga"],
      category_id: categoryMap["500"],
      stock_total: 3,
      stock_available: 2,
      location_rack: "Rak A-01 (Sains)",
      cover_image: "https://images.unsplash.com/photo-1532012197267-da84d127e765?auto=format&fit=crop&w=600&q=80",
      description: "Buku panduan pembelajaran Fisika SMA Kurikulum Merdeka yang membahas kinematika, dinamika, dan termodinamika. [SEED DEMO BOOK]",
      is_ebook: false,
      tags: "sains, fisika, sma, eksperimen",
      total_borrowed: 15,
      rating_avg: 4.7,
      copies: ["BC-FIS-001", "BC-FIS-002", "BC-FIS-003"],
    },
    {
      isbn: "978-602-01-0002-8",
      title: "Pemrograman Web Modern dengan React & Next.js [SEED DATA]",
      publish_year: 2024,
      author_id: authorMap["Rizky Ramadhan"],
      publisher_id: publisherMap["Penerbit Informatika"],
      category_id: categoryMap["600"],
      stock_total: 2,
      stock_available: 2,
      location_rack: "Rak B-03 (Komputer)",
      cover_image: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=600&q=80",
      description: "Panduan praktis membangun web modern full-stack dari dasar hingga deployment. Dilengkapi versi E-Book. [SEED DEMO BOOK]",
      is_ebook: true,
      ebook_file_url: "/ebooks/sample-react-nextjs.pdf",
      ebook_format: "PDF",
      ebook_size_mb: 12.5,
      tags: "komputer, coding, react, nextjs, web",
      total_borrowed: 28,
      rating_avg: 4.9,
      copies: ["BC-WEB-001", "BC-WEB-002"],
    },
    {
      isbn: "978-979-3062-79-2",
      title: "Laskar Pelangi [SEED DATA]",
      publish_year: 2020,
      author_id: authorMap["Andrea Hirata"],
      publisher_id: publisherMap["Bentang Pustaka"],
      category_id: categoryMap["800"],
      stock_total: 4,
      stock_available: 3,
      location_rack: "Rak S-05 (Novel)",
      cover_image: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80",
      description: "Novel inspiratif tentang perjuangan 10 anak Belitung meraih cita-cita pendidikan. Dilengkapi versi E-Book. [SEED DEMO BOOK]",
      is_ebook: true,
      ebook_file_url: "/ebooks/sample-laskar-pelangi.pdf",
      ebook_format: "PDF",
      ebook_size_mb: 8.2,
      tags: "sastra, novel, inspirasi, pendidikan",
      total_borrowed: 52,
      rating_avg: 4.8,
      copies: ["BC-NOV-001", "BC-NOV-002", "BC-NOV-003", "BC-NOV-004"],
    },
  ];

  const bookMap: Record<string, string> = {};
  for (const b of booksData) {
    const { copies, ...bookFields } = b;
    const book = await prisma.book.upsert({
      where: { isbn: b.isbn },
      update: { title: b.title, stock_total: b.stock_total, stock_available: b.stock_available },
      create: bookFields,
    });
    bookMap[b.isbn] = book.id;

    // Seed copies
    for (const copyCode of copies) {
      await prisma.bookCopy.upsert({
        where: { copy_code: copyCode },
        update: { status: CopyStatus.AVAILABLE },
        create: {
          copy_code: copyCode,
          book_id: book.id,
          status: CopyStatus.AVAILABLE,
          condition: "Baik",
        },
      });
    }
  }
  console.log("✓ 6. Books & Book Copies seeded.");

  // 6. Transactions & Fines Sample Data
  const studentId = userMap["STUDENT"];
  const librarianId = userMap["LIBRARIAN"];
  const fisikaBookId = bookMap["978-602-01-0001-1"];
  const fisikaCopy = await prisma.bookCopy.findUnique({ where: { copy_code: "BC-FIS-001" } });

  if (studentId && fisikaBookId && fisikaCopy) {
    const sampleBorrow = await prisma.borrowing.upsert({
      where: { borrow_code: "BOR-20260828-001" },
      update: { status: BorrowStatus.BORROWED },
      create: {
        borrow_code: "BOR-20260828-001",
        user_id: studentId,
        book_id: fisikaBookId,
        book_copy_id: fisikaCopy.id,
        request_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        borrow_date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        status: BorrowStatus.BORROWED,
        approved_by: librarianId,
        notes: "Dipinjam untuk persiapan ujian Fisika XI IPA 1 [SEED TRANS]",
      },
    });

    // Update copy status
    await prisma.bookCopy.update({
      where: { id: fisikaCopy.id },
      data: { status: CopyStatus.BORROWED },
    });

    console.log("✓ 7. Sample Borrowing Transaction created (" + sampleBorrow.borrow_code + ").");
  }

  // 7. Audit Log & Notifications Sample
  if (studentId) {
    await prisma.notification.create({
      data: {
        user_id: studentId,
        title: "Peminjaman Disetujui [SEED]",
        message: "Pengajuan peminjaman buku Fisika Dasar (BOR-20260828-001) telah disetujui pustakawan.",
        type: NotificationType.BORROW_APPROVED,
        is_read: false,
      },
    });

    await prisma.auditLog.create({
      data: {
        user_id: librarianId,
        action: "APPROVE_BORROW",
        entity: "Borrowing",
        entity_id: "BOR-20260828-001",
        details: "Librarian disetujui peminjaman Fisika Dasar untuk Ahmad Fauzi [SEED LOG]",
        ip_address: "127.0.0.1",
      },
    });
    console.log("✓ 8. Notifications & Audit Logs seeded.");
  }

  console.log("====================================================");
  console.log("Database Seeding Tahap 2 Berhasil!");
  console.log("====================================================");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
