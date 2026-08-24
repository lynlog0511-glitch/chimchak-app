/**
 * 자유 대화 연습(온라인 전용 · 무채점) — **오프라인은 검수된 결정론, 온라인은 진짜 여러 상황**.
 *
 * 검증 훈련(`/train/[id]`)이 하는 일과 이 파일이 하는 일은 방향이 다릅니다.
 * 검증 훈련은 검수된 시나리오 위에서 **판정**을 냅니다 — 같은 입력에는 같은 판정이 나오고,
 * 대사는 앵커이며, 기기 밖으로 나가는 것은 미분류 턴의 가명처리된 한 문장뿐입니다.
 * 자유 연습은 반대쪽입니다 — **판정을 내리지 않는 대신 상황을 넓힙니다.** 시나리오 여섯 종에
 * 없는 장면을 그 자리에서 만들고, 인물이 즉흥으로 답합니다. 그 대가로 이 모드는
 * 온라인에서만 열리고, 점수·게이지·기록을 하나도 남기지 않습니다.
 *
 * 나가는 것과 나가지 않는 것
 *  · 나가는 것 — 시드(유형·난이도·적어 주신 한 줄), 만들어진 상황 지문·인물 소개,
 *    그리고 **학습자 발화**입니다. 이 모드에서는 학습자의 말이 기기 밖으로 나갑니다.
 *    대사 변주(`onlineVary.ts`)가 지키던 「학습자 발화는 담지 않는다」가 여기서는 성립하지
 *    않습니다 — 즉흥 연기의 상대가 무슨 말을 들었는지 모르면 연기가 되지 않기 때문입니다.
 *    그래서 그 사실을 시작 전 화면에 그대로 적고, 켜는 것도 시작하는 것도 사람이 합니다.
 *  · 나가지 않는 것 — 원문 그대로의 발화입니다. 발화는 **가명처리를 지나서** 나갑니다
 *    (`engine/masking.ts`). 성명·번호·기관명·주소는 침착 서버에 닿기 전에 가려집니다.
 *  · 남지 않는 것 — 대화 전체입니다. 저장소에 쓰는 것은 연습 횟수 한 칸뿐이고
 *    (`FREE_PRACTICE_KEY`), 대화는 화면을 벗어나면 사라집니다.
 *
 * 제외하는 자리 — **응급 유형 전체**입니다(L3 원칙).
 *  기도폐쇄·낙상 장면에서는 한 낱말이 대응을 가릅니다. 「여기서부터 AI가 화면에서 빠집니다」라고
 *  적어 둔 유형을 즉흥 생성에 맡기는 것은 앞뒤가 맞지 않습니다. 응급은 검수된 고정 프로토콜
 *  (`/emergency`)과 검증 훈련이 맡고, 이 모드의 유형 목록에는 아예 올리지 않습니다
 *  (`FREE_SEED_TYPES` · 화면에도 사유를 그대로 적습니다).
 *
 * 안전망 — **무채점이라고 안전까지 무채점이 되지는 않습니다.**
 *  ① 학습자 발화마다 `checkCritical`을 먼저 돌립니다(전역 사전 · 유형 맥락).
 *     ⚑CF면 대화를 멈추고 왜 멈췄는지와 대안만 보여 드립니다 — 판정도 기록도 남기지 않습니다.
 *  ② 생성문(상황 지문·인물 소개·인물 대사)은 기기 안 가드를 지나야 화면에 닿습니다.
 *     형식·길이·표현·위험 신호 네 단이고, **위험 신호 대조는 앵커 대비가 아니라 절대 기준**입니다 —
 *     이 모드에는 대조할 앵커가 없기 때문입니다. 생성문이 ⚑CF 신호를 포함하면 한 번 더 청하고,
 *     그래도 걸리면 고정 대체 문구를 씁니다.
 *  ③ 마무리 요약의 근거 문서는 `checkEvidence`를 지난 것만 답니다(L2 원칙).
 *
 * 판정 엔진은 여기서 **재사용만** 합니다 — 규칙을 넓히지도 좁히지도 않습니다.
 *
 * @example
 * const setup = await requestFreeSetup(buildSetupRequest(seed), settings);
 * setup.status; // "ok" | "blocked" | "fallback"
 */

import { EVIDENCE_GUARD } from "@/data/evidenceGuard";
import { checkEvidence, type EvidenceGuard } from "@/engine/evidence";
import { maskText } from "@/engine/masking";
import { checkCritical, type CriticalCheck } from "@/engine/rules";
import type { ScenarioType } from "@/types";
import {
  BANNED_PHRASES,
  COACH_ENDPOINT,
  citableDocRefs,
  extractJson,
  findBannedExpression,
  type CoachDocRef,
  type OnlineCoachFallback,
} from "./onlineCoach";
import { getSettings, type OnlineCoachingSettings } from "./settings";

/* ── 시드 (유형·난이도·한 줄) ──────────────────────────── */

/**
 * 이 모드가 다루는 유형 — **둘뿐입니다.**
 *
 * `ScenarioType`의 부분집합이라 규칙 엔진에 그대로 넘길 수 있습니다(변환표를 두지 않습니다).
 * 응급(`EMERGENCY`)이 없는 것이 이 타입의 핵심이고, 위험 판단(`RISK`)은 검증 훈련에서도
 * 아직 베타로 이연한 유형이라 여기서도 열지 않습니다.
 */
