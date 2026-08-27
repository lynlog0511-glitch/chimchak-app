/**
 * 훈련 화면 공통 문구·표기 상수.
 *
 * 안전 규칙(브리프 §3)에 걸린 고정 문구는 여기 한 곳에만 두고 화면들이 가져다 씁니다.
 * 점수·등급·순위·백분위 표기는 어떤 상수에도 두지 않습니다.
 */

/* 2026-08-25: `TIER_TONE`·`TYPE_TONE`·`VERDICT_TONE` 세 표를 지웠습니다.
   공용 `Badge`에 넘기려고 만든 표인데 Badge는 렌더 0건이라 파일째 폐기됐고, 세 표 자체도
   소비처가 0건이었습니다(유형 라벨은 각 목록, 판정 표기는 `TrainingRow`가 직접 그립니다).
   (그때 「계층 칩은 `TierIndicator`가 그린다」고 적었는데, 그 컴포넌트도 임포트 0건이라
    화면에 선 적이 없었습니다 — 지운 이유를 살아 있지 않은 자리로 댄 것입니다. 2026-08-26에
    `TierIndicator`를 파일째 지우면서 이 문장도 사실에 맞게 고쳤습니다. 세션의 계층은
    컴팩트 헤더의 상태 점 한 줄과 L3 전환 안내가 전합니다 — 칩을 그리는 자리는 없습니다.)
   같은 날 그 컴포넌트만 읽던 `TIER_LABEL`·`TIER_SHORT`·`TIER_NOW_NOTE`·`TIER_UNUSED_NOTE`·
   `TIER_ENDED_NOTE` 다섯도 함께 지웠습니다(참조 0건 — 가이드 §9-9).
   계층 라벨이 다시 필요하면 /safety §02가 같은 문장을 들고 있습니다.
   아래 `*_LABEL` 표들은 실제로 쓰이므로 그대로입니다. */
import type { StatusMarkKind } from "@/components/icons";
import { getRule, type TracedFeedback } from "@/engine";
import type {
  CueDef,
  EndingDef,
  GaugeDef,
  PersonaDef,
  Scenario,
  ScenarioType,
  Tier,
  TurnDef,
} from "@/types";

/**
 * 첫 화면·훈련 시작 전 고정 문구 (안전 규칙에 걸린 문장 — 한 글자도 바꾸지 마십시오).
 *
 * 2026-08-26 확인 — 이 상수를 읽는 화면은 **브리핑 한 곳**뿐입니다(BriefingPanel).
 * 시그니처 카피의 노출은 보존하기로 한 세 자리(홈 · /guide · 첫 브리핑)로 정리돼 있고,
 * 이 상수가 그중 셋째 자리를 맡습니다. 네 번째 반복이 아니므로 그대로 둡니다.
 * (이력·안전 설계에 있던 반복은 각 화면에서 걷어냈고, layout.tsx의 것은 화면이 아니라
 *  링크 공유 카드의 og:description입니다 — 읽는 자리가 겹치지 않습니다.)
 */
export const PRACTICE_LINE = "정답을 맞히는 시험이 아니라, 말이 나오게 만드는 연습입니다.";

/** 가상 인물 고지 */
export const FICTION_NOTICE = "등장인물은 전원 가상 인물이며 실존 인물·기관과 무관합니다.";

/**
 * 이 기기에서 음성 인식을 쓸 수 있는지 — **아직 모른다**를 따로 갖는 세 상태입니다.
 *
 * 판정은 마운트 뒤에야 납니다(`isRecognitionSupported()`). 그전까지를 `false`로 두면,
 * 되는 기기에서도 첫 프레임이 「이 기기에서는 음성 인식을 쓸 수 없습니다」라고 단정하고
 * 마이크 버튼이 잠긴 채로 그려집니다 — 그 몇 백 밀리초에 손이 이미 버튼 쪽으로 갑니다
 * (페르소나 현직·PM). 모르는 동안에는 모른다고 적습니다.
 *
 * 문법은 `/report`의 음성 입력(`report/_components/VoiceInput`)에 이미 있는 것을 그대로
 * 옮겨 온 것입니다 — 같은 사실을 두 화면이 다른 말로 하지 않게 합니다.
 */
export type MicCheck = "unknown" | "yes" | "no";

/** 마이크 판정이 나기 전 한 줄 — `/report`와 **같은 문장**입니다. */
export const MIC_CHECKING_LINE = "마이크를 확인하고 있어요";

