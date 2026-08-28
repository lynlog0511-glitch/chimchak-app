/**
 * 온라인 중계 — **키가 사는 유일한 자리**입니다.
 *
 * 브라우저는 이제 상류 제공사를 직접 부르지 않습니다. 같은 도메인의 `/api/coach` 한 곳만
 * 부르고, 주소·모델 이름·키는 **서버 환경변수**에만 있습니다(`NEXT_PUBLIC_` 접두어가 없으므로
 * 어떤 값도 브라우저 번들에 실리지 않습니다). 그래서 온라인 모드를 켜도 CSP의
 * `connect-src 'self'` 한 줄이 그대로 참입니다 — 이 전환이 사려는 것이 정확히 그 한 줄입니다.
 *
 * 이 주소가 받는 일은 **넷**입니다(`task`로 갈립니다).
 *  · `coach`(기본) — 미분류 턴에 코칭 한 문장. `task`가 없으면 이쪽입니다(옛 계약 그대로).
 *  · `vary`        — 검수 앵커 대사를 같은 뜻으로 다시 쓰기(`src/lib/onlineVary.ts`).
 *  · `free`        — 자유 대화 연습의 상황·대사·마무리 요약(`src/lib/onlineFree.ts`).
 *                    **이 작업에만 학습자 발화가 실립니다**(가명처리를 지난 문자열입니다).
 *                    나머지 둘의 계약은 한 글자도 바뀌지 않았습니다.
 *  · `ping`        — 설정 여부만 되돌려 주는 점검용 분기. **상류를 부르지 않고** 예산 통도 쓰지
 *                    않습니다(/check 화면이 무대 전에 켜 보는 자리입니다). 계수기 밖에 두지는
 *                    않아, IP당 분당 한 칸만 셉니다.
 * 앞의 세 일은 검증도 프롬프트도 생성 상한도 따로입니다. **IP당 계수기는 하나를 나눠 쓰지만**
 * (비용은 요청 수로 나가지 작업 이름으로 나가지 않습니다), **배포 전체 하루 예산은 `vary`만
 * 전용 통을 씁니다** — 변주는 못 받으면 검수 앵커 대사로 조용히 접히는 기능이고 자유 연습은 못
 * 받으면 화면이 열리지 않는 기능이라, 접히는 쪽이 안 접히는 쪽을 굶기지 않게 격리한 자리입니다
 * (사유 전문은 `src/lib/coachLimits.ts`의 `varyDailyCap`).
 *
 * 이 파일이 하는 일은 다섯뿐입니다.
 *  ① **출처 확인** — 같은 출처에서 온 JSON 요청만 받습니다. 아무 웹사이트가 방문자의 브라우저로
 *    이 주소에 POST를 쏘는 길(프리플라이트가 붙지 않는 단순 요청)을 입구에서 닫습니다.
 *  ② **표식 대조와 갱신** — `COACH_SHARED_SECRET`이 설정된 배포에서만. 단기 토큰을 되돌려 보낸
 *    요청과 그렇지 않은 요청을 갈라 **예산 통을 둘로 나누고**(어느 창과도 맞지 않는 표식은
 *    계수기에 닿기 전 403), **표식을 들고 온 요청에만** 다음 창의 표식을 응답 헤더로 실어
 *    돌려줍니다. 토큰을 심는 자리가 서버 렌더 하나뿐이면 문서 수명이 곧 토큰 수명이 되어,
 *    20분 뒤 정상 트래픽 전체가 작은 통으로 떨어집니다. 반대로 아무 요청에나 표식을 내주면
 *    작은 통이 30바이트 요청 한 번의 통행료가 됩니다 — 두 실패 사이를 가르는 것이 「낡았지만
 *    이 배포가 내준 표식」(`stale`) 갈래입니다. 비밀값이 없으면 이 단은 통째로 잠듭니다.
 *  ③ **한도** — IP당 분당·일당, 그리고 배포 전체 일당 상한을 셉니다(비용 가드).
 *  ④ **검증** — 클라이언트가 보내는 산출물 모양만 받습니다. 그 밖의 값은 버리고 400으로 끊습니다
 *    (상류로 흘려보내지 않습니다). 발화는 500자가 상한입니다. 프롬프트에 실리는 칸은 **한 줄로
 *    펴서** 받습니다 — 보이지 않는 글자를 지우고 줄바꿈을 공백으로 낮춰, 절 머리를 위조해
 *    사용자 프롬프트의 구조를 갈아 끼우는 길을 닫습니다(`src/lib/textGuard.ts`).
 *  ⑤ **중계** — 키를 붙여 상류를 한 번 부르고, **원문 텍스트만** 그대로 돌려줍니다.
 *
 * 하지 않는 일이 더 중요합니다.
 *  · **가드 체인을 여기서 돌리지 않습니다.** 코칭의 형식·근거·표현·길이 네 단도, 변주의 형식·
 *    길이·숫자·표현 네 단도, 자유 연습의 형식·길이·표현·위험 신호 네 단도 지금처럼 기기 안에서
 *    돕니다(`onlineCoach.ts`·`onlineVary.ts`·`onlineFree.ts`).
 *    「받아 온 문장은 기기 안 가드를 지나야 화면에 닿는다」는 서사가 서버를 하나 세웠다고
 *    서버로 옮겨 가면 안 됩니다.
 *    ※ **계약**: 이 응답(`{ status: "ok", content }`)은 **무가드 원문**입니다. 이 주소를 쓰는
 *      쪽은 어디든 화면에 닿기 전에 해당 작업의 가드 체인을 반드시 통과시켜야 합니다.
 *      지금 소비자는 이 앱의 브라우저 하나뿐이라 약속이 지켜지고 있고, 소비자가 늘면 가드가
 *      전부 순수 함수이므로 서버측에서 한 번 더 태우는 선택지도 그대로 열려 있습니다.
 *  · **발화와 응답을 로그에 남기지 않습니다.** 아래 어디에도 `console.*`이 없고, 예외 객체조차
 *    찍지 않습니다 — 상류 오류 메시지에 보낸 몸통이 딸려 오는 일이 흔하기 때문입니다.
 *    남길 수 있는 것은 「몇 번 불렀는가」뿐이고, 그것도 메모리 안에서만 셉니다.
 *
 * 서비스워커는 이 주소를 건드리지 않습니다 — `public/sw.js`의 fetch 핸들러가 GET이 아닌 요청을
 * 첫 줄에서 그대로 통과시킵니다(개인정보가 담길 수 있는 POST는 저장하지 않는다는 규칙).
 */

import {
  COACH_RATE_LIMITS,
  COACH_TOKEN_HEADER,
  COACH_TOKEN_REFRESH_HEADER,
  coachTokenMetaValue,
  isRenewableCoachToken,
  verifyCoachToken,
} from "@/lib/coachLimits";
import {
  buildSystemPrompt,
  buildUserPrompt,
  chatCompletionsUrl,
  citableDocRefs,
  readChatCompletionContent,
  type CoachDocRef,
  type OnlineCoachRequest,
} from "@/lib/onlineCoach";
import {
  FREE_HISTORY_LINE_MAX,
  FREE_HISTORY_MAX_LINES,
  FREE_PERSONA_MAX,
  FREE_SEED_MAX,
  FREE_SITUATION_MAX,
  buildFreeSystemPrompt,
  buildFreeUserPrompt,
  type FreeRequest,
} from "@/lib/onlineFree";
import {
  VARY_ANCHOR_MAX,
  VARY_MAX_RECENT_LINES,
  VARY_PERSONA_MAX,
  VARY_RECENT_LINE_MAX,
  buildVarySystemPrompt,
  buildVaryUserPrompt,
  type LineVaryRequest,
} from "@/lib/onlineVary";
import { flattenPromptField } from "@/lib/textGuard";

/* ── 상한 ──────────────────────────────────────────────── */

