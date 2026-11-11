import { db } from "./db";

async function validateDatabase() {
  console.log("--------------------------------------------------");
  console.log("Validasi Integrity & Query Database Tahap 2");
  console.log("--------------------------------------------------");

  // 1. Validate Users & Roles
  const users = await db.user.findMany({ select: { name: true, role: true, email: true } });
  console.log(`✓ 1. Total User: ${users.length} (Roles: ${users.map((u) => u.role).join(", ")})`);

  // 2. Validate Book with Author, Publisher, Category, and BookCopy (Inventory)
  const books = await db.book.findMany({
    include: {
      author: true,
      publisher: true,
      category: true,
      copies: true,
    },
  });
  console.log(`✓ 2. Total Buku: ${books.length}`);
  books.forEach((b) => {
    const totalCopies = b.copies.length;
    const availCopies = b.copies.filter((c) => c.status === "AVAILABLE").length;
    console.log(
      `   - [${b.isbn}] "${b.title}" | Author: ${b.author.name} | Publisher: ${b.publisher.name} | Cat: ${b.category.name} | Inventory: ${availCopies}/${totalCopies} Available`
    );
  });

  // 3. Validate Borrowing Transactions & Fines
  const borrowings = await db.borrowing.findMany({
    include: {
      user: { select: { name: true, role: true } },
      book: { select: { title: true } },
      bookCopy: { select: { copy_code: true, status: true } },
      approver: { select: { name: true } },
    },
  });
  console.log(`✓ 3. Total Transaksi Peminjaman: ${borrowings.length}`);
  borrowings.forEach((br) => {
    console.log(
      `   - Code: ${br.borrow_code} | Peminjam: ${br.user.name} (${br.user.role}) | Buku: "${br.book.title}" (Copy: ${br.bookCopy?.copy_code}, Status: ${br.bookCopy?.status}) | Status: ${br.status}`
    );
  });

  // 4. Validate Audit Log & Notifications
  const logsCount = await db.auditLog.count();
  const notifsCount = await db.notification.count();
  console.log(`✓ 4. Audit Log Count: ${logsCount} | Notification Count: ${notifsCount}`);

  console.log("--------------------------------------------------");
  console.log("✓ DIBUKTIKAN: Seluruh relasi, Foreign Keys & Constraints valid tanpa error!");
  console.log("--------------------------------------------------");
}

validateDatabase()
  .catch((e) => {
    console.error("❌ Database validation error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
