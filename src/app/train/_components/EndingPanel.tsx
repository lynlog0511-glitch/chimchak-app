"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronGlyph } from "@/components/icons";
import Link from "next/link";
import { BigButton, useSourceDoc } from "@/components";
import { cx } from "@/components/utils";
import type { TracedFeedback } from "@/engine";
import { loadSessions } from "@/lib/storage";
import type { EndingDef, Scenario, SessionRecord, SessionState } from "@/types";
import { pickNextTraining, type NextTrainingPick } from "@/app/history/_components/HistoryBoard";
import { splitLawSentences } from "./constants";
import { cfVerdictSourceLine, durationText, scenarioHref } from "./constants";

export interface EndingPanelProps {
  scenario: Scenario;
  session: SessionState;
  ending?: EndingDef;
  record: SessionRecord;
  /** 존엄·관계 판정선에 걸렸을 때 함께 보여 줄 안내 (⚑CF와 다른 선입니다) */
  advisoryEnding?: EndingDef;
  /** 이번 훈련에서 즉시 중단이 있었던 지점 — 「다시 볼 장면」 카드의 근거가 됩니다 */
  criticalFeedback?: TracedFeedback;
  /** 그때 안내한 대안 행동 (⚑CF 시트와 같은 목록) */
  criticalAlternatives?: string[];
  onRestart: () => void;
  className?: string;
}

/**
 * 엔딩의 문법 — 앞으로 나아가는 마무리(forward)와 한 지점을 다시 보는 마무리(retry) 둘뿐입니다.
 * 점수·등급·순위는 어떤 형태로도 만들지 않으므로, 판정 낱말도 화면에 세우지 않습니다(시안 6a·6b).
 */
type EndingShape = "forward" | "retry";

const VERDICT_SHAPE: Record<EndingDef["verdict"], EndingShape> = {
  충족: "forward",
  "부분 충족": "forward",
  재시도: "retry",
  재훈련: "retry",
  "재훈련 권고": "retry",
};

/** 54px 원 — ✓(마침) / ↺(다시 보기). 문자 기호만 씁니다(가이드 §3 · 이모지 0건). */
const VERDICT_MARK: Record<EndingDef["verdict"], { char: string; circle: string; label: string }> = {
  충족: { char: "✓", circle: "bg-ok text-white", label: "훈련을 마쳤습니다" },
  "부분 충족": { char: "✓", circle: "bg-ok-soft text-ok-ink", label: "훈련을 마쳤습니다" },
  재시도: { char: "↺", circle: "bg-warn-soft text-warn-ink", label: "다시 볼 지점이 있습니다" },
  재훈련: { char: "↺", circle: "bg-warn-soft text-warn-ink", label: "다시 볼 지점이 있습니다" },
  "재훈련 권고": {
    char: "↺",
    circle: "bg-warn-soft text-warn-ink",
    label: "다시 볼 지점이 있습니다",
  },
};

/**
 * 화면에서 가장 큰 글자(22px)에 서는 문장 — **끝까지 갔다는 사실**입니다.
 *
 * 여기에 시나리오 결과 제목을 세우면 4분을 버틴 분이 처음 읽는 가장 큰 문장이
 * 「경계가 무너졌습니다」·「안전은 확보했지만 원인은 남았습니다」 같은 결핍 선언이 됩니다.
 * 결과 제목은 검수된 고정 문구라 한 글자도 고치지 않고, 아래 15px 부제로 자리만 옮깁니다
 * (CriticalSceneCard가 splitLawSentences로 조문을 접힘에 내리는 것과 같은 수법입니다).
 *
 * 다시 보기 문법(↺)에서도 문장은 같습니다 — 멈춘 지점이 있어도 완주는 완주이고,
 * 벌점이 아니라는 프레임이 여기서 먼저 서야 합니다.
 */