/** 몸통 전체 상한(바이트 대신 문자 수로 셉니다) — 코칭·변주의 **옛 값 그대로**입니다. */
const MAX_BODY_LENGTH = 8_192;

/**
 * 자유 연습만의 몸통 상한.
 *
 * 이 작업에는 대화 이력이 통째로 실립니다(최대 26줄 × 300자). 코칭·변주와 같은 8,192자로
 * 두면 긴 대화가 어느 순간부터 조용히 400으로 끊깁니다 — 화면에는 아무 표시도 나지 않는
 * 고장이라, 상한을 작업별로 갈라 둡니다. **코칭·변주가 받는 값은 한 글자도 바뀌지 않습니다.**
 */
const MAX_FREE_BODY_LENGTH = 16_384;

/** 어느 작업이든 이 길이를 넘으면 파싱조차 하지 않습니다(작업 이름을 읽기 전의 방벽). */
const MAX_ANY_BODY_LENGTH = Math.max(MAX_BODY_LENGTH, MAX_FREE_BODY_LENGTH);

/** 이 작업이 받는 몸통 상한 */
function bodyLimitFor(task: CoachTask): number {
  return task === "free" ? MAX_FREE_BODY_LENGTH : MAX_BODY_LENGTH;
}

/** 발화 길이 상한(자). 훈련 한 턴의 말은 이 안에서 끝납니다. */
const MAX_UTTERANCE_LENGTH = 500;
const MAX_SUMMARY_LENGTH = 400;
const MAX_CUE_PROMPT_LENGTH = 400;
const MAX_INDICATORS = 12;
const MAX_INDICATOR_LENGTH = 200;
const MAX_DOCS = 16;
const MAX_DOC_ID_LENGTH = 48;
const MAX_DOC_TITLE_LENGTH = 160;

/* 변주 쪽 상한 — 나가는 것은 시나리오 요약·인물 프로필·검수 앵커·직전 인물 대사뿐입니다.
   값은 `src/lib/onlineVary.ts`가 한 자리에 들고 있습니다(보내는 쪽과 받는 쪽이 같은 수를 봅니다). */
const MAX_PERSONA_LENGTH = VARY_PERSONA_MAX;
const MAX_ANCHOR_LENGTH = VARY_ANCHOR_MAX;
const MAX_RECENT_LINE_LENGTH = VARY_RECENT_LINE_MAX;

/* 자유 연습 쪽 상한 — 나가는 것은 시드 한 줄·상황 지문·인물 소개·대화 이력입니다.
   대화 이력에는 **학습자 발화가 들어 있습니다**(가명처리를 지난 문자열). 이 작업에만 있는
   사실이라 상한도 이 작업에만 둡니다. 값은 `src/lib/onlineFree.ts`가 한 자리에 들고 있습니다. */
const MAX_FREE_SEED_LENGTH = FREE_SEED_MAX;
const MAX_FREE_SITUATION_LENGTH = FREE_SITUATION_MAX;
const MAX_FREE_PERSONA_LENGTH = FREE_PERSONA_MAX;
const MAX_FREE_HISTORY_LINES = FREE_HISTORY_MAX_LINES;
const MAX_FREE_HISTORY_LINE_LENGTH = FREE_HISTORY_LINE_MAX;

/** 상류를 기다리는 상한(ms). 넘으면 조용히 폴백입니다 — 훈련을 붙잡아 두지 않습니다. */
const UPSTREAM_TIMEOUT_MS = 6_000;

/** 상류에 거는 생성 상한. 코칭은 1~2문장이라 이 이상 받아 봐야 가드가 버립니다. */
const UPSTREAM_MAX_TOKENS = 400;

/**
 * 변주의 생성 상한 — 대사 한 줄을 다시 쓰는 일이라 코칭보다 짧습니다.
 * 길게 받아 봐야 기기 안 길이 가드(앵커의 160%)가 버립니다.
 */
const UPSTREAM_VARY_MAX_TOKENS = 200;

/**
 * 자유 연습의 생성 상한 — **단계마다 다릅니다.**
 *
 * 상황·인물을 만드는 첫 단계만 두어 문장을 함께 받아야 해서 넉넉하고, 대화 한 마디는 변주와
 * 같은 크기이며, 마무리 요약은 두세 문장입니다. 길게 받아 봐야 기기 안 길이 가드가 버립니다.
 */
const UPSTREAM_FREE_MAX_TOKENS: Record<FreeRequest["stage"], number> = {
  setup: 400,
  reply: 200,
  summary: 300,
};

/**
 * 온도 — 코칭은 사실을 짚는 일이라 낮게, 변주는 **말맛을 바꾸는 일**이라 조금 높게 둡니다.
 * 높인 만큼 새 사실이 섞일 여지도 커지는데, 그 자리는 기기 안 숫자·길이 가드가 받습니다.
 *
 * 자유 연습은 상황과 대사를 새로 만드는 일이라 변주와 같은 값을 쓰되, 마무리 요약만은 사실을
 * 짚는 일이라 코칭과 같은 값으로 내립니다.
 */
const COACH_TEMPERATURE = 0.2;
const VARY_TEMPERATURE = 0.7;
const FREE_TEMPERATURE: Record<FreeRequest["stage"], number> = {
  setup: 0.7,
  reply: 0.7,
  summary: 0.2,
};

/**
 * 호출 한도 — 값과 사유는 `src/lib/coachLimits.ts` 한 곳에 있습니다.
 *
 * 라우트 파일은 핸들러 외의 값을 export할 수 없어 상수의 집을 밖에 두었습니다.
 * `.env.example`도 숫자를 적지 않고 그 파일을 가리킵니다 — 문서와 코드가 갈라지던 자리입니다.
 */
const PER_IP_PER_MINUTE = COACH_RATE_LIMITS.perIpPerMinute;
const PER_IP_PER_DAY = COACH_RATE_LIMITS.perIpPerDay;
const DEFAULT_DAILY_CAP = COACH_RATE_LIMITS.defaultDailyCap;
const DEFAULT_VARY_DAILY_CAP = COACH_RATE_LIMITS.varyDailyCap;
const ANON_DAILY_CAP = COACH_RATE_LIMITS.anonDailyCap;

/* ── 서버 설정 ─────────────────────────────────────────── */

interface CoachServerConfig {
  baseUrl: string;
  model: string;
  /** 비어 있을 수 있습니다 — 키 없이 도는 사내·로컬 게이트웨이를 막지 않으려는 자리입니다. */
  apiKey: string;
  /** 코칭·자유 연습이 쓰는 통 (`COACH_DAILY_CAP`) */
  dailyCap: number;
  /**
   * 변주 전용 통 (`COACH_VARY_DAILY_CAP`) — 언제나 `min(설정값, dailyCap)`입니다.
   * 사유는 `COACH_RATE_LIMITS.varyDailyCap` 주석에 있습니다(두 수를 여기 옮겨 적지 않습니다).
   */
  varyCap: number;
}

/**
 * 예산 상한 env 한 칸 — 양의 정수만 받고, 없거나 이상하면 기본값입니다.
 *
 * 두 상한(`COACH_DAILY_CAP`·`COACH_VARY_DAILY_CAP`)이 **같은 함수**를 지납니다. 파싱 규칙을
 * 두 번 적으면 다음 사람이 한쪽에만 상한(10만)을 걸거나 `0`을 다르게 다루는 자리가 됩니다.
 */
function readCapEnv(raw: string | undefined, fallback: number): number {
  const value = Number.parseInt((raw ?? "").trim(), 10);
  return Number.isFinite(value) && value > 0 ? Math.min(value, 100_000) : fallback;
}

/**
 * 환경변수를 읽습니다. **호출 때마다** 읽습니다(모듈 최상단에 상수로 굳히지 않습니다) —
 * 배포 뒤 값을 바꿔도 다음 요청부터 반영되고, 회귀 검사도 값을 갈아 끼우며 돌 수 있습니다.
 *
 * 주소나 모델 이름이 없으면 `undefined`입니다. 그 상태는 오류가 아니라 **기본 빌드**이고,
 * 호출자는 `{ status: "unconfigured" }`를 200으로 돌려받아 조용히 결정론 코칭만 씁니다.
 */
