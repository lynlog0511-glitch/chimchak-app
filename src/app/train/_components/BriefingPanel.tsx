"use client";

import { Badge, BigButton, Card, SourceChip } from "@/components";
import {
  IconChevronDown,
  IconClock,
  IconInfo,
  IconKeyboard,
  IconMic,
} from "@/components/icons";
import type { Scenario } from "@/types";
import { IconPointer } from "./icons";
import {
  FICTION_NOTICE,
  PRACTICE_LINE,
  ROLE_LABEL,
  TIER_LABEL,
  TYPE_TONE,
} from "./constants";

export interface BriefingPanelProps {
  scenario: Scenario;
  /** 마이크를 쓸 수 있는 환경인지 — 폴백 안내 문구를 바꿉니다 */
  micSupported: boolean;
  onStart: () => void;
}

/**
 * 시작 버튼 묶음 — 상단·하단 두 곳에 같은 모양으로 놓습니다.
 * 주인공은 「훈련 시작하기」 하나입니다. 나란한 두 버튼이 같은 무게를 가지면 위계가 사라집니다(§2).
 */
function StartButtons({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <BigButton onClick={onStart} size="lg" className="w-full sm:w-auto sm:min-w-[17rem]">
        훈련 시작하기
      </BigButton>
      <BigButton href="/train" variant="ghost" className="w-full sm:w-auto">
        다른 상황 고르기
      </BigButton>
    </div>
  );
}

/**
 * 시나리오 시작 전 브리핑.
 *
 * 기본 노출은 네 가지만 둡니다 — 상황 지문 · 등장인물 한 줄 · 고정 문구와 가상 인물 고지 · 시작 버튼.
 * 페르소나 상세, 제약 조건, 오늘 연습할 것, 판정 근거, 응답 방법은 “자세히 보기”로 접어 두어
 * 첫 화면에서 바로 훈련을 시작하실 수 있게 했습니다.
 */
