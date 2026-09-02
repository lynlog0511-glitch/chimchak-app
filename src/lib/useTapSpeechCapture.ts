"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createRecognizer, type Recognizer } from "./speech";

export type TapSpeechPhase =
  | "idle"
  | "requesting"
  | "listening"
  | "review"
  | "submitting"
  | "error"
  | "denied"
  | "unsupported";

export type TapSpeechEvent = "request" | "started" | "review" | "submit" | "reset";

/** 마이크 화면들이 공유하는 정상 경로. 잘못된 순서의 이벤트는 현재 상태를 유지합니다. */
export function nextTapSpeechPhase(
  current: TapSpeechPhase,
  event: TapSpeechEvent,
  supported = true,
): TapSpeechPhase {
  if (event === "reset") return supported ? "idle" : "unsupported";
  if (event === "request") {
    if (!supported) return "unsupported";
    return current === "requesting" || current === "listening" ? current : "requesting";
  }
  if (event === "started") return current === "requesting" ? "listening" : current;
  if (event === "review") {
    return current === "requesting" || current === "listening" ? "review" : current;
  }
  if (event === "submit") {
    return current === "requesting" || current === "listening" ? current : "submitting";
  }
  return current;
}

/** 화면 이탈과 페이지 종료는 모두 같은 동기 stop 경로를 탑니다. */
export const TAP_SPEECH_WINDOW_EXIT_EVENTS = ["pagehide", "beforeunload"] as const;

export interface UseTapSpeechCaptureOptions {
  /** 이미 적어 둔 글. 바뀌면 훅의 검토 문장도 같은 값으로 맞춥니다. */
  initialText?: string;
  /** 받아쓰기·직접 수정으로 글이 바뀔 때 호출합니다. */
  onTextChange?: (next: string) => void;
  /** 사용자가 실제로 마이크 시작을 누른 순간 한 번 호출합니다. */
  onCaptureStart?: () => void;
}

export interface TapSpeechCapture {
  phase: TapSpeechPhase;
  text: string;
  notice: string | null;
  supported: boolean;
  /** 한 번 눌러 받아쓰기를 시작합니다. 제출은 하지 않습니다. */
  start: () => void;
  /** 한 번 눌러 받아쓰기를 멈추고 검토 상태로 갑니다. */
  stop: () => void;
  /** 듣기를 멈추고 글·알림을 비운 뒤 idle로 돌아갑니다. */
  reset: () => void;
  /** 직접 입력·예시 선택을 같은 저장 경로로 보냅니다. */
  setText: (next: string) => void;
  /** 호출자가 검토를 마치고 제출하기 직전에 명시적으로 부릅니다. */
  markSubmitting: () => void;
}

function appendUtterance(base: string, added: string): string {
  const head = base.trimEnd();
  const tail = added.trim();
  if (tail.length === 0) return base;
  if (head.length === 0) return tail;
  return `${head} ${tail}`;
}

const DENIED_CODES = new Set(["not-allowed", "service-not-allowed"]);
const EMPTY_CAPTURE_NOTICE = "잘 듣지 못했어요. 문장을 골라 답해 주세요.";
const REVIEW_NOTICE = "받아쓰기를 멈췄습니다. 적힌 내용을 확인하고 고쳐 주세요.";

/** 모든 이탈 경로가 쓰는 동기 종료 함수 — 호출이 돌아오기 전에 stop 요청을 보냅니다. */
export function terminateTapSpeechCapture(
  recognizer: Pick<Recognizer, "stop"> | null,
): void {
  recognizer?.stop();
}

export interface TapSpeechLifecycleTargets {
  documentTarget: EventTarget & { readonly visibilityState: string };
  windowTarget: EventTarget;
  terminate: () => void;
}

/** 실제 브라우저 이탈·숨김 이벤트와 동기 종료 함수를 연결하고, 해제 시에도 한 번 종료합니다. */
export function bindTapSpeechTermination({
  documentTarget,
  windowTarget,
  terminate,
}: TapSpeechLifecycleTargets): () => void {
  const stopWhenHidden = (): void => {
    if (documentTarget.visibilityState === "hidden") terminate();
  };

  documentTarget.addEventListener("visibilitychange", stopWhenHidden);
  TAP_SPEECH_WINDOW_EXIT_EVENTS.forEach((eventName) => {
    windowTarget.addEventListener(eventName, terminate);
  });

  return () => {
    terminate();
    documentTarget.removeEventListener("visibilitychange", stopWhenHidden);
    TAP_SPEECH_WINDOW_EXIT_EVENTS.forEach((eventName) => {
      windowTarget.removeEventListener(eventName, terminate);
    });
  };
}

/**
 * Web Speech API를 「한 번 눌러 시작 → 한 번 눌러 종료 → 눈으로 검토」 흐름으로 제한합니다.
 *
 * `createRecognizer()`는 브라우저가 침묵 때문에 스스로 끝낸 동안에는 다시 이어 듣습니다. 따라서
 * 이 훅의 모든 탈출 경로는 같은 `stopRecognizer()`를 지나 `active=false`가 먼저 되게 합니다.
 * 권한 거부, 컴포넌트 언마운트(경로 이동), document 숨김, pagehide/beforeunload 모두 여기에
 * 포함됩니다. 인식 결과는 글에만 더하며 이 훅은 어떤 경우에도 자동 제출하지 않습니다.
 */
