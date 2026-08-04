"use client";

import { Badge, BigButton, Card, SourceChip } from "@/components";
import type { EndingDef, Scenario, SessionRecord, SessionState } from "@/types";
import { VERDICT_TONE } from "./constants";

export interface EndingPanelProps {
  scenario: Scenario;
  session: SessionState;
  ending?: EndingDef;
  record: SessionRecord;
  /** 존엄·관계 판정선에 걸렸을 때 함께 보여 줄 안내 (⚑CF와 다른 선입니다) */
  advisoryEnding?: EndingDef;
  onRestart: () => void;
}

const VERDICT_LEAD: Record<EndingDef["verdict"], string> = {
  충족: "오늘 연습에서 지키신 것을 그대로 남겨 두었습니다.",
  "부분 충족": "안전은 지켜졌습니다. 한 가지만 더 챙기면 다음이 달라집니다.",
  재시도: "여기서 한 번 더 해보시는 것이 좋겠습니다. 벌점은 없습니다.",
  재훈련: "허용 범위 밖의 선택이 있었습니다. 해당 지점을 다시 확인해 주세요.",
  "재훈련 권고": "안전 위험은 아니지만, 같은 장면을 한 번 더 연습해 보시길 권해 드립니다.",
};

/**
 * 훈련 종료 화면.
 *
 * 표시는 🟢 충족 목록과 ⚪ 코칭 2개까지입니다.
 * 점수·등급·순위·백분위는 어떤 형태로도 보여 주지 않습니다(브리프 §3-1).
 */
export function EndingPanel({
  scenario,
  session,
  ending,
  record,
  advisoryEnding,
  onRestart,
}: EndingPanelProps) {
  const verdict = record.verdict;
  const greens = record.greenChecks;
  // ⚑CF 문구는 아래 전용 카드에서 따로 다룹니다 — 필터 규칙은 엔진(collectCoaching)에 한 곳으로 모았습니다.
  const coachings = record.coachingPoints.slice(0, 2);

  /**
   * ⚑CF를 밟은 뒤 다시 해서 끝까지 오신 경우.
   * 세션 중에는 “벌점은 없습니다”라고 안내해 놓고 엔딩만 ‘재훈련’으로 보이면 약속과 어긋나므로,
   * 표시의 뜻을 먼저 풀어 드립니다. (판정 문구 자체는 시나리오 데이터가 가지고 있습니다.)
   */
  const recoveredAfterRetry =
    verdict === "재훈련" && session.cfCount > 0 && session.retriesUsed > 0;

  return (
    <div className="space-y-6">
      {recoveredAfterRetry && (
        <Card tone="brand">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-brand-900">
            <span aria-hidden="true">↺</span>
            재시도로 회복해 완주하셨습니다
          </h2>
          <p className="mt-2 text-base leading-relaxed font-semibold text-brand-800">
            이 표시는 벌점이 아니라, 현장에서 되돌릴 수 없는 지점을 다시 볼 안내입니다.
          </p>
        </Card>
      )}

      <Card tone={verdict === "충족" ? "ok" : verdict === "부분 충족" ? "warn" : "quiet"}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={VERDICT_TONE[verdict]}>{verdict}</Badge>
          <Badge tone="neutral">{scenario.typeLabel}</Badge>
        </div>
        <h2 className="mt-3 text-2xl font-extrabold text-ink md:text-3xl">
          {ending?.title ?? record.endingTitle}
        </h2>
        <p className="mt-2 text-base leading-relaxed font-semibold text-ink-soft">
          {VERDICT_LEAD[verdict]}
        </p>
        {ending?.message && (
          <p className="mt-3 text-lg leading-relaxed text-ink">{ending.message}</p>
        )}
      </Card>

      {advisoryEnding && (
        <Card tone="warn">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="warn">{advisoryEnding.verdict}</Badge>
            <h3 className="text-lg font-extrabold text-ink">{advisoryEnding.title}</h3>
          </div>
          <p className="mt-2 text-base leading-relaxed text-ink">{advisoryEnding.message}</p>
        </Card>
      )}

      {session.cfCount > 0 && (
        <Card tone="danger">
          <h3 className="flex items-center gap-2 text-lg font-extrabold text-danger-ink">
            <span aria-hidden="true">⚑</span>
            즉시 중단이 있었던 지점이 있습니다
          </h3>
          <p className="mt-2 text-base leading-relaxed text-ink">
            법과 지침이 금지한 행동, 또는 요양보호사 허용 범위 밖의 행동이 선택된 지점입니다. 대안
            행동을 다시 한번 확인하시고 같은 장면을 연습해 보시면 좋겠습니다.
          </p>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h3 className="flex items-center gap-2 text-lg font-extrabold text-ink">
            <span aria-hidden="true">🟢</span>
            지키신 것
          </h3>
          {greens.length > 0 ? (
            <ul className="mt-3 space-y-2.5">
              {greens.map((green) => (
                <li key={green} className="flex gap-2.5 text-base leading-relaxed text-ink">
                  <span aria-hidden="true" className="text-ok-ink">
                    ✓
                  </span>
                  <span>{green}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-base leading-relaxed text-ink-soft">
              이번에는 충족으로 기록된 항목이 없습니다. 아래 코칭 한 가지만 들고 다시 해보시면
              충분합니다.
            </p>
          )}
        </Card>

        <Card>
          <h3 className="flex items-center gap-2 text-lg font-extrabold text-ink">
            <span aria-hidden="true">⚪</span>
            다음에 바꿔볼 것 (최대 두 가지)
          </h3>
          {coachings.length > 0 ? (
            <ul className="mt-3 space-y-3">
              {coachings.map((coaching) => (
                <li
                  key={coaching}
                  className="rounded-card border border-line bg-paper-2 p-3.5 text-base leading-relaxed text-ink"
                >
                  {coaching}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-base leading-relaxed text-ink-soft">
              따로 짚어 드릴 코칭이 없습니다. 지금처럼 이어가 주세요.
            </p>
          )}
        </Card>
      </div>

      <Card tone="quiet">
        <h3 className="text-lg font-extrabold text-ink">이 판정의 근거 문서</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {scenario.sourceDocs.map((docId) => (
            <SourceChip key={docId} docId={docId} />
          ))}
        </div>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          이 세션은 기기 안(브라우저 저장소)에만 남습니다. 말씀하신 발화 원문은 저장하지 않고,
          충족·코칭 문구와 시각만 기록합니다.
        </p>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <BigButton onClick={onRestart} size="lg" block>
          재시도 · 벌점 없이 다시 하기
        </BigButton>
        <BigButton href="/history" variant="secondary" size="lg" block>
          성장 기록에서 보기
        </BigButton>
        <BigButton href="/report" variant="secondary" size="lg" block>
          보고·기록으로 이어서 연습하기
        </BigButton>
        <BigButton href="/train" variant="secondary" size="lg" block>
          다른 상황 고르기
        </BigButton>
      </div>
    </div>
  );
}

export default EndingPanel;
