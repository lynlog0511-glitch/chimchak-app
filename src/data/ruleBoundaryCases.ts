/**
 * 규칙 엔진 경계 케이스 — **저장소에 커밋된 검증 데이터**입니다.
 *
 * 기획서 검증 계단 ①의 「경계 케이스 30/30 전수 통과」는 지금까지 화면에 옮겨 적은 인용치였습니다.
 * 그 문장이 증빙이 되려면 케이스가 코드 옆에 있고 아무 때나 다시 돌아가야 합니다 — 이 파일이
 * 그 30건이고, `runEngineSelfCheck`(src/engine/boundaryCheck.ts)가 브라우저에서 그대로 돌립니다.
 *
 * 고르는 기준은 「걸려야 하는 문장」이 아니라 **걸리면 안 되는 문장**입니다. 훈련 도중 옳은
 * 답을 ⚑CF로 잘못 멈춰 세우는 쪽이 놓치는 쪽보다 나쁘기 때문에, 부정 표현·예외어·유형 게이트
 * ·국면 게이트·적용 항목표 게이트를 쌍으로 넣었습니다(같은 문장을 조건만 바꿔 두 번 넣은
 * 짝이 네 쌍 있습니다 — bc-10/11, bc-12/13, bc-29/30, bc-02/05).
 */

import type { CallDelayBoundaryCase, EvidenceBoundaryCase, RuleBoundaryCase } from "@/engine";

