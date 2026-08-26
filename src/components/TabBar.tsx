"use client";

import { useEffect, useRef, type ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconChat,
  IconHistory,
  IconHome,
  IconNote,
  IconSiren,
  type IconProps,
} from "./icons";
import { NAV_ITEMS, matchesNav, type TabKey } from "./navItems";
import { cx } from "./utils";

/** 목록·활성 판정은 `navItems`가 한 곳에서 들고 있습니다. */
export type { TabKey };

/** 칸별 아이콘 — 전부 장식(aria-hidden)이고 의미는 라벨이 전달합니다(§4 아이콘 단독 금지). */
const TAB_ICONS: Record<TabKey, ComponentType<IconProps>> = {
  home: IconHome,
  train: IconChat,
  emergency: IconSiren,
  report: IconNote,
  history: IconHistory,
};

export interface TabBarProps {
  /** 활성 탭 강제 지정 — 경로로 판정되지 않는 화면(상세·리다이렉트)에서 씁니다. */
  active?: TabKey;
  className?: string;
}

/**
 * 하단 탭바 — **아이콘 + 라벨 5칸** (2026-08-25 팀장 지시로 텍스트 온리에서 전환).
 *
 * 아이콘 22px(1.375rem) 위에 라벨 — 아이콘은 언제나 장식이고 의미는 라벨이 전달합니다.
 * 응급 아이콘은 경광등입니다(의료 십자가는 의료기기 아님 경계와 충돌해 쓰지 않습니다).
 *
 * ── 활성 표시 = 채움(2026-08-25) ──────────────────────────────
 * 활성 칸만 아이콘을 **채웁니다**(`filled` — fill=currentColor). iOS 관용법이고,
 * 가이드의 「그림자 없음·면과 헤어라인」 문법과도 어긋나지 않습니다.
 * 예전에는 스트로크를 1.75→2로 올려 활성을 말했는데, 22px에서 0.23px 차이라
 * 1x 화면에서는 「굵어졌다」가 아니라 「흐릿해졌다」로만 읽혔습니다.
 * 채움/비움은 크기·해상도와 무관하게 확실합니다.
 *
 * 라벨 13.5px · 비활성 `ink-muted`(#5a625f · 6.27:1) w600 · 활성 w700 —
 * 홈/훈련/보고/이력은 `brand-800`(#14665f · 6.78:1), 응급만 `danger-ink`(#b03636)입니다.
 * 응급 탭도 **활성일 때만** 빨강입니다(평소에는 다른 탭과 같은 회색).
 *
 * 비활성 색은 `ink-disabled`(#9aa5a2)였다가 `ink-soft`(8.48:1)였습니다. ink-soft는 읽히기는 했지만
 * **활성(6.78:1)보다 진해서** 값 위계가 뒤집혀 있었습니다 — 다섯 칸이 다 비슷한 무게로 서서
 * 「지금 어디」가 한눈에 안 잡히던 자리입니다. `ink-muted`는 6.27:1로 AA를 넉넉히 넘으면서
 * 활성보다 한 단 옅어, 채움과 함께 위계를 바로 세웁니다.
 * 크기는 12.5→13.5px 그대로이고 터치 영역 48px·5칸 균등도 그대로입니다.
 *
 * 위치는 `PageShell`이 잡습니다(`.chim-tabbar` = 문서 흐름 안 sticky).
 * **어느 뷰포트에서도 섭니다** — 이 앱의 유일한 이동 수단이라 폭으로 접지 않습니다.
 * 각 칸의 터치 영역은 48px 이상입니다.
 *
 * ── 자기 높이를 스스로 말합니다(2026-08-26) ──────────────────
 * 마운트 뒤 `ResizeObserver`로 잰 실제 높이를 `--chim-tabbar-h`에 적습니다(안전 영역 padding은
 * 빼고 — 아래 `write` 주석). 이 바 위에 도킹하는 요소(`report/_components/StickyCtaBar`)가
 * 그 변수만 보고 자리를 잡습니다.
 * 왜 관측이어야 하는가: 이 바의 높이는 계산으로 미리 알 수 없습니다 — `pt-1`·`pb-2`는 rem이고,
 * 「아주 크게」(125%)에서는 링크 내용이 `min-h-[54px]` 바닥을 넘겨 총높이가 67 → 76px로 자랍니다.
 * 예전에는 그 값이 61px 리터럴로 옆 파일에 적혀 있어 표준 배율에서 6px, 아주 크게에서 15px씩
 * 어긋났고, 아이콘을 rem으로 바꾼 옳은 수정이 그 오차를 오히려 키웠습니다(페르소나 FE med).
 */
