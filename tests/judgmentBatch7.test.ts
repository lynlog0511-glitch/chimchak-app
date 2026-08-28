/**
 * 16차 개선 배치 A — 판정 결함 일괄 (2026-08-28).
 *
 * 15차 최종 감사(engine 렌즈 + critic)가 짚은 자리를 **자리째** 못 박는다.
 * 고쳤다는 말이 아니라 다시 무너지지 않게 하는 것이 목적이라, describe 머리마다
 * 「무엇이 어떻게 무너져 있었는가」를 감사 원본의 실측 문장과 함께 적는다.
 *
 *  ① 보고 CUE에서 「내가 한 억제」를 사실대로 적으면 ⚑CF — 세션이 재훈련으로 고정 (high)
 *  ② 성찰 CUE의 대표 문형 「다음엔 ~기 전에」가 ⚑CF (high)
 *  ③ B02 CUE-3 — 119를 부르고 의식을 확인하면 「말 걸기만」 감점으로 뒤집힘 (high)
 *  ④ A02 CUE-3 — 홑 「아침에」·「내일」이 정답을 감점으로 (med)
 *  ⑤ B01 CUE-1 — 「하던 일을 멈추고」가 「계속함」 감점으로 (med)
 *  ⑥ R1-a·V-a 과잉 칭찬 — 개수가 보증하지 않는 사실을 단언 (med)
 *  ⑦ 면죄 표지 「상태를 점검」이 부사 하나로 무너짐 (med)
 *  ⑧ C01 CUE-2 — 홑 「죄송합니다」가 모범 문장을 감점으로 (med)
 *  ⑨ A01 CUE-T1·T1B — 두 글자 「그만」이 완곡한 청유를 「큰 소리로 제지」로 (med)
 *  ⑩ validateAllScenarios가 elementJudge를 한 줄도 검사하지 않음 (low)
 */

import { describe, expect, it } from "vitest";
import type { CueDef, Scenario } from "@/types";
import { CHK_A01, CHK_A02, CHK_B01, CHK_B02, CHK_C01, SCENARIOS, validateScenarioGraph } from "@/data/scenarios";
import { classifyInput } from "@/engine/classify";
import { checkCritical, isPastReportForm, normalize, type RuleCheckOptions } from "@/engine/rules";

/* ── 도우미 ────────────────────────────────────────────── */

function cueOf(s: Scenario, turnId: string): CueDef {
  const turn = s.turns.find((t) => t.id === turnId);
  if (!turn?.cue) throw new Error(`${s.id} ${turnId}: CUE가 없습니다`);
  return turn.cue;
}

/** 세션이 실제로 넘기는 것과 **같은 문맥** (engine/session.ts submitResponse) */
function ctx(s: Scenario, cue: CueDef): RuleCheckOptions {
  return {
    scenarioType: s.type,
    scenarioId: s.id,
    cueId: cue.id,
    appliedRubric: s.appliedRubric,
  };
}

function branchOf(s: Scenario, turnId: string, utterance: string): string {
  return classifyInput(cueOf(s, turnId), { utterance }).branch.id;
}

/* ── ① 보고 CUE — 사실대로 적은 억제는 벌하지 않는다 ─────────────
   감사 실측: A01 CUE-4 "16시 40분 어르신이 현관에서 나가시려 하셔서 제가 팔을 붙잡았습니다.
   현재는 소파에 앉아 계십니다." → ⚑CF(CF-RESTRAINT·표지 「붙잡」).
   ⚑CF 한 건이면 §4.6 규칙 1)로 세션 종합 판정이 「재훈련」에 고정되므로, 사실대로 적은
   사람만 재훈련을 받았다. 앱이 「억제한 사실은 보고하지 말라」를 가르치던 자리다. */

