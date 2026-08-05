import { cx } from "./utils";

/** 시안 4a — 대사 옆 TTS 파형 3줄 (폭 2.5px · 간격 1.5px) */
const BARS_3 = [
  { h: 9, deep: true },
  { h: 5, deep: false },
  { h: 11, deep: true },
] as const;

/** 시안 4b — 녹음 패널 파형 5줄 (폭 3px · 간격 2px) */
const BARS_5 = [
  { h: 7, deep: true },
  { h: 13, deep: true },
  { h: 5, deep: false },
  { h: 11, deep: true },
  { h: 8, deep: false },
] as const;

export interface WaveBarsProps {
  /** 막대 수 — 3(대사 옆 TTS) · 5(녹음 패널) */
  count?: 3 | 5;
  /** 흔들림 (기본 true). reduced-motion에서는 전역 규칙이 즉시 멈춥니다. */
  animated?: boolean;
  /**
   * 스크린리더 라벨. 기본은 장식(`aria-hidden`)입니다 —
   * 시안처럼 옆에 「읽어 주는 중」·「듣고 있어요」 텍스트가 있으면 그대로 두세요.
   */
  label?: string;
  className?: string;
}

/**
 * 파형 — 낭독(TTS) 중·녹음 중임을 알리는 막대 묶음 (v4 §3 · 시안 4a④·4b).
 *
 * 색은 `brand-600`과 `brand-400`을 섞어 두 단계로만 씁니다. 게이지가 아니라 **상태 표시**이므로
 * 막대 높이에 값의 의미를 싣지 않습니다.
 *
 * @example <WaveBars count={3} /> <span className="text-[11px] text-brand-600">읽어 주는 중</span>
 */
export function WaveBars({ count = 3, animated = true, label, className }: WaveBarsProps) {
  const bars = count === 5 ? BARS_5 : BARS_3;
  const width = count === 5 ? 3 : 2.5;
  const gap = count === 5 ? 2 : 1.5;

  return (
    <span
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      className={cx("inline-flex items-end", className)}
      style={{ gap }}
    >
      {bars.map((bar, index) => (
        <span
          key={index}
          className={cx(
            "block rounded-[1px]",
            bar.deep ? "bg-brand-600" : "bg-brand-400",
            animated && "chim-wave-bar",
          )}
          style={{
            width,
            height: bar.h,
            animationDelay: animated ? `${index * 110}ms` : undefined,
          }}
        />
      ))}
    </span>
  );
}

export default WaveBars;
