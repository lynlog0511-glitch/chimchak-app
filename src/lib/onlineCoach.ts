/**
 * 온라인 코칭(경량 LLM) 클라이언트 — 이 앱에서 밖으로 나가는 **유일한** 요청 자리입니다.
 *
 * 기본값은 꺼짐입니다. 설정에서 켜기 전에는 이 파일의 fetch가 한 번도 실행되지 않습니다
 * (그 상태가 기본 빌드이고, 화면들이 적어 둔 「생성 호출 0건」의 기준입니다).
 *
 * 켠 뒤에도 브라우저가 부르는 곳은 **같은 도메인의 `/api/coach` 한 곳**입니다. 상류 주소도
 * 모델 이름도 키도 이 파일에 없고, 번들 어디에도 없습니다 — 전부 서버 환경변수에만 있습니다
 * (`src/app/api/coach/route.ts`). 그래서 온라인 코칭을 켜도 CSP의 `connect-src 'self'` 한 줄이
 * 그대로 참입니다. 예전에는 사용자가 자기 키를 이 기기에 넣는 방식이었고, 그 키는 화면 코드와
 * 같은 자리에 있었습니다.
 *
 * 두 가지만 합니다.
 *  ① 이 턴을 요청 한 덩어리로 만들어(발화는 **가명처리를 거쳐**) 침착 서버에 코칭을 청합니다.
 *  ② 돌아온 답을 **근거 가드 체인**에 통과시킵니다. 기획서가 「가짜 근거 72% → 0%」로 적은 장치가
 *     이것이고, 여기가 그 실물입니다. 네 단 가운데 하나라도 막히면 답을 버리고 고정 문구를 냅니다.
 *     서버를 하나 세웠어도 이 네 단은 **기기 안에 그대로 둡니다** — 「받아 온 문장은 기기 안
 *     가드를 지나야 화면에 닿는다」가 이 앱의 약속이고, 서버는 키 보관·중계·한도만 맡습니다.
 *
 * 가드 네 단 (순서 고정 — 앞 단이 막으면 뒤는 실행하지 않습니다)
 *   ① 형식   : 정해진 JSON으로 오지 않았으면 버립니다.
 *   ② 근거   : docId를 `checkEvidence`(engine/evidence.ts)로 대조합니다. 목록 밖이면 버립니다.
 *   ③ 표현   : 금지 표현 8종과 모델 정체를 드러내는 문자열이 섞이면 버립니다.
 *   ④ 길이   : 160자를 넘으면 버립니다(코칭은 1~2문장입니다).
 *
 * 막혔을 때 화면에 나가는 문장은 기획서·데이터가 들고 있는 고정 문구 하나뿐입니다
 * (`NO_SOURCE_MESSAGE` — 이 파일이 문구를 지어내지 않습니다).
 *
 * 판정은 이 파일과 무관합니다. 충족·코칭·즉시 중단 판정과 게이지·기록은 전부 결정론 엔진이
 * 내린 그대로이고, 온라인 코칭은 **문장 한 덩어리를 덧붙일 뿐**입니다.
 *
 * @example
 * const outcome = await requestOnlineCoaching(request, { enabled: true });
 * outcome.status; // "ok" | "blocked" | "fallback"
 */

import { CITABLE_DOC_IDS, NO_SOURCE_MESSAGE, SOURCE_DOCS } from "@/data/docs";
import { EVIDENCE_GUARD } from "@/data/evidenceGuard";
import { getRubricItem } from "@/data/rubric";
import { checkEvidence, type EvidenceGuard } from "@/engine/evidence";
import { maskText } from "@/engine/masking";
import type { CueDef, Scenario } from "@/types";
import {
  COACH_TOKEN_HEADER,
  COACH_TOKEN_LENGTH,
  COACH_TOKEN_META,
  COACH_TOKEN_REFRESH_HEADER,
  coachTokenWindow,
} from "./coachLimits";
import { getSettings, type OnlineCoachingSettings } from "./settings";

/* ── 문구·상수 ─────────────────────────────────────────── */

/** 코칭 문장 길이 상한(자). 1~2문장을 넘어서면 그 자체로 계약 위반입니다. */
export const COACHING_MAX_LENGTH = 160;

/**
 * 브라우저가 부르는 유일한 주소 — **같은 도메인**입니다.
 * 상수로 두는 이유는 하나입니다: 이 문자열이 바뀌지 않는 한 CSP `connect-src 'self'`가 참입니다.
 */
export const COACH_ENDPOINT = "/api/coach";

