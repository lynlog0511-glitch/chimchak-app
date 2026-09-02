/**
 * CHK-B02 「점심 식사 중 사레」 — 설계서 §3.2 전문 인코딩.
 *
 * 유형 ② 응급 초기 대응 · 난이도 중급 · 소요 약 5분 · 계층 L1+L2+L3
 * 기능 F1 시뮬레이터 + F2 핸즈프리 음성 가이드 + F3 기록 코칭
 *
 * 이 시나리오의 특수 목적: 위기가 고조되는 정확한 지점에서 생성이 화면에서 사라지고,
 * 사전 검수된 고정 스크립트(P-02)가 재생되며, 앱은 신체 술기를 지도하지 않고
 * 119 상황실로 안내 주체를 이양합니다. CUE-3의 D3-a·D3-b가 L3(생성 금지) 진입 지점입니다.
 *
 * 상태 흐름: S0 식사 중 → S1 이상징후 인지(T1/CUE-1) → S2 부분폐쇄 대응(T2/CUE-2)
 *          → [T-1 전환] S3 완전폐쇄·119(T3/CUE-3) → L3 프로토콜 P-02
 *          → S4 인계(T4 상황실 / T5 구급대) → S5 보고·기록(CUE-6, CUE-7)
 *
 * ※ 감수 보류 항목: 설계서 §6.2의 "상체를 앞으로 숙이도록 유도" 발화는 '체위 확보'인지
 *    '동작 지도'인지 2차 현직 감수 대기 중이므로, 본 구현에서는 어떤 분기에도 포함하지 않고
 *    "기침을 계속하시도록 격려"만 남겼습니다. 앱은 신체 술기를 지도하지 않습니다.
 *
 * 판정 공정성 (8/6 감사 기준을 전 CUE로 소급)
 *  - 모든 CUE에 **중립 미분류 분기**(…-n)를 두고 defaultBranchId를 그리로 돌렸습니다.
 *    음성 인식이 빗나간 것과 잘못 대응한 것은 다른 사실입니다. 응급 구간은 양손을 쓰고 있어
 *    (제약 C5) 인식이 더 자주 빗나가므로, 여기서 감점이 붙으면 CUE-1에서만 네 항목이 한꺼번에
 *    1점으로 떨어집니다. 감점 분기는 학습자가 **실제로 그 말을 했을 때만** 열립니다.
 *  - CO-03의 1점 앵커 「미신고 ⚑」는 CUE-3의 D3-d(명시적 신고 거부)가 맡습니다.
 *    시간으로는 잴 수 없는 판정이라 데이터 쪽 ⚑CF 분기가 있어야 성립합니다(engine/timing.ts 참조).
 */

import type { Scenario } from "@/types";

/**
 * 중립 미분류 분기의 코칭 문구 — 감점이 아니라 **다시 말할 기회**입니다.
 * 양손을 쓰고 있는 구간이라(제약 C5) 버튼 폴백을 함께 안내합니다.
 */
const UNCLEAR_COACHING =
  "말씀이 닿지 않았습니다. 지금 하신 말씀은 판정에 넣지 않았으니, 한 문장으로 짧게 다시 말씀하시거나 아래 버튼에서 골라 주세요.";

/* 미분류(-n) 분기의 next는 **같은 CUE**입니다(2026-08-26 · 체류 원칙).
   말이 닿지 않았다는 이유로 다음 장면으로 떠밀면 하시려던 말을 할 자리가 사라집니다.
   되묻지는 않습니다(확정 원칙) — 그 자리에 머물고 보기 버튼을 그대로 열어 둘 뿐입니다.
   예외 자리에는 아래 문구를 쓰고, 각 분기 주석에 사유를 적었습니다. */
/** 진행 예외 자리(응급 전환)의 코칭 문구 — **다시 청하지 않습니다.** */
const UNCLEAR_COACHING_MOVES_ON =
  "지금 하신 말씀은 판정에 넣지 않았습니다. 소리가 사라진 뒤라 화면이 응급 안내로 넘어갑니다.";
/** 회차를 닫는 자리의 코칭 문구 — 그 자리의 대사가 이미 마무리를 알립니다(체류 예외②). */
const UNCLEAR_COACHING_CLOSING =
  "지금 하신 말씀은 판정에 넣지 않았습니다. 응급 대응 회차는 여기서 마칩니다.";

/** CO-01 ⚑CF 인터럽트 화면 문구 (고정, L3 — 변형 불가). */
const CF_OUT_OF_SCOPE_MESSAGE =
  "잠시 멈추겠습니다. 기도가 막힌 어르신에게 물이나 음식을 드리면 상황이 악화됩니다. 지금 할 수 있는 것은 ①식사 중단 ②기침 격려 ③말을 걸어 소리가 나오는지 확인입니다. 다시 해보시겠어요?";

const CF_OUT_OF_SCOPE_ALTERNATIVES = [
  "식사를 즉시 중단합니다.",
  "기침을 계속하시도록 격려합니다.",
  "말을 걸어 소리가 나오는지 확인합니다.",
];

/**
 * ⚑CF D1-d(구강 내 조작) 인터럽트 문구.
 * 액체·음식 제공용 문구를 돌려 쓰면 화면 안내가 실제 행동과 어긋나므로 따로 둡니다(설계 원칙 P4).
 */
const CF_ORAL_MESSAGE =
  "잠시 멈추겠습니다. 입안에 손을 넣어 확인하거나 무엇을 빼내려 하면 이물이 더 깊이 들어갈 수 있습니다. 이 부분은 119 상황실이 목소리로 직접 지도합니다. 다시 해보시겠어요?";

const CF_ORAL_ALTERNATIVES = [
  "지금 119를 누릅니다.",
  "기침을 계속하시도록 격려합니다.",
  "말을 걸어 소리가 나오는지 확인합니다.",
];

/** ⚑CF D1-e(의식 있는 상태에서 눕히기) 인터럽트 문구. */
const CF_LIE_DOWN_MESSAGE =
  "잠시 멈추겠습니다. 기침이 남아 있는 어르신을 눕히면 숨길이 더 막힐 수 있습니다. 앉은 자세를 유지하고 기침을 격려해 주세요. 다시 해보시겠어요?";

const CF_LIE_DOWN_ALTERNATIVES = [
  "앉은 자세를 유지하시도록 곁에서 지지합니다.",
  "기침을 계속하시도록 격려합니다.",
  "말을 걸어 소리가 나오는지 확인합니다.",
];

/** ⚑CF D3-c 인터럽트 문구 (고정 — 신체 술기 이양 고지). */
const CF_NO_MANEUVER_MESSAGE =
  "침착은 밀어내기·두드리기 같은 몸으로 하는 동작은 안내하지 않습니다. 이 부분은 119 상황실이 목소리로 직접 지도합니다. 지금 하실 일은 119 연결입니다.";

const CF_NO_MANEUVER_ALTERNATIVES = [
  "지금 119를 누릅니다.",
  "소리를 낼 수 있는지 확인해 본 그대로 119에 전달합니다.",
  "스피커폰을 켜고 휴대폰을 바닥에 둡니다.",
];

/**
 * ⚑CF D3-d(명시적 신고 거부) 인터럽트 문구 — 루브릭 CO-03의 1점 앵커 「미신고 ⚑」 자리입니다.
 * 지연(2~3점)은 engine/timing.ts가 경과 시간으로 재고, 「부르지 않겠다」는 판단만 여기서 멈춥니다.
 */
