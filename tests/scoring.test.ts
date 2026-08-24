/**
 * 채점 누적기 회귀 검사 — src/engine/scoring.ts
 *
 * 판정 우선순위의 마지막 단계(내부 산식)와 "같은 항목은 낮은 점수를 남긴다"는 누적 원칙을 고정한다.
 * 점수는 화면에 나오지 않으므로 여기가 아니면 어긋난 것을 알아챌 자리가 없다.
 *
 * 파일 끝에는 세는 함수가 하나 더 붙어 있다 — coverage.ts의 unexploredBranches(안 가 본 갈래).
 * 점수가 아니라 「지나온 자리에 몇 갈래가 남았는가」이지만, 화면에 수가 나가는 계산이라
 * 판정·채점과 같은 자리에서 회귀를 잡는다.
 */

import { describe, expect, it } from "vitest";
import {
  areaOf,
  collectCoaching,
  collectGreenChecks,
  isMet,
  judgeInternal,
  lowestScore,
  mergeHits,
  normalizedScore,
  toDisplay,
} from "@/engine/scoring";
import { unexploredBranches } from "@/engine/coverage";
import type { BranchDef, SessionEvent, SessionState } from "@/types";
import { makeScenario } from "./_fixtures";

describe("누적", () => {
  it("같은 항목은 낮은 점수를 남긴다", () => {
    expect(mergeHits({ "RE-01": 4 }, [{ itemId: "RE-01", score: 2 }])).toEqual({ "RE-01": 2 });
    expect(mergeHits({ "RE-01": 2 }, [{ itemId: "RE-01", score: 4 }])).toEqual({ "RE-01": 2 });
  });

  it("원본을 건드리지 않는다 (불변 업데이트)", () => {
    const before = { "RE-01": 4 } as const;
    const after = mergeHits(before, [{ itemId: "RE-01", score: 1 }]);
    expect(before).toEqual({ "RE-01": 4 });
    expect(after).not.toBe(before);
  });

  it("반영할 것이 없으면 같은 객체를 그대로 돌려준다", () => {
    const before = { "RE-01": 4 } as const;
    expect(mergeHits(before, [])).toBe(before);
  });

  it("이번 턴의 최저 점수를 고른다", () => {
    expect(lowestScore([{ itemId: "RE-01", score: 4 }, { itemId: "RE-02", score: 2 }])).toBe(2);
    expect(lowestScore([])).toBeUndefined();
  });
});

describe("영역·표시", () => {
  it("항목 id 접두어로 영역을 가른다", () => {
    expect(areaOf("SA-01")).toBe("SA");
    expect(areaOf("co-07")).toBe("CO");
    expect(areaOf("CL-03")).toBe("CL");
    expect(areaOf("XX-99")).toBe("RE");
  });

  it("표시는 충족·코칭 2단계뿐이다 (점수·등급을 넘기지 않는다)", () => {
    expect(toDisplay(4)).toEqual({ ok: true, mark: "🟢", label: "충족" });
    expect(toDisplay(3).label).toBe("충족");
    expect(toDisplay(2)).toEqual({ ok: false, mark: "⚪", label: "코칭" });
    expect(isMet(3)).toBe(true);
    expect(isMet(2)).toBe(false);
  });
});

describe("내부 산식", () => {
  it("가중치를 반영해 정규화한다", () => {
    // (4×0.35 + 3×0.25) ÷ (4×0.35 + 4×0.25) = 89.6
    // ※ scoring.ts:87 의 @example 은 87.5 라고 적혀 있으나 그것은 가중치를 뺀 단순 평균이다(문서 오기).
    expect(normalizedScore({ "RE-01": 4, "CO-07": 3 }, "BPSD")).toBe(89.6);
    expect(normalizedScore({}, "BPSD")).toBe(0);
  });

  it("가중치가 다른 유형은 같은 점수라도 다르게 나온다", () => {
    expect(normalizedScore({ "RE-01": 4, "CO-07": 3 }, "CONFLICT")).toBe(89.3);
    expect(normalizedScore({ "RE-01": 4, "CO-07": 4 }, "BPSD")).toBe(100);
  });

  it("⚑CF는 점수와 무관하게 재훈련으로 고정한다", () => {
    const perfect = { "RE-01": 4 } as const;
    expect(judgeInternal({ scores: perfect, type: "BPSD", cfCount: 1, retrainAdvice: false }).verdict).toBe("재훈련");
  });

  it("재훈련 권고는 점수 구간보다 앞선다", () => {
    const perfect = { "RE-01": 4 } as const;
    expect(judgeInternal({ scores: perfect, type: "BPSD", cfCount: 0, retrainAdvice: true }).verdict).toBe(
      "재훈련 권고",
    );
  });

  it("⚑CF가 재훈련 권고보다 앞선다", () => {
    expect(judgeInternal({ scores: {}, type: "BPSD", cfCount: 1, retrainAdvice: true }).verdict).toBe("재훈련");
  });

  it("점수 구간을 지킨다", () => {
    const grade = (scores: Record<string, 1 | 2 | 3 | 4>) =>
      judgeInternal({ scores, type: "BPSD", cfCount: 0, retrainAdvice: false });
    expect(grade({ "RE-01": 4 }).grade).toBe("우수");
    expect(grade({ "RE-01": 3 }).verdict).toBe("충족");
    expect(grade({ "RE-01": 2 }).verdict).toBe("부분 충족");
    expect(grade({ "RE-01": 1 }).verdict).toBe("재시도");
  });
});

