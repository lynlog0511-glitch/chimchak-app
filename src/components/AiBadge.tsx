import { IconAi } from "./icons";
import { cx } from "./utils";

export interface AiBadgeProps {
  className?: string;
  /** 짧은 표기가 필요할 때(말풍선 안 등) "AI 생성"만 노출 */
  compact?: boolean;
}

/**
 * AI가 만든 대사임을 알리는 고정 배지.
 * 안전 규칙: AI 대사에는 항상 이 배지와 "가상 인물" 고지가 붙습니다.
 *
 * 마크는 반짝임(sparkle)이 아니라 절제된 기하 마름모입니다 — 생성형 클리셰를 피합니다.
 *
 * 크기 체계(§3): 13px UI 크롬. 보더 없이 옅은 면 하나로 둡니다 —
 * 이 배지는 말풍선 옆에 상시로 붙기 때문에 선이 있으면 화면이 서식처럼 됩니다(§1-4).
 * 코어 콘텐츠(대사·CUE·응급 자막·CTA)의 18px+ 규칙은 이 배지에 적용되지 않습니다.
 */
export function AiBadge({ className, compact = false }: AiBadgeProps) {
  return (
    <span
      className={cx(
        "chim-caption inline-flex items-center gap-1.5 rounded-chip bg-brand-50 px-2.5 py-0.5 font-semibold text-brand-800",
        className,
      )}
    >
      <IconAi className="h-3.5 w-3.5 text-brand-600" />
      {compact ? "AI 생성" : "AI 생성 · 가상 인물"}
    </span>
  );
}

export default AiBadge;
