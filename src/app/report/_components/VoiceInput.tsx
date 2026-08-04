"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import { BigButton, Card, cx } from "@/components";
import { createRecognizer, type Recognizer } from "@/lib/speech";
import { EXAMPLE_NOTICE, EXAMPLE_PARTIAL, EXAMPLE_WANDERING } from "./examples";

export interface VoiceInputProps {
  value: string;
  onChange: (next: string) => void;
  /** 다음 단계(가명처리 확인)로 이동 */
  onNext: () => void;
  /**
   * 실제 입력이 시작된 시점(첫 타이핑 또는 마이크 시작)에 호출합니다.
   * 예시 문장 채우기 버튼은 실제 입력이 아니므로 호출하지 않습니다.
   * 소요시간 측정용이며, 여러 번 불려도 안전하도록 호출부에서 최초 1회만 기록합니다.
   */
  onInputStart: () => void;
}

/** 인식 결과를 기존 내용 뒤에 자연스럽게 이어 붙입니다. */
function appendUtterance(base: string, added: string): string {
  const head = base.trimEnd();
  const tail = added.trim();
  if (tail.length === 0) return base;
  if (head.length === 0) return tail;
  return `${head} ${tail}`;
}

/**
 * 1단계 입력 화면.
 * 마이크는 **누르고 있는 동안에만** 인식하고, 타이핑 입력은 항상 열려 있습니다.
 * 음성 인식이 되지 않는 환경에서도 타이핑만으로 끝까지 진행할 수 있습니다.
 */
export function VoiceInput({ value, onChange, onNext, onInputStart }: VoiceInputProps) {
  const recognizerRef = useRef<Recognizer | null>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const recognizer = createRecognizer({
      onResult: (text, isFinal) => {
        if (isFinal) {
          setInterim("");
          onChangeRef.current(appendUtterance(valueRef.current, text));
        } else {
          setInterim(text);
        }
      },
      onError: (message) => {
        setNotice(message);
        setListening(false);
        setInterim("");
      },
      onEnd: () => {
        setListening(false);
        setInterim("");
      },
      onStart: () => setNotice(null),
    });
    recognizerRef.current = recognizer;
    setSupported(recognizer.supported);
    return () => {
      recognizer.stop();
      recognizerRef.current = null;
    };
  }, []);

  const startListening = (): void => {
    const recognizer = recognizerRef.current;
    if (!recognizer || !recognizer.supported) {
      setNotice("이 기기에서는 음성 인식을 쓸 수 없습니다. 아래 칸에 직접 적어 주세요.");
      return;
    }
    onInputStart();
    setListening(true);
    recognizer.start();
  };

  const stopListening = (): void => {
    recognizerRef.current?.stop();
    setListening(false);
    setInterim("");
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* 포인터 캡처를 지원하지 않는 환경 — 무시합니다 */
    }
    startListening();
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* 이미 해제된 경우 — 무시합니다 */
    }
    stopListening();
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>): void => {
    if (event.repeat) return;
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    startListening();
  };

  const handleKeyUp = (event: ReactKeyboardEvent<HTMLButtonElement>): void => {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    stopListening();
  };

  const empty = value.trim().length === 0;

  return (
    <div className="space-y-5">
      <Card>
        <h2 className="text-lg font-extrabold text-ink md:text-xl">
          1. 오늘 있었던 일을 그대로 말씀해 주세요
        </h2>
        <p className="mt-2 text-base leading-relaxed text-ink-soft">
          정리해서 말하지 않으셔도 됩니다. 기억나는 대로 말씀하시면 기기 안에서 개인정보를 가리고,
          급여제공기록지 5요소로 나눠 드립니다.
        </p>

        <div className="mt-5 flex flex-col items-center gap-3">
          <button
            type="button"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={stopListening}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            onBlur={() => {
              if (listening) stopListening();
            }}
            aria-pressed={listening}
            aria-label={
              listening
                ? "음성 인식 중입니다. 손을 떼면 멈춥니다."
                : "누르고 있는 동안 말씀을 받아 적습니다."
            }
            style={{ touchAction: "none" }}
            className={cx(
              "flex w-full max-w-md min-h-[104px] flex-col items-center justify-center gap-1 rounded-card border-2 px-6 py-4 font-extrabold transition-colors duration-150",
              listening
                ? "border-danger bg-danger-soft text-danger-ink"
                : "border-brand-300 bg-brand-50 text-brand-800 hover:bg-brand-100",
            )}
          >
            <span aria-hidden="true" className="text-2xl leading-none">
              {listening ? "🔴" : "🎤"}
            </span>
            <span className="text-lg">
              {listening ? "듣고 있습니다 — 손을 떼면 멈춥니다" : "누르고 있는 동안 듣습니다"}
            </span>
            <span className="text-sm font-semibold text-ink-muted">
              {supported
                ? "버튼을 누른 채로 말씀하신 뒤 손을 떼 주세요."
                : "이 기기에서는 마이크를 쓸 수 없습니다. 아래 칸에 적어 주세요."}
            </span>
          </button>

          {listening && (
            <p
              aria-live="polite"
              className="w-full max-w-md rounded-field border border-line bg-white px-4 py-3 text-base leading-relaxed text-ink-soft"
            >
              {interim.length > 0 ? `인식 중 · ${interim}` : "말씀을 기다리고 있습니다."}
            </p>
          )}

          {notice && (
            <p
              role="status"
              className="w-full max-w-md rounded-field border border-warn-line bg-warn-soft px-4 py-3 text-base leading-relaxed text-warn-ink"
            >
              {notice}
            </p>
          )}
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label htmlFor="report-utterance" className="text-base font-extrabold text-ink">
            보고 내용 (직접 적으셔도 됩니다)
          </label>
          <span className="text-sm font-semibold text-ink-muted">
            마이크가 없어도 여기까지만 적으면 그대로 진행됩니다.
          </span>
        </div>

        <textarea
          id="report-utterance"
          value={value}
          onChange={(event) => {
            onInputStart();
            onChange(event.target.value);
          }}
          rows={8}
          placeholder="예) 오후 4시 40분쯤 어르신이 현관 앞에서 집에 가야 한다며 나가려 하셨습니다."
          className="mt-3 w-full rounded-field border-2 border-line bg-white p-4 text-base leading-relaxed text-ink placeholder:text-ink-muted/70 focus:border-brand-400 focus:outline-none"
        />

        <div className="mt-4 flex flex-wrap gap-3">
          <BigButton variant="secondary" onClick={() => onChange(EXAMPLE_WANDERING)}>
            예시 문장 넣기 (배회 대응 보고)
          </BigButton>
          <BigButton variant="secondary" onClick={() => onChange(EXAMPLE_PARTIAL)}>
            빈 칸이 있는 예시 넣기
          </BigButton>
          <BigButton variant="ghost" onClick={() => onChange("")} disabled={empty}>
            지우기
          </BigButton>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-ink-muted">{EXAMPLE_NOTICE}</p>
      </Card>

      <Card tone="quiet">
        <p className="text-base leading-relaxed text-ink">
          음성과 원문은 이 기기 안에서만 다루고 저장하지 않습니다. 다음 화면에서 무엇을 왜 가리는지
          먼저 확인하신 뒤에 진행됩니다.
        </p>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <BigButton size="lg" onClick={onNext} disabled={empty}>
          가명처리 확인하기
        </BigButton>
      </div>
      {empty && (
        <p className="text-right text-sm font-semibold text-ink-muted">
          말씀하시거나 적어 주시면 다음 단계로 넘어갈 수 있습니다.
        </p>
      )}
    </div>
  );
}

export default VoiceInput;
