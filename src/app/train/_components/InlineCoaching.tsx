"use client";

import { useId, useState } from "react";
import { useSourceDoc } from "@/components";
import { StatusMark, STATUS_MARK_LABEL, type StatusMarkKind } from "@/components/icons";
import { cx } from "@/components/utils";
import { getRubricItem } from "@/data/rubric";
import type { FeedbackTrace, TracedFeedback } from "@/engine";
import {
  COACH_HEAD,
  COACH_HEAD_TEXT,
  gaugeDeltaChip,
  gaugeDeltaTone,
} from "./constants";

export interface InlineCoachingProps {
  feedback: TracedFeedback;
  /** 게이지 이름 — 델타 칩 문구에 씁니다 (초조도 / 긴장도) */
  gaugeLabel: string;
  className?: string;
}

/** 판정 경로 한 줄 라벨 — 무엇이 이 판정을 내렸는지 그대로 밝힙니다. */
function pathLabel(trace: FeedbackTrace): string {
  switch (trace.source) {
    case "rule":
      return "규칙 사전 단독 판정 (결정론 · 생성 없음)";
    case "criticalPattern":
    case "pattern":
      return trace.matchedPattern
        ? `분기 판정 신호 일치: 「${trace.matchedPattern}」`
        : "분기 판정 신호 일치";
    case "button":
      return "보기 버튼 선택";
    case "default":
    default:
      return "미분류 — 기본 응답 처리";
  }
}

/** 경로별 한 줄 보충 설명 */
function pathNote(trace: FeedbackTrace): string {
  switch (trace.source) {
    case "rule":
      return "말씀 속 표현이 규칙 사전에 등재된 금지 표현과 그대로 맞았습니다. 이 판정에는 생성이 쓰이지 않습니다.";
    case "criticalPattern":
      return "안전 직결 분기의 판정 신호를 먼저 검사해 걸렀습니다.";
    case "pattern":
      return "시나리오 데이터에 적힌 분기 신호와 맞아, 그 분기의 고정 문구를 그대로 보여 드립니다.";
    case "button":
      return "고르신 보기에 시나리오 데이터가 미리 정해 둔 판정을 그대로 따랐습니다.";
    case "default":
    default:
      return "어느 판정 신호에도 걸리지 않아 기본 응답으로 처리했습니다. 조금 더 구체적으로 말씀해 보시면 판정이 달라집니다.";
  }
}

/**
 * 턴 판정 — **카드가 아니라 대화 흐름에 붙는 인라인 한 덩어리**입니다 (시안 4a⑤).
 *
 * [✓ 마크] [충족 · 침착의 코칭] [초조도 한 칸 ↓]
 *          코칭 한 문장
 *          근거 문서 · 왜 이 판정인가요?  ← 누르면 판정 근거가 펼쳐집니다
 *
 * 점수·등급·백분위는 어떤 형태로도 만들지 않습니다. 판정어는 「충족 / 코칭 / 즉시 중단」 세 낱말뿐입니다.
 * (예전 `FeedbackCard`는 다른 화면에서 계속 쓰이고, 세션에서는 이 조각이 대신합니다.)
 */
