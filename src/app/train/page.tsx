import type { Metadata } from "next";
import type { ScenarioType } from "@/types";
import {
  EyebrowLabel,
  InlineDisclaimer,
  ListRow,
  ListRows,
  PageShell,
  ScreenHeader,
} from "@/components";
import { SOURCE_DOCS } from "@/data/docs";
import { MATRIX_LEVEL_LABELS, MATRIX_TYPE_NOTES, SCENARIO_MATRIX } from "@/data/matrix";
import { getActiveScenarios } from "@/data/scenarios";
import { FICTION_NOTICE, PRACTICE_LINE, scenarioHref } from "./_components/constants";

/* ── 훈련 목록 ─────────────────────────────────────────────────
   시안에는 없는 화면이라 v4 §2 공통 문법으로 전개했습니다
   (22px 제목 헤더 + 리스트 행 + 인라인 고지 — 홈 5a·응급 5b와 같은 언어).

   위에서부터: 상단 바 → 고정 문구·가상 인물 고지 → 활성 3종 리스트 →
   준비 중 9종(흐린 행) → 진행 4단계 → 인라인 고지.
   v3의 카드 그리드·12종 매트릭스 표는 앱 프레임(430px)에서 읽히지 않아
   같은 내용을 선으로 나눈 리스트로 옮겼습니다 — 항목 수는 그대로 3 + 9종입니다.
   ─────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: "훈련",
  description:
    "치매 행동심리증상·응급 초기 대응·갈등 화법 3종을 대화로 연습하고, 턴마다 근거와 함께 피드백을 받습니다.",
};

/**
 * 유형 짧은 라벨 — 부제 한 줄에 「유형 · 난이도 · 소요」를 담기 위한 표기입니다.
 * 시안 5c(성장 기록)의 4칸 카피와 같은 낱말을 씁니다.
 */
const TYPE_SHORT: Record<ScenarioType, string> = {
  BPSD: "치매 행동",
  EMERGENCY: "응급 판단",
  CONFLICT: "갈등 대응",
  RISK: "위험 판단",
};

/** 매트릭스 세로축 라벨(「① BPSD」)을 위 짧은 라벨과 같은 낱말로 옮깁니다. */
const MATRIX_TYPE_SHORT: Record<string, string> = {
  "① BPSD": "치매 행동",
  "② 응급": "응급 판단",
  "③ 갈등": "갈등 대응",
  "④ 위험 판단": "위험 판단",
};

/** 베타로 이연한 유형 — 「—」로만 두면 이유를 알 수 없어 아래에 한 줄로 적습니다. */
const DEFERRED_TYPE_LABEL = "④ 위험 판단";

const FLOW_STEPS: readonly { title: string; body: string }[] = [
  {
    title: "브리핑",
    body: "페르소나·상황·제약 조건을 먼저 읽습니다. 등장인물은 전원 가상 인물입니다.",
  },
  {
    title: "대화",
    body: "AI 대사는 자막과 함께 나옵니다. 말하기·버튼·직접 입력 중 편한 것으로 답하시면 됩니다.",
  },
  {
    title: "턴 피드백",
    body: "충족과 코칭 두 가지로만 알려 드리고, 근거 문서를 함께 보여 드립니다.",
  },
  {
    title: "마무리",
    body: "충족한 원칙과 다음에 바꿔볼 점을 정리해 기기 안에만 저장합니다.",
  },
];

function levelLabelOf(level: 1 | 2 | 3): string {
  return MATRIX_LEVEL_LABELS.find((l) => l.level === level)?.label ?? "";
}

