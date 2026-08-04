"use client";

import { useEffect, useState } from "react";
import type { ProtocolStep } from "@/types";
import { Badge, BigButton, Call119Button, Card } from "@/components";
import {
  isSpeechSynthesisSupported,
  primeVoices,
  speak,
  stopSpeaking,
} from "@/lib/speech";

export interface ProtocolPlayerProps {
  protocolId: string;
  title: string;
  steps: ProtocolStep[];
}

/** 자막이 너무 빨리 넘어가지 않도록 한 단계 최소 체류 시간을 계산합니다. */
function dwellMsFor(text: string): number {
  return Math.max(2600, Math.min(12000, text.length * 150));
}

/** 단계 사이의 짧은 숨 고르기 간격입니다. */
const GAP_MS = 700;

/**
 * 응급 프로토콜 단계별 재생기.
 *
 * - 검수된 고정 문구를 **음성 + 대형 자막**으로 순서대로 재생합니다(자막 없는 음성은 만들지 않습니다).
 * - 한 단계를 다 읽으면 자동으로 다음 단계로 넘어갑니다. 일시정지·이전·다음은 언제든 수동 조작할 수 있습니다.
 * - 음성 합성을 쓸 수 없는 기기에서도 자막이 같은 속도로 자동 진행되어 안내가 끊기지 않습니다.
 * - 마지막 침묵 단계에서는 소리를 내지 않고 화면만 유지합니다.
 *
 * 이 화면에서는 생성 호출이 한 건도 일어나지 않습니다. 데이터에 적힌 문구를 그대로 읽을 뿐입니다.
 */
export function ProtocolPlayer({ protocolId, title, steps }: ProtocolPlayerProps) {
  const total = steps.length;
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [voiceOn, setVoiceOn] = useState(true);
  const [ttsSupported, setTtsSupported] = useState(true);

  const step = steps[index];
  const voiceText = step ? step.voice.trim() : "";
  const silent = voiceText.length === 0;

  useEffect(() => {
    primeVoices();
    setTtsSupported(isSpeechSynthesisSupported());
  }, []);

  // 자동 진행: 낭독(또는 최소 체류 시간)이 끝나면 다음 단계로 넘어갑니다.
  useEffect(() => {
    if (!playing) return;
    const current = steps[index];
    if (!current) return;

    const text = current.voice.trim();
    let cancelled = false;
    const timers: number[] = [];

    const wait = (ms: number): Promise<void> =>
      new Promise<void>((resolve) => {
        timers.push(window.setTimeout(resolve, ms));
      });

    const run = async (): Promise<void> => {
      // 침묵 단계 — 재생을 멈추고 화면만 유지합니다.
      if (text.length === 0) {
        setPlaying(false);
        return;
      }

      const jobs: Array<Promise<unknown>> = [wait(dwellMsFor(text))];
      if (voiceOn) jobs.push(speak(text));
      await Promise.all(jobs);
      if (cancelled) return;

      await wait(GAP_MS);
      if (cancelled) return;

      if (index + 1 < steps.length) setIndex(index + 1);
      else setPlaying(false);
    };

    void run();

    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
      stopSpeaking();
    };
  }, [playing, index, voiceOn, steps]);

  // 화면을 떠날 때 남은 음성을 정리합니다.
  useEffect(() => stopSpeaking, []);

  const goTo = (next: number): void => {
    stopSpeaking();
    setIndex(Math.min(total - 1, Math.max(0, next)));
  };

  const togglePlay = (): void => {
    stopSpeaking();
    setPlaying((prev) => !prev);
  };

  const replay = (): void => {
    if (!step || silent) return;
    stopSpeaking();
    void speak(step.voice);
  };

  const restart = (): void => {
    stopSpeaking();
    setIndex(0);
    setPlaying(true);
  };

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
        <Card tone="danger" className="border-2 border-danger">
          <div className="flex items-center justify-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block h-3 w-3 animate-pulse rounded-chip bg-danger"
            />
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
      <Card
        tone={silent ? "quiet" : "default"}
        className={silent ? "" : "border-2 border-brand-200"}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="brand">{step ? step.id : protocolId}</Badge>
          <Badge tone="neutral">
            {index + 1} / {total}
          </Badge>
          {silent && <Badge tone="neutral">의도된 침묵</Badge>}
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
          <p className="mt-5 border-t border-line pt-4 text-base leading-relaxed text-ink-muted">
            <span className="font-bold text-ink-soft">화면 안내</span> · {step.screen}
          </p>
        )}
      </Card>

      {/* 조작 */}
      <div>
        {/* 좁은 화면에서는 재생 버튼을 한 줄 전체로 두어 글자가 접히지 않게 합니다. */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
          <BigButton
            onClick={togglePlay}
            variant="primary"
            size="lg"
            block
            className="order-1 col-span-2 whitespace-nowrap sm:order-2 sm:col-span-1"
          >
            {playing ? (
              <>
                <span aria-hidden="true">⏸</span> 일시정지
              </>
            ) : (
              <>
                <span aria-hidden="true">▶</span> 재생
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
            <span aria-hidden="true">◀</span> 이전
          </BigButton>
          <BigButton
            onClick={() => goTo(index + 1)}
            variant="secondary"
            size="lg"
            disabled={index === total - 1}
            block
            className="order-3 whitespace-nowrap"
          >
            다음 <span aria-hidden="true">▶</span>
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
                    "flex w-full min-h-[48px] items-start gap-3 rounded-card border-2 px-4 py-3 text-left transition-colors duration-150",
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
