import type { ReactNode } from "react";
import { SourceChip } from "./SourceChip";
import { cx } from "./utils";

export interface FeedbackCardProps {
  /** true면 🟢 충족, false면 ⚪ 코칭 (점수·등급은 어떤 경우에도 표시하지 않습니다) */
  ok: boolean;
  message: string;
  docId?: string;
  /** 근거 문서 제목 직접 지정 (데이터 주입 전 화면용) */
  docTitle?: string;
  /** 분기 유형명 등 보조 라벨 */
  label?: string;
  /** ⚑CF(치명적 실패) 표시 — 붉은 톤으로 전환합니다 */
  critical?: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * 턴별 피드백 카드.
 * 표시는 🟢 충족 / ⚪ 코칭 2단계 + 코칭 1문장 + 근거 출처 칩까지입니다.
 *
 * @example <FeedbackCard ok message="감정을 먼저 인정하셨습니다." docId="DOC-GUIDE-001" />
 */
export function FeedbackCard({
  ok,
  message,
  docId,
  docTitle,
  label,
  critical = false,
  className,
  children,
}: FeedbackCardProps) {
  const mark = critical ? "🔴" : ok ? "🟢" : "⚪";
  const heading = critical ? "즉시 중단" : ok ? "충족" : "코칭";
  const box = critical
    ? "border-danger-line bg-danger-soft"
    : ok
      ? "border-ok-line bg-ok-soft"
      : "border-line bg-white";
  const headText = critical ? "text-danger-ink" : ok ? "text-ok-ink" : "text-ink-soft";

  return (
    <div className={cx("rounded-card border p-4 shadow-soft md:p-5", box, className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span aria-hidden="true" className="text-lg leading-none">
          {mark}
        </span>
        <span className={cx("text-base font-extrabold", headText)}>{heading}</span>
        {label && (
          <span className="rounded-chip border border-line bg-white/70 px-2 py-0.5 text-sm font-semibold text-ink-muted">
            {label}
          </span>
        )}
      </div>

      <p className="mt-2 text-base leading-relaxed text-ink">{message}</p>

      {children}

      {docId && (
        <div className="mt-3">
          <SourceChip docId={docId} title={docTitle} />
        </div>
      )}
    </div>
  );
}

export default FeedbackCard;
