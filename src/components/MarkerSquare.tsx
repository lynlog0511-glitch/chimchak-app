import type { ReactNode } from "react";
import { cx } from "./utils";

export type MarkerTone = "danger" | "brand" | "neutral" | "ok";

const TONE: Record<MarkerTone, string> = {
  danger: "bg-danger-soft text-danger-ink", // 응급 안내 목록 — 낙·기·의·경·출·문
  brand: "bg-brand-tint text-brand-800",
  neutral: "bg-paper-2 text-ink-soft",
  ok: "bg-ok-soft text-ok-ink",
};

export interface MarkerSquareProps {
  /** 한 글자 — 두 글자 이상 넣지 마세요(스캔용 마커입니다). */
  children: ReactNode;
  tone?: MarkerTone;
  /**
   * 한 변 — 시안 42px, 기본값은 그 크기의 rem(`2.625rem`)입니다.
   * CSS 길이 문자열이라 `"2.625rem"`·`"48px"`처럼 단위를 붙여 주세요.
   */
  size?: string;
  className?: string;
}

/**
 * 한 글자 마커 — 2.625rem(=42px) 정사각 r12, 17px w800 (v4 §2 · 시안 5b).
 *
 * 아이콘 대신 쓰는 스캔 장치입니다. 옆의 제목이 뜻을 전하므로 마커는 장식이고,
 * 스크린리더에는 읽히지 않게 둡니다(`aria-hidden`).
 *
 * 치수가 rem인 이유: 이 상자 안에는 **글자**가 들어 있고, 그 글자는 옆 행 제목과 같은 단입니다.
 * px로 두면 「아주 크게」에서 글자만 25% 커져 마커가 글자를 못 담습니다
 * (터치 타겟 48px 같은 물리 치수와는 다른 성격입니다 — 그쪽은 px로 둡니다).
 *
 * @example <MarkerSquare>낙</MarkerSquare>
 */
export function MarkerSquare({
  children,
  tone = "danger",
  size = "2.625rem",
  className,
}: MarkerSquareProps) {
  return (
    <span
      aria-hidden
      className={cx(
        /* 마커 글자는 옆 행 제목(17px)과 같은 단에 둡니다 — 16·17·17.5가 1.5px 안에
           셋 다 있던 자리라(심미 재평가 ma1 /emergency 실측) 한 값으로 접었습니다. */
        "flex flex-none items-center justify-center rounded-field text-[1.0625rem] leading-[1.3] font-extrabold",
        TONE[tone],
        className,
      )}
      style={{ width: size, height: size }}
    >
      {children}
    </span>
  );
}

export default MarkerSquare;
