"use client";

import { useCallback, useEffect, useState } from "react";
import { isSilentStep } from "@/data/protocols";
import { speak, stopSpeaking } from "@/lib/speech";
import type { ProtocolStep } from "@/types";

/**
 * 응급 프로토콜 재생 로직 (단독 화면 `/emergency/[id]` 과 훈련 세션 안 L3 구간 공용).
 *
 * 두 화면이 같은 P-02를 서로 다르게 재생하면 안 됩니다. 특히 **낭독이 끝나기 전에 다음 단계로
 * 넘어가면 안내 문장이 중간에 잘립니다** — `speak()` 는 진입할 때 이전 발화를 취소하기 때문입니다.
 * 그래서 여기서는 글자 수 타이머 하나에 맡기지 않고,
 * `Promise.all([최소 체류 시간, 낭독 완료])` 가 모두 끝난 뒤에야 다음 단계로 넘어갑니다.
 *
 * - 음성을 끄거나 쓸 수 없는 기기에서도 자막이 같은 속도로 자동 진행됩니다.
 * - 침묵 단계(voice 가 빈 문자열)에 닿으면 소리를 내지 않고 자동 진행을 멈춥니다.
 * - 화면을 벗어나거나 단계를 손으로 옮기면 남은 음성을 정리합니다.
 */

/** 자막이 너무 빨리 넘어가지 않도록 한 단계 최소 체류 시간을 계산합니다. */
export function dwellMsFor(text: string): number {
  return Math.max(2600, Math.min(12000, text.length * 150));
}

/** 단계 사이의 짧은 숨 고르기 간격입니다. */
export const GAP_MS = 700;

export interface UseProtocolPlaybackOptions {
  steps: ProtocolStep[];
  /** 음성 낭독 여부 — 꺼도 자막은 같은 속도로 진행합니다 */
  voiceOn: boolean;
  /** 재생을 시작해도 되는 시점인지 (훈련 세션은 사용자가 시작 버튼을 누른 뒤부터) */
  enabled?: boolean;
}

export interface ProtocolPlayback {
  index: number;
  step: ProtocolStep | undefined;
  total: number;
  /** 침묵 단계 여부 — 음성을 내지 않고 화면만 유지합니다 */
  silent: boolean;
  isFirst: boolean;
  isLast: boolean;
  playing: boolean;
  goPrev: () => void;
  goNext: () => void;
  goTo: (next: number) => void;
  togglePlaying: () => void;
  /** 이 단계를 한 번 더 읽어 드립니다 */
  replay: () => void;
  restart: () => void;
}

export function useProtocolPlayback({
  steps,
  voiceOn,
  enabled = true,
}: UseProtocolPlaybackOptions): ProtocolPlayback {
  const total = steps.length;
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);

  const step = steps[index];
  const silent = step ? isSilentStep(step) : true;

  // 자동 진행: 낭독과 최소 체류 시간이 **둘 다** 끝나야 다음 단계로 넘어갑니다.
  useEffect(() => {
    if (!enabled || !playing) return;
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
  }, [enabled, playing, index, voiceOn, steps]);

  // 화면을 떠날 때 남은 음성을 정리합니다.
  useEffect(() => stopSpeaking, []);

  const goTo = useCallback(
    (next: number): void => {
      stopSpeaking();
      setIndex(Math.min(steps.length - 1, Math.max(0, next)));
    },
    [steps.length],
  );

  const goPrev = useCallback((): void => {
    stopSpeaking();
    setIndex((value) => Math.max(0, value - 1));
  }, []);

  const goNext = useCallback((): void => {
    stopSpeaking();
    setIndex((value) => Math.min(steps.length - 1, value + 1));
  }, [steps.length]);

  const togglePlaying = useCallback((): void => {
    stopSpeaking();
    setPlaying((value) => !value);
  }, []);

  const replay = useCallback((): void => {
    const current = steps[index];
    const text = current ? current.voice.trim() : "";
    if (text.length === 0) return;
    stopSpeaking();
    void speak(text);
  }, [steps, index]);

  const restart = useCallback((): void => {
    stopSpeaking();
    setIndex(0);
    setPlaying(true);
  }, []);

  return {
    index,
    step,
    total,
    silent,
    isFirst: index === 0,
    isLast: index >= total - 1,
    playing,
    goPrev,
    goNext,
    goTo,
    togglePlaying,
    replay,
    restart,
  };
}
