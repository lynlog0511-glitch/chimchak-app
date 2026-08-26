/**
 * 온라인 중계의 호출 한도 — **이 파일이 유일한 출처**입니다.
 *
 * 예전에는 같은 수가 `.env.example` 문장에도 적혀 있었고, 값을 올릴 때 한쪽만 고쳐져
 * 문서(분당 6·하루 60)와 코드(15·90)가 갈라졌습니다. 보안 통제 수치의 문서 드리프트는 사고가
 * 났을 때 「문서에는 6이라고 돼 있었는데요」로 돌아옵니다. 그래서 이제 문서는 숫자를 적지 않고
 * 이 상수를 가리키기만 하고, 라우트(`src/app/api/coach/route.ts`)도 여기서만 읽습니다.
 * (라우트 파일은 핸들러 외의 값을 export할 수 없어, 상수의 집은 이 자리입니다.)
 *
 * 한 판이 쓰는 몫 — 자유 연습 기준
 *  · 장면 만들기 1 + 대화 12 + 마무리 요약 1 = **14회**
 *  · 여기에 **safety 재시도**가 얹힙니다. setup·reply는 위험 신호 가드에 걸리면 한 번 더 청하고,
 *    그 재시도도 슬롯을 한 칸 먹습니다(`src/lib/onlineFree.ts`). 재시도 횟수는 상류 답에 달려
 *    있어 고정값이 아니고, 한 판이 실제로 먹는 폭은 14~20회 언저리입니다.
 *  · 그래서 분당 한도를 20으로 둡니다 — 재시도가 겹친 한 판도 대화 도중에 끊기지 않으면서
 *    폭주는 여전히 막습니다. 옛 값 15는 재시도 몫이 빠진 계산이었습니다.
 *
 * ※ 이 수가 **실제로 무엇을 막는지는 배포 형태에 달려 있습니다.** IP를 가르는 열쇠는 프록시가
 *   붙여 준 헤더뿐이라(`clientIp()`), 헤더를 덮어써 주는 플랫폼 뒤에서만 「IP당」이 참입니다.
 *   어느 배포에서든 참인 방어선은 상류 계정 자체에 걸어 둔 지출 상한입니다.
 */
export const COACH_RATE_LIMITS = {
  /** IP 하나가 1분에 쓸 수 있는 호출 수 */
  perIpPerMinute: 20,
  /** IP 하나가 하루에 쓸 수 있는 호출 수 */
  perIpPerDay: 90,
  /** 배포 전체 하루 상한 기본값 (`COACH_DAILY_CAP`으로 조정) */
  defaultDailyCap: 600,
  /**
   * **토큰 없는 요청**만의 배포 전체 하루 상한 — 통을 하나 더 두는 이유가 이 줄이다.
   *
   * 예전에는 통이 하나뿐이라, 상한(기본 600)이 곧 **서비스 전체를 하루 끄는 스위치**였다.
   * 배포 주소를 아는 스크립트가 600번만 쏘면 그날 정상 사용자 전원이 `rate_limited`를 만났다.
   * 비용 가드로 만든 숫자가 가용성 공격의 지렛대가 되던 자리다.
   *
   * 그래서 `COACH_SHARED_SECRET`이 설정된 배포에서는 예산을 둘로 나눈다. 화면이 서버 렌더 때
   * 받은 단기 토큰을 붙여 오는 요청은 위 `defaultDailyCap` 통을 쓰고, 토큰 없는 요청은 이 작은
   * 통을 쓴다. 작은 통이 말라도 **정상 사용자의 통은 그대로 돈다.**
   *
   * 값이 작은 이유: 토큰 없는 정상 호출은 옛 클라이언트가 남아 있는 동안의 과도기 몫뿐이다
   * (계약 하위 호환 — 요청 자체는 400도 403도 되지 않는다). 시연 한 판이 14~20회이므로 60은
   * 「과도기 클라이언트 두어 판」에 해당한다.
   *
   * ※ 비밀값이 설정되지 않은 배포에서는 이 값을 쓰지 않는다 — 통은 하나이고 동작은 예전 그대로다.
   */
  anonDailyCap: 60,
} as const;

/* ── 공유 비밀 토큰 ─────────────────────────────────────── */

