import type { Metadata } from "next";
import { InlineDisclaimer, PageShell, ScreenHeader } from "@/components";
import { SOURCE_DOCS } from "@/data/docs";
import {
  FREE_ENTRY_EYEBROW,
  FREE_ENTRY_TITLE,
  FREE_FICTION_NOTICE,
  FREE_NO_SCORE_LINE,
  SCENARIO_COUNT_KO,
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
  // 종수를 손으로 적지 않습니다 — 2026-08-30에 일곱 종이 열려 있는데 이 한 줄만 「여섯」으로
  // 남아 있었습니다. 세는 자리는 카드 문장(`FREE_ENTRY_SUMMARY`)과 같은 한 곳입니다.
  description: `검수된 ${SCENARIO_COUNT_KO} 상황 밖의 장면을 그 자리에서 만들어 자유롭게 대화해 보는 연습 모드입니다. 온라인에서만 열리고 채점하지 않습니다.`,
};

export default function PracticePage() {
  return (
    <PageShell sourceDocs={SOURCE_DOCS} activeTab="train">
      {/* 오른쪽 위 「설정」 — 게이트 안내가 가리키던 그 자리입니다.
          이 화면에는 그 버튼이 없었습니다. 화면 전체가 게이트인 상태에서 유일한 탈출 지시가
          존재하지 않는 컨트롤을 가리켰고, 사용자는 오른쪽 위를 두세 번 훑다가 자기가 잘못
          봤다고 생각하고 나갔습니다(페르소나 UI/UX high · 교육생 high).
          안내를 고치는 대신 **안내를 사실로 만드는 쪽**을 먼저 골랐습니다 — 겸사겸사 글자 크기
          진입점도 이 화면에 생깁니다. 게이트 안의 「지금 켜기」는 그 위에 얹는 지름길입니다.
          버튼을 여기서 직접 세우지 않습니다 — `ScreenHeader`가 전 화면 오른쪽 위에 설정을
          세우게 된 뒤로는(3차 페르소나 UI/UX med) 여기 한 번 더 적으면 같은 버튼이 둘이 됩니다. */}
      <ScreenHeader title={FREE_ENTRY_TITLE} subtitle={PRACTICE_SUBTITLE} />

      {/* 상시 문구 — 화면이 어느 단계에 있든 이 세 줄은 늘 위에 있습니다. */}
      <section className="mt-4 rounded-card bg-paper-2 px-4 py-[15px]">
        <p className="text-[1rem] leading-[1.45] font-extrabold text-ink">{FREE_NO_SCORE_LINE}</p>
        <p className="mt-1.5 text-[0.8438rem] leading-[1.6] text-ink-muted">
          {FREE_ENTRY_EYEBROW}
        </p>
        <p className="mt-1 text-[0.8438rem] leading-[1.6] text-ink-muted">{FREE_FICTION_NOTICE}</p>
      </section>

      <p className="mt-3 text-[0.9375rem] leading-[1.6] text-ink-soft">{PRACTICE_TRADEOFF}</p>

      <PracticeClient />

      <InlineDisclaimer size="md" tone="readable" className="mt-5 mb-6" />
    </PageShell>
  );
}
