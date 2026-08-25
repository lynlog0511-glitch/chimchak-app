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

/**
 * 한국 성씨(통계청 인구총조사 빈도 상위 60성 수준) — 문자 클래스로 사용.
 *
 * 사전이 얇으면 가명처리가 조용히 새는데, 화면은 아무 일도 없었던 것처럼 돌아간다.
 * 실제로 「유 어르신」·「천말숙 님」·「엄 씨가」·「지·진·표·방·현 + 어르신」이 통째로
 * 남아 있었다. 성씨 한 글자를 빠뜨린 대가가 실명 노출이므로 상위 성씨를 넉넉히 채운다.
 * (한 글자만 보고 사람이라고 단정하지 않는 장치는 아래 accept·예외어가 맡는다.)
 */
const SURNAMES =
  "김이박최정강조윤장임한오서신권황안송류유전홍고문양손배백허남심노하곽성차주우구원진지엄채천방공현함변염여추도소석선설마길위표민나";

/** 등장인물 표기에 붙는 호칭 (성 + 호칭) */
const CHARACTER_TITLES = "어르신|할머님|할아버님|할머니|할아버지|여사님|여사|선생님|씨";

/** 성씨+이름 뒤에 붙어 사람임을 드러내는 표지 */
const NAME_MARKERS = "님|씨|어르신|할머님|할아버님|할머니|할아버지|보호자|선생님|께서|에게|한테|께";

/**
 * 이름 뒤에 바로 붙는 **일반 조사**.
 *
 * "김영수는 저녁 식사를 거부하셨습니다"처럼 호칭 없이 이름만 부른 문장이 그대로 새고 있었다.
 * 다만 조사는 사람 표지가 아니라 문장 성분 표지라, 같은 규칙을 NAME_MARKERS에 그냥 얹으면
 * "오늘 기분이 좋으셨습니다"까지 이름으로 읽는다. 그래서 조사 규칙은 별도 규칙(name-josa)으로
 * 두고 **성 1자 + 이름 2자(세 글자 이름)** 로만 좁혔다. 한국 성명의 대다수가 세 글자다.
 */
const NAME_JOSA = "은|는|이|가|을|를|과|와|도|의";

/**
 * 이름 두 번째·세 번째 글자로 흔히 쓰는 음절.
 *
 * 조사만 보고 이름이라고 하면 한국어 산문이 통째로 걸린다("여기에는"·"하는지를"·"고르시는"은
 * 전부 성씨 + 두 글자 + 조사 꼴이다). 그래서 조사 규칙은 **이름에 쓰는 음절로 된 두 글자**
 * 일 때만 발동한다. 목록은 이 앱이 마주하는 세대(1930~50년대생)의 이름 음절 쪽으로 기울여
 * 두었고, 「기·서·지」처럼 산문에서 조사·어미와 겹치는 음절은 일부러 뺐다.
 * 여기서 놓친 이름은 호칭 규칙(성 + 어르신·님·씨)이 다시 받는다.
 */
const GIVEN_NAME_SYLLABLES = new Set(
  ("영수순자옥숙희미남만말복분삼상성세소송승신애양연열용원월윤은익인일임재정제종준중진찬창철" +
    "춘충태학한향헌현형혜호환효훈흥길대덕동두란례룡리명무문병보봉범석선설섭식실심아안" +
    "완우웅유육채천초필팔칠홍황회규").split(""),
);

/**
 * "씨"/"여사" 바로 뒤에 붙어도 사람 지칭을 깨지 않는 조사의 첫 글자.
 * ("김 씨가 오셨습니다"는 가려야 하고 "박 씨앗을 심었습니다"는 남겨야 한다.
 *  다음 글자가 조사면 지칭, 아니면 다른 낱말의 일부로 본다 — 과하게 가리는 쪽이 안전.)
 */