/**
 * `/api/coach`에 얹는 **단기 토큰** — 인증이 아니라 「이 앱의 화면에서 왔다」는 표식이다.
 *
 * 무엇을 푸는가: 출처 검사(`Sec-Fetch-Site`·`Origin`)는 **브라우저가 지키는 경계**라, 헤더를
 * 손으로 적을 수 있는 도구 앞에서는 그대로 통과한다(실측으로 확인된 사실이다). 그 결과 남는
 * 유일한 벽이 배포 전체 상한이었고, 그 벽은 곧 서비스를 끄는 스위치였다.
 *
 * 어떻게 푸는가: 서버가 페이지를 그릴 때 `HMAC-SHA256(현재 창 번호, 비밀값)`의 앞 16자를
 * `<meta>`로 심고, 화면의 fetch 세 자리가 그 값을 `x-chimchak-key` 헤더로 되돌려 보낸다.
 * 서버는 **현재 창과 직전 창** 두 개만 다시 계산해 대조한다. 값이 어긋나면 계수기에 닿기
 * 전에 403이고, 값이 없으면 작은 예산 통으로 보낸다(옛 클라이언트가 그대로 동작한다).
 *
 * 무엇을 풀지 못하는가: 페이지를 한 번 받아 토큰을 긁어 가는 스크립트는 여전히 막지 못한다.
 * 창이 지나면 그 토큰이 죽는다는 것이 이 장치가 파는 전부이고, 그래서 이름을 「비밀 헤더」로
 * 두지 않고 **표식**이라고 적어 둔다. 어느 배포에서든 참인 방어선은 상류 계정의 지출 상한이다.
 *
 * 비밀값이 없으면 이 장치는 **통째로 잠든다** — 파일럿을 세우지 않기 위한 규칙이다.
 */
export const COACH_TOKEN_HEADER = "x-chimchak-key";

/** 서버 렌더가 토큰을 심는 `<meta name>` — 화면과 서버가 같은 문자열을 본다. */
export const COACH_TOKEN_META = "chimchak-k";

/** 토큰 한 창의 길이(ms). 창이 바뀌면 값도 바뀌고, 직전 창까지만 받는다(유효 10~20분). */
export const COACH_TOKEN_WINDOW_MS = 10 * 60_000;

/** 토큰 길이(16진 문자 수) — HMAC 앞부분만 쓴다. 헤더 한 칸에 담기는 크기로 족하다. */
export const COACH_TOKEN_LENGTH = 16;

/** 지금이 몇 번째 창인가. */
export function coachTokenWindow(now: number = Date.now()): number {
  return Math.floor(now / COACH_TOKEN_WINDOW_MS);
}

function toHex(buffer: ArrayBuffer): string {
  let out = "";
  for (const byte of new Uint8Array(buffer)) out += byte.toString(16).padStart(2, "0");
  return out;
}

/**
 * 창 하나의 토큰 — `HMAC-SHA256(창 번호, 비밀값)`의 앞 16자.
 *
 * Web Crypto만 씁니다(node:crypto를 import하지 않습니다) — 서버 렌더와 라우트가 같은 함수를
 * 쓰고, 회귀 검사도 같은 함수를 그대로 태웁니다.
 */
export async function coachToken(secret: string, window: number): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(String(window)));
  return toHex(signature).slice(0, COACH_TOKEN_LENGTH);
}

/**
 * `<meta>`에 심는 값 — `창번호.토큰`.
 *
 * 창 번호를 함께 적는 이유는 화면 쪽이 **낡은 토큰을 스스로 걷어 내기 위해서**다. 앱 안 이동은
 * 서버 렌더를 다시 타지 않으므로, 한 판을 길게 훈련하면 심어 둔 토큰이 창을 넘어선다. 그때
 * 화면이 낡은 값을 그대로 보내면 403을 받고 조용히 검수 코칭으로 접힌다 — 창 번호가 있으면
 * 그 전에 헤더를 빼고 보내 작은 예산 통으로 넘어간다(훈련이 끊기지 않는다).
 * 창 번호는 비밀이 아니다(그냥 시각이다).
 */
export async function coachTokenMetaValue(
  secret: string,
  now: number = Date.now(),
): Promise<string> {
  const window = coachTokenWindow(now);
  return `${window}.${await coachToken(secret, window)}`;
}

/** 길이가 같은 두 문자열을 **끝까지** 비교한다(빨리 빠져나가지 않는다). */
function sameToken(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * 받은 토큰이 **현재 창이나 직전 창**의 값인지.
 *
 * @example
 * const token = await coachToken(secret, coachTokenWindow());
 * await verifyCoachToken(secret, token); // true
 */
export async function verifyCoachToken(
  secret: string,
  value: string,
  now: number = Date.now(),
): Promise<boolean> {
  if (secret.length === 0 || value.length !== COACH_TOKEN_LENGTH) return false;
  const window = coachTokenWindow(now);
  for (const candidate of [window, window - 1]) {
    if (sameToken(value, await coachToken(secret, candidate))) return true;
  }
  return false;
}
