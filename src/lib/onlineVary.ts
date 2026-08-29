/**
 * 대사 변주(경량 LLM) — **어르신을 연기하는 일**입니다.
 *
 * 이 앱의 대사는 전부 검수된 앵커 문장입니다. 그래서 같은 시나리오를 두 번 하면 어르신이
 * 토씨 하나 틀리지 않고 같은 말을 하십니다 — 사람은 그렇게 말하지 않습니다. 여기서 하는 일은
 * 하나뿐입니다: **같은 뜻·같은 정보·같은 감정 강도를 그 인물의 입말로 다시 말하게 하는 것**.
 * 새 사실을 만들라고 시키지 않고, 만들어 오면 기기 안에서 막습니다.
 *
 * 나가는 것과 나가지 않는 것
 *  · 나가는 것 — 시나리오 한 줄 요약 · 그 인물의 프로필 · **검수 앵커 원문** · 직전 인물 대사 몇 줄.
 *    전부 이 앱이 이미 화면에 띄우고 있는 문장이고, 앱 번들에 그대로 들어 있는 것들입니다.
 *  · 나가지 않는 것 — **학습자 발화**입니다. 맥락에 담으면 편하지만 담지 않습니다. 이 앱이
 *    「기기 밖으로 나가는 것은 미분류 턴의 가명처리된 발화 한 문장뿐」이라고 적어 둔 약속을,
 *    편의를 위해 조용히 넓히지 않습니다(`recentLines`를 만드는 쪽이 이 규칙을 지킵니다).
 *
 * **이 목록이 이 기능의 기본값을 정합니다.** 개인정보가 나가지 않으므로 동의 게이트가 붙을
 * 자리가 아니고, 그래서 스위치(`settings.aiDialogue`)는 **기본이 켬**입니다 — 하신 말씀이
 * 나가는 자리(코칭 보조·자유 연습)의 동의 칸(`settings.onlineCoaching`)과는 다른 칸입니다.
 * 위 목록이 한 줄이라도 늘어나면 그 순간 이 문단이 거짓이 되고, 기본값도 함께 다시 정해야 합니다.
 *
 * 제외하는 자리
 *  · **응급 유형 시나리오 전체**(L3 원칙). 기도폐쇄·낙상 장면의 대사는 한 낱말이 대응을 가릅니다.
 *    「여기서부터 AI가 화면에서 빠집니다」라고 적어 둔 유형에서 대사만 다시 쓰는 것은 앞뒤가
 *    맞지 않습니다 — 유형 단위로 통째로 뺍니다.
 *  · 상황 안내(system)·검수된 고정 안내(protocol)·119 상황실(dispatcher). 사람이 말을 고르는
 *    자리가 아니거나, 고정 문구로 남아야 하는 자리입니다.
 *  · 코칭·⚑CF 문구·강화 문구·프로토콜 — 애초에 이 파일이 닿지 않는 자리입니다.
 *
 * 가드 (전부 순수 함수 · 앵커 대비 · 하나라도 막히면 **앵커 원문**을 씁니다)
 *
 * ※ **화면에는 「다섯 단」으로 적습니다.** 막는 단은 ①②③④⑥ 다섯이고(`VaryBlockId`도 다섯입니다),
 *   ⑤동일은 막는 단이 아니라 그대로 통과시키는 규칙입니다. 아래 번호는 읽는 순서일 뿐이니,
 *   이 목록을 세어 화면 문구를 「여섯 단」으로 적지 마십시오 — 심사석이 대조하는 숫자입니다.
 *   ① 형식 — JSON 한 덩어리로 오지 않았거나 문장이 비었으면 버립니다.
 *   ② 길이 — 앵커의 60~160% 밖이면 버립니다(요약도 부풀리기도 「같은 뜻」이 아닙니다).
 *   ③ 숫자 — 앵커에 없던 숫자가 하나라도 생기면 버립니다(시각·나이·호수·119…).
 *   ④ 표현 — 금지 표현 8종과 모델 정체어가 섞이면 버립니다(코칭과 **같은 목록**입니다).
 *   ⑤ 동일 — 앵커와 똑같이 돌아오면 그대로 씁니다. 막을 이유가 없고, 다만 바뀐 것이 없으므로
 *      화면의 「변주」 표기는 붙이지 않습니다(있는 것을 숨기지 않는 만큼, 없는 것을 있다고도 하지 않습니다).
 *   ⑥ 위험 — 변주문과 앵커를 각각 **판정 규칙 엔진**에 넣어, 앵커에 없던 ⚑CF·코칭 신호가
 *      새로 생기면 버립니다(`applyVaryGuards`의 마지막 단). 그물의 실제 폭은 그 함수에 적어 둡니다.
 *
 * 막히든 늦든 실패하든 화면에 서는 문장은 **언제나 검수 앵커**입니다 — 화면이 표류하지 않습니다.
 *
 * @example
 * const outcome = await varyLine({ scenario, speaker: "elder", anchor: turn.text, recentLines: [] });
 * outcome.text;   // 변주문 또는 앵커 원문
 * outcome.varied; // 앵커와 다른 문장이 들어섰는가
 */

