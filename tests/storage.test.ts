/**
 * 로컬 저장소 왕복 검사 — src/lib/storage.ts
 *
 * 가장 지키고 싶은 것은 **발화 원문이 저장될 길이 없다**는 보증이다.
 * 체크포인트로 나가는 유일한 함수 toDecisions()가 utterance를 버리는데, 이건 주석이 아니라
 * 테스트로 못 박아야 하는 성질이다 — 필드 하나만 늘려도 조용히 새어 나가고, /safety의 논증 전체가 무너진다.
 *
 * 브라우저 환경(jsdom)을 끌어오지 않고 최소 localStorage 스텁만 심는다.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  PROGRESS_KEY,
  REPORTS_KEY,
  SAVE_FAILED_BODY,
  SAVE_FAILED_TITLE,
  SESSIONS_KEY,
  SESSION_SAVE_FAILED_BODY,
  STORAGE_BLOCKED_NOTICE,
  canWriteStorage,
  clearAllProgress,
  clearProgress,
  clearReports,
  clearSessions,
  deleteReport,
  deleteSession,
  loadAllProgress,
  loadProgress,
  loadReports,
  loadSessions,
  progressStepCount,
  saveProgress,
  saveReport,
  saveSession,
} from "@/lib/storage";
import type { RecordDraft, SessionRecord, SessionState } from "@/types";

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

function makeRecord(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: "TEST-01-1700000000000-0",
    scenarioId: "TEST-01",
    scenarioTitle: "테스트 시나리오",
    typeLabel: "치매 행동심리증상",
    startedAt: "2026-08-06T00:00:00.000Z",
    endedAt: "2026-08-06T00:05:00.000Z",
    verdict: "충족",
    endingTitle: "충족 엔딩",
    greenChecks: ["감정을 먼저 알아주셨습니다."],
    coachingPoints: [],
    cfCount: 0,
    retriesUsed: 0,
    turnCount: 3,
    ...overrides,
  };
}

const SECRET = "어르신 손목을 붙잡고 못 나가시게 하겠습니다";

function makeState(overrides: Partial<SessionState> = {}): SessionState {
  return {
    scenarioId: "TEST-01",
    currentTurnId: "T2",
    gauge: 1,
    status: "running",
    events: [
      {
        turnId: "T1",
        cueId: "CUE-1",
        utterance: SECRET,
        viaButton: false,
        feedback: {
          branchId: "b-ok",
          branchLabel: "감정 인정형",
          ok: true,
          criticalFail: false,
          message: "감정을 먼저 알아주셨습니다.",
          gaugeDelta: 0,
          rubricHits: [{ itemId: "RE-01", score: 4 }],
        },
        at: 1700000000000,
      },
    ],
    scores: { "RE-01": 4 },
    cfCount: 0,
    retrainAdvice: false,
    retriesUsed: 0,
    startedAt: 1700000000000,
    ...overrides,
  };
}

/* ── 검사 ─────────────────────────────────────────────── */

describe("훈련 세션 왕복", () => {
  it("저장한 기록을 그대로 되읽는다", () => {
    const record = makeRecord();
    saveSession(record);
    expect(loadSessions()).toEqual([record]);
  });

  it("최신이 앞에 오고, 같은 id는 덮어쓴다", () => {
    saveSession(makeRecord({ id: "a" }));
    saveSession(makeRecord({ id: "b" }));
    saveSession(makeRecord({ id: "a", verdict: "재훈련" }));
    const rows = loadSessions();
    expect(rows.map((r) => r.id)).toEqual(["a", "b"]);
    expect(rows[0]?.verdict).toBe("재훈련");
  });

  it("삭제·전체 삭제가 동작한다", () => {
    saveSession(makeRecord({ id: "a" }));
    saveSession(makeRecord({ id: "b" }));
    deleteSession("a");
    expect(loadSessions().map((r) => r.id)).toEqual(["b"]);
    clearSessions();
    expect(loadSessions()).toEqual([]);
  });

  it("형식이 깨진 항목은 걸러 낸다", () => {
    store.setItem(SESSIONS_KEY, JSON.stringify([{ id: 1 }, null, makeRecord()]));
    expect(loadSessions()).toHaveLength(1);
  });

  it("저장소에 배열이 아닌 값이 들어 있어도 빈 목록으로 버틴다", () => {
    store.setItem(SESSIONS_KEY, "깨진 JSON");
    expect(loadSessions()).toEqual([]);
    store.setItem(SESSIONS_KEY, JSON.stringify({ not: "array" }));
    expect(loadSessions()).toEqual([]);
  });

  it("최근 50건만 남긴다", () => {
    for (let i = 0; i < 55; i += 1) saveSession(makeRecord({ id: `r-${i}` }));
    const rows = loadSessions();
    expect(rows).toHaveLength(50);
    expect(rows[0]?.id).toBe("r-54");
    expect(rows.some((r) => r.id === "r-0")).toBe(false);
  });
});

