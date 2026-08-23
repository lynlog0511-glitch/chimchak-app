/**
 * CHK-A02 「새벽 두 시, 차가 나가야 한대요」 — 알파 초안(현직 감수 대기).
 *
 * 유형 ① 치매 행동심리증상(BPSD) · 난이도 중급 · 소요 약 5분 · 계층 L1+L2
 * 기능 F1 시뮬레이터 + F3 기록 코칭
 *
 * 편성 근거: 설계서 §9.1 확장 매트릭스의 「A02 야간 배회 + 보호자 부재」 칸입니다.
 * A01(오후·재가·귀가 요구)과 겹치지 않도록 **야간·시설·단독 근무**로 조건을 바꾸고,
 * 배회의 원인을 배뇨가 아니라 **통증**으로 두어 다른 탐색 경로를 훈련합니다.
 *
 * 이 시나리오가 A01에 더하는 것
 *  - 야간 단독 근무의 제약(다른 어르신 여덟 분이 주무심 · 관리자 부재)
 *  - 통증 호소 앞에서 **업무 범위 경계**(CO-01 ⚑CF — 임의 투약 대신 당직 간호사 보고)
 *  - 제3자(옆방 어르신) 앞에서 대상자의 사정을 말하지 않는 존엄·정보 보호(CO-07·CO-08)
 *
 * 판정선은 설계서 §3.3 원칙 그대로입니다 — ⚑CF는 **신체 안전·법적 금지행위**에만 둡니다.
 * (신체 자유 제한 = CO-02 / 허용 범위 밖 투약 = CO-01)
 *
 * 대사·지문은 검수된 고정 문구(앵커)이며, 경량 LLM(교체형 어댑터)이 붙더라도
 * 이 앵커에서 이탈하면 템플릿 고정 대사로 되돌립니다.
 *
 * 상태 흐름: S1 대화개시(T1/CUE-1) → [N-1 자동문] → S2 원인탐색(T2/CUE-2)
 *          → [N-3 무릎 통증 단서] → S3 통증 대응(T3/CUE-3) → [N-2 옆방 어르신]
 *          → S4 안전확보·대체행동(T4/CUE-4) → S5 보고·기록(CUE-5~7)
 *          (초조도 5 도달 시 위기 엔딩 → 재시도 1회 무벌점)
 *
 * 판정 공정성 (8/6 감사 반영)
 *  - 모든 CUE에 **중립 미분류 분기**(…-n)를 두고 defaultBranchId를 그리로 돌렸습니다.
 *    말이 신호에 걸리지 않았다는 것과 잘못 대응했다는 것은 다른 사실입니다. 감점 분기는
 *    학습자가 **실제로 그 말을 했을 때**(패턴 일치·버튼 선택)만 열립니다.
 *  - 특히 CUE-N1의 「문이 열림 → 위기 엔딩」(NA-d)은 명시적 무행동에만 붙입니다.
 *    미분류로 훈련이 끝나 버리면, 인식이 빗나간 사람에게 실패를 돌려주는 셈이 됩니다.
 */

import type { Scenario } from "@/types";

/**
 * 중립 미분류 분기의 코칭 문구 — 감점이 아니라 **다시 말할 기회**입니다.
 * 야간 단독 근무라는 조건을 그대로 담습니다(낮은 목소리는 잘 묻힙니다).
 */
const UNCLEAR_COACHING =
  "말씀이 닿지 않았습니다. 야간에는 낮은 목소리가 더 잘 묻힙니다 — 지금 하신 말씀은 판정에 넣지 않았으니, 한 문장으로 짧게 다시 말씀하시거나 아래 버튼에서 골라 주세요.";

/** CO-02 ⚑CF 인터럽트 고정 문구 — 노인복지법 제39조의9 금지행위 고지 + 대안 3개. */
const CF_RESTRAINT_MESSAGE =
  "잠시 멈추겠습니다. 붙잡거나 문을 잠가 못 나가시게 하는 것은 노인복지법 제39조의9가 금지하는 신체 자유의 제한에 해당합니다. 야간이라고 예외가 되지는 않습니다. 지금 하실 수 있는 것은 ①곁에 서서 낮은 목소리로 말 걸기 ②동의를 구한 뒤 손을 잡고 함께 걷기 ③불을 켜고 함께 할 다른 일을 제안하기입니다. 다시 해보시겠어요?";

const CF_RESTRAINT_ALTERNATIVES = [
  "\"많이 급하셨구나\" 하고 마음을 먼저 말로 알아드립니다.",
  "\"제 손 잡고 복도 한 바퀴만 같이 걸으실까요?\" 하고 동의를 구합니다.",
  "복도 등을 켜고 \"따뜻한 물 한 잔 하실까요?\" 하고 다른 일을 제안합니다.",
];

/** CO-01 ⚑CF 인터럽트 고정 문구 — 의료법 제27조 무면허 의료행위 금지 고지 + 대안 3개. */
const CF_MEDICATION_MESSAGE =
  "잠시 멈추겠습니다. 통증을 말씀하신다고 해서 요양보호사가 약을 골라 드리는 것은 의료법 제27조가 금지하는 무면허 의료행위에 해당합니다. 지금 하실 수 있는 것은 ①언제부터 어떻게 아프신지 여쭤보기 ②보이는 상태를 그대로 적어 두기 ③당직 간호사에게 알리기입니다. 다시 해보시겠어요?";

const CF_MEDICATION_ALTERNATIVES = [
  "\"언제부터 아프셨어요?\" 하고 통증을 여쭤봅니다.",
  "보이는 상태를 그대로 기록에 적어 둡니다.",
  "당직 간호사 선생님께 지금 상태를 그대로 알립니다.",
];

/**
 * CO-02 ⚑CF 판정 신호 (신체 억제·문 잠금·억제대).
 *
 * 규칙 사전 `rules.ts`의 `RESTRAINT_RULES.terms`와 같은 기준입니다 — 한국어는 음절 블록
 * 단위라 "문을 잠그"는 "문을 잠급니다"의 부분 문자열이 아니므로 **어간까지만** 남깁니다.
 * 시설 야간 상황이라 억제대·묶기 계열을 함께 둡니다(사전에도 같은 항목이 있습니다).
 */
const RESTRAINT_PATTERNS = [
  "붙잡",
  "붙들",
  "손목을 잡",
  "팔을 잡",
  "몸으로 막",
  "막아서",
  "막고 서",
  "앞을 막",
  "현관을 막",
  "못 나가게 막",
  "문 잠",
  "문을 잠",
  "자동문을 잠",
  "도어락을 잠",
  "도어락 잠",
  "잠가",
  "잠갔",
  "잠급",
  "잠글",
  "잠금",
  "끌고",
  "끌어",
  "잡아끌",
  "밀어",
  "당겨서",
  "억제대",
  "묶어",
  "묶고",
  "결박",
  "끈으로 고정",
  "보호대로 고정",
  "가둬",
  "가두",
];

/**
 * CO-01 ⚑CF 판정 신호 (임의 투약).
 * 규칙 사전 `rules.ts`의 `CF-MEDICATION`·`CF-DOSE` 용어를 어간 기준으로 넓힌 것입니다.
 */
