import { cx } from "@/components";
import { CALL_119_CAPTION, CALL_119_CAPTION_CLASS } from "@/components/Call119Button";

export interface Call119BarProps {
  /** md — 시안 5b의 목록·상세 상단(58px) · lg — 프로토콜 1단계 확대(72px) */
  size?: "md" | "lg";
  className?: string;
}

/** 버튼 크기만 갈립니다 — 캡션은 크기와 무관하게 한 문구·한 크기입니다. */
const SIZE = {
  md: "min-h-[58px] text-[1.125rem]",
  lg: "min-h-[72px] text-[1.375rem]",
} as const;

/**
 * 119 신고 버튼 — 시안 5b의 danger 채움·r14·58px을 그대로 씁니다.
 *
 * 캡션(`CALL_119_CAPTION`)은 **버튼 밖, 바로 아래**에 둡니다.
 * 버튼 안 빨강(#d64545) 위 작은 흰 글자는 4.4:1로 소형 텍스트 AA(4.5:1)에 미치지 못했고,
 * 시안 확정색을 바꾸는 대신 캡션을 흰 지면 위 ink-soft(8.5:1)로 빼는 쪽을 택했습니다.
 * 버튼은 「119 눌러 신고」 한 마디만 남아 더 크고 명확해집니다.
 * 문구·크기는 `Call119Button`과 한 곳에서 공유합니다 — 두 버튼이 서로 다른 이야기를 하던 자리입니다.
 *
 * 이 버튼은 진짜 `tel:119` 링크입니다 — 누르면 전화 앱이 열립니다(발신은 한 번 더 눌러야 됩니다).
 * 없는 안전장치(「발신 안 됨」류)를 있다고 적지 않습니다.
 * (안전 규칙 §3-5 — 응급 화면에서는 이 버튼이 스크롤과 무관하게 상시 노출됩니다.)
 */
export function Call119Bar({ size = "md", className }: Call119BarProps) {
  return (
    <div className={className}>
      <a
        href="tel:119"
        className={cx(
          "flex w-full items-center justify-center px-4 py-2",
          "rounded-[14px] bg-danger text-center font-extrabold text-white",
          "transition-colors duration-150 active:bg-danger-ink",
          SIZE[size],
        )}
      >
        119 눌러 신고
      </a>
      <p className={cx("mt-[5px] text-center", CALL_119_CAPTION_CLASS)}>{CALL_119_CAPTION}</p>
    </div>
  );
}

export default Call119Bar;
