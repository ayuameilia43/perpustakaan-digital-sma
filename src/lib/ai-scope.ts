export const OUT_OF_SCOPE_MESSAGE =
  "Maaf, pertanyaan tersebut di luar konteks perpustakaan digital SMA. Saya hanya dapat membantu topik terkait perpustakaan (katalog dan rekomendasi buku, peminjaman dan pengembalian, denda, keanggotaan, jam layanan), panduan cara memakai aplikasi, serta obrolan ringan. Untuk obrolan ringan, silakan sapa atau tanyakan apa yang bisa saya bantu.";

export type ScopeVerdict = {
  inScope: boolean;
  reply: string | null;
  reason: "ok" | "small_talk" | "prompt_injection" | "off_topic";
};

const SMALL_TALK_MAX_LENGTH = 80;

const LIBRARY_TERMS: RegExp[] = [
  /\bperpustakaan\b/i,
  /\bpustaka\b/i,
  /\blibrary\b/i,
  /\b(koleksi|katalog|catalog|daftar\s+buku)\b/i,
  /\b(peminjaman|pinjam|meminjam|meminjamkan|pengembalian|mengembalikan|denda|keterlambatan|perpanjangan|eksemplar)\b/i,
  /\b(anggota|keanggotaan|kartu\s+anggota|pustakawan|librarian|petugas\s+perpustakaan)\b/i,
  /\bjam\s+(buka|tutup|operasional|layanan|kerja)\b/i,
  /\b(buka|tutup|libur|operasional|lokasi|alamat|telepon|kontak)\b/i,
  /\b(pinjaman|syarat|pendaftaran|kartu|terlambat|telat|kembali)\b/i,
  /\b(isbn|penerbit|terbitan|sinopsis|ringkasan|cuplikan)\b/i,
  /\b(literasi|minat\s+baca|gemar\s+baca|komik|ensiklopedia|majalah|kamus|dictionary|ebook|e-book|audiobook)\b/i,
  /\b(rak|self\s?service|layanan\s+perpustakaan|aplikasi\s+perpustakaan)\b/i,
  /\b(referensi|modul|silabus|skripsi|tugas\s+kuliah|tugas\s+sekolah)\b/i,
  /\b(qr|scan)\s+(buku|barcode)\b/i,
];

const BOOK_TERMS: RegExp[] = [
  /\b(buku|book|books|novel|fiksi|nonfiksi|sastra|cerpen|puisi|pantun)\b/i,
  /\b(pengarang|penulis|author|novelis|karakter|genre|judul|cuplikan)\b/i,
  /\b(bacaan|ringkasan|plot|terjemahan)\b/i,
  /\b(hbs|habis\s+bacanya|terbaca)\b/i,
];

const SEARCH_INTENTS: RegExp[] = [
  /\b(cari|carikan|temukan|find|tersedia|available|bisa\s+dibaca|boleh\s+dibaca)\b/i,
  /\b(rekomendasi|rekomendasikan|recommend|suggest|saran)\b/i,
  /\b(tentang|mengenai|untuk|soal)\b/i,
  /\b(siapa|apa|apakah|berapa|kapan|di\s*mana|mengapa|kenapa|how|what|who|when|where)\b/i,
];

const WORKFLOW_VERBS: RegExp[] = [
  /\b(cara|bagaimana|langkah|panduan|tutorial|prosedur|tata\s*cara|gimana\s+cara)\b/i,
];

const WORKFLOW_NOUNS: RegExp[] = [
  /\b(peminjaman|pengembalian|kembalikan|mengembalikan|perpanjang|kuota|batas\s+pinjam)\b/i,
  /\b(profil|profile|akun|akunku|password|sandi|kata\s*sandi|login|logout|keluar|daftar|register)\b/i,
  /\b(ebook|e-book|unduh|download|baca\s+online)\b/i,
  /\b(menu|aplikasi|sistem|dashboard|dasbor|katalog|riwayat|history)\b/i,
  /\b(laporan|report|pengaturan|setting|setelan|pengguna|user|anggota|notifikasi)\b/i,
  /\b(review|ulasan|penilaian|komentar|kategori|rak|stok|denda|keanggotaan)\b/i,
  /\b(jadwal|hilang|rusak)\b/i,
];