export type FreeSeedType = Extract<ScenarioType, "BPSD" | "CONFLICT">;

export const FREE_SEED_TYPES: ReadonlyArray<{
  value: FreeSeedType;
  label: string;
  note: string;
}> = [
  {
    value: "BPSD",
    label: "치매 행동",
    note: "귀가 요구·거부·같은 말의 반복처럼 자주 마주치는 장면입니다.",
  },
  {
    value: "CONFLICT",
    label: "갈등",
    note: "보호자·가족과 말이 부딪히는 장면입니다.",
  },
];

/** 유형 목록에서 뺀 자리 — 화면에 이름과 사유를 그대로 적습니다. */
export const FREE_EXCLUDED_TYPE_LABEL = "응급";

/**
 * 왜 뺐는지 — 한 문장으로 적어 둡니다.
 * 「준비 중」으로 두면 언젠가 열릴 자리로 읽히는데, 이 자리는 열지 않기로 한 자리입니다.
 */
export const FREE_EXCLUDED_TYPE_REASON =
  "응급 상황은 이 연습에 넣지 않습니다. 응급 안내는 사전 검수된 고정 문구로만 나가야 하고, 실시간 대응을 즉흥 생성에 맡기지 않는다는 것이 이 앱의 3계층 설계(L3)입니다. 응급은 「응급 안내」 화면과 검증 훈련에서 연습해 주십시오.";

export type FreeLevel = 1 | 2 | 3;

export const FREE_LEVELS: ReadonlyArray<{ value: FreeLevel; label: string; note: string }> = [
  { value: 1, label: "초급", note: "말문을 여는 연습" },
  { value: 2, label: "중급", note: "요구가 겹치는 장면" },
  { value: 3, label: "고급", note: "설득이 잘 통하지 않는 장면" },
];

export interface FreeSeed {
  type: FreeSeedType;
  level: FreeLevel;
  /** 「상황 만들기」에 적어 주신 한 줄 — 비워 두셔도 됩니다. */
  hint: string;
}

/** 시드에 적을 수 있는 한 줄의 길이 상한(자) */
export const FREE_HINT_MAX = 120;

/** 유형 라벨 — 화면과 요청 몸통이 같은 낱말을 봅니다. */
export function freeTypeLabel(type: FreeSeedType): string {
  return FREE_SEED_TYPES.find((item) => item.value === type)?.label ?? type;
}

export function freeLevelLabel(level: FreeLevel): string {
  return FREE_LEVELS.find((item) => item.value === level)?.label ?? String(level);
}

/**
 * 시드를 요청에 실을 한 줄로 폅니다.
 *
 * @example seedLine({ type: "BPSD", level: 2, hint: "목욕을 거부하십니다" })
 * // "치매 행동 · 중급 — 목욕을 거부하십니다"
 */
export function seedLine(seed: FreeSeed): string {
  const head = `${freeTypeLabel(seed.type)} · ${freeLevelLabel(seed.level)}`;
  const hint = seed.hint.trim().slice(0, FREE_HINT_MAX);
  return hint.length > 0 ? `${head} — ${hint}` : head;
}

/* ── 상수 ──────────────────────────────────────────────── */

/** 변주·코칭과 **같은 한 곳**입니다(CSP `connect-src 'self'`가 그대로 참입니다). */
export const FREE_ENDPOINT = COACH_ENDPOINT;

/** 응답을 기다리는 상한(ms) — 서버가 상류에 거는 6초 뒤에 끊습니다(코칭과 같은 값). */
export const FREE_TIMEOUT_MS = 8000;

/** 학습자가 말할 수 있는 최대 차례 — 넘으면 마무리로 넘어갑니다. */
export const FREE_MAX_TURNS = 12;

/* 생성문 길이 상한(자) — 넘으면 버립니다.
   상황 지문은 두어 문장, 인물 소개는 한 문장, 대사는 한두 문장이 이 모드의 약속입니다. */
export const FREE_SITUATION_MAX = 220;
export const FREE_PERSONA_MAX = 140;
export const FREE_LINE_MAX = 160;
export const FREE_SUMMARY_MAX = 240;

/* 나가는 칸마다의 길이 상한 — **서버 검증과 같은 값**입니다(라우트가 이 상수를 그대로 씁니다).
   한 자리에만 적어 두는 이유는 변주 쪽과 같습니다: 두 곳에 따로 적으면 어느 날 한쪽만 늘어나고,
   그때 요청은 조용히 400으로 끊깁니다 — 화면에는 아무 표시도 나지 않는 고장입니다. */
export const FREE_SEED_MAX = 240;
export const FREE_HISTORY_MAX_LINES = 26;
export const FREE_HISTORY_LINE_MAX = 300;
/** 학습자 한 마디의 길이 상한(자) — 훈련 한 턴의 말은 이 안에서 끝납니다. */
export const FREE_UTTERANCE_MAX = 300;

/** 대화 이력에 붙이는 화자 표기 — 프롬프트와 회귀 검사가 같은 낱말을 봅니다. */
export const FREE_CHARACTER_PREFIX = "인물";
export const FREE_LEARNER_PREFIX = "학습자";

/**
 * 생성 대사가 안전 대조에 두 번 걸렸을 때 대신 세우는 **고정 문구**.
 *
 * 화면이 비어 버리면 대화가 끊기고, 걸린 문장을 그대로 세우면 안전망이 없는 것과 같습니다.
 * 그래서 이 한 줄을 두고, 대체했다는 사실을 말풍선 아래에 그대로 적습니다
 * (`FREE_FALLBACK_NOTE` — 있는 것을 숨기지 않고, 없는 것을 있다고도 하지 않습니다).
 */
