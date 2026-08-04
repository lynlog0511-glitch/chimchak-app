import { cx } from "./utils";

export interface AiBadgeProps {
  className?: string;
  /** 짧은 표기가 필요할 때(말풍선 안 등) "AI 생성"만 노출 */
  compact?: boolean;
}

/**
 * AI가 만든 대사임을 알리는 고정 배지.
 * 안전 규칙: AI 대사에는 항상 이 배지와 "가상 인물" 고지가 붙습니다.
 */
export function AiBadge({ className, compact = false }: AiBadgeProps) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-chip border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-sm font-semibold text-brand-800",
        className,
      )}
    >
      <span aria-hidden="true" className="text-brand-600">
        ◆
      </span>
      {compact ? "AI 생성" : "AI 생성 · 가상 인물"}
    </span>
  );
}

export default AiBadge;
