/**
 * 주간 목표 회귀 검사 — src/lib/goals.ts
 *
 * 못 박고 싶은 것은 셋이다.
 *  ① **주 경계(월요일 00:00)** — 일요일 23:59와 월요일 00:00 사이에서 「이번 주」가 갈리고,
 *     그 한 순간에 카드 숫자가 통째로 0으로 돌아간다. 시간대를 타지 않도록 표본은 전부
 *     로컬 시각 생성자(`new Date(y, m, d, ...)`)로 만든다.
 *  ② **완료 계산의 결정론** — 같은 기록·같은 시각이면 언제 몇 번을 불러도 같은 값이 나온다.
 *     여기서 세는 것은 「했는가」뿐이라 판정(충족·재훈련)은 개수를 바꾸지 못한다.
 *  ③ **목표 저장** — 범위 밖 값은 범위 안으로 당기고, 저장이 막힌 기기에서는 그 사실을 돌려준다.
 *
 * 브라우저 환경(jsdom)을 끌어오지 않고 최소 localStorage 스텁만 심는다(storage.test.ts와 같은 방식).
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_WEEKLY_GOAL,
  GOAL_KEY,
  MAX_WEEKLY_GOAL,
  MIN_WEEKLY_GOAL,
  WEEKLY_GOAL_CHOICES,
  buildWeeklyGoalProgress,
  countSessionsInWeek,
  goalStatusLine,
  loadWeeklyGoal,
  loadWeeklyGoalProgress,
  normalizeWeeklyGoal,
  saveWeeklyGoal,
  startOfWeek,
} from "@/lib/goals";
import { SESSIONS_KEY } from "@/lib/storage";
import type { SessionRecord } from "@/types";

/* ── localStorage 스텁 ─────────────────────────────────── */

class MemoryStorage {
  private map = new Map<string, string>();
  /** setItem이 던지도록 만들 때 쓴다 (사생활 보호 모드·용량 초과 흉내) */
  failOnWrite = false;

  get length(): number {
    return this.map.size;
  }
  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    if (this.failOnWrite) throw new Error("QuotaExceededError");
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  clear(): void {
    this.map.clear();
  }
}

let store: MemoryStorage;

beforeEach(() => {
  store = new MemoryStorage();
  (globalThis as { window?: unknown }).window = { localStorage: store };
});

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

/* ── 표본 ─────────────────────────────────────────────── */

/**
 * 2026-08-24(월)이 이번 주의 시작인 주를 표본 주로 쓴다.
 * 8/23은 일요일이므로 지난주에 속한다 — 이 한 칸이 롤오버 검사의 전부다.
 */
const MONDAY = new Date(2026, 7, 24, 0, 0, 0, 0);
const SUNDAY_BEFORE = new Date(2026, 7, 23, 23, 59, 59, 999);

/** 로컬 시각으로 만든 ISO — 저장된 기록의 시각 칸은 언제나 ISO 문자열이다. */
function iso(year: number, month1: number, day: number, hour = 12, minute = 0): string {
  return new Date(year, month1 - 1, day, hour, minute, 0, 0).toISOString();
}

function makeRecord(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: `TEST-01-${overrides.endedAt ?? "x"}`,
    scenarioId: "TEST-01",
    scenarioTitle: "테스트 시나리오",
    typeLabel: "치매 행동심리증상",
    startedAt: iso(2026, 8, 24, 10, 0),
    endedAt: iso(2026, 8, 24, 10, 5),
    verdict: "충족",
    endingTitle: "충족 엔딩",
    greenChecks: [],
    coachingPoints: [],
    cfCount: 0,
    retriesUsed: 0,
    turnCount: 3,
    ...overrides,
  };
}

/** 세션 기록을 저장소에 직접 심는다 — 이 파일이 검증하는 것은 읽는 쪽이다. */
function seedSessions(records: SessionRecord[]): void {
  store.setItem(SESSIONS_KEY, JSON.stringify(records));
}

/* ── 주 경계 ───────────────────────────────────────────── */

