/**
 * 판정 공정성 — 신작 2종(CHK-A02·CHK-C02)에서 시작해 **열린 5종 전부**로 소급했다.
 *
 * 감사에서 나온 한 문장으로 요약되는 결함을 고정한다 — **옳게 말한 사람이 벌받는 구조**.
 * 세 갈래였다.
 *  ① 회고 진술이 행위로 잡혔다 — C02 보고 구간의 "묶어두라는 요구가 있었습니다"가 ⚑CF.
 *     그 결과 모범 답안이 사실을 뭉개 적는 문장으로 쓰여 있었다(기록을 흐리라는 신호다).
 *  ② 미분류가 감점이었다 — 음성 인식이 빗나가면 「미보고」·「회피」·심지어 위기 엔딩.
 *  ③ 공감 발화가 갈 곳이 없었다 — "많이 아프셨겠어요"가 '재우려 함'으로 떨어졌다.
 *
 * 여기서 고정하는 원칙: **감점은 학습자가 실제로 그 말을 했을 때만** 붙는다.
 * 반대편도 같이 고정한다 — 게이트가 새어 다른 시나리오·다른 구간의 ⚑CF까지 꺼지면 안 된다.
 *
 * 소급 대상(감사 뒤에 발견된 것)
 *  - A01 CUE-T1의 기본값이 「대응 없음 — 문이 열림」(게이지 +2 · 위기 엔딩)이었다.
 *    말이 닿지 않은 사람에게 훈련 종료를 돌려주던 자리다.
 *  - B02는 중립 분기가 한 개도 없어, CUE-4에서 인식이 빗나가면 네 항목이 한꺼번에 1점이었다.
 *  - 엔딩 문구가 세션 사실을 단정했다 — 원인을 확인하고도 "확인하지 못했습니다"가 떴다.
 */

import { describe, expect, it } from "vitest";
import type { Scenario, SessionState } from "@/types";
import { CHK_A01, CHK_A02, CHK_B02, CHK_C02, SCENARIOS } from "@/data/scenarios";
import { RUBRIC } from "@/data/rubric";
import { classifyInput } from "@/engine/classify";
import { checkCritical } from "@/engine/rules";
import {
  advanceAfterCF,
  advanceAuto,
  buildRecord,
  currentCue,
  currentTurn,
  protocolIdOf,
  resumeFromProtocol,
  startSession,
  submitResponse,
  type SubmitInput,
} from "@/engine/session";

/* ── 도우미 ────────────────────────────────────────────── */

/**
 * CUE가 없는 자동 진행 턴(단서 턴)을 지나 다음 CUE까지 밀어 준다 — 화면과 같은 순서다.
 * L3 프로토콜 재생 구간(B02)은 화면이 재생을 마친 뒤 다리 턴의 autoNext로 돌아오므로,
 * 여기서도 같은 규약으로 이어 붙인다.
 */
function step(s: Scenario, state: SessionState, input: SubmitInput) {
  const result = submitResponse(s, state, input);
  let next = result.state;
  for (let guard = 0; guard < 8; guard += 1) {
    if (next.status === "protocol") {
      const bridgeId = protocolIdOf(next);
      const bridge = bridgeId ? s.turns.find((t) => t.id === bridgeId) : undefined;
      if (!bridge?.autoNext) break;
      next = resumeFromProtocol(s, next, bridge.autoNext);
      continue;
    }
    if (next.status !== "running") break;
    const turn = currentTurn(s, next);
    if (!turn || turn.cue) break;
    const advanced = advanceAuto(s, next);
    if (advanced === next) break;
    next = advanced;
  }
  return { ...result, state: next };
}

/** 버튼 폴백만으로 경로 하나를 완주한다 (마이크 없이 완주 가능해야 한다는 계약과 같은 길). */
function walk(s: Scenario, branchIds: string[]) {
  let state = startSession(s);
  const visited: string[] = [];
  for (const branchId of branchIds) {
    visited.push(state.currentTurnId);
    const result = step(s, state, { branchId, viaButton: true });
    state = result.state;
    if (result.interrupted) return { state, visited, interrupted: true };
    if (state.status === "ended") break;
  }
  return { state, visited, interrupted: false };
}

