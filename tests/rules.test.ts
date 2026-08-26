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
  CRITICAL_RULES,
  expandKoreanTimeNumerals,
  findTerm,
  getRule,
  indexOfPattern,
  isNegated,
  normalize,
  RESTRAINT_COMPLY_TERMS,
  type RuleCheckOptions,
} from "@/engine/rules";
import { classifyInput } from "@/engine/classify";
import { runEngineSelfCheck } from "@/engine/boundaryCheck";
import { RULE_DEMO_EXAMPLES } from "@/app/train/_components/ruleDemoExamples";
import {
  CALL_DELAY_BOUNDARY_CASES,
  DIALECT_BOUNDARY_CASE_IDS,
  EVIDENCE_BOUNDARY_CASES,
  RULE_BOUNDARY_CASES,
} from "@/data/ruleBoundaryCases";
import { EVIDENCE_GUARD } from "@/data/evidenceGuard";
import { getScenario } from "@/data/scenarios";
import type { CueDef, ScenarioType } from "@/types";

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
    expect(isNegated("못밀치", 1, 3)).toBe(true);
    expect(isNegated("못그렇게밀치", 4, 6)).toBe(false);
  });

  /**
   * 「절대·절대로·결코」는 부정어가 아니라 **강조 부사**다. 앞자리에 서 있다는 것만으로
   * 면죄하면 같은 부사를 붙인 실행 선언이 전 동사에 걸쳐 빠져나간다(출하 판정 실측).
   * 값이 없다는 것을 짝으로 고정한다 — 정상 거절은 예외 없이 「지 않」을 함께 달고 있다.
   */
  it("앞쪽 강조 부사는 면죄부가 아니다", () => {
    expect(isNegated(normalize("절대 밀치겠습니다"), 2, 4)).toBe(false);
    expect(isNegated(normalize("결코 밀치겠습니다"), 2, 4)).toBe(false);
    expect(isNegated(normalize("절대 밀치지 않겠습니다"), 2, 4)).toBe(true);
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

/**
 * 저장소에 커밋된 경계 케이스(src/data/ruleBoundaryCases.ts)는 지금까지 브라우저(/check·
 * /safety)에서만 돌았다. 화면이 「전수 통과」라고 적는 근거가 화면 안에만 있으면, 사전을
 * 손댄 커밋이 조용히 그 문장을 거짓말로 만든다. 같은 러너를 여기서도 돌린다.
 */
describe("경계 케이스 전수 통과 (runEngineSelfCheck)", () => {
  const result = runEngineSelfCheck({
    ruleCases: RULE_BOUNDARY_CASES,
    callDelayCases: CALL_DELAY_BOUNDARY_CASES,
    evidenceCases: EVIDENCE_BOUNDARY_CASES,
    evidenceGuard: EVIDENCE_GUARD,
    repeat: 1,
  });

  for (const group of result.groups) {
    it(`${group.label} — ${group.total}건 전수 통과`, () => {
      expect(group.failures).toEqual([]);
      expect(group.passed).toBe(group.total);
    });
  }

  /**
   * 기획서가 「시험 문장을 100개로 늘립니다」라고 적었다. 그 100은 **하한**이지 정원이 아니다.
   * 총합을 =100으로 못 박아 두면, 오탐 하나를 고치며 경계 문장을 덧대는 커밋마다 이 검사가
   * 먼저 깨져 「케이스를 늘리지 말라」는 압력이 된다 — 늘어나는 방향은 막지 않고,
   * **줄어드는 방향만** 막는다. 정확한 건수는 화면(/check)이 배열에서 세어 옵니다.
   */
  it("자가 점검은 규칙 150건·총 160건 아래로 내려가지 않는다", () => {
    // 하한은 레드팀 라운드마다 올린다(89 → 150). 기획서가 약속한 100은 그중 첫 눈금이었다.
    expect(RULE_BOUNDARY_CASES.length).toBeGreaterThanOrEqual(150);
    expect(CALL_DELAY_BOUNDARY_CASES).toHaveLength(6);
    expect(EVIDENCE_BOUNDARY_CASES).toHaveLength(5);
    expect(result.total).toBeGreaterThanOrEqual(160);
    expect(result.passed).toBe(result.total);
  });

  /**
   * 「옳은 답을 잘못 막는 쪽이 놓치는 쪽보다 나쁘다」가 이 목록의 고르는 기준이다.
   * 걸리면 안 되는 문장(cf:false)이 절반 아래로 내려가면 목록이 그 기준을 잃은 것이다.
   */
  it("걸리면 안 되는 문장이 절반을 넘는다", () => {
    const negatives = RULE_BOUNDARY_CASES.filter((c) => !c.cf).length;
    expect(negatives * 2).toBeGreaterThan(RULE_BOUNDARY_CASES.length);
  });

  it("사투리 케이스 10건이 목록에 그대로 있다 (화면이 골라 쓰는 id)", () => {
    expect(DIALECT_BOUNDARY_CASE_IDS).toHaveLength(10);
    for (const id of DIALECT_BOUNDARY_CASE_IDS) {
      expect(RULE_BOUNDARY_CASES.some((c) => c.id === id), `${id} 가 없습니다`).toBe(true);
    }
  });

  it("근거 화이트리스트는 인용 가능 문서 7건뿐이다 (표준교재 제외)", () => {
    expect(EVIDENCE_GUARD.allowedDocIds).toHaveLength(7);
    expect(EVIDENCE_GUARD.allowedDocIds).not.toContain("DOC-EDU-000");
  });
});

/**
 * 사유어 우회 — "위험"·"큰일"을 부정 표지로 두었을 때 뚫리던 자리다.
 * 좁힌 뒤에도 「~면 위험합니다」 같은 정상 발화가 ⚑CF로 뒤집히지 않아야 한다.
 */
describe("사유어를 앞세운 우회", () => {
  const BYPASS = [
    "붙잡아서 위험을 막을게요.",
    "문을 잠가야 큰일을 막지요.",
    "일단 붙잡을게요, 위험하니까요.",
    "문을 잠그면 위험하지 않겠죠.",
    "못 나가시게 문을 걸어 두겠습니다.",
  ];

  for (const utterance of BYPASS) {
    it(`${utterance} — 멈춰 세운다`, () => {
      expect(checkCritical(utterance).cf).toBe(true);
    });
  }

  it("조건 연접형은 하지 않겠다는 뜻이라 그대로 통과시킨다", () => {
    expect(checkCritical("문을 잠그면 위험합니다").cf).toBe(false);
    expect(checkCritical("밀치면 위험하니 하지 않겠습니다").cf).toBe(false);
    expect(checkCritical("위험하지 않게 부축해 드릴게요").cf).toBe(false);
  });
});

/**
 * 부정 어휘 — 창 **폭(10)은 그대로 두고** 어휘만 넓힌 자리다.
 *
 * 홑 「못」을 표지로 넣으면 "붙잡고 못 가시게 하겠습니다"가 면죄되고, 「없」을 무조건 표지로
 * 읽으면 "붙잡을 수밖에 없습니다"가 면죄된다. 한쪽만 검사하면 반대쪽이 조용히 무너지므로
 * 통과/차단을 같은 자리에서 함께 본다.
 */
describe("부정 어휘 — 용언 결합형만", () => {
  const PASS = [
    "결박은 못 합니다.",
    "억제대는 못 씁니다.",
    "결박은 몬 합니더.",
    "결박 그런 거 안 헙니다잉.",
    "제가 붙잡은 적은 없습니다.",
    "억제대 사용 없이 대응했다고 보고드립니다.",
    "억제대는 쓸 수 없습니다.",
    "결박은 제가 해 드릴 수 없습니다.",
    "몬 붙잡습니더.",
  ];

  for (const utterance of PASS) {
    it(`${utterance} — 멈춰 세우지 않는다`, () => {
      expect(checkCritical(utterance).cf).toBe(false);
      expect(checkAdvisory(utterance)).toEqual([]);
    });
  }

  const CAUGHT = [
    "붙잡고 못 가시게 하겠습니다.", // 「못」은 화자가 아니라 어르신을 향한다
    "붙잡을 수밖에 없습니다.", // 「수밖에 없」은 하겠다는 체념이다
    "가둬 둘 수밖에 없습니다.",
    "손목을 잡는 것도 어쩔 수 없죠.",
    "손목을 잡는 것도 어쩔 수 없습니다.", // 「수없습」 표지를 「어쩔수없」이 먼저 지운다
    "나가지 못하게 방문을 잠그겠습니다.", // 「못하게」는 부정이 아니라 사동이다
    "몸으로 막아서 나가지 못하게 하겠습니다.",
    "묶어 놔서 못하시게 하겠습니다.", // 존경 선어말어미가 끼어도 사동이다
    "가둬 놓으면 나가지 못합니다.", // 「못합」이 향하는 곳은 어르신의 이동이다
  ];

  for (const utterance of CAUGHT) {
    it(`${utterance} — 그대로 멈춰 세운다`, () => {
      expect(checkCritical(utterance).ruleId).toBe("CF-RESTRAINT");
    });
  }

  it("같은 「못합」이라도 동사가 화자의 행위면 거절로 읽는다", () => {
    expect(checkCritical("붙잡지 못합니다.").cf).toBe(false);
    expect(checkAdvisory("붙잡지 못합니다.")).toEqual([]);
  });

  it("이중 부정은 여전히 통과한다 (부정의 범위를 읽어야 풀리는 자리)", () => {
    // 고쳤다고 적어 두면 다음 사람이 그 오해 위에 단언을 쌓는다. 못 하는 일을 못 한다고 적는다.
    expect(checkCritical("붙잡지 않을 수 없습니다.").cf).toBe(false);
  });
});

/**
 * 홑 「없」을 표지에서 걷어 낸 자리.
 *
 * 「없」 한 글자는 부정어이기도 하지만 **사유어**이기도 하다. 표지로 두었더니 행위를
 * 정당화하는 말이 전부 빠져나갔다 — "붙잡아 두면 사고가 없습니다". 그래서 **무엇이 없는지**를
 * 함께 적은 결합형만 남겼다. 해소되던 거절·부인은 그대로 통과해야 하므로 양쪽을 함께 본다.
 * 「일이 없다」류를 넣지 않은 이유가 마지막 문장이다.
 */
describe("「없」 결합형 — 사유어와 부정어를 가른다", () => {
  const CAUGHT = [
    "붙잡아 두면 사고가 없습니다.",
    "묶어 두는 게 안전에 문제 없습니다.",
    "붙잡아도 아무 일 없습니다.",
    "묶어 놓으면 다칠 일 없어요.",
    "억제대를 채우면 사고 날 일이 없죠.",
    "붙잡는 것 말고는 답이 없어요.", // 「A 말고는」은 A를 하겠다는 말이다
    "가둬 두는 게 어렵지 않습니다.", // 부정되는 말이 난이도다
    "가둬 둘 방법밖에 남지 않았습니다.",
  ];

  for (const utterance of CAUGHT) {
    it(`${utterance} — 그대로 멈춰 세운다`, () => {
      expect(checkCritical(utterance).ruleId).toBe("CF-RESTRAINT");
    });
  }

  const PASS = [
    "결박은 제가 해 드릴 수 없습니다.",
    "제가 붙잡은 적은 없습니다.",
    "억제대 사용 없이 대응했다고 보고드립니다.",
    "억제대는 쓸 수 없습니다.",
    "문을 잠근 사실이 없습니다.",
    "밀치지 말고 손을 잡아 드리겠습니다.", // 보조사 없는 「말고」는 그대로 대체 행동이다
  ];

  for (const utterance of PASS) {
    it(`${utterance} — 멈춰 세우지 않는다`, () => {
      expect(checkCritical(utterance).cf).toBe(false);
      expect(checkAdvisory(utterance)).toEqual([]);
    });
  }
});

/**
 * 부정 표지 확장 — 보고·성찰 CUE를 국면 게이트에서 뺀 뒤, 그 자리의 오탐을 받는 장치다.
 *
 * 게이트는 「어느 자리에서 한 말인가」로 끄고 켜지만 표지는 문장만 본다. 그래서 표지를
 * 넓히는 쪽이 **미탐이 아니라 오탐**으로 실패한다 — 안전 직결 판정에서는 그 편이 낫다.
 * 다만 넓힌 쪽만 검사하면 진짜 선언이 조용히 새므로, 표지마다 **공격 짝**을 함께 둔다.
 */
describe("부정 표지 확장 — 표지마다 공격 짝", () => {
  const PAIRS: [string, string][] = [
    // [멈춰 세우지 않을 문장, 같은 표지를 쓴 공격]
    ["붙잡고 싶은 마음이 들었지만 하지 않았습니다.", "묶고 싶은 마음에 어르신을 묶겠습니다."],
    ["가로막고 싶은 충동이 있었다는 점을 적어 두겠습니다.", "묶고 싶으니 침대에 묶겠습니다."],
    ["붙잡기보다 옆에서 같이 걷겠습니다.", "말리기보다 붙잡겠습니다."],
    ["문 잠금 여부를 먼저 살피겠습니다.", "잠글지 여부와 무관하게 잠급니다."],
    ["문을 잠그셨는지 확인해 보겠습니다.", "묶었는지 확인하고 다시 묶어 두겠습니다."],
    ["붙잡으신 분이 있는지 확인하겠습니다.", "묶었는지 확인하고 다시 묶어 두겠습니다."],
    // 확인 술어가 갈리는 자리 — 「는지 확인」만 알던 표지를 술어별로 늘렸다.
    ["잠금장치가 걸려 있는지 보겠습니다.", "붙잡으라는 지시대로 하겠습니다."],
    ["누가 붙잡았는지 여쭙겠습니다.", "가두는지 확인만 하고 그대로 둡니다."],
    ["문 잠금 상태를 점검하겠습니다.", "문 잠금 여부는 제가 판단해서 그리 합니다."],
    ["결박 요구를 받으면 즉시 센터에 보고하겠습니다.", "결박 요구가 있어서 결박했습니다."],
    ["결박 요구를 받았지만 거절했다는 점을 기록하겠습니다.", "요구를 들어드려 결박하겠습니다."],
    ["결박 요구가 있었다는 사실도 그대로 적겠습니다.", "묶어 달라는 요구가 있어 묶어 두겠습니다."],
    ["붙잡으려던 순간을 멈춘 것이 오늘의 개선점입니다.", "붙잡으려던 대로 붙잡겠습니다."],
    [
      "다음엔 못 나가시게 하기 전에 어디가 불편하신지부터 여쭙겠습니다.",
      "못 나가시게 하겠습니다.",
    ],
  ];

  for (const [pass, attack] of PAIRS) {
    it(`${pass} — 통과 / ${attack} — 차단`, () => {
      expect(checkCritical(pass).cf, pass).toBe(false);
      expect(checkAdvisory(pass), pass).toEqual([]);
      expect(checkCritical(attack).ruleId, attack).toBe("CF-RESTRAINT");
    });
  }
});

/**
 * 활용형 결손을 **목적어와 함께** 메운 자리.
 *
 * 좁힌 사전에는 「묶을게」·「잠그겠」이 있는데 전역 사전에 그 활용형이 없어, 문맥이 없을수록
 * 관대한 뒤집힌 판정선이 있었다. 3라운드에 홑 활용형(「묶겠」·「잠그겠」·「고정하겠」)으로
 * 메웠더니 이번에는 **유도 정답**이 막혔다 — 가스·수도 차단과 침대 바퀴 고정은 치매 가정의
 * 표준 권고 사항인데, 그 말을 한 학습자가 「신체 자유 제한」으로 멈춰 세워졌다(실측 6건).
 * 그래서 활용형은 **누구를·어디에·무엇을**과 함께만 받는다. 이 사전의 원래 지혜다.
 */
describe("활용형 결손 — 목적어·맥락과 함께 메운다", () => {
  const CAUGHT = [
    "어르신을 묶을게요.",
    "침대에 묶습니다.",
    "어르신 손목을 묶겠습니다.",
    "어르신을 가둘게요.",
    "어르신을 가둡니다.",
    "방에 가둘 겁니다.",
    "출입구를 잠그겠습니다.",
    "안쪽에서 잠그겠습니다.",
    "베란다 창문은 잠그는 걸로 하고, 다른 요구는 받아들이지 않겠습니다.",
    "침대에 고정하겠습니다.",
    "가방을 챙기고 문을 잠그겠습니다.", // 예외어가 창 안에 들어와도 다른 신호가 남는다
  ];

  for (const utterance of CAUGHT) {
    it(`${utterance} — 멈춰 세운다`, () => {
      expect(checkCritical(utterance).ruleId).toBe("CF-RESTRAINT");
    });
  }

  const PASS = [
    "머리를 묶을게요.",
    "머리 묶어 드릴게요.",
    "신발끈을 묶어 드릴까요?",
    "환자복 끈을 묶어 드리겠습니다.",
    "쓰레기 봉투를 묶겠습니다.",
    "앞치마를 묶겠습니다.",
    "약장은 잠그겠습니다.",
    "가방을 잠그고 나가겠습니다.",
    "가방을 잠그고 함께 나가시겠어요?",
    "서랍은 잠그는 걸로 하겠습니다.",
    "사물함은 잠그는 걸로 하겠습니다.",
    "휠체어 브레이크를 잠그겠습니다.",
    "가스 밸브를 잠그겠습니다.",
    "수도를 잠그고 나오겠습니다.",
    "침대 바퀴를 고정해 두겠습니다.",
    "붕대를 고정하겠습니다.",
    "차량 이송 중에는 안전벨트를 매 드립니다.",
    "묶을 끈도 없습니다.",
    "가둘 생각은 없습니다.",
  ];

  for (const utterance of PASS) {
    it(`${utterance} — 멈춰 세우지 않는다`, () => {
      expect(checkCritical(utterance).cf).toBe(false);
      expect(checkAdvisory(utterance)).toEqual([]);
    });
  }

  /**
   * 남은 한계 ⑤ — **목적어를 생략했거나 사전 밖 목적어**인 잠금 선언은 잡지 못한다.
   * 홑 「잠그겠」을 되돌리면 이 셋은 잡히지만, 위 PASS의 가스·수도·약장이 함께 막힌다.
   * 1라운드 사전도 잡지 못하던 문형이고, 유도 정답을 되찾는 값으로 내준 자리다.
   * 고쳤다고 적어 두면 다음 사람이 그 오해 위에 단언을 쌓으므로 못 하는 일을 못 한다고 적는다.
   */
  it("목적어 없는·비주거 목적어 잠금 선언은 여전히 통과한다 (한계 ⑤)", () => {
    expect(checkCritical("제가 잠그겠습니다.").cf).toBe(false);
    expect(checkCritical("셔터를 잠그겠습니다.").cf).toBe(false);
    expect(checkCritical("저녁마다 잠그기로 했습니다.").cf).toBe(false);
    // 잠그는 대상이나 자리가 적히면 그대로 잡힌다 — 한계가 끝나는 선.
    expect(checkCritical("저녁마다 방문을 잠그겠습니다.").ruleId).toBe("CF-RESTRAINT");
    expect(checkCritical("밖에서 잠그겠습니다.").ruleId).toBe("CF-RESTRAINT");
  });
});

/**
 * 억제 기구는 「억제대」라고 불리지 않는다 — 2라운드 레드팀이 게이트 안팎에서 함께 뚫은 자리다.
 * 이름(고정·안전벨트·안전띠·복대·조끼형 보호구·손모아장갑)과 사동 선언(「못 일어나시게」)을
 * 넣으면서, 옷을 입혀 드리며 채우는 벨트가 함께 걸리지 않는지를 같은 자리에서 본다.
 */
describe("이름이 다른 억제 기구", () => {
  const CAUGHT = [
    "안전벨트로 침대에 고정하겠습니다.",
    "안전벨트를 채우겠습니다.",
    "허리띠로 고정하겠습니다.",
    "복대를 채워 두겠습니다.",
    "조끼형 보호구를 입혀 두겠습니다.",
    "손모아장갑을 끼워 두겠습니다.",
    "침대 난간을 다 올려서 못 내려오시게 하겠습니다.",
    "이불을 무겁게 덮어 못 일어나시게 하겠습니다.",
    "의자에 앉혀 놓고 일어나지 못하게 하겠습니다.",
    "야간에는 병실 밖으로 못 나오시게 하겠습니다.",
  ];

  for (const utterance of CAUGHT) {
    it(`${utterance} — 멈춰 세운다`, () => {
      expect(checkCritical(utterance).ruleId).toBe("CF-RESTRAINT");
    });
  }

  const PASS = [
    "침대에 고정해 두지는 않겠습니다.",
    "손모아장갑은 사용하지 않겠습니다.",
    "복대는 사용하지 않겠습니다.",
    "바지 벨트를 채워 드리겠습니다.",
    "허리띠를 채워 드리고 옷매무새를 살피겠습니다.",
    "침대 난간은 한쪽만 올리고 나머지는 내려 두겠습니다.",
    "못 일어나시게 하지 않고 곁에서 지켜보겠습니다.",
    "휠체어 안전벨트는 이동 중에만 쓰고 도착하면 바로 풀어 드리겠습니다.",
  ];

  for (const utterance of PASS) {
    it(`${utterance} — 멈춰 세우지 않는다`, () => {
      expect(checkCritical(utterance).cf).toBe(false);
      expect(checkAdvisory(utterance)).toEqual([]);
    });
  }

  /**
   * 남은 한계 ⑤ (rules.ts 머리주석) — 예외어는 언제나 신호를 이긴다.
   * 「휠체어」가 예외어 창(앞뒤 6) 안에 들어오는 **짧은 문장**에서만 열리는 틈이고,
   * 예외어가 창 밖으로 밀려나면 같은 말이 그대로 잡힌다. 고쳤다고 적으면 다음 사람이
   * 그 오해 위에 단언을 쌓으므로, 못 하는 일을 못 한다고 적어 둔다.
   */
  it("예외어 창 안의 억제 기구는 여전히 통과한다 (한계 ⑤)", () => {
    expect(checkCritical("휠체어 벨트를 채우겠습니다.").cf).toBe(false);
    expect(checkCritical("휠체어에 앉으신 뒤 벨트를 채우겠습니다.").ruleId).toBe("CF-RESTRAINT");
  });
});

/**
 * 전역 사전의 보수성과 국면 게이트.
 *
 * 화자 의도(누가 요구했나)를 문자열 구조로 가르려던 장치(언급 판별)는 레드팀에서 **양방향으로**
 * 무너져 철회했다(우회 54 · 오탐 51). 지금 서 있는 자리는 둘이다.
 *  ① 문맥이 없으면 사전은 보수적으로 멈춰 세운다 — 문장 하나로는 실행과 거절을 가를 수 없다.
 *  ② **억제를 다루는 네 CUE(C02 CUE-C1·C3·C4·C6)에서** 사전을 순응 문형으로 좁힌다.
 * 좁히기는 끄기가 아니다 — 그 자리에서도 「하겠다」고 선언한 말은 그대로 잡혀야 한다.
 * (C4·C6은 3라운드까지 전면 오프였다. 자리가 통째로 비어 있어 앞으로의 행위 선언이 아무
 *  되먹임 없이 통과했다 — 아래 「보고·성찰 게이트는 끄지 않고 좁힌다」가 그 자리를 지킨다.)
 *
 * A01·A02·B02의 보고·성찰 CUE(CUE-5·6·7)는 2라운드에 게이트에서 뺐다. 그 자리에는 좁힌
 * 사전이 놓친 말을 받아 줄 ⚑CF 분기가 어느 시나리오에도 없기 때문이다. 그 자리의 오탐은
 * 부정 표지가 받는다(아래 「부정 표지 확장」·「돌아보는 표지」).
 */
describe("전역 사전은 보수적으로 · 게이트 CUE는 순응 문형만", () => {
  const C1: RuleCheckOptions = { scenarioType: "CONFLICT", cueId: "CUE-C1" };
  const C3: RuleCheckOptions = { scenarioType: "CONFLICT", cueId: "CUE-C3" };
  const REPORT: RuleCheckOptions = { scenarioType: "BPSD", cueId: "CUE-5" };
  const REFLECT: RuleCheckOptions = { scenarioType: "BPSD", cueId: "CUE-7" };

  const GATE_PASS: [string, RuleCheckOptions][] = [
    ["묶어 두라는 요구는 받아들이지 않겠습니다.", C1],
    ["결박은 기관 지침상 허용되지 않습니다.", C1],
    ["보호자가 문을 잠가 달라고 하십니다.", C1],
    ["묶거나 방문을 잠그는 것은 법으로 금지된 신체 자유 제한이라 해 드릴 수 없습니다.", C1],
    ["억제대 사용 여부를 센터에 확인해 보겠습니다.", C1],
    ["아까 말씀드린 대로, 묶어 두거나 방문을 잠가 달라는 요구는 허용되지 않는다고 안내드렸습니다.", C3],
    // 아래 셋은 게이트가 아니라 **부정 표지**가 받는 자리다(「여부」·「싶은」·「려던」).
    ["새벽 2시 10분 현관 앞에 서 계셔서, 현관문 잠금 여부를 확인하고 곁에서 함께 걸었습니다.", REPORT],
    ["붙잡고 싶은 마음이 들었지만 하지 않았습니다.", REFLECT],
    ["붙잡으려던 순간을 멈춘 것이 오늘의 개선점입니다.", REFLECT],
  ];

  for (const [utterance, opts] of GATE_PASS) {
    it(`${opts.cueId} · ${utterance} — 멈춰 세우지 않는다`, () => {
      expect(checkCritical(utterance, opts).cf).toBe(false);
    });
  }

  const GATE_CAUGHT: [string, RuleCheckOptions][] = [
    ["말씀대로 밤에는 방문을 잠가 두겠습니다.", C1],
    ["네, 그럼 침대에 묶어 두겠습니다.", C1],
    ["알겠습니다. 억제대를 채우겠습니다.", C1],
    // 문 잠그기 밖의 억제 — 게이트 구간 케이스가 잠금에만 몰려 있던 자리다.
    ["억제대로 고정해 두겠습니다.", C1],
    ["붙잡아서 방으로 모시겠습니다.", C1],
    ["안전벨트로 침대에 고정하겠습니다.", C1],
    ["야간에는 병실 밖으로 못 나오시게 하겠습니다.", C1],
    ["네, 그럼 오늘 밤부터 방문을 잠가 두겠습니다.", C3],
    // 게이트 밖으로 나온 보고·성찰 자리 — 전역 사전이 그대로 돈다.
    ["앞으로는 억제대를 채우겠습니다.", REPORT],
    ["앞으로는 억제대를 채웁니다.", REPORT],
    ["다음엔 붙잡아 두겠습니다.", REFLECT],
    ["다음엔 그냥 붙잡아야겠어요.", REFLECT],
    ["다음엔 자물쇠를 답니다.", { scenarioType: "BPSD", cueId: "CUE-6" }],
  ];

  for (const [utterance, opts] of GATE_CAUGHT) {
    it(`${opts.cueId} · ${utterance} — 그대로 멈춰 세운다`, () => {
      expect(checkCritical(utterance, opts).ruleId).toBe("CF-RESTRAINT");
    });
  }

  const CONSERVATIVE = [
    "묶어 두라는 요구는 받아들이지 않겠습니다.", // 게이트 밖에서는 기본값이 차단이다
    "문을 잠글 거라고 말씀드렸잖아요.",
    "묶어 달라고 하셔서 묶어 두겠습니다.",
    "억제대를 채우겠습니다.",
    "붙잡으라는 지시를 따르겠습니다.",
    "제가 침대에 묶어 두라고 지시했습니다.",
    "오늘부터 병실 문을 잠글 참이라고 보고했습니다.",
    "억제대는 채우겠습니다. 다만 보호자님 요구는 들어드릴 수 없습니다.",
  ];

  for (const utterance of CONSERVATIVE) {
    it(`문맥 없음 · ${utterance} — 보수적 기본값으로 멈춰 세운다`, () => {
      expect(checkCritical(utterance).ruleId).toBe("CF-RESTRAINT");
    });
  }

  it("게이트는 그 두 CUE에서만 열린다", () => {
    expect(checkCritical("팔을 붙잡아 방으로 데려가겠습니다.", { scenarioType: "BPSD", cueId: "CUE-4" }).cf).toBe(
      true,
    );
    // 앞으로의 행위를 말하는 C02 재발 방지 제안(CUE-C5)도 게이트 밖이다.
    expect(checkCritical("앞으로는 밤마다 방문을 잠가 두겠습니다.", { cueId: "CUE-C5" }).cf).toBe(true);
    // 보고·성찰 CUE도 이제 게이트 밖이다 — 좁힌 사전에 없는 신호까지 그대로 잡는다.
    expect(checkCritical("다음엔 끌고 들어옵니다.", { scenarioType: "BPSD", cueId: "CUE-5" }).cf).toBe(true);
    expect(checkCritical("다음엔 손목을 잡고 있겠습니다.", { scenarioType: "BPSD", cueId: "CUE-7" }).cf).toBe(true);
  });

  it("좁힌 사전은 요구·인용의 자리를 담지 않는다 (목록 자체의 성질)", () => {
    for (const term of RESTRAINT_COMPLY_TERMS) {
      expect(term, `${term} 는 요구를 옮긴 꼴입니다`).not.toContain("라는");
      expect(term, `${term} 는 요구를 옮긴 꼴입니다`).not.toContain("달라");
    }
  });

  /**
   * **좁힌 사전이 넓은 사전보다 넓어지면 판정선이 뒤집힌다.**
   *
   * 같은 문장이 게이트 안에서는 ⚑CF고 게이트 밖(문맥 없음)에서는 통과하는 자리가 생긴다 —
   * 문맥이 적을수록 관대해지는 사전이다. 실제로 「묶을게」·「잠그겠」이 그랬다: 좁힌 사전에는
   * 있는데 전역 사전에 그 활용형이 없었다. 사람이 눈으로 두 목록을 맞춰 보는 것으로는
   * 다시 벌어지므로, 항목마다 문장을 만들어 전수로 단언한다.
   *
   * **한때 이 루프가 `RESTRAINT_COMPLY_TERMS` 하나만 돌았다.** 그래서 응급 술기 5종에
   * 인라인 `complyTerms`가 새로 생겼을 때 「흡인할게」·「흡인합니다」·「제가 흡인」이 가드 밖에
   * 있었고, 전역에는 「흡인하」밖에 없어 같은 역전이 그대로 재현됐다(출하 판정 실측).
   * 그래서 **`complyTerms`를 가진 규칙 전부**를 순회한다 — 다음에 어느 규칙에 좁힌 사전을
   * 다는 날, 그 목록도 사람 눈이 아니라 이 루프가 받는다.
   */
  it("좁힌 사전의 모든 항목은 전역 사전에도 걸린다 (뒤집힌 판정선 방지)", () => {
    const narrowed = CRITICAL_RULES.filter(
      (r) => Boolean(r.complyOnlyCues?.length) || Boolean(r.complyTerms?.length),
    );
    // 억제 하나만 도는 루프로 되돌아가면 이 단언이 먼저 깨진다.
    expect(narrowed.length, "좁힌 게이트를 가진 규칙이 억제 하나뿐일 리 없습니다").toBeGreaterThan(1);
    expect(narrowed.map((r) => r.id)).toContain("CF-RESTRAINT");

    for (const rule of narrowed) {
      expect(rule.complyOnlyCues?.length, `${rule.id} 에 complyOnlyCues 가 비어 있습니다`).toBeGreaterThan(0);
      expect(rule.complyTerms?.length, `${rule.id} 에 complyTerms 가 비어 있습니다`).toBeGreaterThan(0);
      for (const term of rule.complyTerms ?? []) {
        // 유형 한정 규칙(CF-FOREIGN-BODY)이 함께 도록 응급 유형을 준다. cueId는 주지 않는다 —
        // 게이트 **밖**의 전역 사전이 이 신호를 받는가를 묻는 자리이기 때문이다.
        const hit = checkCritical(`${term}합니다`, { scenarioType: "EMERGENCY" });
        expect(
          hit.cf,
          `${rule.id}의 「${term}」 는 좁힌 사전에만 있습니다 — 전역 사전에 활용형을 넣어 주세요`,
        ).toBe(true);
        expect(hit.ruleId, `${rule.id}의 「${term}」 를 다른 규칙(${hit.ruleId})이 먼저 잡습니다`).toBe(rule.id);
      }
    }
  });

  /**
   * 방향2 가드 — **새 전역 신호가 comply 짝 없이 들어오는 것**을 잡는다.
   *
   * 방향1(위)은 좁힌 사전이 전역보다 넓어지는 사고를 막지만, 반대 방향은 못 본다:
   * 전역에만 신호를 넣으면 좁힌 네 자리(C1·C3·C4·C6, 응급 보고)에서 그 문형이 통째로
   * 사라진다 — 출하 판정 잔존 [R1]("안전조끼를 입혀 두겠습니다"가 C1에서 미분류)이
   * 정확히 이 사고였다. 전역 신호 전부에 짝을 요구할 수는 없다(맨 어간 「묶어」·「결박」은
   * 언급을 지나보내는 것이 게이트의 존재 이유다). 그래서 **미커버 수를 스냅샷으로 고정**한다:
   * 전역에 신호를 더하는 사람은 comply 짝을 함께 넣어 수를 지키거나, 언급 허용이 의도임을
   * 확인하고 이 숫자를 의식적으로 올려야 한다.
   */
  it("전역 신호의 comply 미커버 수는 스냅샷과 같다 (짝 없이 넣은 새 신호 검출)", () => {
    const SNAPSHOT: Record<string, number> = {
      "CF-RESTRAINT": 116,
      "CF-ORAL": 7,
      "CF-FOREIGN-BODY": 8,
      "CF-SUCTION": 8,
      "CF-ABDOMINAL": 9,
      "CF-RESCUE-BREATH": 6,
    };
    const norm = (s: string) => s.normalize("NFC").toLowerCase().replace(/\s+/g, "");
    for (const rule of CRITICAL_RULES.filter((r) => r.complyTerms?.length)) {
      const comply = (rule.complyTerms ?? []).map(norm);
      const uncovered = rule.terms.filter((t) => {
        const nt = norm(t);
        return !comply.some((c) => nt.includes(c));
      });
      expect(
        uncovered.length,
        `${rule.id}의 comply 미커버 신호가 ${SNAPSHOT[rule.id]}개에서 ${uncovered.length}개로 변했습니다.\n` +
          `새 전역 신호에는 comply 짝(실행 어미 결합형)을 함께 넣거나, 언급 허용이 의도면 스냅샷을 올리세요.\n` +
          `현재 미커버: ${uncovered.join(" · ")}`,
      ).toBe(SNAPSHOT[rule.id]);
    }
  });

  it("좁힌 사전을 가진 규칙은 억제 1 + 응급 술기 5종이다 (목록이 조용히 줄지 않도록)", () => {
    const narrowed = CRITICAL_RULES.filter((r) => r.complyTerms?.length).map((r) => r.id);
    expect(narrowed).toEqual([
      "CF-RESTRAINT",
      "CF-ORAL",
      "CF-FOREIGN-BODY",
      "CF-SUCTION",
      "CF-ABDOMINAL",
      "CF-RESCUE-BREATH",
    ]);
  });

  it("목적어까지 적은 문 잠그기 신호 — 홑 「잠그」를 뺀 자리", () => {
    expect(checkCritical("가방을 잠그고 함께 나가시겠어요?").cf).toBe(false);
    expect(checkCritical("베란다를 잠그겠습니다").matched).toBe("베란다를 잠");
    // 「문을 잠」이 먼저 걸리는 자리는 시연 예시 표가 선언한 신호 그대로여야 한다.
    expect(checkCritical("문을 잠그겠습니다").matched).toBe("문을 잠");
  });
});

/** 사투리로 말했다고 판정선이 느슨해지면, 사전은 말씨를 차별하는 장치가 된다. */
describe("사투리 어간", () => {
  const CAUGHT: [string, string][] = [
    ["몬 나가게 막아뿌겠심더.", "CF-RESTRAINT"],
    ["가마이 안 있으면 문 걸어 잠가뿌리께예.", "CF-RESTRAINT"],
    ["팔 잡아가 몬 가게 하겠심더.", "CF-RESTRAINT"],
    ["묶어뿌리겠습니더.", "CF-RESTRAINT"],
    ["약 반 알로 줄이뿌께예.", "CF-DOSE"],
  ];

  for (const [utterance, ruleId] of CAUGHT) {
    it(`${utterance} — ${ruleId}`, () => {
      const hit = checkCritical(utterance);
      expect(hit.cf).toBe(true);
      expect(hit.ruleId).toBe(ruleId);
    });
  }

  it("사투리 모범 대응은 코칭도 남기지 않는다", () => {
    const clean = [
      "어무이, 밖에 억수로 춥심더. 계단도 미끄러운데 내가 먼저 나가 볼게예.",
      "애기 밥 챙기주야 되겠구마. 마음이 억수로 급하시겠심더.",
      "어무이, 옷이 젖었는데 갈아입으시면 좋겠심더. 제가 도와드려도 되겠능교?",
    ];
    for (const utterance of clean) {
      expect(checkCritical(utterance).cf, utterance).toBe(false);
      expect(checkAdvisory(utterance), utterance).toEqual([]);
    }
  });
});

/**
 * 현실 직면 사전의 어간 확장 — 계열은 12개 그대로 두고 같은 계열의 다른 말투를 덧댔다.
 * 넓힌 쪽만 검사하면 오탐이 조용히 늘어나므로, 보고 구간의 **인용 진술**이 그대로 통과하는지를
 * 같은 자리에서 함께 고정한다.
 */
describe("현실 직면 어간 확장 (RE-02)", () => {
  const CAUGHT = [
    "어머님, 여기가 어머님 댁이에요.", // 호칭이 사이에 끼어 미탐이던 자리 (검증셋 A01-D1a)
    "여기가 댁이잖아요, 어디를 가시려고요.",
    "어무이, 아까 밥 잡샀다 아입니꺼. 자꾸 그카시면 안 됩니더.", // 실측 하네스 Q34 원문
  ];

  for (const utterance of CAUGHT) {
    it(`${utterance} — RE-02 코칭으로 남긴다`, () => {
      expect(checkCritical(utterance).cf).toBe(false);
      expect(checkAdvisory(utterance).map((f) => f.itemId)).toEqual(["RE-02"]);
    });
  }

  it("보고 구간의 인용 진술은 잡지 않는다 (기록이지 강요가 아니다)", () => {
    const quotes = [
      "어르신이 여기가 자기 댁이 아니라고 하셨습니다.",
      "어르신이 여기가 어머님 댁이 아니라고 하셔서, 그 말씀을 그대로 적겠습니다.",
    ];
    for (const utterance of quotes) {
      expect(checkAdvisory(utterance), utterance).toEqual([]);
    }
  });

  it("감정을 먼저 물은 사투리 문장은 코칭도 남기지 않는다", () => {
    const utterance = "어무이, 시장하신가 봅니더. 어떤 걸 드시고 싶으신교?";
    expect(checkCritical(utterance).cf).toBe(false);
    expect(checkAdvisory(utterance)).toEqual([]);
  });
});

/** 파이썬 검증셋(침착_엔진_v0.1/testcases.json)과 같은 문장에 같은 답을 내는지. */
describe("파이썬 검증셋 패리티", () => {
  it("용량 조절 유도를 잡는다 (CO-01 · 이전에는 미탐이었다)", () => {
    const hit = checkCritical("혈압약을 반 알로 줄여 드릴게요.");
    expect(hit.cf).toBe(true);
    expect(hit.ruleId).toBe("CF-DOSE");
    expect(hit.itemId).toBe("CO-01");
  });

  it("끌고 들어가기·사레 중 물 제공을 잡는다", () => {
    expect(checkCritical("일단 제가 끌고 들어갈게요.").ruleId).toBe("CF-RESTRAINT");
    expect(checkCritical("물을 드리겠습니다.", { scenarioType: "EMERGENCY" }).ruleId).toBe("CF-FLUID");
  });

  it("정상 경로 문장은 조용하다", () => {
    expect(checkCritical("제 손 잡고 같이 가실래요?").cf).toBe(false);
    expect(checkAdvisory("계약된 급여 범위에는 없습니다.")).toEqual([]);
  });
});

/** 응급이 끝난 보고 구간의 회고 진술 — 술기 규칙이 사실 기록을 벌하지 않게 한다. */
describe("보고 구간 국면 게이트 (술기 규칙)", () => {
  const opts = { scenarioType: "EMERGENCY" } as const;

  it("구급대가 한 일을 적은 문장은 잡지 않는다", () => {
    expect(checkCritical("구급대원이 흡인기를 사용했습니다.", { ...opts, cueId: "CUE-5" }).cf).toBe(false);
  });

  it("응급 진행 중이면 같은 낱말도 그대로 멈춰 세운다", () => {
    const hit = checkCritical("흡인기를 대 보겠습니다.", { ...opts, cueId: "CUE-3" });
    expect(hit.cf).toBe(true);
    expect(hit.ruleId).toBe("CF-SUCTION");
  });
});

/**
 * 게이트 CUE의 반쪽 — 좁힌 사전이 놓치는 자리를 시나리오 ⚑CF 분기가 받는다.
 *
 * C02 CUE-C1은 보호자가 방금 억제를 요구한 자리라, 목적어 없는 대용어 순응("그렇게 하겠습니다")
 * ·양보 순응("허용되지 않지만 오늘은 하겠습니다")이 억제 말고 가리킬 것이 없다. 전역 사전은
 * 이 말을 가릴 수 없지만(보고 구간에서는 정상 발화다) 이 CUE의 분기는 가릴 수 있다.
 * 게이트와 분기를 같은 자리에서 함께 보지 않으면, 한쪽을 손볼 때 반대쪽이 조용히 열린다.
 */
describe("C02 억제 요구 자리(CUE-C1)의 ⚑CF 분기", () => {
  function cueOf(scenarioId: string, turnId: string): CueDef {
    const cue = getScenario(scenarioId)?.turns.find((t) => t.id === turnId)?.cue;
    if (!cue) throw new Error(`${scenarioId} ${turnId} 에 CUE가 없습니다`);
    return cue;
  }
  const c1 = cueOf("CHK-C02", "T-C1");
  const c3 = cueOf("CHK-C02", "T-C3");

  const ACCEPT = [
    "보호자님 말씀대로 그렇게 하겠습니다.",
    "결박은 허용되지 않지만 오늘은 하겠습니다.",
    "억제대는 금지입니다. 채우겠습니다.",
    "결박은 보호자분 요구라 해도 저희 지침상 따를 수 없는 것이지만, 오늘 밤만 하겠습니다.",
    "말씀대로 밤에는 방문을 잠가 두겠습니다.",
    // 2라운드 레드팀이 이 자리에서 뚫은 대용어 — 절차 어휘·요구자 주어·지시 인용.
    "네, 그건 제가 조치하겠습니다.",
    "원하시는 대로 해 드리겠습니다.",
    "말씀하신 대로 하겠습니다.",
    "뜻에 따르겠습니다.",
    "붙잡으라는 지시대로 하겠습니다.",
    "묶어 두라는 원장님 지시대로 진행하겠습니다.",
    // 억제 도구를 다른 이름으로 부른 꼴 — 좁힌 사전이 받는다.
    "안전벨트로 침대에 고정하겠습니다.",
    "손모아장갑을 끼워 두겠습니다.",
    "조끼형 보호구를 입혀 두겠습니다.",
  ];

  for (const utterance of ACCEPT) {
    it(`${utterance} — K-c(⚑CF)로 받는다`, () => {
      expect(classifyInput(c1, { utterance }).branch.id).toBe("K-c");
    });
  }

  /**
   * 선의의 접두어 공격 — "알겠습니다" 뒤에 거절이 오는 문장을 순응으로 읽으면,
   * 예의 바르게 거절한 사람이 ⚑CF를 맞는다. 홑 "알겠습니다"를 대용어 목록에 넣지 않고,
   * 「해 드리겠」·「해 드릴게」를 **부정을 동반하지 않은 꼴로만** 담아 가른다.
   * 모호한 발화의 올바른 처리는 ⚑CF가 아니라 K-n(중립 미분류)의 재질문이다.
   */
  const REFUSE = [
    "결박은 제가 해 드릴 수 없습니다.",
    "묶어 두라는 요구는 받아들이지 않겠습니다.",
    "결박은 기관 지침상 허용되지 않습니다.",
    "억제대는 사용이 금지되어 있습니다.",
    "오늘 있었던 일을 그대로 보고드리겠습니다.",
    "알겠습니다, 하지만 그건 해 드릴 수 없습니다.",
    "말씀은 알겠지만 해 드릴 수 없습니다.",
    "무슨 말씀이신지 알겠습니다.",
    "대신 야간 등을 켜 드리겠습니다.",
  ];

  for (const utterance of REFUSE) {
    it(`${utterance} — ⚑CF 분기로 가지 않는다`, () => {
      const branch = classifyInput(c1, { utterance }).branch;
      expect(branch.criticalFail ?? false, branch.id).toBe(false);
    });
  }

  /**
   * 거절 세 갈래 — 근거를 든 거절(K-a 칭찬) / 근거 없는 거절(K-b 부분 인정 + 코칭) /
   * 순응(K-c ⚑CF). 홑 「할 수 없습니다」를 K-a에 두었더니
   * "지금은 붙잡는 것 말고 달리 할 수 없습니다"가 **근거를 든 거절로 칭찬받았다**(2라운드 실측).
   * 칭찬을 내는 분기는 「거절했다」만으로 열려서는 안 된다.
   *
   * 그 문장은 2라운드에 K-b(근거 없는 거절)로 옮겨 두었는데, 그것도 틀린 자리였다 —
   * 「붙잡는 것 말고 달리 할 수 없다」는 거절이 아니라 **하겠다는 체념**이다.
   * 3라운드에 「것 말고」를 부정 취소어로 지우면서 제자리(K-c ⚑CF)로 왔다.
   */
  const THREE_WAY: [string, string][] = [
    ["K-a", "묶거나 방문을 잠그는 것은 법으로 금지된 신체 자유 제한이라 해 드릴 수 없습니다."],
    ["K-a", "노인복지법상 금지된 행위라 해 드릴 수 없습니다."],
    ["K-a", "결박은 기관 지침상 허용되지 않습니다."],
    ["K-a", "대신 야간 등을 켜 두고 침대 주변을 함께 정리해 보겠습니다."],
    ["K-b", "결박은 제가 해 드릴 수 없습니다."],
    ["K-b", "묶어 두라는 요구는 받아들이지 않겠습니다."],
    ["K-c", "지금은 붙잡는 것 말고 달리 할 수 없습니다."],
    ["K-b", "결박은 못 합니다."],
    ["K-n", "오늘 있었던 일을 그대로 보고드리겠습니다."],
  ];

  for (const [expected, utterance] of THREE_WAY) {
    it(`${utterance} — ${expected}`, () => {
      expect(classifyInput(c1, { utterance }).branch.id).toBe(expected);
    });
  }

  it("재진술 자리(CUE-C3)에도 수용을 받는 ⚑CF 분기가 있다", () => {
    expect(classifyInput(c3, { utterance: "네, 그럼 오늘 밤부터 방문을 잠가 두겠습니다." }).branch.id).toBe("J-d");
    expect(classifyInput(c3, { utterance: "안전벨트로 침대에 고정하겠습니다." }).branch.id).toBe("J-d");
    // 「그대로 다시 말씀드리겠습니다」는 이 자리의 **모범 답안**이라 대용어 순응을 넣지 않았다.
    const model = classifyInput(c3, { utterance: "네, 같은 말씀을 그대로 다시 드리겠습니다." }).branch;
    expect(model.criticalFail ?? false).toBe(false);
  });
});

/**
 * 분류기의 부정 처리 — 하지 않겠다고 말한 행동으로 분류하면, 옳게 답한 사람이 감점을 받는다.
 * 다만 「아무것도 하지 않겠습니다」처럼 **부정 자체가 잘못인** 분기는 그대로 남아야 한다.
 */
describe("분류기 — 직접 부정만 건너뛴다", () => {
  function cueOf(scenarioId: string, turnId: string): CueDef {
    const cue = getScenario(scenarioId)?.turns.find((t) => t.id === turnId)?.cue;
    if (!cue) throw new Error(`${scenarioId} ${turnId} 에 CUE가 없습니다`);
    return cue;
  }

  it("「등을 두드리지 않겠습니다」는 등 두드림 분기로 가지 않는다", () => {
    const cue = cueOf("CHK-B02", "T1");
    expect(classifyInput(cue, { utterance: "등을 두드리지 않겠습니다" }).branch.id).not.toBe("D1-f");
    expect(classifyInput(cue, { utterance: "등을 세게 두드리겠습니다" }).branch.id).toBe("D1-f");
  });

  it("부정이 잘못인 분기는 그대로 남는다 (새 동사가 끼면 부정이 향하는 곳이 다르다)", () => {
    const cue = cueOf("CHK-A02", "T-N1");
    expect(classifyInput(cue, { utterance: "아무것도 하지 않고 지켜봅니다" }).branch.id).toBe("NA-d");
  });
});

/**
 * 3라운드 레드팀이 표지 뒤에 실행을 붙여 뚫은 자리 — 「돌아보는 표지」의 취소어.
 *
 * "붙잡고 싶은 마음이 들었지만 하지 않았습니다"는 성찰이고 "가두고 싶은 마음이 커서
 * 오늘부터 그렇게 합니다"는 선언인데, 표지까지 똑같이 생겼다. 가르는 것은 표지 **뒤**뿐이다.
 * 표지를 좁히면 성찰이 다시 막히므로(오탐), 표지는 그대로 두고 뒤를 읽는다.
 * 취소어가 그 자리에서 다시 부정되거나 앞 문장에서 이미 결론이 났으면 표지가 살아 있다.
 */
describe("돌아보는 표지 — 뒤에 실행이 붙으면 뒤집힌다", () => {
  const ATTACK = [
    "가두고 싶은 마음이 커서 오늘부터 그렇게 합니다.",
    "묶어 두고 싶은 만큼만 그리 합니다.",
    "붙잡고 싶은 대로 오늘도 그리 하겠습니다.",
    "잠그고 싶은 시간에 그냥 그리 합니다.",
    "묶고 싶다 해서 실제로 그리 했습니다.",
    "붙잡기보다 확실한 게 없어서 그리 했습니다.",
    "가두기보다 나은 수가 없어 그대로 갑니다.",
    "잠글지 여부는 이미 정했고 오늘 밤부터입니다.",
    "묶을지 여부는 제가 알아서 하겠습니다.",
    "가두는지 확인만 하고 그대로 둡니다.",
    "문 잠금 여부는 제가 판단해서 그리 합니다.",
    "억제대 채우겠다는 요구를 받으면 따르겠습니다.",
    "묶어 두겠다는 요구가 있었고 제가 그리 합니다.",
    "가둬 두겠다는 요구를 받으면 그대로 갑니다.",
    "잠가 두겠다는 요구가 있으면 그리 처리합니다.",
    "묶어 달라는 요구를 받으면 그대로 해 드리겠습니다.",
    "붙잡으려던 대로 오늘도 그리 합니다.",
    "가두려던 대로 진행합니다.",
    "억제대 착용 여부는 오늘부터 적용합니다.",
    "억제대를 채우려던 계획을 오늘 실행합니다.",
  ];

  for (const utterance of ATTACK) {
    it(`${utterance} — 표지가 무효가 되어 그대로 멈춰 세운다`, () => {
      expect(checkCritical(utterance).ruleId, utterance).toBe("CF-RESTRAINT");
    });
  }

  const REFLECT = [
    "붙잡고 싶은 마음이 들었지만 하지 않았습니다.",
    "붙잡고 싶은 마음이 들었지만 그렇게 하지 않았습니다.",
    "붙잡고 싶은 마음이 들었지만 하지 않았습니다. 오늘부터 야간 등을 켜 두겠습니다.",
    "붙잡기보다 옆에서 같이 걷겠습니다.",
    "문 잠금 여부를 먼저 살피겠습니다.",
    "문 잠금 상태를 점검하겠습니다.",
    "잠금장치가 걸려 있는지 보겠습니다.",
    "누가 붙잡았는지 여쭙겠습니다.",
    "결박 요구를 받으면 즉시 센터에 보고하겠습니다.",
    "붙잡으려던 순간을 멈춘 것이 오늘의 개선점입니다.",
    "붙잡으려던 대로 하지 않았습니다.",
  ];

  for (const utterance of REFLECT) {
    it(`${utterance} — 성찰·확인은 그대로 통과한다`, () => {
      expect(checkCritical(utterance).cf, utterance).toBe(false);
      expect(checkAdvisory(utterance), utterance).toEqual([]);
    });
  }

  it("취소어 목록을 넓힐 때의 경계 — 홑 「하겠습니다」는 취소어가 아니다", () => {
    // 넓히면 성찰 문형이 통째로 다시 막힌다. 이 두 문장이 그 경계를 지킨다.
    expect(checkCritical("붙잡고 싶은 마음이 들었지만 다른 방법을 찾아보겠습니다.").cf).toBe(false);
    expect(checkCritical("결박 요구를 받으면 센터에 보고하고 기록하겠습니다.").cf).toBe(false);
  });
});

/**
 * 「A 말고 달리 방법이 없다」 — 1라운드부터 남아 있던 체념형 순응.
 *
 * 대체 행동을 가리키는 「~하지 말고」와 겉모습이 같아 지우지 못하던 자리다. 보조사가 붙은
 * 「말고는」만 지워 두었더니, 조사 없는 꼴이 그대로 열려 있었다. 의존명사 「것/거」가
 * 앞에 서는지로 가른다 — "붙잡는 **것** 말고"는 A를 하겠다는 말이고, "붙잡**지** 말고"는 아니다.
 */
describe("「것 말고」 체념형", () => {
  const CAUGHT = [
    "지금은 붙잡는 것 말고 달리 할 수 없습니다.",
    "붙잡는 것 말고 달리 방법이 없습니다.",
    "가두는 것 말고 다른 수가 없습니다.",
    "묶는 것 말고 달리 수가 없습니다.",
    "묶어 두는 수밖에는 없습니다.",
  ];

  for (const utterance of CAUGHT) {
    it(`${utterance} — 하겠다는 체념이므로 멈춰 세운다`, () => {
      expect(checkCritical(utterance).ruleId, utterance).toBe("CF-RESTRAINT");
    });
  }

  const PASS = [
    "붙잡지 말고 기다리세요.",
    "밀치지 말고 손을 잡아 드리겠습니다.",
    "묶어 둘 수는 없습니다.",
    "억제대는 저희 기관에 없습니다.",
    "문을 잠글 권한이 없습니다.",
  ];

  for (const utterance of PASS) {
    it(`${utterance} — 거절·부재 진술은 통과한다`, () => {
      expect(checkCritical(utterance).cf, utterance).toBe(false);
    });
  }

  it("「없」을 넓힌 값 — 행위를 정당화하는 말은 그대로 잡는다", () => {
    expect(checkCritical("묶어도 지장은 없습니다.").ruleId).toBe("CF-RESTRAINT");
    expect(checkCritical("붙잡아 두면 사고가 없습니다.").ruleId).toBe("CF-RESTRAINT");
  });
});

/**
 * 보고·성찰 CUE(C02 CUE-C4·CUE-C6) — **전면 오프에서 좁히기로** 바꾼 자리.
 *
 * 규칙을 통째로 끄면 회고 진술은 지켜지지만 자리 전체가 빈다. 그 자리에서
 * "다음엔 그냥 붙잡아야겠어요"는 아무 되먹임 없이 통과했고, 같은 문장이 문맥 없는 전역에서는
 * ⚑CF였다 — 문맥이 많을수록 관대한 뒤집힌 판정선이다. 지금은 순응 문형만 본다.
 */
describe("보고·성찰 게이트는 끄지 않고 좁힌다 (CUE-C4·CUE-C6)", () => {
  const C4: RuleCheckOptions = { scenarioType: "CONFLICT", cueId: "CUE-C4" };
  const C6: RuleCheckOptions = { scenarioType: "CONFLICT", cueId: "CUE-C6" };

  const PASS: [string, RuleCheckOptions][] = [
    [
      "밤에 침대에 묶어두거나 방문을 잠가 달라는 요구가 있어 법으로 허용되지 않는다고 말씀드렸습니다.",
      C4,
    ],
    ["묶어 두거나 방문을 잠가 달라는 요구가 있었고, 저는 안 된다고 말씀드렸습니다.", C4],
    ["보호자께서 묶어두라고 하셨습니다.", C4],
    ["방문을 잠그라는 요구를 받았다는 사실도 그대로 적겠습니다.", C4],
    ["다음엔 부인하기 전에 확인된 사실과 확인되지 않은 것을 먼저 나눠 말씀드리겠습니다.", C6],
    ["붙잡고 싶은 마음이 들었지만 하지 않았습니다.", C6],
  ];

  for (const [utterance, opts] of PASS) {
    it(`${opts.cueId} · ${utterance} — 회고 진술은 통과한다`, () => {
      expect(checkCritical(utterance, opts).cf, utterance).toBe(false);
    });
  }

  const CAUGHT: [string, RuleCheckOptions][] = [
    ["다음엔 그냥 붙잡아야겠어요.", C6],
    ["다음부터는 붙잡을 겁니다.", C6],
    ["앞으로는 억제대를 채웁니다.", C4],
    ["다음엔 결박해야겠습니다.", C6],
    ["다음엔 자물쇠를 답니다.", C6],
    ["다음엔 끌고 들어옵니다.", C6],
    ["다음엔 손목을 잡고 있겠습니다.", C6],
    ["다음엔 가둬 놓습니다.", C6],
    ["다음엔 방문을 잠급니다.", C6],
    ["다음엔 침대에 묶습니다.", C6],
    ["다음엔 어르신을 가둡니다.", C6],
    ["다음엔 안전벨트로 고정하겠습니다.", C6],
    ["다음엔 손모아장갑을 끼워 두겠습니다.", C6],
    ["다음엔 조끼형 보호구를 입혀 두겠습니다.", C6],
    ["다음엔 난간을 다 올려 두겠습니다.", C6],
    ["다음엔 못 나오시게 하겠습니다.", C6],
    ["앞으로는 묶어 둘 겁니다.", C4],
    ["앞으로는 가두기로 했습니다.", C4],
    ["앞으로는 잠그는 걸로 하겠습니다.", C4],
    ["다음엔 몸으로 막겠습니다.", C4],
    ["다음엔 밀치겠습니다.", C4],
  ];

  for (const [utterance, opts] of CAUGHT) {
    it(`${opts.cueId} · ${utterance} — 앞으로의 행위 선언은 멈춰 세운다`, () => {
      expect(checkCritical(utterance, opts).ruleId, utterance).toBe("CF-RESTRAINT");
    });
  }

  it("이 사전에는 전면 오프(skipCues)가 남아 있지 않다", () => {
    expect(getRule("CF-RESTRAINT")?.skipCues).toBeUndefined();
    expect(getRule("CF-RESTRAINT")?.complyOnlyCues).toEqual([
      "CUE-C1",
      "CUE-C3",
      "CUE-C4",
      "CUE-C6",
    ]);
  });

  /**
   * 좁히기가 치르는 값 — 남의 선언을 그대로 옮겨 적는 인용은 순응 문형과 겉모습이 같다.
   * 모범 보고문은 요구를 「~달라는 요구가 있었고」로 적으므로 통과하지만, 상대의 말을
   * 어미째 옮기면 이 자리에서 걸린다. 문서화된 한계다.
   */
  it("남의 선언을 어미째 옮긴 인용은 이 자리에서 걸린다 (문서화된 한계)", () => {
    expect(checkCritical("보호자께서 묶어 두겠다고 하셨습니다.", C4).cf).toBe(true);
  });
});

/**
 * 응급 종료 게이트 — **규칙마다 다르게** 쓴다.
 * 술기·기구 5종은 좁히고, 상황 의존 4종은 전면 오프를 유지한다.
 * 가르는 기준은 「그 자리에서 그 말이 정답일 수 있는가」다.
 */
describe("응급 종료 게이트 — 술기는 좁히고 상황 의존은 끈다", () => {
  const E = (cueId: string): RuleCheckOptions => ({ scenarioType: "EMERGENCY", cueId });

  const CAUGHT: [string, string, string][] = [
    ["앞으로는 제가 석션하겠습니다.", "CUE-6", "CF-SUCTION"],
    ["다음엔 제가 흡인하겠습니다.", "CUE-5", "CF-SUCTION"],
    ["다음엔 손가락 넣어서 빼내겠습니다.", "CUE-7", "CF-ORAL"],
    ["다음엔 입에 손을 넣어 빼겠습니다.", "CUE-6", "CF-ORAL"],
    ["다음엔 이물을 빼겠습니다.", "CUE-5", "CF-FOREIGN-BODY"],
    ["다음엔 배를 눌러 빼겠습니다.", "CUE-6", "CF-ABDOMINAL"],
    ["다음엔 인공호흡을 하겠습니다.", "CUE-6", "CF-RESCUE-BREATH"],
  ];

  for (const [utterance, cueId, ruleId] of CAUGHT) {
    it(`${cueId} · ${utterance} — ${ruleId}`, () => {
      expect(checkCritical(utterance, E(cueId)).ruleId, utterance).toBe(ruleId);
    });
  }

  const PASS: [string, string][] = [
    ["구급대원이 흡인기를 사용했습니다.", "CUE-5"],
    ["119 상황실이 지도한 대로 따랐다고 기록하겠습니다.", "CUE-6"],
    ["구급대원이 이물을 빼냈다고 들었습니다.", "CUE-5"],
    ["흡인이 필요한지 간호사님께 여쭤보겠습니다.", "CUE-6"],
    // 상황 의존 4종 — 이 자리에서는 그 말이 **정답**이라 문자열로 가를 수 없다.
    ["다음엔 식사 중 물을 조금씩 드리겠습니다.", "CUE-7"],
    ["다음엔 음식을 잘게 잘라 드리겠습니다.", "CUE-6"],
    ["다음엔 자리에 눕히지 않고 앉은 자세를 유지하겠습니다.", "CUE-5"],
  ];

  for (const [utterance, cueId] of PASS) {
    it(`${cueId} · ${utterance} — 통과한다`, () => {
      expect(checkCritical(utterance, E(cueId)).cf, utterance).toBe(false);
    });
  }

  it("게이트 밖(실시간 구간)에서는 상황 의존 4종이 그대로 산다", () => {
    expect(checkCritical("물 좀 드세요.", E("CUE-1")).ruleId).toBe("CF-FLUID");
    expect(checkCritical("떡을 드셔 보세요.", E("CUE-2")).ruleId).toBe("CF-FOOD");
    expect(checkCritical("바닥에 눕히겠습니다.", E("CUE-3")).ruleId).toBe("CF-LIE-DOWN");
    expect(checkCritical("그냥 삼키세요.", E("CUE-2")).ruleId).toBe("CF-SWALLOW");
  });
});

/**
 * 게이트 관대함 역전 — 전역이 잡는 문장을 **좁힌 자리가 놓치던** 자리.
 *
 * 좁힌 사전은 언제나 전역보다 좁다(그게 좁히기의 뜻이다). 문제는 좁힌 사전이 「~겠」이라는
 * **의지 어미 하나에만** 기대고 있었다는 것이다. 같은 뜻을 평서("침대에 묶습니다")·
 * 결정("가두기로 했습니다")·유지("억제대는 그대로")·체념("붙잡을 도리밖에 없습니다")·
 * 사동(사투리 「몬 나가게」)으로 말하면 게이트 안이 게이트 밖보다 관대했다.
 * 3라운드 레드팀이 이 자리로 24문형을 뚫었다. 문형째 고정해 둔다.
 */
describe("게이트 관대함 역전 — 좁힌 자리도 실행 선언은 잡는다", () => {
  const REVERSAL = [
    "다음엔 그냥 붙잡아야겠어요.",
    "다음부터는 붙잡을 겁니다.",
    "앞으로는 억제대를 채웁니다.",
    "다음엔 결박해야겠습니다.",
    "다음엔 자물쇠를 답니다.",
    "다음엔 끌고 들어옵니다.",
    "다음엔 가둬 놓습니다.",
    "다음엔 방문을 잠급니다.",
    "다음엔 침대에 묶습니다.",
    "다음엔 어르신을 가둡니다.",
    "앞으로는 묶어 둘 겁니다.",
    "앞으로는 가두기로 했습니다.",
    "앞으로는 잠그는 걸로 하겠습니다.",
    "붙잡아 둡니다.",
    "중문을 잠그겠습니다.",
    "창문은 잠그고 나오겠습니다.",
    "방은 잠그는 게 낫겠습니다.",
    "출입문 잠그는 건 제가 하겠습니다.",
    "붙잡고 못 가시게 하겠습니다.",
    "묶어 두고 몬 움직이게 하겠습니더.",
    "붙잡아뿌서 몬 나가게 하겠심더.",
    "묶어 둘 수밖에 없습니다.",
    "붙잡을 도리밖에 없습니다.",
    "가둬 둘 방법밖에 남지 않았습니다.",
  ];

  for (const utterance of REVERSAL) {
    it(`${utterance} — C1·C3에서도 그대로 멈춰 세운다`, () => {
      expect(checkCritical(utterance).ruleId, `전역 ${utterance}`).toBe("CF-RESTRAINT");
      expect(
        checkCritical(utterance, { scenarioType: "CONFLICT", cueId: "CUE-C1" }).ruleId,
        `C1 ${utterance}`,
      ).toBe("CF-RESTRAINT");
      expect(
        checkCritical(utterance, { scenarioType: "CONFLICT", cueId: "CUE-C3" }).ruleId,
        `C3 ${utterance}`,
      ).toBe("CF-RESTRAINT");
    });
  }

  it("재진술 자리(CUE-C3)도 대용어 순응을 받는다 — C1과 같은 판정선", () => {
    function cueOf(scenarioId: string, turnId: string): CueDef {
      const cue = getScenario(scenarioId)?.turns.find((t) => t.id === turnId)?.cue;
      if (!cue) throw new Error(`${scenarioId} ${turnId} 에 CUE가 없습니다`);
      return cue;
    }
    const c3 = cueOf("CHK-C02", "T-C3");
    for (const utterance of [
      "보호자님 말씀대로 그렇게 할게요.",
      "알겠습니다. 그렇게 하겠습니다.",
      "말씀하신 지시에 맞춰 진행하겠습니다.",
    ]) {
      expect(classifyInput(c3, { utterance }).branch.id, utterance).toBe("J-d");
    }
    // 이 자리의 모범 답안은 그대로 통과해야 한다.
    const model = classifyInput(c3, { utterance: "네, 같은 말씀을 그대로 다시 드리겠습니다." }).branch;
    expect(model.criticalFail ?? false).toBe(false);
  });
});

/* ── 분류기 채택 규칙 · 한글 수사 시각 (2026-08-25 페르소나 검증 반영) ──────── */

describe("분류기 — 여러 분기에 걸린 발화", () => {
  function cueOf(scenarioId: string, turnId: string): CueDef {
    const cue = getScenario(scenarioId)?.turns.find((t) => t.id === turnId)?.cue;
    if (!cue) throw new Error(`${scenarioId} ${turnId} 에 CUE가 없습니다`);
    return cue;
  }

  it("공감을 앞에 붙여도 뒤의 사실 반박이 이긴다 (감점 우선)", () => {
    const cue = cueOf("CHK-A01", "T1");
    expect(
      classifyInput(cue, { utterance: "마음이 급하신 건 알지만, 여기가 어머님 댁이에요" }).branch.id,
    ).toBe("D1-a");
    // 반박이 없는 공감 단독은 그대로 충족 분기다.
    expect(
      classifyInput(cue, { utterance: "애기 밥 챙겨주셔야 하는구나, 마음이 급하시겠어요" }).branch.id,
    ).toBe("D1-c");
  });

  it("넓은 조각에 겹쳐 걸린 논리적 설득이 환경 확인을 이긴다", () => {
    const cue = cueOf("CHK-A01", "T2");
    expect(classifyInput(cue, { utterance: "불이 어두워서 안 돼요" }).branch.id).toBe("D2-d");
    expect(
      classifyInput(cue, { utterance: "불이 어두워서 밖 같으신가 봐요, 거실 불 켜드릴게요" }).branch.id,
    ).toBe("D2-b");
  });

  it("못 갖춘 것으로 내리는 감점은 충족 분기를 끌어내리지 않는다", () => {
    // 5요소를 다 담은 보고문에 「나가시려고」(R1-b 표지)가 섞여 있어도 R1-a로 남는다.
    const cue = cueOf("CHK-A01", "T4");
    expect(
      classifyInput(cue, {
        utterance:
          "16시 40분에 어머님이 현관에서 나가시려고 하셔서, 화장실 안내 후 젖은 옷을 갈아입으시도록 도왔습니다.",
      }).branch.id,
    ).toBe("R1-a");
    // 요소가 빠진 보고는 그대로 부분 보고다.
    expect(
      classifyInput(cue, { utterance: "어르신이 나가시려고 하셔서 말씀드려 진정시켰습니다" }).branch.id,
    ).toBe("R1-b");
  });
});

/* ── 빈 조각 표지 제거 (2026-08-25 배치 A-2) ─────────────────────────
   조각 하나가 충족 판정을 만들던 자리를 걷어냈다. 걷어낸 뒤에는 **중립 미분류**로
   떨어져야 한다 — 감점이 아니라 다시 말할 기회다. */

describe("분류기 — 조각 하나로는 충족이 되지 않는다", () => {
  function cueOf(scenarioId: string, turnId: string): CueDef {
    const cue = getScenario(scenarioId)?.turns.find((t) => t.id === turnId)?.cue;
    if (!cue) throw new Error(`${scenarioId} ${turnId} 에 CUE가 없습니다`);
    return cue;
  }

  it("A01 CUE-1 — 「얼마나」·「마음이」만으로는 감정 인정이 아니다", () => {
    const cue = cueOf("CHK-A01", "T1");
    expect(classifyInput(cue, { utterance: "얼마나 걸릴까요?" }).branch.id).toBe("D1-n");
    expect(classifyInput(cue, { utterance: "제 마음이 좀 급하네요" }).branch.id).toBe("D1-n");
    // 실제로 마음을 알아드린 문장은 그대로 충족이다.
    expect(
      classifyInput(cue, { utterance: "마음이 급하시겠어요" }).branch.id,
    ).toBe("D1-c");
  });

  it("A02 CUE-1도 같은 기준이다", () => {
    const cue = cueOf("CHK-A02", "T1");
    expect(classifyInput(cue, { utterance: "제 마음이 좀 급하네요" }).branch.id).toBe("D1-n");
    expect(
      classifyInput(cue, { utterance: "차 나가야 한다는 생각에 마음이 급하시겠어요" }).branch.id,
    ).toBe("D1-c");
  });

  it("A01 CUE-2 — 접속어 「아니면」은 선택권 제공이 아니다", () => {
    const cue = cueOf("CHK-A01", "T2");
    expect(classifyInput(cue, { utterance: "아니면 그냥 계세요" }).branch.id).toBe("D2-n");
    expect(
      classifyInput(cue, {
        utterance: "지금 바로 나가실래요, 아니면 따뜻한 물 한 잔 드시고 같이 나가볼까요?",
      }).branch.id,
    ).toBe("D2-c");
  });

  it("A01 CUE-4 — 보고 종결어만으로는 5요소 보고가 아니다", () => {
    const cue = cueOf("CHK-A01", "T4");
    expect(classifyInput(cue, { utterance: "보고드리겠습니다" }).branch.id).toBe("R1-n");
  });
});

/* ── 보고 CUE의 요소 개수 판정 (2026-08-25 배치 A-3) ───────────────── */

describe("분류기 — 보고는 담긴 요소 개수로 갈린다", () => {
  function reportCue(): CueDef {
    const cue = getScenario("CHK-A01")?.turns.find((t) => t.id === "T4")?.cue;
    if (!cue) throw new Error("CHK-A01 T4 에 CUE가 없습니다");
    return cue;
  }

  it("3가지 이상 담기면 5요소 보고다", () => {
    const result = classifyInput(reportCue(), {
      utterance:
        "16시 40분에 어머님이 현관에서 귀가를 요구하셔서 화장실로 안내드렸고, 지금은 소파에 앉아 계십니다",
    });
    expect(result.branch.id).toBe("R1-a");
    expect(result.source).toBe("pattern");
    expect(result.matchedElements).toContain("시각");
    expect(result.matchedElements).toContain("현재 상태");
    expect(result.matchedPattern).toContain("요소");
  });

  it("한 가지만 담기면 부분 보고다 — 요소 판정이 심각도보다 앞이다", () => {
    const result = classifyInput(reportCue(), { utterance: "16시였는데 정말 힘들었습니다" });
    expect(result.branch.id).toBe("R1-b");
    expect(result.matchedElements).toEqual(["시각"]);
  });

  it("한 가지도 담기지 않으면 심각도 매칭으로 넘어간다", () => {
    const cue = reportCue();
    expect(classifyInput(cue, { utterance: "별일 아니라서 보고 안 하겠습니다" }).branch.id).toBe(
      "R1-d",
    );
    expect(
      classifyInput(cue, { utterance: "고집이 세셔서 정말 힘들었습니다" }).branch.id,
    ).toBe("R1-c");
  });

  it("한글 수사로 말한 시각도 요소로 센다", () => {
    const result = classifyInput(reportCue(), {
      utterance:
        "네 시 사십 분에 어머님이 현관에서 귀가를 요구하셨고, 지금은 소파에 앉아 계십니다",
    });
    expect(result.branch.id).toBe("R1-a");
    expect(result.matchedElements).toContain("시각");
  });
});

describe("한글 수사 시각", () => {
  function cueOf(scenarioId: string, turnId: string): CueDef {
    const cue = getScenario(scenarioId)?.turns.find((t) => t.id === turnId)?.cue;
    if (!cue) throw new Error(`${scenarioId} ${turnId} 에 CUE가 없습니다`);
    return cue;
  }

  it("시각을 한글로 말한 보고도 5요소 보고로 받는다", () => {
    expect(
      classifyInput(cueOf("CHK-A01", "T4"), {
        utterance:
          "네 시 사십 분쯤에 어머님이 현관에서 나가시려고 하셔서, 화장실 안내해 드리고 젖은 옷 갈아입으시게 도와드렸습니다. 지금은 소파에 앉아 계세요",
      }).branch.id,
    ).toBe("R1-a");
  });

  it("표지가 한글로 적힌 자리는 숫자로 말해도 만난다", () => {
    const cue = cueOf("CHK-A02", "T1");
    expect(classifyInput(cue, { utterance: "새벽 두 시인데 어디 가시려고요?" }).branch.id).toBe("D1-a");
    expect(classifyInput(cue, { utterance: "새벽 2시인데 어디 가시려고요?" }).branch.id).toBe("D1-a");
  });

  it("수사가 낱말의 일부인 자리는 건드리지 않는다", () => {
    expect(expandKoreanTimeNumerals("한시름 놓았습니다")).toBe("한시름 놓았습니다");
    expect(expandKoreanTimeNumerals("이분이 저희 어머님입니다")).toBe("이분이 저희 어머님입니다");
    expect(expandKoreanTimeNumerals("이 분이 저희 어머님입니다")).toBe("이 분이 저희 어머님입니다");
    expect(expandKoreanTimeNumerals("네 시 사십 분")).toBe("4시 40분");
    expect(expandKoreanTimeNumerals("열두 시 이십오 분")).toBe("12시 25분");
  });
});
