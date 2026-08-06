/**
 * 시간 표기 경계값 표 — src/lib/duration.ts
 *
 * 이 숫자들은 기관 담당자와 심사위원이 결재 근거로 읽는 값이라(총 이수 시수·기록 1건 소요),
 * 화면 두 곳이 서로 다른 값을 내는 순간이 곧 신뢰 문제가 된다. 그래서 함수를 한 곳으로 모으고
 * 경계값을 표로 못 박는다 — 59초/60초, 3599초/3600초, 그리고 0초.
 *
 * 값 자체는 옮겨 오기 전 화면들이 내던 것과 **같아야 한다**(시각적 회귀 0이 이 통합의 조건이다).
 */

import { describe, expect, it } from "vitest";
import {
  durationText,
  formatApproxHours,
  formatApproxMinutes,
  formatElapsedDuration,
  formatTotalDuration,
  isDisplayableElapsed,
} from "@/lib/duration";

describe("총 이수 시수 — 「약 N시간 N분」", () => {
  const table: [number, string][] = [
    [0, "약 1분 미만"],
    [29, "약 1분 미만"],
    // 30초는 분으로 반올림하면 1분이 된다 — 「1분 미만」과 갈리는 지점이다.
    [30, "약 1분"],
    [59, "약 1분"],
    [60, "약 1분"],
    [720, "약 12분"],
    [3540, "약 59분"],
    // 3599초는 반올림하면 60분이라 시간으로 올라간다. 「약 1시간 0분」은 의도된 표기다.
    [3599, "약 1시간 0분"],
    [3600, "약 1시간 0분"],
    [4530, "약 1시간 16분"],
    [86400, "약 24시간 0분"],
  ];

  for (const [sec, text] of table) {
    it(`${sec}초 → ${text}`, () => {
      expect(formatTotalDuration(sec)).toBe(text);
    });
  }
});

describe("기록 작성 소요 — 「N분 N초」", () => {
  const table: [number, string][] = [
    [0, "0초"],
    [59, "59초"],
    [60, "1분 0초"],
    [102, "1분 42초"],
    [3599, "59분 59초"],
    [3600, "60분 0초"],
  ];

  for (const [sec, text] of table) {
    it(`${sec}초 → ${text}`, () => {
      expect(formatElapsedDuration(sec)).toBe(text);
    });
  }

  it("표시할 만한 범위는 0초 초과 60분 이하다", () => {
    expect(isDisplayableElapsed(undefined)).toBe(false);
    expect(isDisplayableElapsed(0)).toBe(false);
    expect(isDisplayableElapsed(1)).toBe(true);
    expect(isDisplayableElapsed(3600)).toBe(true);
    expect(isDisplayableElapsed(3601)).toBe(false);
  });
});

describe("세션 소요 — 「약 4분 12초」", () => {
  const base = "2026-08-05T09:00:00.000Z";
  const table: [string, string][] = [
    ["2026-08-05T09:00:00.000Z", "약 1초"],
    ["2026-08-05T09:00:00.400Z", "약 1초"],
    ["2026-08-05T09:00:59.000Z", "약 59초"],
    ["2026-08-05T09:01:00.000Z", "약 1분"],
    ["2026-08-05T09:04:12.000Z", "약 4분 12초"],
    ["2026-08-05T09:59:59.000Z", "약 59분 59초"],
    ["2026-08-05T10:00:00.000Z", "약 60분"],
  ];

  for (const [end, text] of table) {
    it(`${end.slice(11, 19)} → ${text}`, () => {
      expect(durationText(base, end)).toBe(text);
    });
  }

  it("숫자(밀리초)로 받아도 같은 값을 낸다", () => {
    const start = Date.parse(base);
    expect(durationText(start, start + 252_000)).toBe("약 4분 12초");
  });

  it("거꾸로 된 시각은 「약 1초」로 눌러 담는다 — 음수 시간을 만들지 않는다", () => {
    expect(durationText("2026-08-05T09:04:12.000Z", base)).toBe("약 1초");
  });

  it("읽지 못하는 시각에는 빈 문자열을 준다 — 없는 값을 지어내지 않는다", () => {
    expect(durationText("어제", base)).toBe("");
    expect(durationText(base, "")).toBe("");
  });
});

describe("기관 규모 표기", () => {
  it("시수는 시간 단위로만 낸다", () => {
    expect(formatApproxHours(0)).toBe("약 1시간 미만");
    expect(formatApproxHours(59)).toBe("약 1시간 미만");
    expect(formatApproxHours(60)).toBe("약 1시간");
    expect(formatApproxHours(90)).toBe("약 2시간");
    expect(formatApproxHours(72_000)).toBe("약 1,200시간");
  });

  it("1건당 소요는 소수 첫째 자리까지만 적는다", () => {
    expect(formatApproxMinutes(4)).toBe("약 4분");
    expect(formatApproxMinutes(4.25)).toBe("약 4.3분");
    expect(formatApproxMinutes(4.24)).toBe("약 4.2분");
  });
});