function cueOf(s: Scenario, turnId: string) {
  const turn = s.turns.find((t) => t.id === turnId);
  if (!turn?.cue) throw new Error(`${s.id} ${turnId}: CUE가 없습니다`);
  return turn.cue;
}

function allCues(s: Scenario) {
  return s.turns.flatMap((turn) => (turn.cue ? [{ turnId: turn.id, cue: turn.cue }] : []));
}

/* ── ① 회고 진술은 행위가 아니다 (C02 보고·성찰 구간) ───── */

describe("C02 보고·성찰 구간의 ⚑CF 오탐", () => {
  const opts = { scenarioType: CHK_C02.type, appliedRubric: CHK_C02.appliedRubric };
  const 회고 = "보호자께서 밤에 침대에 묶어두라는 요구가 있었습니다.";

  it("보고 CUE에서 「묶어두라는 요구가 있었습니다」는 그대로 통과한다", () => {
    expect(checkCritical(회고, { ...opts, cueId: "CUE-C4" }).cf).toBe(false);
  });

  it("성찰 CUE에서도 같은 문장이 통과한다", () => {
    expect(checkCritical(회고, { ...opts, cueId: "CUE-C6" }).cf).toBe(false);
  });

  it("요구를 받는 그 자리(CUE-C1)에서는 수용 발화를 그대로 잡는다", () => {
    expect(checkCritical("말씀대로 밤에는 방문을 잠가 두겠습니다.", { ...opts, cueId: "CUE-C1" }).cf).toBe(
      true,
    );
  });

  it("앞으로의 행위를 말하는 재발 방지 제안(CUE-C5)은 게이트 밖이다", () => {
    expect(checkCritical("앞으로는 밤마다 방문을 잠가 두겠습니다.", { ...opts, cueId: "CUE-C5" }).cf).toBe(
      true,
    );
  });

  it("게이트가 다른 시나리오로 새지 않는다 — A02 CUE-4의 억제 판정은 그대로다", () => {
    // cue id는 시나리오끼리 겹친다(CUE-4는 A01 보고·A02 안전확보·C02 보고가 함께 쓴다).
    // C02 쪽 id를 CUE-C4로 유일하게 지은 이유가 이 줄이다.
    const hit = checkCritical("팔을 붙잡아 방으로 데려가겠습니다.", {
      scenarioType: CHK_A02.type,
      appliedRubric: CHK_A02.appliedRubric,
      cueId: "CUE-4",
    });
    expect(hit.cf).toBe(true);
    expect(hit.itemId).toBe("CO-02");
  });
});

describe("C02 모범 답안이 사실을 뭉개지 않는다", () => {
  const reportCue = cueOf(CHK_C02, "T4");
  const model = reportCue.branches.find((b) => b.id === "V-a")?.fallbackOption ?? "";

  it("모범 답안이 요구받은 말을 그대로 적는다", () => {
    expect(model).toContain("묶어두거나");
    expect(model).toContain("방문을 잠가 달라는 요구");
    // 사실을 흐리던 예전 표현이 남아 있지 않다.
    expect(model).not.toContain("못 움직이게 해 달라는");
  });

  it("그 모범 답안을 그대로 말해도 ⚑CF로 멈추지 않고 사실 보고로 판정된다", () => {
    const walked = walk(CHK_C02, ["B1-a", "B2-a", "K-a", "H-a", "W-a", "J-a"]);
    expect(walked.state.currentTurnId).toBe("T4");

    const result = step(CHK_C02, walked.state, { utterance: model, viaButton: false });
    expect(result.interrupted).toBe(false);
    expect(result.feedback.criticalFail).toBe(false);
    expect(result.feedback.branchId).toBe("V-a");
    expect(result.feedback.ok).toBe(true);
  });
});

/* ── ② 미분류는 감점이 아니다 ──────────────────────────── */

