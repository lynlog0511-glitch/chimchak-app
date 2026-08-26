/**
 * 「갈래를 센다」는 말의 **한 벌짜리 정의**.
 *
 * 갈래 수를 세는 자리가 둘입니다 — 종료 화면(`engine/coverage.ts`의 `unexploredBranches`)과
 * 훈련 목록 카드(`app/train/_components/unexplored.ts`). 두 자리가 세는 **범위**는 다릅니다:
 * 종료 화면은 이번 회차가 지나온 CUE만 보고, 목록 카드는 그 상황의 CUE 전부를 봅니다.
 * 그건 각 자리에 맞는 값이라 통일하지 않습니다(문구가 무엇을 세는지 밝힙니다).
 *
 * 통일해야 하는 것은 **무엇을 한 갈래로 치는가**입니다. 그전에는 두 파일이 같은 조건을
 * 각자 적어 두고 「한쪽을 고치면 다른 쪽도 같이 고쳐야 한다」는 주석으로 버티고 있었습니다.
 * 그러다 조건이 갈라지면 같은 상황의 두 숫자가 서로 다른 것을 세게 됩니다 — 사용자에게는
 * 그냥 「숫자가 틀린 앱」입니다. 그래서 조건을 여기 한 곳에 둡니다.
 *
 * 이 파일은 **타입만** 가져옵니다(런타임 의존 0). 훈련 목록 화면은 시나리오 데이터도 규칙
 * 사전도 번들에 싣지 않는다는 규율이 있어서, 이 조건 하나를 나누자고 `coverage.ts`를
 * 통째로 끌어오면(→ `rules.ts`) 그 규율이 조용히 무너집니다.
 */

import type { BranchDef, CueDef } from "@/types";

/**
 * 「가 볼 길」로 권할 수 있는 갈래인가 — 두 가지는 세지 않는다.
 *
 *  - **중립 분기**(`…-n` · 그 CUE의 `defaultBranchId`): 무응답·미분류가 떨어지는 자리라
 *    학습자가 골라 볼 대답이 아니다.
 *  - **⚑CF 분기**: 안전 직결 위반이므로 「가 보시라」고 권할 수 없다.
 *
 * 두 조건을 함께 보는 까닭은, 현행 데이터에서는 둘이 겹치지만(모든 CUE의 defaultBranchId가
 * `…-n`) 그 규약이 나중에 흔들려도 ⚑CF·미분류가 권유 목록으로 새지 않게 하기 위함이다.
 *
 * @example isSuggestableBranch(cue, branch); // false — cue.defaultBranchId와 같은 분기
 */
export function isSuggestableBranch(cue: CueDef, branch: BranchDef): boolean {
  if (branch.criticalFail === true) return false;
  if (branch.id === cue.defaultBranchId) return false;
  return !branch.id.endsWith("-n");
}

/**
 * 그 갈래를 기록에서 **되짚을 수 있게 하는 문구**들 (🟢 충족 문구 · ⚪ 코칭 문구).
 *
 * 목록 카드는 기기에 남은 회차 기록의 문구로 갈래를 되짚습니다 — 기록에 분기 id를 남기지
 * 않기 때문입니다(`unexplored.ts` 머리주석). 문구가 하나도 없는 갈래는 되짚을 방법이 없어
 * 그 자리에서 셈에서 빠지는데, 그러면 종료 화면과 목록 카드가 **다른 집합**을 세게 됩니다.
 * 그래서 두 자리 모두 이 함수를 지나게 하고, 「문구가 있는가」를 같은 조건으로 봅니다.
 *
 * 지금 전 시나리오의 권할 만한 갈래는 전부 문구를 갖고 있어 이 조건으로 빠지는 갈래는
 * 0건입니다(tests/newScenarioFairness.test.ts가 그 사실을 붙들고 있습니다).
 *
 * @example branchMessages(branch); // ["집에 가고 싶은 마음을 먼저 알아주셨습니다."]
 */
export function branchMessages(branch: BranchDef): string[] {
  return [branch.praise, branch.coaching].filter(
    (text): text is string => typeof text === "string" && text.trim().length > 0,
  );
}

/**
 * 목록 카드가 쓰는 조건 — 권할 만하고, **기록에서 되짚을 수 있는** 갈래인가.
 *
 * 종료 화면(`coverage.ts`)은 세션 이벤트에 분기 id를 그대로 들고 있어 문구가 필요 없고,
 * 목록 카드는 기록에 남은 문구로만 되짚으므로 이 조건이 한 겹 더 붙습니다 — 셈법의 차이가
 * 아니라 **되짚는 수단의 차이**입니다. 실제 데이터에서 이 조건으로 빠지는 갈래는 0건이고
 * (tests/newScenarioFairness.test.ts가 그 사실을 붙들고 있습니다), 그래서 두 자리는 같은
 * 집합을 셉니다. 문구 없는 갈래가 새로 들어오면 그 테스트가 먼저 알려 줍니다.
 *
 * @example isCountableBranch(cue, branch); // true
 */
export function isCountableBranch(cue: CueDef, branch: BranchDef): boolean {
  return isSuggestableBranch(cue, branch) && branchMessages(branch).length > 0;
}
