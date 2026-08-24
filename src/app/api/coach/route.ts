/**
 * 온라인 코칭 중계 — **키가 사는 유일한 자리**입니다.
 *
 * 브라우저는 이제 상류 제공사를 직접 부르지 않습니다. 같은 도메인의 `/api/coach` 한 곳만
 * 부르고, 주소·모델 이름·키는 **서버 환경변수**에만 있습니다(`NEXT_PUBLIC_` 접두어가 없으므로
 * 어떤 값도 브라우저 번들에 실리지 않습니다). 그래서 온라인 코칭을 켜도 CSP의
 * `connect-src 'self'` 한 줄이 그대로 참입니다 — 이 전환이 사려는 것이 정확히 그 한 줄입니다.
 *
 * 이 파일이 하는 일은 셋뿐입니다.
 *  ① **검증** — 클라이언트가 보내는 `buildCoachRequest` 산출물 모양만 받습니다. 그 밖의 값은
 *    버리고 400으로 끊습니다(상류로 흘려보내지 않습니다). 발화는 500자가 상한입니다.
 *  ② **한도** — IP당 분당·일당, 그리고 배포 전체 일당 상한을 셉니다(비용 가드).
 *  ③ **중계** — 키를 붙여 상류를 한 번 부르고, **원문 텍스트만** 그대로 돌려줍니다.
 *
 * 하지 않는 일이 더 중요합니다.
 *  · **가드 체인을 여기서 돌리지 않습니다.** 형식·근거·표현·길이 네 단은 지금처럼 기기 안에서
 *    돕니다(`src/lib/onlineCoach.ts`). 「받아 온 문장은 기기 안 가드를 지나야 화면에 닿는다」는
 *    서사가 서버를 하나 세웠다고 서버로 옮겨 가면 안 됩니다.
 *  · **발화와 응답을 로그에 남기지 않습니다.** 아래 어디에도 `console.*`이 없고, 예외 객체조차
 *    찍지 않습니다 — 상류 오류 메시지에 보낸 몸통이 딸려 오는 일이 흔하기 때문입니다.
 *    남길 수 있는 것은 「몇 번 불렀는가」뿐이고, 그것도 메모리 안에서만 셉니다.
 *
 * 서비스워커는 이 주소를 건드리지 않습니다 — `public/sw.js`의 fetch 핸들러가 GET이 아닌 요청을
 * 첫 줄에서 그대로 통과시킵니다(개인정보가 담길 수 있는 POST는 저장하지 않는다는 규칙).
 */

import {
  buildSystemPrompt,
  buildUserPrompt,
  chatCompletionsUrl,
  readChatCompletionContent,
  type CoachDocRef,
  type OnlineCoachRequest,
} from "@/lib/onlineCoach";

/* ── 상한 ──────────────────────────────────────────────── */

/** 몸통 전체 상한(바이트 대신 문자 수로 셉니다 — 파싱 전에 끊으려는 값입니다) */
const MAX_BODY_LENGTH = 8_192;

/** 발화 길이 상한(자). 훈련 한 턴의 말은 이 안에서 끝납니다. */
const MAX_UTTERANCE_LENGTH = 500;
const MAX_SUMMARY_LENGTH = 400;
const MAX_CUE_PROMPT_LENGTH = 400;
const MAX_INDICATORS = 12;
const MAX_INDICATOR_LENGTH = 200;
const MAX_DOCS = 16;
const MAX_DOC_ID_LENGTH = 48;
const MAX_DOC_TITLE_LENGTH = 160;

/** 상류를 기다리는 상한(ms). 넘으면 조용히 폴백입니다 — 훈련을 붙잡아 두지 않습니다. */
const UPSTREAM_TIMEOUT_MS = 6_000;

/** 상류에 거는 생성 상한. 코칭은 1~2문장이라 이 이상 받아 봐야 가드가 버립니다. */
const UPSTREAM_MAX_TOKENS = 400;

/** 호출 한도 — IP 하나 기준 */
const PER_IP_PER_MINUTE = 6;
const PER_IP_PER_DAY = 60;

/** 배포 전체 하루 상한 기본값 (`COACH_DAILY_CAP`으로 조정) */
const DEFAULT_DAILY_CAP = 600;

/* ── 서버 설정 ─────────────────────────────────────────── */

interface CoachServerConfig {
  baseUrl: string;
  model: string;
  /** 비어 있을 수 있습니다 — 키 없이 도는 사내·로컬 게이트웨이를 막지 않으려는 자리입니다. */
  apiKey: string;
  dailyCap: number;
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

  const capRaw = Number.parseInt((process.env.COACH_DAILY_CAP ?? "").trim(), 10);
  const dailyCap =
    Number.isFinite(capRaw) && capRaw > 0 ? Math.min(capRaw, 100_000) : DEFAULT_DAILY_CAP;

  return { baseUrl, model, apiKey: (process.env.COACH_API_KEY ?? "").trim(), dailyCap };
}

/* ── 요청 검증 ─────────────────────────────────────────── */