export function TabBar({ active, className }: TabBarProps) {
  const pathname = usePathname() ?? "/";
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const node = navRef.current;
    const root = document.documentElement;
    if (!node) return undefined;

    const write = (): void => {
      /* **safe-area는 빼고 적습니다.** `.chim-tabbar`는 자기 `padding-bottom`으로 안전 영역을
         먹으므로 `offsetHeight`에는 그 값이 이미 들어 있는데, 이 변수를 읽는 쪽
         (`StickyCtaBar`)이 `+ var(--chim-safe-b)`를 한 번 더 더합니다. 그대로 적으면 노치 기기에서
         안전 영역이 두 번 더해져(아이폰 기준 34px) 도킹 바가 허공에 뜹니다.
         빼고 나면 값의 뜻이 「바 자체의 높이」로 고정되고, globals의 기본값 67px과 같은 수가 됩니다. */
      const safeBottom = parseFloat(window.getComputedStyle(node).paddingBottom) || 0;
      root.style.setProperty("--chim-tabbar-h", `${node.offsetHeight - safeBottom}px`);
    };
    write();

    if (typeof ResizeObserver === "undefined") {
      /* 관측할 수 없는 환경에서는 방금 잰 한 값으로 둡니다 — 글자 크기를 바꾸면
         화면이 다시 그려지며 이 효과가 다시 도는 자리가 아니므로, 그때는 CSS 기본값과
         같은 정도의 오차만 남습니다(도킹 바가 가려지는 것이 아니라 여백이 조금 남습니다). */
      return () => root.style.removeProperty("--chim-tabbar-h");
    }

    const observer = new ResizeObserver(write);
    observer.observe(node);
    return () => {
      observer.disconnect();
      /* 탭바가 없는 화면(세션·프로토콜 재생기)으로 넘어가면 변수도 함께 거둡니다 —
         남겨 두면 탭바가 없는 화면의 도킹 요소가 있지도 않은 바만큼 떠 있습니다. */
      root.style.removeProperty("--chim-tabbar-h");
    };
  }, []);

  return (
    <nav ref={navRef} aria-label="주요 메뉴" className={cx("chim-tabbar", className)}>
      <ul className="flex px-2 pt-1 pb-2">
        {NAV_ITEMS.map((item) => {
          const isActive = active ? active === item.key : matchesNav(pathname, item);
          const Icon = TAB_ICONS[item.key];
          return (
            <li key={item.key} className="flex-1">
              <Link
                href={item.href}
                /* 프리페치는 **응급·훈련 둘만** 켭니다(2026-08-26).
                   탭바는 거의 모든 화면에 상시 노출되므로, 다섯 칸을 다 열어 두면 화면을 열
                   때마다 다섯 라우트의 RSC 페이로드 약 26KB gz가 나갑니다. 게다가 그 요청은
                   `?_rsc=`라 서비스워커가 저장하지 않으므로(sw.js) 오프라인 대비에는 한 바이트도
                   기여하지 않습니다 — 행사장 회선에서는 순수한 지출입니다(페르소나 FE P2).
                   홈 푸터 링크 4개를 같은 이유로 이미 꺼 둔 자리와 판단을 맞춥니다.
                   둘만 남기는 기준은 **급할 때 눌리는 칸**입니다 — 응급은 회선이 나쁜 순간에
                   눌리고, 훈련은 시연에서 가장 먼저 눌리는 칸입니다. */
                prefetch={item.key === "emergency" || item.key === "train" ? undefined : false}
                aria-current={isActive ? "page" : undefined}
                className={cx(
                  "flex min-h-[54px] flex-col items-center justify-center gap-[3px] rounded-field px-1 pt-[5px] pb-[3px] text-center text-[0.8438rem] leading-[1.3]",
                  "transition-colors duration-150 ease-soft active:bg-paper-2",
                  isActive
                    ? item.danger
                      ? "text-danger-ink"
                      : "text-brand-800"
                    : "text-ink-muted",
                )}
              >
                {/* 글자와 짝지어 서는 장식 기하라 rem입니다 — 「아주 크게」에서 라벨만 커지고
                    아이콘은 그대로 남아 25% 작아 보이던 자리입니다(터치 타겟 54px은 물리 치수라 px 유지). */}
                <Icon className="h-[1.375rem] w-[1.375rem] flex-none" filled={isActive} />
                {/* 굵기(600→700)가 바뀌면 글자 폭도 함께 바뀝니다 — 탭을 옮길 때마다 라벨이
                    좌우로 미세하게 흔들리던 자리입니다. 보이지 않는 bold 사본으로 **굵을 때의 폭**을
                    미리 잡아 두면, 색만 150ms에 걸쳐 바뀌고 글자는 제자리에 섭니다.
                    사본은 visibility:hidden이라 접근성 트리에도 오르지 않습니다(aria-hidden은 이중 안전). */}
                <span className="grid">
                  <span aria-hidden className="invisible col-start-1 row-start-1 font-bold">
                    {item.label}
                  </span>
                  <span
                    className={cx(
                      "col-start-1 row-start-1",
                      isActive ? "font-bold" : "font-semibold",
                    )}
                  >
                    {item.label}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default TabBar;