describe("보고 CUE — 끝난 일을 사실대로 적은 문장은 멈춰 세우지 않는다", () => {
  const 보고: [Scenario, string, string][] = [
    [
      CHK_A01,
      "T4",
      "16시 40분 어르신이 현관에서 나가시려 하셔서 제가 팔을 붙잡았습니다. 현재는 소파에 앉아 계십니다.",
    ],
    [
      CHK_A01,
      "T4",
      "16시 40분 어르신이 현관에서 나가시려 하셔서 제가 앞을 막아섰습니다. 현재는 소파에 앉아 계십니다.",
    ],
    [
      CHK_A02,
      "T5",
      "새벽 2시 10분 최 어르신이 현관 앞에 서 계셔서 제가 앞을 가로막았습니다. 지금은 방에서 주무십니다.",
    ],
    [CHK_A01, "T-2", "따님, 오늘 16시 40분에 나가시려 해서 제가 팔을 붙잡았습니다. 지금은 소파에 앉아 계십니다."],
    // 사전 신호가 과거 활용형을 그대로 담고 있는 자리(「잠갔」) — 매치 안에 숨은 과거 표지다.
    [CHK_A01, "T4", "어르신이 나가시려 해서 제가 현관 문을 잠갔습니다. 지금은 안정되셨습니다."],
    [CHK_B01, "T4", "넘어지시려 해서 제가 팔을 붙잡았습니다. 현재는 침대에 누워 계십니다."],
    [CHK_C01, "T5", "보호자께서 요구하셔서 제가 앞을 가로막았습니다. 지금은 귀가하셨습니다."],
  ];

  for (const [scenario, turnId, utterance] of 보고) {
    it(`${scenario.id} ${turnId} · ${utterance.slice(0, 22)}… — 통과한다`, () => {
      const cue = cueOf(scenario, turnId);
      expect(checkCritical(utterance, ctx(scenario, cue)).cf, utterance).toBe(false);
    });
  }

  /* 면제되는 것은 **과거 완료형 하나**다. 지금 하고 있거나 앞으로 하겠다는 말은 보고 자리에서도
     그대로 멈춰 세운다 — 이 단언이 깨지면 게이트가 자리를 통째로 비운 것이다. */
  const 여전히_CF = [
    "지금 어르신 팔을 붙잡고 있습니다.",
    "계속 붙잡아 두겠습니다.",
    "앞으로도 현관 문을 잠가 두겠습니다.",
    "밤에는 방문을 잠급니다.",
    "억제대를 채우고 있습니다.",
    // 과거를 적어 놓고 앞으로도 그렇게 하겠다고 이으면 보고가 아니라 선언이다.
    "제가 팔을 붙잡았습니다. 앞으로도 그렇게 하겠습니다.",
    "제가 앞을 막아섰습니다. 오늘부터 그렇게 합니다.",
  ];

  for (const utterance of 여전히_CF) {
    it(`보고 자리에서도 멈춘다 · ${utterance}`, () => {
      const cue = cueOf(CHK_A01, "T4");
      expect(checkCritical(utterance, ctx(CHK_A01, cue)).ruleId, utterance).toBe("CF-RESTRAINT");
    });
  }

  /* 게이트가 **그 시나리오의 그 자리**에서만 열린다는 것이 이 조의 핵심이다.
     cue id는 시나리오끼리 겹친다 — A01 CUE-4는 기관 보고이고 A02 CUE-4는 어르신이 눈앞에
     계신 실시간 대체 행동 유도다. id만으로 게이트를 걸면 뒤쪽이 함께 열린다. */
  it("같은 cue id라도 실시간 자리는 열리지 않는다 (A02 CUE-4)", () => {
    const cue = cueOf(CHK_A02, "T4");
    expect(checkCritical("어르신 팔을 붙잡았습니다.", ctx(CHK_A02, cue)).ruleId).toBe("CF-RESTRAINT");
    expect(checkCritical("팔을 붙잡아 방으로 데려가겠습니다.", ctx(CHK_A02, cue)).ruleId).toBe("CF-RESTRAINT");
  });

  it("문맥을 모르면 보수적으로 잡는다 (시나리오 id 없이는 게이트가 없다)", () => {
    expect(checkCritical("제가 팔을 붙잡았습니다.").ruleId).toBe("CF-RESTRAINT");
    expect(checkCritical("제가 팔을 붙잡았습니다.", { cueId: "CUE-4" }).ruleId).toBe("CF-RESTRAINT");
  });

  it("과거 완료형 판별은 「겠」·「있」을 과거로 세지 않는다", () => {
    // 두 번째 인자는 **매치 끝 위치**다 — 「앞을 막」 뒤의 「아섰습니다」가 과거다.
    expect(isPastReportForm(normalize("붙잡았습니다"), 2)).toBe(true);
    expect(isPastReportForm(normalize("앞을 막아섰습니다"), 3)).toBe(true);
    expect(isPastReportForm(normalize("붙잡겠습니다"), 2)).toBe(false);
    expect(isPastReportForm(normalize("붙잡고 있습니다"), 2)).toBe(false);
  });
});