import { checkAdvisory, checkCritical, type RuleCheckOptions } from "@/engine/rules";
import type { PersonaDef, Scenario, ScenarioType, TurnDef } from "@/types";
import {
  BANNED_PHRASES,
  COACH_ENDPOINT,
  coachRequestHeaders,
  extractJson,
  findBannedExpression,
  rememberCoachToken,
  squash,
  type OnlineCoachFallback,
} from "./onlineCoach";
import { getSettings, type AiDialogueSettings } from "./settings";

/* ── 상수 ──────────────────────────────────────────────── */

/** 변주를 청하는 주소 — 코칭과 **같은 한 곳**입니다(CSP `connect-src 'self'`가 그대로 참입니다). */
export const VARY_ENDPOINT = COACH_ENDPOINT;

/**
 * 응답을 기다리는 상한(ms). 서버가 상류에 거는 상한이 6초라 그보다 뒤에 끊습니다.
 *
 * ※ 화면이 실제로 기다리는 시간은 이 값이 아니라 **1200ms**입니다(TrainSession).
 *   여기서 6초를 두는 것은 늦게 도착한 응답을 캐시에 담아 **다음 방문에서 쓰기** 위해서입니다 —
 *   이번 대사는 이미 앵커로 펴진 뒤입니다.
 */
export const LINE_VARY_TIMEOUT_MS = 6000;

/** 길이 하한·상한 (앵커 길이 대비) */
export const VARY_MIN_RATIO = 0.6;
export const VARY_MAX_RATIO = 1.6;

/** 맥락으로 실어 보내는 직전 대사 수 — **학습자 발화는 세지 않습니다** */
export const VARY_MAX_RECENT_LINES = 3;

/**
 * 나가는 칸마다의 길이 상한 — **서버 검증과 같은 값**입니다(라우트가 이 상수를 그대로 씁니다).
 *
 * 한 자리에만 적어 두는 이유: 두 곳에 따로 적으면 어느 날 한쪽만 늘어나고, 그때 요청은
 * 조용히 400으로 끊깁니다 — 화면에는 아무 표시도 나지 않는 고장입니다.
 * 앵커가 상한을 넘으면 애초에 청하지 않습니다(그 길이는 대사가 아니라 지문에 가깝습니다).
 */
export const VARY_ANCHOR_MAX = 400;
export const VARY_PERSONA_MAX = 600;
export const VARY_RECENT_LINE_MAX = 300;

/** 말풍선에 붙는 표기 한 낱말 (문자만 씁니다 — 아이콘·이모지 없음) */
export const VARIED_LINE_LABEL = "변주";

/** 그 표기가 뜻하는 것 — 보조기술에는 문장으로 전합니다. */
export const VARIED_LINE_NOTE = "AI가 검수 대사를 같은 뜻으로 바꿔 말했습니다";

/**
 * 말투가 「매번 조금씩 다르게」인 세션의 생성 자리 고지.
 *
 * 꺼 두었을 때의 고지(`GENERATION_ADAPTER_NOTE`)와 짝이 되도록 적어 둔 문장입니다. 다만
 * **지금은 이 문장을 세우는 자리가 없습니다** — 세션 상단의 생성 자리 고지가 2026-08-24에
 * 걷혔고, 이 상수를 읽는 곳이 `src` 전체에 없습니다. 그 말투로 돌고 있다는 표시는 변주가
 * 붙은 말풍선의 「AI 생성 · 변주」 한 줄뿐입니다. 세션 상단 고지를 되살리실 때 쓰십시오.
 */
export const VARY_ADAPTER_NOTE =
  "AI가 어르신·보호자를 연기하고 있어, 검수 문장과 같은 뜻으로 다시 쓰인 대사가 나올 수 있습니다. 바뀐 대사에는 「변주」 표기가 붙고, 판정은 그대로 규칙이 합니다. 하신 말씀은 나가지 않습니다.";

/* ── 결과 모양 ─────────────────────────────────────────── */

/** 가드가 막은 자리 — 무엇이 막았는지 결과에 그대로 남깁니다. */
export type VaryBlockId = "format" | "length" | "number" | "phrase" | "safety";

/** 가드 이름 — 화면·점검·회귀 검사가 같은 낱말을 봅니다. */
export const VARY_BLOCK_LABEL: Record<VaryBlockId, string> = {
  format: "형식 확인",
  length: "길이 비율",
  number: "숫자 대조",
  phrase: "표현 검사",
  safety: "위험 신호 대조",
};

