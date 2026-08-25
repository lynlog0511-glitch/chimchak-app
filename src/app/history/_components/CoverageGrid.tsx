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
 * 형태 — `paper-2` 면 한 덩어리 r14, 칸 사이는 세로 hairline,
 * 숫자 17px w800 tabular `brand-800`(#14665f), 라벨 12.5px `ink-muted`, 미실시는 「—」 `faint`.
 * (19px·11.5px은 가이드 §2 눈금 밖 값이라 11 / 12.5 / 13.5 / 15 / 17 안으로 들여 놓았습니다.)
 *
 * 2026-08-25 바깥 보더를 뺐습니다. 이 화면에는 무보더 면 카드(추천 tint · 재개 warn-soft ·
 * 하단 paper-2)와 선 카드가 섞여 있었는데, 가이드 §3이 「카드는 무보더 면 또는 line 1px 중
 * 택1 — 같은 화면에서 혼용 금지」로 명시적으로 금지한 자리입니다(페르소나 디자이너 med).
 * 이 표를 면 쪽으로 옮기면 /history가 무보더 면 하나로 통일되고, 칸을 가르던 hairline은
 * 그대로 남아 「네 칸」이라는 정보도 잃지 않습니다.
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
  /**
   * 다음 칸 — 지금 열려 있는 유형 가운데 아직 비어 있는 첫 칸입니다.
   * 「—」만 보고는 그 칸이 못 여는 칸인지 아직 안 한 칸인지 갈리지 않아, 한 줄로 밝혀 둡니다.
   * (아직 열지 않은 유형은 애초에 후보가 아니므로 아래 「아직 열리지 않은 유형」 줄이 따로 맡습니다.)
   */
  const nextCell = ORDER.find((type) => activeTypes.includes(type) && counts[type] === 0);
  const openCount = ORDER.filter((type) => activeTypes.includes(type)).length;

  return (
    <div className={className}>
      <ul className="flex overflow-hidden rounded-[14px] bg-paper-2">
        {ORDER.map((type, index) => {
          const done = counts[type];
          const recent = lastAt[type];
          /* 칸 하나를 한 줄로 읽어 드립니다.
             예전에는 「최근 8.24」(눈)와 「최근 이수일 8월 24일」(낭독기)이 따로 적혀 있어,
             화면 글을 그대로 옮기면 같은 날짜가 두 번 나왔습니다. 적는 곳을 하나로 모으고,
             칸 안의 조각은 모두 장식으로 돌립니다. */
          const cellLabel =
            done > 0
              ? `${TYPE_SHORT_LABELS[type]} ${done}회` +
                (recent ? ` · 최근 이수일 ${formatShortDate(recent)}` : "")
              : `${TYPE_SHORT_LABELS[type]} 아직 해 보지 않으셨습니다`;
          return (
            <li
              key={type}
              className={cx(
                "flex-1 py-3 text-center",
                /* 회색 면 위에서는 `line`(#eef0ef)이 묻힙니다 — 칸을 가르는 선만 한 단 올립니다. */
                index > 0 && "border-l border-line-strong",
              )}
            >
              {/* 낭독기용 한 줄 — li의 aria-label은 브라우즈 모드에서 무시하는 보조기술이 있어
                  sr-only 텍스트로 둡니다. 눈에 보이는 조각들은 전부 장식(aria-hidden)입니다. */}
              <span className="sr-only">{cellLabel}</span>
              <p
                aria-hidden
                className={cx(
                  "chim-num text-[1.0625rem] leading-[1.2] font-extrabold",
                  done > 0 ? "text-brand-800" : "text-ink-faint",
                )}
              >
                {done > 0 ? done : "—"}
              </p>
              <p
                aria-hidden
                className={cx(
                  "mt-[1px] text-[0.7813rem] leading-[1.4]",
                  done > 0 ? "text-ink-muted" : "text-ink-faint",
                )}
              >
                {TYPE_SHORT_LABELS[type]}
              </p>
              {/* 기간 축 한 줄 — 칸 높이가 들쭉날쭉해지지 않도록 빈 칸도 자리는 지킵니다. */}
              <p aria-hidden className="chim-num mt-[2px] text-[0.6875rem] leading-[1.4] text-ink-muted">
                {recent ? `최근 ${formatTinyDate(recent)}` : " "}
              </p>
            </li>
          );
        })}
      </ul>

      {/* 다음 칸 안내 — 어느 칸을 채우면 되는지 한 줄로 짚어 둡니다(개수는 세지 않습니다). */}
      {nextCell ? (
        <p className="mt-[6px] text-[0.8438rem] leading-[1.6] text-ink-soft">
          다음 칸은 「{TYPE_SHORT_LABELS[nextCell]}」이에요. 아직 비어 있어요.
        </p>
      ) : (
        openCount > 0 && (
          <p className="mt-[6px] text-[0.8438rem] leading-[1.6] text-ink-soft">
            지금 열려 있는 칸은 모두 채우셨어요. 이제부터는 같은 칸을 다시 채워 가면 돼요.
          </p>
        )
      )}

      {/* 아직 열지 않은 유형은 「—」로만 두면 이유를 알 수 없어, 아래 한 줄로 조용히 적어 둡니다. */}
      {pending.length > 0 && (
        <p className="mt-[6px] text-[0.8438rem] leading-[1.5] text-tertiary">
          {pending.map((type) => TYPE_SHORT_LABELS[type]).join(" · ")}은 아직 열리지 않았습니다
        </p>
      )}
    </div>
  );
}

export default CoverageGrid;
