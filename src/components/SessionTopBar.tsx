import type { ReactNode } from "react";
import Link from "next/link";
import { StatusDot, type StatusTone } from "./StatusDot";
import { cx } from "./utils";

export interface SessionTopBarProps {
  /** 상황 제목 — 16px w700 */
  title: string;
  /** 상태 점 옆 한 줄 — 「대화 단계 · AI는 어르신 역만 맡습니다」 */
  status?: ReactNode;
  /** 상태 점 색 (기본 brand) */
  statusTone?: StatusTone;
  /** 뒤로 갈 곳 — 주면 링크, 없고 `onBack`이 있으면 버튼, 둘 다 없으면 화살표를 그리지 않습니다. */
  backHref?: string;
  /** 클라이언트 컴포넌트에서만 넘기세요. */
  onBack?: () => void;
  /** 뒤로 버튼의 스크린리더 라벨 */
  backLabel?: string;
  /**
   * 우측 액션 — 시안의 「종료」.
   * 스타일은 이렇게 맞추세요(눌림 상태까지 한 벌입니다):
   * `className="-mr-2 flex min-h-[48px] items-center rounded-field px-2 text-[0.8438rem] font-semibold text-ink-muted transition-colors duration-150 active:bg-paper-2"`
   */
  action?: ReactNode;
  className?: string;
}

/**
 * 세션 화면의 컴팩트 상단 바 (v4 §3 · 시안 4a·4b).
 *
 * `‹ 뒤로` + 제목 16px w700 + 상태 점 부제 + 우측 액션.
 * 목록 화면의 22px 제목(`ScreenHeader`)과 달리, 세션에서는 **대사가 주인공**이라 헤더를 낮춥니다.
 * 좌우 여백은 부모가 줍니다(세션은 18px).
 *
 * @example
 * <SessionTopBar
 *   title="집에 가야 해요"
 *   status="대화 단계 · AI는 어르신 역만 맡습니다"
 *   backHref="/train"
 *   action={<button type="button" onClick={end} className="-mr-2 flex min-h-[48px] items-center rounded-field px-2 text-[0.8438rem] font-semibold text-ink-muted transition-colors duration-150 active:bg-paper-2">종료</button>}
 * />
 */
export function SessionTopBar({
  title,
  status,
  statusTone = "brand",
  backHref,
  onBack,
  backLabel = "뒤로",
  action,
  className,
}: SessionTopBarProps) {
  const backClass =
    "-ml-[14px] flex h-12 w-12 flex-none items-center justify-center rounded-field text-[1.0625rem] leading-[1.3] text-ink-soft transition-colors duration-150 active:bg-paper-2";

  return (
    <header className={cx("flex items-center pt-1.5 pb-3", className)}>
      {backHref ? (
        <Link href={backHref} aria-label={backLabel} onClick={onBack} className={backClass}>
          <span aria-hidden>‹</span>
        </Link>
      ) : onBack ? (
        <button type="button" aria-label={backLabel} onClick={onBack} className={backClass}>
          <span aria-hidden>‹</span>
        </button>
      ) : null}

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[1rem] leading-[1.3] font-bold tracking-[-0.01em] text-ink">
          {title}
        </h1>
        {status && (
          <p className="mt-[1px] flex items-center gap-[4px] text-[0.7813rem] leading-[1.45] text-ink-muted">
            <StatusDot tone={statusTone} />
            <span className="min-w-0 truncate">{status}</span>
          </p>
        )}
      </div>

      {action && <div className="flex-none">{action}</div>}
    </header>
  );
}

export default SessionTopBar;