export const FREE_FALLBACK_LINE = "…잠시만요. 마음이 좀 복잡해서요.";

export const FREE_FALLBACK_NOTE = "생성된 대사가 기기 안 대조에 걸려 고정 문구로 대체했습니다.";

/** 마무리 요약을 만들지 못했을 때 — 지어내지 않고 못 만들었다고 적습니다. */
export const FREE_SUMMARY_FAILED = "요약을 만들지 못했습니다.";

/** 화면 상단에 상시 서는 한 줄 (점수·등급 표현 없음) */
export const FREE_NO_SCORE_LINE =
  "자유 연습 — 채점하지 않습니다. 말이 나오게 만드는 연습입니다.";

/** 이 모드가 무엇인지 한 낱말로 — 카드·머리말이 같은 말을 씁니다. */
export const FREE_EXPERIMENT_LABEL = "실험";

/* 훈련 목록 카드와 화면 머리말이 **같은 문장**을 쓰도록 여기 한 자리에 둡니다.
   카드는 `/train`이, 머리말은 `/practice`가 그리므로 문구가 두 곳으로 갈리기 쉬운 자리입니다. */
export const FREE_PRACTICE_HREF = "/practice";
export const FREE_ENTRY_TITLE = "자유 대화 연습";
export const FREE_ENTRY_EYEBROW = `${FREE_EXPERIMENT_LABEL} · 온라인 · 채점 없음`;
export const FREE_ENTRY_SUMMARY =
  "검수된 여섯 상황 밖의 장면을 그 자리에서 만들어 대화합니다 — 판정도 기록도 남기지 않습니다.";

/** 가상 인물 고지 — 만들어진 인물에도 같은 문장을 답니다. */
export const FREE_FICTION_NOTICE =
  "이 연습의 등장인물은 그 자리에서 만들어진 가상 인물이며 실존 인물·기관과 무관합니다.";

/**
 * 시작 전 동의 화면에 그대로 적는 문장들 — **무엇이 나가고 무엇이 남지 않는지**.
 *
 * 첫 줄이 이 절의 전부입니다: 이 모드에서는 학습자의 말이 기기 밖으로 나갑니다.
 * 검증 훈련의 약속(「나가는 것은 미분류 턴의 가명처리된 한 문장뿐」)과 다른 자리이므로,
 * 다르다는 사실부터 적습니다.
 */
export const FREE_CONSENT_LINES: readonly string[] = [
  "자유 연습에서는 대화가 경량 LLM으로 전송됩니다. 검증 훈련과 달리 기기 밖으로 나갑니다.",
  "말씀은 가명처리를 지나서 나갑니다 — 성명·번호·기관명·주소는 서버에 닿기 전에 가려집니다.",
  "대화는 저장되지 않습니다. 화면을 벗어나면 사라지고, 기기에 남는 것은 연습 횟수 하나뿐입니다.",
  "채점하지 않습니다 — 판정도 게이지도 기록도 남기지 않고, 성장 기록에도 올라가지 않습니다.",
  "마이크를 쓰시면 음성 인식은 브라우저 기능이라 제조사 서버를 경유할 수 있습니다. 타이핑만 쓰시면 이 구간이 없습니다.",
];

/* ── 요청 모양 ─────────────────────────────────────────── */

/** 이 요청이 청하는 일 — 셋뿐입니다. */
export type FreeStage = "setup" | "reply" | "summary";

/** 상황과 인물을 만들어 달라는 요청 (대화가 시작되기 전) */
export interface FreeSetupRequest {
  stage: "setup";
  seed: string;
}

/** 인물이 다음 한 마디를 하도록 하는 요청 */
export interface FreeReplyRequest {
  stage: "reply";
  seed: string;
  situation: string;
  persona: string;
  /** 「인물: …」·「학습자: …」 줄들 — 학습자 줄은 **가명처리를 지난 문자열**입니다 */
  history: string[];
}

/** 마무리 요약 요청 — 인용 가능 문서 목록이 함께 나갑니다(가드가 대조할 기준입니다) */
export interface FreeSummaryRequest {
  stage: "summary";
  seed: string;
  situation: string;
  persona: string;
  history: string[];
  docs: readonly CoachDocRef[];
}

export type FreeRequest = FreeSetupRequest | FreeReplyRequest | FreeSummaryRequest;

/** 대화 한 줄 — 화면이 들고 있는 모양 그대로입니다(저장하지 않습니다). */
export interface FreeTurn {
  speaker: "character" | "learner";
  text: string;
}

/**
 * 대화를 요청에 실을 줄 목록으로 옮깁니다.
 *
 * **학습자 줄은 여기서 가명처리를 거칩니다**(engine/masking.ts). 부르는 쪽이 잊어버릴 수 있는
 * 일을 부르는 쪽에 맡기지 않으려고 이 안에 둡니다 — 코칭 요청(`buildCoachRequest`)과 같은 규율입니다.
 * 화면에는 원문이 그대로 남습니다(자기 기기 안에서 자기가 한 말을 가릴 이유가 없습니다).
 *
 * @example
 * buildHistory([{ speaker: "learner", text: "010-1234-5678로 연락드릴게요" }]);
 * // ["학습자: [번호]로 연락드릴게요"]
 */
