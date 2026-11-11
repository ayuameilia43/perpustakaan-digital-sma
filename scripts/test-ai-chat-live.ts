import { getAiRuntimeConfig } from "../src/lib/ai-config";
import { buildLibraryKnowledge } from "../src/lib/ai-knowledge";

async function testLiveAiChat() {
  console.log("================================================================================");
  console.log("PENGUJIAN INTEGRASI LIVE AI ASSISTANT DENGAN RUNTIME CONFIG");
  console.log("================================================================================");

  const runtime = await getAiRuntimeConfig();
  console.log("Provider aktif:", runtime.provider);
  console.log("Base URL:", runtime.baseUrl);
  console.log("Model aktif:", runtime.model);
  console.log("Masked API Key:", runtime.maskedApiKey);
  console.log("Sumber konfigurasi:", runtime.source);

  if (!runtime.apiKey) {
    console.error("API Key tidak ditemukan!");
    process.exit(1);
  }

  // Uji pengetahuan perpustakaan
  console.log("\n1. Menguji pembuatan knowledge base perpustakaan...");
  const knowledge = await buildLibraryKnowledge({
    query: "aturan peminjaman buku",
    personalOnly: false,
    includeGuides: true,
  });
  console.log("Knowledge generated length:", knowledge.length, "karakter.");

  // Uji live upstream chat completion
  console.log("\n2. Mengirim request inferensi nyata ke provider upstream...");
  const start = Date.now();
  const upstream = await fetch(`${runtime.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${runtime.apiKey}`,
    },
    body: JSON.stringify({
      model: runtime.model,
      messages: [
        {
          role: "system",
          content: "Kamu adalah AI Assistant Perpustakaan Digital SMA. Jawab singkat ramah dalam 1 kalimat.",
        },
        {
          role: "user",
          content: "Halo, apa saja layanan di perpustakaan digital ini?",
        },
      ],
      max_tokens: 60,
      temperature: 0.3,
    }),
  });

  const latency = Date.now() - start;
  console.log("HTTP Status:", upstream.status, upstream.statusText);
  console.log("Latency:", latency, "ms");

  if (!upstream.ok) {
    const errText = await upstream.text();
    console.error("Upstream error:", errText);
    process.exit(1);
  }

  const json = await upstream.json();
  const reply = json?.choices?.[0]?.message?.content;
  console.log("\nRespons AI Berhasil Diterima:");
  console.log(">>>", reply);
  console.log("\n[SUCCESS] AI Assistant berfungsi normal dengan konfigurasi runtime terpusat!");
}

void testLiveAiChat();
