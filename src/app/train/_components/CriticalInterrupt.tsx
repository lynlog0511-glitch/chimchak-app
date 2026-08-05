"use client";

import { useEffect, useRef } from "react";
import { BigButton, InlineDisclaimer, SourceChip } from "@/components";
import { StatusMark } from "@/components/icons";
import type { TurnFeedback } from "@/types";

export interface CriticalInterruptProps {
  feedback: TurnFeedback;
  /** 대안 행동 (규칙 사전 또는 시나리오 데이터에서 옵니다) */
  alternatives: string[];
  onRetry: () => void;
}

/**
 * ⚑CF 전면 인터럽트.
 *
 * 치명적 실패는 생성 모델이 아니라 규칙 사전과 시나리오 데이터가 판정합니다.
 * 화면은 즉시 멈추고, 왜 멈췄는지·무엇을 할 수 있었는지만 보여 준 뒤 같은 지점으로 돌려보냅니다.
 * (점수·등급은 표시하지 않습니다. 재시도에 벌점도 없습니다.)
 */
export function CriticalInterrupt({ feedback, alternatives, onRetry }: CriticalInterruptProps) {
  const retryRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const button = retryRef.current?.querySelector("button");
    button?.focus();
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/55 p-3 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cf-title"
      ref={panelRef}
    >
      {/* 빨간 의미는 그대로 두되 과장은 걷어냅니다 — 꽉 찬 빨강 대신 옅은 면과 붉은 잉크로.
          모달은 진짜로 떠 있는 것이라 그림자만 쓰고 테두리는 두르지 않습니다(v4 §2). */}
      <div className="animate-fade-up max-h-[88vh] w-full max-w-[390px] overflow-y-auto rounded-panel bg-white shadow-panel">
        <div className="flex items-center gap-2 bg-danger-soft px-5 py-3.5">
          <StatusMark kind="stop" size="md" />
          <h2 id="cf-title" className="text-[17px] leading-[1.4] font-bold text-danger-ink">
            여기서 멈추겠습니다
          </h2>
        </div>

        <div className="space-y-4 p-5">
          {/* 왜 멈췄는지는 코어 콘텐츠입니다 — 17px 하한(§3). */}
          <p className="text-[17px] leading-[1.6] font-semibold text-ink">{feedback.message}</p>

          {feedback.docId && (
            <div>
              <p className="mb-1.5 text-[12px] leading-[1.5] font-bold tracking-[0.06em] text-ink-muted">
                이 판정의 근거
              </p>
              <SourceChip docId={feedback.docId} />
            </div>
          )}

          {alternatives.length > 0 && (
            <div>
              <h3 className="text-[14px] leading-[1.5] font-bold text-ink">
                지금 하실 수 있었던 것
              </h3>
              {/* 색 배경 대신 hairline 목록 — 이 화면의 색은 머리말 하나로 충분합니다. */}
              <ol className="chim-hairline mt-2 border-t border-line">
                {alternatives.map((alternative, index) => (
                  <li key={alternative} className="flex gap-2.5 py-2.5">
                    <span
                      aria-hidden="true"
                      className="chim-num w-4 shrink-0 pt-0.5 text-[13px] font-bold text-brand-700"
                    >
                      {index + 1}
                    </span>
                    <span className="text-[14px] leading-[1.6] text-ink">{alternative}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <p className="text-[12.5px] leading-[1.65] text-ink-muted">
            이 화면은 훈련을 멈추기 위한 것이 아니라, 현장에서 되돌릴 수 없는 선택을 미리 한 번
            막아 보기 위한 것입니다. 같은 지점부터 다시 하실 수 있고 벌점은 없습니다.
          </p>

          <div ref={retryRef}>
            <BigButton onClick={onRetry} size="lg" block>
              대안을 확인했습니다 · 다시 해보기
            </BigButton>
          </div>

          {/* 이 모달이 입력 도크의 고지를 덮으므로, 고지 문구를 여기에도 그대로 둡니다 (안전 규칙 §3-2). */}
          <InlineDisclaimer tone="readable" />
        </div>
      </div>
    </div>
  );
}

export default CriticalInterrupt;
