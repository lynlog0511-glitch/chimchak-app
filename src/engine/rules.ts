/**
 * 침착(ChimChak) 결정론 규칙 엔진.
 *
 * 옳고 그름의 판정은 한국 법령·공단 지침이 한다. 그중에서도 **치명적 판정(⚑CF)은
 * 생성 모델에 맡기지 않고 이 파일의 사전으로만 내린다.** (설계서 §5.2)
 * 판정 순서: checkCritical() → (통과 시) classifyUtterance() → 게이지·루브릭 반영.
 *
 * 사전 구성
 * - 신체 억제 동사 8종      → CO-02 ⚑CF (노인복지법 제39조의9 금지행위)
 * - 허용 범위 밖 행위 15종  → CO-01 ⚑CF (의료법 제27조 무면허 의료행위 금지)
 * - 현실 직면 강요 12종     → RE-02 코칭 (치매 대응 매뉴얼)
 * - 존칭·호칭 위반          → CO-07 코칭
 * - 개인정보 노출           → CO-08 코칭 (가명처리 엔진 재사용)
 *
 * 모든 대조는 공백 제거·소문자화 정규화 문자열 위에서 이뤄지며, 아래 두 장치로 오탐을 막는다.
 * ① 부정 표현("밀지 않겠습니다", "문을 잠그면 안 되죠")은 발동 제외.
 * ② except(예외어)·onlyTypes(적용 시나리오 유형) 제한.
 */

import type { RubricHit, ScenarioType } from "@/types";
import { maskSpansOnOriginal } from "./masking";

/* ── 정규화 ────────────────────────────────────────────── */

