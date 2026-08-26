/**
 * 가명처리 엔진 회귀 검사 — src/engine/masking.ts
 *
 * 왜 이 파일이 필요한가: 성명 판정이 성씨 문자열(SURNAMES)과 예외어 집합(NAME_STOPWORDS)이라는
 * **사전 두 벌**에 걸려 있다. 예외어를 하나 지워도 화면은 조용히 잘 돌고, 사고는 발표장에서 난다.
 * 종류마다 대표 케이스를 하나씩 못 박고(아래 표 12줄 — 규칙 자체는 20개다), 예외어가
 * 막고 있는 오탐을 같은 수로 붙여 둔다.
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
import { SCENARIOS } from "@/data/scenarios";

/** 종류별 대표 케이스 12줄 — [설명, 원문, 기대 결과, 기대 종류] */
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

describe("가명처리 규칙 — 종류별 대표 케이스", () => {
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

/* ── 친족·직함 호칭 (name-title) ───────────────────────── */

describe("이름 + 친족·직함 호칭", () => {
  /*
   * 현장 발화에서 가장 흔한 꼴 가운데 하나인데, 호칭 규칙이 님·씨·어르신만 보던 자리다.
   * 「김영수 아드님이 오셨어요」·「정미숙 간호사에게 알렸습니다」가 통째로 새고 있었다.
   */
  const 가림 = [
    "김영수 아드님이 오셨어요",
    "김영수 따님께 전화드렸습니다",
    "정미숙 간호사에게 알렸습니다",
    "김영수 팀장께 보고했습니다",
    "이순자 어머님이 오셨습니다",
    "박말순 며느님이 모시고 왔습니다",
  ];

  for (const line of 가림) {
    it(`가린다: ${line}`, () => {
      expect(maskText(line).masked).toContain("[대상자]");
      expect(maskText(line).masked).not.toContain("김영수");
    });
  }

  /*
   * **이 목록을 NAME_MARKERS에 얹지 않은 이유**를 여기에 못 박는다. 그 규칙은 성 + 1~3자를
   * 받으므로 「주간보호 간호사」가 「[대상자] 간호사」가 된다. 폭을 두 글자로 좁히고 검사를
   * 조사·맨이름 규칙과 공유하면(acceptBareName) 아래가 전부 살아 남는다.
   */
  const 남김 = [
    "우리 아드님이 오늘 오셨어요",
    "저희 어머님은 요양원에 계세요",
    "방문 간호사에게 여쭤보세요",
    "주간보호 간호사와 상의했습니다",
    "담당 요양보호사 선생님께 전달했습니다",
    "사회복지사 상담을 받으세요",
    "사위 되시는 분이 오셨어요",
  ];

  for (const line of 남김) {
    it(`남긴다: ${line}`, () => {
      expect(maskText(line).masked).toBe(line);
    });
  }

  /*
   * ── 표지가 선 규칙에서 **음절 사전을 떼었다**는 사실을 여기서 못 박는다 ──
   *
   * 사전(GIVEN_NAME_SYLLABLES)은 이 앱이 마주하는 어르신 세대로 일부러 기울여 두었는데, 이 규칙이
   * 겨냥한 인구는 직원·보호자라 대개 다른 세대다. 두 규칙에 그 사전을 함께 걸었을 때 현대식 이름
   * 12종 × 문틀 7종 = **84문장이 전부 원문 그대로** 나갔다(페르소나 BE 실측 재현).
   * 아래 표본이 「김영수·이순자·박말순·정미숙」뿐이라 그 구멍이 검사에 잡히지 않던 자리다.
   */
  const 현대식_이름 = ["김민호", "이지훈", "박서연", "최하은", "정예진", "한지우", "배시우"];

  for (const name of 현대식_이름) {
    it(`요즘 이름도 가린다: ${name} 간호사`, () => {
      const line = `${name} 간호사에게 알렸습니다`;
      expect(maskText(line).masked).toBe("[대상자] 간호사에게 알렸습니다");
    });
  }

  it("조사로 끝나는 앞 성분은 호칭 앞에 서도 이름이 아니다", () => {
    /*
     * 사전을 뗀 값으로 치른 자리다 — 「용량 조절은 간호사님께」의 「조절은」이 이름으로 읽혔다.
     * 이름은 조사를 달고 호칭 앞에 서지 않으므로, 그 꼴일 때만 넓힌 사전을 한 번 본다.
     */
    for (const line of [
      "용량 조절은 간호사님께 여쭤보겠습니다",
      "억제대 사용 여부는 간호사님께 여쭤보겠습니다",
      "보고 구간의 회고 진술은 요양보호사의 행위가 아닙니다",
    ]) {
      expect(maskText(line).masked, line).toBe(line);
    }
  });
});

/* ── 앞에 표지가 선 맨이름 (name-lead) ─────────────────── */

describe("표지 + 맨이름", () => {
  it("앞에 성함·이름·환자명·대상자가 서면 뒤 세 글자를 가린다", () => {
    expect(maskText("환자명 김영수 확인했습니다").masked).toBe("환자명 [대상자] 확인했습니다");
    expect(maskText("보호자분 성함이 김영수 맞으시죠").masked).toContain("[대상자] 맞으시죠");
    expect(maskText("대상자: 김영수 확인 완료").masked).toBe("대상자: [대상자] 확인 완료");
    expect(maskText("이름은 이순자 라고 하십니다").masked).toContain("[대상자]");
  });

  it("강한 표지 뒤에서는 요즘 이름도 가린다 (음절 사전을 걸지 않는다)", () => {
    expect(maskText("환자명 이지훈 확인했습니다").masked).toBe("환자명 [대상자] 확인했습니다");
    expect(maskText("보호자분 성함이 최하은 맞으시죠").masked).toContain("[대상자] 맞으시죠");
    expect(maskText("수급자 박서연 상태를 살폈습니다").masked).toBe(
      "수급자 [대상자] 상태를 살폈습니다",
    );
  });

  it("약한 표지(「이름」) 뒤에서는 사전을 그대로 건다 — 「모델 이름을 고르는 일」을 지킨다", () => {
    /*
     * 「성함」·「환자명」·「수급자」는 사람에게만 쓰지만 「이름」은 사물에도 쓴다. 이 저장소의 화면
     * 문장만 해도 「모델 이름」·「작업 이름」·「금지 행위의 이름이 나오는 것」이 있어, 이 표지에서
     * 사전을 떼면 그 문장들이 통째로 가려진다(실측 5건). 치르는 값은 아래 마지막 줄이다.
     */
    for (const line of [
      "이름 정하기 어렵습니다",
      "이름이 하나만 말하는 순간 나머지는 허락한 적 없는 일이 됩니다",
      "상류 주소와 모델 이름을 고르는 일은 서버가 합니다",
    ]) {
      expect(maskText(line).masked, line).toBe(line);
    }
    // 어르신 세대 이름은 이 표지에서도 그대로 가려진다.
    expect(maskText("이름은 이순자입니다").masked).toContain("[대상자]");
  });

  it("표지 뒤에 이름이 아니면 발동하지 않는다 (검사는 맨이름 규칙과 같다)", () => {
    for (const line of [
      "성함을 여쭤봤습니다",
      "이름을 여쭤보세요",
      "성함이 어떻게 되세요",
      "이름 정하기 어렵습니다",
      "대상자 목록을 확인했습니다",
      "보호자 동의서를 받았습니다",
      "수급자 본인부담금 안내입니다",
      "환자명 확인 후 진행합니다",
    ]) {
      expect(maskText(line).masked, line).toBe(line);
    }
  });
});

/* ── 같은 입력 안 재등장 ───────────────────────────────── */

describe("확정된 성명의 재등장", () => {
  it("한 번 가린 이름은 같은 입력의 나머지 자리에서도 가린다", () => {
    /*
     * 같은 문장 안에서 한 번은 가리고 한 번은 노출하는 것은 아예 못 가린 것과 위험이 같은데,
     * 화면은 「가렸습니다」라고 말한다. 사람 검토가 없는 /practice에서는 이 체가 마지막이다.
     */
    expect(maskText("김영수 님께 말씀드렸고 김영수 상태는 안정적입니다").masked).toBe(
      "[대상자] 님께 말씀드렸고 [대상자] 상태는 안정적입니다",
    );
    expect(maskText("이순자 어머님이 오늘 이순자 식사를 거부하셨습니다").masked).toBe(
      "[대상자] 어머님이 오늘 [대상자] 식사를 거부하셨습니다",
    );
  });

  it("**씨앗은 표지가 선 규칙이 확정한 것뿐**이다 — 사전만 보는 규칙의 오탐이 번지지 않는다", () => {
    /*
     * 예전에는 모든 성명 후보를 씨앗으로 받았다. 그래서 표지 없이 사전으로만 판단하는 규칙
     * (name-josa·name-bare)의 오탐이 입력 안 모든 자리로 번졌다 — 아래 두 문장은 가려지는 자리가
     * 1건에서 2건으로 늘던 실측 사례다(페르소나 BE, old/new 동시 실행).
     * 씨앗을 좁힌 지금은 조사가 붙은 자리 하나만 남는다(그 자리는 원래 규칙이 잡는다).
     */
    expect(maskText("서명란에 서명을 받았습니다. 서명란은 비어 있었습니다.").masked).toBe(
      "서명란에 서명을 받았습니다. [대상자]은 비어 있었습니다.",
    );
    expect(maskText("권유형 대응을 했습니다. 권유형이 맞습니다.").masked).toBe(
      "권유형 대응을 했습니다. [대상자]이 맞습니다.",
    );
  });

  it("표지가 선 규칙이 씨앗이면 요즘 이름도 함께 번진다", () => {
    expect(maskText("김민호 간호사에게 알렸고 김민호 선생과 다시 확인했습니다").masked).toBe(
      "[대상자] 간호사에게 알렸고 [대상자] 선생과 다시 확인했습니다",
    );
  });

  it("새 후보를 만들지 않는다 — 확정된 문자열 그 자체만 다시 찾는다", () => {
    // 사전도 정규식도 넓히지 않으므로, 처음부터 안 걸리던 문장은 그대로 남는다.
    expect(maskText("김영수 상태 확인하고 왔습니다").masked).toBe("김영수 상태 확인하고 왔습니다");
    expect(maskText("오늘 기분이 좋으셨습니다").masked).toBe("오늘 기분이 좋으셨습니다");
  });

  it("다른 낱말 한가운데는 물지 않는다", () => {
    // 앞 글자가 한글이면 제외 — 원래 규칙들과 같은 앞 경계 검사다.
    expect(maskText("김영수 님과 담당자김영수").masked).toBe("[대상자] 님과 담당자김영수");
  });

  it("원래 규칙이 잡은 더 긴 자리가 이긴다", () => {
    // 2차 패스는 모든 규칙보다 뒤 우선순위라, 겹치면 언제나 원래 자리가 남는다.
    const result = maskText("김영 님과 김영수 씨");
    expect(result.masked).toBe("[대상자] 님과 [대상자] 씨");
    expect(result.spans).toHaveLength(2);
  });

  it("하이라이트 좌표도 같은 계산을 본다", () => {
    // maskText와 maskSpansOnOriginal이 2차 패스를 함께 쓰지 않으면 화면과 결과가 갈라진다.
    const text = "김영수 님께 말씀드렸고 김영수 상태는 안정적입니다";
    expect(maskSpansOnOriginal(text)).toHaveLength(2);
    expect(maskSpansOnOriginal(text).length).toBe(maskText(text).spans.length);
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

/* ── 직함 호칭과 판정 규칙 ─────────────────────────────── */

describe("직함 호칭은 성명이 아니다", () => {
  /*
   * 「소장님께 보고드렸습니다」가 「[대상자]께 보고드렸습니다」가 되고 있었다 — 「소」가 성씨
   * 사전에 있어 호칭 규칙이 "소장" + "님"으로 갈랐는데, 예외어에는 「원장」·「이장」·「차장」만
   * 있었기 때문이다. 하필 같은 커밋이 이 호칭들을 **정답 발화**로 판정 규칙에 넣었다.
   * 훈련이 시키는 모범 발화가 가림 화면에서 「성명 1건」으로 세어지던 자리다.
   */
  const 호칭_발화 = [
    "소장님께 보고드렸습니다",
    "소장께 먼저 알렸습니다",
    "소장에게 보고했습니다",
    "소장한테 말씀드렸습니다",
    "센터장님께 먼저 알렸습니다",
    "시설장님을 통해 알리겠습니다",
    "원장님께 보고드렸습니다",
    "팀장님께 보고드렸습니다",
  ];

  for (const line of 호칭_발화) {
    it(`남긴다: ${line}`, () => {
      expect(maskText(line).masked).toBe(line);
    });
  }

  it("판정 규칙의 직함 호칭 패턴은 하나도 성명으로 가려지지 않는다", () => {
    /*
     * 두 사전(마스킹의 NAME_STOPWORDS와 시나리오의 판정 패턴)이 갈라지는 자리를 사람 기억 대신
     * 여기서 지킨다. 새 호칭을 판정 규칙에 넣고 예외어에 안 넣으면 이 줄이 먼저 말해 준다.
     */
    const patterns: string[] = [];
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) {
        for (const item of node) walk(item);
        return;
      }
      if (typeof node !== "object" || node === null) return;
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        if (key === "patterns" && Array.isArray(value)) {
          for (const p of value) if (typeof p === "string") patterns.push(p);
        } else walk(value);
      }
    };
    walk(SCENARIOS);

    const 직함 = /소장|센터장|시설장|원장|팀장|과장|실장|주임|관리책임자|간호사|사회복지사/;
    const 대상 = [...new Set(patterns)].filter((p) => 직함.test(p));
    expect(대상.length).toBeGreaterThan(10);
    for (const pattern of 대상) {
      const spans = maskSpansOnOriginal(pattern).filter((s) => s.kind === "성명");
      expect(spans, pattern).toHaveLength(0);
    }
  });
});
