/**
 * CHK-C01 「온 김에 반찬 좀」 — 설계서 §3.3 전문 인코딩.
 *
 * 유형 ③ 이용자·보호자 갈등 화법 · 난이도 중급 · 소요 약 5분 · 계층 L1+L2
 * 기능 F1 시뮬레이터 + F3 기록 코칭
 *
 * 이 시나리오의 목표는 "잘 거절하기"가 아니라 "혼자 감당하지 않는 경로(기록·보고)로 이동하기"입니다.
 * 판정선 분리: ⚑CF는 신체 안전과 법적 금지행위에만 적용하고,
 * 존엄·관계 위반(어르신 앞 험담, 폭언 맞대응)은 별도의 '재훈련 권고' 선으로 둡니다.
 *
 * 상태 흐름: S1 요구(T1/CUE-1) → S2 압박(T2/CUE-2) → S3 폭언·격하
 *          → S4 기관 언급 압박(T3/CUE-3, 트리거 T-1) → 어르신 청취(T4/CUE-4, 트리거 T-2)
 *          → S5 보고·기록(CUE-5~7)
 *
 * 판정 공정성 (8/6 감사 기준을 전 CUE로 소급)
 *  - 모든 CUE에 **중립 미분류 분기**(…-n)를 두고 defaultBranchId를 그리로 돌렸습니다.
 *    말이 신호에 걸리지 않았다는 것과 잘못 대응했다는 것은 다른 사실입니다. 「침묵으로 넘김」·
 *    「미보고」 같은 판정은 학습자가 **실제로 그렇게 답했을 때만**(패턴 일치·버튼 선택) 붙습니다.
 */

import type { Scenario } from "@/types";

/** 중립 미분류 분기의 코칭 문구 — 감점이 아니라 **다시 말할 기회**입니다. */
const UNCLEAR_COACHING =
  "잘 전달되지 않았습니다. 지금 하신 말씀은 판정에 넣지 않았으니, 한 문장으로 짧게 다시 말씀해 주시거나 아래 버튼에서 골라 주세요.";

/* 미분류(-n) 분기의 next는 **같은 CUE**입니다(2026-08-26 · 체류 원칙).
   말이 닿지 않았다는 이유로 다음 장면으로 떠밀면 하시려던 말을 할 자리가 사라집니다.
   되묻지는 않습니다(확정 원칙) — 그 자리에 머물고 보기 버튼을 그대로 열어 둘 뿐입니다.
   예외 자리에는 아래 문구를 쓰고, 각 분기 주석에 사유를 적었습니다. */
/** 회차를 닫는 자리의 코칭 문구 — 그 자리의 대사가 이미 마무리를 알립니다(체류 예외②). */
const UNCLEAR_COACHING_CLOSING =
  "지금 하신 말씀은 판정에 넣지 않았습니다. 오늘 방문은 여기서 마무리됩니다.";