/**
 * 같은 CUE에서 **두 번째로** 미분류가 났을 때 대신 세우는 코칭 한 줄.
 *
 * 미분류는 이제 같은 자리에 머뭅니다(시나리오 데이터 · 체류 원칙). 그 자리에서 시나리오가
 * 적어 둔 문구는 「다시 말씀하시거나 아래 버튼에서 골라 주세요」인데, 두 번째에도 같은 말이
 * 돌아오면 「몇 번째인지 아무도 세고 있지 않다」로 읽힙니다(교육생 3차 · 첫 턴 미분류율 75%).
 *
 * 되묻지는 않습니다 — 확정 원칙입니다. 원칙 안에서 할 수 있는 것은 **보기 쪽을 한 단 크게
 * 세우는 것**뿐이라 그렇게만 합니다. 시나리오 데이터는 손대지 않고 표시부에서만 갈아 끼웁니다
 * (기록에 남는 문구는 그대로 데이터의 것입니다).
 *
 * 2026-08-26 — 마지막 마디였던 「고르신 것도 말씀하신 것과 똑같이 판정합니다」를 걷어냈습니다.
 * 사실이 아니었습니다: 버튼으로 분기를 고른 턴에는 규칙 사전이 돌지 않고 시나리오 데이터의
 * 판정을 그대로 따릅니다(engine/session.ts 「규칙 판정 우선 — 자유 발화에만 적용한다」).
 * 같은 화면의 다른 두 문장도 그렇게 적혀 있어(「한 번만 직접 말해 보시면 규칙 사전이 그
 * 말씀을 보고 다르게 짚어 드려요」 · 「보기로 고르신 턴은 이 상황의 표가 판정하고, 규칙
 * 사전은 직접 말씀하신 문장만 봅니다」) 한 화면이 세 갈래로 갈렸습니다. 하필 이 줄을 읽는
 * 분은 말이 두 번 닿지 않아 버튼으로 옮겨 가려는 분이라, 안심시키려던 한 마디가 「버튼으로만
 * 해도 된다」를 정확히 반대로 가르쳤습니다(교육생 5차). 안심은 앞 두 마디가 이미 합니다.
 */
export const UNCLEAR_REPEAT_COACHING =
  "이번에도 잘 닿지 않았어요. 아래 보기에서 하나 골라 주시면 그대로 이어집니다.";

/**
 * 설계표 분류 이름 → 사용자 말 (**표시부 한 겹** · 시나리오 데이터는 그대로입니다).
 *
 * 종료 화면의 「이번 훈련의 흐름」에 서는 것은 분기 label인데, 그 문구는 감수하는 분이 읽는
 * **개조식 분류 이름**입니다. 훈련을 마친 분께 「무응답·미분류」라고 적으면 사실과도 다릅니다 —
 * 그분은 응답을 하셨고 말이 판정 신호에 닿지 않았을 뿐입니다. 그 자리에 자기 회차의 줄로
 * 「무응답」이 적히면 인식이 빗나간 것을 자기 탓으로 읽게 됩니다(현직 3차 · 반드시 고쳐 달라고
 * 하신 항목).
 *
 * 「가장 잘한 순간」 카드에서 이미 쓴 방식과 같습니다 — 분류 이름을 세우지 않고 사람 말이
 * 대신 말하게 둡니다. 다만 거기서는 검수된 칭찬 문장이 있었고 여기에는 없으므로,
 * **표시할 때만 바꿔 끼우는 표**를 둡니다. 판정·기록·감수 문서가 쓰는 이름은 그대로입니다.
 *
 * 표에 없는 이름은 그대로 나갑니다 — 「대체 행동 유도 (동의를 구하고 함께 움직임)」처럼
 * 이미 사람 말인 이름이 대부분이고, 없는 이름을 규칙으로 지어내면 뜻이 어긋납니다.
 *
 * 2026-08-26 — 갈등 시나리오(CHK-C01·C02)까지 넓혔습니다. 「무응답」을 고쳐 달라고 하신
 * 이유가 이쪽에 더 세게 적용됩니다: 보호자에게 몰리다 물러선 회차 끝에 「위축 후 수용
 * (경계 붕괴)」, 사과를 반복한 회차에 「무한 사과」가 **자기 회차의 줄**로 적혔습니다.
 * 판정 이름이 아니라 사람 성향에 대한 평가로 읽히고, 「경계 붕괴」는 현장에서 직무 부적합을
 * 뜻하는 말입니다(현직 5차). 같은 화면 다른 자리에는 배려된 말이 서 있어 한 화면 안에서
 * 어휘 기준이 두 벌로 갈리던 자리이기도 합니다.
 * 바꾼 말은 **그 회차에 실제로 한 행동**을 적습니다 — 성향이 아니라 행동입니다.
 */
