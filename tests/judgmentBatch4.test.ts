/**
 * 4차 개선 배치 1 — 판정·시나리오 (2026-08-26).
 *
 * 현직 요양보호사·교육생 3차 검증에서 나온 결함을 **자리째** 못 박는다.
 * 고쳤다는 말이 아니라 다시 무너지지 않게 하는 것이 이 파일의 목적이라,
 * 각 describe 머리에 「무엇이 어떻게 무너져 있었는가」를 함께 적는다.
 *
 *  ⑫ ⚑CF 억제 분기의 「이끌」 구멍 (현직 med)
 *  ⑬ CUE-T2 센터 보고 갈래의 현장 호칭 (현직 med)
 *  ⑭ 남은 조각 표지 청소 (교육생 med)
 *  ⑮ 보고 틀말 한 마디로는 최고 갈래가 열리지 않는다 (교육생 high)
 *  ⑯ 미분류 체류 원칙과 그 예외 (현직 med · 교육생 med)
 *  ⑰ 두 자리의 「갈래」 셈법이 같은 집합을 센다 (교육생 low)
 *  ⑱ 흐름 목록의 분기 이름이 사용자 말로 나간다 (현직 low)
 */

import { describe, expect, it } from "vitest";
import type { CueDef, Scenario } from "@/types";
import { CHK_A01, CHK_A02, CHK_C02, SCENARIOS } from "@/data/scenarios";
import { RULE_BOUNDARY_CASES } from "@/data/ruleBoundaryCases";
import { classifyInput } from "@/engine/classify";
import { branchMessages, isSuggestableBranch } from "@/engine/branchScope";
import {
  checkCritical,
  RESTRAINT_EXCEPT_BRANCH,
  RESTRAINT_EXCEPT_INVITE,
  RESTRAINT_EXCEPT_TERMS,
} from "@/engine/rules";
import {
  advanceAfterCF,
  advanceAuto,
  cueOptions,
  currentTurn,
  startSession,
  submitResponse,
  type SubmitInput,
} from "@/engine/session";
import { BRANCH_LABEL_IN_WORDS } from "@/app/train/_components/constants";

/* ── 도우미 ────────────────────────────────────────────── */

function cueOf(s: Scenario, turnId: string): CueDef {
  const turn = s.turns.find((t) => t.id === turnId);
  if (!turn?.cue) throw new Error(`${s.id} ${turnId}: CUE가 없습니다`);
  return turn.cue;
}

function allCues(s: Scenario): { turnId: string; cue: CueDef }[] {
  return s.turns.flatMap((turn) => (turn.cue ? [{ turnId: turn.id, cue: turn.cue }] : []));
}

/** CUE가 없는 자동 진행 턴을 지나 다음 CUE까지 밀어 준다 — 화면과 같은 순서다. */
function step(s: Scenario, state: ReturnType<typeof startSession>, input: SubmitInput) {
  const result = submitResponse(s, state, input);
  let next = result.state;
  for (let guard = 0; guard < 8; guard += 1) {
    if (next.status !== "running") break;
    const turn = currentTurn(s, next);
    if (!turn || turn.cue) break;
    const advanced = advanceAuto(s, next);
    if (advanced === next) break;
    next = advanced;
  }
  return { ...result, state: next };
}

/* ── ⑫ ⚑CF 억제 분기의 「이끌」 구멍 ───────────────────────
   3차는 규칙 사전의 예외어 배열을 시나리오 ⚑CF 분기에 통째로 걸었고, 그 배열의 홑 낱말
   「이끌」이 앞뒤 6글자 창 안에서 「팔을 잡아」와 「끌고」를 **함께** 껐다.
   그래서 "제 팔을 잡아 끌고 가겠습니다"는 ⚑CF인데 한 음절 늘린 "…이끌고…"는 통과했다
   (규칙 사전·분기 양쪽 통과 · 현직 3차 실측).
   분기 쪽 예외어에서 그 낱말만 빼고, 억제 신호를 **잡는 말과 함께** 적어 다시 세운다. */

