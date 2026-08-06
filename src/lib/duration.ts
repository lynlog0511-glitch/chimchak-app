/**
 * 시간 표기 한 곳 — 「총 이수 시수」·「기록 1건 소요」처럼 **기관과 심사위원이 결재 근거로 읽는 숫자**를
 * 만드는 포맷터를 여기 모은다.
 *
 * 왜 한 곳이어야 하는가: 같은 값을 확인서(`/history/certificate`)와 기관 안내(`/for-orgs`)가 각자
 * 그리고 있었고, 두 화면은 같은 자료철에 함께 들어간다. 반올림 규칙이나 「약」 표기를 한쪽에서만
 * 고치면 같은 기기에서 뽑은 두 장이 다른 숫자를 말하게 되는데, 그 어긋남은 곧바로 신뢰 문제가 된다.
 *
 * 규칙 두 가지
 * - **반올림한 값에는 「약」을 뗀 표기를 만들지 않는다.** 계측값이 아니라는 사실을 표기가 스스로 밝힌다.
 * - 여기 있는 함수는 **표기만** 한다. 무엇을 셀지(회차당 30분 상한 등)는 `lib/storage`가 정한다.
 *
 * 경계값은 tests/duration.test.ts가 표로 못 박아 두었다 — 0초·59초·60초·3599초·3600초.
 */

/**
 * 총 이수 시수 표기 — 「약 N시간 N분」.
 *
 * 증빙 서식은 언제나 시간 단위로 묻는데 「N회」는 그 칸에 옮겨 적을 수 없다.
 * 분으로 반올림한 뒤 시·분으로 나누므로 「약」을 떼지 않는다. 0초 이하는 호출부에서 먼저 걸러 쓴다.
 *
 * @example formatTotalDuration(4530) // "약 1시간 16분"
 * @example formatTotalDuration(720)  // "약 12분"
 * @example formatTotalDuration(30)   // "약 1분 미만"
 */
export function formatTotalDuration(totalSec: number): string {
  const minutes = Math.round(totalSec / 60);
  if (minutes < 1) return "약 1분 미만";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `약 ${hours}시간 ${rest}분` : `약 ${rest}분`;
}

/**
 * 초 단위 소요시간을 「N분 N초」로 — 1분 미만이면 「N초」만.
 *
 * 이쪽은 실제로 잰 값이라 「약」을 붙이지 않는다(기록 작성에 걸린 시간).
 *
 * @example formatElapsedDuration(102) // "1분 42초"
 * @example formatElapsedDuration(42)  // "42초"
 */
export function formatElapsedDuration(totalSec: number): string {
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return minutes > 0 ? `${minutes}분 ${seconds}초` : `${seconds}초`;
}

/** 소요시간을 화면에 보여도 되는 정상 범위인지 — 0초 이하·60분 초과는 측정 오류로 보고 숨긴다. */
export const MAX_DISPLAYABLE_ELAPSED_SEC = 60 * 60;

/**
 * 표시할 만한 소요시간인지.
 *
 * @example isDisplayableElapsed(102) // true
 * @example isDisplayableElapsed(0)   // false
 */
export function isDisplayableElapsed(sec: number | undefined): sec is number {
  return typeof sec === "number" && sec > 0 && sec <= MAX_DISPLAYABLE_ELAPSED_SEC;
}

/**
 * 두 시각 사이를 사람이 읽는 어림 문구로 — 「약 4분 12초」.
 *
 * 기록에는 초 단위까지 남지만 화면에는 「약」을 붙여 계측값이 아님을 밝힌다.
 * 1초 미만도 「약 1초」로 적는다 — 0초는 아무 일도 없었다는 뜻으로 읽히기 때문이다.
 * 시각을 읽지 못하면 빈 문자열을 돌려준다(없는 값을 지어내지 않는다).
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

/**
 * 기관 규모 계산의 시수 표기 — 「약 N시간」.
 *
 * 결재 서식이 묻는 단위가 시간이라 시간으로만 낸다(분 단위는 산식 줄에 따로 남는다).
 * 천 단위 구분은 한국어 표기를 따른다.
 *
 * @example formatApproxHours(90)    // "약 2시간"
 * @example formatApproxHours(72000) // "약 1,200시간"
 */
export function formatApproxHours(minutes: number): string {
  const hours = minutes / 60;
  if (hours < 1) return "약 1시간 미만";
  return `약 ${Math.round(hours).toLocaleString("ko-KR")}시간`;
}

/**
 * 1건당 소요 표기 — 소수 첫째 자리까지만.
 * 중앙값을 옮겨 적는 자리라 「약」을 떼지 않는다.
 *
 * @example formatApproxMinutes(4.25) // "약 4.3분"
 */
export function formatApproxMinutes(minutes: number): string {
  return `약 ${Math.round(minutes * 10) / 10}분`;
}