/* ── ② 성찰 CUE — 「~기 전에」는 순서를 뒤집는 말이다 ────────────
   감사 실측: A01 CUE-6 "다음엔 막아서기 전에 어디가 불편하신지 먼저 여쭙겠습니다" → ⚑CF.
   면죄 표지가 사동 보조동사 꼴(「하기전」)뿐이라 어간이 「하」로 끝날 때만 닿았다.
   성찰은 「오늘 대응에서 한 가지만 고친다면?」을 묻는 자리라 금지 행위의 이름이 들어오는 것이
   정상이고, 이 문형이 그 자리의 1순위 답이다. */

describe("성찰 CUE — 「다음엔 ~기 전에 …하겠습니다」는 모범이다", () => {
  const 대표문형: [Scenario, string, string][] = [
    [CHK_A01, "T6", "다음엔 막아서기 전에 어디가 불편하신지 먼저 여쭙겠습니다."],
    [CHK_A01, "T6", "다음엔 문을 잠그기 전에 어디가 불편하신지 먼저 여쭙겠습니다."],
    [CHK_A02, "T7", "다음엔 붙잡기 전에 어디가 불편하신지 먼저 여쭙겠습니다."],
    // 예전부터 통과하던 사동 보조동사 꼴 — 함께 지킨다.
    [CHK_A02, "T7", "다음엔 못 나가시게 하기 전에 어디가 불편하신지부터 여쭙겠습니다."],
  ];

  for (const [scenario, turnId, utterance] of 대표문형) {
    it(`${scenario.id} ${turnId} · ${utterance.slice(0, 18)}… — 통과한다`, () => {
      const cue = cueOf(scenario, turnId);
      expect(checkCritical(utterance, ctx(scenario, cue)).cf, utterance).toBe(false);
    });
  }

  it("성찰 표지 뒤에 실행 선언이 붙으면 다시 멈춘다", () => {
    const cue = cueOf(CHK_A02, "T7");
    expect(checkCritical("다음엔 붙잡기 전에 말씀드리고 그렇게 하겠습니다.", ctx(CHK_A02, cue)).ruleId).toBe(
      "CF-RESTRAINT",
    );
    const a01 = cueOf(CHK_A01, "T6");
    expect(checkCritical("다음엔 문을 잠그기 전에 말씀드리고 오늘부터 그렇게 합니다.", ctx(CHK_A01, a01)).ruleId).toBe(
      "CF-RESTRAINT",
    );
  });

  it("목적어가 적힌 잠금 선언은 「기 전에」로도 빠져나가지 않는다", () => {
    // 목적어가 없는 꼴("다음엔 잠그기 전에…")은 이 사전이 원래 잡지 못하는 자리다
    // (rules.ts 머리주석 한계 ⑤ — 이 검사 전부터 그랬고, 이번 라운드가 바꾼 것이 아니다).
    expect(checkCritical("다음엔 문을 잠그기 전에 보고하고 오늘부터 그렇게 합니다.").ruleId).toBe("CF-RESTRAINT");
    expect(checkCritical("다음엔 잠그기 전에 보고하고 오늘부터 그렇게 합니다.").cf).toBe(false);
  });

  it("성찰·재발 방지 자리의 앞으로의 행위 선언은 그대로 멈춘다", () => {
    // 좁힌 사전이 놓친 말을 받아 줄 ⚑CF 분기가 이 자리에 없다는 사실은 그대로다(rules.ts 주석).
    expect(checkCritical("다음엔 끌고 들어옵니다.", { scenarioType: "BPSD", scenarioId: "CHK-A01", cueId: "CUE-5" }).cf).toBe(
      true,
    );
    expect(
      checkCritical("다음엔 손목을 잡고 있겠습니다.", {
        scenarioType: "BPSD",
        scenarioId: "CHK-A02",
        cueId: "CUE-7",
      }).cf,
    ).toBe(true);
  });
});

/* ── ③ B02 CUE-3 — 119를 부르고 확인하면 「말 걸기만」이 아니다 ────
   감사 실측 2건. D3-b가 감점(gaugeDelta > 0)이라 심각도 순위에서 D3-a를 이겨,
   CO-03이 4점 대신 2점으로 적립되고 SA-06·SA-07 4점이 열리지 않았다. */