export interface LineVaryOutcome {
  /** 화면에 그대로 세울 대사 — **어떤 경우에도 비지 않습니다**(막히면 앵커 원문). */
  text: string;
  /** 앵커와 다른 문장이 들어섰는가 — 화면의 「변주」 표기가 이 값 하나를 봅니다. */
  varied: boolean;
  /** 막힌 가드 (통과했거나 애초에 부르지 않았으면 없습니다) */
  blocked?: VaryBlockId;
  /** 막았을 때 무엇을 보고 막았는지 (걸린 숫자·표현 등) */
  blockedDetail?: string;
  /** 조용히 앵커로 되돌아간 까닭 (코칭과 같은 목록을 씁니다) */
  fallback?: OnlineCoachFallback;
}

/* ── 요청 모양 ─────────────────────────────────────────── */

/**
 * `/api/coach`로 나가는 몸통 그대로입니다(`task: "vary"`).
 *
 * 서버는 **이 네 칸만** 읽어 새로 조립해 상류로 보냅니다(`readVaryRequest`). 그 밖의 값이
 * 붙어 와도 400으로 끊지는 않습니다 — 조립에서 빠지므로 상류에 닿지 않을 뿐입니다.
 * 화면 문구(특히 /legal §4-(2))도 이 사실에 맞춰 적습니다: 「거절합니다」가 아니라
 * 「아는 칸만 새로 조립하고, 그 밖의 값은 상류에 닿지 않습니다」입니다.
 */
export interface LineVaryRequest {
  /** 지금 어떤 상황인지 한 덩어리로 */
  scenarioSummary: string;
  /** 이 대사를 말하는 인물의 프로필 (시나리오 데이터에 적힌 그대로) */
  persona: string;
  /** 검수 앵커 원문 — 다시 쓸 대상이자, 가드가 대조할 기준입니다 */
  anchor: string;
  /** 직전 인물 대사 두어 줄 — **학습자 발화는 담기지 않습니다** */
  recentLines: string[];
}

export interface LineVaryOptions {
  /** 시험용 주입 자리 — 넘기지 않으면 전역 fetch를 씁니다 */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** 시험용 — 넘기지 않으면 저장된 설정(`aiDialogue`)을 읽습니다 */
  settings?: AiDialogueSettings;
  /**
   * 가드 ⑥이 규칙 엔진에 넘길 시나리오 유형 — `varyLine`이 채워 넘깁니다.
   *
   * 요청 몸통(`LineVaryRequest`)에는 넣지 않습니다. 넣어 봐야 서버가 아는 네 칸만 새로
   * 조립하므로 상류에 닿지 않고, 이 값은 애초에 밖으로 나갈 이유도 없습니다 —
   * **기기 안에서만** 쓰는 대조 맥락입니다.
   */
  scenarioType?: ScenarioType;
}

/** 변주를 청할 한 대사 — 화면(TrainSession)이 로그 맨 끝에서 이 네 칸을 꺼내 옵니다. */
export interface LineVaryContext {
  scenario: Scenario;
  speaker: TurnDef["speaker"];
  /**
   * 검수 앵커 원문 — 실제로 오는 것은 **턴을 여는 대사(`turn.text`)뿐**입니다.
   *
   * 학습자 응답에 대한 반응 대사(`branch.aiReaction`)는 여기 닿지 않습니다. 부르는 쪽이
   * 로그 맨 끝 하나만 보는데, 반응 대사 뒤에는 언제나 피드백 항목이 한 칸 더 쌓이기
   * 때문입니다(피드백 문구에는 폴백이 있어 비는 경우가 없습니다). 화면 문구도 이 폭에
   * 맞춰 적습니다 — /safety AI 지도가 「다시 쓰이는 것은 턴을 여는 대사」라고 밝힙니다.
   */
  anchor: string;
  /** 직전 인물 대사 두어 줄 — 부르는 쪽이 학습자 발화를 걸러 넘깁니다 */
  recentLines: string[];
}

/* ── 대상 가리기 ───────────────────────────────────────── */

/**
 * 이 화자의 대사를 변주해도 되는가 — **어르신과 보호자뿐**입니다.
 *
 * 119 상황실(dispatcher)은 뺍니다. 실전에서 그 자리의 말은 고정 안내에 가깝고, 훈련에서도
 * 「상황실이 이렇게 묻는다」가 흔들리면 배우는 것이 흔들립니다.
 *
 * @example isVariableSpeaker("elder")      // true
 * @example isVariableSpeaker("dispatcher") // false
 */
export function isVariableSpeaker(speaker: TurnDef["speaker"]): boolean {
  return speaker === "elder" || speaker === "guardian";
}

