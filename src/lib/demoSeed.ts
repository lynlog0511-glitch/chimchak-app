/**
 * 시연용 예시 기록 — 발표자 전용 시드.
 *
 * 왜 두는가: 5~7분 무대에서 「성장 기록」과 「이수 확인서」까지 보여 드리려면 완주 이력이 이미
 * 있어야 합니다. 깨끗한 노트북에서는 두 화면이 전부 빈 상태이고, 채우려면 세션을 실주행해야 해서
 * 발표 시간 예산을 넘깁니다.
 *
 * **정직성이 이 파일의 설계 제약입니다.** 여기서 심는 것은 예시이고, 예시가 진짜 증빙으로 오인되면
 * 기관 신뢰가 무너집니다. 그래서 네 가지를 지킵니다.
 *
 * 1. 심는 레코드의 id는 전부 `demo-`로 시작합니다 — 어느 화면에서든 문자열 비교 한 번으로 가려냅니다.
 * 2. **이수 누계(`chimchak.tally.v1`)에는 한 회차도 더하지 않습니다.** 확인서의 「합계」와 「총 이수
 *    시수」를 떠받치는 값이라, 여기에 시연 기록이 섞이면 증빙 자체가 무너집니다. 예시를 지우면
 *    누계는 심기 전 값 그대로입니다.
 * 3. 예시가 남아 있는 동안 성장 기록에는 안내줄이, 각 행에는 「예시」 표시가, 이수 확인서에는
 *    「예시 미리보기」와 「예시 — 발급되지 않음」이 붙습니다(인쇄물에도 그대로 남습니다).
 * 4. 지우기는 `demo-` 레코드만 지웁니다 — 같은 기기에 쌓인 진짜 기록과 누계는 건드리지 않습니다.
 *
 * 담기는 문구는 실제 시나리오 데이터의 강화·코칭 문장을 그대로 옮겨 온 것이라, 무대에서 보이는
 * 화면이 실주행 결과와 같은 모양입니다. 발화 원문은 애초에 어떤 경로로도 저장하지 않으므로
 * 예시에도 없습니다.
 */

import type { SessionRecord } from "@/types";
import {
  MAX_ITEMS,
  addSessionsWithoutTally,
  clearDemoSeedFlag,
  loadReports,
  loadSessions,
  readDemoSeedFlag,
  removeReportsByIdPrefix,
  removeSessionsByIdPrefix,
  saveReport,
  writeDemoSeedFlag,
  type StoredReport,
} from "./storage";

/** 예시 레코드 id 접두사 — 세션·보고 양쪽에 같은 접두사를 씁니다. */
export const DEMO_ID_PREFIX = "demo-";

/** 이 id가 시연용 예시인지. */
export function isDemoId(id: string | undefined): boolean {
  return typeof id === "string" && id.startsWith(DEMO_ID_PREFIX);
}

/**
 * 이 레코드가 시연용 예시인지 — 성장 기록·확인서가 「예시」 표시를 붙일 때 씁니다.
 *
 * @example
 * sessions.filter(isDemoRecord).length; // 3
 */
export function isDemoRecord(row: { id: string }): boolean {
  return isDemoId(row.id);
}

/** 무엇이 심기는지 한 줄로 — 발표자 화면과 성장 기록 안내줄이 같은 문장을 씁니다. */
export const DEMO_SEED_SUMMARY =
  "완주한 훈련 3회(치매 행동 · 응급 판단 · 갈등 대응 각 1회)와 확정한 보고 1건";

/* ── 심을 내용 ─────────────────────────────────────────── */

interface DemoSessionSpec {
  idSuffix: string;
  scenarioId: string;
  scenarioTitle: string;
  typeLabel: string;
  /** 오늘로부터 며칠 전 */
  daysAgo: number;
  hour: number;
  minute: number;
  /** 완주에 걸린 시간(초) — 실주행에서 나오는 4~6분대를 씁니다 */
  durationSec: number;
  verdict: SessionRecord["verdict"];
  endingTitle: string;
  greenChecks: string[];
  coachingPoints: string[];
  cfCount: number;
  retriesUsed: number;
}

