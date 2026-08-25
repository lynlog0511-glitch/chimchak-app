import type { Metadata } from "next";
import type { ScenarioType } from "@/types";
import { PageShell, ScreenHeader } from "@/components";
import { SOURCE_DOCS } from "@/data/docs";
import { SCENARIOS } from "@/data/scenarios";
import { HistoryBoard } from "./_components/HistoryBoard";
import type { ScenarioTypeMap } from "./_components/nextTraining";

export const metadata: Metadata = {
  title: "성장 기록",
  description:
    "점수와 등급 없이 해 본 것과 다시 볼 것만 남깁니다. 훈련 이력과 확정한 기록은 이 기기 안에만 쌓입니다.",
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
 * `/history` — 성장 기록 (시안 5c).
 *
 * 상단 바(22px 제목 + 부제) → 추천 카드 → 유형별 4칸 → 최근 훈련 행 →
 * 이수 확인서 → 확정한 기록 순서입니다.
 * 안전 규칙: 점수·등급·순위·백분위를 어떤 형태로도 표시하지 않습니다.
 */
export default function HistoryPage() {
  return (
    <PageShell sourceDocs={SOURCE_DOCS}>
      <ScreenHeader
        title="성장 기록"
        subtitle="점수와 등급 없이 해 본 것과 다시 볼 것만 남깁니다"
      />
      <HistoryBoard typeByScenarioId={buildTypeMap()} activeTypes={buildActiveTypes()} />
    </PageShell>
  );
}