export const CHK_C01: Scenario = {
  id: "CHK-C01",
  title: "온 김에 반찬 좀",
  type: "CONFLICT",
  typeLabel: "이용자·보호자 갈등 화법",
  level: 2,
  levelLabel: "중급",
  durationMin: 5,
  tiers: ["L1", "L2"],
  summary:
    "업무 범위 밖 요구와 호칭 격하 앞에서, 관계를 깨지 않고 경계를 세운 뒤 기록과 보고로 옮기는 연습입니다.",
  objectives: [
    "LO-1 업무 범위 밖 요구를 계약·법정 근거로 설명하며 거절합니다. (CO-06, SA-08)",
    "LO-2 관계를 훼손하지 않는 3단 화법(공감 → 불가 사유 → 대안)을 실행합니다. (RE-05)",
    "LO-3 폭언 발생 시 감정적 맞대응 없이 중단 요청 → 거리 확보 → 보고로 이동합니다. (RE-06, CO-04)",
    "LO-4 대상자(어르신) 앞에서 갈등 노출을 최소화하고 존엄을 보호합니다. (CO-07)",
    "LO-5 발생 사실을 감정 형용사 없이 기록·보고합니다. (CL-01, CL-02, CL-03)",
  ],
  personas: [
    {
      role: "guardian",
      name: "보호자 김 씨 (가상 인물)",
      profile:
        "어르신의 딸, 50대 후반, 직장인, 주 1회 토요일 방문하십니다. 어머니는 뇌졸중 후 거동이 불편하시고 방문요양 이용 3개월차입니다. 이전 요양보호사 2명이 3개월 내 교체된 이력이 있습니다. 요구는 늘 \"부탁\"의 형식으로 시작하고, 거절하면 비교(\"다른 선생님은 다 해줬는데\")로 압박하십니다.",
    },
    {
      role: "learner",
      name: "신규 요양보호사 (사용자 본인)",
      profile: "배정 2주차입니다.",
    },
    {
      role: "care_recipient",
      name: "어르신 (가상 인물)",
      profile:
        "보호자의 어머니이십니다. 뇌졸중 후 거동이 불편하시며, 옆방에 계시고 부엌의 대화가 들립니다.",
    },
  ],
  context:
    "서비스 종료 15분 전입니다. 부엌에서 어르신 저녁 준비를 마무리하는 중, 보호자가 부엌 입구에 서십니다. 어르신은 옆방에 계시고, 대화가 들립니다.",
  constraints: [
    "C1 어르신이 옆방에서 대화를 듣고 계십니다.",
    "C2 종료 15분 전입니다 — 거절하면 남은 시간이 어색해집니다.",
    "C3 센터 관리자가 통화 중이어서 즉시 연락이 불가능합니다.",
    "C4 기관은 이용자 이탈을 원치 않습니다 — 보호자 편을 들 가능성이 구조적으로 높습니다.",
    "C5 이전 요양보호사 2명 교체 이력이 있어 재계약이 불안합니다.",
  ],
  gauge: {
    label: "긴장도",
    start: 1,
    max: 5,
    crisisAt: 5,
    crisisEndingId: "E-실패",
  },
  entryTurnId: "T1",
  turns: [
    /* ── S1 요구 ─────────────────────────────────────────────────── */
    {
      id: "T1",
      speaker: "guardian",
      speakerName: "보호자 김 씨",
      text: "선생님, 오신 김에요. 우리 아들이 주말에 오는데 김치찌개 좀 끓여놓고 가시면 안 될까? 어차피 부엌에 계시잖아.",
      stageDirection: "부엌 입구에 서서 웃으며 말씀하십니다.",
      cue: {
        id: "CUE-1",
        prompt: "무엇이라고 답하시겠습니까?",
        waitSec: 8,
        // 미분류(음성 인식 실패 포함)는 중립 분기로 받습니다 — 「회피」로 찍지 않습니다.
        defaultBranchId: "D1-n",
        branches: [
          {
            id: "D1-c",
            label: "3단 화법 (공감 → 불가 사유 → 대안)",
            patterns: [
              "신경 쓰이시겠",
              "마음 쓰이시겠",
              "다만",
              "정해져 있어서",
              "신체·일상 지원",
              "신체 일상 지원",
              "가족분 식사",
              "해드릴 수 없",
              "어렵습니다",
              "대신",
              "넉넉히",
              "가능해요",
              "가능합니다",
              "업무 범위",
              "급여 범위",
            ],
            fallbackOption:
              "아드님 오신다니 신경 쓰이시겠어요. 다만 제가 하는 일은 어머님 신체·일상 지원으로 정해져 있어서, 가족분 식사 준비는 제가 해드릴 수 없어요. 대신 어머님 저녁 반찬을 조금 넉넉히 만들어 두는 건 가능해요.",
            gaugeDelta: -1,
            aiReaction: "…그래요? 그럼 뭐…",
            rubricHits: [
              { itemId: "RE-05", score: 4 },
              { itemId: "CO-06", score: 4 },
              { itemId: "SA-08", score: 3 },
            ],
            praise:
              "공감·불가 사유·대안 세 요소를 모두 쓰셨습니다. 관계를 지키면서 경계를 세운 화법입니다.",
            docId: "DOC-GUIDE-006",
            next: "T2",
          },
          {
            id: "D1-a",
            label: "즉시 수용",
            patterns: ["해드릴게요", "해드리죠", "네 그럴게요", "알겠습니다 해", "끓여드릴"],
            fallbackOption: "네, 해드릴게요",
            gaugeDelta: 0,
            // 반응 대사는 바로 다음 턴 [T-1P]가 맡습니다 (같은 대사가 두 번 찍히지 않도록).
            aiReaction: "",
            rubricHits: [
              { itemId: "CO-06", score: 1 },
              { itemId: "RE-05", score: 1 },
              { itemId: "SA-08", score: 1 },
            ],
            coaching:
              "한 번 받아 드리면 요구는 곧 넓어집니다. \"제가 하는 일은 어머님 신체·일상 지원으로 정해져 있어요\" 하고 범위부터 말씀드려 주세요.",
            docId: "DOC-GUIDE-006",
            triggerId: "T-1P",
            next: "T-1P",
          },
          {
            id: "D1-b",
            label: "단호 거절만",
            patterns: [
              "제 업무가 아닙니다",
              "업무가 아니",
              "규정상 안 됩니다",
              "안 됩니다",
              "못 합니다",
              "그런 건 안",
            ],
            fallbackOption: "그건 제 업무가 아닙니다",
            gaugeDelta: 2,
            aiReaction: "…아니 뭘 그렇게까지.",
            aiReactionNote: "표정이 굳으십니다.",
            rubricHits: [
              { itemId: "CO-06", score: 3 },
              { itemId: "RE-05", score: 2 },
            ],
            praise: "업무 범위를 분명히 하신 점은 지켜졌습니다.",
            coaching:
              "불가 사유 앞에 \"아드님 오신다니 신경 쓰이시겠어요\"를, 뒤에 \"어머님 반찬은 넉넉히 만들어 둘게요\"를 붙여 보세요.",
            docId: "DOC-GUIDE-006",
            next: "T2",
          },
          {
            id: "D1-d",
            label: "회피",
            patterns: ["시간이 좀", "오늘은 좀", "글쎄요", "생각해 볼", "곤란"],
            fallbackOption: "제가 시간이 좀…",
            gaugeDelta: 1,
            aiReaction: "금방이면 되잖아요.",
            aiReactionNote: "요구를 다시 하십니다.",
            rubricHits: [{ itemId: "RE-05", score: 2 }],
            coaching:
              "시간을 이유로 미루면 다음 주에 같은 부탁이 다시 옵니다. 오늘 이 자리에서 업무 범위를 한 문장으로 말씀드려 주세요.",
            docId: "DOC-GUIDE-006",
            next: "T2",
          },
          {
            // 미분류(음성 인식 실패 포함) 전용 중립 분기 — 게이지 변동 0, 루브릭 반영 없음.
            id: "D1-n",
            label: "무응답·미분류",
            patterns: [],
            gaugeDelta: 0,
            aiReaction: "…네? 잘 못 들었는데요.",
            aiReactionNote: "부엌 입구에 그대로 서 계십니다.",
            rubricHits: [],
            coaching: UNCLEAR_COACHING,
            docId: "DOC-GUIDE-006",
            next: "T1",
          },
        ],
      },
    },

    /* ── 돌발 변수 T-1' 「요구 확대」 (D1-a 수용 시) ────────────────── */
    {
      id: "T-1P",
      speaker: "guardian",
      speakerName: "보호자 김 씨",
      text: "아, 그리고 베란다 창문도 좀…",
      stageDirection: "수용한 요구가 곧바로 확대됩니다.",
      isTrigger: true,
      triggerName: "T-1' 요구 확대",
      autoNext: "T2",
    },

    /* ── S2 압박 · S3 폭언·격하 ──────────────────────────────────── */
    {
      id: "T2",
      speaker: "guardian",
      speakerName: "보호자 김 씨",
      text: "다른 선생님은 다 해줬는데. 이모님, 유난이시네. 돈 받고 오시는 거 아니에요?",
      stageDirection: "호칭이 낮아지고 반말이 섞입니다.",
      cue: {
        id: "CUE-2",
        prompt: "어떻게 대응하시겠습니까?",
        waitSec: 8,
        // 미분류를 「침묵으로 넘김」(D2-d)에 매핑하지 않습니다 — 말이 닿지 않은 것과
        // 입을 다물기로 한 것은 다른 사실입니다.
        defaultBranchId: "D2-n",
        branches: [
          {
            id: "D2-c",
            label: "호칭 요청 + 경계 유지",
            patterns: [
              "선생님이라고",
              "선생님으로",
              "선생님입니다",
              "선생님이라 불러",
              "이모님 아니",
              "이모 아니",
              "호칭",
              "그렇게 불러주시면",
              "감사하겠습니다",
              "돌봄에 대해서는",
              "어머님 돌봄",
              "무엇이든 말씀해",
            ],
            fallbackOption:
              "선생님이라고 불러주시면 감사하겠습니다. 어머님 돌봄에 대해서는 무엇이든 말씀해 주세요.",
            gaugeDelta: -1,
            aiReaction: "…뭐, 알겠어요.",
            rubricHits: [
              { itemId: "RE-06", score: 4 },
              { itemId: "CO-07", score: 4 },
            ],
            praise:
              "감정으로 받지 않고 호칭만 정정 요청하셨습니다. 경계는 세우고 관계는 남기는 대응입니다.",
            docId: "DOC-LAW-007",
            next: "T3",
          },
          {
            id: "D2-a",
            label: "감정 맞대응",
            patterns: [
              "저도 사람인데",
              "말씀이 심하",
              "그런 말씀은",
              "무슨 말을 그렇게",
              "기분 나쁘",
              "저도 할 말",
            ],
            fallbackOption: "저도 사람인데요. 말씀이 심하세요.",
            gaugeDelta: 2,
            aiReaction: "뭐라고요? 지금 나한테 대드는 거예요?",
            aiReactionNote: "목소리가 커집니다. 옆방까지 들립니다.",
            rubricHits: [{ itemId: "RE-06", score: 1 }],
            coaching:
              "톤을 올리면 다툼이 되고 옆방 어르신께도 들립니다. \"그 말씀은 어렵습니다\" 한 문장으로 끊고 하던 일로 돌아가 주세요.",
            docId: "DOC-LAW-007",
            triggerId: "T-2",
            next: "T3",
          },
          {
            id: "D2-b",
            label: "무한 사과",
            patterns: ["죄송합니다", "죄송해요", "미안합니다", "제가 잘못"],
            fallbackOption: "죄송합니다, 죄송합니다",
            gaugeDelta: 1,
            aiReaction: "죄송하면 해주면 되잖아요.",
            rubricHits: [{ itemId: "RE-06", score: 2 }],
            coaching:
              "사과만 하면 경계가 생기지 않아 같은 요구가 다시 옵니다. \"선생님이라고 불러주시면 감사하겠습니다\"처럼 바라는 것을 한 문장으로 말씀해 주세요.",
            docId: "DOC-LAW-007",
            next: "T3",
          },
          {
            id: "D2-d",
            label: "침묵으로 넘김",
            // 「말하지 않기로 했다」는 판정도 학습자가 실제로 그렇게 답했을 때만 내립니다.
            patterns: [
              "아무 말 없이",
              "말없이",
              "대답하지 않",
              "대답 안",
              "못 들은 척",
              "그냥 넘기",
              "침묵",
            ],
            fallbackOption: "아무 말 없이 하던 일을 계속합니다",
            gaugeDelta: 1,
            aiReaction: "말이 없으시네. 그럼 해주시는 걸로 알게요.",
            rubricHits: [{ itemId: "RE-06", score: 2 }],
            coaching:
              "침묵은 동의로 읽힙니다. \"그건 제가 해 드릴 수 없어요\" 한 문장만이라도 소리 내어 주세요.",
            docId: "DOC-LAW-007",
            next: "T3",
          },
          {
            id: "D2-n",
            label: "무응답·미분류",
            patterns: [],
            gaugeDelta: 0,
            aiReaction: "…네? 잘 안 들렸어요. 다시 말씀해 보세요.",
            rubricHits: [],
            coaching: UNCLEAR_COACHING,
            docId: "DOC-LAW-007",
            next: "T2",
          },
        ],
      },
    },

    /* ── 돌발 변수 T-1 「센터장 압박」 (알파 100% 고정 발동) ────────── */
    {
      id: "T3",
      speaker: "guardian",
      speakerName: "보호자 김 씨",
      text: "됐어요. 센터에 전화해서 사람 바꿔달라고 할 거예요.",
      stageDirection: "이 시나리오의 핵심 측정 지점입니다.",
      isTrigger: true,
      triggerName: "T-1 센터장 압박",
      cue: {
        id: "CUE-3",
        prompt: "무엇이라고 답하시겠습니까?",
        waitSec: 8,
        // 이 시나리오의 핵심 측정 지점입니다. 미분류(음성 인식 실패 포함)를 감점 분기(D3-d 사과·애원)에
        // 매핑하면 '말이 전달되지 않은 것'이 '애원한 것'으로 낙인되므로 중립 분기로 받습니다.
        defaultBranchId: "D3-n",
        branches: [
          {
            id: "D3-a",
            label: "절차로 이동",
            // 설계서 §3.3 D3-a 원문에서 '드리' 두 글자만 빠져도 최고점이 뒤집히지 않도록 넓혔습니다.
            patterns: [
              "센터에 그대로 보고",
              "센터에 보고",
              "그대로 보고",
              "보고드리",
              "보고하겠",
              "보고할",
              "저도 보고",
              "말씀드리겠",
              "그대로 전달",
              "함께 확인하시면",
              "같이 확인",
              "기록",
            ],
            fallbackOption:
              "네, 저도 오늘 있었던 일을 센터에 그대로 보고드리겠습니다. 함께 확인하시면 좋겠습니다.",
            gaugeDelta: 0,
            aiReaction: "…그렇게까지 할 일인가.",
            rubricHits: [
              { itemId: "CO-04", score: 4 },
              { itemId: "RE-07", score: 4 },
              { itemId: "CO-05", score: 3 },
            ],
            praise:
              "혼자 감당하지 않고 기록과 보고를 통해 절차로 옮기신 것이 가장 안전한 대응입니다. 기록은 나중에 나를 지키는 근거가 됩니다.",
            docId: "DOC-NOTI-002",
            next: "T4",
          },
          {
            id: "D3-b",
            label: "위축 후 수용 (경계 붕괴)",
            patterns: [
              "제가 해드릴게요",
              "해드릴게요",
              "아니에요 제가",
              "그냥 할게요",
              "그러지 마시고",
            ],
            fallbackOption: "아니에요, 제가 해드릴게요",
            gaugeDelta: 0,
            aiReaction: "진작 그러시지.",
            rubricHits: [
              { itemId: "CO-04", score: 1 },
              { itemId: "RE-05", score: 1 },
            ],
            coaching:
              "여기서 수용하면 다음 요구의 기준선이 됩니다. 보고 경로로 옮기는 것이 나를 지키는 길입니다.",
            docId: "DOC-NOTI-002",
            next: "end:E-실패",
          },
          {
            id: "D3-c",
            label: "대립",
            patterns: ["그러세요", "저도 할 말", "마음대로 하", "저도 가만있지"],
            fallbackOption: "그러세요, 저도 할 말 있습니다",
            gaugeDelta: 1,
            aiReaction: "지금 협박하는 거예요?",
            rubricHits: [{ itemId: "RE-06", score: 2 }],
            coaching: "맞서기보다 사실을 기록하고 절차로 옮기는 편이 안전합니다.",
            docId: "DOC-LAW-007",
            next: "T4",
          },
          {
            id: "D3-d",
            label: "사과·애원",
            patterns: ["한 번만", "봐주세요", "죄송합니다", "부탁드립니다", "그러지 마세요"],
            fallbackOption: "한 번만 봐주세요",
            gaugeDelta: 1,
            aiReaction: "그러니까 해달라는 거 좀 해주시라니까.",
            rubricHits: [
              { itemId: "RE-06", score: 2 },
              { itemId: "CO-04", score: 2 },
            ],
            coaching:
              "\"저도 오늘 일을 센터에 그대로 보고드리겠습니다\" 한 문장이면, 상황이 개인의 부탁에서 기관의 절차로 넘어갑니다.",
            docId: "DOC-NOTI-002",
            next: "T4",
          },
          {
            // 미분류(음성 인식 실패 포함) 전용 중립 분기 — 게이지 변동 0, 루브릭 반영 없음.
            id: "D3-n",
            label: "무응답·미분류",
            patterns: [],
            gaugeDelta: 0,
            aiReaction: "…네? 뭐라고 하셨어요?",
            rubricHits: [],
            coaching: UNCLEAR_COACHING,
            docId: "DOC-NOTI-002",
            next: "T3",
          },
        ],
      },
    },

    /* ── 돌발 변수 T-2 「어르신 청취」 ───────────────────────────────
     * 명세상 발동 조건은 "D2-a 또는 긴장도 ≥ 3"이지만, 알파 데모에서 CO-07 측정 지점을
     * 반드시 통과하도록 턴 그래프에서는 항상 이어지게 연결했습니다. (조건은 triggers[]에 보존)
     */
    {
      id: "T4",
      speaker: "elder",
      speakerName: "어르신",
      text: "…왜 그래? 무슨 일 있어?",
      stageDirection: "옆방에서, 불안한 목소리로 물으십니다.",
      isTrigger: true,
      triggerName: "T-2 어르신 청취",
      cue: {
        id: "CUE-4",
        prompt: "어떻게 하시겠습니까?",
        waitSec: 6,
        // 어르신을 못 들은 척한 것과, 말이 닿지 않은 것은 다른 사실입니다.
        defaultBranchId: "C4-n",
        branches: [
          {
            id: "C4-a",
            label: "어르신 안심 + 장소 이동 제안",
            patterns: [
              "아무 일 없어요",
              "괜찮아요 어머님",
              "걱정 마세요",
              "이쪽에서 말씀",
              "잠시 이쪽",
              "자리를 옮겨",
              "저쪽에서 말씀",
              "나가서 말씀",
            ],
            fallbackOption:
              "어머님, 아무 일 없어요. (보호자에게) 잠시 이쪽에서 말씀 나누실까요?",
            gaugeDelta: -1,
            aiReaction: "…그래, 알았어.",
            aiReactionNote: "어르신의 목소리가 편안해지십니다.",
            rubricHits: [
              { itemId: "CO-07", score: 4 },
              { itemId: "SA-04", score: 4 },
            ],
            praise:
              "어르신을 먼저 안심시키고 대화 장소를 옮기셨습니다. 갈등 노출을 최소화한 판단입니다.",
            docId: "DOC-LAW-003",
            next: "T5",
          },
          {
            id: "C4-b",
            label: "어르신 앞에서 보호자와 계속 언쟁",
            // 버튼 문구(행동 서술)를 그대로 말했을 때도 같은 분기로 오도록 포함시켰습니다.
            patterns: [
              "아니 그게 아니고",
              "제 말 좀 들어",
              "그러니까 제가",
              "말씀이 심하",
              "언쟁을 이어",
              "그대로 언쟁",
            ],
            fallbackOption: "어르신 앞에서 그대로 언쟁을 이어갑니다",
            // 게이지 변동 0 — '재훈련 권고'는 긴장도가 아니라 존엄·관계 위반 자체로 결정되는 별도 판정선입니다.
            // 여기서 긴장도를 올리면 위기 엔딩(E-실패)이 먼저 발동해 재훈련 권고 판정이 가려집니다.
            gaugeDelta: 0,
            aiReaction: "…나 때문에 그러는 거야?",
            aiReactionNote: "어르신 목소리가 더 불안해지십니다.",
            rubricHits: [{ itemId: "CO-07", score: 1 }],
            coaching:
              "어르신 앞에서의 언쟁은 어르신의 존엄과 안정에 영향을 줍니다. \"잠시 이쪽에서 말씀 나누실까요?\" 하고 자리를 먼저 옮겨 주세요.",
            docId: "DOC-LAW-003",
            retrainAdvice: true,
            next: "T5",
          },
          {
            id: "C4-c",
            label: "어르신 앞에서 보호자 험담",
            // 버튼 문구(행동 서술)를 그대로 말했을 때도 같은 분기로 오도록 포함시켰습니다.
            patterns: ["따님이", "저분이", "글쎄 저러시", "어머님 딸이", "말도 안 되는", "험담"],
            fallbackOption: "어르신 앞에서 보호자에 대해 험담합니다",
            // 게이지 변동 0 — 위와 같은 이유입니다. (재훈련 권고 판정선 보존)
            gaugeDelta: 0,
            aiReaction: "…우리 딸이 뭘 어쨌다고.",
            rubricHits: [{ itemId: "CO-07", score: 1 }],
            coaching:
              "가족에 대한 평가를 어르신 앞에서 말하지 않습니다. 사실은 기록으로 남기면 됩니다.",
            docId: "DOC-LAW-003",
            retrainAdvice: true,
            next: "T5",
          },
          {
            id: "C4-d",
            label: "못 들은 척하고 대화 지속",
            // 버튼 문구(행동 서술)를 그대로 말했을 때도 같은 분기로 오도록 포함시켰습니다.
            patterns: [
              "못 들은 척",
              "무시하",
              "대답하지 않",
              "대답 안",
              "하던 이야기",
              "계속 이야기",
              "그냥 계속",
            ],
            fallbackOption: "어르신 부르심을 못 들은 척하고 대화를 계속합니다",
            gaugeDelta: 1,
            aiReaction: "…아무도 대답을 안 해주네.",
            rubricHits: [{ itemId: "CO-07", score: 2 }],
            coaching:
              "어르신이 부르시면 \"아무 일 없어요, 어머님\" 한마디를 먼저 드리고 대화를 이어 주세요.",
            docId: "DOC-LAW-003",
            next: "T5",
          },
          {
            id: "C4-n",
            label: "무응답·미분류",
            patterns: [],
            gaugeDelta: 0,
            aiReaction: "…응? 무슨 소리야?",
            aiReactionNote: "옆방에서 다시 물으십니다.",
            rubricHits: [],
            coaching: UNCLEAR_COACHING,
            docId: "DOC-LAW-003",
            next: "T4",
          },
        ],
      },
    },

    /* ── S5 보고·기록 (기능③ 연동) ───────────────────────────────── */
    {
      id: "T5",
      speaker: "system",
      speakerName: "보고·기록",
      text: "보호자가 돌아가셨습니다. 오늘 일을 센터에 보고할 차례입니다.",
      cue: {
        id: "CUE-5",
        prompt: "오늘 일을 센터에 보고한다고 생각하고 말로 보고해 주세요.",
        waitSec: 8,
        // 상식적인 보고 문장이 신호에 걸리지 않았다고 「미보고」(R1-c)로 찍지 않습니다.
        defaultBranchId: "R1-n",
        branches: [
          {
            id: "R1-a",
            label: "시각·요구 내용·본인 응답·상대 반응을 사실만",
            patterns: [
              "16시 45분",
              "16시",
              "4시 45분",
              "가족 식사 준비",
              "요청하셨",
              "업무 범위상",
              "안내드렸습니다",
              "호칭",
              "정정 요청",
              "센터에 연락하겠다",
              "말씀하셨습니다",
            ],
            fallbackOption:
              "16시 45분, 보호자께서 가족 식사 준비를 요청하셨고, 업무 범위상 어렵다고 안내드렸습니다. 이후 호칭 관련해 정정 요청을 드렸고, 보호자께서 센터에 연락하겠다고 하셨습니다.",
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
            next: "T6",
          },
          {
            id: "R1-b",
            label: "감정 형용사 사용",
            patterns: ["무례하게", "황당하게", "기분 나쁘게", "어이없", "너무했", "불쾌"],
            fallbackOption: "보호자가 무례하게 굴어서 황당했습니다",
            gaugeDelta: 0,
            aiReaction: "보고가 접수되었습니다.",
            rubricHits: [
              { itemId: "CL-02", score: 2 },
              { itemId: "CL-01", score: 2 },
              { itemId: "CL-03", score: 2 },
              { itemId: "CO-08", score: 3 },
            ],
            coaching:
              "\"무례하게\"·\"황당했다\" 같은 말은 빼고, 보호자께서 하신 말과 제가 드린 답만 그대로 적어 주세요.",
            docId: "DOC-NOTI-002",
            next: "T6",
          },
          {
            id: "R1-c",
            label: "미보고",
            patterns: ["보고 안", "말 안 하", "괜히 일 키", "그냥 넘어가", "별일 아니"],
            fallbackOption: "괜히 일 키우기 싫어서 보고하지 않겠습니다",
            gaugeDelta: 0,
            aiReaction: "보고 내용이 등록되지 않았습니다.",
            rubricHits: [
              { itemId: "CO-04", score: 1 },
              { itemId: "CL-01", score: 1 },
              { itemId: "CL-03", score: 1 },
            ],
            coaching:
              "혼자 감당하면 다음에도 혼자입니다. 기록과 보고가 나를 지키는 채널이 됩니다.",
            docId: "DOC-LAW-007",
            next: "T6",
          },
          {
            id: "R1-n",
            label: "무응답·미분류",
            patterns: [],
            gaugeDelta: 0,
            aiReaction: "보고 내용이 잘 전달되지 않았습니다.",
            rubricHits: [],
            coaching: UNCLEAR_COACHING,
            docId: "DOC-NOTI-002",
            next: "T5",
          },
        ],
      },
    },
    {
      id: "T6",
      speaker: "system",
      speakerName: "보고·기록",
      text: "보고 내용을 확인했습니다. 다음을 위한 제안을 남길 차례입니다.",
      cue: {
        id: "CUE-6",
        prompt: "같은 요구가 반복되지 않으려면, 무엇을 바꿔볼 수 있을까요?",
        waitSec: 8,
        defaultBranchId: "R2-n",
        branches: [
          {
            id: "R2-a",
            label: "구체적 재발 방지 제안",
            patterns: [
              "업무 범위 안내문",
              "안내문",
              "초기 방문",
              "서비스 계획서",
              "사본",
              "비치",
              "즉시 기록",
              "기록 습관",
              "센터와 함께",
            ],
            fallbackOption:
              "초기 방문 때 업무 범위 안내문을 전달하고, 서비스 계획서 사본을 비치하겠습니다. 요구가 생기면 그 자리에서 기록하겠습니다.",
            gaugeDelta: 0,
            aiReaction: "제안이 기록에 반영되었습니다.",
            rubricHits: [{ itemId: "CL-04", score: 4 }],
            praise: "실행 주체와 시점이 있는 제안입니다. 센터와 함께 바로 적용할 수 있습니다.",
            docId: "DOC-GUIDE-006",
            next: "T7",
          },
          {
            id: "R2-b",
            label: "추상적 제안",
            patterns: ["잘 말씀드리", "더 신경", "조심하", "노력하겠"],
            fallbackOption: "다음엔 더 잘 말씀드리겠습니다",
            gaugeDelta: 0,
            aiReaction: "제안이 기록에 반영되었습니다.",
            rubricHits: [{ itemId: "CL-04", score: 2 }],
            coaching:
              "\"초기 방문 때 업무 범위 안내문을 드리겠습니다\"처럼 무엇을 언제 하겠다는 형태로 바꿔 보세요.",
            docId: "DOC-GUIDE-006",
            next: "T7",
          },
          {
            id: "R2-c",
            label: "제안 없음",
            patterns: ["없습니다", "모르겠", "생각 안"],
            fallbackOption: "특별히 떠오르는 것이 없습니다",
            gaugeDelta: 0,
            aiReaction: "제안 없이 기록이 마감되었습니다.",
            rubricHits: [{ itemId: "CL-04", score: 1 }],
            coaching:
              "업무 범위 안내문 한 장을 초기 방문 때 드리는 것만으로도 다음 대화가 훨씬 쉬워집니다.",
            docId: "DOC-GUIDE-006",
            next: "T7",
          },
          {
            id: "R2-n",
            label: "무응답·미분류",
            patterns: [],
            gaugeDelta: 0,
            aiReaction: "제안이 잘 전달되지 않았습니다.",
            rubricHits: [],
            coaching: UNCLEAR_COACHING,
            docId: "DOC-GUIDE-006",
            next: "T6",
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
            // "다음엔"·"하겠습니다"는 존댓말 종결 표지일 뿐이라 4점 신호가 될 수 없어 뺐습니다.
            patterns: [
              "공감",
              "대안을",
              "대안부터",
              "3단",
              "호칭",
              "자리를 옮",
              "장소를 옮",
              "기록하겠",
              "보고하겠",
              "업무 범위",
            ],
            fallbackOption: "다음엔 거절 앞에 공감 한 문장을 먼저 붙이겠습니다",
            gaugeDelta: 0,
            aiReaction: "오늘 훈련을 마쳤습니다.",
            rubricHits: [
              { itemId: "CL-05", score: 4 },
              { itemId: "RE-08", score: 3 },
            ],
            praise: "고칠 점을 한 문장으로 정리하셨습니다.",
            next: "end:E-성공",
          },
          {
            id: "R3-b",
            label: "성찰이 막연함",
            // 기본값이 중립 분기로 옮겨 갔으므로 버튼 문구도 여기서 직접 걸려야 합니다.
            patterns: [
              "잘 못했",
              "잘 못한",
              "어려웠",
              "모르겠",
              "그냥",
              "조심",
              "신경 쓰",
              "노력하겠",
              "잘하겠",
            ],
            fallbackOption: "잘 못한 것 같습니다",
            gaugeDelta: 0,
            aiReaction: "오늘 훈련을 마쳤습니다.",
            rubricHits: [{ itemId: "CL-05", score: 2 }],
            coaching:
              "\"거절 앞에 공감 한 문장을 먼저 붙이겠습니다\"처럼, 다음 대화에서 바꿀 말 하나를 정해 보세요.",
            next: "end:E-부분",
          },
          {
            id: "R3-n",
            label: "무응답·미분류",
            patterns: [],
            gaugeDelta: 0,
            aiReaction: "오늘 훈련을 마쳤습니다.",
            rubricHits: [],
            /* 체류 원칙의 **예외②** — 회차를 닫는 자리입니다. 이 분기의 대사가 이미
               마무리를 알리고, 새 대사를 더하는 것은 금지라(오디오 재합성) 여기서는 진행이 맞습니다. */
            coaching: UNCLEAR_COACHING_CLOSING,
            next: "end:E-부분",
          },
        ],
      },
    },
  ],
  triggers: [
    {
      id: "T-1P",
      name: "요구 확대",
      condition: "D1-a(즉시 수용) 선택 시",
      description:
        "수용한 요구가 곧바로 확대됩니다. \"아, 그리고 베란다 창문도 좀…\" (측정: CO-06, RE-05)",
    },
    {
      id: "T-1",
      name: "센터장 압박",
      condition: "CUE-2 종료 후 (알파 100% 고정 발동)",
      description:
        "보호자: \"됐어요. 센터에 전화해서 사람 바꿔달라고 할 거예요.\" 목표는 잘 거절하기가 아니라 혼자 감당하지 않는 경로(기록·보고)로 이동하는 것입니다. (측정: CO-04, RE-07)",
    },
    {
      id: "T-2",
      name: "어르신 청취",
      condition: "D2-a 또는 긴장도 ≥ 3 시 발동 (알파 데모에서는 CO-07 측정 보장을 위해 항상 통과)",
      description:
        "옆방에서 어르신이 불안한 목소리로 물으십니다. \"…왜 그래? 무슨 일 있어?\" 갈등 노출을 최소화하고 존엄을 보호하는지 봅니다. (측정: CO-07, SA-04)",
    },
  ],
  endings: [
    {
      id: "E-성공",
      title: "경계도 관계도 지키셨습니다",
      verdict: "충족",
      condition: "경계 유지 + 관계 유지(긴장도 ≤ 2) + 보고 경로 확보(D3-a)",
      message:
        "거절이 관계를 깨지 않았고, 오늘 일이 기록으로 남았습니다. 충족하신 원칙과 근거 출처를 확인해 주세요.",
    },
    {
      id: "E-부분",
      // 이 엔딩은 마지막 돌아보기 한 문장(CUE-7)으로만 갈립니다 — 기록·보고 경로를 잡고도
      // 여기로 옵니다. 그래서 **제목도 문구도** 기록이 남았는지를 단정하지 않고 실제 갈림
      // 사유만 적습니다(그 판정은 아래 항목별 표시가 합니다).
      // 제목은 종료 화면 부제와 /history 회차 카드에 그대로 실리므로 같은 기준을 받습니다.
      title: "부엌에서의 대화를 돌아보는 한 문장이 남았습니다",
      verdict: "부분 충족",
      condition: "경계는 유지했으나 보고 미이행",
      message:
        "마무리 돌아보기에서 한 문장이 남았습니다. 경계와 기록이 어디까지 닿았는지는 아래에서 확인해 주세요.",
    },
    {
      id: "E-실패",
      title: "경계가 무너졌습니다",
      verdict: "재시도",
      condition: "요구 수용(경계 붕괴) 또는 관계 파탄(긴장도 5)",
      message:
        "이 지점의 수용은 다음 요구의 기준선이 됩니다. 다시 한 번 해 보실 수 있습니다. 점수는 매기지 않습니다.",
    },
    {
      id: "E-재훈련권고",
      title: "존중의 자리를 다시 보고 가겠습니다",
      verdict: "재훈련 권고",
      condition: "폭언에 폭언으로 대응 / 어르신 앞 험담",
      message:
        "⚑CF는 아닙니다. 안전 위험이 아니라 존엄·관계에 대한 부분이므로, 이 장면으로 돌아가 다시 연습해 보시길 권해 드립니다. 점수는 매기지 않습니다.",
    },
  ],
  appliedRubric: [
    "SA-04",
    "SA-08",
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
  sourceDocs: ["DOC-NOTI-002", "DOC-GUIDE-006", "DOC-LAW-007", "DOC-LAW-003"],
  reportCues: ["오늘 일을 센터에 보고한다고 생각하고 말로 보고해 주세요."],
  active: true,
};

export default CHK_C01;