function completionHeadline(verdict: EndingDef["verdict"], session: SessionState): string {
  if (verdict === "충족" && session.retriesUsed === 0) return "재시도 없이 끝까지 가셨어요";
  return "끝까지 가셨어요";
}

/**
 * 제목 아래 한 줄 — 어떤 마무리든 **벌점이 아니라 안내**라는 것을 같은 문법으로 말합니다.
 * (⚑CF 시트의 문장과는 반드시 다르게 적습니다 — 가이드 §4.7.)
 *
 * 「끝까지 가셨어요」는 위 22px 줄이 맡으므로, 여기서는 같은 말을 되풀이하지 않습니다.
 */
function leadText(verdict: EndingDef["verdict"], session: SessionState): string {
  switch (verdict) {
    case "충족":
      return "핵심 대응을 지키며 진행하셨어요";
    case "부분 충족":
      return "안전은 지켰습니다 — 한 가지만 더 챙기면 다음이 달라집니다";
    case "재시도":
      return "여기서 한 번 더 해보시면 좋겠어요 — 벌점은 없습니다";
    case "재훈련":
      return session.retriesUsed > 0
        ? "멈춘 뒤 재시도로 회복하셨어요"
        : "멈춘 지점이 한 곳 있었어요";
    case "재훈련 권고":
    default:
      return "안전 위험은 아닙니다 — 존엄·관계를 한 번 더 보고 가시길 권해 드립니다";
  }
}

/** 다시 보기 문법에서만 붙는 두 번째 줄 — 표시의 뜻을 먼저 풀어 드립니다. */
const RETRY_NOTE = "이 표시는 벌점이 아니라 다시 볼 지점 안내입니다.";

/**
 * 헤어라인 목록 — 3개까지 펴 두고 나머지는 「외 N개 ⌄」로 접습니다 (시안 6a).
 * 리스트 자체가 정보 위계의 바닥이라 카드도 배지도 두지 않습니다.
 */
function FoldedList({
  items,
  withCheck,
  emptyText,
}: {
  items: string[];
  /** 잘한 것 목록에만 ✓ 원을 답니다. 다시 볼 것은 문장만 둡니다. */
  withCheck: boolean;
  emptyText: string;
}) {
  const [open, setOpen] = useState(false);

  if (items.length === 0) {
    return <p className="px-0.5 py-2.5 text-[0.9375rem] leading-[1.6] text-ink-soft">{emptyText}</p>;
  }

  const visible = open ? items : items.slice(0, 3);
  const rest = items.length - visible.length;

  return (
    <ul>
      {visible.map((item) => (
        <li
          key={item}
          className={cx(
            "flex gap-2 border-b border-line px-0.5 py-2.5 text-[0.9375rem] last:border-b-0",
            withCheck ? "leading-[1.45] text-ink" : "leading-[1.6] text-ink-soft",
          )}
        >
          {withCheck && (
            <span
              aria-hidden
              /* 9.5px은 이 앱 어디에도 없는 외톨이 값이었습니다(심미 재평가 ma1의 27종 중 하나).
                 15px 원 안에서 ✓는 11px까지 넉넉히 들어가므로 메타 단으로 올려 붙였습니다. */
              className="relative top-[3px] flex h-[15px] w-[15px] flex-none items-center justify-center rounded-full bg-ok-soft text-[0.6875rem] font-extrabold text-ok-ink"
            >
              ✓
            </span>
          )}
          <span className="min-w-0 flex-1">{item}</span>
        </li>
      ))}
      {(rest > 0 || open) && (
        <li className="border-b border-line last:border-b-0">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="flex min-h-[48px] w-full items-center justify-between rounded-field px-0.5 text-[0.7813rem] font-semibold text-ink-muted transition-colors duration-150 active:bg-paper-2"
          >
            {open ? "접기" : `외 ${rest}개 더 보기`}
            <ChevronGlyph size="sm" className={cx("text-ink-ghost", open && "rotate-180")} />
          </button>
        </li>
      )}
    </ul>
  );
}

