/**
 * 훈련 화면 공통 문구·표기 상수.
 *
 * 안전 규칙(브리프 §3)에 걸린 고정 문구는 여기 한 곳에만 두고 화면들이 가져다 씁니다.
 * 점수·등급·순위·백분위 표기는 어떤 상수에도 두지 않습니다.
 */

import type { BadgeTone } from "@/components";
import type { StatusMarkKind } from "@/components/icons";
import type { TracedFeedback } from "@/engine";
import type { EndingDef, GaugeDef, PersonaDef, Scenario, ScenarioType, Tier, TurnDef } from "@/types";

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

/** 계층 표시기 — 좁은 화면에서 두 줄로 나눠 적기 위한 짧은 이름입니다. */
export const TIER_SHORT: Record<Tier, string> = {
  L1: "훈련",
  L2: "채점",
  L3: "실전 응급",
};

/** 계층 표시기 — 지금 어느 계층이 작동 중인지 한 줄로 설명하는 문구입니다. */
export const TIER_NOW_NOTE: Record<Tier, string> = {
  L1: "지금은 훈련 대화 구간입니다 — 대사는 시나리오 데이터의 고정 문구를 재생합니다.",
  L2: "방금 응답을 채점했습니다 — 규칙 사전과 루브릭이 근거 문서 안에서만 판정합니다.",
  L3: "지금부터 생성 호출 0건 — 검수된 고정 안내만 재생",
};

/** 계층 표시기 — 이 시나리오에서 쓰지 않는 계층에 붙는 문구입니다. */
export const TIER_UNUSED_NOTE = "이 시나리오에서는 쓰지 않습니다";

/** 계층 표시기 — 세션이 끝난 뒤 문구입니다. */
export const TIER_ENDED_NOTE = "이번 훈련이 끝났습니다 — 계층 표시를 멈춥니다.";

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

/* ── 세션 헤더 (시안 4a 컴팩트 헤더) ───────────────────────── */

/** L3 구간 — 생성 호출이 0건임을 헤더에서 바로 밝힙니다. */
export const SESSION_STATUS_PROTOCOL = "응급 안내 · 생성 0건";
export const SESSION_STATUS_ENDED = "훈련을 마쳤습니다";

/** 화자 → 사람이 부르는 역할 이름 (헤더 「AI는 … 역만 맡습니다」에 씁니다) */
const SPEAKER_ROLE_WORD: Record<TurnDef["speaker"], string> = {
  elder: "어르신",
  guardian: "보호자",
  dispatcher: "119 상황실",
  system: "",
  protocol: "",
};

/**
 * 헤더 한 줄 — 「대화 단계 · AI는 어르신 역만 맡습니다」.
 *
 * 역할 이름은 시나리오가 실제로 재생하는 화자에서 가져옵니다.
 * (119 상황실 대사가 있는 시나리오에서 「어르신 역만」이라고 적으면 사실과 달라집니다.)
 *
 * @example aiRoleNote(CHK_A01) // "대화 단계 · AI는 어르신·보호자 역만 맡습니다"
 */
export function aiRoleNote(scenario: Scenario): string {
  const words: string[] = [];
  for (const turn of scenario.turns) {
    const word = SPEAKER_ROLE_WORD[turn.speaker];
    if (word.length > 0 && !words.includes(word)) words.push(word);
  }
  const roles = words.length > 0 ? words.join("·") : "상대";
  return `대화 단계 · AI는 ${roles} 역만 맡습니다`;
}

/**
 * 진행 번호의 한글 서수 (가이드 §4.1 · 시안 7d 「셋째 상황」).
 * 열한째부터는 읽기 쉬운 숫자 표기로 넘깁니다.
 *
 * @example situationOrdinal(3) // "셋째"
 * @example situationOrdinal(12) // "12번째"
 */
const SITUATION_ORDINAL = [
  "",
  "첫째",
  "둘째",
  "셋째",
  "넷째",
  "다섯째",
  "여섯째",
  "일곱째",
  "여덟째",
  "아홉째",
  "열째",
];

export function situationOrdinal(index: number): string {
  const n = Math.max(1, Math.round(Number.isFinite(index) ? index : 1));
  return SITUATION_ORDINAL[n] ?? `${n}번째`;
}

/**
 * 세션 헤더 부제 — 「셋째 상황 · 대화 단계 · AI는 어르신 역만 맡습니다」 (가이드 §4.1).
 *
 * 진행 번호는 점수가 아니라 **지금 몇째 장면인가**입니다(§4.2와 같은 뜻).
 *
 * @example sessionSubtitle(CHK_A01, 3) // "셋째 상황 · 대화 단계 · AI는 어르신 역만 맡습니다"
 */
export function sessionSubtitle(scenario: Scenario, index: number): string {
  return `${situationOrdinal(index)} 상황 · ${aiRoleNote(scenario)}`;
}

