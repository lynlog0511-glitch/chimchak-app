/**
 * 훈련 세션 리듀서 회귀 검사 — src/app/train/_components/sessionMachine.ts
 *
 * 무대에서 밟는 동선이 전부 이 리듀서 안에 있다: 시작 → 턴 진행 → ⚑CF 중단과 복귀 →
 * L3 인계와 복귀 → 이어서 하기 복원 → 엔딩, 그리고 발표용 빨리감기 3종.
 * 여기가 깨져도 타입 검사와 엔진 테스트는 녹색이라, 발견 지점이 발표장이 된다.
 *
 * 리듀서는 순수 함수이고 외부 부수효과가 없어(저장은 화면 쪽 효과가 한다) node 환경에서
 * 그대로 돌린다 — 새 의존성도 localStorage 스텁도 필요하지 않다.
 *
 * 가장 지키고 싶은 보증 둘
 *  ① **화면은 대사를 지어내지 않는다** — 로그에 실리는 인물 대사는 시나리오 데이터의 문장뿐이다.
 *  ② **되살린 턴은 되살렸다고 말한다** — 발화 원문을 저장하지 않으므로, 복원된 자리는
 *    보기 문구가 아니라 대체 표기로 남고 기록 초안은 다시 만들지 않는다.
 */

import { describe, expect, it } from "vitest";
import { CHK_A01, CHK_B02, SCENARIOS } from "@/data/scenarios";
import { currentTurn, protocolIdOf } from "@/engine";
import type { BranchDef, CueDef, Scenario } from "@/types";
import type { ProgressDecision, SessionProgress } from "@/lib/storage";
import {
  DEMO_LOG_BANNER,
  RESTORED_LOG_NOTICE,
  RESTORED_LOG_NOTICE_PARTIAL,
  RESTORED_UTTERANCE,
  RESUMED_AT_CF_NOTICE,
  initialTrainState,
  makeTrainReducer,
  parseDemoPreset,
  type LogItem,
  type TrainAction,
  type TrainState,
} from "@/app/train/_components/sessionMachine";
import { PROTOCOL_HANDOFF_TITLE } from "@/app/train/_components/constants";

/* ── 도우미 ───────────────────────────────────────────── */

type Reduce = (state: TrainState, action: TrainAction) => TrainState;

function machine(scenario: Scenario): { reduce: Reduce; started: TrainState } {
  const reduce = makeTrainReducer(scenario);
  return { reduce, started: reduce(initialTrainState(scenario), { type: "start" }) };
}

/** 자동 재생이 고르는 것과 같은 원칙 — ⚑CF·재훈련 권고 분기는 지나가지 않고, 게이지를 덜 올리는 쪽을 고른다. */
function safeBranch(cue: CueDef): BranchDef {
  const pool = cue.branches.filter((b) => b.criticalFail !== true && b.retrainAdvice !== true);
  const list = pool.length > 0 ? pool : cue.branches;
  let best = list[0] as BranchDef;
  for (const branch of list) {
    if (branch.gaugeDelta < best.gaugeDelta) best = branch;
  }
  return best;
}

function cueOf(scenario: Scenario, state: TrainState): CueDef | undefined {
  return currentTurn(scenario, state.session)?.cue;
}

/** 분기를 고르는 방식만 바꿔 끼우며 세션을 끝까지(또는 멈출 때까지) 굴린다. */
function play(
  scenario: Scenario,
  from: TrainState,
  reduce: Reduce,
  pick: (cue: CueDef) => BranchDef | undefined,
  options: { stopAtInterrupt?: boolean; stopAtProtocol?: boolean; maxTurns?: number } = {},
): TrainState {
  let next = from;
  const limit = options.maxTurns ?? 60;
  for (let guard = 0; guard < limit; guard += 1) {
    if (next.phase === "ended") break;
    if (next.session.status === "interrupted") {
      if (options.stopAtInterrupt) break;
      next = reduce(next, { type: "retryAfterCritical" });
      continue;
    }
    if (next.session.status === "protocol") {
      if (options.stopAtProtocol) break;
      next = reduce(next, { type: "protocolDone" });
      continue;
    }
    const cue = cueOf(scenario, next);
    if (!cue) break;
    const branch = pick(cue);
    if (!branch) break;
    const after = reduce(next, {
      type: "submit",
      input: { branchId: branch.id, viaButton: true },
    });
    if (after === next) break;
    next = after;
  }
  return next;
}

