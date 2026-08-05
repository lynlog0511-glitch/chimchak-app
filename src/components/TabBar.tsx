"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "./utils";

export type TabKey = "home" | "train" | "emergency" | "report" | "history";

interface TabItem {
  key: TabKey;
  href: string;
  label: string;
  /** `/` 처럼 정확히 일치할 때만 활성인 항목 */
  exact?: boolean;
  /** 활성색이 딥 레드인 항목(응급) */
  danger?: boolean;
}

/** 하단 탭바 5칸 — 순서는 시안 5a·5b·5c 고정입니다. */
const TABS: readonly TabItem[] = [
  { key: "home", href: "/", label: "홈", exact: true },
  { key: "train", href: "/train", label: "훈련" },
  { key: "emergency", href: "/emergency", label: "응급", danger: true },
  { key: "report", href: "/report", label: "기록" },
  { key: "history", href: "/history", label: "성장" },
];

export interface TabBarProps {
  /** 활성 탭 강제 지정 — 경로로 판정되지 않는 화면(상세·리다이렉트)에서 씁니다. */
  active?: TabKey;
  className?: string;
}

function matches(pathname: string, item: TabItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/**
 * 하단 탭바 — **텍스트 온리 5칸**(아이콘 없음, v4 §0).
 *
 * 12.5px · 비활성 `tertiary`(#9aa5a2) w600 · 활성 w700 —
 * 홈/훈련/기록/성장은 `brand-800`(#14665f), 응급만 `danger-ink`(#b03636)입니다.
 * 응급 탭도 **활성일 때만** 빨강입니다(평소에는 다른 탭과 같은 회색).
 *
 * 위치는 `PageShell`이 잡습니다(`.chim-tabbar` = 문서 흐름 안 sticky).
 * 각 칸의 터치 영역은 48px 이상입니다.
 */
export function TabBar({ active, className }: TabBarProps) {
  const pathname = usePathname() ?? "/";

  return (
    <nav aria-label="주요 메뉴" className={cx("chim-tabbar", className)}>
      <ul className="flex px-2 pt-1 pb-2">
        {TABS.map((item) => {
          const isActive = active ? active === item.key : matches(pathname, item);
          return (
            <li key={item.key} className="flex-1">
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cx(
                  "flex min-h-[48px] items-center justify-center px-1 text-center text-[12.5px] leading-none",
                  "transition-colors duration-150",
                  isActive
                    ? item.danger
                      ? "font-bold text-danger-ink"
                      : "font-bold text-brand-800"
                    : "font-semibold text-tertiary",
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