const TITLE_JOSA = new Set([
  "가", "는", "도", "를", "만", "와", "과", "께", "랑", "에", "한", "의", "보", "부", "까", "조", "마", "처",
]);

/**
 * 성씨로 시작하지만 사람 이름이 아닌 말 — 성명 휴리스틱에서 제외.
 *
 * 성씨 사전(60성)과 조사 규칙을 함께 넓히면 "마지막을"·"현관문을"처럼 성씨로 시작하는
 * 세 글자 낱말이 전부 이름으로 보인다. 과하게 가리는 쪽이 안전하다는 원칙은 유지하되,
 * 화면에 그대로 보이는 보고문이 걸레가 되지 않도록 **현장에서 실제로 쓰는 말**만 추린다.
 * (두 글자 항목은 성+호칭 규칙용, 세 글자 항목은 조사 규칙용이다.)
 */
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
  // ── 성씨 사전을 60성으로 넓히며 함께 늘린 두 글자 예외어 ──
  "함께",
  "선생",
  "여기",
  "저기",
  "거기",
  "지금",
  "방금",
  "마음",
  "도움",
  "소리",
  "진짜",
  "천천",
  "나중",
  "위험",
  "현관",
  "방문",
  "표정",
  "설명",
  "소변",
  "대변",
  "식사",
  "복도",
  "화장",
  // ── 조사 규칙(name-josa)이 잡는 세 글자 낱말 ──
  "현관문",
  "신발장",
  "문고리",
  "손잡이",
  "손가락",
  "구급대",
  "구급차",
  "지팡이",
  "진정제",
  "진료실",
  "정신과",
  "오전에",
  "오후에",
  "주간에",
  "주무시",
  "마지막",
  "나머지",
  "나중에",
  "지난주",
  "도시락",
  "소독약",
  "소변량",
  "설거지",
  "선생님",
  "원장님",
  "여러분",
  "방문객",
  "방바닥",
  "고혈압",
  "양치질",
  "배설물",
  "심호흡",
  "하반신",
  "허벅지",
  "위험도",
  "전화기",
  "안내문",
  "노인정",
  "변비약",
  "최근에",
  "조리실",
  "서랍장",
  "한마디",
  "이야기",
  "임시로",
  "정상적",
  "정기적",
  "고정적",
  "구급대원",
  "정황",
  "하면",
  "전에",
]);

/** 기관 어미 앞에 오더라도 특정 기관으로 보기 어려운 말 */
const ORG_PREFIX_STOPWORDS = new Set(["우리", "저희", "동네", "근처", "지역", "인근", "해당", "종합", "큰", "작은", "일반"]);

