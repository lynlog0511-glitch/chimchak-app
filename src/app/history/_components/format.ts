/**
 * 성장 기록 화면에서 쓰는 표시 헬퍼.
 *
 * - 날짜: 브라우저 로케일에 따라 흔들리지 않도록 직접 조립합니다(클라이언트에서만 렌더링).
 * - 판정 배지: 점수·등급·순위·백분위는 어떤 형태로도 만들지 않습니다. 엔딩 판정 문구만 그대로 씁니다.
 */

import type { BadgeTone } from "@/components";
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

/** 엔딩 판정별 배지 톤 — 색만 다르고 점수는 붙지 않습니다. */
export function verdictTone(verdict: EndingDef["verdict"]): BadgeTone {
  switch (verdict) {
    case "충족":
      return "ok";
    case "부분 충족":
      return "brand";
    case "재시도":
      return "warn";
    case "재훈련 권고":
      // ⚑CF와 구분되는 별도 판정선입니다 (설계서 §3.3 — 안전 위험이 아니라 존엄·관계).
      return "warn";
    default:
      return "danger";
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
      return "안전과 직결된 구간이라 같은 유형을 다시 훈련하시길 권합니다.";
  }
}

/** 4유형 표시 라벨 */
export const TYPE_LABELS: Record<ScenarioType, string> = {
  BPSD: "치매 행동심리증상",
  EMERGENCY: "응급 초기 대응",
  CONFLICT: "이용자·보호자 갈등",
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