/**
 * 응답을 기다리는 상한(ms). 넘으면 조용히 결정론 코칭만 남습니다.
 * 서버가 상류에 거는 상한이 6초라, 왕복 여유를 얹어 그보다 뒤에 끊습니다 —
 * 여기서 먼저 끊으면 이미 값을 치른 응답을 버리게 됩니다.
 */
export const ONLINE_COACH_TIMEOUT_MS = 8000;

/**
 * 금지 표현 8종 (PROJECT_BRIEF §3-8).
 * 화면 문구를 짜는 규율이자, 밖에서 받아 온 문장을 거르는 체이기도 합니다.
 */
export const BANNED_PHRASES: readonly string[] = [
  "증상 완화",
  "인지 개선",
  "위험도 판정",
  "조기 발견",
  "선별",
  "AI 주치의",
  "이렇게 처치하세요",
  "임상적으로 검증된",
];

/**
 * 모델이 스스로의 정체를 드러내는 말.
 *
 * 회사명·모델명은 이 저장소 어디에도 적지 않으므로(브리프 §2), 목록에는 **일반 명사만** 둡니다.
 * 특정 이름을 대조하지 않는 이유는 이제 하나 더 있습니다 — 상류 모델 이름은 서버 환경변수에만
 * 있고 브라우저는 그 이름을 아예 모릅니다. 대신 프롬프트 규칙 4가 자기 소개를 금지하고,
 * 그래도 새어 나오는 일반 명사를 이 목록이 받습니다.
 *
 * 대사 변주(`src/lib/onlineVary.ts`)도 **같은 목록**을 봅니다 — 어르신 입에서 이 낱말이
 * 나오는 순간 「가상 인물의 말」이 아니라 「모델의 말」이 되므로, 거르는 체는 하나여야 합니다.
 *
 * 대조는 **양쪽 공백을 전부 지우고** 합니다(`stripSpaces`). 그래서 「언어모델」처럼 붙여 쓴 꼴을
 * 따로 적어 둘 필요가 없어졌고, 한때 나란히 적혀 있던 붙임형 항목은 걷어 냈습니다 —
 * 같은 말을 두 줄로 적어 두면 어느 날 한 줄만 고쳐집니다.
 * 마찬가지로 「인공지능 모델」도 뺐습니다: 아래 단독 「인공지능」이 그 안에 이미 들어 있습니다.
 *
 * 단독 일반 명사를 넣을 때의 기준은 하나입니다 — **어르신·보호자·코칭의 정상 문장에
 * 나올 일이 없는 낱말인가**. 아래 넷은 활성 시나리오 6종의 대사·분기 반응·코칭 문구를
 * 전수로 훑어 한 번도 나오지 않는 것을 확인하고 넣었습니다(과탐 0건).
 */
export const MODEL_IDENTITY_WORDS: readonly string[] = [
  "LLM",
  "언어 모델",
  "AI 모델",
  "생성형 AI",
  "인공지능",
  "챗봇",
  "에이아이",
  "어시스턴트",
  // 영어 상투구 — 대조할 때 양쪽을 소문자로 접으므로 여기에는 소문자로만 적습니다.
  "as an ai",
];

/* ── 결과 모양 ─────────────────────────────────────────── */

/** 가드 네 단의 이름 — 무엇이 막았는지 결과에 그대로 남깁니다. */
export type GuardStepId = "format" | "evidence" | "phrase" | "length";

/**
 * 조용히 결정론으로 되돌아간 까닭 (화면에는 아무것도 뜨지 않습니다).
 *
 * · `config`      — 서버에 상류 주소·모델이 설정돼 있지 않습니다(기본 빌드). 켜 두어도 나가는
 *                   요청이 없고, 사용자는 아무 차이를 느끼지 않습니다.
 * · `rate_limited`— 서버의 호출 한도를 넘었습니다. 잠시 뒤 다음 턴에서 다시 청해집니다.
 *                   화면에 사유를 띄우지 않습니다 — 검수 코칭이 이미 자리를 지키고 있는데
 *                   훈련 중에 「한도」 같은 낱말을 들이미는 편이 더 방해가 됩니다.
 */
export type OnlineCoachFallback =
  | "disabled"
  | "offline"
  | "config"
  | "rate_limited"
  | "timeout"
  | "network"
  | "http";

export type OnlineCoachStatus = "ok" | "blocked" | "fallback";

export interface GuardStepResult {
  id: GuardStepId;
  /** 사람이 읽는 단 이름 — 화면·점검에 그대로 씁니다 */
  label: string;
  passed: boolean;
  /** 막았다면 무엇을 보고 막았는지 (걸린 표현 등) */
  detail?: string;
}

