import { authOptions } from "@/lib/auth";
import { testAiConnection, AiProvider } from "@/lib/ai-config";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

const testSchema = z.object({
  provider: z.enum(["nvidia", "openai", "gemini", "custom"]),
  baseUrl: z.string().trim().optional(),
  model: z.string().trim().min(1, "Model AI wajib dipilih untuk pengujian."),
  apiKey: z.string().optional(),
  useStoredKey: z.boolean().optional(),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Akses ditolak. Fitur ini hanya dapat diakses oleh Administrator." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = testSchema.parse(body);

    const result = await testAiConnection({
      provider: parsed.provider as AiProvider,
      baseUrl: parsed.baseUrl,
      model: parsed.model,
      apiKey: parsed.apiKey,
      useStoredKey: parsed.useStoredKey,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues.map((e) => e.message).join(", ") },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Terjadi kesalahan internal saat pengujian koneksi." },
      { status: 500 }
    );
  }
}
