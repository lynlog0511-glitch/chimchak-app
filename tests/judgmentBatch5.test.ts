/**
 * 5차 개선 배치 1 — 판정·시나리오 (2026-08-26).
 *
 * 현직 요양보호사·교육생·PM 5차 검증에서 나온 결함을 **자리째** 못 박는다.
 * 고쳤다는 말이 아니라 다시 무너지지 않게 하는 것이 이 파일의 목적이라,
 * 각 describe 머리에 「무엇이 어떻게 무너져 있었는가」를 함께 적는다.
 * 문장은 대부분 평가 원본의 failure_scenario를 그대로 옮긴 것이다.
 *
 *  ① 요소 판정이 감점·심각도 검사를 건너뛴다 (교육생 high)
 *  ② A02 R1-e 가림 회귀와 현장 호칭 (현직 med·low · 교육생 med)
 *  ③ 홑 명사 기구 예외어 (PM high · 현직 low)
 *  ④ 자유 연습에는 분기망이 없다 (현직 med · PM med)
 *  ⑤ 부분 보고 코칭이 방금 말한 요소를 돌려준다 (교육생 med)
 *  ⑥ 접힘 첫 줄의 「5요소 모두」 (교육생 med)
 *  ⑦ 2회째 미분류 문구의 마지막 마디 (교육생 med)
 *  ⑧ 갈등 시나리오의 갈래 이름 (현직 low)
 *  ⑨ 「기다리세요」 조각이 원인을 묻는 질문을 감점으로 찍는다 (교육생 med)
 *  ⑩ 시연용 예시 이력의 낡은 칭찬 (교육생 med)
 */

import { describe, expect, it } from "vitest";
import type { CueDef, Scenario } from "@/types";
import { CHK_A01, CHK_A02, CHK_C01, CHK_C02, SCENARIOS } from "@/data/scenarios";
import { RULE_BOUNDARY_CASES } from "@/data/ruleBoundaryCases";
import { RUBRIC } from "@/data/rubric";
import { classifyInput } from "@/engine/classify";
import { currentTurn } from "@/engine";
import { checkBranchRestraint, checkCritical, RESTRAINT_EXCEPT_TERMS } from "@/engine/rules";
import { checkLearnerUtterance } from "@/lib/onlineFree";
import { initialTrainState, makeTrainReducer } from "@/app/train/_components/sessionMachine";
import { DEMO_SESSIONS } from "@/lib/demoSeed";
import {
  branchLabelInWords,
  BRANCH_LABEL_IN_WORDS,
  partialReportCoaching,
  UNCLEAR_REPEAT_COACHING,
} from "@/app/train/_components/constants";

/* ── 도우미 ────────────────────────────────────────────── */

function cueOf(s: Scenario, turnId: string): CueDef {
  const turn = s.turns.find((t) => t.id === turnId);
  if (!turn?.cue) throw new Error(`${s.id} ${turnId}: CUE가 없습니다`);
  return turn.cue;
}

function allCues(s: Scenario): { turnId: string; cue: CueDef }[] {
  return s.turns.flatMap((turn) => (turn.cue ? [{ turnId: turn.id, cue: turn.cue }] : []));
}

/* ── ① 요소 판정이 감점·심각도 검사를 건너뛴다 ─────────────
   classify에서 요소 개수 판정은 2.5단, 심각도 채택은 3단이다. 요소가 하나라도 서면 그 자리에서
   반환하므로, 같은 발화에 걸리는 감정·추정 갈래(A01 R1-c · A02 R1-c · C02 V-b)는 아예
   대조되지 않았다. 2·3차에 걸쳐 세운 「덧붙인 잘못은 이긴다」가 보고 구간에서만 무효였고,
   그 결과 화면의 칭찬 문장이 사실과 다른 말을 했다(교육생 5차 high).
   이제 사다리(tiers)에 이름이 없는 갈래는 요소 판정 **앞에서** 한 번 대조된다. */