describe("⚑CF 억제 분기 — 「이끌」이 낀 실행 선언", () => {
  /** ⚑CF 억제 분기를 가진 자리 전부 (a01 4곳 · a02 2곳) */
  const 억제_자리 = [
    [CHK_A01, "T1"],
    [CHK_A01, "T-1"],
    [CHK_A01, "T-1B"],
    [CHK_A01, "T3"],
    [CHK_A02, "T1"],
    [CHK_A02, "T-N1"],
  ] as const;

  it("분기 예외어에는 「이끌」이 없고, 청유 꼴은 그대로 들어 있다", () => {
    expect(RESTRAINT_EXCEPT_BRANCH).not.toContain("이끌");
    // 규칙 사전 쪽 원본은 레드팀 검증본이라 값을 바꾸지 않았다.
    expect(RESTRAINT_EXCEPT_TERMS).toContain("이끌");
    // 좁은 핵(청유·동의 계열)은 분기 예외어에 통째로 살아 있다.
    expect(RESTRAINT_EXCEPT_INVITE.length).toBeGreaterThan(0);
    for (const term of RESTRAINT_EXCEPT_INVITE) {
      expect(RESTRAINT_EXCEPT_BRANCH, term).toContain(term);
      expect(RESTRAINT_EXCEPT_TERMS, term).toContain(term);
    }
    // 두 배열의 차이는 그 한 낱말뿐이다.
    expect(RESTRAINT_EXCEPT_BRANCH.length).toBe(RESTRAINT_EXCEPT_TERMS.length - 1);
  });

  it.each(억제_자리.map(([s, t]) => [`${s.id} ${t}`, s, t] as const))(
    "%s — 「팔을 잡아 이끌고」는 ⚑CF로 선다",
    (where, scenario, turnId) => {
      for (const utterance of [
        "제 팔을 잡아 이끌고 가겠습니다",
        "어머님 팔을 잡아 이끌고 나가겠습니다",
        "손을 붙잡고 이끌고 가겠습니다",
      ]) {
        const branch = classifyInput(cueOf(scenario, turnId), { utterance }).branch;
        expect(branch.criticalFail, `${where} "${utterance}"`).toBe(true);
      }
    },
  );

  it.each(억제_자리.map(([s, t]) => [`${s.id} ${t}`, s, t] as const))(
    "%s — 잡는 말이 없는 동행 유도는 그대로 통과한다",
    (where, scenario, turnId) => {
      // 레드팀 경계 케이스 bc-385가 통과로 못 박은 문장이다.
      const branch = classifyInput(cueOf(scenario, turnId), {
        utterance: "이끌고 나가겠습니다",
      }).branch;
      expect(branch.criticalFail ?? false, where).toBe(false);
    },
  );

  it("앱이 스스로 권하는 대안은 여섯 자리에서 그대로 통과한다 (3차 계약 유지)", () => {
    const 권하는_대안 = "어머님, 제 팔 붙잡으세요. 같이 나가요";
    for (const [scenario, turnId] of 억제_자리) {
      const branch = classifyInput(cueOf(scenario, turnId), { utterance: 권하는_대안 }).branch;
      expect(branch.criticalFail ?? false, `${scenario.id} ${turnId}`).toBe(false);
    }
  });

  it("레드팀이 「걸리면 안 된다」고 적어 둔 문장은 한 건도 ⚑CF가 되지 않는다", () => {
    // 예외어를 청유 꼴만 남기면 이 검사에서 35건이 새로 ⚑CF가 된다(실측) —
    // "휠체어를 밀어서 방으로 모시겠습니다"·"가스 밸브를 잠가 두겠습니다"·
    // "저희 시설에는 억제대가 없습니다" 같은 문장들이다.
    // 「이끌」 하나를 막으려고 옳게 말한 사람을 멈춰 세우지 않았음을 여기서 지킨다.
    /* bc-383·bc-384는 **규칙 사전의 한계**를 적어 둔 케이스라 뺀다 — 사전에서는 서지 않지만
       분기가 받아야 하는 문장이고, 그것이 이 배치가 세운 이중 안전망 그 자체다.
       두 판정선이 갈리는 방향은 「분기가 더 엄한 쪽」이며, 나머지 문장에서는 갈리지 않는다. */
    const 분기가_받는_한계 = new Set(["bc-383", "bc-384"]);
    const 통과해야_하는_문장 = RULE_BOUNDARY_CASES.filter(
      (c) => !c.cf && !분기가_받는_한계.has(c.id),
    ).map((c) => c.utterance);
    const 잡힌_문장: string[] = [];
    for (const [scenario, turnId] of 억제_자리) {
      const cue = cueOf(scenario, turnId);
      for (const utterance of 통과해야_하는_문장) {
        // 세션과 같은 순서다 — 규칙 사전이 먼저 보고, 통과한 것만 분기가 본다.
        const critical = checkCritical(utterance, {
          scenarioType: scenario.type,
          cueId: cue.id,
          appliedRubric: scenario.appliedRubric,
        });
        if (critical.cf) continue;
        if (classifyInput(cue, { utterance }).branch.criticalFail) {
          잡힌_문장.push(`${scenario.id} ${turnId} "${utterance}"`);
        }
      }
    }
    expect(잡힌_문장).toEqual([]);
  });

  it("홑 어간 「끌고」는 규칙 사전이 그대로 잡는다 (신호를 옮겼을 뿐 뚫리지 않았다)", () => {
    for (const utterance of ["어르신을 끌고 방으로 가겠습니다.", "일단 제가 끌고 들어갈게요."]) {
      expect(checkCritical(utterance, { scenarioType: "BPSD" }).cf, utterance).toBe(true);
    }
  });

  it("세션 경로에서 분기망이 잡는다 — 사전이 놓친 자리를 분기가 받는다", () => {
    const utterance = "어머님 팔을 잡아 이끌고 나가겠습니다";
    // 규칙 사전은 「이끌」 예외어 때문에 이 문장을 통과시킨다(bc-384가 그 한계를 적어 둔다).
    expect(checkCritical(utterance, { scenarioType: CHK_A01.type, cueId: "CUE-1" }).cf).toBe(false);

    const result = step(CHK_A01, startSession(CHK_A01), { utterance, viaButton: false });
    expect(result.interrupted).toBe(true);
    expect(result.feedback.criticalFail).toBe(true);
    // 분기가 잡은 것이어야 조문 고지와 대안 3개가 화면에 뜬다.
    expect(result.feedback.branchId).toBe("D1-b-CF");
    expect(result.feedback.trace?.source).toBe("criticalPattern");
    expect(result.state.cfCount).toBe(1);
    // 멈춰 세운 그 자리에서 다시 할 수 있다.
    expect(advanceAfterCF(CHK_A01, result.state).currentTurnId).toBe("T1");
  });
});