export interface OnlineCoachOutcome {
  status: OnlineCoachStatus;
  /**
   * 화면에 그대로 띄울 문장.
   * `ok`면 통과한 코칭 문장, `blocked`면 고정 문구, `fallback`이면 빈 문자열입니다.
   */
  message: string;
  /** 근거 가드를 통과한 문서 id (없을 수도 있습니다 — 근거를 달지 않은 코칭) */
  docId?: string;
  /** 막힌 단 */
  blocked?: GuardStepId;
  /** 막힌 까닭 한 줄 — 화면 라벨로 그대로 씁니다 */
  blockedLabel?: string;
  fallback?: OnlineCoachFallback;
  /** 실행한 가드 단의 결과 (막힌 단이 마지막입니다) */
  steps: GuardStepResult[];
}

/** 가드 단 이름 — 화면·테스트가 같은 낱말을 봅니다. */
export const GUARD_STEP_LABEL: Record<GuardStepId, string> = {
  format: "형식 확인",
  evidence: "근거 가드",
  phrase: "표현 검사",
  length: "길이 상한",
};

/** 막혔을 때 화면에 다는 사유 한 줄 (점수·등급 표현 없음) */
const BLOCK_REASON: Record<GuardStepId, string> = {
  format: "정해진 형식으로 오지 않아 검증할 수 없었습니다",
  evidence: "근거 문서 목록 밖을 인용했습니다",
  phrase: "쓰지 않기로 한 표현이 섞였습니다",
  length: `코칭 길이 상한(${COACHING_MAX_LENGTH}자)을 넘었습니다`,
};

/* ── 요청 모양 ─────────────────────────────────────────── */

export interface CoachDocRef {
  id: string;
  title: string;
}

/**
 * `/api/coach`로 나가는 몸통 그대로입니다.
 * 서버는 **이 다섯 칸만** 받아 새로 조립하고, 그 밖의 값은 400으로 끊습니다.
 */
export interface OnlineCoachRequest {
  /** 지금 어떤 상황인지 한 덩어리로 */
  scenarioSummary: string;
  /** 이 턴의 CUE 지시문 */
  cuePrompt: string;
  /** 학습자 발화 — **가명처리를 통과한 문자열만** 들어옵니다 */
  utterance: string;
  /** 이 CUE가 보는 루브릭 항목의 행동지표 문장 (점수·앵커는 넘기지 않습니다) */
  indicators: string[];
  /** 인용해도 되는 문서 목록 (id + 제목) — 이 밖을 들고 오면 가드가 막습니다 */
  docs: readonly CoachDocRef[];
}

export interface OnlineCoachOptions {
  /** 시험용 주입 자리 — 넘기지 않으면 전역 fetch를 씁니다 */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  guard?: EvidenceGuard;
}

/* ── 요청 만들기 ───────────────────────────────────────── */

/** 인용 가능 문서 7종을 id+제목으로 폅니다 (표준교재는 애초에 이 목록에 없습니다). */
export function citableDocRefs(): CoachDocRef[] {
  const refs: CoachDocRef[] = [];
  for (const id of CITABLE_DOC_IDS) {
    const doc = SOURCE_DOCS.find((item) => item.id === id);
    if (doc) refs.push({ id: doc.id, title: doc.title });
  }
  return refs;
}

/** 이 CUE가 보는 루브릭 항목의 행동지표 문장 (중복 제거, 순서 유지) */
function cueIndicators(cue: CueDef): string[] {
  const itemIds: string[] = [];
  for (const branch of cue.branches) {
    for (const hit of branch.rubricHits) {
      if (!itemIds.includes(hit.itemId)) itemIds.push(hit.itemId);
    }
  }
  const out: string[] = [];
  for (const itemId of itemIds) {
    const item = getRubricItem(itemId);
    if (item) out.push(`${item.id} — ${item.indicator}`);
  }
  return out;
}

/**
 * 이 턴을 그대로 요청 한 덩어리로 옮깁니다.
 *
 * 발화는 여기서 **가명처리를 거칩니다**(engine/masking.ts). 어댑터 개방 조건 ③이 요구하는
 * 조건이고, 부르는 쪽이 잊어버릴 수 있는 일을 부르는 쪽에 맡기지 않으려고 이 안에 둡니다.
 *
 * @example
 * const request = buildCoachRequest(scenario, cue, "010-1234-5678로 연락드릴게요");
 * request.utterance; // "[번호]로 연락드릴게요"
 */