export const BRANCH_LABEL_IN_WORDS: Record<string, string> = {
  "무응답·미분류": "말이 닿지 않은 자리",
  "감정 인정형": "마음을 먼저 알아드림",
  "사실 반박형": "사실부터 바로잡음",
  "지시·제지형": "하지 마시라고 말함",
  "지시·제지형 — 신체 접촉·문 잠금": "몸에 손을 대거나 문을 잠금",
  "회피 — 모른다고 답함": "모른다고 답함",
  "회피·모름": "모른다고 답함",
  회피: "답을 피함",
  "침묵·회피": "말없이 넘김",
  "침묵으로 넘김": "말없이 넘김",
  "선행 없는 직접 확인 — 어르신 반발": "마음보다 확인이 먼저였던 자리",
  미보고: "따로 보고하지 않음",
  "보고·기록 없음": "따로 보고하지 않음",
  "SBAR 4요소 충족": "인계에 필요한 것을 갖춰 전달",
  "SBAR 2~3요소": "인계에 빠진 것이 있음",
  해석만: "본 것 대신 짐작을 말함",
  대립: "맞서서 되받음",
  맞대응: "맞서서 되받음",
  "감정 맞대응": "맞서서 되받음",
  "방어·부인": "그런 적 없다고 답함",
  // 갈등 시나리오 — 성향이 아니라 그 회차에 한 행동으로 적습니다.
  "무한 사과": "사과를 거듭함",
  "위축 후 수용 (경계 붕괴)": "물러서서 요구를 받아들임",
  "사과·애원": "사과하며 한 번만 봐 달라고 함",
  "즉시 사과·자책": "곧바로 사과하며 제 탓으로 돌림",
  "애원·위축": "한 번만 봐 달라고 부탁함",
};

/**
 * 부분 보고 코칭을 **빠진 요소 이름으로 조립**합니다 (표시부 한 겹 · 데이터는 그대로).
 *
 * 시나리오의 coaching은 고정 문장입니다. 채택선이 1요소로 내려오면서, 그 문장이 요구하는
 * 것을 **이미 말한 발화**가 이 갈래에 닿게 됐습니다 — "지금은 소파에 앉아 계십니다"에
 * 「"지금은 소파에 앉아 계십니다" 두 마디만 덧붙이면」이 붙어, 방금 한 말을 그대로 인용해
 * 돌려주었습니다(교육생 5차). 같은 화면의 접힘은 실제로 센 요소를 이름으로 적으므로
 * 위에서는 「덧붙이세요」, 아래에서는 「담겨 있어 갈렸습니다」가 되어 앞뒤도 어긋났습니다.
 *
 * 분류기가 이미 센 요소(`trace.matchedElements`)와 그 CUE의 요소 그룹을 맞대어,
 * **담긴 것과 빠진 것**을 그대로 적습니다. 되묻지 않고, 새 문장을 지어내지도 않습니다 —
 * 쓰는 낱말은 전부 시나리오 데이터의 요소 이름입니다.
 * 요소 이름을 다 채웠거나 셀 것이 없으면 `undefined`를 돌려주고, 화면은 데이터의 coaching을
 * 그대로 씁니다(폴백).
 *
 * 나열은 **쉼표**로 합니다 (2026-08-27 · 현직·교육생 7차). 요소 이름 자체에 가운뎃점이 든 것이
 * 있어(「행위·조치」·「관찰·요구」), 가운뎃점으로 이으면 남은 것이 둘인데 셋으로 읽힙니다 —
 * 「시각·행위·조치까지」. 분류기는 같은 이유로 이미 쉼표를 쓰고 그 사유를 적어 두었고
 * (classify.ts:354), 같은 화면의 접힘도 쉼표에 「N가지」입니다(InlineCoaching.tsx:111).
 * 한 화면에 서는 같은 목록이 두 벌의 기호로 갈리지 않게 규약을 하나로 둡니다.
 *
 * @example
 * // groups = 시각·대상·행위·조치·현재 상태, matched = ["현재 상태"]
 * // → "말씀에 담긴 것은 현재 상태입니다. 시각, 대상, 행위·조치까지 함께 적으시면 …"
 */
export function partialReportCoaching(
  cue: CueDef,
  matchedElements: readonly string[] | undefined,
): string | undefined {
  const groups = cue.elementJudge?.groups;
  if (!groups || groups.length === 0) return undefined;
  if (!matchedElements || matchedElements.length === 0) return undefined;
  const missing = groups.map((g) => g.label).filter((label) => !matchedElements.includes(label));
  if (missing.length === 0) return undefined;
  return `말씀에 담긴 것은 ${matchedElements.join(", ")}입니다. ${missing.join(", ")}까지 함께 적으시면 그대로 기록에 옮겨집니다.`;
}

