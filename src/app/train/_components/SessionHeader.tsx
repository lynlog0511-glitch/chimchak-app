"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { StatusDot, type StatusTone } from "@/components";
import { cx } from "@/components/utils";
import { SessionProgressBar } from "./SessionProgressBar";

export interface SessionHeaderProps {
  /** 상황 제목 — 모바일 16/700, 데스크톱 15.5/700 */
  title: string;
  /** 상태 점 옆 한 줄 — 「셋째 상황 · 대화 단계 · AI는 어르신 역만 맡습니다」 */
  status: string;
  /** 상태 점 색 (기본 brand · L3에서 danger) */
  statusTone?: StatusTone;
  /** 뒤로 갈 곳 — 주면 링크, 없고 `onBack`이 있으면 버튼 */
  backHref?: string;
  onBack?: () => void;
  backLabel?: string;
  /** 진행 위치 — md↑ 헤더 오른쪽에 150px 진행바로 섭니다 (시안 7d) */
  progress: { index: number; total: number };
  /** 우측 액션 — 「소리 끄기」·「종료」 */
  action?: ReactNode;
  className?: string;
}

/**
 * 세션 상단 바 — 모바일은 두 줄(시안 4a), md↑는 **한 줄**입니다(시안 7d).
 *
 * `SessionTopBar`(공유 조각)와 같은 문법이지만, 데스크톱에서 제목·부제를 인라인으로 붙이고
 * 진행바를 헤더 안으로 들여오기 위해 세션 화면이 자기 헤더를 직접 그립니다.
 * 같은 내용을 두 벌 렌더해 스크린리더에 두 번 읽히는 일이 없도록 **마크업은 하나**이고,
 * 배치만 반응형으로 바뀝니다.
 */
export function SessionHeader({
  title,
  status,
  statusTone = "brand",
  backHref,
  onBack,
  backLabel = "뒤로",
  progress,
  action,
  className,
}: SessionHeaderProps) {
  const backClass =
    "-ml-[14px] flex h-12 w-12 flex-none items-center justify-center text-[1.375rem] leading-none text-ink-soft md:mr-1 md:text-[1.25rem]";

  return (
    <header className={cx("flex items-start pt-1.5 pb-3 md:items-center md:py-2", className)}>
      {backHref ? (
        <Link href={backHref} aria-label={backLabel} onClick={onBack} className={backClass}>
          <span aria-hidden>‹</span>
        </Link>
      ) : onBack ? (
        <button type="button" aria-label={backLabel} onClick={onBack} className={backClass}>
          <span aria-hidden>‹</span>
        </button>
      ) : null}

      <div className="min-w-0 flex-1 md:flex md:items-baseline md:gap-2">
        <h1 className="truncate text-[1rem] leading-[1.35] font-bold tracking-[-0.01em] text-ink md:shrink-0 md:text-[0.9688rem]">
          {title}
        </h1>
        {/* 「AI는 어르신 역만 맡습니다」는 이 제품의 방어 논리입니다 —
            390px에서 잘리지 않도록 모바일에서는 두 줄까지 허용합니다(md↑ 한 줄 유지). */}
        <p className="mt-[1px] flex min-w-0 items-start gap-[5px] text-[0.7813rem] leading-[1.4] text-ink-muted md:mt-0 md:items-center">
          <StatusDot tone={statusTone} className="relative top-[4px] md:top-0" />
          <span className="min-w-0 md:truncate">{status}</span>
        </p>
      </div>

      {/* 진행바 — 모바일에서는 헤더 아래 전폭으로 따로 섭니다(시안 4a). */}
      <div className="mr-2 ml-4 hidden w-[150px] flex-none md:block">
        <SessionProgressBar index={progress.index} total={progress.total} />
      </div>

      {action && <div className="flex-none whitespace-nowrap">{action}</div>}
    </header>
  );
}

export default SessionHeader;
