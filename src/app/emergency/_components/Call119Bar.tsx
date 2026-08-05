import { cx } from "@/components";

export interface Call119BarProps {
  /** md — 시안 5b의 목록·상세 상단(58px) · lg — 프로토콜 1단계 확대(72px) */
  size?: "md" | "lg";
  className?: string;
}

const SIZE = {
  md: { box: "min-h-[58px] text-[18px]", note: "text-[11px]" },
  lg: { box: "min-h-[72px] text-[22px]", note: "text-[12px]" },
} as const;

/**
 * 119 신고 버튼 — 시안 5b 그대로입니다.
 *
 * `#d64545` 채움 · r14 · 최소 높이 58px · 라벨 18px w800,
 * 그 옆에 「시연 모드 · 실제 발신 안 됨」을 같은 버튼 안에 붙입니다.
 * (안전 규칙 §3-5 — 응급 화면에서는 이 버튼이 스크롤과 무관하게 상시 노출됩니다.)
 *
 * `tel:119` 링크라 전화 앱을 열 뿐, 자동으로 발신되지는 않습니다.
 * 이 화면에서 눈에 띄어야 하는 것은 이 버튼 하나뿐이라 보더·그림자·아이콘을 두지 않습니다.
 */
export function Call119Bar({ size = "md", className }: Call119BarProps) {
  const s = SIZE[size];

  return (
    <a
      href="tel:119"
      className={cx(
        "flex w-full flex-wrap items-center justify-center gap-x-[10px] gap-y-[2px] px-4 py-2",
        "rounded-[14px] bg-danger text-center font-extrabold text-white",
        "transition-colors duration-150 active:bg-danger-ink",
        s.box,
        className,
      )}
    >
      <span>119 눌러 신고</span>
      {/* 시연 고지는 버튼 안에 둡니다 — 누르기 직전에 읽히는 자리가 여기뿐입니다. */}
      <span className={cx("font-semibold text-white/85", s.note)}>시연 모드 · 실제 발신 안 됨</span>
    </a>
  );
}

export default Call119Bar;