export function InlineCoaching({ feedback, gaugeLabel, className }: InlineCoachingProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const kind: StatusMarkKind = feedback.criticalFail ? "stop" : feedback.ok ? "met" : "coach";
  const doc = useSourceDoc(feedback.docId);
  const chip = gaugeDeltaChip(gaugeLabel, feedback.gaugeDelta);
  const trace = feedback.trace;

  /* 걸린 루브릭 항목 — 행동지표 문장만 가져옵니다. 점수·앵커는 내부 전용이라 읽지 않습니다. */
  const basis = (trace?.itemIds ?? []).flatMap((itemId) => {
    const item = getRubricItem(itemId);
    return item ? [{ itemId, indicator: item.indicator, docId: item.docId }] : [];
  });

  const extraDocs = basis
    .map((entry) => entry.docId)
    .filter((id): id is string => typeof id === "string" && id !== feedback.docId)
    .filter((id, index, all) => all.indexOf(id) === index);

  return (
    <div className={cx("flex gap-[9px] px-1", className)}>
      <span className="relative top-[1px] flex-none">
        <StatusMark kind={kind} size="sm" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          {/* 판정어는 「충족 / 코칭 / 즉시 중단」 세 낱말을 그대로 씁니다. */}
          <span className="sr-only">{STATUS_MARK_LABEL[kind]} 판정</span>
          <span className={cx("text-[0.7813rem] leading-[1.4] font-bold", COACH_HEAD_TEXT[kind])}>
            {COACH_HEAD[kind]}
          </span>
          {chip && (
            <span
              className={cx(
                "rounded-[5px] px-1.5 py-px text-[0.7188rem] leading-[1.5] font-semibold",
                gaugeDeltaTone(feedback.gaugeDelta),
              )}
            >
              {chip}
            </span>
          )}
        </div>

        {/* 코칭 문장 — 이 덩어리의 주인공입니다 (시안 15px). */}
        <p className="mt-[3px] text-[0.9375rem] leading-[1.55] text-ink-soft">{feedback.message}</p>

        <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5 text-[0.7813rem] leading-[1.5] text-ink-muted">
          {doc && (
            <span className="min-w-0">
              <span aria-hidden>§ </span>
              {doc.title}
            </span>
          )}
          {doc && trace && <span aria-hidden>·</span>}
          {trace && (
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-controls={panelId}
              className="min-h-[24px] py-1 underline decoration-1 underline-offset-[3px] hover:text-ink-soft"
            >
              왜 이 판정인가요?
            </button>
          )}
          {!doc && !trace && feedback.branchLabel.length > 0 && <span>{feedback.branchLabel}</span>}
        </div>

        {trace && open && (
          <div
            id={panelId}
            className="mt-2 space-y-2.5 rounded-card bg-paper-2 px-3.5 py-3 text-[0.7813rem] leading-[1.6] text-ink-soft"
          >
            <div>
              <p className="text-[0.7188rem] font-bold text-ink-muted">판정 경로</p>
              <p className="mt-0.5 font-bold text-ink">{pathLabel(trace)}</p>
              {trace.ruleLabel && (
                <p className="mt-0.5">
                  규칙: {trace.ruleLabel}
                  {trace.ruleId ? ` (${trace.ruleId})` : ""}
                  {trace.matchedPattern ? ` · 걸린 표현 「${trace.matchedPattern}」` : ""}
                </p>
              )}
              <p className="mt-0.5">{pathNote(trace)}</p>
              {trace.advisoryLabels && trace.advisoryLabels.length > 0 && (
                <p className="mt-0.5">
                  규칙 사전 코칭도 함께 적용되었습니다 — {trace.advisoryLabels.join(" · ")}
                </p>
              )}
            </div>

            {basis.length > 0 && (
              <div>
                <p className="text-[0.7188rem] font-bold text-ink-muted">확인한 항목</p>
                <ul className="chim-hairline mt-0.5">
                  {basis.map((entry) => (
                    <li key={entry.itemId} className="flex gap-2 py-1.5 first:pt-0 last:pb-0">
                      <span className="chim-num shrink-0 font-bold text-ink-muted">
                        {entry.itemId}
                      </span>
                      <span className="min-w-0 flex-1 text-ink">{entry.indicator}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(feedback.docId || extraDocs.length > 0) && (
              <div>
                <p className="text-[0.7188rem] font-bold text-ink-muted">근거 문서</p>
                <p className="mt-0.5">
                  {[doc?.title ?? feedback.docId, ...extraDocs].filter(Boolean).join(" · ")}
                </p>
              </div>
            )}

            <p className="border-t border-line pt-2 font-semibold text-ink-muted">
              이 판정은 이 기기 안에서 끝났습니다 · 외부로 나간 요청 0건
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default InlineCoaching;