describe("보고 단계의 상식적인 문장이 「미보고」로 찍히지 않는다", () => {
  const C02_REPORTS = [
    "오후 5시쯤 보호자께서 어르신 왼팔에 멍이 있는 걸 보시고 물으셨습니다.",
    "제가 본 것과 확인되지 않은 것을 나눠 말씀드렸고, 그대로 보고드리겠습니다.",
    "보호자께서 침대에 묶어두라고 요구하셨고, 법으로 안 된다고 말씀드렸습니다.",
    "계약을 끊겠다고 하셨고, 촬영 요청도 있었던 사실을 함께 남깁니다.",
  ];

  const A02_REPORTS = [
    "새벽 2시 10분에 최 어르신이 현관 앞에 서 계셨습니다.",
    "무릎 통증을 말씀하셔서 당직 간호사께 알렸습니다.",
    "지금은 방에 들어가 주무시는 것을 확인했습니다.",
    "보호자께는 통화가 되지 않아 아침에 시설장님을 통해 알리겠습니다.",
  ];

  it.each(C02_REPORTS)("C02 보고 CUE — %s", (utterance) => {
    const cue = cueOf(CHK_C02, "T4");
    const branch = classifyInput(cue, { utterance }).branch;
    expect(branch.id).not.toBe("V-c"); // 미보고
    expect(branch.criticalFail ?? false).toBe(false);
    expect(
      checkCritical(utterance, {
        scenarioType: CHK_C02.type,
        appliedRubric: CHK_C02.appliedRubric,
        cueId: cue.id,
      }).cf,
    ).toBe(false);
  });

  it.each(A02_REPORTS)("A02 보고 CUE — %s", (utterance) => {
    const cue = cueOf(CHK_A02, "T5");
    const branch = classifyInput(cue, { utterance }).branch;
    expect(branch.id).not.toBe("R1-d"); // 미보고
    expect(branch.criticalFail ?? false).toBe(false);
  });

  it("A02는 보호자 통보 경로를 판단한 답을 따로 알아본다", () => {
    const cue = cueOf(CHK_A02, "T5");
    const branch = classifyInput(cue, {
      utterance: "보호자께는 통화가 되지 않아 아침에 시설장님을 통해 알리겠습니다.",
    }).branch;
    expect(branch.id).toBe("R1-e");
    expect(branch.rubricHits.map((h) => h.itemId)).toContain("SA-07");
  });

  it("정말로 「안 남기겠다」고 말했을 때만 미보고가 붙는다", () => {
    expect(classifyInput(cueOf(CHK_C02, "T4"), { utterance: "일이 커질까 봐 그냥 넘어가겠습니다" }).branch.id).toBe(
      "V-c",
    );
    expect(
      classifyInput(cueOf(CHK_A02, "T5"), { utterance: "밤에 늘 있는 일이라 따로 남기지 않겠습니다" }).branch.id,
    ).toBe("R1-d");
  });
});

describe("모든 CUE가 중립 미분류 분기를 기본값으로 둔다", () => {
  // 열린 5종 전부에 적용한다 — 새 시나리오를 얹는 순간 이 규칙이 자동으로 요구된다.
  for (const scenario of SCENARIOS) {
    for (const { turnId, cue } of allCues(scenario)) {
      it(`${scenario.id} ${turnId} ${cue.id}`, () => {
        const fallback = cue.branches.find((b) => b.id === cue.defaultBranchId);
        expect(fallback, `${cue.id}의 defaultBranchId가 분기에 없습니다`).toBeDefined();
        expect(fallback!.id.endsWith("-n")).toBe(true);
        expect(fallback!.label).toBe("무응답·미분류");
        // 신호가 없어야 한다 — 미분류 전용 자리이므로 어떤 발화도 여기로 '걸려서' 오면 안 된다.
        expect(fallback!.patterns).toEqual([]);
        // 감점도, 게이지 변동도 없다.
        expect(fallback!.rubricHits).toEqual([]);
        expect(fallback!.gaugeDelta).toBe(0);
        expect(fallback!.criticalFail ?? false).toBe(false);
      });
    }
  }

  it("알아듣지 못한 발화는 어느 CUE에서도 게이지를 올리지 않는다", () => {
    for (const scenario of SCENARIOS) {
      for (const { cue } of allCues(scenario)) {
        // 정규화하면 2글자 미만이 되는 잡음 — 분류기가 기본 분기로 보낸다.
        const branch = classifyInput(cue, { utterance: "음…" }).branch;
        expect(branch.id).toBe(cue.defaultBranchId);
        expect(branch.gaugeDelta).toBe(0);
      }
    }
  });
});

/* ── ③ A02 자동문 구간 — 미분류로 훈련이 끝나지 않는다 ──── */

