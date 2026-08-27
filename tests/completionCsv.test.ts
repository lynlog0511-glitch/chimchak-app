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
  completionIssueNumber,
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

/**
 * 확인서에 실리는 **시수 그 자체**를 못 박는다.
 *
 * 위 블록들이 「파일이 왕복하는가」를 지킨다면 여기는 「그 파일에 적히는 숫자가 사실인가」를
 * 지킨다. 실사에서 문제가 되는 것은 서식이 아니라 숫자다(9차 임원평가 구매자 high).
 */
describe("이수 시수 — 벽시계가 아니라 진행 시간을 센다", () => {
  /** 벽시계로 25분 30초, 진행 시간으로 3분 30초인 회차 — 자리를 비운 회차다. */
  function awayRecord(): SessionRecord {
    return makeRecord({
      id: "CHK-A01-away-0",
      startedAt: "2026-08-05T00:00:00.000Z",
      endedAt: "2026-08-05T00:25:30.000Z",
      activeSec: 210,
    });
  }

  it("자리를 비운 회차는 진행 시간만 실린다 — 벽시계 25분이 확인서에 오르지 않는다", () => {
    saveSession(awayRecord());
    const summary = buildCompletionSummary();
    expect(summary.totalCount).toBe(1);
    expect(summary.totalSec).toBe(210);
    // 벽시계였다면 1530초였다. 그 값이 어디에도 남아 있지 않아야 한다.
    expect(summary.totalSec).not.toBe(25 * 60 + 30);
    expect(summary.lines[0]?.seconds).toBe(210);
    // 누계(확인서가 상세 50건 상한 뒤에도 쓰는 값)도 같은 숫자여야 한다.
    expect(loadCompletionTally().seconds).toBe(210);
  });

  it("정상 진행 회차는 값이 달라지지 않는다", () => {
    // 진행 시간과 벽시계가 같은 회차(5분 12초) — 규칙이 바뀌어도 이 숫자는 그대로다.
    saveSession(makeRecord({ activeSec: 312 }));
    expect(buildCompletionSummary().totalSec).toBe(312);
    expect(buildCompletionSummary().totalSec).toBe(
      Math.round(
        (Date.parse("2026-08-05T00:05:12.000Z") - Date.parse("2026-08-05T00:00:00.000Z")) / 1000,
      ),
    );
  });

  it("옛 기록은 다시 계산하지 않는다 — 진행 시간이 없으면 벽시계 그대로다", () => {
    /* 이 규칙이 서기 전에 저장된 기록에는 activeSec이 없다. 이미 인쇄돼 자료철에 들어간
       확인서의 숫자를 앱이 뒤에서 바꾸면, 같은 발급번호의 종이 두 장이 다른 시수를 말한다. */
    const legacy = makeRecord();
    delete (legacy as Partial<SessionRecord>).activeSec;
    saveSession(legacy);
    expect(buildCompletionSummary().totalSec).toBe(5 * 60 + 12);
  });

  it("진행 시간 0초는 「없음」과 다르다 — 0으로 세고 벽시계로 되돌아가지 않는다", () => {
    saveSession(makeRecord({ activeSec: 0 }));
    expect(buildCompletionSummary().totalSec).toBe(0);
  });

  it("회차당 30분 천장은 진행 시간에도 그대로 걸린다", () => {
    saveSession(makeRecord({ activeSec: 99 * 60 }));
    expect(buildCompletionSummary().totalSec).toBe(30 * 60);
  });

  it("발급번호는 시수가 달라진 만큼 달라지고, 파일에서 다시 계산해도 맞는다", () => {
    /* 발급번호 시드의 **짜임새**는 바뀌지 않았다(시나리오·횟수·분 시수·완료 시각·합계 둘).
       바뀐 것은 그 시드에 들어가는 시수 값뿐이라, 파일을 읽는 쪽의 대조는 그대로 선다. */
    saveSession(awayRecord());
    const awayNumber = buildCompletionSummary().number;
    const awayCsv = exportCsv();

    clearSessions();
    // 시각 두 칸은 그대로 두고 **시수만** 벽시계 값으로 되돌린다 — 번호가 달라지는 이유를 하나로 묶는다.
    saveSession({ ...awayRecord(), activeSec: 25 * 60 + 30 });
    expect(buildCompletionSummary().number).not.toBe(awayNumber);

    // 자리 비움 회차로 내보낸 파일은 그 자신의 번호와 여전히 맞아떨어진다.
    const read = parseCompletionCsv(awayCsv);
    expect(read.ok).toBe(true);
    if (read.ok) {
      expect(read.file.number).toBe(awayNumber);
      expect(read.file.numberMatches).toBe(true);
    }
  });
});

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

  it("가져온 회차는 줄마다 몇 회인지 남는다 — 확인서가 줄 단위로 사유를 갈라 적는다", () => {
    seedRealDevice();
    const csv = exportCsv();

    useDevice();
    expect(importCompletionCsv(csv).ok).toBe(true);
    const after = buildCompletionSummary();
    expect(after.lines.length).toBeGreaterThan(0);
    for (const line of after.lines) {
      // 이 기기에서 마친 회차가 없으므로 줄의 전부가 「옮겨 온 회차」다.
      expect(line.importedCount).toBe(line.count);
    }
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

  /* 아래 셋은 「파일을 고쳐 이수 시수를 부풀리는」 길을 막는지 본다.
     발급번호 위조를 막는 장치는 아니고(그건 서버 발급·서명의 일이다), 여기서 막는 것은
     **이 앱이 만들 수 없는 값**이 적힌 파일까지다. */

  it("편성표에 없는 시나리오 번호로 행을 늘린 파일은 받지 않는다", () => {
    const csv = csvFromOtherDevice();
    const rows = csv.replace(/^﻿/, "").split("\r\n");
    const cells = splitRow(rows[1] as string);
    cells[2] = "CHK-Z99"; // 이 앱에 없는 번호
    rows[1] = cells.join(",");
    const result = importCompletionCsv(`﻿${rows.join("\r\n")}`);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("scenario");
    expect(loadCompletionTally().count).toBe(0);
  });

  it("회당 30분 상한을 넘는 이수 시수는 받지 않는다", () => {
    const csv = csvFromOtherDevice();
    const rows = csv.replace(/^﻿/, "").split("\r\n");
    const cells = splitRow(rows[1] as string);
    // 이수 1회에 999분 — 이 앱은 한 회차를 30분까지만 센다.
    cells[5] = "1";
    cells[6] = "999";
    rows[1] = cells.join(",");
    const result = importCompletionCsv(`﻿${rows.join("\r\n")}`);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("limit");
    expect(loadCompletionTally().count).toBe(0);
  });

  it("한 줄에 담을 수 있는 이수 횟수를 넘긴 파일은 받지 않는다", () => {
    const csv = csvFromOtherDevice();
    const rows = csv.replace(/^﻿/, "").split("\r\n");
    const cells = splitRow(rows[1] as string);
    cells[5] = "9999";
    rows[1] = cells.join(",");
    const result = importCompletionCsv(`﻿${rows.join("\r\n")}`);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("limit");
    expect(loadCompletionTally().count).toBe(0);
  });

  it("막힌 파일은 한 줄도 반영되지 않는다 — 반쯤 들어가는 일이 없다", () => {
    const csv = csvFromOtherDevice();
    const rows = csv.replace(/^﻿/, "").split("\r\n");
    // 마지막 줄만 고쳐도 앞줄까지 통째로 되돌린다.
    const last = rows.length - 1;
    const cells = splitRow(rows[last] as string);
    cells[2] = "CHK-Z99";
    rows[last] = cells.join(",");
    expect(importCompletionCsv(`﻿${rows.join("\r\n")}`).ok).toBe(false);
    expect(loadCompletionTally().count).toBe(0);
    expect(buildCompletionSummary().totalCount).toBe(0);
  });

  it("실패한 가져오기는 안내 문장을 함께 돌려준다", () => {
    const result = importCompletionCsv("항목,값\r\n발급번호,CHK-0000-0000\r\n");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message.length).toBeGreaterThan(0);
  });

  /*
   * 발급번호 재계산 대조 — 2026-08-25에 더한 검사다.
   *
   * 발급번호 시드가 파일에 실리는 값(분 반올림)으로 맞춰지면서, 읽는 쪽이 같은 번호를 다시
   * 계산할 수 있게 됐다. 그전에는 서식(`CHK-0000-0000`)만 보았기 때문에 「합계까지 앞뒤가
   * 맞게 고쳐 쓴 파일」이 그대로 통과했다.
   */
  it("번호는 그대로 두고 내용을 고친 파일은 재계산에서 걸린다", () => {
    const csv = csvFromOtherDevice();
    const rows = csv.replace(/^﻿/, "").split("\r\n");
    // 한 줄의 시수를 1분 줄이고 합계 칸도 같이 줄여 **내부 정합성은 맞춘다** —
    // 예전 검사는 이 파일을 통과시켰다.
    // 시나리오 제목에 쉼표가 든 줄이 있어(「현관 앞, 집에 가야 해요」) 되붙일 때 다시 감싼다.
    const joinRow = (cells: string[]): string =>
      cells.map((cell) => (/[",\n\r]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(",");

    const first = splitRow(rows[1] as string);
    first[6] = String(Number(first[6]) + 1);
    rows[1] = joinRow(first);
    for (let i = 1; i < rows.length; i += 1) {
      if ((rows[i] ?? "").length === 0) continue;
      const row = splitRow(rows[i] as string);
      row[9] = String(Number(row[9]) + 1);
      rows[i] = joinRow(row);
    }

    const tampered = `﻿${rows.join("\r\n")}`;
    // 합계 대조(줄 합 = 파일 합계)는 통과한다 — 걸리는 것은 발급번호 재계산이다.
    const read = parseCompletionCsv(tampered);
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.file.numberMatches).toBe(false);

    const result = importCompletionCsv(tampered);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("mismatch");
    expect(loadCompletionTally().count).toBe(0);
  });

  it("손대지 않은 파일은 재계산이 그대로 맞는다", () => {
    const read = parseCompletionCsv(csvFromOtherDevice());
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.file.numberMatches).toBe(true);
    expect(completionIssueNumber(read.file.lines, read.file.totalCount, read.file.totalMinutes)).toBe(
      read.file.number,
    );
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

/* ── 수식 주입 중화 ────────────────────────────────────── */

describe("내보내는 파일이 스프레드시트 수식을 만들지 않는다", () => {
  /**
   * 이 파일의 소비자가 엑셀·한셀이라고 화면이 직접 밝히고 있고, 담당자가 25명분을 모아 여는
   * 흐름을 제품이 권한다. `=`·`+`·`-`·`@`로 시작하는 칸을 그대로 내보내면 그 자리가 값이
   * 아니라 **수식**으로 읽힌다. 가져온 제목이 검증 없이 되돌아 나가던 경로를 여기서 끊는다.
   */
  it("수식 접두로 시작하는 제목은 작은따옴표를 달고 나간다", () => {
    saveSession(makeRecord({ scenarioTitle: "=cmd|'/c calc'!A1" }));
    const rows = rowsOf(exportCsv());
    expect(rows[1]?.[3]).toBe("'=cmd|'/c calc'!A1");
    // 원문 그대로는 어디에도 나가지 않는다 — 「값이 =로 시작하는 칸」이 파일에 없다.
    expect(rows.slice(1).every((row) => row.every((cell) => !/^[=+\-@\t\r]/.test(cell)))).toBe(true);
  });

  it("네 접두를 하나씩 다 막는다", () => {
    for (const lead of ["=", "+", "-", "@"]) {
      useDevice();
      saveSession(makeRecord({ scenarioTitle: `${lead}HYPERLINK("http://x")` }));
      expect(rowsOf(exportCsv())[1]?.[3]).toBe(`'${lead}HYPERLINK("http://x")`);
    }
  });

  it("멀쩡한 값은 한 글자도 건드리지 않는다 — 왕복하면 그대로 돌아온다", () => {
    seedRealDevice();
    const csv = exportCsv();
    const read = parseCompletionCsv(csv);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.file.lines.map((line) => line.title).sort()).toEqual(
      ["온 김에 반찬 좀", "점심 식사 중 사레", "현관 앞, 집에 가야 해요"].sort(),
    );
    expect(read.file.numberMatches).toBe(true);
  });

  it("**발급번호는 중화의 영향을 받지 않는다** — 시드에 제목이 들어 있지 않다", () => {
    /* 중화는 「파일에 쓰는 순간」에만 일어난다. 발급번호 시드는 시나리오 번호·횟수·분 단위
       시수·분까지의 시각으로만 짜이므로, 제목이 어떻게 적히든 번호는 같은 값이 나온다.
       (여기가 어긋나면 기존 파일 대조가 통째로 깨진다.) */
    saveSession(makeRecord({ scenarioTitle: "현관 앞, 집에 가야 해요" }));
    const plain = buildCompletionSummary();
    const plainNumber = plain.number;

    useDevice();
    saveSession(makeRecord({ scenarioTitle: "=cmd|'/c calc'!A1" }));
    const injected = buildCompletionSummary();
    expect(injected.number).toBe(plainNumber);
    expect(
      completionIssueNumber(injected.lines, injected.totalCount, Math.round(injected.totalSec / 60)),
    ).toBe(plainNumber);
  });
});

/* ── 되받는 문자열 칸의 검증 ───────────────────────────── */

describe("가져온 파일의 제목·유형 칸", () => {
  /** 정상 파일 한 판을 만들어 두고, 칸 하나만 바꿔 넣어 본다. */
  function csvWithCell(index: number, value: string): string {
    seedRealDevice();
    const rows = rowsOf(exportCsv());
    const body = rows
      .map((row, rowIndex) =>
        (rowIndex === 1 ? row.map((cell, i) => (i === index ? value : cell)) : row)
          .map((cell) => (/[",\n\r]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell))
          .join(","),
      )
      .join("\r\n");
    useDevice();
    return `\uFEFF${body}\r\n`;
  }

  it("80자를 넘는 제목은 파일 전체를 거부한다", () => {
    const read = parseCompletionCsv(csvWithCell(3, "가".repeat(81)));
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.reason).toBe("text");
  });

  it("80자까지는 받는다 (경계에서 조용히 막지 않는다)", () => {
    const read = parseCompletionCsv(csvWithCell(3, "가".repeat(80)));
    expect(read.ok).toBe(true);
  });

  it("제어문자가 섞인 유형 칸은 거부한다", () => {
    const read = parseCompletionCsv(csvWithCell(4, "치매\u0007행동"));
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.reason).toBe("text");
  });

  it("탭·보이지 않는 문자도 같은 자리에서 걸린다", () => {
    expect(parseCompletionCsv(csvWithCell(3, "제목\t가리기")).ok).toBe(false);
    expect(parseCompletionCsv(csvWithCell(3, "제목\u200b가리기")).ok).toBe(false);
  });

  /*
   * 보이지 않는 글자는 **코드포인트 번호로** 적는다. 소스에 그대로 넣으면 다음 사람이 무엇이
   * 검사되는지 읽을 수 없고, 편집기·포매터가 조용히 지워도 검사가 통과해 버린다.
   */
  const codePoint = (value: number): string => String.fromCharCode(value);

  it("양방향 재정의·격리 문자를 거부한다 — 표기를 뒤집는 계열이다", () => {
    /*
     * U+202A~202E(LRE·RLE·PDF·LRO·RLO)와 U+2066~2069(방향 격리), U+061C(아랍 문자 표시)는
     * 화면 표기 순서를 통째로 뒤집는다. 이 칸을 지키는 이유가 「가져온 값이 확인서와 다음
     * CSV로 되돌아 나가는 길」이라, 목록에서 이 계열만 비어 있으면 통제를 세운 목적이 그
     * 자리에서 무너진다. React가 HTML을 이스케이프하므로 XSS는 아니고, 사람이 읽는 확인서의
     * 표시 위조다 — 그것으로 족하다.
     */
    const bidi = [0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069, 0x061c];
    for (const value of bidi) {
      const cell = `제목${codePoint(value)}가리기`;
      expect(parseCompletionCsv(csvWithCell(3, cell)).ok, value.toString(16)).toBe(false);
    }
  });

  it("C1 제어문자와 결합 없는 이음도 같은 목록에서 걸린다", () => {
    for (const value of [0x0085, 0x009f, 0x2060, 0x2064]) {
      const cell = `치매${codePoint(value)}행동`;
      expect(parseCompletionCsv(csvWithCell(4, cell)).ok, value.toString(16)).toBe(false);
    }
  });

  it("정상 한글·기호는 그대로 통과한다 (넓힌 목록이 정직한 파일을 물지 않는다)", () => {
    expect(parseCompletionCsv(csvWithCell(3, "저녁 식사 거부 (치매·인지) — 3개월차")).ok).toBe(true);
  });

  it("거부 사유에는 화면에 그대로 쓸 문장이 붙는다", () => {
    const merged = importCompletionCsv(csvWithCell(3, "가".repeat(200)));
    expect(merged.ok).toBe(false);
    if (merged.ok) return;
    expect(merged.reason).toBe("text");
    expect(merged.message.length).toBeGreaterThan(0);
  });
});