describe("B02 CUE-3 — 119를 부른 답이 「말 걸기만」으로 뒤집히지 않는다", () => {
  const 모범 = [
    "119에 신고하고 계속 기침하시도록 말을 걸겠습니다.",
    "지금 바로 119에 신고하겠습니다. 어르신 이름을 부르며 의식을 확인하겠습니다.",
    "119! 지금 신고하겠습니다. 소리를 못 내십니다.",
    "구급차 부르고 어르신 이름을 부르며 의식을 확인하겠습니다.",
  ];

  for (const utterance of 모범) {
    it(`D3-a로 간다 · ${utterance}`, () => {
      expect(branchOf(CHK_B02, "T3", utterance), utterance).toBe("D3-a");
    });
  }

  const 여전히_D3b = [
    "어르신! 괜찮으세요? 어르신!",
    "계속 등을 두드리겠습니다.",
    "어르신 이름을 부르며 흔들어 깨우겠습니다.",
    // 주제 조사 「는」으로 미루는 말은 부재 조건을 켜지 못한다 — 지연을 재는 자리가 열리면 안 된다.
    "119는 조금 있다 부르고 등을 두드리겠습니다.",
  ];

  for (const utterance of 여전히_D3b) {
    it(`D3-b가 그대로 선다 · ${utterance}`, () => {
      expect(branchOf(CHK_B02, "T3", utterance), utterance).toBe("D3-b");
    });
  }

  it("신고하지 않기로 한 판단은 ⚑CF 그대로다", () => {
    expect(branchOf(CHK_B02, "T3", "119까지는 부르지 않고 조금 더 지켜보겠습니다")).toBe("D3-d");
    expect(branchOf(CHK_B02, "T3", "119는 안 부르고 이름만 부르겠습니다")).toBe("D3-d");
  });
});

/* ── ④ A02 CUE-3 — 통보 시점을 정한 말은 「재우려 함」이 아니다 ────
   감사 실측: "…당직 간호사께 알린 뒤, 아침에 시설장님께도 전달하겠습니다" → P3-d 감점.
   같은 회차 CUE-5에서는 같은 말("아침에 시설장님을 통해 알리겠습니다")이 SA-07 4점 모범이었다.
   한 회차 안에서 정반대를 가르치던 자리다. */

describe("A02 CUE-3 — 홑 시간어가 정답을 감점으로 뒤집지 않는다", () => {
  const 모범 = [
    "무릎이 언제부터 아프셨는지 여쭤보고 당직 간호사께 알린 뒤, 아침에 시설장님께도 전달하겠습니다.",
    "무릎이 언제부터 아프셨는지 여쭤보고 당직 간호사께 알리겠습니다. 내일 낮에 보호자께도 말씀드리겠습니다.",
  ];

  for (const utterance of 모범) {
    it(`P3-a로 간다 · ${utterance.slice(0, 20)}…`, () => {
      expect(branchOf(CHK_A02, "T3", utterance), utterance).toBe("P3-a");
    });
  }

  const 여전히_P3d = [
    "그냥 들어가서 주무세요.",
    "오늘은 참으시고 아침에 보시죠.",
    "내일 다시 말씀해 주세요.",
    "원래 이맘때 그러십니다.",
  ];

  for (const utterance of 여전히_P3d) {
    it(`P3-d가 그대로 선다 · ${utterance}`, () => {
      expect(branchOf(CHK_A02, "T3", utterance), utterance).toBe("P3-d");
    });
  }

  it("CUE-3과 CUE-5가 같은 말을 서로 다르게 가르치지 않는다", () => {
    const 통보 = "아침에 시설장님을 통해 알리겠습니다";
    expect(branchOf(CHK_A02, "T3", `무릎 통증을 당직 간호사께 알리고, ${통보}`)).toBe("P3-a");
    expect(branchOf(CHK_A02, "T5", 통보)).toBe("R1-e");
  });
});

/* ── ⑤ B01 CUE-1 — 멈추겠다고 말한 사람을 「계속함」으로 찍지 않는다 ─ */

