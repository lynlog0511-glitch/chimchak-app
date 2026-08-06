/**
 * 이수 사실 파일 왕복 — src/lib/storage.ts
 *
 * 이 파일이 지키는 것은 기관 화면이 적어 둔 두 문장이다.
 *  ① 「여러 사람의 파일을 표 계산 프로그램에서 그대로 이어 붙일 수 있습니다」 — 한 행이
 *     시나리오 하나이고 모든 행의 열 수가 같은 **직사각형 표**여야 성립한다.
 *  ② 「기기를 바꾸실 때 되돌려 넣으시면 됩니다」 — 내보낸 파일이 다른 기기에서 이수 누계로
 *     정확히 복원돼야 하고, 같은 파일을 두 번 넣어도 시수가 부풀지 않아야 한다.
 *
 * 무기명 원칙도 함께 못 박는다 — 파일 어디에도 성명·소속 칸이 생기면 안 된다.
 * storage.test.ts와 같은 방식으로 localStorage 최소 스텁만 심는다(jsdom 없음).
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  COMPLETION_CSV_HEADERS,
  buildCompletionCsv,
  buildCompletionSummary,
  clearSessions,
  importCompletionCsv,
  loadCompletionImports,
  loadCompletionTally,
  loadSessions,
  parseCompletionCsv,
  saveSession,
} from "@/lib/storage";
import { clearDemoRecords, seedDemoRecords } from "@/lib/demoSeed";
import type { SessionRecord } from "@/types";

/* ── localStorage 스텁 ─────────────────────────────────── */

class MemoryStorage {
  private map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }
  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  clear(): void {
    this.map.clear();
  }
}

/** 기기 한 대 — 가져오기는 「다른 기기」가 있어야 검증되므로 저장소를 갈아 끼운다. */
function useDevice(): MemoryStorage {
  const store = new MemoryStorage();
  (globalThis as { window?: unknown }).window = { localStorage: store };
  return store;
}

beforeEach(() => {
  useDevice();
});

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

/* ── 표본 ─────────────────────────────────────────────── */

const ISSUED_AT = "2026-08-06T09:00:00.000Z";

function makeRecord(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: "CHK-A01-1700000000000-0",
    scenarioId: "CHK-A01",
    scenarioTitle: "현관 앞, 집에 가야 해요",
    typeLabel: "치매 행동심리증상(BPSD)",
    startedAt: "2026-08-05T00:00:00.000Z",
    endedAt: "2026-08-05T00:05:12.000Z",
    verdict: "충족",
    endingTitle: "안전하게 마무리하셨습니다",
    greenChecks: ["집에 가고 싶은 마음을 먼저 알아주셨습니다."],
    coachingPoints: [],
    cfCount: 0,
    retriesUsed: 0,
    turnCount: 7,
    ...overrides,
  };
}

/** 세 시나리오를 한 번씩 마친 기기를 만든다. */
function seedRealDevice(): void {
  saveSession(makeRecord());
  saveSession(
    makeRecord({
      id: "CHK-C01-1700000000001-0",
      scenarioId: "CHK-C01",
      scenarioTitle: "온 김에 반찬 좀",
      typeLabel: "이용자·보호자 갈등 화법",
      startedAt: "2026-08-05T01:00:00.000Z",
      endedAt: "2026-08-05T01:06:03.000Z",
    }),
  );
  saveSession(
    makeRecord({
      id: "CHK-B02-1700000000002-0",
      scenarioId: "CHK-B02",
      scenarioTitle: "점심 식사 중 사레",
      typeLabel: "응급 초기 대응",
      startedAt: "2026-08-05T02:00:00.000Z",
      endedAt: "2026-08-05T02:04:47.000Z",
    }),
  );
}

function exportCsv(): string {
  return buildCompletionCsv(buildCompletionSummary(), ISSUED_AT);
}

/** 검사용 최소 CSV 분해 — 따옴표 안 쉼표를 지킨다(시나리오 제목에 쉼표가 있다). */
function splitRow(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
      continue;
    }
    if (ch === ",") {
      cells.push(cell);
      cell = "";
      continue;
    }
    cell += ch;
  }
  cells.push(cell);
  return cells;
}

function rowsOf(csv: string): string[][] {
  return csv
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map(splitRow);
}

/* ── 검사 ─────────────────────────────────────────────── */

