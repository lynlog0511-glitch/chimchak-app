import { cx } from "../utils";

/* ─────────────────────────────────────────────────────────────
   랜딩 통계용 미니 차트 — 순수 SVG (외부 라이브러리·CDN 0건)

   왜곡을 막기 위한 규칙
   · 축은 언제나 0에서 시작합니다. 잘라낸 축·잘린 막대를 만들지 않습니다.
   · 같은 그림 안의 막대는 반드시 같은 축을 씁니다(비교 대상이 아니면 같이 그리지 않습니다).
   · 눈금과 단위를 항상 함께 적고, 100%가 무엇인지 밑에 한 줄로 밝힙니다.
   · 도형이 값을 혼자 전달하지 않습니다 — 모든 수치는 옆의 텍스트로도 읽힙니다.
     그래서 SVG는 aria-hidden이고, 스크린리더는 텍스트만 읽습니다(중복 낭독 방지).

   색·글자
   · 잉크 + 틸 + 주황 3색 이내.
   · 막대 색은 흰 지면 대비 3:1을 넘는 값만 씁니다 — brand-600 3.7:1 · warn-ink 4.9:1.
     (warn #E8833A는 2.6:1로 도형 기준에 못 미쳐 막대에는 쓰지 않습니다.)
   · 눈금 글자는 SVG가 아니라 HTML로 둡니다. SVG 안에 넣으면 좁은 화면에서 함께
     축소되어 15px 아래로 내려갑니다.
   ───────────────────────────────────────────────────────────── */

