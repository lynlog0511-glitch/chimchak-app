"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BigButton, Card } from "@/components";
import { cx } from "@/components/utils";
import { cueOptions } from "@/engine";
import { createRecognizer, stopSpeaking, type Recognizer } from "@/lib/speech";
import type { CueDef, Scenario, SessionState } from "@/types";
import { isReportCue } from "./sessionMachine";
import { RecordDraftPreview } from "./RecordDraftPreview";

export interface CueResponderProps {
  scenario: Scenario;
  session: SessionState;
  cue: CueDef;
  /** CUE 시도 횟수 — 값이 바뀌면 입력창과 대기 타이머를 초기화합니다 */
  attempt: number;
  /** 음성 인식 가능 여부 (마운트 후 판정된 값) */
  micSupported: boolean;
  onSubmit: (input: { utterance?: string; branchId?: string; viaButton: boolean }) => void;
}

/** 남은 대기 시간 — 0이 되어도 자동으로 넘기지 않고 버튼 폴백만 강조합니다. */
function useCountdown(seconds: number, resetKey: string): number {
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    setLeft(seconds);
    const timer = window.setInterval(() => {
      setLeft((value) => (value <= 0 ? 0 : value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [seconds, resetKey]);

  return left;
}

/**
 * CUE 응답 입력부.
 *
 * 세 가지 길을 항상 동시에 열어 둡니다.
 *  ① 마이크를 누르고 있는 동안 말하기 → 인식된 문장을 확인한 뒤 전송
 *  ② 보기 버튼 (마이크가 없어도 끝까지 완주할 수 있게 하는 1급 시민)
 *  ③ 직접 입력
 */
export function CueResponder({
  scenario,
  session,
  cue,
  attempt,
  micSupported,
  onSubmit,
}: CueResponderProps) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const recognizerRef = useRef<Recognizer | null>(null);

  const options = useMemo(() => cueOptions(scenario, session), [scenario, session]);
  const reportMode = useMemo(() => isReportCue(scenario, cue), [scenario, cue]);
  const resetKey = `${cue.id}-${attempt}`;
  const secondsLeft = useCountdown(cue.waitSec, resetKey);
  const timeUp = secondsLeft <= 0;

  useEffect(() => {
    setText("");
    setNotice(null);
  }, [resetKey]);

  useEffect(() => {
    return () => {
      recognizerRef.current?.stop();
    };
  }, []);

  const ensureRecognizer = useCallback((): Recognizer => {
    if (!recognizerRef.current) {
      recognizerRef.current = createRecognizer({
        onStart: () => {
          setListening(true);
          setNotice("듣고 있습니다. 말씀이 끝나면 손을 떼 주세요.");
        },
        onResult: (result) => {
          setText(result);
        },
        onError: (message) => {
          setListening(false);
          setNotice(message);
        },
        onEnd: () => {
          setListening(false);
        },
      });
    }
    return recognizerRef.current;
  }, []);

  const startListening = useCallback(() => {
    if (listening) return;
    stopSpeaking();
    const recognizer = ensureRecognizer();
    if (!recognizer.supported) {
      setNotice("이 기기에서는 음성 인식을 쓸 수 없습니다. 아래 버튼이나 직접 입력으로 진행해 주세요.");
      return;
    }
    setNotice(null);
    recognizer.start();
  }, [ensureRecognizer, listening]);

  const stopListening = useCallback(() => {
    recognizerRef.current?.stop();
    setListening(false);
  }, []);

  const send = useCallback(() => {
    const utterance = text.trim();
    if (utterance.length === 0) return;
    stopListening();
    setText("");
    setNotice(null);
    onSubmit({ utterance, viaButton: false });
  }, [onSubmit, stopListening, text]);

  const pick = useCallback(
    (branchId: string) => {
      stopListening();
      setText("");
      setNotice(null);
      onSubmit({ branchId, viaButton: true });
    },
    [onSubmit, stopListening],
  );

  const ratio = cue.waitSec > 0 ? Math.max(0, Math.min(1, secondsLeft / cue.waitSec)) : 0;

  return (
    <Card className="space-y-5">
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-extrabold text-ink md:text-xl">{cue.prompt}</h2>
          <span
            className={cx(
              "rounded-chip border px-3 py-1 text-sm font-bold",
              timeUp
                ? "border-warn-line bg-warn-soft text-warn-ink"
                : "border-line bg-paper-2 text-ink-muted",
            )}
            aria-live="off"
          >
            {timeUp ? "대기 시간이 지났습니다" : `남은 시간 ${secondsLeft}초`}
          </span>
        </div>

        <div className="mt-2 h-2 w-full overflow-hidden rounded-chip bg-line" aria-hidden="true">
          <span
            className={cx(
              "block h-full rounded-chip transition-[width] duration-1000 ease-linear",
              timeUp ? "bg-warn" : "bg-brand-400",
            )}
            style={{ width: `${Math.round(ratio * 100)}%` }}
          />
        </div>

        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          {timeUp
            ? "시간이 지나도 자동으로 넘어가지 않습니다. 아래 보기 버튼 중 하나를 고르시거나 직접 답해 주세요."
            : "천천히 하셔도 됩니다. 시간이 지나도 자동으로 넘어가지 않습니다."}
        </p>
      </div>

      {/* ① 말하기 */}
      <div className="rounded-card border border-line bg-paper-2 p-4">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
          <button
            type="button"
            aria-pressed={listening}
            aria-label="누르고 있는 동안 말하기"
            disabled={!micSupported}
            onPointerDown={(event) => {
              event.preventDefault();
              startListening();
            }}
            onPointerUp={stopListening}
            onPointerCancel={stopListening}
            onPointerLeave={() => {
              if (listening) stopListening();
            }}
            onKeyDown={(event) => {
              if (event.repeat) return;
              if (event.key === " " || event.key === "Enter") {
                event.preventDefault();
                startListening();
              }
            }}
            onKeyUp={(event) => {
              if (event.key === " " || event.key === "Enter") {
                event.preventDefault();
                stopListening();
              }
            }}
            className={cx(
              "inline-flex min-h-[72px] w-full shrink-0 items-center justify-center gap-3 rounded-field border-2 px-6 text-lg font-extrabold transition-colors duration-150 sm:w-auto",
              listening
                ? "border-danger bg-danger text-white"
                : "border-brand-700 bg-brand-700 text-white hover:bg-brand-800",
              !micSupported && "cursor-not-allowed border-line bg-neutral-soft text-ink-muted",
            )}
          >
            <span aria-hidden="true" className="text-2xl leading-none">
              🎙
            </span>
            <span>{listening ? "듣고 있습니다 — 손을 떼면 끝납니다" : "누르고 말하기"}</span>
          </button>

          <p className="text-sm leading-relaxed text-ink-soft">
            {micSupported
              ? "버튼을 누르고 있는 동안 인식합니다. 손을 떼면 인식이 끝나고, 아래 칸에서 내용을 확인한 뒤 보내실 수 있습니다."
              : "이 기기에서는 음성 인식을 쓸 수 없습니다. 아래 보기 버튼과 직접 입력만으로 끝까지 진행하실 수 있습니다."}
          </p>
        </div>

        {notice && (
          <p
            role="status"
            className="mt-3 rounded-field border border-warn-line bg-warn-soft px-3 py-2 text-sm leading-relaxed font-semibold text-warn-ink"
          >
            {notice}
          </p>
        )}

        {/* ③ 직접 입력 겸 인식 결과 확인 */}
        <div className="mt-4">
          <label htmlFor="cue-utterance" className="text-base font-bold text-ink">
            인식된 내용 확인 · 직접 입력
          </label>
          <textarea
            id="cue-utterance"
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={3}
            placeholder="여기에 하실 말씀을 적으시거나, 마이크로 말씀하신 내용을 확인해 주세요."
            className="mt-2 w-full rounded-field border-2 border-line bg-white p-3 text-lg leading-relaxed text-ink placeholder:text-ink-muted focus:border-brand-400"
          />

          {reportMode && text.trim().length > 0 && (
            <RecordDraftPreview source={text} variant="live" className="mt-3" />
          )}

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <BigButton onClick={send} disabled={text.trim().length === 0} size="lg" block>
              이 내용으로 답하기
            </BigButton>
            <BigButton
              onClick={() => setText("")}
              variant="ghost"
              disabled={text.length === 0}
              className="shrink-0 whitespace-nowrap sm:w-auto"
            >
              지우기
            </BigButton>
          </div>
        </div>
      </div>

      {/* ② 버튼 폴백 — 항상 노출 */}
      {options.length > 0 && (
        <div
          className={cx(
            "rounded-card border-2 p-4 transition-colors duration-300",
            timeUp ? "border-warn bg-warn-soft" : "border-line bg-white",
          )}
        >
          <h3 className="text-base font-extrabold text-ink">
            말하기가 어려우시면, 이 중에서 골라 주세요
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">
            버튼만으로도 끝까지 진행하실 수 있습니다.
          </p>
          <ul className="mt-3 space-y-2.5">
            {options.map((branch) => (
              <li key={branch.id}>
                <button
                  type="button"
                  onClick={() => pick(branch.id)}
                  className="w-full rounded-field border-2 border-brand-200 bg-white px-4 py-3.5 text-left text-base leading-relaxed font-semibold text-ink transition-colors duration-150 hover:border-brand-400 hover:bg-brand-50"
                >
                  {branch.fallbackOption}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

export default CueResponder;
