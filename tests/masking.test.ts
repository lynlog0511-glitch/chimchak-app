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
  hasPartialMask,
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

/**
 * 2026-08-25 페르소나 검증에서 **규칙이 아예 없던 범주** 세 가지다.
 *
 * 이메일과 링크는 휴리스틱의 회색지대가 아니라 정규식 한 줄로 끝나는 확정적 범주였는데도
 * 규칙이 없어 통째로 나갔다. 생년월일은 더 뼈아프다 — 화면이 「생년」이라고 이름 붙여 가리겠다고
 * 적어 둔 범주인데, `생|출생`을 요구하는 옛 규칙이 **가장 흔한 표기**를 놓치고 있었다.
 * 자유 연습은 학습자 발화가 기기 밖으로 나가는 유일한 경로이고 이 파일이 그 마지막 체다.
 */
describe("2026-08-25 페르소나 검증 — 규칙이 없던 범주", () => {
  const LEAKED: [string, string, string, string][] = [
    [
      "이메일",
      "kimyoungsu@naver.com으로 보내 주세요",
      "[번호]으로 보내 주세요",
      "번호",
    ],
    [
      "오픈채팅 링크",
      "https://open.kakao.com/o/abc123으로 들어오세요",
      "[번호]으로 들어오세요",
      "번호",
    ],
    ["www 주소", "www.example.com 확인 부탁드립니다", "[번호] 확인 부탁드립니다", "번호"],
    [
      "경로가 붙은 도메인",
      "naver.com/abc 에 올려 두었습니다",
      "[번호] 에 올려 두었습니다",
      "번호",
    ],
    [
      "생년월일 — 「생」 없이",
      "생일이 1948년 3월 2일이십니다",
      "생일이 [생년]이십니다",
      "생년",
    ],
    ["생년월일 — 문장 앞", "1948년 3월 2일에 태어나셨습니다", "[생년]에 태어나셨습니다", "생년"],
  ];

  for (const [label, input, expected, kind] of LEAKED) {
    it(label, () => {
      const result = maskText(input);
      expect(result.masked).toBe(expected);
      expect(result.spans.map((s) => s.kind)).toContain(kind);
    });
  }

  it("링크가 문장 끝의 마침표를 삼키지 않는다", () => {
    expect(maskText("주소는 www.example.com.").masked).toBe("주소는 [번호].");
  });

  it("새 규칙이 멀쩡한 말을 가리지 않는다", () => {
    const CLEAN = [
      "2년 뒤에 다시 뵙기로 했습니다",
      "3년 5월치 기록을 정리했습니다",
      "오늘 오후 3시 10분에 오셨습니다",
      "체온은 36.5도였습니다",
      "1948년생 어르신들 이야기입니다",
    ];
    for (const input of CLEAN) {
      const result = maskText(input);
      // 마지막 문장은 옛 「생년」 규칙이 잡아야 정상이므로 링크·이메일 규칙만 본다.
      expect(result.spans.every((span) => span.kind !== "번호"), input).toBe(true);
    }
  });
});

/* ── 맨이름 경계 (종결·구두점) ─────────────────────────── */