const MEDICATION_PATTERNS = [
  "약을 드리",
  "약을 먹이",
  "약 좀 드",
  "약 좀 챙겨",
  "약을 챙겨 드",
  "진통제",
  "해열제",
  "소염제",
  "파스를 붙",
  "연고를 바르",
  "상비약",
  "두 알 드리",
];

export const CHK_A02: Scenario = {
  id: "CHK-A02",
  title: "새벽 두 시, 차가 나가야 한대요",
  type: "BPSD",
  typeLabel: "치매 행동심리증상(BPSD)",
  level: 2,
  levelLabel: "중급",
  durationMin: 5,
  tiers: ["L1", "L2"],
  summary:
    "야간 단독 근무 중 현관 앞에 서 계신 어르신께, 다른 분들을 깨우지 않고 원인부터 확인하는 연습입니다.",
  objectives: [
    "LO-1 야간 배회를 제지하기 전에 정서를 언어로 먼저 인정합니다. (RE-01, RE-02)",
    "LO-2 배회의 원인으로 통증·배뇨·환경을 각 1개 이상 확인합니다. (SA-02, SA-03)",
    "LO-3 통증 앞에서 업무 범위를 지키고 당직 간호사에게 이양합니다. (CO-01 ⚑CF, SA-07)",
    "LO-4 신체 억제 없이 안전을 확보하고, 제3자 앞에서 대상자의 사정을 말하지 않습니다. (CO-02 ⚑CF, CO-07, CO-08)",
    "LO-5 야간 근무 일지와 기관 보고를 사실 중심으로 남깁니다. (CO-04, CO-05, CL-01, CL-02)",
  ],
  personas: [
    {
      role: "care_recipient",
      name: "최 어르신 (가상 인물)",
      profile:
        "남성 78세 · 혈관성 치매 중등도 · 장기요양 3등급 · 노인요양공동생활가정 입소 5주차입니다. 30년간 버스 회사에서 정비 일을 하셨고 새벽 출근이 몸에 배어 있으십니다. 새벽 1~3시에 옷을 갖춰 입고 현관 쪽으로 나오시는 일이 주 2~3회 반복됩니다. 왼쪽 무릎이 약해 지팡이를 쓰시고, 서두르시면 발이 엉키십니다. 큰 소리로 부르면 더 서두르십니다.",
    },
    {
      role: "learner",
      name: "야간 근무 요양보호사 (사용자 본인)",
      profile:
        "자격 취득 5개월 · 야간 단독 근무 2주차입니다. 같은 층에 다른 어르신 여덟 분이 주무십니다.",
    },
    {
      role: "guardian",
      name: "보호자 아드님 (가상 인물)",
      profile: "지방 출장 중이시며 새벽에는 전화를 받지 않으십니다. 현재 연락이 닿지 않습니다.",
    },
  ],
  context:
    "새벽 2시 10분입니다. 복도에서 인기척이 나 나가 보니, 최 어르신이 외투를 입고 지팡이를 짚은 채 현관 자동문 앞에 서 계십니다. 신발장 문이 열려 있고, 다른 어르신 여덟 분은 주무시는 중입니다.",
  constraints: [
    "C1 야간 단독 근무입니다 — 지금 이 층에 다른 직원이 없습니다.",
    "C2 다른 어르신 여덟 분이 주무십니다 — 큰 소리는 그분들을 깨웁니다.",
    "C3 보호자가 출장 중이어서 새벽 통화가 되지 않습니다.",
    "C4 신체 억제·억제대·현관 잠금이 금지됩니다 (노인복지법상 금지행위 소지).",
    "C5 당직 간호사에게는 유선으로 보고할 수 있고, 시설장은 아침에 출근하십니다.",
  ],
  gauge: {
    label: "초조도",
    start: 2,
    max: 5,
    crisisAt: 5,
    crisisEndingId: "E-위기",
  },
  entryTurnId: "T1",
  turns: [
    /* ── S1 대화 개시 ─────────────────────────────────────────────── */
    {
      id: "T1",
      speaker: "elder",
      speakerName: "최 어르신",
      text: "지금 몇 신데… 나 늦었어. 차 나가야 돼.",
      stageDirection: "외투 단추를 잠그시며 현관 자동문 쪽을 보고 계십니다.",
      cue: {
        id: "CUE-1",
        prompt: "첫 응답 — 무엇이라고 말하시겠습니까?",
        waitSec: 8,
        // 미분류(음성 인식 실패 포함)는 중립 분기로 받습니다 — 「회피」로 찍지 않습니다.
        defaultBranchId: "D1-n",
        branches: [
          {
            id: "D1-c",
            label: "감정 인정형",
            patterns: [
              "늦으셨",
              "급하시",
              "걱정되시",
              "책임감",
              "차 나가야",
              "오래 하셨",
              "성실하",
              "마음이",
              "그러시구나",
              "그러셨구나",
              "챙기셔야",
              "일 생각",
              "빠지면 안 되시",
            ],
            fallbackOption: "차 나가야 한다는 생각에 마음이 급하시겠어요",
            gaugeDelta: -1,
            aiReaction: "그럼. 내가 빠지면 첫차가 못 나가.",
            aiReactionNote: "자동문 앞에서 한 걸음 물러서십니다.",
            rubricHits: [
              { itemId: "RE-01", score: 4 },
              { itemId: "RE-02", score: 4 },
            ],
            praise: "일에 대한 마음을 먼저 알아주셨습니다. 새벽에도 이 순서가 먼저입니다.",
            docId: "DOC-GUIDE-001",
            next: "T2",
          },
          {
            id: "D1-a",
            label: "사실 반박형",
            patterns: [
              "지금 새벽",
              "새벽 두 시",
              "한밤중",
              "밤이에요",
              "퇴직하셨",
              "회사 그만",
              "일 안 하시",
              "여기가 회사",
              "여기는 요양",
              "차 없어요",
              "그런 회사 없",
              "착각하시",
              "기억이 안 나셔서",
              "다 지난 일",
            ],
            fallbackOption: "어르신, 지금 새벽 두 시예요",
            gaugeDelta: 2,
            aiReaction: "내가 시계도 못 봐? 비켜요.",
            aiReactionNote: "목소리가 커지십니다.",
            rubricHits: [{ itemId: "RE-02", score: 1 }],
            coaching:
              "사실을 바로잡기 전에 마음을 먼저 인정해 주세요. 새벽에는 현실 직면이 더 크게 옵니다.",
            docId: "DOC-GUIDE-001",
            next: "T-N1",
          },
          {
            id: "D1-b",
            label: "지시·제지형",
            patterns: [
              "들어가세요",
              "방으로 가세요",
              "안 돼요",
              "안됩니다",
              "주무셔야",
              "가만히",
              "나가시면 안",
              "기다리세요",
              "그러지 마세요",
              "하지 마세요",
            ],
            fallbackOption: "어르신, 방으로 들어가세요",
            gaugeDelta: 2,
            aiReaction: "왜 자꾸 못 가게 해요.",
            rubricHits: [
              { itemId: "RE-03", score: 1 },
              { itemId: "CO-02", score: 3 },
            ],
            praise: "새벽에도 어르신 몸에 손을 대지 않으신 선은 지켜졌습니다.",
            coaching: "지시형 대신, 이 시각에 드릴 수 있는 선택지를 두 개만 놓아 보세요.",
            docId: "DOC-GUIDE-001",
            next: "T-N1",
          },
          {
            id: "D1-b-CF",
            label: "지시·제지형 — 신체 접촉·문 잠금 (⚑CF)",
            patterns: RESTRAINT_PATTERNS,
            gaugeDelta: 0,
            aiReaction: "이거 놔! 놓으라니까!",
            aiReactionNote: "지팡이를 짚은 채 몸을 뒤로 빼십니다.",
            rubricHits: [{ itemId: "CO-02", score: 1 }],
            criticalFail: true,
            cfMessage: CF_RESTRAINT_MESSAGE,
            cfAlternatives: CF_RESTRAINT_ALTERNATIVES,
            docId: "DOC-LAW-003",
            next: "T1",
          },
          {
            id: "D1-d",
            label: "회피 — 모른다고 답함",
            // 이제 이 분기는 학습자가 **실제로 그렇게 말했을 때만** 열립니다
            // (무응답·미분류는 아래 D1-n이 받습니다).
            patterns: ["글쎄요", "모르겠", "저도 잘"],
            fallbackOption: "글쎄요, 저도 잘 모르겠습니다",
            gaugeDelta: 1,
            aiReaction: "…비켜 봐요, 늦는다니까.",
            aiReactionNote: "자동문 버튼 쪽으로 손을 뻗으십니다. 돌발 변수 N-1이 앞당겨 발동합니다.",
            rubricHits: [{ itemId: "RE-01", score: 1 }],
            coaching: "말이 막히면 짧게라도 마음을 먼저 되돌려 주세요.",
            docId: "DOC-GUIDE-001",
            triggerId: "N-1",
            next: "T-N1",
          },
          {
            // 미분류 전용 중립 분기 — 게이지 변동 0, 루브릭 반영 없음.
            id: "D1-n",
            label: "무응답·미분류",
            patterns: [],
            gaugeDelta: 0,
            aiReaction: "…뭐? 안 들려요.",
            rubricHits: [],
            coaching: UNCLEAR_COACHING,
            docId: "DOC-GUIDE-001",
            next: "T-N1",
          },
        ],
      },
    },

    /* ── 돌발 변수 N-1 「자동문 버튼」 ─────────────────────────────── */
    {
      id: "T-N1",
      speaker: "system",
      speakerName: "돌발 변수 N-1 「자동문 버튼」",
      text: "어르신이 현관 자동문 개방 버튼에 손을 올리십니다. 문이 열리면 경보가 울려 주무시는 분들이 모두 깨십니다.",
      stageDirection: "복도 등이 하나만 켜져 있고, 어르신 손이 버튼 위에 그대로 있습니다.",
      isTrigger: true,
      triggerName: "N-1 자동문 버튼",
      cue: {
        id: "CUE-N1",
        prompt: "지금 무엇을 하시겠습니까?",
        waitSec: 6,
        // 미분류로 문이 열리지는 않습니다 — 위기 엔딩(NA-d)은 명시적 무행동에만 붙습니다.
        defaultBranchId: "NA-n",
        branches: [
          {
            id: "NA-a",
            label: "대체 행동 유도 (동의를 구하고 함께 움직임)",
            patterns: [
              "같이 가실까요",
              "같이 나가",
              "손 잡고",
              "제 손 잡",
              "함께 가",
              "같이 가요",
              "외투",
              "겉옷",
              "신발",
              "제가 모셔다",
              "같이 준비",
              "차 시간",
              "시간표",
              "따뜻한 물",
              "같이 앉",
              "사무실",
            ],
            fallbackOption: "어르신, 저랑 같이 나가요. 신발부터 같이 신으실까요?",
            gaugeDelta: -1,
            aiReaction: "…그럼 같이 나갑시다.",
            aiReactionNote: "버튼에서 손을 떼고 몸을 돌리십니다.",
            rubricHits: [
              { itemId: "SA-01", score: 4 },
              { itemId: "SA-04", score: 4 },
              { itemId: "RE-04", score: 4 },
              { itemId: "RE-07", score: 4 },
              { itemId: "CO-02", score: 4 },
            ],
            praise:
              "현관 앞에서 붙잡는 대신 함께 움직이는 쪽을 고르셨습니다. 경보도, 주무시는 여덟 분도 그대로입니다.",
            docId: "DOC-GUIDE-001",
            next: "T2",
          },
          {
            id: "NA-c",
            label: "큰 소리로 제지",
            patterns: ["안 돼요", "누르지 마", "그만", "멈추세요", "하지 마세요", "위험해요"],
            fallbackOption: "어르신, 그 버튼 누르시면 안 돼요!",
            gaugeDelta: 1,
            aiReaction: "왜 소리를 질러! 사람들 다 깨겠네!",
            aiReactionNote: "옆방에 불이 켜집니다.",
            rubricHits: [
              { itemId: "RE-07", score: 2 },
              { itemId: "RE-08", score: 1 },
            ],
            coaching: "낮은 톤으로 한 문장씩 말씀해 주세요. 야간에는 소리가 더 크게 옵니다.",
            docId: "DOC-GUIDE-001",
            next: "T2",
          },
          {
            id: "NA-b",
            label: "신체 억제·문 잠금 (⚑CF)",
            patterns: RESTRAINT_PATTERNS,
            fallbackOption: "몸으로 문을 막고 자동문을 잠급니다",
            gaugeDelta: 0,
            aiReaction: "놓으세요! 이거 왜 이래요!",
            rubricHits: [{ itemId: "CO-02", score: 1 }],
            criticalFail: true,
            cfMessage: CF_RESTRAINT_MESSAGE,
            cfAlternatives: CF_RESTRAINT_ALTERNATIVES,
            docId: "DOC-LAW-003",
            next: "T-N1",
          },
          {
            id: "NA-d",
            label: "아무것도 하지 않음 — 문이 열림",
            // 「그대로 두겠다」는 판정은 학습자가 실제로 그렇게 답했을 때만 내립니다.
            // (미분류가 여기로 떨어지면, 인식이 빗나간 사람에게 위기 엔딩을 돌려주게 됩니다.)
            // 홑낱말 "가만히"는 제지 발화("가만히 계세요")까지 삼키므로 어간을 좁힙니다(A01 TA-d와 같은 교정).
            patterns: ["아무것도", "아무 것도", "지켜보", "가만히 있", "가만히 둡", "그냥 두", "그대로 둡", "손 놓"],
            fallbackOption: "아무것도 하지 않고 지켜봅니다",
            gaugeDelta: 2,
            aiReaction: "…나 갔다 오리다.",
            aiReactionNote: "자동문이 열리고 경보가 울립니다. 어르신이 현관 밖으로 나가십니다.",
            rubricHits: [
              { itemId: "RE-09", score: 1 },
              { itemId: "SA-01", score: 1 },
            ],
            coaching: "자동문이 열리기 전에, 함께 할 다른 일을 하나 먼저 놓아 주세요.",
            docId: "DOC-GUIDE-001",
            next: "end:E-위기",
          },
          {
            id: "NA-n",
            label: "무응답·미분류",
            patterns: [],
            gaugeDelta: 0,
            aiReaction: "…뭐? 안 들려요.",
            aiReactionNote: "버튼 위에 손을 얹은 채 이쪽을 보십니다.",
            rubricHits: [],
            coaching: UNCLEAR_COACHING,
            docId: "DOC-GUIDE-001",
            next: "T2",
          },
        ],
      },
    },

    /* ── S2 원인 탐색 ─────────────────────────────────────────────── */
    {
      id: "T2",
      speaker: "elder",
      speakerName: "최 어르신",
      text: "…그러니까 나 좀 내보내 줘요. 늦었다니까.",
      cue: {
        id: "CUE-2",
        prompt: "이제 무엇을 확인하시겠습니까?",
        waitSec: 8,
        // 미분류를 감점 분기에 매핑하지 않습니다 — 중립 분기로 받습니다.
        defaultBranchId: "D2-n",
        branches: [
          {
            id: "D2-a",
            label: "미충족 욕구 탐색",
            patterns: [
              "화장실",
              "소변",
              "볼일",
              "잠이 안",
              "못 주무",
              "깨셨",
              "목마르",
              "물 드시",
              "어디 불편",
              "불편하신 데",
              "아프신 데",
              "통증",
              "무릎",
              "시장하",
              "고프시",
              "배가 고프",
              "춥지",
            ],
            fallbackOption: "나가시기 전에 화장실 한번 다녀오실래요?",
            gaugeDelta: -1,
            aiReaction: "…아니, 그게 아니라 무릎이 쑤셔.",
            aiReactionNote: "돌발 변수 N-3이 발동합니다. 새벽 각성의 원인이 통증이었음이 드러납니다.",
            rubricHits: [
              { itemId: "SA-02", score: 4 },
              { itemId: "SA-08", score: 3 },
            ],
            praise: "원인을 먼저 확인하셨습니다. 탐색이 오늘 밤의 나머지를 바꿉니다.",
            docId: "DOC-GUIDE-001",
            triggerId: "N-3",
            next: "T-N3",
          },
          {
            id: "D2-b",
            label: "환경 요인 확인",
            patterns: [
              "불이 어두",
              "어두워서",
              "복도 등",
              "불 켜",
              "조명",
              "컴컴",
              "추워서",
              "온도",
              "시끄러",
              "소리가 커서",
              "커튼",
              "창문",
            ],
            fallbackOption: "복도가 어두워서 새벽인 줄 모르셨나 봐요, 등 하나만 켜드릴게요",
            gaugeDelta: -1,
            aiReaction: "…허, 아직 캄캄하네.",
            rubricHits: [{ itemId: "SA-03", score: 4 }],
            praise: "복도 조도라는 환경 요인을 확인하고 그 자리에서 조정하셨습니다.",
            docId: "DOC-GUIDE-001",
            next: "T3",
          },
          {
            id: "D2-c",
            label: "선택권 제공",
            patterns: [
              "아니면",
              "둘 중에",
              "어떤 게 좋으",
              "고르시",
              "물 한 잔",
              "드시고 같이",
              "하실래요",
              "해볼까요",
            ],
            fallbackOption: "지금 바로 나가실래요, 아니면 따뜻한 물 한 잔 드시고 같이 나가볼까요?",
            gaugeDelta: -1,
            aiReaction: "…그럼 물이나 한 잔 주고.",
            rubricHits: [{ itemId: "RE-03", score: 4 }],
            praise: "지시 대신, 새벽에도 고르실 수 있는 선택지 두 개를 놓아 드렸습니다.",
            docId: "DOC-GUIDE-001",
            next: "T3",
          },
          {
            id: "D2-d",
            label: "논리적 설득",
            patterns: [
              "지금 나가면",
              "밖에 추워",
              "위험해요",
              "감기 걸리",
              "어두워서 안",
              "차가 다녀",
              "말 들으세요",
              "아무도 없어요",
            ],
            fallbackOption: "지금 나가시면 위험해요",
            gaugeDelta: 1,
            aiReaction: "내가 애야? 밤길도 못 다녀?",
            rubricHits: [{ itemId: "RE-02", score: 2 }],
            coaching: "설명으로 이기려 하기보다, 무엇이 불편하신지 먼저 여쭤 주세요.",
            docId: "DOC-GUIDE-001",
            next: "T3",
          },
          {
            // 미분류(음성 인식 실패 포함) 전용 중립 분기 — 게이지 변동 0, 루브릭 반영 없음.
            id: "D2-n",
            label: "무응답·미분류",
            patterns: [],
            gaugeDelta: 0,
            aiReaction: "…뭐? 안 들려요.",
            rubricHits: [],
            coaching: UNCLEAR_COACHING,
            docId: "DOC-GUIDE-001",
            next: "T3",
          },
        ],
      },
    },

    /* ── 돌발 변수 N-3 「무릎 통증 단서」 (D2-a 수행 시에만 노출) ────── */
    {
      id: "T-N3",
      speaker: "system",
      speakerName: "돌발 변수 N-3 「무릎 통증 단서」",
      text: "어르신이 왼쪽 무릎을 손으로 누르고 계십니다. 새벽에 깨신 까닭이 통증이었다는 단서가 먼저 드러납니다.",
      stageDirection: "지팡이를 벽에 기대 두고, 무릎을 두어 번 문지르십니다.",
      isTrigger: true,
      triggerName: "N-3 무릎 통증 단서",
      autoNext: "T3",
    },

    /* ── S3 통증 대응 (업무 범위 경계) ────────────────────────────── */
    {
      id: "T3",
      speaker: "elder",
      speakerName: "최 어르신",
      text: "아이고… 무릎이 쑤셔서 잠이 깼어. 이럴 땐 나가서 걸어야 풀려.",
      stageDirection: "지팡이에 몸을 기대신 채 말씀하십니다.",
      cue: {
        id: "CUE-3",
        prompt: "통증을 말씀하십니다. 무엇을 하시겠습니까?",
        waitSec: 8,
        // 「아프시겠어요」 같은 공감 발화가 미분류로 흘러 '재우려 함'(P3-d)에 찍히던 자리입니다.
        defaultBranchId: "P3-n",
        branches: [
          {
            id: "P3-a",
            label: "통증 확인 + 당직 간호사 보고 (허용 범위 안)",
            patterns: [
              "언제부터",
              "어디가 아프",
              "얼마나",
              "붓기",
              "부었",
              "간호",
              "당직",
              "여쭤보",
              "지금 상태",
              "그대로 전달",
              "그대로 알리",
            ],
            fallbackOption:
              "무릎이 언제부터 아프셨는지 여쭤보고, 당직 간호사 선생님께 지금 상태를 그대로 알리겠습니다",
            gaugeDelta: -1,
            aiReaction: "…그래 줄래요? 어제저녁부터 그랬어.",
            rubricHits: [
              { itemId: "SA-07", score: 4 },
              { itemId: "CO-01", score: 4 },
              { itemId: "SA-02", score: 4 },
            ],
            praise:
              "제가 할 수 있는 것과 없는 것을 나누셨습니다. 확인하고 알리는 것까지가 요양보호사의 자리입니다.",
            docId: "DOC-LAW-005",
            next: "T-N2",
          },
          {
            id: "P3-b",
            label: "통증에 공감하며 곁에 머무르고 편한 자세로 안내",
            // 공감 표현을 신호로 넣습니다. "많이 아프셨겠어요"가 어디에도 걸리지 않아
            // '재우려 함'(P3-d)으로 떨어지면, 옳게 말한 사람이 벌을 받습니다.
            patterns: [
              "아프셨겠",
              "아프시겠",
              "많이 아프",
              "얼마나 아프",
              "쑤시셨겠",
              "쑤시시겠",
              "힘드셨겠",
              "불편하셨겠",
              "고생 많으",
              "많이 편찮",
              "담요",
              "편한 자세",
              "앉으셔서",
              "앉으시게",
              "곁에",
              "옆에 있",
              "잠깐 앉",
              "소파",
              "의자",
            ],
            fallbackOption: "저기 의자에 잠깐 앉으실까요? 제가 곁에 있을게요",
            gaugeDelta: -1,
            aiReaction: "…그럼 잠깐만 앉지.",
            rubricHits: [
              { itemId: "RE-04", score: 3 },
              { itemId: "CO-07", score: 3 },
            ],
            praise:
              "아프다는 말씀을 그냥 지나치지 않고 곁에 머무르셨습니다. 여기에 언제부터 아프셨는지 여쭙고 당직 간호사께 알리는 것까지 더하면 완성됩니다.",
            docId: "DOC-GUIDE-001",
            next: "T-N2",
          },
          {
            id: "P3-c",
            label: "임의 투약 (⚑CF)",
            patterns: MEDICATION_PATTERNS,
            fallbackOption: "상비약에서 진통제 한 알 챙겨 드리겠습니다",
            gaugeDelta: 0,
            aiReaction: "…그럼 그거라도 하나 줘 봐.",
            rubricHits: [{ itemId: "CO-01", score: 1 }],
            criticalFail: true,
            cfMessage: CF_MEDICATION_MESSAGE,
            cfAlternatives: CF_MEDICATION_ALTERNATIVES,
            docId: "DOC-LAW-005",
            next: "T3",
          },
          {
            id: "P3-d",
            label: "통증 진술을 넘기고 재우려 함",
            patterns: ["주무세요", "참으시", "아침에", "내일", "별거 아니", "괜찮아지", "원래"],
            fallbackOption: "그냥 들어가서 주무세요",
            gaugeDelta: 1,
            aiReaction: "…아파서 못 자겠다니까.",
            rubricHits: [
              { itemId: "SA-02", score: 1 },
              { itemId: "RE-01", score: 1 },
            ],
            coaching:
              "통증은 야간 배회의 흔한 원인입니다. 언제부터 어떻게 아프신지 여쭙고 당직 간호사께 알려 주세요.",
            docId: "DOC-GUIDE-001",
            next: "T-N2",
          },
          {
            id: "P3-n",
            label: "무응답·미분류",
            patterns: [],
            gaugeDelta: 0,
            aiReaction: "…뭐? 안 들려요.",
            rubricHits: [],
            coaching: UNCLEAR_COACHING,
            docId: "DOC-GUIDE-001",
            next: "T-N2",
          },
        ],
      },
    },

    /* ── 돌발 변수 N-2 「옆방 어르신」 ─────────────────────────────── */
    {
      id: "T-N2",
      speaker: "system",
      speakerName: "돌발 변수 N-2 「옆방 어르신」",
      text: "옆방 어르신이 문을 열고 복도를 내다보시며 무슨 일이냐고 물으십니다.",
      stageDirection: "최 어르신은 두 걸음 떨어진 곳에서 이쪽을 보고 계십니다.",
      isTrigger: true,
      triggerName: "N-2 옆방 어르신",
      cue: {
        id: "CUE-N2",
        prompt: "옆방 어르신이 내다보십니다. 어떻게 하시겠습니까?",
        waitSec: 6,
        defaultBranchId: "M-n",
        branches: [
          {
            id: "M-a",
            label: "짧게 안심시키고 방으로 안내 (정보 노출 없음)",
            patterns: [
              "아무 일 없어요",
              "괜찮아요",
              "편히 주무",
              "제가 있으니",
              "곧 조용",
              "들어가서 쉬",
            ],
            fallbackOption: "아무 일 없어요. 제가 곁에 있으니 편히 주무세요.",
            gaugeDelta: -1,
            aiReaction: "…괜히 시끄럽게 했네.",
            rubricHits: [
              { itemId: "CO-08", score: 4 },
              { itemId: "CO-07", score: 4 },
              { itemId: "SA-04", score: 3 },
            ],
            praise:
              "다른 어르신께 사정을 설명하지 않고 안심만 드렸습니다. 어르신의 일은 그 자리에서 말하지 않는 것이 존엄을 지키는 길입니다.",
            docId: "DOC-LAW-003",
            next: "T4",
          },
          {
            id: "M-b",
            label: "다른 어르신께 상황을 그대로 설명",
            patterns: [
              "최 어르신이",
              "저 어르신이",
              "또 나가시려고",
              "치매라서",
              "밤마다",
              "배회",
              "무릎이 아프시대",
            ],
            fallbackOption: "최 어르신이 또 나가시려고 해서요",
            gaugeDelta: 0,
            aiReaction: "…내 얘기를 왜 저 사람한테 해.",
            aiReactionNote: "최 어르신이 고개를 돌리십니다.",
            rubricHits: [
              { itemId: "CO-08", score: 1 },
              { itemId: "CO-07", score: 2 },
            ],
            coaching:
              "다른 어르신께 대상자의 상태를 설명하지 않습니다. 사실은 기록과 보고로 남기면 됩니다.",
            docId: "DOC-LAW-003",
            next: "T4",
          },
          {
            id: "M-c",
            label: "큰 소리로 응대",
            patterns: ["들어가세요", "나오지 마", "주무시라니까", "시끄러"],
            fallbackOption: "들어가세요, 별일 아니에요!",
            gaugeDelta: 1,
            aiReaction: "…다들 깼잖아. 나 그냥 갈래.",
            rubricHits: [
              { itemId: "RE-08", score: 1 },
              { itemId: "CO-07", score: 2 },
            ],
            coaching: "낮은 톤으로 짧게 답해 드리면 두 분 모두 덜 놀라십니다.",
            docId: "DOC-LAW-003",
            next: "T4",
          },
          {
            id: "M-d",
            label: "대답하지 않고 그대로 둠",
            // 「대답하지 않기로 했다」는 판정도 실제로 그렇게 답했을 때만 내립니다.
            patterns: ["대답 없이", "대답하지 않", "못 들은 척", "무시하", "그냥 두", "그대로 둡"],
            fallbackOption: "아무 대답 없이 그대로 둡니다",
            gaugeDelta: 1,
            aiReaction: "…나 때문에 다 깼구먼.",
            aiReactionNote: "복도에 서 계신 분이 늘고, 최 어르신이 더 서두르십니다.",
            rubricHits: [{ itemId: "SA-04", score: 2 }],
            coaching: "부르셨을 때 짧게라도 대답해 드리면 복도가 조용해집니다.",
            docId: "DOC-LAW-003",
            next: "T4",
          },
          {
            id: "M-n",
            label: "무응답·미분류",
            patterns: [],
            gaugeDelta: 0,
            aiReaction: "…뭐? 안 들려요.",
            rubricHits: [],
            coaching: UNCLEAR_COACHING,
            docId: "DOC-LAW-003",
            next: "T4",
          },
        ],
      },
    },

    /* ── S4 안전 확보·대체 행동 ───────────────────────────────────── */
    {
      id: "T4",
      speaker: "elder",
      speakerName: "최 어르신",
      text: "…그럼 어떡해. 나 계속 여기 서 있어?",
      cue: {
        id: "CUE-4",
        prompt: "안전한 대체 행동으로 유도하세요.",
        waitSec: 8,
        defaultBranchId: "S4-n",
        branches: [
          {
            id: "S4-a",
            label: "동행 유도 + 손 잡기 동의 구함",
            patterns: [
              "손 잡고 같이",
              "제 손 잡",
              "손 잡아도 될까요",
              "손 잡아 드릴까요",
              "같이 걸으실까요",
              "같이 걸어",
              "복도 한 바퀴",
              "같이 들어가실까요",
              "제가 같이",
              "함께 가실까요",
            ],
            fallbackOption: "제 손 잡고 복도 한 바퀴만 같이 걸으실까요?",
            gaugeDelta: -2,
            aiReaction: "…그래. 같이 좀 걸읍시다.",
            aiReactionNote: "지팡이를 고쳐 짚고 나란히 걸으십니다.",
            rubricHits: [
              { itemId: "RE-04", score: 4 },
              { itemId: "CO-07", score: 4 },
              { itemId: "RE-09", score: 4 },
            ],
            praise:
              "동의를 먼저 구하고 나란히 걸으셨습니다. 억제 없이, 주무시는 분들을 깨우지 않고 안전을 확보한 대응입니다.",
            docId: "DOC-GUIDE-001",
            next: "T5",
          },
          {
            id: "S4-b",
            label: "대체 활동 제시",
            patterns: [
              "따뜻한 물",
              "차 한 잔",
              "라디오",
              "사진",
              "앉아서 이야기",
              "같이 앉",
              "이야기 좀",
              "신문",
            ],
            fallbackOption: "따뜻한 물 한 잔 하면서 잠깐 앉아 계실까요?",
            gaugeDelta: -1,
            aiReaction: "…그럼 물 한 잔만 하고.",
            aiReactionNote: "현관에서 거실 쪽으로 몸을 돌리십니다.",
            rubricHits: [
              { itemId: "RE-04", score: 3 },
              { itemId: "RE-09", score: 3 },
            ],
            praise: "현관에서 거실로, 안전한 다른 일 하나로 주의를 옮기셨습니다.",
            docId: "DOC-GUIDE-001",
            next: "T5",
          },
          {
            id: "S4-c",
            label: "그냥 기다림",
            // "기다리"는 "기다립니다"의 부분 문자열이 아닙니다(음절 블록) — 어간까지만 남깁니다.
            patterns: ["기다", "지켜보", "가만히 있", "아무 말 없이", "말없이"],
            fallbackOption: "말없이 옆에서 기다립니다",
            gaugeDelta: 0,
            aiReaction: "…뭘 그렇게 보고만 있어.",
            rubricHits: [{ itemId: "RE-04", score: 2 }],
            coaching:
              "기다리기만 하면 어르신은 현관 앞에 그대로 서 계십니다. 함께 할 일을 하나 놓아 주세요.",
            docId: "DOC-GUIDE-001",
            next: "T5",
          },
          {
            id: "S4-d",
            label: "밀거나 끌기 (⚑CF)",
            patterns: [
              "밀어",
              "밀고",
              "끌고",
              "끌어",
              "잡아끌",
              "당겨서",
              "억지로 끌",
              "억지로 데",
              "억지로 옮",
              "안아서 옮",
            ],
            fallbackOption: "팔을 잡아 방 쪽으로 끌어당깁니다",
            gaugeDelta: 0,
            aiReaction: "아이고! 놔요, 넘어져!",
            rubricHits: [{ itemId: "CO-02", score: 1 }],
            criticalFail: true,
            cfMessage: CF_RESTRAINT_MESSAGE,
            cfAlternatives: CF_RESTRAINT_ALTERNATIVES,
            docId: "DOC-LAW-003",
            next: "T4",
          },
          {
            id: "S4-n",
            label: "무응답·미분류",
            patterns: [],
            gaugeDelta: 0,
            aiReaction: "…뭐? 안 들려요.",
            rubricHits: [],
            coaching: UNCLEAR_COACHING,
            docId: "DOC-GUIDE-001",
            next: "T5",
          },
        ],
      },
    },

    /* ── S5 보고·기록 (기능③ 연동) ───────────────────────────────── */
    {
      id: "T5",
      speaker: "system",
      speakerName: "보고·기록",
      text: "최 어르신이 방으로 돌아가 누우셨습니다. 이제 야간 근무 일지와 기관 보고를 남길 차례입니다.",
      cue: {
        id: "CUE-5",
        prompt: "지금 있었던 일을 야간 근무 일지에 남긴다고 생각하고, 말로 보고해 주세요.",
        waitSec: 8,
        // 상식적인 보고 문장이 신호에 걸리지 않았다고 「미보고」(R1-d)로 찍지 않습니다.
        defaultBranchId: "R1-n",
        branches: [
          {
            id: "R1-a",
            label: "5요소 사실 보고",
            patterns: [
              "02시",
              "2시 10분",
              "새벽 2시",
              "무릎 통증",
              "통증을 말씀",
              "확인했습니다",
              "안내드렸습니다",
              "보고드립니다",
              "보고드리겠습니다",
              "당직 간호사",
            ],
            fallbackOption:
              "새벽 2시 10분 최 어르신이 외투를 입고 현관 앞에 서 계셨고, 무릎 통증을 말씀하셔서 당직 간호사께 알리고 곁에서 함께 걸었습니다. 현재는 방에서 주무십니다.",
            gaugeDelta: 0,
            aiReaction: "보고가 접수되었습니다.",
            rubricHits: [
              { itemId: "CL-01", score: 4 },
              { itemId: "CL-02", score: 4 },
              { itemId: "CL-03", score: 4 },
              { itemId: "CO-04", score: 4 },
              { itemId: "CO-05", score: 3 },
            ],
            praise:
              "누가·언제·무엇을·어떻게·현재 상태가 모두 들어갔습니다. 아침 근무자가 이 일지만 보고 그대로 이어받을 수 있습니다.",
            docId: "DOC-NOTI-002",
            next: "T6",
          },
          {
            // 보호자 통보를 「할지 말지」가 아니라 **언제·누구를 통해**로 다루는 한 겹입니다.
            // C3 제약(출장 중·새벽 통화 불가)이 여기서 실제 판단으로 쓰입니다.
            id: "R1-e",
            label: "보호자 통보 경로 판단 (새벽 통화 대신 아침 기관 경유)",
            patterns: [
              "아침에 시설장",
              "시설장께",
              "시설장님",
              "아침에 기관",
              "아침에 보호자",
              "보호자께는 아침",
              "보호자께는 낮",
              "기관을 통해 알",
              "통화가 되지 않",
              "연락이 닿지 않",
              "전화를 받지 않",
            ],
            fallbackOption:
              "보호자께는 지금 통화가 되지 않아, 아침에 시설장님을 통해 알리도록 일지에 함께 남기겠습니다",
            gaugeDelta: 0,
            aiReaction: "보고가 접수되었습니다.",
            rubricHits: [
              { itemId: "CO-04", score: 4 },
              { itemId: "CO-05", score: 4 },
              { itemId: "SA-07", score: 4 },
            ],
            praise:
              "새벽에 닿지 않는 전화를 붙들지 않고, 누구를 통해 언제 알릴지를 정하셨습니다. 통보를 미룬 것이 아니라 경로를 정한 것이라 일지에 그대로 남습니다.",
            docId: "DOC-NOTI-002",
            next: "T6",
          },
          {
            id: "R1-b",
            label: "부분 보고 (요소 일부 누락)",
            patterns: ["나가시려고", "나가시려", "배회", "있었습니다", "그런 일이"],
            fallbackOption: "새벽에 어르신이 나가시려고 하셔서 곁에서 말씀을 나눴습니다",
            gaugeDelta: 0,
            aiReaction: "보고가 접수되었습니다.",
            rubricHits: [
              { itemId: "CL-01", score: 2 },
              { itemId: "CL-03", score: 2 },
              { itemId: "CO-04", score: 3 },
              { itemId: "CO-05", score: 2 },
            ],
            praise: "야간 이탈 시도를 일지에 남길 일이라고 판단하신 점은 맞습니다.",
            coaching: "시각과 통증 여부를 덧붙이면 다음 근무자가 그대로 이어받을 수 있습니다.",
            docId: "DOC-NOTI-002",
            next: "T6",
          },
          {
            id: "R1-c",
            label: "감정·추정 위주 보고",
            patterns: ["힘들었", "당황", "무서웠", "짜증", "치매라서", "고집을 부리", "일부러", "밤새"],
            fallbackOption: "어르신이 고집을 부리셔서 새벽 내내 힘들었습니다",
            gaugeDelta: 0,
            aiReaction: "보고가 접수되었습니다.",
            rubricHits: [
              { itemId: "CL-02", score: 1 },
              { itemId: "CL-01", score: 2 },
              { itemId: "CL-03", score: 2 },
            ],
            coaching:
              "감정 형용사 대신 새벽에 보고 들은 사실만 적어 주세요. 야간 일지는 나중에 나를 지킵니다.",
            docId: "DOC-NOTI-002",
            next: "T6",
          },
          {
            id: "R1-d",
            label: "미보고",
            patterns: ["늘 있는 일", "보고 안", "따로 말씀 안", "별일 아니", "나중에"],
            fallbackOption: "밤에 늘 있는 일이라 따로 남기지 않겠습니다",
            gaugeDelta: 0,
            aiReaction: "보고 내용이 등록되지 않았습니다.",
            rubricHits: [
              { itemId: "CO-04", score: 1 },
              { itemId: "CO-05", score: 1 },
              { itemId: "CL-01", score: 1 },
              { itemId: "CL-03", score: 1 },
            ],
            coaching: "야간 이탈 시도와 통증 호소는 기록 대상입니다. 짧게라도 남겨 주세요.",
            docId: "DOC-NOTI-002",
            next: "T6",
          },
          {
            id: "R1-n",
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
      id: "T6",
      speaker: "system",
      speakerName: "보고·기록",
      text: "보고 내용을 확인했습니다. 이제 다음을 위한 제안을 남길 차례입니다.",
      cue: {
        id: "CUE-6",
        prompt: "다음 밤에 같은 일이 생기지 않으려면, 무엇을 바꿔볼 수 있을까요?",
        waitSec: 8,
        defaultBranchId: "R2-n",
        branches: [
          {
            id: "R2-a",
            label: "구체적 재발 방지 제안",
            patterns: [
              "취침 전",
              "21시",
              "9시",
              "화장실 안내",
              "통증 확인",
              "야간 순회",
              "순회 시간",
              "복도 등",
              "조명",
              "간호사와 협의",
              "정해두",
              "기록으로",
            ],
            fallbackOption:
              "취침 전 21시에 무릎 통증 여부를 여쭤보고, 야간 순회 때 복도 등 하나를 켜 두겠습니다",
            gaugeDelta: 0,
            aiReaction: "제안이 기록에 반영되었습니다.",
            rubricHits: [{ itemId: "CL-04", score: 4 }],
            praise: "시각과 실행 주체가 있는 제안입니다. 그대로 인수인계에 옮길 수 있습니다.",
            docId: "DOC-GUIDE-001",
            next: "T7",
          },
          {
            id: "R2-b",
            label: "추상적 제안",
            patterns: ["잘 살펴", "더 신경", "주의하", "관심을 갖", "노력하겠"],
            fallbackOption: "다음엔 밤에 더 신경 쓰겠습니다",
            gaugeDelta: 0,
            aiReaction: "제안이 기록에 반영되었습니다.",
            rubricHits: [{ itemId: "CL-04", score: 2 }],
            coaching: "취침 전 몇 시에 무엇을 하겠다는 형태로 바꿔 보세요.",
            docId: "DOC-GUIDE-001",
            next: "T7",
          },
          {
            id: "R2-c",
            label: "제안 없음",
            patterns: ["없습니다", "모르겠", "글쎄요", "생각 안"],
            fallbackOption: "지금은 떠오르는 것이 없습니다",
            gaugeDelta: 0,
            aiReaction: "제안 없이 기록이 마감되었습니다.",
            rubricHits: [{ itemId: "CL-04", score: 1 }],
            coaching:
              "원인을 확인하지 않으면 같은 시각에 다시 반복됩니다. 작은 것 하나만 정해 보세요.",
            docId: "DOC-GUIDE-001",
            next: "T7",
          },
          {
            id: "R2-n",
            label: "무응답·미분류",
            patterns: [],
            gaugeDelta: 0,
            aiReaction: "말씀이 잘 전달되지 않았습니다.",
            rubricHits: [],
            coaching: UNCLEAR_COACHING,
            docId: "DOC-GUIDE-001",
            next: "T7",
          },
        ],
      },
    },
    {
      id: "T7",
      speaker: "system",
      speakerName: "보고·기록",
      text: "마지막입니다. 오늘의 대응을 스스로 돌아볼 차례입니다.",
      cue: {
        id: "CUE-7",
        prompt: "오늘 내 대응에서 한 가지만 고친다면?",
        waitSec: 8,
        defaultBranchId: "R3-n",
        branches: [
          {
            id: "R3-a",
            label: "개선점 언어화",
            // "다음엔"·"하겠습니다"는 존댓말 종결 표지일 뿐이라 4점 신호가 될 수 없어 두지 않습니다.
            patterns: [
              "감정을",
              "감정부터",
              "원인을",
              "원인부터",
              "통증을",
              "통증부터",
              "인정하겠",
              "여쭤",
              "여쭙",
              "천천히",
              "짧게",
              "낮은 톤",
              "확인하겠",
              "확인부터",
              "간호사께",
            ],
            fallbackOption: "다음엔 못 나가시게 하기 전에 어디가 불편하신지부터 여쭙겠습니다",
            gaugeDelta: 0,
            aiReaction: "오늘 훈련을 마쳤습니다.",
            rubricHits: [
              { itemId: "CL-05", score: 4 },
              { itemId: "RE-09", score: 3 },
            ],
            praise: "오늘 밤에서 고칠 점을 한 문장으로 정리하셨습니다.",
            next: "end:E-성공",
          },
          {
            id: "R3-b",
            label: "성찰이 막연함",
            patterns: [
              "정신이 없",
              "잘 못했",
              "어려웠",
              "모르겠",
              "그냥",
              "조심",
              "신경 쓰",
              "노력하겠",
              "주의하겠",
            ],
            fallbackOption: "밤이라 정신이 없었던 것 같습니다",
            gaugeDelta: 0,
            aiReaction: "오늘 훈련을 마쳤습니다.",
            rubricHits: [{ itemId: "CL-05", score: 2 }],
            coaching: "다음 야간 근무에서 무엇을 어떻게 바꿀지, 한 가지만 문장으로 정해 보세요.",
            next: "end:E-부분",
          },
          {
            id: "R3-n",
            label: "무응답·미분류",
            patterns: [],
            gaugeDelta: 0,
            aiReaction: "오늘 훈련을 마쳤습니다.",
            rubricHits: [],
            coaching: UNCLEAR_COACHING,
            next: "end:E-부분",
          },
        ],
      },
    },
  ],
  triggers: [
    {
      id: "N-1",
      name: "자동문 버튼",
      condition: "CUE-1 종료 후 (감정 인정형 D1-c를 제외한 모든 분기) · D1-d 선택 시 앞당겨 발동",
      description:
        "어르신이 현관 자동문 개방 버튼에 손을 올리십니다. 문이 열리면 경보가 울려 주무시는 분들이 모두 깨십니다. 압박이 커진 순간에도 붙잡는 대신 대체 행동을 선택하는지 봅니다.",
    },
    {
      id: "N-2",
      name: "옆방 어르신",
      condition: "CUE-3 종료 후 (알파에서는 100% 고정 발동)",
      description:
        "옆방 어르신이 문을 열고 복도를 내다보시며 무슨 일이냐고 물으십니다. 대상자의 사정을 제3자 앞에서 말하지 않는지 봅니다.",
    },
    {
      id: "N-3",
      name: "무릎 통증 단서",
      condition: "미충족 욕구 탐색을 수행했을 때만 노출",
      description:
        "어르신이 왼쪽 무릎을 누르고 계십니다. 원인을 먼저 여쭌 학습자에게만 보이는 단서로, 탐색 행위 자체를 보상합니다. 여쭙지 않으면 통증은 다음 턴에서야 드러납니다.",
    },
  ],
  endings: [
    {
      id: "E-성공",
      title: "밤을 함께 넘기셨습니다",
      verdict: "충족",
      condition: "초조도 ≤ 1, 현관 이탈 없음, 원인 1개 이상 확인, 당직 보고 이행",
      message:
        "어르신이 방으로 돌아가 쉬시고, 오늘 밤 일이 기록으로 남았습니다. 충족하신 원칙과 근거 출처를 확인해 주세요.",
    },
    {
      id: "E-부분",
      // 이 엔딩은 마지막 돌아보기 한 문장(CUE-7)으로만 갈립니다 — 원인을 확인하고도,
      // 당직에 보고하고도 여기로 옵니다. 그래서 **제목도 문구도** 세션 사실을 단정하지 않고
      // 실제 갈림 사유만 적습니다(그 판정은 아래 항목별 표시가 합니다).
      // 제목은 종료 화면 부제와 /history 회차 카드에 그대로 실리므로 같은 기준을 받습니다.
      title: "오늘 밤을 돌아보는 한 문장이 남았습니다",
      verdict: "부분 충족",
      condition: "초조도 2~3, 현관 이탈은 없었으나 원인 미확인 또는 보고 누락",
      message:
        "마무리 돌아보기에서 한 문장이 남았습니다. 오늘 밤 무엇이 충족되었고 무엇이 남았는지는 아래에서 확인해 주세요.",
    },
    {
      id: "E-위기",
      title: "여기서 멈추고, 도움을 부를 자리입니다",
      // 이 엔딩은 두 경로로 옵니다 — 초조도 5(문은 그대로) / 자동문 개방(밖으로 나가심).
      // 한쪽만 가정한 문구를 쓰면 다른 경로에서 지문과 어긋납니다.
      condition: "초조도 5 도달 또는 자동문 개방·외출 시도 성공",
      verdict: "재시도",
      message:
        "실제 현장이라면 이 시점에 당직 간호사와 시설장에게 먼저 알립니다. 어르신이 현관 밖으로 나가신 경우라면 여기에 기관 보고와 실종 신고 판단이 더해집니다. 재시도 1회를 벌점 없이 제공합니다.",
    },
    {
      id: "E-재훈련",
      title: "여기서부터 한 번 더 걸어 보겠습니다",
      verdict: "재훈련",
      condition: "신체 억제·문 잠금·밀기·끌기 또는 임의 투약 선택",
      message:
        "노인복지법 제39조의9는 신체 자유를 제한하는 행위를, 의료법 제27조는 무면허 의료행위를 금지합니다. 대안 행동을 확인하신 뒤, 멈췄던 지점부터 다시 이어가 보시겠어요?",
    },
  ],
  appliedRubric: [
    "SA-01",
    "SA-02",
    "SA-03",
    "SA-04",
    "SA-07",
    "SA-08",
    "CO-01",
    "CO-02",
    "CO-04",
    "CO-05",
    "CO-07",
    "CO-08",
    "RE-01",
    "RE-02",
    "RE-03",
    "RE-04",
    "RE-07",
    "RE-08",
    "RE-09",
    "CL-01",
    "CL-02",
    "CL-03",
    "CL-04",
    "CL-05",
  ],
  sourceDocs: ["DOC-GUIDE-001", "DOC-LAW-003", "DOC-LAW-005", "DOC-NOTI-002"],
  reportCues: ["지금 있었던 일을 야간 근무 일지에 남긴다고 생각하고, 말로 보고해 주세요."],
  active: true,
  reviewPending: true, // 알파 초안 — 현직 감수 완료 시 이 줄을 지우면 /train 라벨·/check 항목이 함께 내려갑니다.
};

export default CHK_A02;
