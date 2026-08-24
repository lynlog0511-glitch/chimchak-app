/**
 * CHK-B01 「괜찮아, 손 좀 줘 봐요」 — 알파 초안(현직 감수 대기).
 *
 * 유형 ② 응급 초기 대응 · 난이도 초급 · 소요 약 4분 · 계층 L1+L2
 * 기능 F1 시뮬레이터 + F3 기록 코칭
 *
 * 편성 근거: 설계서 §9.1 확장 매트릭스의 「B01 낙상 후 의식 있음 — 관찰·보고」 칸입니다.
 * B02(질식·중급)와 같은 유형이지만 배우는 것이 다릅니다 — B02가 **위험이 올라가는 순간을
 * 알아채고 이양하는** 훈련이라면, B01은 **아무 일도 하지 않는 것이 대응인 순간**을 견디는
 * 훈련입니다.
 *
 * 초급이라 L3(응급 음성 가이드) 구간이 없습니다. 의식이 있고 말씀을 하시는 상태라
 * 고정 프로토콜 재생으로 넘어갈 지점이 생기지 않기 때문입니다. 낙상 프로토콜 P-01은
 * /emergency에 따로 있고, 이 훈련이 다루는 것은 그 앞의 **관찰·판단·보고**뿐입니다.
 *
 * 이 시나리오가 더하는 것
 *  - 어르신 **본인**이 일으켜 달라고 재촉하는 압박 (B02의 압박은 시간, 여기서는 사람입니다)
 *  - 신체 술기를 하지 않는 것이 곧 대응이 되는 자리 (CO-01 ⚑CF — 일으키기·옮기기)
 *  - 「딸한테는 말하지 마요」라는 요구 앞에서의 보고 판단 (CO-03 ⚑CF — 아무에게도 알리지 않기)
 *
 * 대사·지문은 검수된 고정 문구(앵커)이며, 경량 LLM(교체형 어댑터)이 붙더라도
 * 이 앵커에서 이탈하면 템플릿 고정 대사로 되돌립니다.
 *
 * 상태 흐름: S1 낙상 인지(T1/CUE-1) → S2 관찰(T2/CUE-2) → [F-1 재촉] S3 자세 유지(CUE-3)
 *          → S4 연결 판단(T3/CUE-4) → [F-2 보호자 전화] (CUE-T2)
 *          → S5 보고·기록(T4/CUE-5) → 재발 방지(CUE-6) → 돌아보기(CUE-7)
 *
 * 판정 공정성 (8/6 감사 기준을 그대로 따릅니다)
 *  - 모든 CUE에 **중립 미분류 분기**(…-n)를 두고 defaultBranchId를 그리로 돌렸습니다.
 *    말이 신호에 걸리지 않았다는 것과 잘못 대응했다는 것은 다른 사실입니다.
 *    감점 분기는 학습자가 **실제로 그 말을 했을 때만** 열립니다.
 *  - ⚑CF는 두 자리에만 둡니다 — **위험한 행위**(일으키기·옮기기)와 **방치**(아무에게도
 *    알리지 않기). 「어디가 아픈지 물어보지 않았다」·「보고가 늦었다」는 감점이지 ⚑CF가 아닙니다.
 *
 * 근거 문서
 *  - DOC-GUIDE-004 소방청·응급의료정보센터 일반인 응급처치 안내 (관찰·신고 기준)
 *  - DOC-LAW-003  노인복지법 제39조의9 (존엄·금지행위 — 존칭·설명·동의 절차)
 *  - DOC-NOTI-002 장기요양급여 제공기준 고시 (사고 보고·기록)
 *  - DOC-GUIDE-001 중앙치매센터 대응 매뉴얼 (재발 방지 제안)
 *
 * 알려진 한계 — 규칙 사전의 유형 게이트
 *  규칙 사전(engine/rules.ts)의 CO-01 항목 가운데 액체·음식·눕히기·삼킴 4종은
 *  `onlyTypes: ["EMERGENCY"]`라 이 시나리오에서도 그대로 발동하고, 그 고정 문구는
 *  **기도 폐쇄**를 전제로 쓰여 있습니다. 세션 엔진은 규칙이 잡은 항목과 같은 항목의
 *  ⚑CF 분기가 그 CUE에 있으면 **데이터 쪽 문구**를 대신 내보내므로(engine/session.ts),
 *  실시간 구간 세 CUE에 CO-01 ⚑CF 분기를 두고 그 문구를 「일으키기·옮기기·드리기」까지
 *  함께 덮도록 적었습니다. 규칙을 고치는 대신 데이터로 덮은 자리라 여기 적어 둡니다.
 */

import type { Scenario } from "@/types";

/**
 * 중립 미분류 분기의 코칭 문구 — 감점이 아니라 **다시 말할 기회**입니다.
 * 넘어지신 분 곁에 앉아 말하는 자리라, 한 문장으로 짧게 말하도록 안내합니다.
 */
const UNCLEAR_COACHING =
  "말씀이 닿지 않았습니다. 지금 하신 말씀은 판정에 넣지 않았으니, 어르신 곁에서 하실 말씀을 한 문장으로 짧게 다시 들려주시거나 아래 버튼에서 골라 주세요.";

/**
 * CO-01 ⚑CF 판정 신호 — 넘어지신 어르신을 **움직이는** 계열.
 *
 * 한국어는 음절 블록 단위라 "일으켜"는 "일으키겠습니다"의 부분 문자열이 아닙니다 —
 * 어간까지만 남기고 활용형을 함께 둡니다. 「붙잡·붙들」을 여기 두는 이유는, 낙상 자리의
 * "붙잡아 드릴게요"가 신체 억제가 아니라 **무리한 부축**이기 때문입니다
 * (규칙 사전의 CO-02 신체 억제 계열은 이 시나리오의 적용 항목이 아닙니다).
 *
 * 하지 않겠다고 말한 문장("붙잡지 않겠습니다")은 ⚑CF 분기의 넓은 부정 창이 그대로 건너뜁니다.
 */