/**
 * 컴포저 위 회수 앵커 — **로그 아래쪽**에 아직 안 보이는 내용이 남아 있을 때 한 줄로 부릅니다.
 *
 * 예전에는 새 대사가 화면 위로 밀려나 「새로 말씀하셨어요 ↑」로 되불렀습니다.
 * 지금은 제출 직후 새 대사를 띠 맨 위에 세우므로(DialogueLog), 화면 밖에 남는 것은
 * 그 아래로 이어지는 코칭·돌발 변수입니다 — 앵커의 역할이 ↑ 회수에서 ↓ 안내로 바뀌었습니다.
 */
export const TAIL_ANCHOR = "이어지는 코칭 보기";

/* ── 응답 여유 (시안 4a — 숫자 초읽기 대신 상태어) ─────────── */

export type WaitLevel = "plenty" | "half" | "over";

/**
 * 지금 여유가 어느 단계인지.
 * 게이지와 같은 원칙입니다 — 숫자는 화면에 내지 않고 낱말 하나로만 전합니다.
 *
 * @example waitLevel(7, 8) // "plenty"
 * @example waitLevel(0, 8) // "over"
 */
export function waitLevel(secondsLeft: number, total: number): WaitLevel {
  if (!Number.isFinite(secondsLeft) || secondsLeft <= 0) return "over";
  const span = Math.max(1, Math.round(total));
  return secondsLeft > span / 2 ? "plenty" : "half";
}

/**
 * 여유 상태어 — 재촉 어휘는 쓰지 않습니다(가이드 §4.5 「'남은 시간' 대신 '여유'」).
 * 시간이 다 지나도 넘어가지 않으므로, 마지막 단계도 기다린다는 말로 끝냅니다.
 */
export const WAIT_WORD: Record<WaitLevel, string> = {
  plenty: "여유 있어요",
  half: "천천히 하셔도 됩니다",
  over: "기다리고 있어요",
};

/** 여유 표시 옆에 항상 붙는 한 줄 — 얼어붙는 몇 초 동안 같은 자리에 있어야 하는 사실입니다. */
export const WAIT_NO_AUTO_ADVANCE = "시간이 지나도 자동으로 넘어가지 않습니다";

/* ── 감정 상태 (시안 4a③ — 게이지가 숫자 막대 대신 인물에 붙습니다) ── */

export type EmotionLevel = "calm" | "uneasy" | "crisis";

/**
 * 게이지 값 → 감정 상태어.
 * 숫자·점수는 화면에 내보내지 않고, 이름줄의 한 낱말과 아바타 링으로만 전합니다.
 */
export const EMOTION_WORD: Record<GaugeDef["label"], Record<EmotionLevel, string>> = {
  초조도: { calm: "평온", uneasy: "조금 불안", crisis: "많이 불안" },
  긴장도: { calm: "편안", uneasy: "조금 긴장", crisis: "많이 긴장" },
};

/** 이름줄 상태어 색 — 작은 글자라 대비 4.5:1을 넘는 `*-ink` 계열만 씁니다. */
export const EMOTION_TEXT: Record<EmotionLevel, string> = {
  calm: "text-ink-muted",
  uneasy: "text-warn-ink",
  crisis: "text-danger-ink",
};

/** 아바타 감정 링 — 평온은 링 없음(시안 4a③). 색만으로 뜻을 전하지 않도록 항상 상태어와 함께 둡니다. */
export const EMOTION_RING: Record<EmotionLevel, string | undefined> = {
  calm: undefined,
  uneasy: "0 0 0 2px var(--color-warn-line)",
  crisis: "0 0 0 2px var(--color-danger-line)",
};

/**
 * 지금 게이지가 가리키는 감정 단계.
 * 위기값 바로 아래부터 crisis로 보고, 시작값보다 낮게 가라앉으면 calm으로 봅니다.
 *
 * @example emotionLevel({ label: "초조도", start: 2, max: 5, crisisAt: 5, crisisEndingId: "E-위기" }, 4) // "crisis"
 */
export function emotionLevel(gauge: GaugeDef, value: number): EmotionLevel {
  if (value >= gauge.crisisAt - 1) return "crisis";
  if (value <= 1) return "calm";
  return "uneasy";
}

/* ── 인라인 코칭 (시안 4a⑤ — 카드가 아니라 지문 옆 한 덩어리) ── */

/**
 * 판정 머리말.
 * 판정어는 `STATUS_MARK_LABEL`(충족 / 코칭 / 즉시 중단)을 그대로 쓰고,
 * 「침착의 코칭」은 이 말이 AI 인물이 아니라 앱의 판정이라는 표시입니다.
 */
