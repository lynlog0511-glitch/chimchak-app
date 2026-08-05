import type { Metadata } from "next";
import Link from "next/link";
import { Badge, BigButton, Card, PageShell } from "@/components";
import { IconArrowRight, IconInfo, IconLock } from "@/components/icons";
import { SOURCE_DOCS } from "@/data/docs";
import {
  MATRIX_LEVEL_LABELS,
  MATRIX_TYPE_LABELS,
  MATRIX_TYPE_NOTES,
  SCENARIO_MATRIX,
} from "@/data/matrix";
import { getActiveScenarios } from "@/data/scenarios";
import type { MatrixCell, Scenario } from "@/types";
import {
  FICTION_NOTICE,
  PRACTICE_LINE,
  scenarioHref,
  TIER_LABEL,
  TYPE_TONE,
} from "./_components/constants";

export const metadata: Metadata = {
  title: "훈련 모드",
  description:
    "치매 행동심리증상·응급 초기 대응·갈등 화법 3종을 대화로 연습하고, 턴마다 근거와 함께 피드백을 받습니다.",
};

/* ── 활성 시나리오 카드 ────────────────────────────────────── */

function ScenarioCard({ scenario }: { scenario: Scenario }) {
  return (
    <Card hoverable className="flex h-full flex-col">
      {/* 필은 유형 하나만 — 난이도·소요는 그냥 작은 텍스트로 둡니다. */}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <Badge tone={TYPE_TONE[scenario.type]}>{scenario.typeLabel}</Badge>
        <span className="chim-caption font-semibold text-ink-muted">
          {scenario.levelLabel} · 약 {scenario.durationMin}분
        </span>
      </div>

      <h3 className="chim-h3 mt-4 text-ink">{scenario.title}</h3>
      <p className="chim-body mt-2.5 text-ink-soft">{scenario.summary}</p>

      {/* 계층 표기도 배지·세로줄 없이 여백으로만 나눈 텍스트로 둡니다(§1-2). */}
      <div className="chim-caption mt-4 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="font-semibold text-ink-muted">생성 통제</span>
        {scenario.tiers.map((tier) => (
          <span key={tier} className="font-bold text-ink-muted">
            {TIER_LABEL[tier]}
          </span>
        ))}
      </div>

      <ul className="chim-caption mt-4 space-y-1.5 leading-relaxed text-ink-muted">
        {scenario.objectives.slice(0, 2).map((objective) => (
          <li key={objective} className="flex gap-2">
            <span aria-hidden="true" className="text-brand-500">
              ·
            </span>
            <span>{objective}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-6">
        <BigButton href={scenarioHref(scenario.id)} size="lg" block>
          이 상황 연습하기
        </BigButton>
      </div>
    </Card>
  );
}

/* ── 12종 매트릭스 ─────────────────────────────────────────── */

function MatrixCellBox({ cell }: { cell: MatrixCell }) {
  const active = Boolean(cell.scenarioId);

  if (active && cell.scenarioId) {
    return (
      <Link
        href={scenarioHref(cell.scenarioId)}
        className="flex min-h-[92px] flex-col justify-between gap-2 rounded-card bg-brand-50 p-3.5 transition-colors duration-150 hover:bg-brand-100"
      >
        <span className="chim-body leading-snug font-bold text-ink">{cell.title}</span>
        <span className="chim-caption flex items-center gap-1.5 font-bold text-brand-800">
          지금 연습할 수 있습니다
          <IconArrowRight className="h-4 w-4" />
        </span>
      </Link>
    );
  }

  return (
    <div className="flex min-h-[92px] flex-col justify-between gap-2 rounded-card bg-paper-2 p-3.5">
      <span className="chim-body leading-snug font-semibold text-ink-muted">{cell.title}</span>
      <span className="chim-caption flex items-center gap-1.5 font-semibold text-ink-muted">
        <IconLock className="h-4 w-4" />
        준비 중입니다
      </span>
    </div>
  );
}

function MatrixTable() {
  return (
    <div className="space-y-4">
      {MATRIX_TYPE_LABELS.map((typeLabel) => {
        const row = SCENARIO_MATRIX.filter((cell) => cell.typeLabel === typeLabel).sort(
          (a, b) => a.level - b.level,
        );
        const note = MATRIX_TYPE_NOTES[typeLabel];

        return (
          <Card key={typeLabel} padded={false} className="overflow-hidden">
            <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-4 pb-1 md:px-5">
              <h3 className="chim-label font-extrabold text-ink">{typeLabel}</h3>
              {note && <p className="chim-caption leading-snug text-ink-muted">{note}</p>}
            </div>
            <div className="grid gap-3 p-4 md:grid-cols-3 md:px-5">
              {row.map((cell) => {
                const levelLabel =
                  MATRIX_LEVEL_LABELS.find((l) => l.level === cell.level)?.label ?? "";
                return (
                  <div key={`${cell.typeLabel}-${cell.level}`}>
                    <p className="chim-caption mb-1.5 font-bold text-ink-muted">{levelLabel}</p>
                    <MatrixCellBox cell={cell} />
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ── 페이지 ───────────────────────────────────────────────── */

export default function TrainIndexPage() {
  const scenarios = getActiveScenarios();

  return (
    <PageShell
      sourceDocs={SOURCE_DOCS}
      eyebrow="훈련 모드"
      title="말이 나오게 만드는 연습"
      description="AI는 어르신·보호자 역만 맡습니다. 옳고 그름의 판정은 한국 법령과 공단 지침이 합니다."
      wide
    >
      <Card tone="brand" className="mb-8">
        <p className="chim-core font-extrabold text-brand-900">“{PRACTICE_LINE}”</p>
        <p className="chim-body mt-2.5 text-brand-800">
          정해진 정답 문장은 없습니다. 마이크가 없거나 소리를 낼 수 없는 곳이라면 버튼과 직접
          입력만으로도 끝까지 진행하실 수 있습니다.
        </p>
        <p className="chim-caption mt-3 flex items-start gap-2 leading-relaxed font-semibold text-brand-800">
          <IconInfo className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{FICTION_NOTICE}</span>
        </p>
      </Card>

      <section aria-labelledby="active-scenarios">
        <h2 id="active-scenarios" className="chim-h2 text-ink">
          지금 연습할 수 있는 상황 3종
        </h2>
        <p className="chim-body mt-2 text-ink-soft">
          이 3종만으로 루브릭 30항목이 한 번씩 실행되고, 생성 통제 3계층(L1·L2·L3)이 모두
          지나갑니다.
        </p>

        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {scenarios.map((scenario) => (
            <ScenarioCard key={scenario.id} scenario={scenario} />
          ))}
        </div>
      </section>

      <section aria-labelledby="scenario-matrix" className="mt-12">
        <h2 id="scenario-matrix" className="chim-h2 text-ink">
          전체 12종 편성표
        </h2>
        <p className="chim-body mt-2 max-w-3xl text-ink-soft">
          유형 4종 × 난이도 3단계로 설계했고, 알파에서는 3종을 열어 두었습니다. 잠긴 칸은 같은
          루브릭 30항목을 그대로 재사용하므로 시나리오만 추가하면 열립니다.
        </p>

        <div className="mt-6">
          <MatrixTable />
        </div>
      </section>

      <section aria-labelledby="train-guide" className="mt-12">
        <h2 id="train-guide" className="chim-h2 text-ink">
          훈련은 이렇게 진행됩니다
        </h2>
        {/* 카드 그리드 대신 hairline으로 나눈 에디토리얼 목록 — 앞 두 섹션과 리듬을 다르게 둡니다. */}
        <ol className="chim-hairline mt-5 border-t border-line">
          {[
            {
              step: "1",
              title: "브리핑",
              body: "페르소나·상황·제약 조건을 먼저 읽습니다. 등장인물은 전원 가상 인물입니다.",
            },
            {
              step: "2",
              title: "대화",
              body: "AI 대사는 자막과 함께 나옵니다. 말하기·버튼·직접 입력 중 편한 것으로 답하시면 됩니다.",
            },
            {
              step: "3",
              title: "턴 피드백",
              body: "충족과 코칭 두 가지로만 알려 드리고, 근거 문서를 함께 보여 드립니다.",
            },
            {
              step: "4",
              title: "마무리",
              body: "충족한 원칙과 다음에 바꿔볼 점을 정리해 기기 안에만 저장합니다.",
            },
          ].map((item) => (
            <li
              key={item.step}
              className="grid grid-cols-[3rem_1fr] gap-x-4 py-5 md:grid-cols-[5rem_1fr] md:gap-x-6"
            >
              <span
                aria-hidden="true"
                className="chim-stat text-2xl text-brand-600 md:text-3xl"
              >
                {item.step}
              </span>
              <div>
                <h3 className="chim-label font-extrabold text-ink">{item.title}</h3>
                <p className="chim-body mt-1.5 max-w-2xl text-ink-soft">{item.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </PageShell>
  );
}
