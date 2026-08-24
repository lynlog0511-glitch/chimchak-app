/**
 * 침착(ChimChak) 주간 목표 — 「주 몇 회」 하나뿐인 습관 루프.
 *
 * 원칙
 * - 기기 안(localStorage)에만 저장한다. 서버 전송·외부 API 호출은 0건이다.
 *   담기는 것은 **숫자 한 칸(주 n회)** 뿐이고, 발화·판정·개인정보는 어떤 형태로도 넣지 않는다.
 * - **세는 것은 완주 회차 수뿐이다.** 점수·등급·순위·백분위를 만들지 않는다(PROJECT_BRIEF §3-1).
 *   「2/3회」는 화면이 이미 쓰고 있는 개수 표기(성장 기록의 「잘한 것 N」)와 같은 등급의 사실이다.
 * - 세션 기록은 **읽기만** 한다(`storage.loadSessions`). 이 파일이 저장하는 것은 목표값 하나다.
 * - 주 경계는 **월요일 00:00(기기 로컬)** 이다. 기록이 기기 안에만 있으므로 시간대도 기기를 따른다.
 * - SSR 가드: 서버 렌더링 중에는 조용히 기본값으로 동작한다.
 *
 * **왜 세는 방식을 성장 기록과 한 글자도 다르지 않게 맞췄나.**
 * 「이번 주 몇 회」를 말하는 자리가 홈(이 파일)과 성장 기록(`app/history/_components/weeklySummary.ts`)
 * 둘로 갈렸다. 두 곳이 다른 기준으로 세면 같은 날 홈은 2회, 성장 기록은 3회를 말하게 되고,
 * 그 순간 사용자가 믿을 숫자가 사라진다. 그래서 시각 선택(`endedAt || startedAt`)·읽지 못한 시각
 * 버리기·경계 비교(`>= 월요일 00:00`)를 그쪽과 같은 규칙으로 둔다. 한쪽을 고치면 다른 쪽도 함께 고친다.
 *
 * @example
 * const progress = loadWeeklyGoalProgress(); // { goal: 3, done: 2, remaining: 1, ... }
 * goalStatusLine(progress);                  // "한 번이면 목표입니다."
 */

import type { SessionRecord } from "@/types";
import { loadSessions } from "./storage";

/** 목표값이 사는 자리 — 이 키에 담기는 것은 `{ perWeek: 3 }` 한 칸뿐이다. */
export const GOAL_KEY = "chimchak.goal.v1";

/** 기본 주간 목표 — 정한 적 없는 분께는 주 3회로 둔다. */
export const DEFAULT_WEEKLY_GOAL = 3;

/** 고를 수 있는 하한·상한 — 화면도 이 범위 밖의 칸을 그리지 않는다. */
export const MIN_WEEKLY_GOAL = 1;
export const MAX_WEEKLY_GOAL = 7;

/** 화면이 그대로 늘어놓는 선택지(주 1~7회). */
export const WEEKLY_GOAL_CHOICES: readonly number[] = [1, 2, 3, 4, 5, 6, 7];

/** 하루(ms) — 주 경계 계산에만 쓴다. */
/* ── 저장소 (숫자 한 칸) ───────────────────────────────── */

function getStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/**
 * 저장된 값을 안전한 범위로 되돌린다.
 *
 * 숫자가 아니면 기본값으로 낮추고, 범위를 벗어난 숫자는 **버리지 않고 범위 안으로 당긴다** —
 * 손으로 고친 값 하나 때문에 사용자가 정해 둔 목표가 조용히 3으로 되돌아가지 않게 하려는 것이다.
 *
 * @example normalizeWeeklyGoal(9) // 7
 * @example normalizeWeeklyGoal("셋") // 3 (기본값)
 */
export function normalizeWeeklyGoal(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_WEEKLY_GOAL;
  const whole = Math.floor(value);
  if (whole < MIN_WEEKLY_GOAL) return MIN_WEEKLY_GOAL;
  if (whole > MAX_WEEKLY_GOAL) return MAX_WEEKLY_GOAL;
  return whole;
}

/**
 * 이 기기에 정해 둔 주간 목표. 없거나 훼손되었으면 기본값(주 3회)을 돌려준다.
 *
 * @example loadWeeklyGoal(); // 3
 */
export function loadWeeklyGoal(): number {
  const storage = getStorage();
  if (!storage) return DEFAULT_WEEKLY_GOAL;
  try {
    const raw = storage.getItem(GOAL_KEY);
    if (!raw) return DEFAULT_WEEKLY_GOAL;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return DEFAULT_WEEKLY_GOAL;
    return normalizeWeeklyGoal((parsed as Record<string, unknown>).perWeek);
  } catch {
    return DEFAULT_WEEKLY_GOAL;
  }
}

/**
 * 주간 목표를 저장하고 **실제로 남았는지 돌려준다**(`storage.ts`와 같은 규율이다).
 *
 * 예외는 밖으로 던지지 않는다(화면이 죽으면 안 된다). 다만 조용히 삼키지도 않는다 —
 * 사이트 데이터가 막힌 브라우저에서 화면이 「바꿨습니다」라고만 말하면, 다음에 열었을 때
 * 목표가 되돌아가 있는 이유를 사용자가 알 길이 없다.
 *
 * @example
 * if (!saveWeeklyGoal(4)) notify("이 기기에 저장하지 못했습니다");
 */