export function buildCoachRequest(
  scenario: Scenario,
  cue: CueDef,
  utterance: string,
): OnlineCoachRequest {
  return {
    scenarioSummary: `${scenario.title} (${scenario.typeLabel}) — ${scenario.context}`,
    cuePrompt: cue.prompt,
    utterance: maskText(utterance.trim()).masked,
    indicators: cueIndicators(cue),
    docs: citableDocRefs(),
  };
}

/* ── 프롬프트 ──────────────────────────────────────────── */

/**
 * 시스템 프롬프트 — 지켜야 할 것을 전부 문장으로 적어 둡니다.
 *
 * 여기 적은 규칙을 지켰는지는 **믿지 않고 가드로 다시 확인합니다**(applyGuards).
 * 프롬프트는 성공률을 올리는 장치이고, 안전을 보장하는 장치는 가드 쪽입니다.
 * 상류에 실제로 실어 보내는 곳은 서버 라우트이고, 문장은 여기서만 짭니다.
 */
export function buildSystemPrompt(request: OnlineCoachRequest): string {
  const docLines = request.docs.map((doc) => `- ${doc.id} : ${doc.title}`).join("\n");
  return [
    "당신은 요양보호사 훈련 시뮬레이터의 코칭 보조입니다. 아래 규칙을 하나라도 어기면 답은 폐기되고 사용자에게 닿지 않습니다.",
    "",
    "규칙",
    `1. 한국어 존댓말로 1~2문장, ${COACHING_MAX_LENGTH}자 이내로만 씁니다.`,
    "2. 점수·등급·순위·백분위를 쓰지 않습니다. 진단·처방을 하지 않고, 몸에 손이 닿는 동작을 지도하지 않습니다.",
    `3. 다음 표현을 쓰지 않습니다: ${BANNED_PHRASES.join(" / ")}`,
    "4. 자신이 어떤 모델인지, 어디서 만들었는지 밝히지 않습니다.",
    "5. 근거 문서는 아래 목록의 id 중 하나만 씁니다. 마땅한 근거가 없으면 docId를 null로 둡니다. 목록 밖 문서나 지어낸 문서를 대면 답이 폐기됩니다.",
    "6. 나무라지 않고, 다음에 해 보실 수 있는 말이나 행동을 한 가지만 짚어 드립니다.",
    "",
    "인용 가능 문서",
    docLines,
    "",
    '출력은 다른 말 없이 JSON 한 덩어리로만 합니다: {"coaching": "코칭 문장", "docId": "DOC-... 또는 null"}',
  ].join("\n");
}

/** 사용자 프롬프트 — 상황·지시문·발화·행동지표를 그대로 옮깁니다. */
export function buildUserPrompt(request: OnlineCoachRequest): string {
  const indicators =
    request.indicators.length > 0
      ? request.indicators.map((line) => `- ${line}`).join("\n")
      : "- (이 장면에 연결된 행동지표가 없습니다)";
  return [
    `[상황] ${request.scenarioSummary}`,
    `[이 장면의 지시문] ${request.cuePrompt}`,
    `[학습자 발화] ${request.utterance}`,
    "[이 장면이 보는 행동지표]",
    indicators,
  ].join("\n");
}

/* ── 가드 체인 ─────────────────────────────────────────── */

function step(id: GuardStepId, passed: boolean, detail?: string): GuardStepResult {
  return detail === undefined
    ? { id, label: GUARD_STEP_LABEL[id], passed }
    : { id, label: GUARD_STEP_LABEL[id], passed, detail };
}

function blockedOutcome(
  id: GuardStepId,
  steps: GuardStepResult[],
  detail?: string,
): OnlineCoachOutcome {
  return {
    status: "blocked",
    // 문구는 데이터가 들고 있는 고정 문장 하나뿐입니다 — 여기서 짓지 않습니다.
    message: NO_SOURCE_MESSAGE,
    blocked: id,
    blockedLabel: detail ? `${BLOCK_REASON[id]} · ${detail}` : BLOCK_REASON[id],
    steps: [...steps, step(id, false, detail)],
  };
}

function fallbackOutcome(reason: OnlineCoachFallback): OnlineCoachOutcome {
  return { status: "fallback", message: "", fallback: reason, steps: [] };
}

/**
 * 코드 울타리·앞뒤 군말을 걷어내고 JSON 한 덩어리만 꺼냅니다.
 * 대사 변주도 같은 함수로 형식을 봅니다 — 상류가 군말을 붙이는 버릇은 작업이 달라도 같습니다.
 */