describe("보고 기록 왕복", () => {
  const draft: RecordDraft = {
    time: "2026-08-06 09:00",
    who: "[대상자]",
    what: "식사 중 사레가 있었습니다.",
    action: "식사를 멈추고 기침을 격려했습니다.",
    status: "호전되어 관찰을 이어갔습니다.",
    missing: [],
  };

  it("id·시각을 붙여 저장하고 되읽는다", () => {
    // persisted는 반환값에만 있는 칸이다(저장되는 몸통에는 없다) — 여기서 떼어 내고 비교한다.
    const { persisted, ...stored } = saveReport({
      maskedText: "[대상자]께서 사레가 있으셨습니다.",
      draft,
    });
    expect(persisted).toBe(true);
    expect(stored.id).toMatch(/^report-/);
    expect(stored.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(loadReports()).toEqual([stored]);
  });

  it("같은 id로 다시 저장하면 덮어쓴다", () => {
    saveReport({ id: "fixed", maskedText: "첫 번째", draft });
    saveReport({ id: "fixed", maskedText: "두 번째", draft });
    expect(loadReports()).toHaveLength(1);
    expect(loadReports()[0]?.maskedText).toBe("두 번째");
  });

  it("삭제·전체 삭제가 동작한다", () => {
    const a = saveReport({ maskedText: "가", draft });
    saveReport({ maskedText: "나", draft });
    deleteReport(a.id);
    expect(loadReports()).toHaveLength(1);
    clearReports();
    expect(loadReports()).toEqual([]);
  });

  it("maskedText가 없는 항목은 걸러 낸다", () => {
    store.setItem(REPORTS_KEY, JSON.stringify([{ id: "x" }, { id: "y", maskedText: "가" }]));
    expect(loadReports().map((r) => r.id)).toEqual(["y"]);
  });
});

describe("체크포인트 — 발화 원문은 저장될 길이 없다", () => {
  it("saveProgress가 남기는 것은 분기 id·게이지·횟수뿐이다", () => {
    const progress = saveProgress(makeState());
    expect(progress?.decisions).toEqual([
      { turnId: "T1", cueId: "CUE-1", branchId: "b-ok", viaButton: false },
    ]);
  });

  it("저장소 원문 어디에도 발화가 남지 않는다", () => {
    saveProgress(makeState());
    const raw = store.getItem(PROGRESS_KEY) ?? "";
    expect(raw.length).toBeGreaterThan(0);
    expect(raw).not.toContain(SECRET);
    expect(raw).not.toContain("utterance");
  });

  it("어느 저장 경로에도 발화가 새지 않는다", () => {
    saveProgress(makeState());
    saveSession(makeRecord());
    saveReport({
      maskedText: "[대상자]께 안내했습니다.",
      draft: { time: "", who: "", what: "", action: "", status: "", missing: [] },
    });
    for (const key of [PROGRESS_KEY, SESSIONS_KEY, REPORTS_KEY]) {
      expect(store.getItem(key) ?? "").not.toContain(SECRET);
    }
  });

  it("시나리오당 한 건만 남기고 덮어쓴다", () => {
    saveProgress(makeState({ gauge: 1 }));
    saveProgress(makeState({ gauge: 3 }));
    saveProgress(makeState({ scenarioId: "TEST-02" }));
    expect(loadAllProgress()).toHaveLength(2);
    expect(loadProgress("TEST-01")?.gauge).toBe(3);
  });

  it("id 조회는 대소문자를 가리지 않는다", () => {
    saveProgress(makeState());
    expect(loadProgress("test-01")?.scenarioId).toBe("TEST-01");
  });

  it("끝난 세션은 체크포인트를 남기지 않고 지운다", () => {
    saveProgress(makeState());
    expect(saveProgress(makeState({ status: "ended" }))).toBeUndefined();
    expect(loadAllProgress()).toEqual([]);
  });

  it("한 턴도 진행하지 않았으면 저장하지 않는다", () => {
    expect(saveProgress(makeState({ events: [] }))).toBeUndefined();
  });

  it("미분류 분기(__none)는 결정으로 세지 않는다", () => {
    const state = makeState();
    const event = state.events[0]!;
    expect(
      saveProgress({
        ...state,
        events: [{ ...event, feedback: { ...event.feedback!, branchId: "__none" } }],
      }),
    ).toBeUndefined();
  });

  it("삭제·전체 삭제가 동작한다", () => {
    saveProgress(makeState());
    saveProgress(makeState({ scenarioId: "TEST-02" }));
    clearProgress("test-01");
    expect(loadAllProgress().map((p) => p.scenarioId)).toEqual(["TEST-02"]);
    clearAllProgress();
    expect(loadAllProgress()).toEqual([]);
  });

  it("훼손된 체크포인트는 화이트리스트로 걸러 낸다", () => {
    store.setItem(
      PROGRESS_KEY,
      JSON.stringify([
        { scenarioId: "TEST-01", status: "running", decisions: [{ branchId: "b-ok" }], 몰래: "낀 값" },
        { scenarioId: "TEST-02", status: "ended", decisions: [{ branchId: "b-ok" }] },
        { status: "running", decisions: [{ branchId: "b-ok" }] },
      ]),
    );
    const rows = loadAllProgress();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      scenarioId: "TEST-01",
      savedAt: "",
      decisions: [{ turnId: "", branchId: "b-ok", viaButton: false }],
      gauge: 0,
      cfCount: 0,
      retriesUsed: 0,
      status: "running",
    });
  });

  it("진행 위치는 같은 턴의 재시도를 한 번으로 센다", () => {
    const progress = saveProgress(
      makeState({
        events: [
          makeState().events[0]!,
          { ...makeState().events[0]!, turnId: "T1" },
          { ...makeState().events[0]!, turnId: "T2" },
        ],
      }),
    );
    expect(progress).toBeDefined();
    expect(progressStepCount(progress!)).toBe(2);
  });
});

