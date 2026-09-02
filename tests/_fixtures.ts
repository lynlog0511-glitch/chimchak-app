/**
 * 테스트 전용 최소 시나리오.
 *
 * 판정 우선순위(⚑CF → 재훈련 고정 → 권고 → 엔딩 → 산식)는 분기 하나하나를 통제해야
 * 순서를 갈라 볼 수 있어, 실제 3종 시나리오 대신 뼈대만 있는 그래프를 쓴다.
 * (실제 데이터의 무결성은 tests/scenarios.test.ts 가 따로 본다.)
 */

import type { Scenario } from "@/types";

export const CF_MESSAGE = "잠시 멈추겠습니다. 지금 선택은 데이터가 정한 문구로 안내합니다.";

export function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  const base: Scenario = {
    id: "TEST-01",
    title: "테스트 시나리오",
    type: "BPSD",
    typeLabel: "치매 행동심리증상",
    level: 1,
    levelLabel: "초급",
    durationMin: 5,
    tiers: ["L1", "L2"],
    summary: "판정 우선순위 검증용 뼈대입니다.",
    situationLines: ["테스트 상황이 시작되었습니다.", "화면의 안내를 따라 진행합니다."],
    practicePoints: ["상황을 차분히 확인합니다.", "안전한 답을 골라 말합니다."],
    objectives: ["판정 경로 확인"],
    personas: [{ role: "care_recipient", name: "테스트 어르신 (가상 인물)", profile: "가상 인물" }],
    context: "테스트 상황",
    constraints: [],
    gauge: { label: "초조도", start: 0, max: 5, crisisAt: 2, crisisEndingId: "E-위기" },
    entryTurnId: "T1",
    turns: [
      {
        id: "T1",
        speaker: "elder",
        speakerName: "테스트 어르신",
        text: "집에 가야 해요.",
        cue: {
          id: "CUE-1",
          prompt: "무엇이라고 말씀하시겠습니까?",
          waitSec: 8,
          defaultBranchId: "b-flat",
          branches: [
            {
              id: "b-cf",
              label: "자리 이탈형",
              // 규칙 사전(rules.ts)에 없는 신호를 쓴다 — 분기 데이터만으로 나는 ⚑CF를 갈라 보려면
              // 규칙이 먼저 잡아 버리면 안 된다.
              patterns: ["혼자 두고"],
              fallbackOption: "혼자 두고 나가 있겠습니다",
              gaugeDelta: 0,
              aiReaction: "왜 이래요!",
              rubricHits: [{ itemId: "CO-02", score: 1 }],
              criticalFail: true,
              cfMessage: CF_MESSAGE,
              cfAlternatives: ["곁에 서 있기", "동행 제안하기", "다른 행동으로 옮기기"],
              docId: "DOC-LAW-003",
              next: "T2",
            },
            {
              id: "b-ok",
              label: "감정 인정형",
              patterns: ["마음이 급하시"],
              fallbackOption: "마음이 급하시겠어요",
              gaugeDelta: 0,
              aiReaction: "그래요…",
              rubricHits: [{ itemId: "RE-01", score: 4 }],
              praise: "감정을 먼저 알아주셨습니다.",
              next: "T2",
            },
            {
              id: "b-flat",
              label: "사실 확인형",
              patterns: ["어디 가시"],
              fallbackOption: "어디 가시려고요",
              gaugeDelta: 0,
              aiReaction: "집에요.",
              rubricHits: [{ itemId: "RE-01", score: 2 }],
              coaching: "감정을 먼저 알아드려 보세요.",
              next: "T2",
            },
            {
              id: "b-rise",
              label: "재촉형",
              patterns: ["빨리 들어가"],
              gaugeDelta: 2,
              aiReaction: "왜 재촉해요!",
              rubricHits: [{ itemId: "RE-01", score: 2 }],
              next: "T2",
            },
            {
              id: "b-calm",
              label: "진정형",
              patterns: ["천천히 하셔도"],
              gaugeDelta: -2,
              aiReaction: "고마워요.",
              rubricHits: [{ itemId: "RE-01", score: 4 }],
              next: "T2",
            },
            {
              id: "b-advice",
              label: "존엄 위반형",
              patterns: ["그냥 두세요"],
              gaugeDelta: 0,
              aiReaction: "…",
              rubricHits: [{ itemId: "RE-01", score: 2 }],
              retrainAdvice: true,
              next: "T2",
            },
            {
              id: "b-protocol",
              label: "응급 전환형",
              patterns: ["119"],
              gaugeDelta: 0,
              aiReaction: "…",
              rubricHits: [],
              next: "protocol:P-02",
            },
          ],
        },
      },
      { id: "T2", speaker: "system", speakerName: "안내", text: "훈련을 마칩니다.", autoNext: "end:E-충족" },
      { id: "T3", speaker: "system", speakerName: "안내", text: "이어서 진행합니다.", autoNext: "end:E-충족" },
      // 실제 데이터와 같은 규약 — "protocol:P-02" 는 프로토콜 재생 뒤 돌아올 다리 턴을 가리킨다.
      { id: "P-02", speaker: "protocol", speakerName: "응급 안내", text: "응급 안내를 재생합니다.", autoNext: "T3" },
    ],
    triggers: [],
    endings: [
      { id: "E-충족", title: "충족 엔딩", verdict: "충족", condition: "정상 완주", message: "마치셨습니다." },
      { id: "E-위기", title: "위기 엔딩", verdict: "재시도", condition: "게이지 위기", message: "다시 해보시겠어요?" },
      { id: "E-CF", title: "재훈련 엔딩", verdict: "재훈련", condition: "⚑CF 발생", message: "다시 훈련해 주세요." },
      {
        id: "E-권고",
        title: "재훈련 권고 엔딩",
        verdict: "재훈련 권고",
        condition: "존엄·관계 위반",
        message: "재훈련을 권해 드립니다.",
      },
    ],
    appliedRubric: ["RE-01", "CO-01", "CO-02"],
    sourceDocs: ["DOC-LAW-003"],
    active: true,
  };
  return { ...base, ...overrides };
}
