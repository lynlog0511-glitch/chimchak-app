"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BigButton, EyebrowLabel, SourceChip } from "@/components";
import { StatusMark } from "@/components/icons";
import { cx } from "@/components/utils";
import { loadSessions } from "@/lib/storage";
import type { EndingDef, Scenario, SessionRecord, SessionState } from "@/types";
import {
  NextTrainingReasonMark,
  pickNextTraining,
  type NextTrainingPick,
} from "@/app/history/_components/HistoryBoard";
import { scenarioHref } from "./constants";

export interface EndingPanelProps {
  scenario: Scenario;
  session: SessionState;
  ending?: EndingDef;
  record: SessionRecord;
  /** 존엄·관계 판정선에 걸렸을 때 함께 보여 줄 안내 (⚑CF와 다른 선입니다) */
  advisoryEnding?: EndingDef;
  onRestart: () => void;
  className?: string;
}

/**
 * 판정 문구의 색 — 상태 의미만 담습니다(점수·등급·순위는 어떤 형태로도 만들지 않습니다).
 * 큰 글자라 3:1 기준이지만, 실제로는 전부 4.5:1을 넘는 `*-ink` 계열만 씁니다.
 */
const VERDICT_TEXT: Record<EndingDef["verdict"], string> = {
  충족: "text-ok-ink",
  "부분 충족": "text-warn-ink",
  재시도: "text-warn-ink",
  재훈련: "text-danger-ink",
  "재훈련 권고": "text-danger-ink",
};

const VERDICT_LEAD: Record<EndingDef["verdict"], string> = {
  충족: "오늘 연습에서 지키신 것을 그대로 남겨 두었습니다.",
  "부분 충족": "안전은 지켜졌습니다. 한 가지만 더 챙기면 다음이 달라집니다.",
  재시도: "여기서 한 번 더 해보시는 것이 좋겠습니다. 벌점은 없습니다.",
  재훈련: "허용 범위 밖의 선택이 있었습니다. 해당 지점을 다시 확인해 주세요.",
  "재훈련 권고": "안전 위험은 아니지만, 같은 장면을 한 번 더 연습해 보시길 권해 드립니다.",
};

/**
 * “다음엔 이 장면” — 성장 기록 화면(시안 5c)의 추천 카드와 같은 언어로 둡니다.
 * 추천 규칙은 성장 기록과 **같은 순수 함수**를 씁니다(`pickNextTraining`).
 */
function NextTrainingSuggestion({ pick }: { pick: NextTrainingPick }) {
  return (
    <div className="rounded-card bg-tint p-4">
      <EyebrowLabel>다음엔 이 장면</EyebrowLabel>
      <p className="mt-1.5 text-[16px] leading-[1.5] font-bold text-deep">{pick.candidate.title}</p>
      <p className="mt-1 flex items-center gap-1.5 text-[12.5px] leading-[1.6] text-brand-800">
        <NextTrainingReasonMark reason={pick.reason} />
        {pick.reasonText}
      </p>
      <Link
        href={scenarioHref(pick.candidate.id)}
        className="mt-2 inline-flex min-h-[48px] items-center gap-1 text-[14px] font-bold text-brand-800"
      >
        가기 <span aria-hidden>›</span>
      </Link>
    </div>
  );
}

/**
 * 훈련 종료 화면.
 *
 * 표시는 판정 한 낱말 + 지키신 것 + 코칭 2개까지입니다.
 * 점수·등급·순위·백분위는 어떤 형태로도 보여 주지 않습니다(브리프 §3-1).
 */
