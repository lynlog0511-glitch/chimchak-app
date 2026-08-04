/**
 * 침착 일러스트·차트 배럴.
 *
 * 여기에는 "그림"만 둡니다 — 아이콘은 `@/components/icons`, UI 부품은 `@/components`입니다.
 * 전부 외부 라이브러리 없이 SVG로 직접 그리며, 이미지 파일·CDN을 쓰지 않습니다.
 *
 * @example
 * import { ShareBarChart, ScaleBarChart } from "@/components/illustrations";
 */

export { ShareBarChart, ScaleBarChart, formatNumber } from "./MiniChart";
export type {
  ShareBarChartProps,
  ScaleBarChartProps,
  ScaleBarDatum,
  AxisTick,
} from "./MiniChart";
