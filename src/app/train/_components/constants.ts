/**
 * 훈련 화면 공통 문구·표기 상수.
 *
 * 안전 규칙(브리프 §3)에 걸린 고정 문구는 여기 한 곳에만 두고 화면들이 가져다 씁니다.
 * 점수·등급·순위·백분위 표기는 어떤 상수에도 두지 않습니다.
 */

import type { BadgeTone } from "@/components";
import type { EndingDef, PersonaDef, ScenarioType, Tier } from "@/types";

/** 첫 화면·훈련 시작 전 고정 문구 */
export const PRACTICE_LINE = "정답을 맞히는 시험이 아니라, 말이 나오게 만드는 연습입니다.";

/** 가상 인물 고지 */
export const FICTION_NOTICE = "등장인물은 전원 가상 인물이며 실존 인물·기관과 무관합니다.";

/** L3 진입 전환 문구 */
export const PROTOCOL_HANDOFF_TITLE = "여기서부터 AI가 화면에서 빠집니다";
export const PROTOCOL_HANDOFF_BODY =
  "지금부터는 사전 검수된 고정 안내입니다 · AI 생성 아님";

/** 생성 통제 3계층 표기 — 안전 설계 페이지와 같은 라벨을 씁니다. */
export const TIER_LABEL: Record<Tier, string> = {
  L1: "L1 · 훈련",
  L2: "L2 · 채점",
  L3: "L3 · 실전 응급",
};

export const TIER_TONE: Record<Tier, BadgeTone> = {
  L1: "brand",
  L2: "warn",
  L3: "danger",
};

export const TYPE_TONE: Record<ScenarioType, BadgeTone> = {
  BPSD: "brand",
  EMERGENCY: "danger",
  CONFLICT: "warn",
  RISK: "neutral",
};

/** 엔딩 판정 표기 톤 — 점수가 아니라 상태 표시입니다. */
export const VERDICT_TONE: Record<EndingDef["verdict"], BadgeTone> = {
  충족: "ok",
  "부분 충족": "warn",
  재시도: "warn",
  재훈련: "danger",
  "재훈련 권고": "danger",
};

export const ROLE_LABEL: Record<PersonaDef["role"], string> = {
  care_recipient: "돌봄 대상",
  guardian: "보호자",
  learner: "학습자 (나)",
  dispatcher: "119 상황실",
};

/** 시나리오 상세 경로 — 라우트 파라미터는 소문자로 통일합니다. */
export function scenarioHref(id: string): string {
  return `/train/${id.toLowerCase()}`;
}
