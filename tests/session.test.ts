/**
 * 세션 엔진 회귀 검사 — src/engine/session.ts
 *
 * 지키려는 것은 **판정 우선순위**다.
 *   ⚑CF(규칙 사전) → ⚑CF(분기 데이터) → 재훈련 고정 → 재훈련 권고 → 턴 그래프 엔딩 → 내부 산식
 * 이 순서가 뒤집히면 "⚑CF 한 번이면 무조건 재훈련"이라는 설계서 §4.6 약속이 조용히 깨진다.
 * 화면에는 점수가 나오지 않으므로 눈으로는 끝까지 알 수 없다.
 */

import { describe, expect, it } from "vitest";
import {
  advanceAfterCF,
  advanceAuto,
  applyTimeout,
  buildRecord,
  criticalAlternatives,
  cueOptions,
  currentCue,
  currentTurn,
  isFinished,
  protocolIdOf,
  resolveEnding,
  resumeFromProtocol,
  retrySession,
  startSession,
  submitResponse,
  type TracedFeedback,
} from "@/engine/session";
import { TURN_IDLE_CAP_SEC, activeSeconds } from "@/engine/timing";
import type { SessionState } from "@/types";
import { CF_MESSAGE, makeScenario } from "./_fixtures";

const scenario = makeScenario();

function speak(state: SessionState, utterance: string) {
  return submitResponse(scenario, state, { utterance, viaButton: false });
}

describe("startSession", () => {
  it("시작 상태를 만든다", () => {
    const state = startSession(scenario);
    expect(state.status).toBe("running");
    expect(state.currentTurnId).toBe("T1");
    expect(state.gauge).toBe(0);
    expect(state.cfCount).toBe(0);
    expect(state.events).toEqual([]);
    expect(currentTurn(scenario, state)?.id).toBe("T1");
    expect(currentCue(scenario, state)?.id).toBe("CUE-1");
    expect(isFinished(state)).toBe(false);
  });
});

describe("1순위 — 규칙 사전이 분기 판정보다 먼저다", () => {
  it("분기 패턴에 없는 발화라도 규칙 사전이 잡으면 인터럽트다", () => {
    const result = speak(startSession(scenario), "문을 잠그겠습니다");
    expect(result.interrupted).toBe(true);
    expect(result.state.status).toBe("interrupted");
    expect((result.feedback as TracedFeedback).trace?.source).toBe("rule");
    expect((result.feedback as TracedFeedback).trace?.ruleId).toBe("CF-RESTRAINT");
  });

  it("규칙은 탐지, 문구는 데이터 — 같은 항목의 ⚑CF 분기가 있으면 그 문구를 쓴다", () => {
    const result = speak(startSession(scenario), "문을 잠그겠습니다");
    expect(result.feedback.branchId).toBe("b-cf");
    expect(result.feedback.message).toBe(CF_MESSAGE);
    expect((result.feedback as TracedFeedback).trace?.source).toBe("rule");
  });

  it("같은 항목의 분기가 없으면 규칙 사전의 문구·대안을 쓴다", () => {
    const result = speak(startSession(scenario), "주사를 놓아 드리겠습니다");
    expect(result.interrupted).toBe(true);
    expect(result.feedback.branchId).toBe("rule:CF-INJECTION");
    expect(criticalAlternatives(scenario, result.state, result.feedback)).toHaveLength(3);
  });

  it("인터럽트는 같은 CUE에 머무르고 점수를 굳히지 않는다", () => {
    const result = speak(startSession(scenario), "문을 잠그겠습니다");
    expect(result.state.currentTurnId).toBe("T1");
    expect(result.state.scores).toEqual({});
    expect(result.state.cfCount).toBe(1);
  });

  it("버튼으로 고른 턴에서는 규칙 사전을 돌리지 않는다 (데이터의 판단을 따른다)", () => {
    const result = submitResponse(scenario, startSession(scenario), {
      utterance: "문을 잠그겠습니다",
      branchId: "b-ok",
      viaButton: true,
    });
    expect(result.interrupted).toBe(false);
    expect(result.feedback.branchId).toBe("b-ok");
    expect((result.feedback as TracedFeedback).trace?.source).toBe("button");
  });

  it("시나리오에 배정되지 않은 ⚑CF 항목은 인터럽트 대신 코칭으로 남는다", () => {
    const narrow = makeScenario({ appliedRubric: ["RE-01"] });
    const result = submitResponse(narrow, startSession(narrow), {
      utterance: "어디 가시려고요? 문을 잠그겠습니다",
      viaButton: false,
    });
    expect(result.interrupted).toBe(false);
    expect(result.feedback.rubricHits.map((h) => h.itemId)).toContain("CO-02");
    expect((result.feedback as TracedFeedback).trace?.advisoryLabels).toContain("신체 자유 제한");
  });
});

