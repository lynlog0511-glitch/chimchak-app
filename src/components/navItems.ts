/**
 * 주요 메뉴 5칸 — 하단 탭바(`TabBar`)가 전 뷰포트에서 이 목록 하나를 씁니다.
 * 순서는 시안 5a·5b·5c 고정입니다(홈·훈련·응급·보고·이력) — 홈은 관례대로 맨 왼쪽,
 * 정중앙은 응급입니다(급할 때 엄지가 가장 빨리 닿는 자리라 옮기지 않습니다).
 * 「기록」→「보고」는 2026-08-06 팀장 승인 교정 — "기록"이 /report(보고 연습)와
 * /history 양쪽에 걸려 헷갈린다는 평가를 받아, 겹치는 낱말을 탭에서 뺐습니다.
 * 「성장」→「이력」은 2026-08-25 팀장 판정 — 훈련·응급·보고는 하는 일의 이름인데
 * 성장만 추상어라 결이 달랐습니다. "기록"은 위 결정대로 재사용하지 않습니다.
 *
 * 목록·활성 판정을 화면마다 따로 두면 언젠가 한쪽만 바뀝니다 — 그래서 한 파일에 둡니다.
 * (데스크톱 상단 네비 `TopNav`가 이 목록을 함께 쓰던 시절이 있었습니다 — 2026-08-25 폐기.)
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
  { key: "report", href: "/report", label: "보고" },
  { key: "history", href: "/history", label: "이력" },
];

/** 현재 경로가 이 항목에 속하는지 — 하위 경로(`/train/chk-a01`)도 부모 탭을 켭니다. */
export function matchesNav(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