describe("보고 CUE — 사다리 밖 갈래가 요소 개수를 이긴다", () => {
  it("C02 — 감정 형용사가 섞인 보고는 최고 갈래를 받지 못한다", () => {
    const result = classifyInput(cueOf(CHK_C02, "T4"), {
      utterance:
        "아드님이 왼팔 멍을 보시고 억울할 만큼 몰아세우셨지만, 법으로 허용되지 않는다고 말씀드렸습니다",
    });
    expect(result.branch.id).toBe("V-b");
    // 「감정 형용사를 빼고…」 칭찬은 이 발화에 붙지 않는다.
    expect(result.branch.praise).toBeUndefined();
  });

  it("A01 — 추정·감정이 섞이면 3요소여도 감정·추정 갈래로 간다", () => {
    const result = classifyInput(cueOf(CHK_A01, "T4"), {
      utterance: "어르신이 치매라서 자꾸 나가시려고 하셔서 힘들었습니다. 지금은 소파에 앉아 계십니다.",
    });
    expect(result.branch.id).toBe("R1-c");
  });

  it("A02 — 같은 자리에서 같은 규칙이 선다", () => {
    expect(
      classifyInput(cueOf(CHK_A02, "T5"), {
        utterance: "어르신이 고집을 부리셔서 새벽 내내 힘들었습니다. 지금은 방에서 주무십니다.",
      }).branch.id,
    ).toBe("R1-c");
  });

  it("사다리 **위** 갈래는 그대로 개수가 정한다 — 갖춘 것을 못 갖췄다고 하지 않는다", () => {
    for (const [scenario, turnId, topId] of [
      [CHK_A01, "T4", "R1-a"],
      [CHK_A02, "T5", "R1-a"],
      [CHK_C02, "T4", "V-a"],
    ] as const) {
      const cue = cueOf(scenario, turnId);
      const model = cue.branches.find((b) => b.id === topId)?.fallbackOption ?? "";
      expect(model.length, scenario.id).toBeGreaterThan(0);
      expect(classifyInput(cue, { utterance: model }).branch.id, scenario.id).toBe(topId);
    }
  });

  it("미보고 선언도 요소 하나에 가려지지 않는다", () => {
    expect(
      classifyInput(cueOf(CHK_A01, "T4"), {
        utterance: "어르신 일은 별일 아니라서 나중에 말씀드리겠습니다",
      }).branch.id,
    ).toBe("R1-d");
  });
});

/* ── ② A02 R1-e 가림 회귀와 현장 호칭 ────────────────────
   4차가 얹은 요소 판정이 패턴 대조보다 앞이라, 「아침에 시설장님을 통해 알리겠습니다」류가
   2요소로 세어져 부분 보고(R1-b)로 내려갔다. R1-e의 SA-07·CO-05 4점과 「통보를 미룬 것이
   아니라 경로를 정한 것」이라는 칭찬은 열리지 않았고, **덜 말하면 4점 더 말하면 2점**이었다.
   더해서 표지가 「아침에 시설장」·「시설장께」·「시설장님」 세 꼴뿐이라 조사가 바뀌면 미분류로
   떨어졌다(A01 P-e에는 4차에 넣은 현장 호칭이 여기에는 오지 않았다). */