describe("B01 CUE-1 — 「하던 일을 멈추고」는 계속함이 아니다", () => {
  const 모범 = [
    "어르신, 그대로 계세요. 제가 하던 일을 멈추고 곁에서 어디가 아프신지 여쭤볼게요.",
    "하던 일을 멈추고 어르신 곁으로 가서 어디가 아프신지 여쭤보겠습니다.",
    "설거지를 멈추고 곁으로 가서 어디가 아프신지 여쭤보겠습니다.",
  ];

  for (const utterance of 모범) {
    it(`F1-a로 간다 · ${utterance.slice(0, 20)}…`, () => {
      expect(branchOf(CHK_B01, "T1", utterance), utterance).toBe("F1-a");
    });
  }

  const 여전히_F1d = [
    "괜찮다고 하시니 하던 일을 마저 하겠습니다.",
    "괜찮으시다니 설거지부터 끝내겠습니다.",
    // 부정 문맥이면 부재 조건이 켜지지 않는다 — 「멈추지 않고」는 계속하겠다는 말이다.
    "멈추지 않고 하던 일을 마저 하겠습니다.",
  ];

  for (const utterance of 여전히_F1d) {
    it(`F1-d가 그대로 선다 · ${utterance}`, () => {
      expect(branchOf(CHK_B01, "T1", utterance), utterance).toBe("F1-d");
    });
  }
});

/* ── ⑥ 요소 개수가 보증하지 않는 사실을 칭찬이 단언하지 않는다 ──── */

describe("보고 최상단 칭찬 — 개수가 보증하지 않는 것을 단언하지 않는다", () => {
  const 금지구 = [
    "그대로 급여제공기록지에 적을 수 있습니다",
    "이 문장만 보고 판단할 수 있습니다",
    "그대로 이어받을 수 있습니다",
  ];

  it("전 시나리오의 praise·coaching에 완결 단언이 없다", () => {
    const 남은: string[] = [];
    for (const scenario of SCENARIOS) {
      for (const turn of scenario.turns) {
        for (const branch of turn.cue?.branches ?? []) {
          for (const 구 of 금지구) {
            if (branch.praise?.includes(구)) 남은.push(`${scenario.id} ${branch.id} praise · ${구}`);
          }
        }
      }
    }
    expect(남은).toEqual([]);
  });

  it("2·3요소만 담긴 보고도 같은 갈래로 오므로 칭찬이 사실이어야 한다", () => {
    // 이 문장들이 최상단(R1-a)에 닿는다는 사실 자체는 그대로다 — 바뀐 것은 칭찬 문구다.
    expect(branchOf(CHK_A01, "T4", "어르신 현관 확인했고 현재 이상 없습니다.")).toBe("R1-a");
    expect(branchOf(CHK_A02, "T5", "어르신 확인했고 지금은 방에서 주무십니다.")).toBe("R1-a");
  });
});

/* ── ⑦ 면죄 표지 — 부사 하나로 무너지지 않는다 ─────────────────
   감사 실측 대조쌍: 같은 뜻의 두 문장이 어순 하나로 ⚑CF와 통과로 갈렸다. */

describe("잠금 상태 점검 — 어순이 판정을 가르지 않는다", () => {
  const 통과 = [
    "현관 문 잠금 상태를 저녁마다 점검하겠습니다.",
    "저녁마다 현관 문 잠금 상태를 점검하겠습니다.",
    "현관 문 잠금 상태를 매일 밤 확인하겠습니다.",
    "현관 잠금 장치를 매일 확인하겠습니다.",
    "현관 문 잠금 여부를 저녁마다 살펴보겠습니다.",
  ];

  for (const utterance of 통과) {
    it(`통과한다 · ${utterance}`, () => {
      expect(checkCritical(utterance).cf, utterance).toBe(false);
    });
  }

  const 여전히_CF = [
    // 살피는 말이 아니라 잠그겠다는 말이다.
    "저녁마다 현관 문을 잠그겠습니다.",
    // 앞 문장의 실행 선언이 뒤 문장의 점검으로 면죄되지 않는다 — 목적어를 매치 바로 뒤에서만
    // 받는 이유가 이 줄이다(넓히면 이 문장이 통째로 면죄된다).
    "문을 잠그겠습니다. 잠금 상태를 점검하겠습니다.",
  ];

  for (const utterance of 여전히_CF) {
    it(`멈춘다 · ${utterance}`, () => {
      expect(checkCritical(utterance).ruleId, utterance).toBe("CF-RESTRAINT");
    });
  }
});

/* ── ⑧ C01 CUE-2 — 「죄송합니다만 + 요구」는 무한 사과가 아니다 ─── */

describe("C01 CUE-2 — 완충어로 쓴 사과가 감점이 되지 않는다", () => {
  const 모범 = [
    "죄송합니다만 선생님이라고 불러주시면 감사하겠습니다.",
    "죄송합니다. 다만 선생님이라고 불러주시면 감사하겠습니다.",
  ];

  for (const utterance of 모범) {
    it(`D2-c로 간다 · ${utterance}`, () => {
      expect(branchOf(CHK_C01, "T2", utterance), utterance).toBe("D2-c");
    });
  }

  const 여전히_D2b = ["죄송합니다, 죄송합니다", "죄송합니다.", "제가 잘못했습니다."];

  for (const utterance of 여전히_D2b) {
    it(`D2-b가 그대로 선다 · ${utterance}`, () => {
      expect(branchOf(CHK_C01, "T2", utterance), utterance).toBe("D2-b");
    });
  }
});