/**
 * 다시 볼 장면 — ⚑CF가 있었던 지점을 그때의 근거 그대로 다시 보여 줍니다 (시안 6b).
 * 문구·근거·대안은 전부 규칙 사전과 시나리오 데이터의 고정 문구이고, 여기서 새로 짓지 않습니다.
 */
function CriticalSceneCard({
  feedback,
  alternatives,
}: {
  feedback: TracedFeedback;
  alternatives: string[];
}) {
  const doc = useSourceDoc(feedback.docId);
  const { lead, law } = splitLawSentences(feedback.message);

  return (
    <div className="rounded-card bg-paper-2 px-[15px] py-3.5">
      <p className="text-[0.7813rem] leading-[1.45] font-bold text-warn-ink">
        다시 볼 장면{feedback.trace?.ruleLabel ? ` — ${feedback.trace.ruleLabel}` : ""}
      </p>
      <p className="mt-1.5 text-[0.9375rem] leading-[1.6] text-ink-soft">{lead}</p>
      {/* 조문 전문은 접힘 안에 그대로 둡니다 — 지우지 않고, 앞세우지도 않습니다. */}
      {law.length > 0 && (
        <details className="group mt-1.5">
          <summary className="flex min-h-[48px] cursor-pointer list-none items-center gap-1.5 rounded-field text-[0.7813rem] font-semibold text-ink-muted transition-colors duration-150 active:bg-paper-2 [&::-webkit-details-marker]:hidden">
            <span className="underline decoration-1 underline-offset-[3px]">근거 조문 보기</span>
            <ChevronGlyph size="sm" className="text-faint group-open:rotate-180" />
          </summary>
          <p className="border-t border-line pt-2 pb-1 text-[0.8438rem] leading-[1.6] text-ink-soft">
            {law}
          </p>
        </details>
      )}
      {/* 근거와 판정 주체 — ⚑CF 시트에서 보여 드린 것과 같은 문장입니다(대비 4.5:1↑ 유지). */}
      <p className="mt-1.5 text-[0.7813rem] leading-[1.6] text-ink-soft">
        {doc ? `${doc.title} · ` : ""}
        {cfVerdictSourceLine(feedback)}
      </p>

      {alternatives.length > 0 && (
        <details className="group mt-1">
          <summary className="flex min-h-[48px] cursor-pointer list-none items-center gap-1.5 rounded-field text-[0.7813rem] font-semibold text-ink-muted transition-colors duration-150 active:bg-paper-2 [&::-webkit-details-marker]:hidden">
            <span className="underline decoration-1 underline-offset-[3px]">대안 다시 보기</span>
            <ChevronGlyph size="sm" className="text-faint group-open:rotate-180" />
          </summary>
          <ul className="pb-1">
            {alternatives.map((alternative) => (
              <li
                key={alternative}
                className="border-t border-line py-2 text-[0.8438rem] leading-[1.6] text-ink"
              >
                {alternative}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/**
 * 훈련 종료 화면 (시안 6a 충족 · 6b 재훈련 · 가이드 §4.7).
 *
 * ✓ 또는 ↺ 원 하나 + 제목 + 소요시간으로 시작해 「잘한 것」과 「다시 볼 것」만 남깁니다.
 * 점수·등급·순위·백분위는 어떤 형태로도 보여 주지 않습니다(브리프 §3-1).
 */
export function EndingPanel({
  scenario,
  session,
  ending,
  record,
  advisoryEnding,
  criticalFeedback,
  criticalAlternatives = [],
  onRestart,
  className,
}: EndingPanelProps) {
  const verdict = record.verdict;
  const shape = VERDICT_SHAPE[verdict];
  const mark = VERDICT_MARK[verdict];
  const greens = record.greenChecks;
  const coachings = record.coachingPoints;
  const spent = durationText(record.startedAt, record.endedAt);

  /**
   * 다음 훈련 추천 — 이 기기에 쌓인 이력에 방금 마친 회차를 얹어 고릅니다.
   * (읽고 쓰는 것은 판정 문구와 시각뿐이고, 발화 원문은 저장하지도 읽지도 않습니다.)
   */
  const [storedSessions, setStoredSessions] = useState<SessionRecord[]>([]);

  useEffect(() => {
    setStoredSessions(loadSessions());
  }, []);

  const suggestion: NextTrainingPick | undefined = useMemo(
    () =>
      pickNextTraining([record, ...storedSessions.filter((item) => item.id !== record.id)], {
        // 방금 마친 상황은 재시도 버튼이 따로 있으므로 추천에서는 뺍니다.
        excludeScenarioId: scenario.id,
      }),
    [record, scenario.id, storedSessions],
  );

  return (
    <div className={cx("animate-fade-up", className)}>
      {/* 머리 — 원 하나와 제목. 판정 낱말은 세우지 않습니다(점수로 읽히지 않게). */}
      <div className="text-center">
        <span
          aria-hidden
          className={cx(
            "mx-auto mb-3.5 flex h-[54px] w-[54px] items-center justify-center rounded-full text-[1.5rem] leading-none font-extrabold",
            mark.circle,
          )}
        >
          {mark.char}
        </span>
        <span className="sr-only">{mark.label}</span>
        <p className="text-[0.7813rem] leading-[1.45] font-bold tracking-[0.06em] text-ink-muted">
          훈련 마침 · {scenario.title}
        </p>
        <h2 className="mt-1.5 text-[1.375rem] leading-[1.45] font-extrabold tracking-[-0.01em] text-ink">
          {completionHeadline(verdict, session)}
        </h2>
        {/* 시나리오 결과 제목 — 검수 문구 그대로, 크기만 15px 부제로 내려 둡니다. */}
        <p className="mt-1.5 text-[0.9375rem] leading-[1.45] font-semibold text-ink">
          {ending?.title ?? record.endingTitle}
        </p>
        {/* 회복·완주를 말하는 줄은 부제 바로 아래 15px로 세웁니다 — 각주 크기로 내리지 않습니다. */}
        <p className="mt-1.5 text-[0.9375rem] leading-[1.6] text-ink-soft">
          {leadText(verdict, session)}
        </p>
        <p className="mt-[4px] text-[0.8438rem] leading-[1.6] text-ink-muted">
          {spent}
          {shape === "retry" && (
            <>
              {spent.length > 0 && <br />}
              {RETRY_NOTE}
            </>
          )}
        </p>
      </div>

      {/* 다시 볼 장면 — 그때의 규칙 판정과 대안을 그대로 다시 폅니다. */}
      {shape === "retry" && criticalFeedback && (
        <div className="mt-5">
          <CriticalSceneCard feedback={criticalFeedback} alternatives={criticalAlternatives} />
        </div>
      )}

      {advisoryEnding && (
        <div className="mt-4 rounded-card bg-paper-2 px-[15px] py-3.5">
          <p className="text-[0.7813rem] leading-[1.45] font-bold text-warn-ink">
            {advisoryEnding.title}
          </p>
          <p className="mt-1.5 text-[0.8438rem] leading-[1.6] text-ink-soft">{advisoryEnding.message}</p>
        </div>
      )}

      {ending?.message && (
        <p className="mt-4 text-[0.9375rem] leading-[1.6] text-ink-soft">{ending.message}</p>
      )}

      <section className="mt-5">
        {/* 개수는 「몇 가지를 보고 계신지」이지 점수가 아닙니다 — 0은 아예 적지 않습니다. */}
        {/* 「그래도」는 양보 부사라 '그럼에도 불구하고 잘한 게 있긴 하다'로 읽힙니다 — 걷어냅니다. */}
        {/* 이 줄만 15px입니다 — 「다시 볼 것」(12.5px)보다 먼저·크게 읽혀야 하는 자리라,
            같은 h3라고 해서 같은 크기로 통일하지 않습니다. */}
        <h3 className="mb-1.5 text-[0.9375rem] leading-[1.45] font-bold text-ok-ink">
          잘한 것{greens.length > 0 && ` ${greens.length}`}
        </h3>
        <FoldedList
          items={greens}
          withCheck
          emptyText="이번에는 충족으로 기록된 항목이 없습니다. 아래 한 가지만 들고 다시 해보시면 충분합니다."
        />
      </section>

      <section className="mt-4">
        <h3 className="mb-1 text-[0.7813rem] leading-[1.45] font-bold text-warn-ink">
          다시 볼 것{coachings.length > 0 && ` ${coachings.length}`}
        </h3>
        <FoldedList
          items={coachings}
          withCheck={false}
          emptyText="따로 짚어 드릴 것이 없습니다. 지금처럼 이어가 주세요."
        />
      </section>

      {/* 다음 행동 — 문법에 따라 「다음 상황으로」 또는 「같은 장면 다시」가 주인공이 됩니다.
          훈련 → 보고 → 성장의 순환이 마지막 힌지에서 끊기지 않도록 **두 마무리 모두**
          보조 2분할(보고 연습 · 성장 기록)을 답니다(가이드 §4.7).
          모바일에서는 이 블록을 화면 아래에 도킹해, 로그를 끝까지 내리지 않아도 닿게 합니다. */}
      <div className="sticky bottom-0 z-10 mt-5 border-t border-line bg-paper pt-3.5 pb-[calc(20px_+_var(--chim-safe-b))] md:static md:pb-0">
        {shape === "forward" ? (
          <BigButton
            href={suggestion ? scenarioHref(suggestion.candidate.id) : "/train"}
            size="lg"
            block
          >
            {suggestion ? `다음 상황으로 — ${suggestion.candidate.title}` : "다음 상황 고르기"}
          </BigButton>
        ) : (
          <BigButton onClick={onRestart} size="lg" block>
            같은 장면 다시 해보기 — 벌점 없음
          </BigButton>
        )}

        <div className="mt-2 flex gap-2">
          <Link
            href="/report"
            className="flex min-h-[48px] min-w-0 flex-1 items-center justify-center rounded-field bg-paper-2 px-3 text-center text-[0.9375rem] leading-[1.3] font-semibold text-ink transition-colors duration-150 active:bg-neutral-line"
          >
            이 훈련 보고 연습하기
          </Link>
          <Link
            href="/history"
            className="flex min-h-[48px] min-w-0 flex-1 items-center justify-center rounded-field bg-paper-2 px-3 text-center text-[0.9375rem] leading-[1.3] font-semibold text-ink transition-colors duration-150 active:bg-neutral-line"
          >
            성장 기록 보기
          </Link>
        </div>

        {shape === "retry" && (
          <Link
            href="/train"
            className="mt-2 flex min-h-[48px] w-full items-center justify-center rounded-field px-3 text-center text-[0.9375rem] leading-[1.3] font-semibold text-ink-soft transition-colors duration-150 active:bg-paper-2"
          >
            오늘은 여기까지
          </Link>
        )}

        {/* 16px은 §2 눈금에 없는 값이었습니다 — 바로 아래 줄과 같은 15px으로 맞춥니다(대비·색은 유지). */}
        <p className="mt-2.5 text-center text-[0.9375rem] leading-[1.6] text-ink-soft">
          점수가 아닙니다 — 다음에 볼 지점 안내예요
        </p>
        <p className="mt-1 text-center text-[0.9375rem] leading-[1.6] text-ink-soft">
          이 기록은 기기 안에만 남습니다 · 말씀하신 원문은 저장하지 않습니다
        </p>
      </div>
    </div>
  );
}

export default EndingPanel;