export function EndingPanel({
  scenario,
  session,
  ending,
  record,
  advisoryEnding,
  onRestart,
  className,
}: EndingPanelProps) {
  const verdict = record.verdict;
  const greens = record.greenChecks;
  // ⚑CF 문구는 아래 전용 블록에서 따로 다룹니다 — 필터 규칙은 엔진(collectCoaching)에 한 곳으로 모았습니다.
  const coachings = record.coachingPoints.slice(0, 2);

  /**
   * ⚑CF를 밟은 뒤 다시 해서 끝까지 오신 경우.
   * 세션 중에는 “벌점은 없습니다”라고 안내해 놓고 엔딩만 ‘재훈련’으로 보이면 약속과 어긋나므로,
   * 표시의 뜻을 먼저 풀어 드립니다. (판정 문구 자체는 시나리오 데이터가 가지고 있습니다.)
   */
  const recoveredAfterRetry =
    verdict === "재훈련" && session.cfCount > 0 && session.retriesUsed > 0;

  /**
   * 다음 훈련 추천 — 이 기기에 쌓인 이력에 방금 마친 회차를 얹어 고릅니다.
   * (읽고 쓰는 것은 판정 문구와 시각뿐이고, 발화 원문은 저장하지도 읽지도 않습니다.)
   */
  const [storedSessions, setStoredSessions] = useState<SessionRecord[]>([]);

  useEffect(() => {
    setStoredSessions(loadSessions());
  }, []);

  const suggestion = useMemo(
    () =>
      pickNextTraining([record, ...storedSessions.filter((item) => item.id !== record.id)], {
        // 방금 마친 상황은 재시도 버튼이 따로 있으므로 추천에서는 뺍니다.
        excludeScenarioId: scenario.id,
      }),
    [record, scenario.id, storedSessions],
  );

  return (
    <div className={cx("space-y-5", className)}>
      {recoveredAfterRetry && (
        <div className="rounded-card bg-paper-2 p-4">
          <p className="text-[14px] leading-[1.5] font-bold text-ink">
            재시도로 회복해 완주하셨습니다
          </p>
          <p className="mt-1 text-[12.5px] leading-[1.65] text-ink-soft">
            이 표시는 벌점이 아니라, 현장에서 되돌릴 수 없는 지점을 다시 볼 안내입니다.
          </p>
        </div>
      )}

      {/* 판정 — 이 화면의 주인공은 한 낱말입니다. 필도 카드도 쓰지 않고 타이포로만 세웁니다. */}
      <div>
        <EyebrowLabel>{scenario.typeLabel}</EyebrowLabel>
        <p
          className={cx(
            "mt-1 text-[28px] leading-[1.2] font-extrabold tracking-[-0.02em]",
            VERDICT_TEXT[verdict],
          )}
        >
          {verdict}
        </p>
        <h2 className="mt-1.5 text-[17px] leading-[1.4] font-bold text-ink">
          {ending?.title ?? record.endingTitle}
        </h2>
        <p className="mt-1.5 text-[14px] leading-[1.65] text-ink-soft">{VERDICT_LEAD[verdict]}</p>
        {ending?.message && (
          <p className="mt-2.5 text-[15px] leading-[1.65] text-ink">{ending.message}</p>
        )}
      </div>

      {advisoryEnding && (
        <div className="rounded-card bg-paper-2 p-4">
          <p className="text-[12.5px] leading-[1.5] font-bold text-warn-ink">
            {advisoryEnding.verdict}
          </p>
          <p className="mt-1 text-[14px] leading-[1.5] font-bold text-ink">{advisoryEnding.title}</p>
          <p className="mt-1.5 text-[13px] leading-[1.65] text-ink-soft">{advisoryEnding.message}</p>
        </div>
      )}

      {session.cfCount > 0 && (
        <div className="rounded-card bg-danger-soft p-4">
          <p className="flex items-center gap-2 text-[14px] leading-[1.5] font-bold text-danger-ink">
            <StatusMark kind="stop" size="sm" />
            즉시 중단이 있었던 지점이 있습니다
          </p>
          <p className="mt-1.5 text-[13px] leading-[1.65] text-ink">
            법과 지침이 금지한 행동, 또는 요양보호사 허용 범위 밖의 행동이 선택된 지점입니다. 대안
            행동을 다시 한번 확인하시고 같은 장면을 연습해 보시면 좋겠습니다.
          </p>
        </div>
      )}

      <section>
        <EyebrowLabel>지키신 것</EyebrowLabel>
        {greens.length > 0 ? (
          <ul className="chim-hairline mt-1.5">
            {greens.map((green) => (
              <li key={green} className="flex gap-2.5 py-2.5 text-[14px] leading-[1.6] text-ink">
                <StatusMark kind="met" size="sm" />
                <span className="min-w-0 flex-1">{green}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1.5 text-[14px] leading-[1.65] text-ink-soft">
            이번에는 충족으로 기록된 항목이 없습니다. 아래 코칭 한 가지만 들고 다시 해보시면
            충분합니다.
          </p>
        )}
      </section>

      <section>
        <EyebrowLabel>다시 볼 것 (최대 두 가지)</EyebrowLabel>
        {coachings.length > 0 ? (
          <ul className="chim-hairline mt-1.5">
            {coachings.map((coaching) => (
              <li key={coaching} className="flex gap-2.5 py-2.5 text-[14px] leading-[1.6] text-ink">
                <StatusMark kind="coach" size="sm" />
                <span className="min-w-0 flex-1">{coaching}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1.5 text-[14px] leading-[1.65] text-ink-soft">
            따로 짚어 드릴 코칭이 없습니다. 지금처럼 이어가 주세요.
          </p>
        )}
      </section>

      <section>
        <EyebrowLabel>이 판정의 근거 문서</EyebrowLabel>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {scenario.sourceDocs.map((docId) => (
            <SourceChip key={docId} docId={docId} />
          ))}
        </div>
        <p className="mt-2 text-[12px] leading-[1.65] text-ink-muted">
          이 세션은 기기 안(브라우저 저장소)에만 남습니다. 말씀하신 발화 원문은 저장하지 않고,
          충족·코칭 문구와 시각만 기록합니다.
        </p>
      </section>

      {suggestion && <NextTrainingSuggestion pick={suggestion} />}

      {/* 다음 행동 — 다시 하기가 주인공이고, 나머지는 같은 무게로 뒤에 섭니다. */}
      <div className="space-y-2">
        <BigButton onClick={onRestart} size="lg" block>
          재시도 · 벌점 없이 다시 하기
        </BigButton>
        <BigButton href="/history" variant="secondary" block>
          성장 기록에서 보기
        </BigButton>
        <BigButton href="/report" variant="secondary" block>
          보고·기록으로 이어서 연습하기
        </BigButton>
        <BigButton href="/train" variant="secondary" block>
          다른 상황 고르기
        </BigButton>
      </div>
    </div>
  );
}

export default EndingPanel;
