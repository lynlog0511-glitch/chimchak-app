/**
 * 규칙 엔진 회귀 검사 — src/engine/rules.ts
 *
 * 왜 이 파일이 필요한가: ⚑CF 판정의 오탐 방지 장치가 전부 **창(窓) 폭 상수**에 걸려 있다.
 * NEGATION_WINDOW(10) · NEGATION_BEFORE(앞 4글자) · EXCEPT_WINDOW(6) ·
 * 존경 선어말어미 문자군("시신실셨셔세")을 한 글자라도 손대면 "밀지 않겠습니다"가 ⚑CF로 뒤집힌다.
 * 상수는 모듈 밖으로 나오지 않으므로, 경계 바로 안/바로 밖 문장 쌍으로 폭을 고정한다.
 */

import { describe, expect, it } from "vitest";
import {
  advisoryHits,
  checkAdvisory,
  checkCritical,
  containsPii,
  findTerm,
  getRule,
  indexOfPattern,
  isNegated,
  normalize,
} from "@/engine/rules";
import { RULE_DEMO_EXAMPLES } from "@/app/train/_components/ruleDemoExamples";
import type { ScenarioType } from "@/types";

const ALL_TYPES: ScenarioType[] = ["BPSD", "EMERGENCY", "CONFLICT", "RISK"];

describe("normalize", () => {
  it("공백·구두점을 지우고 소문자화한다", () => {
    expect(normalize("문을  잠그겠습니다.")).toBe("문을잠그겠습니다");
    expect(normalize("119! 지금, 신고…")).toBe("119지금신고");
    expect(normalize("OK 알겠습니다")).toBe("ok알겠습니다");
  });

  it("정규화해도 사라지지 않는 글자는 그대로 센다 (패턴 길이 검사의 전제)", () => {
    expect(normalize("음…").length).toBe(1);
  });
});

describe("indexOfPattern — 존경 선어말어미 확장", () => {
  it("'-시'로 끝나는 패턴은 신/실/셨/셔/세 활용형까지 받는다", () => {
    expect(indexOfPattern("집에가고싶으신가봐요", "싶으시")).toBe(4);
    expect(indexOfPattern("많이급하셨겠어요", "급하시")).toBe(2);
    expect(indexOfPattern("물마셔보시겠어요", "물마시")).toBe(0);
    expect(indexOfPattern("얼마나답답하실까요", "답답하시")).toBe(3);
  });

  it("문자군 밖의 꼬리는 받지 않는다", () => {
    // "소" 는 [시신실셨셔세] 밖 — 여기까지 넓히면 사전이 엉뚱한 말을 잡기 시작한다.
    expect(indexOfPattern("물마소", "물마시")).toBe(-1);
    expect(indexOfPattern("급하다고", "급하시")).toBe(-1);
  });

  it("'-시'로 끝나지 않는 패턴은 단순 부분 문자열 대조다", () => {
    expect(indexOfPattern("문을잠그겠습니다", "문을잠")).toBe(0);
    expect(indexOfPattern("문을잠그겠습니다", "문을잠", 1)).toBe(-1);
    expect(indexOfPattern("아무것도없다", "")).toBe(-1);
  });
});

describe("isNegated — 부정 창", () => {
  it("매치 뒤 10글자 안의 부정 표지를 잡는다", () => {
    const text = normalize("밀지 않겠습니다");
    expect(isNegated(text, 0, 1)).toBe(true);
  });

  it("창 밖이면 잡지 않는다", () => {
    // 매치 끝(2)부터 10글자가 창. 표지가 11번째 글자면 창 안, 12번째면 창 밖이다.
    expect(isNegated("붙잡가나다라마바사아자않", 0, 2)).toBe(true);
    expect(isNegated("붙잡가나다라마바사아자차않", 0, 2)).toBe(false);
  });

  it("앞쪽 부정어는 매치에 바로 붙어 있어야 한다", () => {
    expect(isNegated("절대로밀치", 3, 5)).toBe(true);
    expect(isNegated("절대로그렇게밀치", 6, 8)).toBe(false);
  });
});

describe("findTerm", () => {
  it("찾은 신호는 사전 원문(공백 포함) 그대로 돌려준다", () => {
    expect(findTerm("어르신을 붙잡았습니다", ["붙잡"])).toEqual({ term: "붙잡", index: 4 });
    expect(findTerm("팔을 잡아 세웁니다", ["팔을 잡아"])?.term).toBe("팔을 잡아");
  });

  it("부정 문맥의 매치는 건너뛴다", () => {
    expect(findTerm("붙잡지 않았습니다", ["붙잡"])).toBeNull();
  });

  it("빈 신호는 무시한다 (사전에 빈 문자열이 섞여도 전 발화를 삼키지 않는다)", () => {
    expect(findTerm("오늘 날씨가 좋습니다", ["", " "])).toBeNull();
  });
});

