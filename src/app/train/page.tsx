import type { Metadata } from "next";
import Link from "next/link";
import { BigButton, PageShell, ScreenHeader } from "@/components";
import { ChevronGlyph } from "@/components/icons";
import { SCENARIO_MATRIX } from "@/data/matrix";
import { getActiveScenarios } from "@/data/scenarios";
import { FREE_PRACTICE_HREF } from "@/lib/onlineFree";
import { scenarioHref } from "./_components/constants";

export const metadata: Metadata = {
  title: "상황 연습",
  description: "AI 어르신과 말로 연습할 상황을 고릅니다.",
};

/** 목록에서는 한 번에 이해할 수 있는 한 문장만 보여 줍니다. */
const CARD_SUMMARY: Record<string, string> = {
  "CHK-A01": "집에 가겠다는 어르신께 차분히 답해 봐요.",
  "CHK-A02": "새벽에 출근하겠다는 어르신께 답해 봐요.",
  "CHK-B01": "넘어진 어르신은 일으키지 않고 살펴보고 알려요.",
  "CHK-B02": "사레가 응급으로 바뀌는 순간을 알아봐요.",
  "CHK-C01": "무리한 부탁을 관계를 지키며 거절해 봐요.",
  "CHK-C02": "원인을 단정하지 않고 사실대로 기록해요.",
  "CHK-D01": "혼자 문을 열지 않고 도움을 요청해요.",
};

function levelOf(scenarioId: string): string {
  const level = SCENARIO_MATRIX.find((item) => item.scenarioId === scenarioId)?.level;
  return level ? `${level}단계` : "기본";
}

export default function TrainIndexPage() {
  const [recommended, ...otherScenarios] = getActiveScenarios();

  return (
    <PageShell>
      <ScreenHeader title="상황 연습" subtitle="처음이면 추천 연습부터 시작하세요." />

      {recommended && (
        <section className="mt-5 rounded-panel bg-paper-2 p-4" aria-labelledby="recommended-title">
          <p className="text-[0.8438rem] leading-[1.45] font-bold text-brand-800">
            오늘의 추천 · {levelOf(recommended.id)} · 약 {recommended.durationMin}분
          </p>
          <h2
            id="recommended-title"
            className="mt-2 text-[1.375rem] leading-[1.3] font-extrabold text-ink"
          >
            {recommended.title}
          </h2>
          <p className="mt-2 text-[1rem] leading-[1.6] text-ink-soft">
            {CARD_SUMMARY[recommended.id] ?? recommended.summary}
          </p>
          <BigButton href={scenarioHref(recommended.id)} size="lg" block className="mt-4">
            연습 내용 보기
          </BigButton>
        </section>
      )}

      <details className="group mt-4">
        <summary className="flex min-h-[64px] cursor-pointer list-none items-center justify-between gap-3 rounded-card bg-paper-2 px-4 py-3 text-ink transition-colors duration-150 active:bg-neutral-line [&::-webkit-details-marker]:hidden">
          <span className="text-[1rem] leading-[1.45] font-bold">다른 상황 고르기</span>
          <ChevronGlyph
            size="sm"
            className="flex-none text-ink-ghost transition-transform group-open:rotate-180"
          />
        </summary>

        <div className="pb-4">
          <ul className="mt-2 divide-y divide-line" aria-label="다른 연습 상황">
            {otherScenarios.map((scenario) => (
              <li key={scenario.id}>
                <Link
                  href={scenarioHref(scenario.id)}
                  prefetch={false}
                  className="flex min-h-[88px] items-center gap-3 rounded-field px-2 py-4 transition-colors duration-150 active:bg-paper-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.8438rem] leading-[1.45] font-bold text-ink-muted">
                      {levelOf(scenario.id)} · 약 {scenario.durationMin}분
                    </span>
                    <span className="mt-1 block text-[1.0625rem] leading-[1.45] font-bold text-ink">
                      {scenario.title}
                    </span>
                    <span className="mt-1 block text-[0.8438rem] leading-[1.6] text-ink-soft">
                      {CARD_SUMMARY[scenario.id] ?? scenario.summary}
                    </span>
                  </span>
                  <ChevronGlyph size="sm" className="flex-none text-ink-ghost" />
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-3 border-t border-line pt-3">
            <Link
              href={FREE_PRACTICE_HREF}
              className="flex min-h-[64px] items-center justify-between rounded-field px-2 text-[1rem] font-bold text-ink active:bg-paper-2"
            >
              자유 연습
              <ChevronGlyph size="sm" className="text-ink-ghost" />
            </Link>
            <Link
              href="/guide"
              className="flex min-h-[64px] items-center justify-between rounded-field px-2 text-[1rem] font-bold text-ink active:bg-paper-2"
            >
              사용 방법
              <ChevronGlyph size="sm" className="text-ink-ghost" />
            </Link>
          </div>
        </div>
      </details>
    </PageShell>
  );
}
