/**
 * 침착(ChimChak) 로컬 저장소.
 *
 * 원칙
 * - 기기 안(localStorage)에만 저장한다. 서버 전송·외부 API 호출은 0건이다.
 * - **학습자 발화 원문은 저장하지 않는다.** 세션 기록에는 항목 판정 결과와 문구만 남는다.
 * - 보고 기록은 반드시 가명처리된 텍스트만 넣는다(engine/masking.maskText 통과분).
 * - 진행 체크포인트(이어서 하기)에도 발화는 담지 않는다 — 판정된 분기 id와 게이지·횟수뿐이다.
 * - SSR 가드: 서버 렌더링 중에는 조용히 빈 값으로 동작한다.
 */

import type { RecordDraft, SessionEvent, SessionRecord, SessionState, SessionStatus } from "@/types";

export const SESSIONS_KEY = "chimchak.sessions.v1";
export const REPORTS_KEY = "chimchak.reports.v1";
export const PROGRESS_KEY = "chimchak.progress.v1";
export const TALLY_KEY = "chimchak.tally.v1";

/** 너무 많이 쌓이지 않도록 최근 것만 남긴다 */
const MAX_ITEMS = 50;

/** 확정한 보고 기록 (가명처리 완료본만 저장) */
export interface StoredReport {
  id: string;
  /** ISO 시각 */
  createdAt: string;
  /** 가명처리된 본문 — 원문은 저장하지 않는다 */
  maskedText: string;
  /** 5요소 초안 */
  draft: RecordDraft;
  /** 가려진 항목 수 (성명 2건 등) */
  maskedCounts?: Record<string, number>;
  /** 훈련 세션에서 이어진 보고면 시나리오 id */
  scenarioId?: string;
  /**
   * 입력 시작(첫 타이핑 또는 마이크 시작)부터 확정까지 걸린 초.
   * 옛 저장 데이터에는 없을 수 있어 옵셔널이다. 0 이하·3600 초과는 표시하지 않는다(호출부에서 걸러냄).
   */
  elapsedSec?: number;
}

function getStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function readList<T>(key: string): T[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeList<T>(key: string, list: T[]): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(list.slice(0, MAX_ITEMS)));
  } catch {
    /* 저장 공간 부족·사생활 보호 모드 — 조용히 무시한다 */
  }
}