/**
 * 대사 변주에서 **통째로** 빠지는 시나리오 유형.
 *
 * 응급(`EMERGENCY`)은 L3 원칙으로 처음부터 빠져 있었고, 위험 판단(`RISK`)을 2026-08-30에
 * 같은 칸에 넣었습니다. 두 유형의 사유가 같습니다 — **여기서 흔들리는 것은 말투가 아니라
 * 판단의 근거**입니다. CHK-D01에서 「안에서 전화벨이 울립니다」가 같은 뜻이라며 「안이
 * 조용합니다」로 다시 쓰이면, 그 한 낱말이 다음 CUE의 신고 판단을 통째로 뒤집습니다.
 * 변주 가드 다섯 단(형식·길이·숫자·금지 표현·위험 신호)은 **규칙 사전에 적힌 말**만 보므로
 * 이런 사실 뒤집힘을 잡지 못합니다. 그물이 닿지 않는 자리는 애초에 열지 않습니다.
 *
 * 스위치와 무관한 불변입니다 — 사용자가 「매번 조금씩 다르게」를 골라 두어도 거짓입니다.
 * 같은 사실을 /safety AI 지도와 훈련 브리핑 첫 화면이 같은 낱말로 적습니다.
 */
export const LINE_VARY_EXCLUDED_TYPES: ReadonlyArray<Scenario["type"]> = ["EMERGENCY", "RISK"];

/** 이 시나리오가 변주 제외 유형인가 (스위치와 무관). */
export function isLineVaryExcludedType(scenario: Scenario): boolean {
  return LINE_VARY_EXCLUDED_TYPES.includes(scenario.type);
}

/**
 * 이 시나리오에서 대사 변주가 도는가 — 응급·위험 판단 유형은 **통째로** 빠집니다(L3 원칙).
 *
 * 보는 칸은 **「어르신 말투」**(`settings.aiDialogue`)입니다 — 발화 전송 동의
 * (`settings.onlineCoaching`)가 아닙니다. 두 칸이 갈린 날(2026-08-28) 이 함수가 보는 자리도
 * 함께 옮겼습니다. 그대로 두었다면 「하신 말씀은 나가지 않습니다」라고 적어 둔 기능이
 * 발화 전송을 켠 분에게만 도는, 화면과 코드가 어긋난 상태가 됩니다.
 *
 * 여기서 답하는 것은 「사용자가 이 칸에서 어느 말투를 고르셨는가 + 이 시나리오가 대상인가」
 * 둘뿐입니다.
 * 실제로 문장이 오는지는 서버 설정과 회선에 달렸고, 오지 않으면 조용히 앵커가 남습니다.
 * 유형 제외는 스위치와 무관한 불변입니다 — 켜 두어도 `LINE_VARY_EXCLUDED_TYPES`에서는 거짓입니다.
 *
 * @example isLineVaryActive(CHK_B01) // false (응급 — 켜 두어도)
 * @example isLineVaryActive(CHK_D01) // false (위험 판단 — 켜 두어도)
 */
export function isLineVaryActive(
  scenario: Scenario,
  settings: AiDialogueSettings = getSettings().aiDialogue,
): boolean {
  if (!settings.enabled) return false;
  return !isLineVaryExcludedType(scenario);
}

/** 이 화자를 설명하는 인물 프로필 (없으면 undefined — 그러면 변주를 청하지 않습니다) */
export function personaFor(
  scenario: Scenario,
  speaker: TurnDef["speaker"],
): PersonaDef | undefined {
  const role = speaker === "guardian" ? "guardian" : "care_recipient";
  return scenario.personas.find((persona) => persona.role === role);
}

/**
 * 이 대사를 요청 한 덩어리로 옮깁니다. 대상이 아니면 `undefined`입니다.
 *
 * @example
 * const request = buildVaryRequest({ scenario, speaker: "elder", anchor: turn.text, recentLines: [] });
 */
export function buildVaryRequest(context: LineVaryContext): LineVaryRequest | undefined {
  const anchor = context.anchor.trim();
  if (anchor.length === 0 || anchor.length > VARY_ANCHOR_MAX) return undefined;
  if (!isVariableSpeaker(context.speaker)) return undefined;
  // 유형 제외는 여기서도 한 번 더 봅니다 — 요청을 만드는 자리와 켜짐을 답하는 자리가
  // 갈라지면, 한쪽만 고친 날 제외한 유형의 대사가 그대로 나갑니다.
  if (isLineVaryExcludedType(context.scenario)) return undefined;

  const persona = personaFor(context.scenario, context.speaker);
  if (!persona) return undefined;

  return {
    scenarioSummary: `${context.scenario.title} (${context.scenario.typeLabel}) — ${context.scenario.context}`,
    persona: `${persona.name} — ${persona.profile}`.slice(0, VARY_PERSONA_MAX),
    anchor,
    recentLines: context.recentLines
      .map((line) => line.trim().slice(0, VARY_RECENT_LINE_MAX))
      .filter((line) => line.length > 0)
      .slice(-VARY_MAX_RECENT_LINES),
  };
}