describe("환경이 없거나 저장에 실패해도 화면을 죽이지 않는다", () => {
  it("서버 렌더링(window 없음)에서는 빈 값으로 동작한다", () => {
    delete (globalThis as { window?: unknown }).window;
    expect(loadSessions()).toEqual([]);
    expect(loadReports()).toEqual([]);
    expect(loadAllProgress()).toEqual([]);
    expect(() => saveSession(makeRecord())).not.toThrow();
  });

  it("저장 실패는 예외를 밖으로 던지지 않는다", () => {
    store.failOnWrite = true;
    expect(() => saveSession(makeRecord())).not.toThrow();
    store.failOnWrite = false;
    expect(loadSessions()).toEqual([]);
  });
});

/**
 * 저장 실패가 **무음이면 안 된다**는 것이 이 묶음의 요지다.
 * 예외를 던지지 않는 것과 실패를 숨기는 것은 다르다 — 화면이 「확정했습니다 · 이 기기에만 저장」을
 * 띄우는 동안 아무것도 남지 않는 상태를, 반환값 하나로 갈라낸다.
 */
describe("저장 실패를 호출부가 알 수 있다", () => {
  const draft: RecordDraft = { time: "", who: "", what: "", action: "", status: "", missing: [] };

  it("성공하면 true·persisted true", () => {
    expect(saveSession(makeRecord())).toBe(true);
    expect(saveReport({ maskedText: "[대상자] 기록", draft }).persisted).toBe(true);
  });

  it("쓰기가 막히면 false를 돌려준다 — 화면이 성공을 말하지 않도록", () => {
    store.failOnWrite = true;
    expect(saveSession(makeRecord())).toBe(false);
    expect(saveReport({ maskedText: "[대상자] 기록", draft }).persisted).toBe(false);
    store.failOnWrite = false;
  });

  it("저장소가 아예 없는 환경(서버 렌더링)에서도 false다", () => {
    delete (globalThis as { window?: unknown }).window;
    expect(saveSession(makeRecord())).toBe(false);
    expect(saveReport({ maskedText: "가", draft }).persisted).toBe(false);
    expect(canWriteStorage()).toBe(false);
  });

  it("쓰기 가능 여부를 재는 프로브는 앱 데이터 키를 건드리지 않는다", () => {
    saveSession(makeRecord());
    expect(canWriteStorage()).toBe(true);
    expect(loadSessions()).toHaveLength(1);
    store.failOnWrite = true;
    expect(canWriteStorage()).toBe(false);
    store.failOnWrite = false;
  });

  it("실패 문구는 무엇이 막혔는지 사실대로 적고 성공을 말하지 않는다", () => {
    for (const text of [SAVE_FAILED_TITLE, SAVE_FAILED_BODY, SESSION_SAVE_FAILED_BODY, STORAGE_BLOCKED_NOTICE]) {
      expect(text.length).toBeGreaterThan(0);
      expect(text).not.toContain("저장했습니다");
    }
    expect(SAVE_FAILED_TITLE).toContain("저장하지 못했습니다");
  });
});

