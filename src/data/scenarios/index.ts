/**
 * 열린 시나리오 묶음 — 설계서 §2.4 알파 편성 3종 + §9.1 확장 매트릭스에서 이어 붙인 2종.
 *
 * 알파 감수 완료분
 *   CHK-A01 BPSD·초급 (L1+L2) / CHK-B02 응급·중급 (L1+L2+L3) / CHK-C01 갈등·중급 (L1+L2)
 *   이 3종만으로 루브릭 30항목이 전수 1회 이상 실행되고, 생성 통제 3계층이 모두 통과됩니다.
 *
 * 알파 초안 — 현직 감수 대기
 *   CHK-A02 BPSD·중급 (야간 배회 + 보호자 부재) / CHK-C02 갈등·고급 (사고 책임 추궁·계약 해지 위협)
 *   루브릭 30항목·규칙 사전·엔진을 그대로 재사용하고 **데이터만** 더한 확장입니다.
 *   대사 감수가 끝나지 않았다는 사실은 화면(/train 카드 라벨)에 그대로 적습니다.
 */

import type { Scenario, TurnDef } from "@/types";
import { classifyInput } from "@/engine/classify";
import { normalize } from "@/engine/rules";

import { CHK_A01 } from "./chk-a01";
import { CHK_A02 } from "./chk-a02";
import { CHK_B02 } from "./chk-b02";
import { CHK_C01 } from "./chk-c01";
import { CHK_C02 } from "./chk-c02";

export { CHK_A01 } from "./chk-a01";
export { CHK_A02 } from "./chk-a02";
export { CHK_B02, B02_PROTOCOL_RESUME_TURN_ID } from "./chk-b02";
export { CHK_C01 } from "./chk-c01";
export { CHK_C02 } from "./chk-c02";

export const SCENARIOS: Scenario[] = [CHK_A01, CHK_A02, CHK_B02, CHK_C01, CHK_C02];

/** 시나리오 id 로 조회합니다. 대소문자 구분 없이(예: "chk-a01") 찾습니다. */
export function getScenario(id: string): Scenario | undefined {
  const key = id.trim().toUpperCase();
  return SCENARIOS.find((scenario) => scenario.id.toUpperCase() === key);
}

/** 훈련 가능한(활성) 시나리오만 돌려줍니다. */
export function getActiveScenarios(): Scenario[] {
  return SCENARIOS.filter((scenario) => scenario.active);
}

/** 턴 id 로 턴을 찾습니다. */
export function getTurn(scenario: Scenario, turnId: string): TurnDef | undefined {
  return scenario.turns.find((turn) => turn.id === turnId);
}

/**
 * ⚑CF·재훈련 권고 판정으로 **엔진이 직접 채택**하는 엔딩 판정값.
 * (설계서 §4.6 규칙 1)·2) — 턴 그래프의 next로는 연결되지 않으므로 도달 가능성 검사에서 제외합니다.)
 */
const ENGINE_FORCED_VERDICTS = new Set(["재훈련", "재훈련 권고"]);

/** 턴 그래프를 따라가며 실제로 닿을 수 있는 엔딩 id 집합을 구합니다. */
function reachableEndings(scenario: Scenario): Set<string> {
  const reached = new Set<string>();
  const seen = new Set<string>();
  const queue: string[] = [scenario.entryTurnId];

  const push = (target: string): void => {
    if (!target) return;
    if (target.startsWith("end:")) {
      reached.add(target.slice("end:".length));
      return;
    }
    const turnId = target.startsWith("protocol:") ? target.slice("protocol:".length) : target;
    if (!seen.has(turnId)) queue.push(turnId);
  };

  while (queue.length > 0) {
    const turnId = queue.shift();
    if (!turnId || seen.has(turnId)) continue;
    seen.add(turnId);
    const turn = scenario.turns.find((t) => t.id === turnId);
    if (!turn) continue;
    if (turn.autoNext) push(turn.autoNext);
    if (!turn.cue) continue;
    for (const branch of turn.cue.branches) push(branch.next);
  }

  // 게이지 위기 엔딩은 게이지가 위기치에 닿을 수 있을 때만 도달 가능합니다.
  let maxGauge = scenario.gauge.start;
  for (const turn of scenario.turns) {
    if (!turn.cue) continue;
    const up = turn.cue.branches.map((b) => b.gaugeDelta).filter((d) => d > 0);
    if (up.length > 0) maxGauge += Math.max(...up);
  }
  if (maxGauge >= scenario.gauge.crisisAt) reached.add(scenario.gauge.crisisEndingId);

  return reached;
}

