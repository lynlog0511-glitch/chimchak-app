/**
 * 성장 기록 화면에서 쓰는 표시 헬퍼.
 *
 * - 날짜: 브라우저 로케일에 따라 흔들리지 않도록 직접 조립합니다(클라이언트에서만 렌더링).
 * - 판정 배지: 점수·등급·순위·백분위는 어떤 형태로도 만들지 않습니다. 엔딩 판정 문구만 그대로 씁니다.
 */

import type { StatusMarkKind } from "@/components/icons";
import type { EndingDef, ScenarioType } from "@/types";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * ISO 시각을 한국어 표기로 바꿉니다.
 *
 * @example formatDateTime("2026-08-04T16:40:00.000Z") // "2026년 8월 5일 (수) 오전 1시 40분"
 */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "시각 정보 없음";
  const weekday = WEEKDAYS[date.getDay()] ?? "";
  const hours24 = date.getHours();
  const meridiem = hours24 < 12 ? "오전" : "오후";
  const hours = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${weekday}) ${meridiem} ${hours}시 ${minutes}분`;
}

/** 짧은 날짜 표기 (목록 보조용) */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "시각 정보 없음";
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

/**
 * 아주 짧은 날짜 표기 — 시안 5c 최근 훈련 행의 「8월 5일 · 치매 행동」에 씁니다.
 * 해가 바뀐 기록은 연도를 붙여 「2025년 12월 3일」로 둡니다(같은 해면 생략).
 *
 * @example formatShortDate("2026-08-05T07:40:00.000Z") // "8월 5일"
 */
export function formatShortDate(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "시각 정보 없음";
  const head = date.getFullYear() === now.getFullYear() ? "" : `${date.getFullYear()}년 `;
  return `${head}${date.getMonth() + 1}월 ${date.getDate()}일`;
}

/**
 * 아주 좁은 칸(유형별 4칸)에 들어가는 최소 날짜 표기 — 「8.5」.
 * 해가 바뀐 기록은 앞에 두 자리 연도를 붙여 「25.12.3」으로 둡니다(같은 해면 생략).
 * 읽어야 하는 문장이 아니라 칸 안 메타라서 이렇게까지 줄입니다 —
 * 화면 낭독용 전체 표기는 `formatShortDate`를 함께 씁니다.
 *
 * @example formatTinyDate("2026-08-05T07:40:00.000Z") // "8.5"
 */
export function formatTinyDate(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const md = `${date.getMonth() + 1}.${date.getDate()}`;
  if (date.getFullYear() === now.getFullYear()) return md;
  return `${String(date.getFullYear()).slice(2)}.${md}`;
}

/* 2026-08-25: `verdictTone()`을 지웠습니다 — 공용 `Badge`에 넘기려고 만든 함수인데
   Badge가 렌더 0건이라 파일째 폐기됐고, 이 함수 자체도 호출처가 0건이었습니다.
   판정 표기는 아래 `verdictMark()`(StatusMark + 판정어 텍스트)가 담당합니다. */

/**
 * 엔딩 판정별 표준 마크(v3 §4).
 * 판정을 필(배지)로 두르지 않고 StatusMark + 판정어 텍스트로 나란히 씁니다.
 * 점수·등급은 어떤 경우에도 만들지 않으며, 마크는 2단계 의미 체계를 그대로 따릅니다.
 *
 * @example verdictMark("충족") // "met"
 */
export function verdictMark(verdict: EndingDef["verdict"]): StatusMarkKind {
  switch (verdict) {
    case "충족":
      return "met";
    case "부분 충족":
    case "재시도":
    case "재훈련 권고":
      return "coach";
    default:
      // 안전 직결 판정선 — 즉시 중단과 같은 마크를 씁니다.
      return "stop";
  }
}

/** 판정 옆에 붙는 한 줄 안내 */
export function verdictNote(verdict: EndingDef["verdict"]): string {
  switch (verdict) {
    case "충족":
      return "핵심 대응을 지키며 끝까지 진행하셨습니다.";
    case "부분 충족":
      return "흐름은 지키셨고, 아래 코칭 한두 가지만 다음에 살려 보세요.";
    case "재시도":
      return "같은 상황을 한 번 더 연습해 보시면 말이 훨씬 빨리 나옵니다.";
    case "재훈련 권고":
      return "안전 위험이 아니라 존엄·관계에 대한 부분입니다. 벌점 없이 같은 장면을 다시 연습해 보세요.";
    default:
      return "안전과 직결된 구간이라 같은 유형을 다시 훈련하시길 권합니다. 이 표시는 벌점이 아니라 다시 볼 지점 안내입니다.";
  }
}

/** 4유형 표시 라벨 */
export const TYPE_LABELS: Record<ScenarioType, string> = {
  BPSD: "치매 행동심리증상",
  EMERGENCY: "응급 초기 대응",
  CONFLICT: "이용자·보호자 갈등",
  RISK: "위험 판단",
};

/**
 * 4유형 짧은 라벨 — 시안 5c의 카피입니다(유형별 4칸 · 최근 훈련 행 · 추천 문장).
 * 좁은 칸에서 두 줄로 접히지 않게 네 글자로 맞춘 표기이며, 뜻은 위 `TYPE_LABELS`와 같습니다.
 */
export const TYPE_SHORT_LABELS: Record<ScenarioType, string> = {
  BPSD: "치매 행동",
  EMERGENCY: "응급 판단",
  CONFLICT: "갈등 대응",
  RISK: "위험 판단",
};

/** 가명처리 토큰만 뽑아내는 정규식 (하이라이트용) */
export const MASK_TOKEN_SPLIT = /(\[(?:대상자|번호|기관|주소|생년)\])/g;

/** 가명처리 토큰인지 */
export function isMaskToken(text: string): boolean {
  return /^\[(?:대상자|번호|기관|주소|생년)\]$/.test(text);
}

/**
 * 초 단위 소요시간을 "N분 N초"로 표시합니다(1분 미만이면 "N초"만).
 *
 * @example formatElapsedDuration(102) // "1분 42초"
 */
export function formatElapsedDuration(totalSec: number): string {
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return minutes > 0 ? `${minutes}분 ${seconds}초` : `${seconds}초`;
}

/**
 * 화면에 표시할 만한 정상 범위인지 (0초 이하·60분 초과는 측정 오류로 보고 숨긴다).
 *
 * @example isDisplayableElapsed(102) // true
 * @example isDisplayableElapsed(0) // false
 */
export function isDisplayableElapsed(sec: number | undefined): sec is number {
  return typeof sec === "number" && sec > 0 && sec <= 3600;
}
