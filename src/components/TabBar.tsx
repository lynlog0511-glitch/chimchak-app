"use client";

import { useEffect, useRef, type ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconChat, IconHistory, IconHome, type IconProps } from "./icons";
import { NAV_ITEMS, matchesNav, type TabKey } from "./navItems";
import { cx } from "./utils";

export type { TabKey };

const TAB_ICONS: Record<TabKey, ComponentType<IconProps>> = {
  home: IconHome,
  train: IconChat,
  records: IconHistory,
};

export interface TabBarProps {
  /** 경로로 판정되지 않는 화면에서 활성 탭을 직접 지정합니다. */
  active?: TabKey;
  className?: string;
}

/** 홈 · 연습 · 기록 세 칸으로 고정한 학습자용 하단 메뉴입니다. */
export function TabBar({ active, className }: TabBarProps) {
  const pathname = usePathname() ?? "/";
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const node = navRef.current;
    const root = document.documentElement;
    if (!node) return undefined;

    const writeHeight = (): void => {
      // safe-area는 도킹 요소가 따로 더하므로 탭바 자체 높이에서 제외합니다.
      const safeBottom = parseFloat(window.getComputedStyle(node).paddingBottom) || 0;
      root.style.setProperty("--chim-tabbar-h", `${node.offsetHeight - safeBottom}px`);
    };
    writeHeight();

    if (typeof ResizeObserver === "undefined") {
      return () => root.style.removeProperty("--chim-tabbar-h");
    }

    const observer = new ResizeObserver(writeHeight);
    observer.observe(node);
    return () => {
      observer.disconnect();
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
                prefetch={item.key === "train" ? undefined : false}
                aria-current={isActive ? "page" : undefined}
                className={cx(
                  "flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-field px-2 py-2 text-center text-[0.9375rem] leading-[1.3]",
                  "transition-colors duration-150 ease-soft active:bg-paper-2",
                  isActive ? "text-brand-800" : "text-ink-muted",
                )}
              >
                <Icon className="h-[1.375rem] w-[1.375rem] flex-none" filled={isActive} />
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