describe("startOfWeek — 주 경계는 월요일 00:00", () => {
  it("주중 아무 시각이나 그 주의 월요일 0시로 내려온다", () => {
    const wednesday = new Date(2026, 7, 26, 21, 30, 0, 0);
    const start = startOfWeek(wednesday);
    expect(start.getTime()).toBe(MONDAY.getTime());
    expect(start.getDay()).toBe(1);
    expect(start.getHours()).toBe(0);
  });

  it("월요일 00:00은 자기 자신이다(경계가 한 주 앞으로 밀리지 않는다)", () => {
    expect(startOfWeek(MONDAY).getTime()).toBe(MONDAY.getTime());
  });

  it("일요일은 지난 월요일로 붙는다 — 일요일이 새 주를 열지 않는다", () => {
    const start = startOfWeek(SUNDAY_BEFORE);
    expect(start.getTime()).toBe(new Date(2026, 7, 17).getTime());
  });

  it("월 경계를 넘는 주도 이어진다(9/1 화요일 → 8/31 월요일)", () => {
    const tuesday = new Date(2026, 8, 1, 9, 0, 0, 0);
    expect(startOfWeek(tuesday).getTime()).toBe(new Date(2026, 7, 31).getTime());
  });
});

/* ── 완료 계산 ─────────────────────────────────────────── */

describe("countSessionsInWeek — 이번 주에 마친 회차", () => {
  const records = [
    makeRecord({ endedAt: iso(2026, 8, 24, 9, 0) }), // 월 (이번 주)
    makeRecord({ endedAt: iso(2026, 8, 26, 20, 0) }), // 수 (이번 주)
    makeRecord({ endedAt: iso(2026, 8, 23, 20, 0) }), // 일 (지난주)
    makeRecord({ endedAt: iso(2026, 8, 18, 20, 0) }), // 지난 화
  ];

  it("월요일 00:00부터 센다", () => {
    expect(countSessionsInWeek(records, new Date(2026, 7, 26, 23, 0))).toBe(2);
  });

  it("월요일 00:00 정각에 마친 회차는 이번 주로 센다(경계 포함)", () => {
    const onBoundary = [makeRecord({ endedAt: new Date(MONDAY).toISOString() })];
    expect(countSessionsInWeek(onBoundary, new Date(2026, 7, 25))).toBe(1);
  });

  it("일요일 23:59:59.999에 마친 회차는 지난주다(경계 배타)", () => {
    const justBefore = [makeRecord({ endedAt: new Date(SUNDAY_BEFORE).toISOString() })];
    expect(countSessionsInWeek(justBefore, new Date(2026, 7, 25))).toBe(0);
  });

  it("주가 넘어가면 같은 기록이 0회로 돌아간다(월요일 롤오버)", () => {
    const sunday = [makeRecord({ endedAt: iso(2026, 8, 23, 20, 0) })];
    // 그 일요일에 보면 이번 주 1회
    expect(countSessionsInWeek(sunday, new Date(2026, 7, 23, 22, 0))).toBe(1);
    // 하루 뒤 월요일 00:00에 보면 0회 — 지난주로 넘어갔다
    expect(countSessionsInWeek(sunday, MONDAY)).toBe(0);
  });

  it("마친 시각이 없으면 시작 시각으로 세고, 둘 다 읽지 못하면 세지 않는다", () => {
    const rows = [
      makeRecord({ endedAt: "", startedAt: iso(2026, 8, 25, 8, 0) }),
      makeRecord({ endedAt: "", startedAt: "" }),
      makeRecord({ endedAt: "언젠가", startedAt: "언젠가" }),
    ];
    expect(countSessionsInWeek(rows, new Date(2026, 7, 26))).toBe(1);
  });

  it("판정은 개수를 바꾸지 못한다 — 완주했으면 한 번이다", () => {
    const rows = [
      makeRecord({ endedAt: iso(2026, 8, 24, 9, 0), verdict: "충족" }),
      makeRecord({ endedAt: iso(2026, 8, 25, 9, 0), verdict: "재훈련 권고", cfCount: 2 }),
    ];
    expect(countSessionsInWeek(rows, new Date(2026, 7, 26))).toBe(2);
  });

  it("같은 입력이면 몇 번을 불러도 같은 값이다(결정론)", () => {
    const now = new Date(2026, 7, 26, 12, 0);
    const first = countSessionsInWeek(records, now);
    expect(countSessionsInWeek(records, now)).toBe(first);
    expect(countSessionsInWeek([...records].reverse(), now)).toBe(first);
  });
});

