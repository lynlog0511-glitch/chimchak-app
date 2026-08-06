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
  /**
   * 값 구간별 추상 상태 마크를 상태어 앞에 함께 그립니다. 기본 false.
   * 마크는 결·파형만 있는 추상 기호입니다 — 표정·얼굴·숫자·별점 같은 등급 기호는 쓰지 않습니다.
   * 의미는 언제나 옆의 상태어가 전달하고, 마크는 장식(aria-hidden)입니다.
   */
  showStateMark?: boolean;
  className?: string;
}

/** 상태 마크의 결 — 잔잔함에서 요동으로, 위기에서는 멈춤 기호로 바뀝니다. */
type StateShape = "calm" | "ripple" | "spike" | "stop";

interface Level {
  name: string;
  shape: StateShape;
  /** 막대 채움 — 틸·주황·빨강 세 톤만 씁니다(색 남발 금지). */
  fill: string;
  text: string;
}

function levelOf(ratio: number, crisis: boolean): Level {
  if (crisis)
    return { name: "위기 상태", shape: "stop", fill: "bg-danger", text: "text-danger-ink" };
  if (ratio <= 0.2)
    return { name: "낮음", shape: "calm", fill: "bg-brand-600", text: "text-brand-800" };
  if (ratio <= 0.45)
    return { name: "조금 높음", shape: "ripple", fill: "bg-brand-600", text: "text-brand-800" };
  if (ratio <= 0.65)
    return { name: "높음", shape: "spike", fill: "bg-warn", text: "text-warn-ink" };
  if (ratio <= 0.85)
    return { name: "많이 높음", shape: "spike", fill: "bg-warn", text: "text-warn-ink" };
  return { name: "위기 근접", shape: "spike", fill: "bg-danger", text: "text-danger-ink" };
}

/**
 * 상태 마크 — 아이콘 시스템과 같은 규격(24×24 · stroke 1.75 · round cap/join · fill none)으로
 * 이 파일 안에서만 그립니다. 공용 아이콘 폴더에 새 파일을 만들지 않습니다.
 */
function StateMark({ shape, className }: { shape: StateShape; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cx("shrink-0", className)}
    >
      {shape === "calm" && <path d="M3.4 12h17.2" />}
      {shape === "ripple" && <path d="M3.4 13.4 7.7 10.6 12 13.4 16.3 10.6 20.6 13.4" />}
      {shape === "spike" && <path d="M3.4 16.6 7.7 7.4 12 16.6 16.3 7.4 20.6 16.6" />}
      {shape === "stop" && (
        <>
          <circle cx="12" cy="12" r="8.2" />
          <path d="M8.1 12h7.8" />
        </>
      )}
    </svg>
  );
}

/**
 * 초조도·긴장도 게이지.
 * 막대는 얇게, 색은 틸·주황·빨강 세 톤으로만 갑니다 — 값이 아니라 방향을 읽는 장치입니다.
 * max가 8 이하면 칸 단위 막대(읽기 쉬움), 그보다 크면 연속 막대로 그립니다.
 *
 * 크기 체계(§3): 게이지는 UI 크롬이므로 라벨·상태어 15px입니다.
 * 접근성 코어 예외는 코어 콘텐츠(대사·CUE·응급 자막·CTA)에만 적용되며 여기에는 해당하지 않습니다.
 *
 * @example <Gauge value={3} max={5} label="초조도" crisisAt={5} />
 * @example <Gauge value={3} max={5} label="초조도" crisisAt={5} showStateMark />
 */
export function Gauge({
  value,
  max,
  label,
  crisisAt,
  showValue = false,
  showStateMark = false,
  className,
}: GaugeProps) {
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
      <div className="mb-2 flex items-center justify-between gap-3">
        {/* 게이지는 UI 크롬입니다 — 라벨·상태어 모두 15px로 두고, 주인공 자리를 비웁니다(§3). */}
        <span className="chim-label font-bold text-ink">{label}</span>
        <span className={cx("chim-label inline-flex items-center gap-1.5 font-bold", level.text)}>
          {showStateMark && <StateMark shape={level.shape} className="h-[18px] w-[18px]" />}
          {level.name}
          {showValue && (
            <span className="chim-num chim-caption ml-0.5 font-semibold text-ink-muted">
              {clamped} / {safeMax}
            </span>
          )}
        </span>
      </div>

      {segmented ? (
        <div className="flex gap-[4px]" aria-hidden="true">
          {Array.from({ length: safeMax }, (_, i) => (
            <span
              key={i}
              className={cx(
                "h-[7px] flex-1 rounded-chip transition-colors duration-200 ease-soft",
                i < filled ? level.fill : "bg-neutral-line",
              )}
            />
          ))}
        </div>
      ) : (
        <div className="h-[7px] w-full overflow-hidden rounded-chip bg-neutral-line">
          <span
            aria-hidden="true"
            className={cx(
              "block h-full origin-left rounded-chip transition-[width] duration-200 ease-soft",
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
