/**
 * 채점 누적기 회귀 검사 — src/engine/scoring.ts
 *
 * 판정 우선순위의 마지막 단계(내부 산식)와 "같은 항목은 낮은 점수를 남긴다"는 누적 원칙을 고정한다.
 * 점수는 화면에 나오지 않으므로 여기가 아니면 어긋난 것을 알아챌 자리가 없다.
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
import type { SessionEvent } from "@/types";

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
