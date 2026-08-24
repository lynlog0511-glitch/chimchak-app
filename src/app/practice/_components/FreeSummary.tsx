"use client";

import { BigButton, EyebrowLabel, SourceChip } from "@/components";
import { FREE_BLOCK_LABEL, type FreeSummaryOutcome } from "@/lib/onlineFree";
import {
  SUMMARY_AGAIN,
  SUMMARY_COACH_LABEL,
  SUMMARY_COUNT,
  SUMMARY_EYEBROW,
  SUMMARY_FAILED_NOTE,
  SUMMARY_GONE,
  SUMMARY_TITLE,
  SUMMARY_TO_TRAIN,
} from "./constants";

export interface FreeSummaryProps {
  outcome: FreeSummaryOutcome | null;
  /** 학습자가 말한 차례 수 — 세는 것은 이것뿐이고, 잘잘못은 세지 않습니다 */
  spokenTurns: number;
  /** 이 기기에서 자유 연습을 해 본 횟수 */
  practiceCount: number;
  onAgain: () => void;
}

/**
 * 마무리 화면 — **점수도 등급도 판정도 없습니다.**
 *
 * 훈련의 엔딩(`EndingPanel`)은 판정별로 화면이 갈리고 「잘한 것」·「다시 볼 것」을 목록으로
 * 폅니다. 그 목록은 루브릭 30항목과 규칙 사전이 실제로 매긴 결과라 그렇게 적을 수 있습니다.
 * 이 모드에는 그 근거가 없습니다. 그래서 여기 서는 것은 **문장 한 덩어리**뿐이고, 그 문장도
 * 근거 가드를 지난 것만 화면에 닿습니다 — 지나지 못하면 「요약을 만들지 못했습니다」로 남습니다.
 *
 * 세는 것도 하나뿐입니다: 몇 마디 하셨는가. 얼마나 잘하셨는가는 세지 않습니다.
 */
export function FreeSummary({
  outcome,
  spokenTurns,
  practiceCount,
  onAgain,
}: FreeSummaryProps) {
  const ok = outcome?.status === "ok";

  return (
    <div>
      <EyebrowLabel>{SUMMARY_EYEBROW}</EyebrowLabel>
      <h2 className="mt-1 text-[1.375rem] leading-[1.3] font-extrabold tracking-[-0.01em] text-ink">
        {SUMMARY_TITLE}
      </h2>
      <p className="mt-1.5 text-[0.9375rem] leading-[1.6] text-ink-soft">
        이번에 {spokenTurns}마디 하셨습니다. {practiceCount > 0 ? SUMMARY_COUNT(practiceCount) : ""}
      </p>

      <section className="mt-4 rounded-card bg-paper-2 px-4 py-[15px]">
        <p className="text-[0.7813rem] leading-[1.45] font-bold text-ink-muted">
          {SUMMARY_COACH_LABEL}
        </p>
        <p className="mt-1.5 text-[1.0625rem] leading-[1.6] text-ink">
          {outcome?.message ?? "요약을 청하는 중입니다…"}
        </p>

        {ok && outcome?.docId && (
          <div className="mt-3">
            <SourceChip docId={outcome.docId} />
          </div>
        )}

        {outcome && !ok && (
          <>
            <p className="mt-2 text-[0.8438rem] leading-[1.6] text-ink-muted">
              {SUMMARY_FAILED_NOTE}
            </p>
            {outcome.blocked && (
              <p className="mt-1 text-[0.6875rem] leading-[1.45] text-ink-faint">
                막힌 자리 — {FREE_BLOCK_LABEL[outcome.blocked]}
                {outcome.blockedDetail ? ` · ${outcome.blockedDetail}` : ""}
              </p>
            )}
          </>
        )}
      </section>

      <p className="mt-3 text-[0.8438rem] leading-[1.6] text-ink-muted">{SUMMARY_GONE}</p>

      <BigButton size="lg" block onClick={onAgain} className="mt-5">
        {SUMMARY_AGAIN}
      </BigButton>
      <BigButton variant="secondary" block href="/train" className="mt-2">
        {SUMMARY_TO_TRAIN}
      </BigButton>
    </div>
  );
}

export default FreeSummary;
