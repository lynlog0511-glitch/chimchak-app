import type { ScenarioType, SessionRecord } from "@/types";
import { cx } from "@/components";
import { TYPE_SHORT_LABELS } from "./format";
import type { ScenarioTypeMap } from "./nextTraining";

export type { ScenarioTypeMap };

export interface CoverageGridProps {
  records: SessionRecord[];
  typeByScenarioId: ScenarioTypeMap;
  /** 지금 훈련할 수 있는 유형 목록 */
  activeTypes: ScenarioType[];
  className?: string;
}

const ORDER: ScenarioType[] = ["BPSD", "EMERGENCY", "CONFLICT", "RISK"];

/**
 * 유형별로 해 본 것 — 4칸 (시안 5c).
 *
 * 어떤 유형을 얼마나 연습했는지 **완료 횟수만** 보여 주고, 점수·등급·순위는 만들지 않습니다.
 * 형태는 시안 그대로입니다 — 보더 1px `line`(#eef0ef) r14 한 덩어리, 칸 사이는 세로 hairline,
 * 숫자 19px w800 tabular `brand-800`(#14665f), 라벨 11.5px `ink-muted`, 미실시는 「—」 `faint`.
 */
export function CoverageGrid({
  records,
  typeByScenarioId,
  activeTypes,
  className,
}: CoverageGridProps) {
  const counts: Record<ScenarioType, number> = {
    BPSD: 0,
    EMERGENCY: 0,
    CONFLICT: 0,
    RISK: 0,
  };
  for (const record of records) {
    const type = typeByScenarioId[record.scenarioId.trim().toUpperCase()];
    if (type) counts[type] += 1;
  }

  const pending = ORDER.filter((type) => !activeTypes.includes(type));

  return (
    <div className={className}>
      <ul className="flex overflow-hidden rounded-[14px] border border-line">
        {ORDER.map((type, index) => {
          const done = counts[type];
          return (
            <li
              key={type}
              className={cx(
                "flex-1 py-3 text-center",
                index > 0 && "border-l border-line",
              )}
            >
              <p
                className={cx(
                  "chim-num text-[19px] leading-[1.2] font-extrabold",
                  done > 0 ? "text-brand-800" : "text-faint",
                )}
              >
                {done > 0 ? (
                  <>
                    {done}
                    <span className="sr-only">회</span>
                  </>
                ) : (
                  <>
                    <span aria-hidden>—</span>
                    <span className="sr-only">아직 해보지 않으셨습니다</span>
                  </>
                )}
              </p>
              <p
                className={cx(
                  "mt-[1px] text-[11.5px] leading-[1.4]",
                  done > 0 ? "text-ink-muted" : "text-faint",
                )}
              >
                {TYPE_SHORT_LABELS[type]}
              </p>
            </li>
          );
        })}
      </ul>

      {/* 베타 이연 유형은 「—」로만 두면 이유를 알 수 없어, 아래 한 줄로 조용히 적어 둡니다. */}
      {pending.length > 0 && (
        <p className="mt-[6px] text-[11.5px] leading-[1.5] text-tertiary">
          {pending.map((type) => TYPE_SHORT_LABELS[type]).join(" · ")}은 베타 편성 예정입니다
        </p>
      )}
    </div>
  );
}

export default CoverageGrid;