function readConfig(): CoachServerConfig | undefined {
  const baseUrl = (process.env.COACH_BASE_URL ?? "").trim();
  const model = (process.env.COACH_MODEL ?? "").trim();
  if (baseUrl.length === 0 || model.length === 0) return undefined;

  const dailyCap = readCapEnv(process.env.COACH_DAILY_CAP, DEFAULT_DAILY_CAP);
  /* 변주 통은 **일반 통을 넘지 않습니다** — `COACH_DAILY_CAP`을 내려 비용을 조인 배포에서
     변주만 기본 300회를 도는 뒤집힘을 막는 자리입니다(`anonDailyCap`과 같은 규율). */
  const varyCap = Math.min(
    readCapEnv(process.env.COACH_VARY_DAILY_CAP, DEFAULT_VARY_DAILY_CAP),
    dailyCap,
  );

  return { baseUrl, model, apiKey: (process.env.COACH_API_KEY ?? "").trim(), dailyCap, varyCap };
}

/* ── 요청 검증 ─────────────────────────────────────────── */

/**
 * 문자열 칸 하나 — 비었거나 상한을 넘으면 `undefined`(= 요청 전체를 400으로 끊습니다).
 *
 * **한 줄로 펴서 받습니다**(`flattenPromptField`). 예전에는 `trim()`과 길이만 봤는데, 이 칸들의
 * 값은 서버가 조립하는 **사용자 프롬프트에 원문 그대로** 실립니다 — 상황·지시문·발화·시드·
 * 인물 소개·대화 이력이 전부 그렇습니다. 그러면 칸 안에 줄바꿈 하나만 넣어도
 * `[상황]`·`[할 일]` 같은 절 머리를 위조해 프롬프트의 구조를 갈아 끼울 수 있고, 제로폭·양방향
 * 재정의 문자는 눈에 보이지 않은 채 그 자리에 끼어듭니다.
 *
 * 같은 저장소가 가져온 CSV에는 이미 이 규율을 걸어 두었는데(`readImportText`) 정작 **프롬프트로
 * 나가는 쪽**에는 없던 자리입니다. 이제 두 경로가 `src/lib/textGuard.ts`의 **같은 목록**을 봅니다.
 * 다만 하는 일은 다릅니다 — CSV는 파일 전체를 거부하고, 여기서는 지워서 받습니다. 정상 요청이
 * 조용히 400이 되면 화면에는 아무 표시도 나지 않기 때문입니다(마이크 인식이 흘린 글자 하나로
 * 훈련이 멈추면 안 됩니다).
 *
 * 길이는 편 **뒤에** 셉니다. 펴면 길이는 줄기만 하므로 정직한 요청이 이 때문에 걸리지 않습니다.
 */
function readField(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const flat = flattenPromptField(value);
  return flat.length === 0 || flat.length > max ? undefined : flat;
}

/** 행동지표 목록 — 빈 배열은 허용합니다(이 장면에 연결된 지표가 없을 수 있습니다). */
function readIndicators(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.length > MAX_INDICATORS) return undefined;
  const out: string[] = [];
  for (const item of value) {
    const line = readField(item, MAX_INDICATOR_LENGTH);
    if (line === undefined) return undefined;
    out.push(line);
  }
  return out;
}

/**
 * 인용 가능 문서 목록의 **모양만** 봅니다 — 값은 쓰지 않습니다.
 *
 * 이 목록은 시스템 프롬프트의 「인용 가능 문서」 블록에 그대로 들어갑니다. 클라이언트가 보낸
 * 문자열이 그 자리에 닿으면 시스템 프롬프트를 부르는 쪽이 쓰게 되고, 프롬프트에 적어 둔 안전
 * 규칙은 그 경로에서 통째로 무의미해집니다. 그래서 **서버가 `serverDocs()`로 직접 채웁니다.**
 *
 * 요청 계약은 그대로 둡니다(옛 클라이언트가 계속 보내도 400이 되지 않습니다) — 다만 서버는
 * 형태가 맞는지만 확인하고 내용은 버립니다. 「받되 쓰지 않는다」가 이 함수의 전부입니다.
 */
function checkDocsShape(value: unknown): boolean {
  if (!Array.isArray(value) || value.length > MAX_DOCS) return false;
  for (const item of value) {
    if (typeof item !== "object" || item === null) return false;
    const record = item as Record<string, unknown>;
    const id = readField(record.id, MAX_DOC_ID_LENGTH);
    const title = readField(record.title, MAX_DOC_TITLE_LENGTH);
    if (id === undefined || title === undefined) return false;
  }
  return true;
}

/** 프롬프트에 실제로 실리는 문서 목록 — **서버측 화이트리스트 하나뿐**입니다. */
function serverDocs(): CoachDocRef[] {
  return citableDocRefs();
}

/**
 * 기대 형태만 통과시키고, **아는 칸만 새로 조립해** 돌려줍니다.
 * 클라이언트가 무엇을 더 실어 보내든 상류로는 이 다섯 칸만 나갑니다.
 */
function readCoachRequest(body: unknown): OnlineCoachRequest | undefined {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return undefined;
  const record = body as Record<string, unknown>;

  const scenarioSummary = readField(record.scenarioSummary, MAX_SUMMARY_LENGTH);
  const cuePrompt = readField(record.cuePrompt, MAX_CUE_PROMPT_LENGTH);
  const utterance = readField(record.utterance, MAX_UTTERANCE_LENGTH);
  if (!scenarioSummary || !cuePrompt || !utterance) return undefined;

  const indicators = readIndicators(record.indicators);
  if (!indicators || !checkDocsShape(record.docs)) return undefined;

  // 문서 목록은 받은 값을 쓰지 않고 서버가 채웁니다(위 checkDocsShape 주석).
  return { scenarioSummary, cuePrompt, utterance, indicators, docs: serverDocs() };
}

/** 직전 인물 대사 목록 — 빈 배열을 허용합니다(첫 대사에는 앞선 대사가 없습니다). */
function readRecentLines(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.length > VARY_MAX_RECENT_LINES) return undefined;
  const out: string[] = [];
  for (const item of value) {
    const line = readField(item, MAX_RECENT_LINE_LENGTH);
    if (line === undefined) return undefined;
    out.push(line);
  }
  return out;
}

/**
 * 변주 요청 — 코칭과 **같은 규율**입니다. 기대 형태만 통과시키고, 아는 칸만 새로 조립합니다.
 *
 * 여기에 `utterance` 칸이 **없다는 사실**이 이 절의 전부입니다. 대사를 다시 쓰는 데 학습자의
 * 말은 필요하지 않고, 필요하지 않은 것은 상류에 닿을 자리도 두지 않습니다.
 */
function readVaryRequest(body: unknown): LineVaryRequest | undefined {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return undefined;
  const record = body as Record<string, unknown>;

  const scenarioSummary = readField(record.scenarioSummary, MAX_SUMMARY_LENGTH);
  const persona = readField(record.persona, MAX_PERSONA_LENGTH);
  const anchor = readField(record.anchor, MAX_ANCHOR_LENGTH);
  if (!scenarioSummary || !persona || !anchor) return undefined;

  const recentLines = readRecentLines(record.recentLines);
  if (!recentLines) return undefined;

  return { scenarioSummary, persona, anchor, recentLines };
}

/** 자유 연습의 대화 이력 — 빈 배열을 허용합니다(첫 대사에는 앞선 말이 없습니다). */
function readFreeHistory(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.length > MAX_FREE_HISTORY_LINES) return undefined;
  const out: string[] = [];
  for (const item of value) {
    const line = readField(item, MAX_FREE_HISTORY_LINE_LENGTH);
    if (line === undefined) return undefined;
    out.push(line);
  }
  return out;
}

