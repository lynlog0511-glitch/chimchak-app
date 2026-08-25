import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell } from "@/components";
import { SOURCE_DOCS } from "@/data/docs";
import { PROTOCOLS } from "@/data/protocols";
import { getScenario, SCENARIOS } from "@/data/scenarios";
import type { EmergencyProtocol, Scenario } from "@/types";
import { TrainSession } from "../_components/TrainSession";

interface PageProps {
  params: Promise<{ id: string }>;
}

const PROTOCOL_PREFIX = "protocol:";

/**
 * 이 시나리오가 실제로 여는 응급 프로토콜만 고릅니다.
 *
 * 예전에는 `protocols={PROTOCOLS}`로 397줄 전문을 통째로 넘겼는데, 세션이 L3에서 쓰는 것은
 * 한 건뿐입니다(TrainSession의 `protocols.find`). 서버 컴포넌트가 클라이언트로 넘기는 props는
 * 그대로 flight payload에 직렬화되므로, 넘긴 만큼이 이 화면의 전송량입니다(FE 검증).
 * 여는 자리는 분기의 `next`와 턴의 `autoNext` 둘뿐이라 거기서 그대로 읽어 옵니다.
 */
function protocolsFor(scenario: Scenario, all: EmergencyProtocol[]): EmergencyProtocol[] {
  const ids = new Set<string>();
  const add = (target?: string) => {
    if (target?.startsWith(PROTOCOL_PREFIX)) ids.add(target.slice(PROTOCOL_PREFIX.length).toUpperCase());
  };
  for (const turn of scenario.turns) {
    add(turn.autoNext);
    for (const branch of turn.cue?.branches ?? []) add(branch.next);
  }
  return all.filter((protocol) => ids.has(protocol.id.toUpperCase()));
}

/** 열린 시나리오 전부를 정적 생성합니다 (오프라인 데모 보장). */
export function generateStaticParams(): { id: string }[] {
  return SCENARIOS.map((scenario) => ({ id: scenario.id.toLowerCase() }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const scenario = getScenario(id);
  if (!scenario) return { title: "훈련 세션" };
  return {
    title: `${scenario.title} · 훈련`,
    description: scenario.summary,
  };
}

export default async function TrainSessionPage({ params }: PageProps) {
  const { id } = await params;
  const scenario = getScenario(id);
  if (!scenario) notFound();

  return (
    /* 좌우 여백 18px과 상단 바는 화면이 직접 그리므로 셸의 여백·탭바를 끕니다.
       **페이지 스크롤 하나**입니다(가이드 §5) — 그래서 셸의 `fill`(뷰포트 고정 + 내부 스크롤)도
       쓰지 않습니다. 세션은 어느 폭에서도 세로 흐름 한 벌입니다. */
    <PageShell sourceDocs={SOURCE_DOCS} pad={false} tabBar={false}>
      <TrainSession scenario={scenario} protocols={protocolsFor(scenario, PROTOCOLS)} />
    </PageShell>
  );
}
