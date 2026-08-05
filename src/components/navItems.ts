/**
 * 주요 메뉴 5칸 — **모바일 하단 탭바(`TabBar`)와 데스크톱 상단 네비(`TopNav`)가 같은 목록을 씁니다.**
 * 순서는 시안 5a·5b·5c·7c 고정입니다(홈·훈련·응급·기록·성장).
 *
 * 두 곳이 각자 배열을 들고 있으면 언젠가 한쪽만 바뀝니다 — 그래서 한 파일에 둡니다.
 */

export type TabKey = "home" | "train" | "emergency" | "report" | "history";

export interface NavItem {
  key: TabKey;
  href: string;
  label: string;
  /** `/` 처럼 정확히 일치할 때만 활성인 항목 */
  exact?: boolean;
  /** 활성색이 딥 레드인 항목(응급) — 가이드 §4.10 */
  danger?: boolean;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { key: "home", href: "/", label: "홈", exact: true },
  { key: "train", href: "/train", label: "훈련" },
  { key: "emergency", href: "/emergency", label: "응급", danger: true },
  { key: "report", href: "/report", label: "기록" },
  { key: "history", href: "/history", label: "성장" },
];

/** 현재 경로가 이 항목에 속하는지 — 하위 경로(`/train/chk-a01`)도 부모 탭을 켭니다. */
export function matchesNav(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
