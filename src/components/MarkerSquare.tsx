import type { ReactNode } from "react";
import { cx } from "./utils";

export type MarkerTone = "danger" | "brand" | "neutral" | "ok";

const TONE: Record<MarkerTone, string> = {
  danger: "bg-danger-soft text-danger-ink", // 응급 5종 — 낙·기·의·경·출
  brand: "bg-tint text-brand-800",
  neutral: "bg-paper-2 text-ink-soft",
  ok: "bg-ok-soft text-ok-ink",
};

export interface MarkerSquareProps {
  /** 한 글자 — 두 글자 이상 넣지 마세요(스캔용 마커입니다). */
  children: ReactNode;
  tone?: MarkerTone;
  /** 한 변(px) — 시안 42px */
  size?: number;
  className?: string;
}

/**
 * 한 글자 마커 — 42px 정사각 r12, 16px w800 (v4 §2 · 시안 5b).
 *
 * 아이콘 대신 쓰는 스캔 장치입니다. 옆의 제목이 뜻을 전하므로 마커는 장식이고,
 * 스크린리더에는 읽히지 않게 둡니다(`aria-hidden`).
 *
 * @example <MarkerSquare>낙</MarkerSquare>
 */
export function MarkerSquare({
  children,
  tone = "danger",
  size = 42,
  className,
}: MarkerSquareProps) {
  return (
    <span
      aria-hidden
      className={cx(
        /* 마커 글자는 옆 행 제목(17px)과 같은 단에 둡니다 — 16·17·17.5가 1.5px 안에
           셋 다 있던 자리라(심미 재평가 ma1 /emergency 실측) 한 값으로 접었습니다. */
        "flex flex-none items-center justify-center rounded-[12px] text-[1.0625rem] leading-[1.3] font-extrabold",
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
