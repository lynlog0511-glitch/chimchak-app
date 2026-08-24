"use client";

import { useCallback, useRef } from "react";
import { InlineDisclaimer, useSourceDoc } from "@/components";
import { ChevronGlyph } from "@/components/icons";
import { cx } from "@/components/utils";
import { useModalDismiss, useOverlayTransition } from "@/components/useModalDismiss";
import type { CriticalCheck } from "@/engine/rules";
import { splitLawSentences } from "@/app/train/_components/constants";
import {
  CF_ALTERNATIVES_LABEL,
  CF_ALTERNATIVE_NOTE,
  CF_LAW_SUMMARY,
  CF_NOT_SENT,
  CF_NO_RECORD,
  CF_RETRY,
  CF_TITLE,
} from "./constants";

export interface FreeInterruptProps {
  /** 규칙 사전이 잡은 그대로 — 이 값은 **판정으로 기록되지 않습니다** */
  check: CriticalCheck;
  /** 닫기. 대안을 고르셨으면 그 문구를 함께 넘겨 입력창에 놓아 드립니다. */
  onClose: (alternative?: string) => void;
}

/**
 * ⚑CF 즉시 중단 — 자유 연습판 바텀시트입니다.
 *
 * 문법은 훈련의 `CriticalInterrupt`와 **같습니다**(딤 0.5 · 시트 22px · 240ms · 붉은 10px 점 하나 ·
 * 대안 버튼 · 바닥에 붙는 주 CTA). 이 화면에서만 다른 것은 셋입니다.
 *
 *  ① **판정이 없습니다.** 훈련 시트는 판정 한 건(`TracedFeedback`)을 받아 「판정: 규칙 사전 …」을
 *     적습니다. 이 모드는 채점하지 않으므로 판정 객체 자체가 없고, 시트가 받는 것은 규칙 사전이
 *     잡은 결과 하나뿐입니다. 화면에는 「여기서 멈춘 이유」만 적고, 아무것도 기록하지 않습니다.
 *  ② **보내지 않았다는 사실을 먼저 적습니다.** 이 모드에서는 학습자 발화가 서버로 나가는데,
 *     ⚑CF에 걸린 말은 `checkCritical`이 **보내기 전에** 잡으므로 기기 밖으로 나가지 않았습니다.
 *     그 사실이 지금 이 사람에게 가장 필요한 정보라 첫 줄에 둡니다.
 *  ③ **되돌아갈 「같은 장면」이 없습니다.** 자유 대화에는 CUE가 없으므로, 고르신 대안은 같은
 *     지점의 보기 목록이 아니라 **입력창**에 놓입니다. 그대로 보내셔도 되고 고쳐 쓰셔도 됩니다.
 *
 * 시트를 따로 두는 대신 훈련 것을 그대로 쓰지 않은 이유는 위 ①입니다 — 판정을 만들지 않기로
 * 한 모드에서 판정 객체를 흉내 내 만들면, 그 가짜가 어느 날 진짜 기록이 되는 길이 열립니다.
 */
