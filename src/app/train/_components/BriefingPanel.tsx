"use client";

import type { ReactNode } from "react";
import { BigButton, InlineDisclaimer, SessionTopBar, SourceChip } from "@/components";
import { progressStepCount, type SessionProgress } from "@/lib/storage";
import type { Scenario } from "@/types";
import { FICTION_NOTICE, PRACTICE_LINE, ROLE_LABEL } from "./constants";

export interface BriefingPanelProps {
  scenario: Scenario;
  /** 마이크를 쓸 수 있는 환경인지 — 폴백 안내 문구를 바꿉니다 */
  micSupported: boolean;
  onStart: () => void;
  /** 이 시나리오에 진행하던 훈련이 남아 있으면 맨 위에 「이어서 하기」 카드를 띄웁니다 */
  checkpoint?: SessionProgress | null;
  onResume?: () => void;
}

/**
 * 저장 시각 표기 — "8월 5일 오후 2:13".
 * 브라우저에서만 그려지므로(체크포인트를 기기에서 읽어 옵니다) 서버·클라이언트 표기가 어긋날 일이 없습니다.
 */
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

/** 접이식 한 칸 — 시안에는 없는 화면이라 같은 문법(면 없는 hairline 행 + ⌄)으로 전개합니다. */
function Fold({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group border-t border-line">
      <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <span
          aria-hidden
          className="text-[13px] text-faint transition-transform duration-150 group-open:rotate-180"
        >
          ⌄
        </span>
      </summary>
      <div className="pb-5">{children}</div>
    </details>
  );
}

/**
 * 「이어서 하기」 — 진행하던 훈련이 남아 있을 때만 맨 위에 섭니다.
 * 조용한 안내라 면 하나(`#f5f6f6`)에 얹고 배지도 액센트도 쓰지 않습니다.
 */
function ResumeBlock({
  progress,
  onResume,
  onRestart,
}: {
  progress: SessionProgress;
  onResume: () => void;
  onRestart: () => void;
}) {
  const savedAt = formatSavedAt(progress.savedAt);
  const step = progressStepCount(progress);
  const meta = savedAt ? `${step}번째 상황까지 · ${savedAt} 저장` : `${step}번째 상황까지`;

  return (
    <div className="rounded-card bg-paper-2 p-4">
      <h2 className="text-[15px] leading-[1.4] font-bold text-ink">진행하던 훈련이 있습니다</h2>
      <p className="mt-1 text-[12.5px] leading-[1.5] font-semibold text-ink-muted">{meta}</p>
      <p className="mt-2 text-[12.5px] leading-[1.6] text-ink-muted">
        저장해 둔 것은 어느 갈래를 고르셨는지와 진행 위치뿐입니다. 말씀하신 내용은 기기에도 남기지
        않았습니다.
      </p>
      <div className="mt-3 space-y-2">
        <BigButton onClick={onResume} block>
          이어서 하기
        </BigButton>
        <BigButton onClick={onRestart} variant="secondary" block>
          처음부터 하기
        </BigButton>
      </div>
    </div>
  );
}

/**
 * 시나리오 시작 전 브리핑.
 *
 * 시안에는 없는 화면이라 v4 §3의 문법으로 전개합니다 —
 * 컴팩트 상단 바 → 22px 제목 → 지문·등장인물 → 고정 문구 → CTA → 접이식 → 인라인 고지.
 *
 * 기본 노출은 네 가지입니다: 상황 지문 · 등장인물 한 줄 · 고정 문구와 가상 인물 고지 · 시작 버튼.
 * 인물 상세, 제약 조건, 오늘 연습할 것, 판정 근거, 응답 방법은 접어 두었습니다.
 */
