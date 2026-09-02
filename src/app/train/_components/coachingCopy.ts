/** 기본 화면에는 첫 문장만 두고, 이어지는 설명은 「왜 그런가요?」 안으로 보냅니다. */
export function splitCoachingMessage(message: string): { lead: string; detail: string } {
  const text = message.trim();
  const boundary = /^([\s\S]*?[.!?。！？][”"']?)(?:\s+)([\s\S]+)$/u.exec(text);
  if (!boundary) return { lead: text, detail: "" };
  return { lead: boundary[1]!.trim(), detail: boundary[2]!.trim() };
}
