/**
 * 다음 훈련 추천 (순수 함수).
 *
 * 성장 기록 화면과 훈련 엔딩 화면이 **같은 규칙**을 쓰도록 여기 한 곳에 둡니다.
 * (훈련 엔딩 화면 `train/_components/EndingPanel`은 `HistoryBoard`가 다시 내보내는 이름을 씁니다 —
 *  import 경로를 바꾸지 않으려고 재수출을 유지합니다.)
 *
 * 규칙 — 1순위 아직 완주 이력이 없는 유형 → 2순위 최근 세션들의 코칭이 가장 많이 가리키는
 *      **약점 항목**을 다루는 시나리오 → 3순위 최근 세션들에서 코칭이 가장 많이 남은 유형
 *      → 4순위 마지막 훈련이 가장 오래된 유형.
 * 대상은 지금 훈련할 수 있는 활성 시나리오뿐이고, 베타로 이연된 유형(위험 판단)은 후보에서 뺍니다.
 * 점수·등급은 물론 "코칭 몇 개" 같은 개수도 화면으로 나가지 않습니다 — 시나리오 하나와 이유 한 줄까지입니다.
 *
 * 2순위(약점 항목)를 왜 유형 위에 두는가. 유형 단위 집계는 「갈등 대응을 또 하세요」까지만
 * 말할 수 있는데, 같은 유형 안에서도 남은 것이 「경계 세우기」인지 「기록으로 옮기기」인지에 따라
 * 다음에 열 장면이 갈립니다. 코칭 문구는 데이터 파일에 박혀 있는 **검수된 고정 문장**이라
 * 표지 낱말로 항목을 되짚을 수 있고, 그 항목을 실제로 훈련하는 시나리오가 정해져 있습니다.
 * 되짚지 못한 문구는 조용히 버립니다 — 억지로 분류하느니 3순위로 내려가는 편이 낫습니다.
 *
 * ※ v4 재구현에서 **판정 규칙은 한 줄도 바뀌지 않았습니다.** 파일만 옮기고,
 *   시안 5c의 문장형 추천 카피(`nextTrainingSentence`)를 표시용으로 더했습니다.
 *   약점 항목 층(2순위)은 그 위에 **덧댄 층**이라, 되짚히는 항목이 없으면 예전 순서가 그대로 살아납니다.
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
export type NextTrainingReason = "untried" | "weakness" | "coaching" | "stale";

export interface NextTrainingPick {
  candidate: NextTrainingCandidate;
  reason: NextTrainingReason;
  /** 추천 이유 한 줄 (숫자 없음) */
  reasonText: string;
  /** 약점 항목으로 고른 경우에만 채워집니다 (reason === "weakness") */
  theme?: WeaknessTheme;
}

/* ── 약점 항목 ─────────────────────────────────────────── */

/**
 * 코칭 문구가 가리키는 약점 항목.
 *
 * 루브릭 코드(LO/RE/SA/CO)를 그대로 쓰지 않는 이유는 두 가지입니다 —
 * ① 루브릭 코드는 화면 기본 노출 금지 항목이고(디자인 가이드 §4.10),
 * ② 기록에 남는 것은 코드가 아니라 **코칭 문장**이라 여기서 다시 코드로 되돌릴 수 없습니다.
 */
export type WeaknessTheme =
  | "observe"
  | "handover"
  | "tone"
  | "boundary"
  | "dignity"
  | "cause"
  | "emotion"
  | "alternative"
  | "record";

export interface WeaknessThemeDef {
  theme: WeaknessTheme;
  /** 코칭 문구에서 이 항목을 가리키는 표지 — 위에서부터 먼저 맞는 항목이 이깁니다 */
  terms: string[];
  /** 이 항목을 실제로 훈련하는 시나리오 (앞에서부터 고릅니다) */
  trains: string[];
  /** 추천 카드에 그대로 실리는 이유 한 문장 (숫자 없음) */
  sentence: string;
}

/**
 * 항목 표 — 좁은 표지를 위에, 넓은 표지를 아래에 둡니다.
 *
 * 순서가 곧 판정 순서입니다. 「기록·보고」는 거의 모든 코칭 문구 끝에 붙는 말이라
 * 맨 아래에 두지 않으면 다른 항목을 전부 삼킵니다.
 */
