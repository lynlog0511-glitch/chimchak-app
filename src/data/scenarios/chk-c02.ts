/**
 * CHK-C02 「어머니 팔에 멍이 있어요」 — 알파 초안(현직 감수 대기).
 *
 * 유형 ③ 이용자·보호자 갈등 화법 · 난이도 고급 · 소요 약 5분 · 계층 L1+L2
 * 기능 F1 시뮬레이터 + F3 기록 코칭
 *
 * 편성 근거: 설계서 §9.1 확장 매트릭스의 「C02 사고 책임 추궁·계약 해지 위협」 칸입니다.
 * C01(업무 외 요구·호칭 격하)과 겹치지 않도록 **원인이 확인되지 않은 상해 정황**을 다루고,
 * 목표를 「잘 해명하기」가 아니라 「확인된 것과 확인되지 않은 것을 갈라 기록·보고로 옮기기」에 둡니다.
 *
 * 판정선 분리 (설계서 §3.3) — 이 시나리오에도 ⚑CF는 **신체 안전·법적 금지행위에만** 둡니다.
 * 보호자가 야간 신체 억제를 요구하는 지점(T-C1)이 그 하나이며, 요구를 받았다는 사실이
 * 금지행위를 허용하지 않는다는 것을 규칙 엔진이 그대로 판정합니다(CO-02).
 * 어르신 앞 언쟁·험담 같은 존엄·관계 위반은 ⚑CF가 아니라 '재훈련 권고' 선으로 둡니다.
 *
 * 대사·지문은 검수된 고정 문구(앵커)이며, 경량 LLM(교체형 어댑터)이 붙더라도
 * 이 앵커에서 이탈하면 템플릿 고정 대사로 되돌립니다.
 *
 * 상태 흐름: S1 추궁(T1/CUE-1) → S2 책임 압박(T2/CUE-2) → [C-1 억제 요구](CUE-C1, ⚑CF)
 *          → S3 계약 해지 위협(T3/CUE-3) → [C-2 어르신 청취](CUE-C2) → S4 보고·기록(CUE-4~6)
 */

import type { Scenario } from "@/types";

/** CO-02 ⚑CF 인터럽트 고정 문구 — 요구를 받았다는 사실이 금지행위를 허용하지 않습니다. */
const CF_RESTRAINT_REQUEST_MESSAGE =
  "잠시 멈추겠습니다. 보호자께서 요청하셨더라도, 묶거나 방문을 잠가 못 나오시게 하는 것은 노인복지법 제39조의9가 금지하는 신체 자유의 제한입니다. 동의를 받았다고 해서 허용되지 않습니다. 지금 하실 수 있는 것은 ①할 수 없는 이유를 법적 근거로 말씀드리기 ②대신 할 수 있는 환경 조정을 제안하기 ③요구받은 사실과 답변을 그대로 기록하기입니다. 다시 해보시겠어요?";

const CF_RESTRAINT_REQUEST_ALTERNATIVES = [
  "\"그건 법으로 금지된 일이라 해 드릴 수 없습니다\" 하고 근거를 들어 말씀드립니다.",
  "\"대신 야간 등을 켜 두고 침대 주변을 함께 정리해 보겠습니다\" 하고 대안을 제안합니다.",
  "요구받은 내용과 제가 드린 답변을 그대로 기록에 남기고 센터에 보고합니다.",
];

