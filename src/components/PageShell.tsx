import type { ReactNode } from "react";
import type { SourceDoc } from "@/types";
import { SourceDocsProvider } from "./SourceDocsContext";
import { TabBar, type TabKey } from "./TabBar";
import { DEFAULT_SOURCE_DOCS } from "./sourceDocsDefault";
import { cx } from "./utils";

export interface PageShellProps {
  children: ReactNode;

  /* ── v4 앱 프레임 ─────────────────────────────────────────── */
  /** 하단 탭바 노출 (기본 true). 세션·전체화면 재생기처럼 이동을 막는 화면에서 false. */
  tabBar?: boolean;
  /** 활성 탭 강제 지정 — 경로로 판정되지 않는 화면에서만 씁니다. */
  activeTab?: TabKey;
  /** 좌우 20px 여백 (기본 true). 세션처럼 18px을 쓰거나 전폭 요소가 있으면 false. */
  pad?: boolean;
  /** 뷰포트에 고정하고 본문만 스크롤 — 하단 입력 도크가 있는 세션 화면용. */
  fill?: boolean;
  /** 근거 문서 목록 주입 — 주지 않으면 기본 목록을 사용합니다. */
  sourceDocs?: readonly SourceDoc[];
  /** main에 붙는 클래스 */
  className?: string;

  /* ── 하위 호환 (v3 화면이 아직 넘기는 props) ─────────────────
     새 화면에서는 쓰지 마세요. 상단 바는 화면이 직접 `ScreenHeader`·`SessionTopBar`로 그립니다. */
  /** @deprecated `ScreenHeader`를 화면에서 직접 쓰세요. 주면 최소한의 제목만 그립니다. */
  title?: string;
  /** @deprecated `EyebrowLabel`을 쓰세요. */
  eyebrow?: string;
  /** @deprecated `ScreenHeader`의 subtitle을 쓰세요. */
  description?: string;
  /** @deprecated 앱 프레임은 폭이 고정입니다(430px). 무시됩니다. */
  wide?: boolean;
  /** @deprecated `pad={false}`와 같습니다. */
  bleed?: boolean;
  /** @deprecated 제목 옆 액션은 `ScreenHeader`의 action으로. */
  headerSlot?: ReactNode;
}

/**
 * 앱 셸 — 화면 하나의 껍데기입니다 (v4 §0).
 *
 * v3의 "반응형 웹페이지"(전역 헤더 + 본문 + 전역 고정 고지 바)를 버리고 **모바일 앱 프레임**이 됐습니다.
 * - 모바일 전폭 · md↑ 중앙 컬럼 430px, 컬럼 밖 지면 `#f1f2f0`, 화면 안은 흰색.
 * - 전역 헤더 없음 — 각 화면이 `ScreenHeader`(목록) 또는 `SessionTopBar`(세션)를 직접 그립니다.
 * - 전역 고지 바 없음 — 각 화면이 `InlineDisclaimer`를 **반드시 한 번** 넣습니다.
 * - 하단 탭바는 텍스트 온리 5칸이고 문서 흐름 안 sticky입니다(본문을 가리지 않습니다).
 *
 * @example
 * <PageShell>
 *   <ScreenHeader title="응급 안내" subtitle={...} />
 *   ...
 *   <InlineDisclaimer size="md" className="mt-3" />
 * </PageShell>
 *
 * @example 세션(하단 도크 고정)
 * <PageShell fill pad={false} tabBar={false}>...</PageShell>
 */
export function PageShell({
  children,
  tabBar = true,
  activeTab,
  pad,
  fill = false,
  sourceDocs,
  className,
  title,
  eyebrow,
  description,
  bleed = false,
  headerSlot,
}: PageShellProps) {
  const padded = pad ?? !bleed;
  const hasLegacyHead = Boolean(title || eyebrow || description || headerSlot);

  return (
    <SourceDocsProvider docs={sourceDocs ?? DEFAULT_SOURCE_DOCS}>
      <div className="chim-frame">
        <div className={cx("chim-screen", fill && "chim-screen--fill")}>
          <a
            href="#chim-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-field focus:bg-brand-700 focus:px-4 focus:py-2 focus:font-bold focus:text-white"
          >
            본문으로 건너뛰기
          </a>

          <main
            id="chim-content"
            className={cx(
              "flex-1",
              fill && "flex min-h-0 flex-col overflow-y-auto",
              padded && "chim-pad",
              className,
            )}
          >
            {hasLegacyHead && (
              <header className="pt-2 pb-4">
                {eyebrow && (
                  <p className="mb-1 text-[12px] font-bold tracking-[0.06em] text-ink-muted">
                    {eyebrow}
                  </p>
                )}
                {title && (
                  <h1 className="text-[22px] leading-[1.3] font-extrabold tracking-[-0.01em] text-ink">
                    {title}
                  </h1>
                )}
                {description && (
                  <p className="mt-[3px] text-[12.5px] leading-[1.5] text-ink-muted">
                    {description}
                  </p>
                )}
                {headerSlot && <div className="mt-4">{headerSlot}</div>}
              </header>
            )}
            {children}
          </main>

          {tabBar && <TabBar active={activeTab} />}
        </div>
      </div>
    </SourceDocsProvider>
  );
}

export default PageShell;
