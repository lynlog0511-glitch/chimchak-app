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

/**
 * 119 버튼 캡션 — **이 앱에 하나뿐인 문구**입니다.
 *
 * 한때 이 파일과 `emergency/_components/Call119Bar`가 서로 다른 이야기를 했습니다
 * (여기 「시연 모드에서는 실제 발신되지 않습니다」 / 저기 「훈련 중에는 누르지 마세요」 — 평가 초보 m35).
 * 남긴 쪽은 **일어나는 사실 하나만 적는** 문장입니다: `href="tel:119"`는 진짜 전화 앱을 여는 링크라
 * 「발신되지 않는다」는 없는 안전장치를 있다고 적는 셈이 됩니다.
 * 두 버튼이 다시 갈라지지 않도록 문구를 여기 한 곳에 두고 양쪽이 같이 씁니다.
 */
export const CALL_119_CAPTION = "누르면 전화 앱이 열립니다 — 훈련 중에는 누르지 마세요";

/**
 * 캡션 크기 — 13.5px 하한.
 * 「무엇이 일어나는가」를 알리는 문장이라 메타·각주가 아닙니다(평가 초보 m35: 12px → 13.5px↑).
 * 색은 흰 지면 위 `ink-soft`(8.5:1)로, 빨강 채움 위 흰 글자(4.4:1)를 피해 버튼 밖에 둡니다.
 */
export const CALL_119_CAPTION_CLASS =
  "text-[0.8438rem] leading-[1.45] font-semibold text-ink-soft";

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
        <p className={cx("mt-2 text-center", CALL_119_CAPTION_CLASS)}>{CALL_119_CAPTION}</p>
      )}
    </div>
  );
}

export default Call119Button;
