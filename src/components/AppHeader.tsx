"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconChat,
  IconHome,
  IconNote,
  IconShield,
  IconSiren,
  IconSprout,
  type IconProps,
} from "./icons";
import { cx } from "./utils";

interface NavItem {
  href: string;
  label: string;
  /** 하단 탭바용 스트로크 아이콘 — 항상 텍스트 라벨과 함께 노출합니다. */
  Icon: ComponentType<IconProps>;
  exact?: boolean;
  danger?: boolean;
}

/** 하단 탭바·상단 네비 공통 항목 */
const NAV: NavItem[] = [
  { href: "/", label: "홈", Icon: IconHome, exact: true },
  { href: "/train", label: "훈련", Icon: IconChat },
  { href: "/emergency", label: "응급", Icon: IconSiren, danger: true },
  { href: "/report", label: "기록", Icon: IconNote },
  { href: "/history", label: "성장", Icon: IconSprout },
];

/** 데스크톱 상단에만 노출되는 보조 항목 */
const DESKTOP_EXTRA: NavItem[] = [{ href: "/safety", label: "안전 설계", Icon: IconShield }];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export interface AppHeaderProps {
  className?: string;
}

/**
 * 상단 네비게이션(데스크톱) + 하단 탭바(모바일).
 *
 * 활성 표시는 배경 필이 아니라 **색 + 굵기 + 밑줄**로 합니다(조용한 크롬).
 * 헤더는 1px 보더 하나로만 지면과 구분하고, 그림자·반투명 유리 효과는 쓰지 않습니다.
 */
export function AppHeader({ className }: AppHeaderProps) {
  const pathname = usePathname() ?? "/";
  const desktopNav = [...NAV, ...DESKTOP_EXTRA];
  const safetyActive = pathname.startsWith("/safety");

  return (
    <>
      <header
        className={cx("chim-topbar sticky top-0 z-40 border-b border-line bg-paper", className)}
      >
        <div className="chim-container flex h-14 items-center justify-between gap-4 md:h-16">
          <Link
            href="/"
            className="flex shrink-0 items-baseline gap-2 py-1"
            aria-label="침착 홈으로"
          >
            <span className="chim-title text-xl font-extrabold text-brand-800 md:text-2xl">
              침착
            </span>
            <span className="text-sm font-semibold tracking-wide text-ink-muted">ChimChak</span>
          </Link>

          {/* 데스크톱 네비 — 아이콘 없이 텍스트만. 활성은 밑줄과 굵기로 알립니다. */}
          <nav aria-label="주요 메뉴" className="hidden md:block">
            <ul className="-mr-2 flex items-center">
              {desktopNav.map((item) => {
                const active = isActive(pathname, item);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cx(
                        "group inline-flex min-h-[48px] items-center px-3 text-base transition-colors duration-150",
                        item.danger ? "text-danger-ink" : active ? "text-brand-800" : "text-ink-soft",
                        !active && !item.danger && "hover:text-brand-800",
                        active ? "font-extrabold" : "font-semibold",
                      )}
                    >
                      {/* 활성·호버 모두 밑줄로만 알립니다 — 배경 필은 쓰지 않습니다. */}
                      <span
                        className={cx(
                          "border-b-2 py-0.5 transition-colors duration-150",
                          active
                            ? "border-current"
                            : "border-transparent group-hover:border-current",
                        )}
                      >
                        {item.label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* 모바일: 안전 설계 바로가기 — 필 대신 조용한 텍스트 링크 */}
          <Link
            href="/safety"
            aria-current={safetyActive ? "page" : undefined}
            className={cx(
              "inline-flex min-h-[48px] items-center gap-1.5 pl-2 text-sm md:hidden",
              safetyActive ? "font-extrabold text-brand-800" : "font-semibold text-ink-soft",
            )}
          >
            <IconShield className="h-5 w-5" />
            <span
              className={cx(
                "border-b-2 py-0.5",
                safetyActive ? "border-current" : "border-transparent",
              )}
            >
              안전 설계
            </span>
          </Link>
        </div>
      </header>

      {/* 모바일 하단 탭바 — 스트로크 아이콘 + 라벨, 활성은 틸 잉크 + 상단 4px 마크 */}
      <nav
        aria-label="주요 메뉴"
        className="chim-tabbar fixed inset-x-0 bottom-0 z-50 border-t border-line bg-white shadow-lift md:hidden"
      >
        <ul className="grid grid-cols-5">
          {NAV.map((item) => {
            const active = isActive(pathname, item);
            const { Icon } = item;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "relative flex min-h-[4.2rem] flex-col items-center justify-center gap-1 px-1 py-2 text-center transition-colors duration-150",
                    active
                      ? item.danger
                        ? "text-danger-ink"
                        : "text-brand-800"
                      : "text-ink-muted",
                  )}
                >
                  {active && (
                    <span
                      aria-hidden="true"
                      className={cx(
                        "absolute inset-x-4 top-0 h-[3px] rounded-b-full",
                        item.danger ? "bg-danger" : "bg-brand-600",
                      )}
                    />
                  )}
                  <Icon className="h-6 w-6" strokeWidth={active ? 2 : 1.75} />
                  <span className={cx("text-[0.78rem]", active ? "font-extrabold" : "font-semibold")}>
                    {item.label}
                  </span>
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