/* ── 목표값 정화·저장 ──────────────────────────────────── */

describe("주간 목표 저장", () => {
  it("정한 적이 없으면 주 3회다", () => {
    expect(loadWeeklyGoal()).toBe(DEFAULT_WEEKLY_GOAL);
    expect(DEFAULT_WEEKLY_GOAL).toBe(3);
  });

  it("저장한 값을 그대로 다시 읽는다", () => {
    expect(saveWeeklyGoal(5)).toBe(true);
    expect(loadWeeklyGoal()).toBe(5);
  });

  it("범위 밖 값은 버리지 않고 범위 안으로 당긴다", () => {
    expect(normalizeWeeklyGoal(0)).toBe(MIN_WEEKLY_GOAL);
    expect(normalizeWeeklyGoal(-4)).toBe(MIN_WEEKLY_GOAL);
    expect(normalizeWeeklyGoal(99)).toBe(MAX_WEEKLY_GOAL);
    expect(normalizeWeeklyGoal(3.9)).toBe(3);
    saveWeeklyGoal(12);
    expect(loadWeeklyGoal()).toBe(MAX_WEEKLY_GOAL);
  });

  it("숫자가 아닌 값은 기본값으로 내린다", () => {
    expect(normalizeWeeklyGoal("셋")).toBe(DEFAULT_WEEKLY_GOAL);
    expect(normalizeWeeklyGoal(Number.NaN)).toBe(DEFAULT_WEEKLY_GOAL);
    expect(normalizeWeeklyGoal(undefined)).toBe(DEFAULT_WEEKLY_GOAL);
  });

  it("훼손된 값이 남아 있어도 화면이 죽지 않는다", () => {
    store.setItem(GOAL_KEY, "{{{");
    expect(loadWeeklyGoal()).toBe(DEFAULT_WEEKLY_GOAL);
    store.setItem(GOAL_KEY, JSON.stringify({ perWeek: null }));
    expect(loadWeeklyGoal()).toBe(DEFAULT_WEEKLY_GOAL);
  });

  it("저장이 막힌 기기에서는 실패를 돌려준다(조용히 삼키지 않는다)", () => {
    store.failOnWrite = true;
    expect(saveWeeklyGoal(4)).toBe(false);
  });

  it("서버(SSR)에서는 기본값으로 동작하고 던지지 않는다", () => {
    delete (globalThis as { window?: unknown }).window;
    expect(loadWeeklyGoal()).toBe(DEFAULT_WEEKLY_GOAL);
    expect(saveWeeklyGoal(5)).toBe(false);
    expect(loadWeeklyGoalProgress(MONDAY).done).toBe(0);
  });

  it("화면이 그리는 선택지는 하한부터 상한까지 빠짐없이 있다", () => {
    expect(WEEKLY_GOAL_CHOICES).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(WEEKLY_GOAL_CHOICES[0]).toBe(MIN_WEEKLY_GOAL);
    expect(WEEKLY_GOAL_CHOICES[WEEKLY_GOAL_CHOICES.length - 1]).toBe(MAX_WEEKLY_GOAL);
  });
});

/* ── 사실 한 벌 ────────────────────────────────────────── */