describe("checkCritical — ⚑CF 사전", () => {
  it("신체 억제는 전 유형 공통으로 잡는다", () => {
    const hit = checkCritical("문을 잠그겠습니다");
    expect(hit.cf).toBe(true);
    expect(hit.ruleId).toBe("CF-RESTRAINT");
    expect(hit.itemId).toBe("CO-02");
    expect(hit.matched).toBe("문을 잠");
    expect(hit.alternatives).toHaveLength(3);
  });

  it("부정 표현은 발동시키지 않는다", () => {
    expect(checkCritical("문을 잠그지 않겠습니다").cf).toBe(false);
    expect(checkCritical("붙잡는 대신 손을 잡아 드리겠습니다").cf).toBe(false);
    expect(checkCritical("밀치면 안 됩니다").cf).toBe(false);
  });

  it("유형 한정 규칙은 다른 유형에서 조용히 있는다", () => {
    expect(checkCritical("물 좀 드세요", { scenarioType: "EMERGENCY" }).cf).toBe(true);
    expect(checkCritical("물 좀 드세요", { scenarioType: "BPSD" }).cf).toBe(false);
  });

  it("응급이 끝난 보고 구간(skipCues)에서는 회고 진술을 잡지 않는다", () => {
    const opts = { scenarioType: "EMERGENCY" } as const;
    expect(checkCritical("물 한 잔 드려서 넘겨 보시게 하겠습니다.", { ...opts, cueId: "CUE-3" }).cf).toBe(true);
    expect(checkCritical("물 한 잔 드려서 넘겨 보시게 하겠습니다.", { ...opts, cueId: "CUE-6" }).cf).toBe(false);
  });

  it("존경 선어말어미 활용형도 사전에 걸린다", () => {
    const hit = checkCritical("물 마셔 보시겠어요?", { scenarioType: "EMERGENCY" });
    expect(hit.cf).toBe(true);
    expect(hit.matched).toBe("물 마시");
  });

  it("빈 발화는 판정하지 않는다", () => {
    expect(checkCritical("").cf).toBe(false);
    expect(checkCritical("   ").cf).toBe(false);
  });
});

describe("예외어 창(EXCEPT_WINDOW)", () => {
  it("예외어가 매치 주변에 있으면 건너뛴다", () => {
    expect(checkCritical("휠체어를 밀어서 방으로 모시겠습니다").cf).toBe(false);
    expect(checkCritical("휠체어를타고밀어서").cf).toBe(false);
  });

  it("예외어가 창 밖으로 밀려나면 그대로 잡는다 (예외어 끼워 넣기 우회 차단)", () => {
    expect(checkCritical("휠체어를타고서밀어서").cf).toBe(true);
    const hit = checkCritical("휠체어에 태우고 팔을 잡아 못 나가게 하겠습니다");
    expect(hit.cf).toBe(true);
    expect(hit.ruleId).toBe("CF-RESTRAINT");
  });
});

describe("appliedRubric 게이트 — 판정선 분리(§3.3)", () => {
  const utterance = "어르신, 손목을 붙잡고 못 나가시게 하겠습니다.";

  it("배정되지 않은 ⚑CF 항목은 인터럽트를 띄우지 않는다", () => {
    expect(checkCritical(utterance, { appliedRubric: ["RE-01"] }).cf).toBe(false);
  });

  it("대신 코칭으로 남긴다 — 안내는 사라지지 않는다", () => {
    const found = checkAdvisory(utterance, { appliedRubric: ["RE-01"] });
    const restraint = found.find((f) => f.ruleId === "CF-RESTRAINT");
    expect(restraint).toBeDefined();
    expect(restraint?.score).toBe(2);
    expect(restraint?.itemId).toBe("CO-02");
  });

  it("배정된 항목이면 그대로 인터럽트다", () => {
    expect(checkCritical(utterance, { appliedRubric: ["CO-02"] }).cf).toBe(true);
  });
});

