/**
 * 다음 훈련 추천 (순수 함수).
 *
 * 성장 기록 화면과 훈련 엔딩 화면이 **같은 규칙**을 쓰도록 여기 한 곳에 둡니다.
 * (훈련 엔딩 화면 `train/_components/EndingPanel`은 `HistoryBoard`가 다시 내보내는 이름을 씁니다 —
 *  import 경로를 바꾸지 않으려고 재수출을 유지합니다.)
 *
 * 규칙 — 1순위 아직 완주 이력이 없는 유형 → 2순위 최근 세션들에서 코칭이 가장 많이 남은 유형
 *      → 3순위 마지막 훈련이 가장 오래된 유형.
 * 대상은 지금 훈련할 수 있는 활성 시나리오뿐이고, 베타로 이연된 유형(위험 판단)은 후보에서 뺍니다.
 * 점수·등급은 물론 "코칭 몇 개" 같은 개수도 화면으로 나가지 않습니다 — 유형 하나와 이유 한 줄까지입니다.
 *
 * ※ v4 재구현에서 **판정 규칙은 한 줄도 바뀌지 않았습니다.** 파일만 옮기고,
 *   시안 5c의 문장형 추천 카피(`nextTrainingSentence`)를 표시용으로 더했습니다.
 */

import type { ScenarioType, SessionRecord } from "@/types";
import { TYPE_SHORT_LABELS } from "./format";

/** 시나리오 id(대문자) → 유형 표. 시나리오 데이터 전체를 브라우저로 내려보내지 않기 위한 최소 정보입니다. */
export type ScenarioTypeMap = Record<string, ScenarioType>;

/** 추천 후보 — 훈련 화면으로 바로 넘어가는 데 필요한 최소 정보만 담습니다. */
export interface NextTrainingCandidate {
  /** 시나리오 id (대문자 표기) */
  id: string;
  title: string;
  type: ScenarioType;
  typeLabel: string;
}

/** 왜 추천했는지 — 화면에는 한 줄 문구로만 나갑니다. */
export type NextTrainingReason = "untried" | "coaching" | "stale";

export interface NextTrainingPick {
  candidate: NextTrainingCandidate;
  reason: NextTrainingReason;
  /** 추천 이유 한 줄 (숫자 없음) */
  reasonText: string;
}

/**
 * 추천 후보 표 — 지금 훈련할 수 있는 활성 3종입니다.
 *
 * 시나리오 데이터 전체(대사·분기 그래프)를 브라우저 번들로 내려보내지 않기 위해
 * 추천에 필요한 네 가지만 여기 적어 둡니다. 활성 시나리오가 늘면 이 표에 한 줄을 더합니다.
 * 유형④(위험 판단)는 베타 이연이라 후보에 넣지 않습니다.
 */
export const NEXT_TRAINING_CANDIDATES: NextTrainingCandidate[] = [
  {
    id: "CHK-A01",
    title: "현관 앞, 집에 가야 해요",
    type: "BPSD",
    typeLabel: "치매 행동심리증상(BPSD)",
  },
  {
    id: "CHK-A02",
    title: "새벽 두 시, 차가 나가야 한대요",
    type: "BPSD",
    typeLabel: "치매 행동심리증상(BPSD)",
  },
  { id: "CHK-B02", title: "점심 식사 중 사레", type: "EMERGENCY", typeLabel: "응급 초기 대응" },
  { id: "CHK-C01", title: "온 김에 반찬 좀", type: "CONFLICT", typeLabel: "이용자·보호자 갈등 화법" },
  {
    id: "CHK-C02",
    title: "어머니 팔에 멍이 있어요",
    type: "CONFLICT",
    typeLabel: "이용자·보호자 갈등 화법",
  },
];

/** 추천 이유 문구 — 새 문구는 여기 한 곳에만 둡니다. */
export const NEXT_TRAINING_REASON_TEXT: Record<NextTrainingReason, string> = {
  untried: "아직 해보지 않은 유형입니다",
  coaching: "코칭이 남은 유형입니다",
  stale: "가장 오래전에 연습한 유형입니다",
};

/** 2순위 판단에 쓰는 "최근 세션" 범위 — 오래전 회차까지 끌고 오지 않습니다. */
const RECENT_SESSION_WINDOW = 5;

function upperId(id: string): string {
  return id.trim().toUpperCase();
}