const WORKFLOW_ACTIONS: RegExp[] = [
  /\b(ubah|ganti|edit|update|perbarui|simpan|buat|tambah|hapus|nonaktif|aktifkan|buka|tutup|lihat|cek|bayar)\b/i,
];

const CREATIVE_REQUEST: RegExp[] = [
  /\b(tulis|tuliskan|buatkan|buatin|bikinkan|karangkan)\b/i,
];

const PROMPT_INJECTION: RegExp[] = [
  /\b(abaikan|abaikani|lupakan|skip)\b[^.?!]{0,40}\b(instruksi|instruksimu|perintah|aturan|pedoman|prompt)\b/i,
  /\b(ignore|forget|disregard|override|bypass)\b[^.?!]{0,40}\b(instruction|instructions|prompt|prompts|rule|rules|previous|prior)\b/i,
  /\b(system\s*prompt|instruksi\s+sistem|prompt\s+sistem|aturan\s+sistem|developer\s*mode|jailbreak)\b/i,
  /\b(tunjukkan|sebutkan|reveal|show|print|cetak)\b[^.?!]{0,30}\b(instruksi|instruksimu|prompt)\b/i,
  /\b(berperan\s+sebagai|pretend\s+(to\s+be|you)|act\s+as|roleplay)\b/i,
  /\b(jadilah|berubah\s+menjadi)\s+(gpt|chatgpt|dokter|penyanyi|peretas)\b/i,
  /\b(developer|system)\s*:\s*/i,
];

const OFF_TOPIC: RegExp[] = [
  /\b(kode|code|program|programming|programmer|script|python|javascript|typescript|java|php|html|css|react|node\.?js|sql|regex|algoritma|algorithm|fungsi|function|debug|github|git|rest|json|database|server|hosting|deploy|compile|install|software|laptop|komputer|chrome|windows|linux|koding|ngoding|coding|website|web|error|bug)\b/i,
  /\b(hitung|pecah|pecahkan|solve|kerjakan|jawab(an)?\s+soal|hasil\s+dari|jumlahkan|kurangkan|kalikan|bagikan|akar|persen|rumus|matematika)\b/i,
  /\b\d+\s*[+\-x*\/:]\s*\d+\s*=?/i,
  /\b(kerjakan|kunci\s+jawaban|jawaban\s+soal|contoh\s+soal|soal\s+nomor)\b/i,
  /\btugas\s+(matematika|fisika|kimia|biologi|sejarah|ekonomi|inggris|indonesia)\b/i,
  /\b(write|tulis|tuliskan|buatkan|buatin|bikinkan|karangkan)\s+(a\s+|sebuah\s+|satu\s+)?(poem|poetry|puisi|pantun|song|lagu|cerita|story|joke|lelucon|dongeng|drama|script|naskah|pidato|surat|esai|artikel)\b/i,
  /\b(poem|poetry|song|lyrics|joke|riddle|movie|film|drakor|anime|series|musik|lagu|band|konser|sepak\s*bola|timnas|motogp|game|tebak|kuis)\b/i,
  /\b(pilpres|pemilu|pilkada|election|electoral|vote|voting|campaign|kampanye|partai|berita|news|presiden|menteri|gubernur|walikota|bupati|dpr|mpr|politik|pemerintah|kabinet|artis|seleb|viral|trending|gosip|gempa|bencana|skor|liga|bola|pertandingan|mlbb|pubg|valorant)\b/i,
  /\b(diagnosa|penyakit|obat|dokter|terapi|gejala|psikolog|depresi|sakit|demam|batuk|pilek|diet|olahraga|gym)\b/i,
  /\b(invest|investasi|saham|forex|crypto|kripto|bitcoin|trading|judi\w*)\b/i,
  /\b(lelucon|joke|roast|lucu|lawak|humor)\b/i,
  /\b(zodiak|ramalan|meramal|pacar|kencan|cej|date|jodoh|mimpi|tafsir)\b/i,
  /\b(cuaca|prakiraan|resep|masakan|masak|makanan|minuman|kafe|restoran|terjemahkan|translate)\b/i,
  /\b(wifi|internet|smartphone|android|iphone|lemot|servis)\b/i,
];

