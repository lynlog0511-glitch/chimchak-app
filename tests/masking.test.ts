/**
 * 가명처리 엔진 회귀 검사 — src/engine/masking.ts
 *
 * 왜 이 파일이 필요한가: 성명 판정이 성씨 문자열(SURNAMES)과 예외어 집합(NAME_STOPWORDS)이라는
 * **사전 두 벌**에 걸려 있다. 예외어를 하나 지워도 화면은 조용히 잘 돌고, 사고는 발표장에서 난다.
 * 규칙 11종을 하나씩 못 박고, 예외어가 막고 있는 오탐을 같은 수로 붙여 둔다.
 */

import { describe, expect, it } from "vitest";
import {
  MASK_KIND_LABELS,
  MASK_KIND_REASONS,
  MASK_TOKENS,
  countByKind,
  hasSensitive,
  maskSpansOnOriginal,
  maskText,
  splitMasked,
} from "@/engine/masking";

/** 규칙 11종 — [설명, 원문, 기대 결과, 기대 종류] */
const RULE_CASES: [string, string, string, string][] = [
  ["주민등록번호", "480101-1234567 입니다", "[번호] 입니다", "번호"],
  ["생년", "1948년생이십니다", "[생년]이십니다", "생년"],
  ["생년월일", "1948년 3월 2일생", "[생년]", "생년"],
  ["전화번호", "010-1234-5678로 연락 주세요", "[번호]로 연락 주세요", "번호"],
  ["6자리 이상 숫자", "코드 987654 확인했습니다", "코드 [번호] 확인했습니다", "번호"],
  ["주소(시·구·로)", "서울시 강남구 행복로 12에 사십니다", "[주소]에 사십니다", "주소"],
  ["주소(로·길)", "행복로 12 앞에서 뵈었습니다", "[주소] 앞에서 뵈었습니다", "주소"],
  ["주소(동·번지)", "행복동 123번지 근처입니다", "[주소] 근처입니다", "주소"],
  ["주소(공동주택)", "101동 202호에 계십니다", "[주소]에 계십니다", "주소"],
  ["기관명", "행복요양원에서 지냅니다", "[기관]에서 지냅니다", "기관명"],
  ["성 + 호칭", "박 어르신께 전해 드렸습니다", "[대상자]께 전해 드렸습니다", "성명"],
  ["성 + 이름 + 표지", "김영수 님이 오셨습니다", "[대상자] 님이 오셨습니다", "성명"],
];

describe("가명처리 규칙 11종", () => {
  for (const [label, input, expected, kind] of RULE_CASES) {
    it(label, () => {
      const result = maskText(input);
      expect(result.masked).toBe(expected);
      expect(result.spans.map((s) => s.kind)).toContain(kind);
    });
  }

  it("한 문장에 여러 종류가 섞여도 전부 가린다", () => {
    const result = maskText("행복요양원 김영수 님이 서울시 강남구 행복로 12에 사십니다");
    expect(result.masked).toBe("[기관] [대상자] 님이 [주소]에 사십니다");
    expect(result.spans.map((s) => s.kind)).toEqual(["기관명", "성명", "주소"]);
  });

  it("겹치는 후보는 우선순위 높은 규칙이 이긴다 (주민번호가 6자리 숫자 규칙을 이긴다)", () => {
    const spans = maskSpansOnOriginal("480101-1234567");
    expect(spans).toHaveLength(1);
    expect(spans[0]?.kind).toBe("번호");
    expect(spans[0]?.end).toBe(14);
  });
});