describe("A02 자동문 구간(N-1)", () => {
  function atDoor() {
    // D1-a(사실 반박)로 들어가면 돌발 변수 N-1이 발동한다.
    const walked = walk(CHK_A02, ["D1-a"]);
    expect(walked.state.currentTurnId).toBe("T-N1");
    return walked.state;
  }

  it("미분류는 위기 엔딩으로 끝나지 않는다", () => {
    const result = step(CHK_A02, atDoor(), { utterance: "어… 그게요", viaButton: false });
    expect(result.feedback.branchId).toBe("NA-n");
    expect(result.state.status).toBe("running");
    expect(result.state.endingId).toBeUndefined();
    expect(result.state.currentTurnId).toBe("T2");
    expect(result.feedback.rubricHits).toEqual([]);
  });

  it("명시적 무행동을 골랐을 때만 문이 열린다", () => {
    const result = step(CHK_A02, atDoor(), {
      utterance: "아무것도 하지 않고 지켜봅니다",
      viaButton: false,
    });
    expect(result.feedback.branchId).toBe("NA-d");
    expect(result.state.status).toBe("ended");
    expect(result.state.endingId).toBe("E-위기");
  });

  it("위기 엔딩 지문이 두 경로(초조도 5 · 자동문 개방) 모두와 맞는다", () => {
    const ending = CHK_A02.endings.find((e) => e.id === "E-위기");
    expect(ending?.condition).toContain("초조도 5");
    // 문이 열리지 않은 경로에도 실종 신고를 단정하지 않는다.
    expect(ending?.message).toContain("나가신 경우");
    expect(ending?.title).not.toContain("경보");
  });
});

/* ── ④ 공감 발화가 감점 분기로 떨어지지 않는다 ──────────── */

describe("A02 통증 대응(CUE-3)의 공감 발화", () => {
  const cue = cueOf(CHK_A02, "T3");

  // 공감 발화가 '재우려 함'(P3-d)이나 미분류로 떨어지지 않고, 통증을 다루는 분기로 간다.
  it.each(["많이 아프셨겠어요", "얼마나 아프셨을까요", "밤새 쑤시셨겠어요", "많이 힘드셨겠어요"])(
    "%s → 통증을 다루는 분기",
    (utterance) => {
      expect(["P3-a", "P3-b"]).toContain(classifyInput(cue, { utterance }).branch.id);
    },
  );

  it("공감만 한 발화도 곁에 머무름(P3-b)까지는 인정받는다", () => {
    expect(classifyInput(cue, { utterance: "많이 아프셨겠어요" }).branch.id).toBe("P3-b");
  });

  it("통증을 여쭙고 당직 간호사께 알리는 답은 그대로 최상 분기다", () => {
    expect(
      classifyInput(cue, { utterance: "무릎이 언제부터 아프셨어요? 당직 간호사께 알리겠습니다" }).branch.id,
    ).toBe("P3-a");
  });

  it("정말로 재우려 했을 때만 감점 분기가 붙는다", () => {
    expect(classifyInput(cue, { utterance: "그냥 들어가서 주무세요" }).branch.id).toBe("P3-d");
  });
});

/* ── ⑤ 화면 문구 ──────────────────────────────────────── */

