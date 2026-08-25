"use client";

import { useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { cx } from "@/components/utils";
import { useModalDismiss, useOverlayTransition } from "@/components/useModalDismiss";
import {
  RULE_DEMO_HINT,
  RULE_DEMO_NO_CRITICAL_NOTE,
  RULE_DEMO_NOTE,
  RULE_DEMO_TITLE,
  type RuleDemoExample,
} from "./ruleDemoExamples";

export interface RuleDemoSheetProps {
  /** 지금 답하시던 CUE 지시문 — 시트가 떠 있는 동안에도 무엇에 답하던 중인지 남깁니다 */
  prompt: string;
  examples: RuleDemoExample[];
  /** 예시 문장을 입력창에 채웁니다(전송하지 않습니다) */
  onFill: (example: RuleDemoExample) => void;
  onClose: () => void;
}

/**
 * 규칙 엔진 시연 — **바텀시트**입니다 (⚑CF 시트와 같은 문법).
 *
 * 예전에는 입력 도크 안 `<details>`였습니다. 펴는 순간 도크가 919px로 부풀어
 * 뷰포트(844px)를 넘겼고 대화 로그 가시 영역이 0px이 되었습니다 — 라벨 그대로
 * 심사 중 열릴 확률이 가장 높은 요소가 화면을 무너뜨리던 자리입니다(평가 UI/UX m3 실측).
 * 시트로 빼면 도크 높이는 그대로이고, 닫는 순간 CUE 질문과 보기가 원래 자리에 그대로 있습니다.
 *
 * 예시를 고르시면 입력창에 채우기만 하고 시트를 닫습니다 — 보내는 것은 사람이 합니다.
 */
export function RuleDemoSheet({ prompt, examples, onFill, onClose }: RuleDemoSheetProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  /** 시트·딤이 함께 오르내리는 240ms — ⚑CF 시트와 **같은 문법**입니다(§6 · 모션 감사 2). */
  const { entered, leave } = useOverlayTransition<[RuleDemoExample?]>((example) => {
    if (example) onFill(example);
    else onClose();
  });

  /** 닫기 — 퇴장 모션을 태운 뒤 닫힙니다(Esc도 같은 길로 갑니다). */
  const dismiss = useCallback(() => leave(), [leave]);

  useModalDismiss({ panelRef, initialFocusRef: closeRef, onDismiss: dismiss });

  /* 도크는 `sticky z-20`이라 자기 쌓임 맥락을 만듭니다 — 그 안에서 그리면 시트가
     `z-30` 세션 헤더 **아래**로 깔립니다. 그래서 문서 맨 위(body)에 붙여 그립니다.
     이 시트는 사용자가 눌러야 마운트되므로 그 시점의 document는 언제나 있습니다. */
  const host = typeof document === "undefined" ? null : document.body;
  if (!host) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rule-demo-title"
      ref={panelRef}
    >
      {/* 딤 — 시트와 같은 240ms로 함께 들어오고 함께 나갑니다(⚑CF 시트와 같은 문법). */}
      <div
        aria-hidden
        className={cx(
          "absolute inset-0 bg-[rgba(25,31,30,0.32)] transition-opacity duration-[240ms] ease-out",
          entered ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        className={cx(
          "relative flex max-h-[88dvh] w-full max-w-[430px] flex-col rounded-t-[22px] bg-white",
          "shadow-[0_-10px_40px_rgba(25,31,30,0.25)]",
          "transition-transform duration-[240ms] ease-out",
          entered ? "translate-y-0" : "translate-y-full",
        )}
      >
        {/* 그래버 — 22px 띠 하나. 「여기는 스크롤됩니다」를 형태로만 말합니다. */}
        <div aria-hidden className="flex h-[1.375rem] flex-none items-center justify-center">
          <span className="block h-[4px] w-[36px] rounded-full bg-line-strong" />
        </div>

        {/* 답하시던 질문은 시트 위에 남겨 둡니다 — 시연 장치를 열었다고 해서
            무엇에 답하던 중인지까지 화면에서 사라지면 안 됩니다. */}
        <div className="flex-none border-b border-line px-5 pb-3">
          <h2
            id="rule-demo-title"
            className="text-[0.8438rem] leading-[1.45] font-bold text-ink-muted"
          >
            {RULE_DEMO_TITLE}
          </h2>
          <p className="mt-1.5 text-[0.9375rem] leading-[1.45] font-bold text-ink">{prompt}</p>
        </div>

        {/* 스크롤은 시트 안에서 끝냅니다 — 목록 끝에서 뒤 페이지로 새어 나가지 않게(모션 감사 3). */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-3 pb-3">
          <p className="text-[0.8438rem] leading-[1.6] font-semibold text-ink-soft">
            {RULE_DEMO_NOTE}
          </p>
          <p className="mt-1 text-[0.8438rem] leading-[1.6] text-ink-muted">{RULE_DEMO_HINT}</p>

          <ul className="mt-3 space-y-2.5">
            {examples.map((example) => (
              <li key={example.id}>
                <button
                  type="button"
                  onClick={() => leave(example)}
                  className="w-full rounded-card bg-paper-2 px-3.5 py-3 text-left transition-colors duration-150 hover:bg-tint active:bg-tint"
                >
                  <span className="block text-[0.7813rem] leading-[1.45] font-bold text-ink-muted">
                    {example.kind === "critical" ? "즉시 중단" : "코칭"} · {example.ruleId} ·{" "}
                    {example.itemId} {example.ruleLabel}
                  </span>
                  <span className="mt-1 block text-[0.8438rem] leading-[1.6] font-semibold text-ink">
                    “{example.sentence}”
                  </span>
                </button>
                <p className="mt-1 px-1 text-[0.8438rem] leading-[1.6] text-ink-muted">
                  {example.expectation}
                </p>
              </li>
            ))}
          </ul>

          {!examples.some((example) => example.kind === "critical") && (
            <p className="mt-2.5 rounded-card bg-paper-2 px-3.5 py-2.5 text-[0.8438rem] leading-[1.6] text-ink-muted">
              {RULE_DEMO_NO_CRITICAL_NOTE}
            </p>
          )}
        </div>

        {/* 탈출구는 언제나 화면 안에 — 예시가 아무리 길어도 닫기는 바닥에 남습니다. */}
        <div className="flex-none border-t border-line px-5 pt-3 pb-[calc(28px_+_var(--chim-safe-b))]">
          <button
            type="button"
            ref={closeRef}
            onClick={dismiss}
            className="min-h-[54px] w-full rounded-card bg-neutral-soft px-5 text-[1rem] font-bold text-ink transition-colors duration-150 hover:bg-neutral-line active:bg-neutral-line"
          >
            닫고 보기로 돌아가기
          </button>
        </div>
      </div>
    </div>,
    host,
  );
}

export default RuleDemoSheet;
