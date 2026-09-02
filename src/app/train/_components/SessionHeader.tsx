"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { BackGlyph, type StatusTone } from "@/components";
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
  const backClass =
    "flex h-12 min-w-[68px] items-center gap-1 rounded-field px-1 text-[0.9375rem] font-bold text-ink transition-colors duration-150 active:bg-paper-2";

  return (
    <header
      className={cx(
        "grid grid-cols-[auto_1fr_auto] items-center gap-1 border-b border-line py-2",
        className,
      )}
    >
      {backHref ? (
        <Link href={backHref} onClick={onBack} className={backClass}>
          <BackGlyph size="inline" />
          <span>{backLabel}</span>
        </Link>
      ) : onBack ? (
        <button type="button" onClick={onBack} className={backClass}>
          <BackGlyph size="inline" />
          <span>{backLabel}</span>
        </button>
      ) : null}

      <div className="min-w-0 text-center">
        <h1 className="sr-only">{title}</h1>
        <p
          className={cx(
            "text-[0.9375rem] font-bold",
            statusTone === "danger" ? "text-danger-ink" : "text-ink-soft",
          )}
        >
          {status}
        </p>
      </div>

      {action && <div className="flex-none whitespace-nowrap">{action}</div>}
    </header>
  );
}

export default SessionHeader;
