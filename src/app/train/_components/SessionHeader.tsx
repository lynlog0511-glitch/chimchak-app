"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { BackGlyph, StatusDot, type StatusTone } from "@/components";
import { cx } from "@/components/utils";

export interface SessionHeaderProps {
  /** 상황 제목 — 16/700 */
  title: string;
  /** 상태 점 옆 한 줄 — 「셋째 상황 · 대화 단계 · AI는 어르신 역만 맡습니다」 */
  status: string;
  /** 상태 점 색 (기본 brand · L3에서 danger) */
  statusTone?: StatusTone;
  /** 뒤로 갈 곳 — 주면 링크, 없고 `onBack`이 있으면 버튼 */
  backHref?: string;
  onBack?: () => void;
  backLabel?: string;
  /** 우측 액션 — 「소리 끄기」·「종료」 */
  action?: ReactNode;
  className?: string;
}

/**
 * 세션 상단 바 — 두 줄입니다(시안 4a).
 *
 * 문서 화면의 `ScreenHeader`와 같은 문법이지만, 세션은 상태 점·「소리 끄기」·「종료」를
 * 자기 헤더에 직접 얹기 때문에 화면이 자기 헤더를 그립니다.
 * (공용 `SessionTopBar` 조각은 이 헤더가 대신하고 있어 2026-08-25에 파일째 지웠습니다.)
 *
 * 2026-08-25: md↑ 한 줄 배치(시안 7d — 제목·부제 인라인 + 헤더 안 150px 진행바)를 걷어냈습니다.
 * 진행바는 어느 폭에서도 헤더 **아래** 전폭 한 줄입니다(`TrainSession`이 직접 세웁니다).
 */
export function SessionHeader({
  title,
  status,
  statusTone = "brand",
  backHref,
  onBack,
  backLabel = "뒤로",
  action,
  className,
}: SessionHeaderProps) {
  /* ‹ 글리프 자체는 `BackGlyph`가 한 벌로 들고 있습니다(라벨 옆 17px / 단독 19px · ink-soft).
     여기는 라벨 없이 혼자 서는 아이콘 버튼이라 `solo`입니다. */
  const backClass =
    "-ml-[14px] flex h-12 w-12 flex-none items-center justify-center rounded-field transition-colors duration-150 active:bg-paper-2";

  return (
    <header className={cx("flex items-start pt-1.5 pb-3", className)}>
      {backHref ? (
        <Link href={backHref} aria-label={backLabel} onClick={onBack} className={backClass}>
          <BackGlyph size="solo" />
        </Link>
      ) : onBack ? (
        <button type="button" aria-label={backLabel} onClick={onBack} className={backClass}>
          <BackGlyph size="solo" />
        </button>
      ) : null}

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[1rem] leading-[1.3] font-bold tracking-[-0.01em] text-ink">
          {title}
        </h1>
        {/* 「AI는 어르신 역만 맡습니다」는 이 제품의 방어 논리입니다 —
            390px에서 잘리지 않도록 두 줄까지 허용합니다. */}
        <p className="mt-[1px] flex min-w-0 items-start gap-[4px] text-[0.7813rem] leading-[1.45] text-ink-muted">
          <StatusDot tone={statusTone} className="relative top-[4px]" />
          <span className="min-w-0">{status}</span>
        </p>
      </div>

      {action && <div className="flex-none whitespace-nowrap">{action}</div>}
    </header>
  );
}

export default SessionHeader;