/* ── ⑨ A01 CUE-T1·T1B — 「그만」은 완곡한 청유의 상투어다 ───────── */

describe("A01 3초 국면 — 완곡한 청유가 「큰 소리로 제지」가 되지 않는다", () => {
  const 모범 = [
    "어머님, 제 손 잡으시고 그만 가실까요? 신발부터 같이 신어요.",
    "어머님, 이제 그만 신발 신고 저랑 같이 나가실까요?",
  ];

  for (const utterance of 모범) {
    it(`TA-a로 간다 · ${utterance.slice(0, 18)}…`, () => {
      expect(branchOf(CHK_A01, "T-1", utterance), utterance).toBe("TA-a");
    });
  }

  const 여전히_제지 = ["어머님, 그거 누르시면 안 돼요!", "그만하세요!", "그만 좀 하세요."];

  for (const utterance of 여전히_제지) {
    it(`TA-c가 그대로 선다 · ${utterance}`, () => {
      expect(branchOf(CHK_A01, "T-1", utterance), utterance).toBe("TA-c");
    });
  }

  it("T1B도 같은 꼴로 판정한다 (두 트리거가 갈라지지 않는다)", () => {
    expect(branchOf(CHK_A01, "T-1B", "그만하세요!")).toBe("TB-c");
    expect(branchOf(CHK_A01, "T-1B", "어머님, 이제 그만 앉으실까요?")).not.toBe("TB-c");
  });
});

/* ── ⑩ 검증기 — elementJudge에도 그물이 있다 ──────────────────── */

describe("validateScenarioGraph — 요소 개수 판정 구조를 검사한다", () => {
  it("현행 데이터는 전부 통과한다", () => {
    for (const scenario of SCENARIOS) {
      expect(validateScenarioGraph(scenario), scenario.id).toEqual([]);
    }
  });

  /** 고의로 망가뜨린 사본을 만든다 (원본은 건드리지 않는다) */
  function 손상(mutate: (cue: CueDef) => void): Scenario {
    const copy = JSON.parse(JSON.stringify(CHK_A01)) as Scenario;
    const cue = copy.turns.find((t) => t.cue?.id === "CUE-4")?.cue;
    if (!cue) throw new Error("CUE-4를 찾지 못했습니다");
    mutate(cue);
    return copy;
  }

  it("단의 분기 id가 오타면 잡는다 (지금까지는 조용히 아래 단으로 떨어졌다)", () => {
    const broken = 손상((cue) => {
      cue.elementJudge!.tiers[0]!.branchId = "R1-오타";
    });
    expect(validateScenarioGraph(broken).join("\n")).toContain("R1-오타");
  });

  it("minCount가 그룹 수를 넘으면 잡는다 (그 단은 영원히 죽는다)", () => {
    const broken = 손상((cue) => {
      cue.elementJudge!.tiers[0]!.minCount = 99;
    });
    expect(validateScenarioGraph(broken).join("\n")).toContain("영원히 죽습니다");
  });

  it("단이 내림차순이 아니면 잡는다", () => {
    const broken = 손상((cue) => {
      cue.elementJudge!.tiers[1]!.minCount = 4;
    });
    expect(validateScenarioGraph(broken).join("\n")).toContain("내림차순");
  });

  it("요소 그룹의 표지가 비었거나 1글자면 잡는다", () => {
    const empty = 손상((cue) => {
      cue.elementJudge!.groups[0]!.patterns = [];
    });
    expect(validateScenarioGraph(empty).join("\n")).toContain("영원히 세어지지 않습니다");

    const tooShort = 손상((cue) => {
      cue.elementJudge!.groups[0]!.patterns = ["시"];
    });
    expect(validateScenarioGraph(tooShort).join("\n")).toContain("2글자 미만");
  });

  it("부재 조건의 1글자 표지도 잡는다", () => {
    const broken = 손상((cue) => {
      cue.branches[0]!.unlessPatterns = ["아"];
    });
    expect(validateScenarioGraph(broken).join("\n")).toContain("부재 조건");
  });
});