describe("예외어(STOPWORDS)가 막는 오탐", () => {
  const CLEAN: [string, string][] = [
    ["친족 호칭", "이모님, 안녕하세요"],
    ["직위 호칭", "주임님과 상의했습니다"],
    ["일반 명사 + 표지", "오늘 어르신께서 말씀하셨어요"],
    ["기관 접두 불특정어", "우리 센터에서 진행했습니다"],
    ["기관 접두 불특정어2", "근처 병원으로 모셨습니다"],
    ["식별 요소 없음", "오늘 기분이 좋으셨습니다"],
  ];

  for (const [label, input] of CLEAN) {
    it(`${label} — 가리지 않는다`, () => {
      expect(maskText(input).masked).toBe(input);
      expect(hasSensitive(input)).toBe(false);
    });
  }

  it("'씨'로 끝나는 성 호칭은 뒤에 글자가 이어지면 사람으로 보지 않는다", () => {
    expect(maskText("박 씨앗을 심었습니다").masked).toBe("박 씨앗을 심었습니다");
    expect(maskText("김 씨 오셨습니다").masked).toBe("[대상자] 오셨습니다");
    expect(maskText("김영수씨가 오셨습니다").masked).toBe("[대상자]씨가 오셨습니다");
  });

  it("앞 글자가 한글이면 성씨로 보지 않는다 (단어 중간 오탐 방지)", () => {
    expect(maskText("영양사 김영수 님").masked).toBe("영양사 [대상자] 님");
    expect(maskText("담당자님께 전달했습니다").masked).toBe("담당자님께 전달했습니다");
  });
});

describe("좌표 규약", () => {
  it("maskText의 spans는 결과 문자열 기준이다", () => {
    const result = maskText("박 어르신께");
    expect(result.masked).toBe("[대상자]께");
    expect(result.spans[0]).toEqual({ start: 0, end: 5, kind: "성명", replaced: "[대상자]" });
  });

  it("maskSpansOnOriginal은 원문 기준이다", () => {
    expect(maskSpansOnOriginal("박 어르신께")).toEqual([
      { start: 0, end: 5, kind: "성명", replaced: "[대상자]" },
    ]);
  });

  it("빈 입력은 빈 결과다", () => {
    expect(maskText("")).toEqual({ masked: "", spans: [] });
    expect(maskSpansOnOriginal("")).toEqual([]);
  });
});

describe("화면 보조 함수", () => {
  it("countByKind는 종류별로 센다", () => {
    expect(countByKind(maskText("박 어르신 010-1234-5678").spans)).toEqual({ 성명: 1, 번호: 1 });
    expect(countByKind([])).toEqual({});
  });

  it("splitMasked는 하이라이트 조각으로 쪼갠다", () => {
    expect(splitMasked(maskText("박 어르신께"))).toEqual([
      { text: "[대상자]", masked: true, kind: "성명" },
      { text: "께", masked: false },
    ]);
  });

  it("모든 종류에 라벨·사유·토큰이 빠짐없이 있다 (/report 범례 계약)", () => {
    for (const kind of Object.keys(MASK_TOKENS) as (keyof typeof MASK_TOKENS)[]) {
      expect(MASK_KIND_LABELS[kind]).toBeTruthy();
      expect(MASK_KIND_REASONS[kind]).toBeTruthy();
      expect(MASK_TOKENS[kind]).toMatch(/^\[.+\]$/);
    }
  });
});

describe("두 번 통과시켜도 결과가 흔들리지 않는다", () => {
  it("가명처리 결과를 다시 가려도 그대로다 (저장 직전 2차 검사의 전제)", () => {
    const once = maskText("행복요양원 김영수 님이 010-1234-5678로 전화하셨습니다").masked;
    expect(maskText(once).masked).toBe(once);
  });
});

describe("2026-08-06 리드 수정 회귀 — 조사 미탐·존칭 과탐", () => {
  it("성+씨/여사 뒤에 조사가 붙어도 가린다 (미탐이던 케이스)", () => {
    expect(maskText("김 씨가 오셨습니다").masked).toBe("[대상자]가 오셨습니다");
    expect(maskText("김 씨는 오셨습니다").masked).toBe("[대상자]는 오셨습니다");
    expect(maskText("김 씨를 만났습니다").masked).toBe("[대상자]를 만났습니다");
    expect(maskText("박 여사가 오셨습니다").masked).toBe("[대상자]가 오셨습니다");
  });

  it("조사가 아닌 글자가 이어지면 낱말로 보고 남긴다 (기존 오탐 방지 유지)", () => {
    expect(maskText("박 씨앗을 심었습니다").masked).toBe("박 씨앗을 심었습니다");
  });

  it("직함+님은 표지가 더 붙어도 성명으로 오인하지 않는다 (과탐이던 케이스)", () => {
    expect(maskText("원장님께 보고드렸습니다").masked).toBe("원장님께 보고드렸습니다");
    expect(maskText("이용자님께 안내했습니다").masked).toBe("이용자님께 안내했습니다");
    expect(maskText("이모님께 말씀드렸습니다").masked).toBe("이모님께 말씀드렸습니다");
  });

  it("진짜 성명+님은 여전히 가린다 (과탐 수정의 반대 방향 회귀 방지)", () => {
    expect(maskText("김영수 님께 안내했습니다").masked).toBe("[대상자] 님께 안내했습니다");
  });
});

