"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "./utils";

interface NavItem {
  href: string;
  label: string;
  /** 하단 탭바용 아이콘 — 항상 텍스트 라벨과 함께 노출합니다. */
  icon: string;
  exact?: boolean;
  danger?: boolean;
}

/** 하단 탭바·상단 네비 공통 항목 */
const NAV: NavItem[] = [
  { href: "/", label: "홈", icon: "🏠", exact: true },
  { href: "/train", label: "훈련", icon: "💬" },
  { href: "/emergency", label: "응급", icon: "🚨", danger: true },
  { href: "/report", label: "기록", icon: "📝" },
  { href: "/history", label: "성장", icon: "🌱" },
];

/** 데스크톱 상단에만 노출되는 보조 항목 */
const DESKTOP_EXTRA: NavItem[] = [{ href: "/safety", label: "안전 설계", icon: "🛡" }];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export interface AppHeaderProps {
  className?: string;
}

/**
 * 상단 네비게이션(데스크톱) + 하단 탭바(모바일).
 * 현재 경로를 강조하고, 응급 항목은 붉은 톤으로 구분합니다.
 */
export function AppHeader({ className }: AppHeaderProps) {
  const pathname = usePathname() ?? "/";
  const desktopNav = [...NAV, ...DESKTOP_EXTRA];

  return (
    <>
      <header
        className={cx(
          "chim-topbar sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur",
          className,
        )}
      >
        <div className="chim-container flex h-16 items-center justify-between gap-4 md:h-[4.4rem]">
          <Link
            href="/"
            className="flex shrink-0 items-baseline gap-2 rounded-field py-1"
            aria-label="침착 홈으로"
          >
            <span className="text-xl font-extrabold tracking-tight text-brand-800 md:text-2xl">
              침착
            </span>
            <span className="text-sm font-semibold tracking-wide text-ink-muted">ChimChak</span>
          </Link>

          {/* 데스크톱 네비 */}
          <nav aria-label="주요 메뉴" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {desktopNav.map((item) => {
                const active = isActive(pathname, item);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cx(
                        "inline-flex min-h-[48px] items-center rounded-field px-3.5 text-base font-semibold transition-colors duration-150",
                        active
                          ? item.danger
                            ? "bg-danger-soft text-danger-ink"
                            : "bg-brand-100 text-brand-800"
                          : item.danger
                            ? "text-danger-ink hover:bg-danger-soft"
                            : "text-ink-soft hover:bg-brand-50 hover:text-brand-800",
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* 모바일: 안전 설계 바로가기 */}
          <Link
            href="/safety"
            aria-current={pathname.startsWith("/safety") ? "page" : undefined}
            className={cx(
              "inline-flex min-h-[48px] items-center rounded-chip border px-3 text-sm font-semibold md:hidden",
              pathname.startsWith("/safety")
                ? "border-brand-300 bg-brand-100 text-brand-800"
                : "border-line bg-white text-ink-soft",
            )}
          >
            안전 설계
          </Link>
        </div>
      </header>

      {/* 모바일 하단 탭바 */}
      <nav
        aria-label="주요 메뉴"
        className="chim-tabbar fixed inset-x-0 bottom-0 z-50 border-t border-line bg-white shadow-lift md:hidden"
      >
        <ul className="grid grid-cols-5">
          {NAV.map((item) => {
            const active = isActive(pathname, item);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "flex min-h-[4.2rem] flex-col items-center justify-center gap-0.5 px-1 py-2 text-center",
                    active
                      ? item.danger
                        ? "text-danger-ink"
                        : "text-brand-800"
                      : "text-ink-muted",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cx(
                      "flex h-8 w-12 items-center justify-center rounded-chip text-[1.05rem] leading-none transition-colors",
                      active
                        ? item.danger
                          ? "bg-danger-soft"
                          : "bg-brand-100"
                        : "bg-transparent",
                    )}
                  >
                    {item.icon}
                  </span>
                  <span className="text-[0.78rem] font-bold">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

export default AppHeader;