const CF_NO_CALL_MESSAGE =
  "잠시 멈추겠습니다. 소리가 사라진 상태에서 119를 부르지 않는 것은, 요양보호사가 미룰 수 있는 판단이 아닙니다. 지금 하실 수 있는 것은 ①119 연결 ②스피커폰을 켜고 휴대폰을 바닥에 두기 ③보이는 그대로 상황실에 전달하기입니다. 다시 해보시겠어요?";

const CF_NO_CALL_ALTERNATIVES = [
  "지금 119를 누릅니다.",
  "스피커폰을 켜고 휴대폰을 바닥에 둡니다.",
  "소리가 나오지 않는다는 것을 그대로 119에 전달합니다.",
];

export const CHK_B02: Scenario = {
  id: "CHK-B02",
  title: "점심 식사 중 사레",
  type: "EMERGENCY",
  typeLabel: "응급 초기 대응",
  level: 2,
  levelLabel: "중급",
  durationMin: 5,
  tiers: ["L1", "L2", "L3"],
  summary:
    "식사 중 사레가 완전 기도폐쇄로 바뀌는 순간, 허용 범위 안에서 관찰하고 119로 이양하는 연습입니다.",
  situationLines: [
    "식사 중 어르신이 갑자기 몸을 앞으로 숙였습니다.",
    "혼자 근무 중이며 흡인기와 의료인은 없습니다.",
  ],
  practicePoints: [
    "기침과 호흡을 보고 응급 신호를 구분합니다.",
    "숨이 막히면 바로 119에 신고하고 지시에 따릅니다.",
  ],
  objectives: [
    "LO-1 부분 기도폐쇄와 완전 기도폐쇄를 관찰 지표로 60초 내 감별합니다. (SA-05, SA-06)",
    "LO-2 요양보호사 허용 범위(관찰·체위 확보·보고·119) 밖의 행위를 시도하지 않습니다. (CO-01 ⚑CF)",
    "LO-3 완전 폐쇄 전환 즉시 119에 연결하고 지도 주체를 상황실로 이양합니다. (CO-03 ⚑CF, SA-07)",
    "LO-4 구급대·기관에 SBAR 구조로 인계·보고합니다. (CL-01, CL-02, CL-03)",
  ],
  personas: [
    {
      role: "care_recipient",
      name: "이 어르신 (가상 인물)",
      profile:
        "남성 79세 · 뇌졸중 후 좌측 편마비 · 연하 기능 저하 경계 · 장기요양 2등급 · 식이는 죽식(다진 반찬)입니다. 평소 식사 속도가 빠르고, 삼키기 전에 다음 숟가락을 요구하는 습관이 있으십니다. 인지에는 어려움이 없으시지만 말수가 적으셔서, 불편한 데가 있어도 표정과 손짓으로만 알리시는 일이 잦습니다.",
    },
    {
      role: "learner",
      name: "신규 요양보호사 (사용자 본인)",
      profile: "배정 3주차 · 단독 방문입니다.",
    },
    {
      role: "dispatcher",
      name: "119 상황실 (가상 인물)",
      profile: "신고 접수 후 의식·발성 여부를 확인하고, 이후 구두지도를 직접 담당합니다.",
    },
    {
      role: "guardian",
      name: "보호자 따님 (가상 인물)",
      profile:
        "구급 이송 이후 전화로 상황을 확인하십니다. 놀라신 마음이 추궁하는 말투로 먼저 나오고, 답이 늦으면 목소리가 높아지십니다. (돌발 변수 T-2 「보호자 추궁」)",
    },
  ],
  context:
    "12시 20분입니다. 점심 식사 보조 중입니다. 어르신이 죽 한 숟갈을 삼킨 직후 갑자기 몸을 앞으로 숙이십니다.",
  constraints: [
    "C1 혼자입니다. 다른 인력이 없습니다.",
    "C2 흡인기가 없고 의료인이 없습니다.",
    "C3 보호자가 부재 중이고 통화가 불가능합니다.",
    "C4 엘리베이터 없는 3층 빌라여서 구급대 진입이 지연됩니다.",
    "C5 양손을 쓰고 있어 화면 터치가 어려운 상태입니다.",
  ],
  gauge: {
    label: "긴장도",
    start: 2,
    max: 5,
    crisisAt: 5,
    crisisEndingId: "E-재훈련",
  },
  entryTurnId: "T1",
  turns: [
    /* ── S1 이상징후 인지 ─────────────────────────────────────────── */
    {
      id: "T1",
      speaker: "elder",
      speakerName: "이 어르신",
      text: "컥… 컥컥… (기침) …허.",
      stageDirection: "기침 소리가 이어지고, 상체를 앞으로 숙이십니다.",
      cue: {
        id: "CUE-1",
        prompt: "지금 즉시 무엇을 하시겠습니까?",
        waitSec: 6,
        // 미분류를 「관찰만 하고 대기」(D1-b)에 매핑하지 않습니다 — 중립 분기로 받습니다.
        defaultBranchId: "D1-n",
        branches: [
          {
            id: "D1-a",
            label: "식사 즉시 중단 + 기침 격려 + 말 걸어 확인",
            patterns: [
              "기침 계속",
              "기침을 계속",
              "기침하세요",
              "계속 기침",
              "삼키지 마",
              "그만 드시",
              "숟가락",
              "식사 중단",
              "그만 드릴",
              "제 말 들리세요",
              "들리세요",
              "대답해",
              "말씀해 보세",
              "소리 내",
            ],
            fallbackOption:
              "어르신, 삼키지 마시고 기침 계속 하세요. 제 말 들리세요? 대답해보실 수 있어요?",
            gaugeDelta: 0,
            // 반응 대사는 바로 다음 턴 [T2]의 앵커 대사가 맡습니다.
            // 여기에 변형 대사를 두면 설계서 §3.2 [T2] 원문과 다른 한 줄이 더 생깁니다.
            aiReaction: "",
            rubricHits: [
              { itemId: "SA-05", score: 4 },
              { itemId: "SA-06", score: 4 },
              { itemId: "CO-01", score: 4 },
              { itemId: "SA-01", score: 4 },
              { itemId: "CO-07", score: 4 },
            ],
            praise:
              "식사를 멈추고, 기침을 격려하고, 소리가 나오는지 확인하셨습니다. 허용 범위 안의 정확한 첫 대응입니다.",
            docId: "DOC-GUIDE-004",
            next: "T2",
          },
          {
            id: "D1-b",
            label: "관찰만 하고 대기",
            // 기본값이 중립 분기로 옮겨 갔으므로 버튼 문구도 여기서 직접 걸려야 합니다.
            // "지켜보"는 "지켜봅니다"의 부분 문자열이 아닙니다(음절 블록) — 활용형을 함께 둡니다.
            patterns: ["지켜보", "지켜봅", "기다", "가만히", "일단 보", "괜찮아지시겠"],
            fallbackOption: "일단 지켜봅니다",
            gaugeDelta: 1,
            aiReaction: "…컥… 커억…",
            aiReactionNote: "기침 소리가 점점 약해집니다. 돌발 변수 T-1이 앞당겨집니다.",
            rubricHits: [{ itemId: "SA-04", score: 2 }],
            coaching: "지켜보기 전에 식사를 멈추고 소리가 나오는지 말을 걸어 확인해 주세요.",
            docId: "DOC-GUIDE-004",
            triggerId: "T-1",
            next: "T3",
          },
          {
            id: "D1-c",
            label: "물 마시게 함 (⚑CF)",
            patterns: [
              "물 좀 드세요",
              "물 드시",
              "물을 드리",
              "물 한 잔",
              "물 먹",
              "음료",
              "주스",
              "삼키세요",
              "넘기세요",
            ],
            fallbackOption: "물 좀 드세요",
            gaugeDelta: 0,
            aiReaction: "컥— 컥컥컥!",
            rubricHits: [{ itemId: "CO-01", score: 1 }],
            criticalFail: true,
            cfMessage: CF_OUT_OF_SCOPE_MESSAGE,
            cfAlternatives: CF_OUT_OF_SCOPE_ALTERNATIVES,
            docId: "DOC-GUIDE-004",
            next: "T1",
          },
          {
            id: "D1-d",
            label: "입안에 손가락 넣어 확인·제거 (⚑CF)",
            patterns: [
              "손가락",
              "입안에 손",
              "입에 손",
              "꺼내",
              "빼내",
              "제거하",
              "구강",
              "혀를 눌러",
              "입을 벌려",
            ],
            fallbackOption: "입안에 손가락을 넣어 확인합니다",
            gaugeDelta: 0,
            aiReaction: "우웁—!",
            rubricHits: [{ itemId: "CO-01", score: 1 }],
            criticalFail: true,
            cfMessage: CF_ORAL_MESSAGE,
            cfAlternatives: CF_ORAL_ALTERNATIVES,
            // 구강 내 조작은 무면허 의료행위 경계에 놓인 행위입니다 — 루브릭 CO-01의 근거와
            // 같은 문서(의료법 제27조)를 인용합니다. 관찰·체위 오류(D1-c·D1-e)와는 근거가 다릅니다.
            docId: "DOC-LAW-005",
            next: "T1",
          },
          {
            id: "D1-e",
            label: "눕히기 (의식 있는 상태에서) (⚑CF)",
            patterns: ["눕히", "눕혀", "눕게", "바닥에 눕", "침대로 옮", "자리에 뉘"],
            fallbackOption: "바닥에 눕힙니다",
            gaugeDelta: 0,
            aiReaction: "컥— 커억—",
            rubricHits: [{ itemId: "CO-01", score: 1 }],
            criticalFail: true,
            cfMessage: CF_LIE_DOWN_MESSAGE,
            cfAlternatives: CF_LIE_DOWN_ALTERNATIVES,
            docId: "DOC-GUIDE-004",
            next: "T1",
          },
          {
            id: "D1-f",
            label: "등을 세게 두드림 (경고 — ⚑CF 아님)",
            // 부사가 끼어도(등을 '세게' 두드립니다) 걸리도록 어간을 넓혔습니다.
            // 「두드리는 대신 119를 부르겠습니다」처럼 부정·대체 선언까지 감점하지 않도록 부정 창을 건너뜁니다.
            skipNegated: true,
            patterns: ["두드", "등을 세게", "세게 두드", "등짝", "두들기", "때리", "쳐서", "등을 치"],
            fallbackOption: "등을 세게 두드립니다",
            gaugeDelta: 1,
            aiReaction: "컥… 컥…",
            rubricHits: [{ itemId: "CO-01", score: 2 }],
            coaching:
              "세게 두드리는 것은 상황을 악화시킬 수 있습니다. 지금 하실 일은 식사 중단과 기침 격려, 그리고 소리가 나오는지 확인하는 것입니다.",
            docId: "DOC-GUIDE-004",
            next: "T2",
          },
          {
            // 미분류(음성 인식 실패 포함) 전용 중립 분기 — 게이지 변동 0, 루브릭 반영 없음.
            // 여기가 D1-b였을 때는 인식 한 번 빗나가면 관찰 지연으로 기록되고 T-1이 앞당겨졌습니다.
            id: "D1-n",
            label: "무응답·미분류",
            patterns: [],
            gaugeDelta: 0,
            aiReaction: "…컥… 컥…",
            aiReactionNote: "기침이 이어집니다. 아직 소리가 남아 있습니다.",
            rubricHits: [],
            coaching: UNCLEAR_COACHING,
            docId: "DOC-GUIDE-004",
            next: "T1",
          },
        ],
      },
    },

    /* ── S2 부분폐쇄 대응 ─────────────────────────────────────────── */
    {
      id: "T2",
      speaker: "elder",
      speakerName: "이 어르신",
      text: "…어어… (기침) …괜찮…",
      stageDirection: "기침이 이어지고 말소리가 나옵니다. 부분 폐쇄가 유지되고 있습니다.",
      cue: {
        id: "CUE-2",
        prompt: "어르신 상태를 소리 내어 관찰 보고하세요.",
        waitSec: 8,
        // 관찰을 말했는데 신호에 걸리지 않았다고 「미보고」(D2-c)로 찍지 않습니다.
        defaultBranchId: "D2-n",
        branches: [
          {
            id: "D2-a",
            label: "관찰어 사용 (관찰과 해석 분리)",
            patterns: [
              "기침 하고 계시",
              "기침하고 계시",
              "목소리",
              "목소리 나오",
              "소리 나오",
              "말소리",
              "입술 색",
              "입술이",
              "얼굴색",
              "숨소리",
              "12시",
              "정상입니다",
              "관찰",
            ],
            fallbackOption: "기침 하고 계시고, 목소리 나오시고, 입술 색 정상입니다",
            gaugeDelta: 0,
            aiReaction: "…어… 컥…",
            rubricHits: [
              { itemId: "SA-05", score: 4 },
              { itemId: "SA-08", score: 3 },
            ],
            praise: "해석이 아니라 보이는 그대로 진술하셨습니다. 그대로 119에 전달할 수 있습니다.",
            docId: "DOC-GUIDE-004",
            next: "T3",
          },
          {
            id: "D2-b",
            label: "해석만",
            patterns: ["괜찮으신 것 같", "괜찮아 보", "별일 아닌 것 같", "나아지시는 것 같"],
            fallbackOption: "괜찮으신 것 같아요",
            gaugeDelta: 0,
            aiReaction: "…컥…",
            rubricHits: [{ itemId: "SA-05", score: 2 }],
            coaching: "\"괜찮아 보여요\" 대신 무엇이 보이는지 말씀해 주세요. 기침·목소리·입술 색입니다.",
            docId: "DOC-GUIDE-004",
            next: "T3",
          },
          {
            id: "D2-c",
            label: "말하지 않고 지켜보기만 함",
            // 「소리 내어 말하지 않기로 했다」는 판정은 실제로 그렇게 답했을 때만 내립니다.
            patterns: [
              "말없이",
              "아무 말 없이",
              "말하지 않",
              "말씀드리지 않",
              "소리 내지 않",
              "그냥 지켜보",
            ],
            fallbackOption: "아무 말 없이 지켜보기만 합니다",
            gaugeDelta: 0,
            aiReaction: "…컥…",
            aiReactionNote: "상태 진술 없이 시간이 지나갑니다.",
            rubricHits: [{ itemId: "SA-05", score: 1 }],
            coaching:
              "\"기침 하고 계시고 목소리 나오십니다\"처럼 소리 내어 말씀해 보세요. 그 문장이 곧 119 신고 문장이 됩니다.",
            docId: "DOC-GUIDE-004",
            next: "T3",
          },
          {
            id: "D2-n",
            label: "무응답·미분류",
            patterns: [],
            gaugeDelta: 0,
            aiReaction: "…컥…",
            rubricHits: [],
            coaching: UNCLEAR_COACHING,
            docId: "DOC-GUIDE-004",
            next: "T2",
          },
        ],
      },
    },

    /* ── 돌발 변수 T-1 「완전 기도폐쇄 전환」 (알파 100% 고정 발동) ──── */
    {
      id: "T3",
      speaker: "elder",
      speakerName: "이 어르신",
      text: "(소리 없음 — 3초간 무음)",
      /* 「두 손으로」 → 「오른손으로」 (2026-08-31 교차 재검증 · 교육 렌즈 확정) — 이 어르신은
         좌측 편마비 설정이라 두 손을 함께 쓰는 묘사가 인물과 모순이고, 초급 학습자에게
         「기도폐쇄 신호 = 양손」이라는 잘못된 관찰 단서를 심습니다. 판정 표지(「목을 잡고」·
         「목을 움켜」)와 기록 모범답안(「목 움켜쥠」)은 손 개수를 보지 않아 그대로입니다. */
      stageDirection:
        "기침 소리가 급격히 약해지고 소리가 사라집니다. 오른손으로 목을 움켜쥐시고, 마비가 있는 왼팔은 늘어진 그대로입니다. 얼굴이 붉어졌다가 창백해집니다.",
      isTrigger: true,
      triggerName: "T-1 완전 기도폐쇄 전환",
      cue: {
        id: "CUE-3",
        prompt: "지금 판단하세요.",
        waitSec: 4,
        // 미분류를 「신고 지연」(D3-b)에 매핑하지 않습니다 — 인식이 빗나간 것과 신고를 미룬 것은
        // 다른 사실입니다. 상황 자체는 어느 쪽이든 4초 뒤 고정 스크립트(P-02)로 넘어갑니다.
        defaultBranchId: "D3-n",
        branches: [
          {
            id: "D3-a",
            label: "119 연결 판단",
            patterns: [
              "119",
              "일일구",
              "구급차",
              "신고",
              "소리를 못 내",
              "소리가 안 나",
              "말을 못 하",
              "목소리가 안",
              "완전",
              "막혔",
              "응급",
            ],
            fallbackOption: "119! 지금 신고하겠습니다. 소리를 못 내십니다.",
            // 게이지는 학습자 수행이 아니라 **어르신 상태**를 나타냅니다. 돌발 변수 T-1에서
            // 부분 폐쇄가 완전 폐쇄로 바뀌었으므로, 판단이 옳았더라도 긴장도는 올라갑니다.
            // (여기가 0이면 완전 기도폐쇄 구간 내내 지표가 멈춰 있습니다.)
            gaugeDelta: 1,
            aiReaction: "(무음)",
            aiReactionNote:
              "여기서부터 화면이 응급 음성 가이드로 전환됩니다. 생성 호출이 없는 고정 스크립트 구간입니다.",
            rubricHits: [
              { itemId: "CO-03", score: 4 },
              { itemId: "SA-06", score: 4 },
              { itemId: "SA-07", score: 4 },
            ],
            praise: "소리가 나오지 않는 것을 확인하고 즉시 119로 이양하셨습니다.",
            docId: "DOC-GUIDE-004",
            next: "protocol:P-02",
          },
          {
            id: "D3-b",
            label: "계속 등 두드림·말 걸기만",
            // "어르신"은 호칭일 뿐이라 신고 지연 신호가 될 수 없어 뺐습니다.
            patterns: ["괜찮으세요", "정신 차리", "등을 두드", "두드리", "말을 걸", "이름을 부르"],
            /* 이름이 「~만」인 갈래입니다 — **같은 문장에서 119를 부르겠다고 했으면 「만」이 아닙니다**
               (2026-08-28 · 15차 감사 high).
               실측 2건이 이 자리에서 뒤집혀 있었습니다.
                · "119에 신고하고 계속 기침하시도록 말을 걸겠습니다"        → D3-b (표지 「말을 걸」)
                · "지금 바로 119에 신고하겠습니다. 어르신 이름을 부르며 의식을 확인하겠습니다"
                                                                          → D3-b (표지 「이름을 부르」)
               둘 다 119를 부른 뒤 응급 표준 절차(의식 확인·기침 격려)를 함께 말한 **모범 답안**인데,
               D3-b가 감점(gaugeDelta > 0)이라 심각도 순위에서 D3-a를 이겨 CO-03이 4점 대신 2점이 되고
               SA-06·SA-07 4점이 열리지 않았습니다. 화면은 119를 부른 사람에게
               「더 확인하지 말고 바로 119를 눌러 주세요」를 돌려줬습니다.
               표지는 그대로 두고 **부재 조건**만 답니다(classify.ts matchPattern).

               ▸ 조사가 가릅니다 — 부르는 말은 「119**에**·119**를**·119**부**르」로 오고,
                 미루는 말은 주제 조사 「119**는** 조금 있다…」로 옵니다. 그래서 홑 「119」를 두지
                 않습니다. 홑으로 두면 "119는 조금 있다 부르고 등을 두드리겠습니다"까지 이 갈래를
                 빠져나가, 지연을 재려고 만든 자리가 지연에 열립니다.
               ▸ 「부르지 않겠다」는 이 조건에 걸리지 않습니다(부정 문맥) — D3-d ⚑CF가 그대로 받습니다. */
            unlessPatterns: [
              "119에",
              "119로",
              "119를",
              "119 지금",
              "119 신고",
              "119 부",
              "119 불",
              "119 누",
              "지금 119",
              "바로 119",
              "즉시 119",
              "일일구",
              "구급차를 부",
              "구급차 부",
              "구급차를 불",
              "구급차 불",
            ],
            fallbackOption: "어르신! 괜찮으세요? 어르신!",
            // 전환(+1)에 더해 지연분을 더 올리지 않습니다 — D1-b·D1-f로 이미 한 칸 올라온
            // 경로에서 여기가 2가 되면 위기치(5)에 닿아 P-02 인계 전에 세션이 끊깁니다.
            gaugeDelta: 1,
            aiReaction: "(무음)",
            aiReactionNote: "4초가 지나 시스템이 자동으로 개입합니다. 신고 지연이 기록됩니다.",
            rubricHits: [
              { itemId: "CO-03", score: 2 },
              { itemId: "RE-07", score: 2 },
            ],
            coaching:
              "소리가 나오지 않으면 더 확인하지 말고 바로 119를 눌러 주세요. 신고 시각이 기록됩니다.",
            docId: "DOC-GUIDE-004",
            next: "protocol:P-02",
          },
          {
            id: "D3-c",
            label: "하임리히 시도 발화 / 복부 압박 (⚑CF)",
            patterns: [
              "하임리히",
              "복부 압박",
              "배를 밀",
              "밀어내",
              "명치",
              "뒤에서 안고",
              "복부를",
              "가슴압박",
              "흉부 압박",
            ],
            fallbackOption: "뒤에서 안고 밀어냅니다",
            gaugeDelta: 0,
            aiReaction: "(무음)",
            rubricHits: [{ itemId: "CO-01", score: 1 }],
            criticalFail: true,
            cfMessage: CF_NO_MANEUVER_MESSAGE,
            cfAlternatives: CF_NO_MANEUVER_ALTERNATIVES,
            // 복부 압박은 무면허 의료행위 경계에 놓인 행위입니다 — 루브릭 CO-01의 근거와
            // 같은 문서(의료법 제27조)를 인용합니다.
            docId: "DOC-LAW-005",
            next: "T3",
          },
          {
            // CO-03의 1점 앵커 「미신고 ⚑」가 실제로 열리는 자리입니다.
            // 이 분기가 없으면 루브릭 앵커·E-재훈련 조건·engine/timing.ts 주석이 모두
            // 데이터에 없는 판정을 가리키게 됩니다.
            id: "D3-d",
            label: "신고하지 않기로 함 (⚑CF)",
            // 「미룬다」가 아니라 「부르지 않겠다」에만 붙입니다 — 지연(2~3점)은 시간이 재고,
            // 여기서 멈추는 것은 신고를 하지 않기로 한 판단뿐입니다.
            // ⚑CF 분기는 부정 문맥을 넓게 건너뛰므로("안 부르면 안 됩니다"는 걸리지 않습니다)
            // 어간을 넉넉히 둡니다.
            patterns: [
              "신고까지는",
              "신고는 안",
              "신고 안",
              "신고하지 않",
              "119까지는",
              "119는 안",
              "구급차까지는",
              "안 부르",
              "안 불러",
              "부르지 않",
              "부르지는 않",
            ],
            fallbackOption: "119까지는 부르지 않고 조금 더 지켜보겠습니다",
            gaugeDelta: 0,
            aiReaction: "(무음)",
            aiReactionNote: "소리가 나오지 않는 상태가 이어집니다.",
            rubricHits: [{ itemId: "CO-03", score: 1 }],
            criticalFail: true,
            cfMessage: CF_NO_CALL_MESSAGE,
            cfAlternatives: CF_NO_CALL_ALTERNATIVES,
            docId: "DOC-GUIDE-004",
            next: "T3",
          },
          {
            id: "D3-n",
            label: "무응답·미분류",
            patterns: [],
            gaugeDelta: 0,
            aiReaction: "(무음)",
            aiReactionNote:
              "4초가 지나 화면이 응급 음성 가이드로 전환됩니다. 생성 호출이 없는 고정 스크립트 구간입니다.",
            rubricHits: [],
            /* 체류 원칙의 **예외①** — 무행동이 곧 사건이 되는 자리입니다.
               화면만 멈춰 세우면 시간 압박이 거짓이 되므로 넘어가되, 다시 청하는 말은 하지 않습니다. */
            coaching: UNCLEAR_COACHING_MOVES_ON,
            docId: "DOC-GUIDE-004",
            next: "protocol:P-02",
          },
        ],
      },
    },

    /* ── L3 구간 — 응급 음성 가이드 프로토콜 P-02 (생성 0%) ─────────── */
    {
      id: "P-02",
      speaker: "protocol",
      speakerName: "응급 음성 가이드",
      text: "여기서부터 화면에서 생성이 빠집니다. 사전 검수된 고정 문구 6단계를 음성과 자막으로 재생합니다.",
      stageDirection:
        "119 통화 버튼이 상시 확대 노출됩니다. 돌발 변수 T-3「네트워크 단절」은 P-02-2 재생 직후 수동으로 발동하며, 오프라인 캐시로 6단계가 끊김 없이 이어집니다.",
      autoNext: "T4",
    },

    /* ── S4 인계 — 119 상황실 ─────────────────────────────────────── */
    {
      id: "T4",
      speaker: "dispatcher",
      speakerName: "119 상황실",
      text: "119입니다. 지금 환자분 의식 있으십니까? 소리를 내십니까?",
      cue: {
        id: "CUE-4",
        prompt: "상황실 질문에 답하세요.",
        waitSec: 8,
        // 미분류를 「추정·감정 진술」(Q-c)에 매핑하지 않습니다 — 네 항목이 한꺼번에 1점이 되는 자리입니다.
        defaultBranchId: "Q-n",
        branches: [
          {
            id: "Q-a",
            label: "복창·재확인 + 관찰 사실 답변",
            patterns: [
              "소리 안 나",
              "소리를 못",
              "소리가 안",
              "목을 잡고",
              "목을 움켜",
              "입술이 파",
              "입술 색",
              "창백",
              "의식은",
              "네 확인",
              "다시 말씀",
            ],
            fallbackOption:
              "소리 안 나십니다. 목을 잡고 계시고 입술이 파래지고 있습니다.",
            gaugeDelta: 0,
            aiReaction: "확인했습니다. 구급대 출동했습니다. 스피커폰 유지해 주세요.",
            rubricHits: [
              { itemId: "SA-08", score: 4 },
              { itemId: "SA-05", score: 4 },
              { itemId: "RE-07", score: 4 },
              { itemId: "RE-08", score: 4 },
            ],
            praise: "질문을 다시 확인하고 관찰한 사실로 답하셨습니다.",
            docId: "DOC-GUIDE-004",
            next: "T5",
          },
          {
            id: "Q-b",
            label: "답하되 관찰이 부정확",
            patterns: ["숨을 못 쉬시는 것 같", "많이 안 좋으신", "위험한 것 같", "아마"],
            fallbackOption: "숨을 못 쉬시는 것 같아요",
            gaugeDelta: 0,
            aiReaction: "소리를 내시는지만 다시 확인해 주세요.",
            rubricHits: [
              { itemId: "SA-05", score: 2 },
              { itemId: "SA-08", score: 2 },
              { itemId: "RE-08", score: 3 },
            ],
            coaching: "추정 대신 보이는 것만 말씀해 주세요. 소리·손·입술 색입니다.",
            docId: "DOC-GUIDE-004",
            next: "T5",
          },
          {
            id: "Q-c",
            label: "추정·감정 진술 반복",
            patterns: ["큰일났", "빨리 와", "어떡해", "살려", "빨리요"],
            fallbackOption: "큰일났어요, 빨리 와주세요!",
            gaugeDelta: 0,
            aiReaction: "진정하시고, 소리를 내시는지만 알려 주세요.",
            rubricHits: [
              { itemId: "SA-05", score: 1 },
              { itemId: "SA-08", score: 1 },
              { itemId: "RE-07", score: 1 },
              { itemId: "RE-08", score: 1 },
            ],
            coaching: "상황실이 필요한 것은 감정이 아니라 관찰입니다. 한 문장에 하나씩 말씀해 주세요.",
            docId: "DOC-GUIDE-004",
            next: "T5",
          },
          {
            id: "Q-n",
            label: "무응답·미분류",
            patterns: [],
            gaugeDelta: 0,
            aiReaction: "여보세요? 잘 안 들립니다. 소리를 내시는지만 알려 주세요.",
            rubricHits: [],
            coaching: UNCLEAR_COACHING,
            docId: "DOC-GUIDE-004",
            next: "T4",
          },
        ],
      },
    },

    /* ── S4 인계 — 구급대 SBAR ────────────────────────────────────── */
    {
      id: "T5",
      speaker: "system",
      speakerName: "구급대 도착",
      text: "구급대가 도착했습니다. 어르신을 인계할 차례입니다.",
      cue: {
        id: "CUE-5",
        prompt: "구급대원에게 인계한다고 생각하고 SBAR로 보고하세요.",
        waitSec: 8,
        // 인계 문장을 말했는데 신호에 걸리지 않았다고 「인계 없음」(S-d)으로 찍지 않습니다.
        defaultBranchId: "S-n",
        branches: [
          {
            id: "S-a",
            label: "SBAR 4요소 충족",
            // 한 요소만 담은 문장이 4점을 받지 않도록, S·B·A 요소를 실제로 담은 표지만 남깁니다.
            // ("식사 중", "신고", "연락 부탁", "보호자"처럼 한 요소짜리 토큰은 S-b로 옮겼습니다.)
            patterns: [
              "12시 20분",
              "12시 22분",
              "뇌졸중",
              "편마비",
              "연하",
              "죽식",
              "기침 소실",
              "목 움켜",
              "입술 청색",
            ],
            fallbackOption:
              "12시 20분 점심 식사 중 사레, 12시 22분 소리 나오지 않음. 뇌졸중 후 편마비, 연하 저하로 죽식 중이셨습니다. 기침 소실, 목 움켜쥠, 입술 청색, 119 신고 12시 22분입니다. 이송 후 기관과 보호자께 연락 부탁드립니다.",
            // 구급대 인계로 상황이 응급팀에게 넘어갑니다 — T-1에서 올라간 긴장도가 내려오는
            // 자리입니다. 인계가 이루어지면 어느 분기든 한 칸 내려가고, 4요소를 갖춘 인계는
            // 한 칸 더 내려갑니다(하강 값은 위기치 계산에 들어가지 않습니다).
            gaugeDelta: -2,
            aiReaction: "확인했습니다. 인계 받겠습니다.",
            rubricHits: [
              { itemId: "CL-01", score: 4 },
              { itemId: "CL-02", score: 4 },
            ],
            praise: "상황·배경·관찰·요청이 모두 들어간 인계입니다.",
            docId: "DOC-NOTI-002",
            next: "T-2",
          },
          {
            id: "S-b",
            label: "SBAR 2~3요소",
            patterns: [
              "식사 중",
              "사레",
              "신고했습니다",
              "신고",
              "소리가 안 나",
              "연락 부탁",
              "보호자",
            ],
            fallbackOption: "식사 중에 사레가 들려서 소리가 안 나셔서 신고했습니다",
            gaugeDelta: -1,
            aiReaction: "확인했습니다. 인계 받겠습니다.",
            rubricHits: [
              { itemId: "CL-01", score: 2 },
              { itemId: "CL-02", score: 3 },
            ],
            praise: "사실과 추정을 섞지 않으신 점은 좋습니다.",
            coaching: "시각과 기저 상태(연하 저하·죽식)를 덧붙이면 인계가 완성됩니다.",
            docId: "DOC-NOTI-002",
            next: "T-2",
          },
          {
            id: "S-c",
            label: "감정·추정 위주 인계",
            /* 홑 「갑자기」를 걷어냈습니다 (2026-08-27 · 7차 감정·추정 갈래 전수 점검).
               시각을 적는 말이라 "12시 20분 식사 중 갑자기 소리를 못 내십니다"처럼 **관찰만
               적은 인계**에도 걸립니다. 이 CUE는 요소 판정(사다리)이 없어 배열 앞의 S-a·S-b가
               같은 순위로 먼저 서지만, 그 둘에 닿지 않는 관찰 문장은 이 갈래로 내려갔습니다.
               감정과 함께 오는 꼴("갑자기 그러셔서 너무 놀랐습니다")은 「너무 놀랐」이 잡습니다. */
            patterns: ["갑자기 그러", "갑자기 이런", "너무 놀랐", "정신이 없", "제 잘못", "무서웠"],
            fallbackOption: "갑자기 그러셔서 너무 놀랐습니다",
            gaugeDelta: -1,
            aiReaction: "확인했습니다. 인계 받겠습니다.",
            rubricHits: [
              { itemId: "CL-02", score: 1 },
              { itemId: "CL-01", score: 2 },
            ],
            coaching: "놀란 마음은 뒤로 미루고, 시각과 관찰만 먼저 전달해 주세요.",
            docId: "DOC-NOTI-002",
            next: "T-2",
          },
          {
            id: "S-d",
            label: "인계하지 않음",
            // 「전할 말이 없다」는 판정은 실제로 그렇게 답했을 때만 내립니다.
            patterns: [
              "드릴 말씀이 없",
              "따로 말씀드릴",
              "말씀드릴 것이 없",
              "인계하지 않",
              "알아서 하시",
              "그냥 보내",
            ],
            fallbackOption: "따로 드릴 말씀이 없습니다",
            // 인계 문장이 없어도 구급대가 자체 확인 후 이송하므로 상황 자체는 넘어갑니다.
            gaugeDelta: -1,
            aiReaction: "구급대가 자체 확인 후 이송합니다.",
            rubricHits: [{ itemId: "CL-01", score: 1 }],
            coaching: "인계 한 문장이 병원에서의 첫 판단을 바꿉니다. 시각부터 말씀해 보세요.",
            docId: "DOC-NOTI-002",
            next: "T-2",
          },
          {
            // 중립 분기는 게이지도 움직이지 않습니다 — 인계 하강(−1)은 인계가 실제로 있었을 때의 값입니다.
            id: "S-n",
            label: "무응답·미분류",
            patterns: [],
            gaugeDelta: 0,
            aiReaction: "…네? 다시 말씀해 주시겠어요?",
            rubricHits: [],
            coaching: UNCLEAR_COACHING,
            docId: "DOC-NOTI-002",
            next: "T5",
          },
        ],
      },
    },

    /* ── 돌발 변수 T-2 「보호자 추궁」 (구급 이송 이후 100%) ─────────── */
    {
      id: "T-2",
      speaker: "guardian",
      speakerName: "보호자 따님",
      text: "선생님이 계셨는데 왜 이런 일이 생겨요? 뭘 먹였길래요?",
      stageDirection: "구급 이송 직후 전화가 걸려옵니다.",
      isTrigger: true,
      triggerName: "T-2 보호자 추궁",
      cue: {
        id: "CUE-T2",
        prompt: "보호자께 어떻게 답하시겠습니까?",
        waitSec: 8,
        defaultBranchId: "G-n",
        branches: [
          {
            id: "G-a",
            label: "관찰 사실 진술 유지",
            patterns: [
              "12시",
              "죽 한",
              "한 숟갈",
              "기침",
              "소리가 나오지",
              "신고",
              "말씀드리겠",
              "그대로",
              "확인된 것",
              "기관에도",
            ],
            fallbackOption:
              "12시 20분 죽 한 숟갈 드신 뒤 기침이 있었고, 12시 22분 소리가 나오지 않아 119에 신고했습니다. 확인된 사실 그대로 기관에도 보고드리겠습니다.",
            gaugeDelta: 0,
            aiReaction: "…알겠어요. 병원으로 갈게요.",
            rubricHits: [
              { itemId: "CL-02", score: 4 },
              { itemId: "RE-06", score: 4 },
              { itemId: "CO-04", score: 4 },
            ],
            praise: "변명하지 않고 관찰한 사실만 전달하셨습니다. 기록은 나중에 나를 지키는 근거가 됩니다.",
            docId: "DOC-LAW-007",
            next: "T6",
          },
          {
            id: "G-b",
            label: "방어적 변명",
            patterns: ["저는 잘못", "제 탓이 아니", "원래", "평소에도", "어쩔 수 없"],
            fallbackOption: "저는 잘못한 게 없어요",
            gaugeDelta: 0,
            aiReaction: "그럼 누구 잘못이에요?",
            rubricHits: [
              { itemId: "CL-02", score: 2 },
              { itemId: "RE-06", score: 2 },
            ],
            coaching:
              "\"12시 20분 죽 한 숟갈, 12시 22분 신고\"처럼 시각과 관찰부터 전해 주세요. 책임은 그다음 자리입니다.",
            docId: "DOC-LAW-007",
            next: "T6",
          },
          {
            id: "G-c",
            label: "감정 맞대응",
            patterns: ["그렇게 말씀하시면", "저도 사람", "말씀이 심하", "왜 저한테"],
            fallbackOption: "그렇게 말씀하시면 저도 곤란합니다",
            // 게이지 변동 0 — 이송이 끝난 뒤의 통화이므로 어르신 상태와는 무관합니다.
            //
            // B02 긴장도 배선 (시작 2 · 위기치 5)
            //   ▲ 이상징후 방치(D1-b·D1-f) +1 / 완전 폐쇄 전환(D3-a·D3-b) +1
            //   ▼ 구급대 인계(S-a −2 · S-b·S-c·S-d −1)
            //   상승 합은 최대 2(=4)라 위기치에 닿지 않습니다 — 보고·기록 CUE 전에 위기 엔딩으로
            //   끊기면 안 되기 때문입니다. 상승 값을 올리실 때는 이 합을 먼저 확인해 주세요.
            gaugeDelta: 0,
            aiReaction: "지금 저한테 화내시는 거예요?",
            rubricHits: [{ itemId: "RE-06", score: 1 }],
            coaching:
              "맞대응 대신 \"확인된 사실 그대로 기관에도 보고드리겠습니다\" 한 문장으로 절차 쪽으로 옮겨 주세요.",
            docId: "DOC-LAW-007",
            next: "T6",
          },
          {
            id: "G-d",
            label: "대답하지 않고 넘김",
            // 「대답하지 않기로 했다」는 판정은 실제로 그렇게 답했을 때만 내립니다.
            patterns: [
              "아무 말 없이",
              "말없이",
              "대답하지 않",
              "대답 안",
              "못 들은 척",
              "그냥 끊",
              "듣고만",
            ],
            fallbackOption: "아무 말 없이 듣고만 있습니다",
            gaugeDelta: 0,
            aiReaction: "…듣고 계세요?",
            rubricHits: [{ itemId: "RE-06", score: 2 }],
            coaching:
              "듣고만 계시더라도 \"12시 22분에 119에 신고했습니다\" 한 문장은 전해 주세요.",
            docId: "DOC-LAW-007",
            next: "T6",
          },
          {
            id: "G-n",
            label: "무응답·미분류",
            patterns: [],
            gaugeDelta: 0,
            aiReaction: "…여보세요? 잘 안 들려요.",
            rubricHits: [],
            coaching: UNCLEAR_COACHING,
            docId: "DOC-LAW-007",
            next: "T-2",
          },
        ],
      },
    },

    /* ── S5 보고·기록 (기능③ 연동) ───────────────────────────────── */
    {
      id: "T6",
      speaker: "system",
      speakerName: "보고·기록",
      text: "이송이 끝났습니다. 기관 보고와 급여제공기록지 초안을 확정할 차례입니다.",
      cue: {
        id: "CUE-6",
        prompt: "기관에 보고하고, 급여제공기록지 초안을 확정해 주세요.",
        waitSec: 8,
        // 상식적인 보고 문장이 신호에 걸리지 않았다고 「보고·기록 없음」(M-c)으로 찍지 않습니다.
        defaultBranchId: "M-n",
        branches: [
          {
            id: "M-a",
            label: "보고 + 기재 대상 판단",
            patterns: [
              "기관에 보고",
              "센터에 보고",
              "기록지",
              "특이사항",
              "기재하겠",
              "남기겠",
              "사고 보고",
              "지금 바로",
            ],
            fallbackOption:
              "지금 바로 기관에 사고 보고를 드리고, 급여제공기록지 특이사항란에 시각과 조치를 기재하겠습니다",
            gaugeDelta: 0,
            aiReaction: "보고가 접수되었고 기록 초안이 저장되었습니다.",
            rubricHits: [
              { itemId: "CO-04", score: 4 },
              { itemId: "CO-05", score: 4 },
              { itemId: "CL-03", score: 4 },
            ],
            praise: "보고 시점과 기재 항목까지 특정하셨습니다.",
            docId: "DOC-NOTI-002",
            next: "T7",
          },
          {
            id: "M-b",
            label: "보고 의사만 표명",
            patterns: ["나중에 말씀", "이따 보고", "정리해서", "생각해 보"],
            fallbackOption: "나중에 정리해서 말씀드리겠습니다",
            gaugeDelta: 0,
            aiReaction: "보고 예정으로만 기록되었습니다.",
            rubricHits: [
              { itemId: "CO-04", score: 2 },
              { itemId: "CO-05", score: 2 },
              { itemId: "CL-03", score: 2 },
            ],
            coaching:
              "\"지금 센터에 전화드리고 기록지 특이사항란에 적겠습니다\"처럼 언제·누구에게·무엇을까지 정해 주세요.",
            docId: "DOC-NOTI-002",
            next: "T7",
          },
          {
            id: "M-c",
            label: "보고·기록 없음",
            patterns: ["안 해도", "필요 없", "병원에서 알아서"],
            fallbackOption: "병원에서 알아서 처리할 테니 따로 남기지 않겠습니다",
            gaugeDelta: 0,
            aiReaction: "보고와 기록이 등록되지 않았습니다.",
            rubricHits: [
              { itemId: "CO-04", score: 1 },
              { itemId: "CO-05", score: 1 },
              { itemId: "CL-03", score: 1 },
            ],
            coaching:
              "응급 이송은 기관 보고와 급여제공기록지 기재 대상입니다. 이송이 끝난 지금 바로 한 줄 남겨 주세요.",
            docId: "DOC-NOTI-002",
            next: "T7",
          },
          {
            id: "M-n",
            label: "무응답·미분류",
            patterns: [],
            gaugeDelta: 0,
            aiReaction: "말씀이 잘 전달되지 않았습니다.",
            rubricHits: [],
            coaching: UNCLEAR_COACHING,
            docId: "DOC-NOTI-002",
            next: "T6",
          },
        ],
      },
    },
    {
      id: "T7",
      speaker: "system",
      speakerName: "보고·기록",
      text: "마지막입니다. 다음을 위한 제안과 스스로 고칠 점을 남겨 주세요.",
      cue: {
        id: "CUE-7",
        prompt: "재발 방지 제안과, 오늘 내 대응에서 한 가지 고칠 점을 말씀해 주세요.",
        waitSec: 8,
        defaultBranchId: "N-n",
        branches: [
          {
            id: "N-a",
            label: "구체적 제안 + 개선점 언어화",
            // "다음엔"·"하겠습니다"는 존댓말 종결 표지일 뿐이라 4점 신호가 될 수 없어 뺐습니다.
            // 설계서 §3.2 CUE-7이 예시한 **구체 행동**만 남깁니다.
            patterns: [
              "식사 속도",
              "천천히",
              "한 숟갈",
              "삼킴 확인",
              "삼키신 것을 확인",
              "삼키신 것 확인",
              "대화 자제",
              "대화를 줄",
              "상체 각도",
              "협의",
            ],
            fallbackOption:
              "한 숟갈마다 삼키신 것을 확인하고, 식사 중 대화를 줄이겠습니다. 다음엔 소리가 나오는지부터 먼저 확인하겠습니다.",
            gaugeDelta: 0,
            aiReaction: "훈련을 마쳤습니다.",
            rubricHits: [
              { itemId: "CL-04", score: 4 },
              { itemId: "CL-05", score: 4 },
              { itemId: "RE-09", score: 3 },
            ],
            praise: "실행 가능한 제안과 고칠 점을 함께 정리하셨습니다.",
            docId: "DOC-GUIDE-001",
            next: "end:E-성공",
          },
          {
            id: "N-b",
            label: "추상적 제안",
            patterns: ["조심", "신경 쓰", "잘 보", "주의하", "노력하", "잘하겠", "고치겠"],
            fallbackOption: "다음엔 더 조심하겠습니다",
            gaugeDelta: 0,
            aiReaction: "훈련을 마쳤습니다.",
            rubricHits: [
              { itemId: "CL-04", score: 2 },
              { itemId: "CL-05", score: 2 },
            ],
            coaching:
              "\"한 숟갈마다 삼키신 것을 확인하겠습니다\"처럼, 다음 식사에서 바꿀 것 하나를 문장으로 정해 보세요.",
            docId: "DOC-GUIDE-001",
            next: "end:E-부분",
          },
          {
            id: "N-c",
            label: "제안 없음",
            patterns: ["없습니다", "모르겠", "생각 안"],
            fallbackOption: "특별히 떠오르는 것이 없습니다",
            gaugeDelta: 0,
            aiReaction: "훈련을 마쳤습니다.",
            rubricHits: [
              { itemId: "CL-04", score: 1 },
              { itemId: "CL-05", score: 1 },
            ],
            coaching:
              "\"삼키신 것을 확인하고 다음 숟갈을 드리겠습니다\" 하나만 정해 두셔도 다음 식사가 달라집니다.",
            docId: "DOC-GUIDE-001",
            next: "end:E-부분",
          },
          {
            id: "N-n",
            label: "무응답·미분류",
            patterns: [],
            gaugeDelta: 0,
            aiReaction: "훈련을 마쳤습니다.",
            rubricHits: [],
            /* 체류 원칙의 **예외②** — 회차를 닫는 자리입니다. 이 분기의 대사가 이미
               마무리를 알리고, 새 대사를 더하는 것은 금지라(오디오 재합성) 여기서는 진행이 맞습니다. */
            coaching: UNCLEAR_COACHING_CLOSING,
            docId: "DOC-GUIDE-001",
            next: "end:E-부분",
          },
        ],
      },
    },
  ],
  triggers: [
    {
      id: "T-1",
      name: "완전 기도폐쇄 전환",
      condition: "CUE-2 종료 후 (알파에서는 100% 고정 발동) · D1-b 선택 시 앞당겨 발동",
      description:
        "기침 소리가 급격히 약해지고 소리가 사라집니다. 오른손으로 목을 움켜쥐시고(좌측 편마비 — 왼팔은 늘어져 있습니다), 얼굴이 붉어졌다가 창백해집니다. 3초간 무음 구간이 이어집니다.",
    },
    {
      id: "T-2",
      name: "보호자 추궁",
      condition: "구급 이송 이후 100%",
      description:
        "따님 전화: \"선생님이 계셨는데 왜 이런 일이 생겨요? 뭘 먹였길래요?\" 방어적 변명 대신 관찰 사실 진술을 유지하는지 봅니다. 유형③(갈등) 크로스오버 지점입니다. (측정: CL-02, RE-06)",
    },
    {
      id: "T-3",
      name: "네트워크 단절",
      condition: "P-02-2 재생 직후 (시연 시 비행기 모드 수동 전환)",
      description:
        "서버 연결이 끊깁니다. 오프라인 캐시로 P-02 6단계가 끊김 없이 계속 재생되는지 검증합니다. 심사항목 '오류 대비·복구'의 실물 증거이며, 채점 항목이 아니라 시스템 검증 항목입니다.",
    },
  ],
  endings: [
    {
      id: "E-성공",
      title: "이양까지 마치셨습니다",
      verdict: "충족",
      condition: "119 신고 90초 이내 · ⚑CF 0건 · 관찰 진술 2회 이상 · SBAR 4요소 충족",
      message:
        "관찰하고, 이양하고, 기록까지 남기셨습니다. 충족하신 원칙과 근거 출처를 확인해 주세요.",
    },
    {
      id: "E-부분",
      // 이 엔딩은 마지막 한 문장(CUE-7 재발 방지 제안 + 고칠 점)으로만 갈립니다 — 90초 안에
      // 신고하고도 여기로 옵니다. 그래서 **제목도 문구도** 신고가 늦었는지를 단정하지 않고
      // 실제 갈림 사유만 적습니다(연결까지 걸린 시간은 engine/timing.ts가 재서 따로 표시합니다).
      // 제목은 종료 화면 부제와 /history 회차 카드에 그대로 실리므로 같은 기준을 받습니다.
      title: "다음 식사를 위한 한 문장이 남았습니다",
      verdict: "부분 충족",
      condition: "119 신고 90~180초 또는 SBAR 2요소 이하",
      message:
        "마무리 돌아보기에서 한 문장이 남았습니다. 관찰과 이양이 어디까지 닿았는지는 아래에서 확인해 주세요.",
    },
    {
      id: "E-재훈련",
      title: "한 지점만 다시 보고 가겠습니다",
      verdict: "재훈련",
      condition: "⚑CF 1건 이상(CO-01 또는 CO-03)",
      message:
        "허용 범위 밖의 행위가 선택되었습니다. 해당 프로토콜을 다시 확인하신 뒤, 멈췄던 이 지점부터 다시 이어가 보시겠어요?",
    },
  ],
  appliedRubric: [
    "SA-01",
    "SA-04",
    "SA-05",
    "SA-06",
    "SA-07",
    "SA-08",
    "CO-01",
    "CO-03",
    "CO-04",
    "CO-05",
    "CO-07",
    "RE-06",
    "RE-07",
    "RE-08",
    "RE-09",
    "CL-01",
    "CL-02",
    "CL-03",
    "CL-04",
    "CL-05",
  ],
  // 설계서 §3.2 K 표의 3건에 더해, 세션 중 실제로 근거 칩으로 인용되는 두 건을 함께 둡니다.
  // (T-2 보호자 추궁 = RE-06 → DOC-LAW-007 / CUE-7 재발 방지 = CL-04 → DOC-GUIDE-001, §4.3 기준)
  sourceDocs: [
    "DOC-GUIDE-004",
    "DOC-LAW-005",
    "DOC-NOTI-002",
    "DOC-LAW-007",
    "DOC-GUIDE-001",
  ],
  reportCues: [
    "구급대원에게 인계한다고 생각하고 SBAR로 보고하세요.",
    "기관에 보고하고, 급여제공기록지 초안을 확정해 주세요.",
  ],
  active: true,
};

/**
 * L3 프로토콜 재생이 끝난 뒤 세션이 복귀하는 턴 id.
 * (분기의 next 가 "protocol:P-02" 이면, 프로토콜 재생 후 id 가 "P-02" 인 턴의 autoNext 로 이어집니다.)
 */
export const B02_PROTOCOL_RESUME_TURN_ID = "T4";

export default CHK_B02;
