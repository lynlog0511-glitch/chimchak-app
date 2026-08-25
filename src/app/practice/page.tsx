import type { Metadata } from "next";
import { InlineDisclaimer, PageShell, ScreenHeader } from "@/components";
import { SOURCE_DOCS } from "@/data/docs";
import {
  FREE_ENTRY_EYEBROW,
  FREE_ENTRY_TITLE,
  FREE_FICTION_NOTICE,
  FREE_NO_SCORE_LINE,
} from "@/lib/onlineFree";
import { PRACTICE_SUBTITLE, PRACTICE_TRADEOFF } from "./_components/constants";
import { PracticeClient } from "./_components/PracticeClient";

/* ── 자유 대화 연습 (실험 · 온라인 전용 · 무채점) ──────────────
   오프라인은 검수된 결정론, 온라인은 진짜 여러 상황 — 이 화면이 뒷문장을 맡습니다.

   탭바에 넣지 않습니다. 이 모드는 회선이 있어야 열리고 채점하지 않으므로, 다섯 탭과 같은
   무게로 세우면 「이 앱이 하는 일」이 흐려집니다. 들어오는 길은 훈련 목록 맨 아래 카드 하나뿐입니다.
   ─────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: FREE_ENTRY_TITLE,
  description:
    "검수된 여섯 상황 밖의 장면을 그 자리에서 만들어 자유롭게 대화해 보는 연습 모드입니다. 온라인에서만 열리고 채점하지 않습니다.",
};

export default function PracticePage() {
  return (
    <PageShell sourceDocs={SOURCE_DOCS} activeTab="train">
      <ScreenHeader title={FREE_ENTRY_TITLE} subtitle={PRACTICE_SUBTITLE} />

      {/* 상시 문구 — 화면이 어느 단계에 있든 이 세 줄은 늘 위에 있습니다. */}
      <section className="mt-4 rounded-card bg-paper-2 px-4 py-[15px]">
        <p className="text-[1rem] leading-[1.5] font-extrabold text-ink">{FREE_NO_SCORE_LINE}</p>
        <p className="mt-1.5 text-[0.8438rem] leading-[1.6] text-ink-muted">
          {FREE_ENTRY_EYEBROW}
        </p>
        <p className="mt-1 text-[0.8438rem] leading-[1.6] text-ink-muted">{FREE_FICTION_NOTICE}</p>
      </section>

      <p className="mt-3 text-[0.9375rem] leading-[1.65] text-ink-soft">{PRACTICE_TRADEOFF}</p>

      <PracticeClient />

      <InlineDisclaimer size="md" tone="readable" className="mt-5 mb-6" />
    </PageShell>
  );
}
