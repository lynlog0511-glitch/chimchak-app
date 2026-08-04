import type { ReactNode } from "react";

/**
 * 침착 아이콘 공통 props.
 * 아이콘은 언제나 장식(aria-hidden)입니다 — 의미는 반드시 옆의 텍스트 라벨이 전달합니다.
 * (DESIGN_DIRECTION §4: "모든 아이콘은 텍스트 라벨과 함께" · 아이콘 단독 사용 금지)
 */
export interface IconProps {
  /** Tailwind 클래스. 크기를 주지 않으면 24×24로 그려집니다. 색은 `text-*`로 상속됩니다. */
  className?: string;
  /** 굵기 조정이 필요할 때만. 기본 1.75 — 시스템 전체가 이 값을 씁니다. */
  strokeWidth?: number;
}

interface IconBaseProps extends IconProps {
  children: ReactNode;
}

/**
 * 모든 아이콘이 공유하는 SVG 껍데기.
 * 24×24 viewBox · stroke=currentColor · strokeWidth 1.75 · round cap/join · fill none.
 * 이 값들을 개별 아이콘에서 덮어쓰지 않는 것이 시스템 통일의 전부입니다.
 */
export function IconBase({ className, strokeWidth = 1.75, children }: IconBaseProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {children}
    </svg>
  );
}

export default IconBase;
