"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isSilentStep } from "@/data/protocols";
import { canPlayWithoutGesture, speak, stopSpeaking, unlockAudio } from "@/lib/speech";
import { useWakeLock } from "@/lib/wakeLock";
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
 *   자동재생이 막힌 기기(제스처 없이 연 PWA 바로가기 등)도 마찬가지입니다 —
 *   두 소비자가 같은 `useAutoplayGuard()`로 정책을 재고, 막혀 있으면 낭독을 아예 시도하지 않습니다.
 * - 침묵 단계(voice 가 빈 문자열)에 닿으면 소리를 내지 않고 자동 진행을 멈춥니다.
 * - 화면을 벗어나거나 단계를 손으로 옮기면 남은 음성을 정리합니다.
 */

/** 자막이 너무 빨리 넘어가지 않도록 한 단계 최소 체류 시간을 계산합니다. */
export function dwellMsFor(text: string): number {
  return Math.max(2600, Math.min(12000, text.length * 150));
}

/** 단계 사이의 짧은 숨 고르기 간격입니다. */
export const GAP_MS = 700;

/**
 * 낭독이 매듭지어지지 않아도 자막이 넘어가는 상한입니다.
 *
 * `speak()` 안에도 워치독이 있지만(어림 낭독 길이 또는 실제 길이 + 4초), 자막의 자동 진행은
 * **음성 경로가 어떻게 되든** 살아 있어야 하므로 호출부에도 상한을 하나 더 둡니다.
 *
 * 이 값은 speak()의 워치독보다 **넉넉해야** 합니다 — 여기가 먼저 풀리면 정상적으로 읽히는
 * 문장이 중간에 잘립니다. 그래서 문장이 길수록 함께 늘리고, 마지막 안전망으로만 씁니다.
 *
 * @example stallLimitMsFor("지금 119를 누르세요.") // 약 14초
 */
export function stallLimitMsFor(text: string): number {
  return dwellMsFor(text) + 6000 + text.length * 260;
}

export interface AutoplayGuard {
  /** 이 기기가 지금 자동으로 소리를 내지 못하는 상태인지(자동재생 차단) */
  soundBlocked: boolean;
  /** 사용자가 직접 눌러 소리를 시작하는 지점 — 그 탭 안에서 요소 잠금까지 풉니다 */
  unblock: () => void;
}

/**
 * 자동재생 정책 가드 — 단독 화면(`/emergency/[id]`)과 훈련 세션 안 L3 구간이 함께 씁니다.
 *
 * PWA 바로가기로 응급 화면을 곧바로 열거나, 세션 안에서 화면을 오래 두었다가 L3에 닿으면
 * 제스처가 없어 재생이 거부됩니다. 그때 「읽어 주는 중」이라고 적으면 소리가 안 나는데 난다고
 * 말하는 것이 되고, 낭독을 기다리다 자막 진행까지 볼모가 됩니다.
 *
 * 그래서 이 훅은 셋을 함께 합니다.
 *  1. 마운트 때 무음 WAV를 실제로 재생해 **지금의 정책**을 잽니다(재생과 같은 요소로 잽니다).
 *  2. 화면을 건드리는 첫 순간에 그 제스처 안에서 요소 잠금을 풉니다(웹킷은 요소 단위 해제).
 *  3. 차단 상태였다면 눌린 뒤 다시 재 보고, 되면 조용히 소리로 돌아옵니다.
 *
 * @example
 * const { soundBlocked, unblock } = useAutoplayGuard();
 * const voiceActive = voiceOn && !soundBlocked;
 */
