/**
 * 규칙 엔진 자가 점검 — **지금 이 브라우저에서** 경계 케이스를 돌려 보는 러너.
 *
 * 화면(/safety·/check)이 「경계 케이스 N/N 전수 통과 · p95 x ms」라고 적으려면 그 숫자가
 * 어딘가에서 실제로 나와야 한다. 이 파일이 그 자리다. 인용치를 옮겨 적지 않고,
 * 케이스 목록(src/data/ruleBoundaryCases.ts)을 받아 그 자리에서 판정을 돌린다.
 *
 * 순수 함수다 — React·DOM에 의존하지 않고, 시계만 `performance.now()`를 쓴다(없으면 Date).
 * 케이스 순서·반복 횟수가 같으면 통과/실패 결과는 항상 같다(결정론).
 *
 * 시간 재는 법: 브라우저의 performance.now()는 눈금이 굵어(보통 0.1ms) 한 번 호출로는
 * 대부분 0이 찍힌다. 그래서 케이스마다 `repeat`번 돌린 **총 시간을 나눈 평균**을 그 케이스의
 * 판정 시간으로 삼고, 케이스별 평균 30개 위에서 p50·p95를 구한다. 화면에도 그렇게 적는다.
 */

import type { ScenarioType } from "@/types";
import { checkEvidence, type EvidenceGuard } from "./evidence";
import { checkAdvisory, checkCritical } from "./rules";
import { judgeCallDelay } from "./timing";

/* ── 케이스 모양 ───────────────────────────────────────── */

/** 문장 하나로 규칙 사전을 때려 보는 경계 케이스 */
export interface RuleBoundaryCase {
  id: string;
  /** 넣는 문장 */
  utterance: string;
  /** 왜 경계인가 — 화면에서 실패했을 때 사람이 읽는 설명 */
  why: string;
  scenarioType?: ScenarioType;
  cueId?: string;
  appliedRubric?: string[];
  /** ⚑CF로 잡혀야 하는가 */
  cf: boolean;
  /** ⚑CF일 때 발동해야 하는 규칙 id */
  ruleId?: string;
  /** 코칭 규칙으로 반드시 잡혀야 하는 루브릭 항목 (순서 무관, 포함 검사) */
  advisory?: readonly string[];
  /** true면 코칭 규칙이 하나도 걸리지 않아야 한다 */
  noAdvisory?: boolean;
}

/** 경과 시간으로 CO-03을 판정하는 경계 케이스 */
export interface CallDelayBoundaryCase {
  id: string;
  elapsedSec: number;
  why: string;
  expectScore: 1 | 2 | 3 | 4;
}

/** 근거 화이트리스트 가드 경계 케이스 */
export interface EvidenceBoundaryCase {
  id: string;
  docId?: string;
  why: string;
  expectAllowed: boolean;
}

/* ── 결과 모양 ─────────────────────────────────────────── */

export interface CheckGroupResult {
  key: string;
  label: string;
  total: number;
  passed: number;
  /** 실패한 케이스 설명 (통과하면 빈 배열) */
  failures: string[];
}

export interface EngineSelfCheckResult {
  groups: CheckGroupResult[];
  total: number;
  passed: number;
  /** 케이스별 평균 판정 시간(ms)의 중앙값·p95·최댓값 */
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
  /** 케이스마다 몇 번씩 돌렸는지 */
  repeat: number;
  ranAt: number;
}

export interface EngineSelfCheckInput {
  ruleCases: readonly RuleBoundaryCase[];
  callDelayCases: readonly CallDelayBoundaryCase[];
  evidenceCases: readonly EvidenceBoundaryCase[];
  /** 근거 가드에 넘길 화이트리스트·고정 문구 (데이터에서 옵니다) */
  evidenceGuard: EvidenceGuard;
  /** 케이스별 반복 횟수 (기본 25) */
  repeat?: number;
}

/* ── 내부 ──────────────────────────────────────────────── */

function nowMs(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

/** 최근접 순위 방식 백분위 — 표본이 적어도 실제 관측값 하나를 그대로 돌려준다. */
function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const rank = Math.ceil(p * sorted.length);
  const index = Math.min(sorted.length - 1, Math.max(0, rank - 1));
  return sorted[index] ?? 0;
}

