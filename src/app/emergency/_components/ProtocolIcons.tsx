import type { ComponentType } from "react";
import { IconBase, type IconProps } from "@/components/icons";

/**
 * 응급 프로토콜 5종 전용 스트로크 아이콘.
 *
 * `@/components/icons`와 같은 스펙을 그대로 따릅니다(24×24 viewBox · stroke=currentColor ·
 * strokeWidth 1.75 · round cap/join · fill none). 다만 이 아이콘들은 프로토콜 목록·상세
 * 화면에서만 쓰이는 도상이라 공용 아이콘 배럴(src/components/icons)에는 넣지 않고
 * 이 라우트 전용 폴더에 둡니다.
 *
 * 얼굴(눈·코·입)은 그리지 않습니다 — 사람 형상은 IconUser와 같은 원(머리)+선(몸) 뿐입니다.
 * 아이콘은 항상 프로토콜 제목 텍스트와 함께 쓰입니다(아이콘 단독 금지).
 */

/** P-01 낙상 — 넘어진 자세 + 바닥선 */
export function IconProtocolFall({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <circle cx="7.4" cy="6.2" r="2.2" />
      <path d="M8.8 7.9 14 13.6" />
      <path d="M14 13.6 18.6 11.6" />
      <path d="M14 13.6 16.8 18" />
      <path d="M8.8 7.9 5.4 10.8" />
      <path d="M3 19.6h18" />
    </IconBase>
  );
}

/** P-02 기도폐쇄(질식) — 목을 감싸 쥔 손 (만국 공통 질식 신호) */
export function IconProtocolAirway({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <circle cx="12" cy="6.6" r="3" />
      <path d="M5.8 20.4c0-3.7 2.9-5.9 6.2-5.9s6.2 2.2 6.2 5.9" />
      <path d="M8.6 11c-1 .6-1.5 1.7-1.1 2.8.3.9 1.2 1.4 2.1 1.3" />
      <path d="M15.4 11c1 .6 1.5 1.7 1.1 2.8-.3.9-1.2 1.4-2.1 1.3" />
    </IconBase>
  );
}

/** P-03 의식 저하 · 무반응 — 물음표(불러도 반응 없음) + 누운 자세 */
export function IconProtocolUnresponsive({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <path d="M9.7 6a2.3 2.3 0 1 1 3.6 1.9c-.9.6-1.3 1.1-1.3 2.1" />
      <path d="M12 12.6h.01" />
      <circle cx="6" cy="17.4" r="2.1" />
      <path d="M8.1 17.7h6.4" />
      <path d="M14.5 17.7 18 16.1" />
      <path d="M3 20.4h18" />
    </IconBase>
  );
}

/** P-04 경련 — 목부터 이어지는 지그재그(떨림) 선 */
export function IconProtocolSeizure({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <circle cx="12" cy="5.4" r="2.2" />
      <path d="M12 7.6 9.4 10.8 14.6 13 9.9 16.2 13.6 19.2" />
      <path d="M3 20.6h18" />
    </IconBase>
  );
}

/** P-05 심한 출혈 — 핏방울 윤곽선 */
export function IconProtocolBleeding({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <path d="M12 3.4c3.3 4.4 5.6 7.8 5.6 10.6a5.6 5.6 0 1 1-11.2 0c0-2.8 2.3-6.2 5.6-10.6Z" />
    </IconBase>
  );
}

/**
 * 프로토콜 id("P-01"~"P-05", 대소문자 무관)로 아이콘 컴포넌트를 찾습니다.
 * 알 수 없는 id가 오더라도(데이터 오타 등) 화면이 깨지지 않도록 낙상 아이콘으로 대체합니다.
 *
 * @example const Icon = getProtocolIcon(protocol.id); <Icon className="h-6 w-6 text-ink" />
 */
export function getProtocolIcon(id: string): ComponentType<IconProps> {
  switch (id.trim().toUpperCase()) {
    case "P-02":
      return IconProtocolAirway;
    case "P-03":
      return IconProtocolUnresponsive;
    case "P-04":
      return IconProtocolSeizure;
    case "P-05":
      return IconProtocolBleeding;
    case "P-01":
    default:
      return IconProtocolFall;
  }
}