describe("화면에 나가는 문구", () => {
  function screenTexts(s: Scenario): { where: string; text: string }[] {
    const out: { where: string; text: string }[] = [];
    for (const turn of s.turns) {
      out.push({ where: `${s.id} ${turn.id}.text`, text: turn.text });
      if (turn.stageDirection) out.push({ where: `${s.id} ${turn.id}.stageDirection`, text: turn.stageDirection });
    }
    for (const trigger of s.triggers) {
      out.push({ where: `${s.id} ${trigger.id}.description`, text: trigger.description });
      out.push({ where: `${s.id} ${trigger.id}.condition`, text: trigger.condition });
    }
    for (const ending of s.endings) out.push({ where: `${s.id} ${ending.id}.message`, text: ending.message });
    return out;
  }

  it("지문·돌발 변수 설명에 채점 코드가 노출되지 않는다", () => {
    const leaked: string[] = [];
    for (const scenario of [CHK_A02, CHK_C02]) {
      for (const { where, text } of screenTexts(scenario)) {
        if (text.includes("측정:")) leaked.push(`${where} (측정 표기)`);
        if (/\b(SA|CO|RE|CL)-\d\d\b/.test(text)) leaked.push(`${where} (루브릭 항목 id)`);
        // 분기 id("D2-a")를 지문에 적으면 학습자가 채점표를 읽게 된다.
        if (/[가-힣]\(([A-Z]\d?-[a-z])\)/.test(text)) leaked.push(`${where} (분기 id)`);
      }
    }
    expect(leaked).toEqual([]);
  });

  it("지문(stageDirection)에 설계자 메모가 남아 있지 않다", () => {
    // 엔딩 문구의 "⚑CF는 아닙니다"처럼 학습자에게 설명하려고 쓴 표기는 그대로 둔다.
    // 여기서 막는 것은 **상황 지문 자리에 들어간 채점 설계 메모**다.
    const leaked: string[] = [];
    for (const scenario of [CHK_A02, CHK_C02]) {
      for (const turn of scenario.turns) {
        const text = turn.stageDirection;
        if (!text) continue;
        if (/⚑CF|보는 지점입니다|노출됩니다/.test(text)) leaked.push(`${scenario.id} ${turn.id}.stageDirection`);
      }
    }
    expect(leaked).toEqual([]);
  });

  it("A02의 칭찬·코칭 문구가 A01과 겹치지 않는다", () => {
    const collect = (s: Scenario): string[] =>
      s.turns.flatMap((turn) =>
        (turn.cue?.branches ?? []).flatMap((b) => [b.praise, b.coaching].filter((v): v is string => Boolean(v))),
      );
    const a01 = new Set(collect(CHK_A01));
    expect(collect(CHK_A02).filter((text) => a01.has(text))).toEqual([]);
  });

  it("C02에 고급 난이도의 근거가 되는 돌발 변수가 3개 있다", () => {
    expect(CHK_C02.triggers.map((t) => t.id)).toEqual(["C-1", "C-2", "C-3"]);
    const turn = CHK_C02.turns.find((t) => t.id === "T-C3");
    expect(turn?.isTrigger).toBe(true);
    // 어르신 청취(C-2) 다음, 보고(T4) 앞에 놓인다.
    for (const branch of cueOf(CHK_C02, "T-C2").branches) expect(branch.next).toBe("T-C3");
    for (const branch of cueOf(CHK_C02, "T-C3").branches) expect(branch.next).toBe("T4");
  });
});

/* ── ⑥ 워크스루 — 충족·부분·⚑CF·위기 ──────────────────── */

