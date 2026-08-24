import type { RubricItem } from "@/types";

/**
 * 판정 주체 표기 — 루브릭 한 항목을 **누가** 판정하도록 배정했는지.
 *
 * 낱말을 이 파일에 모아 두는 이유는 하나입니다: 같은 배정을 항목 목록에서는 「AI」로,
 * 계수 칸에서는 「경량 LLM」으로 부르면 두 칸이 다른 이야기를 하는 것처럼 읽힙니다.
 * 짧은 쪽은 30줄 목록에 붙는 칩이고, 긴 쪽은 배정 분포를 세는 줄에 붙습니다.
 */
export const JUDGE_LABEL: Record<RubricItem["judge"], { short: string; long: string }> = {
  rule: { short: "규칙", long: "규칙 — 규칙 사전·시간 규칙이 판정" },
  llm: { short: "AI", long: "AI — 교체형 어댑터 자리" },
  both: { short: "공동", long: "공동 — 두 경로가 함께 판정" },
};