describe("A02 CUE-5 R1-e — 보호자 통보 경로 판단", () => {
  const cue = cueOf(CHK_A02, "T5");

  it("요소를 함께 말해도 통보 경로 판단으로 남는다 (5차 failure_scenario)", () => {
    for (const utterance of [
      "보호자께는 지금 통화가 되지 않아, 아침에 시설장님을 통해 알리도록 일지에 남기겠습니다. 어르신은 지금 방에서 주무십니다.",
      "어르신 무릎 통증을 당직 간호사께 알렸고, 보호자께는 아침에 시설장님을 통해 알리겠습니다",
    ]) {
      expect(classifyInput(cue, { utterance }).branch.id, utterance).toBe("R1-e");
    }
  });

  it("현장에서 쓰는 호칭·조사가 모두 걸린다 (A01 P-e와 같은 폭)", () => {
    for (const utterance of [
      "보호자께는 새벽이라 연락드리지 않고, 시설장에게 아침에 보고하겠습니다",
      "보호자께는 새벽이라 연락드리지 않고, 시설장님께 아침에 보고하겠습니다",
      "보호자께는 새벽이라 연락드리지 않고, 원장님께 아침에 보고하겠습니다",
      "보호자께는 새벽이라 연락드리지 않고, 센터장님께 아침에 보고하겠습니다",
      "보호자께는 새벽이라 연락드리지 않고, 간호팀장님께 아침에 보고하겠습니다",
    ]) {
      expect(classifyInput(cue, { utterance }).branch.id, utterance).toBe("R1-e");
    }
  });

  /* 이 한 겹이 **또 하나의 강등 통로**가 되지 않는지 본다. 요소를 다 갖춰 말하면서 통보
     경로까지 정한 답이 R1-e로 옮겨 가면 CL-01·02·03이 통째로 빠져, 고치려던 「더 말할수록
     손해」가 자리만 바꿔 되살아난다. 최상단에 닿은 발화는 「덧붙인 잘못」만 이긴다. */
  it("요소를 다 갖추고 통보 경로까지 말하면 최고 갈래가 그대로 선다", () => {
    const result = classifyInput(cue, {
      utterance:
        "새벽 2시 10분 어르신이 무릎 통증을 말씀하셔서 당직 간호사께 알렸고, 보호자께는 통화가 되지 않아 아침에 시설장님을 통해 알리겠습니다. 지금은 방에서 주무십니다.",
    });
    expect(result.branch.id).toBe("R1-a");
    expect(result.branch.rubricHits.map((hit) => hit.itemId)).toContain("CL-01");
  });

  it("최상단에 닿아도 감정·추정이 섞이면 그쪽이 이긴다", () => {
    expect(
      classifyInput(cue, {
        utterance:
          "새벽 2시 10분 어르신이 고집을 부리셔서 당직 간호사께 알렸습니다. 지금은 방에서 주무십니다.",
      }).branch.id,
    ).toBe("R1-c");
  });

  it("R1-e는 사다리에 이름이 없다 — 개수가 정하는 자리가 아니다", () => {
    const ladder = (cue.elementJudge?.tiers ?? []).map((tier) => tier.branchId);
    expect(ladder).not.toContain("R1-e");
    expect(ladder).toEqual(["R1-a", "R1-b"]);
  });
});

/* ── ③ 홑 명사 기구 예외어 ───────────────────────────────
   억제 신호가 걸린 자리 앞뒤 6글자 창 안에 홑 명사 예외어 「휠체어」가 들어오면 그 매치가
   통째로 건너뛰어졌다. 예외 배열은 규칙 사전(CF-RESTRAINT)과 시나리오 ⚑CF 분기가 「이끌」
   한 낱말만 빼고 공유하므로, **자유 발화도 분기도** 이 문장을 잡지 못했다(PM 5차 high).
   휠체어 결박은 장기요양 현장의 대표적 신체억제 형태이고, 가장 짧고 가장 자연스러운 꼴만
   뚫려 있었다. 목적어+동사 꼴로 좁혀 두 판정선에서 함께 닫았다. */