describe("내보내기 서식 — 병합 가능한 직사각형 표", () => {
  it("머리글 한 줄 + 시나리오당 한 행이고, 모든 행의 열 수가 같다", () => {
    seedRealDevice();
    const rows = rowsOf(exportCsv());

    expect(rows[0]).toEqual([...COMPLETION_CSV_HEADERS]);
    expect(rows).toHaveLength(1 + buildCompletionSummary().lines.length);
    for (const row of rows) expect(row).toHaveLength(COMPLETION_CSV_HEADERS.length);
  });

  it("엑셀 한글 깨짐을 막는 BOM이 그대로 남는다", () => {
    seedRealDevice();
    expect(exportCsv().startsWith("﻿")).toBe(true);
  });

  it("맨 앞 칸이 발급번호이고 모든 행에서 같은 값이다 — 25명분을 이어 붙여도 구분자가 남는다", () => {
    seedRealDevice();
    const summary = buildCompletionSummary();
    for (const row of rowsOf(exportCsv()).slice(1)) {
      expect(row[0]).toBe(summary.number);
    }
    expect(summary.number).toMatch(/^CHK-[0-9A-F]{4}-[0-9A-F]{4}$/);
  });

  it("성명·소속 같은 개인 식별 칸이 파일에 생기지 않는다", () => {
    seedRealDevice();
    expect([...COMPLETION_CSV_HEADERS].some((head) => /성명|소속|이름/.test(head))).toBe(false);
    // 성명·소속이라는 낱말은 「담기지 않는다」고 밝히는 마지막 열에만 나온다.
    for (const row of rowsOf(exportCsv()).slice(1)) {
      for (const cell of row.slice(0, -1)) {
        expect(/성명|소속/.test(cell)).toBe(false);
      }
      expect(row[row.length - 1]).toContain("성명·소속 없음");
    }
  });
});

describe("왕복 — 내보내기 → 다른 기기에서 가져오기 → 누계 병합", () => {
  it("이수 회차·시수·시나리오별 횟수가 새 기기에서 그대로 복원된다", () => {
    seedRealDevice();
    const before = buildCompletionSummary();
    const csv = exportCsv();

    // 기기를 바꾼 상황 — 저장소가 통째로 새것이다.
    useDevice();
    expect(buildCompletionSummary().totalCount).toBe(0);

    const merged = importCompletionCsv(csv);
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;
    expect(merged.number).toBe(before.number);
    expect(merged.addedCount).toBe(before.totalCount);
    expect(merged.lineCount).toBe(before.lines.length);

    const after = buildCompletionSummary();
    expect(after.totalCount).toBe(before.totalCount);
    expect(Math.round(after.totalSec / 60)).toBe(Math.round(before.totalSec / 60));
    expect(after.importedCount).toBe(before.totalCount);
    // 시나리오별 이수 횟수도 한 칸씩 그대로 옮겨 온다.
    const byScenario = (rows: { scenarioId: string; count: number }[]) =>
      Object.fromEntries(rows.map((row) => [row.scenarioId, row.count]));
    expect(byScenario(after.lines)).toEqual(byScenario(before.lines));
  });

  it("가져와도 상세 기록은 생기지 않는다 — 파일에 대화도 판정도 없다", () => {
    seedRealDevice();
    const csv = exportCsv();

    useDevice();
    expect(importCompletionCsv(csv).ok).toBe(true);
    expect(loadSessions()).toEqual([]);
    expect(loadCompletionTally().count).toBeGreaterThan(0);
  });

  it("상세 없이 합계만 있는 기기에서도 확인서 문장이 사유를 나눠 셀 수 있다", () => {
    seedRealDevice();
    const csv = exportCsv();

    useDevice();
    importCompletionCsv(csv);
    const summary = buildCompletionSummary();
    // 상세가 없는 회차는 전부 「가져온 것」이지 「50건 상한에 밀려난 것」이 아니다.
    expect(summary.importedCount).toBe(summary.totalCount);
    expect(summary.hiddenCount).toBe(0);
  });

  it("이 기기가 방금 만든 파일은 되돌려 넣지 않는다", () => {
    seedRealDevice();
    const csv = exportCsv();
    const result = importCompletionCsv(csv);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("same-device");
    expect(loadCompletionTally().count).toBe(3);
  });
});

describe("중복 차단 — 같은 파일을 두 번 넣어도 시수가 부풀지 않는다", () => {
  it("같은 발급번호는 두 번째부터 막고 누계를 건드리지 않는다", () => {
    seedRealDevice();
    const csv = exportCsv();

    useDevice();
    expect(importCompletionCsv(csv).ok).toBe(true);
    const afterFirst = buildCompletionSummary();

    const second = importCompletionCsv(csv);
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.reason).toBe("duplicate");
    expect(second.message).toContain("이미 가져온");

    const afterSecond = buildCompletionSummary();
    expect(afterSecond.totalCount).toBe(afterFirst.totalCount);
    expect(afterSecond.totalSec).toBe(afterFirst.totalSec);
    expect(loadCompletionImports()).toHaveLength(1);
  });

  it("서로 다른 기기의 파일 둘은 합쳐진다", () => {
    seedRealDevice();
    const first = exportCsv();
    const firstTotal = buildCompletionSummary().totalCount;

    useDevice();
    saveSession(makeRecord({ id: "CHK-A01-1700000000009-0" }));
    const second = exportCsv();
    const secondTotal = buildCompletionSummary().totalCount;

    useDevice();
    expect(importCompletionCsv(first).ok).toBe(true);
    expect(importCompletionCsv(second).ok).toBe(true);
    expect(buildCompletionSummary().totalCount).toBe(firstTotal + secondTotal);
    expect(loadCompletionImports()).toHaveLength(2);
  });

  it("기록을 전부 지우면 가져오기 기록도 함께 비워져 같은 파일을 다시 넣을 수 있다", () => {
    seedRealDevice();
    const csv = exportCsv();

    useDevice();
    expect(importCompletionCsv(csv).ok).toBe(true);
    clearSessions();
    expect(loadCompletionImports()).toEqual([]);
    expect(importCompletionCsv(csv).ok).toBe(true);
    expect(buildCompletionSummary().totalCount).toBe(3);
  });
});