describe("2순위 — 분기 데이터의 ⚑CF", () => {
  it("⚑CF 분기에 걸리면 인터럽트다", () => {
    const result = speak(startSession(scenario), "혼자 두고 나가 있겠습니다");
    expect(result.interrupted).toBe(true);
    expect(result.feedback.branchId).toBe("b-cf");
    expect((result.feedback as TracedFeedback).trace?.source).toBe("criticalPattern");
  });

  it("advanceAfterCF는 벌점 없이 같은 CUE로 되돌린다", () => {
    const cf = speak(startSession(scenario), "혼자 두고 나가 있겠습니다");
    const retried = advanceAfterCF(scenario, cf.state);
    expect(retried.status).toBe("running");
    expect(retried.currentTurnId).toBe("T1");
    expect(retried.retriesUsed).toBe(1);
    expect(retried.cfCount).toBe(1);
  });
});

describe("게이지", () => {
  it("위기치에 닿으면 분기의 next 대신 위기 엔딩으로 간다", () => {
    const result = speak(startSession(scenario), "빨리 들어가세요");
    expect(result.state.status).toBe("ended");
    expect(result.state.endingId).toBe("E-위기");
    expect(result.state.gauge).toBe(2);
  });

  it("0 아래로 내려가지 않는다", () => {
    const result = speak(startSession(scenario), "천천히 하셔도 됩니다");
    expect(result.state.gauge).toBe(0);
    expect(result.state.status).toBe("running");
  });
});

describe("판정 우선순위 — buildRecord", () => {
  function runToEnd(utterance: string): SessionState {
    const after = speak(startSession(scenario), utterance);
    expect(after.state.currentTurnId).toBe("T2");
    return advanceAuto(scenario, after.state);
  }

  it("엔딩 — 턴 그래프가 확정한 판정을 쓴다", () => {
    const ended = runToEnd("마음이 급하시겠어요");
    expect(ended.status).toBe("ended");
    expect(ended.endingId).toBe("E-충족");
    expect(buildRecord(scenario, ended).verdict).toBe("충족");
  });

  it("재훈련 권고는 엔딩을 이긴다", () => {
    const ended = runToEnd("그냥 두세요");
    expect(ended.endingId).toBe("E-충족");
    const record = buildRecord(scenario, ended);
    expect(record.verdict).toBe("재훈련 권고");
    expect(record.endingTitle).toBe("재훈련 권고 엔딩");
  });

  it("⚑CF는 재훈련 권고보다도 앞선다", () => {
    const cf = speak(startSession(scenario), "문을 잠그겠습니다");
    const retried = advanceAfterCF(scenario, cf.state);
    const advice = speak(retried, "그냥 두세요");
    const ended = advanceAuto(scenario, advice.state);
    expect(ended.endingId).toBe("E-충족");
    const record = buildRecord(scenario, ended);
    expect(record.verdict).toBe("재훈련");
    expect(record.cfCount).toBe(1);
    expect(record.retriesUsed).toBe(1);
  });

  it("엔딩이 없으면 내부 산식으로 판정한다", () => {
    const state: SessionState = {
      ...startSession(scenario),
      status: "ended",
      scores: { "RE-01": 2 },
    };
    expect(buildRecord(scenario, state).verdict).toBe("부분 충족");
  });

  it("resolveEnding은 고정 판정에 맞는 엔딩을 골라 온다", () => {
    const cf = speak(startSession(scenario), "문을 잠그겠습니다");
    const retried = advanceAfterCF(scenario, cf.state);
    const ok = speak(retried, "마음이 급하시겠어요");
    const ended = advanceAuto(scenario, ok.state);
    expect(ended.endingId).toBe("E-충족");
    expect(resolveEnding(scenario, ended)?.id).toBe("E-CF");
  });

  it("⚑CF 인터럽트는 대화 턴 수로 세지 않는다", () => {
    const cf = speak(startSession(scenario), "문을 잠그겠습니다");
    const retried = advanceAfterCF(scenario, cf.state);
    const ok = speak(retried, "마음이 급하시겠어요");
    const ended = advanceAuto(scenario, ok.state);
    const record = buildRecord(scenario, ended);
    expect(record.turnCount).toBe(1);
    expect(record.greenChecks).toEqual(["감정을 먼저 알아주셨습니다."]);
  });

  it("기록에는 발화 원문이 담기지 않는다", () => {
    const ended = runToEnd("마음이 급하시겠어요");
    expect(JSON.stringify(buildRecord(scenario, ended))).not.toContain("마음이 급하시겠어요");
  });

  it("기록에 진행 시간(activeSec)을 싣는다", () => {
    const ended = runToEnd("마음이 급하시겠어요");
    const record = buildRecord(scenario, ended);
    expect(typeof record.activeSec).toBe("number");
    // 검사 안에서 순식간에 끝나는 회차라 값 자체는 0초에 가깝다. 여기서 못 박는 것은
    // 「이 칸이 채워져 나간다」는 사실이다 — 비어 나가면 storage가 벽시계로 되돌아간다.
    expect(record.activeSec).toBeGreaterThanOrEqual(0);
    expect(record.activeSec).toBeLessThan(TURN_IDLE_CAP_SEC);
  });
});

