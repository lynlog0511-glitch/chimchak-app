import { cx } from "./utils";

export interface GaugeProps {
  /** 현재 값 */
  value: number;
  /** 최댓값 (시나리오 기본 5) */
  max: number;
  /** "초조도" · "긴장도" */
  label: string;
  /** 이 값 이상이면 위기 상태로 표기 */
  crisisAt?: number;
  /**
   * 숫자 노출 여부. 기본 false — 화면에는 상태 표현(낮음·높음 등)만 보여 줍니다.
   * 점수·등급으로 오인될 표기를 피하기 위한 기본값입니다.
   */
  showValue?: boolean;
  className?: string;
}

interface Level {
  name: string;
  fill: string;
  text: string;
  track: string;
}

function levelOf(ratio: number, crisis: boolean): Level {
  if (crisis)
    return {
      name: "위기 상태",
      fill: "bg-danger",
      text: "text-danger-ink",
      track: "bg-danger-soft",
    };
  if (ratio <= 0.2)
    return { name: "낮음", fill: "bg-brand-500", text: "text-brand-800", track: "bg-brand-100" };
  if (ratio <= 0.45)
    return {
      name: "조금 높음",
      fill: "bg-brand-400",
      text: "text-brand-800",
      track: "bg-brand-100",
    };
  if (ratio <= 0.65)
    return { name: "높음", fill: "bg-warn", text: "text-warn-ink", track: "bg-warn-soft" };
  if (ratio <= 0.85)
    return { name: "많이 높음", fill: "bg-warn", text: "text-warn-ink", track: "bg-warn-soft" };
  return { name: "위기 근접", fill: "bg-danger", text: "text-danger-ink", track: "bg-danger-soft" };
}

/**
 * 초조도·긴장도 게이지.
 * 낮음은 틸, 높아질수록 주황→빨강으로 변합니다.
 * max가 8 이하면 칸 단위 막대(읽기 쉬움), 그보다 크면 연속 막대로 그립니다.
 *
 * @example <Gauge value={3} max={5} label="초조도" crisisAt={5} />
 */
export function Gauge({ value, max, label, crisisAt, showValue = false, className }: GaugeProps) {
  const safeMax = Math.max(1, max);
  const clamped = Math.min(safeMax, Math.max(0, value));
  const ratio = clamped / safeMax;
  const crisis = typeof crisisAt === "number" && clamped >= crisisAt;
  const level = levelOf(ratio, crisis);
  const segmented = safeMax <= 8;
  const filled = Math.round(clamped);

  return (
    <div
      className={cx("w-full", className)}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={clamped}
      aria-valuetext={`${label} ${level.name}`}
    >
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-base font-bold text-ink">{label}</span>
        <span className={cx("text-base font-bold", level.text)}>
          {level.name}
          {showValue && (
            <span className="ml-1.5 text-sm font-semibold text-ink-muted">
              {clamped} / {safeMax}
            </span>
          )}
        </span>
      </div>

      {segmented ? (
        <div className="flex gap-1.5" aria-hidden="true">
          {Array.from({ length: safeMax }, (_, i) => (
            <span
              key={i}
              className={cx(
                "h-3.5 flex-1 rounded-chip transition-colors duration-300 ease-soft",
                i < filled ? level.fill : "bg-line",
              )}
            />
          ))}
        </div>
      ) : (
        <div className={cx("h-3.5 w-full overflow-hidden rounded-chip", level.track)}>
          <span
            aria-hidden="true"
            className={cx(
              "block h-full origin-left rounded-chip transition-[width] duration-300 ease-soft",
              level.fill,
            )}
            style={{ width: `${Math.round(ratio * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default Gauge;
