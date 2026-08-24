"use client";

import { useCallback, useRef } from "react";
import { InlineDisclaimer, useSourceDoc } from "@/components";
import { ChevronGlyph } from "@/components/icons";
import { cx } from "@/components/utils";
import { useModalDismiss, useOverlayTransition } from "@/components/useModalDismiss";
import type { TracedFeedback } from "@/engine";
import { cfVerdictSourceLine, splitLawSentences } from "./constants";

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
  /**
   * 시트·딤이 함께 움직이는 240ms — 들어올 때도 나갈 때도 같은 값입니다.
   * 예전에는 시트만 올라오고 딤은 하드컷이었고 퇴장 모션은 아예 없어서, 이 데모의 서명 장면이
   * 「멈춰 세웠다」가 아니라 「화면이 깜빡했다」로 읽혔습니다(모션 감사 2).
   * reduced-motion에서는 전역 규칙이 즉시 정지시킵니다(§6).
   */
  const { entered, leave } = useOverlayTransition(onRetry);

  const doc = useSourceDoc(feedback.docId);
  /** 검수 문구는 그대로 두고, 조문 문장만 아래 접힘으로 내립니다. */
  const { lead, law } = splitLawSentences(feedback.message);

  /** Esc — 대안을 고르지 않고 같은 장면으로 (퇴장 모션을 태운 뒤 닫힙니다). */
  const dismiss = useCallback(() => leave(), [leave]);

  // 마운트 초점(스크롤 없이) · Esc = 다시 해보기 · Tab 가두기 · 배경 스크롤 잠금.
  // 네 가지는 종료 확인 모달과 규칙 엔진 시연 시트도 같은 훅으로 씁니다.
  useModalDismiss({ panelRef, initialFocusRef: retryRef, onDismiss: dismiss });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cf-title"
      ref={panelRef}
    >
      {/* 딤 — 시트와 **같은 240ms**로 함께 들어오고 함께 나갑니다(레이어마다 속도가 다르면 하드컷 플래시로 읽힙니다).
          강도는 0.5입니다(옛 0.32). 0.32에서는 뒤 대화가 그대로 읽혀서, 시트가 「위에 뜬 카드」로
          보이고 훈련은 계속 흐르는 것처럼 읽혔습니다 — 이 시트는 흐름을 **멈춘** 자리이므로
          뒤 화면이 확실히 물러나야 합니다(세션 배경도 같은 순간 .25로 내려앉습니다).
          종료 확인 모달의 딤(ink/55)과도 이제 한 문법입니다. */}
      <div
        aria-hidden
        className={cx(
          "absolute inset-0 bg-[rgba(25,31,30,0.5)] transition-opacity duration-[240ms] ease-out",
          entered ? "opacity-100" : "opacity-0",
        )}
      />
      {/* 시트는 진짜로 떠 있는 것이라 그림자만 쓰고 테두리는 두르지 않습니다(가이드 §3).
          **탈출구는 언제나 화면 안에 있어야 합니다** — 내용만 스크롤하고 주 CTA는 바닥에 붙여 둡니다
          (360×640에서 CTA가 뷰포트 밖으로 밀려나던 문제 — 평가 UX m5). */}
      <div
        className={cx(
          // 딤이 absolute라 시트도 자리를 잡아 둡니다(그래야 DOM 순서대로 딤 위에 섭니다).
          "relative flex max-h-[88dvh] w-full max-w-[430px] flex-col rounded-t-[22px] bg-white",
          "shadow-[0_-10px_40px_rgba(25,31,30,0.25)]",
          "transition-transform duration-[240ms] ease-out",
          entered ? "translate-y-0" : "translate-y-full",
        )}
      >
        {/* 그래버 — 22px 띠 하나. 「여기는 스크롤됩니다」를 형태로만 말합니다. */}
        <div aria-hidden className="flex h-[22px] flex-none items-center justify-center">
          <span className="block h-[4px] w-[36px] rounded-full bg-line-strong" />
        </div>

        {/* 시트 안 스크롤은 시트 안에서 끝냅니다 — 끝에 닿았다고 뒤 페이지로 넘어가면
            「멈춰 세웠다」는 상태가 손끝에서 부정됩니다(모션 감사 3). */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-3">
          <div className="flex items-center gap-2">
            {/* 붉은 점 하나가 시트와 **같은 240ms** 동안 제 크기로 벌어집니다 —
                「멈춤」을 말로 적기 전에 형태로 한 번 말하는 자리입니다. 새 속도를 만들지 않으려고
                시트·딤과 같은 값을 쓰고, 움직이는 것은 크기 하나뿐입니다(색·위치는 그대로).
                reduced-motion에서는 전역 규칙이 전이를 끊어 처음부터 제 크기로 서 있습니다. */}
            <span
              aria-hidden
              className={cx(
                "h-[10px] w-[10px] flex-none rounded-full bg-danger",
                "transition-transform duration-[240ms] ease-out",
                entered ? "scale-100" : "scale-50",
              )}
            />
            <h2
              id="cf-title"
              className="text-[1.1875rem] leading-[1.3] font-extrabold tracking-[-0.01em] text-ink"
            >
              잠깐, 여기서 멈춥니다
            </h2>
          </div>

          {/* 왜 멈췄는지는 코어 콘텐츠입니다.
              조문을 인용한 문장은 아래 「법 근거 보기」 접힘으로 내립니다 — 문구는 검수된
              고정 문장이라 한 글자도 고치지 않고 자리만 옮깁니다(엔딩의 「다시 볼 장면」과 같은 규칙).
              얼어붙은 그 순간에 두 번째 줄로 읽히는 것이 「법 위반」이면, 다음 말이 나오지 않습니다
              (평가 초보 m5). */}
          <p className="mt-2 text-[0.9375rem] leading-[1.6] text-ink-soft">{lead}</p>

          {alternatives.length > 0 && (
            <>
              <h3 className="mt-3.5 mb-[8px] text-[0.7813rem] leading-[1.45] font-bold text-ink-muted">
                대신 이렇게 말해볼 수 있어요
              </h3>
              <ul className="flex flex-col gap-[8px]">
                {alternatives.map((alternative) => (
                  <li key={alternative}>
                    {/* 고르시면 그 대안을 로그에 적어 두고 같은 장면으로 돌아갑니다(전송은 하지 않습니다).
                        라벨은 제안 버튼과 같은 17px입니다 — 골라서 눌러야 하는 문장입니다(가이드 §4.6). */}
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
              {/* 고르신 문장은 같은 장면으로 돌아간 뒤 보기 맨 위에 다시 섭니다 —
                  버튼만으로도 끝까지 가실 수 있어야 하므로 안내도 그 사실대로 적습니다. */}
              <p className="mt-1.5 text-[0.7813rem] leading-[1.6] text-ink-muted">
                고르시면 대화 기록에 남기고 같은 장면으로 돌아갑니다. 고르신 문장은 보기 맨 위에 다시
                놓아 드리니, 말씀하셔도 되고 그 버튼을 누르셔도 됩니다.
              </p>
            </>
          )}

          {/* 판정 주체는 접지 않습니다 — 「생성이 아니라 규칙」은 이 시트의 안전 증거라(가이드 §4.6,
              보안성 심사 대응) 한 번의 탭 뒤로 보내지 않습니다. 겁을 주는 것은 조문이지 판정 주체가
              아니므로, 조문 전문·문서 상세만 접습니다. */}
          <p className="mt-3.5 text-[0.8438rem] leading-[1.6] font-semibold text-ink">
            {cfVerdictSourceLine(feedback)}
          </p>
          <details className="group mt-1">
            <summary className="flex min-h-[48px] cursor-pointer list-none items-center gap-1.5 rounded-field text-[0.8438rem] font-semibold text-ink-muted transition-colors duration-150 active:bg-paper-2 [&::-webkit-details-marker]:hidden">
              <span className="underline decoration-1 underline-offset-[3px]">법 근거 보기</span>
              {/* 동봉 폰트에 `⌄`(U+2304)가 없어 OS 심볼 폰트로 떨어집니다 — SVG 대체 글리프를 씁니다. */}
              <ChevronGlyph size="sm" className="text-ink-ghost group-open:rotate-180" />
            </summary>
            {law.length > 0 && (
              <p className="text-[0.9375rem] leading-[1.6] text-ink-soft">{law}</p>
            )}
            {/* 문서·규칙 상세 — 판정 주체 줄은 위에 상시 노출돼 있으므로 여기서는 반복하지 않습니다. */}
            <div className="mt-2 rounded-field bg-paper-2 px-[13px] py-[12px] text-[0.8438rem] leading-[1.6] text-ink-soft">
              {doc && <b className="font-bold text-ink">{doc.title}</b>}
              {doc && feedback.trace?.ruleLabel && " — "}
              {feedback.trace?.ruleLabel}
            </div>
          </details>
        </div>

        {/* 주 CTA — 내용이 아무리 길어도 여기 남습니다.
            경계는 헤어라인 한 줄로만 긋습니다(가이드 §7-4 그라데이션 0건). */}
        <div className="flex-none border-t border-line px-5 pt-3 pb-[calc(28px_+_var(--chim-safe-b))]">
          <button
            type="button"
            ref={retryRef}
            onClick={() => leave()}
            className="min-h-[54px] w-full rounded-[14px] bg-brand-700 px-5 text-[1rem] font-bold text-white transition-colors duration-150 hover:bg-brand-800 active:bg-brand-900"
          >
            같은 장면에서 다시 해보기 — 벌점 없음
          </button>

          {/* 이 시트가 입력 도크의 고지를 덮으므로, 고지 문구를 여기에도 그대로 둡니다 (안전 규칙 §3-2). */}
          <InlineDisclaimer tone="readable" className="mt-3" />
        </div>
      </div>
    </div>
  );
}

export default CriticalInterrupt;