export const WEAKNESS_THEMES: WeaknessThemeDef[] = [
  {
    theme: "observe",
    // 「소리 내어」만으로 두었더니 갈등 코칭의 「한 문장만이라도 소리 내어 주세요」가
    // 관찰 진술로 분류되었습니다(실측). 관찰을 말로 옮기라는 꼴만 남깁니다.
    terms: [
      "관찰",
      "보이는",
      "보이는지",
      "추정",
      "입술",
      "소리 내어 말씀",
      "지켜보기 전에",
      "본 것",
      "확인된 사실",
      "확인되지 않",
    ],
    trains: ["CHK-B02", "CHK-B01", "CHK-C02"],
    sentence: "보이는 그대로 말하는 관찰 진술이 최근 코칭에 남아 있어요",
  },
  {
    theme: "handover",
    terms: ["119", "당직", "간호사", "구급"],
    trains: ["CHK-B02", "CHK-B01", "CHK-A02"],
    sentence: "119·당직 간호사로 넘기는 판단이 최근 코칭에 남아 있어요",
  },
  {
    theme: "tone",
    terms: ["낮은 톤", "목소리를 낮", "목소리를 높이", "큰 소리", "톤을 올리"],
    trains: ["CHK-A02", "CHK-A01"],
    sentence: "낮은 톤으로 짧게 말하는 대목이 최근 코칭에 남아 있어요",
  },
  {
    theme: "boundary",
    terms: ["업무 범위", "불가 사유", "근거", "경계", "요구", "침묵은", "안내문"],
    trains: ["CHK-C01", "CHK-C02"],
    sentence: "업무 범위를 근거와 함께 말하는 대목이 최근 코칭에 남아 있어요",
  },
  {
    theme: "dignity",
    terms: [
      "존엄",
      "어르신 앞",
      "자리를 먼저",
      "자리부터",
      "부르시면",
      "다른 어르신",
      "다른 이용자",
      "험담",
    ],
    trains: ["CHK-C01", "CHK-C02", "CHK-A02"],
    sentence: "어르신 앞에서 말할 자리를 고르는 대목이 최근 코칭에 남아 있어요",
  },
  {
    theme: "cause",
    terms: ["원인", "여쭤", "여쭙", "불편하신", "통증"],
    trains: ["CHK-A01", "CHK-A02"],
    sentence: "원인을 먼저 여쭙는 말이 최근 코칭에 남아 있어요",
  },
  {
    theme: "emotion",
    terms: ["감정", "마음을 먼저", "한마디만", "인정해 주세요"],
    trains: ["CHK-A01", "CHK-A02"],
    sentence: "감정을 먼저 알아드리는 말이 최근 코칭에 남아 있어요",
  },
  {
    theme: "alternative",
    terms: ["함께 할", "같이", "선택지", "대체 행동"],
    trains: ["CHK-A01", "CHK-A02"],
    sentence: "붙잡는 대신 함께 할 일을 놓아 드리는 말이 최근 코칭에 남아 있어요",
  },
  {
    theme: "record",
    terms: ["기록", "보고", "일지", "특이사항", "인계", "적어", "남기"],
    trains: ["CHK-C02", "CHK-C01", "CHK-B02", "CHK-A01"],
    sentence: "기록과 보고로 옮기는 대목이 최근 코칭에 남아 있어요",
  },
];

/**
 * 코칭 문구 하나가 어떤 약점 항목을 가리키는지. 되짚을 수 없으면 `undefined`.
 *
 * @example classifyCoaching("낮은 톤으로 한 문장씩 말씀해 주세요.") // "tone"
 */
export function classifyCoaching(text: string): WeaknessTheme | undefined {
  const line = text.trim();
  if (line.length === 0) return undefined;
  return WEAKNESS_THEMES.find((def) => def.terms.some((term) => line.includes(term)))?.theme;
}