/**
 * 이수 시수 산정 — 벽시계가 아니라 **진행 시간**을 센다.
 *
 * 이 블록이 지키는 것은 기관장이 서명하는 종이의 숫자다. 4분짜리 시나리오를 열어 둔 채
 * 자리를 비운 회차가 25분으로 확인서에 실리면, 실사에서 그 종이를 들고 서 있는 사람이
 * 답할 문장이 없다(9차 임원평가 구매자 high).
 */
describe("이수 시수 — 진행 시간 산정(activeSeconds)", () => {
  const MIN = 60_000;
  /** 시각만 있으면 되는 자리라 판정·분기는 넣지 않는다(이 함수가 보는 것은 `at`뿐이다). */
  const tick = (turnId: string, at: number) => ({ turnId, viaButton: true, at });

  it("정상 진행은 벽시계와 같은 값이다 — 깎지 않는다", () => {
    // 40초씩 여섯 턴 = 240초, 시나리오 설계 소요(4~6분)와 같은 결이다.
    const events = [0, 1, 2, 3, 4, 5].map((i) => tick(`T${i + 1}`, (i + 1) * 40_000));
    const endedAt = 6 * 40_000;
    expect(activeSeconds(events, 0, endedAt)).toBe(240);
    // 같은 회차의 벽시계 값과 한 초도 다르지 않다.
    expect(activeSeconds(events, 0, endedAt)).toBe(Math.round(endedAt / 1000));
  });

  it("자리 비움 — 마지막 턴 전 25분 정지는 턴당 상한까지만 센다", () => {
    /* A01(설계 소요 4분)을 열어 두고 자리를 비운 회차:
       30초 진행 → 25분 정지 → 마지막 턴 응답 → 곧바로 종료. */
    const away = [tick("T1", 30_000), tick("T2", 30_000 + 25 * MIN)];
    const endedAt = 30_000 + 25 * MIN;

    // 벽시계로 세면 25분 30초가 그대로 시수가 된다 — 이것이 닫으려는 상태다.
    expect(Math.round(endedAt / 1000)).toBe(25 * 60 + 30);
    // 진행 시간으로 세면 30초 + 상한 3분.
    expect(activeSeconds(away, 0, endedAt)).toBe(30 + TURN_IDLE_CAP_SEC);
  });

  it("정지가 여러 번이어도 턴마다 따로 깎는다", () => {
    const away = [
      tick("T1", 10 * MIN), // 10분 정지 → 3분
      tick("T2", 20 * MIN), // 10분 정지 → 3분
      tick("T3", 20 * MIN + 20_000), // 20초 → 20초
    ];
    expect(activeSeconds(away, 0, 20 * MIN + 20_000)).toBe(TURN_IDLE_CAP_SEC * 2 + 20);
  });

  it("마지막 응답 뒤 종료까지의 구간에도 같은 상한이 걸린다", () => {
    // 끝 화면이 뜬 뒤 기록이 만들어지기까지가 길어져도 그 구간이 시수를 밀어 올리지 못한다.
    expect(activeSeconds([tick("T1", 20_000)], 0, 20_000 + 40 * MIN)).toBe(20 + TURN_IDLE_CAP_SEC);
  });

  it("이벤트가 없으면 시작~종료 한 구간이고, 그 구간도 상한을 받는다", () => {
    expect(activeSeconds([], 0, 30_000)).toBe(30);
    expect(activeSeconds([], 0, 40 * MIN)).toBe(TURN_IDLE_CAP_SEC);
  });

  it("시계가 거꾸로 간 이벤트는 구간을 만들지 못한다 — 음수로 깎지 않는다", () => {
    const skewed = [tick("T1", 30_000), tick("T2", 10_000), tick("T3", 50_000)];
    // 30초 + (되감긴 이벤트 무시) + 20초.
    expect(activeSeconds(skewed, 0, 50_000)).toBe(50);
    expect(activeSeconds(skewed, 0, 50_000)).toBeGreaterThanOrEqual(0);
  });

  it("읽을 수 없는 시각에는 0을 돌려준다", () => {
    expect(activeSeconds([], Number.NaN, 1000)).toBe(0);
    expect(activeSeconds([], 0, Number.NaN)).toBe(0);
  });

  it("상한은 시나리오 설계 예산보다 넉넉하다 — 느린 진행을 깎지 않는다", () => {
    /* 가장 넉넉한 설계 예산이 한 턴 42.9초(C01: 5분 ÷ 7턴)다. 상한이 그보다 작아지면
       천천히 진행하시는 분의 시수가 깎이기 시작하므로, 그 방향의 변경을 여기서 막는다. */
    const WIDEST_DESIGNED_TURN_SEC = (5 * 60) / 7;
    expect(TURN_IDLE_CAP_SEC).toBeGreaterThan(WIDEST_DESIGNED_TURN_SEC * 4);
  });
});

