"use client";

import type { ComponentType } from "react";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { initSettings } from "@/lib/settings";
import { SettingsMenu } from "./SettingsMenu";
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

/* 저장된 글자 크기는 화면이 그려지기 전에 적용될수록 깜빡임이 적습니다.
   이 모듈은 헤더가 모든 페이지의 최상단이라 클라이언트 번들에서 가장 먼저 평가되므로,
   여기서 한 번 적용해 둡니다. 서버 렌더 중에는 settings.ts의 가드가 조용히 빠져나갑니다.
   (멱등이라 아래 useEffect에서 다시 불러도 안전합니다.) */
initSettings();

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
 * v3 §5: 활성 표시는 **색 + 굵기만** 입니다.
 * 배경 필도, 밑줄도, 탭 위 색 바도 쓰지 않습니다 — 색 바는 액센트 금지 대상입니다(§1-2).
 * 지면과의 구분은 hairline 1px 하나로 끝냅니다(그림자·유리 효과 없음).
 *
 * 네비 라벨은 UI 크롬이라 15px입니다. 코어 콘텐츠(대사·CUE·응급 자막·CTA)의 18px+ 규칙은
 * 이 컴포넌트에 적용되지 않습니다 — 다만 터치 타겟 48px은 여기서도 불변입니다.
 */
export function AppHeader({ className }: AppHeaderProps) {
  const pathname = usePathname() ?? "/";
  const desktopNav = [...NAV, ...DESKTOP_EXTRA];
  const safetyActive = pathname.startsWith("/safety");

  // 하이드레이션 이후에도 저장된 설정이 확실히 반영되게 합니다(멱등).
  useEffect(() => {
    initSettings();
  }, []);

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
            <span className="chim-title text-[1.25rem] font-extrabold text-brand-800 md:text-[1.375rem]">
              침착
            </span>
            <span className="chim-caption font-semibold tracking-wide text-ink-muted">
              ChimChak
            </span>
          </Link>

          {/* 우측 묶음: 네비(데스크톱) · 안전 설계(모바일) · 설정.
              설정은 데스크톱·모바일 모두 여기 한 자리에 둡니다 — 탭바 5칸은 이동 전용이기 때문입니다. */}
          <div className="flex shrink-0 items-center gap-1">
            {/* 데스크톱 네비 — 아이콘 없이 텍스트만. 활성은 색과 굵기로만 알립니다. */}
            <nav aria-label="주요 메뉴" className="hidden md:block">
              <ul className="flex items-center">
                {desktopNav.map((item) => {
                  const active = isActive(pathname, item);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cx(
                          "chim-label inline-flex min-h-[48px] items-center px-3 transition-colors duration-150",
                          item.danger
                            ? "text-danger-ink"
                            : active
                              ? "text-brand-800"
                              : "text-ink-soft",
                          !active && !item.danger && "hover:text-brand-800",
                          active ? "font-extrabold" : "font-semibold",
                        )}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            {/* 모바일: 안전 설계 바로가기 — 필도 밑줄도 없는 조용한 텍스트 링크 */}
            <Link
              href="/safety"
              aria-current={safetyActive ? "page" : undefined}
              className={cx(
                "chim-caption inline-flex min-h-[48px] items-center gap-1.5 pl-2 md:hidden",
                safetyActive ? "font-extrabold text-brand-800" : "font-semibold text-ink-soft",
              )}
            >
              <IconShield className="h-5 w-5" />
              안전 설계
            </Link>

            {/* 표시·음성 설정 — 글자 크기와 낭독 속도를 여기서 바꿉니다. */}
            <SettingsMenu className="-mr-2" />
          </div>
        </div>
      </header>

      {/* 모바일 하단 탭바 — 스트로크 아이콘 + 라벨.
          활성은 색과 굵기(아이콘 스트로크 포함)로만 알립니다. 탭 위 색 바는 두지 않습니다. */}
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
                    "flex min-h-[4rem] flex-col items-center justify-center gap-1 px-1 py-2 text-center transition-colors duration-150",
                    active
                      ? item.danger
                        ? "text-danger-ink"
                        : "text-brand-800"
                      : "text-ink-muted",
                  )}
                >
                  <Icon className="h-6 w-6" strokeWidth={active ? 2 : 1.75} />
                  <span
                    className={cx("chim-caption", active ? "font-extrabold" : "font-semibold")}
                  >
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
