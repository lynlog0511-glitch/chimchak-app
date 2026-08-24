"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { BigButton, InlineDisclaimer, MicButton } from "@/components";
import { cx } from "@/components/utils";
import { createRecognizer, stopSpeaking, type Recognizer } from "@/lib/speech";
import { FREE_UTTERANCE_MAX } from "@/lib/onlineFree";
import {
  COMPOSER_FINISH,
  COMPOSER_MIC_LABEL,
  COMPOSER_PLACEHOLDER,
  COMPOSER_SEND,
  COMPOSER_TURNS_DONE,
  COMPOSER_TURNS_LEFT,
  COMPOSER_WAITING,
  TTS_OFF,
  TTS_ON,
} from "./constants";

export interface FreeComposerProps {
  value: string;
  onChange: (text: string) => void;
  onSend: () => void;
  onFinish: () => void;
  /** 인물의 답을 기다리는 중 — 보내기를 잠급니다 */
  busy: boolean;
  /** 남은 차례 (0이면 입력을 닫고 마무리만 남깁니다) */
  turnsLeft: number;
  ttsOn: boolean;
  onToggleTts: () => void;
  /** 화면 쪽에서 온 안내 한 줄 (연결 실패·한도 등) */
  notice?: string;
}

/**
 * 자유 대화의 입력 자리.
 *
 * 훈련의 컴포저(`CueResponder`)와 다른 점은 하나입니다 — **제안 버튼이 없습니다.**
 * 훈련에서는 「버튼 폴백이 1급 시민」이고, 모든 CUE를 버튼만으로 완주할 수 있어야 합니다.
 * 그 버튼은 시나리오 데이터의 분기에서 나오는데, 자유 대화에는 분기가 없습니다.
 * 없는 것을 흉내 내 만들면 그것은 이미 자유 대화가 아니라 좁은 선택지이므로, 여기서는
 * 말하기(마이크)와 직접 입력 두 길만 둡니다. 마이크가 막힌 기기에서도 타이핑으로 끝까지
 * 가실 수 있고, **어느 화면에서도 「마무리하기」는 항상 눌립니다** — 나가는 길은 늘 열려 있습니다.
 * (버튼만으로 완주해야 하는 훈련은 `/train`이 그대로 맡습니다.)
 */
export function FreeComposer({
  value,
  onChange,
  onSend,
  onFinish,
  busy,
  turnsLeft,
  ttsOn,
  onToggleTts,
  notice,
}: FreeComposerProps) {
  const inputId = useId();
  const recognizerRef = useRef<Recognizer | null>(null);
  const committedRef = useRef("");
  const valueRef = useRef(value);
  const [listening, setListening] = useState(false);
  const [micNotice, setMicNotice] = useState<string | null>(null);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  /** 인식기는 한 번만 만들고 계속 씁니다(미지원 기기에서는 supported=false인 no-op입니다). */
  const ensureRecognizer = useCallback((): Recognizer => {
    if (!recognizerRef.current) {
      recognizerRef.current = createRecognizer({
        onStart: () => {
          setListening(true);
          setMicNotice(null);
        },
        // 침묵을 건너뛰며 계속 듣는 인식기라 확정 조각이 여러 번 옵니다 — 덮어쓰지 않고 이어 붙입니다.
        onResult: (result, isFinal) => {
          const joined = committedRef.current ? `${committedRef.current} ${result}`.trim() : result;
          if (isFinal) committedRef.current = joined;
          onChangeRef.current(joined.slice(0, FREE_UTTERANCE_MAX));
        },
        onError: (message) => {
          setListening(false);
          setMicNotice(message);
        },
        onEnd: () => setListening(false),
      });
    }
    return recognizerRef.current;
  }, []);

  const startListening = useCallback(() => {
    if (listening) return;
    stopSpeaking();
    const recognizer = ensureRecognizer();
    if (!recognizer.supported) {
      setMicNotice("이 기기에서는 음성 인식을 쓸 수 없습니다. 직접 입력으로 진행해 주세요.");
      return;
    }
    setMicNotice(null);
    // 이미 적혀 있던 문장 뒤에 이어 붙입니다 — 앞말을 지우지 않게.
    committedRef.current = valueRef.current;
    recognizer.start();
  }, [ensureRecognizer, listening]);

  const stopListening = useCallback(() => {
    recognizerRef.current?.stop();
    setListening(false);
  }, []);

  useEffect(() => () => recognizerRef.current?.stop(), []);

  const closed = turnsLeft <= 0;
  const canSend = !busy && !closed && value.trim().length > 0;

  return (
    <section className="mt-5 border-t border-line pt-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[0.8438rem] leading-[1.45] font-semibold text-ink-muted">
          {busy ? COMPOSER_WAITING : closed ? COMPOSER_TURNS_DONE : COMPOSER_TURNS_LEFT(turnsLeft)}
        </p>
        {/* 낭독 켜고 끄기 — 상태를 색이 아니라 낱말로 말합니다. */}
        <button
          type="button"
          onClick={onToggleTts}
          aria-pressed={ttsOn}
          className="-mr-2 flex min-h-[48px] flex-none items-center rounded-field px-2 text-[0.8438rem] font-semibold text-ink-muted transition-colors duration-150 active:bg-paper-2"
        >
          {ttsOn ? TTS_ON : TTS_OFF}
        </button>
      </div>

      {!closed && (
        <>
          <label htmlFor={inputId} className="sr-only">
            하실 말씀
          </label>
          <div className="mt-2 flex items-end gap-2">
            <textarea
              id={inputId}
              rows={2}
              value={value}
              maxLength={FREE_UTTERANCE_MAX}
              disabled={busy}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  if (canSend) onSend();
                }
              }}
              placeholder={COMPOSER_PLACEHOLDER}
              className={cx(
                "min-h-12 min-w-0 flex-1 resize-none rounded-[18px] border border-line-strong bg-paper-2",
                "px-4 py-3 text-[1.0625rem] leading-[1.5] text-ink placeholder:text-ink-muted",
                "disabled:opacity-60",
              )}
            />
            <MicButton
              label={listening ? "말하는 중 — 손을 떼면 멈춥니다" : COMPOSER_MIC_LABEL}
              pressed={listening}
              disabled={busy}
              onPointerDown={(event) => {
                event.preventDefault();
                startListening();
              }}
              onPointerUp={stopListening}
              onPointerCancel={stopListening}
              onPointerLeave={stopListening}
              onKeyDown={(event) => {
                if (event.repeat) return;
                if (event.key === " " || event.key === "Enter") {
                  event.preventDefault();
                  startListening();
                }
              }}
              onKeyUp={(event) => {
                if (event.key === " " || event.key === "Enter") stopListening();
              }}
            />
          </div>

          {listening && (
            <p className="mt-2 text-[0.8438rem] leading-[1.6] font-semibold text-brand-800">
              듣고 있어요 — 손을 떼면 멈춥니다. 보내기 전에 고치실 수 있습니다.
            </p>
          )}

          <BigButton block disabled={!canSend} onClick={onSend} className="mt-2.5">
            {COMPOSER_SEND}
          </BigButton>
        </>
      )}

      {(micNotice || notice) && (
        <p role="status" className="mt-2.5 text-[0.9375rem] leading-[1.6] text-warn-ink">
          {notice ?? micNotice}
        </p>
      )}

      <BigButton variant="secondary" block onClick={onFinish} className="mt-2">
        {COMPOSER_FINISH}
      </BigButton>

      <InlineDisclaimer tone="readable" className="mt-3" />
    </section>
  );
}

export default FreeComposer;
