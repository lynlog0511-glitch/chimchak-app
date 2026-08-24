/**
 * 규칙 엔진 시연용 예시 문장 표 (발표·시연 전용).
 *
 * 왜 필요한가 — 버튼 폴백으로 분기를 고르면 판정한 것은 **시나리오 데이터**이고,
 * `src/engine/rules.ts`의 규칙 사전(신체 억제·허용 범위 밖 행위·현실 직면·호칭·개인정보)은
 * **자유 발화에만** 돌아갑니다(`session.ts`의 `utterance.length > 0 && !input.branchId` 조건).
 * 그래서 버튼만 눌러 시연하면 규칙 엔진이 한 번도 실행되지 않습니다.
 * 이 표는 그 사전을 무대에서 오타 없이 한 번에 발동시키기 위한 문장 모음입니다.
 *
 * 지키는 원칙
 * - 버튼은 **입력창을 채우기만** 하고 전송하지 않습니다. 보내는 것은 사람이 합니다(조작 아님).
 * - 문장은 전부 `src/engine/rules.ts`의 사전 용어와 실제로 대조해 확정했습니다.
 *   (`matchedTerm`이 그 사전에 들어 있는 신호이고, `ruleId`가 발동하는 규칙입니다.)
 * - 점수·등급 표기는 두지 않습니다. 표기는 ⚑CF(전면 인터럽트) / 코칭 두 갈래뿐이고,
 *   화면의 마크는 이모지가 아니라 StatusMark가 그립니다.
 *
 * 대조 결과 메모 (2026-08-04, rules.ts 대조)
 * - "물 한 모금 드려서 넘겨 보겠습니다"는 **걸리지 않습니다**. 사전 용어가 "물 한 잔 드"·"물을 드"
 *   형태라 "물 한 모금 드"는 부분 일치가 되지 않습니다 → "물 한 잔 드려서 …"로 바꿔 확정했습니다.
 * - "여기가 어르신 집이에요"도 **걸리지 않습니다**. 사전 용어가 "여기가 집이에요"인데 사이에
 *   "어르신"이 끼어들어 부분 문자열이 끊깁니다 → "어르신, 여기가 집이에요."로 바꿔 확정했습니다.
 * - 액체·음식 관련 ⚑CF는 응급이 끝난 보고 구간(CUE-5·CUE-T2·CUE-6·CUE-7)에서 사전이 스스로
 *   비활성화됩니다(rules.ts의 `skipCues`). 그 구간에서는 해당 예시를 숨깁니다 — `skipCueIds`.
 */

import { POST_EMERGENCY_CUES } from "@/engine/rules";
import type { ScenarioType } from "@/types";

/** 접이식 제목 */
export const RULE_DEMO_TITLE = "규칙 엔진 시험해 보기 (발표·시연용)";

/** 접이식 안을 여는 설명 한 줄 */
export const RULE_DEMO_NOTE =
  "이 문장들은 규칙 엔진(AI 밖 결정론 판정)이 무엇을 잡는지 보여 드리기 위한 예시입니다.";

/** 자동 전송하지 않는다는 안내 */
export const RULE_DEMO_HINT =
  "누르면 위 입력창에 문장이 채워지기만 합니다. 보내실지는 직접 「이 내용으로 답하기」를 눌러 정해 주세요.";

/** ⚑CF 예시가 없는 유형(갈등)에서 대신 보여 드리는 안내 */
export const RULE_DEMO_NO_CRITICAL_NOTE =
  "이 유형은 안전 위험이 아니라 존엄·관계를 다루므로 ⚑CF를 적용하지 않습니다. 규칙 엔진은 코칭으로만 남깁니다.";

/** 규칙 엔진이 내리는 두 갈래 — 점수·등급은 두지 않습니다. */
export type RuleDemoKind = "critical" | "coaching";

export interface RuleDemoExample {
  id: string;
  /** 입력창에 그대로 채워 넣는 문장 */
  sentence: string;
  /** 버튼 옆 한 줄 — 예상 발동 규칙 소개 */
  expectation: string;
  /** src/engine/rules.ts 규칙 id */
  ruleId: string;
  /** 루브릭 항목 id (점수가 아니라 항목 이름표입니다) */
  itemId: string;
  /** 규칙 이름 */
  ruleLabel: string;
  /** 사전에서 실제로 걸리는 신호 (rules.ts의 terms 원문) */
  matchedTerm: string;
  kind: RuleDemoKind;
  /** 지정하면 해당 유형에서만 보여 드립니다 (미지정 = 전 유형) */
  onlyTypes?: ScenarioType[];
  /** 이 CUE에서는 사전이 스스로 비활성화되므로 숨깁니다 */
  skipCueIds?: string[];
}

/**
 * 액체·음식 ⚑CF가 꺼지는 구간 — rules.ts의 POST_EMERGENCY_CUES와 같은 값입니다.
 * (응급이 끝난 뒤 "물을 드린 사실도 기록하겠습니다" 같은 회고 진술을 잡지 않기 위한 게이트)
 */
/* 값의 원본은 엔진(rules.ts) 하나뿐입니다 — 두 벌이 갈라지면 UI 단언이 조용히 거짓이 됩니다. */