function readValue(key: string): unknown {
  const storage = getStorage();
  if (!storage) return undefined;
  try {
    const raw = storage.getItem(key);
    if (!raw) return undefined;
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

function writeValue(key: string, value: unknown): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    /* 저장 공간 부족·사생활 보호 모드 — 조용히 무시한다 */
  }
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ── 훈련 세션 ─────────────────────────────────────────── */

/**
 * 세션 기록을 저장한다(최신순). 같은 id가 있으면 덮어쓴다.
 *
 * @example
 * saveSession(buildRecord(scenario, state));
 */
export function saveSession(record: SessionRecord): void {
  const list = loadSessions().filter((r) => r.id !== record.id);
  writeList(SESSIONS_KEY, [record, ...list]);
  // 상세는 50건 상한에 걸려 밀려나지만 「이수 사실」은 밀려나면 안 된다(아래 이수 누계).
  addToTally(record);
}

/**
 * 저장된 세션 기록(최신순).
 *
 * @example
 * const rows = loadSessions(); // [] 이면 빈 상태 화면
 */
export function loadSessions(): SessionRecord[] {
  return readList<SessionRecord>(SESSIONS_KEY).filter(
    (r): r is SessionRecord => Boolean(r) && typeof r.id === "string" && typeof r.scenarioId === "string",
  );
}

/**
 * 세션 기록 1건 삭제.
 *
 * @example
 * deleteSession("CHK-A01-1700000000000-0");
 */
export function deleteSession(id: string): void {
  const list = loadSessions();
  writeList(
    SESSIONS_KEY,
    list.filter((r) => r.id !== id),
  );
  // 사용자가 지운 회차가 이수 누계에만 남아 있으면 「지웠는데 합계에 남아 있다」가 된다.
  const removed = list.find((r) => r.id === id);
  if (removed) removeFromTally(removed);
}

/** 세션 기록 전체 삭제 — 이수 누계도 함께 지웁니다(화면에 없는 합계를 남기지 않는다). */
export function clearSessions(): void {
  writeList<SessionRecord>(SESSIONS_KEY, []);
  clearCompletionTally();
}

/* ── 이수 누계 (확인서 증빙용) ─────────────────────────────── */

/**
 * 한 회차를 이수 시간으로 셀 때의 상한 — 자리를 비우고 방치한 회차가 시수를 부풀리지 않게 한다.
 * 확인서 각주가 이 값을 「30분」이라고 문장으로 적고 있으므로 함께 고친다.
 */
export const MAX_SESSION_SEC = 30 * 60;

/** 이수 누계에 기억해 두는 회차 id 최대 개수 — 같은 회차를 두 번 세지 않기 위한 목록이다. */
const MAX_COUNTED_IDS = 300;

/**
 * 회차 하나의 이수 시간(초).
 *
 * `endedAt − startedAt`이고, 회차당 30분을 넘으면 30분까지만 센다.
 * 시각이 없거나 거꾸로면 0으로 둔다.
 *
 * @example sessionSeconds({ startedAt: "...T10:00:00Z", endedAt: "...T10:04:00Z" }) // 240
 */
export function sessionSeconds(record: Pick<SessionRecord, "startedAt" | "endedAt">): number {
  const start = new Date(record.startedAt).getTime();
  const end = new Date(record.endedAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  const sec = Math.round((end - start) / 1000);
  if (sec <= 0) return 0;
  return Math.min(sec, MAX_SESSION_SEC);
}

/** 이수 누계 한 줄 — 시나리오 하나에 대한 이수 사실뿐이다(판정·대화는 담지 않는다). */
export interface CompletionTallyLine {
  scenarioId: string;
  title: string;
  typeLabel: string;
  count: number;
  seconds: number;
  /** 가장 최근에 마친 시각 (ISO) */
  lastEndedAt: string;
}

/**
 * 이수 누계 — **상세 기록과 별도로** 쌓는 이수 사실 집계다.
 *
 * 세션 기록은 50건 상한이라 51회차부터 첫 회차가 조용히 밀려난다. 확인서의 「합계 N회」와
 * 「총 이수 시수」가 그 상한 때문에 시간이 갈수록 줄어드는 것을 막으려고 이 누계를 따로 둔다.
 * 담기는 것은 시나리오·횟수·시수·최근 완료일뿐이고, 판정·대화·발화는 어떤 형태로도 넣지 않는다.
 */
export interface CompletionTally {
  count: number;
  seconds: number;
  lines: CompletionTallyLine[];
  /** 이미 센 회차 id — 같은 회차를 다시 저장해도 두 번 세지 않는다 */
  countedIds: string[];
  updatedAt: string;
}

function emptyTally(): CompletionTally {
  return { count: 0, seconds: 0, lines: [], countedIds: [], updatedAt: "" };
}

/** 저장된 값이 훼손되었거나 옛 형식이어도 화면이 깨지지 않게 필요한 항목만 골라 담는다. */
function sanitizeTallyLine(value: unknown): CompletionTallyLine | undefined {
  if (!value || typeof value !== "object") return undefined;
  const row = value as Record<string, unknown>;
  const scenarioId = typeof row.scenarioId === "string" ? row.scenarioId : "";
  if (scenarioId.length === 0) return undefined;
  return {
    scenarioId,
    title: typeof row.title === "string" ? row.title : scenarioId,
    typeLabel: typeof row.typeLabel === "string" ? row.typeLabel : "",
    count: typeof row.count === "number" && row.count > 0 ? Math.floor(row.count) : 0,
    seconds: typeof row.seconds === "number" && row.seconds > 0 ? Math.round(row.seconds) : 0,
    lastEndedAt: typeof row.lastEndedAt === "string" ? row.lastEndedAt : "",
  };
}

/**
 * 이수 누계를 읽는다. 값이 없거나 훼손되었으면 빈 누계를 돌려준다.
 *
 * @example
 * loadCompletionTally().count; // 12
 */
export function loadCompletionTally(): CompletionTally {
  const raw = readValue(TALLY_KEY);
  if (!raw || typeof raw !== "object") return emptyTally();
  const row = raw as Record<string, unknown>;
  const lines: CompletionTallyLine[] = [];
  for (const item of Array.isArray(row.lines) ? row.lines : []) {
    const line = sanitizeTallyLine(item);
    if (line && line.count > 0) lines.push(line);
  }
  const countedIds: string[] = [];
  for (const item of Array.isArray(row.countedIds) ? row.countedIds : []) {
    if (typeof item === "string" && item.length > 0) countedIds.push(item);
  }
  return {
    count: typeof row.count === "number" && row.count > 0 ? Math.floor(row.count) : 0,
    seconds: typeof row.seconds === "number" && row.seconds > 0 ? Math.round(row.seconds) : 0,
    lines,
    countedIds,
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : "",
  };
}

/** 이수 누계 전체 삭제 */
export function clearCompletionTally(): void {
  writeValue(TALLY_KEY, emptyTally());
}

function laterIso(a: string, b: string): string {
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (Number.isNaN(ta)) return b;
  if (Number.isNaN(tb)) return a;
  return tb > ta ? b : a;
}

/** 완주한 회차 하나를 누계에 더한다. 같은 id가 이미 반영돼 있으면 아무 일도 하지 않는다. */
function addToTally(record: SessionRecord): void {
  const tally = loadCompletionTally();
  if (tally.countedIds.includes(record.id)) return;

  const key = record.scenarioId.trim().toUpperCase();
  const at = record.endedAt || record.startedAt;
  const seconds = sessionSeconds(record);
  const found = tally.lines.find((line) => line.scenarioId === key);
  if (found) {
    found.count += 1;
    found.seconds += seconds;
    found.lastEndedAt = laterIso(found.lastEndedAt, at);
    if (record.scenarioTitle) found.title = record.scenarioTitle;
    if (record.typeLabel) found.typeLabel = record.typeLabel;
  } else {
    tally.lines.push({
      scenarioId: key,
      title: record.scenarioTitle || key,
      typeLabel: record.typeLabel,
      count: 1,
      seconds,
      lastEndedAt: at,
    });
  }

  tally.count += 1;
  tally.seconds += seconds;
  tally.countedIds = [record.id, ...tally.countedIds].slice(0, MAX_COUNTED_IDS);
  tally.updatedAt = new Date().toISOString();
  writeValue(TALLY_KEY, tally);
}

/** 회차 하나를 누계에서 뺀다(사용자가 그 기록을 지운 경우). */
function removeFromTally(record: SessionRecord): void {
  const tally = loadCompletionTally();
  if (!tally.countedIds.includes(record.id)) return;

  const key = record.scenarioId.trim().toUpperCase();
  const seconds = sessionSeconds(record);
  const found = tally.lines.find((line) => line.scenarioId === key);
  if (found) {
    found.count -= 1;
    found.seconds = Math.max(0, found.seconds - seconds);
  }
  tally.lines = tally.lines.filter((line) => line.count > 0);
  tally.count = Math.max(0, tally.count - 1);
  tally.seconds = Math.max(0, tally.seconds - seconds);
  tally.countedIds = tally.countedIds.filter((id) => id !== record.id);
  tally.updatedAt = new Date().toISOString();
  writeValue(TALLY_KEY, tally);
}

/* ── 이수 사실 요약 · 발급번호 · 내보내기 ────────────────────── */

/** 확인서·기관 안내가 함께 쓰는 한 줄 — 이수 사실만 담는다. */
export interface CompletionLine {
  scenarioId: string;
  title: string;
  typeLabel: string;
  count: number;
  /** 가장 최근에 마친 시각 (ISO) */
  lastEndedAt: string;
}

export interface CompletionSummary {
  /** 발급번호 — 같은 기록 집합이면 언제 다시 만들어도 같은 값이 나온다 */
  number: string;
  /** 이수 회차 합계 */
  totalCount: number;
  /** 총 이수 시수(초) */
  totalSec: number;
  lines: CompletionLine[];
  /** 상세가 이 기기에 남아 있지 않은 회차 수(50건 상한으로 밀려난 분) */
  hiddenCount: number;
}

/**
 * 32비트 FNV-1a 해시. 발급번호를 서버 없이 결정론으로 만들기 위한 것이고,
 * 암호학적 용도가 아니다(위조 방지가 아니라 같은 기록 집합의 대조용 번호다).
 */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** 「CHK-3F7A-9C21」 — 기록 집합에서 계산한 발급번호. */
function issueNumberFor(lines: CompletionLine[], totalCount: number, totalSec: number): string {
  const seed = [
    ...lines.map((line) => `${line.scenarioId}:${line.count}:${line.lastEndedAt}`),
    `#${totalCount}:${totalSec}`,
  ].join("|");
  const hex = fnv1a(seed).toString(16).toUpperCase().padStart(8, "0");
  return `CHK-${hex.slice(0, 4)}-${hex.slice(4)}`;
}

/**
 * 이 기기에 남은 **이수 사실**을 한 덩어리로 요약한다.
 *
 * 상세 기록(50건 상한)과 이수 누계를 겹쳐 큰 쪽을 쓴다 — 상한에 밀려 상세가 사라져도
 * 합계와 시수는 줄지 않는다. 옛 사용자처럼 누계가 비어 있으면 상세만으로 계산한다.
 *
 * @example
 * const summary = buildCompletionSummary(); // { number: "CHK-3F7A-9C21", totalCount: 4, ... }
 */
export function buildCompletionSummary(): CompletionSummary {
  const records = loadSessions();
  const tally = loadCompletionTally();

  const map = new Map<string, CompletionLine>();
  let visibleCount = 0;
  let visibleSec = 0;

  for (const record of records) {
    const key = record.scenarioId.trim().toUpperCase();
    const at = record.endedAt || record.startedAt;
    visibleCount += 1;
    visibleSec += sessionSeconds(record);
    const found = map.get(key);
    if (found) {
      found.count += 1;
      found.lastEndedAt = laterIso(found.lastEndedAt, at);
      continue;
    }
    map.set(key, {
      scenarioId: key,
      title: record.scenarioTitle,
      typeLabel: record.typeLabel,
      count: 1,
      lastEndedAt: at,
    });
  }

  for (const line of tally.lines) {
    const found = map.get(line.scenarioId);
    if (found) {
      found.count = Math.max(found.count, line.count);
      found.lastEndedAt = laterIso(found.lastEndedAt, line.lastEndedAt);
      continue;
    }
    map.set(line.scenarioId, {
      scenarioId: line.scenarioId,
      title: line.title,
      typeLabel: line.typeLabel,
      count: line.count,
      lastEndedAt: line.lastEndedAt,
    });
  }

  const lines = [...map.values()].sort(
    (a, b) => new Date(b.lastEndedAt).getTime() - new Date(a.lastEndedAt).getTime(),
  );
  const totalCount = Math.max(visibleCount, tally.count);
  const totalSec = Math.max(visibleSec, tally.seconds);

  return {
    number: issueNumberFor(lines, totalCount, totalSec),
    totalCount,
    totalSec,
    lines,
    hiddenCount: Math.max(0, totalCount - visibleCount),
  };
}

/** CSV 한 칸 — 쉼표·따옴표·줄바꿈이 들어가면 따옴표로 감싼다. */
function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** 파일 안에서 쓰는 시각 표기 — 로케일에 흔들리지 않게 직접 조립한다(현지 시각). */
function csvDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const p = (n: number): string => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}`;
}

/**
 * 이수 사실만 담은 CSV 문자열을 만든다.
 *
 * **담기는 것**: 발급번호·만든 날짜·합계·시수·시나리오별 이수 횟수와 최근 완료 시각.
 * **담기지 않는 것**: 발화 원문·대화 내용·판정 결과·성명·소속 — 개인정보는 한 칸도 넣지 않는다.
 * 엑셀에서 한글이 깨지지 않도록 앞에 BOM을 붙인다.
 *
 * @example
 * const csv = buildCompletionCsv(buildCompletionSummary(), new Date().toISOString());
 */
export function buildCompletionCsv(summary: CompletionSummary, issuedAt: string): string {
  const minutes = Math.round(summary.totalSec / 60);
  const rows: string[][] = [
    ["항목", "값"],
    ["발급번호", summary.number],
    ["만든 시각", csvDateTime(issuedAt)],
    ["합계 이수 회차", String(summary.totalCount)],
    ["총 이수 시수(분)", String(minutes)],
    ["담긴 내용", "이수 사실만 — 판정·대화·발화 원문·성명·소속 없음"],
    [],
    ["시나리오 번호", "시나리오", "유형", "이수 횟수", "최근 완료"],
  ];
  for (const line of summary.lines) {
    rows.push([
      line.scenarioId,
      line.title,
      line.typeLabel,
      String(line.count),
      csvDateTime(line.lastEndedAt),
    ]);
  }
  const body = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  return `\uFEFF${body}\r\n`;
}

/* ── 보고 기록 ─────────────────────────────────────────── */

export type ReportInput = Omit<StoredReport, "id" | "createdAt"> & Partial<Pick<StoredReport, "id" | "createdAt">>;

/**
 * 확정한 보고 기록을 저장한다. maskedText에는 반드시 가명처리 결과만 넣는다.
 *
 * @example
 * saveReport({ maskedText: masked, draft, scenarioId: "CHK-A01" });
 */
export function saveReport(report: ReportInput): StoredReport {
  const stored: StoredReport = {
    ...report,
    id: report.id ?? makeId("report"),
    createdAt: report.createdAt ?? new Date().toISOString(),
  };
  const list = loadReports().filter((r) => r.id !== stored.id);
  writeList(REPORTS_KEY, [stored, ...list]);
  return stored;
}

/**
 * 저장된 보고 기록(최신순).
 *
 * @example
 * const reports = loadReports();
 */
export function loadReports(): StoredReport[] {
  return readList<StoredReport>(REPORTS_KEY).filter(
    (r): r is StoredReport => Boolean(r) && typeof r.id === "string" && typeof r.maskedText === "string",
  );
}

/**
 * 보고 기록 1건 삭제.
 *
 * @example
 * deleteReport("report-1700000000000-ab12cd");
 */
export function deleteReport(id: string): void {
  writeList(
    REPORTS_KEY,
    loadReports().filter((r) => r.id !== id),
  );
}

/** 보고 기록 전체 삭제 */
export function clearReports(): void {
  writeList<StoredReport>(REPORTS_KEY, []);
}

/* ── 진행 체크포인트 (이어서 하기) ─────────────────────────── */

/**
 * 체크포인트로 남기는 상태 — 끝난 세션은 체크포인트가 아니라 세션 기록으로 갑니다.
 */
export type ProgressStatus = Exclude<SessionStatus, "ended">;

/**
 * 한 턴의 결정 — **판정된 분기 id만** 남깁니다.
 *
 * 음성이나 타이핑으로 답하신 경우에도 발화 원문은 담지 않습니다.
 * 나중에 이어서 하실 때는 이 분기 id를 엔진에 그대로 다시 넣어 상태를 되짚습니다.
 */
export interface ProgressDecision {
  /** 이 결정을 내린 턴 id (재생 순서 확인용) */
  turnId: string;
  /** 그 턴의 CUE id */
  cueId?: string;
  /** 엔진이 판정한 분기 id */
  branchId: string;
  /** 보기 버튼으로 고르셨는지 — 되살릴 때 대화 로그 표기를 나눕니다 */
  viaButton: boolean;
}

/**
 * 진행 중인 훈련 1건. 시나리오당 한 개만 둡니다(같은 시나리오를 다시 시작하면 덮어씁니다).
 *
 * **여기에 발화 원문·대사 텍스트는 들어가지 않습니다.** 저장되는 것은
 * 결정 목록(분기 id)·게이지·⚑CF 횟수·재시도 횟수·상태뿐입니다.
 */
export interface SessionProgress {
  scenarioId: string;
  /** ISO 시각 */
  savedAt: string;
  decisions: ProgressDecision[];
  /** 초조도·긴장도 현재값 */
  gauge: number;
  cfCount: number;
  retriesUsed: number;
  status: ProgressStatus;
}

/**
 * 세션 이벤트에서 결정 목록만 뽑아냅니다.
 * `SessionEvent.utterance`(세션 메모리 안의 발화 원문)는 **여기서 버려집니다** —
 * 체크포인트로 나가는 경로는 이 함수 하나뿐이므로, 발화가 저장될 길이 없습니다.
 */
function toDecisions(events: SessionEvent[]): ProgressDecision[] {
  const out: ProgressDecision[] = [];
  for (const event of events) {
    const branchId = event.feedback?.branchId;
    if (typeof branchId !== "string" || branchId.length === 0) continue;
    if (branchId === "__none") continue;
    const decision: ProgressDecision = {
      turnId: typeof event.turnId === "string" ? event.turnId : "",
      branchId,
      viaButton: event.viaButton === true,
    };
    if (typeof event.cueId === "string" && event.cueId.length > 0) decision.cueId = event.cueId;
    out.push(decision);
  }
  return out;
}

/** 저장된 값이 훼손되었거나 옛 형식이어도 화면이 깨지지 않게 필요한 항목만 골라 담습니다. */
function sanitizeDecision(value: unknown): ProgressDecision | undefined {
  if (!value || typeof value !== "object") return undefined;
  const row = value as Record<string, unknown>;
  const branchId = typeof row.branchId === "string" ? row.branchId : "";
  if (branchId.length === 0) return undefined;
  const decision: ProgressDecision = {
    turnId: typeof row.turnId === "string" ? row.turnId : "",
    branchId,
    viaButton: row.viaButton === true,
  };
  if (typeof row.cueId === "string" && row.cueId.length > 0) decision.cueId = row.cueId;
  return decision;
}

/** 화이트리스트 방식으로 다시 만듭니다 — 모르는 항목은 그대로 버립니다. */
function sanitizeProgress(value: unknown): SessionProgress | undefined {
  if (!value || typeof value !== "object") return undefined;
  const row = value as Record<string, unknown>;
  const scenarioId = typeof row.scenarioId === "string" ? row.scenarioId : "";
  if (scenarioId.length === 0) return undefined;
  const status = row.status;
  if (status !== "running" && status !== "interrupted" && status !== "protocol") return undefined;
  const rawDecisions = Array.isArray(row.decisions) ? row.decisions : [];
  const decisions: ProgressDecision[] = [];
  for (const item of rawDecisions) {
    const decision = sanitizeDecision(item);
    if (decision) decisions.push(decision);
  }
  if (decisions.length === 0) return undefined;
  return {
    scenarioId,
    savedAt: typeof row.savedAt === "string" ? row.savedAt : "",
    decisions,
    gauge: typeof row.gauge === "number" ? row.gauge : 0,
    cfCount: typeof row.cfCount === "number" ? row.cfCount : 0,
    retriesUsed: typeof row.retriesUsed === "number" ? row.retriesUsed : 0,
    status,
  };
}

/**
 * 진행 중인 훈련을 체크포인트로 남깁니다(시나리오당 1건, 턴마다 갱신).
 * 끝난 세션이거나 아직 한 턴도 진행하지 않았으면 저장하지 않습니다.
 *
 * @example
 * saveProgress(state.session); // 턴 결정 직후마다 호출
 */
export function saveProgress(state: SessionState): SessionProgress | undefined {
  if (!state || typeof state.scenarioId !== "string" || state.scenarioId.length === 0) return undefined;
  if (state.status === "ended") {
    clearProgress(state.scenarioId);
    return undefined;
  }
  const decisions = toDecisions(state.events);
  if (decisions.length === 0) return undefined;

  const progress: SessionProgress = {
    scenarioId: state.scenarioId,
    savedAt: new Date().toISOString(),
    decisions,
    gauge: state.gauge,
    cfCount: state.cfCount,
    retriesUsed: state.retriesUsed,
    status: state.status,
  };
  const list = loadAllProgress().filter((p) => p.scenarioId !== progress.scenarioId);
  writeList(PROGRESS_KEY, [progress, ...list]);
  return progress;
}

/**
 * 저장된 체크포인트 전체(최신순).
 *
 * @example
 * const rows = loadAllProgress(); // [] 이면 진행 중인 훈련이 없습니다
 */
export function loadAllProgress(): SessionProgress[] {
  const out: SessionProgress[] = [];
  for (const raw of readList<unknown>(PROGRESS_KEY)) {
    const progress = sanitizeProgress(raw);
    if (progress) out.push(progress);
  }
  return out;
}

/**
 * 시나리오 하나의 체크포인트.
 *
 * @example
 * const saved = loadProgress("CHK-A01"); // 있으면 「이어서 하기」 카드를 띄웁니다
 */
export function loadProgress(scenarioId: string): SessionProgress | undefined {
  const key = scenarioId.toUpperCase();
  return loadAllProgress().find((p) => p.scenarioId.toUpperCase() === key);
}

/**
 * 체크포인트 1건 삭제 — 엔딩에 도달했거나 「처음부터」를 고르셨을 때 부릅니다.
 *
 * @example
 * clearProgress("CHK-A01");
 */
export function clearProgress(scenarioId: string): void {
  const key = scenarioId.toUpperCase();
  writeList(
    PROGRESS_KEY,
    loadAllProgress().filter((p) => p.scenarioId.toUpperCase() !== key),
  );
}

/** 체크포인트 전체 삭제 */
export function clearAllProgress(): void {
  writeList<SessionProgress>(PROGRESS_KEY, []);
}

/**
 * 「몇 번째 상황까지」 — 응답을 마친 상황(턴)의 개수입니다.
 * 같은 턴에서 ⚑CF로 다시 하신 경우는 한 번으로 셉니다. 점수가 아니라 진행 위치입니다.
 *
 * @example
 * progressStepCount(saved); // 3 → "3번째 상황까지"
 */
export function progressStepCount(progress: SessionProgress): number {
  const seen: string[] = [];
  for (const decision of progress.decisions) {
    const key = decision.turnId || decision.cueId || "";
    if (key.length === 0) continue;
    if (!seen.includes(key)) seen.push(key);
  }
  return seen.length > 0 ? seen.length : progress.decisions.length;
}
