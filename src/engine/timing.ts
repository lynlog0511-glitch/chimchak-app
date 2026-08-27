/**
 * 침착(ChimChak) 시간 규칙 — **세션 이벤트의 시각으로만 내리는 판단**을 모아 둔다.
 *
 * 여기 사는 것은 둘이고, 목적이 서로 다르다.
 *  ① CO-03 「119 신고 지연」 — 루브릭 **판정**이다(아래 전문).
 *  ② 회차의 **진행 시간** — 이수 확인서가 증빙으로 적는 시수의 산정이다(`activeSeconds`).
 * 둘 다 `SessionEvent.at`만 읽고 생성 모델은 개입하지 않는다. 다만 **값을 공유하지 않는다** —
 * 하나는 현장 프로토콜이 정한 판정선이고 하나는 회계 상한이라, 같은 수여야 할 이유가 없다.
 *
 * ── ① CO-03 「119 신고 지연」 ──
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

/* ── ② 회차의 진행 시간 (이수 시수 산정) ────────────────────── */

/**
 * 한 턴에서 **정지로 인정하는 상한(초)**. 이보다 오래 멈춰 있던 구간은 이 값까지만 센다.
 *
 * ── 왜 180초인가 (실측 근거) ──
 * ⓐ **설계 예산**: 시나리오의 `durationMin`을 응답 턴 수로 나누면 한 턴에 주어진 시간이 나온다 —
 *    A01 26.7초 · B01 30.0초 · A02 33.3초 · B02 37.5초 · C02 40.0초 · C01 42.9초(가장 넉넉).
 * ⓑ **읽고 듣는 시간**: 한 턴에 화면으로 나가는 가장 긴 대사가 63자(C01 T1)이고, 낭독까지
 *    쳐도 13초 남짓이다. 읽고·생각하고·말하는 시간을 다 합쳐도 ⓐ 안에 들어간다.
 * ⓒ 그래서 180초는 **가장 넉넉한 설계 예산(42.9초)의 4.2배**다. 느리게 진행하시는 분을 깎지
 *    않으면서, 자리를 비운 구간은 턴당 3분에서 멈춘다.
 *
 * 참고로 이 저장소는 「한 결정에 3분이면 현장에서 지체다」를 이미 한 번 적어 두었다
 * (`CALL_DELAY_LATE_SEC` = 180초, CO-03 지연선). 눈금이 같은 것은 우연이 아니지만 **상수를
 * 묶지는 않는다** — 저쪽은 루브릭 판정선이라 앵커 문서가 바뀌면 따라 움직이고, 이쪽은 시수
 * 회계 상한이라 증빙 관행이 바뀌면 따로 움직인다. 한쪽을 고칠 때 다른 쪽이 조용히 끌려가면
 * 그것이 곧 문서 드리프트다.
 */
export const TURN_IDLE_CAP_SEC = 3 * 60;

/**
 * 회차의 **진행 시간(초)** — 확인서가 이수 시수로 적는 값이다.
 *
 * 세는 방법: 「시작 → 첫 응답 → 다음 응답 → … → 마지막 응답 → 종료」의 **구간을 하나씩 더하되,
 * 구간마다 `TURN_IDLE_CAP_SEC`을 넘는 몫은 버린다.** 벽시계(`endedAt − startedAt`)를 그대로 쓰면
 * 4분짜리 시나리오를 열어 둔 채 25분 자리를 비운 회차가 25분으로 확인서에 실리는데, 그 종이에
 * 서명하는 사람은 기관장이다. 실사에서 「4분 시나리오가 왜 25분입니까」에 답할 문장이 상한
 * 고지뿐이면 그건 답이 아니다. 그래서 **자리를 비운 시간은 턴당 상한까지만 센다.**
 *
 * 시각이 거꾸로 간 이벤트(기기 시계 변경)는 건너뛴다 — 없는 시간을 지어내지도, 음수로 깎지도
 * 않는다. 회차 전체의 상한(30분)은 여기서 보지 않는다. 그것은 저장·집계 쪽 규칙이라
 * `lib/storage.ts`의 `MAX_SESSION_SEC`이 한 자리에서 건다.
 *
 * @example
 * // 시작 0s → 응답 30s → (25분 정지) → 응답 → 종료: 30 + 180 = 210
 * activeSeconds([{ turnId: "T1", viaButton: true, at: 30_000 },
 *                { turnId: "T2", viaButton: true, at: 1_530_000 }], 0, 1_530_000); // 210
 */
export function activeSeconds(
  events: readonly SessionEvent[],
  startedAt: number,
  endedAt: number,
): number {
  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt)) return 0;
  const capMs = TURN_IDLE_CAP_SEC * 1000;
  let total = 0;
  let previous = startedAt;

  for (const event of events) {
    const at = event?.at;
    // 앞선 시각보다 이르거나 읽을 수 없는 값은 구간을 만들지 못한다(시계를 되감지 않는다).
    if (typeof at !== "number" || !Number.isFinite(at) || at <= previous) continue;
    total += Math.min(at - previous, capMs);
    previous = at;
  }

  // 마지막 응답부터 종료 화면이 뜬 순간까지 — 보통 한 박자지만, 여기도 같은 상한을 건다.
  if (endedAt > previous) total += Math.min(endedAt - previous, capMs);

  return Math.round(total / 1000);
}
