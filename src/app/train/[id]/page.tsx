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
    /* 세션은 뷰포트에 고정된 화면입니다 — 본문(대화)만 스크롤하고 입력 도크는 아래에 붙어 있습니다.
       좌우 여백 18px과 상단 바는 화면이 직접 그리므로 셸의 여백·탭바는 끕니다(v4 §0·§3). */
    <PageShell sourceDocs={SOURCE_DOCS} fill pad={false} tabBar={false}>
      <TrainSession scenario={scenario} protocols={PROTOCOLS} />
    </PageShell>
  );
}
