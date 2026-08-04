import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell } from "@/components";
import { SOURCE_DOCS } from "@/data/docs";
import { PROTOCOLS } from "@/data/protocols";
import { getScenario, SCENARIOS } from "@/data/scenarios";
import { TrainSession } from "../_components/TrainSession";

interface PageProps {
  params: Promise<{ id: string }>;
}

/** 활성 시나리오 3종을 정적 생성합니다 (오프라인 데모 보장). */
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
    <PageShell sourceDocs={SOURCE_DOCS} wide>
      <TrainSession scenario={scenario} protocols={PROTOCOLS} />
    </PageShell>
  );
}
