import { IconPhone } from "./icons";
import { cx } from "./utils";

export interface Call119ButtonProps {
  className?: string;
  /** xl은 응급 프로토콜 1단계 강조용(약 60% 확대) */
  size?: "md" | "lg" | "xl";
  /** 캡션 노출 여부 */
  caption?: boolean;
  /** 가로 전체 채우기 */
  block?: boolean;
}

/* 라벨은 코어 콘텐츠(§3) 중에서도 가장 위에 있습니다 — 루트를 16px로 내려도 여기는 줄이지 않습니다.
   20px↑ extrabold라 WCAG 큰 글자(3:1) 기준이 적용되고, 흰 글자/danger 채움은 4.4:1로 이를 넘습니다. */
const SIZE = {
  md: "min-h-[56px] px-6 text-[1.25rem] gap-2.5", // 20px
  lg: "min-h-[68px] px-8 text-[1.5rem] gap-3", // 24px
  xl: "min-h-[96px] px-10 text-[2rem] md:text-[2.25rem] gap-4", // 32~36px
} as const;

const ICON_SIZE = {
  md: "h-6 w-6",
  lg: "h-7 w-7",
  xl: "h-9 w-9",
} as const;

/**
 * 119 신고 버튼.
 * 응급 화면에서는 상시 노출하고, 프로토콜 1단계에서는 size="xl"로 확대합니다.
 * 링크는 전화 앱을 여는 tel: 링크이며, 자동으로 발신되지는 않습니다.
 *
 * 그라데이션·그림자·보더·이모지 없이 danger 단색 하나로만 세웁니다 —
 * 이 화면에서 눈에 띄어야 하는 것은 이 버튼 하나뿐이기 때문입니다.
 *
 * 접근성 코어 예외(§3): **코어 콘텐츠(대사·CUE·응급 자막·CTA)는 18px+ 유지.**
 * 이 버튼은 그중에서도 최상위라 20px(md)/24px(lg)/32px(xl)이 하한입니다.
 */
export function Call119Button({
  className,
  size = "lg",
  caption = true,
  block = true,
}: Call119ButtonProps) {
  return (
    <div className={cx(block && "w-full", className)}>
      <a
        href="tel:119"
        className={cx(
          // v4 §2: 버튼 라운드 14px (채움 #d64545는 시안 5b의 119 버튼 색과 같은 값입니다).
          "inline-flex items-center justify-center rounded-[14px] bg-danger font-extrabold text-white transition-colors duration-150 hover:bg-danger-ink active:bg-danger-ink",
          SIZE[size],
          block && "w-full",
        )}
      >
        <IconPhone className={ICON_SIZE[size]} strokeWidth={2} />
        <span>119 신고</span>
      </a>
      {caption && (
        <p className="chim-caption mt-2 text-center leading-snug text-ink-muted">
          누르면 전화 앱이 열립니다 · 시연 모드에서는 실제 발신되지 않습니다.
        </p>
      )}
    </div>
  );
}

export default Call119Button;
