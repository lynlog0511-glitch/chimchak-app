import Link from "next/link";
import { BigButton, IconNote, IconSiren, PageShell, SettingsMenu } from "@/components";
import { SCENARIOS } from "@/data/scenarios";
import { ResumeCard, type ResumeScenario } from "./_components/ResumeCard";

function scenarioPath(id: string): string {
  return `/train/${id.toLowerCase()}`;
}

const RESUME_SCENARIOS: readonly ResumeScenario[] = SCENARIOS.map((scenario) => ({
  id: scenario.id,
  title: scenario.title,
  summary:
    scenario.id === "CHK-A01"
      ? "어르신이 외투 없이 밖으로 나가려 합니다."
      : scenario.situationLines[0],
  durationMin: scenario.durationMin,
  href: scenarioPath(scenario.id),
}));

export default function Home() {
  return (
    <PageShell>
      <header className="flex items-center pt-2 pb-1">
        <span className="text-[1.0625rem] leading-[1.3] font-extrabold tracking-[-0.01em] text-brand-800">
          침착
        </span>
        <SettingsMenu className="ml-auto" />
      </header>

      <section className="pt-5" aria-labelledby="home-title">
        <h1
          id="home-title"
          className="text-[1.4375rem] leading-[1.45] font-extrabold tracking-[-0.02em] text-ink"
        >
          오늘도 한 번 연습해 볼까요?
        </h1>

        <ResumeCard scenarios={RESUME_SCENARIOS} className="mt-7" />
      </section>

      <section className="mt-5 flex flex-col gap-3" aria-label="빠른 메뉴">
        <BigButton href="/emergency" variant="danger" size="lg" block className="font-bold">
          <IconSiren className="h-7 w-7" filled />
          응급 상황 도움
        </BigButton>
        <BigButton href="/report" variant="secondary" size="lg" block>
          <IconNote className="h-7 w-7 text-brand-800" />
          돌봄 기록 만들기
        </BigButton>
      </section>

      <p className="mt-4 pb-4 text-center">
        <Link
          href="/guide"
          prefetch={false}
          className="inline-flex min-h-[56px] items-center justify-center rounded-field px-5 text-[1rem] leading-[1.45] font-bold text-brand-800 underline underline-offset-4 transition-colors duration-150 active:bg-paper-2"
        >
          사용 방법
        </Link>
      </p>
    </PageShell>
  );
}