/** 데이터에 실제로 적혀 있는 문장 전체 — 화면이 대사를 지어내지 않았는지 대조하는 표다. */
function scriptedLines(scenario: Scenario): Set<string> {
  const out = new Set<string>();
  for (const turn of scenario.turns) {
    out.add(turn.text);
    for (const branch of turn.cue?.branches ?? []) {
      if (branch.aiReaction.trim().length > 0) out.add(branch.aiReaction);
    }
  }
  return out;
}

function noticeTexts(log: LogItem[]): string[] {
  return log.filter((item) => item.kind === "notice").map((item) => item.text);
}

/* ── 1. 다섯 시나리오 완주 ─────────────────────────────── */

describe("다섯 시나리오를 버튼만으로 완주한다", () => {
  for (const scenario of SCENARIOS) {
    it(`${scenario.id} — 엔딩까지 도달하고 대사는 데이터의 문장뿐이다`, () => {
      const { reduce, started } = machine(scenario);
      expect(started.phase).toBe("session");
      expect(started.log.length).toBeGreaterThan(0);

      const ended = play(scenario, started, reduce, safeBranch);

      expect(ended.phase).toBe("ended");
      expect(ended.session.status).toBe("ended");
      // ⚑CF 분기를 고르지 않았으므로 멈춰 세워질 일이 없다.
      expect(ended.session.cfCount).toBe(0);
      expect(ended.critical).toBeNull();

      const scripted = scriptedLines(scenario);
      const spoken = ended.log.filter((item) => item.kind === "line");
      expect(spoken.length).toBeGreaterThan(0);
      for (const line of spoken) {
        expect(scripted.has(line.text)).toBe(true);
      }
    });
  }

  it("브리핑 상태에서는 아직 로그가 없다", () => {
    const initial = initialTrainState(CHK_A01);
    expect(initial.phase).toBe("briefing");
    expect(initial.log).toEqual([]);
    expect(initial.session.status).toBe("running");
  });

  it("「처음부터」는 로그와 게이지 표시를 초기 상태로 되돌린다", () => {
    const { reduce, started } = machine(CHK_A01);
    const played = play(CHK_A01, started, reduce, safeBranch, { maxTurns: 2 });
    const again = reduce(played, { type: "restart" });
    expect(again.log.length).toBeLessThan(played.log.length + 1);
    expect(again.seq).toBeLessThanOrEqual(played.seq);
    expect(again.critical).toBeNull();
    expect(again.lastFeedback).toBeNull();
    expect(again.gaugeTick).toBe(0);
  });
});

/* ── 1-2. 미분류로 같은 자리에 머무를 때 (2026-08-25) ──── */

describe("미분류는 같은 자리에 머물고, 대사를 다시 읽지 않는다", () => {
  const opening = CHK_A01.turns.find((turn) => turn.id === "T1")?.text as string;
  const unclearReaction = CHK_A01.turns
    .find((turn) => turn.id === "T1")
    ?.cue?.branches.find((branch) => branch.id === "D1-n")?.aiReaction as string;

  function countLine(state: TrainState, text: string): number {
    return state.log.filter((item) => item.kind === "line" && item.text === text).length;
  }

  it("어르신 대사가 로그에 한 번만 남는다", () => {
    const { reduce, started } = machine(CHK_A01);
    expect(countLine(started, opening)).toBe(1);

    const after = reduce(started, {
      type: "submit",
      input: { utterance: "음…", viaButton: false },
    });

    expect(after.session.currentTurnId).toBe("T1");
    expect(countLine(after, opening)).toBe(1);
    // 되묻는 반응은 그대로 붙는다 — 그것이 이 자리의 대사다.
    expect(countLine(after, unclearReaction)).toBe(1);
    // 보기 버튼은 그대로 열려 있다.
    expect(cueOf(CHK_A01, after)?.branches.length).toBeGreaterThan(0);
  });

  it("여러 번 미분류가 이어져도 겹쳐 쌓이지 않는다", () => {
    const { reduce, started } = machine(CHK_A01);
    let next = started;
    for (let i = 0; i < 3; i += 1) {
      next = reduce(next, { type: "submit", input: { utterance: "음…", viaButton: false } });
    }
    expect(next.session.currentTurnId).toBe("T1");
    expect(countLine(next, opening)).toBe(1);
    expect(next.session.gauge).toBe(CHK_A01.gauge.start);

    // 그 다음 발화는 그대로 판정되고, 다음 장면의 대사가 이어진다.
    const answered = reduce(next, {
      type: "submit",
      input: { utterance: "애기 밥 챙겨주셔야 하는구나, 마음이 급하시겠어요", viaButton: false },
    });
    expect(answered.session.currentTurnId).toBe("T2");
    const t2 = CHK_A01.turns.find((turn) => turn.id === "T2")?.text as string;
    expect(countLine(answered, t2)).toBe(1);
  });
});

