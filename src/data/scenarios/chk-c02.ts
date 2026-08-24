/**
 * CHK-C02 「어머니 팔에 멍이 있어요」 — 알파 초안(현직 감수 대기).
 *
 * 유형 ③ 이용자·보호자 갈등 화법 · 난이도 고급 · 소요 약 6분 · 계층 L1+L2
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
 *          → S3 계약 해지 위협(T3/CUE-3) → [C-2 어르신 청취](CUE-C2)
 *          → [C-3 촬영 요구](CUE-C3) → S4 보고·기록(CUE-C4~C6)
 *
 * 판정 공정성 (8/6 감사 반영)
 *  - 모든 CUE에 **중립 미분류 분기**(…-n)를 두고 defaultBranchId를 그리로 돌렸습니다.
 *    음성 인식이 빗나갔다는 이유로 「미보고」·「회피」 같은 감점 분기가 찍히지 않습니다.
 *    감점 분기는 학습자가 **실제로 그 말을 했을 때**(패턴 일치·버튼 선택)만 열립니다.
 *  - 보고·성찰 CUE는 유일한 id(CUE-C4·CUE-C6)를 달아 규칙 사전(rules.ts)의
 *    `POST_INCIDENT_REPORT_CUES` 게이트를 받습니다. 회고 진술로 적는 "묶어두라는 요구가
 *    있었습니다"가 신체 억제 ⚑CF로 잡히지 않게 하려는 것입니다. 반대로 앞으로의 행위를
 *    말하는 재발 방지 제안(CUE-C5)은 게이트 밖에 두어 억제 판정이 그대로 살아 있습니다.
 *    **이 게이트는 3라운드에 「전면 오프」에서 「순응 문형으로 좁히기」로 바뀌었습니다.**
 *    끄면 회고 진술은 지켜지지만 자리 전체가 비어, 같은 자리에서 "다음엔 그냥
 *    붙잡아야겠어요"·"앞으로는 억제대를 채웁니다"가 아무 되먹임 없이 통과했습니다.
 *  - 요구를 **거절**하는 자리(CUE-C1)와 같은 사실을 **재진술**하는 자리(CUE-C3)는
 *    모범 답안 자체에 금지 행위의 이름이 들어갑니다("결박은 해 드릴 수 없습니다").
 *    이 두 CUE에서는 사전을 끄지 않고 순응 문형으로 좁히고(rules.ts의 `complyOnlyCues`),
 *    실제 수용 발화는 같은 목록을 쓰는 ⚑CF 분기(K-c·J-d)가 함께 받습니다.
 *    두 분기는 **같은 목록**(행위 순응 + 대용어 순응)을 씁니다 — 3라운드까지 J-d에만
 *    대용어가 빠져 있어, "말씀대로 그렇게 할게요"가 C-1에서는 ⚑CF이고 C-3에서는
 *    통과했습니다(같은 요구, 다른 판정선).
 */

import type { Scenario } from "@/types";
import { RESTRAINT_COMPLY_TERMS } from "@/engine/rules";

/**
 * 중립 미분류 분기의 코칭 문구 — 감점이 아니라 **다시 말할 기회**입니다.
 * (같은 자리에 놓이는 문구라 한 곳에서 관리합니다.)
 */
const UNCLEAR_COACHING =
  "말씀이 잘 전달되지 않았습니다. 지금 하신 말씀은 판정에 넣지 않았습니다 — 한 문장으로 짧게 다시 말씀하시거나, 아래 버튼에서 골라 주세요.";

/** CO-02 ⚑CF 인터럽트 고정 문구 — 요구를 받았다는 사실이 금지행위를 허용하지 않습니다. */
const CF_RESTRAINT_REQUEST_MESSAGE =
  "잠시 멈추겠습니다. 보호자께서 요청하셨더라도, 묶거나 방문을 잠가 못 나오시게 하는 것은 노인복지법 제39조의9가 금지하는 신체 자유의 제한입니다. 동의를 받았다고 해서 허용되지 않습니다. 지금 하실 수 있는 것은 ①할 수 없는 이유를 법적 근거로 말씀드리기 ②대신 할 수 있는 환경 조정을 제안하기 ③요구받은 사실과 답변을 그대로 기록하기입니다. 다시 해보시겠어요?";

