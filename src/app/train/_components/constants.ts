/**
 * 훈련 화면 공통 문구·표기 상수.
 *
 * 안전 규칙(브리프 §3)에 걸린 고정 문구는 여기 한 곳에만 두고 화면들이 가져다 씁니다.
 * 점수·등급·순위·백분위 표기는 어떤 상수에도 두지 않습니다.
 */

import type { BadgeTone } from "@/components";
import type { StatusMarkKind } from "@/components/icons";
import { getRule, type TracedFeedback } from "@/engine";
import type { EndingDef, GaugeDef, PersonaDef, Scenario, ScenarioType, Tier, TurnDef } from "@/types";

/** 첫 화면·훈련 시작 전 고정 문구 */
export const PRACTICE_LINE = "정답을 맞히는 시험이 아니라, 말이 나오게 만드는 연습입니다.";

/** 가상 인물 고지 */
export const FICTION_NOTICE = "등장인물은 전원 가상 인물이며 실존 인물·기관과 무관합니다.";

/* 생성 자리 고지(GENERATION_ADAPTER_NOTE·VARY_ADAPTER_NOTE 노출)는 2026-08-24에 세션 상단에서
   걷어냈습니다. 「어댑터 자리」·「근거 가드 검증을 통과한 구간」은 심사·개발 상태를 말하는 문장이라,
   어르신 대사 바로 위에 서면 훈련하러 오신 분이 읽을 것이 아니었습니다.
   같은 사실은 /safety §02가 그대로 들고 있습니다 — 지운 것이 아니라 자리를 옮긴 것입니다.
   말풍선 쪽 표기는 남습니다: 실제로 생성이 붙은 턴에만 「AI 생성」이 붙습니다(DialogueLog). */

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
  L3: "지금부터는 AI가 아무것도 만들지 않습니다 — 검수된 고정 안내만 재생합니다.",
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

/* ── 인물 아바타 한 글자 ───────────────────────────────────
   세션 말풍선(DialogueLog)과 브리핑 인물 카드(BriefingPanel)가 **같은 한 글자**를 씁니다 —
   브리핑에서 본 얼굴이 대화에서 그대로 나와야 「같은 사람」으로 읽힙니다.
   두 화면이 각자 성씨를 뽑으면 언젠가 갈라지므로, 뽑는 규칙은 여기 한 곳에만 둡니다. */

const ROLE_PREFIX = ["보호자", "요양보호사", "간호사", "센터장", "가족", "따님", "아드님"];

/**
 * 아바타에 새길 한 글자.
 * 역할어("보호자" 등)와 괄호 주석을 걷어낸 뒤, 홀로 떨어져 있는 성씨 한 글자를 먼저 찾습니다.
 *
 * @example initialOf("박 어르신")     // "박"
 * @example initialOf("보호자 김 씨")  // "김"
 * @example initialOf("119 상황실")    // "상"
 */
export function initialOf(name: string): string {
  let base = name.replace(/\([^)]*\)/g, " ").trim();
  for (const word of ROLE_PREFIX) {
    if (base.startsWith(word)) {
      base = base.slice(word.length).trim();
      break;
    }
  }
  const surname = base.split(/\s+/).find((token) => /^[가-힣]$/.test(token));
  if (surname) return surname;
  const hangul = base.match(/[가-힣]/);
  if (hangul) return hangul[0];
  const other = base.match(/[A-Za-z0-9]/);
  return other ? other[0] : "";
}

/* ── 돌발 변수 = 무대 지문 ─────────────────────────────────
   시나리오 데이터의 `triggerName`은 저작용 표기입니다(「T-2 보호자 전화」·「N-1 자동문 버튼」).
   그 표기를 대화 한가운데에 「돌발 변수 · T-2 보호자 전화」로 세우면, 훈련 중인 분이 읽는 것은
   장면이 아니라 설계 문서의 색인이 됩니다.

   그래서 데이터는 그대로 두고 **화면에서만** 무대 지문 한 줄로 바꿉니다 —
   「그때, 전화가 옵니다」. 무슨 일이 일어났는지의 자세한 내용은 바로 아래 말풍선의 본문과
   지문(`stageDirection`)이 이미 들고 있으므로, 이 줄이 하는 일은 **박자를 끊는 것** 하나입니다. */

const TRIGGER_STAGE_LINE: Record<string, string> = {
  /* CHK-A01 — 현관 앞 귀가 요구 */
  "T-1 문고리": "그때, 어르신 손이 문 쪽으로 갑니다",
  "T-3 젖은 옷 단서": "그때, 눈에 들어오는 것이 있습니다",
  "T-2 보호자 전화": "그때, 전화가 옵니다",
  /* CHK-A02 — 야간 배회 */
  "N-1 자동문 버튼": "그때, 어르신 손이 문 쪽으로 갑니다",
  "N-3 무릎 통증 단서": "그때, 눈에 들어오는 것이 있습니다",
  "N-2 옆방 어르신": "그때, 옆방 문이 열립니다",
  /* CHK-B01 — 낙상 후 관찰·보고 */
  "F-1 일으켜 달라는 재촉": "그때, 어르신이 몸을 일으키려 하십니다",
  "F-2 보호자 전화": "그때, 전화가 옵니다",
  /* CHK-B02 — 사레·질식 */
  "T-1 완전 기도폐쇄 전환": "그때, 소리가 멎습니다",
  "T-2 보호자 추궁": "그때, 전화가 옵니다",
  /* CHK-C01 — 업무 외 요구 + 폭언 */
  "T-1' 요구 확대": "그때, 말이 이어집니다",
  "T-1 센터장 압박": "그때, 말투가 달라집니다",
  "T-2 어르신 청취": "그때, 어르신이 이쪽을 보십니다",
  /* CHK-C02 — 원인을 모르는 멍 */
  "C-1 억제 요구": "그때, 말투가 달라집니다",
  "C-2 어르신 청취": "그때, 어르신이 이쪽을 보십니다",
  "C-3 촬영 요구": "그때, 휴대전화가 올라옵니다",
};