describe("무응답·재시도·프로토콜", () => {
  it("applyTimeout은 기본 분기로 진행시킨다", () => {
    const result = applyTimeout(scenario, startSession(scenario));
    expect(result.feedback.branchId).toBe("b-flat");
    expect((result.feedback as TracedFeedback).trace?.source).toBe("button");
  });

  it("미분류 발화는 기본 분기로 떨어진다", () => {
    const result = speak(startSession(scenario), "음…");
    expect(result.feedback.branchId).toBe("b-flat");
    expect((result.feedback as TracedFeedback).trace?.source).toBe("default");
  });

  it("retrySession은 처음부터 다시 시작하되 재시도 횟수를 이어 센다", () => {
    const cf = speak(startSession(scenario), "문을 잠그겠습니다");
    const fresh = retrySession(scenario, cf.state);
    expect(fresh.currentTurnId).toBe("T1");
    expect(fresh.cfCount).toBe(0);
    expect(fresh.retriesUsed).toBe(1);
  });

  it("프로토콜로 넘어갔다가 지정한 턴으로 돌아온다", () => {
    const result = speak(startSession(scenario), "119를 부르겠습니다");
    expect(result.state.status).toBe("protocol");
    expect(protocolIdOf(result.state)).toBe("P-02");
    const back = resumeFromProtocol(scenario, result.state, "T3");
    expect(back.status).toBe("running");
    expect(back.currentTurnId).toBe("T3");
  });

  it("돌아갈 턴이 없으면 세션을 끝낸다 (그래프가 끊겨도 화면이 멈추지 않는다)", () => {
    const result = speak(startSession(scenario), "119를 부르겠습니다");
    expect(resumeFromProtocol(scenario, result.state, "없는턴").status).toBe("ended");
  });

  it("cueOptions는 버튼 폴백이 있는 분기만 돌려준다", () => {
    expect(cueOptions(scenario, startSession(scenario)).map((b) => b.id)).toEqual(["b-cf", "b-ok", "b-flat"]);
  });

  it("끝난 세션에는 더 이상 응답을 받지 않는다", () => {
    const ended: SessionState = { ...startSession(scenario), status: "ended" };
    const result = speak(ended, "마음이 급하시겠어요");
    expect(result.interrupted).toBe(false);
    expect(result.state).toBe(ended);
    expect(result.feedback.branchId).toBe("__none");
  });
});