/**
 * 갈래 이름을 **화면 낱말**로 다듬습니다 — 저작용 괄호를 떼고 위 표를 한 번 지납니다.
 *
 * 시나리오 데이터의 label에는 저작자용 주석이 괄호로 붙어 있습니다:
 * 「눕히기 (의식 있는 상태에서) (⚑CF)」·「등을 세게 두드림 (경고 — ⚑CF 아님)」.
 * ⚑CF는 설계 문서의 표기이지 화면 낱말이 아니므로(화면에서는 판정어 「즉시 중단」이 그
 * 자리를 대신합니다) 그 표기가 든 괄호만 통째로 뗍니다. 사람이 읽는 괄호는 건드리지 않습니다.
 *
 * 표시부 한 겹이므로 판정·기록·감수 문서가 쓰는 이름은 그대로입니다. 화면 쪽에서는
 * 내부 id를 지운 뒤 이 함수를 지납니다(EndingPanel).
 *
 * @example branchLabelInWords("눕히기 (의식 있는 상태에서) (⚑CF)") // "눕히기 (의식 있는 상태에서)"
 * @example branchLabelInWords("무응답·미분류")                      // "말이 닿지 않은 자리"
 */
export function branchLabelInWords(raw: string): string {
  const trimmed = raw.replace(/\s*\([^)]*(?:⚑|\bCF\b)[^)]*\)/g, "").trim();
  return BRANCH_LABEL_IN_WORDS[trimmed] ?? trimmed;
}

/* 생성 자리 고지(GENERATION_ADAPTER_NOTE·VARY_ADAPTER_NOTE 노출)는 2026-08-24에 세션 상단에서
   걷어냈습니다. 「어댑터 자리」·「근거 가드 검증을 통과한 구간」은 심사·개발 상태를 말하는 문장이라,
   어르신 대사 바로 위에 서면 훈련하러 오신 분이 읽을 것이 아니었습니다.
   같은 사실은 /safety §02가 그대로 들고 있습니다 — 지운 것이 아니라 자리를 옮긴 것입니다.
   말풍선 쪽 표기는 남습니다: 실제로 생성이 붙은 턴에만 「AI 생성」이 붙습니다(DialogueLog). */

/** L3 진입 전환 문구 */
export const PROTOCOL_HANDOFF_TITLE = "여기서부터 AI가 화면에서 빠집니다";
export const PROTOCOL_HANDOFF_BODY =
  "지금부터는 사전 검수된 고정 안내입니다 · AI 생성 아님";

/* ※ 계층 표시기 문구 다섯(`TIER_LABEL`·`TIER_SHORT`·`TIER_NOW_NOTE`·`TIER_UNUSED_NOTE`·
     `TIER_ENDED_NOTE`)은 2026-08-26에 지웠습니다 — 읽는 자리가 `TierIndicator` 하나뿐이었고
     그 컴포넌트가 렌더 0건이었습니다(위 머리말 참조). 같은 라벨이 필요하면 /safety §02가
     들고 있고, L3 전환 문구는 바로 위 `PROTOCOL_HANDOFF_*`가 맡습니다. */

export const ROLE_LABEL: Record<PersonaDef["role"], string> = {
  care_recipient: "돌봄 대상",
  guardian: "보호자",
  learner: "학습자 (나)",
  dispatcher: "119 상황실",
};

/** 시나리오 상세 경로 — 라우트 파라미터는 소문자로 통일합니다. */
export function scenarioHref(id: string): string {
  return `/train/${id.toLowerCase()}`;
}

/* ── 인물 아바타 한 글자 ───────────────────────────────────
   세션 말풍선(DialogueLog)과 브리핑 인물 카드(BriefingPanel)가 **같은 한 글자**를 씁니다 —
   브리핑에서 본 얼굴이 대화에서 그대로 나와야 「같은 사람」으로 읽힙니다.
   두 화면이 각자 성씨를 뽑으면 언젠가 갈라지므로, 뽑는 규칙은 여기 한 곳에만 둡니다. */

const ROLE_PREFIX = ["보호자", "요양보호사", "간호사", "센터장", "가족", "따님", "아드님"];

/**
 * 아바타에 새길 한 글자.
 * 역할어("보호자" 등)와 괄호 주석을 걷어낸 뒤, 홀로 떨어져 있는 성씨 한 글자를 먼저 찾습니다.
 *
 * @example initialOf("박 어르신")     // "박"
 * @example initialOf("보호자 김 씨")  // "김"
 * @example initialOf("119 상황실")    // "상"
 */
export function initialOf(name: string): string {
  let base = name.replace(/\([^)]*\)/g, " ").trim();
  for (const word of ROLE_PREFIX) {
    if (base.startsWith(word)) {
      base = base.slice(word.length).trim();
      break;
    }
  }
  const surname = base.split(/\s+/).find((token) => /^[가-힣]$/.test(token));
  if (surname) return surname;
  const hangul = base.match(/[가-힣]/);
  if (hangul) return hangul[0];
  const other = base.match(/[A-Za-z0-9]/);
  return other ? other[0] : "";
}

