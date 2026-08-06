"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ProtocolStep } from "@/types";
import { EyebrowLabel, cx } from "@/components";
import { isSpeechPlaybackSupported, primeVoices, stopSpeaking } from "@/lib/speech";
import { Call119Bar } from "../../_components/Call119Bar";
import {
  CONTROL_OUTLINE,
  CONTROL_PRIMARY,
  CONTROL_QUIET,
  ProtocolFootnote,
  ProtocolReadingLine,
  ProtocolSegments,
  nextStepPreview,
  type ReadingState,
} from "../../_components/PlayerParts";
import { ProtocolAddressCard } from "../../_components/ProtocolAddressCard";
import { useAutoplayGuard, useProtocolPlayback } from "../../_components/useProtocolPlayback";

export interface ProtocolPlayerProps {
  title: string;
  steps: ProtocolStep[];
  /** 「‹ 안내 종료」가 돌아갈 곳 */
  backHref: string;
}

/**
 * 응급 프로토콜 단계별 재생기 (시안 6d · 가이드 §4.8).
 *
 * - 검수된 고정 문구를 **음성 + 대형 자막**으로 순서대로 재생합니다(자막 없는 음성은 만들지 않습니다).
 * - 한 단계를 다 읽으면 자동으로 다음 단계로 넘어갑니다. 잠시 멈춤·이전·다음은 언제든 수동 조작할 수 있습니다.
 * - 음성 합성을 쓸 수 없는 기기에서도 자막이 같은 속도로 자동 진행되어 안내가 끊기지 않습니다.
 * - 마지막 침묵 단계에서는 소리를 내지 않고 화면만 유지합니다.
 *
 * 화면의 주인은 자막입니다 — 그래서 제목을 13px 한 줄로 낮추고, 상단에는 **119 버튼·진행바만** 남깁니다.
 * 119 버튼은 스크롤과 무관하게 자리를 지킵니다(안전 규칙 §3-5 상시 노출).
 *
 * 이 화면에서는 생성 호출이 한 건도 일어나지 않습니다. 데이터에 적힌 문구를 그대로 읽을 뿐입니다.
 * 진행 규칙은 훈련 세션 안의 L3 구간과 **같은 훅**(`useProtocolPlayback`)에서 옵니다.
 */
