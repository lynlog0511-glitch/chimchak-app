"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronGlyph, StatusMark, STATUS_MARK_LABEL, type StatusMarkKind } from "@/components/icons";
import Link from "next/link";
import { BigButton, useSourceDoc } from "@/components";
import { BreathMark } from "@/components/BreathMark";
import { cx } from "@/components/utils";
import { unexploredBranches, type TracedFeedback } from "@/engine";
import { loadSessions } from "@/lib/storage";
import type { EndingDef, Scenario, SessionEvent, SessionRecord, SessionState } from "@/types";
import {
  nextTrainingSentence,
  pickNextTraining,
  type NextTrainingPick,
} from "@/app/history/_components/HistoryBoard";
import { stripInternalIds } from "./DialogueLog";
import { splitLawSentences } from "./constants";
import { cfVerdictSourceLine, durationText, scenarioHref, situationOrdinal } from "./constants";

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
 * 「경계가 무너졌습니다」 같은 결핍 선언이 됩니다.
 * 결과 제목은 시나리오 데이터의 문구를 그대로 아래 15px 부제로 자리만 옮깁니다
 * (8/23 교정: 부분 충족 제목도 실패 단정 없이 「돌아보는 한 문장」 계열로 통일 —
 * CriticalSceneCard가 splitLawSentences로 조문을 접힘에 내리는 것과 같은 수법입니다).
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
      return "안전은 지켰습니다. 한 가지만 더 챙기면 다음이 달라집니다";
    case "재시도":
      return "여기서 한 번 더 해보시면 좋겠어요. 벌점은 없어요";
    case "재훈련":
      return session.retriesUsed > 0
        ? "멈춘 뒤 재시도로 회복하셨어요"
        : "멈춘 지점이 한 곳 있었어요";
    case "재훈련 권고":
    default:
      return "안전 위험은 아닙니다. 존엄·관계를 한 번 더 보고 가시길 권해 드립니다";
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

/* ── 이번 훈련의 흐름 (턴별 판정 나열) ────────────────────── */

interface TimelineRow {
  key: string;
  /** 몇째 상황이었는지 — 같은 자리를 다시 하신 턴은 같은 번호를 씁니다(세션 헤더와 같은 셈법) */
  ordinal: string;
  kind: StatusMarkKind;
  /** 그 자리에서 고르신 갈래의 이름 — 저작용 분기 id는 화면에서 걷어냅니다 */
  label: string;
  /** 같은 상황을 다시 하신 자리인지 */
  again: boolean;
}

/**
 * 갈래 이름을 화면 낱말로 다듬습니다 — 저작용 표기만 걷어내고 문구는 그대로 둡니다.
 *
 * 시나리오 데이터의 label에는 저작자용 주석이 괄호로 붙어 있습니다:
 * 「눕히기 (의식 있는 상태에서) (⚑CF)」·「등을 세게 두드림 (경고 — ⚑CF 아님)」.
 * ⚑CF는 설계 문서의 표기이지 화면 낱말이 아니므로(화면에서는 판정어 「즉시 중단」이 그 자리를
 * 대신합니다), 그 표기가 든 괄호만 통째로 뗍니다. 사람이 읽는 괄호는 건드리지 않습니다.
 *
 * @example cleanBranchLabel("눕히기 (의식 있는 상태에서) (⚑CF)") // "눕히기 (의식 있는 상태에서)"
 * @example cleanBranchLabel("대체 행동 유도 (동의를 구하고 함께 움직임)") // 그대로
 */
function cleanBranchLabel(raw: string): string {
  return stripInternalIds(raw)
    .replace(/\s*\([^)]*(?:⚑|\bCF\b)[^)]*\)/g, "")
    .trim();
}

/** 판정 → 표준 마크. 판정은 엔진이 이미 내려 둔 것을 그대로 옮기기만 합니다. */
function markKind(feedback: NonNullable<SessionEvent["feedback"]>): StatusMarkKind {
  if (feedback.criticalFail) return "stop";
  return feedback.ok ? "met" : "coach";
}