describe("호칭도 조사도 없는 맨이름", () => {
  /**
   * 조사 규칙은 조사를, 호칭 규칙은 호칭을 요구했다. 그래서 실무 표기의 상당수 — 문장 끝·
   * 쉼표·콜론·괄호 앞, 그리고 「~입니다」 앞 — 가 통째로 새고 있었다. 이 경로(/practice
   * 자유 연습)에는 사람이 검토하는 단계가 없어 자동 체가 마지막이다.
   */
  const LEAKED: [string, string, string][] = [
    ["「~입니다」 앞", "성함은 김영수입니다", "성함은 [대상자]입니다"],
    ["「~이십니다」 앞", "보호자는 이순자이십니다", "보호자는 [대상자]이십니다"],
    ["콜론 뒤 문장 끝", "대상자: 김영수", "대상자: [대상자]"],
    ["마침표 앞", "김영수. 오늘 아침에 넘어지셨습니다", "[대상자]. 오늘 아침에 넘어지셨습니다"],
    ["여는 괄호 앞", "김영수 (85세)", "[대상자] (85세)"],
    ["슬래시 목록", "보고 대상 김영수 / 이순자", "보고 대상 [대상자] / [대상자]"],
    ["「~이라고」 앞", "김영수이라고 하십니다", "[대상자]이라고 하십니다"],
  ];

  for (const [label, input, expected] of LEAKED) {
    it(label, () => {
      const result = maskText(input);
      expect(result.masked).toBe(expected);
      expect(result.spans.every((span) => span.kind === "성명")).toBe(true);
    });
  }

  it("쉼표로 늘어놓은 이름은 **뒤엣것까지** 가린다", () => {
    /* 경계를 전방탐색으로 둔 이유가 이 줄이다 — 쉼표를 삼키지 않으므로 다음 탐색이 쉼표 바로
       뒤에서 다시 시작한다. 예전에는 조사를 삼켜 뒤 이름이 밀려났다("[대상자]와 이순자"). */
    expect(maskText("김영수, 이순자").masked).toBe("[대상자], [대상자]");
    expect(maskText("어르신 성함은 김영수, 보호자는 이순자입니다").masked).toBe(
      "어르신 성함은 [대상자], 보호자는 [대상자]입니다",
    );
    expect(maskText("김영수와 이순자").masked).toBe("[대상자]와 [대상자]");
  });

  it("호칭·조사가 붙은 옛 경로는 그대로다", () => {
    expect(maskText("김영수 님이 오셨습니다").masked).toBe("[대상자] 님이 오셨습니다");
    expect(maskText("김영수는 저녁을 거부하셨습니다").masked).toBe("[대상자]는 저녁을 거부하셨습니다");
  });

  it("공백 하나만으로는 이름 경계로 치지 않는다", () => {
    /* 여기를 넓게 잡으면 한국어 산문이 통째로 걸린다. 실측으로 확인한 문장들이다 —
       공백을 경계에 넣었을 때 아래 다섯이 전부 이름으로 읽혔다. */
    const CLEAN = [
      "마무리 및 피드백을 했습니다",
      "배우자 분이 오셨습니다",
      "넘어지셨는데 정신은 있으실 때",
      "휠체어 이동은 예외로 봅니다",
      "조용한 데서 말씀드렸습니다",
    ];
    for (const input of CLEAN) {
      expect(maskText(input).masked, input).toBe(input);
    }
  });

  it("이름 음절이 아닌 글자가 섞이면 발동하지 않는다", () => {
    // 조사 규칙과 **같은 사전**을 본다 — 두 규칙이 갈라지지 않게 검사도 같은 자리에 둔다.
    expect(maskText("최선을 다했습니다.").masked).toBe("최선을 다했습니다.");
    expect(maskText("서서히 좋아지셨습니다.").masked).toBe("서서히 좋아지셨습니다.");
  });

  it("앞 글자가 한글이면 맨이름으로 보지 않는다", () => {
    expect(maskText("담당자김영수").masked).toBe("담당자김영수");
  });
});

/* ── 부분 가림 감지 ────────────────────────────────────── */

describe("hasPartialMask", () => {
  it("토큰에 숫자·붙임표 조각이 맞붙어 남으면 참이다", () => {
    // 「N곳 가렸습니다」가 완전 처리 신호로 읽히는 자리 — 남은 조각을 화면이 밝힐 수 있게 한다.
    expect(hasPartialMask(maskText("어르신 계좌 110-123-456789 국민은행"))).toBe(true);
    expect(hasPartialMask(maskText("인정번호 L0123456789"))).toBe(true);
  });

  it("토큰 뒤에 번지 꼴이 남아도 참이다", () => {
    const result = maskText("어르신 댁은 역삼동 12-3 입니다");
    expect(result.masked).toContain("12-3");
    expect(hasPartialMask(result)).toBe(true);
  });

  it("깨끗하게 가려진 문장은 거짓이다", () => {
    expect(hasPartialMask(maskText("박 어르신께 전해 드렸습니다"))).toBe(false);
    expect(hasPartialMask(maskText("010-1234-5678로 연락 주세요"))).toBe(false);
    expect(hasPartialMask(maskText("행복요양원에서 지냅니다"))).toBe(false);
  });

  it("가릴 것이 없으면 거짓이다", () => {
    expect(hasPartialMask(maskText("오늘 기분이 좋으셨습니다"))).toBe(false);
    expect(hasPartialMask(maskText(""))).toBe(false);
  });
});