export function buildHistory(turns: readonly FreeTurn[]): string[] {
  const out: string[] = [];
  for (const turn of turns.slice(-FREE_HISTORY_MAX_LINES)) {
    const body =
      turn.speaker === "learner" ? maskText(turn.text.trim()).masked : turn.text.trim();
    if (body.length === 0) continue;
    const prefix = turn.speaker === "learner" ? FREE_LEARNER_PREFIX : FREE_CHARACTER_PREFIX;
    out.push(`${prefix}: ${body}`.slice(0, FREE_HISTORY_LINE_MAX));
  }
  return out;
}

/** 상황·인물을 만들어 달라는 요청 한 덩어리 */
export function buildSetupRequest(seed: FreeSeed): FreeSetupRequest {
  return { stage: "setup", seed: seedLine(seed).slice(0, FREE_SEED_MAX) };
}

export interface FreeSceneContext {
  seed: FreeSeed;
  /** 가드를 지난 상황 지문 */
  situation: string;
  /** 가드를 지난 인물 소개 */
  persona: string;
  turns: readonly FreeTurn[];
}

/** 인물의 다음 한 마디를 청하는 요청 한 덩어리 */
export function buildReplyRequest(context: FreeSceneContext): FreeReplyRequest {
  return {
    stage: "reply",
    seed: seedLine(context.seed).slice(0, FREE_SEED_MAX),
    situation: context.situation.trim().slice(0, FREE_SITUATION_MAX),
    persona: context.persona.trim().slice(0, FREE_PERSONA_MAX),
    history: buildHistory(context.turns),
  };
}

/** 마무리 요약을 청하는 요청 한 덩어리 — 인용 가능 문서 목록이 함께 나갑니다 */
export function buildSummaryRequest(context: FreeSceneContext): FreeSummaryRequest {
  return { ...buildReplyRequest(context), stage: "summary", docs: citableDocRefs() };
}

/* ── 프롬프트 ──────────────────────────────────────────── */

/** 세 단계가 함께 지키는 규칙 — 한 자리에 적어 두고 단계마다 이어 붙입니다. */
function commonRules(): string[] {
  return [
    "· 한국어로만 씁니다.",
    "· 점수·등급·순위·백분위를 쓰지 않습니다. 진단·처방을 하지 않고, 몸에 손이 닿는 동작(밀기·붙잡기·이물 제거·가슴압박 등)을 지도하거나 요구하지 않습니다.",
    // 목록은 코칭·변주와 **같은 상수**를 봅니다 — 두 곳에 따로 적으면 어느 날 한쪽만 고쳐집니다.
    `· 다음 표현을 쓰지 않습니다: ${BANNED_PHRASES.join(" / ")}`,
    "· 자신이 어떤 모델인지, 어디서 만들었는지 밝히지 않습니다.",
    "· 응급 상황(질식·의식 소실·경련·심한 출혈·낙상 후 통증)을 만들지 않습니다. 그런 장면은 이 연습에서 다루지 않습니다.",
    "· 실존 인물·기관·상호를 쓰지 않습니다. 이름은 흔한 성씨 한 자로만 짓습니다.",
  ];
}

/**
 * 시스템 프롬프트 — 단계마다 지켜야 할 것을 전부 문장으로 적어 둡니다.
 *
 * 코칭·변주와 같은 원칙입니다: 여기 적은 규칙을 지켰는지는 **믿지 않고 가드로 다시 확인합니다**.
 * 프롬프트는 성공률을 올리는 장치이고, 안전을 보장하는 장치는 `applyFree*Guards` 쪽입니다.
 * 상류에 실어 보내는 곳은 서버 라우트이고, 문장은 여기서만 짭니다.
 */
