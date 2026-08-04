/**
 * 침착(ChimChak) 로컬 저장소.
 *
 * 원칙
 * - 기기 안(localStorage)에만 저장한다. 서버 전송·외부 API 호출은 0건이다.
 * - **학습자 발화 원문은 저장하지 않는다.** 세션 기록에는 항목 판정 결과와 문구만 남는다.
 * - 보고 기록은 반드시 가명처리된 텍스트만 넣는다(engine/masking.maskText 통과분).
 * - SSR 가드: 서버 렌더링 중에는 조용히 빈 값으로 동작한다.
 */

import type { RecordDraft, SessionRecord } from "@/types";

export const SESSIONS_KEY = "chimchak.sessions.v1";
export const REPORTS_KEY = "chimchak.reports.v1";

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
  writeList(
    SESSIONS_KEY,
    loadSessions().filter((r) => r.id !== id),
  );
}

/** 세션 기록 전체 삭제 */
export function clearSessions(): void {
  writeList<SessionRecord>(SESSIONS_KEY, []);
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
