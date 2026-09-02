/**
 * 훈련 진행 위치 계산.
 *
 * 분모는 시나리오에 들어 있는 모든 CUE 수가 아니라, 현재 갈래에서 실제로 도달할 수 있는
 * CUE 수입니다. 서로 배타적인 돌발 턴을 한꺼번에 더하지 않습니다.
 */

import type { CueDef, Scenario, SessionState } from "@/types";

export interface CueProgress {
  /** 지금 진행 중인 단계 번호 (1부터) */
  index: number;
  /** 현재 갈래에서 끝까지 진행할 때의 실제 단계 수 */
  total: number;
}

const END_PREFIX = "end:";
const PROTOCOL_PREFIX = "protocol:";

function turnIdFromNext(next: string | undefined): string | undefined {
  if (!next || next.startsWith(END_PREFIX)) return undefined;
  return next.startsWith(PROTOCOL_PREFIX) ? next.slice(PROTOCOL_PREFIX.length) : next;
}

/**
 * 화면의 대표 경로와 같은 선택: 중단·재훈련·미분류를 빼고 초조도를 가장 낮추는 답을 고릅니다.
 * 같은 값이면 시나리오에 먼저 적힌 검수 답을 유지합니다.
 */
function preferredNext(cue: CueDef, visited: ReadonlySet<string>): string | undefined {
  const safe = cue.branches.filter(
    (branch) =>
      !branch.criticalFail &&
      !branch.retrainAdvice &&
      branch.id !== cue.defaultBranchId,
  );
  const candidates = safe.length > 0 ? safe : cue.branches.filter((branch) => !branch.criticalFail);
  const advancing = candidates.filter((branch) => {
    const nextId = turnIdFromNext(branch.next);
    return !nextId || !visited.has(nextId);
  });
  const choices = advancing.length > 0 ? advancing : candidates;
  const first = choices[0];
  if (!first) return undefined;
  const preferred = choices.reduce((best, branch) =>
    branch.gaugeDelta < best.gaugeDelta ? branch : best,
  );
  return preferred.next;
}

/** 이미 지난 턴을 다시 세지 않으면서 대표 정상 경로의 남은 CUE를 셉니다. */
function remainingCueCount(
  scenario: Scenario,
  fromTurnId: string | undefined,
  visited: ReadonlySet<string>,
): number {
  if (!fromTurnId || visited.has(fromTurnId)) return 0;
  const turn = scenario.turns.find((item) => item.id === fromTurnId);
  if (!turn) return 0;

  const nextVisited = new Set(visited);
  nextVisited.add(turn.id);

  if (!turn.cue) {
    return remainingCueCount(scenario, turnIdFromNext(turn.autoNext), nextVisited);
  }

  const next = preferredNext(turn.cue, nextVisited);
  return 1 + remainingCueCount(scenario, turnIdFromNext(next), nextVisited);
}

/** 브리핑에서 보여 줄 대표 정상 경로의 실제 단계 수. */
export function scenarioPracticeStepCount(scenario: Scenario): number {
  return Math.max(remainingCueCount(scenario, scenario.entryTurnId, new Set()), 1);
}

/**
 * 현재 진행 위치.
 *
 * 이미 선택한 갈래는 세션 이벤트로 확정하고, 아직 선택하지 않은 뒤쪽만 현재 턴에서 다시 셉니다.
 * 같은 CUE를 재시도한 이벤트는 한 단계로만 셉니다.
 */
export function cueProgress(
  scenario: Scenario,
  session: SessionState,
  cue?: CueDef,
): CueProgress {
  const answeredCueIds = new Set<string>();
  const answeredTurnIds = new Set<string>();
  for (const event of session.events) {
    if (!event.cueId) continue;
    answeredCueIds.add(event.cueId);
    answeredTurnIds.add(event.turnId);
  }

  const cueWasAnswered = Boolean(cue && answeredCueIds.has(cue.id));
  const index = cue
    ? cueWasAnswered
      ? Math.max(1, answeredCueIds.size)
      : answeredCueIds.size + 1
    : answeredCueIds.size;

  // 현재 턴의 앞선 시도는 단계 하나로 합치되, 현재 턴 자체는 남은 경로에 한 번 포함합니다.
  answeredTurnIds.delete(session.currentTurnId);
  const completedBeforeCurrent = Math.max(0, answeredCueIds.size - (cueWasAnswered ? 1 : 0));
  const remaining = remainingCueCount(scenario, session.currentTurnId, answeredTurnIds);
  const total = Math.max(completedBeforeCurrent + remaining, index, 1);

  return { index, total };
}
