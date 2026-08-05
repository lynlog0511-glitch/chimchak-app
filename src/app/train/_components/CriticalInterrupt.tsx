"use client";

import { useEffect, useRef, useState } from "react";
import { InlineDisclaimer, useSourceDoc } from "@/components";
import { cx } from "@/components/utils";
import type { TracedFeedback } from "@/engine";
import { cfVerdictSourceLine } from "./constants";

export interface CriticalInterruptProps {
  feedback: TracedFeedback;
  /** 대안 행동 (규칙 사전 또는 시나리오 데이터에서 옵니다) */
  alternatives: string[];
  /** 같은 장면으로 되돌립니다. 대안을 고르셨으면 그 문구를 함께 넘겨 로그에 남깁니다. */
  onRetry: (alternative?: string) => void;
}

/**
 * ⚑CF 즉시 중단 — **바텀시트**입니다 (시안 6c · 가이드 §4.6).
 *
 * 치명적 실패는 생성 모델이 아니라 규칙 사전과 시나리오 데이터가 판정합니다.
 * 화면은 즉시 멈추고, 왜 멈췄는지·무엇을 할 수 있었는지만 보여 준 뒤 같은 지점으로 돌려보냅니다.
 * (점수·등급은 표시하지 않습니다. 재시도에 벌점도 없습니다.)
 *
 * 빨강은 10px 점 하나뿐입니다 — 헤더 밴드도 좌측 액센트 바도 두지 않습니다.
 */
export function CriticalInterrupt({ feedback, alternatives, onRetry }: CriticalInterruptProps) {
  const retryRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  /** 시트가 아래에서 올라오는 240ms — reduced-motion에서는 전역 규칙이 즉시 정지시킵니다(§6). */
  const [entered, setEntered] = useState(false);

  const doc = useSourceDoc(feedback.docId);

  useEffect(() => {
    // 시트가 아직 화면 아래에 있는 동안 포커스를 주므로 스크롤은 막습니다(문서가 튀지 않게).
    retryRef.current?.focus({ preventScroll: true });
    const frame = window.requestAnimationFrame(() => setEntered(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  // Esc로 닫기(= 다시 해보기)와 Tab 포커스 가두기.
  // 전면 인터럽트에서 포커스가 배경으로 빠지면 키보드 사용자가 모달 밖을 조작하게 됩니다.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        onRetry();
        return;
      }
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      );
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onRetry]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-[rgba(25,31,30,0.32)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cf-title"
      ref={panelRef}
    >
      {/* 시트는 진짜로 떠 있는 것이라 그림자만 쓰고 테두리는 두르지 않습니다(가이드 §3). */}
      <div
        className={cx(
          "max-h-[88dvh] w-full max-w-[430px] overflow-y-auto rounded-t-[22px] bg-white px-5 pt-[22px]",
          // 홈 인디케이터와 겹치지 않게 하단 28px + safe-area (가이드 §4.11)
          "pb-[calc(28px_+_var(--chim-safe-b))]",
          "shadow-[0_-10px_40px_rgba(25,31,30,0.25)]",
          "transition-transform duration-[240ms] ease-out",
          entered ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className="flex items-center gap-2">
          <span aria-hidden className="h-[10px] w-[10px] flex-none rounded-full bg-danger" />
          <h2
            id="cf-title"
            className="text-[19px] leading-[1.35] font-extrabold tracking-[-0.01em] text-ink"
          >
            잠깐, 여기서 멈춥니다
          </h2>
        </div>

        {/* 왜 멈췄는지는 코어 콘텐츠입니다. */}
        <p className="mt-2 text-[15.5px] leading-[1.6] text-ink-soft">{feedback.message}</p>

        {/* 근거 — 판정한 주체까지 한 박스에 적습니다(생성이 아니라 규칙임을 여기서 밝힙니다).
            「(AI 아님)」은 이 화면에서 가장 중요한 사실이라 옅은 회색으로 내리지 않습니다(대비 4.5:1↑). */}
        <div className="mt-3 rounded-field bg-paper-2 px-[13px] py-[11px] text-[13px] leading-[1.55] text-ink-soft">
          {doc && <b className="font-bold text-ink">{doc.title}</b>}
          {doc && feedback.trace?.ruleLabel && " — "}
          {feedback.trace?.ruleLabel}
          {(doc || feedback.trace?.ruleLabel) && " · "}
          {cfVerdictSourceLine(feedback)}
        </div>

        {alternatives.length > 0 && (
          <>
            <h3 className="mt-3.5 mb-[7px] text-[12.5px] leading-[1.4] font-bold text-ink-muted">
              대신 이렇게 말해볼 수 있어요
            </h3>
            <ul className="flex flex-col gap-[7px]">
              {alternatives.map((alternative) => (
                <li key={alternative}>
                  {/* 고르시면 그 대안을 로그에 적어 두고 같은 장면으로 돌아갑니다(전송은 하지 않습니다). */}
                  <button
                    type="button"
                    onClick={() => onRetry(alternative)}
                    className="min-h-[48px] w-full rounded-[14px] border border-line-strong bg-white px-[15px] py-2.5 text-left text-[15px] leading-[1.4] font-medium text-ink transition-colors duration-150 hover:bg-paper-2"
                  >
                    {alternative}
                  </button>
                </li>
              ))}
            </ul>
            {/* 이 버튼들은 대신 말해 주지 않습니다 — 무엇을 고르셨는지만 대화 기록에 남깁니다. */}
            <p className="mt-1.5 text-[12px] leading-[1.6] text-ink-muted">
              고르시면 대화 기록에 남기고 같은 장면으로 돌아갑니다 — 말씀은 직접 하시면 됩니다.
            </p>
          </>
        )}

        <button
          type="button"
          ref={retryRef}
          onClick={() => onRetry()}
          className="mt-3.5 min-h-[54px] w-full rounded-[14px] bg-brand-700 px-5 text-[16px] font-bold text-white transition-colors duration-150 hover:bg-brand-800 active:bg-brand-900"
        >
          같은 장면에서 다시 해보기 — 벌점 없음
        </button>

        {/* 이 시트가 입력 도크의 고지를 덮으므로, 고지 문구를 여기에도 그대로 둡니다 (안전 규칙 §3-2). */}
        <InlineDisclaimer tone="readable" className="mt-3" />
      </div>
    </div>
  );
}

export default CriticalInterrupt;