/** 자유 연습의 단계 — 셋 중 하나가 아니면 요청 전체를 400으로 끊습니다. */
function readFreeStage(value: unknown): FreeRequest["stage"] | undefined {
  return value === "setup" || value === "reply" || value === "summary" ? value : undefined;
}

/**
 * 자유 연습 요청 — 코칭·변주와 **같은 규율**입니다. 기대 형태만 통과시키고, 아는 칸만 새로 조립합니다.
 *
 * 단계마다 받는 칸이 다릅니다. `setup`은 시드 한 줄뿐이고(아직 상황도 인물도 없습니다),
 * `reply`는 거기에 상황·인물·대화 이력이 붙고, `summary`에만 인용 가능 문서 목록이 더 붙습니다.
 * 단계에 없는 칸은 실려 와도 조립하지 않습니다 — 상류에 닿는 것은 이 함수가 만든 객체뿐입니다.
 */
function readFreeRequest(body: unknown): FreeRequest | undefined {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return undefined;
  const record = body as Record<string, unknown>;

  const stage = readFreeStage(record.stage);
  const seed = readField(record.seed, MAX_FREE_SEED_LENGTH);
  if (!stage || !seed) return undefined;
  if (stage === "setup") return { stage, seed };

  const situation = readField(record.situation, MAX_FREE_SITUATION_LENGTH);
  const persona = readField(record.persona, MAX_FREE_PERSONA_LENGTH);
  if (!situation || !persona) return undefined;

  const history = readFreeHistory(record.history);
  if (!history) return undefined;
  if (stage === "reply") return { stage, seed, situation, persona, history };

  if (!checkDocsShape(record.docs)) return undefined;
  return { stage, seed, situation, persona, history, docs: serverDocs() };
}

/* ── 호출 한도 ─────────────────────────────────────────── */

/**
 * 인메모리 계수기.
 *
 * ※ 정직하게 적어 둡니다: 이 지도는 **서버리스 인스턴스마다 따로** 삽니다. 인스턴스가 둘로
 *   늘면 한도도 사실상 둘로 늘고, 인스턴스가 잠들면 계수가 0으로 돌아갑니다. 그래도 파일럿
 *   규모(시연·소수 사용자)에서 「무한 호출로 요금이 새는 일」을 막는 데는 충분합니다.
 *   콘솔 단계로 넘어가면 이 자리를 공유 저장소(카운터 테이블·KV)로 옮깁니다 — 옮길 때
 *   바뀌는 것은 `takeSlot` 한 함수뿐이도록 계산을 여기 몰아 두었습니다.
 *
 * ※ IP 하나를 여럿이 나눠 쓰는 자리(행사장 공용 와이파이·기관 NAT)에서는 **IP당 한도가
 *   방 전체의 몫**입니다. 그 자리에서 막히면 먼저 볼 것은 배포 전체 상한(env)이 아니라
 *   `COACH_RATE_LIMITS`의 IP당 값입니다 — **상수라 올리려면 재배포가 필요합니다**(문답카드
 *   B-19가 같은 사실을 말합니다). 배포 전체 상한은 총 사용량이 문제일 때의 손잡이입니다.
 *   1인 1기기(개인 회선) 수칙이 기본인 이유가 이 성질입니다.
 */
interface IpBucket {
  minute: number;
  minuteCount: number;
  day: number;
  dayCount: number;
}

const ipBuckets = new Map<string, IpBucket>();
let globalDay = -1;

/**
 * 배포 전체 하루 예산 **한 통**의 계수 두 칸.
 *
 *  · `tokened` — 토큰 표식이 붙은 요청의 몫(화면에서 온 정상 호출).
 *  · `anon`    — 토큰 없는 요청의 몫. 비밀값이 설정된 배포에서만 갈립니다(`anonDailyCap` 주석).
 */
interface DailyBudget {
  tokened: number;
  anon: number;
}

/**
 * **통이 둘입니다** — 코칭·자유 연습이 쓰는 `main`과 변주 전용 `vary`.
 *
 * 왜 가르는가: 실패 비용이 비대칭이기 때문입니다. 변주는 못 받으면 화면이 검수 앵커 대사로
 * 조용히 접히지만(학습자는 아무 일도 없었다고 느낍니다), 자유 연습은 못 받으면 **화면이
 * 열리지 않습니다**. 통이 하나였을 때는 한 판에 4~6회씩 나가는 변주 트래픽이 그 안 접히는
 * 기능의 몫을 먹을 수 있었고, 그때 보이는 증상은 「변주가 안 되네」가 아니라 「자유 연습이
 * 안 열린다」였습니다. 값싼 실패가 비싼 실패를 끌고 들어오지 못하게 격리하는 자리입니다.
 * 값과 사유 전문은 `COACH_RATE_LIMITS.varyDailyCap`에 있습니다.
 *
 * 가르지 **않는** 것도 적어 둡니다 — IP당 분당·일당 한도는 두 통이 그대로 함께 씁니다
 * (`ipBuckets`). 작업 이름을 바꿔 가며 IP 하나의 몫을 두 배로 쓰는 길을 열지 않습니다.
 */
const budgets: Record<"main" | "vary", DailyBudget> = {
  main: { tokened: 0, anon: 0 },
  vary: { tokened: 0, anon: 0 },
};

/** 항목 수 상한 — 값과 사유는 `src/lib/coachLimits.ts`에 있습니다. */
const MAX_IP_BUCKETS = COACH_RATE_LIMITS.maxIpBuckets;

/**
 * 오래 쉰 항목을 지우는 문턱(분). 하루가 지난 항목이 없어도 지도가 상한에 닿으면,
 * 이 시간 넘게 아무 요청도 없던 자리를 거둡니다.
 *
 * 치르는 값을 정직하게 적어 둡니다 — 거둔 IP의 **그날 누적 계수**가 0으로 돌아갑니다. 그래서
 * 이 정리는 지도가 상한에 닿았을 때만 돕니다. 그 상황에서 지킬 것은 IP당 일당 계수의 정밀도가
 * 아니라 인스턴스 메모리이고, 비용을 실제로 막는 것은 배포 전체 상한입니다.
 */
const IDLE_EVICT_MINUTES = 60;

/** 전체 훑기를 마지막으로 돈 분 — 상한에 닿은 뒤 요청마다 O(n)을 태우지 않기 위한 자리입니다. */
let lastPruneMinute = -1;

/**
 * 지도가 무한정 자라지 않게 — **상한에 닿았을 때만** 훑습니다.
 *
 * 예전에는 「하루가 지난 자리」만 버렸습니다. 그런데 하루 안에서 항목이 4,096개를 넘기면 그 조건은
 * 한 건도 지우지 못하면서 요청마다 지도 전체를 훑기만 했습니다(요청당 O(n)). 그래서 둘을 고칩니다 —
 * 오래 쉰 자리도 함께 거두고, 훑기는 **분당 한 번**으로 묶습니다.
 */
function prune(day: number, minute: number): void {
  if (ipBuckets.size < MAX_IP_BUCKETS) return;
  if (lastPruneMinute === minute) return;
  lastPruneMinute = minute;
  for (const [ip, bucket] of ipBuckets) {
    if (bucket.day !== day || minute - bucket.minute >= IDLE_EVICT_MINUTES) ipBuckets.delete(ip);
  }
}