const CF_RESTRAINT_REQUEST_ALTERNATIVES = [
  "\"그건 법으로 금지된 일이라 해 드릴 수 없습니다\" 하고 근거를 들어 말씀드립니다.",
  "\"대신 야간 등을 켜 두고 침대 주변을 함께 정리해 보겠습니다\" 하고 대안을 제안합니다.",
  "요구받은 내용과 제가 드린 답변을 그대로 기록에 남기고 센터에 보고합니다.",
];

/**
 * CO-02 ⚑CF 판정 신호 (신체 억제·문 잠금·억제대) — **명시적 순응 문형만** 봅니다.
 *
 * 왜 어간이 아니라 순응 문형인가. 이 두 CUE(C-1 억제 요구 거절, C-3 같은 사실 재진술)에서
 * 학습자에게 요구하는 **모범 답안 자체에** 금지 행위의 이름이 들어갑니다 —
 * "결박은 해 드릴 수 없습니다", "묶어 두라는 요구는 받아들이지 않겠습니다".
 * 어간("결박"·"묶어")으로 두면 거절한 사람이 ⚑CF로 멈춰 세워집니다(레드팀 실측).
 * 잘못은 이름을 말할 때가 아니라 **하겠다고 선언할 때** 생깁니다.
 *
 * 목록의 원본은 규칙 사전 하나뿐입니다(`rules.ts`의 `RESTRAINT_COMPLY_TERMS`).
 * 같은 CUE에서 사전은 그 목록으로 좁혀 판정하고(complyOnlyCues) 이 분기는 그 목록으로
 * 분류하므로, 두 벌로 갈라지면 게이트와 분기가 서로 다른 문장을 잡게 됩니다.
 *
 * 대용어 순응("말씀대로 그렇게 하겠습니다")은 전역 사전이 가릴 수 없는 말입니다 —
 * 무엇을 가리키는지는 이 CUE만 알기 때문입니다. 그래서 여기에만 덧댑니다(C-1 전용).
 *
 * 「채우겠」도 같은 이유로 여기에만 둡니다. 보호자가 방금 억제를 요구한 이 자리에서
 * "지금은 채우겠습니다"는 억제대 말고 가리킬 것이 없지만, 보고 구간에서는
 * "기록지를 채우겠습니다"가 정상 발화라 전역 사전에 두면 곧바로 오탐이 됩니다.
 * 「그래도 하겠」 계열은 금지를 **알면서 하겠다**고 잇는 양보 문형입니다 —
 * 앞 절의 부정("허용되지 않지만")이 뒤 절의 실행 선언을 면죄하던 자리입니다.
 *
 * 2라운드 레드팀이 이 목록으로 뚫은 자리를 아래에 덧댑니다 — 요구를 **처리·조치**로
 * 받아 넘기는 꼴("그건 제가 조치하겠습니다"), 요구자를 주어로 세운 꼴("원하시는 대로"),
 * 지시를 옮겨 그대로 따르는 꼴("붙잡으라는 지시대로 하겠습니다")입니다.
 *
 * 넣지 않는 말 — **홑 "알겠습니다"**. "알겠습니다, 하지만 그건 해 드릴 수 없습니다"와
 * "알겠습니다, 그렇게 하겠습니다"가 같은 두 글자로 시작합니다. 모호한 발화의 올바른 처리는
 * ⚑CF가 아니라 K-n(중립 미분류)의 재질문입니다 — 되묻는 비용이 잘못 낙인찍는 비용보다 쌉니다.
 * 같은 이유로 「해 드리겠」·「해 드릴게」는 **부정을 동반하지 않은 꼴만** 담깁니다:
 * "그건 해 드릴 수 없습니다"에는 「해 드리겠」이 들어 있지 않습니다(세션 프로브로 확인).
 */