describe("문구 모으기", () => {
  const event = (ok: boolean, message: string, criticalFail = false): SessionEvent => ({
    turnId: "T1",
    cueId: "CUE-1",
    viaButton: false,
    at: 0,
    feedback: { branchId: "b", branchLabel: "분기", ok, criticalFail, message, gaugeDelta: 0, rubricHits: [] },
  });

  it("충족 문구만 모으고 중복은 지운다", () => {
    expect(collectGreenChecks([event(true, "잘하셨습니다."), event(true, "잘하셨습니다."), event(false, "다시")])).toEqual(
      ["잘하셨습니다."],
    );
  });

  it("코칭 문구에서 ⚑CF 인터럽트 문구는 빼낸다", () => {
    expect(collectCoaching([event(false, "감정을 먼저 알아드려 보세요."), event(false, "잠시 멈추겠습니다.", true)])).toEqual([
      "감정을 먼저 알아드려 보세요.",
    ]);
  });

  it("피드백이 없는 이벤트는 건너뛴다", () => {
    expect(collectGreenChecks([{ turnId: "T1", viaButton: false, at: 0 }])).toEqual([]);
  });
});

/* ── 안 가 본 갈래 (src/engine/coverage.ts) ───────────────── */

const scenario = makeScenario();

/** 뼈대 시나리오 CUE-1의 갈래 — b-cf(⚑CF)와 b-flat(defaultBranchId)은 권유 대상이 아니다. */
function branchOf(id: string): BranchDef {
  const branch = scenario.turns[0].cue?.branches.find((b) => b.id === id);
  if (!branch) throw new Error(`_fixtures에 분기 ${id}가 없습니다`);
  return branch;
}

/** 「CUE-1에서 이 분기들을 골랐다」만 담은 세션 — 세는 함수는 이벤트 외에 아무것도 보지 않는다. */
function sessionPicking(branchIds: string[]): SessionState {
  return {
    scenarioId: scenario.id,
    currentTurnId: "T2",
    gauge: 0,
    status: "ended",
    events: branchIds.map((branchId, index) => ({
      turnId: "T1",
      cueId: "CUE-1",
      viaButton: true,
      at: index,
      feedback: {
        branchId,
        branchLabel: branchId,
        ok: true,
        criticalFail: false,
        message: "",
        gaugeDelta: 0,
        rubricHits: [],
      },
    })),
    scores: {},
    cfCount: 0,
    retrainAdvice: false,
    retriesUsed: 0,
    startedAt: 0,
  };
}

/** 권유 대상 5갈래 — b-cf(⚑CF)·b-flat(중립)을 뺀 나머지 전부. */
const SUGGESTABLE = ["b-ok", "b-rise", "b-calm", "b-advice", "b-protocol"];

describe("안 가 본 갈래", () => {
  it("지나온 자리에 남은 갈래를 센다 (일부 탐험)", () => {
    const session = sessionPicking(["b-ok"]);
    expect(unexploredBranches(scenario, session)).toBe(SUGGESTABLE.length - 1);

    // 결정론 — 같은 입력이면 몇 번을 불러도 같은 수이고, 세션을 건드리지 않는다.
    const before = JSON.stringify(session);
    expect(unexploredBranches(scenario, session)).toBe(SUGGESTABLE.length - 1);
    expect(JSON.stringify(session)).toBe(before);

    // 지나지 않은 자리는 애초에 세지 않는다 — 이벤트가 없으면 0이다.
    expect(unexploredBranches(scenario, sessionPicking([]))).toBe(0);
  });

  it("재시도로 고른 갈래도 모두 가 본 것으로 친다 (전부 탐험)", () => {
    expect(unexploredBranches(scenario, sessionPicking(SUGGESTABLE))).toBe(0);
    // 같은 갈래를 두 번 골라도 셈이 흔들리지 않는다.
    expect(unexploredBranches(scenario, sessionPicking([...SUGGESTABLE, "b-ok"]))).toBe(0);
  });

  it("⚑CF·중립 갈래는 「가 볼 길」로 세지 않는다", () => {
    // ⚑CF와 중립만 고른 회차 — 권유 대상 5갈래가 그대로 남는다(둘은 분모에도 없다).
    expect(unexploredBranches(scenario, sessionPicking(["b-cf", "b-flat"]))).toBe(SUGGESTABLE.length);

    // 권유 대상이 b-ok 하나뿐인 CUE로 좁혀 보면, 그 하나를 고른 순간 0이 된다.
    const cueTurn = scenario.turns[0];
    const cue = cueTurn.cue;
    if (!cue) throw new Error("_fixtures의 T1에 CUE가 없습니다");
    const narrowed = makeScenario({
      turns: [
        {
          ...cueTurn,
          cue: {
            ...cue,
            branches: [
              branchOf("b-ok"),
              branchOf("b-cf"), // ⚑CF
              branchOf("b-flat"), // defaultBranchId (무응답·미분류 자리)
              { ...branchOf("b-calm"), id: "b-calm-n" }, // …-n 표기의 중립 분기
            ],
          },
        },
        ...scenario.turns.slice(1),
      ],
    });
    expect(unexploredBranches(narrowed, sessionPicking(["b-ok"]))).toBe(0);
  });
});
