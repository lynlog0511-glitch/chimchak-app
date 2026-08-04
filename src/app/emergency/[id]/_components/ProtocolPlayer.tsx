"use client";

import { useEffect, useState } from "react";
import type { ProtocolStep } from "@/types";
import { Badge, BigButton, Call119Button, Card } from "@/components";
import { IconNext, IconPause, IconPlay, IconPrev } from "@/components/icons";
import { isSpeechSynthesisSupported, primeVoices, stopSpeaking } from "@/lib/speech";
import { ProtocolAddressCard } from "../../_components/ProtocolAddressCard";
import { useProtocolPlayback } from "../../_components/useProtocolPlayback";

export interface ProtocolPlayerProps {
  protocolId: string;
  title: string;
  steps: ProtocolStep[];
}

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
 * 진행 규칙은 훈련 세션 안의 L3 구간과 **같은 훅**(`useProtocolPlayback`)에서 옵니다.
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

  const progress = total > 0 ? Math.round(((index + 1) / total) * 100) : 0;
  const emphasize = Boolean(step?.emphasize119);

  return (
    <div className="space-y-6">
      {/* 진행바 */}
      <div>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-base font-extrabold text-ink">
            전체 {total}단계 중 <span className="text-brand-800">{index + 1}단계</span>
          </p>
          <p className="text-sm font-semibold text-ink-muted">
            {playing ? "자동으로 다음 단계로 넘어갑니다" : "일시정지 상태입니다"}
          </p>
        </div>
        <div
          className="h-3.5 w-full overflow-hidden rounded-chip bg-line"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={index + 1}
          aria-valuetext={`전체 ${total}단계 중 ${index + 1}단계`}
        >
          <span
            aria-hidden="true"
            className="block h-full rounded-chip bg-brand-600 transition-[width] duration-500 ease-soft"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 1단계 119 확대 연출 */}
      {emphasize && (
        <Card tone="danger">
          <div className="flex items-center justify-center gap-2">
            {/* 장식성 깜빡임은 쓰지 않습니다 — 크기와 색만으로 우선순위를 말합니다. */}
            <span aria-hidden="true" className="inline-block h-3 w-3 rounded-chip bg-danger" />
            <p className="text-lg font-extrabold text-danger-ink md:text-xl">
              먼저 119부터 누르세요
            </p>
          </div>
          <div className="mt-4">
            <Call119Button size="xl" />
          </div>
        </Card>
      )}

      {/* 대형 자막 */}
      <Card tone={silent ? "quiet" : "default"}>
        {/* 필은 단계 번호 하나만 — 진행 수치와 침묵 표시는 작은 텍스트로 둡니다. */}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <Badge tone="brand">{step ? step.id : protocolId}</Badge>
          <span className="chim-num border-l border-line pl-2.5 text-sm font-bold text-ink-soft">
            {index + 1} / {total}
          </span>
          {silent && (
            <span className="border-l border-line pl-2.5 text-sm font-bold text-ink-soft">
              의도된 침묵
            </span>
          )}
        </div>

        <p
          aria-live="polite"
          className="mt-4 text-2xl leading-snug font-extrabold text-ink md:text-4xl"
        >
          {silent ? "안내 음성을 여기서 멈춥니다." : voiceText}
        </p>

        {silent && (
          <p className="mt-3 text-base leading-relaxed text-ink-soft md:text-lg">
            지금부터는 119 상황실 지시에 따르세요. 화면은 이대로 두셔도 됩니다.
          </p>
        )}

        {step?.screen && (
          <p className="mt-5 border-t border-line pt-4 text-base leading-relaxed text-ink-soft">
            {step.screen}
          </p>
        )}

        {step?.address && <ProtocolAddressCard address={step.address} />}
      </Card>

      {/* 조작 */}
      <div>
        {/* 좁은 화면에서는 재생 버튼을 한 줄 전체로 두어 글자가 접히지 않게 합니다. */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
          <BigButton
            onClick={togglePlaying}
            variant="primary"
            size="lg"
            block
            className="order-1 col-span-2 whitespace-nowrap sm:order-2 sm:col-span-1"
          >
            {playing ? (
              <>
                <IconPause className="h-5 w-5" /> 일시정지
              </>
            ) : (
              <>
                <IconPlay className="h-5 w-5" /> 재생
              </>
            )}
          </BigButton>
          <BigButton
            onClick={() => goTo(index - 1)}
            variant="secondary"
            size="lg"
            disabled={index === 0}
            block
            className="order-2 whitespace-nowrap sm:order-1"
          >
            <IconPrev className="h-5 w-5" /> 이전
          </BigButton>
          <BigButton
            onClick={() => goTo(index + 1)}
            variant="secondary"
            size="lg"
            disabled={index === total - 1}
            block
            className="order-3 whitespace-nowrap"
          >
            다음 <IconNext className="h-5 w-5" />
          </BigButton>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <BigButton onClick={replay} variant="ghost" disabled={silent || !ttsSupported || !voiceOn}>
            이 단계 다시 듣기
          </BigButton>
          <BigButton
            onClick={() => {
              stopSpeaking();
              setVoiceOn((prev) => !prev);
            }}
            variant="ghost"
            disabled={!ttsSupported}
          >
            {voiceOn ? "음성 끄기(자막만)" : "음성 켜기"}
          </BigButton>
          <BigButton onClick={restart} variant="ghost">
            처음부터 다시
          </BigButton>
        </div>

        {!ttsSupported && (
          <p className="mt-3 rounded-card border border-warn-line bg-warn-soft px-4 py-3 text-base leading-relaxed font-semibold text-warn-ink">
            이 기기에서는 음성 안내를 사용할 수 없습니다. 자막이 같은 속도로 자동 진행되니 화면을
            보고 따라 주세요.
          </p>
        )}
      </div>

      {/* 전체 단계 목록 */}
      <section aria-labelledby="steps-heading">
        <h2 id="steps-heading" className="mb-3 text-lg font-extrabold text-ink md:text-xl">
          전체 단계 — {title}
        </h2>
        <ol className="space-y-2">
          {steps.map((s, i) => {
            const current = i === index;
            const done = i < index;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => goTo(i)}
                  aria-current={current ? "step" : undefined}
                  className={[
                    "flex w-full min-h-[48px] items-start gap-3 rounded-card border px-4 py-3 text-left transition-colors duration-150",
                    // 아직 지나지 않은 단계는 opacity 대신 배경색으로만 약하게 표시합니다.
                    // (불투명도를 걸면 본문 대비가 WCAG AA 4.5:1 아래로 떨어집니다.)
                    current
                      ? "border-brand-600 bg-brand-50"
                      : done
                        ? "border-line bg-white"
                        : "border-line bg-paper-2 hover:bg-white",
                  ].join(" ")}
                >
                  <span
                    aria-hidden="true"
                    className={[
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-chip text-base font-extrabold",
                      current ? "bg-brand-600 text-white" : "bg-neutral-soft text-ink-soft",
                    ].join(" ")}
                  >
                    {i + 1}
                  </span>
                  <span
                    className={[
                      "text-base leading-relaxed",
                      current ? "font-extrabold text-ink" : "text-ink-soft",
                    ].join(" ")}
                  >
                    {s.voice.trim().length > 0 ? s.voice : "(음성 없음 — 의도된 침묵 단계)"}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

export default ProtocolPlayer;
