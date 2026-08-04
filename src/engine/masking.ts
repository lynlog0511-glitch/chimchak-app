/**
 * 침착(ChimChak) 가명처리 엔진.
 *
 * 학습자 발화·보고문에서 개인을 식별할 수 있는 요소를 찾아 고정 토큰으로 치환한다.
 * 전부 브라우저 안에서 도는 결정론 규칙이며 외부 호출이 0건이다.
 * 경량 LLM(교체형 어댑터)을 붙이더라도, 반드시 이 함수를 통과한 결과만 넘긴다.
 *
 * ⚠ 좌표 규약: MaskResult.spans 의 start/end 는 **결과 문자열(masked) 기준**이다.
 *    원문 좌표가 필요하면 maskSpansOnOriginal() 을 쓴다.
 *
 * @example
 * maskText("박 어르신이 010-1234-5678로 전화하셨어요")
 * // → { masked: "[대상자]이 [번호]로 전화하셨어요", spans: [{ start: 0, end: 5, kind: "성명", replaced: "[대상자]" }, ...] }
 */

import type { MaskResult, MaskSpan } from "@/types";

export type MaskKind = MaskSpan["kind"];

/** 화면에 붙일 종류 라벨 (report 화면의 하이라이트 범례용) */
export const MASK_KIND_LABELS: Record<MaskKind, string> = {
  성명: "성명",
  번호: "번호",
  기관명: "기관명",
  주소: "주소",
  생년: "생년",
};

/** 왜 가렸는지 — 화면에 그대로 노출해도 되는 존댓말 설명 */
export const MASK_KIND_REASONS: Record<MaskKind, string> = {
  성명: "개인을 특정할 수 있는 이름이라 가렸습니다.",
  번호: "연락처·식별번호로 쓰일 수 있어 가렸습니다.",
  기관명: "이용 기관이 드러나면 개인이 좁혀지므로 가렸습니다.",
  주소: "거주지가 드러나면 개인이 특정되므로 가렸습니다.",
  생년: "생년월일은 민감한 식별 정보라 가렸습니다.",
};

/** 치환 토큰 */
export const MASK_TOKENS: Record<MaskKind, string> = {
  성명: "[대상자]",
  번호: "[번호]",
  기관명: "[기관]",
  주소: "[주소]",
  생년: "[생년]",
};

/* ── 사전 ──────────────────────────────────────────────── */

/** 한국 성씨(빈도 상위) — 문자 클래스로 사용 */
const SURNAMES = "김이박최정강조윤장임한오서신권황안송류전홍고문양손배백남심노하곽성차주우구원";

/** 등장인물 표기에 붙는 호칭 (성 + 호칭) */
const CHARACTER_TITLES = "어르신|할머님|할아버님|할머니|할아버지|여사님|여사|선생님|씨";

/** 성씨+이름 뒤에 붙어 사람임을 드러내는 표지 */
const NAME_MARKERS = "님|씨|어르신|할머님|할아버님|할머니|할아버지|보호자|선생님|께서|에게|한테|께";

/** 성씨로 시작하지만 사람 이름이 아닌 말 — 성명 휴리스틱에서 제외 */
const NAME_STOPWORDS = new Set([
  "이모",
  "이모부",
  "고모",
  "장모",
  "이사",
  "이장",
  "이용자",
  "고객",
  "주임",
  "원장",
  "차장",
  "구청장",
  "정부",
  "우리",
  "조카",
  "남편",
  "임시",
  "안내",
  "전화",
  "정말",
  "최근",
  "하나",
  "오늘",
  "오전",
  "오후",
  "서로",
  "신경",
  "문제",
  "양해",
  "심장",
  "노인",
  "하루",
  "주말",
  "구조",
  "원인",
  "안전",
  "안심",
  "성함",
  "차이",
  "배려",
  "문의",
  "백번",
  "고생",
  "홍보",
  "송구",
  "황당",
  "권리",
  "박수",
  "강조",
  "조금",
  "장소",
  "김치",
  "전달",
  "정도",
  "이번",
  "이야",
  "이분",
  "저분",
]);

/** 기관 어미 앞에 오더라도 특정 기관으로 보기 어려운 말 */
const ORG_PREFIX_STOPWORDS = new Set(["우리", "저희", "동네", "근처", "지역", "인근", "해당", "종합", "큰", "작은", "일반"]);

/** 기관 어미 (긴 것 우선) */
const ORG_SUFFIX = [
  "치매안심센터",
  "노인복지관",
  "재가복지센터",
  "주간보호센터",
  "요양병원",
  "재가센터",
  "주간보호",
  "복지관",
  "요양원",
  "보건소",
  "데이케어",
  "병원",
  "의원",
  "센터",
  "재가",
].join("|");

/* ── 규칙 정의 ─────────────────────────────────────────── */

