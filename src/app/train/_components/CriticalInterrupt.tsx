"use client";

import { useCallback, useRef } from "react";
import { BigButton, InlineDisclaimer, useSourceDoc } from "@/components";
import { ChevronGlyph } from "@/components/icons";
import { cx } from "@/components/utils";
import { useModalDismiss, useOverlayTransition } from "@/components/useModalDismiss";
import type { TracedFeedback } from "@/engine";
import { cfVerdictSourceLine, splitLawSentences } from "./constants";
import type { CriticalReplyOption } from "./sessionMachine";

export interface CriticalInterruptProps {
  feedback: TracedFeedback;
  /** 실제 제출 분기와 한 쌍인, 가장 안전한 검수 추천 문장 하나입니다. */
  replyOptions: CriticalReplyOption[];
  /** 추천 문장을 쓰지 않고 같은 장면으로 돌아갑니다. */
  onRetry: () => void;
  /** 추천 문장으로 같은 장면에 즉시 답합니다. */
  onRecommendedReply: (option: CriticalReplyOption) => void;
}

type CriticalExit =
  | { kind: "retry" }
  | { kind: "reply"; option: CriticalReplyOption };

/**
 * 안전선을 넘은 답을 즉시 멈추는 바텀시트.
 * 기본 화면은 이유 한 줄, 추천 문장 하나, 다음 행동 두 개만 보여 줍니다.
 */
export function CriticalInterrupt({
  feedback,
  replyOptions,
  onRetry,
  onRecommendedReply,
}: CriticalInterruptProps) {
  const actionRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const recommended = replyOptions[0];
  const doc = useSourceDoc(feedback.docId);
  const { lead, law } = splitLawSentences(feedback.message);

  const { entered, leave } = useOverlayTransition((exit: CriticalExit) => {
    if (exit.kind === "reply") {
      onRecommendedReply(exit.option);
      return;
    }
    onRetry();
  });

  const dismiss = useCallback(() => leave({ kind: "retry" }), [leave]);
  useModalDismiss({ panelRef, initialFocusRef: actionRef, onDismiss: dismiss });

  const replyWith = (option: CriticalReplyOption): void => {
    leave({ kind: "reply", option });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cf-title"
      aria-describedby="cf-reason"
      ref={panelRef}
    >
      <div
        aria-hidden
        className={cx(
          "absolute inset-0 bg-[rgba(25,31,30,0.5)] transition-opacity duration-[240ms] ease-out",
          entered ? "opacity-100" : "opacity-0",
        )}
      />

      <div
        className={cx(
          "relative flex max-h-[88dvh] w-full max-w-[430px] flex-col rounded-t-[22px] bg-paper",
          "shadow-[0_-10px_40px_rgba(25,31,30,0.25)]",
          "transition-transform duration-[240ms] ease-out",
          entered ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div aria-hidden className="flex h-[1.375rem] flex-none items-center justify-center">
          <span className="block h-1 w-9 rounded-full bg-line-strong" />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-3">
          <div className="flex items-start gap-2.5">
            <span
              aria-hidden
              className={cx(
                "mt-1 h-2.5 w-2.5 flex-none rounded-full bg-danger",
                "transition-transform duration-[240ms] ease-out",
                entered ? "scale-100" : "scale-50",
              )}
            />
            <h2
              id="cf-title"
              className="text-[1.375rem] leading-[1.3] font-extrabold tracking-[-0.01em] text-ink"
            >
              잠깐, 더 안전한 방법이 있어요
            </h2>
          </div>

          <p id="cf-reason" className="mt-3 text-[1rem] leading-[1.6] text-ink-soft">
            이 방법은 어르신의 안전이나 권리를 해칠 수 있어요.
          </p>

          {recommended && (
            <section className="mt-4 rounded-card bg-paper-2 px-4 py-4" aria-labelledby="recommended-reply">
              <h3
                id="recommended-reply"
                className="text-[0.9375rem] leading-[1.45] font-bold text-ink-muted"
              >
                추천 문장
              </h3>
              <p className="mt-2 text-[1.1875rem] leading-[1.6] font-semibold text-ink">
                {recommended.sentence}
              </p>
            </section>
          )}

          <details className="group mt-2 border-b border-line">
            <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-2 rounded-field text-[0.9375rem] font-bold text-ink-muted transition-colors duration-150 active:bg-paper-2 [&::-webkit-details-marker]:hidden">
              <span>안전 근거 보기</span>
              <ChevronGlyph size="sm" className="text-ink-ghost group-open:rotate-180" />
            </summary>
            <div className="pb-4">
              {lead.length > 0 && (
                <p className="text-[0.9375rem] leading-[1.6] text-ink-soft">{lead}</p>
              )}
              {law.length > 0 && (
                <p className="mt-2 text-[0.9375rem] leading-[1.6] text-ink-soft">{law}</p>
              )}
              <p className="mt-2 text-[0.8438rem] leading-[1.6] font-semibold text-ink-soft">
                {cfVerdictSourceLine(feedback)}
              </p>
              {(doc || feedback.trace?.ruleLabel) && (
                <p className="mt-2 rounded-field bg-paper-2 px-3 py-3 text-[0.8438rem] leading-[1.6] text-ink-soft">
                  {doc?.title}
                  {doc && feedback.trace?.ruleLabel ? " · " : ""}
                  {feedback.trace?.ruleLabel}
                </p>
              )}
            </div>
          </details>

        </div>

        <div className="flex-none border-t border-line px-5 pt-3 pb-[calc(24px_+_var(--chim-safe-b))]">
          <div
            ref={(node) => {
              actionRef.current = node?.querySelector("button") ?? null;
            }}
            className="space-y-2"
          >
            {recommended ? (
              <BigButton size="lg" block onClick={() => replyWith(recommended)}>
                이 문장으로 다시 답하기
              </BigButton>
            ) : (
              <BigButton size="lg" block onClick={() => leave({ kind: "retry" })}>
                내 말로 다시 하기
              </BigButton>
            )}
            {recommended && (
              <BigButton variant="secondary" block onClick={() => leave({ kind: "retry" })}>
                내 말로 다시 하기
              </BigButton>
            )}
          </div>
          <p className="mt-2 text-[0.8438rem] leading-[1.6] text-ink-muted">
            점수는 매기지 않아요. 다시 볼 지점으로만 남아요.
          </p>
          <InlineDisclaimer tone="readable" className="mt-3" />
        </div>
      </div>
    </div>
  );
}

export default CriticalInterrupt;
