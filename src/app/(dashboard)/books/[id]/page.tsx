import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { BookMarked, User, Building, Calendar, Hash, Globe, BookCopy, Tablet, MapPin, Star, BookOpen, Download } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { BorrowAction } from "@/components/borrow/BorrowAction";

export default async function BookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const book = await db.book.findUnique({
    where: { id },
    include: {
      category: true,
      author: true,
      publisher: true,
      copies: {
        select: { id: true, copy_code: true, condition: true, status: true },
        orderBy: { copy_code: "asc" },
      },
      reviews: {
        select: {
          id: true, rating: true, comment: true, createdAt: true,
          user: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      _count: { select: { copies: true, reviews: true } },
    },
  });

  if (!book) notFound();

  const avgRating = book.reviews.length > 0
    ? book.reviews.reduce((sum, r) => sum + r.rating, 0) / book.reviews.length
    : null;

  const availableCopies = book.copies.filter(c => c.status === "AVAILABLE").length;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="text-xs text-slate-500 flex items-center gap-2">
        <Link href="/catalog" className="hover:text-emerald-400 transition">Katalog</Link>
        <span>/</span>
        <span className="text-slate-300">{book.title}</span>
      </nav>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cover + Quick Info */}
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 aspect-[3/4] relative">
            {book.cover_image ? (
              <Image src={book.cover_image} alt={book.title} fill sizes="(max-width: 1024px) 100vw, 380px" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-600">
                <BookMarked className="w-20 h-20" />
              </div>
            )}
            {book.is_ebook && (
              <span className="absolute top-3 right-3 bg-teal-500 text-slate-950 text-xs font-black px-3 py-1 rounded-full flex items-center gap-1.5">
                <Tablet className="w-3.5 h-3.5" />E-Book
              </span>
            )}
          </div>

          {/* Availability Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Ketersediaan</h3>
            {book.is_ebook ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-teal-400">
                  <Tablet className="w-5 h-5" />
                  <span className="font-bold">Tersedia sebagai E-Book Digital</span>
                </div>
                {book.ebook_file_url ? (
                  <div className="grid grid-cols-1 gap-2">
                    <Link
                      href={`/ebook/${book.id}`}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold rounded-xl transition"
                    >
                      <BookOpen className="w-4 h-4" /> Baca E-Book Sekarang
                    </Link>
                    <a
                      href={book.ebook_file_url}
                      download
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold rounded-xl transition"
                    >
                      <Download className="w-3.5 h-3.5" /> Unduh File ({book.ebook_format ?? "PDF"})
                    </a>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">File e-book belum diunggah pustakawan.</p>
                )}
              </div>
            ) : (
              <div>
                <div className={`text-2xl font-black ${availableCopies > 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {availableCopies}/{book._count.copies}
                </div>
                <p className="text-xs text-slate-400">Eksemplar Tersedia</p>
                <div className="w-full bg-slate-800 rounded-full h-2 mt-2">
                  <div
                    className={`h-2 rounded-full transition-all ${availableCopies > 0 ? "bg-emerald-500" : "bg-red-500"}`}
                    style={{ width: `${book._count.copies > 0 ? (availableCopies / book._count.copies) * 100 : 0}%` }}
                  />
                </div>
                <div className="mt-3">
                  <BorrowAction
                    bookId={book.id}
                    bookTitle={book.title}
                    stockAvailable={availableCopies}
                  />
                </div>
              </div>
            )}
            {book.location_rack && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <MapPin className="w-3.5 h-3.5" />
                <span>Rak: <span className="font-bold text-slate-200">{book.location_rack}</span></span>
              </div>
            )}
          </div>
        </div>

        {/* Book Details */}
        <div className="lg:col-span-2 space-y-5">
          <div>
            <span className="text-xs font-bold uppercase text-emerald-400">{book.category.name}</span>
            <h1 className="text-2xl font-black text-white mt-1 leading-tight">{book.title}</h1>
            <p className="text-slate-400 text-sm mt-1">oleh <span className="font-semibold text-slate-200">{book.author.name}</span></p>

            {avgRating && (
              <div className="flex items-center gap-1.5 mt-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`w-4 h-4 ${i < Math.round(avgRating) ? "text-amber-400 fill-amber-400" : "text-slate-600"}`} />
                ))}
                <span className="text-xs text-slate-400 ml-1">{avgRating.toFixed(1)} ({book._count.reviews} ulasan)</span>
              </div>
            )}
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: User, label: "Pengarang", value: book.author.name },
              { icon: Building, label: "Penerbit", value: book.publisher.name },
              { icon: Calendar, label: "Tahun Terbit", value: String(book.publish_year) },
              { icon: Hash, label: "ISBN", value: book.isbn },
              { icon: Globe, label: "Format", value: book.is_ebook ? (book.ebook_format ?? "PDF") : "Buku Fisik" },
              { icon: BookCopy, label: "Total Eksemplar", value: book._count.copies > 0 ? `${book._count.copies} eks.` : "—" },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-start gap-3">
                <Icon className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-bold">{label}</p>
                  <p className="text-sm text-slate-200 font-semibold mt-0.5">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Description */}
          {book.description && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-3">Deskripsi</h3>
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{book.description}</p>
            </div>
          )}

          {/* Tags */}
          {book.tags && (
            <div className="flex flex-wrap gap-2">
              {book.tags.split(",").map(tag => (
                <span key={tag} className="px-2 py-0.5 text-xs bg-slate-800 border border-slate-700 text-slate-400 rounded-full">
                  #{tag.trim()}
                </span>
              ))}
            </div>
          )}

          {/* Book Copies */}
          {!book.is_ebook && book.copies.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-3">
                Inventaris Eksemplar ({book.copies.length})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {book.copies.map(copy => (
                  <div key={copy.id} className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between ${
                    copy.status === "AVAILABLE"
                      ? "bg-emerald-950/40 border border-emerald-800/40 text-emerald-300"
                      : "bg-slate-800 border border-slate-700 text-slate-500"
                  }`}>
                    <span className="font-mono">{copy.copy_code}</span>
                    <span className="text-[10px] uppercase">
                      {copy.status === "AVAILABLE" ? "Tersedia" : copy.status === "BORROWED" ? "Dipinjam" : copy.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reviews */}
          {book.reviews.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-3">
                Ulasan Pembaca ({book._count.reviews})
              </h3>
              <div className="space-y-3">
                {book.reviews.map(r => (
                  <div key={r.id} className="pb-3 border-b border-slate-800/80 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-300">{r.user.name}</span>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`w-3 h-3 ${i < r.rating ? "text-amber-400 fill-amber-400" : "text-slate-700"}`} />
                        ))}
                      </div>
                    </div>
                    {r.comment && <p className="text-xs text-slate-400">{r.comment}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