/* ── ⑬ CUE-T2 센터 보고 갈래의 현장 호칭 ─────────────────
   3차에 신설한 P-e의 신호가 「센터에·관리책임자·시설장」뿐이라, 재가·주간보호에서 실제로
   쓰는 「센터장님께」가 어느 신호에도 닿지 않았다(전 소스 grep 0건). 기관 규정대로 답한
   분이 미분류로 떨어졌다. 반대로 홑 「지시 받」은 너무 넓어 따님 지시까지 칭찬했다. */

describe("A01 CUE-T2 P-e — 현장에서 쓰는 호칭", () => {
  const cue = cueOf(CHK_A01, "T-2");

  it("센터장·팀장·소장·원장을 부르는 말이 모두 걸린다", () => {
    for (const utterance of [
      "센터장님께 먼저 말씀드리겠습니다",
      "팀장님한테 먼저 보고하겠습니다",
      "소장님께 먼저 알리겠습니다",
      "원장님께 먼저 알리겠습니다",
      "기관에 알리고 지시를 받겠습니다",
      "지금은 어머님 곁에 있어야 해서, 센터에 먼저 알리고 지시를 받겠습니다",
    ]) {
      expect(classifyInput(cue, { utterance }).branch.id, utterance).toBe("P-e");
    }
  });

  it("기관 낱말이 없는 「지시를 받겠다」는 센터 보고로 칭찬하지 않는다", () => {
    // 따님에게 지시를 받겠다는 말까지 「센터에 먼저 알리는 순서를 잡으셨습니다」로
    // 칭찬받던 자리다(현직 3차 실측).
    for (const utterance of ["따님 지시를 받겠습니다", "보호자 지시를 받고 움직이겠습니다"]) {
      expect(classifyInput(cue, { utterance }).branch.id, utterance).not.toBe("P-e");
    }
  });

  it("P-a는 그대로 P-a로 남는다 (같은 무게의 이웃 갈래를 삼키지 않는다)", () => {
    expect(
      classifyInput(cue, { utterance: "지금 어머님 곁에 있어야 해서, 5분 뒤에 제가 다시 걸겠습니다" })
        .branch.id,
    ).toBe("P-a");
  });

  it("새 호칭이 다른 자리에서 ⚑CF·감점으로 새지 않는다", () => {
    const 새_호칭 = [
      "센터장님께 알리겠습니다",
      "팀장님께 알리겠습니다",
      "소장님께 알리겠습니다",
      "원장님께 알리겠습니다",
    ];
    for (const scenario of SCENARIOS) {
      for (const { turnId, cue: each } of allCues(scenario)) {
        for (const utterance of 새_호칭) {
          const branch = classifyInput(each, { utterance }).branch;
          if (branch.id === "P-e") continue;
          const where = `${scenario.id} ${turnId} "${utterance}"`;
          expect(branch.criticalFail ?? false, where).toBe(false);
          expect(branch.gaugeDelta, where).toBeLessThanOrEqual(0);
        }
      }
    }
  });
});

