/**
 * 시연용 예시 기록 — src/lib/demoSeed.ts
 *
 * 이 파일이 지키는 것은 편의가 아니라 **정직성**이다.
 * 예시가 진짜 증빙으로 오인되면 기관 신뢰가 무너지므로, 다음 세 가지를 코드가 아니라 검사로 못 박는다.
 *
 * 1) 심어도 **이수 누계(tally)가 한 칸도 움직이지 않는다** — 확인서의 합계·총 이수 시수가 예시로 부풀지 않는다.
 * 2) 지우기는 `demo-` 레코드만 지운다 — 같은 기기에 쌓인 **진짜 기록은 불변**이다.
 * 3) 심기 → 지우기 왕복 뒤 이수 사실 요약이 심기 전 값으로 정확히 돌아온다.
 *
 * storage.test.ts와 같은 방식으로 localStorage 최소 스텁만 심는다(jsdom 없음).
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEMO_ID_PREFIX,
  clearDemoRecords,
  countDemoRecords,
  demoSeededAt,
  hasDemoRecords,
  isDemoRecord,
  seedDemoRecords,
} from "@/lib/demoSeed";
import {
  buildCompletionSummary,
  clearReports,
  clearSessions,
  loadCompletionTally,
  loadReports,
  loadSessions,
  saveReport,
  saveSession,
} from "@/lib/storage";
import type { RecordDraft, SessionRecord } from "@/types";

/* ── localStorage 스텁 ─────────────────────────────────── */

class MemoryStorage {
  private map = new Map<string, string>();

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

/** 시드 날짜 계산이 실행 시각에 흔들리지 않도록 고정 기준 시각을 쓴다. */
const NOW = new Date("2026-08-06T09:00:00.000Z");

function makeRealRecord(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: "CHK-A01-1700000000000-0",
    scenarioId: "CHK-A01",
    scenarioTitle: "현관 앞, 집에 가야 해요",
    typeLabel: "치매 행동심리증상(BPSD)",
    startedAt: "2026-08-05T00:00:00.000Z",
    endedAt: "2026-08-05T00:06:00.000Z",
    verdict: "충족",
    endingTitle: "안전하게 마무리하셨습니다",
    greenChecks: ["집에 가고 싶은 마음을 먼저 알아주셨습니다."],
    coachingPoints: [],
    cfCount: 0,
    retriesUsed: 0,
    turnCount: 7,
    ...overrides,
  };
}

const DRAFT: RecordDraft = {
  time: "09:00",
  who: "[대상자]",
  what: "식사 중 사레",
  action: "식사 중단",
  status: "안정",
  missing: [],
};

/* ── 검사 ─────────────────────────────────────────────── */

describe("심기 → 지우기 왕복", () => {
  it("예시 회차 3종과 확정 보고 1건을 심고, 전부 demo- 접두사로 식별된다", () => {
    const planted = seedDemoRecords(NOW);

    expect(planted.sessions).toHaveLength(3);
    expect(planted.reports).toHaveLength(1);
    expect(planted.skipped).toBe(0);
    expect(planted.sessions.every((r) => r.id.startsWith(DEMO_ID_PREFIX))).toBe(true);
    expect(planted.reports.every((r) => r.id.startsWith(DEMO_ID_PREFIX))).toBe(true);

    // 3종을 한 번씩 — 유형별 커버리지가 세 칸 차고 한 칸이 남는 구성이어야 한다.
    expect(planted.sessions.map((r) => r.scenarioId).sort()).toEqual([
      "CHK-A01",
      "CHK-B02",
      "CHK-C01",
    ]);

    expect(hasDemoRecords()).toBe(true);
    expect(countDemoRecords()).toEqual({ sessions: 3, reports: 1, total: 4 });
    expect(demoSeededAt()).toBe(NOW.toISOString());
  });

  it("완주 시각이 현실적이다 — 시작이 끝보다 앞서고 회차당 3~10분이다", () => {
    for (const record of seedDemoRecords(NOW).sessions) {
      const sec = (new Date(record.endedAt).getTime() - new Date(record.startedAt).getTime()) / 1000;
      expect(sec).toBeGreaterThanOrEqual(180);
      expect(sec).toBeLessThanOrEqual(600);
      expect(new Date(record.endedAt).getTime()).toBeLessThan(NOW.getTime());
      // 턴 수는 남은 문장 수와 어긋나면 안 된다(실주행과 같은 셈).
      expect(record.turnCount).toBe(record.greenChecks.length + record.coachingPoints.length);
    }
  });

  it("여러 번 심어도 늘어나지 않는다 (같은 id로 덮어쓴다)", () => {
    seedDemoRecords(NOW);
    seedDemoRecords(NOW);
    seedDemoRecords(NOW);
    expect(countDemoRecords()).toEqual({ sessions: 3, reports: 1, total: 4 });
  });

  it("지우면 예시가 하나도 남지 않는다", () => {
    seedDemoRecords(NOW);
    const removed = clearDemoRecords();
    expect(removed).toEqual({ sessions: 3, reports: 1 });
    expect(hasDemoRecords()).toBe(false);
    expect(countDemoRecords().total).toBe(0);
    expect(demoSeededAt()).toBeUndefined();
    expect(loadSessions()).toEqual([]);
    expect(loadReports()).toEqual([]);
  });

  it("심은 적 없이 지워도 조용히 0을 돌려준다", () => {
    expect(clearDemoRecords()).toEqual({ sessions: 0, reports: 0 });
  });
});

