/**
 * 세션 진행 위치 계산 (시안 4a① — 6칸 세그먼트 진행바).
 *
 * 점수·백분율이 아니라 **지금 몇 번째 상황인가**만 셉니다.
 * 칸 수는 cue가 붙은 턴 수(대략치)이고, 고르신 갈래에 따라 실제로 지나는 상황 수는 달라집니다.
 */

import type { CueDef, Scenario, SessionState } from "@/types";

export interface CueProgress {
  /** 지금 진행 중인 상황 번호 (1부터) */
  index: number;
  /** 대략 몇 개 상황인지 — 진행바의 칸 수 */
  total: number;
}

/**
 * 진행 위치.
 *
 * @example
 * cueProgress(scenario, session, cue); // { index: 3, total: 6 }
 */
export function cueProgress(
  scenario: Scenario,
  session: SessionState,
  cue?: CueDef,
): CueProgress {
  const cueTurnCount = scenario.turns.filter((turn) => Boolean(turn.cue)).length;

  const answered = new Set<string>();
  for (const event of session.events) {
    if (event.cueId) answered.add(event.cueId);
  }

  // 같은 CUE를 다시 하고 계시면 번호가 되돌아가지 않도록 이미 센 것으로 봅니다.
  const index = cue
    ? answered.has(cue.id)
      ? Math.max(1, answered.size)
      : answered.size + 1
    : answered.size;

  return { index, total: Math.max(cueTurnCount, index, 1) };
}
