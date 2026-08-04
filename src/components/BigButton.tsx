import type { ReactNode } from "react";
import Link from "next/link";
import { cx } from "./utils";

export type BigButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type BigButtonSize = "md" | "lg";

export interface BigButtonProps {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: BigButtonVariant;
  size?: BigButtonSize;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  className?: string;
  /** 가로 전체를 채웁니다(모바일 CTA 기본값으로 유용). */
  block?: boolean;
  /** 스크린리더용 라벨 (아이콘만 있는 경우는 없지만 보조 설명이 필요할 때) */
  ariaLabel?: string;
  title?: string;
}

/* 그림자는 쓰지 않습니다 — 채움 색과 1px 보더만으로 버튼임을 알립니다. */
const VARIANT: Record<BigButtonVariant, string> = {
  // 채움 배경은 brand-700 — 흰 글자와의 대비가 AA를 통과합니다.
  primary: "bg-brand-700 text-white border-brand-700 hover:bg-brand-800 active:bg-brand-900",
  secondary:
    "bg-white text-brand-800 border-brand-300 hover:bg-brand-50 hover:border-brand-400 active:bg-brand-100",
  danger: "bg-danger text-white border-danger hover:bg-danger-ink active:bg-danger-ink",
  ghost:
    "bg-transparent text-ink-soft border-transparent hover:bg-neutral-soft hover:text-ink active:bg-neutral-line",
};

const SIZE: Record<BigButtonSize, string> = {
  // 접근성: 주요 버튼 48px↑ / 핵심 CTA 56px↑
  md: "min-h-[48px] px-5 py-2.5 text-base",
  lg: "min-h-[56px] px-7 py-3 text-lg",
};

/**
 * 고령 사용자 기준 터치 타겟(48px↑)을 보장하는 공용 버튼.
 * `href`를 주면 링크로, 없으면 버튼으로 렌더링합니다.
 *
 * @example <BigButton href="/train" size="lg">훈련 시작하기</BigButton>
 * @example <BigButton onClick={next} variant="secondary">다음 단계</BigButton>
 */
export function BigButton({
  children,
  onClick,
  href,
  variant = "primary",
  size = "md",
  disabled = false,
  type = "button",
  className,
  block = false,
  ariaLabel,
  title,
}: BigButtonProps) {
  const base = cx(
    "inline-flex items-center justify-center gap-2 rounded-field border font-bold",
    "transition-colors duration-150 ease-soft",
    "disabled:cursor-not-allowed disabled:opacity-45",
    SIZE[size],
    VARIANT[variant],
    block && "w-full",
    className,
  );

  if (href && !disabled) {
    const isInternal = href.startsWith("/");
    if (isInternal) {
      return (
        <Link href={href} className={base} aria-label={ariaLabel} title={title} onClick={onClick}>
          {children}
        </Link>
      );
    }
    return (
      <a href={href} className={base} aria-label={ariaLabel} title={title} onClick={onClick}>
        {children}
      </a>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={base}
      aria-label={ariaLabel}
      title={title}
    >
      {children}
    </button>
  );
}

export default BigButton;
