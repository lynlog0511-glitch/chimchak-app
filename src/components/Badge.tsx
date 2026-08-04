import type { ReactNode } from "react";
import { cx } from "./utils";

export type BadgeTone = "brand" | "ok" | "warn" | "danger" | "neutral";
/** soft=옅은 채움(기본) · outline=채움 없이 선만 — 한 화면에 색 블록을 줄일 때 씁니다. */
export type BadgeVariant = "soft" | "outline";

export interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  /** 작은 라벨용 (기본) / lg는 카드 제목 옆 강조용 */
  size?: "sm" | "md";
  variant?: BadgeVariant;
  className?: string;
}

const SOFT: Record<BadgeTone, string> = {
  brand: "bg-brand-50 text-brand-800 border-brand-200",
  ok: "bg-ok-soft text-ok-ink border-ok-line",
  warn: "bg-warn-soft text-warn-ink border-warn-line",
  danger: "bg-danger-soft text-danger-ink border-danger-line",
  neutral: "bg-neutral-soft text-ink-soft border-neutral-line",
};

const OUTLINE: Record<BadgeTone, string> = {
  brand: "bg-transparent text-brand-800 border-brand-200",
  ok: "bg-transparent text-ok-ink border-ok-line",
  warn: "bg-transparent text-warn-ink border-warn-line",
  danger: "bg-transparent text-danger-ink border-danger-line",
  neutral: "bg-transparent text-ink-muted border-line-strong",
};

/**
 * 상태·유형 표기용 소형 배지. 점수·등급 표기에는 사용하지 않습니다.
 *
 * 한 화면에 필 형태는 2~3종 이내로 유지하세요 — 그 이상이면 그냥 작은 텍스트로 두는 편이 낫습니다.
 * 색 블록을 더 줄여야 하면 `variant="outline"`을 쓰세요.
 */
export function Badge({
  children,
  tone = "neutral",
  size = "sm",
  variant = "soft",
  className,
}: BadgeProps) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-chip border font-semibold whitespace-nowrap",
        size === "sm" ? "px-2.5 py-0.5 text-sm" : "px-3 py-1 text-base",
        variant === "outline" ? OUTLINE[tone] : SOFT[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export default Badge;
