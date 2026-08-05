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
  /** 마우스 오버 시 면이 살짝 바뀌는 효과 (링크 카드용) */
  hoverable?: boolean;
  /**
   * 1px 보더를 옵트인으로 켭니다. 기본은 **무보더**(v3 §5·§7).
   * 지면이 흰색인 구간에 흰 카드를 놓아 구분이 정말 불가능할 때만 켜세요.
   */
  border?: boolean;
  id?: string;
}

/** 면(surface) — 지면 #fafbfb 위에서 흰 카드가 그 자체로 구분됩니다. */
const TONE: Record<CardTone, string> = {
  default: "bg-white",
  brand: "bg-brand-50",
  ok: "bg-ok-soft",
  warn: "bg-warn-soft",
  danger: "bg-danger-soft",
  quiet: "bg-paper-2",
};

/** 보더는 옵트인일 때만 — 톤에 맞는 선 하나로 끝냅니다. */
const TONE_BORDER: Record<CardTone, string> = {
  default: "border border-line",
  brand: "border border-brand-200",
  ok: "border border-ok-line",
  warn: "border border-warn-line",
  danger: "border border-danger-line",
  quiet: "border border-line",
};

/**
 * 공용 카드 컨테이너.
 * radius 16px · **무보더·무그림자**가 기본값이고, 구분은 지면(#fafbfb)과의 면 차이로 합니다(§7).
 * (그림자는 떠 있는 것 — 모달·팝오버·고정 바 — 에만 씁니다.)
 *
 * 정보 위계가 낮은 목록·표라면 카드로 감싸지 말고 `.chim-hairline` 구분선을 쓰세요.
 * 한 뷰포트에 카드가 4장 넘게 보이면 카드를 줄이거나 리스트로 바꾸는 편이 낫습니다(§6).
 *
 * 접근성 코어 예외(§3): 카드 안에 놓이더라도 코어 콘텐츠(대사·CUE·응급 자막·CTA)는 18px+를 유지합니다.
 */
export function Card({
  children,
  className,
  tone = "default",
  padded = true,
  hoverable = false,
  border = false,
  id,
}: CardProps) {
  return (
    <div
      id={id}
      className={cx(
        "rounded-card",
        TONE[tone],
        border && TONE_BORDER[tone],
        padded && "p-5 md:p-6",
        hoverable && "transition-colors duration-150 ease-soft hover:bg-brand-50",
        className,
      )}
    >
      {children}
    </div>
  );
}

export default Card;