/**
 * 추천 후보 표 — 지금 훈련할 수 있는 활성 시나리오입니다.
 *
 * 시나리오 데이터 전체(대사·분기 그래프)를 브라우저 번들로 내려보내지 않기 위해
 * 추천에 필요한 네 가지만 여기 적어 둡니다. 활성 시나리오가 늘면 이 표에 한 줄을 더합니다.
 * 순서는 `SCENARIOS`와 같게 둡니다 — 동점일 때 이 순서가 곧 추천 순서이기 때문입니다.
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
  { id: "CHK-B01", title: "괜찮아, 손 좀 줘 봐요", type: "EMERGENCY", typeLabel: "응급 초기 대응" },
  { id: "CHK-B02", title: "점심 식사 중 사레", type: "EMERGENCY", typeLabel: "응급 초기 대응" },
  { id: "CHK-C01", title: "온 김에 반찬 좀", type: "CONFLICT", typeLabel: "이용자·보호자 갈등 화법" },
  {
    id: "CHK-C02",
    title: "어머니 팔에 멍이 있어요",
    type: "CONFLICT",
    typeLabel: "이용자·보호자 갈등 화법",
  },
];

/**
 * 추천 이유 문구 — 새 문구는 여기 한 곳에만 둡니다.
 * (약점 항목으로 고른 경우의 이유 문장은 항목 표 `WEAKNESS_THEMES`의 `sentence`가 맡습니다.)
 */
export const NEXT_TRAINING_REASON_TEXT: Record<NextTrainingReason, string> = {
  untried: "아직 해보지 않은 유형입니다",
  weakness: "최근 코칭이 가리킨 항목을 다루는 장면입니다",
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
  /** 최근 세션들의 코칭 문구가 가리킨 약점 항목별 건수 */
  const themeHits = new Map<WeaknessTheme, number>();

  ordered.forEach((record, index) => {
    const type = typeOf(record);
    if (!type) return;
    trainedTypes.add(type);

    const at = timeOf(record.endedAt) || timeOf(record.startedAt);
    if (at > (lastTrainedAt.get(type) ?? 0)) lastTrainedAt.set(type, at);

    if (index < RECENT_SESSION_WINDOW) {
      const points = Array.isArray(record.coachingPoints) ? record.coachingPoints : [];
      coachingLeft.set(type, (coachingLeft.get(type) ?? 0) + points.length);
      for (const point of points) {
        if (typeof point !== "string") continue;
        const theme = classifyCoaching(point);
        if (theme) themeHits.set(theme, (themeHits.get(theme) ?? 0) + 1);
      }
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

  // 2순위 — 최근 코칭이 가장 많이 가리킨 약점 항목 (동점이면 항목 표 순서)
  let themePick: WeaknessThemeDef | undefined;
  let themeMax = 0;
  for (const def of WEAKNESS_THEMES) {
    const hits = themeHits.get(def.theme) ?? 0;
    if (hits > themeMax) {
      themeMax = hits;
      themePick = def;
    }
  }
  if (themePick) {
    // 그 항목을 훈련하는 시나리오 중 지금 고를 수 있는 첫 번째. 없으면 3순위로 내려갑니다.
    const target = themePick.trains
      .map((id) => pool.find((item) => upperId(item.id) === upperId(id)))
      .find((item): item is NextTrainingCandidate => item !== undefined);
    if (target) {
      return {
        candidate: target,
        reason: "weakness",
        reasonText: themePick.sentence,
        theme: themePick.theme,
      };
    }
  }

  // 3순위 — 최근 세션들에서 코칭이 가장 많이 남은 유형 (동점이면 후보 표 순서)
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

  // 4순위 — 마지막 훈련이 가장 오래된 유형
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
 * 약점 항목으로 고른 경우에는 유형 이름 대신 **무엇이 남았는지**를 말합니다 —
 * 「갈등 대응을 한 번 더」보다 「업무 범위를 근거와 함께 말하는 대목이 남았어요」가
 * 다음에 열 장면을 고른 이유를 그대로 설명합니다.
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
    case "weakness":
      return (
        WEAKNESS_THEMES.find((def) => def.theme === pick.theme)?.sentence ??
        `${label}${objectParticle} 한 번 더 해보시면 좋겠어요`
      );
    case "coaching":
      return `${label}${objectParticle} 한 번 더 해보시면 좋겠어요`;
    default:
      return `${label}${objectParticle} 오랜만에 다시 해보시면 좋겠어요`;
  }
}
