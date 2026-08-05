import type { Metadata } from "next";
import Link from "next/link";
import type { ScenarioType } from "@/types";
import { EyebrowLabel, InlineDisclaimer, PageShell, ScreenHeader } from "@/components";
import { SOURCE_DOCS } from "@/data/docs";
import {
  getMatrixRow,
  MATRIX_LEVEL_LABELS,
  MATRIX_TYPE_LABELS,
  MATRIX_TYPE_NOTES,
  SCENARIO_MATRIX,
} from "@/data/matrix";
import { getActiveScenarios } from "@/data/scenarios";
import { FICTION_NOTICE, scenarioHref } from "./_components/constants";
import { PracticeCount } from "./_components/PracticeCount";

/* ── 훈련 목록 = 시안 7a ───────────────────────────────────────
   위에서부터: 헤더(훈련 + 한 줄) → 활성 3종 카드 → 「전체 12종 편성표 ⌄」 접힘 행
   → 가상 인물 고지 한 줄 → 인라인 고지.

   카드는 시안의 인라인 값 그대로입니다 — paper-2 면 radius 14, 15/16px 안쪽 여백,
   eyebrow 12/700 muted · 제목 17/700 · 한 줄 요약 13.5 ink-soft · 하단 [해 본 횟수 | 연습하기 ›].
   **루브릭 코드(LO/RE/SA/CO)는 이 화면에 노출하지 않습니다**(가이드 v4 §4.10) —
   12종 편성표와 학습목표 원문은 각각 접힘 안에 있습니다.
   ─────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: "훈련",
  description:
    "치매 행동·응급 판단·갈등 대응 3종을 말로 연습합니다. 정답 시험이 아니라 말이 나오게 만드는 연습입니다.",
};

/** 카드 eyebrow의 유형 낱말 — 시안 7a의 표기입니다(데이터의 긴 유형명 대신 목록용 짧은 말). */
const TYPE_SHORT: Record<ScenarioType, string> = {
  BPSD: "치매 행동",
  EMERGENCY: "응급 판단",
  CONFLICT: "갈등 대응",
  RISK: "위험 판단",
};

/** 매트릭스 세로축 라벨(「① BPSD」)을 카드와 같은 낱말로 옮깁니다. */
const MATRIX_TYPE_SHORT: Record<string, string> = {
  "① BPSD": "치매 행동",
  "② 응급": "응급 판단",
  "③ 갈등": "갈등 대응",
  "④ 위험 판단": "위험 판단",
};

/**
 * 카드 한 줄 요약 — 시안 7a의 카피입니다.
 * 데이터(`scenario.summary`)는 설계 문서용 문장이라 목록에서는 이 짧은 말을 씁니다.
 * 모르는 시나리오가 들어오면 데이터 쪽 요약으로 물러섭니다.
 */
const CARD_SUMMARY: Record<string, string> = {
  "CHK-A01": "저녁마다 집에 가겠다는 어르신 — 막지 않고 말로 방향 바꾸기",
  "CHK-B02": "기침이 멎는 순간을 알아채기 — 진짜 응급이 되면 AI가 빠집니다",
  "CHK-C01": "해 드릴 수 없는 일을 관계를 지키며 거절하기",
};

/** 첫 카드에만 붙는 안내 — 어디부터 해야 할지 묻지 않게 합니다(시안 7a). */
const FIRST_CARD_HINT = "처음이라면 여기부터";

/** 베타로 이연한 유형 — 「준비 중」으로만 두면 이유를 알 수 없어 편성표 아래 한 줄로 적습니다. */
const DEFERRED_TYPE_LABEL = "④ 위험 판단";

function levelLabelOf(level: 1 | 2 | 3): string {
  return MATRIX_LEVEL_LABELS.find((l) => l.level === level)?.label ?? "";
}

