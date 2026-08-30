/**
 * 항목별 펼침 — src/lib/rubricBreakdown.ts
 *
 * 지키려는 것은 **세부화가 새 판정을 만들지 않았다**는 사실이다.
 * 이 표시는 엔진이 이미 이벤트에 적어 둔 루브릭 항목을 묶기만 하므로,
 *  · 항목별로 정확히 묶이는가(같은 항목이 두 번 걸리면 한 행인가)
 *  · 같은 문구가 두 번 서지 않는가
 *  · 한 항목이 충족·코칭 양쪽에 걸린 회차를 한쪽으로 지우지 않는가
 *  · **점수가 어디로도 새지 않는가** (1점과 2점이 화면에서 구별되지 않아야 한다)
 * 넷이 이 파일의 전부다. 마지막 하나가 특히 눈으로는 끝까지 알 수 없는 자리다 —
 * 숫자가 한 칸 새어도 화면은 그냥 조금 더 자세해 보인다.
 *
 * 실제 시나리오(A01)를 버튼으로 두 턴 진행시켜 **엔진이 만든 이벤트**로 검사하고,
 * 한 회차에서 재현하기 어려운 자리(같은 문구 반복·⚑CF)만 합성 이벤트를 쓴다.
 */

import { describe, expect, it } from "vitest";
import { AREA_LABELS, getRubricItem } from "@/data/rubric";
import { CHK_A01 } from "@/data/scenarios/chk-a01";
import { startSession, submitResponse } from "@/engine/session";
import { buildRubricBreakdown } from "@/lib/rubricBreakdown";
import type { RubricHit, SessionEvent, SessionState } from "@/types";

/** 버튼으로 분기를 직접 고른다 — 발화 분류를 거치지 않아 검사가 판정선에 흔들리지 않는다. */
function pick(state: SessionState, branchId: string): SessionState {
  return submitResponse(CHK_A01, state, { branchId, viaButton: true }).state;
}

/**
 * A01을 두 턴 진행한 회차.
 * D1-c(감정 인정) → RE-01·RE-02 충족, D2-d(논리적 설득) → RE-02 코칭.
 * 같은 항목(RE-02)이 한 회차 안에서 양쪽에 걸리는 실제 경로다.
 */
function twoTurnEvents(): SessionEvent[] {
  const afterFirst = pick(startSession(CHK_A01), "D1-c");
  expect(afterFirst.currentTurnId).toBe("T2");
  const afterSecond = pick(afterFirst, "D2-d");
  return afterSecond.events;
}

/** 시각·턴 id는 이 함수가 보지 않는 값이라 최소만 채운다. */
function synthetic(hits: RubricHit[], message: string, ok: boolean): SessionEvent {
  return {
    turnId: "T1",
    cueId: "CUE-1",
    viaButton: true,
    at: 0,
    feedback: {
      branchId: "b",
      branchLabel: "합성 분기",
      ok,
      criticalFail: false,
      message,
      gaugeDelta: 0,
      rubricHits: hits,
    },
  };
}

describe("항목별 그룹핑", () => {
  it("걸린 항목마다 한 행이고, 처음 걸린 순서대로 선다", () => {
    const rows = buildRubricBreakdown(twoTurnEvents());
    expect(rows.map((row) => row.itemId)).toEqual(["RE-01", "RE-02"]);
  });

  it("행에는 항목 이름(행동지표)과 축 라벨이 그대로 실린다", () => {
    const rows = buildRubricBreakdown(twoTurnEvents());
    const item = getRubricItem("RE-01");
    expect(rows[0]?.name).toBe(item?.indicator);
    expect(rows[0]?.areaLabel).toBe(AREA_LABELS.RE);
  });

  it("루브릭 표에 없는 항목 id는 담지 않는다 — 화면에 내부 id가 서지 않게", () => {
    const rows = buildRubricBreakdown([
      synthetic([{ itemId: "ZZ-99", score: 4 }], "없는 항목입니다.", true),
    ]);
    expect(rows).toEqual([]);
  });

  it("판정이 붙지 않은 이벤트(자동 진행 턴)는 행을 만들지 않는다", () => {
    expect(buildRubricBreakdown([{ turnId: "T2", viaButton: false, at: 0 }])).toEqual([]);
  });
});

