import type { ReactNode } from "react";
import { cx } from "./utils";

export interface ScreenHeaderProps {
  /** 화면 제목 — 22px w800. 화면당 하나뿐입니다. */
  title: string;
  /**
   * 부제 12.5px — 상태 점을 붙이려면 노드로 넘기세요.
   * @example subtitle={<span className="flex items-center gap-[5px] text-ok-ink"><StatusDot tone="ok" />기기에 저장됨</span>}
   */
  subtitle?: ReactNode;
  /** 우측 액션 — 홈의 「설정」처럼 조용한 텍스트 버튼만 둡니다. */
  action?: ReactNode;
  /** h1이 이미 있는 화면에서 위계를 낮출 때 */
  as?: "h1" | "h2";
  className?: string;
  id?: string;
}

/**
 * 목록 화면 상단 바 (v4 §0 · 시안 5b·5c).
 *
 * 전역 헤더가 사라진 자리를 각 화면이 이 조각으로 채웁니다 — 제목 22px w800 + 부제 12.5px.
 * **좌우 여백은 부모(`PageShell`의 `pad`)가 줍니다** — 여기서는 넣지 않습니다.
 *
 * @example <ScreenHeader title="성장 기록" subtitle="점수와 등급은 없습니다 — 해 본 것과 다시 볼 것만 남깁니다" />
 */
export function ScreenHeader({
  title,
  subtitle,
  action,
  as: Heading = "h1",
  className,
  id,
}: ScreenHeaderProps) {
  return (
    <header className={cx("flex items-start gap-3 pt-2", className)}>
      <div className="min-w-0 flex-1">
        <Heading
          id={id}
          className="text-[1.375rem] leading-[1.3] font-extrabold tracking-[-0.01em] text-ink"
        >
          {title}
        </Heading>
        {subtitle && (
          <div className="mt-[3px] text-[0.7813rem] leading-[1.5] text-ink-muted">{subtitle}</div>
        )}
      </div>
      {action && <div className="flex-none">{action}</div>}
    </header>
  );
}

export default ScreenHeader;