/**
 * 이 요청의 몫을 한 칸 집습니다. 남은 몫이 없으면 `false`입니다.
 * 상류를 부르기 **전에** 셉니다 — 실패한 호출도 비용과 부하를 만들기 때문입니다.
 *
 * `ip`가 없으면(프록시 없는 배포) **배포 전체 상한만** 겁니다 — 위 `clientIp()` 주석 참조.
 *
 * **배포 전체 상한은 통 둘 × 칸 둘입니다.**
 *  · **어느 통인가** — `vary`는 전용 통(`config.varyCap`), 코칭·자유 연습은 기존 통
 *    (`config.dailyCap`). 접히는 기능이 안 접히는 기능을 굶기지 않게 가른 자리입니다
 *    (사유 전문은 위 `budgets`와 `COACH_RATE_LIMITS.varyDailyCap`).
 *  · **통 안의 어느 칸인가** — `tokened`가 참인 요청(화면이 받은 단기 토큰을 붙여 온 요청)은
 *    그 통의 상한을, 토큰 없는 요청은 훨씬 작은 `anonDailyCap` 몫을 씁니다. 이 이원 구조는
 *    통을 가르기 전과 **한 글자도 달라지지 않았고**, 이제 통마다 걸립니다.
 * 통을 나누기 전에는 상한 하나가 곧 「그날 하루 전 사용자의 온라인 코칭을 끄는 스위치」였습니다.
 * 비밀값이 설정되지 않은 배포에서는 호출자가 `tokened`를 언제나 참으로 넘기므로 **통 안의 칸은
 * 하나이고 동작은 예전 그대로**입니다(파일럿 무중단).
 *
 * IP당 한도는 **네 몫이 전부 함께** 씁니다 — IP 하나가 토큰을 붙였다 뺐다 하거나 작업 이름을
 * 바꿔 가며 몫을 늘리는 길을 열지 않기 위해서입니다.
 *
 * **작은 칸은 그 통을 넘지 않습니다** — `min(anonDailyCap, 이 통의 상한)`. 상수 60을 그대로 쓰면
 * `COACH_DAILY_CAP`을 60 밑으로 내린 배포에서 대소가 뒤집혀, 비용을 조이려던 운영자가 화면에서
 * 온 요청은 30회에 막고 표식 없는 스크립트 호출에는 60회를 주게 됩니다. 「작은 통이 말라도
 * 정상 사용자의 통은 그대로 돈다」가 그 배포에서만 거짓이 되던 자리입니다. 변주 통도 같은
 * 규율을 그대로 지납니다(`config.varyCap` 자체가 이미 `min(설정값, dailyCap)`입니다).
 */
function takeSlot(
  ip: string | undefined,
  task: CoachTask,
  config: CoachServerConfig,
  tokened: boolean,
  now: number = Date.now(),
): boolean {
  const minute = Math.floor(now / 60_000);
  const day = Math.floor(now / 86_400_000);

  if (globalDay !== day) {
    globalDay = day;
    for (const budget of Object.values(budgets)) {
      budget.tokened = 0;
      budget.anon = 0;
    }
  }

  const vary = task === "vary";
  const budget = vary ? budgets.vary : budgets.main;
  const dailyCap = vary ? config.varyCap : config.dailyCap;

  const anonCap = Math.min(ANON_DAILY_CAP, dailyCap);
  if (tokened ? budget.tokened >= dailyCap : budget.anon >= anonCap) return false;

  const take = (): true => {
    if (tokened) budget.tokened += 1;
    else budget.anon += 1;
    return true;
  };

  if (ip === undefined) return take();

  const bucket = ipBuckets.get(ip);
  if (!bucket || bucket.day !== day) {
    prune(day, minute);
    // 지도가 상한이면 **세지 않고 통과**시킵니다 — 예산 통은 이미 위에서 지났고, 상한에 닿았다는
    // 이유로 정상 훈련을 거절할 이유가 없습니다(사유는 `COACH_RATE_LIMITS.maxIpBuckets`).
    if (ipBuckets.size >= MAX_IP_BUCKETS) return take();
    ipBuckets.set(ip, { minute, minuteCount: 1, day, dayCount: 1 });
    return take();
  }
  if (bucket.dayCount >= PER_IP_PER_DAY) return false;
  if (bucket.minute !== minute) {
    bucket.minute = minute;
    bucket.minuteCount = 0;
  }
  if (bucket.minuteCount >= PER_IP_PER_MINUTE) return false;

  bucket.minuteCount += 1;
  bucket.dayCount += 1;
  return take();
}

/**
 * 점검(`ping`)의 몫 — **IP당 분당 계수만** 겁니다.
 *
 * 예산 두 통과 IP당 **일당** 한도는 그대로 면제입니다. 이 분기는 상류를 부르지 않고 토큰도
 * 요구하지 않으므로 요금이 나가지 않고, 무대 직전 점검(`/check`)이 배포 설정이나 그날의 사용량
 * 때문에 붉어지는 편이 훨씬 나쁩니다.
 *
 * 그래도 계수기 **밖에 두지는 않습니다.** 예전에는 출처와 Content-Type만 통과하면 이 분기가
 * 완전 무제한이었고, 그 사실이 「지금은 몫을 먼저 집으므로 무한도 연산 구간이 사라집니다」라는
 * 아래 주석을 절반만 참으로 만들었습니다. 몸통을 16KB까지 읽고 JSON을 파싱하는 일이 한도 없이
 * 반복될 수 있는 자리이므로, 분당 한 칸만이라도 세어 둡니다.
 *
 * 계수기는 일반 호출과 **같은 바구니**를 씁니다 — ping으로 몫을 따로 늘리는 길을 열지 않습니다.
 * 다만 일당 계수(`dayCount`)는 건드리지 않으므로, 점검을 몇 번 해도 그날 훈련 몫은 줄지 않습니다.
 *
 * **새 항목을 만들기 전에 지도 크기를 봅니다.** 이 분기는 예산 두 통을 지나지 않으므로, 예전에는
 * 예산 검사가 삽입까지 함께 묶어 주던 이중 상한이 여기서만 사라져 있었습니다 — 30바이트 POST에
 * 매번 다른 `x-forwarded-for`를 붙이면 항목이 무한히 쌓이는 자리였습니다. 상한에 닿으면 새 IP는
 * **세지 않고 통과**입니다: ping은 요금을 만들지 않으므로, 무대 직전 점검을 거절하는 편이 더
 * 나쁩니다(사유 전문은 `COACH_RATE_LIMITS.maxIpBuckets`).
 *
 * `ip`가 없으면(프록시 없는 배포) 가를 열쇠가 없어 그대로 통과입니다 — `clientIp()` 주석 참조.
 */
function takePingSlot(ip: string | undefined, now: number = Date.now()): boolean {
  if (ip === undefined) return true;

  const minute = Math.floor(now / 60_000);
  const day = Math.floor(now / 86_400_000);

  const bucket = ipBuckets.get(ip);
  if (!bucket || bucket.day !== day) {
    prune(day, minute);
    if (ipBuckets.size >= MAX_IP_BUCKETS) return true;
    ipBuckets.set(ip, { minute, minuteCount: 1, day, dayCount: 0 });
    return true;
  }
  if (bucket.minute !== minute) {
    bucket.minute = minute;
    bucket.minuteCount = 0;
  }
  if (bucket.minuteCount >= PER_IP_PER_MINUTE) return false;

  bucket.minuteCount += 1;
  return true;
}

/**
 * 호출자를 가르는 열쇠 — 프록시가 붙여 준 헤더뿐이고, 저장하지 않습니다(메모리 계수기만 씁니다).
 *
 * ※ **전제를 적어 둡니다**: 「IP당 한도」는 앞단이 `x-forwarded-for`를 **덮어써 줄 때만** 참입니다.
 *   Vercel·Cloudflare처럼 자기 값으로 덮어쓰는 플랫폼 뒤에서는 첫 원소가 실제 호출자입니다.
 *   반대로 nginx의 `proxy_add_x_forwarded_for`처럼 **이어 붙이는** 앞단이나, 프록시 없이 직접
 *   노출된 자체 호스팅에서는 호출자가 헤더 한 줄을 스스로 적을 수 있어 IP당 한도가 무력해집니다.
 *   그 배포에서 실제로 남는 방어선은 배포 전체 상한과 상류 계정의 지출 상한입니다.
 *
 * 헤더가 아예 없으면(로컬·프록시 없는 배포) `undefined`를 돌려줍니다. 예전에는 그 경우 전원이
 * `"unknown"` 한 바구니를 나눠 써서, 행사장에서 로컬로 띄우면 방 전체가 분당 한도 하나를
 * 공유했습니다 — 정상 사용자를 먼저 막는 계수기였습니다. 지금은 IP당 한도를 적용하지 않고
 * 배포 전체 상한만 겁니다.
 */