/* ── 2. ⚑CF 중단과 복귀 ───────────────────────────────── */

/** ⚑CF 분기가 있는 CUE를 만나면 그 분기를 고른다 — 없으면 안전 분기로 지나간다. */
function pickCritical(cue: CueDef): BranchDef {
  return cue.branches.find((b) => b.criticalFail === true) ?? safeBranch(cue);
}

describe("⚑CF — 멈춰 세우고, 같은 자리에서 점수 없이 다시 한다", () => {
  it("전면 인터럽트가 열리고 대안이 함께 온다", () => {
    const { reduce, started } = machine(CHK_A01);
    const stopped = play(CHK_A01, started, reduce, pickCritical, { stopAtInterrupt: true });

    expect(stopped.session.status).toBe("interrupted");
    expect(stopped.critical).not.toBeNull();
    expect(stopped.critical?.feedback.criticalFail).toBe(true);
    expect(stopped.critical?.feedback.message.trim().length).toBeGreaterThan(0);
    expect(stopped.critical?.alternatives.length).toBeGreaterThan(0);
    expect(stopped.session.cfCount).toBe(1);

    // 왜 멈췄는지는 모달이 닫힌 뒤에도 남아야 한다 — 피드백 항목이 로그에 들어간다.
    const feedbacks = stopped.log.filter((item) => item.kind === "feedback");
    expect(feedbacks.length).toBeGreaterThan(0);
  });

  it("대안을 고르면 그 문구가 로그에 남고 같은 CUE로 돌아온다", () => {
    const { reduce, started } = machine(CHK_A01);
    const stopped = play(CHK_A01, started, reduce, pickCritical, { stopAtInterrupt: true });
    const at = stopped.session.currentTurnId;
    const alternative = stopped.critical?.alternatives[0] as string;

    const again = reduce(stopped, { type: "retryAfterCritical", alternative });

    expect(again.critical).toBeNull();
    expect(again.lastFeedback).toBeNull();
    expect(again.session.status).toBe("running");
    // 같은 자리다 — 다음 턴으로 밀려나지 않는다.
    expect(again.session.currentTurnId).toBe(at);
    const last = again.log[again.log.length - 1];
    expect(last?.kind).toBe("notice");
    expect(last?.kind === "notice" && last.text).toContain(alternative);
    expect(last?.kind === "notice" && last.text).toContain("점수는 매기지 않습니다");
  });

  it("대안 없이 다시 하기도 같은 자리로 돌아온다", () => {
    const { reduce, started } = machine(CHK_A01);
    const stopped = play(CHK_A01, started, reduce, pickCritical, { stopAtInterrupt: true });
    const again = reduce(stopped, { type: "retryAfterCritical" });
    expect(noticeTexts(again.log).some((t) => t.includes("점수는 매기지 않습니다"))).toBe(true);
    expect(again.session.status).toBe("running");
  });

  it("멈춘 상태가 아니면 「다시 하기」는 아무 일도 하지 않는다", () => {
    const { reduce, started } = machine(CHK_A01);
    expect(reduce(started, { type: "retryAfterCritical" })).toBe(started);
  });

  it("⚑CF를 지나온 세션도 끝까지 간다 — ⚑CF 횟수는 사실대로 남는다", () => {
    const { reduce, started } = machine(CHK_A01);
    const stopped = play(CHK_A01, started, reduce, pickCritical, { stopAtInterrupt: true });
    const ended = play(CHK_A01, stopped, reduce, safeBranch);
    expect(ended.phase).toBe("ended");
    expect(ended.session.cfCount).toBeGreaterThanOrEqual(1);
  });
});