const LIFT_PATTERNS = [
  "일으켜",
  "일으키",
  "부축",
  "붙잡",
  "붙들",
  "안아서",
  "안아 올",
  "들어 올",
  "들어올",
  "업고",
  "업어",
  "세워 드리",
  "세워 드릴",
  "잡아 당기",
  "당겨서 일",
  "끌어",
  "옮겨 드리",
  "옮겨 드릴",
  "옮기겠",
  "의자에 앉히",
  "침대로 옮",
];

/**
 * CO-01 ⚑CF 인터럽트 고정 문구.
 *
 * 「일으키기」만 적지 않고 **무엇을 드리는 것**까지 함께 적은 이유는 위 헤더의 마지막 항목과
 * 같습니다 — 규칙 사전이 액체·음식·눕히기로 잡은 판정도 이 자리에서는 이 문구를 빌려 갑니다.
 * 넘어지신 뒤에 물·음식을 드리지 않는 것은 그 자체로도 맞는 안내입니다(검사·처치가 남아 있습니다).
 */
const CF_MOVE_MESSAGE =
  "잠시 멈추겠습니다. 넘어지신 뒤에는 어디를 다치셨는지 아직 알 수 없습니다. 일으켜 세우거나 옮기는 것, 물이나 음식을 드리는 것은 지금 하실 일이 아닙니다. 침착은 몸으로 하는 동작을 안내하지 않습니다. 지금 하실 수 있는 것은 ①그대로 계시도록 말씀드리기 ②어디가 아프신지 여쭤보기 ③119나 기관에 알리기입니다. 다시 해보시겠어요?";

const CF_MOVE_ALTERNATIVES = [
  "\"조금만 그대로 계셔 주세요\" 하고 말씀드립니다.",
  "어디가 아프신지, 팔다리를 움직이실 수 있는지 여쭤봅니다.",
  "119 또는 기관·담당 간호사에게 보이는 그대로 알립니다.",
];

/**
 * CO-03 ⚑CF 인터럽트 고정 문구 — 루브릭 CO-03의 1점 앵커 「미신고 ⚑」 자리입니다.
 * 지연(2~3점)은 engine/timing.ts가 경과 시간으로 재고, 「알리지 않겠다」는 판단만 여기서 멈춥니다.
 */
const CF_NO_REPORT_MESSAGE =
  "잠시 멈추겠습니다. 넘어지신 일을 아무에게도 알리지 않고 그대로 두는 것은, 요양보호사가 혼자 감당할 수 있는 판단이 아닙니다. 어르신이 알리지 말라고 하셔도 마찬가지입니다. 지금 하실 수 있는 것은 ①119에 연결하기 ②기관·담당 간호사에게 보이는 그대로 알리기 ③보호자께 시각과 상태를 알리기입니다. 다시 해보시겠어요?";

const CF_NO_REPORT_ALTERNATIVES = [
  "지금 119를 누릅니다.",
  "기관·담당 간호사에게 지금 상태를 그대로 알립니다.",
  "보호자께 넘어지신 시각과 지금 상태를 알립니다.",
];