/**
 * 세션 이벤트를 시간순으로 옮깁니다 — 여기서 다시 재는 것은 아무것도 없습니다.
 *
 * 담기는 것은 **순서 · 판정어 · 그때 고른 갈래 이름** 셋뿐입니다.
 * 점수·등급·개수 비교는 만들지 않고(브리프 §3-1), 말씀하신 원문도 옮기지 않습니다
 * (세션 메모리에는 있지만 화면에 옮기지 않는 것은 기록으로 남지 않는 값이기 때문입니다).
 */
function buildTimeline(events: readonly SessionEvent[]): TimelineRow[] {
  const numbers = new Map<string, number>();
  const rows: TimelineRow[] = [];

  events.forEach((event, index) => {
    const feedback = event.feedback;
    if (!feedback) return;
    const cueId = event.cueId ?? event.turnId;
    const seen = numbers.has(cueId);
    if (!seen) numbers.set(cueId, numbers.size + 1);
    rows.push({
      key: `${cueId}-${index}`,
      ordinal: situationOrdinal(numbers.get(cueId) ?? rows.length + 1),
      kind: markKind(feedback),
      label: cleanBranchLabel(feedback.branchLabel ?? ""),
      again: seen,
    });
  });

  return rows;
}

/**
 * 이번 훈련의 흐름 — 기본은 접혀 있습니다.
 *
 * 엔딩의 주인공은 「잘한 것」과 「다시 볼 것」이고, 이 목록은 그 뒤에서 **순서를 확인하는 자리**입니다.
 * 마크를 한 줄로 늘어놓지 않고 행으로 세우는 까닭도 같습니다 — ✓··✓·· 가 가로로 붙으면
 * 그 자체가 성적표처럼 읽힙니다.
 */