export function ProtocolPlayer({ title, steps, backHref }: ProtocolPlayerProps) {
  const [voiceOn, setVoiceOn] = useState(true);
  const [ttsSupported, setTtsSupported] = useState(true);
  /** 자동재생 정책은 훈련 세션 안 L3 구간과 **같은 가드**에서 옵니다. */
  const { soundBlocked, unblock } = useAutoplayGuard();

  /* 차단된 동안에는 낭독을 시도하지 않습니다 — 소리를 내지 못하는 낭독을 기다리다
     자막 진행까지 멈추면 안내 자체가 죽습니다. 자막은 같은 속도로 계속 넘어갑니다. */
  const voiceActive = voiceOn && !soundBlocked;
  const playback = useProtocolPlayback({ steps, voiceOn: voiceActive });
  const { index, step, total, silent, playing, goTo, togglePlaying, replay, restart } = playback;
  const voiceText = step ? step.voice.trim() : "";
  const preview = nextStepPreview(steps, index);

  useEffect(() => {
    primeVoices();
    setTtsSupported(isSpeechPlaybackSupported());
  }, []);

  /* 상태줄은 지금 실제로 일어나는 일만 말합니다 — 소리가 없는데 「읽어 주는 중」이라고 하지 않습니다. */
  const readingState: ReadingState = silent
    ? "done"
    : !playing
      ? "paused"
      : voiceActive && ttsSupported
        ? "reading"
        : "caption";

  /** 소리를 켤 수 있는데 자동으로 시작하지 못한 상태 — 한 번 누르면 그 자리에서 소리가 납니다. */
  const needsTapToStart = soundBlocked && ttsSupported && voiceOn && !silent;

  return (
    <div>
      {/* 상단 — 「‹ 안내 종료」 + 「{프로토콜명} · N / M」 + danger 진행바 + 119 버튼.
          스크롤해도 이 덩어리는 화면에 남습니다. */}
      <div className="sticky top-0 z-30 -mx-[20px] bg-paper px-[20px] pt-[2px] pb-3">
        <div className="flex items-center gap-3">
          <Link
            href={backHref}
            className="-ml-2 flex min-h-[48px] items-center gap-[4px] px-2 text-[0.8438rem] font-semibold text-ink-muted transition-colors duration-150 active:text-ink"
          >
            <span aria-hidden className="text-[1.1875rem] leading-none">
              ‹
            </span>
            안내 종료
          </Link>
          {/* 제목이 길어도 「N / M」은 잘리지 않습니다 — 잘리는 쪽은 언제나 제목입니다. */}
          <p className="ml-auto flex min-w-0 items-baseline gap-[4px] text-[0.8438rem] leading-[1.45] font-bold text-ink-soft">
            <span className="min-w-0 truncate">{title}</span>
            <span className="chim-num flex-none">
              · {index + 1} / {total}
            </span>
          </p>
        </div>

        <ProtocolSegments steps={steps} index={index} />

        {/* 119 버튼은 단계와 무관하게 같은 크기(58px)로 늘 같은 자리에 있습니다.
            데이터의 `emphasize119`가 가리키는 1단계에서는 자막 자체가 「지금 119를 누르세요」라
            버튼을 키워 상단 높이를 흔들 이유가 없습니다 — 강조는 29px 자막이 이미 하고 있습니다. */}
        <Call119Bar className="mt-3" />
      </div>

      {/* 본문 — 이 화면 전체에서 가장 큰 글자는 자막 하나뿐입니다. */}
      <div className="pt-4 pb-6">
        <ProtocolReadingLine state={readingState} />

        {/* 바로가기로 곧바로 열면 제스처가 없어 소리가 막힙니다. 그 사실을 적고, 한 번 누를 자리를 둡니다.
            누르는 순간 낭독이 다시 켜지므로(voiceActive) 이 자리에서 소리가 시작됩니다. */}
        {needsTapToStart && (
          <div className="mt-2">
            <button
              type="button"
              onClick={unblock}
              className="flex min-h-[52px] w-full items-center justify-center rounded-[14px] border border-line-strong bg-paper px-3 text-[0.9375rem] font-bold text-ink transition-colors duration-150 active:bg-paper-2"
            >
              눌러서 소리 시작
            </button>
            <p className="mt-[6px] text-[0.8438rem] leading-[1.6] text-ink-soft">
              이 기기가 소리를 자동으로 시작하지 못했습니다. 누르지 않으셔도 자막은 같은 속도로
              계속 넘어갑니다.
            </p>
          </div>
        )}

        <p
          aria-live="polite"
          className="mt-3 text-[1.8125rem] leading-[1.45] font-extrabold tracking-[-0.015em] text-ink md:text-[2.5rem]"
        >
          {silent ? "안내 음성을 여기서 멈춥니다." : voiceText}
        </p>

        {/* 화면 보조 문구 — 데이터의 `screen`은 사용자가 그대로 읽는 문장입니다(레이아웃 지시문 아님). */}
        {step?.screen && (
          <p className="mt-3 text-[0.9375rem] leading-[1.6] text-ink-soft">{step.screen}</p>
        )}

        {step?.address && <ProtocolAddressCard address={step.address} className="mt-4" />}

        {preview && (
          <p className="mt-4 text-[0.8438rem] leading-[1.6] text-tertiary">다음 — {preview}</p>
        )}
      </div>

      {/* 컨트롤 — 아웃라인 둘 + 틸 채움 하나. 지금 누를 것 하나만 채움입니다. */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
          className={CONTROL_OUTLINE}
        >
          이전
        </button>
        <button type="button" onClick={togglePlaying} className={CONTROL_OUTLINE}>
          {playing ? "잠시 멈춤" : "이어서 듣기"}
        </button>
        <button
          type="button"
          onClick={() => goTo(index + 1)}
          disabled={index === total - 1}
          className={CONTROL_PRIMARY}
        >
          다음 단계
        </button>
      </div>

      <ProtocolFootnote className="mt-3" />

      {/* 아래는 재생을 방해하지 않는 보조 영역입니다 — 위계를 낮춰 선 하나로만 나눕니다. */}
      {!ttsSupported && (
        <p className="mt-5 rounded-[14px] bg-warn-soft px-4 py-3 text-[0.8438rem] leading-[1.6] font-semibold text-warn-ink">
          이 기기에서는 음성 안내를 사용할 수 없습니다. 자막이 같은 속도로 자동 진행되니 화면을 보고
          따라 주세요.
        </p>
      )}

      <div className="mt-5 flex gap-1 border-t border-line pt-2">
        <button
          type="button"
          onClick={replay}
          disabled={silent || !ttsSupported || !voiceOn}
          className={CONTROL_QUIET}
        >
          이 단계 다시 듣기
        </button>
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
                    "chim-num flex h-7 w-7 flex-none items-center justify-center rounded-[9px] text-[0.7813rem] font-extrabold",
                    /* 빨강은 119 버튼 하나로 족합니다 — 지금 단계 표시는 danger **면**으로만(5b 마커와 같은 언어). */
                    current ? "bg-danger-soft text-danger-ink" : "bg-paper-2 text-ink-muted",
                  )}
                >
                  {i + 1}
                </span>
                <span
                  className={cx(
                    "min-w-0 flex-1 text-[0.9375rem] leading-[1.6]",
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