describe("워크스루 4경로", () => {
  it("A02 충족", () => {
    const { state } = walk(CHK_A02, ["D1-c", "D2-a", "P3-a", "M-a", "S4-a", "R1-a", "R2-a", "R3-a"]);
    expect(state.status).toBe("ended");
    expect(state.endingId).toBe("E-성공");
    const record = buildRecord(CHK_A02, state);
    expect(record.verdict).toBe("충족");
    expect(record.cfCount).toBe(0);
  });

  it("A02 부분 충족", () => {
    const { state } = walk(CHK_A02, ["D1-c", "D2-b", "P3-b", "M-b", "S4-c", "R1-b", "R2-b", "R3-b"]);
    expect(state.endingId).toBe("E-부분");
    expect(buildRecord(CHK_A02, state).verdict).toBe("부분 충족");
  });

  it("A02 ⚑CF — 인터럽트 뒤 같은 CUE로 돌아오고, 판정은 재훈련으로 고정된다", () => {
    const cf = walk(CHK_A02, ["D1-b-CF"]);
    expect(cf.interrupted).toBe(true);
    expect(cf.state.status).toBe("interrupted");
    expect(cf.state.cfCount).toBe(1);
    const resumed = advanceAfterCF(CHK_A02, cf.state);
    expect(resumed.status).toBe("running");
    expect(resumed.currentTurnId).toBe("T1");
    expect(currentCue(CHK_A02, resumed)?.id).toBe("CUE-1");
    expect(buildRecord(CHK_A02, resumed).verdict).toBe("재훈련");
  });

  it("A02 위기 — 초조도가 위기치에 닿으면 위기 엔딩", () => {
    const { state } = walk(CHK_A02, ["D1-a", "NA-c", "D2-d"]);
    expect(state.gauge).toBe(CHK_A02.gauge.max);
    expect(state.endingId).toBe("E-위기");
  });

  it("C02 충족", () => {
    const { state } = walk(CHK_C02, ["B1-a", "B2-a", "K-a", "H-a", "W-a", "J-a", "V-a", "X-a", "Y-a"]);
    expect(state.endingId).toBe("E-충족");
    const record = buildRecord(CHK_C02, state);
    expect(record.verdict).toBe("충족");
    expect(record.cfCount).toBe(0);
  });

  it("C02 부분 충족", () => {
    const { state } = walk(CHK_C02, ["B1-b", "B2-b", "K-b", "H-b", "W-a", "J-b", "V-b", "X-b", "Y-b"]);
    expect(state.endingId).toBe("E-부분");
    expect(buildRecord(CHK_C02, state).verdict).toBe("부분 충족");
  });

  it("C02 ⚑CF — 억제 요구를 수용하면 같은 CUE에서 멈춘다", () => {
    const cf = walk(CHK_C02, ["B1-a", "B2-a", "K-c"]);
    expect(cf.interrupted).toBe(true);
    expect(cf.state.currentTurnId).toBe("T-C1");
    expect(cf.state.cfCount).toBe(1);
    expect(buildRecord(CHK_C02, cf.state).verdict).toBe("재훈련");
  });

  it("C02 위기 — 긴장도가 위기치에 닿으면 결렬 엔딩", () => {
    const { state } = walk(CHK_C02, ["B1-c", "B2-c", "K-b", "H-c"]);
    expect(state.gauge).toBe(CHK_C02.gauge.max);
    expect(state.endingId).toBe("E-결렬");
  });

  it.each(SCENARIOS.map((s) => [s.id, s] as const))(
    "%s — 미분류만으로도 끝까지 완주된다 (감점 없이)",
    (_id, scenario) => {
      let state = startSession(scenario);
      for (let guard = 0; guard < 20 && state.status === "running"; guard += 1) {
        const result = step(scenario, state, { utterance: "음…", viaButton: false });
        expect(result.interrupted).toBe(false);
        state = result.state;
      }
      expect(state.status).toBe("ended");
      expect(state.gauge).toBe(scenario.gauge.start);
      expect(state.cfCount).toBe(0);
      expect(Object.keys(state.scores)).toEqual([]);
    },
  );
});

/* ── ⑦ A01 문고리 구간 — 미분류로 문이 열리지 않는다 ───── */

describe("A01 문고리 구간(T-1)", () => {
  function atDoor() {
    // D1-a(사실 반박)로 들어가면 돌발 변수 T-1이 발동한다.
    const walked = walk(CHK_A01, ["D1-a"]);
    expect(walked.state.currentTurnId).toBe("T-1");
    return walked.state;
  }

  it("미분류는 위기 엔딩으로 끝나지 않는다", () => {
    // 소급 전에는 이 자리의 기본값이 TA-d(게이지 +2 · end:E-위기)였다.
    const result = step(CHK_A01, atDoor(), { utterance: "어… 그게요", viaButton: false });
    expect(result.feedback.branchId).toBe("TA-n");
    expect(result.state.status).toBe("running");
    expect(result.state.endingId).toBeUndefined();
    expect(result.state.currentTurnId).toBe("T2");
    expect(result.feedback.rubricHits).toEqual([]);
    expect(result.state.gauge).toBe(CHK_A01.gauge.start + 2); // D1-a의 +2만 남는다
  });

  it("명시적 무행동을 골랐을 때만 문이 열린다", () => {
    const result = step(CHK_A01, atDoor(), {
      utterance: "아무것도 하지 않고 지켜봅니다",
      viaButton: false,
    });
    expect(result.feedback.branchId).toBe("TA-d");
    expect(result.state.status).toBe("ended");
    expect(result.state.endingId).toBe("E-위기");
  });
});

/* ── ⑧ B02 — 응급 구간에서 인식이 빗나가도 낙인되지 않는다 ── */

