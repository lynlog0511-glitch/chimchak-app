"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, matchesNav, type TabKey } from "./navItems";
import { cx } from "./utils";

/** 목록·판정 로직은 데스크톱 상단 네비(`TopNav`)와 공유합니다. */
export type { TabKey };

export interface TabBarProps {
  /** 활성 탭 강제 지정 — 경로로 판정되지 않는 화면(상세·리다이렉트)에서 씁니다. */
  active?: TabKey;
  className?: string;
}

/**
 * 하단 탭바 — **텍스트 온리 5칸**(아이콘 없음, v4 §0 · 가이드 §4.10).
 *
 * 13px · 비활성 `ink-soft`(#454f4c) w600 · 활성 w700 —
 * 홈/훈련/기록/성장은 `brand-800`(#14665f), 응급만 `danger-ink`(#b03636)입니다.
 * 응급 탭도 **활성일 때만** 빨강입니다(평소에는 다른 탭과 같은 회색).
 *
 * 비활성 색은 `ink-faint`(#9aa5a2)였습니다 — 흰 지면 위 **2.54:1**로, 앱에서 상시 노출되는
 * 글자 중 가장 안 읽히는 자리였습니다(초보 m31 실측 「약 2.4:1 · 돋보기 없이는 못 읽음」).
 * `ink-muted`도 그때는 3.22:1이라 미달이었고(지금은 6.27:1), 4.5:1을 넉넉히 넘는 `ink-soft`(8.48:1)를 씁니다.
 * 크기도 12.5→13px로 한 단 올렸습니다(터치 영역 48px·5칸 균등은 그대로).
 * 위계는 색이 아니라 **굵기(600/700)와 활성 틸**이 만듭니다 — 안 보이게 만들어 낮추지 않습니다.
 *
 * 위치는 `PageShell`이 잡습니다(`.chim-tabbar` = 문서 흐름 안 sticky).
 * **md↑에서는 숨습니다** — 그 자리는 상단 가로 네비(`TopNav`, 시안 7c)가 대신합니다.
 * 각 칸의 터치 영역은 48px 이상입니다.
 */
export function TabBar({ active, className }: TabBarProps) {
  const pathname = usePathname() ?? "/";

  return (
    <nav aria-label="주요 메뉴" className={cx("chim-tabbar", className)}>
      <ul className="flex px-2 pt-1 pb-2">
        {NAV_ITEMS.map((item) => {
          const isActive = active ? active === item.key : matchesNav(pathname, item);
          return (
            <li key={item.key} className="flex-1">
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cx(
                  "flex min-h-[48px] items-center justify-center px-1 text-center text-[0.8438rem] leading-none",
                  "transition-colors duration-150",
                  isActive
                    ? item.danger
                      ? "font-bold text-danger-ink"
                      : "font-bold text-brand-800"
                    : "font-semibold text-ink-soft",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default TabBar;