const RESTRAINT_COMPLY_ANAPHORA = [
  "그렇게 하겠",
  "그렇게 할게",
  "그리하겠",
  "그러겠습니다",
  // 평서·과거형 대용어 — 3라운드 레드팀이 「~겠」만 피해 가며 뚫은 자리입니다.
  // ("가두고 싶은 마음이 커서 오늘부터 그렇게 합니다" · "묶고 싶다 해서 실제로 그리 했습니다")
  "그렇게 합니",
  "그렇게 했",
  "그리 합니",
  "그리 하겠",
  "그리 했",
  "그대로 합니",
  "그대로 하겠",
  "그대로 갑니",
  "그대로 둡니",
  "말씀대로 하겠",
  "말씀대로 할게",
  "말씀하신 대로 하",
  "시키신 대로 하겠",
  "시키는 대로 하겠",
  "요구대로 하겠",
  "하라시는 대로 하겠",
  "원하시는 대로",
  "뜻에 따르",
  "채우겠",
  "채워 두겠",
  "채울게",
  "채웁니",
  "채워야겠",
  "채워만",
  "그래도 하겠",
  "그래도 할게",
  "오늘은 하겠",
  "오늘만 하겠",
  "오늘 밤만 하겠",
  "이번만 하겠",
  "한 번만 하겠",
  "일단 하겠",
  // 요구를 절차 어휘로 받아 넘기는 꼴 — 이 자리에서 「조치」·「처리」의 대상은 억제뿐입니다.
  "조치하겠",
  "처리하겠",
  "해 드리겠",
  "해 드릴게",
  // 지시를 옮겨 그대로 따르는 꼴. 전역 사전은 「무엇을」이 빠진 이 말을 원리상 가릴 수 없어
  // (rules.ts 한계 ②) 여기에만 둡니다 — 대신 "붙잡으라는 지시대로"처럼 행위 이름이 함께
  // 나온 문장은 전역 사전이 그 이름으로 이미 잡습니다.
  "라는 지시대로",
  "라는 대로 하",
  "지시대로 하겠",
  "지시대로 진행",
  // 3라운드 실측 — 「대로」가 아니라 「에 맞춰/에 따라」로 이은 꼴이 그대로 열려 있었습니다.
  "지시에 맞춰",
  "지시에 따라",
  "말씀에 맞춰",
  "요구에 맞춰",
];

/** C-1(억제 요구) 전용 — 행위 순응 문형 + 이 자리에서만 뜻이 확정되는 대용어 순응 */
const RESTRAINT_REQUEST_ACCEPT_PATTERNS = [...RESTRAINT_COMPLY_TERMS, ...RESTRAINT_COMPLY_ANAPHORA];

