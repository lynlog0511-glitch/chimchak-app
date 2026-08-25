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
      <TrainSession scenario={scenario} protocols={PROTOCOLS} />
    </PageShell>
  );
}
