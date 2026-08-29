/**
 * 「안 가 본 갈래」 — 훈련 목록 카드가 쓰는 순수 함수.
 *
 * 엔딩 화면은 방금 끝난 세션의 이벤트를 그대로 들고 있어서 `engine/coverage.ts`의
 * `unexploredBranches(scenario, session)`가 지나온 자리의 남은 갈래를 셉니다.
 * 목록 카드에는 그 세션이 없습니다 — 기기에 남는 회차 기록(`SessionRecord`)에는 분기 id가
 * 들어 있지 않고(발화도 분기 id도 저장하지 않는다는 약속이 먼저입니다), 남는 것은 그때
 * 화면에 드린 **문구**(🟢 충족 문구 · ⚪ 코칭 문구)뿐입니다.
 *
 * 그래서 여기서는 **문구로 갈래를 되짚습니다**. 갈래마다 붙어 있는 문구(praise·coaching)는
 * 시나리오 안에서 서로 겹치지 않으므로(2026-08-30 실측 — 활성 7종에서 권할 수 있는 갈래
 * 185개가 전부 문구를 갖고 있고, 문구 193개는 시나리오 안에서도 전 시나리오를 통틀어도
 * 중복 0건), 기록에 남은 문구를 보면 그 갈래를 지났는지 정확히 알 수 있습니다.
 *
 * 문구를 그대로 브라우저로 내려보내지는 않습니다 — 목록 화면은 시나리오 데이터를 번들에
 * 싣지 않는다는 규율이 이미 있고(`history/_components/nextTraining`의 후보 표와 같은 이유),
 * 갈래 185개의 코칭 문장을 매 방문 실어 보내면 그 규율이 조용히 무너집니다. 대신 문구의
 * **지문**(짧은 해시)만 보내고, 브라우저는 자기 기기에 남은 문구를 같은 방식으로 지문으로
 * 바꿔 맞춰 봅니다. 오가는 것은 지문뿐이고 판정도 점수도 만들지 않습니다.
 *
 * 한 자리만 정확하지 않을 수 있습니다. 갈래 문구는 그 턴의 판정(🟢/⚪)에 따라 골라지므로,
 * 규칙 사전이 그 턴에 항목을 하나 더 얹어 판정이 뒤집히면 갈래에 적힌 문구 대신 기본 문구가
 * 기록에 남습니다 — 그때 그 갈래는 **아직 안 가 본 쪽으로 남습니다**. 틀리는 방향이
 * 「덜 가 봤다」쪽이라 안내로서는 안전하고(가 본 자리를 안 가 봤다고 적을지언정 그 반대는
 * 없습니다), 이 줄이 하는 일은 다시 열 이유를 하나 드리는 것까지입니다.
 *
 * 세는 기준은 종료 화면과 **같은 함수**를 씁니다(`engine/branchScope.ts`의 `isCountableBranch`) —
 * 중립 분기(`…-n` · 그 CUE의 defaultBranchId)와 ⚑CF 분기는 「가 보시라」고 권할 갈래가 아니고,
 * 문구가 없는 갈래는 기록에서 되짚을 수 없어 셈에서 뺍니다. 예전에는 같은 조건을 두 파일이
 * 각자 적어 두고 주석으로 「한쪽을 고치면 다른 쪽도」라고 버티고 있었습니다(2026-08-26 통일).
 * 그 파일은 타입만 가져오므로, 이걸 나눈다고 규칙 사전이 목록 번들에 실리지는 않습니다.
 *
 * **범위는 다릅니다** — 종료 화면은 이번 회차가 지나온 CUE만 세고, 이 카드는 그 상황의 CUE를
 * 전부 셉니다. 그래서 완주 직후 카드 숫자가 종료 화면 숫자보다 큽니다. 셈법을 맞추는 대신
 * 두 자리의 문구가 **무엇을 세고 있는지**를 그대로 적습니다(교육생 3차 P2).
 */

import type { Scenario } from "@/types";
import { branchMessages, isCountableBranch } from "@/engine/branchScope";

/** 갈래 하나 안에서 문구를 잇는 글자 — 그 갈래의 문구가 **하나라도** 맞으면 가 본 것입니다. */
const IN_BRANCH = "|";

/** 갈래끼리 잇는 글자 — 프롭 하나로 넘기려고 문자열로 붙입니다(배열이면 매 렌더 새 참조가 됩니다). */
const BETWEEN_BRANCHES = " ";

/** FNV-1a 32비트 — 짧고 결정론적이면 충분합니다(암호용이 아닙니다). */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * 문구 한 줄의 지문. 기록에 담길 때 앞뒤 공백이 다듬어지므로(scoring.ts) 여기서도 다듬습니다.
 *
 * @example messagePrint(" 지금처럼 이어가 주세요. ") === messagePrint("지금처럼 이어가 주세요.")
 */
export function messagePrint(text: string): string {
  return fnv1a(text.trim()).toString(36);
}

/**
 * 시나리오가 가진 권할 만한 갈래들의 지문표 — 서버에서 한 번 만들어 카드에 실어 보냅니다.
 *
 * @example scenarioBranchPrints(scenario); // "1a2b3c|4d5e 6f7g …"
 */
export function scenarioBranchPrints(scenario: Scenario): string {
  const groups: string[] = [];
  for (const turn of scenario.turns) {
    const cue = turn.cue;
    if (!cue) continue;
    for (const branch of cue.branches) {
      // 문구가 하나도 없는 갈래는 되짚을 방법이 없으므로 셈에서 빠집니다 —
      // 셀 수 없는 것을 「남았다」고 적으면 그 수가 영영 줄지 않습니다.
      // (그 조건까지 `isCountableBranch`가 함께 봅니다 — 종료 화면과 같은 집합을 셉니다.)
      if (!isCountableBranch(cue, branch)) continue;
      groups.push(branchMessages(branch).map(messagePrint).join(IN_BRANCH));
    }
  }
  return groups.join(BETWEEN_BRANCHES);
}

/**
 * 아직 고르지 않은 갈래의 수. 기기에 남은 문구의 지문 집합을 받아 셉니다.
 *
 * @example countUnexplored("aa|bb cc", new Set(["bb"])); // 1
 */
export function countUnexplored(prints: string, seen: Set<string>): number {
  if (prints.length === 0) return 0;
  let left = 0;
  for (const group of prints.split(BETWEEN_BRANCHES)) {
    if (group.length === 0) continue;
    const visited = group.split(IN_BRANCH).some((print) => seen.has(print));
    if (!visited) left += 1;
  }
  return left;
}
