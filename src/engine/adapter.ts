/**
 * 경량 LLM 교체형 어댑터 자리 — **검증(근거 가드) 통과 구간부터 개방합니다.**
 *
 * 지금 이 앱의 판정은 전부 결정론입니다. 발화는 시나리오 데이터의 분기 패턴으로 분류하고
 * (classify.ts), 치명적 판정은 법령·지침 사전으로만 내립니다(rules.ts). 나중에 경량 LLM을
 * 붙이더라도 **그 자리가 어디인지 타입으로 못 박아 두는 것**이 이 파일의 목적입니다.
 *
 * 개방 조건 — 아래를 만족하는 구간부터만 어댑터를 갈아 끼웁니다.
 * ① ⚑CF 판정 구간은 열지 않습니다. 치명적 판정은 사전이 단독으로 내립니다(설계서 §5.2).
 * ② 어댑터가 돌려준 판정에 붙은 근거 docId는 근거 가드(evidence.ts)를 통과해야 합니다.
 *    목록 밖 근거를 들고 오면 판정을 쓰지 않고 고정 문구로 넘깁니다.
 * ③ 어댑터에 넘기는 발화는 가명처리(masking.ts)를 통과한 문자열이어야 합니다.
 *
 * 지금 열린 자리는 **하나뿐입니다 — 코칭(UtteranceCoach)**.
 * 판정 자리(UtteranceJudge)는 여전히 결정론 구현 하나이고, 아무도 다른 구현으로 갈아 끼우지
 * 않았습니다. 두 계약을 한 파일에 나란히 두는 이유가 그것입니다: 「무엇이 열렸고 무엇이 닫혀
 * 있는가」를 타입 두 개의 구현 목록으로 바로 확인할 수 있어야 합니다.
 *
 * 코칭 자리의 실제 구현은 `src/lib/onlineCoach.ts`이며, 위 ②·③ 조건을 그 안에서 지킵니다
 * (근거 가드 4단 + 발화 가명처리). 판정·게이지·기록은 그 구현이 한 글자도 건드리지 않습니다.
 */

import type { BranchDef, CueDef } from "@/types";
import { classifyInput, type ClassifySource } from "./classify";

/** 판정 한 건의 결과 — 분기와 그 분기를 고른 근거(출처)입니다. */
export interface JudgeResult {
  branch: BranchDef;
  /** 무엇이 이 분기를 골랐는가 (버튼·⚑CF 패턴·일반 패턴·미일치) */
  source: ClassifySource;
  /** 어떤 패턴에 걸렸는지 — 설명·디버깅용이며 화면 문구로 쓰지 않습니다 */
  matchedPattern?: string;
  /** 결정론 판정인지 — false면 근거 가드를 한 번 더 통과시킨 뒤에만 씁니다 */
  deterministic: boolean;
}

/**
 * 발화를 분기로 판정하는 주체.
 *
 * 결정론 구현과 경량 LLM 구현이 같은 모양을 갖도록 하는 계약입니다.
 * 비동기인 이유는 교체 대상이 네트워크나 로컬 추론을 탈 수 있어서이며,
 * 현행 구현은 즉시 이행된 Promise를 돌려줍니다.
 */
export interface UtteranceJudge {
  /** 사람이 읽는 구현 이름 — 화면에 「무엇이 판정했는가」를 적을 때 씁니다 */
  readonly name: string;
  judge(cue: CueDef, utterance: string): Promise<JudgeResult>;
}

/**
 * 현행 구현 — 시나리오 데이터의 분기 패턴만 보는 결정론 판정기.
 *
 * @example
 * const result = await DETERMINISTIC_JUDGE.judge(cue, "마음이 급하시겠어요");
 * result.deterministic; // true
 */
export const DETERMINISTIC_JUDGE: UtteranceJudge = {
  name: "규칙 판정기",
  async judge(cue: CueDef, utterance: string): Promise<JudgeResult> {
    const result = classifyInput(cue, { utterance });
    return {
      branch: result.branch,
      source: result.source,
      matchedPattern: result.matchedPattern,
      deterministic: true,
    };
  },
};

/* ── 코칭 자리는 여기가 아니라 lib에 있습니다 ──────────────
   판정과 코칭은 계약을 나눠 두었습니다. 이 파일의 `UtteranceJudge`는 분기를 고르는 자리라
   게이지·점수·엔딩에 직접 닿고, 그래서 아직 닫혀 있습니다. 코칭은 화면에 문장을 한 덩어리
   덧붙일 뿐이라 판정에 닿을 길이 구조적으로 없고, 그쪽만 열었습니다
   (`src/lib/onlineCoach.ts` — 요청 만들기·가드 4단·결과 보관까지 한 파일에 있습니다).

   두 자리를 한 계약으로 묶지 않은 것이 요점입니다. 묶어 두면 코칭 구현을 갈아 끼우다가
   판정 구현까지 갈아 끼울 수 있는 문이 열립니다. */
