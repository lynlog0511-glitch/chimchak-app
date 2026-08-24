/**
 * CHK-A01 「현관 앞, 집에 가야 해요」 — 설계서 §3.1 전문 인코딩.
 *
 * 유형 ① 치매 행동심리증상(BPSD) · 난이도 초급 · 소요 약 4분 · 계층 L1+L2
 * 기능 F1 시뮬레이터 + F3 기록 코칭
 *
 * 대사·분기 판정 신호·▲(게이지 변동)·엔딩 조건은 설계서 원문을 그대로 인코딩했습니다.
 * 역할 발화(AI 대사)는 앵커 대사 고정값이며, 경량 LLM(교체형 어댑터)이 연결되더라도
 * 이 앵커에서 이탈하면 템플릿 고정 대사로 되돌립니다.
 *
 * 상태 흐름: S0 진입 → S1 대화개시(T1/CUE-1) → S2 원인탐색(T2/CUE-2)
 *          → S3 안전확보·대체행동(T3/CUE-3) → S4 보고·기록(CUE-4~6)
 *          (초조도 5 도달 시 위기 엔딩 → 재시도 1회 무벌점)
 *
 * 판정 공정성 (8/6 감사 기준을 전 CUE로 소급)
 *  - 모든 CUE에 **중립 미분류 분기**(…-n)를 두고 defaultBranchId를 그리로 돌렸습니다.
 *    말이 신호에 걸리지 않았다는 것과 잘못 대응했다는 것은 다른 사실입니다. 감점 분기는
 *    학습자가 **실제로 그 말을 했을 때**(패턴 일치·버튼 선택)만 열립니다.
 *  - 특히 CUE-T1·CUE-T1B의 「문이 열림 → 위기 엔딩」(TA-d·TB-d)은 명시적 무행동에만 붙입니다.
 *    미분류로 훈련이 끝나 버리면, 인식이 빗나간 사람에게 실패를 돌려주는 셈입니다.
 */

import type { Scenario } from "@/types";

/**
 * 중립 미분류 분기의 코칭 문구 — 감점이 아니라 **다시 말할 기회**입니다.
 * (CUE-T2 전화 구간만 문맥이 달라 따로 씁니다.)
 */
const UNCLEAR_COACHING =
  "잘 전달되지 않았습니다. 지금 하신 말씀은 판정에 넣지 않았으니, 하시려던 말을 한 문장으로 짧게 다시 하시거나 아래 버튼에서 골라 주세요.";

/** CO-02 ⚑CF 인터럽트 고정 문구 — 노인복지법 제39조의9 금지행위 고지 + 대안 3개. */
const CF_RESTRAINT_MESSAGE =
  "잠시 멈추겠습니다. 어르신의 몸을 붙잡거나 문을 잠그는 것은 노인복지법 제39조의9가 금지하는 신체 자유의 제한에 해당합니다. 지금 하실 수 있는 것은 ①감정을 먼저 말로 인정하기 ②동의를 구한 뒤 손을 잡고 함께 걷기 ③함께 할 다른 활동을 제안하기입니다. 다시 해보시겠어요?";

const CF_RESTRAINT_ALTERNATIVES = [
  "\"집에 가고 싶으시구나\" 하고 감정을 먼저 말로 인정합니다.",
  "\"제 손 잡고 같이 가실까요?\" 하고 동의를 구한 뒤 함께 움직입니다.",
  "\"사진첩 같이 볼까요?\" 하고 함께 할 다른 활동을 제안합니다.",
];

