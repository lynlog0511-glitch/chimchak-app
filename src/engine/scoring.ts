/**
 * 침착(ChimChak) 채점 누적기.
 *
 * ⚠ 이 파일이 계산하는 점수·정규화 값·종합 판정은 **전부 내부 전용**이다.
 *    화면에는 점수·등급·순위·백분위를 어떤 형태로도 표시하지 않는다(브리프 §3-1).
 *    화면 표시는 toDisplay()가 돌려주는 🟢 충족 / ⚪ 코칭 2단계와 코칭 문장, 근거 출처 칩뿐이다.
 *
 * 누적 원칙: 같은 루브릭 항목이 여러 번 채점되면 **낮은 점수를 남긴다**(설계서 §4.4).
 */

import type { RubricArea, RubricHit, ScenarioType, SessionEvent, EndingDef } from "@/types";

export type ScoreValue = 1 | 2 | 3 | 4;
export type ScoreMap = Record<string, ScoreValue>;

/** 항목 id 접두어로 영역을 판별한다 */
export function areaOf(itemId: string): RubricArea {
  const prefix = itemId.slice(0, 2).toUpperCase();
  if (prefix === "SA" || prefix === "CO" || prefix === "RE" || prefix === "CL") return prefix;
  return "RE";
}

/**
 * 시나리오 유형별 영역 가중치 (설계서 §4.5).
 * 내부 산식 전용 — 화면에 노출하지 않는다.
 */
export const AREA_WEIGHTS: Record<ScenarioType, Record<RubricArea, number>> = {
  BPSD: { SA: 0.25, CO: 0.25, RE: 0.35, CL: 0.15 },
  EMERGENCY: { SA: 0.3, CO: 0.35, RE: 0.15, CL: 0.2 },
  CONFLICT: { SA: 0.1, CO: 0.3, RE: 0.4, CL: 0.2 },
  RISK: { SA: 0.25, CO: 0.25, RE: 0.25, CL: 0.25 },
};

/**
 * 루브릭 반영 — 항목별로 더 낮은 점수를 남긴다 (불변 업데이트).
 *
 * @example
 * mergeHits({ "RE-01": 4 }, [{ itemId: "RE-01", score: 2 }]); // { "RE-01": 2 }
 */
export function mergeHits(scores: ScoreMap, hits: RubricHit[]): ScoreMap {
  if (hits.length === 0) return scores;
  const next: ScoreMap = { ...scores };
  for (const hit of hits) {
    const prev = next[hit.itemId];
    next[hit.itemId] = prev === undefined ? hit.score : (Math.min(prev, hit.score) as ScoreValue);
  }
  return next;
}

/**
 * 이번 턴에서 가장 낮은 점수 — 🟢/⚪ 판정 기준.
 *
 * @example
 * lowestScore([{ itemId: "RE-01", score: 4 }, { itemId: "RE-02", score: 2 }]); // 2
 */
export function lowestScore(hits: RubricHit[]): ScoreValue | undefined {
  if (hits.length === 0) return undefined;
  let low: ScoreValue = 4;
  for (const hit of hits) {
    if (hit.score < low) low = hit.score;
  }
  return low;
}

/** 3점 이상이면 충족(🟢) */
export function isMet(score: ScoreValue): boolean {
  return score >= 3;
}

/**
 * 화면 표시 변환. 점수는 넘기지 않고 상태 기호만 돌려준다.
 *
 * @example
 * toDisplay(4); // { ok: true, mark: "🟢", label: "충족" }
 * toDisplay(2); // { ok: false, mark: "⚪", label: "코칭" }
 */
export function toDisplay(score: ScoreValue): { ok: boolean; mark: "🟢" | "⚪"; label: "충족" | "코칭" } {
  const ok = isMet(score);
  return { ok, mark: ok ? "🟢" : "⚪", label: ok ? "충족" : "코칭" };
}