export default function TrainIndexPage() {
  const scenarios = getActiveScenarios();
  const locked = SCENARIO_MATRIX.filter((cell) => !cell.scenarioId);

  return (
    <PageShell sourceDocs={SOURCE_DOCS}>
      <ScreenHeader
        title="훈련"
        subtitle="AI는 어르신·보호자 역만 맡습니다 — 옳고 그름의 판정은 법령과 공단 지침이 합니다"
      />

      {/* 고정 문구 + 가상 인물 고지 — 큰 글자는 헤더 하나뿐이라 여기서는 면 위 14.5px으로 둡니다. */}
      <div className="mt-[14px] rounded-[14px] bg-paper-2 px-[15px] py-[14px]">
        <p className="text-[14.5px] leading-[1.55] font-bold text-ink">{PRACTICE_LINE}</p>
        <p className="mt-[6px] text-[12px] leading-[1.6] text-ink-muted">{FICTION_NOTICE}</p>
      </div>

      {/* 활성 3종 — 아이콘 없이 [제목 17.5px + 부제 12.5px] + `›` (v4 §2) */}
      <section className="mt-[20px]" aria-labelledby="train-active">
        <EyebrowLabel id="train-active" className="mb-[2px]">
          지금 연습할 수 있는 3종
        </EyebrowLabel>
        <ListRows>
          {scenarios.map((scenario) => (
            <ListRow
              key={scenario.id}
              size="lg"
              href={scenarioHref(scenario.id)}
              ariaLabel={`${scenario.title} 브리핑 열기`}
              title={scenario.title}
              subtitle={`${TYPE_SHORT[scenario.type]} · ${scenario.levelLabel} · 약 ${scenario.durationMin}분`}
            />
          ))}
        </ListRows>
        <p className="mt-[8px] text-[11.5px] leading-[1.6] text-tertiary">
          이 3종만으로 루브릭 30항목이 한 번씩 실행되고, 생성 통제 3계층(L1·L2·L3)이 모두
          지나갑니다.
        </p>
      </section>

      {/* 준비 중 9종 — 같은 리스트 문법을 쓰되 잉크를 한 단 낮춰 눌러 둡니다. */}
      <section className="mt-[22px]" aria-labelledby="train-locked">
        <EyebrowLabel id="train-locked" className="mb-[2px]">
          준비 중 9종
        </EyebrowLabel>
        <ListRows>
          {locked.map((cell) => (
            <ListRow
              key={`${cell.typeLabel}-${cell.level}`}
              size="lg"
              title={<span className="text-ink-muted">{cell.title}</span>}
              subtitle={
                <span className="text-faint">
                  {MATRIX_TYPE_SHORT[cell.typeLabel] ?? cell.typeLabel} ·{" "}
                  {levelLabelOf(cell.level)}
                </span>
              }
              trailing={
                <span className="flex-none text-[12px] leading-none font-semibold text-tertiary">
                  준비 중
                </span>
              }
            />
          ))}
        </ListRows>
        <p className="mt-[8px] text-[11.5px] leading-[1.6] text-tertiary">
          유형 4종 × 난이도 3단계로 설계했고, 잠긴 칸은 같은 루브릭 30항목을 그대로 재사용합니다.
          <br />
          {MATRIX_TYPE_SHORT[DEFERRED_TYPE_LABEL]} — {MATRIX_TYPE_NOTES[DEFERRED_TYPE_LABEL]}
        </p>
      </section>

      {/* 진행 4단계 — 카드 없이 hairline 행으로만 (v4 §2) */}
      <section className="mt-[22px]" aria-labelledby="train-flow">
        <EyebrowLabel id="train-flow" className="mb-[6px]">
          훈련은 이렇게 진행됩니다
        </EyebrowLabel>
        <ol className="chim-hairline border-t border-line">
          {FLOW_STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-[10px] py-[13px]">
              <span
                aria-hidden
                className="chim-num w-[13px] flex-none text-[13px] leading-[1.5] font-extrabold text-brand-700"
              >
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-[14px] leading-[1.45] font-bold text-ink">{step.title}</p>
                <p className="mt-[2px] text-[12.5px] leading-[1.6] text-ink-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <InlineDisclaimer size="md" tone="readable" className="mt-6 mb-6" />
    </PageShell>
  );
}