/* ── 돌발 변수 = 무대 지문 ─────────────────────────────────
   시나리오 데이터의 `triggerName`은 저작용 표기입니다(「T-2 보호자 전화」·「N-1 자동문 버튼」).
   그 표기를 대화 한가운데에 「돌발 변수 · T-2 보호자 전화」로 세우면, 훈련 중인 분이 읽는 것은
   장면이 아니라 설계 문서의 색인이 됩니다.

   그래서 데이터는 그대로 두고 **화면에서만** 무대 지문 한 줄로 바꿉니다 —
   「그때, 전화가 옵니다」. 무슨 일이 일어났는지의 자세한 내용은 바로 아래 말풍선의 본문과
   지문(`stageDirection`)이 이미 들고 있으므로, 이 줄이 하는 일은 **박자를 끊는 것** 하나입니다. */

const TRIGGER_STAGE_LINE: Record<string, string> = {
  /* CHK-A01 — 현관 앞 귀가 요구 */
  "T-1 문고리": "그때, 어르신 손이 문 쪽으로 갑니다",
  "T-3 젖은 옷 단서": "그때, 눈에 들어오는 것이 있습니다",
  "T-2 보호자 전화": "그때, 전화가 옵니다",
  /* CHK-A02 — 야간 배회 */
  "N-1 자동문 버튼": "그때, 어르신 손이 문 쪽으로 갑니다",
  "N-3 무릎 통증 단서": "그때, 눈에 들어오는 것이 있습니다",
  "N-2 옆방 어르신": "그때, 옆방 문이 열립니다",
  /* CHK-B01 — 낙상 후 관찰·보고 */
  "F-1 일으켜 달라는 재촉": "그때, 어르신이 몸을 일으키려 하십니다",
  "F-2 보호자 전화": "그때, 전화가 옵니다",
  /* CHK-B02 — 사레·질식 */
  "T-1 완전 기도폐쇄 전환": "그때, 소리가 멎습니다",
  "T-2 보호자 추궁": "그때, 전화가 옵니다",
  /* CHK-C01 — 업무 외 요구 + 폭언 */
  "T-1' 요구 확대": "그때, 말이 이어집니다",
  "T-1 센터장 압박": "그때, 말투가 달라집니다",
  "T-2 어르신 청취": "그때, 어르신이 이쪽을 보십니다",
  /* CHK-C02 — 원인을 모르는 멍 */
  "C-1 억제 요구": "그때, 말투가 달라집니다",
  "C-2 어르신 청취": "그때, 어르신이 이쪽을 보십니다",
  "C-3 촬영 요구": "그때, 휴대전화가 올라옵니다",
};

/** 지문에 남는 마지막 안전망 — 표에 없는 돌발 변수가 들어와도 코드가 화면에 나가지 않습니다. */
const TRIGGER_STAGE_FALLBACK = "그때, 상황이 하나 더 겹칩니다";

/**
 * 돌발 변수 이름 → 무대 지문 한 줄.
 *
 * @example triggerStageLine("T-2 보호자 전화") // "그때, 전화가 옵니다"
 * @example triggerStageLine("Z-9 미정")        // "그때, 상황이 하나 더 겹칩니다"
 */
export function triggerStageLine(triggerName: string): string {
  return TRIGGER_STAGE_LINE[triggerName.trim()] ?? TRIGGER_STAGE_FALLBACK;
}

/* ── 세션 헤더 (시안 4a 컴팩트 헤더) ───────────────────────── */

/** L3 구간 — AI가 만든 문장이 아님을 헤더에서 바로 밝힙니다(말풍선 라벨과 같은 어휘). */
export const SESSION_STATUS_PROTOCOL = "응급 안내 · AI 생성 아님";
export const SESSION_STATUS_ENDED = "훈련을 마쳤습니다";

/** 화자 → 사람이 부르는 역할 이름 (헤더 「AI는 … 역만 맡습니다」에 씁니다) */
const SPEAKER_ROLE_WORD: Record<TurnDef["speaker"], string> = {
  elder: "어르신",
  guardian: "보호자",
  dispatcher: "119 상황실",
  system: "",
  protocol: "",
};

/**
 * 헤더 한 줄 — 「대화 단계 · AI는 어르신 역만 맡습니다」.
 *
 * 역할 이름은 시나리오가 실제로 재생하는 화자에서 가져옵니다.
 * (119 상황실 대사가 있는 시나리오에서 「어르신 역만」이라고 적으면 사실과 달라집니다.)
 *
 * @example aiRoleNote(CHK_A01) // "대화 단계 · AI는 어르신·보호자 역만 맡습니다"
 */
export function aiRoleNote(scenario: Scenario): string {
  const words: string[] = [];
  for (const turn of scenario.turns) {
    const word = SPEAKER_ROLE_WORD[turn.speaker];
    if (word.length > 0 && !words.includes(word)) words.push(word);
  }
  const roles = words.length > 0 ? words.join("·") : "상대";
  return `대화 단계 · AI는 ${roles} 역만 맡습니다`;
}

