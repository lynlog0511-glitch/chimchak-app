/**
 * 규칙 엔진이 **단독으로** 판정하는 루브릭 항목 — 코드에서 세어 온 값.
 *
 * 화면의 단언(「규칙 엔진이 단독 판정하는 N항목」)이 코드보다 앞서 나가지 않도록,
 * 세는 곳을 이 파일 하나로 모은다. 두 갈래를 합친다.
 *  - 규칙 사전(rules.ts)이 문장으로 잡는 항목
 *  - 시간 규칙(timing.ts)이 경과 초로 잡는 항목 (CO-03 · 119 지연)
 */

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