/* ── ⑭ 남은 조각 표지 청소 ────────────────────────────────
   3차는 「마음이」·「얼마나」·「아니면」을 A01에서만 걷어냈다. 같은 성격의 조각이
   A01 D1-c의 「싶으시」, A02 D2-c의 「아니면」·P3-a의 「얼마나」, C02 B2-b의 「마음이」에
   그대로 남아, 감정과 무관한 질문이 최고 등급 충족과 칭찬을 받았다(교육생 3차 실측). */

describe("남은 조각 표지 청소", () => {
  it("A01 CUE-1 — 3글자 조각 「싶으시」로는 감정 인정이 아니다", () => {
    const cue = cueOf(CHK_A01, "T1");
    for (const utterance of [
      "뭐 드시고 싶으세요?",
      "어디 가고 싶으세요?",
      "뭐 하고 싶으시면 말씀하세요",
    ]) {
      expect(classifyInput(cue, { utterance }).branch.id, utterance).toBe("D1-n");
    }
    // 무엇을 알아드렸는지가 담긴 꼴은 그대로 충족이다 — ⚑CF 시트가 권하는 대안 문장이다.
    for (const utterance of [
      "집에 가고 싶으시구나",
      "집에 가고 싶으시겠어요",
      "애기가 보고 싶으시구나",
    ]) {
      expect(classifyInput(cue, { utterance }).branch.id, utterance).toBe("D1-c");
    }
  });

  it("A02 CUE-2 — 접속어 「아니면」은 선택권 제공이 아니다", () => {
    const cue = cueOf(CHK_A02, "T2");
    expect(classifyInput(cue, { utterance: "아니면 그냥 계세요" }).branch.id).toBe("D2-n");
    expect(
      classifyInput(cue, {
        utterance: "지금 바로 나가실래요, 아니면 따뜻한 물 한 잔 드시고 같이 나가볼까요?",
      }).branch.id,
    ).toBe("D2-c");
  });

  it("A02 CUE-3 — 홑 「얼마나」로는 통증 확인이 아니다", () => {
    const cue = cueOf(CHK_A02, "T3");
    expect(classifyInput(cue, { utterance: "얼마나 걸릴까요?" }).branch.id).toBe("P3-n");
    expect(classifyInput(cue, { utterance: "무릎이 얼마나 아프세요?" }).branch.id).toBe("P3-a");
  });

  it("C02 CUE-2 — 홑 「마음이」로는 공감이 아니다", () => {
    const cue = cueOf(CHK_C02, "T2");
    expect(classifyInput(cue, { utterance: "제 마음이 좀 급하네요" }).branch.id).toBe("B2-n");
    expect(classifyInput(cue, { utterance: "많이 놀라셨겠어요" }).branch.id).toBe("B2-b");
  });

  it("충족 갈래의 표지에 두 글자짜리 홑 조각이 남아 있지 않다", () => {
    // 「마음이」·「얼마나」·「싶으시」가 그랬듯, 무엇을 말했는지가 담기지 않은 조각은
    // 그 자체로 충족 판정을 만든다. 앞으로 들어오는 데이터에도 같은 선을 건다.
    const 금지_조각 = ["마음이", "얼마나", "싶으시", "아니면", "그래서", "그러면", "지시 받"];
    const 남은_조각: string[] = [];
    for (const scenario of SCENARIOS) {
      for (const { turnId, cue } of allCues(scenario)) {
        for (const branch of cue.branches) {
          const top = Math.max(0, ...branch.rubricHits.map((h) => h.score));
          if (top < 3) continue; // 충족으로 적립되는 갈래만 본다
          for (const pattern of branch.patterns) {
            if (금지_조각.includes(pattern.trim())) {
              남은_조각.push(`${scenario.id} ${turnId} ${branch.id} 「${pattern}」`);
            }
          }
        }
      }
    }
    expect(남은_조각).toEqual([]);
  });
});