/* ── 3. L3 전환 ───────────────────────────────────────── */

/** 응급 프로토콜로 넘어가는 분기가 있으면 그쪽을 고른다. */
function pickProtocol(cue: CueDef): BranchDef {
  return cue.branches.find((b) => b.next.startsWith("protocol:")) ?? safeBranch(cue);
}

describe("L3 전환 — 화면이 AI에서 고정 안내로 넘어갔다 돌아온다", () => {
  it("인계 문구를 로그에 남기고 프로토콜 상태로 들어간다", () => {
    const { reduce, started } = machine(CHK_B02);
    const handed = play(CHK_B02, started, reduce, pickProtocol, { stopAtProtocol: true });

    expect(handed.session.status).toBe("protocol");
    expect(protocolIdOf(handed.session)).toBe("P-02");
    expect(noticeTexts(handed.log).some((t) => t.includes(PROTOCOL_HANDOFF_TITLE))).toBe(true);
    expect(handed.critical).toBeNull();
  });

  it("고정 안내가 끝나면 인계·보고 턴으로 이어진다", () => {
    const { reduce, started } = machine(CHK_B02);
    const handed = play(CHK_B02, started, reduce, pickProtocol, { stopAtProtocol: true });
    const back = reduce(handed, { type: "protocolDone" });

    expect(back.session.status).toBe("running");
    expect(noticeTexts(back.log).some((t) => t.includes("고정 안내가 끝났습니다"))).toBe(true);
    // 프로토콜 직전 턴의 게이지 안내가 복귀 뒤까지 남지 않는다.
    expect(back.lastFeedback).toBeNull();
    expect(back.log.length).toBeGreaterThan(handed.log.length);

    const ended = play(CHK_B02, back, reduce, safeBranch);
    expect(ended.phase).toBe("ended");
  });

  it("프로토콜 상태가 아니면 「안내 끝」은 아무 일도 하지 않는다", () => {
    const { reduce, started } = machine(CHK_B02);
    expect(reduce(started, { type: "protocolDone" })).toBe(started);
  });
});

/* ── 4. 체크포인트 복원 ───────────────────────────────── */

/** 진행하면서 체크포인트에 적힐 결정만 따로 받아 적는다(발화 원문은 애초에 담기지 않는다). */
function playRecording(
  scenario: Scenario,
  reduce: Reduce,
  started: TrainState,
  turns: number,
  viaButton: boolean,
  pick: (cue: CueDef) => BranchDef = safeBranch,
): { state: TrainState; decisions: ProgressDecision[] } {
  const decisions: ProgressDecision[] = [];
  let next = started;
  for (let i = 0; i < turns; i += 1) {
    if (next.phase !== "session" || next.session.status !== "running") break;
    const turn = currentTurn(scenario, next.session);
    const cue = turn?.cue;
    if (!turn || !cue) break;
    const branch = pick(cue);
    const decision: ProgressDecision = { turnId: turn.id, cueId: cue.id, branchId: branch.id, viaButton };
    next = reduce(next, {
      type: "submit",
      input: viaButton
        ? { branchId: branch.id, viaButton: true }
        : { utterance: branch.fallbackOption ?? branch.label, branchId: branch.id, viaButton: false },
    });
    decisions.push(decision);
  }
  return { state: next, decisions };
}

function progressOf(
  scenario: Scenario,
  decisions: ProgressDecision[],
  overrides: Partial<SessionProgress> = {},
): SessionProgress {
  return {
    scenarioId: scenario.id,
    savedAt: "2026-08-06T00:00:00.000Z",
    decisions,
    gauge: 0,
    cfCount: 0,
    retriesUsed: 0,
    status: "running",
    ...overrides,
  };
}