/**
 * 턴 그래프 무결성 검사 — QA·개발 중 확인용 순수 함수입니다.
 *
 * 찾는 것
 * 1) 끊어진 연결(존재하지 않는 턴 id)·정의되지 않은 엔딩 id·잘못된 defaultBranchId
 * 2) 도달 불가 엔딩 (⚑CF·재훈련 권고처럼 엔진이 직접 채택하는 엔딩은 제외)
 * 3) 정규화하면 2글자 미만이 되는 판정 패턴 (사실상 모든 발화를 삼킵니다)
 * 4) 버튼 폴백 문구를 그대로 말했을 때 자기 분기로 되돌아오지 않는 분기
 *
 * 예: `validateScenarioGraph(CHK_B02) // => []`
 */
export function validateScenarioGraph(scenario: Scenario): string[] {
  const problems: string[] = [];
  const turnIds = new Set(scenario.turns.map((turn) => turn.id));
  const endingIds = new Set(scenario.endings.map((ending) => ending.id));

  const checkTarget = (target: string, where: string): void => {
    if (target.startsWith("end:")) {
      const endingId = target.slice("end:".length);
      if (!endingIds.has(endingId)) {
        problems.push(`${where}: 정의되지 않은 엔딩 "${endingId}"`);
      }
      return;
    }
    const turnId = target.startsWith("protocol:") ? target.slice("protocol:".length) : target;
    if (!turnIds.has(turnId)) {
      problems.push(`${where}: 존재하지 않는 턴 "${turnId}"`);
    }
  };

  if (!turnIds.has(scenario.entryTurnId)) {
    problems.push(`entryTurnId: 존재하지 않는 턴 "${scenario.entryTurnId}"`);
  }
  if (!endingIds.has(scenario.gauge.crisisEndingId)) {
    problems.push(`gauge.crisisEndingId: 정의되지 않은 엔딩 "${scenario.gauge.crisisEndingId}"`);
  }

  for (const turn of scenario.turns) {
    if (turn.autoNext) checkTarget(turn.autoNext, `${scenario.id} ${turn.id}.autoNext`);
    if (!turn.cue) {
      if (!turn.autoNext) {
        problems.push(`${scenario.id} ${turn.id}: cue 도 autoNext 도 없어 흐름이 끊깁니다`);
      }
      continue;
    }
    const branchIds = new Set(turn.cue.branches.map((branch) => branch.id));
    if (!branchIds.has(turn.cue.defaultBranchId)) {
      problems.push(
        `${scenario.id} ${turn.id} ${turn.cue.id}: defaultBranchId "${turn.cue.defaultBranchId}" 가 분기 목록에 없습니다`,
      );
    }
    for (const branch of turn.cue.branches) {
      checkTarget(branch.next, `${scenario.id} ${turn.id} ${turn.cue.id} ${branch.id}.next`);

      for (const pattern of branch.patterns) {
        if (normalize(pattern).length < 2) {
          problems.push(
            `${scenario.id} ${turn.cue.id} ${branch.id}: 패턴 "${pattern}" 은 정규화하면 2글자 미만이라 모든 발화를 삼킵니다`,
          );
        }
      }

      if (typeof branch.fallbackOption === "string" && branch.fallbackOption.length > 0) {
        const back = classifyInput(turn.cue, { utterance: branch.fallbackOption });
        if (back.branch.id !== branch.id) {
          problems.push(
            `${scenario.id} ${turn.cue.id} ${branch.id}: 버튼 폴백 문구를 그대로 말하면 "${back.branch.id}" 로 분류됩니다`,
          );
        }
      }
    }
  }

  const reached = reachableEndings(scenario);
  for (const ending of scenario.endings) {
    if (reached.has(ending.id)) continue;
    if (ENGINE_FORCED_VERDICTS.has(ending.verdict)) continue;
    problems.push(`${scenario.id} 엔딩 "${ending.id}": 턴 그래프에서 도달할 수 없습니다`);
  }

  return problems;
}

/** 열린 시나리오 전체를 한 번에 검사합니다. */
export function validateAllScenarios(): string[] {
  return SCENARIOS.flatMap((scenario) => validateScenarioGraph(scenario));
}
