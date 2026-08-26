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

/* 보더도 그림자도 쓰지 않습니다 — 채움(또는 회색 면) 하나로 버튼임을 알립니다(§5).
   흰 글자를 얹는 채움은 4.5:1을 넘는 값만 씁니다:
     brand-700 #157F75 4.86:1 · danger-ink #B03636 6.2:1
   (danger #D64545는 4.4:1이라 17~18px 라벨에는 못 씁니다 — 큰 자막(19px+)을 쓰는 Call119Bar 전용입니다.)

   ※ 가이드 §1은 주 CTA 채움을 brand-600(#17948a)으로 적어 두었지만 **여기서는 쓰지 않습니다.**
     #17948a 위 흰 글자는 상대휘도 0.2319 → 대비 **3.72:1**입니다.
     (평가 원본이 적은 「brand-600 + 15px 흰 글자 4.4:1」은 danger #D64545의 값과 섞인 오기입니다.)
     WCAG가 3:1을 허용하는 '큰 글자'는 24px 이상 또는 18.66px(14pt) 이상의 **굵은** 글씨인데,
     이 버튼 라벨은 md 17px / lg 18px · font-semibold(600)라 두 크기 모두 큰 글자에 들지 못합니다 →
     일반 텍스트 기준 4.5:1이 적용되고 3.72:1은 미달입니다. 그래서 두 변형 다 brand-700을 유지합니다.
     brand-600은 마이크·진행바·상태 점·파형처럼 '누르는 것이 아닌 표시'에만 남깁니다
     (심미 m38이 실측 끝에 낸 결론과 같습니다 — 통일 방향은 600이 아니라 700입니다). */
const VARIANT: Record<BigButtonVariant, string> = {
  primary: "bg-brand-700 text-white hover:bg-brand-800 active:bg-brand-900",
  // secondary = 회색 면. 틸 보더를 두르면 화면마다 선이 늘어나 서식처럼 보입니다.
  secondary: "bg-paper-2 text-ink hover:bg-neutral-line active:bg-neutral-line",
  danger: "bg-danger-ink text-white hover:brightness-110 active:brightness-95",
  ghost: "bg-transparent text-ink-soft hover:bg-paper-2 hover:text-ink active:bg-neutral-line",
};

/* 라벨은 코어 콘텐츠(§3)입니다 — 크롬을 16px로 내리는 작업에서도 17px을 지킵니다.
   터치 타겟 48px(md) / 56px(lg)도 불변입니다. */
/* 2026-08-06 타입 스케일 통합: lg 라벨 18px → 17px.
   가이드 §2 역할표에 18px 단은 없습니다 — 코어 단은 17px(대사·CUE) 하나이고,
   md 17 / lg 18은 비율 1.06으로 지각 역치 아래라 위계가 아니라 편차였습니다(심미 재평가 ma1).
   **하한 17px은 그대로입니다.** 크기 대신 터치 타겟(48/56px)과 여백으로 두 단을 가릅니다. */
const SIZE: Record<BigButtonSize, string> = {
  md: "min-h-[48px] px-5 py-2.5 text-[1.0625rem]", // 17px
  lg: "min-h-[56px] px-7 py-3 text-[1.0625rem]", // 17px
};

/**
 * 고령 사용자 기준 터치 타겟(48px↑)을 보장하는 공용 버튼.
 * `href`를 주면 링크로, 없으면 버튼으로 렌더링합니다.
 *
 * 접근성 코어 예외(§3): **코어 콘텐츠(대사·CUE·응급 자막·CTA)는 코어 단(17px)을 지킵니다.**
 * 이 버튼의 라벨은 CTA이므로 17px semibold가 하한입니다 —
 * UI 크롬을 줄이는 어떤 작업에서도 이 값 아래로 내리지 마세요.
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
    // v4 §2: 버튼 라운드는 14px 하나로 통일했습니다(카드와 같은 값).
    "inline-flex items-center justify-center gap-2 rounded-card font-semibold",
    // 눌림 = 색 전환 + 1.5% 축소를 한 박자(150ms)에. `.chim-press`가 transition-property를
    // 통째로 선언하므로 여기에 `transition-colors`를 다시 걸지 마세요(globals.css 주석 참조).
    "chim-press",
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