function SessionTimeline({ rows, situations }: { rows: TimelineRow[]; situations: number }) {
  return (
    <details className="group mt-4 border-t border-line">
      <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 rounded-field px-0.5 text-[0.7813rem] leading-[1.45] font-bold text-ink-muted transition-colors duration-150 active:bg-paper-2 [&::-webkit-details-marker]:hidden">
        <span>이번 훈련의 흐름 — 상황 {situations}개</span>
        <ChevronGlyph size="sm" className="flex-none text-ink-ghost group-open:rotate-180" />
      </summary>
      <p className="px-0.5 pb-1 text-[0.7813rem] leading-[1.6] text-ink-muted">
        판정이 난 순서 그대로입니다. 점수도 등급도 아닙니다.
      </p>
      <ul className="pb-1">
        {rows.map((row) => (
          <li key={row.key} className="border-t border-line px-0.5 py-2.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <StatusMark kind={row.kind} label={STATUS_MARK_LABEL[row.kind]} size="sm" quiet />
              <span className="text-[0.7813rem] leading-[1.45] font-semibold text-ink-muted">
                {row.ordinal} 상황{row.again ? " · 다시" : ""}
              </span>
            </div>
            {row.label.length > 0 && (
              <p className="mt-1 text-[0.9375rem] leading-[1.6] text-ink-soft">{row.label}</p>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

/* ── 가장 잘한 순간 ───────────────────────────────────────── */

interface BestMoment {
  ordinal: string;
  /**
   * 그때 드린 강화 문구 — 시나리오 데이터의 검수 문장 그대로입니다.
   *
   * 이 카드가 세우는 문장은 이것 하나뿐입니다. 예전에는 머리줄에 분기 이름(「대체 행동 유도
   * (동의를 구하고 함께 움직임)」)이 함께 섰는데, 그것은 설계표의 개조식 항목 이름이라
   * 「가장 잘한 순간」이라는 말과 나란히 놓이면 칭찬이 아니라 분류가 됩니다.
   * 그 자리에 이미 검수된 **문장체 칭찬**이 있으니, 그 문장이 대신 말하게 둡니다.
   */
  message: string;
}

/**
 * 이 턴의 루브릭 최고점 — **고르는 데만** 쓰는 내부 값입니다.
 * 어떤 형태로도 화면에 나가지 않습니다(브리프 §3-1 · 판정 산식은 엔진 소관이라 손대지 않습니다).
 */
function topScore(feedback: NonNullable<SessionEvent["feedback"]>): number {
  let top = 0;
  for (const hit of feedback.rubricHits) {
    if (hit.score > top) top = hit.score;
  }
  return top;
}

/**
 * 「가장 잘한 순간」 한 곳.
 *
 * 충족으로 판정된 턴 가운데 루브릭이 가장 높게 본 자리를 고르고, 같으면 어르신 상태를
 * 더 내려놓은 쪽을, 그것도 같으면 **먼저** 해내신 쪽을 남깁니다.
 * 고르는 기준일 뿐 화면에 나가는 것은 순서·갈래 이름·검수된 강화 문구 셋뿐입니다.
 */
function pickBestMoment(events: readonly SessionEvent[]): BestMoment | undefined {
  const numbers = new Map<string, number>();
  let best: { moment: BestMoment; score: number; delta: number } | undefined;

  for (const event of events) {
    const feedback = event.feedback;
    if (!feedback) continue;
    const cueId = event.cueId ?? event.turnId;
    if (!numbers.has(cueId)) numbers.set(cueId, numbers.size + 1);
    if (!feedback.ok || feedback.criticalFail) continue;
    const message = stripInternalIds(feedback.message ?? "").trim();
    if (message.length === 0) continue;

    const score = topScore(feedback);
    const delta = feedback.gaugeDelta;
    const better =
      !best || score > best.score || (score === best.score && delta < best.delta);
    if (!better) continue;

    best = {
      score,
      delta,
      moment: {
        ordinal: situationOrdinal(numbers.get(cueId) ?? 1),
        message,
      },
    };
  }

  return best?.moment;
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
 *
 * 그 위아래로 이번 회차를 되짚는 세 가지가 더 있습니다 — 전부 엔진이 남긴 이벤트를 옮긴 것이고,
 * 여기서 새로 판정하거나 문장을 짓지 않습니다:
 *  · 「가장 잘한 순간」 — 충족 턴 하나를 순서·갈래 이름과 함께 카드로 세웁니다(목록에서는 뺍니다).
 *  · 「이번 훈련의 흐름」 — 턴별 판정어를 순서대로 편 접힘(마크를 가로로 늘어놓지 않습니다).
 *  · 「다음엔 —」 — 성장 기록과 같은 순수 함수(`nextTraining`)가 고른 추천 한 줄.
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
  const coachings = record.coachingPoints;
  const spent = durationText(record.startedAt, record.endedAt);

  /* 이번 회차의 흐름과 가장 잘한 순간 — 둘 다 엔진이 남긴 이벤트를 옮기기만 합니다. */
  const timeline = useMemo(() => buildTimeline(session.events), [session.events]);
  const situations = useMemo(
    () => new Set(timeline.map((row) => row.ordinal)).size,
    [timeline],
  );
  const best = useMemo(() => pickBestMoment(session.events), [session.events]);

  /* 안 가 본 길 — 지나온 자리에 남은 갈래 수. 엔진의 순수 함수가 세고, 여기서는 옮기기만 합니다. */
  const unexplored = useMemo(() => unexploredBranches(scenario, session), [scenario, session]);

  /**
   * 버튼만으로 완주하신 회차인지.
   *
   * 세션 안에서 한 번 드린 한 줄(CueResponder)을 마무리 화면에도 남깁니다 — 그 자리에서
   * 지나치셨더라도, 「지금까지 한 건 뭐였나」를 나중에 알게 되는 것보다 낫습니다(현직 검증).
   */
  const buttonOnly = useMemo(
    () =>
      session.events.some((event) => event.cueId) &&
      !session.events.some((event) => !event.viaButton && event.utterance),
    [session.events],
  );

  /* 가장 잘한 순간으로 세운 문장은 아래 목록에서 뺍니다 — 같은 문장이 두 번 서면
     강조가 아니라 중복으로 읽힙니다. 「잘한 것 N」의 N은 둘을 합한 수 그대로입니다. */
  const greens = useMemo(
    () => (best ? record.greenChecks.filter((item) => item !== best.message) : record.greenChecks),
    [best, record.greenChecks],
  );

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
      {/* 머리 — 호흡 마크, 원 하나, 제목. 판정 낱말은 세우지 않습니다(점수로 읽히지 않게).

          호흡 마크는 이 앱의 전역 유일 심볼입니다(홈 히어로·앱 아이콘과 같은 마크).
          훈련이 끝난 자리에 그 마크를 세우는 것은 「끝까지 가셨어요」를 형태로 한 번 더 말하는
          일이고, 점 셋이 차례로 들어오는 동안 화면이 한 박자 숨을 고릅니다.

          모션은 새로 만들지 않습니다 — 등장은 이미 있는 두 단 중 가벼운 쪽(chim-pop-in 180ms)이고,
          점마다 110ms씩 늦게 출발합니다(말하는 중 점 셋과 같은 간격). 움직임을 줄여 달라고
          설정하신 분께는 규칙 자체가 적용되지 않아, 세 점이 처음부터 제자리에 서 있습니다.

          틸 채움은 이 화면에서 여전히 **두 곳**입니다 — 판정 원 하나와 아래 주 버튼 하나.
          호흡 마크는 면이 아니라 심볼이라 그 셈에 들지 않습니다(14px 높이의 점 셋). */}
      <div className="text-center">
        <BreathMark
          height={14}
          className={cx(
            "mx-auto mb-3",
            /* 점마다 같은 등장(--animate-pop-in)에 110ms씩 늦은 출발만 얹습니다 —
               `animation` 축약형에서 두 번째 시간값이 지연이라, 속도·이징·채움은 그대로 한 벌입니다.
               `animation-delay`를 따로 걸지 않는 이유는 축약형이 뒤에 오면 지연을 0으로 되돌리기 때문입니다.
               `motion-safe:`로 감싸 두었으므로, 움직임을 줄여 달라고 하신 분께는 규칙 자체가 적용되지
               않습니다 — 세 점이 처음부터 제자리에 그대로 서 있습니다(지연된 등장도 없습니다). */
            "motion-safe:[&>.breath-dot-1]:[animation:var(--animate-pop-in)]",
            "motion-safe:[&>.breath-dot-2]:[animation:var(--animate-pop-in)_110ms]",
            "motion-safe:[&>.breath-dot-3]:[animation:var(--animate-pop-in)_220ms]",
          )}
        />
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
          잘한 것{record.greenChecks.length > 0 && ` ${record.greenChecks.length}`}
        </h3>
        {/* 가장 잘한 순간 — 그 자리에서 드린 검수 문구를 순서·갈래 이름과 함께 다시 폅니다.
            새 문장을 짓지 않고, 목록 맨 위 한 줄을 카드로 세운 것뿐입니다.
            면은 이 화면의 다른 카드와 같은 `paper-2`입니다 — 뜻은 머리말 색(ok-ink)이 전합니다
            (초록 면을 하나 더 만들면 위 ✓ 원과 함께 화면이 초록으로 두 번 말합니다). */}
        {best && (
          <div className="mb-2 rounded-card bg-paper-2 px-[15px] py-3.5">
            <p className="text-[0.7813rem] leading-[1.45] font-bold text-ok-ink">
              가장 잘한 순간 — {best.ordinal} 상황
            </p>
            <p className="mt-1.5 text-[0.9375rem] leading-[1.6] text-ink">{best.message}</p>
          </div>
        )}
        {(greens.length > 0 || !best) && (
          <FoldedList
            items={greens}
            withCheck
            emptyText="이번에는 충족으로 기록된 항목이 없습니다. 아래 한 가지만 들고 다시 해보시면 충분합니다."
          />
        )}
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

      {/* 이번 훈련의 흐름 — 접힌 채로 둡니다(주인공은 위 두 목록입니다). */}
      {timeline.length > 0 && <SessionTimeline rows={timeline} situations={situations} />}

      {/* 안 가 본 길 — 한 줄. 아래 버튼(같은 장면 다시 · 다음 상황으로)으로 그대로 이어지는
          자리라 새 버튼을 달지 않고 문구만 둡니다. 남은 갈래 수는 「몇 곳이 남았는가」이지
          점수가 아니고(위 「잘한 것 N」과 같은 셈법), 전부 가 보셨으면 달성으로만 적습니다. */}
      {timeline.length > 0 && (
        <p className="mt-4 rounded-card bg-paper-2 px-[15px] py-3.5 text-[0.9375rem] leading-[1.6] text-ink-soft">
          {unexplored > 0
            ? `이번에 고르지 않은 갈래가 ${unexplored}곳 남아 있습니다. 같은 상황도 다른 대답이면 다르게 흘러갑니다.`
            : "이 상황의 갈래를 전부 가 보셨습니다."}
        </p>
      )}

      {/* 버튼만으로 완주하신 회차에 한 줄 — 세션 안에서 드린 것과 같은 사실입니다. */}
      {buttonOnly && (
        <p className="mt-4 rounded-card bg-paper-2 px-[15px] py-3.5 text-[0.9375rem] leading-[1.6] text-ink-soft">
          이번에는 보기로만 하셨어요. 다음에 한 번만 직접 말해 보시면 규칙 사전이 그 말씀을 보고
          다르게 짚어 드려요.
        </p>
      )}

      {/* 보조 경로와 안내문 — **도크 밖 일반 흐름**입니다.
          훈련 → 보고 → 성장의 순환이 마지막 힌지에서 끊기지 않도록 두 마무리 모두 보조
          2분할(보고 연습 · 성장 기록)을 답니다(가이드 §4.7). 다만 도크 안에 두었을 때는
          주 CTA 56px + 추천 한 줄 + 2분할 48px + 「오늘은 여기까지」 48px + 안내 두 줄이
          쌓여 표준 260px·「아주 크게」 320px이 되었고, 완주 직후 읽어야 할 「잘한 것 / 다시 볼 것」이
          844px 뷰포트의 38%를 도크에 내주었습니다 — 도크가 화면이 되어 버린 자리입니다
          (UIUX 검증). 지금 여기 남는 것은 「지금 눌러야 하는 것」이 아닌 것들입니다. */}
      <div className="mt-5 space-y-2">
        <div className="flex gap-2">
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
            내 이력 보기
          </Link>
        </div>

        {shape === "retry" && (
          <Link
            href="/train"
            className="flex min-h-[48px] w-full items-center justify-center rounded-field px-3 text-center text-[0.9375rem] leading-[1.3] font-semibold text-ink-soft transition-colors duration-150 active:bg-paper-2"
          >
            오늘은 여기까지
          </Link>
        )}

        {/* 16px은 §2 눈금에 없는 값이었습니다 — 바로 아래 줄과 같은 15px으로 맞춥니다(대비·색은 유지). */}
        <p className="text-center text-[0.9375rem] leading-[1.6] text-ink-soft">
          점수가 아니라 다음에 볼 지점 안내예요
        </p>
        <p className="text-center text-[0.9375rem] leading-[1.6] text-ink-soft">
          이 기록은 기기 안에만 남습니다 · 말씀하신 원문은 저장하지 않습니다
        </p>
      </div>

      {/* 다음 행동 — 문법에 따라 「다음 상황으로」 또는 「같은 장면 다시」가 주인공이 됩니다.
          이 블록은 화면 아래에 도킹해, 로그를 끝까지 내리지 않아도 닿게 합니다.
          도크 안에는 **주 CTA 하나와 그 까닭 한 줄**만 둡니다. 세션 컴포저와 같은 상한(45dvh)을
          걸어 두어, 큰 글자 설정에서도 도크가 화면을 차지하는 역전이 일어나지 않게 합니다. */}
      <div className="sticky bottom-0 z-10 mt-4 max-h-[45dvh] overflow-y-auto overscroll-contain border-t border-line bg-paper pt-3.5 pb-[calc(20px_+_var(--chim-safe-b))]">
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
            같은 장면 다시 해 보기 — 벌점 없음
          </BigButton>
        )}

        {/* 다음 추천 한 줄 — 성장 기록과 **같은 순수 함수**가 고른 이유를 그대로 적습니다
            (`nextTraining`). 앞으로 가는 마무리에서는 위 버튼이 어디로 가는지의 까닭이 되고,
            다시 보는 마무리에서는 오늘 이후를 가리키는 조용한 한 줄로 남습니다. */}
        {suggestion && (
          <p className="mt-2 text-center text-[0.9375rem] leading-[1.6] text-ink-soft">
            다음엔 — {nextTrainingSentence(suggestion)}
          </p>
        )}

      </div>
    </div>
  );
}

export default EndingPanel;
