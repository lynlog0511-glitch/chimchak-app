import { describe, expect, it } from "vitest";
import { getActiveScenarios } from "@/data/scenarios";

const MAX_SHORT_LINE = 55;

describe("훈련 시작 전 짧은 안내 문구", () => {
  it("열린 모든 상황에 상황 두 문장과 연습 포인트 두 문장이 있다", () => {
    for (const scenario of getActiveScenarios()) {
      expect(scenario.situationLines, `${scenario.id} 상황 설명`).toHaveLength(2);
      expect(scenario.practicePoints, `${scenario.id} 연습 포인트`).toHaveLength(2);
    }
  });

  it("네 문장은 큰 글씨에서도 짧게 읽히고 저작용 코드를 노출하지 않는다", () => {
    for (const scenario of getActiveScenarios()) {
      for (const line of [...scenario.situationLines, ...scenario.practicePoints]) {
        expect(line).toBe(line.trim());
        expect(line.length, `${scenario.id}: ${line}`).toBeLessThanOrEqual(MAX_SHORT_LINE);
        expect(line, `${scenario.id}: ${line}`).toMatch(/[.!?]$/);
        expect(line, `${scenario.id}: ${line}`).not.toMatch(/\b(?:LO|CUE|CHK)-?\d/i);
      }
    }
  });
});