/**
 * CO-02 ⚑CF 판정 신호 (신체 억제·문 잠금).
 *
 * 세 트리거 CUE가 같은 집합을 쓰도록 한곳에 모았습니다. 한국어는 음절 블록 단위라
 * "문을 잠그"는 "문을 잠급니다"의 부분 문자열이 아니므로 **어간까지만** 남깁니다.
 * (규칙 사전 rules.ts의 RESTRAINT_RULES.terms와 같은 기준입니다.)
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
];

export const CHK_A01: Scenario = {
  id: "CHK-A01",
  title: "현관 앞, 집에 가야 해요",
  type: "BPSD",
  typeLabel: "치매 행동심리증상(BPSD)",
  level: 1,
  levelLabel: "초급",
  durationMin: 4,
  tiers: ["L1", "L2"],
  summary:
    "해 질 무렵 현관 앞에서 귀가를 요구하시는 어르신께, 제지하지 않고 말로 다가가는 연습입니다.",
  objectives: [
    "LO-1 사실을 정정하기 전에 대상자의 정서를 언어로 먼저 인정합니다. (RE-01, RE-02)",
    "LO-2 배회 행동의 미충족 욕구와 환경 요인을 각 1개 이상 확인합니다. (SA-02, SA-03)",
    "LO-3 신체 억제 없이 안전을 확보합니다. (CO-02 ⚑CF, RE-04, RE-09)",
    "LO-4 보고·기록 대상임을 판단하고 사실 중심 보고를 완성합니다. (CO-04, CO-05, CL-01, CL-02)",
  ],
  personas: [
    {
      role: "care_recipient",
      name: "박 어르신 (가상 인물)",
      profile:
        "여성 82세 · 알츠하이머형 치매 중등도 · 장기요양 3등급 · 방문요양 주 5회(14:00~17:00) 이용 3개월차입니다. 오후 4시 이후 초조·귀가 요구가 주 3회 이상 반복됩니다(일몰 무렵 악화 패턴). 낮잠 2시간 이상, 3주 전 배우자 기일이었습니다. 평소 자녀를 어린아이로 지칭하시고(\"우리 애기\"), 큰 소리로 말하면 더 흥분하십니다.",
    },
    {
      role: "learner",
      name: "신규 요양보호사 (사용자 본인)",
      profile:
        "자격 취득 2개월 · 이 가정 배정 3일차 · 단독 방문 · 야간 대응 경험이 없습니다.",
    },
    {
      role: "guardian",
      name: "보호자 따님 (가상 인물)",
      profile: "직장인이며 19:00 이후 귀가하십니다. 현재 부재 중이고 통화 연결이 보장되지 않습니다.",
    },
  ],
  context:
    "오후 4시 40분입니다. 설거지를 마치고 거실로 나온 순간, 어르신이 현관 앞에서 신발을 반쯤 신은 채 문고리를 잡고 계십니다. 밖은 이미 어둑하고 기온은 3도입니다. 어르신은 외투를 입지 않으셨습니다.",
  constraints: [
    "C1 서비스 종료 20분 전입니다 — 퇴근 시간 압박이 있습니다.",
    "C2 보호자가 부재 중이고 즉시 통화가 보장되지 않습니다.",
    "C3 물리적 제지·문 잠금이 금지됩니다 (노인복지법상 금지행위 소지).",
    "C4 다른 인력이 없고, 현관 도어락은 안에서 열립니다.",
    "C5 어르신은 큰 소리에 더 흥분하십니다.",
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
      speakerName: "박 어르신",
      text: "아이고… 나 지금 가야 돼. 우리 애기 학교에서 오면 밥을 줘야 하는데.",
      stageDirection: "신발을 반쯤 신은 채 문고리를 잡고 계십니다.",
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
              "마음이 급하",
              "급하시",
              "걱정되시",
              "걱정이 되시",
              "속상하시",
              "보고 싶으시",
              "챙겨주셔야",
              "밥 챙겨",
              "애기 밥",
              "그러시구나",
              "그러셨구나",
              "그러시겠어요",
              "마음이",
              "얼마나",
              "많이 기다리",
              "생각이 나시",
              "싶으시",
              "그리우시",
            ],
            fallbackOption: "애기 밥 챙겨주셔야 하는구나, 마음이 급하시겠어요",
            gaugeDelta: -1,
            aiReaction: "그럼그럼… 걔가 나 아니면 밥을 안 먹어.",
            aiReactionNote: "문고리에서 손을 떼십니다.",
            rubricHits: [
              { itemId: "RE-01", score: 4 },
              { itemId: "RE-02", score: 4 },
            ],
            praise: "집에 가고 싶은 마음을 먼저 알아주셨습니다.",
            docId: "DOC-GUIDE-001",
            next: "T2",
          },
          {
            id: "D1-a",
            label: "사실 반박형",
            patterns: [
              "여기가 집",
              "여기가 어머님 댁",
              "여기가 댁",
              "여기 집이",
              "여기가 어르신",
              "여기가 어머님",
              "집이에요",
              "집인데요",
              "집이잖아요",
              "댁이잖아요",
              "다녀가셨",
              "댁이에요",
              "애기는 다 컸",
              "애기 다 컸",
              "다 커서",
              "다 크셨",
              "학교 안 다녀",
              "학교 끝난 지",
              "지금 밤",
              "지금 저녁",
              "벌써 밤",
              "밤이에요",
              "그런 사람 없",
              "그런 분 없",
              "아무도 없어요",
              "돌아가셨",
              "잘못 아시",
              "착각하시",
              "기억이 안 나셔서",
            ],
            fallbackOption: "어머님, 여기가 어머님 댁이에요",
            gaugeDelta: 2,
            aiReaction: "무슨 소리야! 내가 우리 집을 몰라? 비켜요!",
            aiReactionNote: "목소리가 커지십니다.",
            rubricHits: [{ itemId: "RE-02", score: 1 }],
            coaching:
              "사실을 바로잡기 전에 \"애기 밥 챙기셔야 하는구나\" 하고 마음을 먼저 되돌려 주세요. 현실을 직면시키면 초조가 커집니다.",
            docId: "DOC-GUIDE-001",
            next: "T-1",
          },
          {
            id: "D1-b",
            label: "지시·제지형",
            patterns: [
              "안 돼요",
              "안돼요",
              "안 됩니다",
              "앉으세요",
              "앉아 계세요",
              "가만히",
              "가만 계세요",
              "움직이지 마",
              "나가시면 안",
              "기다리세요",
              "잠깐만요",
              "그러지 마세요",
              "하지 마세요",
            ],
            fallbackOption: "잠깐만요, 앉아 계세요",
            gaugeDelta: 2,
            aiReaction: "왜 나를 못 가게 해! 놔요!",
            rubricHits: [
              { itemId: "RE-03", score: 1 },
              { itemId: "CO-02", score: 3 },
            ],
            praise: "몸에 손을 대지 않으신 점은 지켜졌습니다.",
            coaching:
              "지시 대신 \"지금 나가실까요, 물 한 잔 드시고 나가실까요?\"처럼 선택지를 두 개만 드려 보세요.",
            docId: "DOC-GUIDE-001",
            next: "T-1",
          },
          {
            id: "D1-b-CF",
            label: "지시·제지형 — 신체 접촉·문 잠금 (⚑CF)",
            // 잠그다의 활용형(잠급니다·잠갔습니다·잠금)을 놓치지 않도록 어간까지만 둡니다.
            patterns: RESTRAINT_PATTERNS,
            gaugeDelta: 0,
            aiReaction: "놔! 놓으라고!",
            aiReactionNote: "손을 뿌리치며 몸을 뒤로 빼십니다.",
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
            // "음…"·"어…"는 정규화하면 한 글자만 남아 모든 발화를 삼키므로 두지 않습니다.
            // 이제 이 분기는 학습자가 **실제로 그렇게 말했을 때만** 열립니다
            // (무응답·미분류는 아래 D1-n이 받습니다).
            patterns: ["글쎄요", "모르겠"],
            fallbackOption: "글쎄요, 저도 잘 모르겠습니다",
            gaugeDelta: 1,
            aiReaction: "이 사람이 왜 안 비켜…",
            aiReactionNote: "혼잣말을 하십니다. 돌발 변수 T-1이 앞당겨 발동합니다.",
            rubricHits: [{ itemId: "RE-01", score: 1 }],
            coaching:
              "말이 막히면 \"많이 급하시죠\" 한마디만 먼저 건네 보세요. 답을 찾는 사이에도 어르신은 기다려 주십니다.",
            docId: "DOC-GUIDE-001",
            triggerId: "T-1",
            next: "T-1",
          },
          {
            // 미분류(음성 인식 실패 포함) 전용 중립 분기 — 게이지 변동 0, 루브릭 반영 없음.
            id: "D1-n",
            label: "무응답·미분류",
            patterns: [],
            gaugeDelta: 0,
            aiReaction: "…응? 뭐라고요. 잘 안 들려요.",
            aiReactionNote: "문고리를 잡은 채 이쪽으로 고개를 돌리십니다.",
            rubricHits: [],
            coaching: UNCLEAR_COACHING,
            docId: "DOC-GUIDE-001",
            next: "T-1",
          },
        ],
      },
    },

    /* ── 돌발 변수 T-1 「문고리」 (초조도 ≥ 4 또는 D1-d) ─────────────── */
    {
      id: "T-1",
      speaker: "system",
      speakerName: "돌발 변수 T-1 「문고리」",
      text: "어르신이 도어락 버튼을 누르십니다. 화면에 3초 카운트다운이 표시됩니다.",
      stageDirection:
        "시간 압박이 극대화된 순간입니다. 억제(⚑CF)가 아니라 대체 행동을 선택하는지 봅니다.",
      isTrigger: true,
      triggerName: "T-1 문고리",
      cue: {
        id: "CUE-T1",
        prompt: "3초입니다. 지금 무엇을 하시겠습니까?",
        waitSec: 3,
        // 미분류로 문이 열리지는 않습니다 — 위기 엔딩(TA-d)은 명시적 무행동에만 붙입니다.
        defaultBranchId: "TA-n",
        branches: [
          {
            id: "TA-a",
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
              "신발 마저",
              "제가 모셔다",
              "같이 준비",
              // 대체 활동 제안도 이 분기입니다 (T-1의 측정 목적 = 억제 대신 대체 행동).
              "사진첩",
              "사진 같이",
              "같이 볼까요",
              "차 한 잔",
              "따뜻한 물",
            ],
            fallbackOption: "어머님, 저랑 같이 나가요. 외투부터 같이 입으실까요?",
            gaugeDelta: -1,
            aiReaction: "…그럼 같이 가.",
            aiReactionNote: "도어락에서 손을 떼고 몸을 돌리십니다.",
            rubricHits: [
              { itemId: "SA-01", score: 4 },
              { itemId: "SA-04", score: 4 },
              { itemId: "RE-04", score: 4 },
              { itemId: "RE-07", score: 4 },
              { itemId: "CO-02", score: 4 },
            ],
            praise: "붙잡지 않고 함께 움직이는 방법으로 안전을 확보하셨습니다.",
            docId: "DOC-GUIDE-001",
            next: "T2",
          },
          {
            id: "TA-c",
            label: "큰 소리로 제지",
            // "어머님!"은 정규화로 느낌표가 사라져 존칭 호칭 전체를 제지로 오분류하므로 뺐습니다.
            patterns: ["안 돼요", "누르지 마", "그만", "멈추세요", "하지 마세요", "위험해요"],
            fallbackOption: "어머님, 그거 누르시면 안 돼요!",
            gaugeDelta: 1,
            aiReaction: "왜 소리를 질러! 내가 뭘 잘못했는데!",
            aiReactionNote: "어르신은 큰 소리에 더 흥분하십니다.",
            rubricHits: [
              { itemId: "RE-07", score: 2 },
              { itemId: "RE-08", score: 1 },
            ],
            coaching:
              "한 걸음 다가가 눈높이를 맞추고 낮은 톤으로 한 문장씩만 말씀해 주세요. 어르신은 큰 소리에 더 흥분하십니다.",
            docId: "DOC-GUIDE-001",
            next: "T2",
          },
          {
            id: "TA-b",
            label: "신체 억제·문 잠금 (⚑CF)",
            patterns: RESTRAINT_PATTERNS,
            fallbackOption: "몸으로 문을 막고 도어락을 잠급니다",
            gaugeDelta: 0,
            aiReaction: "이거 놔! 사람 살려!",
            rubricHits: [{ itemId: "CO-02", score: 1 }],
            criticalFail: true,
            cfMessage: CF_RESTRAINT_MESSAGE,
            cfAlternatives: CF_RESTRAINT_ALTERNATIVES,
            docId: "DOC-LAW-003",
            next: "T-1",
          },
          {
            id: "TA-d",
            label: "대응 없음 — 문이 열림",
            // 「그대로 두겠다」는 판정은 학습자가 실제로 그렇게 답했을 때만 내립니다.
            // (미분류가 여기로 떨어지면, 인식이 빗나간 사람에게 위기 엔딩을 돌려주게 됩니다.)
            // "가만히"는 홑낱말로 두면 제지 발화("가만히 계세요")까지 삼키므로 구로 좁혔습니다.
            patterns: [
              "아무것도",
              "아무 것도",
              "아무 대응",
              "지켜보",
              "가만히 있",
              "가만히 둡",
              "그냥 두",
              "그대로 둡",
              "손 놓",
            ],
            fallbackOption: "아무것도 하지 않고 지켜봅니다",
            gaugeDelta: 2,
            aiReaction: "…다녀올게.",
            aiReactionNote: "도어락이 열리고 어르신이 현관 밖으로 나가십니다.",
            rubricHits: [
              { itemId: "RE-09", score: 1 },
              { itemId: "SA-01", score: 1 },
            ],
            coaching:
              "문이 열리기 전 3초 안에 \"저랑 같이 나가요, 외투부터 입으실까요?\" 하고 함께 할 일을 먼저 놓아 주세요.",
            docId: "DOC-GUIDE-001",
            next: "end:E-위기",
          },
          {
            id: "TA-n",
            label: "무응답·미분류",
            patterns: [],
            gaugeDelta: 0,
            aiReaction: "…뭐라고요? 안 들려요.",
            aiReactionNote: "도어락 버튼 위에 손을 얹은 채 이쪽을 보십니다.",
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
      speakerName: "박 어르신",
      text: "그래서 지금 나가야 돼. 문 좀 열어줘요.",
      cue: {
        id: "CUE-2",
        prompt: "이제 무엇을 확인하시겠습니까?",
        waitSec: 8,
        // 미분류를 감점 분기(D2-d 논리적 설득)에 매핑하지 않습니다 — 중립 분기로 받습니다.
        defaultBranchId: "D2-n",
        branches: [
          {
            id: "D2-a",
            label: "미충족 욕구 탐색",
            // 조사가 끼어도 걸리도록 어간까지만 둡니다("배가 고프신", "시장하세요?").
            patterns: [
              "화장실",
              "소변",
              "볼일",
              "시장하",
              "고프신",
              "고프세",
              "고프시",
              "출출하",
              "간식",
              "드시고 싶",
              "어디 불편",
              "불편하신 데",
              "아프신 데",
              "통증",
              "졸리",
              "주무시고",
              "목마르",
              "물 드시",
            ],
            fallbackOption: "나가시기 전에 화장실 한번 다녀오실래요?",
            gaugeDelta: -1,
            aiReaction: "아유… 축축해.",
            aiReactionNote: "돌발 변수 T-3이 발동합니다. 실제 원인이 배뇨였음이 드러납니다.",
            rubricHits: [
              { itemId: "SA-02", score: 4 },
              { itemId: "SA-08", score: 3 },
            ],
            praise: "원인을 먼저 확인하셨습니다. 탐색이 다음 30분을 바꿉니다.",
            docId: "DOC-GUIDE-001",
            triggerId: "T-3",
            next: "T-3",
          },
          {
            id: "D2-b",
            label: "환경 요인 확인",
            patterns: [
              "불이 어두",
              "어두워서",
              "불 켜",
              "조명",
              "컴컴",
              "추워서 그러",
              "온도",
              "시끄러",
              "소리가 커서",
              "커튼",
            ],
            fallbackOption: "불이 어두워서 밖 같으신가 봐요, 거실 불 켜드릴게요",
            gaugeDelta: -1,
            aiReaction: "…그러네. 왜 이렇게 컴컴해.",
            rubricHits: [{ itemId: "SA-03", score: 4 }],
            praise: "환경 요인을 확인하고 바로 조정하셨습니다.",
            docId: "DOC-GUIDE-001",
            next: "T-2",
          },
          {
            id: "D2-c",
            label: "선택권 제공",
            patterns: [
              "아니면",
              "둘 중에",
              "어떤 게 좋으",
              "고르시",
              "따뜻한 물",
              "물 한 잔",
              "드시고 같이",
              "하실래요",
              "해볼까요",
            ],
            fallbackOption:
              "지금 바로 나가실래요, 아니면 따뜻한 물 한 잔 드시고 같이 나가볼까요?",
            gaugeDelta: -1,
            aiReaction: "…물이나 한 잔 주든가.",
            rubricHits: [{ itemId: "RE-03", score: 4 }],
            praise: "지시 대신 두 개의 선택지를 드렸습니다.",
            docId: "DOC-GUIDE-001",
            next: "T-2",
          },
          {
            id: "D2-d",
            label: "논리적 설득",
            patterns: [
              "밖에 추워",
              "추워서 안",
              "위험해요",
              "감기 걸리",
              "지금 나가면",
              "어두워서 안",
              "차가 다녀",
              "말 들으세요",
            ],
            fallbackOption: "밖에 추워서 안 돼요",
            gaugeDelta: 1,
            aiReaction: "내가 애야? 추운 거 몰라?",
            rubricHits: [{ itemId: "RE-02", score: 2 }],
            coaching: "설명으로 이기려 하기보다, 무엇이 필요하신지 먼저 여쭤 주세요.",
            docId: "DOC-GUIDE-001",
            next: "T-2",
          },
          {
            // 미분류(음성 인식 실패 포함) 전용 중립 분기 — 게이지 변동 0, 루브릭 반영 없음.
            id: "D2-n",
            label: "무응답·미분류",
            patterns: [],
            gaugeDelta: 0,
            aiReaction: "…뭐라고?",
            rubricHits: [],
            coaching: UNCLEAR_COACHING,
            docId: "DOC-GUIDE-001",
            next: "T-2",
          },
        ],
      },
    },

    /* ── 돌발 변수 T-3 「젖은 옷 단서」 (D2-a 수행 시에만 노출) ───────── */
    {
      id: "T-3",
      speaker: "system",
      speakerName: "돌발 변수 T-3 「젖은 옷 단서」",
      text: "어르신의 옷이 젖어 있습니다. 배회의 실제 원인이 배뇨였음이 드러납니다.",
      stageDirection: "이 단서는 원인 탐색(D2-a)을 수행한 학습자에게만 노출됩니다.",
      isTrigger: true,
      triggerName: "T-3 젖은 옷 단서",
      autoNext: "T-2",
    },

    /* ── 돌발 변수 T-2 「보호자 전화」 (T2 종료 후 100% 고정 발동) ────── */
    {
      id: "T-2",
      speaker: "guardian",
      speakerName: "보호자 따님",
      text: "지금 통화 되세요? 엄마 오늘 어땠어요?",
      stageDirection: "따님에게서 전화가 걸려옵니다. 어르신은 아직 현관 근처에 계십니다.",
      isTrigger: true,
      triggerName: "T-2 보호자 전화",
      cue: {
        id: "CUE-T2",
        prompt: "어르신 곁을 지키면서, 이 전화를 어떻게 하시겠습니까?",
        waitSec: 8,
        // 미분류를 감점 분기(P-c)에 매핑하지 않습니다 — 중립 분기로 받습니다.
        defaultBranchId: "P-n",
        branches: [
          {
            id: "P-a",
            label: "안전 우선 + 재연락 약속",
            patterns: [
              "다시 걸겠",
              "다시 연락",
              "이따 전화",
              "5분 뒤",
              "곁에 있어야",
              "옆에 있어야",
              "지금 어머님",
              "잠시 후에",
              "끊고 다시",
            ],
            fallbackOption:
              "지금 어머님 곁에 있어야 해서, 5분 뒤에 제가 다시 걸겠습니다",
            gaugeDelta: 0,
            aiReaction: "네, 그럼 그때 전화 주세요.",
            rubricHits: [
              { itemId: "SA-04", score: 4 },
              { itemId: "CL-02", score: 4 },
            ],
            praise: "어르신 안전을 먼저 두고, 다시 연락할 시점까지 정하셨습니다.",
            docId: "DOC-GUIDE-001",
            next: "T3",
          },
          {
            id: "P-b",
            label: "통화하되 어르신에게서 손·시선을 떼지 않음을 명시",
            patterns: [
              "보면서 말씀",
              "보면서 통화",
              "옆에서 통화",
              "옆에서 받",
              "곁에서 통화",
              "곁에서 받",
              "손 잡고 통화",
              "손 잡고 있",
              "손 잡은 채",
              "시선을 떼지",
              "시선 안 떼",
              "지켜보면서",
            ],
            fallbackOption: "어머님 손 잡고 있으면서 짧게 말씀드릴게요",
            gaugeDelta: 0,
            aiReaction: "네, 그럼 짧게만 여쭤볼게요.",
            rubricHits: [
              { itemId: "SA-04", score: 3 },
              { itemId: "CL-02", score: 3 },
            ],
            praise: "통화 중에도 어르신에게서 손과 시선을 떼지 않으셨습니다.",
            docId: "DOC-GUIDE-001",
            next: "T3",
          },
          {
            id: "P-c",
            label: "즉시 통화 수락 (어르신 위치 확인 없음)",
            patterns: ["네 말씀하세요", "여보세요", "네 통화 됩니다", "괜찮아요 말씀"],
            fallbackOption: "네, 통화 됩니다. 말씀하세요",
            gaugeDelta: 1,
            aiReaction: "오늘은 좀 어떠셨어요?",
            rubricHits: [{ itemId: "SA-04", score: 2 }],
            coaching:
              "전화를 받기 전에 \"잠시만요\" 하고 어르신이 어디 계신지부터 눈으로 확인해 주세요.",
            docId: "DOC-GUIDE-001",
            next: "T3",
          },
          {
            id: "P-d",
            label: "통화 중 어르신 시야 이탈",
            patterns: ["방으로 들어가", "자리를 옮겨", "조용한 데서", "잠깐 나가서"],
            fallbackOption: "조용한 방으로 들어가 통화합니다",
            gaugeDelta: 2,
            aiReaction: "…지금이다.",
            aiReactionNote: "어르신이 다시 현관 쪽으로 움직이십니다. T-1이 즉시 발동합니다.",
            rubricHits: [
              { itemId: "SA-04", score: 1 },
              { itemId: "CL-02", score: 1 },
            ],
            coaching:
              "자리를 옮기기 전에 어르신을 시야 안에 두시거나, \"5분 뒤 다시 걸겠습니다\" 하고 통화를 먼저 끊어 주세요.",
            docId: "DOC-GUIDE-001",
            triggerId: "T-1",
            next: "T-1B",
          },
          {
            // 미분류(음성 인식 실패 포함) 전용 중립 분기 — 게이지 변동 0, 루브릭 반영 없음.
            id: "P-n",
            label: "무응답·미분류",
            patterns: [],
            gaugeDelta: 0,
            aiReaction: "…여보세요? 안 들리세요?",
            rubricHits: [],
            coaching:
              "지금 하신 말씀은 판정에 넣지 않았습니다. 전화를 지금 받으실지 뒤로 미루실지 한 문장으로 말씀하시거나, 아래 버튼에서 골라 주세요.",
            docId: "DOC-GUIDE-001",
            next: "T3",
          },
        ],
      },
    },

    /* ── T-1 재발동 (보호자 전화 중 시야 이탈 경로) ──────────────────── */
    {
      id: "T-1B",
      speaker: "system",
      speakerName: "돌발 변수 T-1 「문고리」 재발동",
      text: "어르신이 다시 도어락 버튼을 누르십니다. 화면에 3초 카운트다운이 표시됩니다.",
      isTrigger: true,
      triggerName: "T-1 문고리",
      cue: {
        id: "CUE-T1B",
        prompt: "3초입니다. 지금 무엇을 하시겠습니까?",
        waitSec: 3,
        // CUE-T1과 같은 기준입니다 — 미분류로는 문이 열리지 않습니다.
        defaultBranchId: "TB-n",
        branches: [
          {
            id: "TB-a",
            label: "대체 행동 유도 (동의를 구하고 함께 움직임)",
            patterns: [
              "같이 가실까요",
              "같이 가요",
              "저랑 같이",
              "손 잡고",
              "손 잡아도",
              "손 잡아 드",
              "제 손 잡",
              "함께 가",
              "외투",
              "겉옷",
              "같이 준비",
              "제가 모셔다",
              "사진첩",
              "사진 같이",
              "같이 볼까요",
              "차 한 잔",
              "따뜻한 물",
            ],
            fallbackOption: "어머님, 저랑 같이 가요. 손 잡아도 될까요?",
            gaugeDelta: -1,
            aiReaction: "…그래, 손 좀 잡아줘.",
            rubricHits: [
              { itemId: "RE-04", score: 4 },
              { itemId: "RE-07", score: 4 },
              { itemId: "CO-02", score: 4 },
              { itemId: "CO-07", score: 4 },
            ],
            praise: "동의를 구한 뒤 손을 잡는 대체 행동을 선택하셨습니다.",
            docId: "DOC-GUIDE-001",
            next: "T3",
          },
          {
            id: "TB-c",
            label: "큰 소리로 제지",
            patterns: ["안 돼요", "누르지 마", "그만", "멈추세요"],
            fallbackOption: "어머님, 안 돼요!",
            gaugeDelta: 1,
            aiReaction: "왜 자꾸 소리를 질러!",
            rubricHits: [{ itemId: "RE-08", score: 1 }],
            coaching:
              "목소리를 높이는 대신 \"제가 여기 있어요\" 한 문장으로 낮춰 주세요. 통화 중이라도 톤이 먼저 전해집니다.",
            docId: "DOC-GUIDE-001",
            next: "T3",
          },
          {
            id: "TB-b",
            label: "신체 억제·문 잠금 (⚑CF)",
            // TA-b와 같은 집합입니다 — 두 트리거 CUE의 판정이 어긋나지 않게 합니다.
            patterns: RESTRAINT_PATTERNS,
            fallbackOption: "몸으로 문을 막고 도어락을 잠급니다",
            gaugeDelta: 0,
            aiReaction: "이거 놔!",
            rubricHits: [{ itemId: "CO-02", score: 1 }],
            criticalFail: true,
            cfMessage: CF_RESTRAINT_MESSAGE,
            cfAlternatives: CF_RESTRAINT_ALTERNATIVES,
            docId: "DOC-LAW-003",
            next: "T-1B",
          },
          {
            id: "TB-d",
            label: "대응 없음 — 문이 열림",
            // TA-d와 같은 기준입니다 — 명시적 무행동에만 붙습니다.
            patterns: [
              "아무것도",
              "아무 것도",
              "아무 대응",
              "지켜보",
              "가만히 있",
              "가만히 둡",
              "그냥 두",
              "그대로 둡",
              "손 놓",
              "통화를 계속",
            ],
            fallbackOption: "아무것도 하지 않고 지켜봅니다",
            gaugeDelta: 2,
            aiReaction: "…다녀올게.",
            aiReactionNote: "도어락이 열리고 어르신이 현관 밖으로 나가십니다.",
            rubricHits: [{ itemId: "RE-09", score: 1 }],
            coaching:
              "통화는 뒤로 미룰 수 있습니다. \"잠시 후 다시 걸겠습니다\" 하고 끊은 뒤 어르신 곁으로 먼저 가 주세요.",
            docId: "DOC-GUIDE-001",
            next: "end:E-위기",
          },
          {
            id: "TB-n",
            label: "무응답·미분류",
            patterns: [],
            gaugeDelta: 0,
            aiReaction: "…뭐라고요? 다시 말해 봐요.",
            aiReactionNote: "도어락 버튼에서 손을 떼지 않으십니다.",
            rubricHits: [],
            coaching: UNCLEAR_COACHING,
            docId: "DOC-GUIDE-001",
            next: "T3",
          },
        ],
      },
    },

    /* ── S3 안전 확보·대체 행동 ───────────────────────────────────── */
    {
      id: "T3",
      speaker: "elder",
      speakerName: "박 어르신",
      text: "…그러면 잠깐만 들어갔다 나가자.",
      cue: {
        id: "CUE-3",
        prompt: "어르신을 안전한 행동으로 이끌어 볼까요?",
        waitSec: 8,
        // 미분류를 감점 분기(D3-c 그냥 기다림)에 매핑하지 않습니다 — 중립 분기로 받습니다.
        defaultBranchId: "D3-n",
        branches: [
          {
            id: "D3-a",
            label: "동행 유도 + 손 잡기 동의 구함",
            patterns: [
              "손 잡고 같이",
              "제 손 잡고",
              "손 잡아도 될까요",
              "손 잡아 드릴까요",
              "같이 가실까요",
              "같이 들어가실까요",
              "제가 같이",
              "함께 가실까요",
            ],
            fallbackOption: "제 손 잡고 같이 가실까요?",
            gaugeDelta: -2,
            aiReaction: "…그래.",
            aiReactionNote: "손을 내미시고, 현관에서 거실 쪽으로 함께 이동하십니다.",
            rubricHits: [
              { itemId: "RE-04", score: 4 },
              { itemId: "CO-07", score: 4 },
              { itemId: "RE-09", score: 4 },
            ],
            praise: "동의를 먼저 구하고 함께 움직이셨습니다. 억제 없이 안전을 확보한 대응입니다.",
            docId: "DOC-GUIDE-001",
            next: "T4",
          },
          {
            id: "D3-b",
            label: "대체 활동 제시",
            patterns: [
              "사진첩",
              "사진 같이",
              "차 한 잔",
              "커피",
              "노래",
              "티비",
              "텔레비전",
              "같이 볼까요",
              "같이 앉아",
              "이야기 좀",
            ],
            fallbackOption: "사진첩 같이 볼까요?",
            gaugeDelta: -1,
            aiReaction: "…사진? 어디 있는데.",
            aiReactionNote: "현관에서 거실 쪽으로 몸을 돌리십니다.",
            rubricHits: [
              { itemId: "RE-04", score: 3 },
              { itemId: "RE-09", score: 3 },
            ],
            praise: "안전한 대체 활동으로 주의를 옮기셨습니다.",
            docId: "DOC-GUIDE-001",
            next: "T4",
          },
          {
            id: "D3-c",
            label: "그냥 기다림",
            // "기다리"는 "기다립니다"의 부분 문자열이 아닙니다(음절 블록) — 어간까지만 남깁니다.
            // 기본값이 중립 분기로 옮겨 갔으므로, 버튼 문구도 여기서 직접 걸려야 합니다.
            patterns: ["기다", "지켜보", "가만히 있", "아무 말 없이", "말없이"],
            fallbackOption: "말없이 옆에서 기다립니다",
            gaugeDelta: 0,
            aiReaction: "…뭐 해. 문 안 열어줘?",
            rubricHits: [{ itemId: "RE-04", score: 2 }],
            coaching:
              "기다리는 동안 상황은 그대로입니다. \"사진첩 같이 볼까요?\"처럼 지금 함께 할 일을 하나만 꺼내 주세요.",
            docId: "DOC-GUIDE-001",
            next: "T4",
          },
          {
            id: "D3-d",
            label: "밀거나 끌기 (⚑CF)",
            // "억지로"처럼 단독으로 ⚑CF를 단정하기 어려운 말은 구(句)로 좁혔습니다.
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
            fallbackOption: "팔을 잡아 거실 쪽으로 끌어당깁니다",
            gaugeDelta: 0,
            aiReaction: "왜 이래! 놔!",
            rubricHits: [{ itemId: "CO-02", score: 1 }],
            criticalFail: true,
            cfMessage: CF_RESTRAINT_MESSAGE,
            cfAlternatives: CF_RESTRAINT_ALTERNATIVES,
            docId: "DOC-LAW-003",
            next: "T3",
          },
          {
            id: "D3-n",
            label: "무응답·미분류",
            patterns: [],
            gaugeDelta: 0,
            aiReaction: "…네? 잘 못 들었어요.",
            rubricHits: [],
            coaching: UNCLEAR_COACHING,
            docId: "DOC-GUIDE-001",
            next: "T4",
          },
        ],
      },
    },

    /* ── S4 보고·기록 (기능③ 연동) ───────────────────────────────── */
    {
      id: "T4",
      speaker: "system",
      speakerName: "보고·기록",
      text: "어르신이 거실 소파에 앉으셨습니다. 이제 오늘 있었던 일을 기관에 보고할 차례입니다.",
      cue: {
        id: "CUE-4",
        prompt: "지금 있었던 일을 기관에 보고한다고 생각하고, 말로 보고해 주세요.",
        waitSec: 8,
        // 상식적인 보고 문장이 신호에 걸리지 않았다고 「미보고」(R1-d)로 찍지 않습니다.
        defaultBranchId: "R1-n",
        branches: [
          {
            id: "R1-a",
            label: "5요소 사실 보고",
            // 시각·행위·조치처럼 5요소를 실제로 담은 표지만 남깁니다.
            // ("현재", "지금은", "거실"처럼 한 단어로 4점이 되던 범용 토큰은 뺐습니다.)
            patterns: [
              "16시",
              "4시 4",
              "오후 4시",
              "귀가 요구",
              "귀가를 요구",
              "확인했습니다",
              "안내드렸습니다",
              "보고드립니다",
              "보고드리겠습니다",
            ],
            fallbackOption:
              "16시 40분 어르신이 현관에서 귀가를 요구하셨고, 화장실 안내 후 젖은 옷을 갈아입으시도록 도왔습니다. 현재는 거실 소파에 앉아 계십니다.",
            gaugeDelta: 0,
            aiReaction: "보고가 접수되었습니다.",
            rubricHits: [
              { itemId: "CL-01", score: 4 },
              { itemId: "CL-02", score: 4 },
              { itemId: "CL-03", score: 4 },
              { itemId: "CO-04", score: 4 },
              { itemId: "CO-05", score: 3 },
              { itemId: "CO-08", score: 4 },
            ],
            praise: "누가·언제·무엇을·어떻게·현재 상태가 모두 들어간 사실 중심 보고입니다.",
            docId: "DOC-NOTI-002",
            next: "T5",
          },
          {
            id: "R1-b",
            label: "부분 보고 (요소 일부 누락)",
            patterns: ["나가시려고", "나가시려", "귀가", "배회", "있었습니다", "그런 일이"],
            fallbackOption: "어르신이 나가시려고 하셔서 말씀드려 진정시켰습니다",
            gaugeDelta: 0,
            aiReaction: "보고가 접수되었습니다.",
            rubricHits: [
              { itemId: "CL-01", score: 2 },
              { itemId: "CL-03", score: 2 },
              { itemId: "CO-04", score: 3 },
              { itemId: "CO-08", score: 3 },
            ],
            praise: "보고 대상이라고 판단하신 점은 맞습니다.",
            coaching:
              "\"16시 40분\"과 \"지금은 소파에 앉아 계십니다\" 두 마디만 덧붙이면 그대로 기록지에 옮겨집니다.",
            docId: "DOC-NOTI-002",
            next: "T5",
          },
          {
            id: "R1-c",
            label: "감정·추정 위주 보고",
            patterns: [
              "힘들었",
              "당황",
              "황당",
              "무서웠",
              "짜증",
              "치매라서",
              "고집이 세셔서",
              "일부러",
            ],
            fallbackOption: "어르신이 고집을 부리셔서 정말 힘들었습니다",
            gaugeDelta: 0,
            aiReaction: "보고가 접수되었습니다.",
            rubricHits: [
              { itemId: "CL-02", score: 1 },
              { itemId: "CL-01", score: 2 },
              { itemId: "CL-03", score: 2 },
              { itemId: "CO-08", score: 3 },
            ],
            coaching:
              "\"힘들었다\" 대신 \"현관에서 문고리를 잡고 계셨다\"처럼 보고 들은 것만 적어 주세요. 사실만 남은 기록이 나중에 나를 지킵니다.",
            docId: "DOC-NOTI-002",
            next: "T5",
          },
          {
            id: "R1-d",
            label: "미보고",
            patterns: ["보고 안", "따로 말씀 안", "별일 아니", "괜찮을 것 같", "나중에"],
            fallbackOption: "별일 아니라서 따로 보고하지 않겠습니다",
            gaugeDelta: 0,
            aiReaction: "보고 내용이 등록되지 않았습니다.",
            rubricHits: [
              { itemId: "CO-04", score: 1 },
              { itemId: "CL-01", score: 1 },
              { itemId: "CL-03", score: 1 },
            ],
            coaching:
              "현관 이탈 시도는 급여제공기록지 특이사항란 기재 대상입니다. \"16시 40분 귀가 요구, 화장실 안내 후 진정\" 한 줄이면 됩니다.",
            docId: "DOC-NOTI-002",
            next: "T5",
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
        id: "CUE-5",
        prompt: "다음에 같은 시간에 같은 일이 생기지 않으려면, 무엇을 바꿔볼 수 있을까요?",
        waitSec: 8,
        defaultBranchId: "R2-n",
        branches: [
          {
            id: "R2-a",
            label: "구체적 재발 방지 제안",
            patterns: [
              "화장실 안내",
              "15시 30분",
              "3시 30분",
              "일정화",
              "불을 켜",
              "조명",
              "16시",
              "낮잠",
              "보호자와 협의",
              "미리",
              "정해두",
            ],
            fallbackOption:
              "15시 30분에 화장실 안내를 일정화하고, 16시에 거실 조명을 미리 켜두겠습니다",
            gaugeDelta: 0,
            aiReaction: "제안이 기록에 반영되었습니다.",
            rubricHits: [{ itemId: "CL-04", score: 4 }],
            praise: "시각과 실행 주체가 있는 제안입니다. 그대로 기록에 옮길 수 있습니다.",
            docId: "DOC-GUIDE-001",
            next: "T6",
          },
          {
            id: "R2-b",
            label: "추상적 제안",
            patterns: ["잘 살펴", "더 신경", "주의하", "관심을 갖", "노력하겠"],
            fallbackOption: "다음엔 더 잘 살펴보겠습니다",
            gaugeDelta: 0,
            aiReaction: "제안이 기록에 반영되었습니다.",
            rubricHits: [{ itemId: "CL-04", score: 2 }],
            coaching:
              "\"15시 30분에 화장실 안내를 하겠습니다\"처럼 몇 시에 무엇을 하겠다는 형태로 바꿔 보세요.",
            docId: "DOC-GUIDE-001",
            next: "T6",
          },
          {
            id: "R2-c",
            label: "제안 없음",
            patterns: ["없습니다", "모르겠", "글쎄요", "생각 안"],
            fallbackOption: "특별히 떠오르는 것이 없습니다",
            gaugeDelta: 0,
            aiReaction: "제안 없이 기록이 마감되었습니다.",
            rubricHits: [{ itemId: "CL-04", score: 1 }],
            coaching:
              "원인을 짚어 두지 않으면 같은 일이 30분 뒤 다시 옵니다. \"내일은 16시에 거실 불을 먼저 켜겠습니다\" 하나만 정해 보세요.",
            docId: "DOC-GUIDE-001",
            next: "T6",
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
        id: "CUE-6",
        prompt: "오늘 내 대응에서 한 가지만 고친다면?",
        waitSec: 8,
        defaultBranchId: "R3-n",
        branches: [
          {
            id: "R3-a",
            label: "개선점 언어화",
            // "다음엔"·"하겠습니다"는 존댓말 종결 표지일 뿐이라 4점 신호가 될 수 없어 뺐습니다.
            // 무엇을 바꾸겠다는 **내용어**만 남깁니다 (설계서 §4.4 CL-05 3~4점 앵커).
            patterns: [
              "감정을",
              "감정부터",
              "원인을",
              "원인부터",
              "인정하겠",
              "여쭤",
              "여쭙",
              "천천히",
              "짧게",
              "낮은 톤",
              "확인하겠",
              "확인부터",
            ],
            fallbackOption: "다음엔 사실을 바로잡기 전에 감정을 먼저 말로 인정하겠습니다",
            gaugeDelta: 0,
            aiReaction: "오늘 훈련을 마쳤습니다.",
            rubricHits: [
              { itemId: "CL-05", score: 4 },
              { itemId: "RE-09", score: 3 },
            ],
            praise:
              "고칠 점을 스스로 짚어 한 문장으로 남기셨습니다. 이 한 줄이 다음 회차의 첫 대응이 됩니다.",
            next: "end:E-성공",
          },
          {
            id: "R3-b",
            label: "성찰이 막연함",
            // 기본값이 중립 분기로 옮겨 갔으므로 버튼 문구("잘 못한 것 같습니다")도
            // 여기서 직접 걸려야 합니다 — "잘 못했"만으로는 활용형이 빠집니다.
            patterns: [
              "잘 못했",
              "잘 못한",
              "어려웠",
              "모르겠",
              "그냥",
              "다음엔 잘",
              "조심",
              "신경 쓰",
              "노력하겠",
              "주의하겠",
            ],
            fallbackOption: "잘 못한 것 같습니다",
            gaugeDelta: 0,
            aiReaction: "오늘 훈련을 마쳤습니다.",
            rubricHits: [{ itemId: "CL-05", score: 2 }],
            coaching:
              "\"다음엔 사실을 바로잡기 전에 감정을 먼저 인정하겠습니다\"처럼, 바꿀 것 하나만 문장으로 남겨 보세요.",
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
      id: "T-1",
      name: "문고리",
      condition: "초조도 ≥ 4 또는 D1-d",
      description:
        "어르신이 도어락 버튼을 누르십니다. 화면에 3초 카운트다운이 표시됩니다. 시간 압박이 극대화된 순간에도 억제(⚑CF) 대신 대체 행동을 선택하는지 봅니다. (측정: CO-02, SA-04, RE-07)",
    },
    {
      id: "T-2",
      name: "보호자 전화",
      condition: "T2 종료 후 (알파에서는 100% 고정 발동)",
      description:
        "따님에게서 전화가 옵니다. \"지금 통화 되세요? 엄마 오늘 어땠어요?\" 멀티태스킹 상황의 우선순위 판정과 사실·추정 분리 보고를 봅니다. (측정: SA-04, CL-02)",
    },
    {
      id: "T-3",
      name: "젖은 옷 단서",
      condition: "D2-a 수행 시에만 노출",
      description:
        "\"아유… 축축해\" — 원인 탐색 행위 자체를 보상합니다. 탐색하지 않으면 영구 미노출이며, 종료 후 \"원인을 확인하지 않으면 같은 상황이 30분 뒤 반복됩니다\"라는 코칭을 받습니다. (측정: SA-02)",
    },
  ],
  endings: [
    {
      id: "E-성공",
      title: "안전하게 마무리하셨습니다",
      verdict: "충족",
      condition: "초조도 ≤ 1, 어르신 현관 이탈, 원인 1개 이상 확인",
      message:
        "어르신이 현관에서 안전하게 돌아오셨고, 오늘 일이 기록으로 남았습니다. 충족하신 원칙과 근거 출처를 확인해 주세요.",
    },
    {
      id: "E-부분",
      // 이 엔딩은 마지막 돌아보기 한 문장(CUE-6)으로만 갈립니다 — 원인을 확인하고도,
      // 보고를 남기고도 여기로 옵니다. 그래서 **제목도 문구도** 세션 사실을 단정하지 않고
      // 실제 갈림 사유만 적습니다(무엇이 충족되었는지는 아래 항목별 표시가 말합니다).
      // 제목은 종료 화면 부제와 /history 회차 카드에 그대로 실리므로 같은 기준을 받습니다.
      title: "현관 앞 장면을 돌아보는 한 문장이 남았습니다",
      verdict: "부분 충족",
      condition: "초조도 2~3, 현관 이탈했으나 원인 미확인",
      message:
        "마무리 돌아보기에서 한 문장이 남았습니다. 오늘 무엇이 충족되었고 무엇이 남았는지는 아래에서 확인해 주세요.",
    },
    {
      id: "E-위기",
      title: "문이 열렸습니다",
      verdict: "재시도",
      condition: "문 개방·외출 시도 성공",
      message:
        "실제 현장이라면 이 시점에 기관 보고와 실종 신고 판단이 필요합니다. 재시도 1회를 벌점 없이 제공합니다.",
    },
    {
      id: "E-CF",
      title: "한 지점만 다시 보고 가겠습니다",
      verdict: "재훈련",
      condition: "신체 억제·문 잠금·밀기·끌기 선택",
      message:
        "노인복지법 제39조의9는 신체 자유를 제한하는 행위를 금지합니다. 대안 행동 3개를 확인하신 뒤, 멈췄던 이 지점부터 다시 이어가 보시겠어요?",
    },
  ],
  appliedRubric: [
    "SA-01",
    "SA-02",
    "SA-03",
    "SA-04",
    "SA-08",
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
  sourceDocs: ["DOC-GUIDE-001", "DOC-LAW-003", "DOC-NOTI-002"],
  reportCues: ["지금 있었던 일을 기관에 보고한다고 생각하고, 말로 보고해 주세요."],
  active: true,
};

export default CHK_A01;