interface MaskRule {
  id: string;
  kind: MaskKind;
  /** 전역 매칭용 정규식 (g 플래그는 내부에서 보장) */
  pattern: RegExp;
  /** 실제로 가릴 캡처 그룹 번호 (없으면 매치 전체) */
  group?: number;
  /** 낮을수록 우선 — 겹치면 우선순위가 높은 규칙이 이긴다 */
  priority: number;
  /** 추가 검증 — false면 후보에서 제외 */
  accept?: (matched: string, text: string, start: number, end: number) => boolean;
}

const HANGUL = /[가-힣]/;

function isHangulAt(text: string, index: number): boolean {
  if (index < 0 || index >= text.length) return false;
  return HANGUL.test(text.charAt(index));
}

const MASK_RULES: MaskRule[] = [
  // 주민등록번호 형태
  {
    id: "no-rrn",
    kind: "번호",
    pattern: /\d{6}\s*[-–—]\s*\d{7}/g,
    priority: 1,
  },
  // 생년 표기
  {
    id: "birth-year",
    kind: "생년",
    pattern: /(?:19|20)\d{2}\s*년(?:\s*\d{1,2}\s*월\s*\d{1,2}\s*일)?\s*(?:생|출생)/g,
    priority: 2,
  },
  // 전화번호
  {
    id: "no-phone",
    kind: "번호",
    pattern: /0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}/g,
    priority: 3,
  },
  // 6자리 이상 연속 숫자
  {
    id: "no-long-digits",
    kind: "번호",
    pattern: /\d{6,}/g,
    priority: 4,
  },
  // 주소 — 시/도·구/군이 앞에 붙는 형태
  {
    id: "addr-full",
    kind: "주소",
    pattern:
      /(?:[가-힣○〇xX]{1,10}(?:시|도)\s*)?[가-힣○〇xX]{1,10}(?:구|군)\s*[가-힣0-9○〇xX]{1,10}(?:로|길|동)\s*\d{1,4}(?:-\d{1,4})?(?:번지|번길|호)?/g,
    priority: 5,
  },
  // 주소 — "○○로 12", "행복길 3-2"
  {
    id: "addr-street",
    kind: "주소",
    pattern: /[가-힣0-9○〇xX]{1,10}(?:로|길)\s*\d{1,4}(?:-\d{1,4})?(?:번지|번길)?/g,
    priority: 6,
  },
  // 주소 — "○○동 123번지"
  {
    id: "addr-dong",
    kind: "주소",
    pattern: /[가-힣0-9○〇xX]{1,10}(?:동|리)\s*\d{1,4}\s*번지/g,
    priority: 6,
  },
  // 주소 — 공동주택 동·호수
  {
    id: "addr-apt",
    kind: "주소",
    pattern: /\d{1,4}\s*동\s*\d{1,4}\s*호/g,
    priority: 6,
  },
  // 기관명
  {
    id: "org",
    kind: "기관명",
    pattern: new RegExp(`[가-힣A-Za-z0-9○〇]{1,10}(?:${ORG_SUFFIX})`, "g"),
    priority: 7,
    accept: (matched, text, start) => {
      if (isHangulAt(text, start - 1)) return false;
      const suffix = ORG_SUFFIX.split("|").find((s) => matched.endsWith(s));
      if (!suffix) return false;
      const prefix = matched.slice(0, matched.length - suffix.length);
      if (prefix.length === 0) return false;
      return !ORG_PREFIX_STOPWORDS.has(prefix);
    },
  },
  // 등장인물 표기 — 성 + 호칭 ("박 어르신", "김 씨")
  {
    id: "name-character",
    kind: "성명",
    pattern: new RegExp(`[${SURNAMES}]\\s?(?:${CHARACTER_TITLES})`, "g"),
    priority: 8,
    accept: (matched, text, start, end) => {
      if (isHangulAt(text, start - 1)) return false;
      // "씨"/"여사"로 끝나면 뒤에 다른 글자가 이어지지 않아야 한다 ("박 씨앗" 오탐 방지)
      if ((matched.endsWith("씨") || matched.endsWith("여사")) && isHangulAt(text, end)) return false;
      return true;
    },
  },
  // 성씨 + 이름(1~3자) + 사람 표지 ("김영수 님", "박말순 어르신", "이영희에게")
  {
    id: "name-heuristic",
    kind: "성명",
    pattern: new RegExp(`([${SURNAMES}][가-힣]{1,3})\\s?(?:${NAME_MARKERS})`, "g"),
    group: 1,
    priority: 9,
    accept: (matched, text, start) => {
      if (isHangulAt(text, start - 1)) return false;
      return !NAME_STOPWORDS.has(matched);
    },
  },
];

/* ── 후보 수집 ─────────────────────────────────────────── */

interface Candidate {
  start: number;
  end: number;
  kind: MaskKind;
  replaced: string;
  priority: number;
}

