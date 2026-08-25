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
  /**
   * 채움 변형 — **하단 탭바의 활성 칸에서만** 씁니다(iOS 관용: 비움/채움으로 「지금 여기」를 말합니다).
   *
   * 굵기(1.75↔2)로 활성을 말하던 예전 방식은 22px에서 0.23px 차이라 1x 화면에서는
   * 흐릿해지는 것으로만 읽혔습니다. 채움/비움은 크기와 무관하게 확실합니다.
   * 이 prop을 받는 아이콘은 탭바 5종(홈·훈련·응급·보고·이력)뿐이고, 나머지는 무시합니다.
   */
  filled?: boolean;
}

interface IconBaseProps extends IconProps {
  children: ReactNode;
}

/**
 * 모든 아이콘이 공유하는 SVG 껍데기.
 * 24×24 viewBox · stroke=currentColor · strokeWidth 1.75 · round cap/join · fill none.
 * 이 값들을 개별 아이콘에서 덮어쓰지 않는 것이 시스템 통일의 전부입니다.
 *
 * `filled`일 때는 반대로 뒤집습니다 — fill=currentColor · stroke=none.
 * 채움 변형의 실루엣은 선 변형의 **바깥 가장자리**에 맞춰 그려 두었으므로
 * 두 상태의 광학 크기가 같습니다. 선으로 남겨야 하는 잔가지(경광등 안테나 등)는
 * 그 요소에만 stroke를 명시합니다.
 *
 * 광학 상자 — 탭바 5종은 24 viewBox 안 **20×20(x·y 2~22)** 을 공통 기준으로 삼고
 * 면적이 같아 보이도록 배급합니다: 사각형에 가까운 홈·보고는 상자보다 한 단 작게,
 * 원형인 이력은 상자에 꽉, 가로로 긴 훈련 말풍선은 폭을 줄이고 높이를 보강합니다.
 * 세로 중심은 다섯 종 모두 12.0입니다.
 */
export function IconBase({ className, strokeWidth = 1.75, filled = false, children }: IconBaseProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
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
