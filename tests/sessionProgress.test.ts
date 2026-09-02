import { describe, expect, it } from "vitest";
import { getActiveScenarios } from "@/data/scenarios";
import { CHK_A01 } from "@/data/scenarios/chk-a01";
import { currentTurn } from "@/engine";
import type { BranchDef, CueDef, Scenario } from "@/types";
import {
  initialTrainState,
  makeTrainReducer,
  type TrainState,
} from "@/app/train/_components/sessionMachine";
import {
  cueProgress,
  scenarioPracticeStepCount,
} from "@/app/train/_components/sessionProgress";

function safeBranch(cue: CueDef): BranchDef {
  const preferred = cue.branches.filter(
    (branch) =>
      !branch.criticalFail &&
      !branch.retrainAdvice &&
      branch.id !== cue.defaultBranchId,
  );
  const choices = preferred.length > 0 ? preferred : cue.branches;
  return choices.reduce((best, branch) =>
    branch.gaugeDelta < best.gaugeDelta ? branch : best,
  );
}

function finishAlongSafePath(scenario: Scenario): { last?: ReturnType<typeof cueProgress>; state: TrainState } {
  const reduce = makeTrainReducer(scenario);
  let state = reduce(initialTrainState(scenario), { type: "start" });
  let last: ReturnType<typeof cueProgress> | undefined;

  for (let guard = 0; guard < 80 && state.phase !== "ended"; guard += 1) {
    if (state.session.status === "protocol") {
      state = reduce(state, { type: "protocolDone" });
      continue;
    }
    if (state.session.status !== "running") break;

    const cue = currentTurn(scenario, state.session)?.cue;
    if (!cue) break;
    last = cueProgress(scenario, state.session, cue);
    expect(last.total, `${scenario.id} ${state.session.currentTurnId}`).toBeGreaterThanOrEqual(
      last.index,
    );
    const branch = safeBranch(cue);
    state = reduce(state, {
      type: "submit",
      input: { branchId: branch.id, viaButton: true },
    });
  }

  return { last, state };
}

describe("현재 갈래 기준 단계 수", () => {
  it("A01은 서로 배타적인 돌발 턴을 더하지 않고 7단계로 안내한다", () => {
    expect(scenarioPracticeStepCount(CHK_A01)).toBe(7);
  });

  it("모든 열린 시나리오의 안전 경로에서 마지막 표시가 N / N이다", () => {
    for (const scenario of getActiveScenarios()) {
      const { last, state } = finishAlongSafePath(scenario);
      expect(state.phase, scenario.id).toBe("ended");
      expect(last, scenario.id).toBeDefined();
      expect(last?.total, scenario.id).toBe(last?.index);
    }
  });
});