export function saveWeeklyGoal(perWeek: number): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(GOAL_KEY, JSON.stringify({ perWeek: normalizeWeeklyGoal(perWeek) }));
    return true;
  } catch {
    /* 저장 공간 부족·사생활 보호 모드 — 던지지 않고 실패로 돌려준다 */
    return false;
  }
}

/* ── 주 경계와 완료 회차 (순수 함수) ───────────────────── */

/**
 * 그 시각이 속한 주의 **월요일 00:00**(기기 로컬).
 *
 * @example startOfWeek(new Date(2026, 7, 23, 12, 0)).getDay() // 1 (일요일 8/23 → 월요일 8/17)
 */
export function startOfWeek(at: Date): Date {
  const day = new Date(at.getFullYear(), at.getMonth(), at.getDate());
  // getDay(): 0=일 … 6=토. 일요일은 그 주의 마지막 날이므로 6일 전이 월요일이다.
  const back = (day.getDay() + 6) % 7;
  day.setDate(day.getDate() - back);
  return day;
}

/**
 * 회차 한 건의 시각(ms). 읽지 못하는 시각은 0으로 두고 세지 않는다.
 * 마친 시각이 우선이고, 없으면 시작 시각을 쓴다 — 성장 기록의 「이번 주」와 같은 선택이다.
 */
function timeOf(record: SessionRecord): number {
  const raw = record.endedAt || record.startedAt;
  const ms = new Date(raw).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * 이번 주(월요일 00:00부터)에 마친 회차 수.
 *
 * 판정이 무엇이든 **완주한 회차는 한 번으로 센다** — 여기서 세는 것은 「했는가」이고,
 * 잘했는지는 세지 않는다(그것을 세기 시작하면 점수가 된다).
 *
 * @example countSessionsInWeek(records, new Date(2026, 7, 26)) // 2
 */
export function countSessionsInWeek(
  records: readonly SessionRecord[],
  now: Date = new Date(),
): number {
  const weekStart = startOfWeek(now).getTime();
  let count = 0;
  for (const record of records) {
    const at = timeOf(record);
    if (at > 0 && at >= weekStart) count += 1;
  }
  return count;
}

/** 홈 카드가 그리는 데 필요한 사실 한 벌 — 전부 횟수이고, 점수·등급은 없다. */
export interface WeeklyGoalProgress {
  /** 이 기기에 정해 둔 주 n회 (1~7) */
  goal: number;
  /** 이번 주에 마친 회차 수 */
  done: number;
  /** 목표까지 남은 회차 수 (채웠으면 0) */
  remaining: number;
  /** 이번 주 월요일 00:00 (ms) — 화면이 주가 바뀐 것을 알아채는 데 쓴다 */
  weekStartMs: number;
  /** 이 기기에 완주 기록이 한 건이라도 있는지 — 첫 문장을 고르는 데만 쓴다 */
  hasAnyRecord: boolean;
}

/**
 * 회차 목록과 목표값에서 이번 주 사실을 뽑는다(순수 함수 — 같은 입력이면 같은 값).
 *
 * @example
 * buildWeeklyGoalProgress(records, 3, new Date(2026, 7, 26)).remaining // 1
 */
export function buildWeeklyGoalProgress(
  records: readonly SessionRecord[],
  goal: number,
  now: Date = new Date(),
): WeeklyGoalProgress {
  const safeGoal = normalizeWeeklyGoal(goal);
  const done = countSessionsInWeek(records, now);
  let hasAnyRecord = false;
  for (const record of records) {
    if (timeOf(record) > 0) {
      hasAnyRecord = true;
      break;
    }
  }
  return {
    goal: safeGoal,
    done,
    remaining: Math.max(0, safeGoal - done),
    weekStartMs: startOfWeek(now).getTime(),
    hasAnyRecord,
  };
}

/**
 * 이 기기의 이번 주 사실 — 목표값과 세션 기록을 함께 읽는다(세션은 읽기만 한다).
 *
 * @example const { done, goal } = loadWeeklyGoalProgress();
 */
export function loadWeeklyGoalProgress(now: Date = new Date()): WeeklyGoalProgress {
  return buildWeeklyGoalProgress(loadSessions(), loadWeeklyGoal(), now);
}

/* ── 문장 (사실만) ─────────────────────────────────────── */

/**
 * 횟수 아래 한 줄. **미달을 꾸짖지 않는다** — 남은 것을 사실로 적고 판단은 사람 몫으로 둔다.
 *
 * 위에서부터 먼저 맞는 것 하나만 쓴다(두 줄로 늘리지 않는다).
 * 아직 한 회차도 마치지 않은 분께는 「0회」를 설명하는 문장을 세운다 —
 * 처음 열어 보신 분께 첫 문장이 빚처럼 읽히지 않게 하려는 자리다.
 *
 * @example goalStatusLine({ goal: 3, done: 2, remaining: 1, ... }) // "한 번이면 목표입니다."
 */
export function goalStatusLine(progress: WeeklyGoalProgress): string {
  const { goal, done, remaining, hasAnyRecord } = progress;
  if (done > goal) return `목표보다 ${done - goal}회 더 하셨습니다.`;
  if (done === goal) return "이번 주 목표를 채우셨습니다.";
  if (done === 0) {
    return hasAnyRecord
      ? "아직 이번 주가 남아 있습니다."
      : "첫 회차를 마치시면 여기에 쌓입니다.";
  }
  if (remaining === 1) return "한 번이면 목표입니다.";
  return `${remaining}번이면 목표입니다.`;
}
