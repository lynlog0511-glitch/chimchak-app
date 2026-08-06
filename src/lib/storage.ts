/**
 * 침착(ChimChak) 로컬 저장소.
 *
 * 원칙
 * - 기기 안(localStorage)에만 저장한다. 서버 전송·외부 API 호출은 0건이다.
 * - **학습자 발화 원문은 저장하지 않는다.** 세션 기록에는 항목 판정 결과와 문구만 남는다.
 * - 보고 기록은 반드시 가명처리된 텍스트만 넣는다(engine/masking.maskText 통과분).
 * - 진행 체크포인트(이어서 하기)에도 발화는 담지 않는다 — 판정된 분기 id와 게이지·횟수뿐이다.
 * - SSR 가드: 서버 렌더링 중에는 조용히 빈 값으로 동작한다.
 * - **쓰기 실패는 삼키지 않는다.** 예외는 밖으로 던지지 않되(화면이 죽으면 안 된다) 성공 여부는
 *   반드시 돌려준다 — 사이트 데이터가 막힌 브라우저에서 「저장했습니다」라고 말하지 않기 위해서다.
 * - **읽을 때는 필드 단위로 정화한다.** 한 필드가 어긋난 옛 기록 하나가 화면 전체를 죽이면
 *   사용자는 그 기록을 지울 화면에도 못 들어간다.
 */

import type { RecordDraft, SessionEvent, SessionRecord, SessionState, SessionStatus } from "@/types";

export const SESSIONS_KEY = "chimchak.sessions.v1";
export const REPORTS_KEY = "chimchak.reports.v1";
export const PROGRESS_KEY = "chimchak.progress.v1";
export const TALLY_KEY = "chimchak.tally.v1";
/** 시연용 예시 기록이 심겨 있는지 알리는 플래그(발표자 전용) — 값은 `lib/demoSeed`가 다룬다. */
export const DEMO_SEED_KEY = "chimchak.demoSeed.v1";

/** 너무 많이 쌓이지 않도록 최근 것만 남긴다 */
export const MAX_ITEMS = 50;

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

/**
 * 목록을 저장하고 **실제로 남았는지 돌려준다**.
 *
 * 예외는 밖으로 던지지 않는다(화면이 죽으면 안 된다). 다만 조용히 삼키지도 않는다 —
 * 사이트 데이터가 막힌 브라우저에서 앱이 「확정했습니다 · 이 기기에만 저장」을 띄우면서
 * 아무것도 남기지 않는 상태를 만들지 않기 위해, 실패했다는 사실만은 호출부로 올려 보낸다.
 */
function writeList<T>(key: string, list: T[]): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(list.slice(0, MAX_ITEMS)));
    return true;
  } catch {
    /* 저장 공간 부족·사생활 보호 모드 — 던지지 않고 실패로 돌려준다 */
    return false;
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

/** 값 하나를 저장하고 **실제로 남았는지 돌려준다**(사유는 `writeList`와 같다). */
function writeValue(key: string, value: unknown): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    /* 저장 공간 부족·사생활 보호 모드 — 던지지 않고 실패로 돌려준다 */
    return false;
  }
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ── 저장 실패를 알리는 문구 ───────────────────────────── */

/**
 * 저장이 실패했을 때 화면이 쓰는 제목 — 성공 문구가 서 있던 **같은 자리**에 세운다.
 *
 * 문구를 저장소가 들고 있는 이유는 하나다: 실패를 아는 곳이 여기뿐인데 말하는 곳은 화면이라,
 * 두 곳이 서로 다른 이야기를 하기 시작하면 「확정했습니다」와 「안 남았습니다」가 동시에 뜬다.
 */
export const SAVE_FAILED_TITLE = "이 기기에 저장하지 못했습니다";

/** 실패 제목 아래 한 줄 — 무엇이 막혔는지 사실대로 적고, 되는 척하지 않는다. */
export const SAVE_FAILED_BODY =
  "브라우저에서 사이트 데이터 저장이 막혀 있습니다. 시크릿 모드를 끄시거나 저장 공간을 비우신 뒤 다시 확정하시면 이 기기에 남습니다.";

/**
 * 훈련을 마쳤는데 회차가 남지 않았을 때의 한 줄.
 * 이수 시수·확인서가 이 기록 위에 서 있으므로, 무엇이 비게 되는지까지 함께 적는다.
 */
export const SESSION_SAVE_FAILED_BODY =
  "브라우저에서 사이트 데이터 저장이 막혀 있어 이번 회차가 기록에 남지 않았습니다. 성장 기록과 이수 확인서에도 이 회차는 세지 않습니다.";

