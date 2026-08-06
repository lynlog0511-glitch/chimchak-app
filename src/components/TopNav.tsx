"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, matchesNav, type TabKey } from "./navItems";
import { SettingsMenu } from "./SettingsMenu";
import { cx } from "./utils";

export interface TopNavProps {
  /** 활성 항목 강제 지정 — 경로로 판정되지 않는 화면(상세·리다이렉트)에서 씁니다. */
  active?: TabKey;
  className?: string;
}

/**
 * 데스크톱 상단 가로 네비 (시안 7c 헤더 · md↑ 전용).
 *
 * `침착` 워드마크 18px w800 딥틸 + 텍스트 링크 5개 14px + 우측 「설정」, 아래 헤어라인 한 줄.
 * 모바일에서는 통째로 숨고(하단 탭바가 그 역할을 합니다) md↑에서만 나타납니다 —
 * 노출 판단은 `.chim-topnav`(globals.css)가 미디어쿼리로 합니다.
 *
 * 아이콘·이모지·활성 밑줄 없이 **굵기와 색만으로** 현재 위치를 알립니다(가이드 §3·§4.10).
 * 비활성 14px w500 `ink-muted` / 활성 w700 `ink` — 단, 응급만 활성일 때 `danger-ink`입니다.
 * 각 링크의 세로 터치 영역은 48px입니다(가로도 좌우 10px 패딩으로 48px 안팎을 확보).
 *
 * 위치는 `PageShell`이 잡습니다(스크롤에 따라 붙지 않는 정적 바 —
 * 화면 안쪽의 sticky 요소(응급 119 버튼 등)와 상단에서 겹치지 않게 하려는 의도입니다).
 */
export function TopNav({ active, className }: TopNavProps) {
  const pathname = usePathname() ?? "/";

  return (
    <div className={cx("chim-topnav", className)}>
      <div className="flex items-center px-10 py-[3px]">
        {/* 워드마크는 링크가 아닙니다 — 바로 옆이 「홈」이라 같은 곳으로 가는 문이 둘일 필요가 없습니다. */}
        <span className="mr-[18px] flex min-h-[48px] flex-none items-center text-[1.125rem] leading-none font-extrabold tracking-[-0.01em] text-brand-800">
          침착
        </span>

        <nav aria-label="주요 메뉴">
          <ul className="flex items-center gap-[8px]">
            {NAV_ITEMS.map((item) => {
              const isActive = active ? active === item.key : matchesNav(pathname, item);
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cx(
                      "flex min-h-[48px] items-center px-[10px] text-[0.8438rem] leading-none",
                      "transition-colors duration-150",
                      isActive
                        ? item.danger
                          ? "font-bold text-danger-ink"
                          : "font-bold text-ink"
                        : "font-medium text-ink-soft hover:text-brand-800",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <SettingsMenu className="ml-auto" />
      </div>
    </div>
  );
}

export default TopNav;
