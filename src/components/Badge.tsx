import type { ReactNode } from "react";
import { cx } from "./utils";

export type BadgeTone = "brand" | "ok" | "warn" | "danger" | "neutral";

export interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  /** 작은 라벨용 (기본) / lg는 카드 제목 옆 강조용 */
  size?: "sm" | "md";
  className?: string;
}

const TONE: Record<BadgeTone, string> = {
  brand: "bg-brand-50 text-brand-800 border-brand-200",
  ok: "bg-ok-soft text-ok-ink border-ok-line",
  warn: "bg-warn-soft text-warn-ink border-warn-line",
  danger: "bg-danger-soft text-danger-ink border-danger-line",
  neutral: "bg-neutral-soft text-ink-soft border-neutral-line",
};

/** 상태·유형 표기용 소형 배지. 점수·등급 표기에는 사용하지 않습니다. */
export function Badge({ children, tone = "neutral", size = "sm", className }: BadgeProps) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-chip border font-semibold whitespace-nowrap",
        size === "sm" ? "px-2.5 py-0.5 text-sm" : "px-3 py-1 text-base",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export default Badge;
