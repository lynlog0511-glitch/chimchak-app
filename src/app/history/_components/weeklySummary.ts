/**
 * 이번 주 요약 (순수 함수).
 *
 * 성장 기록에 「점수 없는 시간 축」을 하나 놓기 위한 조각입니다. 커버리지 4칸은 누계라
 * 한 번 채워지면 다시는 움직이지 않고, 최근 훈련 목록은 회차 하나하나라 흐름이 보이지 않습니다.
 * 그 사이에서 **이번 주에 무엇이 달라졌는지**만 사실로 한 줄 적습니다.
 *
 * 지키는 선
 *  - 점수·등급·순위·백분위를 만들지 않습니다. 세는 것은 **완주 회차 수**뿐이고,
 *    이는 화면이 이미 쓰고 있는 개수 표기(「잘한 것 N」)와 같은 등급의 사실입니다.
 *  - 「잘하고 있어요」 같은 평가를 붙이지 않습니다 — 달라진 사실만 적고 판단은 사람 몫으로 둡니다.
 *  - 새로 저장하는 것이 없습니다. 이미 있는 `SessionRecord`만 읽습니다.
 *  - 주 경계는 **월요일 00:00(기기 로컬)** 입니다. 기록이 기기 안에만 있으므로 시간대도 기기를 따릅니다.
 */

import type { ScenarioType, SessionRecord } from "@/types";
import { TYPE_SHORT_LABELS, formatShortDate } from "./format";
import type { ScenarioTypeMap } from "./nextTraining";

export interface WeeklySummary {
  /** 이번 주(월~일) 완주 회차 수 */
  thisWeek: number;
  /** 지난주 완주 회차 수 */
  lastWeek: number;
  /** 이번 주에 처음 해 본 유형의 짧은 라벨 (없으면 빈 배열) */
  firstTimeLabels: string[];
  /** 달라진 점 한 줄 — 사실만 적습니다 */
  changeLine: string;
  /** 기록이 하나라도 있는지 (없으면 화면이 이 카드를 접습니다) */
  hasAnyRecord: boolean;
}

function timeOf(record: SessionRecord): number {
  const raw = record.endedAt || record.startedAt;
  const ms = new Date(raw).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * 그 시각이 속한 주의 월요일 00:00.
 *
 * @example startOfWeek(new Date("2026-08-23T12:00:00")).getDay() // 1 (월요일)
 */
export function startOfWeek(at: Date): Date {
  const d = new Date(at.getFullYear(), at.getMonth(), at.getDate());
  // getDay(): 0=일 … 6=토. 일요일은 그 주의 마지막 날이므로 6일 전이 월요일입니다.
  const back = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - back);
  return d;
}

/**
 * 이번 주 요약을 만듭니다.
 *
 * @example
 * buildWeeklySummary(records, typeMap).changeLine // "지난주보다 1회 더 하셨어요"
 */
export function buildWeeklySummary(
  records: SessionRecord[],
  typeByScenarioId: ScenarioTypeMap,
  now: Date = new Date(),
): WeeklySummary {
  const weekStart = startOfWeek(now).getTime();
  const lastWeekStart = weekStart - 7 * 24 * 60 * 60 * 1000;

  const dated = records
    .map((record) => ({ record, at: timeOf(record) }))
    .filter((row) => row.at > 0)
    .sort((a, b) => a.at - b.at);

  const thisWeekRows = dated.filter((row) => row.at >= weekStart);
  const lastWeekRows = dated.filter((row) => row.at >= lastWeekStart && row.at < weekStart);

  const typeOf = (record: SessionRecord): ScenarioType | undefined =>
    typeByScenarioId[record.scenarioId.trim().toUpperCase()];

  // 이번 주 이전에 한 번도 나오지 않은 유형이 이번 주에 나왔다면 「처음」입니다.
  const before = new Set<ScenarioType>();
  for (const row of dated) {
    if (row.at >= weekStart) break;
    const type = typeOf(row.record);
    if (type) before.add(type);
  }
  const firstTimeTypes: ScenarioType[] = [];
  for (const row of thisWeekRows) {
    const type = typeOf(row.record);
    if (type && !before.has(type) && !firstTimeTypes.includes(type)) firstTimeTypes.push(type);
  }
  const firstTimeLabels = firstTimeTypes.map((type) => TYPE_SHORT_LABELS[type]);

  const cfIn = (rows: typeof dated): number =>
    rows.reduce((sum, row) => sum + (typeof row.record.cfCount === "number" ? row.record.cfCount : 0), 0);

  const thisWeek = thisWeekRows.length;
  const lastWeek = lastWeekRows.length;

  return {
    thisWeek,
    lastWeek,
    firstTimeLabels,
    hasAnyRecord: dated.length > 0,
    changeLine: changeLineOf({
      thisWeek,
      lastWeek,
      firstTimeLabels,
      lastSeenAt: dated.length > 0 ? dated[dated.length - 1].at : 0,
      thisWeekCf: cfIn(thisWeekRows),
      lastWeekCf: cfIn(lastWeekRows),
    }),
  };
}

interface ChangeLineInput {
  thisWeek: number;
  lastWeek: number;
  firstTimeLabels: string[];
  lastSeenAt: number;
  thisWeekCf: number;
  lastWeekCf: number;
}

/**
 * 달라진 점 한 줄. 위에서부터 먼저 맞는 것 하나만 씁니다 — 두 줄로 늘리지 않습니다.
 *
 * 조사(을/를)를 만들지 않으려고 유형 이름은 문장 앞에 떼어 놓습니다
 * (「치매 행동 · 응급 판단 — 이번 주에 처음 해보셨어요」).
 */
function changeLineOf(input: ChangeLineInput): string {
  const { thisWeek, lastWeek, firstTimeLabels, lastSeenAt, thisWeekCf, lastWeekCf } = input;

  if (thisWeek === 0) {
    if (lastSeenAt > 0) {
      return `마지막으로 완주하신 날은 ${formatShortDate(new Date(lastSeenAt).toISOString())}이었어요`;
    }
    return "아직 완주한 훈련이 없어요";
  }
  if (firstTimeLabels.length > 0) {
    return `${firstTimeLabels.join(" · ")} — 이번 주에 처음 해보셨어요`;
  }
  if (lastWeekCf > 0 && thisWeekCf === 0) {
    return "지난주에는 즉시 중단 안내를 받은 장면이 있었고, 이번 주에는 없었어요";
  }
  if (lastWeek === 0) {
    return "지난주에는 기록이 없었고, 이번 주에 다시 이어가고 계세요";
  }
  if (thisWeek > lastWeek) {
    return `지난주보다 ${thisWeek - lastWeek}회 더 하셨어요`;
  }
  if (thisWeek === lastWeek) {
    return "지난주와 같은 횟수로 이어가고 계세요";
  }
  return `지난주에는 ${lastWeek}회였어요`;
}
