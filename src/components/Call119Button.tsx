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

const SIZE = {
  md: "min-h-[56px] px-6 text-lg",
  lg: "min-h-[68px] px-8 text-xl",
  xl: "min-h-[96px] px-10 text-3xl",
} as const;

/**
 * 119 신고 버튼.
 * 응급 화면에서는 상시 노출하고, 프로토콜 1단계에서는 size="xl"로 확대합니다.
 * 링크는 전화 앱을 여는 tel: 링크이며, 자동으로 발신되지는 않습니다.
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
          "inline-flex items-center justify-center gap-3 rounded-field border-2 border-danger bg-danger font-extrabold text-white shadow-card transition-colors duration-150 hover:bg-danger-ink active:bg-danger-ink",
          SIZE[size],
          block && "w-full",
        )}
      >
        <span aria-hidden="true">🚨</span>
        <span>119 신고</span>
      </a>
      {caption && (
        <p className="mt-1.5 text-center text-sm leading-snug text-ink-muted">
          누르면 전화 앱이 열립니다 · 시연 모드에서는 실제 발신되지 않습니다.
        </p>
      )}
    </div>
  );
}

export default Call119Button;