describe("검증 — 서식이 어긋나면 반쯤 넣지 않고 사유를 말한다", () => {
  function csvFromOtherDevice(): string {
    seedRealDevice();
    const csv = exportCsv();
    useDevice();
    return csv;
  }

  it("빈 파일·머리글만 있는 파일은 받지 않는다", () => {
    expect(parseCompletionCsv("")).toEqual({ ok: false, reason: "empty" });
    expect(parseCompletionCsv(`﻿${COMPLETION_CSV_HEADERS.join(",")}\r\n`)).toEqual({
      ok: false,
      reason: "empty",
    });
  });

  it("다른 서식의 CSV는 머리글에서 걸러 낸다", () => {
    const result = importCompletionCsv("이름,점수\r\n김순자,90\r\n");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("format");
    expect(loadCompletionTally().count).toBe(0);
  });

  it("발급번호 칸이 비었거나 서식과 다르면 받지 않는다", () => {
    const csv = csvFromOtherDevice();
    const broken = csv.replace(/CHK-[0-9A-F]{4}-[0-9A-F]{4}/g, "CHK-0000");
    const result = importCompletionCsv(broken);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("number");
  });

  it("이수 횟수를 손으로 고쳐 합계와 어긋나면 받지 않는다", () => {
    const csv = csvFromOtherDevice();
    const rows = csv.replace(/^﻿/, "").split("\r\n");
    const cells = splitRow(rows[1] as string);
    cells[5] = "9"; // 이수 횟수만 늘려 둔다 — 합계 칸은 그대로다
    rows[1] = cells.join(",");
    const result = importCompletionCsv(`﻿${rows.join("\r\n")}`);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("total");
    expect(loadCompletionTally().count).toBe(0);
  });

  it("숫자 자리에 글자가 들어 있으면 받지 않는다", () => {
    const csv = csvFromOtherDevice();
    const rows = csv.replace(/^﻿/, "").split("\r\n");
    const cells = splitRow(rows[1] as string);
    cells[6] = "스물";
    rows[1] = cells.join(",");
    const result = importCompletionCsv(`﻿${rows.join("\r\n")}`);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("row");
  });

  it("실패한 가져오기는 안내 문장을 함께 돌려준다", () => {
    const result = importCompletionCsv("항목,값\r\n발급번호,CHK-0000-0000\r\n");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message.length).toBeGreaterThan(0);
  });
});

describe("시연용 예시는 파일로도 새어 나가지 않는다", () => {
  it("예시만 심긴 기기의 파일에는 담을 이수 사실이 없다 — 예시는 누계에 들어가지 않기 때문", () => {
    seedDemoRecords(new Date("2026-08-06T09:00:00.000Z"));
    // 화면에는 예시가 보이지만(상세 3건), 이수 누계는 0이다.
    expect(loadCompletionTally().count).toBe(0);

    // 예시를 지우면 파일로 나갈 이수 사실도 0이다(확인서 화면은 예시가 있는 동안 내려받기를 잠근다).
    clearDemoRecords();
    const summary = buildCompletionSummary();
    expect(summary.totalCount).toBe(0);
    expect(rowsOf(buildCompletionCsv(summary, ISSUED_AT))).toHaveLength(1);
  });

  it("가져오기는 예시 회차를 만들지 않는다 — 들어오는 것은 누계 숫자뿐이다", () => {
    seedRealDevice();
    const csv = exportCsv();

    useDevice();
    seedDemoRecords(new Date("2026-08-06T09:00:00.000Z"));
    expect(importCompletionCsv(csv).ok).toBe(true);
    // 예시 상세는 그대로 3건, 가져온 회차는 상세를 만들지 않는다.
    expect(loadSessions()).toHaveLength(3);
    expect(loadSessions().every((row) => row.id.startsWith("demo-"))).toBe(true);
  });
});