export const CHK_C02: Scenario = {
  id: "CHK-C02",
  title: "어머니 팔에 멍이 있어요",
  type: "CONFLICT",
  typeLabel: "이용자·보호자 갈등 화법",
  level: 3,
  levelLabel: "고급",
  // 돌발 변수 C-3(촬영 요구)이 한 턴 늘어 6분으로 잡습니다.
  durationMin: 6,
  tiers: ["L1", "L2"],
  summary:
    "원인이 확인되지 않은 멍을 두고 책임을 추궁받을 때, 단정하지 않고 기록과 보고로 옮기는 연습입니다.",
  objectives: [
    "LO-1 확인된 사실과 확인되지 않은 것을 갈라 진술합니다. (SA-05, CL-02)",
    "LO-2 사고 정황을 기관 보고·기록 대상으로 판단하고 경로를 밝힙니다. (CO-04, CO-05)",
    "LO-3 보호자의 신체 억제 요구를 법적 근거로 거절하고 대안을 제시합니다. (CO-02 ⚑CF, CO-06, RE-05)",
    "LO-4 폭언·해지 위협·촬영 요구에 맞대응하거나 진술을 바꾸지 않고 절차와 인수인계로 이동합니다. (RE-06, RE-07, SA-07)",
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
        // 미분류(음성 인식 실패 포함)는 중립 분기로 받습니다 — 「회피」로 찍지 않습니다.
        defaultBranchId: "B1-n",
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
              "확인되지 않은 일을 먼저 인정하면 사실과 책임이 뒤섞입니다. \"제가 오늘 뵀을 때는 멍이 없었습니다\"처럼 본 것부터 말씀해 주세요.",
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
          {
            // 미분류 전용 중립 분기 — 게이지 변동 0, 루브릭 반영 없음.
            id: "B1-n",
            label: "무응답·미분류",
            patterns: [],
            gaugeDelta: 0,
            aiReaction: "…지금 뭐라고 하신 거예요?",
            rubricHits: [],
            coaching: UNCLEAR_COACHING,
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
        defaultBranchId: "B2-n",
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
            coaching:
              "공감 뒤에 \"오늘 멍도 보이는 그대로 기록하고 센터에 보고드리겠습니다\"까지 이어 주세요.",
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
            // 「침묵을 골랐다」는 판정은 학습자가 실제로 그렇게 답했을 때만 내립니다.
            patterns: ["아무 말", "말없이", "말 없이", "침묵", "대답하지 않"],
            fallbackOption: "아무 말 없이 서 있습니다",
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
          {
            id: "B2-n",
            label: "무응답·미분류",
            patterns: [],
            gaugeDelta: 0,
            aiReaction: "…지금 뭐라고 하신 거예요?",
            rubricHits: [],
            coaching: UNCLEAR_COACHING,
            docId: "DOC-NOTI-002",
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
            // 이 분기는 **칭찬**을 내므로 「거절했다」만으로는 열 수 없습니다.
            // 근거 신호(법·금지·지침·규정)나 대안 신호(야간 등·침대 주변·환경)가 있어야 합니다.
            // 홑 「할 수 없습니다」를 여기 두었더니 "지금은 붙잡는 것 말고 달리 할 수 없습니다"가
            // 근거를 든 거절로 칭찬받았습니다(2라운드 실측). 근거 없는 거절은 K-b가 받아
            // 「왜 할 수 없는지 한 문장」을 코칭합니다.
            patterns: [
              "법으로 금지",
              "법이 금지",
              "노인복지법",
              "금지된",
              "금지되어",
              "금지 행위",
              "법으로 허용되지 않",
              "법상 허용되지 않",
              "지침상",
              "규정상",
              "규정으로",
              "기관 지침",
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
            label: "근거 없이 거절만 함",
            // 거절 자체는 옳으므로 감점이 아니라 **부분 인정 + 근거 코칭**입니다.
            // K-a보다 뒤에 두어, 근거·대안이 함께 있으면 K-a가 먼저 가져갑니다.
            patterns: [
              "곤란합니다",
              "곤란",
              "어렵습니다",
              "그건 좀",
              "제가 결정할",
              "센터에 물어",
              "저는 못",
              "할 수 없습니다",
              "드릴 수 없",
              "허용되지 않",
              "받아들이지 않",
              "못 합니다",
              "안 됩니다",
              "사양",
            ],
            fallbackOption: "그건 제가 결정할 일이 아니라서 곤란합니다",
            gaugeDelta: 0,
            aiReaction: "그럼 누가 결정하는데요?",
            rubricHits: [
              { itemId: "CO-06", score: 2 },
              { itemId: "RE-05", score: 2 },
            ],
            coaching:
              "\"노인복지법이 금지하는 신체 자유 제한이라 해 드릴 수 없습니다\"처럼 근거를 한 문장으로 붙여 주세요. 근거가 없으면 같은 요구가 다시 옵니다.",
            docId: "DOC-GUIDE-006",
            next: "T3",
          },
          {
            id: "K-c",
            label: "요구 수용 — 신체 억제·방문 잠금 (⚑CF)",
            patterns: RESTRAINT_REQUEST_ACCEPT_PATTERNS,
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
            coaching: UNCLEAR_COACHING,
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
            coaching:
              "애원 대신 \"센터에 그대로 보고드리고 인수인계를 준비하겠습니다\" 하고 절차를 말씀해 주세요.",
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
            coaching: UNCLEAR_COACHING,
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
        defaultBranchId: "W-n",
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
            next: "T-C3",
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
              "\"잠시 저쪽에서 말씀 나누실까요?\" 하고 자리부터 옮겨 주세요. 어르신은 이 다툼을 당신 탓으로 들으십니다.",
            docId: "DOC-LAW-003",
            retrainAdvice: true,
            next: "T-C3",
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
            next: "T-C3",
          },
          {
            id: "W-d",
            label: "어르신 말씀에 답하지 않음",
            // 「대답하지 않기로 했다」는 판정도 실제로 그렇게 답했을 때만 내립니다.
            patterns: ["대답하지 않", "못 들은 척", "무시하", "답하지 않"],
            fallbackOption: "어르신 말씀에 대답하지 않고 아드님과의 대화를 이어갑니다",
            gaugeDelta: 1,
            aiReaction: "…내 말은 안 들리나 보네.",
            rubricHits: [{ itemId: "CO-07", score: 2 }],
            coaching:
              "어르신이 부르시면 하던 말을 잠깐 멈추고 \"어머님, 괜찮아요\" 한마디를 먼저 드려 주세요.",
            docId: "DOC-LAW-003",
            next: "T-C3",
          },
          {
            id: "W-n",
            label: "무응답·미분류",
            patterns: [],
            gaugeDelta: 0,
            // 어르신께는 「대답이 오지 않았다」는 사실만 같습니다 — 같은 반응 대사를 씁니다.
            aiReaction: "…내 말은 안 들리나 보네.",
            rubricHits: [],
            coaching: UNCLEAR_COACHING,
            docId: "DOC-LAW-003",
            next: "T-C3",
          },
        ],
      },
    },

    /* ── 돌발 변수 C-3 「촬영 요구」 — 고급 난이도의 근거 지점 ───────── */
    {
      id: "T-C3",
      speaker: "guardian",
      speakerName: "보호자 아드님",
      text: "잠깐만요. 지금부터 녹음하겠습니다. 방금 하신 말씀 다시 해 보세요.",
      stageDirection:
        "휴대전화를 들어 어르신 팔 쪽으로 화면을 돌리십니다. 어르신도 그 화면 안에 들어옵니다.",
      isTrigger: true,
      triggerName: "C-3 촬영 요구",
      cue: {
        id: "CUE-C3",
        prompt: "무엇이라고 답하시겠습니까?",
        waitSec: 8,
        defaultBranchId: "J-n",
        branches: [
          {
            id: "J-a",
            label: "같은 사실을 그대로 다시 진술 + 어르신 촬영은 의사 확인",
            patterns: [
              "같은 말씀",
              "그대로 다시",
              "그대로 말씀드리",
              "다시 말씀드리",
              "어머님께 여쭤",
              "어머님 의사",
              "어르신 의사",
              "동의를 여쭤",
              "화면에 담기",
              "이 통화도 기록",
              "이 일도 기록",
              "기록에 남기겠",
            ],
            fallbackOption:
              "네, 같은 말씀을 그대로 다시 드리겠습니다. 다만 어머님이 화면에 담기는 것은 어머님께 먼저 여쭤봐 주시면 좋겠습니다. 촬영 요청이 있었다는 것도 기록에 남기겠습니다.",
            gaugeDelta: -1,
            aiReaction: "…그럼 그대로 다시 말해 봐요.",
            rubricHits: [
              { itemId: "CL-02", score: 4 },
              { itemId: "CO-08", score: 4 },
              { itemId: "RE-06", score: 4 },
              { itemId: "SA-05", score: 3 },
            ],
            praise:
              "찍힌다고 해서 말이 달라지지 않았습니다. 같은 사실을 같은 문장으로 두 번 말할 수 있는 것이 기록의 힘입니다.",
            docId: "DOC-NOTI-002",
            next: "T4",
          },
          {
            id: "J-b",
            label: "말을 바꾸거나 사과로 덮음",
            patterns: [
              "죄송합니다",
              "제가 잘못",
              "아까는 제가",
              "그런 뜻이 아니",
              "말이 잘못",
              "없던 걸로",
            ],
            fallbackOption: "죄송합니다, 아까 말씀은 그런 뜻이 아니었습니다",
            gaugeDelta: 1,
            aiReaction: "아까랑 말이 다르잖아요.",
            aiReactionNote: "휴대전화를 더 가까이 드십니다.",
            rubricHits: [
              { itemId: "CL-02", score: 2 },
              { itemId: "SA-05", score: 1 },
            ],
            coaching:
              "찍히는 자리에서 말이 달라지면 앞서 드린 사실까지 흔들립니다. 처음 드린 사실을 그대로 다시 말씀해 주세요.",
            docId: "DOC-NOTI-002",
            next: "T4",
          },
          {
            id: "J-c",
            label: "촬영을 막거나 맞대응",
            patterns: [
              "찍지 마세요",
              "촬영 안 됩니다",
              "휴대전화 좀",
              "그거 내려",
              "지워 주",
              "저도 녹음",
              "고발",
              "법대로",
            ],
            fallbackOption: "찍지 마세요. 저도 녹음하겠습니다.",
            gaugeDelta: 2,
            aiReaction: "지금 뭐 하시는 거예요?",
            rubricHits: [
              { itemId: "RE-06", score: 1 },
              { itemId: "CO-08", score: 2 },
            ],
            coaching:
              "촬영을 두고 다투면 그 장면이 그대로 남습니다. 어르신이 화면에 담기는 부분만 의사를 여쭙고, 나머지는 사실 진술과 기록으로 옮겨 주세요.",
            docId: "DOC-LAW-007",
            next: "T4",
          },
          {
            // 재진술 자리에서 앞서 거절한 요구를 뒤집는 발화를 받는 ⚑CF 분기입니다.
            // 규칙 사전은 이 CUE에서 순응 문형으로 좁혀 판정하므로(rules.ts의
            // complyOnlyCues), 좁힌 사전이 놓친 자리를 같은 목록으로 여기서 한 번 더 받습니다.
            // 버튼으로는 노출하지 않습니다 — 촬영 요구 자리의 보기는 넷 그대로 두고,
            // 학습자가 **실제로 그 말을 했을 때만** 열립니다.
            //
            // C-1과 같은 **대용어 순응**까지 함께 봅니다. 앞서 거절한 요구를 그대로 다시
            // 말하는 자리라, "말씀대로 그렇게 할게요"가 가리킬 것은 억제 말고 없습니다.
            // 3라운드 레드팀 실측에서 이 자리만 대용어를 못 받아, 같은 문장이 C-1에서는
            // ⚑CF이고 C-3에서는 통과했습니다(같은 요구, 다른 판정선).
            id: "J-d",
            label: "재진술 자리에서 억제 요구를 수용 (⚑CF)",
            patterns: RESTRAINT_REQUEST_ACCEPT_PATTERNS,
            gaugeDelta: 0,
            aiReaction: "봐요, 방금 그렇게 하겠다고 하셨어요.",
            aiReactionNote: "휴대전화가 그대로 향해 있습니다.",
            rubricHits: [{ itemId: "CO-02", score: 1 }],
            criticalFail: true,
            cfMessage: CF_RESTRAINT_REQUEST_MESSAGE,
            cfAlternatives: CF_RESTRAINT_REQUEST_ALTERNATIVES,
            docId: "DOC-LAW-003",
            next: "T4",
          },
          {
            id: "J-n",
            label: "무응답·미분류",
            patterns: [],
            gaugeDelta: 0,
            aiReaction: "…지금 뭐라고 하신 거예요?",
            rubricHits: [],
            coaching: UNCLEAR_COACHING,
            docId: "DOC-NOTI-002",
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
        // 유일한 id — rules.ts의 POST_INCIDENT_REPORT_CUES 게이트를 받는 자리입니다.
        // (회고 진술 "묶어두라는 요구가 있었습니다"가 신체 억제 ⚑CF로 잡히지 않습니다.)
        id: "CUE-C4",
        prompt: "오늘 있었던 일을 센터 당직에 보고한다고 생각하고 말로 보고해 주세요.",
        waitSec: 8,
        defaultBranchId: "V-n",
        branches: [
          {
            id: "V-a",
            label: "시각·관찰·요구·본인 응답을 사실만",
            patterns: [
              "17시",
              "오후 5시",
              "왼팔",
              "멍을 확인",
              "멍이 있",
              "확인되지 않",
              "요구하셨",
              "요구가 있었",
              "묶어두",
              "묶어 두",
              "방문을 잠",
              "안내드렸습니다",
              "말씀드렸습니다",
              "계약 해지",
              "촬영",
              "녹음",
              "보고드립니다",
              "보고드리겠습니다",
              "보고드리겠",
              "그대로 전달",
            ],
            // 사실을 뭉개지 않은 문장입니다 — 받은 요구를 요구받은 말 그대로 적습니다.
            // ("못 움직이게 해 달라는 요구"처럼 돌려 적으면, 기록이 남겨야 할 바로 그
            //  대목을 흐리게 만듭니다. 규칙 게이트가 이 문장을 통과시킵니다.)
            fallbackOption:
              "17시경 보호자께서 어르신 왼팔의 멍을 확인하셨고, 발생 시점은 확인되지 않았다고 안내드렸습니다. 밤에 침대에 묶어두거나 방문을 잠가 달라는 요구가 있어 법으로 허용되지 않는다고 말씀드렸습니다. 계약 해지 의사와 촬영 요청이 있었던 사실도 함께 전달드립니다.",
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
            praise:
              "시각·요구·제가 드린 답이 순서대로 들어갔습니다. 당직 근무자가 이 문장만 보고 판단할 수 있습니다.",
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
              "\"억울했다\"는 빼고, 아드님이 하신 요구와 제가 드린 답을 들은 말 그대로 적어 주세요. 사실만 남은 기록이 나를 지킵니다.",
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
          {
            // 보고 문장이 신호에 걸리지 않았다고 해서 「미보고」로 찍지 않습니다.
            id: "V-n",
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
      text: "보고 내용을 확인했습니다. 다음을 위한 제안을 남길 차례입니다.",
      cue: {
        // 재발 방지 「제안」은 앞으로의 행위라 규칙 게이트 밖에 둡니다 —
        // 여기서 "방문을 잠그겠습니다"는 여전히 ⚑CF로 멈춰 세워야 합니다.
        id: "CUE-C5",
        prompt: "같은 일이 반복되지 않으려면, 무엇을 바꿔볼 수 있을까요?",
        waitSec: 8,
        defaultBranchId: "X-n",
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
            praise: "실행 주체와 시점이 있는 제안입니다. 다음 방문부터 그대로 해 보실 수 있습니다.",
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
            coaching:
              "\"방문 때마다 피부 상태를 확인해 기록하겠습니다\"처럼 무엇을 언제 하겠다는 형태로 바꿔 보세요.",
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
          {
            id: "X-n",
            label: "무응답·미분류",
            patterns: [],
            gaugeDelta: 0,
            aiReaction: "말씀이 잘 전달되지 않았습니다.",
            rubricHits: [],
            coaching: UNCLEAR_COACHING,
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
        // 성찰도 회고 진술 구간입니다 — POST_INCIDENT_REPORT_CUES 게이트를 받습니다.
        id: "CUE-C6",
        prompt: "오늘 내 대응에서 한 가지만 고친다면?",
        waitSec: 8,
        defaultBranchId: "Y-n",
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
            praise: "다음에 무엇부터 나눠 말씀드릴지 스스로 정하셨습니다.",
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
            coaching:
              "\"확인된 것과 확인되지 않은 것을 먼저 나눠 말씀드리겠습니다\"처럼, 다음에 바꿀 순서 하나를 정해 보세요.",
            next: "end:E-부분",
          },
          {
            id: "Y-n",
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
      id: "C-1",
      name: "억제 요구",
      condition: "CUE-2 종료 후 (알파에서는 100% 고정 발동)",
      description:
        "보호자: \"침대에 묶어두든지 방문을 잠그든지 하세요.\" 요구를 받았다는 사실이 금지행위를 허용하지 않는다는 것을 규칙 엔진이 그대로 판정합니다. 이 시나리오에서 ⚑CF가 적용되는 유일한 지점입니다.",
    },
    {
      id: "C-2",
      name: "어르신 청취",
      condition: "CUE-3 종료 후 (알파에서는 100% 고정 발동)",
      description:
        "어르신이 소파에서 두 사람을 번갈아 보시며 \"…나 때문에 싸우는 거야?\" 하고 물으십니다. 갈등 노출을 최소화하고 존엄을 보호하는지 봅니다.",
    },
    {
      id: "C-3",
      name: "촬영 요구",
      condition: "CUE-C2 종료 후 (알파에서는 100% 고정 발동)",
      description:
        "보호자가 휴대전화를 들어 \"지금부터 녹음하겠습니다. 방금 하신 말씀 다시 해 보세요\" 하십니다. 어르신도 화면 안에 들어옵니다. 고급 난이도의 근거가 되는 지점으로, 기록될 것을 아는 상태에서도 처음 드린 사실이 그대로 유지되는지, 어르신이 화면에 담기는 부분을 어르신의 일로 다루는지를 봅니다.",
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
      // 이 엔딩은 마지막 돌아보기 한 문장(CUE-C6)으로만 갈립니다 — 사실을 그대로 보고하고도
      // 여기로 옵니다. 그래서 **제목도 문구도** 남은 기록의 양을 단정하지 않고 실제 갈림
      // 사유만 적습니다(그 판정은 아래 항목별 표시가 합니다).
      // 제목은 종료 화면 부제와 /history 회차 카드에 그대로 실리므로 같은 기준을 받습니다.
      title: "보호자와의 대화를 돌아보는 한 문장이 남았습니다",
      verdict: "부분 충족",
      condition: "그 자리는 넘겼으나 보고·기록 미이행",
      message:
        "마무리 돌아보기에서 한 문장이 남았습니다. 오늘 무엇이 충족되었고 무엇이 남았는지는 아래에서 확인해 주세요.",
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
  reviewPending: true, // 알파 초안 — 현직 감수 완료 시 이 줄을 지우면 /train 라벨·/check 항목이 함께 내려갑니다.
};

export default CHK_C02;