describe("이어서 하기 — 저장된 분기 id만으로 진행 위치를 되짚는다", () => {
  it("복원했다고 로그 맨 위에 밝히고, 같은 자리에 서 있다", () => {
    const { reduce, started } = machine(CHK_A01);
    const live = playRecording(CHK_A01, reduce, started, 3, true);

    const restored = reduce(initialTrainState(CHK_A01), {
      type: "resume",
      progress: progressOf(CHK_A01, live.decisions),
    });

    expect(restored.log[0]).toMatchObject({ kind: "notice", text: RESTORED_LOG_NOTICE });
    expect(restored.session.currentTurnId).toBe(live.state.session.currentTurnId);
    expect(restored.session.gauge).toBe(live.state.session.gauge);
    expect(restored.phase).toBe("session");
  });

  it("직접 말씀하신 턴은 보기 문구가 아니라 대체 표기로 되살아나고, 기록 초안은 다시 만들지 않는다", () => {
    const { reduce, started } = machine(CHK_A01);
    const live = playRecording(CHK_A01, reduce, started, 3, false);

    const restored = reduce(initialTrainState(CHK_A01), {
      type: "resume",
      progress: progressOf(CHK_A01, live.decisions),
    });

    const learner = restored.log.filter((item) => item.kind === "learner");
    expect(learner.length).toBeGreaterThan(0);
    for (const item of learner) {
      expect(item.kind === "learner" && item.text).toBe(RESTORED_UTTERANCE);
    }
    // 원문이 없으니 가명처리·5요소 추출을 다시 돌릴 수 없다 — 초안 미리보기는 붙지 않는다.
    expect(restored.log.some((item) => item.kind === "draft")).toBe(false);
    // 어떤 신호에 걸렸는지도 발화가 있어야 알 수 있으므로 판정 경로는 붙이지 않는다.
    for (const item of restored.log) {
      if (item.kind === "feedback") expect(item.feedback.trace).toBeUndefined();
    }
  });

  it("되살리지 못한 구간이 있으면 그 사실을 문구로 바꿔 적는다", () => {
    const { reduce, started } = machine(CHK_A01);
    const live = playRecording(CHK_A01, reduce, started, 3, true);
    const [first, second, ...rest] = live.decisions;
    const broken: ProgressDecision[] = [
      first as ProgressDecision,
      // 규칙 사전이 단독으로 잡았던 ⚑CF처럼 시나리오 분기로 되돌릴 수 없는 결정
      { ...(second as ProgressDecision), branchId: "없는-분기-id" },
      second as ProgressDecision,
      ...rest,
    ];

    const restored = reduce(initialTrainState(CHK_A01), {
      type: "resume",
      progress: progressOf(CHK_A01, broken),
    });

    expect(restored.log[0]).toMatchObject({ kind: "notice", text: RESTORED_LOG_NOTICE_PARTIAL });
    expect(restored.session.currentTurnId).toBe(live.state.session.currentTurnId);
  });

  it("한 턴도 되살리지 못하면 그냥 처음부터 시작한다", () => {
    const { reduce } = machine(CHK_A01);
    const restored = reduce(initialTrainState(CHK_A01), {
      type: "resume",
      progress: progressOf(CHK_A01, [
        { turnId: "없는-턴", branchId: "없는-분기", viaButton: true },
      ]),
    });
    expect(noticeTexts(restored.log)).not.toContain(RESTORED_LOG_NOTICE);
    expect(noticeTexts(restored.log)).not.toContain(RESTORED_LOG_NOTICE_PARTIAL);
    expect(restored.log[0]?.kind).toBe("line");
  });

  it("멈춰 세웠던 지점에서 저장했으면 시트를 다시 띄우지 않고 그 자리만 밝힌다", () => {
    const { reduce, started } = machine(CHK_A01);
    const live = playRecording(CHK_A01, reduce, started, 4, true, pickCritical);
    expect(live.state.session.cfCount).toBeGreaterThanOrEqual(1);

    const restored = reduce(initialTrainState(CHK_A01), {
      type: "resume",
      progress: progressOf(CHK_A01, live.decisions, { cfCount: live.state.session.cfCount }),
    });

    // 몇 시간 뒤 돌아온 분이 처음 보는 화면이 전면 인터럽트가 되지 않는다.
    expect(restored.critical).toBeNull();
    expect(restored.session.status).toBe("running");
    expect(noticeTexts(restored.log)).toContain(RESUMED_AT_CF_NOTICE);
  });

  it("되살리지 못한 ⚑CF가 있어도 횟수는 사실대로 남는다 — 새로고침으로 없던 일이 되지 않는다", () => {
    const { reduce, started } = machine(CHK_A01);
    const live = playRecording(CHK_A01, reduce, started, 2, true);

    const restored = reduce(initialTrainState(CHK_A01), {
      type: "resume",
      progress: progressOf(CHK_A01, live.decisions, { cfCount: 2, retriesUsed: 1 }),
    });

    expect(restored.session.cfCount).toBe(2);
    expect(restored.session.retriesUsed).toBe(1);
  });

  it("저장값이 훼손돼 있어도 말이 되는 범위 안으로만 받는다", () => {
    const { reduce, started } = machine(CHK_A01);
    const live = playRecording(CHK_A01, reduce, started, 2, true);

    const restored = reduce(initialTrainState(CHK_A01), {
      type: "resume",
      progress: progressOf(CHK_A01, live.decisions, {
        cfCount: Number.POSITIVE_INFINITY,
        retriesUsed: -5,
      }),
    });

    // ⚑CF 횟수는 결정 수를 넘지 못하고, 음수는 0으로 눌러 담는다.
    expect(restored.session.cfCount).toBeLessThanOrEqual(live.decisions.length);
    expect(restored.session.retriesUsed).toBeGreaterThanOrEqual(0);
  });
});

