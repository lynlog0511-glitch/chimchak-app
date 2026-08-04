/**
 * 침착(ChimChak) 발화 분류기.
 *
 * 시나리오 데이터(CueDef)의 분기 패턴만 보고 결정론적으로 분류한다. 외부 호출 0건.
 * 나중에 경량 LLM(교체형 어댑터)을 붙이더라도 이 함수의 시그니처를 그대로 유지하고,
 * 패턴 미일치 구간만 어댑터에 넘기면 된다.
 *
 * 판정 순서
 * 1) 버튼으로 분기를 직접 지정했으면(branchId) 그 분기가 최우선 — 데이터의 판단을 그대로 따른다.
 * 2) ⚑CF 플래그가 붙은 분기의 패턴을 먼저 검사한다 (안전 판정 우선).
 * 3) 나머지 분기를 배열 순서대로 부분 문자열 대조한다 (공백 제거·소문자화).
 * 4) 그래도 못 찾으면 defaultBranchId.
 */

import type { BranchDef, CueDef } from "@/types";
import { indexOfPattern, isNegated, normalize } from "./rules";

export type ClassifySource = "button" | "criticalPattern" | "pattern" | "default";

export interface ClassifyResult {
  branch: BranchDef;
  source: ClassifySource;
  /** 어떤 패턴에 걸렸는지 (디버깅·설명용) */
  matchedPattern?: string;
}

/** 데이터가 비어 있을 때만 쓰는 안전망 분기 (next가 빈 문자열이면 세션은 같은 턴에 머문다) */
const NEUTRAL_BRANCH: BranchDef = {
  id: "__none",
  label: "미분류",
  patterns: [],
  gaugeDelta: 0,
  aiReaction: "",
  rubricHits: [],
  next: "",
};

/**
 * CUE 안에서 분기 id로 찾는다.
 *
 * @example
 * findBranch(cue, "D1-c")?.label; // "감정 인정형"
 */
export function findBranch(cue: CueDef, branchId: string): BranchDef | undefined {
  return cue.branches.find((b) => b.id === branchId);
}

/**
 * 무응답·미분류 시 적용할 기본 분기.
 *
 * @example
 * defaultBranch(cue).id; // cue.defaultBranchId
 */
export function defaultBranch(cue: CueDef): BranchDef {
  return findBranch(cue, cue.defaultBranchId) ?? cue.branches[0] ?? NEUTRAL_BRANCH;
}

/**
 * 버튼 폴백으로 노출할 분기 목록 (fallbackOption이 있는 분기만).
 * 마이크 없이도 완주할 수 있어야 하므로 훈련 화면은 이 목록을 상시 노출한다.
 *
 * @example
 * fallbackBranches(cue).map(b => b.fallbackOption);
 */
export function fallbackBranches(cue: CueDef): BranchDef[] {
  return cue.branches.filter((b) => typeof b.fallbackOption === "string" && b.fallbackOption.length > 0);
}

/**
 * 분기 패턴 대조.
 *
 * - 정규화 후 2글자 미만이 되는 패턴은 무시한다.
 *   ("음…", "어…" 처럼 구두점이 지워지면 한 글자만 남아 사실상 모든 발화를 삼킨다.)
 * - 패턴이 '-시'로 끝나면 존경 선어말어미 활용형(-신/-셨/-세…)까지 받는다.
 * - `skipNegated`(⚑CF 분기 전용)면 "밀어내지 않고", "억지로 하지 않고"처럼
 *   부정 문맥 안의 매치는 건너뛴다. 규칙 엔진(rules.ts)과 같은 기준이다.
 */
function matchPattern(
  normalizedUtterance: string,
  branch: BranchDef,
  skipNegated = false,
): string | undefined {
  for (const pattern of branch.patterns) {
    const needle = normalize(pattern);
    if (needle.length < 2) continue;
    let from = 0;
    for (;;) {
      const idx = indexOfPattern(normalizedUtterance, needle, from);
      if (idx < 0) break;
      const end = idx + needle.length;
      if (!skipNegated || !isNegated(normalizedUtterance, idx, end)) return pattern;
      from = idx + 1;
    }
  }
  return undefined;
}

/**
 * 발화를 분기로 분류한다 (엔진 계약 시그니처).
 *
 * @example
 * classifyUtterance(cue, "마음이 급하시겠어요").id; // "D1-c"
 * classifyUtterance(cue, "").id;                   // cue.defaultBranchId
 */
export function classifyUtterance(cue: CueDef, utterance: string): BranchDef {
  return classifyInput(cue, { utterance }).branch;
}

/**
 * 버튼 선택과 자유 발화를 함께 처리하는 분류기.
 *
 * @example
 * classifyInput(cue, { branchId: "D3-d" }).source;              // "button"
 * classifyInput(cue, { utterance: "밀어서라도" }).source;        // "criticalPattern" (⚑CF 분기 우선)
 * classifyInput(cue, { utterance: "음…" }).source;               // "default"
 */
export function classifyInput(cue: CueDef, input: { utterance?: string; branchId?: string }): ClassifyResult {
  // 1) 버튼으로 고른 분기가 최우선
  if (input.branchId) {
    const picked = findBranch(cue, input.branchId);
    if (picked) return { branch: picked, source: "button" };
  }

  const raw = (input.utterance ?? "").trim();
  if (raw.length === 0) return { branch: defaultBranch(cue), source: "default" };

  const normalized = normalize(raw);
  if (normalized.length === 0) return { branch: defaultBranch(cue), source: "default" };

  // 2) ⚑CF 분기 우선 검사 (부정 표현은 제외 — "밀어내지 않고 119를 부르겠습니다")
  for (const branch of cue.branches) {
    if (!branch.criticalFail) continue;
    const matched = matchPattern(normalized, branch, true);
    if (matched) return { branch, source: "criticalPattern", matchedPattern: matched };
  }

  // 3) 배열 순서대로 패턴 대조
  for (const branch of cue.branches) {
    if (branch.criticalFail) continue;
    const matched = matchPattern(normalized, branch);
    if (matched) return { branch, source: "pattern", matchedPattern: matched };
  }

  // 4) 미일치
  return { branch: defaultBranch(cue), source: "default" };
}