function clientIp(request: Request): string | undefined {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || undefined;
}

/* ── 상류 중계 ─────────────────────────────────────────── */

/** 상류에 실어 보낼 한 덩어리 — 프롬프트 두 벌과 이 작업에 맞춘 생성 상한입니다. */
interface RelayPrompt {
  system: string;
  user: string;
  maxTokens: number;
  temperature: number;
}

/**
 * 상류를 한 번 부르고 **원문 텍스트만** 꺼냅니다. 실패·지연·낯선 모양은 전부 `undefined`이고,
 * 그 하나가 화면에서는 「아무 일도 없었음」이 됩니다(검수 코칭·검수 앵커가 이미 떠 있습니다).
 *
 * 프롬프트와 주소 꼴은 `src/lib/onlineCoach.ts`·`src/lib/onlineVary.ts`가 들고 있습니다 —
 * 상류와의 계약은 그 두 파일에만 적어 두고, 이 라우트는 거기에 **키와 한도만** 얹습니다.
 */
async function relay(
  prompt: RelayPrompt,
  config: CoachServerConfig,
  clientSignal?: AbortSignal,
): Promise<string | undefined> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.apiKey.length > 0) headers.Authorization = `Bearer ${config.apiKey}`;

  /*
   * 끊는 조건이 둘입니다 — 6초 상한과 **클라이언트의 연결 해제**.
   *
   * 화면 쪽은 8초에 스스로 포기하지만(`onlineCoach.ts`·`onlineFree.ts`), 그때 상류 호출이
   * 그대로 남아 있으면 사용자가 화면을 떠난 뒤에도 요금은 끝까지 나갑니다. 요청의 signal을
   * 함께 물려 두면 취소가 상류까지 전파됩니다. `AbortSignal.any`가 없는 낡은 런타임에서는
   * 옛 동작(시간 상한만) 그대로 물러납니다.
   */
  const timeout = AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);
  const signal =
    clientSignal && typeof AbortSignal.any === "function"
      ? AbortSignal.any([clientSignal, timeout])
      : timeout;

  try {
    const response = await fetch(chatCompletionsUrl(config.baseUrl), {
      method: "POST",
      headers,
      signal,
      body: JSON.stringify({
        model: config.model,
        temperature: prompt.temperature,
        max_tokens: prompt.maxTokens,
        stream: false,
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
      }),
    });
    if (!response.ok) return undefined;
    const payload: unknown = await response.json();
    return readChatCompletionContent(payload);
  } catch {
    /* 시간 초과·연결 실패. 예외를 찍지 않습니다 — 오류 메시지에 보낸 몸통이 딸려 나옵니다. */
    return undefined;
  }
}

/* ── 핸들러 ────────────────────────────────────────────── */

/**
 * 응답 한 벌 — 어떤 경우에도 캐시하지 않습니다.
 *
 * `extra`는 **단기 토큰 갱신 헤더** 한 칸을 위한 자리입니다(설정된 배포에서만, 아래 `refreshHeader`).
 * 비밀값이 없으면 `undefined`가 들어와 응답이 한 글자도 달라지지 않습니다.
 */
function json(
  body: Record<string, unknown>,
  status = 200,
  extra?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extra },
  });
}

type CoachTask = "coach" | "vary" | "free" | "ping";

/** 이 요청이 청하는 일 — `task`가 없으면 코칭입니다(옛 계약을 그대로 둡니다). */
function readTask(body: unknown): CoachTask | undefined {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return undefined;
  const task = (body as Record<string, unknown>).task;
  if (task === undefined || task === "coach") return "coach";
  if (task === "vary") return "vary";
  if (task === "free") return "free";
  if (task === "ping") return "ping";
  // 모르는 작업 이름은 400입니다 — 조용히 코칭으로 처리하면 계약이 흐려집니다.
  return undefined;
}

/* ── 출처 확인 ─────────────────────────────────────────── */

/**
 * 같은 출처에서 온 요청인지.
 *
 * 무엇을 막는가: `Content-Type: text/plain`(또는 헤더 없는) POST는 CORS 프리플라이트가 붙지
 * 않는 **단순 요청**이라, 아무 웹사이트나 방문자의 브라우저를 시켜 이 주소로 쏠 수 있었습니다.
 * 공격자가 응답을 읽지는 못하지만(CORS 미설정) 그게 요점이 아닙니다 — 요청이 방문자의 IP로
 * 나가므로 IP당 한도를 공격자 비용 없이 태우고, 그 방문자가 실제 사용자라면 훈련 도중에
 * 자기 몫이 사라진 채 `rate_limited`를 만납니다.
 *
 * 어떻게 막는가: 최신 브라우저가 스스로 붙이는 `Sec-Fetch-Site`(위조 불가 헤더)가 있으면 그것을
 * 먼저 보고, 없으면 `Origin`을 이 서버의 출처와 대조합니다. 브라우저가 아닌 호출(curl 등)은
 * `Origin`을 붙이지 않는데, 그 경우 `Sec-Fetch-Site`도 없으므로 여기서 걸립니다.
 *
 * `same-origin` 하나만 받습니다. 예전에는 `none`도 받았는데, 그 값은 주소창 입력·북마크 같은
 * **사용자 개시 내비게이션**에 붙는 값이라 이 라우트의 정상 호출 경로에는 등장하지 않습니다
 * (화면 코드의 fetch는 언제나 `same-origin`입니다). 헤더를 손으로 적는 쪽에 통과 값을 하나 더
 * 주던 자리라 걷어 냈습니다.
 *
 * **이 검사가 실제로 막는 것**: 브라우저가 다른 출처에서 쏘는 교차 출처 호출입니다. 헤더를
 * 위조하는 비브라우저 호출(curl·스크립트)은 이 검사로 막히지 않고, 그 자리는 아래 세 가지가
 * 나눠 맡습니다 — 단기 토큰 표식(`x-chimchak-key`, 설정된 배포에서), 무토큰 요청의 작은 예산 통,
 * 그리고 어느 배포에서든 참인 상류 계정의 지출 상한. 인증이라고 적지 않는 이유가 이 문단입니다.
 */
function isSameOrigin(request: Request): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite) return fetchSite === "same-origin";

  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

/* ── 단기 토큰 표식 ────────────────────────────────────── */

/**
 * 공유 비밀값 — **선택입니다.** 비어 있으면 이 절 전체가 잠들고 라우트는 예전 그대로 돕니다.
 *
 * 파일럿을 세우지 않기 위한 규칙입니다. 값을 넣지 않은 배포에서는 토큰을 심지도(레이아웃),
 * 요구하지도(여기) 않으므로 요청 계약이 한 글자도 바뀌지 않습니다.
 */
function readSharedSecret(): string {
  return (process.env.COACH_SHARED_SECRET ?? "").trim();
}

/** 토큰 대조 결과 — 네 갈래입니다. */
type TokenVerdict =
  /** 유효한 표식이 붙었습니다(또는 비밀값이 없어 표식을 요구하지 않습니다) → 정상 예산 통 */
  | "tokened"
  /** 창은 지났지만 이 배포가 내준 표식이 맞습니다 → 작은 예산 통 + **갱신 표식** */
  | "stale"
  /** 표식이 없습니다 → 작은 예산 통(옛 클라이언트가 그대로 동작합니다) */
  | "anonymous"
  /** 표식이 붙었는데 어느 창과도 맞지 않습니다 → 403 (계수기에 닿기 전입니다) */
  | "invalid";