export function buildFreeSystemPrompt(request: FreeRequest): string {
  if (request.stage === "setup") {
    return [
      "당신은 요양보호사 훈련 시뮬레이터의 **상황 작가**입니다. 연습할 장면 하나와 그 장면에 나오는 가상 인물 한 사람을 만듭니다. 아래 규칙을 하나라도 어기면 답은 폐기되고 사용자에게 닿지 않습니다.",
      "",
      "규칙",
      `1. 상황 지문은 두세 문장, ${FREE_SITUATION_MAX}자 이내입니다. 요양보호사가 그 자리에 막 들어선 순간을 3인칭으로 적습니다.`,
      `2. 인물 소개는 한 문장, ${FREE_PERSONA_MAX}자 이내입니다. 이름·나이대·지금 마음 상태만 담습니다.`,
      "3. 정답이나 대응 요령을 적지 않습니다. 상황만 놓고, 무슨 말을 할지는 학습자가 정합니다.",
      ...commonRules(),
      "",
      '출력은 다른 말 없이 JSON 한 덩어리로만 합니다: {"situation": "상황 지문", "persona": "인물 소개"}',
    ].join("\n");
  }

  if (request.stage === "reply") {
    return [
      "당신은 요양보호사 훈련 시뮬레이터에서 **한 등장인물을 연기**합니다. 학습자가 방금 한 말에 그 인물로서 답하는 것이 전부입니다. 아래 규칙을 하나라도 어기면 답은 폐기됩니다.",
      "",
      "규칙",
      `1. 한두 문장, ${FREE_LINE_MAX}자 이내로 그 인물의 입말로만 말합니다.`,
      "2. 학습자에게 조언하지 않습니다. 당신은 코치가 아니라 그 인물입니다.",
      "3. 연기 밖의 말(설명·사과·머리말·지문)을 붙이지 않습니다.",
      "4. 상황을 갑자기 뒤집지 않습니다 — 학습자의 말에 반응해 조금씩 움직입니다.",
      "5. 학습자에게 몸에 손대는 일이나 약·의료 처치를 시키지 않습니다.",
      ...commonRules(),
      "",
      '출력은 다른 말 없이 JSON 한 덩어리로만 합니다: {"line": "인물의 대사"}',
    ].join("\n");
  }

  const docLines = request.docs.map((doc) => `- ${doc.id} : ${doc.title}`).join("\n");
  return [
    "당신은 요양보호사 훈련 시뮬레이터의 **코칭 보조**입니다. 방금 끝난 연습 대화를 읽고, 다음에 해 보실 수 있는 것을 짚어 드립니다. 아래 규칙을 하나라도 어기면 답은 폐기되고 사용자에게 닿지 않습니다.",
    "",
    "규칙",
    `1. 한국어 존댓말로 두세 문장, ${FREE_SUMMARY_MAX}자 이내로만 씁니다.`,
    "2. 나무라지 않습니다. 잘된 대목 하나와 다음에 해 보실 수 있는 것 하나를 짚습니다.",
    "3. 잘함·못함을 가르는 말, 등급·점수·합격 여부를 쓰지 않습니다. 이 연습은 채점하지 않습니다.",
    "4. 근거 문서는 아래 목록의 id 중 하나만 씁니다. 마땅한 근거가 없으면 docId를 null로 둡니다. 목록 밖 문서나 지어낸 문서를 대면 답이 폐기됩니다.",
    ...commonRules(),
    "",
    "인용 가능 문서",
    docLines.length > 0 ? docLines : "- (이번에는 인용 가능 문서가 전달되지 않았습니다)",
    "",
    '출력은 다른 말 없이 JSON 한 덩어리로만 합니다: {"summary": "요약", "docId": "DOC-... 또는 null"}',
  ].join("\n");
}

/** 사용자 프롬프트 — 시드·상황·인물·대화를 그대로 옮깁니다. */
export function buildFreeUserPrompt(request: FreeRequest): string {
  if (request.stage === "setup") {
    return [
      `[연습 시드] ${request.seed}`,
      "[할 일] 이 시드에 맞는 상황 지문 하나와 가상 인물 한 사람을 만들어 주십시오.",
    ].join("\n");
  }

  const history =
    request.history.length > 0
      ? request.history.map((line) => `- ${line}`).join("\n")
      : "- (아직 오간 말이 없습니다)";

  const tail =
    request.stage === "reply"
      ? "[다음 차례] 인물로서 한 마디만 해 주십시오."
      : "[할 일] 이 대화를 읽고 잘된 대목 하나와 다음에 해 보실 수 있는 것 하나를 짚어 주십시오.";

  return [
    `[연습 시드] ${request.seed}`,
    `[상황] ${request.situation}`,
    `[연기할 인물] ${request.persona}`,
    "[지금까지의 대화]",
    history,
    tail,
  ].join("\n");
}

/* ── 가드 ──────────────────────────────────────────────── */

/** 가드가 막은 자리 — 화면·점검·회귀 검사가 같은 낱말을 봅니다. */
export type FreeBlockId = "format" | "length" | "phrase" | "safety" | "evidence";

export const FREE_BLOCK_LABEL: Record<FreeBlockId, string> = {
  format: "형식 확인",
  length: "길이 상한",
  phrase: "표현 검사",
  safety: "위험 신호 대조",
  evidence: "근거 가드",
};

/**
 * 이 문장이 ⚑CF 신호를 달고 있는가 — **절대 기준**입니다.
 *
 * 대사 변주(`onlineVary.ts`)는 「앵커에 없던 신호가 새로 생기면」으로 봅니다. 검수 앵커 자체가
 * 신호를 달고 있는 자리가 있기 때문입니다(그 요구를 거절하는 것이 그 장면의 과제입니다).
 * 자유 연습에는 그 앵커가 없습니다. 대조할 기준이 없으니 기준을 절대값으로 둡니다 —
 * 생성문에 ⚑CF 신호가 하나라도 붙으면 그 문장은 화면에 서지 못합니다.
 *
 * **이 단은 그물이지 벽이 아닙니다.** 규칙 사전은 적어 둔 활용형에만 닿습니다 —
 * 사전 밖 표현은 지나갈 수 있고, 폭은 `engine/rules.ts`가 적어 둔 그대로입니다.
 * 여기서 넓히지 않습니다(판정 엔진은 재사용만 합니다). 화면 문구도 이 폭에 맞춰 적습니다.
 */
export function generatedCriticalSignal(text: string, type: FreeSeedType): string | undefined {
  const critical = checkCritical(text, { scenarioType: type });
  if (!critical.cf) return undefined;
  return `${critical.label ?? critical.ruleId ?? "⚑CF"} 「${critical.matched ?? ""}」`;
}