describe("B02 응급 구간의 미분류", () => {
  it("CUE-1의 미분류가 「관찰만 하고 대기」로 기록되지 않는다", () => {
    const result = step(CHK_B02, startSession(CHK_B02), { utterance: "음…", viaButton: false });
    expect(result.feedback.branchId).toBe("D1-n");
    expect(result.feedback.rubricHits).toEqual([]);
    // 관찰 지연으로 돌발 변수(T-1)가 앞당겨지지도 않는다.
    expect(result.state.currentTurnId).toBe("T2");
  });

  it("상황실 응답(CUE-4)의 미분류가 네 항목을 한꺼번에 1점으로 만들지 않는다", () => {
    const walked = walk(CHK_B02, ["D1-a", "D2-a", "D3-a"]);
    expect(walked.state.currentTurnId).toBe("T4");
    const result = step(CHK_B02, walked.state, { utterance: "음…", viaButton: false });
    expect(result.feedback.branchId).toBe("Q-n");
    expect(result.feedback.rubricHits).toEqual([]);
  });

  it("정말로 그렇게 답했을 때만 감점 분기가 붙는다", () => {
    expect(classifyInput(cueOf(CHK_B02, "T1"), { utterance: "일단 지켜봅니다" }).branch.id).toBe("D1-b");
    expect(
      classifyInput(cueOf(CHK_B02, "T5"), { utterance: "따로 드릴 말씀이 없습니다" }).branch.id,
    ).toBe("S-d");
    expect(
      classifyInput(cueOf(CHK_B02, "T6"), { utterance: "병원에서 알아서 처리할 테니 따로 남기지 않겠습니다" })
        .branch.id,
    ).toBe("M-c");
  });
});

/* ── ⑨ CO-03 「미신고 ⚑」가 실제로 열린다 ─────────────── */

describe("B02 CUE-3의 신고 거부 ⚑CF", () => {
  const cue = cueOf(CHK_B02, "T3");

  it("루브릭 앵커가 가리키는 분기가 데이터에 있다", () => {
    const branch = cue.branches.find((b) => b.id === "D3-d");
    expect(branch?.criticalFail).toBe(true);
    expect(branch?.rubricHits).toEqual([{ itemId: "CO-03", score: 1 }]);
    expect(branch?.cfMessage).toBeTruthy();
    expect(branch?.cfAlternatives?.length).toBe(3);
    // CO-03의 근거 문서는 루브릭과 같은 것을 쓴다.
    expect(branch?.docId).toBe(RUBRIC.find((item) => item.id === "CO-03")?.docId);
  });

  it("신고하지 않겠다고 말하면 그 자리에서 멈춘다", () => {
    const walked = walk(CHK_B02, ["D1-a", "D2-a"]);
    expect(walked.state.currentTurnId).toBe("T3");
    const result = step(CHK_B02, walked.state, {
      utterance: "119까지는 부르지 않고 조금 더 지켜보겠습니다",
      viaButton: false,
    });
    expect(result.interrupted).toBe(true);
    expect(result.feedback.criticalFail).toBe(true);
    // 규칙 사전이 아니라 이 데이터 분기가 멈춘 것이어야 화면에 CO-03 문구·대안이 뜬다.
    expect(result.feedback.branchId).toBe("D3-d");
    expect(result.feedback.rubricHits).toEqual([{ itemId: "CO-03", score: 1 }]);
    expect(result.state.cfCount).toBe(1);
    const resumed = advanceAfterCF(CHK_B02, result.state);
    expect(resumed.currentTurnId).toBe("T3");
  });

  it("신고하겠다는 말은 ⚑CF에 걸리지 않는다", () => {
    for (const utterance of [
      "119! 지금 신고하겠습니다. 소리를 못 내십니다.",
      "지금 119를 부르겠습니다",
      "119를 안 부르면 안 됩니다, 바로 신고하겠습니다",
    ]) {
      const branch = classifyInput(cue, { utterance }).branch;
      expect(branch.criticalFail ?? false).toBe(false);
      expect(branch.id).toBe("D3-a");
    }
  });
});

/* ── ⑩ 근거 칩이 루브릭 근거와 어긋나지 않는다 ──────────── */

describe("B02의 CO-01 ⚑CF 근거 문서", () => {
  const cfBranches = CHK_B02.turns
    .flatMap((turn) => turn.cue?.branches ?? [])
    .filter((branch) => branch.criticalFail);

  it("무면허 의료행위 경계 분기는 루브릭 CO-01과 같은 문서를 인용한다", () => {
    const co01Doc = RUBRIC.find((item) => item.id === "CO-01")?.docId;
    for (const id of ["D1-d", "D3-c"]) {
      expect(cfBranches.find((b) => b.id === id)?.docId, id).toBe(co01Doc);
    }
  });

  it("관찰·체위 오류 분기는 응급처치 안내 문서를 그대로 쓴다", () => {
    for (const id of ["D1-c", "D1-e"]) {
      expect(cfBranches.find((b) => b.id === id)?.docId, id).toBe("DOC-GUIDE-004");
    }
  });

  it("선언한 sourceDocs가 전부 실제로 인용된다", () => {
    const cited = new Set<string>();
    for (const turn of CHK_B02.turns) {
      for (const branch of turn.cue?.branches ?? []) {
        if (branch.docId) cited.add(branch.docId);
      }
    }
    expect(CHK_B02.sourceDocs.filter((id) => !cited.has(id))).toEqual([]);
  });
});