/* ── ⑮ 보고 틀말 한 마디로는 최고 갈래가 열리지 않는다 ────
   3차는 요소 개수 판정(elementJudge)을 CHK-A01 한 종에만 붙였다. A02 CUE-5와 C02 CUE-C4는
   예전 조각 매치가 그대로 돌아, 「보고드리겠습니다」 여섯 글자가 4점 다섯~여섯 항목과
   「5요소가 모두 들어갔습니다」 칭찬을 받았다(교육생 3차 실측 · high). */

describe("보고 CUE — 「보고드리겠습니다」 여섯 글자", () => {
  /** 요소 개수로 가르는 보고 CUE 전부 */
  const 보고_CUE = SCENARIOS.flatMap((scenario) =>
    allCues(scenario)
      .filter(({ cue }) => Boolean(cue.elementJudge))
      .map(({ cue }) => [`${scenario.id} ${cue.id}`, cue] as const),
  );

  it("요소 개수 판정을 선언한 CUE가 세 곳이다 (A01 CUE-4 · A02 CUE-5 · C02 CUE-C4)", () => {
    expect(보고_CUE.map(([where]) => where)).toEqual([
      "CHK-A01 CUE-4",
      "CHK-A02 CUE-5",
      "CHK-C02 CUE-C4",
    ]);
  });

  it.each(보고_CUE)("%s — 내용 없는 보고 틀말은 최고 갈래를 받지 못한다", (where, cue) => {
    for (const utterance of ["보고드리겠습니다", "보고드립니다", "보고드리겠", "보고하겠습니다"]) {
      const result = classifyInput(cue, { utterance });
      // 0요소는 어느 단에도 닿지 않는다 — 감점이 아니라 중립 미분류로 받는다.
      expect(result.branch.id, `${where} "${utterance}"`).toBe(cue.defaultBranchId);
      expect(result.branch.rubricHits, `${where} "${utterance}"`).toEqual([]);
    }
  });

  it.each(보고_CUE)("%s — 최고 갈래는 표지가 아니라 요소 개수로만 열린다", (where, cue) => {
    const branch = cue.branches.find((b) => b.id === cue.elementJudge?.tiers[0]?.branchId);
    expect(branch, where).toBeDefined();
    // 표지가 남아 있으면 조각 하나로 다시 열린다.
    expect(branch?.patterns, where).toEqual([]);
  });

  it.each(보고_CUE)("%s — 갈래 이름·칭찬이 세는 개수를 넘겨 단정하지 않는다", (where, cue) => {
    const branch = cue.branches.find((b) => b.id === cue.elementJudge?.tiers[0]?.branchId);
    // 기준은 3요소인데 이름은 「5요소」, 칭찬은 「모두 들어갔습니다」이던 자리다.
    for (const word of ["5요소", "4요소", "3요소", "모두 들어갔", "모두 들어간"]) {
      expect(branch?.label ?? "", `${where} label`).not.toContain(word);
      expect(branch?.praise ?? "", `${where} praise`).not.toContain(word);
    }
  });

  it.each(보고_CUE)("%s — 모범 답안은 그대로 최고 갈래로 남는다", (where, cue) => {
    const top = cue.elementJudge?.tiers[0];
    const model = cue.branches.find((b) => b.id === top?.branchId)?.fallbackOption ?? "";
    expect(model.length, where).toBeGreaterThan(0);
    expect(classifyInput(cue, { utterance: model }).branch.id, where).toBe(top?.branchId);
  });

  it("내용이 하나라도 담기면 아래 단이 받는다 (미분류로 떨어뜨리지 않는다)", () => {
    expect(
      classifyInput(cueOf(CHK_A02, "T5"), { utterance: "새벽에 어르신이 나가시려고 하셨습니다" })
        .branch.id,
    ).toBe("R1-b");
    // C02에는 부분 보고 갈래가 없어 옳게 적은 한 마디가 미분류로 떨어졌다 — V-p를 세웠다.
    expect(
      classifyInput(cueOf(CHK_C02, "T4"), { utterance: "가둘 수 없다고 말씀드렸습니다" }).branch.id,
    ).toBe("V-p");
    expect(
      classifyInput(cueOf(CHK_C02, "T4"), {
        utterance: "묶어 두라는 요구가 있어 법으로 허용되지 않는다고 말씀드렸습니다",
      }).branch.id,
    ).toBe("V-a");
  });

  it("세션 경로에서도 보고 틀말은 루브릭을 한 항목도 적립하지 않는다", () => {
    for (const [scenario, turnId] of [
      [CHK_A02, "T5"],
      [CHK_C02, "T4"],
    ] as const) {
      let state = startSession(scenario);
      state = { ...state, currentTurnId: turnId };
      const result = submitResponse(scenario, state, {
        utterance: "보고드리겠습니다",
        viaButton: false,
      });
      expect(result.feedback.rubricHits, scenario.id).toEqual([]);
      expect(Object.keys(result.state.scores), scenario.id).toEqual([]);
    }
  });
});

