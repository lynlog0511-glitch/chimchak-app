/**
 * 7차 개선 배치 A — 판정 핫픽스 (2026-08-27).
 *
 * 현직 요양보호사·교육생 7차 검증에서 나온 **6차가 새로 연 자리**를 자리째 못 박는다.
 * 고쳤다는 말이 아니라 다시 무너지지 않게 하는 것이 목적이라, 각 describe 머리에
 * 「무엇이 어떻게 무너져 있었는가」를 함께 적는다. 문장은 대부분 평가 원본의
 * failure_scenario를 그대로 옮긴 것이다.
 *
 *  ① 사다리 밖 갈래의 낡은 광폭 표지 — 「나중에」·「밤새」 (현직 high · 교육생 high)
 *  ② 조립 코칭이 규칙 사전 경고를 덮어쓴다 (교육생 high)
 *  ③ 조립 문장의 나열 구분자 (현직 low · 교육생 med)
 *  ④ 종료 화면·이력에 남는 데이터 코칭이 방금 한 말을 인용한다 (교육생 med)
 *  ⑤ A02 R1-e 과열 — 기관 안 알림만으로 통보 경로 칭찬 (현직 low)
 *  ⑥ 이동 목적의 휠체어 안전벨트 「채우고」 (현직 med)
 *  ⑦ 「잠깐만요」가 원인을 묻는 질문을 감점으로 찍는다 (교육생 low)
 */

import { describe, expect, it } from "vitest";
import type { BranchDef, CueDef, Scenario } from "@/types";
import { CHK_A01, CHK_A02, CHK_B02, CHK_C02, SCENARIOS } from "@/data/scenarios";
import { classifyInput } from "@/engine/classify";
import { currentTurn } from "@/engine";
import { checkCritical } from "@/engine/rules";
import { initialTrainState, makeTrainReducer } from "@/app/train/_components/sessionMachine";
import { partialReportCoaching } from "@/app/train/_components/constants";
import type { TrainState } from "@/app/train/_components/sessionMachine";

/* ── 도우미 ────────────────────────────────────────────── */

function cueOf(s: Scenario, turnId: string): CueDef {
  const turn = s.turns.find((t) => t.id === turnId);
  if (!turn?.cue) throw new Error(`${s.id} ${turnId}: CUE가 없습니다`);
  return turn.cue;
}

/** 요소 판정(사다리)을 쓰는 보고 CUE 전부 — 새 시나리오가 늘어도 이 목록이 함께 자란다. */
function reportCues(): { scenario: Scenario; turnId: string; cue: CueDef }[] {
  return SCENARIOS.flatMap((scenario) =>
    scenario.turns
      .filter((turn) => turn.cue?.elementJudge)
      .map((turn) => ({ scenario, turnId: turn.id, cue: turn.cue as CueDef })),
  );
}

/** 사다리(tiers)에 이름이 없는 갈래 = 이번 회귀가 난 자리 (미분류 제외) */
function outsideLadder(cue: CueDef): BranchDef[] {
  const ladder = new Set((cue.elementJudge?.tiers ?? []).map((tier) => tier.branchId));
  return cue.branches.filter(
    (b) => !ladder.has(b.id) && b.id !== cue.defaultBranchId && b.criticalFail !== true,
  );
}