const PERSONAL_IDENTITY: RegExp[] = [
  /^(siapa|siapakah)\s+(saya|aku|ku|diriku)\b/i,
  /\b(saya|aku)\b[^.?!]{0,30}\b(siapa)\b/i,
  /\b(profil|profile|akun|account|data\s+diri|identitas)\s+(saya|aku|ku)\b/i,
  /\b(saya|aku|ku)\s+(itu|ini)?\s*(siapa|adalah)\b/i,
  /\b(nama|nisn|nip|email|kelas|departemen|role|jabatan)\s+(saya|aku|ku)\b/i,
  /\b(saya|aku)\s+(terdaftar|bergabung|jadi\s+anggota)\b/i,
  /\banggota\s+(sejak|semenjak|sejak\s+kapan)\b/i,
];

const PERSONAL_ACTIVITY: RegExp[] = [
  /\b(saya|aku|ku)\b[^.?!]{0,40}\b(pinjam|meminjam|peminjaman|dipinjam|kembalikan|mengembalikan|dikembalikan|selesai|riwayat|denda|notifikasi|baca|membaca|progres)\b/i,
  /\b(pinjam|meminjam|peminjaman|dipinjam|dikembalikan|selesai|riwayat|denda|notifikasi|progres|kutip)\b[^.?!]{0,40}\b(saya|aku|ku)\b/i,
  /\bbuku\s+(apa|yang|mana|selesai|sudah|sedang|lagi)\b[^.?!]{0,20}\b(saya|aku|ku)\b/i,
  /\b(cek|lihat|tampilkan|periksa|bagaimana|berapa)\b[^.?!]{0,30}\b(saya|akunku|akun\s+saya|diriku|pinjaman\s+saya|riwayat\s+saya)\b/i,
  // Konteks peminjaman/riwayat per orang (pertanyaan total, jumlah, "pernah", "sudah"):
  // dipisah agar phrasing bebas ("berapa total riwayat peminjaman yang pernah
  // saya lakukan", "sudah berapa kali saya pinjam", "riwayat peminjaman saya
  // berapa") tetap terbaca sebagai personal tanpa tergantung urutan kata.
  /\b(riwayat|peminjaman|transaksi|jumlah|total|catatan)\b[^.?!]{0,40}\b(saya|aku|ku|akunku|akun\s+saya|diriku)\b/i,
  /\b(saya|aku|ku|akunku|akun\s+saya|diriku)\b[^.?!]{0,40}\b(riwayat|peminjaman|transaksi|jumlah|total|catatan)\b/i,
  /\b(berapa|berapa\s+(banyak|kali)|total|jumlah)\b[^.?!]{0,40}\b(riwayat|peminjaman|transaksi|pinjam|meminjam)\b/i,
  /\b(pernah|pernah\s+saya|pernah\s+melakukan)\b[^.?!]{0,40}\b(saya|aku|ku)\b/i,
  /\b(sudah|telah)\b[^.?!]{0,30}\b(saya|aku|ku)\b[^.?!]{0,40}\b(pinjam|meminjam|peminjaman|riwayat|transaksi)\b/i,
  /\bdaftar\b[^.?!]{0,20}\b(riwayat|peminjaman|transaksi|pinjam)\b[^.?!]{0,20}\b(saya|aku|ku)\b/i,
];

const RECOMMEND_OR_SEARCH: RegExp[] = [
  /\b(rekomendasi|rekomendasikan|recommend|suggest|saran(buku)?|carikan|cari\s+buku)\b/i,
];

const SMALL_TALK: RegExp[] = [
  /^(halo|hai|hi|hello|hei|pagi|siang|sore|malam|salam|permisi|selamat\s+(pagi|siang|sore|malam|datang|bertemu))\b/i,
  /\b(apa\s+kabar|gimana\s+kabar|how\s+are\s+you)\b/i,
  /\b(terima\s+kasih|makasih|thanks|thank\s+you|jazakumahu)\b/i,
  /\b(selamat\s+tinggal|sampai\s+jumpa|bye|dadah|goodbye)\b/i,
  /\b(siapa\s+(kamu|anda)|nama\s+(kamu|anda)|kamu\s+siapa|anda\s+siapa|kamu\s+adalah|kamu\s+AI|kamu\s+bot|kamu\s+manusia|apa\s+itu\s+AI|AI\s+assistant)\b/i,
  /\b(apa\s+yang\s+bisa\s+(kamu|anda)|apa\s+saja\s+(yang|kemampuan|bisa)|kemampuanmu|kemampuan\s+kamu|bisa\s+bantu\s+apa|kamu\s+bisa\s+apa|apa\s+tugasmu|fitur\s+apa)\b/i,
  /\b(semangat|sukses|berhasil|lolos|semoga)\b/i,
  /\b(happy\s+reading|good\s+luck)\b/i,
  /\b(kamu\s+(baik|ramah|aman)|terima\s+kasih\s+atas\s+bantuan)\b/i,
  /^((ok|oke|okay|baik|iya|ya|sip|siap|wah|keren|bagus|hebat|mantap)\s*)+[\s!.,?]*$/i,
];

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

