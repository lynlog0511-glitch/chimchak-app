"use client";

import { Badge, BigButton, Card, SourceChip } from "@/components";
import type { Scenario } from "@/types";
import {
  FICTION_NOTICE,
  PRACTICE_LINE,
  ROLE_LABEL,
  TIER_LABEL,
  TIER_TONE,
  TYPE_TONE,
} from "./constants";

export interface BriefingPanelProps {
  scenario: Scenario;
  /** 마이크를 쓸 수 있는 환경인지 — 폴백 안내 문구를 바꿉니다 */
  micSupported: boolean;
  onStart: () => void;
}

/**
 * 시나리오 시작 전 브리핑.
 * 페르소나·상황·제약 조건을 먼저 읽고 들어가야 첫 응답에서 헤매지 않습니다.
 */
export function BriefingPanel({ scenario, micSupported, onStart }: BriefingPanelProps) {
  return (
    <div className="space-y-6">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={TYPE_TONE[scenario.type]}>{scenario.typeLabel}</Badge>
          <Badge tone="neutral">{scenario.levelLabel}</Badge>
          <Badge tone="neutral">약 {scenario.durationMin}분</Badge>
          {scenario.tiers.map((tier) => (
            <Badge key={tier} tone={TIER_TONE[tier]}>
              {TIER_LABEL[tier]}
            </Badge>
          ))}
        </div>
        <h1 className="mt-4 text-2xl font-extrabold text-ink md:text-4xl">{scenario.title}</h1>
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-ink-soft md:text-lg">
          {scenario.summary}
        </p>
      </header>

      <Card tone="brand">
        <p className="text-lg leading-relaxed font-extrabold text-brand-900">“{PRACTICE_LINE}”</p>
        <p className="mt-2 flex items-start gap-2 text-base leading-relaxed font-semibold text-brand-800">
          <span aria-hidden="true">◆</span>
          <span>{FICTION_NOTICE}</span>
        </p>
      </Card>

      <Card>
        <h2 className="text-lg font-extrabold text-ink">상황</h2>
        <p className="mt-2.5 text-base leading-relaxed text-ink">{scenario.context}</p>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-extrabold text-ink">등장인물</h2>
          <p className="mt-1 text-sm font-semibold text-ink-muted">{FICTION_NOTICE}</p>
          <ul className="mt-4 space-y-4">
            {scenario.personas.map((persona) => (
              <li key={persona.name} className="border-t border-line pt-4 first:border-t-0 first:pt-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-extrabold text-ink">{persona.name}</span>
                  <Badge tone="neutral">{ROLE_LABEL[persona.role]}</Badge>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{persona.profile}</p>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-5">
          <Card tone="warn">
            <h2 className="text-lg font-extrabold text-ink">제약 조건</h2>
            <ul className="mt-3 space-y-2">
              {scenario.constraints.map((constraint) => (
                <li key={constraint} className="flex gap-2 text-base leading-relaxed text-ink">
                  <span aria-hidden="true" className="text-warn-ink">
                    ·
                  </span>
                  <span>{constraint}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <h2 className="text-lg font-extrabold text-ink">오늘 연습할 것</h2>
            <ul className="mt-3 space-y-2">
              {scenario.objectives.map((objective) => (
                <li key={objective} className="flex gap-2 text-base leading-relaxed text-ink-soft">
                  <span aria-hidden="true" className="text-brand-500">
                    ·
                  </span>
                  <span>{objective}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <Card tone="quiet">
        <h2 className="text-lg font-extrabold text-ink">이 훈련의 판정 근거</h2>
        <p className="mt-2 text-base leading-relaxed text-ink-soft">
          피드백에는 아래 문서에서 확인한 내용만 붙습니다. 근거를 찾지 못하면 “공식 지침에서 근거를
          찾지 못했습니다. 담당 간호사 또는 기관에 확인해 주세요.”라고 그대로 말씀드립니다.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {scenario.sourceDocs.map((docId) => (
            <SourceChip key={docId} docId={docId} />
          ))}
        </div>
      </Card>

      <Card tone="quiet">
        <h2 className="text-lg font-extrabold text-ink">응답 방법</h2>
        <ul className="mt-3 space-y-2 text-base leading-relaxed text-ink-soft">
          <li className="flex gap-2">
            <span aria-hidden="true">🎙</span>
            <span>
              {micSupported
                ? "마이크 버튼을 누르고 있는 동안 말씀하시면 됩니다. 손을 떼면 인식이 끝나고, 인식된 문장을 확인한 뒤 보내실 수 있습니다."
                : "이 기기에서는 음성 인식을 쓸 수 없습니다. 버튼과 직접 입력만으로 끝까지 진행하실 수 있습니다."}
            </span>
          </li>
          <li className="flex gap-2">
            <span aria-hidden="true">👆</span>
            <span>말하기가 어려우시면 아래 보기 버튼을 고르셔도 됩니다. 버튼은 항상 열려 있습니다.</span>
          </li>
          <li className="flex gap-2">
            <span aria-hidden="true">⌨</span>
            <span>직접 입력창에 문장을 적어 보내셔도 됩니다.</span>
          </li>
          <li className="flex gap-2">
            <span aria-hidden="true">⏱</span>
            <span>
              응답 대기 시간이 표시되지만, 시간이 지나도 자동으로 넘어가지 않습니다. 천천히 하셔도
              됩니다.
            </span>
          </li>
        </ul>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row">
        <BigButton onClick={onStart} size="lg" block>
          훈련 시작하기
        </BigButton>
        <BigButton href="/train" variant="secondary" size="lg" block>
          다른 상황 고르기
        </BigButton>
      </div>
    </div>
  );
}

export default BriefingPanel;
