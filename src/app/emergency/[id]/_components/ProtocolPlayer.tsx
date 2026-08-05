"use client";

import { useEffect, useState } from "react";
import type { ProtocolStep } from "@/types";
import { EyebrowLabel, cx } from "@/components";
import { isSpeechSynthesisSupported, primeVoices, stopSpeaking } from "@/lib/speech";
import { Call119Bar } from "../../_components/Call119Bar";
import { ProtocolAddressCard } from "../../_components/ProtocolAddressCard";
import { useProtocolPlayback } from "../../_components/useProtocolPlayback";

export interface ProtocolPlayerProps {
  protocolId: string;
  title: string;
  steps: ProtocolStep[];
}

/* 컨트롤은 아이콘 없이 **텍스트 + 면 버튼**입니다(v4 §3 응급).
   면은 surface `#f5f6f6`, 라운드 14px, 터치 영역 52px — 손이 바쁜 상황에서 눌리는 크기입니다. */
const CONTROL =
  "flex min-h-[52px] items-center justify-center rounded-[14px] px-3 text-[16px] font-bold " +
  "transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45";
const CONTROL_SURFACE = `${CONTROL} bg-paper-2 text-ink active:bg-line-strong`;
/** 지금 누를 버튼 하나만 옅은 틸 면으로 구분합니다(채움 CTA는 119 버튼 몫입니다). */
const CONTROL_PRIMARY = `${CONTROL} bg-tint text-deep active:bg-brand-200`;
/** 부수 조작 — 텍스트만. 48px 터치는 지킵니다. */
const CONTROL_QUIET =
  "flex min-h-[48px] items-center justify-center rounded-[12px] px-3 text-[13px] font-semibold " +
  "text-ink-muted transition-colors duration-150 active:bg-paper-2 disabled:cursor-not-allowed disabled:opacity-45";

/**
 * 응급 프로토콜 단계별 재생기.
 *
 * - 검수된 고정 문구를 **음성 + 대형 자막**으로 순서대로 재생합니다(자막 없는 음성은 만들지 않습니다).
 * - 한 단계를 다 읽으면 자동으로 다음 단계로 넘어갑니다. 일시정지·이전·다음은 언제든 수동 조작할 수 있습니다.
 * - 음성 합성을 쓸 수 없는 기기에서도 자막이 같은 속도로 자동 진행되어 안내가 끊기지 않습니다.
 * - 마지막 침묵 단계에서는 소리를 내지 않고 화면만 유지합니다.
 *
 * 이 화면에서는 생성 호출이 한 건도 일어나지 않습니다. 데이터에 적힌 문구를 그대로 읽을 뿐입니다.
 *
 * 진행 규칙은 훈련 세션 안의 L3 구간과 **같은 훅**(`useProtocolPlayback`)에서 옵니다 — v4 재단장에서도
 * 로직은 한 줄도 바꾸지 않았고, 진행 표시만 세션과 같은 세그먼트 막대로 맞췄습니다.
 */