/**
 * 진행 번호의 한글 서수 (가이드 §4.1 · 시안 7d 「셋째 상황」).
 * 열한째부터는 읽기 쉬운 숫자 표기로 넘깁니다.
 *
 * @example situationOrdinal(3) // "셋째"
 * @example situationOrdinal(12) // "12번째"
 */
const SITUATION_ORDINAL = [
  "",
  "첫째",
  "둘째",
  "셋째",
  "넷째",
  "다섯째",
  "여섯째",
  "일곱째",
  "여덟째",
  "아홉째",
  "열째",
];

export function situationOrdinal(index: number): string {
  const n = Math.max(1, Math.round(Number.isFinite(index) ? index : 1));
  return SITUATION_ORDINAL[n] ?? `${n}번째`;
}

/**
 * 세션 헤더 부제 — 「셋째 상황 · 대화 단계 · AI는 어르신 역만 맡습니다」 (가이드 §4.1).
 *
 * 진행 번호는 점수가 아니라 **지금 몇째 장면인가**입니다(§4.2와 같은 뜻).
 *
 * @example sessionSubtitle(CHK_A01, 3) // "셋째 상황 · 대화 단계 · AI는 어르신 역만 맡습니다"
 */
export function sessionSubtitle(scenario: Scenario, index: number): string {
  return `${situationOrdinal(index)} 상황 · ${aiRoleNote(scenario)}`;
}

/**
 * 컴포저 위 회수 앵커 — **로그 아래쪽**에 아직 안 보이는 내용이 남아 있을 때 한 줄로 부릅니다.
 *
 * 예전에는 새 대사가 화면 위로 밀려나 「새로 말씀하셨어요 ↑」로 되불렀습니다.
 * 지금은 제출 직후 새 대사를 띠 맨 위에 세우므로(DialogueLog), 화면 밖에 남는 것은
 * 그 아래로 이어지는 코칭·돌발 변수입니다 — 앵커의 역할이 ↑ 회수에서 ↓ 안내로 바뀌었습니다.
 */
export const TAIL_ANCHOR = "이어지는 코칭 보기";

/* ── 응답 여유 (시안 4a — 숫자 초읽기 대신 상태어) ─────────── */

export type WaitLevel = "plenty" | "half" | "over";

/**
 * 지금 여유가 어느 단계인지.
 * 게이지와 같은 원칙입니다 — 숫자는 화면에 내지 않고 낱말 하나로만 전합니다.
 *
 * @example waitLevel(7, 8) // "plenty"
 * @example waitLevel(0, 8) // "over"
 */
export function waitLevel(secondsLeft: number, total: number): WaitLevel {
  if (!Number.isFinite(secondsLeft) || secondsLeft <= 0) return "over";
  const span = Math.max(1, Math.round(total));
  return secondsLeft > span / 2 ? "plenty" : "half";
}

/**
 * 여유 상태어 — 재촉 어휘는 쓰지 않습니다(가이드 §4.5 「'남은 시간' 대신 '여유'」).
 * 시간이 다 지나도 넘어가지 않으므로, 마지막 단계도 기다린다는 말로 끝냅니다.
 */
export const WAIT_WORD: Record<WaitLevel, string> = {
  plenty: "여유 있어요",
  half: "천천히 하셔도 됩니다",
  over: "기다리고 있어요",
};

/** 여유 표시 옆에 항상 붙는 한 줄 — 얼어붙는 몇 초 동안 같은 자리에 있어야 하는 사실입니다. */
export const WAIT_NO_AUTO_ADVANCE = "시간이 지나도 자동으로 넘어가지 않아요";

/* ── 감정 상태 (시안 4a③ — 게이지가 숫자 막대 대신 인물에 붙습니다) ── */

export type EmotionLevel = "calm" | "uneasy" | "crisis";

/**
 * 게이지 값 → 감정 상태어.
 * 숫자·점수는 화면에 내보내지 않고, 이름줄의 한 낱말과 아바타 링으로만 전합니다.
 */
export const EMOTION_WORD: Record<GaugeDef["label"], Record<EmotionLevel, string>> = {
  초조도: { calm: "평온", uneasy: "조금 불안", crisis: "많이 불안" },
  긴장도: { calm: "편안", uneasy: "조금 긴장", crisis: "많이 긴장" },
};

/** 이름줄 상태어 색 — 작은 글자라 대비 4.5:1을 넘는 `*-ink` 계열만 씁니다. */
export const EMOTION_TEXT: Record<EmotionLevel, string> = {
  calm: "text-ink-muted",
  uneasy: "text-warn-ink",
  crisis: "text-danger-ink",
};