export function useTapSpeechCapture({
  initialText = "",
  onTextChange,
  onCaptureStart,
}: UseTapSpeechCaptureOptions = {}): TapSpeechCapture {
  const recognizerRef = useRef<Recognizer | null>(null);
  const mountedRef = useRef(false);
  const phaseRef = useRef<TapSpeechPhase>("idle");
  const textRef = useRef(initialText);
  const captureProducedRef = useRef(false);
  const supportedRef = useRef(false);
  const onTextChangeRef = useRef(onTextChange);
  const onCaptureStartRef = useRef(onCaptureStart);

  const [phase, setPhase] = useState<TapSpeechPhase>("idle");
  const [text, setTextState] = useState(initialText);
  const [notice, setNotice] = useState<string | null>(null);
  const [supported, setSupported] = useState(false);

  const moveTo = useCallback((next: TapSpeechPhase): void => {
    phaseRef.current = next;
    if (mountedRef.current) setPhase(next);
  }, []);

  const stopRecognizer = useCallback((): void => {
    terminateTapSpeechCapture(recognizerRef.current);
  }, []);

  const updateText = useCallback((next: string): void => {
    textRef.current = next;
    if (mountedRef.current) setTextState(next);
    onTextChangeRef.current?.(next);
  }, []);

  useEffect(() => {
    onTextChangeRef.current = onTextChange;
  }, [onTextChange]);

  useEffect(() => {
    onCaptureStartRef.current = onCaptureStart;
  }, [onCaptureStart]);

  useEffect(() => {
    if (initialText === textRef.current) return;
    textRef.current = initialText;
    setTextState(initialText);
  }, [initialText]);

  useEffect(() => {
    mountedRef.current = true;

    const recognizer = createRecognizer({
      onResult: (recognized, isFinal) => {
        if (!mountedRef.current || !isFinal) return;
        if (phaseRef.current === "denied" || phaseRef.current === "unsupported") return;
        captureProducedRef.current = true;
        updateText(appendUtterance(textRef.current, recognized));
      },
      onStart: () => {
        if (!mountedRef.current || phaseRef.current !== "requesting") return;
        setNotice(null);
        moveTo(nextTapSpeechPhase(phaseRef.current, "started"));
      },
      onError: (message, code) => {
        if (!mountedRef.current) return;
        const next = code && DENIED_CODES.has(code) ? "denied" : "error";
        moveTo(next);
        stopRecognizer();
        setNotice(message);
      },
      onEnd: () => {
        if (!mountedRef.current) return;
        if (phaseRef.current === "requesting" || phaseRef.current === "listening") {
          moveTo(nextTapSpeechPhase(phaseRef.current, "review"));
          setNotice(captureProducedRef.current ? REVIEW_NOTICE : EMPTY_CAPTURE_NOTICE);
        }
      },
    });

    recognizerRef.current = recognizer;
    supportedRef.current = recognizer.supported;
    setSupported(recognizer.supported);
    if (!recognizer.supported) {
      moveTo("unsupported");
      setNotice("이 기기에서는 음성 인식을 쓸 수 없습니다. 글자로 적어 주세요.");
    }

    const stopForExit = (): void => {
      const wasCapturing =
        phaseRef.current === "requesting" || phaseRef.current === "listening";
      stopRecognizer();
      if (wasCapturing && mountedRef.current) {
        moveTo("review");
        setNotice(
          captureProducedRef.current
            ? "화면을 벗어나 받아쓰기를 멈췄습니다. 적힌 내용을 확인해 주세요."
            : EMPTY_CAPTURE_NOTICE,
        );
      }
    };
    const unbindTermination = bindTapSpeechTermination({
      documentTarget: document,
      windowTarget: window,
      terminate: stopForExit,
    });

    return () => {
      mountedRef.current = false;
      unbindTermination();
      recognizerRef.current = null;
    };
  }, [moveTo, stopRecognizer, updateText]);

  const start = useCallback((): void => {
    const recognizer = recognizerRef.current;
    if (!recognizer || !recognizer.supported) {
      moveTo("unsupported");
      setNotice("이 기기에서는 음성 인식을 쓸 수 없습니다. 글자로 적어 주세요.");
      return;
    }
    if (phaseRef.current === "requesting" || phaseRef.current === "listening") return;

    onCaptureStartRef.current?.();
    captureProducedRef.current = false;
    setNotice(null);
    moveTo(nextTapSpeechPhase(phaseRef.current, "request", true));
    recognizer.start();
  }, [moveTo]);

  const stop = useCallback((): void => {
    const wasCapturing = phaseRef.current === "requesting" || phaseRef.current === "listening";
    stopRecognizer();
    if (!wasCapturing) return;
    moveTo(nextTapSpeechPhase(phaseRef.current, "review"));
    setNotice(captureProducedRef.current ? REVIEW_NOTICE : EMPTY_CAPTURE_NOTICE);
  }, [moveTo, stopRecognizer]);

  const reset = useCallback((): void => {
    stopRecognizer();
    captureProducedRef.current = false;
    setNotice(null);
    updateText("");
    moveTo(nextTapSpeechPhase(phaseRef.current, "reset", supportedRef.current));
  }, [moveTo, stopRecognizer, updateText]);

  const markSubmitting = useCallback((): void => {
    stopRecognizer();
    setNotice(null);
    moveTo(nextTapSpeechPhase(phaseRef.current, "submit"));
  }, [moveTo, stopRecognizer]);

  return {
    phase,
    text,
    notice,
    supported,
    start,
    stop,
    reset,
    setText: updateText,
    markSubmitting,
  };
}

export default useTapSpeechCapture;
