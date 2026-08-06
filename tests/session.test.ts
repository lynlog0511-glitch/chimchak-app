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