export const CHK_B01: Scenario = {
  id: "CHK-B01",
  title: "괜찮아, 손 좀 줘 봐요",
  type: "EMERGENCY",
  typeLabel: "응급 초기 대응",
  level: 1,
  levelLabel: "초급",
  durationMin: 4,
  tiers: ["L1", "L2"],
  summary:
    "재가 방문 중 넘어지신 어르신 곁에서, 일으켜 드리는 대신 관찰하고 알리는 연습입니다.",
  objectives: [
    "LO-1 넘어지신 직후 의식·통증·출혈을 해석이 아닌 관찰어로 확인합니다. (SA-01, SA-05)",
    "LO-2 일으켜 세우거나 옮기지 않고, 그대로 계시도록 이유를 설명해 안내합니다. (CO-01 ⚑CF, CO-07)",
    "LO-3 혼자 판단하지 않고 119 또는 기관·담당 간호사에게 연결합니다. (CO-03 ⚑CF, SA-06, SA-07)",
    "LO-4 보호자께 확인된 사실만 전달하고, 기관 보고와 기록을 남깁니다. (CL-02, CO-04, CO-05, CL-01)",
  ],
  personas: [
    {
      role: "care_recipient",
      name: "정 어르신 (가상 인물)",
      profile:
        "여성 84세 · 골다공증 · 양쪽 무릎 관절염 · 장기요양 4등급 · 재가 방문요양 주 3회(09:30~12:30) 이용 8개월차이십니다. 인지에는 어려움이 없으시고, 남에게 폐를 끼치는 것을 가장 싫어하셔서 아프셔도 「괜찮다」고 먼저 말씀하십니다. 딸에게 걱정을 옮기지 않으려 하십니다.",
    },
    {
      role: "learner",
      name: "신규 요양보호사 (사용자 본인)",
      profile: "자격 취득 4개월 · 이 가정 배정 6주차 · 단독 방문입니다.",
    },
    {
      role: "guardian",
      name: "보호자 따님 (가상 인물)",
      profile: "직장인이시며 근무 중에도 통화가 됩니다. (돌발 변수 F-2 「보호자 전화」)",
    },
  ],
  context:
    "오전 10시 20분입니다. 부엌에서 설거지를 하던 중 욕실 쪽에서 소리가 나 나가 보니, 정 어르신이 욕실 문턱 앞 젖은 바닥에 옆으로 주저앉아 계십니다. 눈을 뜨고 계시고 말씀도 하십니다.",
  constraints: [
    "C1 단독 방문입니다 — 지금 이 집에 다른 사람이 없습니다.",
    "C2 어르신이 「괜찮다」고 하시며 손을 내밀고 재촉하십니다.",
    "C3 욕실 앞 바닥이 젖어 있어 두 번째 미끄러짐 위험이 남아 있습니다.",
    "C4 어르신을 혼자 들어 올릴 수 없고, 앱은 신체 술기를 지도하지 않습니다.",
    "C5 보호자는 근무 중이지만 통화가 되고, 기관에는 유선 보고가 됩니다.",
  ],
  gauge: {
    label: "긴장도",
    start: 2,
    max: 5,
    crisisAt: 5,
    // 위기치에 닿는 길은 두지 않았습니다 — 아래 「긴장도 배선」 주석을 함께 봐 주세요.
    // 이 값은 ⚑CF 1건으로 판정이 고정될 때 엔진이 채택하는 엔딩이기도 합니다.
    crisisEndingId: "E-재훈련",
  },
  entryTurnId: "T1",
  turns: [
    /* ── S1 낙상 인지 ─────────────────────────────────────────────── */
    {
      id: "T1",
      speaker: "elder",
      speakerName: "정 어르신",
      text: "아이고… 아이고 참. 괜찮아요, 괜찮아. 손 좀 줘 봐요, 일어나게.",
      stageDirection:
        "왼쪽 엉덩이를 손으로 짚은 채 바닥에 앉아 계십니다. 왼쪽 손목이 조금 벗겨져 있고, 바닥에는 물기가 남아 있습니다.",
      cue: {
        id: "CUE-1",
        prompt: "지금 즉시 무엇을 하시겠습니까?",
        // 응급 유형이라 대기를 줄입니다(설계서 §6.1 R-10). 초급이라 판정 CUE의 4초까지는 내리지 않습니다.
        waitSec: 6,
        // 미분류를 「하던 일을 계속함」(F1-d)에 매핑하지 않습니다 — 중립 분기로 받습니다.
        defaultBranchId: "F1-n",
        branches: [
          {
            id: "F1-a",
            label: "그대로 계시도록 안내하고 상태를 여쭤봄",
            patterns: [
              "그대로 계",
              "움직이지 마",
              "일어나지 마",
              "그 자리에",
              "어디가 아프",
              "어디 아프",
              "다치신 데",
              "다치신 곳",
              "머리 부딪",
              "제 말 들리세",
              "여쭤볼",
              "여쭤보",
            ],
            fallbackOption: "어르신, 잠깐만 그대로 계세요. 어디가 아프신지 먼저 여쭤볼게요.",
            gaugeDelta: 0,
            aiReaction: "…어어, 그냥 좀 일으켜 주면 되는데.",
            aiReactionNote: "손을 내미신 채 이쪽을 보십니다.",
            rubricHits: [
              { itemId: "SA-01", score: 4 },
              { itemId: "SA-05", score: 3 },
              { itemId: "CO-07", score: 3 },
            ],
            praise:
              "움직이시기 전에 멈춰 세우고, 어디가 아프신지부터 여쭤보셨습니다. 낙상에서는 이 순서가 먼저입니다.",
            docId: "DOC-GUIDE-004",
            next: "T2",
          },
          {
            id: "F1-b",
            label: "안심시키기만 하고 상태는 확인하지 않음",
            patterns: ["놀라셨", "많이 놀라", "괜찮으세", "괜찮으신"],
            fallbackOption: "어르신, 많이 놀라셨죠?",
            gaugeDelta: 0,
            aiReaction: "놀라긴 뭘. 어서 손이나 좀 줘요.",
            rubricHits: [{ itemId: "SA-05", score: 2 }],
            coaching:
              "안심시켜 드린 것은 좋습니다. 여기에 어디가 아프신지·움직이실 수 있는지를 한 가지만 더 여쭤봐 주세요.",
            docId: "DOC-GUIDE-004",
            next: "T2",
          },
          {
            id: "F1-c",
            label: "일으키기·옮기기·드리기 (⚑CF)",
            patterns: LIFT_PATTERNS,
            fallbackOption: "제가 부축해서 일으켜 드리겠습니다",
            gaugeDelta: 0,
            aiReaction: "아이고! 아야, 아야…",
            rubricHits: [{ itemId: "CO-01", score: 1 }],
            criticalFail: true,
            cfMessage: CF_MOVE_MESSAGE,
            cfAlternatives: CF_MOVE_ALTERNATIVES,
            docId: "DOC-GUIDE-004",
            next: "T1",
          },
          {
            id: "F1-d",
            label: "괜찮다는 말씀만 믿고 하던 일을 계속함",
            // 「그대로 두겠다」는 판정은 학습자가 실제로 그렇게 답했을 때만 내립니다.
            patterns: ["하던 일", "설거지", "청소", "괜찮다고 하시니", "괜찮으시다니", "마저"],
            fallbackOption: "괜찮다고 하시니 하던 일을 마저 하겠습니다",
            gaugeDelta: 1,
            aiReaction: "…그래, 뭐. 나는 괜찮으니까.",
            aiReactionNote: "바닥에 앉으신 채로 그대로 계십니다.",
            rubricHits: [{ itemId: "SA-01", score: 1 }],
            coaching:
              "「괜찮다」는 말씀은 상태가 아니라 마음입니다. 곁으로 가서 어디가 아프신지 먼저 확인해 주세요.",
            docId: "DOC-GUIDE-004",
            next: "T2",
          },
          {
            // 미분류(음성 인식 실패 포함) 전용 중립 분기 — 게이지 변동 0, 루브릭 반영 없음.
            id: "F1-n",
            label: "무응답·미분류",
            patterns: [],
            gaugeDelta: 0,
            aiReaction: "…뭐라고? 손 좀 줘 봐요.",
            rubricHits: [],
            coaching: UNCLEAR_COACHING,
            docId: "DOC-GUIDE-004",
            next: "T2",
          },
        ],
      },
    },

    /* ── S2 관찰 ──────────────────────────────────────────────────── */
    {
      id: "T2",
      speaker: "elder",
      speakerName: "정 어르신",
      text: "엉치가 좀 뻐근하네. 손목도 쓰라리고. 그래도 다리는 움직여요.",
      stageDirection: "왼쪽 손목이 벗겨져 피가 조금 비칩니다. 두 다리는 모두 움직이십니다.",
      cue: {
        id: "CUE-2",
        prompt: "어르신 상태를 소리 내어 관찰해 보고하세요.",
        waitSec: 8,
        // 관찰을 말했는데 신호에 걸리지 않았다고 「확인하지 않음」(F2-c)으로 찍지 않습니다.
        defaultBranchId: "F2-n",
        branches: [
          {
            id: "F2-a",
            label: "관찰어 사용 (관찰과 해석 분리)",
            patterns: [
              "의식",
              "말씀하시",
              "대답하시",
              "엉치",
              "엉덩이",
              "손목",
              "피가",
              "출혈",
              "벗겨",
              "긁힌",
              "움직이시",
              "부기",
              "부어",
              "머리",
              "10시",
            ],
            fallbackOption:
              "의식 있으시고 말씀하십니다. 왼쪽 엉치와 손목이 아프다고 하시고, 손목이 조금 벗겨져 피가 비칩니다.",
            gaugeDelta: 0,
            aiReaction: "…그러네. 피가 다 났네, 이거.",
            rubricHits: [
              { itemId: "SA-05", score: 4 },
              { itemId: "SA-01", score: 3 },
            ],
            praise:
              "해석이 아니라 보이는 그대로 말씀하셨습니다. 이 문장이 그대로 119와 기관에 전할 문장이 됩니다.",
            docId: "DOC-GUIDE-004",
            next: "T-F1",
          },
          {
            id: "F2-b",
            label: "해석만",
            patterns: ["괜찮아 보", "괜찮으신 것 같", "별일 아닌 것 같", "크게 안 다치", "멀쩡"],
            fallbackOption: "크게 안 다치신 것 같아요",
            gaugeDelta: 0,
            aiReaction: "그럼, 나 튼튼해요.",
            rubricHits: [{ itemId: "SA-05", score: 2 }],
            coaching:
              "「괜찮아 보인다」 대신 무엇이 보이는지 말씀해 주세요. 의식·통증 부위·출혈·움직임입니다.",
            docId: "DOC-GUIDE-004",
            next: "T-F1",
          },
          {
            id: "F2-c",
            label: "살펴보지 않고 넘어감",
            // 「보지 않기로 했다」는 판정도 실제로 그렇게 답했을 때만 내립니다.
            patterns: ["살펴보지 않", "확인하지 않", "굳이 보지", "물어보지 않", "여쭤보지 않"],
            fallbackOption: "굳이 살펴보지 않겠습니다",
            gaugeDelta: 0,
            aiReaction: "…어디 보긴 뭘 봐요.",
            aiReactionNote: "손목을 옷으로 가리십니다.",
            rubricHits: [{ itemId: "SA-05", score: 1 }],
            coaching:
              "보이는 것을 소리 내어 말해 두면, 나중에 기억에 기대지 않고 그대로 보고할 수 있습니다.",
            docId: "DOC-GUIDE-004",
            next: "T-F1",
          },
          {
            id: "F2-d",
            label: "일으키기·옮기기·드리기 (⚑CF)",
            patterns: LIFT_PATTERNS,
            fallbackOption: "우선 일으켜서 의자에 앉혀 드리겠습니다",
            gaugeDelta: 0,
            aiReaction: "아야! 아이고, 엉치야…",
            rubricHits: [{ itemId: "CO-01", score: 1 }],
            criticalFail: true,
            cfMessage: CF_MOVE_MESSAGE,
            cfAlternatives: CF_MOVE_ALTERNATIVES,
            docId: "DOC-GUIDE-004",
            next: "T2",
          },
          {
            id: "F2-n",
            label: "무응답·미분류",
            patterns: [],
            gaugeDelta: 0,
            aiReaction: "…뭐라고요?",
            rubricHits: [],
            coaching: UNCLEAR_COACHING,
            docId: "DOC-GUIDE-004",
            next: "T-F1",
          },
        ],
      },
    },

    /* ── 돌발 변수 F-1 「일으켜 달라는 재촉」 (알파에서는 100% 고정 발동) ── */
    {
      id: "T-F1",
      speaker: "elder",
      speakerName: "정 어르신",
      text: "그만 좀 보고 손 좀 줘요. 이러고 앉아 있으니 내가 다 민망하구먼.",
      stageDirection:
        "두 손으로 젖은 바닥을 짚고 스스로 일어서려 하십니다. 몸이 한 번 휘청하십니다.",
      isTrigger: true,
      triggerName: "F-1 일으켜 달라는 재촉",
      cue: {
        id: "CUE-3",
        prompt: "어르신이 재촉하십니다. 무엇을 하시겠습니까?",
        waitSec: 6,
        defaultBranchId: "F3-n",
        branches: [
          {
            id: "F3-a",
            label: "이유를 설명하고 그대로 계시도록 부탁 + 곁을 지킴",
            patterns: [
              "그대로 계",
              "움직이지 마",
              "일어나지 마",
              "조금만 더",
              "다치셨는지",
              "다치신 곳을 모르",
              "확인하기 전",
              "곁에 있",
              "옆에 있",
              "제가 여기",
              "담요",
              "쿠션",
              "무릎 밑",
            ],
            fallbackOption:
              "어르신, 어디를 다치셨는지 아직 몰라서요. 조금만 더 그대로 계시면 제가 곁에 있겠습니다.",
            gaugeDelta: -1,
            aiReaction: "…그럼 뭐, 그러든지.",
            aiReactionNote: "짚으셨던 손을 내리고 다시 앉으십니다.",
            rubricHits: [
              { itemId: "CO-07", score: 4 },
              { itemId: "RE-04", score: 4 },
              { itemId: "RE-07", score: 4 },
            ],
            praise:
              "왜 기다려야 하는지를 먼저 말씀드리고 곁에 남으셨습니다. 재촉을 이겨 내는 것은 힘이 아니라 설명입니다.",
            docId: "DOC-LAW-003",
            next: "T3",
          },
          {
            id: "F3-b",
            label: "안 된다고만 말함",
            patterns: ["안 돼요", "안됩니다", "일어나시면 안", "움직이시면 안", "가만히", "위험해요"],
            fallbackOption: "지금 일어나시면 안 돼요",
            gaugeDelta: 1,
            aiReaction: "왜 자꾸 못 일어나게 해요. 남도 아니고.",
            rubricHits: [
              { itemId: "CO-07", score: 2 },
              { itemId: "RE-07", score: 2 },
            ],
            coaching:
              "「안 된다」는 말만으로는 재촉이 멈추지 않습니다. 왜 기다려야 하는지를 한 문장으로 덧붙여 주세요.",
            docId: "DOC-LAW-003",
            next: "T3",
          },
          {
            id: "F3-c",
            label: "일으키기·옮기기·드리기 (⚑CF)",
            patterns: LIFT_PATTERNS,
            fallbackOption: "손을 잡아 일으켜 드리겠습니다",
            gaugeDelta: 0,
            aiReaction: "아이고! 아야… 아파, 아파.",
            rubricHits: [{ itemId: "CO-01", score: 1 }],
            criticalFail: true,
            cfMessage: CF_MOVE_MESSAGE,
            cfAlternatives: CF_MOVE_ALTERNATIVES,
            docId: "DOC-GUIDE-004",
            next: "T-F1",
          },
          {
            id: "F3-d",
            label: "약·파스로 먼저 처치하려 함 (경고 — ⚑CF 아님)",
            // ⚑CF가 아니라 경고입니다(B02 D1-f 「등을 세게 두드림」과 같은 자리) — 위험을 만드는
            // 것은 「지금 붙여 드리는 일」이 아니라 **처치 여부를 스스로 판단하는 일**이고,
            // 그 판단은 낙인이 아니라 코칭으로 되돌리는 편이 실패 허용 원칙(P1)에 맞습니다.
            //
            // 규칙 사전의 CF-MEDICATION은 「진통제를」·「약을 드리」처럼 조사가 붙은 꼴만 잡아
            // "진통제 한 알 드릴까요"·"파스 붙여 드릴게요"는 그대로 지나갑니다(rules.ts 한계 ⑦).
            // 낙상 자리에서 가장 흔한 말이라, 그 틈을 이 분기가 받습니다.
            // 「붙여」는 ⚑CF 신호 「붙잡」과 글자가 달라 서로 먹지 않습니다.
            patterns: ["파스", "찜질", "연고", "진통제", "약 좀", "약을", "한 알", "소독"],
            fallbackOption: "파스라도 하나 붙여 드리겠습니다",
            gaugeDelta: 0,
            aiReaction: "…그래요, 그거라도 하나 붙여 줘요.",
            rubricHits: [{ itemId: "CO-01", score: 2 }],
            coaching:
              "붙이거나 바르거나 문지르는 것은 다친 자리를 키울 수 있고, 필요 여부를 정하는 것은 의료인의 몫입니다. 지금은 보이는 상태를 그대로 알리는 데까지가 요양보호사의 자리입니다.",
            docId: "DOC-LAW-005",
            next: "T3",
          },
          {
            id: "F3-n",
            label: "무응답·미분류",
            patterns: [],
            gaugeDelta: 0,
            aiReaction: "…듣고 있어요? 손 좀 달라니까.",
            rubricHits: [],
            coaching: UNCLEAR_COACHING,
            docId: "DOC-GUIDE-004",
            next: "T3",
          },
        ],
      },
    },

    /* ── S4 연결 판단 ─────────────────────────────────────────────── */
    {
      id: "T3",
      speaker: "elder",
      speakerName: "정 어르신",
      text: "…그럼 어떡해요. 나 때문에 일만 커지네. 딸한테는 말하지 마요.",
      stageDirection: "젖은 바닥에 그대로 앉아 계시고, 왼손으로 엉치를 짚고 계십니다.",
      cue: {
        id: "CUE-4",
        prompt: "지금 누구에게 어떻게 알리시겠습니까?",
        waitSec: 8,
        // 미분류를 「조금 더 지켜보기」(F4-c)에 매핑하지 않습니다 — 중립 분기로 받습니다.
        defaultBranchId: "F4-n",
        branches: [
          {
            id: "F4-a",
            label: "119 연결 + 관찰 사실 전달",
            patterns: ["119", "일일구", "구급차", "구급대", "신고"],
            fallbackOption: "119에 신고하고, 지금 보이는 그대로 말씀드리겠습니다",
            // 연결이 이루어지면 판단 주체가 넘어갑니다 — 긴장도가 한 칸 내려오는 자리입니다.
            gaugeDelta: -1,
            aiReaction: "…아이고, 일이 커지네. 그래요, 그럼.",
            // CO-03은 여기서 **경과 시간**으로도 함께 판정됩니다(engine/timing.ts).
            // 이 분기를 고른 순간이 「119 연결」이고, 시계는 이 턴에 들어온 시각부터 흐릅니다.
            rubricHits: [
              { itemId: "CO-03", score: 4 },
              { itemId: "SA-06", score: 4 },
              { itemId: "SA-07", score: 4 },
            ],
            praise:
              "혼자 판단하지 않고 연결하셨습니다. 어르신이 말리셔도 알리는 쪽이 요양보호사의 자리입니다.",
            docId: "DOC-GUIDE-004",
            next: "T-F2",
          },
          {
            id: "F4-b",
            label: "기관·담당 간호사에게 알리고 판단을 구함",
            patterns: ["센터", "기관", "간호사", "관리자", "여쭤보", "판단을 여쭙"],
            fallbackOption: "센터에 전화해 지금 상태를 그대로 전하고 판단을 여쭙겠습니다",
            gaugeDelta: -1,
            aiReaction: "…선생님 마음대로 해요, 그럼.",
            rubricHits: [
              { itemId: "SA-07", score: 4 },
              { itemId: "CO-04", score: 3 },
            ],
            praise:
              "혼자 떠안지 않고 기관에 판단을 넘기셨습니다. 통증이 심해지거나 움직이지 못하시면 그다음은 119입니다.",
            docId: "DOC-NOTI-002",
            next: "T-F2",
          },
          {
            id: "F4-c",
            label: "조금 더 지켜보기로 함",
            patterns: ["조금 더 지켜보", "좀 더 지켜보", "지켜보고", "기다려 보", "이따", "나중에", "괜찮아지시면"],
            fallbackOption: "조금 더 지켜보고 나중에 알리겠습니다",
            gaugeDelta: 0,
            aiReaction: "그래요, 그게 낫지. 괜히 소란 피우지 말고.",
            // 「지켜보기」에는 CO-03을 걸지 않습니다 — 연결한 적이 없는데 시간 규칙이
            // 「연결까지 걸린 초」를 재기 시작하면, 재지 않은 값이 기록으로 남습니다.
            rubricHits: [
              { itemId: "SA-07", score: 2 },
              { itemId: "CO-04", score: 2 },
            ],
            coaching:
              "낙상은 시간이 지난 뒤에 통증이 커지는 일이 흔합니다. 지켜보시더라도 지금 기관에 한 번은 알려 주세요.",
            docId: "DOC-NOTI-002",
            next: "T-F2",
          },
          {
            id: "F4-d",
            label: "아무에게도 알리지 않기로 함 (⚑CF)",
            // 「미룬다」가 아니라 「알리지 않겠다」에만 붙입니다 — 지연은 시간이 재고,
            // 여기서 멈추는 것은 알리지 않기로 한 판단뿐입니다.
            patterns: [
              "알리지 않",
              "알리지는 않",
              "말하지 않",
              "말씀드리지 않",
              "보고하지 않",
              "신고는 안",
              "신고 안",
              "연락은 안",
              "연락 안",
              "아무한테도",
              "아무에게도",
              "혼자 두",
              "그냥 두",
              "자리를 뜨",
              "그냥 넘어가",
            ],
            fallbackOption: "따로 알리지 않고 이대로 두겠습니다",
            gaugeDelta: 0,
            aiReaction: "…그래요. 우리끼리만 알고 있읍시다.",
            rubricHits: [{ itemId: "CO-03", score: 1 }],
            criticalFail: true,
            cfMessage: CF_NO_REPORT_MESSAGE,
            cfAlternatives: CF_NO_REPORT_ALTERNATIVES,
            // CO-03의 근거는 루브릭과 같은 문서를 씁니다(신고 기준).
            docId: "DOC-GUIDE-004",
            next: "T3",
          },
          {
            id: "F4-n",
            label: "무응답·미분류",
            patterns: [],
            gaugeDelta: 0,
            aiReaction: "…뭐라고요? 딸한테는 말하지 마요.",
            rubricHits: [],
            coaching: UNCLEAR_COACHING,
            docId: "DOC-GUIDE-004",
            next: "T-F2",
          },
        ],
      },
    },

    /* ── 돌발 변수 F-2 「보호자 전화」 (알파에서는 100% 고정 발동) ────── */
    {
      id: "T-F2",
      speaker: "guardian",
      speakerName: "보호자 따님",
      text: "선생님, 어머니 오늘 어떠세요? 아침엔 괜찮으셨는데 전화를 안 받으셔서요.",
      stageDirection: "어르신은 두 걸음 떨어진 자리에 그대로 앉아 계시고, 통화가 들리십니다.",
      isTrigger: true,
      triggerName: "F-2 보호자 전화",
      cue: {
        id: "CUE-T2",
        prompt: "보호자께 어떻게 말씀드리시겠습니까?",
        waitSec: 8,
        defaultBranchId: "G-n",
        branches: [
          {
            id: "G-a",
            label: "확인된 사실과 지금 조치를 그대로 전달",
            patterns: [
              "10시",
              "미끄러",
              "넘어지",
              "화장실",
              "욕실",
              "119",
              "기관에",
              "센터에",
              "알렸",
              "확인된",
            ],
            fallbackOption:
              "오전 10시 20분 욕실 앞에서 미끄러져 앉으셨고, 의식은 있으십니다. 지금 상태를 그대로 알렸고 곁을 지키고 있습니다.",
            gaugeDelta: 0,
            aiReaction: "…네, 지금 바로 가겠습니다. 알려 주셔서 고맙습니다.",
            rubricHits: [
              { itemId: "CL-02", score: 4 },
              { itemId: "CO-04", score: 4 },
            ],
            praise:
              "시각과 보이는 상태만 전하셨습니다. 어르신의 부탁과 보호자께 알릴 의무는 다른 문제입니다.",
            docId: "DOC-NOTI-002",
            next: "T4",
          },
          {
            id: "G-b",
            label: "축소해 전달",
            patterns: ["살짝", "별일 아니", "크게 안 다치", "걱정 마시", "말씀 안 드", "놀라실까 봐"],
            fallbackOption: "크게 다치신 건 아니니 걱정 마시라고 말씀드리겠습니다",
            gaugeDelta: 0,
            aiReaction: "…그래요? 그럼 이따 퇴근하고 들를게요.",
            rubricHits: [
              { itemId: "CL-02", score: 1 },
              { itemId: "CO-04", score: 2 },
            ],
            coaching:
              "덜어서 전한 말은 나중에 사실과 어긋납니다. 보이는 것만, 시각과 함께 전해 주세요.",
            docId: "DOC-NOTI-002",
            next: "T4",
          },
          {
            id: "G-c",
            label: "사과·추정 위주",
            patterns: ["죄송", "제 잘못", "어떡하죠", "정신이 없", "큰일"],
            fallbackOption: "죄송합니다, 제가 잠깐 자리를 비운 사이에 이런 일이 생겼습니다",
            gaugeDelta: 0,
            aiReaction: "…네? 어머니 지금 어떠신데요?",
            rubricHits: [
              { itemId: "CL-02", score: 2 },
              { itemId: "CO-04", score: 3 },
            ],
            coaching:
              "책임을 가리기 전에 지금 상태부터 전해 주세요. 보호자가 먼저 알아야 하는 것은 시각과 상태입니다.",
            docId: "DOC-NOTI-002",
            next: "T4",
          },
          {
            id: "G-n",
            label: "무응답·미분류",
            patterns: [],
            gaugeDelta: 0,
            aiReaction: "…여보세요? 잘 안 들려요.",
            rubricHits: [],
            coaching: UNCLEAR_COACHING,
            docId: "DOC-NOTI-002",
            next: "T4",
          },
        ],
      },
    },

    /* ── S5 보고·기록 (기능③ 연동) ───────────────────────────────── */
    {
      id: "T4",
      speaker: "system",
      speakerName: "보고·기록",
      text: "어르신 곁을 지키며 기다리는 사이입니다. 기관 보고와 급여제공기록지 초안을 남길 차례입니다.",
      cue: {
        id: "CUE-5",
        prompt: "기관에 보고하고, 급여제공기록지 초안을 확정해 주세요.",
        waitSec: 8,
        // 상식적인 보고 문장이 신호에 걸리지 않았다고 「보고·기록 없음」(R-c)으로 찍지 않습니다.
        defaultBranchId: "R-n",
        branches: [
          {
            id: "R-a",
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
              "지금 바로 기관에 사고 보고를 드리고, 급여제공기록지 특이사항란에 넘어지신 시각과 조치를 기재하겠습니다",
            gaugeDelta: 0,
            aiReaction: "보고가 접수되었고 기록 초안이 저장되었습니다.",
            rubricHits: [
              { itemId: "CO-04", score: 4 },
              { itemId: "CO-05", score: 4 },
              { itemId: "CL-01", score: 4 },
              { itemId: "CL-03", score: 4 },
            ],
            praise: "언제·무엇을 어디에 적을지까지 정하셨습니다. 다음 근무자가 그대로 이어받습니다.",
            docId: "DOC-NOTI-002",
            next: "T5",
          },
          {
            id: "R-b",
            label: "보고를 미룸",
            patterns: ["나중에", "이따", "정리해서", "퇴근 전에", "구두로만"],
            fallbackOption: "퇴근 전에 정리해서 말씀드리겠습니다",
            gaugeDelta: 0,
            aiReaction: "보고 예정으로만 기록되었습니다.",
            rubricHits: [
              { itemId: "CO-04", score: 2 },
              { itemId: "CO-05", score: 2 },
              { itemId: "CL-03", score: 2 },
            ],
            coaching: "낙상은 당일 보고 대상입니다. 지금 한 줄이라도 남기면 기록의 시각이 살아납니다.",
            docId: "DOC-NOTI-002",
            next: "T5",
          },
          {
            id: "R-c",
            label: "보고·기록 없음",
            patterns: ["남기지 않아도", "안 남겨도", "필요 없", "기록은 안", "보고는 안"],
            fallbackOption: "따로 남기지 않아도 될 것 같습니다",
            gaugeDelta: 0,
            aiReaction: "보고와 기록이 등록되지 않았습니다.",
            rubricHits: [
              { itemId: "CO-04", score: 1 },
              { itemId: "CO-05", score: 1 },
              { itemId: "CL-01", score: 1 },
              { itemId: "CL-03", score: 1 },
            ],
            coaching: "넘어지신 일은 기관 보고와 기록지 기재 대상입니다. 기록은 나중에 나를 지킵니다.",
            docId: "DOC-NOTI-002",
            next: "T5",
          },
          {
            id: "R-n",
            label: "무응답·미분류",
            patterns: [],
            gaugeDelta: 0,
            aiReaction: "말씀이 잘 전달되지 않았습니다.",
            rubricHits: [],
            coaching: UNCLEAR_COACHING,
            docId: "DOC-NOTI-002",
            next: "T5",
          },
        ],
      },
    },
    {
      id: "T5",
      speaker: "system",
      speakerName: "보고·기록",
      text: "보고 내용을 확인했습니다. 이제 다음을 위한 제안을 남길 차례입니다.",
      cue: {
        id: "CUE-6",
        prompt: "같은 자리에서 또 넘어지지 않으시려면, 무엇을 바꿔볼 수 있을까요?",
        waitSec: 8,
        defaultBranchId: "P-n",
        branches: [
          {
            id: "P-a",
            label: "구체적 재발 방지 제안",
            patterns: [
              "미끄럼 방지",
              "매트",
              "손잡이",
              "물기",
              "바닥을 닦",
              "슬리퍼",
              "동선",
              "협의",
              "건의",
            ],
            fallbackOption:
              "욕실 앞 물기를 바로 닦고, 미끄럼 방지 매트와 손잡이를 기관과 협의해 두겠습니다",
            gaugeDelta: 0,
            aiReaction: "제안이 기록에 반영되었습니다.",
            rubricHits: [{ itemId: "CL-04", score: 4 }],
            praise: "자리와 물건이 적힌 제안입니다. 그대로 기관 협의 안건으로 옮길 수 있습니다.",
            docId: "DOC-GUIDE-001",
            next: "T6",
          },
          {
            id: "P-b",
            label: "추상적 제안",
            patterns: ["조심", "신경 쓰", "주의하", "잘 살펴", "노력하"],
            fallbackOption: "다음엔 더 조심하겠습니다",
            gaugeDelta: 0,
            aiReaction: "제안이 기록에 반영되었습니다.",
            rubricHits: [{ itemId: "CL-04", score: 2 }],
            coaching: "어디를 어떻게 바꿀지 한 가지만 정해 보세요. 자리와 물건이 적히면 제안이 됩니다.",
            docId: "DOC-GUIDE-001",
            next: "T6",
          },
          {
            id: "P-c",
            label: "제안 없음",
            patterns: ["없습니다", "모르겠", "생각 안"],
            fallbackOption: "특별히 떠오르는 것이 없습니다",
            gaugeDelta: 0,
            aiReaction: "제안 없이 기록이 마감되었습니다.",
            rubricHits: [{ itemId: "CL-04", score: 1 }],
            coaching: "물기를 닦아 두는 것 하나만 정해도 다음 방문이 달라집니다.",
            docId: "DOC-GUIDE-001",
            next: "T6",
          },
          {
            id: "P-n",
            label: "무응답·미분류",
            patterns: [],
            gaugeDelta: 0,
            aiReaction: "말씀이 잘 전달되지 않았습니다.",
            rubricHits: [],
            coaching: UNCLEAR_COACHING,
            docId: "DOC-GUIDE-001",
            next: "T6",
          },
        ],
      },
    },
    {
      id: "T6",
      speaker: "system",
      speakerName: "보고·기록",
      text: "마지막입니다. 오늘의 대응을 스스로 돌아볼 차례입니다.",
      cue: {
        id: "CUE-7",
        prompt: "오늘 내 대응에서 한 가지만 고친다면?",
        waitSec: 8,
        defaultBranchId: "S-n",
        branches: [
          {
            id: "S-a",
            label: "개선점 언어화",
            // "다음엔"·"하겠습니다"는 존댓말 종결 표지일 뿐이라 4점 신호가 될 수 없어 두지 않습니다.
            patterns: [
              "먼저 여쭙",
              "먼저 여쭤",
              "먼저 확인",
              "그대로 계시",
              "움직이지 않",
              "관찰",
              "시각을",
              "바로 알리",
              "손부터",
            ],
            fallbackOption: "다음엔 손부터 내밀지 않고, 어디가 아프신지 먼저 여쭙겠습니다",
            gaugeDelta: 0,
            aiReaction: "오늘 훈련을 마쳤습니다.",
            rubricHits: [
              { itemId: "CL-05", score: 4 },
              { itemId: "RE-09", score: 3 },
            ],
            praise: "오늘 손이 먼저 나갔던 자리를 한 문장으로 정리하셨습니다.",
            docId: "DOC-GUIDE-001",
            next: "end:E-성공",
          },
          {
            id: "S-b",
            label: "성찰이 막연함",
            patterns: ["잘 못했", "어려웠", "정신이 없", "당황", "조심하겠", "노력하겠"],
            fallbackOption: "그 순간엔 정신이 없었던 것 같습니다",
            gaugeDelta: 0,
            aiReaction: "오늘 훈련을 마쳤습니다.",
            rubricHits: [{ itemId: "CL-05", score: 2 }],
            coaching: "다음 방문에서 무엇을 먼저 하실지, 한 가지만 문장으로 정해 보세요.",
            docId: "DOC-GUIDE-001",
            next: "end:E-부분",
          },
          {
            id: "S-n",
            label: "무응답·미분류",
            patterns: [],
            gaugeDelta: 0,
            aiReaction: "오늘 훈련을 마쳤습니다.",
            rubricHits: [],
            coaching: UNCLEAR_COACHING,
            docId: "DOC-GUIDE-001",
            next: "end:E-부분",
          },
        ],
      },
    },
  ],
  triggers: [
    {
      id: "F-1",
      name: "일으켜 달라는 재촉",
      condition: "CUE-2 종료 후 (알파에서는 100% 고정 발동)",
      description:
        "어르신이 젖은 바닥을 짚고 스스로 일어서려 하시며 손을 달라고 재촉하십니다. 재촉이 커진 순간에도 일으키는 대신 그대로 계시도록 안내하는지 봅니다.",
    },
    {
      id: "F-2",
      name: "보호자 전화",
      condition: "CUE-4 종료 후 (알파에서는 100% 고정 발동)",
      description:
        "따님에게서 전화가 옵니다. 어르신이 딸에게는 말하지 말아 달라고 하신 뒤라, 확인된 사실을 시각과 함께 그대로 전하는지 봅니다.",
    },
  ],
  endings: [
    {
      id: "E-성공",
      title: "곁을 지키고, 알리고, 남기셨습니다",
      verdict: "충족",
      condition: "⚑CF 0건 · 관찰 진술 1회 이상 · 119 또는 기관 연결 · 보고·기록 확정",
      message:
        "일으켜 드리지 않는 것이 오늘의 대응이었습니다. 충족하신 원칙과 근거 출처를 확인해 주세요.",
    },
    {
      id: "E-부분",
      // 이 엔딩은 마지막 돌아보기 한 문장(CUE-7)으로만 갈립니다 — 관찰하고, 연결하고,
      // 기록까지 남기고도 여기로 옵니다. 그래서 **제목도 문구도** 세션 사실을 단정하지 않고
      // 실제 갈림 사유만 적습니다(그 판정은 아래 항목별 표시가 합니다).
      // 제목은 종료 화면 부제와 /history 회차 카드에 그대로 실리므로 같은 기준을 받습니다.
      title: "다음 방문을 위한 한 문장이 남았습니다",
      verdict: "부분 충족",
      condition: "마무리 돌아보기에서 고칠 점이 한 문장으로 정리되지 않았을 때",
      message:
        "마무리 돌아보기에서 한 문장이 남았습니다. 오늘 어디까지 닿았는지는 아래에서 확인해 주세요.",
    },
    {
      id: "E-재훈련",
      title: "여기서 한 번만 되짚고 가겠습니다",
      verdict: "재훈련",
      condition: "⚑CF 1건 이상(CO-01 또는 CO-03)",
      message:
        "넘어지신 뒤에 하지 않아야 할 일이 선택되었습니다. 대안 행동을 확인하신 뒤, 멈췄던 지점부터 다시 이어가 보시겠어요?",
    },
  ],
  /*
   * 긴장도 배선 (시작 2 · 위기치 5)
   *   ▲ 하던 일 계속(F1-d) +1 / 안 된다고만 함(F3-b) +1
   *   ▼ 그대로 계시도록 안내(F3-a) −1 / 연결 판단(F4-a·F4-b) −1
   *   상승 합은 최대 2(=4)라 위기치에 닿지 않습니다 — 보고·기록 CUE 전에 위기 엔딩으로
   *   끊기면 안 되기 때문입니다. 상승 값을 올리실 때는 이 합을 먼저 확인해 주세요.
   */
  appliedRubric: [
    "SA-01",
    "SA-05",
    "SA-06",
    "SA-07",
    "CO-01",
    "CO-03",
    "CO-04",
    "CO-05",
    "CO-07",
    "RE-04",
    "RE-07",
    "RE-09",
    "CL-01",
    "CL-02",
    "CL-03",
    "CL-04",
    "CL-05",
  ],
  // 설계서 §3.2 K 표와 같은 방식으로, 세션 중 실제로 근거 칩으로 인용되는 문서만 적습니다.
  // (DOC-LAW-005는 CUE-3의 약·파스 경고 분기가 인용합니다 — 처치 판단은 의료인의 영역입니다.)
  sourceDocs: ["DOC-GUIDE-004", "DOC-LAW-003", "DOC-LAW-005", "DOC-NOTI-002", "DOC-GUIDE-001"],
  reportCues: ["기관에 보고하고, 급여제공기록지 초안을 확정해 주세요."],
  active: true,
  reviewPending: true, // 알파 초안 — 현직 감수 완료 시 이 줄을 지우면 /train 라벨·/check 항목이 함께 내려갑니다.
};

export default CHK_B01;
