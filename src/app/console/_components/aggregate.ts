/**
 * 기관 콘솔 미리보기가 화면에 그릴 값을 만드는 순수 함수들.
 *
 * 여기서 지키는 선 하나 — **사람을 가리키는 값은 발급번호뿐입니다.** 파일에 성명·소속 칸이
 * 애초에 없으므로(`buildCompletionCsv`의 서식 계약), 이 화면이 모을 수 있는 것도 발급번호와
 * 시나리오별 이수 횟수·시수까지입니다. 발급번호와 사람을 잇는 일은 기관의 명부와 확인자
 * 서명이 하고, 앱은 그 연결을 알지 못합니다.
 *
 * 저장소를 부르지 않습니다 — 올리신 파일에서 읽은 값만 다루고, 이 기기에 남은 이수 기록은
 * 보지도 쓰지도 않습니다.
 */

import type { CompletionLine } from "@/lib/storage";

/** 콘솔이 읽어 들인 이수 사실 파일 한 벌 — 저장하지 않고 화면 상태로만 들고 있습니다. */
export interface ConsoleEntry {
  /** 파일에 적혀 있던 발급번호 — 이 화면에서 사람을 대신하는 유일한 값입니다. */
  number: string;
  /**
   * 고르신 파일의 이름.
   *
   * **화면 대조용으로만 씁니다.** 담당자가 파일을 성함으로 바꿔 두셨을 수 있어 인쇄물에는
   * 싣지 않습니다 — 묶음에 성명이 들어가지 않는다는 문장을 파일 이름이 깨뜨리지 않도록.
   */
  fileName: string;
  /**
   * 파일에 적혀 있던 「만든 시각」 표기 **그대로**.
   *
   * 다시 조립하지 않는 이유는 대조 때문입니다 — 담당자가 손에 든 파일과 화면의 줄이 같은
   * 파일인지 확인하는 값이라, 앱이 표기를 고쳐 쓰면 두 값이 달라 보입니다.
   */
  issuedAt: string;
  /** 파일에 적힌 합계 이수 회차 — 줄 값의 합과 맞는지 파서가 이미 대조했습니다 */
  totalCount: number;
  /** 파일에 적힌 총 이수 시수(분) */
  totalMinutes: number;
  lines: CompletionLine[];
}

/** 과정(시나리오) 한 줄의 기관 합계. */
export interface CourseTotal {
  scenarioId: string;
  title: string;
  typeLabel: string;
  /** 이 과정을 이수한 파일 수 — 한 파일이 한 사람이라는 전제 위의 값입니다 */
  people: number;
  count: number;
  seconds: number;
  /** 이 과정에서 가장 최근에 마친 시각 (ISO) */
  lastEndedAt: string;
}

/** 올라온 파일 전체의 합계. */
export interface ConsoleTotals {
  /** 파일 수 = 인원(한 사람이 한 벌을 올린다는 전제) */
  people: number;
  /** 이수 회차 합계 */
  count: number;
  /** 이수 시수 합계(초) */
  seconds: number;
  courses: CourseTotal[];
}

/** 두 시각 중 나중 것 — 읽지 못하는 값은 상대 쪽을 그대로 둡니다. */
function laterIso(a: string, b: string): string {
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (Number.isNaN(ta)) return b;
  if (Number.isNaN(tb)) return a;
  return tb > ta ? b : a;
}

/**
 * 파일 한 벌의 이수 시수(초) — 줄 값의 합입니다.
 *
 * 파일에 적힌 합계(분)를 쓰지 않는 이유는 눈금 때문입니다. 줄마다 분으로 반올림해 적히므로
 * 줄 수만큼의 오차가 생기는데, 과정별 표는 줄 값으로 세므로 두 표가 서로 다른 값을 말하게 됩니다.
 *
 * @example entrySeconds({ lines: [{ seconds: 540 }, { seconds: 300 }] }) // 840
 */
export function entrySeconds(entry: Pick<ConsoleEntry, "lines">): number {
  let sum = 0;
  for (const line of entry.lines) sum += line.seconds;
  return sum;
}

/**
 * 파일 한 벌이 담고 있는 과정 수.
 *
 * @example entryCourseCount({ lines: [{ scenarioId: "CHK-A01" }, { scenarioId: "CHK-B02" }] }) // 2
 */
export function entryCourseCount(entry: Pick<ConsoleEntry, "lines">): number {
  const seen = new Set<string>();
  for (const line of entry.lines) seen.add(line.scenarioId);
  return seen.size;
}

/**
 * 파일 한 벌에서 가장 최근에 마친 시각 — 읽을 수 있는 값이 없으면 빈 문자열입니다.
 *
 * @example entryLastEndedAt({ lines: [{ lastEndedAt: "2026-08-01T00:00:00.000Z" }] })
 */
export function entryLastEndedAt(entry: Pick<ConsoleEntry, "lines">): string {
  let latest = "";
  for (const line of entry.lines) latest = laterIso(latest, line.lastEndedAt);
  return latest;
}

/**
 * 올라온 파일들을 기관 관점 합계로 접습니다.
 *
 * 과정 줄은 이수 회차가 많은 순으로 세우고, 같으면 시수·번호 순입니다 — 같은 파일 묶음이면
 * 언제 다시 만들어도 같은 순서가 나옵니다(인쇄물이 다시 뽑을 때마다 달라지면 대조가 안 됩니다).
 *
 * @example
 * summarizeEntries(entries).courses[0].count; // 5
 */
export function summarizeEntries(entries: readonly ConsoleEntry[]): ConsoleTotals {
  const map = new Map<string, CourseTotal & { peopleSet: Set<string> }>();
  let count = 0;
  let seconds = 0;

  for (const entry of entries) {
    count += entry.totalCount;
    for (const line of entry.lines) {
      seconds += line.seconds;
      const key = line.scenarioId;
      const found = map.get(key);
      if (found) {
        found.count += line.count;
        found.seconds += line.seconds;
        found.lastEndedAt = laterIso(found.lastEndedAt, line.lastEndedAt);
        found.peopleSet.add(entry.number);
        if (found.title.length === 0) found.title = line.title;
        if (found.typeLabel.length === 0) found.typeLabel = line.typeLabel;
        continue;
      }
      map.set(key, {
        scenarioId: key,
        title: line.title,
        typeLabel: line.typeLabel,
        people: 0,
        count: line.count,
        seconds: line.seconds,
        lastEndedAt: line.lastEndedAt,
        peopleSet: new Set([entry.number]),
      });
    }
  }

  const courses: CourseTotal[] = [...map.values()]
    .map(({ peopleSet, ...course }) => ({ ...course, people: peopleSet.size }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      if (b.seconds !== a.seconds) return b.seconds - a.seconds;
      return a.scenarioId.localeCompare(b.scenarioId);
    });

  return { people: entries.length, count, seconds, courses };
}