/**
 * CO-02 ⚑CF 판정 신호 (신체 억제·문 잠금·억제대).
 *
 * 규칙 사전 `rules.ts`의 `RESTRAINT_RULES.terms`와 같은 기준이며, 한국어 활용형을 놓치지
 * 않도록 **어간까지만** 남깁니다("잠그/잠급/잠갔/잠금/잠가/잠글").
 * ※ "신체 억제" 같은 **명사구는 넣지 않습니다** — 보고 단계에서 "신체 억제 요구가 있었습니다"
 *    처럼 사실을 적는 문장이 위반으로 잡히면 기록을 남기지 말라는 신호가 되기 때문입니다.
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
  "못 나오게 막",
  "문 잠",
  "문을 잠",
  "도어락을 잠",
  "도어락 잠",
  "잠가",
  "잠갔",
  "잠급",
  "잠글",
  "잠금",
  "묶어",
  "묶고",
  "묶어두",
  "묶어 두",
  "결박",
  "끈으로 고정",
  "억제대",
  "보호대로 고정",
  "가둬",
  "가두",
];

export const CHK_C02: Scenario = {
  id: "CHK-C02",
  title: "어머니 팔에 멍이 있어요",
  type: "CONFLICT",
  typeLabel: "이용자·보호자 갈등 화법",
  level: 3,
  levelLabel: "고급",
  durationMin: 5,
  tiers: ["L1", "L2"],
  summary:
    "원인이 확인되지 않은 멍을 두고 책임을 추궁받을 때, 단정하지 않고 기록과 보고로 옮기는 연습입니다.",
  objectives: [
    "LO-1 확인된 사실과 확인되지 않은 것을 갈라 진술합니다. (SA-05, CL-02)",
    "LO-2 사고 정황을 기관 보고·기록 대상으로 판단하고 경로를 밝힙니다. (CO-04, CO-05)",
    "LO-3 보호자의 신체 억제 요구를 법적 근거로 거절하고 대안을 제시합니다. (CO-02 ⚑CF, CO-06, RE-05)",
    "LO-4 폭언·해지 위협에 맞대응하지 않고 절차와 인수인계로 이동합니다. (RE-06, RE-07, SA-07)",
    "LO-5 어르신 앞에서 갈등 노출을 최소화하고 다른 이용자 정보를 옮기지 않습니다. (CO-07, CO-08)",
  ],
  personas: [
    {
      role: "guardian",
      name: "보호자 아드님 (가상 인물)",
      profile:
        "어르신의 아들, 60대 초반, 자영업, 주 2회 저녁에 들르십니다. 어머니 일에 관해서는 늘 \"누가 그랬느냐\"부터 물으시고, 답이 늦으면 기관에 먼저 전화하십니다. 지난주 미끄러짐 이후로 말이 짧아지셨습니다.",
    },
    {
      role: "care_recipient",
      name: "윤 어르신 (가상 인물)",
      profile:
        "여성 85세 · 파킨슨병으로 보행이 불안정하시고 방문요양 이용 7개월차입니다. 팔에 멍이 잘 드시고 말수가 적으십니다. 지금 거실 소파에 앉아 이 대화를 듣고 계십니다.",
    },
    {
      role: "learner",
      name: "요양보호사 (사용자 본인)",
      profile: "이 가정 배정 4개월차 · 단독 방문입니다.",
    },
  ],
  context:
    "오후 5시입니다. 서비스 종료 30분 전, 어르신 저녁 준비를 마친 참에 아드님이 들어오십니다. 어머니 왼팔 소매를 걷어 보시더니 멍을 발견하십니다. 어르신은 거실 소파에 앉아 이 대화를 듣고 계십니다.",
  constraints: [
    "C1 어르신이 같은 공간에서 대화를 듣고 계십니다.",
    "C2 센터 관리자가 퇴근해 즉시 연락이 어렵고, 당직 번호만 열려 있습니다.",
    "C3 지난주 미끄러짐은 그날 기록지에 남겼고, 오늘 멍의 발생 시점은 확인되지 않았습니다.",
    "C4 기관은 이용자 이탈을 원치 않아 보호자 편에 설 가능성이 구조적으로 높습니다.",
    "C5 어떤 요청이 있어도 신체 억제·방문 잠금은 허용되지 않습니다 (노인복지법상 금지행위).",
  ],
  gauge: {
    label: "긴장도",
    start: 2,
    max: 5,
    crisisAt: 5,
    crisisEndingId: "E-결렬",
  },
  entryTurnId: "T1",
  turns: [
    /* ── S1 추궁 ─────────────────────────────────────────────────── */
    {
      id: "T1",
      speaker: "guardian",
      speakerName: "보호자 아드님",
      text: "이 멍 뭐예요? 어머니 팔에 이런 게 왜 있어요?",
      stageDirection: "어머니 소매를 걷은 채 돌아보십니다.",
      cue: {
        id: "CUE-1",
        prompt: "무엇이라고 답하시겠습니까?",
        waitSec: 8,
        defaultBranchId: "B1-d",
        branches: [
          {
            id: "B1-a",
            label: "본 것과 확인되지 않은 것을 갈라 진술",
            patterns: [
              "확인되지 않",
              "확인된 것",
              "제가 본 것은",
              "오늘 뵀을 때",
              "언제 생겼는지",
              "지금은 알 수 없",
              "사실만",
              "기록을 확인",
              "지난주",
              "미끄러지",
              "그대로 말씀",
            ],
            fallbackOption:
              "제가 오늘 뵀을 때는 멍이 없었고, 언제 생겼는지는 확인되지 않았습니다. 지난주 미끄러지신 일은 그날 기록지에 남겼습니다.",
            gaugeDelta: -1,
            aiReaction: "…기록이 있어요?",
            rubricHits: [
              { itemId: "SA-05", score: 4 },
              { itemId: "CL-02", score: 4 },
              { itemId: "CO-05", score: 3 },
            ],
            praise:
              "본 것과 확인되지 않은 것을 나눠 말씀하셨습니다. 이렇게 적어 둔 기록이 이런 순간에 나를 지킵니다.",
            docId: "DOC-NOTI-002",
            next: "T2",
          },
          {
            id: "B1-b",
            label: "즉시 사과·자책",
            patterns: ["죄송합니다", "제 잘못", "제가 못 봐서", "미안합니다", "제 탓"],
            fallbackOption: "죄송합니다, 제가 못 봐서 그렇습니다",
            gaugeDelta: 1,
            aiReaction: "그러니까 선생님이 그랬다는 거네요?",
            rubricHits: [
              { itemId: "CL-02", score: 2 },
              { itemId: "RE-06", score: 2 },
            ],
            coaching:
              "확인되지 않은 일을 먼저 인정하면 사실과 책임이 뒤섞입니다. 본 것부터 말씀해 주세요.",
            docId: "DOC-NOTI-002",
            next: "T2",
          },
          {
            id: "B1-c",
            label: "방어·부인",
            patterns: ["저는 아니", "제가 안 그랬", "저 아니에요", "그럴 리가", "저한테 왜"],
            fallbackOption: "저는 아닙니다, 그럴 리가 없어요",
            gaugeDelta: 1,
            aiReaction: "그럼 누가 그랬다는 거예요?",
            aiReactionNote: "목소리가 커지십니다.",
            rubricHits: [
              { itemId: "CL-02", score: 2 },
              { itemId: "RE-06", score: 1 },
            ],
            coaching:
              "부인부터 하면 대화가 책임 다툼이 됩니다. 확인된 사실과 확인되지 않은 것을 나눠 주세요.",
            docId: "DOC-LAW-007",
            next: "T2",
          },
          {
            id: "B1-d",
            label: "회피·모름",
            patterns: ["글쎄요", "잘 모르겠", "저도 방금", "그러게요"],
            fallbackOption: "글쎄요, 저도 잘 모르겠습니다",
            gaugeDelta: 1,
            aiReaction: "모른다고요? 하루 종일 계셨잖아요.",
            rubricHits: [
              { itemId: "SA-05", score: 1 },
              { itemId: "CL-02", score: 2 },
            ],
            coaching: "모른다는 말 대신, 오늘 본 것과 보지 못한 것을 나눠 말씀해 주세요.",
            docId: "DOC-NOTI-002",
            next: "T2",
          },
        ],
      },
    },

    /* ── S2 책임 압박 ────────────────────────────────────────────── */
    {
      id: "T2",
      speaker: "guardian",
      speakerName: "보호자 아드님",
      text: "지난주엔 넘어졌다면서요. 이번엔 멍이고. 어머니를 어떻게 보시는 거예요?",
      stageDirection: "목소리가 낮아지고 말이 빨라지십니다.",
      cue: {
        id: "CUE-2",
        prompt: "어떻게 대응하시겠습니까?",
        waitSec: 8,
        defaultBranchId: "B2-d",
        branches: [
          {
            id: "B2-a",
            label: "사실 정리 + 기록·보고 경로 제시",
            patterns: [
              "기록지",
              "기록에",
              "기록으로",
              "남겼습니다",
              "남기겠",
              "센터에",
              "당직",
              "보고드리",
              "보고하겠",
              "함께 확인",
              "같이 확인",
            ],
            fallbackOption:
              "지난주 일도 기록지에 남겼고, 오늘 멍도 보이는 그대로 기록하고 센터에 보고드리겠습니다. 함께 확인해 주시면 좋겠습니다.",
            gaugeDelta: -1,
            aiReaction: "…그럼 그 기록 좀 봅시다.",
            rubricHits: [
              { itemId: "CO-04", score: 4 },
              { itemId: "CO-05", score: 4 },
              { itemId: "RE-07", score: 4 },
            ],
            praise:
              "혼자 감당하지 않고 기록과 보고로 옮기셨습니다. 상황이 개인의 해명에서 기관의 절차로 넘어갑니다.",
            docId: "DOC-NOTI-002",
            next: "T-C1",
          },
          {
            id: "B2-b",
            label: "공감만 하고 다음 절차 없음",
            patterns: ["걱정되시겠", "놀라셨겠", "마음이", "속상하시겠", "이해합니다"],
            fallbackOption: "많이 놀라셨겠어요",
            gaugeDelta: 0,
            aiReaction: "놀란 게 문제가 아니잖아요.",
            rubricHits: [
              { itemId: "RE-05", score: 2 },
              { itemId: "CO-04", score: 2 },
            ],
            coaching: "공감 다음에 무엇을 어떻게 확인하고 남길지까지 말씀해 주세요.",
            docId: "DOC-GUIDE-006",
            next: "T-C1",
          },
          {
            id: "B2-c",
            label: "다른 이용자 이야기로 해명",
            patterns: ["다른 집", "다른 어르신도", "앞 선생님이", "전에 오시던", "다른 이용자"],
            fallbackOption: "제가 가는 다른 집 어르신도 이런 멍이 자주 있으세요",
            gaugeDelta: 1,
            aiReaction: "남의 집 얘기를 왜 여기서 해요?",
            rubricHits: [
              { itemId: "CO-08", score: 1 },
              { itemId: "CL-02", score: 2 },
            ],
            coaching: "다른 이용자의 이야기는 어떤 경우에도 이 자리에 옮기지 않습니다.",
            docId: "DOC-NOTI-002",
            next: "T-C1",
          },
          {
            id: "B2-d",
            label: "침묵·회피",
            patterns: [],
            gaugeDelta: 1,
            aiReaction: "말이 없으시네. 인정하시는 거죠?",
            rubricHits: [
              { itemId: "RE-06", score: 2 },
              { itemId: "CO-04", score: 1 },
            ],
            coaching: "침묵은 인정으로 읽힙니다. 짧게라도 확인된 사실과 보고 계획을 말씀해 주세요.",
            docId: "DOC-LAW-007",
            next: "T-C1",
          },
        ],
      },
    },

    /* ── 돌발 변수 C-1 「억제 요구」 — 이 시나리오의 ⚑CF 측정 지점 ───── */
    {
      id: "T-C1",
      speaker: "guardian",
      speakerName: "보호자 아드님",
      text: "밤에 혼자 일어나시다 그런 거면, 침대에 묶어두든지 방문을 잠그든지 하세요. 그게 안전한 거 아니에요?",
      stageDirection: "요구의 형식이 부탁에서 지시로 바뀝니다.",
      isTrigger: true,
      triggerName: "C-1 억제 요구",
      cue: {
        id: "CUE-C1",
        prompt: "무엇이라고 답하시겠습니까?",
        waitSec: 8,
        // 미분류(음성 인식 실패 포함)를 감점 분기에 매핑하지 않습니다 — 중립 분기로 받습니다.
        defaultBranchId: "K-n",
        branches: [
          {
            id: "K-a",
            label: "법적 근거로 거절 + 대안 제시",
            patterns: [
              "법으로 금지",
              "노인복지법",
              "금지된",
              "할 수 없습니다",
              "해서는 안",
              "야간 등",
              "침대 주변",
              "센터와 함께",
              "낙상 예방",
              "환경을",
            ],
            fallbackOption:
              "묶거나 방문을 잠그는 것은 법으로 금지된 신체 자유 제한이라 해 드릴 수 없습니다. 대신 야간 등을 켜 두고 침대 주변을 함께 정리하는 방법을 센터와 의논드리겠습니다.",
            gaugeDelta: -1,
            aiReaction: "…법이 그래요?",
            rubricHits: [
              { itemId: "CO-02", score: 4 },
              { itemId: "CO-06", score: 4 },
              { itemId: "RE-05", score: 4 },
            ],
            praise:
              "요구를 받았다고 해서 할 수 있는 일이 되지는 않습니다. 근거를 들어 거절하고 대안까지 얹으셨습니다.",
            docId: "DOC-LAW-003",
            next: "T3",
          },
          {
            id: "K-b",
            label: "곤란하다고만 함",
            patterns: ["곤란합니다", "어렵습니다", "그건 좀", "제가 결정할", "센터에 물어", "저는 못"],
            fallbackOption: "그건 제가 결정할 일이 아니라서 곤란합니다",
            gaugeDelta: 0,
            aiReaction: "그럼 누가 결정하는데요?",
            rubricHits: [
              { itemId: "CO-06", score: 2 },
              { itemId: "RE-05", score: 2 },
            ],
            coaching:
              "왜 할 수 없는지 근거를 한 문장으로 말씀해 주세요. 근거가 없으면 같은 요구가 다시 옵니다.",
            docId: "DOC-GUIDE-006",
            next: "T3",
          },
          {
            id: "K-c",
            label: "요구 수용 — 신체 억제·방문 잠금 (⚑CF)",
            patterns: RESTRAINT_PATTERNS,
            fallbackOption: "말씀대로 밤에는 방문을 잠가 두겠습니다",
            gaugeDelta: 0,
            aiReaction: "그래요, 그렇게 해요.",
            aiReactionNote: "요구가 그대로 굳어집니다.",
            rubricHits: [{ itemId: "CO-02", score: 1 }],
            criticalFail: true,
            cfMessage: CF_RESTRAINT_REQUEST_MESSAGE,
            cfAlternatives: CF_RESTRAINT_REQUEST_ALTERNATIVES,
            docId: "DOC-LAW-003",
            next: "T-C1",
          },
          {
            id: "K-n",
            label: "무응답·미분류",
            patterns: [],
            gaugeDelta: 0,
            aiReaction: "…대답을 안 하시네요.",
            rubricHits: [],
            coaching:
              "잘 전달되지 않았습니다. 한 문장으로 짧게 다시 말씀하시거나, 아래 버튼에서 골라 주세요.",
            docId: "DOC-LAW-003",
            next: "T3",
          },
        ],
      },
    },

    /* ── S3 계약 해지 위협 ───────────────────────────────────────── */
    {
      id: "T3",
      speaker: "guardian",
      speakerName: "보호자 아드님",
      text: "됐고요. 이런 데 못 맡기겠어요. 센터에 전화해서 계약 끊겠습니다.",
      cue: {
        id: "CUE-3",
        prompt: "무엇이라고 답하시겠습니까?",
        waitSec: 8,
        defaultBranchId: "H-n",
        branches: [
          {
            id: "H-a",
            label: "절차로 이동 + 어르신 서비스 연속성 확보",
            patterns: [
              "센터에 그대로",
              "그대로 보고",
              "보고드리겠",
              "보고하겠",
              "함께 확인하시면",
              "같이 확인",
              "기록을 보시면",
              "인수인계",
              "서비스가 끊기지",
              "공백 없이",
            ],
            fallbackOption:
              "네, 오늘 있었던 일을 센터에 그대로 보고드리겠습니다. 결정하시더라도 어머님 서비스가 끊기지 않도록 센터와 인수인계를 준비하겠습니다.",
            gaugeDelta: 0,
            aiReaction: "…어머니 서비스는 어떻게 되는데요?",
            rubricHits: [
              { itemId: "CO-04", score: 4 },
              { itemId: "RE-07", score: 4 },
              { itemId: "SA-07", score: 4 },
            ],
            praise:
              "붙잡지 않고 절차와 어르신의 연속성으로 답하셨습니다. 계약이 어떻게 되든 어르신이 남습니다.",
            docId: "DOC-NOTI-002",
            next: "T-C2",
          },
          {
            id: "H-b",
            label: "애원·위축",
            patterns: ["한 번만", "봐주세요", "그러지 마세요", "제발", "제가 잘하겠", "다시는"],
            fallbackOption: "한 번만 봐주세요, 제가 더 잘하겠습니다",
            gaugeDelta: 1,
            aiReaction: "잘하고 말고의 문제가 아니라니까요.",
            rubricHits: [
              { itemId: "RE-06", score: 2 },
              { itemId: "CO-04", score: 2 },
            ],
            coaching: "애원 대신 보고와 인수인계를 말씀하시면 상황이 개인에서 절차로 넘어갑니다.",
            docId: "DOC-NOTI-002",
            next: "T-C2",
          },
          {
            id: "H-c",
            label: "맞대응",
            patterns: ["마음대로 하", "그러세요", "저도 할 말", "저도 가만있지", "그렇게 나오시면"],
            fallbackOption: "마음대로 하세요. 저도 가만있지 않겠습니다.",
            gaugeDelta: 2,
            aiReaction: "지금 저를 협박하시는 거예요?",
            rubricHits: [{ itemId: "RE-06", score: 1 }],
            coaching:
              "맞서면 그 자리에 남는 것은 어르신입니다. 사실을 기록하고 절차로 옮기는 편이 안전합니다.",
            docId: "DOC-LAW-007",
            next: "T-C2",
          },
          {
            id: "H-n",
            label: "무응답·미분류",
            patterns: [],
            gaugeDelta: 0,
            aiReaction: "…지금 뭐라고 하신 거예요?",
            rubricHits: [],
            coaching:
              "잘 전달되지 않았습니다. 한 문장으로 짧게 다시 말씀하시거나, 아래 버튼에서 골라 주세요.",
            docId: "DOC-NOTI-002",
            next: "T-C2",
          },
        ],
      },
    },

    /* ── 돌발 변수 C-2 「어르신 청취」 ────────────────────────────── */
    {
      id: "T-C2",
      speaker: "elder",
      speakerName: "윤 어르신",
      text: "…나 때문에 싸우는 거야?",
      stageDirection: "소파에 앉으신 채 두 사람을 번갈아 보십니다.",
      isTrigger: true,
      triggerName: "C-2 어르신 청취",
      cue: {
        id: "CUE-C2",
        prompt: "어떻게 하시겠습니까?",
        waitSec: 6,
        defaultBranchId: "W-d",
        branches: [
          {
            id: "W-a",
            label: "어르신 안심 + 장소 이동 제안",
            patterns: [
              "아니에요 어머님",
              "아무 일 없어요",
              "걱정 마세요",
              "어머님 잘못",
              "잠시 이쪽",
              "자리를 옮겨",
              "저쪽에서 말씀",
              "나가서 말씀",
              "밖에서 말씀",
            ],
            fallbackOption:
              "어머님, 어머님 잘못이 아니에요. (아드님께) 잠시 저쪽에서 말씀 나누실까요?",
            gaugeDelta: -1,
            aiReaction: "…나는 괜찮아요.",
            aiReactionNote: "어깨에서 힘이 조금 풀리십니다.",
            rubricHits: [
              { itemId: "CO-07", score: 4 },
              { itemId: "SA-04", score: 4 },
            ],
            praise:
              "어르신을 먼저 안심시키고 자리를 옮기셨습니다. 갈등이 어르신 앞에서 이어지지 않게 한 판단입니다.",
            docId: "DOC-LAW-003",
            next: "T4",
          },
          {
            id: "W-b",
            label: "어르신 앞에서 말다툼 지속",
            // 버튼 문구(행동 서술)를 그대로 말했을 때도 같은 분기로 오도록 포함시켰습니다.
            patterns: [
              "아니 그게 아니고",
              "제 말 좀 들어",
              "그러니까 제가",
              "언쟁을 이어",
              "그대로 말다툼",
            ],
            fallbackOption: "어르신 앞에서 그대로 말다툼을 이어갑니다",
            // 게이지 변동 0 — '재훈련 권고'는 긴장도가 아니라 존엄 위반 자체로 결정되는 별도 판정선입니다.
            gaugeDelta: 0,
            aiReaction: "…나 때문이구나.",
            aiReactionNote: "고개를 숙이십니다.",
            rubricHits: [{ itemId: "CO-07", score: 1 }],
            coaching:
              "어르신 앞에서의 다툼은 어르신의 존엄과 안정에 영향을 줍니다. 자리를 먼저 옮겨 주세요.",
            docId: "DOC-LAW-003",
            retrainAdvice: true,
            next: "T4",
          },
          {
            id: "W-c",
            label: "어르신께 그 자리에서 사실 확인을 요구",
            patterns: [
              "어머님이 말씀해",
              "어르신이 말씀 좀",
              "언제 다치셨",
              "누가 그랬는지",
              "말씀해 보세",
            ],
            fallbackOption: "어머님, 이 멍 언제 생긴 건지 말씀해 보세요",
            gaugeDelta: 1,
            aiReaction: "…나는 몰라. 미안해.",
            rubricHits: [
              { itemId: "CO-07", score: 2 },
              { itemId: "SA-08", score: 2 },
            ],
            coaching:
              "확인이 필요하더라도 두 분 사이에서 어르신께 답을 요구하지 않습니다. 어르신께는 안심을 먼저 드려 주세요.",
            docId: "DOC-LAW-003",
            next: "T4",
          },
          {
            id: "W-d",
            label: "무시하고 대화 지속",
            patterns: [],
            gaugeDelta: 1,
            aiReaction: "…내 말은 안 들리나 보네.",
            rubricHits: [{ itemId: "CO-07", score: 2 }],
            coaching: "부르셨을 때 짧게라도 대답해 드리면 불안이 줄어듭니다.",
            docId: "DOC-LAW-003",
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
      text: "아드님이 돌아가셨습니다. 오늘 일을 센터에 보고할 차례입니다.",
      cue: {
        id: "CUE-4",
        prompt: "오늘 있었던 일을 센터 당직에 보고한다고 생각하고 말로 보고해 주세요.",
        waitSec: 8,
        defaultBranchId: "V-c",
        branches: [
          {
            id: "V-a",
            label: "시각·관찰·요구·본인 응답을 사실만",
            patterns: [
              "17시",
              "오후 5시",
              "왼팔",
              "멍을 확인",
              "확인되지 않",
              "요구하셨",
              "안내드렸습니다",
              "계약 해지",
              "보고드립니다",
              "보고드리겠습니다",
            ],
            fallbackOption:
              "17시경 보호자께서 어르신 왼팔의 멍을 확인하셨고, 발생 시점은 확인되지 않았다고 안내드렸습니다. 밤에 어머님을 못 움직이게 해 달라는 요구가 있어 법으로 허용되지 않는다고 말씀드렸으며, 계약 해지 의사도 함께 전달드립니다.",
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
            praise: "시각과 사실만으로 정리하셨습니다. 그대로 기록지에 옮길 수 있습니다.",
            docId: "DOC-NOTI-002",
            next: "T5",
          },
          {
            id: "V-b",
            label: "감정 형용사 사용",
            patterns: ["억울", "무서웠", "황당", "어이없", "너무했", "불쾌", "기분 나쁘"],
            fallbackOption: "보호자께서 몰아세우셔서 억울했습니다",
            gaugeDelta: 0,
            aiReaction: "보고가 접수되었습니다.",
            rubricHits: [
              { itemId: "CL-02", score: 2 },
              { itemId: "CL-01", score: 2 },
              { itemId: "CL-03", score: 2 },
            ],
            coaching:
              "감정 형용사는 빼고, 들은 말과 제가 한 말만 적어 주세요. 사실만 남은 기록이 나를 지킵니다.",
            docId: "DOC-NOTI-002",
            next: "T5",
          },
          {
            id: "V-c",
            label: "미보고",
            patterns: ["그냥 넘어가", "보고 안", "말 안 하", "괜히 일 키", "별일 아니"],
            fallbackOption: "일이 커질까 봐 그냥 넘어가겠습니다",
            gaugeDelta: 0,
            aiReaction: "보고 내용이 등록되지 않았습니다.",
            rubricHits: [
              { itemId: "CO-04", score: 1 },
              { itemId: "CL-01", score: 1 },
              { itemId: "CL-03", score: 1 },
            ],
            coaching:
              "사고 정황과 보호자 요구는 기록·보고 대상입니다. 남기지 않으면 다음에도 혼자 감당하게 됩니다.",
            docId: "DOC-LAW-007",
            next: "T5",
          },
        ],
      },
    },
    {
      id: "T5",
      speaker: "system",
      speakerName: "보고·기록",
      text: "보고 내용을 확인했습니다. 다음을 위한 제안을 남길 차례입니다.",
      cue: {
        id: "CUE-5",
        prompt: "같은 일이 반복되지 않으려면, 무엇을 바꿔볼 수 있을까요?",
        waitSec: 8,
        defaultBranchId: "X-c",
        branches: [
          {
            id: "X-a",
            label: "구체적 재발 방지 제안",
            patterns: [
              "방문 때마다",
              "피부 상태",
              "확인해 기록",
              "야간 등",
              "침대 주변",
              "동선",
              "센터와 함께",
              "초기 안내",
              "낙상 위험 점검",
            ],
            fallbackOption:
              "방문 때마다 피부 상태를 눈으로 확인해 기록에 남기고, 야간 등과 침대 주변 동선을 센터와 함께 점검하겠습니다",
            gaugeDelta: 0,
            aiReaction: "제안이 기록에 반영되었습니다.",
            rubricHits: [{ itemId: "CL-04", score: 4 }],
            praise: "실행 주체와 시점이 있는 제안입니다.",
            docId: "DOC-GUIDE-006",
            next: "T6",
          },
          {
            id: "X-b",
            label: "추상적 제안",
            patterns: ["잘 살펴", "더 신경", "조심하", "노력하겠"],
            fallbackOption: "앞으로 더 조심하겠습니다",
            gaugeDelta: 0,
            aiReaction: "제안이 기록에 반영되었습니다.",
            rubricHits: [{ itemId: "CL-04", score: 2 }],
            coaching: "무엇을 언제 어떻게 하겠다는 형태로 바꿔 보세요.",
            docId: "DOC-GUIDE-006",
            next: "T6",
          },
          {
            id: "X-c",
            label: "제안 없음",
            patterns: ["없습니다", "모르겠", "생각 안"],
            fallbackOption: "따로 떠오르는 것이 없습니다",
            gaugeDelta: 0,
            aiReaction: "제안 없이 기록이 마감되었습니다.",
            rubricHits: [{ itemId: "CL-04", score: 1 }],
            coaching: "방문 때마다 눈으로 확인해 한 줄 남기는 것만으로도 다음 대화가 달라집니다.",
            docId: "DOC-GUIDE-006",
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
        defaultBranchId: "Y-b",
        branches: [
          {
            id: "Y-a",
            label: "개선점 언어화",
            patterns: [
              "사실과 추정",
              "확인되지 않",
              "기록부터",
              "기록으로",
              "근거를",
              "법으로",
              "자리를 옮",
              "장소를 옮",
              "어르신 앞에서는",
              "먼저 안심",
            ],
            fallbackOption:
              "다음엔 부인하기 전에 확인된 사실과 확인되지 않은 것을 먼저 나눠 말씀드리겠습니다",
            gaugeDelta: 0,
            aiReaction: "오늘 훈련을 마쳤습니다.",
            rubricHits: [
              { itemId: "CL-05", score: 4 },
              { itemId: "RE-08", score: 3 },
            ],
            praise: "고칠 점을 한 문장으로 정리하셨습니다.",
            next: "end:E-충족",
          },
          {
            id: "Y-b",
            label: "성찰이 막연함",
            patterns: ["어려웠", "잘 못했", "모르겠", "그냥", "조심", "신경 쓰", "노력하겠", "잘하겠"],
            fallbackOption: "많이 어려웠습니다",
            gaugeDelta: 0,
            aiReaction: "오늘 훈련을 마쳤습니다.",
            rubricHits: [{ itemId: "CL-05", score: 2 }],
            coaching: "무엇을 어떻게 바꿀지 한 가지만 문장으로 정해 보세요.",
            next: "end:E-부분",
          },
        ],
      },
    },
  ],
  triggers: [
    {
      id: "C-1",
      name: "억제 요구",
      condition: "CUE-2 종료 후 (알파에서는 100% 고정 발동)",
      description:
        "보호자: \"침대에 묶어두든지 방문을 잠그든지 하세요.\" 요구를 받았다는 사실이 금지행위를 허용하지 않는다는 것을 규칙 엔진이 그대로 판정합니다. 이 시나리오에서 ⚑CF가 적용되는 유일한 지점입니다. (측정: CO-02, CO-06, RE-05)",
    },
    {
      id: "C-2",
      name: "어르신 청취",
      condition: "CUE-3 종료 후 (알파에서는 100% 고정 발동)",
      description:
        "어르신이 소파에서 두 사람을 번갈아 보시며 \"…나 때문에 싸우는 거야?\" 하고 물으십니다. 갈등 노출을 최소화하고 존엄을 보호하는지 봅니다. (측정: CO-07, SA-04)",
    },
  ],
  endings: [
    {
      id: "E-충족",
      title: "기록으로 답하고, 어르신을 지키셨습니다",
      verdict: "충족",
      condition: "확인되지 않은 것을 단정하지 않음 + 억제 요구 거절 + 보고 경로 확보(H-a)",
      message:
        "해명 대신 기록으로 답하셨고, 어르신이 그 자리에서 혼자가 되지 않았습니다. 충족하신 원칙과 근거 출처를 확인해 주세요.",
    },
    {
      id: "E-부분",
      title: "오늘은 넘겼지만, 남은 기록이 적습니다",
      verdict: "부분 충족",
      condition: "그 자리는 넘겼으나 보고·기록 미이행",
      message:
        "말로 지킨 것은 기록으로 남겨야 남습니다. 다음엔 요구받은 내용과 제가 드린 답변까지 함께 남겨 주세요.",
    },
    {
      id: "E-결렬",
      title: "대화가 끊겼습니다",
      verdict: "재시도",
      condition: "관계 파탄(긴장도 5)",
      message:
        "실제 현장이라면 이 시점에 센터 당직과 관리자에게 즉시 알리는 판단이 필요합니다. 재시도 1회를 벌점 없이 제공합니다.",
    },
    {
      id: "E-재훈련",
      title: "법이 그은 선을 다시 보고 가겠습니다",
      verdict: "재훈련",
      condition: "신체 억제·방문 잠금 요구 수용",
      message:
        "노인복지법 제39조의9는 신체 자유를 제한하는 행위를 금지합니다. 보호자의 요청도 이 선을 넘길 수 없습니다. 대안을 확인하신 뒤, 멈췄던 지점부터 다시 이어가 보시겠어요?",
    },
    {
      id: "E-재훈련권고",
      title: "어르신 앞이라는 조건을 다시 보겠습니다",
      verdict: "재훈련 권고",
      condition: "어르신 앞에서 말다툼 지속",
      message:
        "⚑CF는 아닙니다. 안전 위험이 아니라 존엄에 대한 부분이므로, 벌점 없이 이 장면으로 돌아가 다시 연습해 보시길 권해 드립니다.",
    },
  ],
  appliedRubric: [
    "SA-04",
    "SA-05",
    "SA-07",
    "SA-08",
    "CO-02",
    "CO-04",
    "CO-05",
    "CO-06",
    "CO-07",
    "CO-08",
    "RE-05",
    "RE-06",
    "RE-07",
    "RE-08",
    "CL-01",
    "CL-02",
    "CL-03",
    "CL-04",
    "CL-05",
  ],
  sourceDocs: ["DOC-NOTI-002", "DOC-LAW-003", "DOC-LAW-007", "DOC-GUIDE-006"],
  reportCues: ["오늘 있었던 일을 센터 당직에 보고한다고 생각하고 말로 보고해 주세요."],
  active: true,
};

export default CHK_C02;