/* ── 프롬프트 ──────────────────────────────────────────── */

/**
 * 시스템 프롬프트 — 지켜야 할 것을 전부 문장으로 적어 둡니다.
 *
 * 코칭 쪽과 같은 원칙입니다: 여기 적은 규칙을 지켰는지는 **믿지 않고 가드로 다시 확인합니다**.
 * 프롬프트는 성공률을 올리는 장치이고, 안전을 보장하는 장치는 `applyVaryGuards` 쪽입니다.
 * 상류에 실어 보내는 곳은 서버 라우트이고, 문장은 여기서만 짭니다.
 */
export function buildVarySystemPrompt(request: LineVaryRequest): string {
  const min = Math.round(request.anchor.length * VARY_MIN_RATIO);
  const max = Math.round(request.anchor.length * VARY_MAX_RATIO);
  return [
    "당신은 요양보호사 훈련 시뮬레이터에서 **한 등장인물을 연기**합니다. 대본 한 줄을 그 인물의 입말로 다시 말하는 것이 전부입니다. 아래 규칙을 하나라도 어기면 답은 폐기되고 원래 대본이 그대로 쓰입니다.",
    "",
    "규칙",
    "1. 같은 뜻·같은 정보·같은 감정 강도로 다시 말합니다. 뜻을 더하거나 덜어 내지 않습니다.",
    "2. 새 사실을 만들지 않습니다 — 새 이름·숫자·시각·장소·증상·의료 지시를 넣지 않습니다. 원문에 없는 숫자가 하나라도 들어가면 폐기됩니다.",
    "3. 문장 수는 원문과 같거나 하나 차이까지입니다.",
    `4. 길이는 원문의 60~160%(${min}~${max}자) 안에 둡니다.`,
    "5. 인물의 말투를 그대로 지킵니다 — 원문이 반말이면 반말, 존댓말이면 존댓말입니다. 호칭도 원문을 따릅니다.",
    `6. 다음 표현을 쓰지 않습니다: ${BANNED_PHRASES.join(" / ")}`,
    "7. 자신이 어떤 모델인지 밝히지 않고, 연기 밖의 말(설명·사과·머리말)을 하지 않습니다.",
    "8. 학습자에게 조언하지 않습니다. 당신은 코치가 아니라 그 인물입니다.",
    "",
    '출력은 다른 말 없이 JSON 한 덩어리로만 합니다: {"line": "다시 말한 대사"}',
  ].join("\n");
}

/** 사용자 프롬프트 — 상황·인물·직전 대화·원문을 그대로 옮깁니다. */
export function buildVaryUserPrompt(request: LineVaryRequest): string {
  const recent =
    request.recentLines.length > 0
      ? request.recentLines.map((line) => `- ${line}`).join("\n")
      : "- (앞선 대사가 없습니다)";
  return [
    `[상황] ${request.scenarioSummary}`,
    `[연기할 인물] ${request.persona}`,
    "[직전 대화]",
    recent,
    `[다시 말할 대본] ${request.anchor}`,
  ].join("\n");
}

/* ── 가드 ──────────────────────────────────────────────── */

/** 앵커 그대로 — 막혔을 때의 결과 한 벌입니다(화면에는 검수 문장이 섭니다). */
function anchorOutcome(anchor: string, blocked?: VaryBlockId, detail?: string): LineVaryOutcome {
  const base: LineVaryOutcome = { text: anchor, varied: false };
  if (!blocked) return base;
  return detail === undefined
    ? { ...base, blocked }
    : { ...base, blocked, blockedDetail: detail };
}

/** 조용히 앵커로 되돌아간 결과 (부르지 않았거나·늦었거나·실패했거나) */
function varyFallback(anchor: string, reason: OnlineCoachFallback): LineVaryOutcome {
  return { text: anchor, varied: false, fallback: reason };
}

/**
 * 아라비아 숫자가 아닌 십진 숫자를 0~9로 접는 자리들.
 *
 * 「４시」·「٤시」는 사람 눈에 「4시」이고, 화면에도 그렇게 읽힙니다. 접지 않으면 두 가지가
 * 한꺼번에 어긋납니다 — 앵커의 「4」와 변주문의 「４」가 서로 **다른 숫자**로 세어져 옳은
 * 변주가 막히고, 반대로 상류가 전각으로 적어 보낸 **새 숫자**는 대조 자체가 어긋난 채 지나갑니다.
 */