describe("buildWeeklyGoalProgress", () => {
  const now = new Date(2026, 7, 26, 12, 0);

  it("남은 횟수는 목표에서 이번 주 회차를 뺀 값이다", () => {
    const rows = [makeRecord({ endedAt: iso(2026, 8, 24, 9, 0) })];
    const progress = buildWeeklyGoalProgress(rows, 3, now);
    expect(progress).toEqual({
      goal: 3,
      done: 1,
      remaining: 2,
      weekStartMs: MONDAY.getTime(),
      hasAnyRecord: true,
    });
  });

  it("목표를 넘겨도 남은 횟수는 음수가 되지 않는다", () => {
    const rows = [
      makeRecord({ endedAt: iso(2026, 8, 24, 9, 0) }),
      makeRecord({ endedAt: iso(2026, 8, 25, 9, 0) }),
    ];
    const progress = buildWeeklyGoalProgress(rows, 1, now);
    expect(progress.done).toBe(2);
    expect(progress.remaining).toBe(0);
  });

  it("기록이 지난주 것뿐이면 이번 주는 0회지만 「기록 있음」이다", () => {
    const rows = [makeRecord({ endedAt: iso(2026, 8, 18, 9, 0) })];
    const progress = buildWeeklyGoalProgress(rows, 3, now);
    expect(progress.done).toBe(0);
    expect(progress.hasAnyRecord).toBe(true);
  });

  it("범위 밖 목표를 받아도 사실 한 벌은 범위 안에서 나온다", () => {
    expect(buildWeeklyGoalProgress([], 0, now).goal).toBe(MIN_WEEKLY_GOAL);
    expect(buildWeeklyGoalProgress([], 40, now).goal).toBe(MAX_WEEKLY_GOAL);
  });

  it("저장소에서 읽어도 같은 값이 나온다(loadSessions 재사용 — 읽기만)", () => {
    const rows = [
      makeRecord({ id: "a", endedAt: iso(2026, 8, 24, 9, 0) }),
      makeRecord({ id: "b", endedAt: iso(2026, 8, 25, 9, 0) }),
      makeRecord({ id: "c", endedAt: iso(2026, 8, 23, 9, 0) }),
    ];
    seedSessions(rows);
    saveWeeklyGoal(4);

    const progress = loadWeeklyGoalProgress(now);
    expect(progress.goal).toBe(4);
    expect(progress.done).toBe(2);
    expect(progress.remaining).toBe(2);

    // 읽기만 한다 — 세션 기록은 한 글자도 달라지지 않는다.
    expect(JSON.parse(store.getItem(SESSIONS_KEY) as string)).toEqual(rows);
  });
});

/* ── 문장 ─────────────────────────────────────────────── */

describe("goalStatusLine — 미달을 꾸짖지 않는다", () => {
  const line = (done: number, goal: number, hasAnyRecord = true): string =>
    goalStatusLine({
      goal,
      done,
      remaining: Math.max(0, goal - done),
      weekStartMs: MONDAY.getTime(),
      hasAnyRecord,
    });

  it("한 번 남았으면 「한 번이면 목표입니다」", () => {
    expect(line(2, 3)).toBe("한 번이면 목표입니다.");
  });

  it("두 번 이상 남았으면 남은 횟수를 사실로 적는다", () => {
    expect(line(1, 3)).toBe("2번이면 목표입니다.");
  });

  it("0회인 주에도 문장이 나무라지 않는다", () => {
    expect(line(0, 3)).toBe("아직 이번 주가 남아 있습니다.");
  });

  it("아직 한 회차도 마치지 않은 분께는 설명으로 갈린다", () => {
    expect(line(0, 3, false)).toBe("첫 회차를 마치시면 여기에 쌓입니다.");
  });

  it("채웠거나 넘겼으면 그 사실만 적는다", () => {
    expect(line(3, 3)).toBe("이번 주 목표를 채우셨습니다.");
    expect(line(5, 3)).toBe("목표보다 2회 더 하셨습니다.");
  });

  it("어느 경우에도 점수·등급·순위 낱말을 만들지 않는다", () => {
    const forbidden = ["점수", "등급", "순위", "백분위", "달성률", "%"];
    for (let done = 0; done <= 9; done += 1) {
      for (const goal of WEEKLY_GOAL_CHOICES) {
        for (const seen of [true, false]) {
          const text = line(done, goal, seen);
          for (const word of forbidden) expect(text).not.toContain(word);
        }
      }
    }
  });
});