/** 지문에 남는 마지막 안전망 — 표에 없는 돌발 변수가 들어와도 코드가 화면에 나가지 않습니다. */
const TRIGGER_STAGE_FALLBACK = "그때, 상황이 하나 더 겹칩니다";

/**
 * 돌발 변수 이름 → 무대 지문 한 줄.
 *
 * @example triggerStageLine("T-2 보호자 전화") // "그때, 전화가 옵니다"
 * @example triggerStageLine("Z-9 미정")        // "그때, 상황이 하나 더 겹칩니다"
 */
export function triggerStageLine(triggerName: string): string {
  return TRIGGER_STAGE_LINE[triggerName.trim()] ?? TRIGGER_STAGE_FALLBACK;
}

/* ── 세션 헤더 (시안 4a 컴팩트 헤더) ───────────────────────── */

/** L3 구간 — AI가 만든 문장이 아님을 헤더에서 바로 밝힙니다(말풍선 라벨과 같은 어휘). */
export const SESSION_STATUS_PROTOCOL = "응급 안내 · AI 생성 아님";
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

/**
 * 판정 머리말 색 — 가이드 v4 §4.4.
 *
 * 미충족 코칭은 `warn-ink`입니다. 예전에는 `ink-soft`(보조 본문과 같은 회색)라,
 * 같은 판정을 가리키는 엔딩의 「다시 볼 것」(warn-ink)과 색 문법이 갈렸습니다 —
 * 한 훈련 안에서 같은 뜻이 두 색으로 나오면 색이 뜻을 잃습니다.
 */
export const COACH_HEAD_TEXT: Record<StatusMarkKind, string> = {
  met: "text-ok-ink",
  coach: "text-warn-ink",
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
 * 규칙 사전에서 발동한 규칙의 **한국어 이름** — 「신체 자유 제한」.
 *
 * 판정에 쓰인 규칙 id(`CF-RESTRAINT`)는 사전의 열쇠이지 사람이 읽는 이름이 아닙니다.
 * 이름은 새로 짓지 않고 `src/engine/rules.ts`의 `label`을 그대로 가져옵니다 —
 * 화면에 나가는 낱말과 판정을 실행한 규칙이 같은 원천을 가리키게 하려는 것입니다.
 */
function ruleNameOf(trace: TracedFeedback["trace"]): string | undefined {
  const label = trace?.ruleLabel ?? (trace?.ruleId ? getRule(trace.ruleId)?.label : undefined);
  return label && label.trim().length > 0 ? label.trim() : undefined;
}

/**
 * 판정 주체 한 줄 — 「판정: 규칙 사전 — 신체 자유 제한 (AI 아님)」.
 *
 * 규칙 사전이 단독으로 잡은 판정과 시나리오 분기 데이터가 정한 판정은 주체가 다릅니다.
 * 둘 다 결정론이지만, 아닌 것을 「규칙 사전」이라고 적지는 않습니다.
 * (⚑CF 시트와 엔딩의 「다시 볼 장면」 카드가 같은 문장을 씁니다.)
 *
 * 형식(「판정: … (AI 아님)」)은 고정입니다 — 바뀐 것은 규칙을 부르는 말뿐입니다.
 * 얼어붙은 순간에 읽는 줄이 영문 코드일 이유가 없고, 「AI 아님」은 이 시트의 안전 증거라
 * 한 글자도 줄이지 않습니다.
 *
 * @example cfVerdictSourceLine(feedback) // "판정: 규칙 사전 — 신체 자유 제한 (AI 아님)"
 */
export function cfVerdictSourceLine(feedback: TracedFeedback): string {
  const trace = feedback.trace;
  if (trace?.source === "rule") {
    const name = ruleNameOf(trace);
    return name ? `판정: 규칙 사전 — ${name} (AI 아님)` : "판정: 규칙 사전 (AI 아님)";
  }
  return "판정: 시나리오 규칙표 (AI 아님)";
}

/**
 * ⚑CF 문구에서 **법령 조문을 인용한 문장만** 갈라냅니다.
 *
 * 문구 자체는 검수된 고정 문장이라 한 글자도 고치지 않고, 자리만 옮깁니다 —
 * 얼어붙은 사람이 두 번째 줄에서 읽는 것이 「당신은 법을 어겼습니다」가 되지 않도록
 * 조문은 접힘 안으로 내리고, 할 수 있는 말(대안)을 먼저 세웁니다.
 * (⚑CF 시트와 엔딩의 「다시 볼 장면」 카드가 같은 규칙을 씁니다.)
 *
 * @example splitLawSentences("잠시 멈추겠습니다. …노인복지법 제39조의9가… 다시 해보시겠어요?")
 * // { lead: "잠시 멈추겠습니다. 다시 해보시겠어요?", law: "…노인복지법 제39조의9가…" }
 */
export function splitLawSentences(message: string): { lead: string; law: string } {
  const sentences = message.match(/[^.]+\.?/g);
  if (!sentences) return { lead: message, law: "" };
  const lead: string[] = [];
  const law: string[] = [];
  for (const raw of sentences) {
    const sentence = raw.trim();
    if (sentence.length === 0) continue;
    if (/(?:법|고시|지침|규칙)\s*제\s*\d+조/.test(sentence)) law.push(sentence);
    else lead.push(sentence);
  }
  if (law.length === 0 || lead.length === 0) return { lead: message, law: "" };
  return { lead: lead.join(" "), law: law.join(" ") };
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