/**
 * 정규화 점수 (설계서 §4.6). **내부 전용 — 화면 표시 금지.**
 * 정규화점수 = Σ(항목점수 × 영역가중치) ÷ (4 × Σ영역가중치) × 100
 *
 * @example
 * normalizedScore({ "RE-01": 4, "CO-07": 3 }, "BPSD"); // 89.6 — BPSD 가중치(RE 0.35·CO 0.25) 반영값
 */
export function normalizedScore(scores: ScoreMap, type: ScenarioType): number {
  const weights = AREA_WEIGHTS[type];
  let numerator = 0;
  let denominator = 0;
  for (const itemId of Object.keys(scores)) {
    const score = scores[itemId];
    if (score === undefined) continue;
    const weight = weights[areaOf(itemId)];
    numerator += score * weight;
    denominator += 4 * weight;
  }
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

/** 내부 등급 — 화면에 절대 표시하지 않는다 */
export type InternalGrade = "우수" | "충족" | "부분 충족" | "재시도 권장" | "재훈련" | "재훈련 권고";

export interface JudgeInput {
  scores: ScoreMap;
  type: ScenarioType;
  cfCount: number;
  retrainAdvice: boolean;
}

export interface JudgeResult {
  /** 내부 등급 (표시 금지) */
  grade: InternalGrade;
  /** 엔딩 화면이 쓰는 판정값 */
  verdict: EndingDef["verdict"];
  /** 내부 정규화 점수 (표시 금지) */
  normalized: number;
}

/**
 * 종합 판정 (설계서 §4.6 우선순위 그대로). **내부 전용.**
 * 규칙 1) ⚑CF 1건 이상 → 재훈련, 2) 재훈련 권고 조건 → 재훈련 권고 는 **점수·엔딩보다 우선**한다.
 * 시나리오 데이터의 엔딩은 3)~6)의 점수 구간을 대신할 때만 쓴다(buildRecord 참조).
 *
 * @example
 * judgeInternal({ scores: {}, type: "BPSD", cfCount: 1, retrainAdvice: false }).verdict; // "재훈련"
 */
export function judgeInternal(input: JudgeInput): JudgeResult {
  const normalized = normalizedScore(input.scores, input.type);
  if (input.cfCount > 0) return { grade: "재훈련", verdict: "재훈련", normalized };
  if (input.retrainAdvice) return { grade: "재훈련 권고", verdict: "재훈련 권고", normalized };
  if (normalized >= 85) return { grade: "우수", verdict: "충족", normalized };
  if (normalized >= 70) return { grade: "충족", verdict: "충족", normalized };
  if (normalized >= 50) return { grade: "부분 충족", verdict: "부분 충족", normalized };
  return { grade: "재시도 권장", verdict: "재시도", normalized };
}

function dedupe(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    const key = item.trim();
    if (key.length === 0 || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

/**
 * 🟢 충족 문구 모음 (성장 기록 화면용).
 *
 * @example
 * collectGreenChecks(state.events); // ["감정을 먼저 알아주셨습니다."]
 */
export function collectGreenChecks(events: SessionEvent[]): string[] {
  return dedupe(
    events
      .map((e) => e.feedback)
      .filter((f): f is NonNullable<SessionEvent["feedback"]> => Boolean(f))
      .filter((f) => f.ok && !f.criticalFail)
      .map((f) => f.message),
  );
}

/**
 * ⚪ 코칭 문구 모음 (약점 요약).
 *
 * ⚑CF 인터럽트 문구는 전용 카드에서 따로 다루므로 여기서 제외한다
 * ("다시 해보시겠어요?" 같은 인터럽트 질문이 성장 기록에 코칭으로 남지 않게 한다).
 *
 * @example
 * collectCoaching(state.events); // ["멈추게 하기 전에 원인을 먼저 확인해 주세요."]
 */
export function collectCoaching(events: SessionEvent[]): string[] {
  return dedupe(
    events
      .map((e) => e.feedback)
      .filter((f): f is NonNullable<SessionEvent["feedback"]> => Boolean(f))
      .filter((f) => !f.ok && !f.criticalFail)
      .map((f) => f.message),
  );
}