/**
 * 2026-08 사전 점검에서 **실제로 새어 나간 열 문장**이다. 성씨 사전이 얇았고(유·지·진·엄·
 * 천·표·방·현이 없었다), 호칭 없이 이름만 부른 문장·축약 생년·줄표 전화번호·동 단위 주소·
 * 기관 어미가 전부 통과했다. 하나같이 화면은 조용히 잘 돌았다 — 그래서 회귀 검사로 못 박는다.
 */
describe("2026-08 우회 실측 10건 — 전부 가려야 한다", () => {
  const LEAKED: [string, string, string][] = [
    ["호칭 없는 이름 + 조사(는)", "김영수는 저녁 식사를 거부하셨습니다", "성명"],
    ["호칭 없는 이름 + 조사(이)", "박말순이 넘어지셨습니다", "성명"],
    ["빠진 성씨 — 유", "유 어르신께서 부르셨습니다", "성명"],
    ["빠진 성씨 — 천", "천말숙 님이 오셨습니다", "성명"],
    ["빠진 성씨 — 엄", "엄 씨가 오셨습니다", "성명"],
    ["축약 생년", "43년생이십니다", "생년"],
    ["줄표 전화번호", "010–1234–5678로 연락드렸습니다", "번호"],
    ["번지 없는 동 이름", "역삼동에 사십니다", "주소"],
    ["기관 어미 — 실버타운", "행복실버타운에서 지내십니다", "기관명"],
    ["빠진 성씨 — 지·진·표·방·현", "지 어르신, 진 어르신, 표 어르신, 방 어르신, 현 어르신", "성명"],
  ];

  for (const [label, input, kind] of LEAKED) {
    it(label, () => {
      const result = maskText(input);
      expect(result.spans.length, `${input} 이 그대로 남았습니다`).toBeGreaterThan(0);
      expect(result.spans.map((s) => s.kind)).toContain(kind);
    });
  }

  it("한 문장에 성명·생년·번호가 섞여도 전부 가린다", () => {
    const result = maskText("천말숙 님(43년생)께 010–1234–5678로 연락드렸습니다");
    expect(result.masked).toBe("[대상자] 님([생년])께 [번호]로 연락드렸습니다");
  });
});

/**
 * 사전을 넓히면 반드시 반대편이 무너진다. 성씨 60성 + 조사 규칙을 얹은 뒤
 * **가리면 안 되는 말**을 같은 수로 못 박는다 — 보고문이 [대상자]로 뒤덮이면
 * 학습자는 가명처리를 신뢰하지 않고 꺼 버린다.
 */
describe("사전을 넓힌 뒤에도 가리지 않아야 하는 말", () => {
  const CLEAN = [
    "이상 행동은 없었습니다",
    "야간 활동을 관찰했습니다",
    "우리 동네에서 뵈었습니다",
    "선생님께 말씀드렸습니다",
    "함께 어르신을 모셨습니다",
    "오전에는 조용하셨습니다",
    "구급대가 도착했습니다",
    "마지막으로 확인했습니다",
    "현관문을 열어 두었습니다",
    "손잡이를 잡고 계셨습니다",
    "주무시는 동안 지켜보았습니다",
    "지팡이를 챙겨 드렸습니다",
    "나머지는 내일 하겠습니다",
    "바로 119에 신고했습니다",
    "관찰 지표로 60초 안에 확인했습니다",
  ];

  for (const input of CLEAN) {
    it(`${input} — 그대로 둔다`, () => {
      expect(maskText(input).masked).toBe(input);
    });
  }
});
