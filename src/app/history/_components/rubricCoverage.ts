/**
 * 루브릭 커버리지 (순수 함수).
 *
 * 기획서 §2가 「이 가운데 세 가지만 돌려도 채점표 30항목이 한 번씩 모두 나옵니다」라고 적는데,
 * 앱 안에는 그 문장을 확인해 주는 화면이 없었습니다. 이 앱은 거의 모든 숫자를 화면이 직접
 * 세어 증명하는 규율을 지키고 있어서, 증명되지 않는 숫자 하나가 오히려 도드라집니다
 * (페르소나 PM med).
 *
 * 그래서 **이력에서 실제로 지나온 항목**을 세어 한 줄로 적습니다. 세는 방법은 하나뿐입니다 —
 * 완주하신 회차의 시나리오가 적용하는 루브릭 항목(`Scenario.appliedRubric`)을 합집합으로
 * 모읍니다. 표를 새로 만들지 않고, 저장 항목도 늘리지 않습니다.
 *
 * 왜 점수가 아닌가. 여기서 세는 것은 「몇 점이었는가」가 아니라 「그 항목이 한 번이라도
 * 화면에 나왔는가」입니다. 점수·등급·순위·백분위를 만들지 않는다는 규칙에 걸리지 않고,
 * 오히려 이수 시수 설계와 파일럿 운영(누구에게 무엇을 몇 판 시킬지)에 필요한 값입니다.
 *
 * 시나리오 데이터 전체를 브라우저 번들로 내려보내지 않도록, 표는 서버에서 만들어 넘깁니다
 * (`app/history/page.tsx`) — 유형 표(`ScenarioTypeMap`)와 같은 규율입니다.
 */

import type { SessionRecord } from "@/types";

/** 시나리오 id(대문자) → 그 시나리오가 적용하는 루브릭 항목 id 목록. */
export type ScenarioRubricMap = Record<string, readonly string[]>;

export interface RubricCoverage {
  /** 이력에서 실제로 지나온 항목 수 */
  covered: number;
  /** 채점표 전체 항목 수 */
  total: number;
}

/**
 * 완주 이력이 지나온 루브릭 항목 수를 셉니다.
 *
 * @example
 * countRubricCoverage([], { "CHK-A01": ["SA-01"] }, 30) // { covered: 0, total: 30 }
 * @example
 * countRubricCoverage(records, map, 30) // { covered: 22, total: 30 }
 */
export function countRubricCoverage(
  records: readonly SessionRecord[],
  rubricByScenarioId: ScenarioRubricMap,
  total: number,
): RubricCoverage {
  const seen = new Set<string>();
  for (const record of records) {
    const key = (record.scenarioId ?? "").trim().toUpperCase();
    for (const itemId of rubricByScenarioId[key] ?? []) {
      seen.add(itemId.trim().toUpperCase());
    }
  }
  // 표에 없는 항목이 기록에 섞여 들어와도 전체 수를 넘지 않게 잘라 둡니다.
  return { covered: Math.min(seen.size, total), total };
}

/**
 * 화면에 그대로 나가는 한 줄 — 숫자 둘까지이고, 점수·등급은 만들지 않습니다.
 *
 * @example
 * rubricCoverageSentence({ covered: 0, total: 30 }) // "30항목 가운데 아직 지나온 항목이 없습니다."
 */
export function rubricCoverageSentence(coverage: RubricCoverage): string {
  if (coverage.covered === 0) {
    return `채점표 ${coverage.total}항목 가운데 아직 지나오신 항목이 없습니다. 한 판을 마치시면 이 자리에 세어 드립니다.`;
  }
  if (coverage.covered >= coverage.total) {
    return `채점표 ${coverage.total}항목을 모두 지나오셨습니다.`;
  }
  return `채점표 ${coverage.total}항목 중 ${coverage.covered}항목을 지나오셨습니다.`;
}
