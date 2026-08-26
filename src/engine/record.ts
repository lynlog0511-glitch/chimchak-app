/**
 * 침착(ChimChak) 기록 코칭 엔진 — 보고 발화에서 급여제공기록지 5요소를 뽑아낸다.
 *
 * 5요소: 시각 · 누가 · 무엇을 · 조치 · 현재 상태 (설계서 CL-01·CL-03)
 * 키워드·정규식 휴리스틱만 쓰는 결정론 함수이며 외부 호출이 0건이다.
 * 뽑지 못한 슬롯은 missing에 담아, 화면이 그 칸을 묻는 질문 한마디로 안내하게 한다.
 */

import type { RecordDraft } from "@/types";

export type RecordSlot = "time" | "who" | "what" | "action" | "status";

/** 화면 라벨 */
export const RECORD_SLOT_LABELS: Record<RecordSlot, string> = {
  time: "시각",
  who: "누가",
  what: "무엇을",
  action: "조치",
  status: "현재 상태",
};

/** 비었을 때 띄울 안내 문구 */
export const RECORD_SLOT_HINTS: Record<RecordSlot, string> = {
  time: "몇 시 몇 분에 있었던 일인지 채워 주세요.",
  who: "누구에게 있었던 일인지 채워 주세요.",
  what: "무슨 일이 있었는지 보이는 대로 채워 주세요.",
  action: "그때 무엇을 하셨는지 채워 주세요.",
  status: "지금은 어떤 상태인지 채워 주세요.",
};

/**
 * 비었을 때 그 자리에서 되묻는 한마디 — **질문 그대로**다.
 *
 * `RECORD_SLOT_HINTS`가 「…채워 주세요」로 끝나는 지시문이라면, 이쪽은 사람이 옆에서 물어보는
 * 말이다. 빈 칸이 셋일 때 「채워 주세요」가 셋 늘어서면 남은 것이 숙제로 읽히는데, 질문이
 * 셋이면 그냥 대답하게 된다 — 실제로 대답이 곧 그 칸의 값이다(페르소나 PM P2).
 *
 * 화면은 이 문장을 **그대로** 세운다. 앞에 「채워 주세요 — 」를 붙이지 않는다(2026-08-26):
 * 붙이면 없애려던 지시문이 빈 칸 수만큼 다시 늘어서서, 이 상수를 만든 이유가 사라진다.
 *
 * 여기 있는 것은 **표시 문구뿐**이고, 판정·추출 로직은 이 상수를 읽지 않는다.
 *
 * @example RECORD_SLOT_QUESTIONS.time; // "몇 시쯤이었나요?"
 */
export const RECORD_SLOT_QUESTIONS: Record<RecordSlot, string> = {
  time: "몇 시쯤이었나요?",
  who: "어느 분 이야기인가요?",
  what: "무슨 일이 있었나요?",
  action: "어떻게 하셨나요?",
  status: "지금은 어떠신가요?",
};

const SLOT_ORDER: RecordSlot[] = ["time", "who", "what", "action", "status"];

/* ── 사전 ──────────────────────────────────────────────── */

const SUBJECT_TOKENS = [
  "[대상자]",
  "어르신",
  "이용자",
  "수급자",
  "보호자",
  "따님",
  "아드님",
  "가족분",
  "센터장",
  "간호사",
];

const EVENT_KEYWORDS = [
  "사레",
  "기침",
  "삼키",
  "넘어",
  "낙상",
  "미끄러",
  "부딪",
  "떨어",
  "배회",
  "나가려",
  "현관",
  "거부",
  "요구",
  "흥분",
  "초조",
  "불안",
  "통증",
  "아프",
  "열이",
  "출혈",
  "경련",
  "의식",
  "호흡",
  "식사",
  "고함",
  "욕설",
  "울",
  "젖",
  "실금",
];

const ACTION_KEYWORDS = [
  "119",
  "중단",
  "멈추",
  "확인",
  "안내",
  "보고",
  "연락",
  "전화",
  "도움",
  "부축",
  "지지",
  "제공",
  "유도",
  "설명",
  "요청",
  "기록",
  "동행",
  "앉으시",
  "앉게",
  "진정",
  "달래",
  "기다",
  "드렸",
  "해 드",
  "켜",
  "닦",
  "갈아",
  "옮겨",
  "인계",
];

const STATUS_KEYWORDS = [
  "현재",
  "지금",
  "이후",
  "안정",
  "진정",
  "호전",
  "이송",
  "귀가",
  "유지",
  "확보",
  "특이사항",
  "계십니다",
  "계세요",
  "주무",
  "돌아오",
  "돌아가",
  "상태",
];

/* ── 문장 처리 ─────────────────────────────────────────── */

/**
 * 보고 발화를 문장 단위로 나눈다. 마침표 없이 말하는 경우가 많아 종결어미 뒤에서도 끊는다.
 *
 * @example
 * splitSentences("16시 40분에 어르신이 나가려 하셨습니다 거실 불을 켜 드렸습니다");
 * // ["16시 40분에 어르신이 나가려 하셨습니다", "거실 불을 켜 드렸습니다"]
 */