const PUNCTUATION = /[.,!?~·…()\[\]{}<>:;"'`\-–—\/\\|*]/g;

/**
 * 판정용 정규화 — 공백·구두점 제거 + 소문자화.
 *
 * @example
 * normalize("문을  잠그겠습니다."); // "문을잠그겠습니다"
 */
export function normalize(text: string): string {
  return text.normalize("NFC").toLowerCase().replace(/\s+/g, "").replace(PUNCTUATION, "");
}

/**
 * 부정·금지 표현 — 매치 뒤 10글자 안에 들어 있으면 발동시키지 않는다.
 * ("밀지 않겠습니다", "물을 마시게 하면 안 됩니다", "붙잡는 대신 손을 잡습니다")
 * 훈련 도중 옳은 답을 잘못 막는 것이 놓치는 것보다 나쁘므로 넉넉히 잡는다.
 */
const NEGATION_MARKERS = [
  "않",
  "지마",
  "지말",
  "말고",
  "말아",
  "마세",
  "면안",
  "안됩",
  "안돼",
  "안된",
  "금지",
  "위험",
  "큰일",
  "대신",
];

const NEGATION_WINDOW = 10;

/** 부정 표현 — 매치 앞에 붙으면 발동시키지 않는다 */
const NEGATION_BEFORE = ["안", "못", "절대", "절대로", "결코"];

/**
 * 매치 지점이 부정·금지 문맥 안에 있는지.
 * (분류기(classify.ts)도 ⚑CF 분기 대조에 이 함수를 그대로 쓴다.)
 *
 * @example
 * isNegated(normalize("밀지 않겠습니다"), 0, 1); // true
 */
export function isNegated(normalized: string, start: number, end: number): boolean {
  const after = normalized.slice(end, end + NEGATION_WINDOW);
  if (NEGATION_MARKERS.some((n) => after.includes(n))) return true;
  const before = normalized.slice(Math.max(0, start - 4), start);
  return NEGATION_BEFORE.some((n) => before.endsWith(n));
}

/**
 * 존경 선어말어미 '-시-'의 활용형까지 받아 주는 부분 문자열 검색.
 *
 * 한국어는 음절 블록 단위라 "싶으시"는 "싶으신"의 부분 문자열이 아니다.
 * 패턴이 "시"로 끝나면 마지막 한 글자를 [시신실셨셔세] 문자군으로 넓혀 대조한다.
 * (npm 추가 없이 문자 비교만으로 처리한다.)
 *
 * @example
 * indexOfPattern("집에가고싶으신가봐요", "싶으시"); // 4
 * indexOfPattern("많이급하셨겠어요", "급하시");     // 2
 */
export function indexOfPattern(haystack: string, needle: string, from = 0): number {
  if (needle.length === 0) return -1;
  if (!needle.endsWith("시")) return haystack.indexOf(needle, from);
  const stem = needle.slice(0, -1);
  const tails = "시신실셨셔세";
  for (let i = Math.max(0, from); i + needle.length <= haystack.length; i += 1) {
    if (!haystack.startsWith(stem, i)) continue;
    const tail = haystack[i + stem.length];
    if (tail !== undefined && tails.includes(tail)) return i;
  }
  return -1;
}

/** 예외어를 찾는 창(窓) — 매치 지점 앞뒤 이 글자 수 안에서만 본다 */
const EXCEPT_WINDOW = 6;

/**
 * 예외어가 **매치 지점 주변에** 있으면 그 매치는 건너뛴다.
 * 문장 전체를 보면 "휠체어에 태우고 팔을 잡아 못 나가게 하겠습니다"처럼
 * 예외어를 끼워 넣어 ⚑CF를 우회할 수 있어, isNegated()와 같은 창 방식을 쓴다.
 */
function hasExceptionNear(src: string, except: string[] | undefined, start: number, end: number): boolean {
  if (!except || except.length === 0) return false;
  const window = src.slice(Math.max(0, start - EXCEPT_WINDOW), end + EXCEPT_WINDOW);
  return except.some((e) => {
    const term = normalize(e);
    return term.length > 0 && window.includes(term);
  });
}

/**
 * 사전 용어 중 하나라도(부정 표현·주변 예외어 제외) 나타나는지 찾는다.
 *
 * @example
 * findTerm("어르신을 붙잡았습니다", ["붙잡"]); // { term: "붙잡", index: 4 }
 * findTerm("붙잡지 않았습니다", ["붙잡"]);      // null
 */
export function findTerm(
  text: string,
  terms: string[],
  except?: string[],
): { term: string; index: number } | null {
  const src = normalize(text);
  for (const raw of terms) {
    const term = normalize(raw);
    if (term.length === 0) continue;
    let from = 0;
    for (;;) {
      const idx = indexOfPattern(src, term, from);
      if (idx < 0) break;
      const end = idx + term.length;
      if (!isNegated(src, idx, end) && !hasExceptionNear(src, except, idx, end)) {
        return { term: raw, index: idx };
      }
      from = idx + 1;
    }
  }
  return null;
}

/* ── 규칙 사전 ─────────────────────────────────────────── */

export type RuleSeverity = "critical" | "coaching";

export interface RuleDef {
  id: string;
  /** 루브릭 항목 id */
  itemId: string;
  /** 사람이 읽는 규칙 이름 */
  label: string;
  severity: RuleSeverity;
  /** 이 규칙이 발동했을 때 부여할 점수 (내부 전용 — 화면 미표시) */
  score: 1 | 2;
  /** 판정 신호 (부분 문자열, 공백 제거 후 대조) */
  terms: string[];
  /** 이 말이 함께 있으면 발동하지 않는다 (문맥 오탐 방지) */
  except?: string[];
  /** 지정하면 해당 유형 시나리오에서만 발동한다 (미지정 시 전 유형) */
  onlyTypes?: ScenarioType[];
  /**
   * 이 CUE에서는 발동하지 않는다 (세션 국면 게이트).
   * 예: 응급이 이미 종료된 보고·기록 구간에서 "물을 드린 사실도 기록하겠습니다"가
   *     액체 제공으로 잡히지 않도록 한다.
   */
  skipCues?: string[];
  /** 화면에 그대로 띄우는 고정 문구 */
  message: string;
  /** 근거 문서 id */
  docId?: string;
  /** 대안 행동 (⚑CF 인터럽트에서 3개 제시) */
  alternatives?: string[];
}

/** ⚑CF — 신체 억제 동사 8종 (CO-02 · 전 시나리오 공통) */
export const RESTRAINT_RULES: RuleDef[] = [
  {
    id: "CF-RESTRAINT",
    itemId: "CO-02",
    label: "신체 자유 제한",
    severity: "critical",
    score: 1,
    // ① 붙잡기 ② 끌기 ③ 밀기 ④ 가로막기 ⑤ 문 잠그기 ⑥ 묶기 ⑦ 억제대 ⑧ 가두기
    // ※ 한국어 활용형을 놓치지 않도록 어간까지만 남긴다("잠그/잠급/잠갔/잠금/잠가/잠글").
    terms: [
      "붙잡",
      "붙들",
      "꽉 잡",
      "손목을 잡",
      "팔을 잡아",
      "끌고",
      "끌어당",
      "잡아끌",
      "끌어내",
      "밀어서",
      "밀어붙",
      "밀치",
      "떠밀",
      "가로막",
      "막아서",
      "몸으로 막",
      "못 나가게 막",
      "앞을 막",
      "막고 서",
      "현관을 막",
      "문을 잠",
      "문 잠",
      "잠가",
      "잠갔",
      "잠급",
      "잠글",
      "잠금",
      "걸어 잠",
      "도어락을 잠",
      "도어락 잠",
      "자물쇠",
      "묶어",
      "묶고",
      "결박",
      "끈으로 고정",
      "억제대",
      "신체 억제",
      "보호대로 고정",
      "가둬",
      "가두",
      "못 나오게 문",
    ],
    // "이끌고", "휠체어를 밀어서"처럼 제지가 아닌 표현은 제외한다
    except: ["휠체어", "보행기", "유모차", "이끌"],
    message:
      "잠시 멈추겠습니다. 붙잡기·끌기·밀기·문 잠그기는 법이 금지한 신체 자유 제한에 해당합니다. 어르신을 더 위험하게 만들 수 있어 훈련에서도 허용하지 않습니다.",
    docId: "DOC-LAW-003",
    alternatives: [
      "동의를 구한 뒤 손을 잡아 드리고 곁에 서 있기",
      "\"같이 나가 볼까요?\" 하고 동행을 제안하기",
      "따뜻한 물 한 잔·사진첩처럼 안전한 다른 행동으로 옮기기",
    ],
  },
];

/**
 * 응급이 이미 끝난 뒤(구급 인계·기관 보고·재발 방지 제안) 구간의 CUE id.
 * 이 구간에서는 "식사 전에 물을 드린 사실도 기록하겠습니다" 같은 **회고 진술**이
 * 액체·음식 제공으로 잡히면 안 되므로, 응급 처치 관련 ⚑CF 규칙을 건너뛴다.
 */
const POST_EMERGENCY_CUES = ["CUE-5", "CUE-T2", "CUE-6", "CUE-7"];

/** ⚑CF — 허용 범위 밖 행위 15종 (CO-01) */
export const PROHIBITED_ACTION_RULES: RuleDef[] = [
  {
    id: "CF-FLUID",
    itemId: "CO-01",
    label: "액체 제공",
    severity: "critical",
    score: 1,
    terms: [
      "물 좀 드",
      "물 드세",
      "물 드리",
      "물 드릴",
      "물을 드",
      "물 한 잔 드",
      "물 마시",
      "물 먹",
      "음료를 드",
      "음료 드",
      "주스를 드",
    ],
    onlyTypes: ["EMERGENCY"],
    skipCues: POST_EMERGENCY_CUES,
    message:
      "잠시 멈추겠습니다. 기도가 막힌 어르신에게 물이나 음식을 드리면 상황이 악화됩니다. 지금 하실 수 있는 것은 ① 식사 중단 ② 기침 격려 ③ 말을 걸어 소리가 나오는지 확인입니다.",
    docId: "DOC-GUIDE-004",
    alternatives: [
      "식사를 즉시 멈추고 상을 물리기",
      "\"기침 계속 하세요\" 하고 기침을 격려하기",
      "\"제 말 들리세요?\" 하고 소리가 나오는지 확인하기",
    ],
  },
  {
    id: "CF-FOOD",
    itemId: "CO-01",
    label: "음식 제공",
    severity: "critical",
    score: 1,
    terms: ["음식을 드리", "밥을 더 드", "떡을 드", "간식을 드리", "밥을 드시게", "더 드셔 보"],
    onlyTypes: ["EMERGENCY"],
    skipCues: POST_EMERGENCY_CUES,
    message:
      "잠시 멈추겠습니다. 사레·기도 폐쇄가 의심되는 상황에서 음식을 더 드리는 것은 위험합니다. 식사를 멈추고 상태를 확인하는 것이 먼저입니다.",
    docId: "DOC-GUIDE-004",
    alternatives: ["식사를 즉시 멈추기", "기침을 계속하시도록 격려하기", "말을 걸어 소리가 나오는지 확인하기"],
  },
  {
    id: "CF-ORAL",
    itemId: "CO-01",
    label: "구강 내 조작",
    severity: "critical",
    score: 1,
    terms: ["손가락을 넣", "손가락 넣", "입안에 손", "입에 손을 넣", "입안을 훑", "혀를 잡", "입을 벌려 안을"],
    message:
      "잠시 멈추겠습니다. 입안에 손을 넣어 확인하거나 무엇을 빼내려 하면 이물이 더 깊이 들어갈 수 있습니다. 이 부분은 119 상황실이 목소리로 직접 지도합니다.",
    docId: "DOC-GUIDE-004",
    alternatives: ["지금 119를 누르기", "기침을 계속하시도록 격려하기", "소리가 나오는지 말을 걸어 확인하기"],
  },
  {
    id: "CF-FOREIGN-BODY",
    itemId: "CO-01",
    label: "이물 직접 제거",
    severity: "critical",
    score: 1,
    terms: ["이물을 빼", "이물질을 빼", "빼내 드리", "꺼내 드리", "집어내", "빼내겠", "꺼내겠"],
    onlyTypes: ["EMERGENCY"],
    skipCues: POST_EMERGENCY_CUES,
    message:
      "잠시 멈추겠습니다. 이물을 직접 빼내려는 시도는 상황을 악화시킬 수 있습니다. 이 부분은 119 상황실이 목소리로 직접 지도합니다.",
    docId: "DOC-GUIDE-004",
    alternatives: ["지금 119를 누르기", "어르신 곁을 지키며 상태를 말로 확인하기", "119 안내에 따라 행동하기"],
  },
  {
    id: "CF-SUCTION",
    itemId: "CO-01",
    label: "흡인(석션)",
    severity: "critical",
    score: 1,
    terms: ["흡인기", "석션", "빨아들이", "빨아내"],
    message: "잠시 멈추겠습니다. 흡인은 요양보호사의 업무 범위 밖 의료행위입니다.",
    docId: "DOC-LAW-005",
    alternatives: ["지금 119를 누르기", "간호(조무)사·의료진에게 즉시 연결하기", "관찰한 상태를 그대로 전달하기"],
  },
  {
    id: "CF-ABDOMINAL",
    itemId: "CO-01",
    label: "복부 압박",
    severity: "critical",
    score: 1,
    terms: ["복부를 압박", "배를 누르", "배를 밀어", "하임리", "명치를 눌", "복부 밀어내"],
    message:
      "잠시 멈추겠습니다. 이 앱은 신체 술기를 지도하지 않습니다. 이 부분은 119 상황실이 목소리로 직접 지도합니다.",
    docId: "DOC-GUIDE-004",
    alternatives: ["지금 119를 누르기", "휴대전화를 스피커로 켜 두기", "상황실 안내를 그대로 따르기"],
  },
  {
    id: "CF-RESCUE-BREATH",
    itemId: "CO-01",
    label: "인공호흡·기도 확보 술기",
    severity: "critical",
    score: 1,
    terms: ["인공호흡", "입으로 숨을 불어", "기도를 확보하겠", "턱을 젖혀"],
    message:
      "잠시 멈추겠습니다. 이 앱은 신체 술기를 지도하지 않습니다. 이 부분은 119 상황실이 목소리로 직접 지도합니다.",
    docId: "DOC-GUIDE-004",
    alternatives: ["지금 119를 누르기", "어르신 곁을 지키기", "상황실 안내에 따라 행동하기"],
  },
  {
    id: "CF-LIE-DOWN",
    itemId: "CO-01",
    label: "의식 있는 상태에서 눕히기",
    severity: "critical",
    score: 1,
    terms: ["눕히", "눕혀", "자리에 눕", "바닥에 눕"],
    onlyTypes: ["EMERGENCY"],
    skipCues: POST_EMERGENCY_CUES,
    message:
      "잠시 멈추겠습니다. 기침이 남아 있는 어르신을 눕히면 숨길이 더 막힐 수 있습니다. 앉은 자세를 유지하고 기침을 격려해 주세요.",
    docId: "DOC-GUIDE-004",
    alternatives: ["앉은 자세를 유지하도록 곁에서 지지하기", "기침을 계속하시도록 격려하기", "소리가 나오는지 확인하기"],
  },
  {
    id: "CF-MEDICATION",
    itemId: "CO-01",
    label: "임의 투약 판단",
    severity: "critical",
    score: 1,
    terms: ["약을 드리", "약을 먹이", "약 좀 드", "진통제를", "해열제를", "혈압약을 드리", "소화제를 드"],
    message: "잠시 멈추겠습니다. 약을 드리거나 필요 여부를 판단하는 것은 요양보호사의 업무 범위 밖입니다.",
    docId: "DOC-LAW-005",
    alternatives: ["담당 간호(조무)사·기관에 확인 요청하기", "보호자에게 상황을 알리기", "관찰한 사실을 기록으로 남기기"],
  },
  {
    id: "CF-DOSE",
    itemId: "CO-01",
    label: "임의 용량 조절",
    severity: "critical",
    score: 1,
    terms: ["약을 반으로", "용량을 줄여", "약을 더 드리", "두 알 드리", "약을 빼고"],
    message: "잠시 멈추겠습니다. 약의 용량을 조절하는 판단은 의료인의 영역입니다.",
    docId: "DOC-LAW-005",
    alternatives: ["담당 간호(조무)사에게 문의하기", "기관에 보고하기", "복약 상황을 사실대로 기록하기"],
  },
  {
    id: "CF-INJECTION",
    itemId: "CO-01",
    label: "주사·의료기구 사용",
    severity: "critical",
    score: 1,
    terms: ["주사를 놓", "주사 놓", "인슐린을 놓", "관장을", "도뇨", "카테터"],
    message: "잠시 멈추겠습니다. 주사·의료기구 사용은 무면허 의료행위에 해당합니다.",
    docId: "DOC-LAW-005",
    alternatives: ["담당 간호(조무)사에게 연결하기", "기관에 즉시 보고하기", "관찰 사실만 전달하기"],
  },
  {
    id: "CF-WOUND",
    itemId: "CO-01",
    label: "상처 처치 판단",
    severity: "critical",
    score: 1,
    terms: ["봉합", "꿰매", "소독하고 괜찮", "연고를 바르고 괜찮"],
    message: "잠시 멈추겠습니다. 상처 처치 여부를 판단하는 것은 의료인의 영역입니다.",
    docId: "DOC-LAW-005",
    alternatives: ["출혈이 심하면 지금 119를 누르기", "간호(조무)사·기관에 알리기", "관찰한 상태를 그대로 보고하기"],
  },
  {
    id: "CF-SWALLOW",
    itemId: "CO-01",
    label: "삼킴 강요",
    severity: "critical",
    score: 1,
    terms: ["삼키세", "삼키게 하", "꿀꺽 삼", "그냥 넘기"],
    onlyTypes: ["EMERGENCY"],
    skipCues: POST_EMERGENCY_CUES,
    message: "잠시 멈추겠습니다. 억지로 삼키게 하면 기도로 넘어갈 위험이 커집니다.",
    docId: "DOC-GUIDE-004",
    alternatives: ["식사를 멈추기", "기침을 격려하기", "소리가 나오는지 확인하기"],
  },
  {
    id: "CF-OXYGEN",
    itemId: "CO-01",
    label: "산소 공급 판단",
    severity: "critical",
    score: 1,
    terms: ["산소를 틀", "산소마스크를 씌", "산소를 대 드"],
    message: "잠시 멈추겠습니다. 산소 공급 여부를 판단하는 것은 의료인의 영역입니다.",
    docId: "DOC-LAW-005",
    alternatives: ["지금 119를 누르기", "119 안내를 그대로 따르기", "관찰한 상태를 전달하기"],
  },
  {
    id: "CF-TRANSPORT",
    itemId: "CO-01",
    label: "임의 이송",
    severity: "critical",
    score: 1,
    terms: ["제 차로 병원", "직접 모시고 병원", "업고 병원", "차에 태워서 병원"],
    message: "잠시 멈추겠습니다. 응급 상황에서 직접 이송하면 이동 중 악화를 감당할 수 없습니다.",
    docId: "DOC-GUIDE-004",
    alternatives: ["지금 119를 누르기", "구급대가 올 때까지 곁을 지키기", "주소와 상태를 상황실에 전달하기"],
  },
];

/** ⚑CF 전체 (신체 억제 8종 + 허용 범위 밖 행위 15종) */
export const CRITICAL_RULES: RuleDef[] = [...RESTRAINT_RULES, ...PROHIBITED_ACTION_RULES];

/** 코칭 규칙 — ⚑CF는 아니지만 루브릭에 반영한다 */
export const COACHING_RULES: RuleDef[] = [
  {
    id: "WARN-BACK-BLOW",
    itemId: "CO-01",
    label: "등을 세게 두드림",
    severity: "coaching",
    score: 2,
    terms: ["등을 세게", "세게 두드", "등짝", "힘껏 두드", "세게 쳐"],
    message: "세게 두드리는 대신, 기침을 계속하시도록 격려하고 소리가 나오는지 확인해 주세요.",
    docId: "DOC-GUIDE-004",
  },
  {
    id: "WARN-REALITY",
    itemId: "RE-02",
    label: "현실 직면 강요",
    severity: "coaching",
    score: 2,
    // 현실 직면 강요 패턴 12종
    terms: [
      "여기가 집이에요",
      "여기가 댁이에요",
      "지금 집에 있잖아요",
      "그런 사람 없어요",
      "그런 분 안 계세요",
      "돌아가셨잖아요",
      "이미 돌아가셨어요",
      "아까도 말씀드렸잖아요",
      "기억 안 나세요",
      "정신 차리세요",
      "착각하신 거예요",
      "그런 일 없었어요",
    ],
    message: "사실을 바로잡기 전에, 어르신이 느끼시는 마음을 먼저 말로 알아드려 보세요.",
    docId: "DOC-GUIDE-001",
  },
  {
    id: "WARN-TITLE",
    itemId: "CO-07",
    label: "호칭·존칭 위반",
    severity: "coaching",
    score: 1,
    terms: ["이모", "아줌마", "아저씨", "할멈", "영감", "애기야", "아가야", "우리 아가", "얘가"],
    // 호칭을 바로잡아 달라고 요청하는 발화는 오히려 모범 대응이므로 제외한다
    // ("이모님 아니고 선생님입니다"처럼 짧은 정정문도 걸러지도록 단독 토큰을 함께 둔다)
    except: [
      "선생",
      "호칭",
      "불러",
      "부르",
      "선생님이라고",
      "불러주시면",
      "불러 주시면",
      "라고 불러",
      "이라고 부르",
    ],
    message: "\"어르신\" 또는 성함에 \"님\"을 붙여 부르고, 행동 전에 설명하고 동의를 구해 주세요.",
    docId: "DOC-LAW-003",
  },
  {
    id: "WARN-BANMAL",
    itemId: "CO-07",
    label: "반말·명령형",
    severity: "coaching",
    score: 1,
    terms: [],
    message: "반말·명령형 대신 존칭과 설명, 동의 확인 순으로 말씀해 주세요.",
    docId: "DOC-LAW-003",
  },
  {
    id: "WARN-PII",
    itemId: "CO-08",
    label: "개인정보 노출",
    severity: "coaching",
    score: 1,
    terms: [],
    message: "연락처·주소 같은 개인정보는 말하지 않고 \"[번호]\", \"[주소]\"처럼 가려서 전달해 주세요.",
    docId: "DOC-NOTI-002",
  },
];

/** 문장 끝에 오면 반말·명령형으로 보는 표현 */
const BANMAL_ENDINGS = [
  "앉아",
  "일어나",
  "가만있어",
  "가만 있어",
  "하지마",
  "하지 마",
  "그만해",
  "저리가",
  "저리 가",
  "이리와",
  "이리 와",
  "먹어",
  "먹어라",
  "기다려",
  "안돼",
  "안 돼",
  "됐어",
  "몰라",
  "왜그래",
  "왜 그래",
  "빨리해",
  "빨리 해",
  "조용히해",
  "조용히 해",
];

const ALL_RULES: RuleDef[] = [...CRITICAL_RULES, ...COACHING_RULES];

/**
 * 규칙 id로 규칙 정의를 찾는다. ⚑CF 인터럽트 화면에서 대안 3개를 꺼낼 때 쓴다.
 *
 * @example
 * getRule("CF-RESTRAINT")?.alternatives?.length; // 3
 */
export function getRule(id: string): RuleDef | undefined {
  return ALL_RULES.find((r) => r.id === id);
}

function applies(rule: RuleDef, opts: RuleCheckOptions): boolean {
  if (rule.onlyTypes && rule.onlyTypes.length > 0 && opts.scenarioType) {
    if (!rule.onlyTypes.includes(opts.scenarioType)) return false;
  }
  if (rule.skipCues && opts.cueId && rule.skipCues.includes(opts.cueId)) return false;
  return true;
}

/**
 * 설계서 §4.5의 시나리오별 적용 항목표 게이트.
 * 해당 시나리오에 배정되지 않은 ⚑CF 항목은 인터럽트를 띄우지 않는다.
 * (§3.3 판정선 분리 설계 — 갈등 시나리오에는 ⚑CF를 적용하지 않는다.)
 */
function inAppliedRubric(rule: RuleDef, appliedRubric?: string[]): boolean {
  if (!appliedRubric || appliedRubric.length === 0) return true;
  return appliedRubric.includes(rule.itemId);
}

/* ── 판정 ──────────────────────────────────────────────── */

export interface RuleCheckOptions {
  /** 시나리오 유형 — 유형 한정 규칙(예: 기도폐쇄 관련)이 엉뚱한 시나리오에서 발동하지 않게 한다 */
  scenarioType?: ScenarioType;
  /** 현재 CUE id — 세션 국면 게이트(skipCues)에 쓴다 */
  cueId?: string;
  /**
   * 시나리오의 적용 루브릭 항목 목록(설계서 §4.5).
   * 넘기면, 여기에 없는 ⚑CF 항목은 인터럽트 대신 코칭으로 강등한다.
   */
  appliedRubric?: string[];
}

export interface CriticalCheck {
  /** ⚑CF 여부 */
  cf: boolean;
  /** 화면에 띄울 고정 문구 */
  reason?: string;
  docId?: string;
  ruleId?: string;
  itemId?: string;
  label?: string;
  matched?: string;
  alternatives?: string[];
}

/**
 * ⚑CF 판정 — classify 보다 **먼저** 호출한다.
 *
 * @example
 * checkCritical("문을 잠그겠습니다").cf;                              // true
 * checkCritical("문을 잠그지 않겠습니다").cf;                         // false
 * checkCritical("물 좀 드세요", { scenarioType: "EMERGENCY" }).cf;    // true
 * checkCritical("물 좀 드세요", { scenarioType: "BPSD" }).cf;         // false
 */
export function checkCritical(utterance: string, opts: RuleCheckOptions = {}): CriticalCheck {
  if (!utterance || utterance.trim().length === 0) return { cf: false };
  for (const rule of CRITICAL_RULES) {
    if (!applies(rule, opts)) continue;
    if (!inAppliedRubric(rule, opts.appliedRubric)) continue;
    const hit = findTerm(utterance, rule.terms, rule.except);
    if (hit) {
      return {
        cf: true,
        reason: rule.message,
        docId: rule.docId,
        ruleId: rule.id,
        itemId: rule.itemId,
        label: rule.label,
        matched: hit.term,
        alternatives: rule.alternatives,
      };
    }
  }
  return { cf: false };
}

export interface AdvisoryFinding {
  ruleId: string;
  itemId: string;
  label: string;
  message: string;
  docId?: string;
  score: 1 | 2;
  matched: string;
}

/** 문장 단위로 잘라 준다 (종결어미 뒤에서도 끊는다) */
function splitSentences(text: string): string[] {
  return text
    .replace(/(습니다|했어요|해요|하세요|입니다|이에요|예요|네요|더라고요)(?=\s|$)/g, "$1.")
    .split(/[.!?\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function findBanmalEnding(text: string): string | null {
  for (const sentence of splitSentences(text)) {
    const tail = normalize(sentence);
    for (const ending of BANMAL_ENDINGS) {
      const norm = normalize(ending);
      if (norm.length > 0 && tail.endsWith(norm)) return ending;
    }
  }
  return null;
}

/**
 * ⚑CF는 아니지만 루브릭에 반영해야 하는 위반을 모은다.
 * (현실 직면 강요·반말/호칭·개인정보 노출·등 강타)
 *
 * @example
 * checkAdvisory("여기가 집이에요").map(f => f.itemId); // ["RE-02"]
 * checkAdvisory("같이 앉아 계실까요?");                 // []
 */
export function checkAdvisory(utterance: string, opts: RuleCheckOptions = {}): AdvisoryFinding[] {
  const out: AdvisoryFinding[] = [];
  if (!utterance || utterance.trim().length === 0) return out;

  for (const rule of COACHING_RULES) {
    if (rule.terms.length === 0) continue;
    if (!applies(rule, opts)) continue;
    const hit = findTerm(utterance, rule.terms, rule.except);
    if (hit) {
      out.push({
        ruleId: rule.id,
        itemId: rule.itemId,
        label: rule.label,
        message: rule.message,
        docId: rule.docId,
        score: rule.score,
        matched: hit.term,
      });
    }
  }

  // 설계서 §4.5에서 이 시나리오에 배정되지 않은 ⚑CF 항목은 인터럽트 대신 코칭으로 남긴다.
  // (안내는 사라지지 않고, '치명적 실패' 낙인만 걷어 낸다 — §3.3 판정선 분리)
  for (const rule of CRITICAL_RULES) {
    if (!applies(rule, opts)) continue;
    if (inAppliedRubric(rule, opts.appliedRubric)) continue;
    const hit = findTerm(utterance, rule.terms, rule.except);
    if (hit) {
      out.push({
        ruleId: rule.id,
        itemId: rule.itemId,
        label: rule.label,
        message: rule.message,
        docId: rule.docId,
        score: 2,
        matched: hit.term,
      });
    }
  }

  const banmal = findBanmalEnding(utterance);
  if (banmal && !out.some((f) => f.itemId === "CO-07")) {
    const rule = getRule("WARN-BANMAL");
    if (rule) {
      out.push({
        ruleId: rule.id,
        itemId: rule.itemId,
        label: rule.label,
        message: rule.message,
        docId: rule.docId,
        score: rule.score,
        matched: banmal,
      });
    }
  }

  const pii = maskSpansOnOriginal(utterance).filter((s) => s.kind === "번호" || s.kind === "주소" || s.kind === "생년");
  const firstPii = pii[0];
  if (firstPii) {
    const rule = getRule("WARN-PII");
    if (rule) {
      out.push({
        ruleId: rule.id,
        itemId: rule.itemId,
        label: rule.label,
        message: rule.message,
        docId: rule.docId,
        score: rule.score,
        matched: firstPii.kind,
      });
    }
  }

  return out;
}

/**
 * 코칭 규칙 결과를 루브릭 반영 형태로 바꾼다.
 *
 * @example
 * advisoryHits(checkAdvisory("여기가 집이에요")); // [{ itemId: "RE-02", score: 2 }]
 */
export function advisoryHits(findings: AdvisoryFinding[]): RubricHit[] {
  return findings.map((f) => ({ itemId: f.itemId, score: f.score }));
}

/**
 * 발화에 개인정보로 볼 만한 요소가 있는지 확인한다 (CO-08 보조).
 *
 * @example
 * containsPii("010-1234-5678로 연락 주세요"); // true
 */
export function containsPii(utterance: string): boolean {
  return maskSpansOnOriginal(utterance).some((s) => s.kind !== "성명");
}
