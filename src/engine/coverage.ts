/**
 * 규칙 엔진이 **단독으로** 판정하는 루브릭 항목 — 코드에서 세어 온 값.
 *
 * 화면의 단언(「규칙 엔진이 단독 판정하는 N항목」)이 코드보다 앞서 나가지 않도록,
 * 세는 곳을 이 파일 하나로 모은다. 두 갈래를 합친다.
 *  - 규칙 사전(rules.ts)이 문장으로 잡는 항목
 *  - 시간 규칙(timing.ts)이 경과 초로 잡는 항목 (CO-03 · 119 지연)
 *
 * 같은 「세는 곳은 한 군데」 원칙으로, **이번 회차가 지나간 자리에 남은 갈래**를 세는
 * 순수 함수(unexploredBranches)도 여기에 둔다 — 엔딩 화면의 안내 한 줄이 근거로 쓴다.
 */

import type { BranchDef, CueDef, Scenario, SessionState } from "@/types";
import { RULE_DICTIONARY_ITEM_IDS } from "./rules";
import { CALL_DELAY_ITEM_ID } from "./timing";

/**
 * 지금 이 코드가 단독 판정하는 항목 전부.
 *
 * @example RULE_ENGINE_ITEM_IDS.includes("CO-03"); // true (시간 규칙)
 */
export const RULE_ENGINE_ITEM_IDS: string[] = RULE_DICTIONARY_ITEM_IDS.includes(CALL_DELAY_ITEM_ID)
  ? [...RULE_DICTIONARY_ITEM_IDS]
  : [...RULE_DICTIONARY_ITEM_IDS, CALL_DELAY_ITEM_ID];

/** 그중 ⚑CF(안전 직결) 항목 — 1건이라도 나오면 종합 판정이 '재훈련'으로 고정된다. */
export const RULE_ENGINE_CF_ITEM_IDS: string[] = ["CO-01", "CO-02", "CO-03"].filter((id) =>
  RULE_ENGINE_ITEM_IDS.includes(id),
);

/* ── 안 가 본 갈래 ───────────────────────────────────────── */

/**
 * 「가 볼 길」로 권할 수 있는 갈래인가 — 두 가지는 세지 않는다.
 *
 *  - **중립 분기**(`…-n` · 그 CUE의 `defaultBranchId`): 무응답·미분류가 떨어지는 자리라
 *    학습자가 골라 볼 대답이 아니다.
 *  - **⚑CF 분기**: 안전 직결 위반이므로 「가 보시라」고 권할 수 없다.
 *
 * 두 조건을 함께 보는 까닭은, 현행 데이터에서는 둘이 겹치지만(모든 CUE의 defaultBranchId가
 * `…-n`) 그 규약이 나중에 흔들려도 ⚑CF·미분류가 권유 목록으로 새지 않게 하기 위함이다.
 */
function isSuggestableBranch(cue: CueDef, branch: BranchDef): boolean {
  if (branch.criticalFail === true) return false;
  if (branch.id === cue.defaultBranchId) return false;
  return !branch.id.endsWith("-n");
}

/**
 * 이번 세션이 **지나간 CUE들**에서 학습자가 고르지 않은 갈래의 수.
 *
 * 판정도 점수도 아니고, 이미 남아 있는 시나리오 데이터와 세션 이벤트를 세기만 한다
 * (결정론 · 부작용 0 · 시계를 보지 않는다). 재시도로 같은 CUE를 여러 번 지났다면
 * 그때 고른 갈래는 **모두** 가 본 것으로 친다.
 *
 * 지나지 않은 CUE는 애초에 세지 않는다 — 이번 회차가 닿지도 않은 자리를 「남았다」고
 * 세면, 안내가 아니라 미달 통지가 된다.
 *
 * @example
 * unexploredBranches(scenario, session); // 4 — 지나온 자리에 아직 4갈래가 남음
 * unexploredBranches(scenario, allSeen); // 0 — 그 자리들의 갈래를 전부 가 봄
 */
export function unexploredBranches(scenario: Scenario, session: SessionState): number {
  // CUE id는 시나리오마다 다시 매겨지므로(CUE-1은 어느 시나리오에나 있다),
  // 짝이 맞지 않는 세션이 들어오면 남의 갈래를 세지 않도록 여기서 멈춘다.
  if (session.scenarioId !== scenario.id) return 0;

  /** 지나간 CUE id → 그 자리에서 고른 분기 id들 */
  const visited = new Map<string, Set<string>>();
  for (const event of session.events) {
    const cueId = event.cueId;
    if (!cueId) continue;
    let picked = visited.get(cueId);
    if (!picked) {
      picked = new Set<string>();
      visited.set(cueId, picked);
    }
    if (event.feedback) picked.add(event.feedback.branchId);
  }
  if (visited.size === 0) return 0;

  let left = 0;
  for (const turn of scenario.turns) {
    const cue = turn.cue;
    if (!cue) continue;
    const picked = visited.get(cue.id);
    if (!picked) continue;
    for (const branch of cue.branches) {
      if (!isSuggestableBranch(cue, branch)) continue;
      if (picked.has(branch.id)) continue;
      left += 1;
    }
  }
  return left;
}
