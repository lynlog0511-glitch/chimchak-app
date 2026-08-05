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
