import type { ReactNode } from "react";
import type { SourceDoc } from "@/types";
import { AppHeader } from "./AppHeader";
import { DisclaimerBar } from "./DisclaimerBar";
import { SourceDocsProvider } from "./SourceDocsContext";
import { DEFAULT_SOURCE_DOCS } from "./sourceDocsDefault";
import { cx } from "./utils";

export interface PageShellProps {
  /** 페이지 제목 — 주면 본문 상단에 h1으로 렌더링합니다. */
  title?: string;
  /** 제목 위 작은 라벨 */
  eyebrow?: string;
  /** 제목 아래 한 줄 설명 */
  description?: string;
  children: ReactNode;
  /** 본문 폭 확장 (표가 넓은 페이지용) */
  wide?: boolean;
  /** 컨테이너 없이 전체 폭을 직접 다루고 싶을 때 (랜딩처럼 섹션마다 배경이 다른 경우) */
  bleed?: boolean;
  /** 근거 문서 목록 주입 — 주지 않으면 기본 목록을 사용합니다. */
  sourceDocs?: readonly SourceDoc[];
  className?: string;
  /** 본문 상단 우측 등에 놓을 요소 (예: 119 버튼) */
  headerSlot?: ReactNode;
}

/**
 * 모든 페이지의 공통 껍데기.
 * 상단 네비 + 본문 컨테이너 + 하단 고정 고지 바(+모바일 하단 탭바)를 포함합니다.
 *
 * @example
 * <PageShell title="응급 프로토콜" description="검수된 고정 안내입니다.">
 *   ...
 * </PageShell>
 */
export function PageShell({
  title,
  eyebrow,
  description,
  children,
  wide = false,
  bleed = false,
  sourceDocs,
  className,
  headerSlot,
}: PageShellProps) {
  const hasHead = Boolean(title || eyebrow || description || headerSlot);

  return (
    <SourceDocsProvider docs={sourceDocs ?? DEFAULT_SOURCE_DOCS}>
      <a
        href="#chim-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-field focus:bg-brand-700 focus:px-4 focus:py-2 focus:font-bold focus:text-white"
      >
        본문으로 건너뛰기
      </a>

      <AppHeader />

      <main id="chim-content" className={cx("chim-main min-h-[60vh]", className)}>
        {bleed ? (
          children
        ) : (
          <div className={cx("chim-container pt-7 pb-10 md:pt-10", wide && "max-w-[80rem]")}>
            {hasHead && (
              <header className="mb-7 md:mb-9">
                {eyebrow && (
                  <p className="mb-2 text-sm font-bold tracking-wide text-brand-700 uppercase">
                    {eyebrow}
                  </p>
                )}
                {title && (
                  <h1 className="text-2xl font-extrabold text-ink md:text-4xl">{title}</h1>
                )}
                {description && (
                  <p className="mt-3 max-w-3xl text-base leading-relaxed text-ink-soft md:text-lg">
                    {description}
                  </p>
                )}
                {headerSlot && <div className="mt-5">{headerSlot}</div>}
              </header>
            )}
            {children}
          </div>
        )}
      </main>

      <DisclaimerBar />
    </SourceDocsProvider>
  );
}

export default PageShell;