/**
 * 훼손된 레코드 하나가 화면 전체를 죽이지 않는다.
 * 이수 누계가 이미 쓰던 정화 규율(sanitizeTallyLine)을 세션·보고까지 넓힌 자리다.
 */
describe("스키마 정화 — 깨진 레코드만 버리고 나머지는 살린다", () => {
  it("배열·숫자 필드가 없는 옛 기록도 빈 값으로 낮춰 살린다", () => {
    store.setItem(
      SESSIONS_KEY,
      JSON.stringify([
        {
          id: "old-1",
          scenarioId: "TEST-01",
          verdict: "충족",
          // greenChecks·coachingPoints·cfCount·turnCount가 통째로 없는 옛 형식
        },
      ]),
    );
    const rows = loadSessions();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      id: "old-1",
      scenarioId: "TEST-01",
      scenarioTitle: "TEST-01",
      typeLabel: "",
      startedAt: "",
      endedAt: "",
      verdict: "충족",
      endingTitle: "",
      greenChecks: [],
      coachingPoints: [],
      cfCount: 0,
      retriesUsed: 0,
      turnCount: 0,
    });
  });

  it("배열 자리에 배열이 아닌 값이 들어 있어도 화면이 읽을 수 있는 모양으로 준다", () => {
    store.setItem(
      SESSIONS_KEY,
      JSON.stringify([
        { ...makeRecord(), greenChecks: "문자열", coachingPoints: [1, "코칭", null], turnCount: "셋" },
      ]),
    );
    const row = loadSessions()[0];
    expect(row?.greenChecks).toEqual([]);
    expect(row?.coachingPoints).toEqual(["코칭"]);
    expect(row?.turnCount).toBe(0);
  });

  it("판정값이 알려진 다섯 밖이면 그 레코드만 버린다", () => {
    store.setItem(
      SESSIONS_KEY,
      JSON.stringify([{ ...makeRecord(), id: "bad", verdict: "S등급" }, makeRecord()]),
    );
    expect(loadSessions().map((r) => r.id)).toEqual([makeRecord().id]);
  });

  it("훼손된 한 건이 있어도 나머지 목록은 그대로 남는다", () => {
    store.setItem(
      SESSIONS_KEY,
      JSON.stringify([{ id: "", scenarioId: "TEST-01" }, null, "문자열", makeRecord()]),
    );
    expect(loadSessions()).toHaveLength(1);
  });

  it("보고 기록의 5칸 초안이 깨져 있어도 빈칸으로 살린다", () => {
    store.setItem(
      REPORTS_KEY,
      JSON.stringify([
        { id: "r1", maskedText: "[대상자] 기록", draft: null, maskedCounts: { 성명: "둘" } },
        { id: "r2", maskedText: 42 },
      ]),
    );
    const rows = loadReports();
    expect(rows.map((r) => r.id)).toEqual(["r1"]);
    expect(rows[0]?.draft).toEqual({
      time: "",
      who: "",
      what: "",
      action: "",
      status: "",
      missing: [],
    });
    expect(rows[0]?.maskedCounts).toEqual({});
  });

  it("정상 기록은 저장한 그대로 되읽힌다(정화가 값을 바꾸지 않는다)", () => {
    const record = makeRecord({ greenChecks: ["가"], coachingPoints: ["나"], cfCount: 1 });
    saveSession(record);
    expect(loadSessions()).toEqual([record]);
  });
});
