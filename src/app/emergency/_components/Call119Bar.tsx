import { cx } from "@/components";

export interface Call119BarProps {
  /** md — 시안 5b의 목록·상세 상단(58px) · lg — 프로토콜 1단계 확대(72px) */
  size?: "md" | "lg";
  className?: string;
}

const SIZE = {
  md: { box: "min-h-[58px] text-[1.125rem]", note: "text-[0.6875rem]" },
  lg: { box: "min-h-[72px] text-[1.375rem]", note: "text-[0.75rem]" },
} as const;

/**
 * 119 신고 버튼 — 시안 5b 그대로입니다.
 *
 * `#d64545` 채움 · r14 · 최소 높이 58px · 라벨 18px w800,
 * 그 옆에 「누르면 전화 앱이 열립니다 — 훈련 중에는 누르지 마세요」를 같은 버튼 안에 붙입니다.
 * (안전 규칙 §3-5 — 응급 화면에서는 이 버튼이 스크롤과 무관하게 상시 노출됩니다.)
 *
 * 캡션이 「발신되지 않는다」는 뜻으로 읽히던 때가 있었는데, 코드에는 그런 장치가 없습니다 —
 * 이 버튼은 진짜 `tel:119` 링크라 누르면 전화 앱이 열립니다(발신은 한 번 더 눌러야 됩니다).
 * 그래서 캡션을 **실제 동작 서술**로 바꿨습니다. 없는 안전장치를 있다고 적어 두는 편이 더 위험합니다.
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
      {/* 고지는 버튼 안에 둡니다 — 누르기 직전에 읽히는 자리가 여기뿐입니다.
          빨강 면 위 작은 글자라 흰색을 그대로 씁니다(투명도를 빼서 대비를 올렸습니다). */}
      <span className={cx("font-semibold text-white", s.note)}>
        누르면 전화 앱이 열립니다 — 훈련 중에는 누르지 마세요
      </span>
    </a>
  );
}

export default Call119Bar;
