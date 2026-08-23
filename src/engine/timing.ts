/**
 * 침착(ChimChak) 시간 규칙 — CO-03 「119 신고 지연」.
 *
 * 루브릭 CO-03의 행동지표는 "프로토콜상 신고 시점으로부터 90초 이내 119에 연결했는가"이고
 * 판정기가 `rule`로 지정돼 있다(src/data/rubric.ts). 사전(rules.ts)은 **문장**을 보지만
 * 이 항목만은 문장이 아니라 **경과 시간**을 봐야 하므로, 규칙 사전과 같은 결정론 계층에
 * 별도 함수로 둔다. 여기도 생성 모델은 개입하지 않는다.
 *
 * 시계는 두 지점 사이를 잰다.
 *  - 신고 결정 시점 = 완전 폐쇄 같은 응급 신호가 **화면에 뜬 순간**(= 그 턴에 들어온 시각).
 *    직전 결정이 끝난 시각이라 세션 이벤트의 타임스탬프만으로 구할 수 있다.
 *  - 119 연결      = 학습자가 CO-03을 채점하는 분기를 고른 순간(이벤트의 at).
 * 같은 CUE에서 ⚑CF로 멈췄다가 다시 시도해도 시계는 되감지 않는다 — 실제로 흐른 시간이므로
 * 턴에 들어온 시각을 기준으로 잡는다(currentTurnEnteredAt 참조).
 *
 * 앵커(rubric.ts CO-03)와 그대로 맞춘다.
 *   4점 90초 이내 · 3점 90~180초 · 2점 180초 초과 · 1점 미신고 ⚑CF
 * 미신고(1점)는 시간으로 잴 수 없어 시나리오 데이터의 ⚑CF 분기가 맡는다 —
 * 현재 그 자리는 CHK-B02 CUE-3의 D3-d(「신고하지 않기로 함」)이다. 그 분기가 없으면
 * 이 주석과 루브릭 앵커가 데이터에 없는 판정을 가리키게 되므로 함께 확인한다.
 * 이 파일이 판정하는 것은 **연결까지 걸린 시간**뿐이다.
 */

import type { RubricHit, SessionEvent } from "@/types";

/** 이 규칙이 채점하는 루브릭 항목 */
export const CALL_DELAY_ITEM_ID = "CO-03";

/** 충족선 — 이 초 안에 연결하면 4점 */
export const CALL_DELAY_MET_SEC = 90;

/** 지연선 — 이 초를 넘기면 2점 */
export const CALL_DELAY_LATE_SEC = 180;

/** 근거 문서 (rubric.ts CO-03과 같은 문서) */
export const CALL_DELAY_DOC_ID = "DOC-GUIDE-004";

export interface CallDelayFinding {
  itemId: typeof CALL_DELAY_ITEM_ID;
  /** 신고 결정 시점부터 119 연결까지 걸린 초 (내림) */
  elapsedSec: number;
  score: 1 | 2 | 3 | 4;
  /** 3점 이상이면 충족 */
  met: boolean;
  /** 충족선을 넘겼을 때 화면에 띄울 코칭 한 문장 (충족이면 undefined) */
  message?: string;
  docId: string;
}

/**
 * 경과 시간으로 CO-03을 판정한다.
 *
 * @example
 * judgeCallDelay(12_000).score;   // 4
 * judgeCallDelay(120_000).score;  // 3
 * judgeCallDelay(200_000).score;  // 2
 */
export function judgeCallDelay(elapsedMs: number): CallDelayFinding {
  const elapsedSec = Math.max(0, Math.floor(elapsedMs / 1000));
  const base = { itemId: CALL_DELAY_ITEM_ID, elapsedSec, docId: CALL_DELAY_DOC_ID } as const;
  if (elapsedSec <= CALL_DELAY_MET_SEC) {
    return { ...base, score: 4, met: true };
  }
  if (elapsedSec <= CALL_DELAY_LATE_SEC) {
    return { ...base, score: 3, met: true };
  }
  return {
    ...base,
    score: 2,
    met: false,
    // 숫자는 초만 말합니다 — 점수·등급으로 읽히지 않도록 기준선과 나란히 적습니다.
    message: `119 연결까지 ${elapsedSec}초가 걸렸습니다. 소리가 사라진 순간이 신고 시점이니, ${CALL_DELAY_MET_SEC}초 안에 눌러 주세요.`,
  };
}

/** CO-03을 채점하는 분기인지 — 이 분기를 고른 순간이 「119 연결」이다. */
export function isCallHandoff(hits: readonly RubricHit[]): boolean {
  return hits.some((hit) => hit.itemId === CALL_DELAY_ITEM_ID);
}

/**
 * 지금 답하고 있는 턴에 **들어온 시각**.
 *
 * 세션 이벤트를 뒤에서부터 훑어 현재 턴이 아닌 첫 이벤트의 시각을 쓴다. 그런 이벤트가 없으면
 * 세션 시작 시각이다. 같은 턴에서 여러 번 시도(⚑CF 재시도)해도 그 시도들은 건너뛰므로,
 * 시계는 화면에 응급 신호가 뜬 순간부터 끊기지 않고 흐른다.
 *
 * @example
 * currentTurnEnteredAt([{ turnId: "T2", viaButton: true, at: 1000 }], "T3", 500); // 1000
 */
export function currentTurnEnteredAt(
  events: readonly SessionEvent[],
  turnId: string,
  startedAt: number,
): number {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (!event) continue;
    if (event.turnId !== turnId) return event.at;
  }
  return startedAt;
}