/** 문자열 칸 하나 — 비었거나 상한을 넘으면 `undefined`(= 요청 전체를 400으로 끊습니다). */
function readField(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 || trimmed.length > max ? undefined : trimmed;
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

/** 인용 가능 문서 목록 — id+제목 두 칸만 받습니다. 다른 칸은 조용히 버립니다. */
function readDocs(value: unknown): CoachDocRef[] | undefined {
  if (!Array.isArray(value) || value.length > MAX_DOCS) return undefined;
  const out: CoachDocRef[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) return undefined;
    const record = item as Record<string, unknown>;
    const id = readField(record.id, MAX_DOC_ID_LENGTH);
    const title = readField(record.title, MAX_DOC_TITLE_LENGTH);
    if (id === undefined || title === undefined) return undefined;
    out.push({ id, title });
  }
  return out;
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
  const docs = readDocs(record.docs);
  if (!indicators || !docs) return undefined;

  return { scenarioSummary, cuePrompt, utterance, indicators, docs };
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
 * ※ IP 하나를 여럿이 나눠 쓰는 자리(행사장 공용 와이파이·기관 NAT)에서는 분당 6회가 방 전체의
 *   몫입니다. 시연 인원이 늘면 `PER_IP_PER_MINUTE`가 아니라 배포 전체 상한을 먼저 보십시오.
 */
interface IpBucket {
  minute: number;
  minuteCount: number;
  day: number;
  dayCount: number;
}

const ipBuckets = new Map<string, IpBucket>();
let globalDay = -1;
let globalCount = 0;

/** 지도가 무한정 자라지 않게 — 하루가 지난 자리는 버립니다. */
function prune(day: number): void {
  if (ipBuckets.size < 4_096) return;
  for (const [ip, bucket] of ipBuckets) {
    if (bucket.day !== day) ipBuckets.delete(ip);
  }
}

/**
 * 이 요청의 몫을 한 칸 집습니다. 남은 몫이 없으면 `false`입니다.
 * 상류를 부르기 **전에** 셉니다 — 실패한 호출도 비용과 부하를 만들기 때문입니다.
 */
function takeSlot(ip: string, dailyCap: number, now: number = Date.now()): boolean {
  const minute = Math.floor(now / 60_000);
  const day = Math.floor(now / 86_400_000);

  if (globalDay !== day) {
    globalDay = day;
    globalCount = 0;
  }
  if (globalCount >= dailyCap) return false;

  const bucket = ipBuckets.get(ip);
  if (!bucket || bucket.day !== day) {
    prune(day);
    ipBuckets.set(ip, { minute, minuteCount: 1, day, dayCount: 1 });
    globalCount += 1;
    return true;
  }
  if (bucket.dayCount >= PER_IP_PER_DAY) return false;
  if (bucket.minute !== minute) {
    bucket.minute = minute;
    bucket.minuteCount = 0;
  }
  if (bucket.minuteCount >= PER_IP_PER_MINUTE) return false;

  bucket.minuteCount += 1;
  bucket.dayCount += 1;
  globalCount += 1;
  return true;
}

/** 호출자를 가르는 열쇠 — 프록시가 붙여 준 헤더뿐이고, 저장하지 않습니다(메모리 계수기만 씁니다). */
function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/* ── 상류 중계 ─────────────────────────────────────────── */

/**
 * 상류를 한 번 부르고 **원문 텍스트만** 꺼냅니다. 실패·지연·낯선 모양은 전부 `undefined`이고,
 * 그 하나가 화면에서는 「아무 일도 없었음」이 됩니다(결정론 코칭이 이미 떠 있습니다).
 *
 * 프롬프트와 주소 꼴은 `src/lib/onlineCoach.ts`가 들고 있습니다 — 상류와의 계약은 한 파일에만
 * 적어 두고, 이 라우트는 거기에 **키와 한도만** 얹습니다.
 */
async function relay(
  coachRequest: OnlineCoachRequest,
  config: CoachServerConfig,
): Promise<string | undefined> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.apiKey.length > 0) headers.Authorization = `Bearer ${config.apiKey}`;

  try {
    const response = await fetch(chatCompletionsUrl(config.baseUrl), {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      body: JSON.stringify({
        model: config.model,
        temperature: 0.2,
        max_tokens: UPSTREAM_MAX_TOKENS,
        stream: false,
        messages: [
          { role: "system", content: buildSystemPrompt(coachRequest) },
          { role: "user", content: buildUserPrompt(coachRequest) },
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

/** 응답 한 벌 — 어떤 경우에도 캐시하지 않습니다. */
function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/**
 * 온라인 코칭 한 문장을 중계합니다.
 *
 * 돌려주는 모양은 넷입니다. 400 하나를 빼면 전부 200인데, 클라이언트에게 이 넷은 모두
 * 「코칭이 붙거나 · 조용히 결정론으로 돌아가거나」 둘 중 하나라서 오류로 다룰 것이 없기 때문입니다.
 *  · `{ status: "ok", content }`   — 상류 원문. 가드는 **기기 안에서** 이 문장을 검사합니다.
 *  · `{ status: "unconfigured" }`  — 서버에 주소·모델이 없습니다(기본 빌드).
 *  · `{ status: "rate_limited" }`  — 한도를 넘었습니다. 잠시 뒤 다시 청하면 됩니다.
 *  · `{ status: "upstream" }`      — 상류가 늦거나 실패했습니다.
 *  · 400 `{ status: "invalid" }`   — 기대 형태가 아닙니다.
 */
export async function POST(request: Request): Promise<Response> {
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return json({ status: "invalid" }, 400);
  }
  if (raw.length === 0 || raw.length > MAX_BODY_LENGTH) return json({ status: "invalid" }, 400);

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ status: "invalid" }, 400);
  }

  const coachRequest = readCoachRequest(body);
  if (!coachRequest) return json({ status: "invalid" }, 400);

  const config = readConfig();
  if (!config) return json({ status: "unconfigured" });

  if (!takeSlot(clientIp(request), config.dailyCap)) return json({ status: "rate_limited" });

  const content = await relay(coachRequest, config);
  if (content === undefined) return json({ status: "upstream" });
  return json({ status: "ok", content });
}
