"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  BackGlyph,
  BigButton,
  EyebrowLabel,
  InlineDisclaimer,
  REVIEW_PENDING_LABEL,
  SourceChip,
} from "@/components";
import { ChevronGlyph } from "@/components/icons";
import { progressStepCount, type SessionProgress } from "@/lib/storage";
import { isLikelyInAppBrowser, unlockAudio } from "@/lib/speech";
import type { Scenario } from "@/types";
import { scenarioPracticeStepCount } from "./sessionProgress";
import {
  FICTION_NOTICE,
  initialOf,
  MIC_CHECKING_LINE,
  ROLE_LABEL,
  type MicCheck,
} from "./constants";

export interface BriefingPanelProps {
  scenario: Scenario;
  /** 마이크를 쓸 수 있는 환경인지 — 판정 전(`unknown`)에는 단정하지 않습니다. */
  micCheck: MicCheck;
  onStart: () => void;
  /** 이 시나리오에 진행하던 연습이 남아 있으면 이어 하기부터 보여 줍니다. */
  checkpoint?: SessionProgress | null;
  onResume?: () => void;
}

function objectiveText(raw: string): string {
  return raw
    .replace(/^LO-\d+\s*/, "")
    .replace(/\s*\([^()]*\)\s*$/, "")
    .trim();
}

function constraintDetail(raw: string): string {
  const text = raw.trim();
  const match = /^C(\d+)\s*([\s\S]*)$/.exec(text);
  return match ? `제약 ${match[1]} · ${match[2].trim()}` : text;
}

function plainName(name: string): string {
  return name.replace(/\s*\((?:가상 인물|사용자 본인)\)\s*/g, " ").trim();
}

function Fold({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group border-y border-line">
      <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-3 rounded-field px-1 py-3 text-[1rem] leading-[1.45] font-bold text-ink transition-colors duration-150 active:bg-paper-2 [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <ChevronGlyph size="sm" className="flex-none text-ink-ghost group-open:rotate-180" />
      </summary>
      <div className="px-1 pb-5">{children}</div>
    </details>
  );
}

function formatSavedAt(iso: string): string {
  if (!iso) return "";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(at);
  } catch {
    return "";
  }
}

