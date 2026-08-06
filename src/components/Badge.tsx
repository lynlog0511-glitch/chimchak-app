import type { ReactNode } from "react";
import { cx } from "./utils";

export type BadgeTone = "brand" | "ok" | "warn" | "danger" | "neutral";
/** soft=옅은 채움(기본·무보더) · outline=채움 없이 선만 — 한 화면에 색 블록을 줄일 때 씁니다. */
export type BadgeVariant = "soft" | "outline";

export interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  /** 작은 라벨용 (기본) / md는 카드 제목 옆 강조용 */
  size?: "sm" | "md";
  variant?: BadgeVariant;
  className?: string;
}

/** soft는 면만 씁니다 — 채움 위에 다시 선을 두르면 서식처럼 보입니다(§1-4). */
const SOFT: Record<BadgeTone, string> = {
  brand: "bg-brand-50 text-brand-800",
  ok: "bg-ok-soft text-ok-ink",
  warn: "bg-warn-soft text-warn-ink",
  danger: "bg-danger-soft text-danger-ink",
  neutral: "bg-neutral-soft text-ink-soft",
};

const OUTLINE: Record<BadgeTone, string> = {
  brand: "border border-brand-200 bg-transparent text-brand-800",
  ok: "border border-ok-line bg-transparent text-ok-ink",
  warn: "border border-warn-line bg-transparent text-warn-ink",
  danger: "border border-danger-line bg-transparent text-danger-ink",
  neutral: "border border-line-strong bg-transparent text-ink-muted",
};

/**
 * 상태·유형 표기용 소형 배지. 점수·등급 표기에는 사용하지 않습니다.
 *
 * 크기 체계(§3): 배지는 UI 크롬이라 13px(sm)/14px(md)입니다.
 * 접근성 코어 예외 — 코어 콘텐츠(대사·CUE·응급 자막·CTA)는 18px+ 유지 — 는 여기에 적용되지 않습니다.
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
        "inline-flex items-center gap-1.5 rounded-chip font-semibold whitespace-nowrap",
        size === "sm" ? "chim-caption px-2.5 py-0.5" : "chim-caption px-3 py-1",
        variant === "outline" ? OUTLINE[tone] : SOFT[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export default Badge;