/**
 * 앱이 열릴 때 한 번 알리는 문구 — 훈련을 마친 뒤가 아니라 **시작 전에** 알리려는 자리다.
 */
export const STORAGE_BLOCKED_NOTICE =
  "이 브라우저는 사이트 데이터 저장이 막혀 있어, 훈련 기록과 보고 기록이 이 기기에 남지 않습니다. 시연은 그대로 진행하실 수 있습니다.";

/**
 * 이 기기에 쓸 수 있는지 실제로 한 번 재 본다(시험 키를 썼다가 지운다).
 *
 * `/check`의 저장소 항목이 하던 일과 같은 방식이고, 화면이 부팅 시 한 줄 고지를 띄울지
 * 정하는 데 쓰라고 여기에 둔다. 앱 데이터 키는 건드리지 않는다.
 *
 * @example
 * if (!canWriteStorage()) show(STORAGE_BLOCKED_NOTICE);
 */
export function canWriteStorage(): boolean {
  const storage = getStorage();
  if (!storage) return false;
  const key = "chimchak.probe.v1";
  try {
    storage.setItem(key, "1");
    const ok = storage.getItem(key) === "1";
    storage.removeItem(key);
    return ok;
  } catch {
    return false;
  }
}

/* ── 훈련 세션 ─────────────────────────────────────────── */

/** 알려진 판정값 — 목록 밖 값이 든 기록은 무엇으로 표시할지 정할 수 없어 버린다. */
const VERDICTS: readonly SessionRecord["verdict"][] = [
  "충족",
  "부분 충족",
  "재시도",
  "재훈련",
  "재훈련 권고",
];

/** 문자열 자리 — 아니면 빈 문자열로 낮춘다. */
function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** 0 이상 정수 자리 — 아니면 0으로 낮춘다. */
function asCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

/** 문구 목록 자리 — 배열이 아니거나 문자열이 아닌 항목은 버린다. */
function asTextList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === "string" && item.length > 0) out.push(item);
  }
  return out;
}

/**
 * 저장된 세션 기록 한 건을 **필드 단위로 정화한다** — 이수 누계(`sanitizeTallyLine`)와 같은 방식이다.
 *
 * 버리는 기준은 셋뿐이다: id·scenarioId가 비었거나(무엇의 기록인지 알 수 없다), 판정값이
 * 알려진 다섯 중 하나가 아닐 때(엉뚱한 배지를 다는 것보다 없는 편이 정직하다).
 * 나머지는 모양이 어긋나도 버리지 않고 낮춰 담는다 — 배열 자리는 `[]`, 숫자 자리는 `0`,
 * 문자열 자리는 `""`. 화면(TrainingRow)이 `greenChecks.length`를 무가드로 읽기 때문에,
 * 한 필드가 어긋난 옛 기록 하나가 /history 전체와 그 안의 「이 기기의 기록 지우기」 버튼까지
 * 함께 날려 버리는 상태를 막는 것이 이 함수의 목적이다.
 *
 * **키 버전에 대한 결정**: 앞으로 필드를 더할 때도 키(`.v1`)를 올리지 않고 여기서 흡수한다.
 * 담기는 것이 이수 사실과 판정 문구뿐이라 옛 기록을 버릴 이유가 없고, 키를 올리면 사용자의
 * 이수 시수가 조용히 0으로 돌아간다. 필드를 **지우는** 변경이 생길 때만 새 키를 검토한다.
 */
function sanitizeSessionRecord(value: unknown): SessionRecord | undefined {
  if (!value || typeof value !== "object") return undefined;
  const row = value as Record<string, unknown>;
  const id = asText(row.id);
  const scenarioId = asText(row.scenarioId);
  if (id.length === 0 || scenarioId.length === 0) return undefined;
  const verdict = VERDICTS.find((item) => item === row.verdict);
  if (!verdict) return undefined;
  return {
    id,
    scenarioId,
    scenarioTitle: asText(row.scenarioTitle) || scenarioId,
    typeLabel: asText(row.typeLabel),
    startedAt: asText(row.startedAt),
    endedAt: asText(row.endedAt),
    verdict,
    endingTitle: asText(row.endingTitle),
    greenChecks: asTextList(row.greenChecks),
    coachingPoints: asTextList(row.coachingPoints),
    cfCount: asCount(row.cfCount),
    retriesUsed: asCount(row.retriesUsed),
    turnCount: asCount(row.turnCount),
  };
}

/**
 * 세션 기록을 저장한다(최신순). 같은 id가 있으면 덮어쓴다.
 *
 * **저장에 성공했는지 돌려준다** — false면 이 회차는 이 기기에 남지 않았다는 뜻이고,
 * 화면은 `SESSION_SAVE_FAILED_BODY`를 성공 문구가 서 있던 자리에 세운다.
 *
 * @example
 * if (!saveSession(buildRecord(scenario, state))) notify(SESSION_SAVE_FAILED_BODY);
 */
