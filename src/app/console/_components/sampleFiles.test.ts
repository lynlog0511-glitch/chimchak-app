/**
 * 콘솔 미리보기가 스스로 만든 예시 파일 — 이 파일이 지키는 것은 두 문장이다.
 *
 *  ① 「앱이 실제로 내보내는 것과 같은 서식입니다」 — 예시 파일은 저장소의 진짜 검사
 *     (`parseCompletionCsv`)를 그대로 통과해야 한다. 통과하지 못하면 시연에서 「예시조차
 *     읽지 못하는 콘솔」이 되고, 통과 조건을 콘솔 쪽에서 느슨하게 푸는 순간 대조 화면이
 *     설명하는 네 가지 검사가 거짓말이 된다.
 *  ② 「사람을 가리키는 값은 발급번호뿐입니다」 — 예시 파일에도 성명·소속 칸이 생기면 안 된다.
 *
 * 기관 관점 합계(`summarizeEntries`)도 함께 못 박는다 — 직원별 표와 과정별 표가 서로 다른
 * 값을 말하면 그 인쇄물은 증빙으로 쓸 수 없다.
 *
 * 브라우저를 띄우지 않는다. 저장소도 부르지 않는다(두 함수 모두 순수 함수다).
 */

import { describe, expect, it } from "vitest";
import { SCENARIOS } from "@/data/scenarios";
import { parseCompletionCsv } from "@/lib/storage";
import { SAMPLE_FILES, buildSampleCsv, sampleFileName } from "./sampleFiles";
import { entryCourseCount, entrySeconds, summarizeEntries, type ConsoleEntry } from "./aggregate";

/** 예시 한 벌을 파일로 만들었다가 콘솔이 하듯 다시 읽어 들인다. */
function roundTrip(index: number): ConsoleEntry {
  const spec = SAMPLE_FILES[index];
  if (!spec) throw new Error(`예시 ${index}번이 없다`);
  const read = parseCompletionCsv(buildSampleCsv(spec));
  if (!read.ok) throw new Error(`예시 ${spec.number}가 파서를 통과하지 못했다: ${read.reason}`);
  return {
    number: read.file.number,
    fileName: sampleFileName(spec),
    issuedAt: read.file.issuedAt,
    totalCount: read.file.totalCount,
    totalMinutes: read.file.totalMinutes,
    lines: read.file.lines,
  };
}

describe("예시 이수 사실 파일", () => {
  it("세 벌을 만든다", () => {
    expect(SAMPLE_FILES).toHaveLength(3);
  });

  it("발급번호가 서로 다르다", () => {
    const numbers = SAMPLE_FILES.map((spec) => spec.number);
    expect([...new Set(numbers)]).toHaveLength(numbers.length);
  });

  it.each(SAMPLE_FILES.map((spec) => [spec.number, spec] as const))(
    "%s 는 저장소의 검사를 그대로 통과한다",
    (_number, spec) => {
      const read = parseCompletionCsv(buildSampleCsv(spec));
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      expect(read.file.number).toBe(spec.number);
      expect(read.file.lines).toHaveLength(spec.lines.length);
      expect(read.file.totalCount).toBe(spec.lines.reduce((sum, line) => sum + line.count, 0));
      expect(read.file.totalMinutes).toBe(spec.lines.reduce((sum, line) => sum + line.minutes, 0));
    },
  );

  it("편성표에 실린 시나리오만 쓰고, 제목도 편성표에서 가져온다", () => {
    const byId = new Map(SCENARIOS.map((scenario) => [scenario.id.toUpperCase(), scenario]));
    for (const spec of SAMPLE_FILES) {
      for (const line of spec.lines) {
        const scenario = byId.get(line.scenarioId.toUpperCase());
        expect(scenario, `${line.scenarioId} 가 편성표에 없다`).toBeDefined();
      }
      const read = parseCompletionCsv(buildSampleCsv(spec));
      expect(read.ok).toBe(true);
      if (!read.ok) continue;
      for (const line of read.file.lines) {
        expect(line.title).toBe(byId.get(line.scenarioId)?.title);
      }
    }
  });

  it("한 회차 30분 상한 안에서만 적는다", () => {
    for (const spec of SAMPLE_FILES) {
      for (const line of spec.lines) {
        expect(line.minutes).toBeLessThanOrEqual(line.count * 30);
      }
    }
  });

  it("무기명이다 — 파일에 성명·소속 칸이 없다", () => {
    for (const spec of SAMPLE_FILES) {
      const csv = buildSampleCsv(spec);
      // 머리글에 그런 열이 없어야 한다. 본문 마지막 열의 「…성명·소속 없음」은 무엇이 안 담겼는지
      // 밝히는 문장이므로 낱말 검색이 아니라 열 이름으로 본다.
      const header = (csv.split("\r\n")[0] ?? "").replace(/^﻿/, "").split(",");
      expect(header).not.toContain("성명");
      expect(header).not.toContain("소속");
    }
  });

  it("파일 이름이 예시라는 사실을 적는다", () => {
    for (const spec of SAMPLE_FILES) {
      expect(sampleFileName(spec)).toContain("chimchak-sample-");
    }
  });
});

describe("기관 관점 합계", () => {
  it("파일 세 벌을 모으면 인원·회차·시수가 줄 값의 합과 같다", () => {
    const entries = SAMPLE_FILES.map((_spec, index) => roundTrip(index));
    const totals = summarizeEntries(entries);

    expect(totals.people).toBe(3);
    expect(totals.count).toBe(entries.reduce((sum, entry) => sum + entry.totalCount, 0));
    expect(totals.seconds).toBe(entries.reduce((sum, entry) => sum + entrySeconds(entry), 0));
    // 과정별 표의 회차 합이 직원별 표의 회차 합과 같아야 한 장의 인쇄물이 될 수 있다.
    expect(totals.courses.reduce((sum, course) => sum + course.count, 0)).toBe(totals.count);
    expect(totals.courses.reduce((sum, course) => sum + course.seconds, 0)).toBe(totals.seconds);
  });

  it("같은 과정을 여러 사람이 이수하면 인원으로 센다", () => {
    const entries = SAMPLE_FILES.map((_spec, index) => roundTrip(index));
    const totals = summarizeEntries(entries);
    const b02 = totals.courses.find((course) => course.scenarioId === "CHK-B02");
    expect(b02).toBeDefined();
    // 예시 세 벌 모두에 CHK-B02가 들어 있다.
    expect(b02?.people).toBe(3);
  });

  it("과정 줄은 이수 회차가 많은 순이다", () => {
    const entries = SAMPLE_FILES.map((_spec, index) => roundTrip(index));
    const counts = summarizeEntries(entries).courses.map((course) => course.count);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
  });

  it("파일 한 벌의 과정 수는 시나리오 종수다", () => {
    const entry = roundTrip(1);
    expect(entryCourseCount(entry)).toBe(SAMPLE_FILES[1]?.lines.length);
  });

  it("아무것도 올리지 않으면 빈 합계다", () => {
    const totals = summarizeEntries([]);
    expect(totals).toEqual({ people: 0, count: 0, seconds: 0, courses: [] });
  });
});