function timeOf(iso: string | undefined): number {
  if (!iso) return 0;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

export interface PickNextTrainingOptions {
  /** 후보에서 빼 둘 시나리오 (방금 마친 회차 등) */
  excludeScenarioId?: string;
  /** 지금 훈련할 수 있는 유형 — 주면 이 유형만 남깁니다 */
  activeTypes?: ScenarioType[];
  /** 시나리오 id(대문자) → 유형. 주면 기록 해석에 먼저 씁니다 */
  typeByScenarioId?: ScenarioTypeMap;
  /** 후보 표 교체 (확장·검증용) */
  candidates?: NextTrainingCandidate[];
}

/**
 * 다음에 해보시면 좋을 훈련을 하나만 고릅니다. 고를 것이 없으면 `undefined`.
 *
 * 같은 입력이면 같은 결과가 나오는 순수 함수이고, 무작위·가중치·점수는 쓰지 않습니다.
 *
 * @example
 * pickNextTraining([]) // => 첫 후보 + "아직 해보지 않은 유형입니다"
 * @example
 * pickNextTraining(records, { excludeScenarioId: "CHK-A01" }) // 방금 마친 회차는 빼고 고릅니다
 */
export function pickNextTraining(
  records: SessionRecord[],
  options: PickNextTrainingOptions = {},
): NextTrainingPick | undefined {
  const candidates = options.candidates ?? NEXT_TRAINING_CANDIDATES;
  const exclude = options.excludeScenarioId ? upperId(options.excludeScenarioId) : undefined;
  const activeTypes = options.activeTypes;
  const pool = candidates.filter(
    (item) => upperId(item.id) !== exclude && (!activeTypes || activeTypes.includes(item.type)),
  );
  if (pool.length === 0) return undefined;

  const typeOf = (record: SessionRecord): ScenarioType | undefined => {
    const key = upperId(record.scenarioId ?? "");
    const mapped = options.typeByScenarioId?.[key];
    if (mapped) return mapped;
    return candidates.find((item) => upperId(item.id) === key)?.type;
  };

  // 저장 순서를 믿지 않고 마친 시각으로 다시 세웁니다 (최신 → 과거).
  const ordered = [...records].sort((a, b) => timeOf(b.endedAt) - timeOf(a.endedAt));

  const trainedTypes = new Set<ScenarioType>();
  const coachingLeft = new Map<ScenarioType, number>();
  const lastTrainedAt = new Map<ScenarioType, number>();

  ordered.forEach((record, index) => {
    const type = typeOf(record);
    if (!type) return;
    trainedTypes.add(type);

    const at = timeOf(record.endedAt) || timeOf(record.startedAt);
    if (at > (lastTrainedAt.get(type) ?? 0)) lastTrainedAt.set(type, at);

    if (index < RECENT_SESSION_WINDOW) {
      const left = Array.isArray(record.coachingPoints) ? record.coachingPoints.length : 0;
      coachingLeft.set(type, (coachingLeft.get(type) ?? 0) + left);
    }
  });

  // 1순위 — 아직 완주 이력이 없는 유형
  const untried = pool.find((item) => !trainedTypes.has(item.type));
  if (untried) {
    return {
      candidate: untried,
      reason: "untried",
      reasonText: NEXT_TRAINING_REASON_TEXT.untried,
    };
  }

  // 2순위 — 최근 세션들에서 코칭이 가장 많이 남은 유형 (동점이면 후보 표 순서)
  let coachingPick: NextTrainingCandidate | undefined;
  let coachingMax = 0;
  for (const item of pool) {
    const left = coachingLeft.get(item.type) ?? 0;
    if (left > coachingMax) {
      coachingMax = left;
      coachingPick = item;
    }
  }
  if (coachingPick) {
    return {
      candidate: coachingPick,
      reason: "coaching",
      reasonText: NEXT_TRAINING_REASON_TEXT.coaching,
    };
  }

  // 3순위 — 마지막 훈련이 가장 오래된 유형
  let stalePick = pool[0];
  if (!stalePick) return undefined;
  let staleAt = lastTrainedAt.get(stalePick.type) ?? 0;
  for (const item of pool.slice(1)) {
    const at = lastTrainedAt.get(item.type) ?? 0;
    if (at < staleAt) {
      stalePick = item;
      staleAt = at;
    }
  }
  return { candidate: stalePick, reason: "stale", reasonText: NEXT_TRAINING_REASON_TEXT.stale };
}

/** 훈련 상세 경로 — 라우트 파라미터는 소문자로 통일합니다. */
export function trainHref(scenarioId: string): string {
  return `/train/${scenarioId.toLowerCase()}`;
}

/** 받침 여부 — 조사(을/를·은/는)를 붙일 때만 씁니다. */
function hasFinalConsonant(word: string): boolean {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0);
  if (Number.isNaN(code) || code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

/**
 * 시안 5c 추천 카드의 문장형 카피를 만듭니다 — 「갈등 대응을 한 번 더 해보시면 좋겠어요」.
 *
 * 판정 규칙(`pickNextTraining`)은 그대로 두고 **표시 문장만** 여기서 만듭니다.
 * 숫자·점수·등급은 문장에 넣지 않습니다.
 *
 * @example nextTrainingSentence({ candidate, reason: "coaching", reasonText }) // "갈등 대응을 한 번 더 해보시면 좋겠어요"
 */
export function nextTrainingSentence(pick: NextTrainingPick): string {
  const label = TYPE_SHORT_LABELS[pick.candidate.type];
  const hasBatchim = hasFinalConsonant(label);
  const objectParticle = hasBatchim ? "을" : "를";
  const topicParticle = hasBatchim ? "은" : "는";

  switch (pick.reason) {
    case "untried":
      return `${label}${topicParticle} 아직 해보지 않으셨어요`;
    case "coaching":
      return `${label}${objectParticle} 한 번 더 해보시면 좋겠어요`;
    default:
      return `${label}${objectParticle} 오랜만에 다시 해보시면 좋겠어요`;
  }
}