/** 아바타 감정 링 — 평온은 링 없음(시안 4a③). 색만으로 뜻을 전하지 않도록 항상 상태어와 함께 둡니다. */
export const EMOTION_RING: Record<EmotionLevel, string | undefined> = {
  calm: undefined,
  uneasy: "0 0 0 2px var(--color-warn-line)",
  crisis: "0 0 0 2px var(--color-danger-line)",
};

/**
 * 지금 게이지가 가리키는 감정 단계.
 * 위기값 바로 아래부터 crisis로 보고, 시작값보다 낮게 가라앉으면 calm으로 봅니다.
 *
 * @example emotionLevel({ label: "초조도", start: 2, max: 5, crisisAt: 5, crisisEndingId: "E-위기" }, 4) // "crisis"
 */
export function emotionLevel(gauge: GaugeDef, value: number): EmotionLevel {
  if (value >= gauge.crisisAt - 1) return "crisis";
  if (value <= 1) return "calm";
  return "uneasy";
}

/* ── 인라인 코칭 (시안 4a⑤ — 카드가 아니라 지문 옆 한 덩어리) ── */

/**
 * 판정 머리말.
 * 판정어는 `STATUS_MARK_LABEL`(충족 / 코칭 / 즉시 중단)을 그대로 쓰고,
 * 「침착의 코칭」은 이 말이 AI 인물이 아니라 앱의 판정이라는 표시입니다.
 */
export const COACH_HEAD: Record<StatusMarkKind, string> = {
  met: "충족 · 침착의 코칭",
  coach: "침착의 코칭",
  stop: "즉시 중단 · 침착의 코칭",
};

/**
 * 판정 머리말 색 — 가이드 v4 §4.4.
 *
 * 미충족 코칭은 `warn-ink`입니다. 예전에는 `ink-soft`(보조 본문과 같은 회색)라,
 * 같은 판정을 가리키는 엔딩의 「다시 볼 것」(warn-ink)과 색 문법이 갈렸습니다 —
 * 한 훈련 안에서 같은 뜻이 두 색으로 나오면 색이 뜻을 잃습니다.
 */
export const COACH_HEAD_TEXT: Record<StatusMarkKind, string> = {
  met: "text-ok-ink",
  coach: "text-warn-ink",
  stop: "text-danger-ink",
};

const COUNT_WORD = ["", "한", "두", "세", "네", "다섯"];

/**
 * 게이지 변동 칩 문구 — 「초조도 한 칸 ↓」. 변동이 없으면 칩을 붙이지 않습니다.
 *
 * @example gaugeDeltaChip("초조도", -1) // "초조도 한 칸 ↓"
 */
export function gaugeDeltaChip(label: string, delta: number): string | null {
  if (!Number.isFinite(delta) || delta === 0) return null;
  const steps = Math.min(Math.abs(Math.round(delta)), COUNT_WORD.length - 1);
  const word = COUNT_WORD[steps] ?? "한";
  return `${label} ${word} 칸 ${delta < 0 ? "↓" : "↑"}`;
}

/** 델타 칩 색 — 게이지가 내려가면 틸(좋아진 것), 올라가면 앰버(주의).
 *
 * 틸 쪽이 brand-800인 이유: 칩 바탕이 ok-soft(#eaf7f1)라 흰 지면이 아닙니다.
 * brand-700은 그 위에서 4.41:1로 AA(4.5:1) 미달이고 brand-800은 6.16:1입니다
 * (2026-08-26 실측 · 「흰 지면이 아니면 brand-800」 — globals.css의 brand-700 주석).
 * 칩 글자는 11px/600이라 큰 글자 예외(18.66px 굵게)에도 걸리지 않습니다.
 */
export function gaugeDeltaTone(delta: number): string {
  return delta < 0
    ? "bg-ok-soft text-brand-800"
    : "bg-warn-soft text-warn-ink";
}

/**
 * 데스크톱 레일의 게이지 변동 문장 (시안 7d 「방금 한 칸 내려갔어요」).
 * 칩과 달리 문장이라 숫자·화살표를 쓰지 않습니다.
 *
 * @example gaugeDeltaSentence(-1) // "방금 한 칸 내려갔어요"
 */
export function gaugeDeltaSentence(delta: number): string | null {
  if (!Number.isFinite(delta) || delta === 0) return null;
  const steps = Math.min(Math.abs(Math.round(delta)), COUNT_WORD.length - 1);
  const word = COUNT_WORD[steps] ?? "한";
  return delta < 0 ? `방금 ${word} 칸 내려갔어요` : `방금 ${word} 칸 올라갔어요`;
}

/**
 * 게이지가 설명하는 인물을 앞에 붙인 이름 — 「어르신 초조도」 (시안 7d).
 *
 * @example gaugeRailLabel(CHK_A01) // "어르신 초조도"
 */
