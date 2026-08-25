"use client";

import type { ComponentType } from "react";
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
 * 비활성 색은 `ink-faint`(#9aa5a2)였다가 `ink-soft`(8.48:1)였습니다. ink-soft는 읽히기는 했지만
 * **활성(6.78:1)보다 진해서** 값 위계가 뒤집혀 있었습니다 — 다섯 칸이 다 비슷한 무게로 서서
 * 「지금 어디」가 한눈에 안 잡히던 자리입니다. `ink-muted`는 6.27:1로 AA를 넉넉히 넘으면서
 * 활성보다 한 단 옅어, 채움과 함께 위계를 바로 세웁니다.
 * 크기는 12.5→13.5px 그대로이고 터치 영역 48px·5칸 균등도 그대로입니다.
 *
 * 위치는 `PageShell`이 잡습니다(`.chim-tabbar` = 문서 흐름 안 sticky).
 * **어느 뷰포트에서도 섭니다** — 이 앱의 유일한 이동 수단이라 폭으로 접지 않습니다.
 * 각 칸의 터치 영역은 48px 이상입니다.
 */
export function TabBar({ active, className }: TabBarProps) {
  const pathname = usePathname() ?? "/";

  return (
    <nav aria-label="주요 메뉴" className={cx("chim-tabbar", className)}>
      <ul className="flex px-2 pt-1 pb-2">
        {NAV_ITEMS.map((item) => {
          const isActive = active ? active === item.key : matchesNav(pathname, item);
          const Icon = TAB_ICONS[item.key];
          return (
            <li key={item.key} className="flex-1">
              <Link
                href={item.href}
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
