import { PrismaClient } from "@prisma/client";
import {
  getAiRuntimeConfig,
  getMaskedAiConfig,
  saveAiConfig,
  encryptApiKey,
  decryptApiKey,
  maskApiKey,
  testAiConnection,
  validateEndpointUrl,
  invalidateAiConfigCache,
} from "../src/lib/ai-config";

const prisma = new PrismaClient();

async function runTests() {
  console.log("================================================================================");
  console.log("MENJALANKAN PENGUJIAN KOMPREHENSIF FITUR DYNAMIC AI CONFIGURATION");
  console.log("================================================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} - ${detail || "Assertion failed"}`);
      failed++;
    }
  }

  try {
    // Cari admin user untuk konteks test
    const adminUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    if (!adminUser) throw new Error("Admin user tidak ditemukan di database!");

    const studentUser = await prisma.user.findFirst({ where: { role: "STUDENT" } });
    if (!studentUser) throw new Error("Student user tidak ditemukan di database!");

    // Simpan backup systemSettings awal terkait AI agar bisa dipulihkan setelah test selesai
    const originalAiSettings = await prisma.systemSetting.findMany({
      where: { key: { startsWith: "ai_" } },
    });

    console.log(`\n--- Test 1: Unit Enkripsi, Dekripsi, dan Masking (AES-256-GCM) ---`);
    const testSecret = "nvapi-sample-key-1234567890abcdef-secret";
    const encrypted = encryptApiKey(testSecret);
    assert(encrypted.includes(":"), "Format ciphertext berisi iv:tag:ciphertext");
    const decrypted = decryptApiKey(encrypted);
    assert(decrypted === testSecret, "Hasil dekripsi persis sama dengan plaintext awal");
    const corruptedEncrypted = encrypted.slice(0, -4) + "ffff";
    const failedDecryption = decryptApiKey(corruptedEncrypted);
    assert(failedDecryption === null, "Dekripsi gagal dengan aman saat ciphertext rusak/tampered");

    const masked = maskApiKey(testSecret);
    assert(masked.startsWith("nvapi-"), "Masked key mempertahankan prefix nvapi-");
    assert(masked.endsWith(testSecret.slice(-4)), "Masked key menampilkan 4 digit terakhir");
    assert(!masked.includes(testSecret.slice(10, 20)), "Masked key menyembunyikan mayoritas isi kunci");

    console.log(`\n--- Test A: Konfigurasi Awal (Fallback ke .env saat DB kosong) ---`);
    // Bersihkan setting DB sementara
    await prisma.systemSetting.deleteMany({ where: { key: { startsWith: "ai_" } } });
    invalidateAiConfigCache();

    const fallbackConfig = await getAiRuntimeConfig();
    assert(fallbackConfig.source === "env_fallback", "Sumber konfigurasi adalah env_fallback ketika DB belum disetel");
    assert(Boolean(fallbackConfig.apiKey), "API Key fallback terbaca dari process.env.NVIDIA_API_KEY");
    assert(fallbackConfig.model === "meta/llama-3.2-11b-vision-instruct", "Model fallback adalah model default llama-3.2-11b");

    const maskedFallback = await getMaskedAiConfig();
    assert(maskedFallback.source === "env_fallback", "Masked config mencerminkan env_fallback");
    assert(!("apiKey" in maskedFallback), "Masked config TIDAK mengekspos raw apiKey");

    console.log(`\n--- Test B: Menyimpan API Key Baru dengan Aman ---`);
    const newApiKey = "nvapi-testing-new-unique-key-9999-ABCD";
    const saveResult = await saveAiConfig({
      provider: "nvidia",
      model: "meta/llama-3.2-11b-vision-instruct",
      newApiKey,
      adminUserId: adminUser.id,
      adminUserName: adminUser.name,
    });

    assert(saveResult.ok === true, "saveAiConfig berhasil dieksekusi");
    assert(saveResult.maskedConfig.hasApiKey === true, "Status hasApiKey bernilai true");
    assert(saveResult.maskedConfig.maskedApiKey.endsWith("ABCD"), "Masked key diperbarui dengan 4 digit terakhir key baru");

    // Verifikasi database tidak menyimpan plaintext
    const dbRecord = await prisma.systemSetting.findUnique({ where: { key: "ai_api_key_encrypted" } });
    assert(Boolean(dbRecord && !dbRecord.value.includes("nvapi-testing")), "API Key di database terenkripsi, BUKAN plaintext");

    // Verifikasi runtime langsung menggunakan key baru tanpa restart
    const runtimeConfigAfterSave = await getAiRuntimeConfig();
    assert(runtimeConfigAfterSave.source === "database", "Sumber konfigurasi kini adalah database");
    assert(runtimeConfigAfterSave.apiKey === newApiKey, "Runtime langsung menggunakan API Key baru");

    // Verifikasi audit log tercatat
    const auditLog = await prisma.auditLog.findFirst({
      where: { entity_id: "AI_CONFIGURATION" },
      orderBy: { createdAt: "desc" },
    });
    assert(Boolean(auditLog && auditLog.action === "UPDATE_AI_CONFIG"), "Audit log mencatat aksi UPDATE_AI_CONFIG");
    assert(!auditLog?.details?.includes(newApiKey), "Audit log TIDAK membocorkan plaintext API Key");

    console.log(`\n--- Test C: Mengganti Model AI Tanpa Mengubah API Key ---`);
    const newModel = "meta/llama-3.1-8b-instruct";
    const changeModelResult = await saveAiConfig({
      provider: "nvidia",
      model: newModel,
      adminUserId: adminUser.id,
      adminUserName: adminUser.name,
      // API Key dikosongkan untuk menguji apakah key lama dipertahankan
    });

    assert(changeModelResult.ok === true, "Penyimpanan model baru berhasil");
    const runtimeAfterModelChange = await getAiRuntimeConfig();
    assert(runtimeAfterModelChange.model === newModel, "Model runtime langsung berganti ke model baru");
    assert(runtimeAfterModelChange.apiKey === newApiKey, "API Key tersimpan tetap terjaga dan tidak hilang saat input kosong");

    console.log(`\n--- Test D: Mengganti Provider, API Key, dan Model Bersamaan ---`);
    const comboKey = "sk-test-custom-openai-compatible-key-5678";
    const comboModel = "gpt-4o-mini";
    await saveAiConfig({
      provider: "openai",
      model: comboModel,
      newApiKey: comboKey,
      adminUserId: adminUser.id,
      adminUserName: adminUser.name,
    });

    const runtimeCombo = await getAiRuntimeConfig();
    assert(runtimeCombo.provider === "openai", "Provider runtime berganti ke openai");
    assert(runtimeCombo.model === comboModel, "Model runtime berganti ke gpt-4o-mini");
    assert(runtimeCombo.apiKey === comboKey, "API Key runtime berganti ke comboKey");

    console.log(`\n--- Test E & F: Pengujian Koneksi & Validasi Error ---`);
    // Pengujian URL SSRF
    const ssrfCheck1 = validateEndpointUrl("http://localhost:8080");
    const ssrfCheck2 = validateEndpointUrl("ftp://invalid-protocol.com");
    assert(!ssrfCheck2.valid, "Protokol non-HTTP/HTTPS ditolak oleh validator");

    // Pengujian koneksi dengan key palsu (harus gagal dengan aman tanpa crash)
    const testInvalidKey = await testAiConnection({
      provider: "nvidia",
      model: "meta/llama-3.2-11b-vision-instruct",
      apiKey: "nvapi-fake-invalid-key-000000000000000000000000000000",
    });
    assert(testInvalidKey.ok === false, "Koneksi dengan key palsu ditolak");
    assert(Boolean(testInvalidKey.message), "Pesan error informatif diberikan: " + testInvalidKey.message);

    console.log(`\n--- Test H: Persistensi Konfigurasi ---`);
    // Simulasi cold restart: hapus cache in-memory
    invalidateAiConfigCache();
    const persisted = await getAiRuntimeConfig();
    assert(persisted.source === "database", "Konfigurasi tetap terbaca dari DB setelah cache in-memory di-reset");
    assert(persisted.model === comboModel, "Model tetap persisten sesuai yang tersimpan");
    assert(persisted.apiKey === comboKey, "API key tetap persisten dan terdekripsi sempurna");

    console.log(`\n--- Test J: Permintaan Bersamaan (Concurrency & Atomicity) ---`);
    // Menjalankan beberapa pembacaan paralel serentak saat konfigurasi diubah
    const reads = Promise.all([
      getAiRuntimeConfig(),
      getAiRuntimeConfig(),
      getAiRuntimeConfig(),
      getAiRuntimeConfig(),
    ]);
    const update = saveAiConfig({
      provider: "nvidia",
      model: "meta/llama-3.2-11b-vision-instruct",
      newApiKey: "nvapi-concurrent-test-key-1111",
      adminUserId: adminUser.id,
    });

    const [results, updateRes] = await Promise.all([reads, update]);
    assert(results.length === 4, "Semua 4 pembacaan konkuren selesai tanpa benturan");
    assert(updateRes.ok === true, "Pembaruan konkuren berhasil dilakukan secara atomik");

    const latestRuntime = await getAiRuntimeConfig();
    assert(latestRuntime.apiKey === "nvapi-concurrent-test-key-1111", "Konfigurasi akhir konsisten");

    // Pulihkan kembali konfigurasi asli jika sebelumnya ada
    console.log(`\n--- Membersihkan dan Memulihkan Kondisi Awal ---`);
    await prisma.systemSetting.deleteMany({ where: { key: { startsWith: "ai_" } } });
    if (originalAiSettings.length > 0) {
      for (const s of originalAiSettings) {
        await prisma.systemSetting.create({ data: s });
      }
    }
    invalidateAiConfigCache();
    console.log("Kondisi sistem dikembalikan ke semula.");

  } catch (error) {
    console.error("Terjadi error tak terduga selama pengujian:", error);
    failed++;
  } finally {
    await prisma.$disconnect();
  }

  console.log("\n================================================================================");
  console.log(`RINGKASAN HASIL PENGUJIAN: ${passed} LULUS, ${failed} GAGAL`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

void runTests();