/**
 * Deteksi pertanyaan personal akun yang sedang login
 * (identitas, pinjaman aktif, riwayat pengembalian, denda, notifikasi, progres baca).
 * Pertanyaan rekomendasi/pencarian buku tidak dianggap personal-only agar
 * konteks katalog tetap ikut dikirim ke model.
 */
export function isPersonalAccountQuery(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  if (matchesAny(text, RECOMMEND_OR_SEARCH)) return false;
  return matchesAny(text, PERSONAL_IDENTITY) || matchesAny(text, PERSONAL_ACTIVITY);
}

/**
 * Pertanyaan yang butuh panduan alur aplikasi (cara pakai, prosedur, kebijakan).
 * Dipakai agar pertanyaan personal sederhana tidak mengirim panduan statis ~4k char.
 */
export function isWorkflowHelpQuery(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  return (
    matchesAny(text, WORKFLOW_VERBS) ||
    matchesAny(text, [/\b(kenapa|mengapa|kok|gimana|bagaimana)\b/i])
  );
}

function hasLibraryContext(text: string): boolean {
  if (matchesAny(text, LIBRARY_TERMS)) return true;
  if (matchesAny(text, PERSONAL_IDENTITY) || matchesAny(text, PERSONAL_ACTIVITY)) {
    return true;
  }
  if (matchesAny(text, CREATIVE_REQUEST)) return hasWorkflowContext(text);
  if (matchesAny(text, BOOK_TERMS) && matchesAny(text, SEARCH_INTENTS)) return true;
  return hasWorkflowContext(text);
}

function hasWorkflowContext(text: string): boolean {
  const hasCompanion =
    matchesAny(text, WORKFLOW_NOUNS) ||
    matchesAny(text, BOOK_TERMS) ||
    matchesAny(text, LIBRARY_TERMS);
  if (matchesAny(text, WORKFLOW_VERBS)) return hasCompanion;
  return (
    matchesAny(text, WORKFLOW_NOUNS) &&
    (matchesAny(text, SEARCH_INTENTS) || matchesAny(text, WORKFLOW_ACTIONS))
  );
}

function isSmallTalk(text: string): boolean {
  return text.length <= SMALL_TALK_MAX_LENGTH && matchesAny(text, SMALL_TALK);
}

export function checkLibraryScope(
  message: string,
  previousMessages: string[] = []
): ScopeVerdict {
  const text = message.trim();

  if (!text) {
    return { inScope: false, reply: OUT_OF_SCOPE_MESSAGE, reason: "off_topic" };
  }

  if (matchesAny(text, PROMPT_INJECTION)) {
    return {
      inScope: false,
      reply: OUT_OF_SCOPE_MESSAGE,
      reason: "prompt_injection",
    };
  }

  if (hasLibraryContext(text)) {
    return { inScope: true, reply: null, reason: "ok" };
  }

  const hasFollowUpContext = previousMessages
    .slice(-6)
    .some((prev) => hasLibraryContext(prev));

  if (hasFollowUpContext && !matchesAny(text, OFF_TOPIC)) {
    return { inScope: true, reply: null, reason: "ok" };
  }

  if (isSmallTalk(text) && !matchesAny(text, OFF_TOPIC)) {
    return { inScope: true, reply: null, reason: "small_talk" };
  }

  if (matchesAny(text, OFF_TOPIC)) {
    return { inScope: false, reply: OUT_OF_SCOPE_MESSAGE, reason: "off_topic" };
  }

  return { inScope: true, reply: null, reason: "ok" };
}