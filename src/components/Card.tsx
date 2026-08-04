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
 * radius 14px · **그림자 없음** · 1px 보더로 정리 · 넉넉한 여백이 기본값입니다.
 * (그림자는 떠 있는 것 — 모달·팝오버 — 에만 씁니다.)
 *
 * 정보 위계가 낮은 목록·표라면 카드로 감싸지 말고 `.chim-hairline` 구분선을 쓰세요.
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
        "rounded-card border",
        TONE[tone],
        padded && "p-5 md:p-6",
        hoverable &&
          "transition-colors duration-150 ease-soft hover:border-brand-300 hover:bg-brand-50/50",
        className,
      )}
    >
      {children}
    </div>
  );
}

export default Card;