function sameSet(actual: readonly string[], expected: readonly string[]): boolean {
  return expected.every((id) => actual.includes(id));
}

/* ── 러너 ──────────────────────────────────────────────── */

/**
 * 경계 케이스를 전부 돌려 통과 건수와 판정 지연을 잰다.
 *
 * @example
 * const r = runEngineSelfCheck({ ruleCases: RULE_BOUNDARY_CASES, ... });
 * r.passed === r.total; // true 이길 기대합니다
 */
export function runEngineSelfCheck(input: EngineSelfCheckInput): EngineSelfCheckResult {
  const repeat = Math.max(1, input.repeat ?? 25);
  const durations: number[] = [];
  const ruleFailures: string[] = [];
  let rulePassed = 0;

  for (const testCase of input.ruleCases) {
    const opts = {
      scenarioType: testCase.scenarioType,
      cueId: testCase.cueId,
      appliedRubric: testCase.appliedRubric,
    };

    const started = nowMs();
    let critical = checkCritical(testCase.utterance, opts);
    let advisory = checkAdvisory(testCase.utterance, opts);
    for (let i = 1; i < repeat; i += 1) {
      critical = checkCritical(testCase.utterance, opts);
      advisory = checkAdvisory(testCase.utterance, opts);
    }
    durations.push((nowMs() - started) / repeat);

    const advisoryItems = advisory.map((finding) => finding.itemId);
    const problems: string[] = [];
    if (critical.cf !== testCase.cf) {
      problems.push(testCase.cf ? "⚑CF로 잡히지 않았습니다" : "⚑CF로 잘못 잡혔습니다");
    }
    if (testCase.cf && testCase.ruleId && critical.ruleId !== testCase.ruleId) {
      problems.push(`규칙 ${testCase.ruleId}가 아니라 ${critical.ruleId ?? "없음"}이 발동했습니다`);
    }
    if (testCase.advisory && !sameSet(advisoryItems, testCase.advisory)) {
      problems.push(`코칭 항목 ${testCase.advisory.join("·")}가 나오지 않았습니다`);
    }
    if (testCase.noAdvisory && advisoryItems.length > 0) {
      problems.push(`코칭이 없어야 하는데 ${advisoryItems.join("·")}가 나왔습니다`);
    }

    if (problems.length === 0) rulePassed += 1;
    else ruleFailures.push(`${testCase.id} — ${testCase.why} · ${problems.join(" / ")}`);
  }

  const delayFailures: string[] = [];
  let delayPassed = 0;
  for (const testCase of input.callDelayCases) {
    const finding = judgeCallDelay(testCase.elapsedSec * 1000);
    if (finding.score === testCase.expectScore) delayPassed += 1;
    else delayFailures.push(`${testCase.id} — ${testCase.why} · 판정이 어긋났습니다`);
  }

  const evidenceFailures: string[] = [];
  let evidencePassed = 0;
  for (const testCase of input.evidenceCases) {
    const check = checkEvidence(testCase.docId, input.evidenceGuard);
    const noticeOk = testCase.expectAllowed
      ? check.notice === undefined
      : check.notice === input.evidenceGuard.notFoundMessage;
    if (check.allowed === testCase.expectAllowed && noticeOk) evidencePassed += 1;
    else evidenceFailures.push(`${testCase.id} — ${testCase.why} · 가드가 다르게 동작했습니다`);
  }

  const groups: CheckGroupResult[] = [
    {
      key: "rules",
      label: "규칙 사전 경계 문장",
      total: input.ruleCases.length,
      passed: rulePassed,
      failures: ruleFailures,
    },
    {
      key: "delay",
      label: "119 지연 시간 규칙",
      total: input.callDelayCases.length,
      passed: delayPassed,
      failures: delayFailures,
    },
    {
      key: "evidence",
      label: "근거 화이트리스트 가드",
      total: input.evidenceCases.length,
      passed: evidencePassed,
      failures: evidenceFailures,
    },
  ];

  const sorted = [...durations].sort((a, b) => a - b);
  return {
    groups,
    total: groups.reduce((sum, group) => sum + group.total, 0),
    passed: groups.reduce((sum, group) => sum + group.passed, 0),
    p50Ms: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    maxMs: sorted[sorted.length - 1] ?? 0,
    repeat,
    ranAt: Date.now(),
  };
}