describe("이수 누계는 예시로 움직이지 않는다", () => {
  it("빈 기기에 심어도 누계는 0회 0초 그대로다", () => {
    seedDemoRecords(NOW);
    const tally = loadCompletionTally();
    expect(tally.count).toBe(0);
    expect(tally.seconds).toBe(0);
    expect(tally.lines).toEqual([]);
    expect(tally.countedIds).toEqual([]);
  });

  it("진짜 기록이 있는 기기에 심어도 누계가 바뀌지 않는다", () => {
    saveSession(makeRealRecord());
    const before = loadCompletionTally();

    seedDemoRecords(NOW);
    expect(loadCompletionTally()).toEqual(before);

    clearDemoRecords();
    expect(loadCompletionTally()).toEqual(before);
  });

  it("심기 → 지우기 뒤 이수 사실 요약(발급번호 포함)이 심기 전 값으로 돌아온다", () => {
    saveSession(makeRealRecord());
    const before = buildCompletionSummary();

    seedDemoRecords(NOW);
    // 예시가 있는 동안에는 화면에 보이는 합계가 늘어난다 — 그래서 확인서가 「예시 미리보기」가 된다.
    expect(buildCompletionSummary().totalCount).toBe(before.totalCount + 3);

    clearDemoRecords();
    expect(buildCompletionSummary()).toEqual(before);
  });
});

describe("실기록 보존", () => {
  it("지우기는 예시만 지우고 진짜 기록·보고는 그대로 둔다", () => {
    saveSession(makeRealRecord({ id: "real-a" }));
    saveSession(makeRealRecord({ id: "real-b", scenarioId: "CHK-C01" }));
    // saveReport의 반환값에는 성공 여부(persisted) 한 칸이 더 붙는다 — 저장되는 것은 그 칸을 뺀 몸통이다.
    const { persisted, ...realReport } = saveReport({
      id: "real-report",
      maskedText: "[대상자] 기록",
      draft: DRAFT,
    });
    expect(persisted).toBe(true);

    seedDemoRecords(NOW);
    expect(loadSessions()).toHaveLength(5);
    expect(loadReports()).toHaveLength(2);

    clearDemoRecords();
    const sessions = loadSessions();
    expect(sessions.map((r) => r.id).sort()).toEqual(["real-a", "real-b"]);
    expect(sessions.some(isDemoRecord)).toBe(false);
    expect(loadReports()).toEqual([realReport]);
  });

  it("저장 상한(50건)이 찬 기기에서는 예시를 심지 않는다 — 진짜 기록을 밀어내지 않는다", () => {
    for (let i = 0; i < 50; i += 1) saveSession(makeRealRecord({ id: `real-${i}` }));
    const before = loadSessions();

    const planted = seedDemoRecords(NOW);
    expect(planted.sessions).toHaveLength(0);
    expect(planted.skipped).toBeGreaterThan(0);
    expect(loadSessions()).toEqual(before);
    expect(loadSessions()).toHaveLength(50);
  });

  it("사용자가 전체 기록을 지우면 예시도 함께 사라지고, 화면은 예시가 없다고 답한다", () => {
    seedDemoRecords(NOW);
    // 성장 기록의 「이 기기의 기록 지우기」와 같은 경로다.
    clearSessions();
    clearReports();
    // 쪽지(플래그)는 남아 있어도 판단 근거는 저장된 레코드다 — 없는 것을 있다고 말하지 않는다.
    expect(countDemoRecords()).toEqual({ sessions: 0, reports: 0, total: 0 });
    expect(hasDemoRecords()).toBe(false);
    expect(demoSeededAt()).toBeUndefined();
  });
});

describe("환경이 없어도 화면을 죽이지 않는다", () => {
  it("서버 렌더링(window 없음)에서는 조용히 빈 값으로 동작한다", () => {
    delete (globalThis as { window?: unknown }).window;
    expect(() => seedDemoRecords(NOW)).not.toThrow();
    expect(hasDemoRecords()).toBe(false);
    expect(clearDemoRecords()).toEqual({ sessions: 0, reports: 0 });
  });
});