/**
 * 학습자 발화의 ⚑CF 판정 — 대화를 멈출지 정하는 자리입니다.
 *
 * 넘기는 맥락은 **유형 하나뿐**입니다. `cueId`(국면 게이트)도 `appliedRubric`(시나리오별 적용
 * 항목)도 없습니다 — 자유 연습에는 CUE도 시나리오도 없으므로 좁힐 근거가 없고, 좁히지 않은
 * 전역 사전이 이 자리의 그물입니다. 돌려주는 값은 엔진의 것 그대로이고, **판정으로 기록되지
 * 않습니다** — 멈추는 데에만 씁니다.
 *
 * @example checkLearnerUtterance("문을 잠그겠습니다", "BPSD").cf; // true
 */
export function checkLearnerUtterance(utterance: string, type: FreeSeedType): CriticalCheck {
  return checkCritical(utterance, { scenarioType: type });
}

export interface FreeSetupOutcome {
  status: "ok" | "blocked" | "fallback";
  /** 가드를 지난 상황 지문 (`ok`가 아니면 빈 문자열) */
  situation: string;
  /** 가드를 지난 인물 소개 (`ok`가 아니면 빈 문자열) */
  persona: string;
  blocked?: FreeBlockId;
  blockedDetail?: string;
  fallback?: OnlineCoachFallback;
  /** 안전 대조에 걸려 한 번 더 청했는가 */
  retried?: boolean;
}

export interface FreeLineOutcome {
  /**
   * 화면에 세울 대사.
   * `ok`면 생성문, `replaced`면 고정 대체 문구, `fallback`이면 **빈 문자열**입니다 —
   * 연결이 안 되었을 때 말풍선을 만들지 않는 것이 지어내지 않는 쪽입니다.
   */
  text: string;
  status: "ok" | "replaced" | "fallback";
  blocked?: FreeBlockId;
  blockedDetail?: string;
  fallback?: OnlineCoachFallback;
  retried?: boolean;
}

export interface FreeSummaryOutcome {
  status: "ok" | "blocked" | "fallback";
  /** `ok`면 요약, 아니면 `FREE_SUMMARY_FAILED` — 지어낸 문장을 세우지 않습니다 */
  message: string;
  /** 근거 가드를 통과한 문서 id (없을 수도 있습니다) */
  docId?: string;
  blocked?: FreeBlockId;
  blockedDetail?: string;
  fallback?: OnlineCoachFallback;
}

function blockedSetup(id: FreeBlockId, detail?: string): FreeSetupOutcome {
  const base: FreeSetupOutcome = { status: "blocked", situation: "", persona: "", blocked: id };
  return detail === undefined ? base : { ...base, blockedDetail: detail };
}

function blockedLine(id: FreeBlockId, detail?: string): FreeLineOutcome {
  const base: FreeLineOutcome = {
    status: "replaced",
    text: FREE_FALLBACK_LINE,
    blocked: id,
  };
  return detail === undefined ? base : { ...base, blockedDetail: detail };
}

function blockedSummary(id: FreeBlockId, detail?: string): FreeSummaryOutcome {
  const base: FreeSummaryOutcome = {
    status: "blocked",
    message: FREE_SUMMARY_FAILED,
    blocked: id,
  };
  return detail === undefined ? base : { ...base, blockedDetail: detail };
}

/**
 * 상황 지문·인물 소개 가드 — 형식 · 길이 · 표현 · 위험 신호.
 *
 * @example applySetupGuards('{"situation":"...","persona":"..."}', "BPSD").status; // "ok"
 */
export function applySetupGuards(raw: string, type: FreeSeedType): FreeSetupOutcome {
  /* ① 형식 — JSON으로 오지 않았거나 두 칸 중 하나가 비었으면 버립니다. */
  const parsed = extractJson(raw);
  const situation = typeof parsed?.situation === "string" ? parsed.situation.trim() : "";
  const persona = typeof parsed?.persona === "string" ? parsed.persona.trim() : "";
  if (!parsed || situation.length === 0 || persona.length === 0) return blockedSetup("format");

  /* ② 길이 — 두어 문장을 넘어서면 지문이 아니라 대본입니다. */
  if (situation.length > FREE_SITUATION_MAX) {
    return blockedSetup("length", `상황 ${situation.length}자`);
  }
  if (persona.length > FREE_PERSONA_MAX) {
    return blockedSetup("length", `인물 ${persona.length}자`);
  }

  /* ③ 표현 — 금지 표현 8종과 모델 정체 노출(코칭·변주와 **같은 체**입니다). */
  const banned = findBannedExpression(`${situation} ${persona}`);
  if (banned) return blockedSetup("phrase", `「${banned}」`);

  /* ④ 위험 — ⚑CF 신호가 붙은 장면을 만들어 오면 버립니다(절대 기준). */
  const signal = generatedCriticalSignal(situation, type) ?? generatedCriticalSignal(persona, type);
  if (signal) return blockedSetup("safety", signal);

  return { status: "ok", situation, persona };
}

/**
 * 인물 대사 가드 — 형식 · 길이 · 표현 · 위험 신호.
 * 어느 단에서 막히든 돌려주는 문장은 고정 대체 문구이므로, 부르는 쪽은 빈 화면을 다루지 않습니다.
 *
 * @example applyLineGuards('{"line":"집에 좀 보내 줘요."}', "BPSD").status; // "ok"
 */