describe("기구 예외어 — 목적어+동사 꼴", () => {
  it("홑 명사로 남은 기구 낱말이 없다", () => {
    for (const term of ["휠체어", "보행기", "유모차", "구급차"]) {
      expect(RESTRAINT_EXCEPT_TERMS, term).not.toContain(term);
    }
  });

  it("규칙 사전이 휠체어 결박을 잡는다", () => {
    for (const utterance of [
      "휠체어에 묶어 두겠습니다",
      "휠체어 벨트를 채우겠습니다.",
      "휠체어에 안전벨트로 고정해 두겠습니다.",
      "보행기에 묶어 두겠습니다",
      "구급차에 묶어 두겠습니다",
    ]) {
      expect(checkCritical(utterance).ruleId, utterance).toBe("CF-RESTRAINT");
    }
  });

  it("시나리오 ⚑CF 분기도 같은 문장을 받는다 (두 판정선이 함께 닫힌다)", () => {
    const result = classifyInput(cueOf(CHK_A02, "T1"), { utterance: "휠체어에 묶어 두겠습니다" });
    expect(result.branch.criticalFail).toBe(true);
    expect(result.source).toBe("criticalPattern");
  });

  it("기구를 다루는 말은 그대로 지나간다 (좁히기의 반대쪽)", () => {
    for (const utterance of [
      "휠체어를 밀어서 방으로 모시겠습니다",
      "휠체어 밀어서 방으로 모시겠습니다",
      "보행기를 밀어서 화장실까지 함께 가겠습니다.",
      "휠체어 안전벨트를 매 드리고 이동하겠습니다.",
      "휠체어 안전벨트는 이동 중에만 쓰고 도착하면 바로 풀어 드리겠습니다.",
      "휠체어 브레이크를 잠그겠습니다.",
      "구급차에서 안전벨트로 고정합니다.",
      "차량 이송 중에는 안전벨트를 매 드립니다.",
    ]) {
      expect(checkCritical(utterance).cf, utterance).toBe(false);
    }
  });

  it("경계 케이스가 양쪽을 못 박는다 — 한쪽만 넣지 않는다", () => {
    const byUtterance = new Map(RULE_BOUNDARY_CASES.map((c) => [c.utterance, c]));
    expect(byUtterance.get("휠체어에 묶어 두겠습니다.")?.cf).toBe(true);
    expect(byUtterance.get("휠체어 벨트를 채우겠습니다.")?.cf).toBe(true);
    expect(byUtterance.get("휠체어 밀어서 방으로 모시겠습니다.")?.cf).toBe(false);
    expect(byUtterance.get("휠체어 안전벨트를 매 드리고 이동하겠습니다.")?.cf).toBe(false);
  });
});

/* ── ④ 자유 연습에는 분기망이 없다 ────────────────────────
   4차가 세운 이중 안전망은 「규칙 사전이 놓치면 시나리오 분기가 받는다」였다. 그런데 자유
   연습(/practice)에는 시나리오도 CUE도 없어 분기가 존재하지 않고, 학습자 발화를 재는 것은
   사전 한 겹뿐이었다. 판정이 갈리는 것이 아니라 **같은 문장이 한 화면에서는 ⚑CF, 다른
   화면에서는 무사통과**인 것이 문제였다 — 문답카드 C-7이 시연으로 지정한 대비쌍이다. */