export function ProtocolPlayer({ protocolId, title, steps }: ProtocolPlayerProps) {
  const [voiceOn, setVoiceOn] = useState(true);
  const [ttsSupported, setTtsSupported] = useState(true);

  const playback = useProtocolPlayback({ steps, voiceOn });
  const { index, step, total, silent, playing, goTo, togglePlaying, replay, restart } = playback;
  const voiceText = step ? step.voice.trim() : "";

  useEffect(() => {
    primeVoices();
    setTtsSupported(isSpeechSynthesisSupported());
  }, []);

  const emphasize = Boolean(step?.emphasize119);

  return (
    <div>
      {/* 세그먼트 진행 — 3px 막대 N칸. 세션의 진행바와 같은 언어입니다. */}
      <div
        className="flex gap-[3px]"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={index + 1}
        aria-valuetext={`전체 ${total}단계 중 ${index + 1}단계`}
      >
        {steps.map((s, i) => (
          <span
            key={s.id}
            aria-hidden
            className={cx(
              "h-[3px] flex-1 rounded-full transition-colors duration-300",
              i <= index ? "bg-brand-600" : "bg-line",
            )}
          />
        ))}
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-3">
        <p className="chim-num text-[12.5px] font-bold text-ink">
          {index + 1} / {total}단계
        </p>
        <p className="text-[12.5px] text-ink-muted">
          {playing ? "자동으로 다음 단계로 넘어갑니다" : "일시정지 상태입니다"}
        </p>
      </div>

      {/* 대형 자막 — 이 화면 전체에서 가장 큰 글자입니다(코어 중의 코어). */}
      <section
        className={cx("mt-3 rounded-[14px] px-5 py-6", emphasize ? "bg-danger-soft" : "bg-paper-2")}
      >
        <p className="chim-num text-[11.5px] font-bold tracking-[0.06em] text-ink-muted">
          {step ? step.id : protocolId}
          {silent && " · 의도된 침묵"}
        </p>

        <p
          aria-live="polite"
          className="mt-2 text-[28px] leading-[1.32] font-extrabold tracking-[-0.02em] text-ink"
        >
          {silent ? "안내 음성을 여기서 멈춥니다." : voiceText}
        </p>

        {silent && (
          <p className="mt-3 text-[16px] leading-[1.6] text-ink-soft">
            지금부터는 119 상황실 지시에 따르세요. 화면은 이대로 두셔도 됩니다.
          </p>
        )}

        {step?.screen && (
          <p className="mt-4 border-t border-line-strong pt-4 text-[15px] leading-[1.65] text-ink-soft">
            {step.screen}
          </p>
        )}

        {step?.address && <ProtocolAddressCard address={step.address} />}

        {/* 1단계 119 확대 — 깜빡임·아이콘 없이 버튼 크기로만 말합니다. */}
        {emphasize && (
          <>
            <p className="mt-5 text-center text-[15px] font-bold text-danger-ink">
              먼저 119부터 누르세요
            </p>
            <Call119Bar size="lg" className="mt-2" />
          </>
        )}
      </section>

      {/* 조작 — 텍스트·면 버튼만 둡니다. */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
          className={CONTROL_SURFACE}
        >
          이전
        </button>
        <button type="button" onClick={togglePlaying} className={CONTROL_PRIMARY}>
          {playing ? "일시정지" : "재생"}
        </button>
        <button
          type="button"
          onClick={() => goTo(index + 1)}
          disabled={index === total - 1}
          className={CONTROL_SURFACE}
        >
          다음
        </button>
      </div>

      <button
        type="button"
        onClick={replay}
        disabled={silent || !ttsSupported || !voiceOn}
        className={cx(CONTROL_SURFACE, "mt-2 w-full")}
      >
        이 단계 다시 듣기
      </button>

      <div className="mt-1 flex justify-center gap-1">
        <button
          type="button"
          onClick={() => {
            stopSpeaking();
            setVoiceOn((prev) => !prev);
          }}
          disabled={!ttsSupported}
          className={CONTROL_QUIET}
        >
          {voiceOn ? "음성 끄기(자막만)" : "음성 켜기"}
        </button>
        <button type="button" onClick={restart} className={CONTROL_QUIET}>
          처음부터 다시
        </button>
      </div>

      {!ttsSupported && (
        <p className="mt-2 rounded-[14px] bg-warn-soft px-4 py-3 text-[14px] leading-[1.6] font-semibold text-warn-ink">
          이 기기에서는 음성 안내를 사용할 수 없습니다. 자막이 같은 속도로 자동 진행되니 화면을 보고
          따라 주세요.
        </p>
      )}

      {/* 전체 단계 — 위계가 낮은 목록이라 카드 없이 선으로만 나눕니다. */}
      <section aria-labelledby="steps-heading" className="mt-8">
        <EyebrowLabel id="steps-heading">전체 단계 · {title}</EyebrowLabel>
        <div className="chim-rows mt-1">
          {steps.map((s, i) => {
            const current = i === index;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => goTo(i)}
                aria-current={current ? "step" : undefined}
                className="flex min-h-[48px] w-full items-center gap-3 border-b border-line px-[2px] py-3 text-left transition-colors duration-150 active:bg-paper-2"
              >
                <span
                  aria-hidden
                  className={cx(
                    "chim-num flex h-7 w-7 flex-none items-center justify-center rounded-[9px] text-[12.5px] font-extrabold",
                    current ? "bg-brand-700 text-white" : "bg-paper-2 text-ink-muted",
                  )}
                >
                  {i + 1}
                </span>
                <span
                  className={cx(
                    "min-w-0 flex-1 text-[14.5px] leading-[1.55]",
                    current ? "font-bold text-ink" : "text-ink-soft",
                  )}
                >
                  {s.voice.trim().length > 0 ? s.voice : "(음성 없음 — 의도된 침묵 단계)"}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default ProtocolPlayer;