export function applyLineGuards(raw: string, type: FreeSeedType): FreeLineOutcome {
  /* ① 형식 */
  const parsed = extractJson(raw);
  const line = typeof parsed?.line === "string" ? parsed.line.trim() : "";
  if (!parsed || line.length === 0) return blockedLine("format");

  /* ② 길이 — 한두 문장이 이 자리의 약속입니다. */
  if (line.length > FREE_LINE_MAX) return blockedLine("length", `${line.length}자`);

  /* ③ 표현 */
  const banned = findBannedExpression(line);
  if (banned) return blockedLine("phrase", `「${banned}」`);

  /* ④ 위험 — 인물의 입에서 ⚑CF 신호가 나오면 버립니다(절대 기준). */
  const signal = generatedCriticalSignal(line, type);
  if (signal) return blockedLine("safety", signal);

  return { status: "ok", text: line };
}

/**
 * 마무리 요약 가드 — 형식 · 근거 · 표현 · 길이.
 *
 * 근거 단이 코칭(`onlineCoach.applyGuards`)과 같은 자리에 있습니다 — 목록 밖 문서를 근거로
 * 내밀면 요약 전체를 버립니다(L2 원칙). 막히면 화면에는 「요약을 만들지 못했습니다」만 섭니다.
 *
 * @example applySummaryGuards('{"summary":"…","docId":"없는것-999"}').blocked; // "evidence"
 */
export function applySummaryGuards(
  raw: string,
  guard: EvidenceGuard = EVIDENCE_GUARD,
): FreeSummaryOutcome {
  /* ① 형식 */
  const parsed = extractJson(raw);
  const summary = typeof parsed?.summary === "string" ? parsed.summary.trim() : "";
  if (!parsed || summary.length === 0) return blockedSummary("format");

  /* ② 근거 — 목록 밖 문서를 근거로 들면 버립니다. */
  const rawDocId = parsed.docId;
  const docId =
    typeof rawDocId === "string" && rawDocId.trim().length > 0 && rawDocId.trim() !== "null"
      ? rawDocId.trim()
      : undefined;
  const evidence = checkEvidence(docId, guard);
  if (!evidence.allowed) return blockedSummary("evidence", `「${docId}」`);

  /* ③ 표현 */
  const banned = findBannedExpression(summary);
  if (banned) return blockedSummary("phrase", `「${banned}」`);

  /* ④ 길이 */
  if (summary.length > FREE_SUMMARY_MAX) {
    return blockedSummary("length", `${summary.length}자`);
  }

  return evidence.docId
    ? { status: "ok", message: summary, docId: evidence.docId }
    : { status: "ok", message: summary };
}

/* ── 호출 ──────────────────────────────────────────────── */

export interface FreeOptions {
  /** 시험용 주입 자리 — 넘기지 않으면 전역 fetch를 씁니다 */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  guard?: EvidenceGuard;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/** `/api/coach`가 돌려준 몸통에서 원문 한 덩어리만 읽습니다(코칭·변주와 같은 계약입니다). */
function readRelay(payload: unknown): { content?: string; fallback?: OnlineCoachFallback } {
  if (typeof payload !== "object" || payload === null) return { fallback: "http" };
  const record = payload as { status?: unknown; content?: unknown };
  if (record.status === "unconfigured") return { fallback: "config" };
  if (record.status === "rate_limited") return { fallback: "rate_limited" };
  if (record.status === "ok" && typeof record.content === "string" && record.content.length > 0) {
    return { content: record.content };
  }
  return { fallback: "http" };
}

/**
 * 같은 도메인 `/api/coach`를 한 번 부르고 **원문 한 덩어리**만 받아 옵니다(`task: "free"`).
 * 키를 붙이지 않습니다 — 붙일 키가 이 기기에 없습니다.
 */
async function relayFree(
  request: FreeRequest,
  options: FreeOptions,
): Promise<{ content?: string; fallback?: OnlineCoachFallback }> {
  // 오프라인이면 애초에 부르지 않습니다. 화면도 문 앞에서 막지만(`/practice`의 안내 카드),
  // 대화 도중에 회선이 끊기는 자리는 화면 밖이라 여기에도 같은 확인을 둡니다.
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { fallback: "offline" };
  }

  const doFetch = options.fetchImpl ?? (typeof fetch === "function" ? fetch : undefined);
  if (!doFetch) return { fallback: "network" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? FREE_TIMEOUT_MS);

  let payload: unknown;
  try {
    const response = await doFetch(FREE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({ task: "free", ...request }),
    });
    if (!response.ok) return { fallback: "http" };
    payload = await response.json();
  } catch (error) {
    return { fallback: isAbortError(error) ? "timeout" : "network" };
  } finally {
    clearTimeout(timer);
  }

  return readRelay(payload);
}

/**
 * 상황과 인물을 만들어 옵니다.
 *
 * 안전 대조(가드 ④)에 걸리면 **한 번만** 더 청합니다. 두 번 다 걸리면 상황을 만들지 못한 채
 * 끝냅니다 — 여기서 고정 장면을 대신 세우면 그것은 이미 자유 연습이 아니라 검증 훈련이고,
 * 그 자리는 검수된 시나리오 여섯 종이 이미 훨씬 낫게 하고 있습니다.
 */