export function BriefingPanel({
  scenario,
  micSupported,
  onStart,
  checkpoint,
  onResume,
}: BriefingPanelProps) {
  return (
    <div className="px-[18px] pb-10">
      <SessionTopBar
        title="훈련 준비"
        status={`${scenario.typeLabel} · ${scenario.levelLabel} · 약 ${scenario.durationMin}분`}
        backHref="/train"
        backLabel="훈련 목록으로"
      />

      {/* 진행하던 훈련이 있으면 브리핑보다 먼저 보여 드립니다 — 「처음부터」는 새로 시작하는 것과 같습니다. */}
      {checkpoint && onResume && (
        <div className="mb-5">
          <ResumeBlock progress={checkpoint} onResume={onResume} onRestart={onStart} />
        </div>
      )}

      {/* 상단 바가 이미 h1(「훈련 준비」)을 가지고 있어 상황 제목은 h2로 둡니다. */}
      <h2 className="text-[22px] leading-[1.3] font-extrabold tracking-[-0.01em] text-ink">
        {scenario.title}
      </h2>
      <p className="mt-2.5 text-[15px] leading-[1.65] text-ink-soft">{scenario.context}</p>

      {/* 등장인물 — 위계가 낮은 목록이라 카드 대신 여백으로만 나눕니다. */}
      <ul className="mt-4 space-y-1">
        {scenario.personas.map((persona) => (
          <li key={persona.name} className="flex items-baseline gap-2 text-[13px] leading-[1.6]">
            <span className="font-bold text-ink">{persona.name}</span>
            <span className="text-ink-muted">{ROLE_LABEL[persona.role]}</span>
          </li>
        ))}
      </ul>

      {/* 고정 문구 · 가상 인물 고지 — 이 화면에서 색 면은 이 블록 하나입니다. */}
      <div className="mt-5 rounded-card bg-tint p-4">
        <p className="text-[16px] leading-[1.55] font-bold text-deep">“{PRACTICE_LINE}”</p>
        <p className="mt-2 text-[12.5px] leading-[1.6] font-semibold text-brand-800">
          {FICTION_NOTICE}
        </p>
      </div>

      <div className="mt-5 space-y-2">
        <BigButton onClick={onStart} size="lg" block>
          훈련 시작하기
        </BigButton>
        <BigButton href="/train" variant="secondary" block>
          다른 상황 고르기
        </BigButton>
      </div>

      <div className="mt-6 border-b border-line">
        <Fold title="인물 소개">
          <p className="text-[12.5px] leading-[1.6] font-semibold text-ink-muted">
            {FICTION_NOTICE}
          </p>
          <ul className="mt-2 space-y-3">
            {scenario.personas.map((persona) => (
              <li key={persona.name}>
                <p className="text-[14px] leading-[1.5] font-bold text-ink">
                  {persona.name}
                  <span className="ml-2 text-[12.5px] font-semibold text-ink-muted">
                    {ROLE_LABEL[persona.role]}
                  </span>
                </p>
                <p className="mt-1 text-[13px] leading-[1.65] text-ink-soft">{persona.profile}</p>
              </li>
            ))}
          </ul>
        </Fold>

        <Fold title="제약 조건">
          <ul className="space-y-1.5">
            {scenario.constraints.map((constraint) => (
              <li key={constraint} className="flex gap-2 text-[13px] leading-[1.65] text-ink">
                <span aria-hidden className="text-faint">
                  ·
                </span>
                <span>{constraint}</span>
              </li>
            ))}
          </ul>
        </Fold>

        <Fold title="오늘 연습할 것">
          <ul className="space-y-1.5">
            {scenario.objectives.map((objective) => (
              <li key={objective} className="flex gap-2 text-[13px] leading-[1.65] text-ink-soft">
                <span aria-hidden className="text-brand-400">
                  ·
                </span>
                <span>{objective}</span>
              </li>
            ))}
          </ul>
        </Fold>

        <Fold title="이 훈련의 판정 근거">
          <p className="text-[13px] leading-[1.65] text-ink-soft">
            피드백에는 아래 문서에서 확인한 내용만 붙습니다. 근거를 찾지 못하면 “공식 지침에서
            근거를 찾지 못했습니다. 담당 간호사 또는 기관에 확인해 주세요.”라고 그대로 말씀드립니다.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {scenario.sourceDocs.map((docId) => (
              <SourceChip key={docId} docId={docId} />
            ))}
          </div>
        </Fold>

        <Fold title="응답 방법">
          <ul className="space-y-2 text-[13px] leading-[1.65] text-ink-soft">
            <li>
              <span className="font-bold text-ink">말하기 — </span>
              {micSupported
                ? "마이크 버튼을 누르면 브라우저가 마이크 허용을 물어봅니다. ‘허용’을 누르신 뒤 버튼을 다시 눌러 말씀해 주세요."
                : "이 기기에서는 음성 인식을 쓸 수 없습니다. 버튼과 직접 입력만으로 끝까지 진행하실 수 있습니다."}
            </li>
            <li>
              <span className="font-bold text-ink">고르기 — </span>
              말하기가 어려우시면 제안 버튼을 고르셔도 됩니다. 버튼은 항상 열려 있습니다.
            </li>
            <li>
              <span className="font-bold text-ink">직접 입력 — </span>
              입력창에 문장을 적어 보내셔도 됩니다.
            </li>
            <li>
              <span className="font-bold text-ink">여유 시간 — </span>
              남은 시간이 표시되지만, 시간이 지나도 자동으로 넘어가지 않습니다. 천천히 하셔도
              됩니다.
            </li>
          </ul>
        </Fold>
      </div>

      <InlineDisclaimer size="md" tone="readable" className="mt-6" />
    </div>
  );
}

export default BriefingPanel;
