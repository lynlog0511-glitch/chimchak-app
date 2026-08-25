/**
 * 시나리오 그래프 무결성 — src/data/scenarios/index.ts
 *
 * validateScenarioGraph()는 잘 쓰여 있었지만 앱 어디에서도 부르지 않아 죽은 코드였다.
 * 여기서 배선한다. 4번째 시나리오를 얹는 순간 끊어진 next 하나가 그대로 배포되고,
 * 증상은 "훈련 도중 화면이 멈춤" 형태로 발표장에서 나온다.
 *
 * 검증기 자체가 무력해지는 것(전부 통과시키는 검증기)도 같이 막는다 —
 * 일부러 망가뜨린 그래프를 넣어 실제로 잡아내는지 확인한다.
 */

import { describe, expect, it } from "vitest";
import { SCENARIOS, getActiveScenarios, getScenario, getTurn, validateAllScenarios, validateScenarioGraph } from "@/data/scenarios";
import { SCENARIO_IDS } from "@/data/scenarioIds";
import { RUBRIC } from "@/data/rubric";
import { makeScenario } from "./_fixtures";

describe("실제 시나리오 데이터", () => {
  it("전 시나리오에 무결성 문제가 없다", () => {
    expect(validateAllScenarios()).toEqual([]);
  });

  for (const scenario of SCENARIOS) {
    it(`${scenario.id} — 그래프 문제 0건`, () => {
      expect(validateScenarioGraph(scenario)).toEqual([]);
    });
  }

  it("id 조회는 대소문자를 가리지 않는다", () => {
    expect(getScenario("chk-a01")?.id).toBe("CHK-A01");
    expect(getScenario(" CHK-B02 ")?.id).toBe("CHK-B02");
    expect(getScenario("없는-id")).toBeUndefined();
  });

  it("활성 시나리오만 훈련 목록에 오른다", () => {
    const active = getActiveScenarios();
    expect(active.length).toBeGreaterThan(0);
    expect(active.every((s) => s.active)).toBe(true);
  });

  it("getTurn은 진입 턴을 찾아 준다", () => {
    for (const scenario of SCENARIOS) {
      expect(getTurn(scenario, scenario.entryTurnId)?.id).toBe(scenario.entryTurnId);
    }
  });
});

/**
 * 번호만 담은 잎 모듈(`src/data/scenarioIds.ts`)과 시나리오 배럴의 동기화.
 *
 * 저장소 유틸(`src/lib/storage.ts`)은 시나리오 본문을 전 라우트 공유 청크로 끌고 오지 않으려고
 * 배럴 대신 그 잎 모듈을 봅니다. 값이 둘로 갈리면 이수 사실 파일 가져오기가 「이 앱에 없는
 * 시나리오」라며 멀쩡한 줄을 거절하거나, 반대로 없는 번호를 받아들입니다 — 둘 다 화면에는
 * 아무 표시가 없는 고장이라 여기서 못 박습니다.
 */
describe("시나리오 번호 목록 동기화", () => {
  it("잎 모듈의 번호가 SCENARIOS와 순서까지 같다", () => {
    expect([...SCENARIO_IDS]).toEqual(SCENARIOS.map((scenario) => scenario.id.toUpperCase()));
  });
});

describe("루브릭 참조", () => {
  const rubricIds = new Set(RUBRIC.map((item) => item.id));

  it("루브릭은 30항목이다", () => {
    expect(RUBRIC).toHaveLength(30);
  });

  it("시나리오가 쓰는 항목 id는 전부 루브릭에 정의돼 있다", () => {
    const unknown: string[] = [];
    for (const scenario of SCENARIOS) {
      for (const id of scenario.appliedRubric) {
        if (!rubricIds.has(id)) unknown.push(`${scenario.id}.appliedRubric ${id}`);
      }
      for (const turn of scenario.turns) {
        for (const branch of turn.cue?.branches ?? []) {
          for (const hit of branch.rubricHits) {
            if (!rubricIds.has(hit.itemId)) unknown.push(`${scenario.id} ${branch.id} ${hit.itemId}`);
          }
        }
      }
    }
    expect(unknown).toEqual([]);
  });

  it("열린 3종만으로 30항목이 한 번씩 실제 분기에서 실행된다", () => {
    const hit = new Set<string>();
    for (const scenario of SCENARIOS) {
      for (const turn of scenario.turns) {
        for (const branch of turn.cue?.branches ?? []) {
          for (const h of branch.rubricHits) hit.add(h.itemId);
        }
      }
    }
    expect([...rubricIds].filter((id) => !hit.has(id))).toEqual([]);
  });
});

describe("검증기가 실제로 잡는지", () => {
  it("끊어진 next를 잡는다", () => {
    const broken = makeScenario();
    broken.turns[0]!.cue!.branches[1]!.next = "T없음";
    expect(validateScenarioGraph(broken).join(" ")).toContain("존재하지 않는 턴");
  });

  it("정의되지 않은 엔딩을 잡는다", () => {
    const broken = makeScenario();
    broken.turns[1]!.autoNext = "end:E-없음";
    expect(validateScenarioGraph(broken).join(" ")).toContain("정의되지 않은 엔딩");
  });

  it("분기 목록에 없는 defaultBranchId를 잡는다", () => {
    const broken = makeScenario();
    broken.turns[0]!.cue!.defaultBranchId = "b-없음";
    expect(validateScenarioGraph(broken).join(" ")).toContain("defaultBranchId");
  });

  it("모든 발화를 삼키는 짧은 패턴을 잡는다", () => {
    const broken = makeScenario();
    broken.turns[0]!.cue!.branches[1]!.patterns = ["음…"];
    expect(validateScenarioGraph(broken).join(" ")).toContain("모든 발화를 삼킵니다");
  });

  it("버튼 폴백 문구가 자기 분기로 돌아오지 않으면 잡는다", () => {
    const broken = makeScenario();
    broken.turns[0]!.cue!.branches[1]!.fallbackOption = "어디 가시려고요";
    expect(validateScenarioGraph(broken).join(" ")).toContain("버튼 폴백 문구");
  });

  it("도달할 수 없는 엔딩을 잡는다", () => {
    const broken = makeScenario();
    broken.endings = [
      ...broken.endings,
      { id: "E-고아", title: "고아 엔딩", verdict: "충족", condition: "없음", message: "" },
    ];
    expect(validateScenarioGraph(broken).join(" ")).toContain("도달할 수 없습니다");
  });

  it("엔진이 직접 채택하는 엔딩(재훈련·재훈련 권고)은 도달 불가로 세지 않는다", () => {
    expect(validateScenarioGraph(makeScenario())).toEqual([]);
  });
});
