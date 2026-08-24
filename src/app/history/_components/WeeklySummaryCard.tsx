import type { SessionRecord } from "@/types";
import { EyebrowLabel } from "@/components";
import { buildWeeklySummary } from "./weeklySummary";
import type { ScenarioTypeMap } from "./nextTraining";

export interface WeeklySummaryCardProps {
  records: SessionRecord[];
  typeByScenarioId: ScenarioTypeMap;
  className?: string;
}

/**
 * 이번 주 요약 카드.
 *
 * 추천 카드(틸 면) 바로 아래에 놓이는 **조용한 회색 면**입니다 —
 * 가이드 §1의 「색 면은 화면당 1~2블록」을 지키려고 여기서는 paper-2만 씁니다.
 * 담는 것은 이번 주 완주 회차 수와 달라진 점 한 줄까지이고, 점수·등급은 만들지 않습니다.
 *
 * 기록이 한 건도 없으면 아무것도 그리지 않습니다 — 빈 상태 안내는 「최근 훈련」 자리가 이미 맡고 있어,
 * 여기까지 「0회」를 세워 두면 처음 오신 분에게 빈 칸만 두 번 보여 주게 됩니다.
 */
export function WeeklySummaryCard({
  records,
  typeByScenarioId,
  className,
}: WeeklySummaryCardProps) {
  const summary = buildWeeklySummary(records, typeByScenarioId);
  if (!summary.hasAnyRecord) return null;

  return (
    <section aria-labelledby="weekly-summary-title" className={className}>
      <div className="rounded-[14px] bg-paper-2 px-4 py-[14px]">
        <EyebrowLabel id="weekly-summary-title">이번 주</EyebrowLabel>
        <p className="mt-[6px] text-[1.0625rem] leading-[1.35] font-bold text-ink">
          {summary.thisWeek > 0 ? (
            <>
              <span className="chim-num">{summary.thisWeek}</span>회 완주하셨어요
            </>
          ) : (
            "이번 주에는 아직 완주한 훈련이 없어요"
          )}
        </p>
        <p className="mt-[3px] text-[0.8438rem] leading-[1.6] text-ink-soft">
          {summary.changeLine}
        </p>
      </div>
    </section>
  );
}

export default WeeklySummaryCard;