const DIGIT_BLOCKS: ReadonlyArray<readonly [number, number]> = [
  [0xff10, 0xff19], // 전각 ０-９
  [0x0660, 0x0669], // 아랍-인도 ٠-٩
  [0x06f0, 0x06f9], // 확장 아랍-인도 ۰-۹
];

/** 위 세 자리의 숫자를 0~9로 바꿉니다. 그 밖의 글자는 그대로 둡니다. */
function foldDigits(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    const block = DIGIT_BLOCKS.find(([lo, hi]) => code >= lo && code <= hi);
    out += block ? String(code - block[0]) : ch;
  }
  return out;
}

/**
 * 문장에 든 숫자 토막들 — 「오후 4시 40분」이면 `["4", "40"]`입니다.
 * 자릿수를 붙여 세므로 「40」을 「4」로 잘라 빠져나가지 못합니다.
 *
 * 세는 대상은 **십진 숫자 전부**입니다(`\p{Nd}`) — 아라비아 숫자만 세던 자리라, 전각
 * 「４」나 아랍-인도 「٤」로 적어 보내면 새 숫자가 그대로 지나갔습니다. 아는 세 자리는
 * 0~9로 접어 앵커와 같은 잣대로 세고, 접는 표에 없는 문자 체계의 숫자는 접히지 않은 채
 * 그대로 토막이 됩니다 — 앵커에 없으면 막히는 쪽입니다(안전한 방향).
 *
 * **한글 수사(한·두·세…)는 세지 않습니다.** 「한 번 더 여쭤볼게요」·「두 손을 잡아 드릴게요」가
 * 전부 새 숫자로 잡혀 정상 변주가 통째로 막힙니다. 위험한 한글 수사(「두 알」 같은)는
 * 숫자가 아니라 **가드 ⑥의 규칙 사전**이 받습니다 — 그쪽이 목적어와 함께 보는 자리입니다.
 *
 * @example numberTokens("４시 40분"); // ["4", "40"]
 */
function numberTokens(text: string): string[] {
  return foldDigits(text).match(/\p{Nd}+/gu) ?? [];
}

/**
 * 이 문장에 붙는 판정 신호들 — **판정 규칙 엔진을 그대로 다시 씁니다**(새로 짓지 않습니다).
 *
 * 열쇠는 규칙 id이고, 값은 화면·기록에 그대로 쓸 사람 말입니다.
 *
 * 넘기는 맥락은 **시나리오 유형 하나뿐**입니다.
 *  · cueId는 넘기지 않습니다 — 국면 게이트(좁힌 사전)는 「학습자가 지금 어느 자리에서
 *    말했는가」를 보는 장치이고, 여기서 검사하는 것은 학습자의 말이 아니라 **어르신 입에
 *    넣을 대사**라 해당하는 자리가 없습니다. 게이트 없는 전역 사전이 이 자리의 그물입니다.
 *  · 유형은 넘깁니다 — 실제 판정이 보는 것과 같은 맥락으로 대조하는 편이 맞고, 유형 한정
 *    규칙이 걷어 내지는 것은 응급 한정 규칙뿐인데 **응급 유형은 애초에 변주가 돌지
 *    않습니다**(L3 원칙). 그래서 이 선택으로 좁아지는 그물이 실제로는 없습니다.
 */
function ruleSignals(text: string, scenarioType?: ScenarioType): Map<string, string> {
  const opts: RuleCheckOptions = scenarioType ? { scenarioType } : {};
  const found = new Map<string, string>();
  const critical = checkCritical(text, opts);
  if (critical.cf && critical.ruleId) {
    found.set(critical.ruleId, `${critical.label ?? critical.ruleId} 「${critical.matched ?? ""}」`);
  }
  for (const finding of checkAdvisory(text, opts)) {
    found.set(finding.ruleId, `${finding.label} 「${finding.matched}」`);
  }
  return found;
}