export function extractJson(raw: string): Record<string, unknown> | undefined {
  const text = raw.replace(/```[a-zA-Z]*/g, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return undefined;
  try {
    const parsed: unknown = JSON.parse(text.slice(start, end + 1));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return undefined;
    return parsed as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/** 대조는 공백을 하나로 눌러 놓고 합니다 — 「증상  완화」로 띄어 쓰면 빠져나가지 않게. */
export function squash(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * 금지 표현·정체어 대조 전용 정규화 — 공백을 **하나도 남기지 않고** 지웁니다.
 *
 * `squash`는 여러 칸을 한 칸으로 눌러 「증상  완화」를 잡아 주지만, 반대쪽으로 붙여 쓴
 * 「증상완화」·「AI주치의」는 그대로 빠져나갔습니다 — 한국어에서 띄어쓰기는 붙여도 읽히는
 * 쪽이라, 늘리는 우회만 막고 줄이는 우회를 열어 두면 체에 구멍이 하나 남습니다.
 * 그래서 **찾는 말과 찾을 자리 양쪽**에서 공백을 지우고 대조합니다(코칭·변주 공통).
 *
 * 문장을 화면에 낼 때는 쓰지 않습니다 — 검사용 사본을 만드는 함수입니다.
 *
 * @example stripSpaces("증상  완화"); // "증상완화"
 * @example stripSpaces("AI 주치의");  // "AI주치의"
 */
export function stripSpaces(text: string): string {
  return text.replace(/\s+/g, "");
}

/**
 * 금지 표현 8종과 모델 정체어를 한 번에 봅니다 — **코칭과 변주가 같은 체를 씁니다.**
 *
 * 걸린 말을 그대로 돌려줍니다(없으면 undefined). 돌려주는 것은 목록에 적힌 **원문**이라,
 * 화면·기록에 뜨는 사유가 목록과 글자 그대로 같습니다.
 *
 * @example findBannedExpression("증상완화에 좋대요");        // "증상 완화"
 * @example findBannedExpression("저는 인공지능이라서요");     // "인공지능"
 * @example findBannedExpression("이유를 여쭤봐 주세요");      // undefined
 */
export function findBannedExpression(text: string): string | undefined {
  const flat = stripSpaces(text);
  for (const phrase of BANNED_PHRASES) {
    if (flat.includes(stripSpaces(phrase))) return phrase;
  }
  const lowered = flat.toLowerCase();
  for (const word of MODEL_IDENTITY_WORDS) {
    if (lowered.includes(stripSpaces(word).toLowerCase())) return word;
  }
  return undefined;
}

/**
 * 가드 네 단을 순서대로 적용합니다. **이 함수가 이 파일의 핵심**입니다.
 *
 * 서버가 중계해 준 원문을 받아 **기기 안에서** 검사합니다 — 문장이 화면에 닿기 전 마지막 관문이
 * 브라우저 안에 있다는 사실이 이 함수의 자리 자체입니다.
 *
 * @example
 * applyGuards('{"coaching":"먼저 이유를 물어봐 주세요.","docId":"DOC-GUIDE-001"}').status; // "ok"
 * applyGuards('{"coaching":"...","docId":"DOC-없는것-999"}').blocked; // "evidence"
 */
export function applyGuards(
  raw: string,
  guard: EvidenceGuard = EVIDENCE_GUARD,
): OnlineCoachOutcome {
  const steps: GuardStepResult[] = [];

  /* ① 형식 — JSON으로 오지 않았거나 코칭 문장이 비었으면 버립니다. */
  const parsed = extractJson(raw);
  const coaching = typeof parsed?.coaching === "string" ? parsed.coaching.trim() : "";
  if (!parsed || coaching.length === 0) {
    return blockedOutcome("format", steps);
  }
  steps.push(step("format", true));

  /* ② 근거 — 목록 밖 문서를 근거로 들면 버립니다(engine/evidence.ts와 같은 가드). */
  const rawDocId = parsed.docId;
  const docId =
    typeof rawDocId === "string" && rawDocId.trim().length > 0 && rawDocId.trim() !== "null"
      ? rawDocId.trim()
      : undefined;
  const evidence = checkEvidence(docId, guard);
  if (!evidence.allowed) {
    return blockedOutcome("evidence", steps, `「${docId}」`);
  }
  steps.push(step("evidence", true, evidence.docId ? `${evidence.docId} 확인` : "근거 없음"));

  /* ③ 표현 — 금지 표현 8종과 모델 정체 노출을 함께 봅니다(양쪽 공백을 지우고 대조합니다). */
  const banned = findBannedExpression(coaching);
  if (banned) return blockedOutcome("phrase", steps, `「${banned}」`);
  steps.push(step("phrase", true));

  /* ④ 길이 — 1~2문장을 넘어서면 버립니다. */
  if (coaching.length > COACHING_MAX_LENGTH) {
    return blockedOutcome("length", steps, `${coaching.length}자`);
  }
  steps.push(step("length", true));

  return evidence.docId
    ? { status: "ok", message: coaching, docId: evidence.docId, steps }
    : { status: "ok", message: coaching, steps };
}

/* ── 호출 ──────────────────────────────────────────────── */

/**
 * 널리 쓰이는 chat-completions 규격의 주소를 만듭니다 (이미 전체 주소면 그대로 씁니다).
 *
 * 이 함수를 부르는 곳은 이제 서버 라우트 하나뿐입니다 — 상류와의 계약(프롬프트 두 벌·주소 꼴·
 * 응답 모양)은 여전히 이 파일 한 곳에만 적혀 있고, 라우트는 거기에 키와 한도만 얹습니다.
 */
export function chatCompletionsUrl(baseUrl: string): string {
  const base = baseUrl.trim().replace(/\/+$/, "");
  return base.endsWith("/chat/completions") ? base : `${base}/chat/completions`;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/* ── 요청 헤더 ─────────────────────────────────────────── */

/** `창번호.토큰` 한 줄 — meta와 갱신 헤더가 **같은 꼴**이라 읽는 함수도 하나입니다. */
interface CoachTokenStamp {
  window: number;
  token: string;
}

function parseTokenStamp(content: string): CoachTokenStamp | undefined {
  const dot = content.indexOf(".");
  if (dot <= 0) return undefined;
  const window = Number.parseInt(content.slice(0, dot), 10);
  const token = content.slice(dot + 1);
  if (!Number.isFinite(window) || token.length !== COACH_TOKEN_LENGTH) return undefined;
  return { window, token };
}

/**
 * 서버 렌더가 문서에 심어 둔 **단기 토큰 표식**을 읽습니다 (없으면 `undefined`).
 *
 * 심는 쪽은 `src/app/layout.tsx`이고, 심는 조건은 배포에 `COACH_SHARED_SECRET`이 설정돼
 * 있을 때뿐입니다. 비밀값이 없는 배포(기본 빌드·파일럿)에서는 meta 자체가 없으므로 이 함수는
 * 언제나 `undefined`를 돌려주고, 요청은 예전과 **한 글자도 다르지 않게** 나갑니다.
 *
 * meta 값은 `창번호.토큰` 꼴입니다. 창 번호를 함께 읽는 이유는 **낡은 값을 스스로 걷어 내기
 * 위해서**입니다 — 낡은 값을 그대로 보내면 서버가 403을 돌려주고 코칭이 조용히 접히는데,
 * 아예 보내지 않으면 「토큰 없는 요청」으로 다뤄져 훈련이 이어집니다.
 * 비밀값을 이 기기가 아는 일은 없습니다 — 읽는 것은 서버가 계산해 준 결과 한 줄뿐입니다.
 *
 * **이 자리는 첫 한 번의 씨앗입니다.** 앱 안 이동은 서버 렌더를 다시 타지 않으므로 문서에 심긴
 * 값은 20분이면 낡는데, 그 뒤로는 라우트가 응답 헤더로 돌려주는 최신 값이 앞에 섭니다
 * (`rememberCoachToken`). 두 자리의 값 꼴이 같아 읽는 함수는 하나입니다.
 */
function readMetaToken(): CoachTokenStamp | undefined {
  if (typeof document === "undefined") return undefined;
  const content = document
    .querySelector(`meta[name="${COACH_TOKEN_META}"]`)
    ?.getAttribute("content")
    ?.trim();
  return content ? parseTokenStamp(content) : undefined;
}

/**
 * 라우트가 응답 헤더로 돌려준 **최신 표식** — 이 모듈이 사는 동안만 들고 있습니다.
 *
 * 저장소에 넣지 않습니다. 표식은 10분이면 죽는 값이고, 남겨 봐야 다음 방문에는 이미 낡았으며,
 * 「기기에 남는 것은 연습 횟수 하나뿐」이라는 약속에 칸을 하나 더 만들 이유가 없습니다.
 */
let refreshed: CoachTokenStamp | undefined;

/**
 * 응답에 실려 온 다음 표식을 갈무리합니다 — 세 호출자가 fetch 직후에 한 번씩 부릅니다.
 *
 * 이 한 줄이 「문서 수명 = 토큰 수명」을 끊습니다. 예전에는 심는 자리가 서버 렌더 하나뿐이라,
 * 한 판을 20분 넘게 훈련하면 화면이 스스로 표식을 빼고 **작은 예산 통**으로 넘어갔습니다
 * (자세한 사정은 `COACH_TOKEN_REFRESH_HEADER` 주석).
 *
 * **헤더가 없으면 아무 일도 하지 않습니다** — 비밀값이 없는 배포는 이 헤더를 붙이지 않고,
 * 그때 들고 있던 값을 지우지도 않습니다. 모양이 깨진 값도 그냥 버립니다(믿고 쓰지 않습니다).
 */
export function rememberCoachToken(response: { headers?: { get(name: string): string | null } }): void {
  const content = response.headers?.get(COACH_TOKEN_REFRESH_HEADER)?.trim();
  if (!content) return;
  const stamp = parseTokenStamp(content);
  if (stamp) refreshed = stamp;
}

/**
 * 지금 보낼 표식 — **갱신 값이 meta보다 먼저**입니다.
 *
 * 갱신 값은 언제나 meta보다 뒤에 받은 것이므로 창 번호가 같거나 큽니다. 그래도 창 검사는
 * 두 자리에 똑같이 겁니다 — 탭을 오래 열어 둔 채 아무 호출도 하지 않으면 갱신 값도 낡습니다.
 */
function readCoachToken(now: number): string | undefined {
  const stamp = refreshed ?? readMetaToken();
  if (!stamp) return undefined;
  // 서버는 현재 창과 직전 창만 받습니다. 그보다 낡았으면 보내지 않습니다.
  return coachTokenWindow(now) - stamp.window > 1 ? undefined : stamp.token;
}

/**
 * `/api/coach`로 나가는 요청의 헤더 한 벌 — **세 호출자가 이 함수 하나를 나눠 씁니다**
 * (코칭·대사 변주·자유 연습). 헤더를 세 곳에 손으로 적어 두면 어느 날 한 곳만 고쳐집니다.
 *
 * @example
 * const response = await fetch(COACH_ENDPOINT, { method: "POST", headers: coachRequestHeaders(), body });
 * rememberCoachToken(response); // 다음 요청이 쓸 표식을 갈무리합니다
 */
export function coachRequestHeaders(now: number = Date.now()): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = readCoachToken(now);
  if (token) headers[COACH_TOKEN_HEADER] = token;
  return headers;
}

/** 중계 응답을 읽은 결과 — 원문 한 덩어리이거나, 조용히 되돌아갈 까닭이거나. */
type RelayResult =
  | { status: "ok"; content: string }
  | { status: "fallback"; fallback: OnlineCoachFallback };

/** `/api/coach`가 돌려준 몸통을 읽습니다. 낯선 모양은 전부 조용한 폴백입니다. */
function readRelay(payload: unknown): RelayResult {
  if (typeof payload !== "object" || payload === null) {
    return { status: "fallback", fallback: "http" };
  }
  const record = payload as { status?: unknown; content?: unknown };
  if (record.status === "unconfigured") return { status: "fallback", fallback: "config" };
  if (record.status === "rate_limited") return { status: "fallback", fallback: "rate_limited" };
  if (record.status === "ok" && typeof record.content === "string" && record.content.length > 0) {
    return { status: "ok", content: record.content };
  }
  // "upstream"과 그 밖의 모양 — 서버가 상류에서 아무것도 받지 못한 경우입니다.
  return { status: "fallback", fallback: "http" };
}

/**
 * 코칭 한 문장을 청하고, 돌아온 답을 가드에 통과시킵니다.
 *
 * 부르는 곳은 같은 도메인 `/api/coach` 하나입니다. 키를 붙이지 않습니다 — 붙일 키가
 * 이 기기에 없습니다. 상류 주소와 모델 이름을 고르는 일은 서버가 합니다.
 *
 * 연결이 안 되거나 늦으면(`fallback`) 화면에는 **아무것도 뜨지 않습니다** — 결정론 코칭이
 * 이미 떠 있으므로, 실패를 알리는 것보다 조용히 원래 자리에 있는 편이 훈련을 덜 끊습니다.
 */
export async function requestOnlineCoaching(
  request: OnlineCoachRequest,
  config: OnlineCoachingSettings,
  options: OnlineCoachOptions = {},
): Promise<OnlineCoachOutcome> {
  if (!config.enabled) return fallbackOutcome("disabled");

  const doFetch = options.fetchImpl ?? (typeof fetch === "function" ? fetch : undefined);
  if (!doFetch) return fallbackOutcome("network");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? ONLINE_COACH_TIMEOUT_MS);

  let payload: unknown;
  try {
    const response = await doFetch(COACH_ENDPOINT, {
      method: "POST",
      headers: coachRequestHeaders(),
      signal: controller.signal,
      // 나가는 것은 이 다섯 칸뿐입니다 — 발화는 이미 가명처리를 지났습니다(buildCoachRequest).
      body: JSON.stringify(request),
    });
    // 다음 요청이 쓸 표식을 갈무리합니다 — 문서 수명이 곧 토큰 수명이던 자리를 끊습니다.
    rememberCoachToken(response);
    if (!response.ok) return fallbackOutcome("http");
    payload = await response.json();
  } catch (error) {
    return fallbackOutcome(isAbortError(error) ? "timeout" : "network");
  } finally {
    clearTimeout(timer);
  }

  const relayed = readRelay(payload);
  if (relayed.status !== "ok") return fallbackOutcome(relayed.fallback);
  return applyGuards(relayed.content, options.guard);
}

/**
 * chat-completions 응답에서 본문 문자열만 꺼냅니다 (모양이 다르면 undefined).
 * 이 모양을 아는 곳은 서버 라우트뿐입니다 — 브라우저는 중계된 원문 텍스트만 봅니다.
 */
export function readChatCompletionContent(payload: unknown): string | undefined {
  if (typeof payload !== "object" || payload === null) return undefined;
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return undefined;
  const first = choices[0];
  if (typeof first !== "object" || first === null) return undefined;
  const message = (first as { message?: unknown }).message;
  if (typeof message !== "object" || message === null) return undefined;
  const content = (message as { content?: unknown }).content;
  return typeof content === "string" ? content : undefined;
}

/* ── 화면용 보관소 ─────────────────────────────────────── */

/**
 * 판정 결과 객체를 열쇠로 코칭을 붙여 둡니다.
 *
 * 대화 로그의 판정 한 건은 렌더가 몇 번 돌아도 **같은 객체**이고, 화면을 벗어나면 함께
 * 사라집니다. WeakMap을 쓰면 발화도 코칭도 어디에도 남지 않습니다(브리프 §2 — 원문 미저장).
 * 이 보관소 덕분에 대화 로그 컴포넌트를 통과하는 새 prop 배선이 필요 없습니다.
 */
const outcomes = new WeakMap<object, OnlineCoachOutcome>();
const inflight = new WeakSet<object>();
const listeners = new Set<() => void>();

/** 코칭이 도착하면 알려 줍니다. 해제 함수를 돌려줍니다. */
export function subscribeCoaching(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 이 판정에 붙은 온라인 코칭 (없으면 undefined) */
export function getCoaching(feedback: object): OnlineCoachOutcome | undefined {
  return outcomes.get(feedback);
}

/** 시험·초기화용 — 보관해 둔 코칭을 지웁니다. */
export function clearCoaching(feedback: object): void {
  outcomes.delete(feedback);
}

export interface CueCoachingContext {
  scenario: Scenario;
  cue: CueDef;
  utterance: string;
}

/**
 * 이 턴에 온라인 코칭을 청합니다 — **중립 미분류로 떨어진 턴에서만** 부르십시오.
 *
 * 꺼져 있거나·오프라인이거나·서버에 상류 설정이 없거나·한도를 넘었거나·응답이 늦으면 아무것도
 * 보관하지 않습니다(화면 그대로). 판정·게이지·기록에는 손대지 않습니다.
 */
export async function startCueCoaching(
  feedback: object,
  context: CueCoachingContext,
  options: OnlineCoachOptions = {},
): Promise<void> {
  if (outcomes.has(feedback) || inflight.has(feedback)) return;

  const config = getSettings().onlineCoaching;
  if (!config.enabled) return;
  // 오프라인이면 애초에 부르지 않습니다 — 훈련은 네트워크 없이 끝까지 돌아야 합니다.
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  if (context.utterance.trim().length === 0) return;

  inflight.add(feedback);
  try {
    const outcome = await requestOnlineCoaching(
      buildCoachRequest(context.scenario, context.cue, context.utterance),
      config,
      options,
    );
    // 조용한 폴백은 화면에 아무것도 남기지 않습니다.
    if (outcome.status === "fallback") return;
    outcomes.set(feedback, outcome);
    for (const listener of listeners) listener();
  } finally {
    inflight.delete(feedback);
  }
}
