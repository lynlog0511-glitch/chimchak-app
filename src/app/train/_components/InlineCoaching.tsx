"use client";

import { useId, useState } from "react";
import { useSourceDoc } from "@/components";
import { ChevronGlyph, StatusMark, STATUS_MARK_LABEL, type StatusMarkKind } from "@/components/icons";
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

/**
 * 이 판정을 실제로 실행한 판정기 이름 — 「시나리오 규칙표 / 규칙 사전 / 시간 규칙」 세 낱말만 씁니다.
 *
 * 이름은 `cfVerdictSourceLine`(constants.ts)과 같은 낱말을 쓰고, /safety 01의 「규칙 사전이
 * 문장으로, 119 지연은 경과 초로」와 같은 갈래입니다. 셋을 한 낱말로 뭉뚱그리지 않는 이유는,
 * 버튼만으로 시연하면 규칙 사전이 실행되지 않기 때문입니다(session.ts:282 — 자유 발화 조건).
 * 그 사실을 감추는 대신 어느 판정기가 돌았는지 매 턴 그대로 적습니다.
 */
function pathEngines(trace: FeedbackTrace): string[] {
  const engines = [trace.source === "rule" ? "규칙 사전" : "시나리오 규칙표"];
  // 자유 발화에서는 분기 판정 위에 규칙 사전 코칭이 함께 얹힙니다.
  if (trace.advisoryLabels && trace.advisoryLabels.length > 0 && !engines.includes("규칙 사전")) {
    engines.push("규칙 사전");
  }
  // CO-03은 문장이 아니라 경과 초로 잽니다(timing.ts). 버튼 경로에서도 실행됩니다.
  if (typeof trace.callDelaySec === "number") engines.push("시간 규칙");
  return engines;
}

/** 접힘 손잡이 줄에 상시 노출하는 판정 경로 — 「시나리오 규칙표 · 시간 규칙」. */
function pathBadge(trace: FeedbackTrace): string {
  return pathEngines(trace).join(" · ");
}

/**
 * 판정기 이름만으로는 모자란 사실 한 마디.
 * 버튼으로 고르신 턴은 규칙 사전이 아니라 시나리오 규칙표가 판정하므로 그대로 적습니다.
 */
function pathQualifier(trace: FeedbackTrace): string | null {
  if (trace.source === "button") return "선택지 그대로";
  if (trace.source === "default") return "기본 응답";
  return null;
}