/**
 * 예시 회차 3건 — 알파 감수를 지난 3종(A01·C01·B02)을 한 번씩입니다.
 *
 * 유형별 커버리지 4칸이 세 칸 차고 한 칸은 「—」로 남아 「다음엔 이 장면」 추천까지 살아 있는
 * 구성이라, 무대에서 성장 기록의 설계를 한 화면으로 설명할 수 있습니다.
 * 문구는 `src/data/scenarios/*`의 praise·coaching 원문 그대로입니다(창작하지 않습니다).
 */
export const DEMO_SESSIONS: DemoSessionSpec[] = [
  {
    idSuffix: "session-chk-a01",
    scenarioId: "CHK-A01",
    scenarioTitle: "현관 앞, 집에 가야 해요",
    typeLabel: "치매 행동심리증상(BPSD)",
    daysAgo: 8,
    hour: 14,
    minute: 20,
    durationSec: 312,
    verdict: "충족",
    endingTitle: "안전하게 마무리하셨습니다",
    greenChecks: [
      "집에 가고 싶은 마음을 먼저 알아주셨습니다.",
      "원인을 먼저 확인하셨습니다. 탐색이 다음 30분을 바꿉니다.",
      "지시 대신 두 개의 선택지를 드렸습니다.",
      "동의를 먼저 구하고 함께 움직이셨습니다. 억제 없이 안전을 확보한 대응입니다.",
      "어르신 안전을 먼저 두고, 다시 연락할 시점까지 정하셨습니다.",
      // 2026-08-26 — 앞 문구(「누가·언제·무엇을·어떻게·현재 상태가 모두 들어간…」)는 사실과
      // 달라 시나리오에서 걷어냈는데 이 예시 회차에만 남아 있었습니다(교육생 5차 med).
      // 2026-08-28 — 같은 이유로 뒷문장(「그대로 급여제공기록지에 적을 수 있습니다」)도
      // 걷어냈습니다(15차 감사 med · 사유는 chk-a01 R1-a에 있습니다).
      // 지금 값은 CHK-A01 R1-a의 praise 원문입니다.
      "보고 들은 것만 사실대로 옮기셨습니다.",
    ],
    coachingPoints: ["설명으로 이기려 하기보다, 무엇이 필요하신지 먼저 여쭤 주세요."],
    cfCount: 0,
    retriesUsed: 0,
  },
  {
    idSuffix: "session-chk-c01",
    scenarioId: "CHK-C01",
    scenarioTitle: "온 김에 반찬 좀",
    typeLabel: "이용자·보호자 갈등 화법",
    daysAgo: 4,
    hour: 10,
    minute: 5,
    durationSec: 363,
    verdict: "부분 충족",
    endingTitle: "부엌에서의 대화를 돌아보는 한 문장이 남았습니다",
    greenChecks: [
      "공감·불가 사유·대안 세 요소를 모두 쓰셨습니다. 관계를 지키면서 경계를 세운 화법입니다.",
      "감정으로 받지 않고 호칭만 정정 요청하셨습니다. 경계는 세우고 관계는 남기는 대응입니다.",
      "어르신을 먼저 안심시키고 대화 장소를 옮기셨습니다. 갈등 노출을 최소화한 판단입니다.",
      "시각과 사실만으로 정리하셨습니다. 그대로 기록지에 옮길 수 있습니다.",
    ],
    coachingPoints: [
      "맞서기보다 사실을 기록하고 절차로 옮기는 편이 안전합니다.",
      "고칠 점을 한 문장으로 정리하셨습니다.",
    ],
    cfCount: 0,
    retriesUsed: 1,
  },
  {
    idSuffix: "session-chk-b02",
    scenarioId: "CHK-B02",
    scenarioTitle: "점심 식사 중 사레",
    typeLabel: "응급 초기 대응",
    daysAgo: 1,
    hour: 12,
    minute: 35,
    durationSec: 287,
    verdict: "충족",
    endingTitle: "이양까지 마치셨습니다",
    greenChecks: [
      "식사를 멈추고, 기침을 격려하고, 소리가 나오는지 확인하셨습니다. 허용 범위 안의 정확한 첫 대응입니다.",
      "해석이 아니라 보이는 그대로 진술하셨습니다. 그대로 119에 전달할 수 있습니다.",
      "소리가 나오지 않는 것을 확인하고 즉시 119로 이양하셨습니다.",
      "질문을 다시 확인하고 관찰한 사실로 답하셨습니다.",
      "상황·배경·관찰·요청이 모두 들어간 인계입니다.",
      "변명하지 않고 관찰한 사실만 전달하셨습니다. 기록은 나중에 나를 지키는 근거가 됩니다.",
      "보고 시점과 기재 항목까지 특정하셨습니다.",
    ],
    coachingPoints: ["시각과 기저 상태(연하 저하·죽식)를 덧붙이면 인계가 완성됩니다."],
    cfCount: 0,
    retriesUsed: 0,
  },
];