export function useAutoplayGuard(): AutoplayGuard {
  const [soundBlocked, setSoundBlocked] = useState(false);

  useEffect(() => {
    let alive = true;
    void canPlayWithoutGesture().then((ok) => {
      if (alive) setSoundBlocked(!ok);
    });
    return () => {
      alive = false;
    };
  }, []);

  /* 첫 탭 잠금 해제 — 어느 버튼을 누르셨든 그 제스처 안에서 요소 하나를 풀어 둡니다.
     이미 풀렸으면 unlockAudio()가 즉시 물러나므로 재생을 방해하지 않습니다. */
  useEffect(() => {
    const unlock = (): void => unlockAudio();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  /* 화면을 한 번 건드리면 브라우저 정책이 바뀝니다 — 그때 다시 재 보고, 되면 소리로 돌아옵니다. */
  useEffect(() => {
    if (!soundBlocked) return;
    const recheck = (): void => {
      window.setTimeout(() => {
        void canPlayWithoutGesture().then((ok) => {
          if (ok) setSoundBlocked(false);
        });
      }, 0);
    };
    window.addEventListener("pointerdown", recheck);
    window.addEventListener("keydown", recheck);
    return () => {
      window.removeEventListener("pointerdown", recheck);
      window.removeEventListener("keydown", recheck);
    };
  }, [soundBlocked]);

  const unblock = useCallback((): void => {
    unlockAudio();
    setSoundBlocked(false);
  }, []);

  return { soundBlocked, unblock };
}

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
  /**
   * 화면이 가려져 **자동 진행이 멈춘 채로 돌아온** 상태.
   *
   * 이 화면의 1단계는 사용자를 전화 앱으로 내보냅니다(`tel:119`). 돌아왔을 때 몇 단계에
   * 서 있는지를 앱이 보장하지 못하면, 스피커폰 켜기·소리 확인을 건너뛴 채 마지막 단계가
   * 떠 있을 수 있습니다(페르소나 UI/UX high). 그래서 가려지는 순간 단계를 고정하고,
   * 돌아오면 **자동으로 재개하지 않고** 사람이 누르게 둡니다.
   */
  resumedFromHidden: boolean;
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
  const [resumedFromHidden, setResumedFromHidden] = useState(false);
  /** 가려지는 순간의 재생 여부 — 이벤트 핸들러가 최신 값을 읽도록 ref로 들고 있습니다. */
  const playingRef = useRef(playing);
  playingRef.current = playing;

  const step = steps[index];
  const silent = step ? isSilentStep(step) : true;

  /* 자동 진행 중에는 화면이 꺼지지 않게 잡아 둡니다.
     손이 어르신에게 가 있어 화면을 못 만지는 구간인데, 기본 잠금 시간(보통 30초)은 한 단계 낭독보다
     짧을 수 있습니다. 화면이 꺼지면 자막이 사라지고 다시 깨워 잠금을 푸는 동안 안내가 끊깁니다.
     멈춰 두거나(playing=false) 아직 시작 전(enabled=false)이면 잠금도 함께 풉니다 —
     미지원·거부 환경에서는 wakeLock.ts가 조용히 아무것도 하지 않습니다. */
  useWakeLock(enabled && playing);

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

      const dwell = dwellMsFor(text);
      const jobs: Array<Promise<unknown>> = [wait(dwell)];
      if (voiceOn) jobs.push(speak(text));
      // 낭독이 어떤 이유로도 매듭지어지지 않는 환경이 있습니다(인터럽트·정체·이벤트 미발화).
      // 자막만은 반드시 넘어가야 하므로 상한에서 기다림을 풉니다.
      await Promise.race([Promise.all(jobs), wait(stallLimitMsFor(text))]);
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

  /* 화면이 가려지면 진행과 낭독을 멈춥니다 — 이 앱에서 유일하게 「초 단위로 옳아야 하는」
     화면이라, 백그라운드에서 스로틀된 타이머와 기기마다 다른 낭독 동작에 단계 인덱스를
     맡길 수 없습니다.

     멈추기만 하고 **자동으로 재개하지 않습니다.** 119 통화를 마치고 돌아온 분이 보는 단계가
     2단계인지 5단계인지 앱이 보장할 수 없다면, 앱이 할 수 있는 정직한 일은 「여기서 멈춰
     있습니다」라고 적고 다음 동작을 사람에게 맡기는 것입니다(페르소나 UI/UX high).
     이미 멈춰 있던 경우(사용자가 「잠시 멈춤」을 누른 뒤)에는 안내를 세우지 않습니다 —
     그건 사용자가 만든 정지이지 앱이 만든 정지가 아닙니다. */
  useEffect(() => {
    if (!enabled) return;
    const onVisibility = (): void => {
      if (document.visibilityState !== "hidden") return;
      if (!playingRef.current) return;
      stopSpeaking();
      setPlaying(false);
      setResumedFromHidden(true);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [enabled]);

  // 화면을 떠날 때 남은 음성을 정리합니다.
  useEffect(() => stopSpeaking, []);

  /* 아래 조작들은 「어디에 멈춰 있는가」를 사람이 직접 정한 것이므로, 그 순간
     복귀 안내는 할 일을 마칩니다(자리를 옮기거나 실제로 이어 가는 조작들입니다). */
  const goTo = useCallback(
    (next: number): void => {
      stopSpeaking();
      setResumedFromHidden(false);
      setIndex(Math.min(steps.length - 1, Math.max(0, next)));
    },
    [steps.length],
  );

  const goPrev = useCallback((): void => {
    stopSpeaking();
    setResumedFromHidden(false);
    setIndex((value) => Math.max(0, value - 1));
  }, []);

  const goNext = useCallback((): void => {
    stopSpeaking();
    setResumedFromHidden(false);
    setIndex((value) => Math.min(steps.length - 1, value + 1));
  }, [steps.length]);

  const togglePlaying = useCallback((): void => {
    stopSpeaking();
    setResumedFromHidden(false);
    setPlaying((value) => !value);
  }, []);

  const replay = useCallback((): void => {
    const current = steps[index];
    const text = current ? current.voice.trim() : "";
    if (text.length === 0) return;
    stopSpeaking();
    /* 「다시 듣기」는 자리를 옮기지도, 자동 진행을 켜지도 않습니다 — 아직 멈춰 있는 것은
       그대로라 복귀 안내도 그대로 둡니다(안내를 접는 것은 실제로 이어 가실 때입니다). */
    void speak(text);
  }, [steps, index]);

  const restart = useCallback((): void => {
    stopSpeaking();
    setResumedFromHidden(false);
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
    resumedFromHidden,
    goPrev,
    goNext,
    goTo,
    togglePlaying,
    replay,
    restart,
  };
}