/**
 * 이 요청에 붙은 표식을 봅니다. **계수기보다 앞**에서 부릅니다.
 *
 * 어느 창과도 맞지 않는 표식만 403입니다. 표식이 아예 없는 요청은 막지 않습니다 — 요청 계약의
 * 하위 호환을 지키기 위해서이고(옛 화면이 그대로 동작합니다), 대신 그 요청은 작은 예산 통으로
 * 갑니다.
 *
 * `stale`이 따로 있는 이유: 갱신 표식을 「표식을 들고 온 요청」에만 내주기로 하면서(아래
 * `refreshHeader`), 창을 넘긴 화면이 **영영 작은 통에 남는** 자리가 생겼습니다.
 * `COACH_TOKEN_STALE_WINDOWS`(2026-08-27 기준 36창 = 6시간) 안의 낡은 표식은 정상 통을 주지 않되
 * 갱신은 받게 해, 탭을 오래 열어 둔 훈련이 되살아납니다(사유 전문은 그 상수 — 그 창을 **넘긴**
 * 화면에는 회복 경로가 없다는 사실도 거기 적혀 있습니다). 표식을 한 번도 가진 적 없는 호출자는
 * 이 갈래에 들어오지 못합니다.
 */
async function checkToken(request: Request, secret: string): Promise<TokenVerdict> {
  if (secret.length === 0) return "tokened";
  const value = request.headers.get(COACH_TOKEN_HEADER)?.trim() ?? "";
  if (value.length === 0) return "anonymous";
  if (await verifyCoachToken(secret, value)) return "tokened";
  return (await isRenewableCoachToken(secret, value)) ? "stale" : "invalid";
}

/**
 * 받아들인 요청에 실어 돌려줄 **다음 표식** 한 칸 (`창번호.토큰` — `<meta>`와 같은 꼴).
 *
 * 이 한 함수가 「문서 수명 = 토큰 수명」을 끊습니다. 표식을 심는 자리가 서버 렌더 하나뿐이면,
 * 앱 안 이동으로만 도는 이 화면에서는 문서가 창 둘(최대 20분)을 넘어서는 순간 정상 트래픽
 * **전체**가 무토큰 통으로 떨어집니다 — 예산을 둘로 나눈 목적이 그대로 뒤집히고, 서비스를 하루
 * 끄는 문턱이 `dailyCap`에서 `anonDailyCap`으로 내려앉습니다. 심는 자리를 「매 호출」로 옮기면
 * 한 판을 두 시간 돌려도 정상 통에 남습니다(사유 전문은 `COACH_TOKEN_REFRESH_HEADER` 주석).
 *
 * 붙이는 자리를 좁혀 둡니다 — 출처·Content-Type·크기·작업 이름을 지나고 **이미 유효한 표식을
 * 들고 온** 요청에만 붙습니다(`tokened`·`stale`). 403(다른 출처·어긋난 표식)과 그 앞의 400에는
 * 붙지 않습니다. `ping`에도 붙이지 않습니다: 토큰을 요구하지 않는 유일한 분기에 토큰을 내주면,
 * 계수기를 거의 지나지 않는 자리가 표식 발급소가 됩니다.
 *
 * **무토큰 요청에도 붙이지 않습니다.** 예전에는 붙였고, 그래서 몸통이 틀린 30바이트 POST 한 번의
 * 400 응답이 표식을 내주었습니다 — 작은 예산 통이 「1회 통행료」가 되어, 스크립트가 작은 통 한
 * 칸만 쓰고 나머지 전량을 큰 통에서 태울 수 있었습니다. 표식을 처음 얻는 길은 다시 「페이지를
 * 받는 것」 하나로 돌아갑니다.
 *
 * 창을 넘긴 화면이 되살아나는 길은 `stale` 갈래가 맡습니다(위 `checkToken`) — 그 표식도 이 배포가
 * 내준 값이라는 증거이므로, 작은 통을 쓰되 갱신은 받습니다.
 *
 * 비밀값이 없으면 `undefined`입니다 — 응답이 예전과 한 글자도 다르지 않습니다.
 */
async function refreshHeader(
  secret: string,
  verdict: TokenVerdict,
): Promise<Record<string, string> | undefined> {
  if (secret.length === 0) return undefined;
  if (verdict !== "tokened" && verdict !== "stale") return undefined;
  return { [COACH_TOKEN_REFRESH_HEADER]: await coachTokenMetaValue(secret) };
}

/** JSON 몸통이라고 선언한 요청만 받습니다 — 이 한 줄이 프리플라이트 없는 경로를 닫습니다. */
function isJsonRequest(request: Request): boolean {
  const type = request.headers.get("content-type");
  if (!type) return false;
  return type.split(";")[0]?.trim().toLowerCase() === "application/json";
}

/**
 * 몸통을 **읽기 전에** 크기를 봅니다.
 *
 * 예전에는 `await request.text()`로 전부 버퍼링한 다음 길이를 쟀습니다. 8MB를 보내면 8MB를
 * 다 읽고 나서 400을 돌려줬다는 뜻이고, 그 지점은 한도 계수기보다도 앞입니다. 플랫폼이 본문
 * 상한을 걸어 주는 배포(Vercel 등)에서는 가려져 있었지만, 자체 호스팅·로컬 시연 서버에는
 * 그 뚜껑이 없습니다.
 *
 * 문자 수 상한을 바이트로 옮길 때는 넉넉히 3배를 둡니다 — 한글은 UTF-8에서 한 자가 3바이트라
 * 정직한 요청이 여기서 걸리면 안 됩니다. `content-length`가 없는 chunked 요청은 이 문에서
 * 걸러지지 않고 아래 문자 수 검사가 받습니다.
 */
const MAX_BODY_BYTES = MAX_ANY_BODY_LENGTH * 3;

function declaredBodyTooLarge(request: Request): boolean {
  const raw = request.headers.get("content-length");
  if (!raw) return false;
  const length = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(length) && length > MAX_BODY_BYTES;
}

/** 이 요청의 프롬프트 두 벌을 짭니다. 기대 형태가 아니면 `undefined`(= 400). */
function promptFor(task: CoachTask, body: unknown): RelayPrompt | undefined {
  // ping은 상류를 부르지 않으므로 프롬프트가 없습니다(핸들러가 이 앞에서 갈라집니다).
  if (task === "ping") return undefined;

  if (task === "free") {
    const freeRequest = readFreeRequest(body);
    if (!freeRequest) return undefined;
    return {
      system: buildFreeSystemPrompt(freeRequest),
      user: buildFreeUserPrompt(freeRequest),
      maxTokens: UPSTREAM_FREE_MAX_TOKENS[freeRequest.stage],
      temperature: FREE_TEMPERATURE[freeRequest.stage],
    };
  }

  if (task === "vary") {
    const varyRequest = readVaryRequest(body);
    if (!varyRequest) return undefined;
    return {
      system: buildVarySystemPrompt(varyRequest),
      user: buildVaryUserPrompt(varyRequest),
      maxTokens: UPSTREAM_VARY_MAX_TOKENS,
      temperature: VARY_TEMPERATURE,
    };
  }

  const coachRequest: OnlineCoachRequest | undefined = readCoachRequest(body);
  if (!coachRequest) return undefined;
  return {
    system: buildSystemPrompt(coachRequest),
    user: buildUserPrompt(coachRequest),
    maxTokens: UPSTREAM_MAX_TOKENS,
    temperature: COACH_TEMPERATURE,
  };
}