/** 기관 어미 (긴 것 우선) */
const ORG_SUFFIX = [
  "치매안심센터",
  "노인복지관",
  "재가복지센터",
  "주간보호센터",
  "노인요양시설",
  "실버타운",
  "요양병원",
  "요양시설",
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

/** 도로명 번지로 볼 수 없는 숫자 — 이 앱에서는 신고 번호가 압도적으로 많다 */
const EMERGENCY_NUMBERS = new Set(["119", "112", "911"]);

/** 숫자 뒤에 이런 단위가 붙으면 번지가 아니라 수량이다 */
const UNIT_AFTER_NUMBER = ["초", "분", "시", "개", "명", "건", "살", "년", "회", "번", "점", "단계", "쪽", "인"];

/**
 * 「○○동」으로 끝나지만 주소가 아닌 말 — 동(洞) 규칙에서 제외한다.
 * 낱말 끝이 이 목록으로 끝나면(「이상행동」·「야간활동」) 주소로 보지 않는다.
 */
const DONG_STOPWORD_TAILS = [
  "행동",
  "활동",
  "이동",
  "운동",
  "작동",
  "출동",
  "거동",
  "자동",
  "수동",
  "진동",
  "감동",
  "소동",
  "공동",
  "합동",
  "협동",
  "노동",
  "아동",
  "변동",
  "발동",
  "시동",
  "부동",
  "회동",
  "충동",
  "요동",
  "격동",
  "언동",
  "반동",
  "가동",
  "선동",
  "유동",
  "능동",
  "피동",
  "중동",
];

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

/** 이름 뒤가 아니라 낱말 뒤에 붙은 것으로 보이는 꼬리 — 벗겨서 예외어와 한 번 더 대조한다 */
const TRIMMABLE_TAILS = ["님", "은", "는", "이", "가", "을", "를", "도", "의", "과", "와"];

/**
 * 이름 후보가 사람 이름이 아니라 흔한 낱말인지.
 * 탐욕적 매칭이 존칭·조사까지 삼키는 경우("원장님께" → 캡처 "원장님",
 * "여기가 어르신" → 캡처 "여기가")가 있어 꼬리를 벗긴 형태도 함께 본다.
 */
function isCommonWord(candidate: string): boolean {
  if (NAME_STOPWORDS.has(candidate)) return true;
  const tail = TRIMMABLE_TAILS.find((t) => candidate.endsWith(t) && candidate.length > t.length);
  return tail !== undefined && NAME_STOPWORDS.has(candidate.slice(0, -tail.length));
}

const MASK_RULES: MaskRule[] = [
  // 주민등록번호 형태
  {
    id: "no-rrn",
    kind: "번호",
    pattern: /\d{6}\s*[-–—]\s*\d{7}/g,
    priority: 1,
  },
  /*
   * 이메일 주소.
   *
   * 휴리스틱의 회색지대가 아니라 확정적인 범주다 — 정규식 하나면 끝나는데 규칙이 아예 없어
   * `kimyoungsu@naver.com`이 그대로 나가고 있었다. 종류는 「번호」로 둔다(연락처·식별자로
   * 쓰이는 값이고, 화면 범례에 새 이름을 하나 더 만들지 않는 편이 안내가 짧다).
   */
  {
    id: "contact-email",
    kind: "번호",
    pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
    priority: 1,
  },
  /*
   * 링크 — http(s) 주소와 도메인만 적은 형태(오픈채팅 초대 링크 포함).
   *
   * `https://open.kakao.com/o/abc123`처럼 링크 하나가 곧 연락 수단인 경우가 있어 이메일과 같은
   * 무게로 다룬다. 아래쪽 `www.`·`도메인/경로` 분기는 경로(`/…`)가 붙었을 때만 잡는다 —
   * "농협은행.kr" 같은 말은 없고, 경로 없는 낱말을 도메인으로 오인하면 문장이 걸레가 된다.
   */
  {
    id: "contact-url",
    kind: "번호",
    pattern:
      /(?:https?:\/\/|www\.)[A-Za-z0-9\-._~:/?#@!$&*+,;=%]*[A-Za-z0-9/]|[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.(?:com|net|org|kr|io|me|link)\/[A-Za-z0-9\-._~:/?#@!$&*+,;=%]*/g,
    priority: 1,
  },
  // 생년 표기 — "1948년생"과 현장에서 더 흔한 축약형("43년생")을 함께 받는다
  {
    id: "birth-year",
    kind: "생년",
    pattern: /(?:19|20)?\d{2}\s*년(?:\s*\d{1,2}\s*월\s*\d{1,2}\s*일)?\s*(?:생|출생)/g,
    priority: 2,
  },
  /*
   * 생년월일 — 「생/출생」이 뒤에 붙지 않는 표기.
   *
   * 위 규칙이 끝에 `생|출생`을 요구해서, **가장 흔한 표기인 「1948년 3월 2일」이 통과했다.**
   * 「생년」이라는 범주를 화면에 이름 붙여 두고 그 범주의 대표형을 놓치던 자리다.
   * 네 자리 연도를 요구하므로 "3년 5월"·"2년 뒤" 같은 말은 걸리지 않고, 연도 앞에 숫자가
   * 이어지는 경우(전화번호 조각 등)는 accept에서 제외한다.
   */
  {
    id: "birth-date",
    kind: "생년",
    pattern: /(?:19|20)\d{2}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일/g,
    priority: 2,
    accept: (_matched, text, start) => !/\d/.test(text.charAt(start - 1)),
  },
  // 전화번호 — 구분자로 붙임표 대신 줄표(–·—)를 쓴 표기도 같은 번호다
  {
    id: "no-phone",
    kind: "번호",
    pattern: /0\d{1,2}[-–—.\s]?\d{3,4}[-–—.\s]?\d{4}/g,
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
  // 조사 "-(으)로" 뒤에 숫자가 오는 말("바로 119", "지표로 60초")이 도로명으로 잡히면
  // 보고문에서 「[주소]에 신고했습니다」가 된다. 도로명이 아닌 꼴을 아래에서 걸러 낸다.
  {
    id: "addr-street",
    kind: "주소",
    pattern: /[가-힣0-9○〇xX]{1,10}(?:로|길)\s*\d{1,4}(?:-\d{1,4})?(?:번지|번길)?/g,
    priority: 6,
    accept: (matched, text, start, end) => {
      if (isHangulAt(text, start - 1)) return false;
      const digits = /\d+/.exec(matched);
      const head = matched.slice(0, digits?.index ?? matched.length).trim();
      if (head.endsWith("으로")) return false;
      if (EMERGENCY_NUMBERS.has(digits?.[0] ?? "")) return false;
      // 숫자 뒤에 단위가 붙으면 번지가 아니라 수량이다("60초", "6단계")
      return !UNIT_AFTER_NUMBER.some((unit) => text.startsWith(unit, end));
    },
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
  // 주소 — 번지 없이 동 이름만 말한 경우("역삼동에 사십니다")
  // 법정동 이름은 대개 두 글자 이상이라 앞을 {2,4}로 묶어 "이동"·"행동"류를 애초에 비켜 간다.
  {
    id: "addr-dong-name",
    kind: "주소",
    pattern: /[가-힣]{2,4}동(?=$|[^가-힣]|[은는이가을를에의로와과도])/g,
    priority: 6,
    accept: (matched, text, start) => {
      if (isHangulAt(text, start - 1)) return false;
      return !DONG_STOPWORD_TAILS.some((tail) => matched.endsWith(tail));
    },
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
      // "씨"/"여사" 뒤에 다른 글자가 이어지면 오탐 후보("박 씨앗")지만,
      // 조사("김 씨가/는/를")까지 거르면 정상 지칭이 통째로 새므로 조사만 통과시킨다.
      if (
        (matched.endsWith("씨") || matched.endsWith("여사")) &&
        isHangulAt(text, end) &&
        !TITLE_JOSA.has(text[end] ?? "")
      )
        return false;
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
    accept: (matched, text, start, end) => {
      if (isHangulAt(text, start - 1)) return false;
      if (isCommonWord(matched)) return false;
      // "도와드릴께요"처럼 '-ㄹ게요'를 '께요'로 적은 말은 사람을 부르는 "께"가 아니다.
      if (/^\s?께요/.test(text.slice(end, end + 4))) return false;
      return true;
    },
  },
  // 성씨 + 이름 두 자 + 일반 조사 ("김영수는", "박말순이") — 호칭 없이 이름만 부른 문장
  {
    id: "name-josa",
    kind: "성명",
    pattern: new RegExp(`([${SURNAMES}][가-힣]{2})(?:${NAME_JOSA})(?![가-힣])`, "g"),
    group: 1,
    priority: 10,
    accept: (matched, text, start) => {
      if (isHangulAt(text, start - 1)) return false;
      if (isCommonWord(matched)) return false;
      return [...matched.slice(1)].every((syllable) => GIVEN_NAME_SYLLABLES.has(syllable));
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