export function gaugeRailLabel(scenario: Scenario): string {
  const roles = scenario.personas.map((persona) => persona.role);
  if (roles.includes("care_recipient")) return `어르신 ${scenario.gauge.label}`;
  if (roles.includes("guardian")) return `보호자 ${scenario.gauge.label}`;
  return scenario.gauge.label;
}

/* ── ⚑CF 판정 주체 (시안 6c 근거 박스 · 가이드 §4.6) ───────── */

/**
 * 규칙 사전에서 발동한 규칙의 **한국어 이름** — 「신체 자유 제한」.
 *
 * 판정에 쓰인 규칙 id(`CF-RESTRAINT`)는 사전의 열쇠이지 사람이 읽는 이름이 아닙니다.
 * 이름은 새로 짓지 않고 `src/engine/rules.ts`의 `label`을 그대로 가져옵니다 —
 * 화면에 나가는 낱말과 판정을 실행한 규칙이 같은 원천을 가리키게 하려는 것입니다.
 */
function ruleNameOf(trace: TracedFeedback["trace"]): string | undefined {
  const label = trace?.ruleLabel ?? (trace?.ruleId ? getRule(trace.ruleId)?.label : undefined);
  return label && label.trim().length > 0 ? label.trim() : undefined;
}

/**
 * 판정 주체 한 줄 — 「판정: 규칙 사전 — 신체 자유 제한 (AI 아님)」.
 *
 * 규칙 사전이 단독으로 잡은 판정과 시나리오 분기 데이터가 정한 판정은 주체가 다릅니다.
 * 둘 다 결정론이지만, 아닌 것을 「규칙 사전」이라고 적지는 않습니다.
 * (⚑CF 시트와 엔딩의 「다시 볼 장면」 카드가 같은 문장을 씁니다.)
 *
 * 형식(「판정: … (AI 아님)」)은 고정입니다 — 바뀐 것은 규칙을 부르는 말뿐입니다.
 * 얼어붙은 순간에 읽는 줄이 영문 코드일 이유가 없고, 「AI 아님」은 이 시트의 안전 증거라
 * 한 글자도 줄이지 않습니다.
 *
 * @example cfVerdictSourceLine(feedback) // "판정: 규칙 사전 — 신체 자유 제한 (AI 아님)"
 */
export function cfVerdictSourceLine(feedback: TracedFeedback): string {
  const trace = feedback.trace;
  if (trace?.source === "rule") {
    const name = ruleNameOf(trace);
    return name ? `판정: 규칙 사전 — ${name} (AI 아님)` : "판정: 규칙 사전 (AI 아님)";
  }
  return "판정: 시나리오 규칙표 (AI 아님)";
}

/**
 * ⚑CF 문구에서 **법령 조문을 인용한 문장만** 갈라냅니다.
 *
 * 문구 자체는 검수된 고정 문장이라 한 글자도 고치지 않고, 자리만 옮깁니다 —
 * 얼어붙은 사람이 두 번째 줄에서 읽는 것이 「당신은 법을 어겼습니다」가 되지 않도록
 * 조문은 접힘 안으로 내리고, 할 수 있는 말(대안)을 먼저 세웁니다.
 * (⚑CF 시트와 엔딩의 「다시 볼 장면」 카드가 같은 규칙을 씁니다.)
 *
 * @example splitLawSentences("잠시 멈추겠습니다. …노인복지법 제39조의9가… 다시 해보시겠어요?")
 * // { lead: "잠시 멈추겠습니다. 다시 해보시겠어요?", law: "…노인복지법 제39조의9가…" }
 */
export function splitLawSentences(message: string): { lead: string; law: string } {
  const sentences = message.match(/[^.]+\.?/g);
  if (!sentences) return { lead: message, law: "" };
  const lead: string[] = [];
  const law: string[] = [];
  for (const raw of sentences) {
    const sentence = raw.trim();
    if (sentence.length === 0) continue;
    if (/(?:법|고시|지침|규칙)\s*제\s*\d+조/.test(sentence)) law.push(sentence);
    else lead.push(sentence);
  }
  if (law.length === 0 || lead.length === 0) return { lead: message, law: "" };
  return { lead: lead.join(" "), law: law.join(" ") };
}

/* ── 소요 시간 (시안 6a 「약 4분 12초」) ──────────────────────
   여기 있던 `durationText` 사본을 지웠습니다 — 정본은 `src/lib/duration.ts` 한 곳입니다.
   그 파일이 스스로 「같은 값을 두 화면이 각자 그리면 같은 자료철의 두 장이 다른 숫자를 말한다」고
   적어 둔 자리이고, 실제로 이 사본과 정본이 나란히 살아 있었습니다. 마침 화면이 회차의
   **진행 시간**을 적게 되면서(`durationTextFromSeconds`) 사본을 유지할 이유도 사라졌습니다. */