/**
 * 앵커 대비 가드를 순서대로 적용합니다. **이 함수가 이 파일의 핵심**입니다.
 *
 * 서버가 중계해 준 원문을 받아 **기기 안에서** 검사합니다 — 코칭과 같은 자리, 같은 약속입니다.
 * 어느 단에서 막히든 돌려주는 문장은 앵커이므로, 부르는 쪽은 실패를 따로 다루지 않아도 됩니다.
 *
 * ── 가드 ⑥이 무엇이고 무엇이 아닌가 ─────────────────────────────────────
 * ⑥은 변주문과 앵커를 **각각** 판정 규칙 엔진(`checkCritical`+`checkAdvisory`)에 넣어,
 * 변주문에만 붙은 신호가 있으면 막습니다. 왜 「있으면」이 아니라 「앵커에 없던 것이 생기면」인가 —
 * 검수 앵커 자체가 이미 신호를 달고 있는 자리가 있기 때문입니다. C02의 보호자 대사
 * "…침대에 묶어두든지 방문을 잠그든지 하세요"는 ⚑CF 신호가 붙은 채로 **정상 앵커**입니다
 * (그 요구를 거절하는 것이 그 장면의 과제입니다). 「신호가 있으면 막기」로 두면 그 장면의
 * 변주가 통째로 죽습니다. 그래서 대조는 언제나 앵커 대비입니다(A02·C02 참조).
 *
 * **이 단은 그물이지 벽이 아닙니다.** 규칙 사전은 적어 둔 활용형에만 닿습니다 —
 * "인슐린을 놓으라던데"는 잡지만 "인슐린 맞으라던데"는 지나가고, "혈압약을 더 드리라던데"는
 * 잡지만 "혈압약을 더 드셔야 한대요"는 지나갑니다(실측). 사전의 한계는 engine/rules.ts가
 * 항목으로 적어 둔 그것이고, 여기서 넓히지 않습니다 — 판정 엔진은 재사용만 합니다.
 * 화면 문구도 이 폭에 맞춰 적습니다(가드를 실제보다 넓게 말하지 않습니다).
 *
 * 또 하나 — `checkCritical`은 **먼저 걸린 규칙 하나만** 돌려줍니다. 변주문에 ⚑CF 신호가 둘
 * 붙고 그중 하나가 앵커에도 있으면, 돌려받는 것이 앵커에도 있는 쪽일 수 있어 나머지 하나를
 * 놓칠 수 있습니다. 엔진을 고치면 닫히는 자리지만, 이 파일은 엔진을 읽기만 합니다.
 *
 * @example
 * applyVaryGuards('{"line":"집에 가야 해요, 우리 애기 밥 줘야 하는데."}', "집에 가야 해요.").varied; // true
 * applyVaryGuards('{"line":"3시에 데리러 온대요."}', "곧 온대요.").blocked; // "number"
 */
export function applyVaryGuards(
  raw: string,
  anchorText: string,
  scenarioType?: ScenarioType,
): LineVaryOutcome {
  const anchor = anchorText.trim();

  /* ① 형식 — JSON으로 오지 않았거나 대사가 비었으면 버립니다. */
  const parsed = extractJson(raw);
  const line = typeof parsed?.line === "string" ? parsed.line.trim() : "";
  if (!parsed || line.length === 0) return anchorOutcome(anchor, "format");

  /* ⑤ 동일 — 앵커와 같은 문장이면 막을 이유가 없습니다. 다만 바뀐 것이 없으므로 표기도 없습니다. */
  if (squash(line) === squash(anchor)) return { text: anchor, varied: false };

  /* ② 길이 — 요약도 부풀리기도 「같은 뜻」이 아닙니다. */
  const min = anchor.length * VARY_MIN_RATIO;
  const max = anchor.length * VARY_MAX_RATIO;
  if (line.length < min || line.length > max) {
    return anchorOutcome(anchor, "length", `${line.length}자 (앵커 ${anchor.length}자)`);
  }

  /* ③ 숫자 — 앵커에 없던 숫자는 곧 새 사실입니다(시각·나이·호수·119…). */
  const known = new Set(numberTokens(anchor));
  for (const token of numberTokens(line)) {
    if (!known.has(token)) return anchorOutcome(anchor, "number", `「${token}」`);
  }

  /* ④ 표현 — 금지 표현 8종과 모델 정체 노출. 코칭과 같은 체를 씁니다(공백은 양쪽에서 지웁니다). */
  const banned = findBannedExpression(line);
  if (banned) return anchorOutcome(anchor, "phrase", `「${banned}」`);

  /* ⑥ 위험 — 앵커에 없던 ⚑CF·코칭 신호가 새로 생기면 버립니다(위 주석의 폭 그대로). */
  const anchorSignals = ruleSignals(anchor, scenarioType);
  for (const [ruleId, detail] of ruleSignals(line, scenarioType)) {
    if (!anchorSignals.has(ruleId)) return anchorOutcome(anchor, "safety", detail);
  }

  return { text: line, varied: true };
}

/* ── 세션 안 보관소 ────────────────────────────────────── */

/**
 * 이번 세션에서 이미 받아 둔 변주 — **메모리에만** 삽니다.
 *
 * 같은 지점으로 되돌아오시는 길은 훈련에서 흔합니다(⚑CF 뒤 재시도·처음부터 다시). 그때마다
 * 같은 앵커를 다시 청하면 값도 시간도 두 번 치르고, 무엇보다 **되돌아온 그 장면에서 어르신이
 * 또 다른 말을 하십니다** — 다시 해 보는 훈련에서 조건이 바뀌면 무엇을 고쳤는지 알 수 없습니다.
 * 열쇠는 시나리오와 앵커 원문입니다. 저장소에는 쓰지 않으므로 새로고침 한 번에 사라집니다.
 */
