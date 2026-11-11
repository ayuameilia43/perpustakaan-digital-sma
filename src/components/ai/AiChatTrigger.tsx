"use client";

import { openAiChat } from "@/components/ai/AiChatWidget";

/**
 * Tombol pembuka popup AI chat. Dipakai di tempat yang dulu
 * menautkan ke halaman /ai-assistant (banner & kartu dashboard).
 */
export function AiChatTrigger({
  children,
  className,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <button type="button" onClick={openAiChat} className={className} title={title}>
      {children}
    </button>
  );
}