/* ── ⑯ 미분류 체류 원칙과 그 예외 ─────────────────────────
   3차는 미분류를 같은 장면에 머물게 하는 것을 두 자리에만 적용했다. 나머지 자리는
   「다시 하시거나 아래 버튼에서 골라 주세요」라고 청해 놓고 다음 장면으로 넘어갔다 —
   다시 말할 자리를 준다고 해 놓고 안 주는 셈이다(현직 3차). */

describe("미분류 분기의 체류 원칙", () => {
  /**
   * 진행이 허용되는 자리 — **사유가 있는 곳만** 적는다.
   * 여기 없는 자리가 넘어가면 그 순간 이 검사가 깨진다.
   */
  const 진행_예외: Record<string, string> = {
    // ① 무행동이 곧 사건이 되는 자리 — 문이 열리거나 응급 안내로 넘어간다.
    //    화면만 멈춰 세우면 3초 카운트다운이 거짓이 된다.
    "CHK-A01/CUE-T1": "3초 문고리 — TA-d 「대응 없음 — 문이 열림」",
    "CHK-A01/CUE-T1B": "3초 문고리 재발동 — TB-d 「아무것도 하지 않음 — 문이 열림」",
    "CHK-A02/CUE-N1": "자동문 — NA-d 「아무것도 하지 않음 — 문이 열림」",
    "CHK-B02/CUE-3": "응급 전환 — 소리가 사라진 뒤 L3 고정 안내로 넘어간다",
    // ② 회차를 닫는 자리 — 그 분기의 대사가 이미 마무리를 알린다(새 대사 추가 금지).
    "CHK-A01/CUE-6": "마무리 — 「오늘 훈련을 마쳤습니다」",
    "CHK-A02/CUE-7": "마무리 — 「오늘 훈련을 마쳤습니다」",
    "CHK-B01/CUE-7": "마무리 — 「오늘 훈련을 마쳤습니다」",
    "CHK-B02/CUE-7": "마무리 — 「훈련을 마쳤습니다」",
    "CHK-C01/CUE-7": "마무리 — 「오늘 훈련을 마쳤습니다」",
    "CHK-C02/CUE-C6": "마무리 — 「오늘 훈련을 마쳤습니다」",
  };

  it("예외로 적어 둔 자리가 실제로 있는 자리다 (목록이 낡지 않게)", () => {
    const 있는_자리 = new Set(
      SCENARIOS.flatMap((s) => allCues(s).map(({ cue }) => `${s.id}/${cue.id}`)),
    );
    for (const key of Object.keys(진행_예외)) expect([...있는_자리], key).toContain(key);
  });

  it.each(SCENARIOS.map((s) => [s.id, s] as const))(
    "%s — 미분류는 같은 자리에 머문다 (예외는 사유가 적힌 곳뿐)",
    (_id, scenario) => {
      for (const { turnId, cue } of allCues(scenario)) {
        const branch = cue.branches.find((b) => b.id === cue.defaultBranchId);
        const key = `${scenario.id}/${cue.id}`;
        if (진행_예외[key]) {
          expect(branch?.next, `${key} — ${진행_예외[key]}`).not.toBe(turnId);
          continue;
        }
        expect(branch?.next, key).toBe(turnId);
      }
    },
  );

  it("머무는 자리와 넘어가는 자리의 코칭 문구가 두 벌로 갈린다", () => {
    for (const scenario of SCENARIOS) {
      for (const { turnId, cue } of allCues(scenario)) {
        const branch = cue.branches.find((b) => b.id === cue.defaultBranchId);
        const coaching = branch?.coaching ?? "";
        const key = `${scenario.id}/${cue.id}`;
        expect(coaching.length, key).toBeGreaterThan(0);
        if (branch?.next === turnId) {
          // 머무는 자리 — 다시 말할 자리를 준다고 했으면 실제로 줘야 한다.
          expect(coaching, `${key} 체류`).toMatch(/다시|골라/);
        } else {
          // 넘어가는 자리 — 다시 청하지 않는다. 그 말대로 할 수가 없다.
          expect(coaching, `${key} 진행`).not.toMatch(/다시 (말씀|하시|들려)/);
          expect(coaching, `${key} 진행`).not.toContain("골라 주세요");
        }
      }
    }
  });

  it("체류로 바뀐 뒤에도 미분류는 어디서도 해를 끼치지 않는다", () => {
    for (const scenario of SCENARIOS) {
      let state = startSession(scenario);
      for (let guard = 0; guard < 20 && state.status === "running"; guard += 1) {
        const result = step(scenario, state, { utterance: "음…", viaButton: false });
        expect(result.interrupted, scenario.id).toBe(false);
        expect(result.feedback.rubricHits, scenario.id).toEqual([]);
        expect(result.feedback.gaugeDelta, scenario.id).toBe(0);
        state = result.state;
        expect(state.gauge, scenario.id).toBe(scenario.gauge.start);
        expect(state.cfCount, scenario.id).toBe(0);
        // 머무는 자리라면 다시 말할 길(보기 버튼)이 반드시 열려 있어야 한다.
        if (state.status === "running") {
          expect(cueOptions(scenario, state).length, scenario.id).toBeGreaterThan(0);
        }
      }
    }
  });

  it("체류하는 자리에서 다음 발화는 그대로 판정된다 (막다른 길이 아니다)", () => {
    const first = step(CHK_A01, startSession(CHK_A01), { utterance: "음…", viaButton: false });
    expect(first.state.currentTurnId).toBe("T1");
    const second = step(CHK_A01, first.state, {
      utterance: "애기 밥 챙겨주셔야 하는구나, 마음이 급하시겠어요",
      viaButton: false,
    });
    expect(second.feedback.branchId).toBe("D1-c");
    expect(second.state.currentTurnId).toBe("T2");
  });
});