/* ── ⑪ 엔딩 문구가 세션 사실을 단정하지 않는다 ─────────── */

describe("부분 충족 엔딩 문구", () => {
  // 이 엔딩은 마지막 돌아보기 CUE 하나로 갈린다. 원인을 확인하고도·즉시 신고하고도·기록을
  // 남기고도 뜨므로, 특정 실패를 단정하는 문장이 들어가면 세션 사실과 어긋난다.
  const ASSERTIONS = [
    "확인하지 못했습니다",
    "남지 않았습니다",
    "먼저 119를 눌러",
    "기록으로 남겨야 남습니다",
    "원인을 확인하지",
  ];

  function partialEndings(s: Scenario) {
    return s.endings.filter((e) => e.verdict === "부분 충족");
  }

  it.each(SCENARIOS.map((s) => [s.id, s] as const))("%s", (_id, scenario) => {
    const partial = partialEndings(scenario);
    expect(partial.length).toBeGreaterThan(0);
    for (const ending of partial) {
      expect(ending.message).toContain("돌아보기");
      for (const phrase of ASSERTIONS) {
        expect(ending.message, `${scenario.id} ${ending.id}`).not.toContain(phrase);
      }
    }
  });

  // 제목에도 같은 기준을 건다. message만 고쳐 두면 제목이 반대말을 하는데, 제목은 종료 화면
  // 부제(EndingPanel)와 /history 회차 카드에 그대로 실리므로 화면에서 정면으로 어긋난다.
  it.each(SCENARIOS.map((s) => [s.id, s] as const))("%s — 제목", (_id, scenario) => {
    for (const ending of partialEndings(scenario)) {
      const where = `${scenario.id} ${ending.id}`;
      // 갈림 사유(마지막 한 문장)를 적는다 — 이 엔딩이 실제로 무엇으로 갈렸는지가 제목이다.
      expect(ending.title, where).toContain("한 문장");
      // 「A는 했지만 B는 못했다」 꼴을 막는다. 다섯 종의 옛 제목이 전부 이 구문으로
      // 세션이 보장하지 않는 실패(원인·시간·기록)를 단정하고 있었다.
      expect(ending.title, where).not.toContain("지만");
      for (const phrase of ASSERTIONS) {
        expect(ending.title, where).not.toContain(phrase);
      }
      // 판정 낱말은 화면에 세우지 않는다(EndingPanel이 원·문장으로만 알린다).
      for (const verdict of ["부분 충족", "충족", "재시도", "재훈련"]) {
        expect(ending.title, where).not.toContain(verdict);
      }
    }
  });

  // 제목이 세션 사실을 단정하지 않아도 되는 근거 — 이 엔딩으로 오는 길이 마지막 CUE 하나뿐이다.
  // 중간 구간에서도 올 수 있게 되는 순간 「한 문장이 남았습니다」가 거짓이 되므로 여기서 막는다.
  it.each(SCENARIOS.map((s) => [s.id, s] as const))("%s — 마지막 CUE에서만 온다", (_id, scenario) => {
    const partialIds = new Set(partialEndings(scenario).map((e) => `end:${e.id}`));
    const lastTurnId = scenario.turns[scenario.turns.length - 1]?.id;
    for (const turn of scenario.turns) {
      for (const branch of turn.cue?.branches ?? []) {
        if (!partialIds.has(branch.next ?? "")) continue;
        expect(turn.id, `${scenario.id} ${turn.id} ${branch.id}`).toBe(lastTurnId);
      }
    }
    // 게이지가 위기치에 닿았을 때 가는 곳도 부분 충족이 아니어야 한다.
    expect(partialIds.has(`end:${scenario.gauge.crisisEndingId}`)).toBe(false);
  });
});