export function FreeInterrupt({ check, onClose }: FreeInterruptProps) {
  const retryRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const { entered, leave } = useOverlayTransition(onClose);

  const doc = useSourceDoc(check.docId);
  /** 검수 문구는 그대로 두고, 조문 문장만 아래 접힘으로 내립니다(훈련 시트와 같은 규칙). */
  const { lead, law } = splitLawSentences(check.reason ?? "");
  const alternatives = check.alternatives ?? [];

  const dismiss = useCallback(() => leave(), [leave]);
  useModalDismiss({ panelRef, initialFocusRef: retryRef, onDismiss: dismiss });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="free-cf-title"
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
          "relative flex max-h-[88dvh] w-full max-w-[430px] flex-col rounded-t-[22px] bg-white",
          "shadow-[0_-10px_40px_rgba(25,31,30,0.25)]",
          "transition-transform duration-[240ms] ease-out",
          entered ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div aria-hidden className="flex h-[22px] flex-none items-center justify-center">
          <span className="block h-[4px] w-[36px] rounded-full bg-line-strong" />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-3">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className={cx(
                "h-[10px] w-[10px] flex-none rounded-full bg-danger",
                "transition-transform duration-[240ms] ease-out",
                entered ? "scale-100" : "scale-50",
              )}
            />
            <h2
              id="free-cf-title"
              className="text-[1.1875rem] leading-[1.3] font-extrabold tracking-[-0.01em] text-ink"
            >
              {CF_TITLE}
            </h2>
          </div>

          {lead.length > 0 && (
            <p className="mt-2 text-[0.9375rem] leading-[1.6] text-ink-soft">{lead}</p>
          )}

          {/* 지금 이 사람에게 가장 먼저 필요한 사실 — 그 말은 기기 밖으로 나가지 않았습니다. */}
          <p className="mt-2.5 rounded-field bg-paper-2 px-[13px] py-[12px] text-[0.875rem] leading-[1.6] font-semibold text-ink">
            {CF_NOT_SENT}
          </p>

          {alternatives.length > 0 && (
            <>
              <h3 className="mt-3.5 mb-[8px] text-[0.7813rem] leading-[1.45] font-bold text-ink-muted">
                {CF_ALTERNATIVES_LABEL}
              </h3>
              <ul className="flex flex-col gap-[8px]">
                {alternatives.map((alternative) => (
                  <li key={alternative}>
                    <button
                      type="button"
                      onClick={() => leave(alternative)}
                      className="min-h-[48px] w-full rounded-[14px] border border-line-strong bg-white px-[15px] py-2.5 text-left text-[1.0625rem] leading-[1.45] font-medium text-ink transition-colors duration-150 hover:bg-paper-2 active:bg-paper-2"
                    >
                      {alternative}
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-[0.7813rem] leading-[1.6] text-ink-muted">
                {CF_ALTERNATIVE_NOTE}
              </p>
            </>
          )}

          {/* 무엇이 멈춰 세웠는지는 접지 않습니다 — 「생성이 아니라 규칙」이 이 시트의 안전 증거입니다.
              다만 훈련 시트와 달리 「판정」이라는 낱말을 쓰지 않습니다. 이 모드에는 판정이 없습니다. */}
          <p className="mt-3.5 text-[0.8438rem] leading-[1.6] font-semibold text-ink">
            여기서 멈춘 것은 규칙 사전 {check.ruleId ?? "⚑CF"}입니다 (AI 아님)
          </p>
          <p className="mt-1 text-[0.7813rem] leading-[1.6] text-ink-muted">{CF_NO_RECORD}</p>

          <details className="group mt-1">
            <summary className="flex min-h-[48px] cursor-pointer list-none items-center gap-1.5 rounded-field text-[0.8438rem] font-semibold text-ink-muted transition-colors duration-150 active:bg-paper-2 [&::-webkit-details-marker]:hidden">
              <span className="underline decoration-1 underline-offset-[3px]">{CF_LAW_SUMMARY}</span>
              <ChevronGlyph size="sm" className="text-ink-ghost group-open:rotate-180" />
            </summary>
            {law.length > 0 && (
              <p className="text-[0.9375rem] leading-[1.6] text-ink-soft">{law}</p>
            )}
            <div className="mt-2 rounded-field bg-paper-2 px-[13px] py-[12px] text-[0.8438rem] leading-[1.6] text-ink-soft">
              {doc && <b className="font-bold text-ink">{doc.title}</b>}
              {doc && check.label && " — "}
              {check.label}
            </div>
          </details>
        </div>

        <div className="flex-none border-t border-line px-5 pt-3 pb-[calc(28px_+_var(--chim-safe-b))]">
          <button
            type="button"
            ref={retryRef}
            onClick={() => leave()}
            className="min-h-[54px] w-full rounded-[14px] bg-brand-700 px-5 text-[1rem] font-bold text-white transition-colors duration-150 hover:bg-brand-800 active:bg-brand-900"
          >
            {CF_RETRY}
          </button>
          <InlineDisclaimer tone="readable" className="mt-3" />
        </div>
      </div>
    </div>
  );
}

export default FreeInterrupt;