describe("문구", () => {
  it("같은 문구가 두 번 걸려도 한 번만 남는다", () => {
    const repeated = "감정을 먼저 알아주셨습니다.";
    const rows = buildRubricBreakdown([
      synthetic([{ itemId: "RE-01", score: 4 }], repeated, true),
      synthetic([{ itemId: "RE-01", score: 4 }], repeated, true),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.messages).toEqual([repeated]);
  });

  it("한 항목에 서로 다른 문구가 붙었으면 둘 다 순서대로 남는다", () => {
    const rows = buildRubricBreakdown(twoTurnEvents());
    const re02 = rows.find((row) => row.itemId === "RE-02");
    expect(re02?.messages).toHaveLength(2);
    expect(re02?.messages[0]).not.toBe(re02?.messages[1]);
  });

  it("빈 문구는 담지 않는다", () => {
    const rows = buildRubricBreakdown([synthetic([{ itemId: "RE-01", score: 4 }], "   ", true)]);
    expect(rows[0]?.messages).toEqual([]);
  });
});

describe("충족·코칭 동시 걸림", () => {
  it("한 항목이 양쪽에 걸리면 한 행에 두 낱말이 함께 선다", () => {
    const rows = buildRubricBreakdown(twoTurnEvents());
    const re02 = rows.find((row) => row.itemId === "RE-02");
    expect(re02?.statuses).toEqual(["충족", "코칭"]);
  });

  it("같은 낱말이 여러 번 걸려도 한 번만 적는다", () => {
    const rows = buildRubricBreakdown([
      synthetic([{ itemId: "SA-02", score: 2 }], "한 가지만 더 여쭤 주세요.", false),
      synthetic([{ itemId: "SA-02", score: 1 }], "다른 코칭 문구입니다.", false),
    ]);
    expect(rows[0]?.statuses).toEqual(["코칭"]);
  });

  it("즉시 중단(⚑CF) 턴은 담지 않는다 — 그 자리는 「다시 볼 장면」 카드가 맡는다", () => {
    const cf: SessionEvent = {
      turnId: "T1",
      cueId: "CUE-1",
      viaButton: false,
      at: 0,
      feedback: {
        branchId: "b-cf",
        branchLabel: "억제형",
        ok: false,
        criticalFail: true,
        message: "잠시 멈추겠습니다.",
        gaugeDelta: 0,
        rubricHits: [{ itemId: "CO-02", score: 1 }],
      },
    };
    expect(buildRubricBreakdown([cf])).toEqual([]);
  });
});

describe("빈 회차", () => {
  it("이벤트가 없으면 빈 배열이다 — 화면은 이 길이로 섹션 자체를 접는다", () => {
    expect(buildRubricBreakdown([])).toEqual([]);
  });
});

/**
 * 점수는 어떤 형태로도 나가지 않는다(브리프 §3-1).
 * 4점 척도는 내부 채점·이력 산출 전용이고, 이 표시가 아는 낱말은 「충족」·「코칭」 둘뿐이다.
 */
describe("점수 유출 금지", () => {
  it("행에는 다섯 칸뿐이다 — 점수 칸이 없다", () => {
    const rows = buildRubricBreakdown(twoTurnEvents());
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual([
        "areaLabel",
        "itemId",
        "messages",
        "name",
        "statuses",
      ]);
    }
    expect(JSON.stringify(rows)).not.toContain("score");
  });

  it("판정 낱말은 두 개뿐이다", () => {
    const rows = buildRubricBreakdown(twoTurnEvents());
    for (const row of rows) {
      for (const status of row.statuses) {
        expect(["충족", "코칭"]).toContain(status);
      }
    }
  });

  it("1점과 2점이 구별되지 않는다 — 「몇 점인지」가 화면에 실리지 않게", () => {
    const message = "같은 코칭 문구입니다.";
    const worst = buildRubricBreakdown([synthetic([{ itemId: "RE-01", score: 1 }], message, false)]);
    const partial = buildRubricBreakdown([
      synthetic([{ itemId: "RE-01", score: 2 }], message, false),
    ]);
    expect(worst).toEqual(partial);
  });

  it("척도 앵커는 실리지 않는다 — 어느 눈금인지가 화면에 서지 않게", () => {
    /* 양 끝(1점·4점)만 본다. 3점 앵커는 「기대 행동을 수행했다」는 뜻이라 행동지표와 같은 말을
       쓰는 자리이고(RE-01: 지표 「…정서를 언어로 인정했는가」 · 3점 앵커 「정서를 언어로 인정」),
       부분 문자열로는 지표와 갈라지지 않는다. 여기서 막으려는 것은 「몇 점인지」를 말하는
       문장이 붙는 것이고, 그 일이 벌어지면 양 끝이 먼저 실린다. */
    const rows = buildRubricBreakdown(twoTurnEvents());
    const serialized = JSON.stringify(rows);
    expect(serialized).not.toContain("anchors");
    for (const itemId of ["RE-01", "RE-02"]) {
      const anchors = getRubricItem(itemId)?.anchors;
      if (!anchors) continue;
      expect(serialized).not.toContain(anchors[1]);
      expect(serialized).not.toContain(anchors[4]);
    }
  });
});