export const RULE_DEMO_EXAMPLES: RuleDemoExample[] = [
  /* ── 치매 행동심리증상(BPSD) ── */
  {
    id: "demo-restraint-hold",
    sentence: "어르신, 손목을 붙잡고 못 나가시게 하겠습니다.",
    expectation: "→ 신체 억제 사전이 「붙잡」을 즉시 잡아 ⚑CF로 멈춰 세웁니다 · 생성 없음",
    ruleId: "CF-RESTRAINT",
    itemId: "CO-02",
    ruleLabel: "신체 자유 제한",
    matchedTerm: "붙잡",
    kind: "critical",
    onlyTypes: ["BPSD"],
  },
  {
    id: "demo-restraint-lock",
    sentence: "문을 잠그고 못 나가시게 하겠습니다.",
    expectation: "→ 같은 사전의 다른 신호 「문을 잠」도 그대로 잡습니다 · 생성 없음",
    ruleId: "CF-RESTRAINT",
    itemId: "CO-02",
    ruleLabel: "신체 자유 제한",
    matchedTerm: "문을 잠",
    kind: "critical",
    onlyTypes: ["BPSD"],
  },
  {
    id: "demo-reality-home",
    sentence: "어르신, 여기가 집이에요.",
    expectation: "→ 현실 직면 사전이 「여기가 집이에요」를 잡아 코칭으로 남깁니다 · 생성 없음",
    ruleId: "WARN-REALITY",
    itemId: "RE-02",
    ruleLabel: "현실 직면 강요",
    matchedTerm: "여기가 집이에요",
    kind: "coaching",
    onlyTypes: ["BPSD"],
  },

  /* ── 응급 초기 대응(EMERGENCY) ── */
  {
    id: "demo-fluid",
    sentence: "물 한 잔 드려서 넘겨 보시게 하겠습니다.",
    expectation: "→ 허용 범위 밖 행위 사전이 「물 한 잔 드」를 잡아 ⚑CF로 멈춰 세웁니다 · 생성 없음",
    ruleId: "CF-FLUID",
    itemId: "CO-01",
    ruleLabel: "액체 제공",
    matchedTerm: "물 한 잔 드",
    kind: "critical",
    onlyTypes: ["EMERGENCY"],
    skipCueIds: POST_EMERGENCY_CUES,
  },
  {
    id: "demo-oral",
    sentence: "입에 손을 넣어 빼내 드리겠습니다.",
    expectation: "→ 같은 사전이 「입에 손을 넣」을 잡아 119 이양으로 돌려세웁니다 · 생성 없음",
    ruleId: "CF-ORAL",
    itemId: "CO-01",
    ruleLabel: "구강 내 조작",
    matchedTerm: "입에 손을 넣",
    kind: "critical",
    onlyTypes: ["EMERGENCY"],
  },

  /* ── 이용자·보호자 갈등(CONFLICT) ── */
  {
    id: "demo-reality-said",
    sentence: "아까도 말씀드렸잖아요.",
    expectation:
      "→ 현실 직면 사전이 「아까도 말씀드렸잖아요」를 잡아 코칭으로 남깁니다 · 생성 없음",
    ruleId: "WARN-REALITY",
    itemId: "RE-02",
    ruleLabel: "현실 직면 강요",
    matchedTerm: "아까도 말씀드렸잖아요",
    kind: "coaching",
    onlyTypes: ["CONFLICT"],
  },
  {
    id: "demo-title",
    sentence: "아줌마, 진정 좀 하세요.",
    expectation: "→ 호칭 사전이 「아줌마」를 잡아 코칭으로 남깁니다 · 생성 없음",
    ruleId: "WARN-TITLE",
    itemId: "CO-07",
    ruleLabel: "호칭·존칭 위반",
    matchedTerm: "아줌마",
    kind: "coaching",
    onlyTypes: ["CONFLICT"],
  },

  /* ── 전 유형 공통 (보안) ── */
  {
    id: "demo-pii",
    sentence: "보호자님께 010-1234-5678로 지금 전화드리겠습니다.",
    expectation: "→ 가명처리 규칙이 전화번호를 「번호」로 알아보고 코칭으로 남깁니다 · 생성 없음",
    ruleId: "WARN-PII",
    itemId: "CO-08",
    ruleLabel: "개인정보 노출",
    matchedTerm: "번호",
    kind: "coaching",
    onlyTypes: ["EMERGENCY", "CONFLICT"],
  },
];

/**
 * 지금 화면(시나리오 유형 + CUE)에서 **실제로 발동하는** 예시만 골라 줍니다.
 *
 * @example
 * ruleDemoExamplesFor("EMERGENCY", "CUE-3").map((e) => e.ruleId); // ["CF-FLUID", "CF-ORAL", "WARN-PII"]
 * ruleDemoExamplesFor("EMERGENCY", "CUE-6").map((e) => e.ruleId); // ["CF-ORAL", "WARN-PII"]
 */
export function ruleDemoExamplesFor(type: ScenarioType, cueId: string): RuleDemoExample[] {
  return RULE_DEMO_EXAMPLES.filter((example) => {
    if (example.onlyTypes && !example.onlyTypes.includes(type)) return false;
    if (example.skipCueIds && example.skipCueIds.includes(cueId)) return false;
    return true;
  });
}