describe("자유 연습 — 억제 그물이 훈련과 같은 폭이다", () => {
  it("C-7 대비쌍 두 문장이 자유 연습에서도 같은 판정을 받는다", () => {
    // 통과해야 하는 쪽 — 이 앱이 ⚑CF 시트에서 스스로 권하는 대안이다.
    expect(checkLearnerUtterance("어머님, 제 팔 붙잡으세요. 같이 나가요", "BPSD").cf).toBe(false);
    // 멈춰 세워야 하는 쪽
    const stopped = checkLearnerUtterance("제 팔을 잡아 이끌고 가겠습니다", "BPSD");
    expect(stopped.cf).toBe(true);
    expect(stopped.ruleId).toBe("CF-RESTRAINT");
    // 조문 고지와 대안 3개가 같이 온다 — 훈련 화면과 같은 것을 세운다.
    expect(stopped.docId).toBe("DOC-LAW-003");
    expect(stopped.alternatives?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it("훈련에서 즉시 중단되는 문장이 자유 연습에서도 멈춘다", () => {
    const utterance = "어머님 팔을 잡아 이끌고 나가겠습니다";
    // 규칙 사전 단독으로는 여전히 지나간다(bc-384가 그 한계를 적어 둔다) — 한 겹이 더 있다.
    expect(checkCritical(utterance, { scenarioType: "BPSD" }).cf).toBe(false);
    expect(checkLearnerUtterance(utterance, "BPSD").cf).toBe(true);
    // 시나리오 분기도 같은 문장을 받는다.
    expect(
      classifyInput(cueOf(CHK_A01, "T1"), { utterance }).branch.criticalFail,
    ).toBe(true);
  });

  it("보강 검사는 사전이 이미 잡은 문장을 다시 만들지 않는다", () => {
    const dict = checkLearnerUtterance("문을 잠그겠습니다", "BPSD");
    expect(dict.cf).toBe(true);
    expect(dict.matched).toBeDefined();
    // 부정·예외는 그대로다 — 넓힌 것이 아니라 분기가 쓰던 목록을 같이 볼 뿐이다.
    expect(checkLearnerUtterance("문을 잠그지 않겠습니다", "BPSD").cf).toBe(false);
    expect(checkLearnerUtterance("무슨 일이신지 여쭤보겠습니다", "BPSD").cf).toBe(false);
    expect(checkBranchRestraint("어머님, 제 팔 붙잡으세요").cf).toBe(false);
  });
});

/* ── ⑤ 부분 보고 코칭이 방금 말한 요소를 돌려준다 ──────────
   채택선이 1요소로 내려오면서, 고정 코칭 문장이 요구하는 것을 **이미 말한 발화**가 이 갈래에
   닿았다. "지금은 소파에 앉아 계십니다"에 「"지금은 소파에 앉아 계십니다" 두 마디만 덧붙이면」이
   붙어 방금 한 말을 그대로 인용해 돌려주었고, 같은 화면의 접힘은 실제로 센 요소를 적어
   위아래가 다른 말을 했다(교육생 5차). 표시부에서 빠진 그룹 이름으로 조립한다. */

describe("부분 보고 코칭 — 빠진 요소로 조립한다", () => {
  it("담긴 것과 빠진 것을 그대로 적는다", () => {
    const cue = cueOf(CHK_A01, "T4");
    const result = classifyInput(cue, { utterance: "지금은 소파에 앉아 계십니다" });
    expect(result.branch.id).toBe("R1-b");
    const line = partialReportCoaching(cue, result.matchedElements);
    expect(line).toBeDefined();
    // 방금 말한 요소를 「덧붙이라」고 하지 않는다.
    expect(line).toContain("말씀에 담긴 것은 현재 상태입니다");
    expect(line).toContain("시각");
    expect(line).not.toContain("소파에 앉아 계십니다.");
  });

  it("C02 V-p도 같은 규칙을 지난다", () => {
    const cue = cueOf(CHK_C02, "T4");
    const result = classifyInput(cue, { utterance: "가둘 수 없다고 말씀드렸습니다" });
    expect(result.branch.id).toBe("V-p");
    const line = partialReportCoaching(cue, result.matchedElements) ?? "";
    expect(line).toContain("본인 응답");
    expect(line).toContain("시각");
    expect(line).toContain("관찰·요구");
  });

  it("화면에 실제로 서는 줄도 조립된 문장이다 (리듀서 경로)", () => {
    const reduce = makeTrainReducer(CHK_A01);
    let state = reduce(initialTrainState(CHK_A01), { type: "start" });
    for (let guard = 0; guard < 40; guard += 1) {
      const turn = currentTurn(CHK_A01, state.session);
      if (!turn?.cue || turn.cue.id === "CUE-4") break;
      const branch = turn.cue.branches.find(
        (b) =>
          typeof b.fallbackOption === "string" &&
          b.fallbackOption.length > 0 &&
          b.criticalFail !== true &&
          b.retrainAdvice !== true,
      );
      if (!branch) break;
      state = reduce(state, { type: "submit", input: { branchId: branch.id, viaButton: true } });
    }
    expect(currentTurn(CHK_A01, state.session)?.cue?.id).toBe("CUE-4");

    const next = reduce(state, {
      type: "submit",
      input: { utterance: "지금은 소파에 앉아 계십니다", viaButton: false },
    });
    expect(next.lastFeedback?.branchId).toBe("R1-b");
    expect(next.lastFeedback?.message).toContain("말씀에 담긴 것은 현재 상태입니다");
    // 데이터 원문(방금 한 말을 그대로 돌려주던 문장)은 화면에 서지 않는다.
    expect(next.lastFeedback?.message).not.toContain("두 마디만 덧붙이면");
  });

  it("요소를 다 채웠거나 셀 것이 없으면 데이터의 코칭을 그대로 쓴다 (폴백)", () => {
    const cue = cueOf(CHK_A01, "T4");
    const labels = (cue.elementJudge?.groups ?? []).map((g) => g.label);
    expect(partialReportCoaching(cue, labels)).toBeUndefined();
    expect(partialReportCoaching(cue, [])).toBeUndefined();
    expect(partialReportCoaching(cue, undefined)).toBeUndefined();
    // 요소 판정이 없는 CUE는 애초에 대상이 아니다.
    expect(partialReportCoaching(cueOf(CHK_A01, "T1"), ["시각"])).toBeUndefined();
  });
});

/* ── ⑥ 접힘 첫 줄의 「5요소 모두」 ────────────────────────
   판정 접힘의 첫 줄(「이 자리의 돌봄 기준」)은 CL-01의 행동지표 원문을 그대로 옮긴다.
   그 원문이 「5요소를 모두 포함했는가」이고 앵커 4점이 「5개 전부」인데, 그 항목이 4점으로
   적립되는 자리의 채택선은 3요소다. 한 화면에 기준 5개 · 실제 3개 · 초록 「충족」이
   나란히 섰다(교육생 5차). 지표를 실제 판정 기준과 같은 말로 고쳤다. */

describe("CL-01 지표 — 판정 기준과 같은 말을 한다", () => {
  const item = RUBRIC.find((rubric) => rubric.id === "CL-01");

  it("지표·앵커가 개수를 단정하지 않는다", () => {
    expect(item).toBeDefined();
    for (const word of ["모두 포함", "5개 전부", "5요소 0"]) {
      expect(item?.indicator ?? "", word).not.toContain(word);
      for (const anchor of Object.values(item?.anchors ?? {})) {
        expect(anchor, word).not.toContain(word);
      }
    }
  });

  it("행동지표는 할 일 서술로 바뀌는 꼴이다 (접힘 첫 줄이 질문으로 서지 않는다)", () => {
    expect(item?.indicator ?? "").toMatch(/했는가(\s*\([^()]*\))?$/);
  });

  it("A01·A02 학습목표도 같은 말을 쓴다", () => {
    for (const scenario of [CHK_A01, CHK_A02]) {
      const report = scenario.objectives.filter((line) => line.includes("CL-01"));
      expect(report.length, scenario.id).toBeGreaterThan(0);
      for (const line of report) expect(line, scenario.id).not.toContain("5요소");
    }
  });
});

/* ── ⑦ 2회째 미분류 문구의 마지막 마디 ────────────────────
   「고르신 것도 말씀하신 것과 똑같이 판정합니다」는 사실이 아니었다 — 버튼 경로에서는 규칙
   사전이 돌지 않고 시나리오 데이터의 판정을 그대로 따른다. 같은 화면의 다른 두 문장이
   그렇게 적혀 있어 한 화면이 세 갈래로 갈렸고, 하필 이 줄을 읽는 분은 버튼으로 옮겨 가려는
   분이라 「버튼으로만 해도 된다」를 정확히 반대로 배웠다(교육생 5차). */

describe("2회째 미분류 문구", () => {
  it("판정기가 같다고 단정하지 않는다", () => {
    expect(UNCLEAR_REPEAT_COACHING).not.toContain("똑같이 판정");
    expect(UNCLEAR_REPEAT_COACHING).not.toContain("같은 판정");
  });

  it("되묻지 않고 보기 쪽을 세우는 두 마디만 남는다", () => {
    expect(UNCLEAR_REPEAT_COACHING).toBe(
      "이번에도 잘 닿지 않았어요. 아래 보기에서 하나 골라 주시면 그대로 이어집니다.",
    );
    expect(UNCLEAR_REPEAT_COACHING).not.toContain("?");
  });
});

/* ── ⑧ 갈등 시나리오의 갈래 이름 ─────────────────────────
   「무응답·미분류」를 사람 말로 바꾼 이유가 갈등 시나리오에 더 세게 적용된다. 보호자에게
   몰리다 물러선 회차 끝에 「위축 후 수용 (경계 붕괴)」, 사과를 반복한 회차에 「무한 사과」가
   자기 회차의 줄로 적혔다. 판정 이름이 아니라 사람 성향에 대한 평가로 읽히고, 「경계 붕괴」는
   현장에서 직무 부적합을 뜻하는 말이다(현직 5차). */

describe("흐름 목록의 갈래 이름 — 전 시나리오 전수", () => {
  /** 사람의 성향을 평가하는 것으로 읽히는 말 — 화면에 남으면 안 된다. */
  const 평가어 = ["경계 붕괴", "무한 사과", "애원", "자책", "위축", "무응답", "미분류"];

  const 모든_라벨 = SCENARIOS.flatMap((scenario) =>
    allCues(scenario).flatMap(({ cue }) =>
      cue.branches.map((branch) => [`${scenario.id} ${cue.id} ${branch.id}`, branch.label] as const),
    ),
  );

  it("표를 지난 뒤 남는 설계 이름이 0건이다", () => {
    const 남은 = 모든_라벨
      .map(([where, label]) => [where, branchLabelInWords(label)] as const)
      .filter(([, shown]) => 평가어.some((word) => shown.includes(word)));
    expect(남은).toEqual([]);
  });

  it("⚑CF 표기는 화면 낱말이 아니다 — 그 괄호만 떨어진다", () => {
    for (const [where, label] of 모든_라벨) {
      expect(branchLabelInWords(label), where).not.toContain("⚑");
    }
    expect(branchLabelInWords("눕히기 (의식 있는 상태에서) (⚑CF)")).toBe(
      "눕히기 (의식 있는 상태에서)",
    );
  });

  it("C01·C02의 다섯 갈래가 사용자 말로 나간다", () => {
    expect(branchLabelInWords("무한 사과")).toBe("사과를 거듭함");
    expect(branchLabelInWords("위축 후 수용 (경계 붕괴)")).toBe("물러서서 요구를 받아들임");
    expect(branchLabelInWords("사과·애원")).toBe("사과하며 한 번만 봐 달라고 함");
    expect(branchLabelInWords("즉시 사과·자책")).toBe("곧바로 사과하며 제 탓으로 돌림");
    expect(branchLabelInWords("애원·위축")).toBe("한 번만 봐 달라고 부탁함");
  });

  it("표에 죽은 줄이 없다 — 모든 열쇠가 실제 갈래 이름이다", () => {
    const 실제 = new Set(
      모든_라벨.map(([, label]) => label.replace(/\s*\([^)]*(?:⚑|\bCF\b)[^)]*\)/g, "").trim()),
    );
    const 죽은 = Object.keys(BRANCH_LABEL_IN_WORDS).filter((key) => !실제.has(key));
    expect(죽은).toEqual([]);
  });

  it("갈등 시나리오 두 종이 실제로 그 이름을 쓰고 있다 (표만 고치고 끝내지 않는다)", () => {
    const c01 = allCues(CHK_C01).flatMap(({ cue }) => cue.branches.map((b) => b.label));
    const c02 = allCues(CHK_C02).flatMap(({ cue }) => cue.branches.map((b) => b.label));
    expect(c01).toContain("무한 사과");
    expect(c01).toContain("위축 후 수용 (경계 붕괴)");
    expect(c01).toContain("사과·애원");
    expect(c02).toContain("즉시 사과·자책");
    expect(c02).toContain("애원·위축");
  });
});

/* ── ⑨ 「기다리세요」 조각 ───────────────────────────────
   정규화가 물음표를 지우므로 "집에서 누가 기다리세요?"·"누구 기다리세요?"처럼 어르신이 왜
   나가려 하시는지 묻는 질문이 지시·제지형(gaugeDelta 2)에 걸렸다. 초조도가 두 칸 오르고
   「지시 대신 선택지를 두 개만」이라는 엉뚱한 코칭이 붙었다. 원인 탐색은 이 시나리오가 다음
   턴에서 가르치는 바로 그 행동이라, 첫 턴에 그걸 했다고 감점을 주면 다음 턴에 안 하게 된다. */

describe("A01·A02 CUE-1 — 원인을 묻는 질문은 지시가 아니다", () => {
  it.each([
    [CHK_A01, "T1"],
    [CHK_A02, "T1"],
  ] as const)("%s — 「누가 기다리세요?」가 감점 갈래에 걸리지 않는다", (scenario, turnId) => {
    const cue = cueOf(scenario, turnId);
    for (const utterance of [
      "집에서 누가 기다리세요?",
      "누구 기다리세요?",
      "누구를 기다리세요?",
      "어디서 기다리세요?",
    ]) {
      const branch = classifyInput(cue, { utterance }).branch;
      expect(branch.id, `${scenario.id} "${utterance}"`).not.toBe("D1-b");
      expect(branch.gaugeDelta, `${scenario.id} "${utterance}"`).toBe(0);
    }
  });

  it.each([
    [CHK_A01, "T1"],
    [CHK_A02, "T1"],
  ] as const)("%s — 그냥 「기다리세요」는 그대로 지시다", (scenario, turnId) => {
    for (const utterance of ["기다리세요", "잠깐 기다리세요", "여기서 기다리세요"]) {
      expect(
        classifyInput(cueOf(scenario, turnId), { utterance }).branch.id,
        `${scenario.id} "${utterance}"`,
      ).toBe("D1-b");
    }
  });
});

/* ── ⑩ 시연용 예시 이력의 낡은 칭찬 ───────────────────────
   4차에서 「누가·언제·무엇을·어떻게·현재 상태가 모두 들어간 사실 중심 보고입니다」를 사실과
   다르다는 이유로 시나리오에서 뺐는데, 시연으로 심는 예시 회차에는 그대로 남았다. 그 파일은
   「문구는 시나리오의 praise·coaching 원문 그대로입니다」라고 스스로 적어 두었는데 이제 그
   문장은 어느 시나리오에도 없다. 지키는 검사도 없었다(교육생 5차). */

describe("시연용 예시 이력 — 문구는 시나리오 원문 그대로", () => {
  /** 전 시나리오의 praise·coaching 원문 */
  const 원문 = new Set(
    SCENARIOS.flatMap((scenario) =>
      allCues(scenario).flatMap(({ cue }) =>
        cue.branches.flatMap((branch) =>
          [branch.praise, branch.coaching].filter((line): line is string => Boolean(line)),
        ),
      ),
    ),
  );

  it("예시 회차의 문구가 전부 시나리오에 있다 (창작 0건)", () => {
    const 없는: string[] = [];
    for (const seed of DEMO_SESSIONS) {
      for (const line of [...seed.greenChecks, ...seed.coachingPoints]) {
        if (!원문.has(line)) 없는.push(`${seed.scenarioId} · ${line}`);
      }
    }
    expect(없는).toEqual([]);
  });

  it("걷어낸 5요소 칭찬이 남아 있지 않다", () => {
    for (const seed of DEMO_SESSIONS) {
      for (const line of [...seed.greenChecks, ...seed.coachingPoints]) {
        // 「상황·배경·관찰·요청이 모두 들어간 인계입니다」(B02 SBAR)는 실제로 넷을 세는
        // 자리라 그대로 둡니다 — 사라져야 하는 것은 5요소를 단정하던 보고 칭찬입니다.
        expect(line, seed.scenarioId).not.toContain("누가·언제·무엇을");
        expect(line, seed.scenarioId).not.toContain("5요소");
      }
    }
  });
});