/* ── 5. 시연 프리셋 ───────────────────────────────────── */

describe("?demo= 빨리감기 — 보여 드릴 장면 직전에서 손을 뗀다", () => {
  it("쿼리 값을 프리셋으로 읽고, 모르는 값은 없는 것과 같이 다룬다", () => {
    expect(parseDemoPreset("cf")).toBe("cf");
    expect(parseDemoPreset("L3")).toBe("l3");
    expect(parseDemoPreset(" end ")).toBe("end");
    expect(parseDemoPreset("아무거나")).toBeUndefined();
    expect(parseDemoPreset("")).toBeUndefined();
    expect(parseDemoPreset(null)).toBeUndefined();
    expect(parseDemoPreset(undefined)).toBeUndefined();
  });

  it("cf — ⚑CF가 열리는 CUE 직전에서 멈추고, 지나온 구간을 숨기지 않는다", () => {
    const { reduce } = machine(CHK_A01);
    const state = reduce(initialTrainState(CHK_A01), { type: "demo", preset: "cf" });

    expect(state.log[0]).toMatchObject({ kind: "notice", text: DEMO_LOG_BANNER });
    expect(state.session.status).toBe("running");
    // 자동 재생은 ⚑CF를 지나가지 않는다 — 멈춰 선 자리에 ⚑CF 분기가 있고, 시트는 아직 닫혀 있다.
    expect(cueOf(CHK_A01, state)?.branches.some((b) => b.criticalFail === true)).toBe(true);
    expect(state.critical).toBeNull();
    expect(state.session.cfCount).toBe(0);
  });

  it("l3 — 응급 안내로 넘어가는 CUE 직전에서 멈춘다", () => {
    const { reduce } = machine(CHK_B02);
    const state = reduce(initialTrainState(CHK_B02), { type: "demo", preset: "l3" });

    expect(state.log[0]).toMatchObject({ kind: "notice", text: DEMO_LOG_BANNER });
    expect(state.session.status).toBe("running");
    expect(cueOf(CHK_B02, state)?.branches.some((b) => b.next.startsWith("protocol:"))).toBe(true);
  });

  it("end — 엔딩으로 끝나는 CUE 직전에서 멈춘다", () => {
    const { reduce } = machine(CHK_A01);
    const state = reduce(initialTrainState(CHK_A01), { type: "demo", preset: "end" });

    expect(state.log[0]).toMatchObject({ kind: "notice", text: DEMO_LOG_BANNER });
    expect(state.phase).toBe("session");
    expect(cueOf(CHK_A01, state)?.branches.some((b) => b.next.startsWith("end:"))).toBe(true);

    // 손을 뗀 자리에서 한 턴만 더 가면 엔딩이다 — 발표자가 그 한 번을 직접 누른다.
    const ended = play(CHK_A01, state, reduce, (cue) => {
      const finisher = cue.branches.find((b) => b.next.startsWith("end:"));
      return finisher ?? safeBranch(cue);
    });
    expect(ended.phase).toBe("ended");
  });

  it("빨리감기로 지나온 구간의 대사도 데이터의 문장뿐이다", () => {
    const { reduce } = machine(CHK_B02);
    const state = reduce(initialTrainState(CHK_B02), { type: "demo", preset: "l3" });
    const scripted = scriptedLines(CHK_B02);
    for (const item of state.log) {
      if (item.kind === "line") expect(scripted.has(item.text)).toBe(true);
    }
  });
});
