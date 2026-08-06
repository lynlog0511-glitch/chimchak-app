import type { ReactNode } from "react";
import type { SourceDoc } from "@/types";
import { EyebrowLabel } from "./EyebrowLabel";
import { SourceDocsProvider } from "./SourceDocsContext";
import { TabBar } from "./TabBar";
import { TopNav } from "./TopNav";
import type { TabKey } from "./navItems";
import { DEFAULT_SOURCE_DOCS } from "./sourceDocsDefault";
import { cx } from "./utils";

export interface PageShellProps {
  children: ReactNode;

  /* ── v4 앱 프레임 ─────────────────────────────────────────── */
  /** 하단 탭바 노출 (기본 true). 세션·전체화면 재생기처럼 이동을 막는 화면에서 false. md↑에서는 자동으로 숨습니다. */
  tabBar?: boolean;
  /**
   * md↑ 상단 가로 네비 노출 (기본 true · 시안 7c).
   * 세션(7d)처럼 **자체 헤더가 상단을 차지하는 화면**에서만 false로 끕니다.
   * 모바일에는 애초에 나타나지 않습니다.
   */
  topNav?: boolean;
  /**
   * md↑에서 본문을 읽기 폭(560px)으로 좁혀 960 프레임 안 가운데 둘지 (기본 true).
   * 목록형 화면(응급·기록·성장·훈련 목록…)의 기본값이고,
   * **홈(7c)·세션(7d)처럼 960 전폭 2단 레이아웃을 직접 짜는 화면은 `narrow={false}`** 로 끕니다.
   * `fill`(세션)에서는 무시됩니다 — 그 화면은 폭을 스스로 잡습니다.
   */
  narrow?: boolean;
  /**
   * 좌우 여백 20px (기본 true). 세션처럼 18px을 쓰거나 전폭 요소가 있으면 false.
   * md↑에서 `narrow={false}`(960 전폭)인 화면만 40px로 넓어집니다 — 시안 7c.
   */
  pad?: boolean;
  /** 뷰포트에 고정하고 본문만 스크롤 — 하단 입력 도크가 있는 세션 화면용. */
  fill?: boolean;
  /** 활성 탭 강제 지정 — 경로로 판정되지 않는 화면에서만 씁니다. */
  activeTab?: TabKey;
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
  /** @deprecated `narrow={false}`와 같습니다(md↑ 960 전폭). */
  wide?: boolean;
  /** @deprecated `pad={false}`와 같습니다. */
  bleed?: boolean;
  /** @deprecated 제목 옆 액션은 `ScreenHeader`의 action으로. */
  headerSlot?: ReactNode;
}

/**
 * 앱 셸 — 화면 하나의 껍데기입니다 (v4 §0 · 가이드 §5).
 *
 * **모바일(<md)**: v4 그대로입니다 — 전폭 흰 화면 + 문서 흐름 안 sticky 하단 탭바.
 * **데스크톱(md↑, 시안 7c·7d)**: 하단 탭바를 접고 **상단 가로 네비 + 960px 중앙 프레임**이 됩니다.
 * 목록형 화면은 그 안에서 다시 560px 읽기 폭으로 좁힙니다(`narrow`) — 한 줄이 40자를 넘지 않게.
 * 홈·세션처럼 2단 레이아웃을 직접 짜는 화면만 `narrow={false}`로 960 전폭을 씁니다.
 *
 * 전역 헤더·전역 고지 바는 여전히 없습니다 — 각 화면이 `ScreenHeader`/`SessionTopBar`와
 * `InlineDisclaimer`를 **반드시 한 번** 직접 넣습니다.
 *
 * @example 목록 화면 (기본값)
 * <PageShell>
 *   <ScreenHeader title="응급 안내" subtitle={...} />
 *   ...
 *   <InlineDisclaimer size="md" className="mt-3" />
 * </PageShell>
 *
 * @example 홈 — 데스크톱에서 960 전폭 2단
 * <PageShell narrow={false}>...</PageShell>
 *
 * @example 세션 — 자체 헤더 + 하단 도크 고정
 * <PageShell fill pad={false} tabBar={false} topNav={false}>...</PageShell>
 */
export function PageShell({
  children,
  tabBar = true,
  topNav = true,
  narrow = true,
  activeTab,
  pad,
  fill = false,
  sourceDocs,
  className,
  title,
  eyebrow,
  description,
  wide = false,
  bleed = false,
  headerSlot,
}: PageShellProps) {
  const padded = pad ?? !bleed;
  // fill(세션)은 본문이 스크롤 컨테이너라 가운데 정렬을 화면이 직접 잡습니다 — 여기서 폭을 물리지 않습니다.
  const narrowed = narrow && !wide && !fill;
  const hasLegacyHead = Boolean(title || eyebrow || description || headerSlot);

  return (
    <SourceDocsProvider docs={sourceDocs ?? DEFAULT_SOURCE_DOCS}>
      <div className="chim-frame">
        <div
          className={cx(
            "chim-screen",
            fill && "chim-screen--fill",
            // 상단 네비가 있는 화면에서만 md↑ 하단 탭바를 접습니다(네비가 없으면 탭바가 유일한 이동 수단).
            topNav && "chim-screen--desknav",
          )}
        >
          <a
            href="#chim-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-field focus:bg-brand-700 focus:px-4 focus:py-2 focus:font-bold focus:text-white"
          >
            본문으로 건너뛰기
          </a>

          {topNav && <TopNav active={activeTab} />}

          <main
            id="chim-content"
            className={cx(
              "flex-1",
              fill && "flex min-h-0 flex-col overflow-y-auto overscroll-contain",
              padded && "chim-pad",
              narrowed && "chim-narrow",
              className,
            )}
          >
            {hasLegacyHead && (
              <header className="pt-2 pb-4">
                {eyebrow && <EyebrowLabel className="mb-1">{eyebrow}</EyebrowLabel>}
                {title && (
                  <h1 className="text-[1.375rem] leading-[1.3] font-extrabold tracking-[-0.01em] text-ink">
                    {title}
                  </h1>
                )}
                {description && (
                  <p className="mt-[3px] text-[0.7813rem] leading-[1.45] text-ink-muted">
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
