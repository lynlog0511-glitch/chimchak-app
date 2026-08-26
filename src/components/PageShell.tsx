import type { ReactNode } from "react";
import type { SourceDoc } from "@/types";
import { EyebrowLabel } from "./EyebrowLabel";
import { SourceDocsProvider } from "./SourceDocsContext";
import { TabBar } from "./TabBar";
import type { TabKey } from "./navItems";
import { DEFAULT_SOURCE_DOCS } from "./sourceDocsDefault";
import { cx } from "./utils";

export interface PageShellProps {
  children: ReactNode;

  /* ── v4 앱 프레임 ─────────────────────────────────────────── */
  /** 하단 탭바 노출 (기본 true). 세션·전체화면 재생기처럼 이동을 막는 화면에서만 false.
      **뷰포트로는 접히지 않습니다** — 어느 폭에서도 이 앱의 유일한 이동 수단입니다. */
  tabBar?: boolean;
  /**
   * @deprecated 아무 일도 하지 않습니다.
   * 데스크톱 상단 가로 네비(시안 7c)는 2026-08-25 전 뷰포트 앱 프레임 확정과 함께 없앴습니다 —
   * 이동은 어느 폭에서도 하단 탭바 하나가 맡습니다. 넘겨도 무해하도록 prop만 남깁니다.
   */
  topNav?: boolean;
  /**
   * @deprecated 아무 일도 하지 않습니다.
   * 읽기 폭(560px)은 960px 프레임이 있던 시절의 개념입니다. 지금은 프레임 자체가 430px이라
   * 한 줄이 40자를 넘지 않고, 폭은 프레임이 잡습니다. 넘겨도 무해하도록 prop만 남깁니다.
   */
  narrow?: boolean;
  /** 좌우 여백 20px (기본 true). 세션처럼 18px을 쓰거나 전폭 요소가 있으면 false.
      전 뷰포트 한 값입니다. */
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
     새 화면에서는 쓰지 마세요. 상단 바는 화면이 직접 `ScreenHeader`로 그립니다
     (세션만 자기 `SessionHeader`를 씁니다). */
  /** @deprecated `ScreenHeader`를 화면에서 직접 쓰세요. 주면 최소한의 제목만 그립니다. */
  title?: string;
  /** @deprecated `EyebrowLabel`을 쓰세요. */
  eyebrow?: string;
  /** @deprecated `ScreenHeader`의 subtitle을 쓰세요. */
  description?: string;
  /** @deprecated 아무 일도 하지 않습니다(`narrow`와 함께 폐기). */
  wide?: boolean;
  /** @deprecated `pad={false}`와 같습니다. */
  bleed?: boolean;
  /** @deprecated 제목 옆 액션은 `ScreenHeader`의 action으로. */
  headerSlot?: ReactNode;
}

/**
 * 앱 셸 — 화면 하나의 껍데기입니다 (v4 §0 · 가이드 §5).
 *
 * **화면은 어느 뷰포트에서도 같은 앱입니다**(2026-08-25 확정). 웹 셸로 변신하지 않습니다.
 * · 좁은 폭(<480px): 전폭 흰 화면 + 문서 흐름 안 sticky 하단 탭바.
 * · 480px↑: 같은 화면이 지면 위 가운데 **430px 세로 기둥**으로 서고, 좌우는 hairline 1px입니다.
 *   그림자·베젤·폰 목업은 없습니다. 탭바는 그대로 섭니다 — 접히는 뷰포트가 없습니다.
 * 폭은 프레임이 잡으므로 화면 안에서는 뷰포트 분기(읽기 폭·2단)를 쓰지 않습니다.
 *
 * 전역 헤더·전역 고정 고지 바는 여전히 없습니다 — 각 화면이 `ScreenHeader`(세션은 `SessionHeader`)와
 * `InlineDisclaimer`를 **반드시 한 번** 직접 넣습니다.
 *
 * @example 목록 화면 (기본값)
 * <PageShell>
 *   <ScreenHeader title="응급 안내" subtitle={...} />
 *   ...
 *   <InlineDisclaimer size="md" className="mt-3" />
 * </PageShell>
 *
 * @example 세션 — 자체 헤더 + 하단 도크 고정
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
          {/* 이 링크는 **모든 화면의 첫 Tab 스톱**입니다 — 그래서 앱 안에 서야 합니다.
              한동안 `focus:absolute focus:top-2 focus:left-2`였는데, 조상 어디에도 위치 지정
              요소가 없어(`.chim-frame`·`.chim-screen`에 `position` 선언이 없습니다) 컨테이닝
              블록이 초기 컨테이닝 블록(뷰포트)이 됐습니다. 480px↑에서 화면은 가운데 430px
              기둥이므로, 링크만 창 왼쪽 위 — 앱에서 수백 px 떨어진 회색 지면 위에 떴습니다
              (5차 페르소나 UI/UX med). 설정 팝오버를 「창이 아니라 화면(`.chim-screen`)에
              맞춘다」로 되돌린 것과 **같은 종류**의 탈주였습니다.

              고치는 방법은 `absolute`를 걷는 것입니다 — `not-sr-only`가 만드는 정상 흐름
              배치를 그대로 쓰면 링크는 화면의 첫 자식으로 서고, 프레임을 벗어날 길이 아예
              없어집니다(조상에 `position`을 새로 주는 쪽은 이 앱의 sticky·fixed 요소 전부의
              기준선을 함께 옮기므로 고르지 않았습니다).
              `.chim-screen`이 세로 flex라 `self-start`가 없으면 알약이 전폭으로 늘어나고,
              여백 `m-2`는 예전 `top-2 left-2`와 같은 8px입니다 — margin·padding 유틸리티는
              둘 다 `not-sr-only`보다 뒤에 등록되므로 그쪽의 `margin: 0`을 덮습니다.
              초점을 받았을 때만 한 줄 자리를 차지하고, 벗어나면 다시 `sr-only`로 접힙니다. */}
          <a
            href="#chim-content"
            className="sr-only focus:not-sr-only focus:z-50 focus:m-2 focus:self-start focus:rounded-field focus:bg-brand-700 focus:px-4 focus:py-2 focus:font-bold focus:text-paper"
          >
            본문으로 건너뛰기
          </a>

          <main
            id="chim-content"
            /* 프래그먼트 이동(`#chim-content`)의 목적지가 **초점을 받을 수 있어야** 합니다.
               `href="#..."`는 스크롤과 「순차 초점 시작점」만 옮기고 초점 자체는 옮기지 않으며,
               Safari는 이 자리에서 시작점도 옮기지 않는 것으로 오래 알려져 있습니다 — 이 앱의
               주 배포 형태가 iOS PWA입니다. tabIndex가 없던 동안 「본문으로 건너뛰기」를 눌러도
               다음 Tab이 다시 헤더로 돌아갔고, /legal 절 끝의 「맨 위로」 열둘도 화면만 올리고
               초점은 그 자리에 두었습니다(3차 페르소나 UI/UX low).
               `-1`이라 Tab 순서에는 끼지 않습니다 — 프로그램으로만 닿는 자리입니다.
               `RouteFocus`가 h1에 같은 값을 붙이는 것과 같은 문법이고, 그쪽 main 폴백 경로에서는
               이제 `setAttribute` 한 번이 줄어듭니다. */
            tabIndex={-1}
            className={cx(
              "flex-1",
              fill && "flex min-h-0 flex-col overflow-y-auto overscroll-contain",
              padded && "chim-pad",
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