export async function requestFreeSetup(
  request: FreeSetupRequest,
  config: OnlineCoachingSettings,
  type: FreeSeedType,
  options: FreeOptions = {},
): Promise<FreeSetupOutcome> {
  if (!config.enabled) {
    return { status: "fallback", situation: "", persona: "", fallback: "disabled" };
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const retried = attempt > 0;
    const relayed = await relayFree(request, options);
    if (relayed.content === undefined) {
      return {
        status: "fallback",
        situation: "",
        persona: "",
        fallback: relayed.fallback ?? "http",
        ...(retried ? { retried } : {}),
      };
    }
    const outcome = applySetupGuards(relayed.content, type);
    if (outcome.status === "ok") return retried ? { ...outcome, retried } : outcome;
    // 다시 청하는 것은 위험 신호로 막힌 경우뿐입니다 — 형식·길이·표현은 한 번 더 청해도
    // 같은 값이 돌아오기 쉽고, 값만 두 번 치릅니다.
    if (outcome.blocked !== "safety" || retried) {
      return retried ? { ...outcome, retried } : outcome;
    }
  }

  return blockedSetup("safety");
}

/**
 * 인물의 다음 한 마디를 받아 옵니다.
 *
 * 안전 대조에 걸리면 **한 번만** 더 청하고, 그래도 걸리면 고정 대체 문구를 세웁니다
 * (`FREE_FALLBACK_LINE`) — 대화를 끊지 않으면서 걸린 문장은 화면에 세우지 않는 자리입니다.
 * 연결이 안 되거나 늦으면 말풍선을 만들지 않습니다(`text`가 빈 문자열입니다).
 */
export async function requestFreeLine(
  request: FreeReplyRequest,
  config: OnlineCoachingSettings,
  type: FreeSeedType,
  options: FreeOptions = {},
): Promise<FreeLineOutcome> {
  if (!config.enabled) return { text: "", status: "fallback", fallback: "disabled" };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const retried = attempt > 0;
    const relayed = await relayFree(request, options);
    if (relayed.content === undefined) {
      return {
        text: "",
        status: "fallback",
        fallback: relayed.fallback ?? "http",
        ...(retried ? { retried } : {}),
      };
    }
    const outcome = applyLineGuards(relayed.content, type);
    if (outcome.status === "ok") return retried ? { ...outcome, retried } : outcome;
    if (outcome.blocked !== "safety" || retried) {
      return retried ? { ...outcome, retried } : outcome;
    }
  }

  return blockedLine("safety");
}

/**
 * 마무리 요약을 받아 옵니다 — 근거 가드를 지난 것만 화면에 닿습니다.
 * 막히거나 늦으면 「요약을 만들지 못했습니다」만 남습니다(요약을 지어내지 않습니다).
 */
export async function requestFreeSummary(
  request: FreeSummaryRequest,
  config: OnlineCoachingSettings,
  options: FreeOptions = {},
): Promise<FreeSummaryOutcome> {
  if (!config.enabled) {
    return { status: "fallback", message: FREE_SUMMARY_FAILED, fallback: "disabled" };
  }

  const relayed = await relayFree(request, options);
  if (relayed.content === undefined) {
    return {
      status: "fallback",
      message: FREE_SUMMARY_FAILED,
      fallback: relayed.fallback ?? "http",
    };
  }
  return applySummaryGuards(relayed.content, options.guard);
}

/* ── 이 기기의 연습 횟수 ───────────────────────────────── */

/**
 * 저장소에 남는 **유일한** 칸 — 연습 횟수 하나입니다.
 *
 * 대화도, 만들어진 상황도, 인물도, 요약도 담지 않습니다. 세션 기록(`chimchak.sessions.v1`)과
 * 열쇠를 나누지 않는 것도 같은 이유입니다 — 이 모드의 결과가 `/history`의 성장 기록이나
 * 이수 확인서에 섞이면, 채점하지 않는다는 약속이 화면 밖에서 조용히 깨집니다.
 */
export const FREE_PRACTICE_KEY = "chimchak.practice.v1";

function getStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/** 이 기기에서 자유 연습을 해 본 횟수 (읽을 수 없으면 0) */
export function readPracticeCount(): number {
  const storage = getStorage();
  if (!storage) return 0;
  try {
    const raw = storage.getItem(FREE_PRACTICE_KEY);
    if (!raw) return 0;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return 0;
    const count = (parsed as { count?: unknown }).count;
    return typeof count === "number" && Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  } catch {
    return 0;
  }
}

/** 한 번 마쳤음을 세어 둡니다. 저장이 막힌 환경에서는 조용히 지나갑니다. */
export function bumpPracticeCount(): number {
  const next = readPracticeCount() + 1;
  const storage = getStorage();
  if (!storage) return next;
  try {
    storage.setItem(FREE_PRACTICE_KEY, JSON.stringify({ count: next }));
  } catch {
    /* 저장 공간 부족·사생활 보호 모드 — 세지 못해도 연습에는 아무 영향이 없습니다. */
  }
  return next;
}

/* ── 열려 있는가 ───────────────────────────────────────── */

/**
 * 이 기기에서 자유 연습을 열 수 있는가 — **사용자가 온라인 모드를 켜 두었는가** 하나입니다.
 *
 * 서버에 상류 연결이 준비돼 있는지는 브라우저가 미리 알 방법이 없습니다(주소도 모델 이름도
 * 키도 서버에만 있습니다). 준비돼 있지 않으면 첫 요청이 `config` 폴백으로 돌아오고, 화면은
 * 그 사실을 그대로 적습니다 — 미리 「열린다」고 말해 두고 빈 화면을 보여 드리지 않습니다.
 */
export function isFreePracticeActive(
  settings: OnlineCoachingSettings = getSettings().onlineCoaching,
): boolean {
  return settings.enabled;
}