interface DemoReportSpec {
  idSuffix: string;
  daysAgo: number;
  hour: number;
  minute: number;
  scenarioId: string;
  /** 가명처리를 마친 본문 — 원문은 예시에도 넣지 않습니다 */
  maskedText: string;
  draft: StoredReport["draft"];
  maskedCounts: Record<string, number>;
  elapsedSec: number;
}

/** 예시 확정 보고 1건 — 위 응급 회차(CHK-B02) 직후에 쓴 기록으로 두었습니다. */
const DEMO_REPORTS: DemoReportSpec[] = [
  {
    idSuffix: "report-chk-b02",
    daysAgo: 1,
    hour: 12,
    minute: 52,
    scenarioId: "CHK-B02",
    maskedText:
      "12시 20분경 [대상자]께서 점심 식사 중 사레가 있으셨습니다. 즉시 식사를 멈추고 기침을 하시도록 도왔으며, 목소리가 나오는 것을 확인했습니다. 현재는 안정되셨고 30분간 관찰을 이어가고 있습니다. [기관] 간호사에게 구두로 보고했습니다.",
    draft: {
      time: "12시 20분경",
      who: "[대상자]",
      what: "점심 식사 중 사레",
      action: "식사 중단 · 기침 격려 · 목소리 확인 후 간호사 보고",
      status: "안정 · 30분간 관찰 중",
      missing: [],
    },
    maskedCounts: { 성명: 1, 기관명: 1 },
    elapsedSec: 96,
  },
];

/* ── 심기·지우기 ───────────────────────────────────────── */

/** 며칠 전 몇 시 — 기기 현지 시각으로 잡습니다(화면 표기도 현지 시각입니다). */
function pastMoment(now: Date, daysAgo: number, hour: number, minute: number): Date {
  const at = new Date(now.getTime());
  at.setDate(at.getDate() - daysAgo);
  at.setHours(hour, minute, 0, 0);
  return at;
}

function buildDemoRecord(spec: DemoSessionSpec, now: Date): SessionRecord {
  const started = pastMoment(now, spec.daysAgo, spec.hour, spec.minute);
  const ended = new Date(started.getTime() + spec.durationSec * 1000);
  return {
    id: `${DEMO_ID_PREFIX}${spec.idSuffix}`,
    scenarioId: spec.scenarioId,
    scenarioTitle: spec.scenarioTitle,
    typeLabel: spec.typeLabel,
    startedAt: started.toISOString(),
    endedAt: ended.toISOString(),
    /* 예시도 **실주행과 같은 모양**으로 둡니다 — 실주행 기록은 진행 시간(`activeSec`)을 싣고
       나가므로, 예시만 그 칸이 비면 확인서 미리보기가 옛 기록 경로로 계산됩니다.
       자리를 비우지 않고 마친 회차를 흉내 내는 예시라 벽시계와 같은 값을 넣습니다. */
    activeSec: spec.durationSec,
    verdict: spec.verdict,
    endingTitle: spec.endingTitle,
    greenChecks: [...spec.greenChecks],
    coachingPoints: [...spec.coachingPoints],
    cfCount: spec.cfCount,
    retriesUsed: spec.retriesUsed,
    // 한 상황에 강화 또는 코칭 한 줄이 남으므로, 실주행과 같은 셈으로 둡니다.
    turnCount: spec.greenChecks.length + spec.coachingPoints.length,
  };
}