/** 판정 경로 한 줄 라벨 — 무엇이 이 판정을 내렸는지 그대로 밝힙니다. */
function pathLabel(trace: FeedbackTrace): string {
  switch (trace.source) {
    case "rule":
      return "규칙 사전 단독 판정 (결정론 · 생성 없음)";
    case "criticalPattern":
    case "pattern":
      return trace.matchedPattern
        ? `시나리오 규칙표 — 판정 신호 일치: 「${trace.matchedPattern}」`
        : "시나리오 규칙표 — 판정 신호 일치";
    case "button":
      return "시나리오 규칙표 — 고르신 선택지 그대로";
    case "default":
    default:
      return "시나리오 규칙표 — 미분류, 기본 응답 처리";
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
      return "고르신 보기에 시나리오 데이터가 미리 정해 둔 판정을 그대로 따랐습니다. 보기로 고르신 턴은 시나리오 규칙표가 판정하고, 규칙 사전은 직접 말씀하신 문장에 돕니다 — 둘 다 생성 없이 정해진 표를 따릅니다.";
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
    <div className={cx("flex gap-[8px] px-1", className)}>
      <span className="relative top-[1px] flex-none">
        <StatusMark kind={kind} size="sm" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          {/* 판정어는 「충족 / 코칭 / 즉시 중단」 세 낱말을 그대로 씁니다. */}
          <span className="sr-only">{STATUS_MARK_LABEL[kind]} 판정</span>
          <span className={cx("text-[0.7813rem] leading-[1.45] font-bold", COACH_HEAD_TEXT[kind])}>
            {COACH_HEAD[kind]}
          </span>
          {chip && (
            <span
              className={cx(
                "rounded-[5px] px-1.5 py-px text-[0.6875rem] leading-[1.45] font-semibold",
                gaugeDeltaTone(feedback.gaugeDelta),
              )}
            >
              {chip}
            </span>
          )}
        </div>

        {/* 코칭 문장 — 이 덩어리의 주인공입니다 (시안 15px). */}
        <p className="mt-[3px] text-[0.9375rem] leading-[1.6] text-ink-soft">{feedback.message}</p>

        {/* 근거 문서 라벨과 토글을 한 덩어리로 묶어 **행 전체**를 누를 수 있게 합니다.
            예전에는 밑줄 텍스트만 27px이라, 48px을 지키는 이 앱에서 유일하게 손가락이
            미끄러지는 컨트롤이었습니다(평가 UI/UX mi9 실측 · 완주 한 회에 7개 노출). */}
        {trace ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls={panelId}
            className="-mx-1.5 mt-1 flex min-h-[48px] w-full flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-field px-1.5 py-1 text-left text-[0.7813rem] leading-[1.45] text-ink-muted transition-colors duration-150 hover:bg-paper-2 active:bg-paper-2"
          >
            {/* 판정 경로는 접힘 안에 숨기지 않고 손잡이 줄에 상시 노출합니다.
                버튼만으로 시연하는 동선에서도 「무엇이 판정했는가」가 매 턴 보여야, 화면의
                단언(/safety 01)과 실제로 밟는 실행 경로가 어긋나지 않습니다. */}
            <span className="min-w-0">
              판정:{" "}
              <span className="font-bold text-ink-soft">{pathBadge(trace)}</span>
              {pathQualifier(trace) ? ` · ${pathQualifier(trace)}` : ""}
            </span>
            <span aria-hidden>·</span>
            {doc && (
              <span className="min-w-0">
                <span aria-hidden>§ </span>
                {doc.title}
              </span>
            )}
            {doc && <span aria-hidden>·</span>}
            <span className="font-semibold underline decoration-1 underline-offset-[3px]">
              왜 이 판정인가요?
            </span>
            <ChevronGlyph
              size="sm"
              className={cx("ml-auto flex-none text-ink-ghost", open && "rotate-180")}
            />
          </button>
        ) : (
          (doc || feedback.branchLabel.length > 0) && (
            <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5 text-[0.7813rem] leading-[1.45] text-ink-muted">
              {doc ? (
                <span className="min-w-0">
                  <span aria-hidden>§ </span>
                  {doc.title}
                </span>
              ) : (
                <span>{feedback.branchLabel}</span>
              )}
            </div>
          )
        )}

        {trace && open && (
          <div
            id={panelId}
            className="mt-2 space-y-2.5 rounded-card bg-paper-2 px-3.5 py-3 text-[0.7813rem] leading-[1.6] text-ink-soft"
          >
            <div>
              <p className="text-[0.6875rem] font-bold text-ink-muted">판정 경로</p>
              <p className="mt-0.5 font-bold text-ink">{pathLabel(trace)}</p>
              {trace.ruleLabel && (
                <p className="mt-0.5">
                  규칙: {trace.ruleLabel}
                  {trace.ruleId ? ` (${trace.ruleId})` : ""}
                  {trace.matchedPattern ? ` · 걸린 표현 「${trace.matchedPattern}」` : ""}
                </p>
              )}
              <p className="mt-0.5">{pathNote(trace)}</p>
              {/* 시간 규칙은 문장이 아니라 경과 초로 잽니다(timing.ts) — 잰 값을 그대로 적습니다. */}
              {typeof trace.callDelaySec === "number" && (
                <p className="mt-0.5">
                  시간 규칙 CO-03 — 응급 신호가 뜬 순간부터 119 연결까지 {trace.callDelaySec}초로
                  재어 판정했습니다.
                </p>
              )}
              {trace.advisoryLabels && trace.advisoryLabels.length > 0 && (
                <p className="mt-0.5">
                  규칙 사전 코칭도 함께 적용되었습니다 — {trace.advisoryLabels.join(" · ")}
                </p>
              )}
            </div>

            {basis.length > 0 && (
              <div>
                <p className="text-[0.6875rem] font-bold text-ink-muted">확인한 항목</p>
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
                <p className="text-[0.6875rem] font-bold text-ink-muted">근거 문서</p>
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