export function splitSentences(text: string): string[] {
  return text
    .replace(/(습니다|했어요|해요|하셨어요|하셨습니다|였습니다|이었어요|입니다|이에요|예요|네요)(?=\s|$)/g, "$1.")
    .split(/[.!?\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function firstSentenceWith(sentences: string[], keywords: string[], skip?: Set<number>): { index: number; text: string } | null {
  for (let i = 0; i < sentences.length; i += 1) {
    if (skip?.has(i)) continue;
    const sentence = sentences[i];
    if (!sentence) continue;
    if (keywords.some((k) => sentence.includes(k))) return { index: i, text: sentence };
  }
  return null;
}

function lastSentenceWith(sentences: string[], keywords: string[], skip?: Set<number>): { index: number; text: string } | null {
  for (let i = sentences.length - 1; i >= 0; i -= 1) {
    if (skip?.has(i)) continue;
    const sentence = sentences[i];
    if (!sentence) continue;
    if (keywords.some((k) => sentence.includes(k))) return { index: i, text: sentence };
  }
  return null;
}

/* ── 슬롯 추출 ─────────────────────────────────────────── */

const TIME_PATTERNS: RegExp[] = [
  /(오전|오후|아침|점심|저녁|새벽|밤)?\s*\d{1,2}\s*시\s*(?:\d{1,2}\s*분)?\s*(?:경|쯤)?/,
  /\d{1,2}\s*:\s*\d{2}/,
  /(오늘|어제|방금|조금\s*전|점심\s*무렵|저녁\s*무렵)\s*(오전|오후|아침|점심|저녁|새벽|밤)?/,
];

/**
 * 시각 표현을 뽑는다.
 *
 * @example
 * extractTime("오후 4시 40분쯤 있었던 일입니다"); // "오후 4시 40분쯤"
 */
export function extractTime(text: string): string {
  for (const pattern of TIME_PATTERNS) {
    const m = pattern.exec(text);
    if (m && m[0].trim().length > 0) return m[0].trim().replace(/\s+/g, " ");
  }
  return "";
}

/**
 * 대상(누가)을 뽑는다. 가명처리된 "[대상자]"도 인식한다.
 *
 * @example
 * extractWho("[대상자]께서 현관 앞에 서 계셨습니다"); // "[대상자]"
 */
export function extractWho(text: string): string {
  for (const token of SUBJECT_TOKENS) {
    if (text.includes(token)) return token;
  }
  return "";
}

/**
 * 보고 발화에서 급여제공기록지 5요소 초안을 만든다.
 *
 * @example
 * const d = extractDraft("오후 4시 40분에 어르신이 현관에서 나가려 하셨습니다. 거실 불을 켜 드리고 화장실로 안내했습니다. 지금은 진정되어 소파에 앉아 계십니다.");
 * d.time;    // "오후 4시 40분"
 * d.who;     // "어르신"
 * d.action;  // "거실 불을 켜 드리고 화장실로 안내했습니다"
 * d.missing; // []
 */
export function extractDraft(text: string): RecordDraft {
  const source = (text ?? "").trim();
  if (source.length === 0) {
    return recomputeMissing({ time: "", who: "", what: "", action: "", status: "", missing: [] });
  }

  const sentences = splitSentences(source);
  const used = new Set<number>();

  const time = extractTime(source);
  const who = extractWho(source);

  const eventHit = firstSentenceWith(sentences, EVENT_KEYWORDS);
  let what = eventHit?.text ?? "";
  if (eventHit) used.add(eventHit.index);
  if (what.length === 0 && sentences.length > 0) {
    const first = sentences[0];
    if (first) {
      what = first;
      used.add(0);
    }
  }

  const actionHit = firstSentenceWith(sentences, ACTION_KEYWORDS, used);
  const action = actionHit?.text ?? "";
  if (actionHit) used.add(actionHit.index);

  const statusHit = lastSentenceWith(sentences, STATUS_KEYWORDS, used);
  const status = statusHit?.text ?? "";

  return recomputeMissing({ time, who, what, action, status, missing: [] });
}

/**
 * 사용자가 슬롯을 고친 뒤 missing 목록을 다시 계산한다.
 *
 * @example
 * recomputeMissing({ ...draft, status: "지금은 안정되셨습니다" }).missing; // ["조치"] 등
 */
export function recomputeMissing(draft: RecordDraft): RecordDraft {
  const missing = SLOT_ORDER.filter((slot) => (draft[slot] ?? "").trim().length === 0).map(
    (slot) => RECORD_SLOT_LABELS[slot],
  );
  return { ...draft, missing };
}

/**
 * 5요소가 모두 채워졌는지.
 *
 * @example
 * isDraftComplete(draft); // false
 */
export function isDraftComplete(draft: RecordDraft): boolean {
  return SLOT_ORDER.every((slot) => (draft[slot] ?? "").trim().length > 0);
}

/**
 * 슬롯 충족률 (내부 지표 — 화면에 수치로 표시하지 않는다).
 *
 * @example
 * slotFillRatio(draft); // 0.8
 */
export function slotFillRatio(draft: RecordDraft): number {
  const filled = SLOT_ORDER.filter((slot) => (draft[slot] ?? "").trim().length > 0).length;
  return filled / SLOT_ORDER.length;
}

/**
 * 급여제공기록지 특이사항 초안 문자열.
 *
 * @example
 * formatDraft(draft);
 * // "시각: 오후 4시 40분\n누가: 어르신\n무엇을: …\n조치: …\n현재 상태: …"
 */
export function formatDraft(draft: RecordDraft): string {
  return SLOT_ORDER.map((slot) => {
    const value = (draft[slot] ?? "").trim();
    return `${RECORD_SLOT_LABELS[slot]}: ${value.length > 0 ? value : "(비어 있음)"}`;
  }).join("\n");
}