/* ── ⑰ 두 자리의 「갈래」 셈법이 같은 집합을 센다 ─────────
   종료 화면(engine/coverage)과 훈련 목록 카드(train/unexplored)가 같은 조건을 각자 적어
   두고 있었다. 조건이 갈라지면 같은 상황의 두 숫자가 서로 다른 것을 세게 된다. */

describe("안 가 본 갈래 — 두 셈법의 기준", () => {
  it("권할 만한 갈래는 전부 되짚을 문구를 갖고 있다", () => {
    // 종료 화면은 분기 id로, 목록 카드는 기록에 남은 문구로 되짚는다.
    // 문구 없는 갈래가 하나라도 생기면 그 순간 두 숫자가 다른 집합을 세게 된다.
    const 문구_없는_갈래: string[] = [];
    for (const scenario of SCENARIOS) {
      for (const { turnId, cue } of allCues(scenario)) {
        for (const branch of cue.branches) {
          if (!isSuggestableBranch(cue, branch)) continue;
          if (branchMessages(branch).length > 0) continue;
          문구_없는_갈래.push(`${scenario.id} ${turnId} ${branch.id}`);
        }
      }
    }
    expect(문구_없는_갈래).toEqual([]);
  });

  it("중립·⚑CF 갈래는 어느 쪽에서도 세지 않는다", () => {
    for (const scenario of SCENARIOS) {
      for (const { cue } of allCues(scenario)) {
        for (const branch of cue.branches) {
          if (branch.criticalFail === true || branch.id === cue.defaultBranchId) {
            expect(isSuggestableBranch(cue, branch), `${scenario.id} ${branch.id}`).toBe(false);
          }
        }
      }
    }
  });
});