export const COACH_HEAD: Record<StatusMarkKind, string> = {
  met: "충족 · 침착의 코칭",
  coach: "침착의 코칭",
  stop: "즉시 중단 · 침착의 코칭",
};

export const COACH_HEAD_TEXT: Record<StatusMarkKind, string> = {
  met: "text-ok-ink",
  coach: "text-ink-soft",
  stop: "text-danger-ink",
};

const COUNT_WORD = ["", "한", "두", "세", "네", "다섯"];

/**
 * 게이지 변동 칩 문구 — 「초조도 한 칸 ↓」. 변동이 없으면 칩을 붙이지 않습니다.
 *
 * @example gaugeDeltaChip("초조도", -1) // "초조도 한 칸 ↓"
 */
export function gaugeDeltaChip(label: string, delta: number): string | null {
  if (!Number.isFinite(delta) || delta === 0) return null;
  const steps = Math.min(Math.abs(Math.round(delta)), COUNT_WORD.length - 1);
  const word = COUNT_WORD[steps] ?? "한";
  return `${label} ${word} 칸 ${delta < 0 ? "↓" : "↑"}`;
}

/** 델타 칩 색 — 게이지가 내려가면 틸(좋아진 것), 올라가면 앰버(주의). */
export function gaugeDeltaTone(delta: number): string {
  return delta < 0
    ? "bg-ok-soft text-brand-700"
    : "bg-warn-soft text-warn-ink";
}

/**
 * 데스크톱 레일의 게이지 변동 문장 (시안 7d 「방금 한 칸 내려갔어요」).
 * 칩과 달리 문장이라 숫자·화살표를 쓰지 않습니다.
 *
 * @example gaugeDeltaSentence(-1) // "방금 한 칸 내려갔어요"
 */
export function gaugeDeltaSentence(delta: number): string | null {
  if (!Number.isFinite(delta) || delta === 0) return null;
  const steps = Math.min(Math.abs(Math.round(delta)), COUNT_WORD.length - 1);
  const word = COUNT_WORD[steps] ?? "한";
  return delta < 0 ? `방금 ${word} 칸 내려갔어요` : `방금 ${word} 칸 올라갔어요`;
}

/**
 * 게이지가 설명하는 인물을 앞에 붙인 이름 — 「어르신 초조도」 (시안 7d).
 *
 * @example gaugeRailLabel(CHK_A01) // "어르신 초조도"
 */
export function gaugeRailLabel(scenario: Scenario): string {
  const roles = scenario.personas.map((persona) => persona.role);
  if (roles.includes("care_recipient")) return `어르신 ${scenario.gauge.label}`;
  if (roles.includes("guardian")) return `보호자 ${scenario.gauge.label}`;
  return scenario.gauge.label;
}

/* ── ⚑CF 판정 주체 (시안 6c 근거 박스 · 가이드 §4.6) ───────── */

/**
 * 판정 주체 한 줄 — 「판정: 규칙 사전 CF-RESTRAINT (AI 아님)」.
 *
 * 규칙 사전이 단독으로 잡은 판정과 시나리오 분기 데이터가 정한 판정은 주체가 다릅니다.
 * 둘 다 결정론이지만, 아닌 것을 「규칙 사전」이라고 적지는 않습니다.
 * (⚑CF 시트와 엔딩의 「다시 볼 장면」 카드가 같은 문장을 씁니다.)
 *
 * @example cfVerdictSourceLine(feedback) // "판정: 규칙 사전 CF-RESTRAINT (AI 아님)"
 */
export function cfVerdictSourceLine(feedback: TracedFeedback): string {
  const trace = feedback.trace;
  const itemId = trace?.itemIds?.[0];
  if (trace?.source === "rule") {
    return `판정: 규칙 사전 ${trace.ruleId ?? itemId ?? "⚑CF"} (AI 아님)`;
  }
  return `판정: 시나리오 규칙표 ${itemId ?? feedback.branchId} (AI 아님)`;
}

/* ── 소요 시간 (시안 6a 「약 4분 12초」) ────────────────────── */

/**
 * 두 시각 사이를 사람이 읽는 어림 문구로 바꿉니다.
 * 기록에는 초 단위까지 남지만, 화면에는 「약」을 붙여 계측값이 아님을 밝힙니다.
 *
 * @example durationText("2026-08-05T09:00:00.000Z", "2026-08-05T09:04:12.000Z") // "약 4분 12초"
 */
export function durationText(startedAt: string | number, endedAt: string | number): string {
  const start = typeof startedAt === "number" ? startedAt : Date.parse(startedAt);
  const end = typeof endedAt === "number" ? endedAt : Date.parse(endedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "";
  const seconds = Math.max(0, Math.round((end - start) / 1000));
  if (seconds < 60) return `약 ${Math.max(1, seconds)}초`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `약 ${minutes}분` : `약 ${minutes}분 ${rest}초`;
}