export function saveSession(record: SessionRecord): boolean {
  const list = loadSessions().filter((r) => r.id !== record.id);
  const stored = writeList(SESSIONS_KEY, [record, ...list]);
  // 상세는 50건 상한에 걸려 밀려나지만 「이수 사실」은 밀려나면 안 된다(아래 이수 누계).
  // 상세 쓰기가 실패해도 누계는 따로 시도한다 — 둘 중 하나라도 남는 편이 증빙에 유리하다.
  const tallied = addToTally(record);
  return stored && tallied;
}

/**
 * 저장된 세션 기록(최신순). 훼손된 레코드는 버리고, 필드가 어긋난 레코드는 낮춰 담는다.
 *
 * @example
 * const rows = loadSessions(); // [] 이면 빈 상태 화면
 */
export function loadSessions(): SessionRecord[] {
  const out: SessionRecord[] = [];
  for (const raw of readList<unknown>(SESSIONS_KEY)) {
    const record = sanitizeSessionRecord(raw);
    if (record) out.push(record);
  }
  return out;
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

/**
 * 이수 누계 전체 삭제.
 *
 * 가져오기 기록도 함께 지운다 — 누계가 0으로 돌아갔는데 「이미 가져온 발급번호」만 남아 있으면
 * 같은 파일을 다시 넣을 길이 막힌다.
 */
export function clearCompletionTally(): void {
  writeValue(TALLY_KEY, emptyTally());
  clearCompletionImports();
}

function laterIso(a: string, b: string): string {
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (Number.isNaN(ta)) return b;
  if (Number.isNaN(tb)) return a;
  return tb > ta ? b : a;
}

/**
 * 완주한 회차 하나를 누계에 더한다. 같은 id가 이미 반영돼 있으면 아무 일도 하지 않는다.
 * 실제로 남았는지 돌려준다(이미 세어 둔 회차는 「할 일이 없었다」이므로 성공으로 본다).
 */
function addToTally(record: SessionRecord): boolean {
  const tally = loadCompletionTally();
  if (tally.countedIds.includes(record.id)) return true;

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
  return writeValue(TALLY_KEY, tally);
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
  /**
   * 이 시나리오로 쌓인 이수 시수(초). 회차당 30분 상한을 적용한 값의 합이다.
   * 이수 사실 파일이 한 행에 실어 나르는 값이라, 행 단위로 합칠 수 있으려면 줄마다 있어야 한다.
   */
  seconds: number;
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
  /** 다른 기기의 이수 사실 파일에서 가져온 회차 수 — 합계 안에 들어 있다 */
  importedCount: number;
  /** 가져온 회차의 이수 시수(초) */
  importedSec: number;
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
    const sec = sessionSeconds(record);
    visibleCount += 1;
    visibleSec += sec;
    const found = map.get(key);
    if (found) {
      found.count += 1;
      found.seconds += sec;
      found.lastEndedAt = laterIso(found.lastEndedAt, at);
      continue;
    }
    map.set(key, {
      scenarioId: key,
      title: record.scenarioTitle,
      typeLabel: record.typeLabel,
      count: 1,
      seconds: sec,
      lastEndedAt: at,
    });
  }

  for (const line of tally.lines) {
    const found = map.get(line.scenarioId);
    if (found) {
      found.count = Math.max(found.count, line.count);
      found.seconds = Math.max(found.seconds, line.seconds);
      found.lastEndedAt = laterIso(found.lastEndedAt, line.lastEndedAt);
      continue;
    }
    map.set(line.scenarioId, {
      scenarioId: line.scenarioId,
      title: line.title,
      typeLabel: line.typeLabel,
      count: line.count,
      seconds: line.seconds,
      lastEndedAt: line.lastEndedAt,
    });
  }

  const lines = [...map.values()].sort(
    (a, b) => new Date(b.lastEndedAt).getTime() - new Date(a.lastEndedAt).getTime(),
  );
  const totalCount = Math.max(visibleCount, tally.count);
  const totalSec = Math.max(visibleSec, tally.seconds);

  // 가져온 회차는 상세가 이 기기에 없지만 「50건 상한에 밀려난 것」과는 사유가 다르다 —
  // 확인서가 두 사유를 다른 문장으로 적을 수 있게 따로 세어 넘긴다.
  let importedCount = 0;
  let importedSec = 0;
  for (const entry of loadCompletionImports()) {
    importedCount += entry.count;
    importedSec += entry.seconds;
  }

  return {
    number: issueNumberFor(lines, totalCount, totalSec),
    totalCount,
    totalSec,
    lines,
    hiddenCount: Math.max(0, totalCount - visibleCount - importedCount),
    importedCount,
    importedSec,
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

/** 파일 안의 「YYYY-MM-DD HH:mm」을 다시 ISO로 되돌린다(현지 시각 기준). 읽지 못하면 빈 문자열. */
function csvDateTimeToIso(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length === 0) return "";
  const date = new Date(trimmed.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

/**
 * 이수 사실 파일의 열 이름 — **이 배열이 곧 서식 계약**이다.
 *
 * 한 행이 시나리오 하나이고 모든 행의 열 수가 같은 평평한 표라, 25명분을 그대로 이어 붙여도
 * 표가 깨지지 않는다(예전 서식은 머리블록 + 빈 행 + 본표로 나뉜 비직사각형이라 엑셀에서
 * 합칠 수 없었다). 맨 앞의 발급번호가 사람 대신 기록 집합을 가리키는 구분자다.
 *
 * 합계 두 열은 행마다 같은 값이 반복된다 — 일부러 둔 중복이다. 줄 값의 합과 대조해 고쳐 쓴
 * 파일을 걸러 낼 수 있고, 피벗 표에서 합계를 다시 세지 않아도 된다.
 */
export const COMPLETION_CSV_HEADERS = [
  "발급번호",
  "만든 시각",
  "시나리오 번호",
  "시나리오",
  "유형",
  "이수 횟수",
  "이수 시수(분)",
  "최근 완료",
  "합계 이수 회차",
  "총 이수 시수(분)",
  "담긴 내용",
] as const;

/** 파일이 혼자 돌아다닐 때도 무엇이 안 담겼는지 함께 가도록 마지막 열에 싣는 문장. */
export const COMPLETION_CSV_NOTE = "이수 사실만 — 판정·대화·발화 원문·성명·소속 없음";

/**
 * 이수 사실만 담은 CSV 문자열을 만든다.
 *
 * **담기는 것**: 발급번호·만든 시각·시나리오별 이수 횟수와 시수·최근 완료 시각·합계.
 * **담기지 않는 것**: 발화 원문·대화 내용·판정 결과·성명·소속 — 개인정보는 한 칸도 넣지 않는다.
 * 엑셀에서 한글이 깨지지 않도록 앞에 BOM을 붙인다.
 *
 * @example
 * const csv = buildCompletionCsv(buildCompletionSummary(), new Date().toISOString());
 */
export function buildCompletionCsv(summary: CompletionSummary, issuedAt: string): string {
  const totalMinutes = Math.round(summary.totalSec / 60);
  const madeAt = csvDateTime(issuedAt);
  const rows: string[][] = [[...COMPLETION_CSV_HEADERS]];
  for (const line of summary.lines) {
    rows.push([
      summary.number,
      madeAt,
      line.scenarioId,
      line.title,
      line.typeLabel,
      String(line.count),
      String(Math.round(line.seconds / 60)),
      csvDateTime(line.lastEndedAt),
      String(summary.totalCount),
      String(totalMinutes),
      COMPLETION_CSV_NOTE,
    ]);
  }
  const body = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  return `\uFEFF${body}\r\n`;
}

/* ── 이수 사실 파일 가져오기 ──────────────────────────────── */

/** 이미 가져온 파일 목록 — 같은 발급번호를 두 번 더하지 않기 위한 기록이다. */
export const IMPORTS_KEY = "chimchak.imports.v1";

/** 가져온 이수 사실 한 건 — 담기는 것은 발급번호와 합계뿐이고, 사람을 가리키는 값은 없다. */
export interface CompletionImport {
  /** 파일에 적혀 있던 발급번호 */
  number: string;
  /** 가져온 시각 (ISO) */
  importedAt: string;
  /** 이 파일로 더해진 회차 수 */
  count: number;
  /** 이 파일로 더해진 이수 시수(초) */
  seconds: number;
}

function sanitizeImport(value: unknown): CompletionImport | undefined {
  if (!value || typeof value !== "object") return undefined;
  const row = value as Record<string, unknown>;
  const number = typeof row.number === "string" ? row.number : "";
  if (number.length === 0) return undefined;
  return {
    number,
    importedAt: typeof row.importedAt === "string" ? row.importedAt : "",
    count: typeof row.count === "number" && row.count > 0 ? Math.floor(row.count) : 0,
    seconds: typeof row.seconds === "number" && row.seconds > 0 ? Math.round(row.seconds) : 0,
  };
}

/**
 * 이 기기가 가져온 이수 사실 파일 목록(최근 것이 앞).
 *
 * @example
 * loadCompletionImports().map((row) => row.number); // ["CHK-3F7A-9C21"]
 */
export function loadCompletionImports(): CompletionImport[] {
  const out: CompletionImport[] = [];
  for (const raw of readList<unknown>(IMPORTS_KEY)) {
    const row = sanitizeImport(raw);
    if (row) out.push(row);
  }
  return out;
}

/** 가져오기 기록 전체 삭제 — 누계가 0인데 「이미 가져왔다」만 남는 상태를 만들지 않는다. */
export function clearCompletionImports(): void {
  writeList<CompletionImport>(IMPORTS_KEY, []);
}

/** 가져오기가 막힌 사유 — 화면 문구는 `completionImportMessage`가 만든다. */
export type CompletionImportError =
  | "empty"
  | "format"
  | "number"
  | "row"
  | "total"
  | "same-device"
  | "duplicate";

/** 사유별 안내 문장 — 무엇이 어긋났는지 사실대로 적고, 되는 척하지 않는다. */
export function completionImportMessage(reason: CompletionImportError): string {
  switch (reason) {
    case "empty":
      return "파일이 비어 있거나 표가 들어 있지 않습니다.";
    case "format":
      return "이 앱에서 내려받은 이수 사실 파일이 아닙니다 — 머리글 줄이 서식과 다릅니다.";
    case "number":
      return "발급번호 칸이 비었거나 서식과 다릅니다. 한 파일에는 한 발급번호만 담깁니다.";
    case "row":
      return "이수 횟수·이수 시수 칸에 숫자가 아닌 값이 들어 있습니다.";
    case "total":
      return "파일 안의 합계가 줄 값과 맞지 않습니다 — 고쳐 쓴 파일은 가져오지 않습니다.";
    case "same-device":
      return "이 기기에서 만든 파일입니다 — 같은 이수 사실을 두 번 세지 않습니다.";
    default:
      return "이미 가져온 발급번호입니다 — 같은 파일을 두 번 더하지 않습니다.";
  }
}

/** 파일에서 읽어 낸 이수 사실 한 벌. */
export interface ParsedCompletionFile {
  number: string;
  /** 파일에 적혀 있던 「만든 시각」 표기 그대로 */
  issuedAt: string;
  totalCount: number;
  totalMinutes: number;
  lines: CompletionLine[];
}

export type CompletionParseResult =
  | { ok: true; file: ParsedCompletionFile }
  | { ok: false; reason: CompletionImportError };

/** 따옴표·줄바꿈이 든 칸을 포함해 CSV 한 판을 행 배열로 읽는다. 빈 줄은 버린다. */
function parseCsvRows(text: string): string[][] {
  const body = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (quoted) {
      if (ch === '"') {
        if (body[i + 1] === '"') {
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
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\r") continue;
    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += ch;
  }
  row.push(cell);
  rows.push(row);
  return rows.filter((cells) => cells.some((value) => value.trim().length > 0));
}

/** 「CHK-3F7A-9C21」 서식인지 — 발급번호는 이 모양 하나뿐이다. */
const ISSUE_NUMBER_RE = /^CHK-[0-9A-F]{4}-[0-9A-F]{4}$/;

function parseWhole(text: string): number | undefined {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return undefined;
  return Number.parseInt(trimmed, 10);
}

/**
 * 이수 사실 파일을 읽어 검증한다. **저장은 하지 않는다.**
 *
 * 통과 조건: 머리글이 서식과 같고, 모든 행의 발급번호가 하나이며, 줄 값의 합이 파일에 적힌
 * 합계와 맞을 것. 시수는 줄마다 분으로 반올림해 적히므로 줄 수만큼의 오차까지 허용한다.
 *
 * @example
 * const read = parseCompletionCsv(text);
 * if (read.ok) read.file.totalCount; // 4
 */
export function parseCompletionCsv(text: string): CompletionParseResult {
  const rows = parseCsvRows(text ?? "");
  if (rows.length < 2) return { ok: false, reason: "empty" };

  const header = (rows[0] as string[]).map((cell) => cell.trim());
  if (header.length !== COMPLETION_CSV_HEADERS.length) return { ok: false, reason: "format" };
  for (let i = 0; i < COMPLETION_CSV_HEADERS.length; i += 1) {
    if (header[i] !== COMPLETION_CSV_HEADERS[i]) return { ok: false, reason: "format" };
  }

  let number = "";
  let issuedAt = "";
  let totalCount: number | undefined;
  let totalMinutes: number | undefined;
  let sumCount = 0;
  let sumMinutes = 0;
  const lines: CompletionLine[] = [];

  for (const raw of rows.slice(1)) {
    if (raw.length !== COMPLETION_CSV_HEADERS.length) return { ok: false, reason: "format" };
    const cells = raw.map((cell) => cell.trim());
    const rowNumber = cells[0] as string;
    if (!ISSUE_NUMBER_RE.test(rowNumber)) return { ok: false, reason: "number" };
    if (number.length === 0) {
      number = rowNumber;
      issuedAt = cells[1] as string;
    } else if (rowNumber !== number) {
      return { ok: false, reason: "number" };
    }

    const scenarioId = (cells[2] as string).toUpperCase();
    if (scenarioId.length === 0) return { ok: false, reason: "row" };
    const count = parseWhole(cells[5] as string);
    const minutes = parseWhole(cells[6] as string);
    if (count === undefined || count < 1 || minutes === undefined) return { ok: false, reason: "row" };
    const rowTotalCount = parseWhole(cells[8] as string);
    const rowTotalMinutes = parseWhole(cells[9] as string);
    if (rowTotalCount === undefined || rowTotalMinutes === undefined) {
      return { ok: false, reason: "row" };
    }
    if (totalCount === undefined) {
      totalCount = rowTotalCount;
      totalMinutes = rowTotalMinutes;
    } else if (rowTotalCount !== totalCount || rowTotalMinutes !== totalMinutes) {
      return { ok: false, reason: "total" };
    }

    sumCount += count;
    sumMinutes += minutes;
    lines.push({
      scenarioId,
      title: (cells[3] as string).length > 0 ? (cells[3] as string) : scenarioId,
      typeLabel: cells[4] as string,
      count,
      seconds: minutes * 60,
      lastEndedAt: csvDateTimeToIso(cells[7] as string),
    });
  }

  if (lines.length === 0 || totalCount === undefined || totalMinutes === undefined) {
    return { ok: false, reason: "empty" };
  }
  if (sumCount !== totalCount) return { ok: false, reason: "total" };
  if (Math.abs(sumMinutes - totalMinutes) > lines.length) return { ok: false, reason: "total" };

  return { ok: true, file: { number, issuedAt, totalCount, totalMinutes, lines } };
}

export type CompletionImportResult =
  | { ok: true; number: string; addedCount: number; addedSec: number; lineCount: number }
  | { ok: false; reason: CompletionImportError; message: string };

/** 가져온 줄을 이수 누계에 더한다. 상세 목록에는 넣지 않는다 — 파일에 대화도 판정도 없다. */
function addImportedLines(lines: CompletionLine[]): { count: number; seconds: number } {
  const tally = loadCompletionTally();
  let count = 0;
  let seconds = 0;
  for (const line of lines) {
    const key = line.scenarioId.trim().toUpperCase();
    const found = tally.lines.find((row) => row.scenarioId === key);
    if (found) {
      found.count += line.count;
      found.seconds += line.seconds;
      found.lastEndedAt = laterIso(found.lastEndedAt, line.lastEndedAt);
      if (found.title.length === 0) found.title = line.title;
      if (found.typeLabel.length === 0) found.typeLabel = line.typeLabel;
    } else {
      tally.lines.push({
        scenarioId: key,
        title: line.title,
        typeLabel: line.typeLabel,
        count: line.count,
        seconds: line.seconds,
        lastEndedAt: line.lastEndedAt,
      });
    }
    count += line.count;
    seconds += line.seconds;
  }
  tally.count += count;
  tally.seconds += seconds;
  tally.updatedAt = new Date().toISOString();
  writeValue(TALLY_KEY, tally);
  return { count, seconds };
}

/**
 * 다른 기기에서 내려받은 이수 사실 파일을 이 기기의 이수 누계에 합친다.
 *
 * 막는 것 둘 — 이 기기가 방금 만든 파일(발급번호가 같다)과 이미 가져온 발급번호다.
 * 더해지는 것은 시나리오별 이수 횟수·시수뿐이고, 상세 기록·판정·대화는 파일에 애초에 없다.
 * 시연용 예시가 섞인 기기인지는 화면 쪽에서 먼저 가린다(저장소는 예시 개념을 알지 못한다).
 *
 * @example
 * const merged = importCompletionCsv(text);
 * if (merged.ok) merged.addedCount; // 4
 */
export function importCompletionCsv(text: string): CompletionImportResult {
  const read = parseCompletionCsv(text);
  if (!read.ok) {
    return { ok: false, reason: read.reason, message: completionImportMessage(read.reason) };
  }

  const { file } = read;
  if (file.number === buildCompletionSummary().number) {
    return { ok: false, reason: "same-device", message: completionImportMessage("same-device") };
  }
  if (loadCompletionImports().some((row) => row.number === file.number)) {
    return { ok: false, reason: "duplicate", message: completionImportMessage("duplicate") };
  }

  const added = addImportedLines(file.lines);
  const entry: CompletionImport = {
    number: file.number,
    importedAt: new Date().toISOString(),
    count: added.count,
    seconds: added.seconds,
  };
  writeList(IMPORTS_KEY, [entry, ...loadCompletionImports()]);

  return {
    ok: true,
    number: file.number,
    addedCount: added.count,
    addedSec: added.seconds,
    lineCount: file.lines.length,
  };
}

/* ── 보고 기록 ─────────────────────────────────────────── */

export type ReportInput = Omit<StoredReport, "id" | "createdAt"> & Partial<Pick<StoredReport, "id" | "createdAt">>;

/**
 * `saveReport`가 돌려주는 값 — 저장된 기록에 **성공 여부 한 칸**을 얹은 것이다.
 *
 * `StoredReport`를 그대로 넓힌 모양이라 기존 호출부는 손대지 않아도 그대로 동작한다.
 * `persisted`는 **반환값에만 있고 저장되지는 않는다** — 저장된 JSON에는 이 칸이 없다.
 */
export interface SavedReport extends StoredReport {
  /** 이 기기에 실제로 남았는지. false면 화면은 `SAVE_FAILED_TITLE`/`SAVE_FAILED_BODY`를 세운다. */
  persisted: boolean;
}

/**
 * 확정한 보고 기록을 저장한다. maskedText에는 반드시 가명처리 결과만 넣는다.
 *
 * @example
 * const saved = saveReport({ maskedText: masked, draft, scenarioId: "CHK-A01" });
 * if (!saved.persisted) show(SAVE_FAILED_TITLE, SAVE_FAILED_BODY);
 */
export function saveReport(report: ReportInput): SavedReport {
  const stored: StoredReport = {
    ...report,
    id: report.id ?? makeId("report"),
    createdAt: report.createdAt ?? new Date().toISOString(),
  };
  const list = loadReports().filter((r) => r.id !== stored.id);
  const persisted = writeList(REPORTS_KEY, [stored, ...list]);
  return { ...stored, persisted };
}

/** 기록 초안 5칸 — 칸이 어긋나 있어도 화면이 빈칸을 그릴 수 있게 문자열 자리를 맞춰 둔다. */
function sanitizeDraft(value: unknown): RecordDraft {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    time: asText(row.time),
    who: asText(row.who),
    what: asText(row.what),
    action: asText(row.action),
    status: asText(row.status),
    missing: asTextList(row.missing),
  };
}

/** 가려진 항목 수 — 숫자가 아닌 값이 섞여 있으면 그 항목만 버린다. */
function sanitizeMaskedCounts(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const out: Record<string, number> = {};
  for (const [key, count] of Object.entries(value as Record<string, unknown>)) {
    if (typeof count === "number" && Number.isFinite(count)) out[key] = Math.floor(count);
  }
  return out;
}

/**
 * 저장된 보고 기록 한 건을 필드 단위로 정화한다(`sanitizeSessionRecord`와 같은 규율).
 *
 * 버리는 기준은 둘 — id가 비었거나 maskedText가 문자열이 아닐 때다. 본문이 없는 보고는
 * 화면에 그릴 것이 없고, **가명처리를 통과한 본문만 저장한다**는 계약이 깨진 값이기도 하다.
 * 5칸 초안·가림 건수처럼 모양만 어긋난 값은 낮춰 담아 목록 전체를 잃지 않게 한다.
 */
function sanitizeReport(value: unknown): StoredReport | undefined {
  if (!value || typeof value !== "object") return undefined;
  const row = value as Record<string, unknown>;
  const id = asText(row.id);
  if (id.length === 0 || typeof row.maskedText !== "string") return undefined;
  const report: StoredReport = {
    id,
    createdAt: asText(row.createdAt),
    maskedText: row.maskedText,
    draft: sanitizeDraft(row.draft),
  };
  const counts = sanitizeMaskedCounts(row.maskedCounts);
  if (counts) report.maskedCounts = counts;
  const scenarioId = asText(row.scenarioId);
  if (scenarioId.length > 0) report.scenarioId = scenarioId;
  if (typeof row.elapsedSec === "number" && Number.isFinite(row.elapsedSec)) {
    report.elapsedSec = Math.round(row.elapsedSec);
  }
  return report;
}

/**
 * 저장된 보고 기록(최신순). 훼손된 레코드는 버리고, 필드가 어긋난 레코드는 낮춰 담는다.
 *
 * @example
 * const reports = loadReports();
 */
export function loadReports(): StoredReport[] {
  const out: StoredReport[] = [];
  for (const raw of readList<unknown>(REPORTS_KEY)) {
    const report = sanitizeReport(raw);
    if (report) out.push(report);
  }
  return out;
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

/* ── 시연용 예시 기록 (발표자 전용 시드) ────────────────────── */

/**
 * 예시 기록을 심었다는 사실만 적어 두는 쪽지.
 *
 * **판단 근거로 쓰지 않습니다** — 예시가 남아 있는지는 언제나 저장된 레코드의 id를 보고 정합니다
 * (`lib/demoSeed.hasDemoRecords`). 사용자가 「이 기기의 기록 지우기」로 전부 지우면 이 쪽지만 남는데,
 * 그때 화면이 "예시가 있다"고 말하면 거짓이 되기 때문입니다. 여기 담기는 것은 심은 시각과 개수뿐입니다.
 */
export interface DemoSeedFlag {
  /** 심은 시각 (ISO) */
  seededAt: string;
  sessionCount: number;
  reportCount: number;
}

/** 시드 쪽지를 읽는다. 없거나 훼손되었으면 undefined. */
export function readDemoSeedFlag(): DemoSeedFlag | undefined {
  const raw = readValue(DEMO_SEED_KEY);
  if (!raw || typeof raw !== "object") return undefined;
  const row = raw as Record<string, unknown>;
  const seededAt = typeof row.seededAt === "string" ? row.seededAt : "";
  if (seededAt.length === 0) return undefined;
  return {
    seededAt,
    sessionCount: typeof row.sessionCount === "number" ? Math.max(0, Math.floor(row.sessionCount)) : 0,
    reportCount: typeof row.reportCount === "number" ? Math.max(0, Math.floor(row.reportCount)) : 0,
  };
}

/** 시드 쪽지를 남긴다. */
export function writeDemoSeedFlag(flag: DemoSeedFlag): void {
  writeValue(DEMO_SEED_KEY, flag);
}

/** 시드 쪽지를 지운다. */
export function clearDemoSeedFlag(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(DEMO_SEED_KEY);
  } catch {
    /* 사생활 보호 모드 — 조용히 무시한다 */
  }
}

function timeOf(iso: string): number {
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * 시연용 예시 회차를 **상세 목록에만** 넣는다.
 *
 * `saveSession`과 다른 점이 이 함수의 존재 이유다 — **이수 누계(TALLY_KEY)를 건드리지 않는다.**
 * 시연 기록이 진짜 이수 시수에 섞이면 확인서가 증빙으로서 무너지므로, 예시는 화면에만 보이고
 * 누계에는 한 회차도 더하지 않는다. 예시를 지우면 시수는 심기 전 값 그대로 돌아온다.
 *
 * 50건 상한을 넘기는 몫은 **예시 쪽에서 덜어 낸다** — 예시를 심었다가 진짜 기록이 밀려나면
 * 되돌릴 방법이 없기 때문이다. 실제로 저장된 예시 회차만 돌려준다.
 *
 * @example
 * addSessionsWithoutTally(demoRecords); // 이수 누계는 그대로
 */
export function addSessionsWithoutTally(records: SessionRecord[]): SessionRecord[] {
  const incoming = new Set(records.map((r) => r.id));
  const kept = loadSessions().filter((r) => !incoming.has(r.id));
  const room = Math.max(0, MAX_ITEMS - kept.length);
  const seeded = records.slice(0, room);
  if (seeded.length === 0) return [];
  const merged = [...seeded, ...kept].sort((a, b) => timeOf(b.endedAt) - timeOf(a.endedAt));
  writeList(SESSIONS_KEY, merged);
  return seeded;
}

/**
 * id가 접두사로 시작하는 세션 기록만 지운다. 지운 개수를 돌려준다.
 *
 * 이수 누계는 손대지 않는다 — 이 경로로 들어온 기록은 애초에 누계에 더해진 적이 없다.
 * (사용자가 지운 회차를 누계에서 빼는 일은 `deleteSession`이 계속 담당한다.)
 */
export function removeSessionsByIdPrefix(prefix: string): number {
  const list = loadSessions();
  const kept = list.filter((r) => !r.id.startsWith(prefix));
  if (kept.length === list.length) return 0;
  writeList(SESSIONS_KEY, kept);
  return list.length - kept.length;
}

/** id가 접두사로 시작하는 보고 기록만 지운다. 지운 개수를 돌려준다. */
export function removeReportsByIdPrefix(prefix: string): number {
  const list = loadReports();
  const kept = list.filter((r) => !r.id.startsWith(prefix));
  if (kept.length === list.length) return 0;
  writeList(REPORTS_KEY, kept);
  return list.length - kept.length;
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
