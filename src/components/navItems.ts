/**
 * 가장 자주 쓰는 이동만 세 칸으로 둡니다.
 * 응급 안내는 홈의 큰 빨간 버튼에서만 열고, 보고와 이력은 한 탭(기록)으로 묶습니다.
 */
export type TabKey = "home" | "train" | "records";

export interface NavItem {
  key: TabKey;
  href: string;
  label: string;
  /** `/` 처럼 정확히 일치할 때만 활성인 항목 */
  exact?: boolean;
  /** 서로 다른 경로를 같은 탭으로 묶을 때 쓰는 활성 판정 기준 */
  matchHrefs?: readonly string[];
}

export const NAV_ITEMS: readonly NavItem[] = [
  { key: "home", href: "/", label: "홈", exact: true },
  { key: "train", href: "/train", label: "연습" },
  {
    key: "records",
    href: "/history",
    label: "기록",
    matchHrefs: ["/history", "/report"],
  },
];

/** 현재 경로가 이 항목에 속하는지 — 하위 경로도 같은 부모 탭을 켭니다. */
export function matchesNav(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  const hrefs = item.matchHrefs ?? [item.href];
  return hrefs.some((href) => pathname === href || pathname.startsWith(`${href}/`));
}