function ResumeBlock({
  progress,
  onResume,
  onStartOver,
}: {
  progress: SessionProgress;
  onResume: () => void;
  onStartOver: () => void;
}) {
  const [confirmingStartOver, setConfirmingStartOver] = useState(false);
  const step = progressStepCount(progress);
  const savedAt = formatSavedAt(progress.savedAt);

  if (confirmingStartOver) {
    return (
      <section
        className="rounded-card bg-paper-2 px-4 py-4"
        aria-labelledby="start-over-title"
        aria-live="polite"
      >
        <h2 id="start-over-title" className="text-[1.1875rem] leading-[1.45] font-extrabold text-ink">
          처음부터 할까요?
        </h2>
        <p className="mt-2 text-[1rem] leading-[1.6] text-ink-soft">
          저장된 진행이 지워집니다.
        </p>
        <div className="mt-4 space-y-2">
          <BigButton
            onClick={() => {
              unlockAudio();
              onStartOver();
            }}
            variant="danger"
            size="lg"
            block
          >
            처음부터 시작
          </BigButton>
          <BigButton onClick={() => setConfirmingStartOver(false)} variant="secondary" block>
            취소
          </BigButton>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-card bg-paper-2 px-4 py-4" aria-labelledby="resume-title">
      <h2 id="resume-title" className="text-[1.1875rem] leading-[1.45] font-extrabold text-ink">
        이어 할 연습이 있어요
      </h2>
      <p className="mt-2 text-[1rem] leading-[1.6] text-ink-soft">
        {step > 0 ? `${step}단계까지 했어요. ` : ""}멈춘 곳부터 이어집니다.
      </p>
      {savedAt && (
        <p className="mt-1 text-[0.8438rem] leading-[1.45] text-ink-muted">{savedAt} 저장</p>
      )}
      <div className="mt-4 space-y-2">
        <BigButton
          onClick={() => {
            unlockAudio();
            onResume();
          }}
          size="lg"
          block
        >
          이어서 하기
        </BigButton>
        <BigButton
          onClick={() => setConfirmingStartOver(true)}
          variant="secondary"
          block
        >
          처음부터 하기
        </BigButton>
      </div>
    </section>
  );
}

export function BriefingPanel({
  scenario,
  micCheck,
  onStart,
  checkpoint,
  onResume,
}: BriefingPanelProps) {
  const steps = scenarioPracticeStepCount(scenario);
  const canResume = Boolean(checkpoint && onResume);

  return (
    <div className="chim-pad w-full pb-10">
      <div className="pt-1 pb-1">
        <Link
          href="/train"
          className="-ml-0.5 inline-flex min-h-[48px] items-center gap-2 rounded-field pr-2 text-[0.9375rem] leading-none font-bold text-ink-muted transition-colors duration-150 hover:text-ink active:bg-paper-2"
        >
          <BackGlyph />
          상황 고르기
        </Link>
      </div>

      <EyebrowLabel>
        약 {scenario.durationMin}분 · {steps}단계
      </EyebrowLabel>
      <h1 className="mt-1.5 text-[1.4375rem] leading-[1.3] font-extrabold tracking-[-0.02em] text-ink">
        {scenario.title}
      </h1>

      <section className="mt-4 rounded-card bg-paper-2 px-4 py-4" aria-labelledby="situation-title">
        <h2 id="situation-title" className="text-[1.0625rem] leading-[1.45] font-extrabold text-ink">
          지금 상황
        </h2>
        <div className="mt-2 space-y-1.5">
          {scenario.situationLines.map((line) => (
            <p key={line} className="text-[1.0625rem] leading-[1.6] text-ink">
              {line}
            </p>
          ))}
        </div>
      </section>

      <section className="mt-4" aria-labelledby="practice-points-title">
        <h2
          id="practice-points-title"
          className="text-[1.0625rem] leading-[1.45] font-extrabold text-ink"
        >
          이번에 연습할 것
        </h2>
        <ol className="mt-2 space-y-2">
          {scenario.practicePoints.map((point, index) => (
            <li key={point} className="flex gap-3 text-[1.0625rem] leading-[1.6] text-ink-soft">
              <span
                aria-hidden
                className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-paper-2 text-[0.9375rem] font-extrabold text-ink"
              >
                {index + 1}
              </span>
              <span>{point}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-4">
        {checkpoint && onResume ? (
          <ResumeBlock progress={checkpoint} onResume={onResume} onStartOver={onStart} />
        ) : (
          <BigButton
            onClick={() => {
              unlockAudio();
              onStart();
            }}
            size="lg"
            block
          >
            연습 시작
          </BigButton>
        )}
      </div>

      <div className="mt-5">
        <Fold title="자세한 안내 보기">
          <section>
            <h2 className="text-[1rem] leading-[1.45] font-bold text-ink">상황 전체 보기</h2>
            <p className="mt-2 text-[0.9375rem] leading-[1.6] text-ink-soft">{scenario.context}</p>
            {scenario.constraints.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {scenario.constraints.map((constraint) => (
                  <li key={constraint} className="text-[0.9375rem] leading-[1.6] text-ink-soft">
                    {constraintDetail(constraint)}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-5 border-t border-line pt-4">
            <h2 className="text-[1rem] leading-[1.45] font-bold text-ink">등장인물</h2>
            <p className="mt-2 text-[0.8438rem] leading-[1.6] font-semibold text-ink-muted">
              {FICTION_NOTICE}
            </p>
            <ul className="mt-3 space-y-3">
              {scenario.personas.map((persona) => (
                <li key={persona.name} className="flex gap-3">
                  <span
                    aria-hidden
                    className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-paper-out text-[0.9375rem] font-bold text-ink-soft"
                  >
                    {initialOf(persona.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.9375rem] leading-[1.45] font-bold text-ink">
                      {plainName(persona.name)} · {ROLE_LABEL[persona.role]}
                    </span>
                    <span className="mt-1 block text-[0.9375rem] leading-[1.6] text-ink-soft">
                      {persona.profile}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-5 border-t border-line pt-4">
            <h2 className="text-[1rem] leading-[1.45] font-bold text-ink">답하는 방법</h2>
            <ul className="mt-2 space-y-2 text-[0.9375rem] leading-[1.6] text-ink-soft">
              <li>
                <b className="text-ink">말하기 · </b>
                {micCheck === "unknown"
                  ? `${MIC_CHECKING_LINE}. 예시 문장과 직접 입력은 지금도 쓸 수 있어요.`
                  : micCheck === "yes"
                    ? `마이크 버튼을 누른 채 말하고, 다 말하면 손을 떼세요. 처음 한 번은 ‘허용’을 눌러 주세요.${
                        isLikelyInAppBrowser()
                          ? " 음성이 열리지 않으면 크롬 같은 기본 브라우저로 열어 주세요."
                          : ""
                      }`
                    : "이 기기에서는 음성 인식을 쓸 수 없어요. 예시 문장이나 직접 입력으로 끝까지 할 수 있어요."}
              </li>
              <li>
                <b className="text-ink">예시 문장 · </b>말이 막히면 화면의 문장을 골라 답하세요.
              </li>
              <li>
                <b className="text-ink">천천히 · </b>시간 제한이 없어요. 준비되면 답하세요.
              </li>
            </ul>
          </section>

          <section className="mt-5 border-t border-line pt-4">
            <h2 className="text-[1rem] leading-[1.45] font-bold text-ink">학습목표와 확인 항목</h2>
            <ul className="mt-2 space-y-1.5">
              {scenario.objectives.map((objective) => (
                <li key={objective} className="text-[0.9375rem] leading-[1.6] text-ink-soft">
                  {objectiveText(objective)}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[0.8438rem] leading-[1.6] text-ink-muted">
              채점표가 아니라 확인표예요. 점수와 등급은 표시하지 않아요.
            </p>
          </section>

          <section className="mt-5 border-t border-line pt-4">
            <h2 className="text-[1rem] leading-[1.45] font-bold text-ink">판정 근거 문서</h2>
            <p className="mt-2 text-[0.9375rem] leading-[1.6] text-ink-soft">
              피드백에는 아래 문서에서 확인한 내용만 붙어요. 근거를 찾지 못하면 담당 간호사 또는
              기관에 확인하도록 안내해요.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {scenario.sourceDocs.map((docId) => (
                <SourceChip key={docId} docId={docId} />
              ))}
            </div>
          </section>

          {scenario.reviewPending && (
            <p className="mt-5 border-t border-line pt-4 text-[0.8438rem] leading-[1.6] text-ink-muted">
              {REVIEW_PENDING_LABEL} — 현직 선생님들이 보고 계신 것은 어르신 대사 표현이에요. 판정
              근거 문서는 확정본이에요.
            </p>
          )}
          <InlineDisclaimer size="md" tone="readable" className="mt-5" />
        </Fold>
      </div>
      {canResume && (
        <p className="mt-3 text-[0.8438rem] leading-[1.6] text-ink-muted">
          저장된 진행에는 위치와 선택만 남고, 말씀하신 내용은 저장되지 않아요.
        </p>
      )}
    </div>
  );
}

export default BriefingPanel;
