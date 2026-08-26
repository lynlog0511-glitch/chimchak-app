import { cx } from "@/components";

export interface Call119BarProps {
  /** md — 시안 5b의 목록·상세 상단(58px) · lg — 프로토콜 1단계 확대(72px) */
  size?: "md" | "lg";
  className?: string;
}

/**
 * 버튼 크기만 갈립니다 — 캡션은 크기와 무관하게 한 문구·한 크기입니다.
 * md 글자는 19px입니다: 18px/800은 굵은체 큰 글자 문턱(18.66px)에 0.66px 모자라 4.5:1이
 * 적용되는데 흰 글자 on danger(#d64545)는 4.38:1이라 걸립니다. 19px이면 큰 글자(3:1)로 통과.
 */
const SIZE = {
  md: "min-h-[58px] text-[1.1875rem]",
  lg: "min-h-[72px] text-[1.375rem]",
} as const;

/**
 * 119 버튼 캡션 — **이 앱에 하나뿐인 문구**입니다.
 *
 * 한때 `components/Call119Button`과 이 파일이 서로 다른 이야기를 했습니다
 * (저기 「시연 모드에서는 실제 발신되지 않습니다」 / 여기 「훈련 중에는 누르지 마세요」 — 평가 초보 m35).
 * 남긴 쪽은 **일어나는 사실 하나만 적는** 문장입니다: `href="tel:119"`는 진짜 전화 앱을 여는 링크라
 * 「발신되지 않는다」는 없는 안전장치를 있다고 적는 셈이 됩니다.
 * 두 버튼이 다시 갈라지지 않도록 문구를 한 곳에 두고 양쪽이 같이 쓰던 상수인데,
 * 렌더 0건이던 `Call119Button`을 파일째 지우면서(2026-08-23) 쓰는 쪽이 이 버튼 하나만 남아
 * 상수도 여기로 옮겨 왔습니다. 119 버튼이 다시 둘이 되는 날에는 여기서 가져다 쓰십시오.
 *
 * 2026-08-25 순서 교정. 예전 문구는 「누르면 전화 앱이 열립니다 — 훈련 중에는 누르지 마세요」로,
 * 급한 순간에 빨간 버튼 다음으로 눈에 들어오는 다섯 글자가 「누르지 마세요」였습니다.
 * 실제 상황에서 0.5초라도 손이 멈추면 그건 이 앱이 만든 지연입니다(페르소나 현직 high).
 * 그래서 **두 상황을 나란히** 적고, 실전 쪽을 앞에 둡니다. 「전화 앱이 열린다」는 사실은
 * 사라지지 않았습니다 — 목록 화면 각주와 「처음 오신 분께」의 119 항목이 그대로 들고 있습니다.
 * (없는 안전장치를 있다고 적지 않는다는 원칙은 이 문구에서도 그대로입니다.)
 */
export const CALL_119_CAPTION = "실제 상황이면 지금 누르세요 · 연습 중이면 누르지 마세요";

/**
 * 캡션 크기 — 13.5px 하한.
 * 「무엇이 일어나는가」를 알리는 문장이라 메타·각주가 아닙니다(평가 초보 m35: 12px → 13.5px↑).
 * 색은 흰 지면 위 `ink-soft`(8.5:1)로, 빨강 채움 위 흰 글자(4.4:1)를 피해 버튼 밖에 둡니다.
 */
export const CALL_119_CAPTION_CLASS =
  "text-[0.8438rem] leading-[1.45] font-semibold text-ink-soft";

/**
 * 119 신고 버튼 — 시안 5b의 danger 채움·r14·58px을 그대로 씁니다.
 *
 * 캡션(`CALL_119_CAPTION`)은 **버튼 밖, 바로 아래**에 둡니다.
 * 버튼 안 빨강(#d64545) 위 작은 흰 글자는 4.4:1로 소형 텍스트 AA(4.5:1)에 미치지 못했고,
 * 시안 확정색을 바꾸는 대신 캡션을 흰 지면 위 ink-soft(8.5:1)로 빼는 쪽을 택했습니다.
 * 버튼은 「119 눌러 신고」 한 마디만 남아 더 크고 명확해집니다.
 * 문구·크기는 이 파일 위쪽 상수 한 곳에 둡니다 — 두 버튼이 서로 다른 이야기를 하던 자리입니다.
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
          "rounded-card bg-danger text-center font-extrabold text-paper",
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