export function BriefingPanel({ scenario, micSupported, onStart }: BriefingPanelProps) {
  return (
    <div className="space-y-5">
      <header>
        {/* 필은 유형 하나만 두고, 난이도·소요·계층은 세로줄 없이 여백으로만 나눕니다(§1-2). */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Badge tone={TYPE_TONE[scenario.type]}>{scenario.typeLabel}</Badge>
          <span className="chim-caption font-semibold text-ink-muted">
            {scenario.levelLabel} · 약 {scenario.durationMin}분
          </span>
          {scenario.tiers.map((tier) => (
            <span key={tier} className="chim-caption font-bold text-ink-muted">
              {TIER_LABEL[tier]}
            </span>
          ))}
        </div>
        {/* 브리핑의 주인공은 제목과 시작 버튼입니다 — 제목만 페이지 제목 크기로 올립니다(§2). */}
        <h1 className="chim-h1 mt-3 text-ink">{scenario.title}</h1>
      </header>

      {/* ① 상황 지문 + ② 등장인물 한 줄 요약 — 카드 두 장을 하나로 합쳐 첫 화면 밀도를 낮춥니다(§6) */}
      <Card>
        <h2 className="chim-h3 text-ink">상황</h2>
        <p className="chim-body mt-2 text-ink">{scenario.context}</p>

        <div className="mt-5 border-t border-line pt-4">
          <h2 className="chim-caption font-bold text-ink-muted">등장인물</h2>
          {/* 정보 위계가 낮은 목록이라 필도 세로줄도 쓰지 않고 여백으로만 나눕니다. */}
          <ul className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1">
            {scenario.personas.map((persona) => (
              <li key={persona.name} className="flex items-baseline gap-2">
                <span className="chim-label font-bold text-ink">{persona.name}</span>
                <span className="chim-caption font-semibold text-ink-muted">
                  {ROLE_LABEL[persona.role]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      {/* ③ 고정 문구 · 가상 인물 고지 — 이 화면에서 색 면은 이 블록 하나입니다(§1-3) */}
      <Card tone="brand" padded={false} className="p-4 md:p-5">
        <p className="chim-core-sm font-extrabold text-brand-900">“{PRACTICE_LINE}”</p>
        <p className="chim-caption mt-2 flex items-start gap-2 leading-relaxed font-semibold text-brand-800">
          <IconInfo className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{FICTION_NOTICE}</span>
        </p>
      </Card>

      {/* ④ 시작 버튼 (상단) */}
      <StartButtons onStart={onStart} />

      {/* 나머지는 접어 둡니다 — 필요하실 때만 펼쳐 보시면 됩니다(§6). 접힌 정보는 전부 조용한 크기로. */}
      <details className="group rounded-card bg-white">
        <summary className="chim-label flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-3 rounded-card px-5 py-4 font-bold text-ink-soft hover:bg-brand-50 [&::-webkit-details-marker]:hidden">
          <span>자세히 보기 — 인물 소개 · 제약 조건 · 오늘 연습할 것 · 판정 근거 · 응답 방법</span>
          <IconChevronDown className="h-5 w-5 shrink-0 text-ink-muted transition-transform duration-150 group-open:rotate-180" />
        </summary>

        <div className="space-y-5 border-t border-line p-5 md:p-6">
          <section>
            <h2 className="chim-body font-extrabold text-ink">인물 소개</h2>
            <p className="chim-caption mt-1 font-semibold text-ink-muted">{FICTION_NOTICE}</p>
            <ul className="mt-3 space-y-4">
              {scenario.personas.map((persona) => (
                <li
                  key={persona.name}
                  className="border-t border-line pt-4 first:border-t-0 first:pt-0"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="chim-label font-extrabold text-ink">{persona.name}</span>
                    <Badge tone="neutral">{ROLE_LABEL[persona.role]}</Badge>
                  </div>
                  <p className="chim-meta mt-1.5 leading-relaxed text-ink-soft">{persona.profile}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-card bg-paper-2 p-4">
            <h2 className="chim-body font-extrabold text-ink">제약 조건</h2>
            <ul className="mt-3 space-y-2">
              {scenario.constraints.map((constraint) => (
                <li key={constraint} className="chim-meta flex gap-2 leading-relaxed text-ink">
                  <span aria-hidden="true" className="text-ink-muted">
                    ·
                  </span>
                  <span>{constraint}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="chim-body font-extrabold text-ink">오늘 연습할 것</h2>
            <ul className="mt-3 space-y-2">
              {scenario.objectives.map((objective) => (
                <li key={objective} className="chim-meta flex gap-2 leading-relaxed text-ink-soft">
                  <span aria-hidden="true" className="text-brand-500">
                    ·
                  </span>
                  <span>{objective}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="border-t border-line pt-4">
            <h2 className="chim-body font-extrabold text-ink">이 훈련의 판정 근거</h2>
            <p className="chim-meta mt-2 leading-relaxed text-ink-soft">
              피드백에는 아래 문서에서 확인한 내용만 붙습니다. 근거를 찾지 못하면 “공식 지침에서
              근거를 찾지 못했습니다. 담당 간호사 또는 기관에 확인해 주세요.”라고 그대로
              말씀드립니다.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {scenario.sourceDocs.map((docId) => (
                <SourceChip key={docId} docId={docId} />
              ))}
            </div>
          </section>

          <section className="border-t border-line pt-4">
            <h2 className="chim-body font-extrabold text-ink">응답 방법</h2>
            <ul className="chim-meta mt-3 space-y-2.5 leading-relaxed text-ink-soft">
              <li className="flex gap-2.5">
                <IconMic className="mt-1 h-5 w-5 shrink-0 text-brand-700" />
                <span>
                  {micSupported
                    ? "마이크 버튼을 누르면 브라우저가 마이크 허용을 물어봅니다. ‘허용’을 누르신 뒤 버튼을 다시 눌러 말씀해 주세요."
                    : "이 기기에서는 음성 인식을 쓸 수 없습니다. 버튼과 직접 입력만으로 끝까지 진행하실 수 있습니다."}
                </span>
              </li>
              <li className="flex gap-2.5">
                <IconPointer className="mt-1 h-5 w-5 shrink-0 text-brand-700" />
                <span>
                  말하기가 어려우시면 아래 보기 버튼을 고르셔도 됩니다. 버튼은 항상 열려 있습니다.
                </span>
              </li>
              <li className="flex gap-2.5">
                <IconKeyboard className="mt-1 h-5 w-5 shrink-0 text-brand-700" />
                <span>직접 입력창에 문장을 적어 보내셔도 됩니다.</span>
              </li>
              <li className="flex gap-2.5">
                <IconClock className="mt-1 h-5 w-5 shrink-0 text-brand-700" />
                <span>
                  응답 대기 시간이 표시되지만, 시간이 지나도 자동으로 넘어가지 않습니다. 천천히
                  하셔도 됩니다.
                </span>
              </li>
            </ul>
          </section>
        </div>
      </details>

      {/* 시작 버튼 (하단) — 데스크톱은 한 화면에 다 들어와 상단 버튼과 중복되므로 모바일에서만 보입니다. */}
      <div className="md:hidden">
        <StartButtons onStart={onStart} />
      </div>
    </div>
  );
}

export default BriefingPanel;
