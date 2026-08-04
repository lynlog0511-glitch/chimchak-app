import type { Metadata } from "next";
import type { ScenarioType } from "@/types";
import { PageShell } from "@/components";
import { SOURCE_DOCS } from "@/data/docs";
import { SCENARIOS } from "@/data/scenarios";
import { HistoryBoard } from "./_components/HistoryBoard";
import type { ScenarioTypeMap } from "./_components/CoverageGrid";

export const metadata: Metadata = {
  title: "성장 기록",
  description:
    "훈련 이력과 확정한 기록을 이 기기에 쌓아 둡니다. 🟢 충족한 것과 ⚪ 다음에 살려 볼 것만 문장으로 남기고, 점수·등급은 만들지 않습니다.",
};

/**
 * 시나리오 데이터 전체가 브라우저 번들로 내려가지 않도록,
 * 커버리지 계산에 필요한 최소 정보만 서버에서 만들어 넘깁니다.
 */
function buildTypeMap(): ScenarioTypeMap {
  const map: ScenarioTypeMap = {};
  for (const scenario of SCENARIOS) {
    map[scenario.id.toUpperCase()] = scenario.type;
  }
  return map;
}

function buildActiveTypes(): ScenarioType[] {
  const types = new Set<ScenarioType>();
  for (const scenario of SCENARIOS) {
    if (scenario.active) types.add(scenario.type);
  }
  return [...types];
}

/**
 * `/history` — 성장 기록.
 *
 * 세션 이력·유형 커버리지·확정한 기록을 한 화면에 모읍니다.
 * 안전 규칙: 점수·등급·순위·백분위를 어떤 형태로도 표시하지 않습니다.
 */
export default function HistoryPage() {
  return (
    <PageShell
      eyebrow="성장 기록"
      title="잘한 것과 다음에 살려 볼 것만 남깁니다"
      description="등수를 매기지 않습니다. 어떤 상황을 몇 번 연습했는지, 그때 무엇을 지켰고 무엇을 다음에 살려 볼지만 문장으로 쌓입니다. 기록은 이 기기 안에만 있습니다."
      sourceDocs={SOURCE_DOCS}
      wide
    >
      <HistoryBoard typeByScenarioId={buildTypeMap()} activeTypes={buildActiveTypes()} />
    </PageShell>
  );
}