/** 버튼 폴백만 눌러 목표 CUE 앞까지 세션을 몰고 간다. */
function driveTo(scenario: Scenario, cueId: string): TrainState {
  const reduce = makeTrainReducer(scenario);
  let state = reduce(initialTrainState(scenario), { type: "start" });
  for (let guard = 0; guard < 40; guard += 1) {
    const turn = currentTurn(scenario, state.session);
    if (!turn?.cue || turn.cue.id === cueId) break;
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
  expect(currentTurn(scenario, state.session)?.cue?.id).toBe(cueId);
  return state;
}

/* ── ① 사다리 밖 갈래의 낡은 광폭 표지 ─────────────────────
   6차가 요소 판정 앞에 세운 「사다리 밖 선행 대조」(classify.ts matchOutsideLadder)는 옳지만,
   그 한 겹이 **낡은 표지에 새 힘을 실었다**. 사다리 밖 갈래는 최상단 보고도 이기는데
   (루브릭이 충족선 아래로 적립되는 갈래에 한해), 그 표지 목록이 힘없던 시절의 넓은 조각을
   그대로 들고 있었다 — R1-d(미보고)의 「나중에」, A02 R1-c(감정·추정)의 「밤새」.
   둘 다 잘못이 아니라 평범한 부사다. 그래서

    · 5요소를 다 갖춘 보고에 "보호자께는 나중에 말씀드리겠습니다" 한 마디만 붙으면 **미보고**로
      떨어지고 화면이 「보고 내용이 등록되지 않았습니다」를 세웠다(현직 7차 high —
      요양보호사에게 미보고는 행정처분이 걸린 낱말이다).
    · 감정 형용사가 한 개도 없는 4요소 야간 사실 보고가 「밤새」 두 글자로 감정·추정 갈래로
      내려가 「감정 형용사 대신 … 사실만 적어 주세요」를 들었다(교육생 7차 high).

   표지는 CHK-C02 V-c가 이미 들고 있던 모양(**선언형만**)으로 좁혔다. */

describe("사다리 밖 갈래 — 평범한 부사가 보고를 강등하지 않는다", () => {
  it("A01 — 5요소 보고 + 「보호자께는 나중에 말씀드리겠습니다」는 최상단 그대로 (현직 7차 failure_scenario)", () => {
    const result = classifyInput(cueOf(CHK_A01, "T4"), {
      utterance:
        "16시 40분 어르신이 현관에서 귀가를 요구하셨고, 화장실 안내 후 젖은 옷을 갈아입으시도록 도왔습니다. 현재는 거실 소파에 앉아 계십니다. 보호자께는 나중에 말씀드리겠습니다.",
    });
    expect(result.branch.id).toBe("R1-a");
    expect(result.branch.aiReaction).not.toContain("등록되지 않았습니다");
  });

  it("A02 — 4요소 야간 사실 보고 + 「밤새」는 최상단 그대로 (교육생·현직 7차 failure_scenario)", () => {
    for (const utterance of [
      "새벽 2시 10분 어르신이 무릎 통증을 말씀하셔서 당직 간호사께 알렸고, 밤새 곁에서 함께 걸었습니다. 지금은 방에서 주무십니다.",
      "새벽 2시 10분 어르신이 무릎 통증을 말씀하셔서 밤새 곁에서 함께 걸었습니다. 지금은 방에서 주무십니다.",
    ]) {
      const result = classifyInput(cueOf(CHK_A02, "T5"), { utterance });
      expect(result.branch.id, utterance).toBe("R1-a");
      expect(result.branch.coaching, utterance).toBeUndefined();
    }
  });

  it("A01 — 요소가 담긴 보고에 「나중에」가 붙어도 부분 보고로 받는다 (교육생 7차 med)", () => {
    const result = classifyInput(cueOf(CHK_A01, "T4"), {
      utterance: "어르신은 지금 소파에 앉아 계십니다. 나중에 상태를 한 번 더 살펴보겠습니다",
    });
    expect(result.branch.id).toBe("R1-b");
  });

  it("미보고 **선언**은 그대로 잡힌다 — 좁힌 것이 갈래를 비우지 않았다", () => {
    for (const [scenario, turnId, branchId, utterance] of [
      [CHK_A01, "T4", "R1-d", "별일 아니라서 따로 보고하지 않겠습니다"],
      [CHK_A01, "T4", "R1-d", "괜히 일 키우기 싫어서 보고 안 하겠습니다"],
      [CHK_A01, "T4", "R1-d", "어르신은 지금 소파에 앉아 계시고, 그냥 넘어가겠습니다"],
      [CHK_A02, "T5", "R1-d", "밤에 늘 있는 일이라 따로 남기지 않겠습니다"],
      [CHK_A02, "T5", "R1-d", "새벽 2시 10분 일은 별일 아니라서 보고 안 하겠습니다"],
      [CHK_C02, "T4", "V-c", "일이 커질까 봐 그냥 넘어가겠습니다"],
    ] as const) {
      expect(classifyInput(cueOf(scenario, turnId), { utterance }).branch.id, utterance).toBe(
        branchId,
      );
    }
  });

  it("감정·추정 갈래도 그대로 잡힌다 — 감정어·단정 진술은 남아 있다", () => {
    for (const [scenario, turnId, branchId, utterance] of [
      [CHK_A01, "T4", "R1-c", "어르신이 치매라서 자꾸 나가시려고 하셔서 힘들었습니다. 지금은 소파에 앉아 계십니다."],
      [CHK_A02, "T5", "R1-c", "어르신이 고집을 부리셔서 새벽 내내 힘들었습니다. 지금은 방에서 주무십니다."],
      [CHK_A02, "T5", "R1-c", "어르신이 일부러 그러시는 것 같아 밤새 지켜봤습니다. 지금은 방에서 주무십니다."],
      [CHK_C02, "T4", "V-b", "보호자께서 몰아세우셔서 억울했습니다"],
    ] as const) {
      expect(classifyInput(cueOf(scenario, turnId), { utterance }).branch.id, utterance).toBe(
        branchId,
      );
    }
  });

  /* 전수 그물 ① — 모범 보고에 **현장에서 늘 쓰는 중립 꼬리**를 붙여도 최상단이 유지되는가.
     이번 회귀는 모두 「모범 보고 + 평범한 한 마디 = 강등」이라는 한 모양이었다. */
  it("전 보고 CUE — 모범 보고에 중립 꼬리를 붙여도 최상단이 유지된다", () => {
    const tails = [
      "보호자께는 나중에 말씀드리겠습니다.",
      "나중에 한 번 더 살펴보겠습니다.",
      "밤새 곁에서 지켜봤습니다.",
      "제가 일부러 서두르지 않고 안내드렸습니다.",
      "그 밖에 특이사항은 없습니다.",
    ];
    for (const { scenario, turnId, cue } of reportCues()) {
      const top = cue.elementJudge?.tiers[0];
      const model = cue.branches.find((b) => b.id === top?.branchId)?.fallbackOption ?? "";
      expect(model.length, `${scenario.id} ${turnId}`).toBeGreaterThan(0);
      for (const tail of tails) {
        const utterance = `${model} ${tail}`;
        expect(classifyInput(cue, { utterance }).branch.id, `${scenario.id} ${tail}`).toBe(
          top?.branchId,
        );
      }
    }
  });

  /* 전수 그물 ② — 사다리 밖 갈래의 표지 목록을 **여기에 한 번 더 적어 둔다**.
     이 갈래들은 최상단 보고를 이기는 힘을 가졌으므로, 표지가 한 줄 늘어날 때마다
     「그것이 정말 감정어·단정 진술·미보고 선언인가」를 사람이 한 번 보게 만드는 자리다.
     데이터를 고치면 이 검사가 먼저 깨진다 — 그때 목록을 함께 고치면서 확인한다. */
  it("사다리 밖 갈래의 표지는 선언·감정어뿐이다 (증분 검토 게이트)", () => {
    const expected: Record<string, Record<string, string[]>> = {
      "CHK-A01/CUE-4": {
        "R1-c": [
          "힘들었",
          "당황",
          "황당",
          "무서웠",
          "짜증",
          "치매라서",
          "고집이 세셔서",
          "일부러 그러",
          "일부러 그런",
          "일부러 저러",
        ],
        "R1-d": ["보고 안", "보고하지 않", "따로 말씀 안", "별일 아니", "그냥 넘어가", "괜히 일 키"],
      },
      "CHK-A02/CUE-5": {
        "R1-c": [
          "힘들었",
          "당황",
          "무서웠",
          "짜증",
          "치매라서",
          "고집을 부리",
          "일부러 그러",
          "일부러 그런",
          "일부러 저러",
        ],
        "R1-d": [
          "늘 있는 일",
          "보고 안",
          "보고하지 않",
          "따로 말씀 안",
          "별일 아니",
          "그냥 넘어가",
          "괜히 일 키",
        ],
      },
      "CHK-C02/CUE-C4": {
        "V-b": ["억울", "무서웠", "황당", "어이없", "너무했", "불쾌", "기분 나쁘"],
        "V-c": ["그냥 넘어가", "보고 안", "말 안 하", "괜히 일 키", "별일 아니"],
      },
    };
    for (const { scenario, cue } of reportCues()) {
      const key = `${scenario.id}/${cue.id}`;
      const table = expected[key];
      expect(table, key).toBeDefined();
      for (const branch of outsideLadder(cue)) {
        // R1-e(통보 경로 판단)는 감정·미보고 계열이 아니라 아래 ⑤가 따로 본다.
        if (!table[branch.id]) continue;
        expect(branch.patterns, `${key} ${branch.id}`).toEqual(table[branch.id]);
      }
    }
  });
});

/* ── ② 조립 코칭이 규칙 사전 경고를 덮어쓴다 ────────────────
   최고 갈래(R1-a·V-a)에는 coaching이 없다. 그래서 그 갈래를 받은 턴에 규칙 사전 경고가 하나
   걸리면 엔진은 **규칙의 문구**를 화면 문장으로 내보낸다(session.ts). 6차가 그 위에 조립 코칭을
   얹으면서, 요소가 하나라도 빠져 있으면 그 문구가 통째로 「…까지 함께 적으시면」으로 바뀌었다.
   조립 조건에는 evidenceBlocked만 예외로 적혀 있고 advisory는 없었다(교육생 7차 high).
   남는 흔적은 기본이 닫힘인 접힘 안의 라벨 한 줄뿐이라, 이 앱이 처음부터 가르치는 두 가지
   (개인정보 노출·현실 직면 강요)가 화면에서 사라졌다. */

describe("조립 코칭 — 규칙 경고가 걸린 턴은 건드리지 않는다", () => {
  it("현실 직면 강요 경고가 화면에 그대로 선다 (교육생 7차 evidence ①)", () => {
    const state = driveTo(CHK_A01, "CUE-4");
    const reduce = makeTrainReducer(CHK_A01);
    const next = reduce(state, {
      type: "submit",
      input: {
        utterance: "16시 40분 어르신이 현관에서 나가시려 하셔서 여기가 어머님 댁이라고 말씀드렸습니다",
        viaButton: false,
      },
    });
    expect(next.lastFeedback?.trace?.advisoryLabels).toContain("현실 직면 강요");
    expect(next.lastFeedback?.message).toContain("어르신이 느끼시는 마음을 먼저 말로 알아드려");
    expect(next.lastFeedback?.message).not.toContain("말씀에 담긴 것은");
  });

  it("개인정보 노출 경고도 같은 자리에서 살아남는다 (교육생 7차 evidence ②)", () => {
    const state = driveTo(CHK_A01, "CUE-4");
    const reduce = makeTrainReducer(CHK_A01);
    const next = reduce(state, {
      type: "submit",
      input: {
        utterance: "16시 40분 어르신이 현관에서 나가시려 하셔서 보호자님께 010-1234-5678로 전화드렸습니다",
        viaButton: false,
      },
    });
    expect(next.lastFeedback?.trace?.advisoryLabels).toContain("개인정보 노출");
    expect(next.lastFeedback?.message).toContain("가려서 전달해 주세요");
    expect(next.lastFeedback?.message).not.toContain("말씀에 담긴 것은");
  });

  it("규칙 경고가 없는 턴은 6차대로 조립 문장이 선다 (막은 것이 조립 자체가 아니다)", () => {
    const state = driveTo(CHK_A01, "CUE-4");
    const reduce = makeTrainReducer(CHK_A01);
    const next = reduce(state, {
      type: "submit",
      input: { utterance: "지금은 소파에 앉아 계십니다", viaButton: false },
    });
    expect(next.lastFeedback?.trace?.advisoryLabels).toBeUndefined();
    expect(next.lastFeedback?.message).toContain("말씀에 담긴 것은 현재 상태입니다");
  });
});

/* ── ③ 조립 문장의 나열 구분자 ────────────────────────────
   요소 이름 자체에 가운뎃점이 든 것이 둘 있다 — 「행위·조치」(A01·A02)·「관찰·요구」(C02).
   6차의 조립 문장은 나열도 가운뎃점으로 이어, 남은 것이 둘인데 셋으로 읽혔다
   (「시각·행위·조치까지」). 같은 화면의 접힘은 이미 쉼표에 「N가지」이고, 분류기도 같은 이유로
   쉼표를 쓰며 그 사유를 주석으로 적어 두었다(classify.ts). 표시부만 규약 밖에 있었다. */

describe("조립 문장 — 나열은 접힘과 같은 쉼표 규약", () => {
  it("A02 두 요소가 빠지면 두 덩어리로 읽힌다", () => {
    const cue = cueOf(CHK_A02, "T5");
    const result = classifyInput(cue, { utterance: "어르신은 지금 방에서 주무십니다" });
    expect(result.branch.id).toBe("R1-b");
    const line = partialReportCoaching(cue, result.matchedElements) ?? "";
    expect(line).toContain("시각, 행위·조치까지");
    expect(line).not.toContain("시각·행위·조치까지");
  });

  it("전 보고 CUE — 조립 문장에 가운뎃점은 요소 이름 안에만 있다", () => {
    for (const { scenario, cue } of reportCues()) {
      const labels = (cue.elementJudge?.groups ?? []).map((g) => g.label);
      for (const label of labels) {
        const line = partialReportCoaching(cue, [label]);
        if (!line) continue;
        // 나열이 가운뎃점이면 「A·B」 꼴이 요소 이름 밖에서 나타난다.
        const stripped = labels.reduce((acc, name) => acc.split(name).join("§"), line);
        expect(stripped, `${scenario.id} ${label}`).not.toContain("·");
      }
    }
  });
});

/* ── ④ 종료 화면·이력에 남는 데이터 코칭 ─────────────────
   6차는 조립 문장을 **표시부에서만** 갈아 끼우고 이벤트에는 데이터 원문을 남겼다. 그런데
   종료 화면의 「돌아볼 점」과 이력의 성장 기록은 그 이벤트의 message를 그대로 모은다
   (scoring.collectCoaching → SessionRecord.coachingPoints). 그래서 턴 화면에서는 조립 문장을
   읽고, 회차를 마친 화면에서는 같은 턴에 대해 「"지금은 소파에 앉아 계십니다" 두 마디만
   덧붙이면」을 다시 읽었다 — 5차에 걷어낸 「방금 한 말을 그대로 돌려주기」가 요약 화면에만
   남아 있었다(교육생 7차 med). 기록에 남는 문구는 데이터의 것이라는 원칙은 그대로 두고,
   **데이터 문장에서 인용 예시를 뺐다**. */

describe("부분 보고 데이터 코칭 — 방금 한 말을 인용해 돌려주지 않는다", () => {
  it("세 시나리오의 부분 보고 코칭에 인용부호가 없다", () => {
    for (const [scenario, turnId, branchId] of [
      [CHK_A01, "T4", "R1-b"],
      [CHK_A02, "T5", "R1-b"],
      [CHK_C02, "T4", "V-p"],
    ] as const) {
      const cue = cueOf(scenario, turnId);
      const coaching = cue.branches.find((b) => b.id === branchId)?.coaching ?? "";
      expect(coaching.length, scenario.id).toBeGreaterThan(0);
      expect(coaching, scenario.id).not.toContain("\"");
      expect(coaching, scenario.id).not.toContain("덧붙이면");
      // 쓰는 낱말은 그 CUE의 요소 이름뿐이다 — 새 문장을 지어내지 않는다.
      for (const group of cue.elementJudge?.groups ?? []) {
        expect(coaching, `${scenario.id} ${group.label}`).toContain(group.label);
      }
    }
  });

  it("회차 요약에 남는 줄도 방금 한 말을 인용하지 않는다 (리듀서 → 기록 경로)", () => {
    const state = driveTo(CHK_A01, "CUE-4");
    const reduce = makeTrainReducer(CHK_A01);
    const next = reduce(state, {
      type: "submit",
      input: { utterance: "지금은 소파에 앉아 계십니다", viaButton: false },
    });
    const events = next.session.events.filter((e) => e.cueId === "CUE-4");
    const recorded = events[events.length - 1]?.feedback?.message ?? "";
    expect(recorded.length).toBeGreaterThan(0);
    expect(recorded).not.toContain("소파에 앉아 계십니다\"");
    expect(recorded).not.toContain("덧붙이면");
  });
});

/* ── ⑤ A02 R1-e 과열 ────────────────────────────────────
   6차가 현장 호칭을 넓히면서 표지가 홑 「시설장」·「팀장」·「센터장」이 됐다. 이 갈래는 사다리
   밖이라 요소 개수를 이기므로, 넓어진 만큼 그대로 열렸다 — "당직 간호팀장님께 알렸습니다"처럼
   **기관 안에 알렸다는 말만 한 발화**에 「누구를 통해 언제 알릴지를 정하셨습니다」라는 칭찬이
   붙었다. 보호자 이야기는 한 마디도 하지 않은 발화다(현직 7차 low).
   직함을 통보의 시점·경로를 적는 말과 한 덩어리로 묶어 좁혔다. */

describe("A02 R1-e — 기관 안 알림만으로는 열리지 않는다", () => {
  const cue = cueOf(CHK_A02, "T5");

  it("「당직 간호팀장님께 알렸습니다」는 부분 보고다 (현직 7차 failure_scenario)", () => {
    for (const utterance of ["당직 간호팀장님께 알렸습니다", "시설장님께 알렸습니다"]) {
      expect(classifyInput(cue, { utterance }).branch.id, utterance).toBe("R1-b");
    }
    // 요소가 하나도 없는 꼴은 미분류로 남는다 — 어느 쪽이든 통보 경로 칭찬은 열리지 않는다.
    expect(classifyInput(cue, { utterance: "센터장께 보고했습니다" }).branch.id).not.toBe("R1-e");
  });

  it("통보의 시점·경로를 말한 발화는 6차와 똑같이 R1-e다", () => {
    for (const utterance of [
      "보호자께는 지금 통화가 되지 않아, 아침에 시설장님을 통해 알리도록 일지에 남기겠습니다. 어르신은 지금 방에서 주무십니다.",
      "어르신 무릎 통증을 당직 간호사께 알렸고, 보호자께는 아침에 시설장님을 통해 알리겠습니다",
      "보호자께는 새벽이라 연락드리지 않고, 시설장에게 아침에 보고하겠습니다",
      "보호자께는 새벽이라 연락드리지 않고, 시설장님께 아침에 보고하겠습니다",
      "보호자께는 새벽이라 연락드리지 않고, 원장님께 아침에 보고하겠습니다",
      "보호자께는 새벽이라 연락드리지 않고, 센터장님께 아침에 보고하겠습니다",
      "보호자께는 새벽이라 연락드리지 않고, 간호팀장님께 아침에 보고하겠습니다",
      "보호자께는 새벽이라 연락드리지 않고, 관리책임자를 통해 아침에 알리겠습니다",
    ]) {
      expect(classifyInput(cue, { utterance }).branch.id, utterance).toBe("R1-e");
    }
  });

  it("칭찬 문장이 하지 않은 일을 적지 않는다 — 전화 이야기를 단정하지 않는다", () => {
    const praise = cue.branches.find((b) => b.id === "R1-e")?.praise ?? "";
    expect(praise.length).toBeGreaterThan(0);
    expect(praise).not.toContain("전화를 붙들지 않고");
    expect(praise).toContain("누구를 통해 언제 알릴지");
  });
});

/* ── ⑥ 이동 목적의 휠체어 안전벨트 ────────────────────────
   6차가 홑 「휠체어」를 목적어+동사 꼴로 좁히면서, 이동 맥락을 받는 예외어를 「차에서」·
   「이송 중」·「차량 이송」 셋으로만 뒀다. 「이송」은 구급 용어이고 현장에서 쓰는 말은 「이동」이다.
   그래서 이 앱이 스스로 원칙이라 적어 둔 행위를 현장 말씨로 말하면 즉시 중단됐고, 같은 뜻을
   「매 드리고」로 말하면 통과했다 — 통과 여부가 행위가 아니라 동사 선택으로 갈렸다(현직 7차 med). */

describe("휠체어 안전벨트 — 이동 목적이면 동사가 갈리지 않는다", () => {
  it("「채워 드리고 이동」과 「매 드리고 이동」이 같은 판정을 받는다", () => {
    for (const utterance of [
      "휠체어 안전벨트를 채워 드리고 이동하겠습니다.",
      "휠체어 안전벨트를 채우고 이동하겠습니다.",
      "휠체어 안전벨트를 매 드리고 이동하겠습니다.",
      "휠체어 안전벨트를 채워서 이동하겠습니다.",
      "안전벨트를 채워 드리고 이송하겠습니다.",
    ]) {
      expect(checkCritical(utterance, { scenarioType: "BPSD" }).cf, utterance).toBe(false);
    }
  });

  it("이동한다는 말이 없는 벨트 채우기 선언은 그대로 선다", () => {
    for (const utterance of [
      "휠체어 벨트를 채우겠습니다.",
      "휠체어에 앉으신 뒤 벨트를 채우겠습니다.",
      "휠체어 안전벨트를 채우고 자리를 비우겠습니다.",
      "복대를 채우고 이동하겠습니다.",
      "이동 못 하게 벨트를 채우겠습니다.",
    ]) {
      const cf = checkCritical(utterance, { scenarioType: "BPSD" });
      expect(cf.cf, utterance).toBe(true);
      expect(cf.ruleId, utterance).toBe("CF-RESTRAINT");
    }
  });
});

/* ── ⑦ 「잠깐만요」가 질문을 감점으로 찍는다 ────────────────
   5차에 「기다리세요」와 나란히 든 낱말의 나머지 절반이다. 정규화가 물음표를 지우므로
   "잠깐만요, 무슨 일이세요?"·"잠깐만요, 어디 가시려고요?"가 지시·제지(D1-b)에 걸려 초조도가
   두 칸 오르고 「지시 대신 선택지를 두 개만 드려 보세요」라는 어긋난 코칭이 붙었다.
   원인 탐색은 바로 다음 턴이 가르치는 행동이라, 첫 턴에 그걸 했다고 감점을 주면 다음 턴에
   안 하게 된다(교육생 7차 low). */

describe("「잠깐만요」 — 원인을 묻는 질문은 제지가 아니다", () => {
  const cue = cueOf(CHK_A01, "T1");

  it("질문 꼴은 지시·제지로 찍히지 않는다", () => {
    for (const utterance of [
      "잠깐만요, 무슨 일이세요?",
      "잠깐만요, 어디 가시려고요?",
      "잠깐만요, 어디 가세요?",
      "잠깐만요, 왜 그러세요?",
    ]) {
      expect(classifyInput(cue, { utterance }).branch.id, utterance).not.toBe("D1-b");
    }
  });

  it("제지는 그대로 제지다 — 예외어가 다른 표지를 함께 끄지 않는다", () => {
    for (const utterance of [
      "잠깐만요, 앉아 계세요",
      "잠깐만요, 어디 가시려고요? 앉으세요",
      "어디 가세요? 나가시면 안 돼요",
      "가만히 계세요, 무슨 일이세요?",
    ]) {
      expect(classifyInput(cue, { utterance }).branch.id, utterance).toBe("D1-b");
    }
  });
});

/* ── ⑧ 감정·추정 계열 표지 전수 점검의 나머지 ───────────────
   사다리가 없는 CUE에도 같은 결의 조각이 하나 남아 있었다 — CHK-B02 SBAR 인계의 홑 「갑자기」.
   배열 앞의 S-a·S-b가 같은 순위로 먼저 서므로 모범 인계는 안전했지만, 그 둘에 닿지 않는
   관찰 문장은 감정·추정 갈래로 내려갔다. */

describe("B02 SBAR — 시각을 적는 말이 감정·추정으로 읽히지 않는다", () => {
  const cue = cueOf(CHK_B02, "T5");

  it("관찰만 적은 인계는 감정·추정 갈래가 아니다", () => {
    expect(
      classifyInput(cue, { utterance: "12시 20분 식사 중 갑자기 소리를 못 내십니다" }).branch.id,
    ).not.toBe("S-c");
  });

  it("감정과 함께 온 꼴은 그대로 잡힌다", () => {
    for (const utterance of ["갑자기 그러셔서 너무 놀랐습니다", "갑자기 이런 일이 생겼습니다"]) {
      expect(classifyInput(cue, { utterance }).branch.id, utterance).toBe("S-c");
    }
  });
});