/**
 * 코칭 한 문장 · 대사 한 줄 · 자유 연습의 상황·대사·요약을 중계합니다(`task`로 갈립니다).
 *
 * 돌려주는 모양은 다섯입니다. 400·403을 빼면 전부 200인데, 클라이언트에게 그 셋은 모두
 * 「문장이 붙거나 · 조용히 검수 문장으로 돌아가거나」 둘 중 하나라서 오류로 다룰 것이 없기 때문입니다.
 *  · `{ status: "ok", content }`   — 상류 원문. 가드는 **기기 안에서** 이 문장을 검사합니다.
 *  · `{ status: "unconfigured" }`  — 서버에 주소·모델이 없습니다(기본 빌드).
 *  · `{ status: "rate_limited" }`  — 한도를 넘었습니다. 잠시 뒤 다시 청하면 됩니다.
 *  · `{ status: "upstream" }`      — 상류가 늦거나 실패했습니다.
 *  · 400 `{ status: "invalid" }`   — 기대 형태가 아닙니다.
 *  · 403 `{ status: "forbidden" }` — 다른 출처에서 왔거나, JSON 요청이 아니거나, 표식이 어긋납니다.
 *
 * `task: "ping"`만 흐름이 다릅니다 — 설정 여부(`readConfig`)만 보고 곧장 답합니다.
 * 상류를 부르지 않고 예산 통도 쓰지 않으므로 무대 직전 점검이 요금을 만들지 않습니다
 * (IP당 분당 계수 한 칸만 셉니다).
 */
export async function POST(request: Request): Promise<Response> {
  // ① 출처 — 몸통을 읽기 전에 봅니다. 다른 출처의 요청은 여기서 끝납니다.
  if (!isSameOrigin(request) || !isJsonRequest(request)) {
    return json({ status: "forbidden" }, 403);
  }
  // ② 크기 — 선언된 길이가 상한을 넘으면 **읽지 않고** 끊습니다.
  if (declaredBodyTooLarge(request)) return json({ status: "invalid" }, 400);

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return json({ status: "invalid" }, 400);
  }
  if (raw.length === 0 || raw.length > MAX_ANY_BODY_LENGTH) return json({ status: "invalid" }, 400);

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ status: "invalid" }, 400);
  }

  const task = readTask(body);
  if (!task) return json({ status: "invalid" }, 400);
  // 작업별 몸통 상한 — 코칭·변주는 예전과 같은 8,192자에서 끊깁니다.
  if (raw.length > bodyLimitFor(task)) return json({ status: "invalid" }, 400);

  const ip = clientIp(request);

  /*
   * 점검용 분기 — 상류에 닿지 않는 유일한 작업입니다.
   *
   * 표식을 요구하지 않고 예산 통도 쓰지 않습니다. 상류를 부르지 않으므로 요금이 나가지 않고,
   * 무대 직전 점검(/check)이 배포 설정이나 그날의 사용량 때문에 붉어지는 편이 더 나쁩니다.
   * 다만 **IP당 분당 계수 한 칸**은 셉니다 — 계수기 밖의 완전 무제한 분기를 남겨 두지 않기
   * 위해서입니다(사유는 `takePingSlot` 주석).
   */
  if (task === "ping") {
    if (!takePingSlot(ip)) return json({ status: "rate_limited" });
    return json(readConfig() ? { status: "ok" } : { status: "unconfigured" });
  }

  /*
   * ③ 표식 — **계수기보다 앞**입니다. 어긋난 표식은 여기서 끝나고 예산을 한 칸도 쓰지 않습니다.
   */
  const secret = readSharedSecret();
  const verdict = await checkToken(request, secret);
  if (verdict === "invalid") return json({ status: "forbidden" }, 403);

  /*
   * 여기서부터의 응답에는 **다음 창의 표식**을 한 칸 실어 보냅니다(설정된 배포에서, 그리고
   * **이미 표식을 들고 온 요청에만**). 표식을 심는 자리를 「서버 렌더 한 번」에서 「매 호출」로
   * 옮기는 한 줄입니다 — 이것이 없으면 문서를 연 지 20분이 지난 정상 사용자가 통째로 무토큰
   * 통으로 떨어집니다. 한도에 걸린 응답에도 붙입니다 — 표식까지 잃으면 다음 날에도 작은 통에
   * 남습니다. 무토큰 요청에는 붙지 않습니다(사유는 `refreshHeader` 주석).
   */
  const refresh = await refreshHeader(secret, verdict);

  const config = readConfig();
  if (!config) return json({ status: "unconfigured" }, 200, refresh);

  /*
   * ④ 한도 — IP당 계수기는 세 작업이 나눠 쓰고, **배포 전체 예산 통만 변주가 따로 씁니다.**
   *   (비용은 요청 수로 나가지 작업 이름으로 나가지 않지만, 몫이 마를 때 **잃는 것**은 작업마다
   *    다릅니다 — 변주는 앵커 대사로 접히고 자유 연습은 화면이 열리지 않습니다. 사유 전문은
   *    위 `budgets`.)
   *
   * **프롬프트 조립보다 앞**입니다. 예전에는 순서가 반대라, 400으로 끊길 요청이 한도를 한 칸도
   * 쓰지 않은 채 JSON 파싱·정규식·프롬프트 조립 CPU를 무제한으로 태울 수 있었습니다.
   * 지금은 몫을 먼저 집으므로 그 구간이 사라집니다 — 대가는 「형태가 틀린 요청도 몫을 쓴다」이고,
   * 정상 클라이언트는 틀린 몸통을 보내지 않으므로 치를 만한 값입니다.
   *
   * ※ 계수기를 **지나지 않는** 자리를 정확히 적어 둡니다. 셋입니다.
   *   ① 어긋난 표식(위 403) — 요청당 HMAC을 태우고 예산은 쓰지 않습니다. 값이 어긋난 요청에
   *      예산을 물리면 표식을 아무렇게나 적어 보내는 쪽이 정상 사용자의 통을 비울 수 있습니다.
   *      (창 여섯을 다시 계산하는 비용은 창 하나의 값을 기억해 두는 것으로 없앴습니다 —
   *       `coachLimits.ts`의 `windowTokens`.)
   *   ② **주소·모델이 없는 배포의 `unconfigured` 반환**(바로 위) — 그 상태는 오류가 아니라
   *      기본 빌드이고, 반환이 계수기보다 앞입니다. 그 배포에서 이 라우트가 하는 일은 몸통
   *      읽기·JSON 파싱·HMAC이 전부이며 **상류 요금은 0**입니다. 그래서 이 자리에 남깁니다 —
   *      계수기가 지키는 것은 상류 지출이고, 지출이 없는 배포에서는 지킬 것이 CPU뿐입니다.
   *      대가는 정직하게 적어 둡니다: **기본 빌드에서 이 POST 경로는 무계수입니다**
   *      (몸통 16,384자 읽기 + JSON.parse가 한도 없이 반복됩니다 — 상한은 크기 검사 하나뿐).
   *      바꾸실 거면 `if (!config)` 반환을 `takeSlot` 뒤로 옮기시면 되고, 화면은 한 글자도
   *      달라지지 않습니다(`onlineCoach.ts`가 unconfigured와 rate_limited를 모두 조용한 폴백으로
   *      접습니다). 그때는 아래 검사도 함께 고쳐야 합니다(tests/coachRoute.test.ts).
   *      (2026-08-27 사유 교정: 여기 「그 배포에 「한도에 걸린 점검」이라는 상태를 만들지 않기
   *       위해서」라고 적혀 있었는데 **사실이 아니었습니다** — 점검(/check)은 `task: "ping"` 하나만
   *       보내고 그 분기가 위에서 끝나므로 이 줄에 닿지 않습니다. 이 파일의 값어치가 열거의
   *       정확도라면 열거에 딸린 사유의 정확도도 같은 값입니다 — 7차 페르소나 백엔드 med.)
   *   ③ `ping`(위 분기) — 예산 두 통과 IP당 일당은 면제이고 IP당 분당 계수만 셉니다.
   *   이 열거가 틀리면 「하지 않는 일까지 적는다」는 이 파일의 미덕이 그대로 위험이 됩니다.
   */
  if (!takeSlot(ip, task, config, verdict === "tokened")) {
    return json({ status: "rate_limited" }, 200, refresh);
  }

  const prompt = promptFor(task, body);
  if (!prompt) return json({ status: "invalid" }, 400, refresh);

  const content = await relay(prompt, config, request.signal);
  if (content === undefined) return json({ status: "upstream" }, 200, refresh);
  return json({ status: "ok", content }, 200, refresh);
}