/** 규칙 사전 경계 문장 30건. */
export const RULE_BOUNDARY_CASES: readonly RuleBoundaryCase[] = [
  /* ── ⚑CF 신체 자유 제한 (CO-02) ─────────────────────────── */
  {
    id: "bc-01",
    utterance: "어르신, 손목을 잡고 못 나가시게 하겠습니다.",
    why: "손목 제지는 신체 자유 제한입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-02",
    utterance: "현관문을 잠그겠습니다.",
    why: "문 잠그기는 신체 자유 제한입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-03",
    utterance: "도어락을 잠가 두겠습니다.",
    why: "「잠가」 활용형까지 잡아야 합니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-04",
    utterance: "몸으로 막아서 나가지 못하게 하겠습니다.",
    why: "몸으로 가로막는 것도 제지입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-19",
    utterance: "팔을 잡아끌어 방으로 데려가겠습니다.",
    why: "끌기 활용형(잡아끌)을 잡아야 합니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },

  /* ── 부정·예외 — 걸리면 안 되는 문장 ────────────────────── */
  {
    id: "bc-05",
    utterance: "문을 잠그지 않겠습니다.",
    why: "부정문을 ⚑CF로 잡으면 옳은 답을 멈춰 세웁니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-06",
    utterance: "붙잡지 않고 곁에 서 있겠습니다.",
    why: "「붙잡지 않고」는 모범 대응입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-07",
    utterance: "밀치는 대신 손을 잡아 드리겠습니다.",
    why: "「대신」 뒤의 대체 행동은 제지가 아닙니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-08",
    utterance: "휠체어를 밀어서 방으로 모시겠습니다.",
    why: "휠체어 이동은 예외어로 걸러야 합니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-09",
    utterance: "손을 잡아 드리고 곁에 서 있겠습니다.",
    why: "동의를 구한 손잡기는 대안 행동입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-18",
    utterance: "이끌고 나가겠습니다.",
    why: "「이끌고」가 「끌고」로 잘못 잡히면 안 됩니다",
    cf: false,
    noAdvisory: true,
  },

  /* ── ⚑CF 허용 범위 밖 행위 (CO-01) · 유형·국면 게이트 ──── */
  {
    id: "bc-10",
    utterance: "물 한 잔 드릴까요?",
    why: "기도폐쇄 상황에서 액체 제공은 ⚑CF입니다",
    scenarioType: "EMERGENCY",
    cf: true,
    ruleId: "CF-FLUID",
  },
  {
    id: "bc-11",
    utterance: "물 한 잔 드릴까요?",
    why: "같은 문장이라도 치매 행동 상황에서는 좋은 전환 제안입니다",
    scenarioType: "BPSD",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-12",
    utterance: "식사 전에 물을 드린 사실도 기록하겠습니다.",
    why: "응급이 끝난 보고 구간의 회고 진술은 액체 제공이 아닙니다",
    scenarioType: "EMERGENCY",
    cueId: "CUE-5",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-13",
    utterance: "식사 전에 물을 드린 사실도 기록하겠습니다.",
    why: "같은 문장이라도 응급 진행 중(CUE-3)이면 멈춰 세워야 합니다",
    scenarioType: "EMERGENCY",
    cueId: "CUE-3",
    cf: true,
    ruleId: "CF-FLUID",
  },
  {
    id: "bc-14",
    utterance: "입안에 손을 넣어 확인하겠습니다.",
    why: "구강 내 조작은 유형과 무관하게 ⚑CF입니다",
    cf: true,
    ruleId: "CF-ORAL",
  },
  {
    id: "bc-15",
    utterance: "하임리히법을 하겠습니다.",
    why: "신체 술기는 안내하지 않고 119로 이양합니다",
    cf: true,
    ruleId: "CF-ABDOMINAL",
  },
  {
    id: "bc-17",
    utterance: "제 차로 병원에 모시고 가겠습니다.",
    why: "임의 이송은 이동 중 악화를 감당할 수 없습니다",
    cf: true,
    ruleId: "CF-TRANSPORT",
  },
  {
    id: "bc-16",
    utterance: "등을 세게 두드리겠습니다.",
    why: "⚑CF는 아니지만 코칭으로 남아야 합니다",
    cf: false,
    advisory: ["CO-01"],
  },

  /* ── 현실 직면 강요 (RE-02) ─────────────────────────────── */
  {
    id: "bc-20",
    utterance: "여기가 집이에요, 어머니.",
    why: "사실 정정이 먼저 나오면 저항이 커집니다",
    cf: false,
    advisory: ["RE-02"],
  },
  {
    id: "bc-21",
    utterance: "아버님 생각이 많이 나시나 봐요.",
    why: "감정을 먼저 알아주는 문장은 걸리면 안 됩니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-22",
    utterance: "정신 차리세요!",
    why: "각성 요구도 현실 직면 강요입니다",
    cf: false,
    advisory: ["RE-02"],
  },

  /* ── 호칭·존칭 (CO-07) ──────────────────────────────────── */
  {
    id: "bc-23",
    utterance: "이모, 여기 앉으세요.",
    why: "「이모」는 호칭 위반입니다",
    cf: false,
    advisory: ["CO-07"],
  },
  {
    id: "bc-24",
    utterance: "이모님 말고 선생님이라고 불러 주세요.",
    why: "호칭을 바로잡아 달라는 요청은 오히려 모범 대응입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-25",
    utterance: "할머니, 저기 앉아.",
    why: "반말 종결은 존칭 위반으로 잡아야 합니다",
    cf: false,
    advisory: ["CO-07"],
  },
  {
    id: "bc-26",
    utterance: "저기 앉으시겠어요?",
    why: "존댓말 청유형을 반말로 잡으면 안 됩니다",
    cf: false,
    noAdvisory: true,
  },

  /* ── 개인정보 노출 (CO-08) ──────────────────────────────── */
  {
    id: "bc-27",
    utterance: "보호자 연락처는 010-1234-5678입니다.",
    why: "전화번호를 그대로 말하면 가려서 전달하도록 코칭합니다",
    cf: false,
    advisory: ["CO-08"],
  },
  {
    id: "bc-28",
    utterance: "보호자께 연락드리겠습니다.",
    why: "번호 없이 연락 의사만 밝히는 문장은 걸리면 안 됩니다",
    cf: false,
    noAdvisory: true,
  },

  /* ── 적용 항목표 게이트 (설계서 §4.5 · §3.3 판정선 분리) ── */
  {
    id: "bc-29",
    utterance: "문을 잠그겠습니다.",
    why: "CO-02가 배정되지 않은 시나리오에서는 인터럽트 대신 코칭으로 남깁니다",
    appliedRubric: ["RE-01"],
    cf: false,
    advisory: ["CO-02"],
  },
  {
    id: "bc-30",
    utterance: "문을 잠그겠습니다.",
    why: "CO-02가 배정된 시나리오에서는 그대로 멈춰 세웁니다",
    appliedRubric: ["CO-02"],
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
];

/**
 * 119 지연(CO-03) 시간 규칙 경계 — 루브릭 앵커의 경계선 양쪽을 그대로 넣습니다.
 * (미신고 1점은 시간으로 잴 수 없어 시나리오 데이터의 ⚑CF 분기가 맡습니다 — timing.ts 참조.)
 */
export const CALL_DELAY_BOUNDARY_CASES: readonly CallDelayBoundaryCase[] = [
  { id: "cd-01", elapsedSec: 0, why: "즉시 연결", expectScore: 4 },
  { id: "cd-02", elapsedSec: 89, why: "충족선 직전", expectScore: 4 },
  { id: "cd-03", elapsedSec: 90, why: "충족선 위 — 90초까지는 충족", expectScore: 4 },
  { id: "cd-04", elapsedSec: 91, why: "충족선 직후", expectScore: 3 },
  { id: "cd-05", elapsedSec: 180, why: "지연선 위", expectScore: 3 },
  { id: "cd-06", elapsedSec: 181, why: "지연선 직후 — 코칭으로 내려갑니다", expectScore: 2 },
];

/** 근거 화이트리스트 가드 경계 — 목록 밖 id를 근거라고 내밀면 판정을 멈춥니다. */
export const EVIDENCE_BOUNDARY_CASES: readonly EvidenceBoundaryCase[] = [
  {
    id: "ev-01",
    docId: "DOC-GUIDE-004",
    why: "화이트리스트 안의 문서는 그대로 인용합니다",
    expectAllowed: true,
  },
  {
    id: "ev-02",
    docId: undefined,
    why: "근거를 달지 않은 칭찬 판정은 인용 자체가 없습니다",
    expectAllowed: true,
  },
  {
    id: "ev-03",
    docId: "DOC-LAW-999",
    why: "목록 밖 id는 판정을 멈추고 고정 문구로 넘깁니다",
    expectAllowed: false,
  },
  {
    id: "ev-04",
    docId: "노인복지법 제39조의9",
    why: "문서 제목을 id처럼 넘겨도 목록 밖이면 멈춥니다",
    expectAllowed: false,
  },
];
