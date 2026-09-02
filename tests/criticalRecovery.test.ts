import { describe, expect, it } from "vitest";
import { CHK_A01 } from "@/data/scenarios/chk-a01";
import { getActiveScenarios } from "@/data/scenarios";
import { advanceAfterCF, currentTurn, startSession, submitResponse } from "@/engine";
import { criticalReplyOptions } from "@/app/train/_components/sessionMachine";

describe("안전 중단 한 번 복구", () => {
  it("모든 활성 안전 중단 턴은 화면 문장과 정확히 짝인 전진 분기를 제공한다", () => {
    for (const scenario of getActiveScenarios()) {
      for (const turn of scenario.turns) {
        const cue = turn.cue;
        if (!cue?.branches.some((branch) => branch.criticalFail)) continue;

        const replies = criticalReplyOptions(cue, turn.id);
        expect(replies.length, `${scenario.id} ${turn.id}`).toBe(1);
        for (const reply of replies) {
          const branch = cue.branches.find((candidate) => candidate.id === reply.branchId);
          expect(branch?.fallbackOption, `${scenario.id} ${turn.id} ${reply.branchId}`).toBe(
            reply.sentence,
          );
          expect(branch?.criticalFail, `${scenario.id} ${turn.id} ${reply.branchId}`).not.toBe(true);
          expect(branch?.retrainAdvice, `${scenario.id} ${turn.id} ${reply.branchId}`).not.toBe(true);
          expect(branch?.next, `${scenario.id} ${turn.id} ${reply.branchId}`).not.toBe(turn.id);
        }
      }
    }
  });

  it("추천 답변 버튼은 재분류하지 않고 앞으로 가는 검수 분기를 제출한다", () => {
    const atRiskTurn = "T3";
    const session = { ...startSession(CHK_A01), currentTurnId: atRiskTurn };
    const cue = currentTurn(CHK_A01, session)?.cue;
    expect(cue).toBeDefined();

    const interrupted = submitResponse(CHK_A01, session, {
      branchId: "D3-d",
      viaButton: true,
    });
    expect(interrupted.state.status).toBe("interrupted");

    const [reply] = criticalReplyOptions(cue!, atRiskTurn);
    const safeBranch = cue!.branches.find((branch) => branch.id === reply?.branchId);
    expect(reply?.sentence).toBe(safeBranch?.fallbackOption);
    expect(safeBranch?.criticalFail).not.toBe(true);
    expect(safeBranch?.next).not.toBe(atRiskTurn);

    const recovered = advanceAfterCF(CHK_A01, interrupted.state);
    const advanced = submitResponse(CHK_A01, recovered, {
      branchId: reply!.branchId,
      viaButton: true,
    });
    expect(advanced.state.status).toBe("running");
    expect(advanced.state.currentTurnId).toBe("T4");
  });
});
