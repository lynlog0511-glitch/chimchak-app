import { describe, expect, it } from "vitest";
import { NAV_ITEMS, matchesNav } from "../src/components/navItems";

describe("학습자 하단 메뉴", () => {
  it("홈·연습·기록 세 칸만 이 순서로 보여 준다", () => {
    expect(NAV_ITEMS.map(({ key, href, label }) => ({ key, href, label }))).toEqual([
      { key: "home", href: "/", label: "홈" },
      { key: "train", href: "/train", label: "연습" },
      { key: "records", href: "/history", label: "기록" },
    ]);
  });

  it("보고와 이력 경로를 모두 기록 탭으로 묶는다", () => {
    const records = NAV_ITEMS.find((item) => item.key === "records");
    expect(records).toBeDefined();
    expect(matchesNav("/history", records!)).toBe(true);
    expect(matchesNav("/history/certificate", records!)).toBe(true);
    expect(matchesNav("/report", records!)).toBe(true);
    expect(matchesNav("/report/review", records!)).toBe(true);
  });

  it("응급 화면에서는 어떤 하단 탭도 활성화하지 않는다", () => {
    expect(NAV_ITEMS.some((item) => matchesNav("/emergency", item))).toBe(false);
    expect(NAV_ITEMS.some((item) => matchesNav("/emergency/p-01", item))).toBe(false);
  });
});