export default function TrainIndexPage() {
  const scenarios = getActiveScenarios();
  const openCount = SCENARIO_MATRIX.filter((cell) => cell.scenarioId).length;
  const lockedCount = SCENARIO_MATRIX.length - openCount;

  return (
    <PageShell sourceDocs={SOURCE_DOCS}>
      <ScreenHeader title="훈련" subtitle="정답 시험이 아닙니다 — 말이 나오게 만드는 연습" />

      {/* 활성 3종 — 이 화면에서 면(paper-2)을 쓰는 곳은 이 카드들뿐입니다. */}
      <section className="mt-4 space-y-[10px]" aria-label="지금 연습할 수 있는 상황">
        {scenarios.map((scenario, index) => {
          const eyebrow = [
            TYPE_SHORT[scenario.type],
            `약 ${scenario.durationMin}분`,
            index === 0 ? FIRST_CARD_HINT : null,
          ]
            .filter((part): part is string => Boolean(part))
            .join(" · ");

          return (
            <Link
              key={scenario.id}
              href={scenarioHref(scenario.id)}
              aria-label={`${scenario.title} — 브리핑 열기`}
              className="block rounded-[14px] bg-paper-2 px-4 py-[15px] transition-colors duration-150 ease-soft active:bg-neutral-line"
            >
              <span className="block text-[12px] leading-[1.5] font-bold text-ink-muted">
                {eyebrow}
              </span>
              <span className="mt-[4px] block text-[17px] leading-[1.4] font-bold text-ink">
                {scenario.title}
              </span>
              <span className="mt-[4px] block text-[13.5px] leading-[1.55] text-ink-soft">
                {CARD_SUMMARY[scenario.id] ?? scenario.summary}
              </span>
              <span className="mt-[10px] flex items-center gap-3">
                {/* 해 본 횟수는 기기(localStorage)에서만 읽습니다 — 마운트 뒤에 채워집니다. */}
                <PracticeCount scenarioId={scenario.id} />
                <span aria-hidden className="ml-auto text-[14px] leading-none font-bold text-brand-700">
                  연습하기 ›
                </span>
              </span>
            </Link>
          );
        })}
      </section>

      {/* 전체 12종 편성표 — 기본은 접혀 있습니다. 펼치면 유형 4종 × 난이도 3단계 매트릭스입니다. */}
      <details className="group mt-4">
        <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 border-t border-line px-[2px] py-[13px] text-[14.5px] leading-[1.4] font-semibold text-ink [&::-webkit-details-marker]:hidden">
          <span>
            전체 {SCENARIO_MATRIX.length}종 편성표{" "}
            <span className="font-medium text-ink-faint">
              — {openCount}종 열림 · {lockedCount}종 준비 중
            </span>
          </span>
          <span
            aria-hidden
            className="flex-none text-[13px] leading-none text-ink-ghost transition-transform duration-150 group-open:rotate-180"
          >
            ⌄
          </span>
        </summary>

        <div className="pb-2">
          {MATRIX_TYPE_LABELS.map((typeLabel) => (
            <section key={typeLabel} className="pt-[10px] pb-1">
              <EyebrowLabel>{MATRIX_TYPE_SHORT[typeLabel] ?? typeLabel}</EyebrowLabel>
              <ul className="mt-[2px]">
                {getMatrixRow(typeLabel).map((cell) => {
                  const open = Boolean(cell.scenarioId);
                  return (
                    <li
                      key={`${cell.typeLabel}-${cell.level}`}
                      className="flex items-baseline gap-[10px] border-b border-line py-[9px] last:border-b-0"
                    >
                      <span className="w-[30px] flex-none text-[12px] leading-[1.5] font-semibold text-ink-faint">
                        {levelLabelOf(cell.level)}
                      </span>
                      <span
                        className={`min-w-0 flex-1 text-[13px] leading-[1.5] ${open ? "font-semibold text-ink" : "text-ink-muted"}`}
                      >
                        {cell.title}
                      </span>
                      <span
                        className={`flex-none text-[11.5px] leading-[1.5] font-semibold ${open ? "text-brand-700" : "text-ink-faint"}`}
                      >
                        {open ? "열림" : "준비 중"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          <p className="mt-[10px] text-[11.5px] leading-[1.6] text-ink-faint">
            열린 {openCount}종만으로 루브릭 30항목이 한 번씩 실행되고, 생성 통제 3계층(L1·L2·L3)이 모두
            지나갑니다. 잠긴 칸은 같은 루브릭 30항목을 그대로 재사용합니다.
            <br />
            {MATRIX_TYPE_SHORT[DEFERRED_TYPE_LABEL]} 유형은 {MATRIX_TYPE_NOTES[DEFERRED_TYPE_LABEL]}
          </p>
        </div>
      </details>

      {/* 가상 인물 고지 한 줄 — 대사가 없는 화면이라 목록 끝에 조용히 답니다. */}
      <p className="mt-[10px] text-[11.5px] leading-[1.6] text-ink-faint">{FICTION_NOTICE}</p>

      <InlineDisclaimer size="md" tone="readable" className="mt-5 mb-6" />
    </PageShell>
  );
}