export interface DemoSeedResult {
  /** 실제로 심긴 예시 회차 */
  sessions: SessionRecord[];
  /** 실제로 심긴 예시 확정 보고 */
  reports: StoredReport[];
  /** 저장 상한(50건) 때문에 심지 못한 개수 — 진짜 기록을 밀어내지 않으려고 예시 쪽을 덜어 냅니다 */
  skipped: number;
}

/**
 * 시연용 예시 기록을 심습니다(발표자 전용).
 *
 * 같은 id로 다시 심으면 덮어쓰므로 여러 번 눌러도 늘어나지 않습니다.
 * **이수 누계는 건드리지 않습니다** — 예시는 화면에만 보이고 이수 시수에는 섞이지 않습니다.
 *
 * @example
 * const planted = seedDemoRecords(); // planted.sessions.length === 3
 */
export function seedDemoRecords(now: Date = new Date()): DemoSeedResult {
  const wanted = DEMO_SESSIONS.map((spec) => buildDemoRecord(spec, now));
  const sessions = addSessionsWithoutTally(wanted);

  const reports: StoredReport[] = [];
  let skippedReports = 0;
  for (const spec of DEMO_REPORTS) {
    const id = `${DEMO_ID_PREFIX}${spec.idSuffix}`;
    const existing = loadReports();
    // 상한에 걸린 상태에서 새로 끼워 넣으면 가장 오래된 진짜 기록이 밀려납니다 — 그때는 심지 않습니다.
    if (!existing.some((r) => r.id === id) && existing.length >= MAX_ITEMS) {
      skippedReports += 1;
      continue;
    }
    const at = pastMoment(now, spec.daysAgo, spec.hour, spec.minute);
    reports.push(
      saveReport({
        id,
        createdAt: at.toISOString(),
        maskedText: spec.maskedText,
        draft: { ...spec.draft, missing: [...spec.draft.missing] },
        maskedCounts: { ...spec.maskedCounts },
        scenarioId: spec.scenarioId,
        elapsedSec: spec.elapsedSec,
      }),
    );
  }

  if (sessions.length > 0 || reports.length > 0) {
    writeDemoSeedFlag({
      seededAt: now.toISOString(),
      sessionCount: sessions.length,
      reportCount: reports.length,
    });
  }

  return {
    sessions,
    reports,
    skipped: wanted.length - sessions.length + skippedReports,
  };
}

export interface DemoClearResult {
  sessions: number;
  reports: number;
}

/**
 * 심어 둔 예시를 전부 지웁니다. **진짜 기록과 이수 누계는 그대로 둡니다.**
 *
 * @example
 * clearDemoRecords(); // { sessions: 3, reports: 1 }
 */
export function clearDemoRecords(): DemoClearResult {
  const sessions = removeSessionsByIdPrefix(DEMO_ID_PREFIX);
  const reports = removeReportsByIdPrefix(DEMO_ID_PREFIX);
  clearDemoSeedFlag();
  return { sessions, reports };
}

/**
 * 지금 이 기기에 남아 있는 예시 개수 — 쪽지가 아니라 **저장된 레코드**를 세어 답합니다.
 *
 * @example
 * countDemoRecords(); // { sessions: 3, reports: 1, total: 4 }
 */
export function countDemoRecords(): DemoClearResult & { total: number } {
  const sessions = loadSessions().filter(isDemoRecord).length;
  const reports = loadReports().filter(isDemoRecord).length;
  return { sessions, reports, total: sessions + reports };
}

/**
 * 예시 기록이 심겨 있는지 — 참이면 화면은 안내줄과 「예시 미리보기」 표시를 켭니다.
 *
 * @example
 * hasDemoRecords(); // true
 */
export function hasDemoRecords(): boolean {
  return countDemoRecords().total > 0;
}

/** 언제 심었는지 — 예시가 실제로 남아 있을 때만 답합니다(쪽지만 남은 경우는 undefined). */
export function demoSeededAt(): string | undefined {
  if (!hasDemoRecords()) return undefined;
  return readDemoSeedFlag()?.seededAt;
}