describe("checkAdvisory — 코칭 규칙", () => {
  it("현실 직면 강요를 잡는다", () => {
    expect(checkAdvisory("어르신, 여기가 집이에요.").map((f) => f.itemId)).toEqual(["RE-02"]);
  });

  it("호칭 정정 요청은 예외어로 걸러 낸다", () => {
    expect(checkAdvisory("이모 아니고 선생님입니다")).toEqual([]);
  });

  it("예외어가 창 밖이면 호칭 위반으로 남긴다", () => {
    const found = checkAdvisory("이모, 어제 저녁에 드신 것도 기록해 두었는데 선생님께 전해 드릴게요");
    expect(found.map((f) => f.ruleId)).toEqual(["WARN-TITLE"]);
  });

  it("반말·명령형은 문장 끝에서만 본다", () => {
    expect(checkAdvisory("거기 앉아").map((f) => f.ruleId)).toEqual(["WARN-BANMAL"]);
    expect(checkAdvisory("같이 앉아 계실까요?")).toEqual([]);
  });

  it("호칭 위반이 이미 잡혔으면 반말을 겹쳐 세지 않는다 (CO-07 중복 방지)", () => {
    const found = checkAdvisory("아줌마, 조용히 해");
    expect(found.filter((f) => f.itemId === "CO-07")).toHaveLength(1);
  });

  it("개인정보가 섞이면 CO-08을 남긴다", () => {
    const found = checkAdvisory("보호자님께 010-1234-5678로 지금 전화드리겠습니다.");
    const pii = found.find((f) => f.ruleId === "WARN-PII");
    expect(pii?.itemId).toBe("CO-08");
    expect(pii?.matched).toBe("번호");
  });

  it("성명만 있는 발화는 CO-08로 세지 않는다 (번호·주소·생년만 대상)", () => {
    expect(checkAdvisory("박 어르신께 말씀드리겠습니다").some((f) => f.ruleId === "WARN-PII")).toBe(false);
  });

  it("빈 발화는 아무것도 남기지 않는다", () => {
    expect(checkAdvisory("")).toEqual([]);
  });
});

describe("advisoryHits · containsPii · getRule", () => {
  it("코칭 결과를 루브릭 반영 형태로 바꾼다", () => {
    expect(advisoryHits(checkAdvisory("어르신, 여기가 집이에요."))).toEqual([{ itemId: "RE-02", score: 2 }]);
  });

  it("containsPii는 성명 외 식별 요소만 본다", () => {
    expect(containsPii("010-1234-5678로 연락 주세요")).toBe(true);
    expect(containsPii("박 어르신께 말씀드렸습니다")).toBe(false);
  });

  it("⚑CF 규칙은 대안 행동 3개를 반드시 들고 있다 (인터럽트 화면 계약)", () => {
    expect(getRule("CF-RESTRAINT")?.alternatives).toHaveLength(3);
    expect(getRule("없는규칙")).toBeUndefined();
  });
});

/**
 * 시연 예시 표(ruleDemoExamples.ts)는 "무대에서 오타 없이 발동시키는 문장 모음"이라
 * 사전을 손대면 가장 먼저 조용히 거짓말이 되는 파일이다. 표가 선언한 규칙 id·항목 id·
 * 걸리는 신호가 엔진 실행 결과와 같은지 전수 대조한다.
 */
describe("시연 예시 표가 실제 엔진과 일치하는지", () => {
  for (const example of RULE_DEMO_EXAMPLES) {
    const types = example.onlyTypes ?? ALL_TYPES;
    for (const type of types) {
      it(`${example.id} · ${type}`, () => {
        const cueId = "CUE-1";
        if (example.kind === "critical") {
          const hit = checkCritical(example.sentence, { scenarioType: type, cueId });
          expect(hit.cf).toBe(true);
          expect(hit.ruleId).toBe(example.ruleId);
          expect(hit.itemId).toBe(example.itemId);
          expect(hit.label).toBe(example.ruleLabel);
          expect(hit.matched).toBe(example.matchedTerm);
          return;
        }
        const found = checkAdvisory(example.sentence, { scenarioType: type, cueId });
        const target = found.find((f) => f.ruleId === example.ruleId);
        expect(target, `${example.ruleId} 가 발동하지 않았습니다`).toBeDefined();
        expect(target?.itemId).toBe(example.itemId);
        expect(target?.label).toBe(example.ruleLabel);
        expect(target?.matched).toBe(example.matchedTerm);
      });
    }
  }

  it("시연 예시는 ⚑CF가 꺼지는 구간을 스스로 숨긴다", () => {
    const fluid = RULE_DEMO_EXAMPLES.find((e) => e.id === "demo-fluid");
    expect(fluid?.skipCueIds).toBeDefined();
    for (const cueId of fluid?.skipCueIds ?? []) {
      expect(checkCritical(fluid!.sentence, { scenarioType: "EMERGENCY", cueId }).cf).toBe(false);
    }
  });
});