/** 천 단위 구분 — 서버·브라우저가 같은 결과를 내도록 로케일 API를 쓰지 않습니다. */
export function formatNumber(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export interface AxisTick {
  /** 축 위 위치 (0~100, 백분율) */
  pos: number;
  label: string;
}

/**
 * 두 차트가 공유하는 가로 축.
 * 눈금선은 SVG, 눈금 글자는 HTML(절대 위치)로 그려 어느 폭에서도 15px을 지킵니다.
 */
function ChartAxis({ ticks, unit }: { ticks: AxisTick[]; unit: string }) {
  const last = ticks.length - 1;

  return (
    <div className="mt-2">
      {/* overflow-visible: 양 끝 눈금선이 반만 그려져 흐려 보이는 것을 막습니다. */}
      <svg width="100%" height="7" className="block overflow-visible" aria-hidden="true">
        <line x1="0" y1="0.5" x2="100%" y2="0.5" strokeWidth={1} className="stroke-line-strong" />
        {ticks.map((t) => (
          <line
            key={t.pos}
            x1={`${t.pos}%`}
            y1="0.5"
            x2={`${t.pos}%`}
            y2="6.5"
            strokeWidth={1}
            className="stroke-line-strong"
          />
        ))}
      </svg>

      <div className="relative mt-1 h-6">
        {ticks.map((t, i) => (
          <span
            key={t.pos}
            className="chim-caption chim-num absolute top-0 font-semibold whitespace-nowrap text-ink-muted"
            style={{
              left: `${t.pos}%`,
              transform:
                i === 0 ? undefined : i === last ? "translateX(-100%)" : "translateX(-50%)",
            }}
          >
            {t.label}
            {i === last && unit}
          </span>
        ))}
      </div>
    </div>
  );
}

export interface ShareBarChartProps {
  /** 채움 비율 (0~100) */
  percent: number;
  /** 채운 막대가 무엇인지 — 값과 단위를 그대로 적습니다. */
  fillLabel: string;
  /** 비교 시점 표시선 (0~100). 없으면 그리지 않습니다. */
  markPercent?: number;
  markLabel?: string;
  /** 전체(100%)가 무엇인지 밝히는 한 줄 — 축 기준 명시. */
  baseNote: string;
  /** 눈금(%) — 기본 0·25·50·75·100 */
  ticks?: number[];
  className?: string;
}

/**
 * 비율 막대 — 전체 100% 위에 부분을 채우고, 이전 시점을 점선으로 표시합니다.
 * 축이 0~100%로 고정이라 눈금을 잘라 과장할 여지가 없습니다.
 *
 * @example
 * <ShareBarChart percent={22.9} fillLabel="22.9% · 698,521명" markPercent={24.8} markLabel="6년 전 24.8%" baseNote="…" />
 */
export function ShareBarChart({
  percent,
  fillLabel,
  markPercent,
  markLabel,
  baseNote,
  ticks = [0, 25, 50, 75, 100],
  className,
}: ShareBarChartProps) {
  const pct = Math.min(100, Math.max(0, percent));
  const mark =
    typeof markPercent === "number" ? Math.min(100, Math.max(0, markPercent)) : undefined;

  return (
    <div className={cx("w-full", className)}>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="chim-num text-lg font-extrabold text-brand-800">{fillLabel}</p>
        {markLabel && (
          <p className="chim-num chim-caption font-bold text-warn-ink">{markLabel}</p>
        )}
      </div>

      <svg width="100%" height="40" className="mt-2 block" aria-hidden="true">
        <rect x="0" y="0" width="100%" height="40" rx="4" className="fill-paper-2" />
        <rect x="0" y="0" width={`${pct}%`} height="40" rx="4" className="fill-brand-600" />
        {mark !== undefined && (
          <line
            x1={`${mark}%`}
            y1="0"
            x2={`${mark}%`}
            y2="40"
            strokeWidth={2.5}
            strokeDasharray="4 3"
            className="stroke-warn-ink"
          />
        )}
      </svg>

      <ChartAxis ticks={ticks.map((t) => ({ pos: t, label: String(t) }))} unit="%" />

      <p className="chim-caption mt-1 leading-relaxed text-ink-muted">{baseNote}</p>
    </div>
  );
}

export interface ScaleBarDatum {
  label: string;
  value: number;
  /** brand=틸(현재 있는 것) · warn=주황(모자란 것) */
  tone: "brand" | "warn";
}

export interface ScaleBarChartProps {
  bars: ScaleBarDatum[];
  /** 축 최댓값 — 모든 막대가 이 축 하나를 공유합니다. */
  axisMax: number;
  /** 눈금 값(축과 같은 단위). 첫 값은 0으로 둡니다. */
  ticks: number[];
  /** 단위 표기 (예: "명") */
  unit: string;
  /** 축 기준을 밝히는 한 줄 */
  baseNote: string;
  className?: string;
}

/**
 * 같은 축을 공유하는 가로 막대 몇 개.
 * 축 최댓값을 밖에서 받기 때문에, 값에 맞춰 축을 늘였다 줄였다 하지 않습니다.
 *
 * @example
 * <ScaleBarChart axisMax={800000} ticks={[0, 400000, 800000]} unit="명" bars={[…]} baseNote="…" />
 */
export function ScaleBarChart({
  bars,
  axisMax,
  ticks,
  unit,
  baseNote,
  className,
}: ScaleBarChartProps) {
  const max = Math.max(1, axisMax);

  return (
    <div className={cx("w-full", className)}>
      {bars.map((bar) => {
        const width = Math.min(100, Math.max(0, (bar.value / max) * 100));
        return (
          <div key={bar.label} className="mt-5 first:mt-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="text-base font-bold text-ink">{bar.label}</p>
              <p
                className={cx(
                  "chim-num text-base font-extrabold",
                  bar.tone === "brand" ? "text-brand-800" : "text-warn-ink",
                )}
              >
                {formatNumber(bar.value)}
                {unit}
              </p>
            </div>

            <svg width="100%" height="22" className="mt-1.5 block" aria-hidden="true">
              <rect x="0" y="0" width="100%" height="22" rx="3" className="fill-paper-2" />
              <rect
                x="0"
                y="0"
                width={`${width}%`}
                height="22"
                rx="3"
                className={bar.tone === "brand" ? "fill-brand-600" : "fill-warn-ink"}
              />
            </svg>
          </div>
        );
      })}

      <ChartAxis
        ticks={ticks.map((t) => ({ pos: (t / max) * 100, label: formatNumber(t) }))}
        unit={unit}
      />

      <p className="chim-caption mt-1 leading-relaxed text-ink-muted">{baseNote}</p>
    </div>
  );
}
