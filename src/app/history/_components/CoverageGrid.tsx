import type { ScenarioType, SessionRecord } from "@/types";
import { cx } from "@/components";
import { TYPE_SHORT_LABELS, formatShortDate, formatTinyDate } from "./format";
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
 *
 * 라벨 아래 「최근 8.5」 한 줄은 기간 축입니다 — 횟수만으로는 「최근에도 했는가」를 알 수 없어
 * 정기평가·직무교육 실적처럼 기간으로 묻는 자리에서 이 표를 쓸 수 없기 때문입니다.
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
  /** 유형별 가장 최근 이수 시각 (ISO) — 없으면 빈 문자열 */
  const lastAt: Record<ScenarioType, string> = {
    BPSD: "",
    EMERGENCY: "",
    CONFLICT: "",
    RISK: "",
  };
  for (const record of records) {
    const type = typeByScenarioId[record.scenarioId.trim().toUpperCase()];
    if (!type) continue;
    counts[type] += 1;
    const at = record.endedAt || record.startedAt;
    const current = lastAt[type];
    if (!current || new Date(at).getTime() > new Date(current).getTime()) {
      lastAt[type] = at;
    }
  }

  const pending = ORDER.filter((type) => !activeTypes.includes(type));

  return (
    <div className={className}>
      <ul className="flex overflow-hidden rounded-[14px] border border-line">
        {ORDER.map((type, index) => {
          const done = counts[type];
          const recent = lastAt[type];
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
                  "chim-num text-[1.1875rem] leading-[1.2] font-extrabold",
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
                  "mt-[1px] text-[0.7188rem] leading-[1.4]",
                  done > 0 ? "text-ink-muted" : "text-faint",
                )}
              >
                {TYPE_SHORT_LABELS[type]}
              </p>
              {/* 기간 축 한 줄 — 칸 높이가 들쭉날쭉해지지 않도록 빈 칸도 자리는 지킵니다. */}
              <p className="mt-[2px] text-[0.6875rem] leading-[1.4] text-ink-muted">
                {recent ? (
                  <>
                    <span aria-hidden className="chim-num">
                      최근 {formatTinyDate(recent)}
                    </span>
                    <span className="sr-only">최근 이수일 {formatShortDate(recent)}</span>
                  </>
                ) : (
                  <span aria-hidden>&nbsp;</span>
                )}
              </p>
            </li>
          );
        })}
      </ul>

      {/* 베타 이연 유형은 「—」로만 두면 이유를 알 수 없어, 아래 한 줄로 조용히 적어 둡니다. */}
      {pending.length > 0 && (
        <p className="mt-[6px] text-[0.7188rem] leading-[1.5] text-tertiary">
          {pending.map((type) => TYPE_SHORT_LABELS[type]).join(" · ")}은 베타 편성 예정입니다
        </p>
      )}
    </div>
  );
}

export default CoverageGrid;
