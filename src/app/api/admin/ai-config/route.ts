import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getMaskedAiConfig,
  saveAiConfig,
  AiProvider,
} from "@/lib/ai-config";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateAiConfigSchema = z.object({
  provider: z.enum(["nvidia", "openai", "gemini", "custom"]),
  baseUrl: z.string().trim().optional(),
  model: z.string().trim().min(1, "Model AI wajib dipilih atau diisi."),
  apiKey: z.string().optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Akses ditolak. Fitur ini hanya dapat diakses oleh Administrator." },
      { status: 403 }
    );
  }

  try {
    const config = await getMaskedAiConfig();

    // Fetch recent audit logs related to AI Configuration
    const auditLogs = await db.auditLog.findMany({
      where: { entity_id: "AI_CONFIGURATION" },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        user: {
          select: {
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return NextResponse.json({
      config,
      auditLogs: auditLogs.map((log) => ({
        id: log.id,
        action: log.action,
        details: log.details ? JSON.parse(log.details) : null,
        createdAt: log.createdAt.toISOString(),
        userName: log.user?.name || "Admin",
      })),
    });
  } catch (error) {
    console.error("Gagal mengambil konfigurasi AI:", error);
    return NextResponse.json(
      { error: "Gagal memuat konfigurasi AI dari server." },
      { status: 500 }
    );
  }
}

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
    const parsed = updateAiConfigSchema.parse(body);

    const result = await saveAiConfig({
      provider: parsed.provider as AiProvider,
      baseUrl: parsed.baseUrl,
      model: parsed.model,
      newApiKey: parsed.apiKey,
      adminUserId: session.user.id,
      adminUserName: session.user.name || undefined,
    });

    return NextResponse.json({
      message: "Konfigurasi AI Assistant berhasil diperbarui dan langsung aktif.",
      config: result.maskedConfig,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues.map((e) => e.message).join(", ") },
        { status: 400 }
      );
    }
    const message = (error as Error)?.message || "Gagal menyimpan konfigurasi AI.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