/* ── ⑱ 흐름 목록의 분기 이름이 사용자 말로 나간다 ─────────
   훈련이 끝난 뒤 「이번 훈련의 흐름」을 펴면 설계표 이름이 그대로 나왔다.
   말을 했는데 인식이 빗나간 자리에 「무응답」이라고 적히는 것은 사실과도 다르다. */

describe("종료 화면 표시부 — 설계표 분류 이름", () => {
  it("「무응답」이라는 말이 화면 낱말로 나가지 않는다", () => {
    expect(BRANCH_LABEL_IN_WORDS["무응답·미분류"]).toBeDefined();
    for (const word of Object.values(BRANCH_LABEL_IN_WORDS)) {
      expect(word).not.toContain("무응답");
      expect(word).not.toContain("미분류");
    }
  });

  it("표의 열쇠가 실제 분기 이름과 맞는다 (낡은 항목 0건)", () => {
    const 있는_이름 = new Set(
      SCENARIOS.flatMap((s) =>
        allCues(s).flatMap(({ cue }) =>
          cue.branches.map((b) =>
            b.label.replace(/\s*\([^)]*(?:⚑|\bCF\b)[^)]*\)/g, "").trim(),
          ),
        ),
      ),
    );
    for (const key of Object.keys(BRANCH_LABEL_IN_WORDS)) {
      expect([...있는_이름], key).toContain(key);
    }
  });

  it("데이터의 분기 이름은 그대로다 (표시부 한 겹만 얹었다)", () => {
    // 감수 문서·판정·기록이 쓰는 이름은 손대지 않는다.
    const labels = SCENARIOS.flatMap((s) => allCues(s).flatMap(({ cue }) => cue.branches.map((b) => b.label)));
    expect(labels.filter((l) => l === "무응답·미분류").length).toBe(50);
  });
});
