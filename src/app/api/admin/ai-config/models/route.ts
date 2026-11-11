import { authOptions } from "@/lib/auth";
import { fetchProviderModels, AiProvider } from "@/lib/ai-config";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

const modelsSchema = z.object({
  provider: z.enum(["nvidia", "openai", "gemini", "custom"]),
  baseUrl: z.string().trim().optional(),
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
    const parsed = modelsSchema.parse(body);

    const result = await fetchProviderModels({
      provider: parsed.provider as AiProvider,
      baseUrl: parsed.baseUrl,
      apiKey: parsed.apiKey,
      useStoredKey: parsed.useStoredKey,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues.map((e) => e.message).join(", ") },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Gagal memuat daftar model." },
      { status: 500 }
    );
  }
}
