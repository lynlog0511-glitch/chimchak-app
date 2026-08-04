import type { ReactNode } from "react";
import { cx } from "./utils";

export type CardTone = "default" | "brand" | "ok" | "warn" | "danger" | "quiet";

export interface CardProps {
  children: ReactNode;
  className?: string;
  /** 카드 톤 — 기본은 흰 배경 카드입니다. */
  tone?: CardTone;
  /** 내부 여백을 끄고 직접 채우고 싶을 때 false */
  padded?: boolean;
  /** 마우스 오버 시 살짝 떠오르는 효과 (링크 카드용) */
  hoverable?: boolean;
  id?: string;
}

const TONE: Record<CardTone, string> = {
  default: "bg-white border-line",
  brand: "bg-brand-50 border-brand-200",
  ok: "bg-ok-soft border-ok-line",
  warn: "bg-warn-soft border-warn-line",
  danger: "bg-danger-soft border-danger-line",
  quiet: "bg-paper-2 border-line",
};

/**
 * 공용 카드 컨테이너.
 * radius 20px · 은은한 그림자 · 넉넉한 여백이 기본값입니다.
 */
export function Card({
  children,
  className,
  tone = "default",
  padded = true,
  hoverable = false,
  id,
}: CardProps) {
  return (
    <div
      id={id}
      className={cx(
        "rounded-card border shadow-card",
        TONE[tone],
        padded && "p-5 md:p-6",
        hoverable &&
          "transition-shadow transition-transform duration-200 ease-soft hover:-translate-y-0.5 hover:shadow-card-hover",
        className,
      )}
    >
      {children}
    </div>
  );
}

export default Card;