const cache = new Map<string, string>();

function cacheKey(scenarioId: string, anchor: string): string {
  return `${scenarioId}${anchor.trim()}`;
}

/** 이 앵커에 이미 받아 둔 변주 (없으면 undefined) */
export function getCachedVariation(scenarioId: string, anchor: string): string | undefined {
  return cache.get(cacheKey(scenarioId, anchor));
}

/** 시험·초기화용 — 보관해 둔 변주를 전부 지웁니다. */
export function clearVariationCache(): void {
  cache.clear();
}

/* ── 호출 ──────────────────────────────────────────────── */

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/** `/api/coach`가 돌려준 몸통에서 원문 한 덩어리만 읽습니다(코칭과 같은 계약입니다). */
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
 * 대사 한 줄의 변주를 청하고, 돌아온 답을 가드에 통과시킵니다.
 *
 * 부르는 곳은 같은 도메인 `/api/coach` 하나입니다(`task: "vary"`). 키를 붙이지 않습니다 —
 * 붙일 키가 이 기기에 없습니다. 어떤 실패에서도 돌려주는 문장은 **앵커 원문**입니다.
 */
export async function requestLineVariation(
  request: LineVaryRequest,
  config: AiDialogueSettings,
  options: LineVaryOptions = {},
): Promise<LineVaryOutcome> {
  if (!config.enabled) return varyFallback(request.anchor, "disabled");

  const doFetch = options.fetchImpl ?? (typeof fetch === "function" ? fetch : undefined);
  if (!doFetch) return varyFallback(request.anchor, "network");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? LINE_VARY_TIMEOUT_MS);

  let payload: unknown;
  try {
    const response = await doFetch(VARY_ENDPOINT, {
      method: "POST",
      // 헤더 한 벌은 코칭·자유 연습과 **같은 함수**가 만듭니다(`onlineCoach.ts`) — 단기 토큰 표식 포함.
      headers: coachRequestHeaders(),
      signal: controller.signal,
      // 나가는 것은 이 네 칸과 작업 이름뿐입니다 — 학습자 발화는 여기 없습니다.
      body: JSON.stringify({ task: "vary", ...request }),
    });
    // 다음 요청이 쓸 표식을 갈무리합니다 — 코칭·자유 연습과 **같은 함수**입니다.
    rememberCoachToken(response);
    if (!response.ok) return varyFallback(request.anchor, "http");
    payload = await response.json();
  } catch (error) {
    return varyFallback(request.anchor, isAbortError(error) ? "timeout" : "network");
  } finally {
    clearTimeout(timer);
  }

  const relayed = readRelay(payload);
  if (relayed.content === undefined) {
    return varyFallback(request.anchor, relayed.fallback ?? "http");
  }
  return applyVaryGuards(relayed.content, request.anchor, options.scenarioType);
}

/**
 * 이 대사를 변주해 옵니다 — 화면이 부르는 자리는 여기 하나입니다.
 *
 * 꺼져 있거나·응급 유형이거나·오프라인이거나·대상 화자가 아니면 **부르지 않고** 앵커를
 * 그대로 돌려줍니다(네트워크 호출 0건). 이미 받아 둔 변주가 있으면 그것을 그대로 씁니다.
 *
 * @example
 * const { text, varied } = await varyLine({ scenario, speaker: "elder", anchor, recentLines });
 */
export async function varyLine(
  context: LineVaryContext,
  options: LineVaryOptions = {},
): Promise<LineVaryOutcome> {
  const anchor = context.anchor.trim();
  const config = options.settings ?? getSettings().aiDialogue;

  if (!isLineVaryActive(context.scenario, config)) return varyFallback(anchor, "disabled");
  // 오프라인이면 애초에 부르지 않습니다 — 훈련은 네트워크 없이 끝까지 돌아야 합니다.
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return varyFallback(anchor, "offline");
  }

  const cached = getCachedVariation(context.scenario.id, anchor);
  if (cached !== undefined) return { text: cached, varied: cached !== anchor };

  const request = buildVaryRequest(context);
  if (!request) return varyFallback(anchor, "disabled");

  // 가드 ⑥의 대조 맥락은 부르는 쪽이 이미 들고 있습니다 — 여기서 채워 넘깁니다.
  const outcome = await requestLineVariation(request, config, {
    ...options,
    scenarioType: options.scenarioType ?? context.scenario.type,
  });
  // 통과한 문장만 보관합니다 — 막힌 답을 담아 두면 다음 방문에서 그 실패를 되풀이하게 됩니다.
  if (outcome.varied) cache.set(cacheKey(context.scenario.id, anchor), outcome.text);
  return outcome;
}