function collectCandidates(text: string): Candidate[] {
  const found: Candidate[] = [];
  for (const rule of MASK_RULES) {
    const flags = rule.pattern.flags.includes("g") ? rule.pattern.flags : `${rule.pattern.flags}g`;
    const re = new RegExp(rule.pattern.source, flags);
    let m = re.exec(text);
    while (m !== null) {
      if (m[0].length === 0) {
        re.lastIndex += 1;
        m = re.exec(text);
        continue;
      }
      const whole = m[0];
      const groupText = rule.group !== undefined ? m[rule.group] : whole;
      if (groupText && groupText.length > 0) {
        const offset = rule.group !== undefined ? whole.indexOf(groupText) : 0;
        const start = m.index + (offset >= 0 ? offset : 0);
        const end = start + groupText.length;
        const ok = rule.accept ? rule.accept(groupText, text, start, end) : true;
        if (ok) {
          found.push({ start, end, kind: rule.kind, replaced: MASK_TOKENS[rule.kind], priority: rule.priority });
        }
      }
      m = re.exec(text);
    }
  }
  return found;
}

/** 겹치는 후보 제거 — 우선순위(작은 값) → 길이(긴 것) → 앞선 위치 순으로 채택 */
function resolveOverlap(candidates: Candidate[]): Candidate[] {
  const sorted = [...candidates].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    const lenA = a.end - a.start;
    const lenB = b.end - b.start;
    if (lenA !== lenB) return lenB - lenA;
    return a.start - b.start;
  });
  const accepted: Candidate[] = [];
  for (const c of sorted) {
    const clash = accepted.some((a) => c.start < a.end && a.start < c.end);
    if (!clash) accepted.push(c);
  }
  return accepted.sort((a, b) => a.start - b.start);
}

/* ── 공개 API ──────────────────────────────────────────── */

/**
 * 가명처리 실행.
 *
 * @param text 원문 (마이크 인식 결과 또는 타이핑 입력)
 * @returns masked = 치환된 문자열, spans = **masked 기준** 좌표
 *
 * @example
 * const r = maskText("행복요양원 김영수 님이 서울시 강남구 행복로 12에 사십니다");
 * r.masked; // "[기관] [대상자] 님이 [주소]에 사십니다"
 * r.spans.map(s => s.kind); // ["기관명", "성명", "주소"]
 */
export function maskText(text: string): MaskResult {
  if (!text) return { masked: "", spans: [] };
  const accepted = resolveOverlap(collectCandidates(text));
  let masked = "";
  let cursor = 0;
  const spans: MaskSpan[] = [];
  for (const c of accepted) {
    masked += text.slice(cursor, c.start);
    const start = masked.length;
    masked += c.replaced;
    spans.push({ start, end: masked.length, kind: c.kind, replaced: c.replaced });
    cursor = c.end;
  }
  masked += text.slice(cursor);
  return { masked, spans };
}

/**
 * 같은 규칙을 원문 좌표로 돌려준다. 원문 위에 하이라이트를 그릴 때 쓴다.
 *
 * @example
 * maskSpansOnOriginal("박 어르신께"); // [{ start: 0, end: 5, kind: "성명", replaced: "[대상자]" }]
 */
export function maskSpansOnOriginal(text: string): MaskSpan[] {
  if (!text) return [];
  return resolveOverlap(collectCandidates(text)).map((c) => ({
    start: c.start,
    end: c.end,
    kind: c.kind,
    replaced: c.replaced,
  }));
}

/**
 * 가려진 것이 있는지만 빠르게 확인한다.
 *
 * @example
 * hasSensitive("오늘 기분이 좋으셨습니다"); // false
 */
export function hasSensitive(text: string): boolean {
  return maskSpansOnOriginal(text).length > 0;
}

/**
 * 종류별 개수 — 화면 안내 문구("성명 1건, 번호 1건을 가렸습니다")에 쓴다.
 *
 * @example
 * countByKind(maskText("박 어르신 010-1234-5678").spans); // { 성명: 1, 번호: 1 }
 */
export function countByKind(spans: MaskSpan[]): Partial<Record<MaskKind, number>> {
  const out: Partial<Record<MaskKind, number>> = {};
  for (const s of spans) {
    out[s.kind] = (out[s.kind] ?? 0) + 1;
  }
  return out;
}

/**
 * masked 문자열을 하이라이트용 조각으로 쪼갠다. UI가 span 계산을 다시 하지 않도록 돕는다.
 *
 * @example
 * splitMasked(maskText("박 어르신께"));
 * // [{ text: "[대상자]", masked: true, kind: "성명" }, { text: "께", masked: false }]
 */
export function splitMasked(result: MaskResult): { text: string; masked: boolean; kind?: MaskKind }[] {
  const parts: { text: string; masked: boolean; kind?: MaskKind }[] = [];
  let cursor = 0;
  for (const s of result.spans) {
    if (s.start > cursor) parts.push({ text: result.masked.slice(cursor, s.start), masked: false });
    parts.push({ text: result.masked.slice(s.start, s.end), masked: true, kind: s.kind });
    cursor = s.end;
  }
  if (cursor < result.masked.length) parts.push({ text: result.masked.slice(cursor), masked: false });
  return parts;
}
