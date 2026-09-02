"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { BigButton, MicButton } from "@/components";
import { useModalDismiss } from "@/components/useModalDismiss";
import { cx } from "@/components/utils";
import { cueOptions } from "@/engine";
import { stopSpeaking } from "@/lib/speech";
import { useTapSpeechCapture } from "@/lib/useTapSpeechCapture";
import type { BranchDef, CueDef, Scenario, SessionState } from "@/types";
import type { MicCheck } from "./constants";
import { RuleDemoSheet } from "./RuleDemoSheet";
import type { RuleDemoExample } from "./ruleDemoExamples";

export interface CueResponderProps {
  scenario: Scenario;
  session: SessionState;
  cue: CueDef;
  attempt: number;
  micCheck: MicCheck;
  focusFirstCue?: boolean;
  chosenAlternative?: string;
  anchor?: ReactNode;
  demoExamples: RuleDemoExample[];
  demoOpen: boolean;
  onDemoClose: () => void;
  onSubmit: (input: { utterance?: string; branchId?: string; viaButton: boolean }) => void;
  onListeningChange?: (listening: boolean) => void;
}

/** 이전 레이아웃의 실측 코드가 참조하는 값. 새 입력 화면에는 내부 스크롤이 없습니다. */
export const DOCK_MAX_RATIO = 0.45;

function seedOf(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function shuffleWithSeed<T>(items: readonly T[], seed: number): T[] {
  const out = items.slice();
  let state = seed || 1;
  for (let index = out.length - 1; index > 0; index -= 1) {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    const target = Math.floor(
      (((value ^ (value >>> 14)) >>> 0) / 4294967296) * (index + 1),
    );
    [out[index], out[target]] = [out[target]!, out[index]!];
  }
  return out;
}

function SentenceSheet({
  options,
  chosenAlternative,
  onPick,
  onPickAlternative,
  onClose,
}: {
  options: BranchDef[];
  chosenAlternative?: string;
  onPick: (branchId: string) => void;
  onPickAlternative: (sentence: string) => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  useModalDismiss({ panelRef, initialFocusRef: titleRef, onDismiss: onClose });

  return createPortal(
    <div className="fixed inset-0 z-[80] flex justify-center bg-ink/55">
      <button
        type="button"
        aria-label="문장 선택 닫기"
        onClick={onClose}
        className="absolute inset-0"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sentence-sheet-title"
        className="relative flex h-[100dvh] w-full max-w-[430px] flex-col bg-paper pt-[var(--chim-safe-t)]"
      >
        <header className="flex flex-none items-center border-b border-line px-[18px] py-2">
          <h2
            ref={titleRef}
            id="sentence-sheet-title"
            tabIndex={-1}
            className="text-[1.375rem] leading-[1.3] font-bold text-ink"
          >
            문장을 골라 주세요
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto min-h-[48px] min-w-[48px] rounded-field px-2 text-[0.9375rem] font-bold text-ink-soft active:bg-paper-2"
          >
            닫기
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-[18px] py-5 pb-[calc(24px_+_var(--chim-safe-b))]">
          <p className="text-[1rem] leading-[1.6] text-ink-soft">
            지금 상황에 맞는 문장 하나를 누르면 바로 다음 단계로 넘어갑니다.
          </p>
          <ul className="mt-4 space-y-3">
            {chosenAlternative && (
              <li>
                <button
                  type="button"
                  onClick={() => onPickAlternative(chosenAlternative)}
                  className="min-h-[72px] w-full rounded-panel border-2 border-brand-700 bg-brand-tint px-5 py-4 text-left text-[1.0625rem] leading-[1.45] font-bold text-ink active:bg-mint-200"
                >
                  {chosenAlternative}
                </button>
              </li>
            )}
            {options.map((branch) => (
              <li key={branch.id}>
                <button
                  type="button"
                  onClick={() => onPick(branch.id)}
                  className="min-h-[72px] w-full rounded-panel border border-line-strong bg-paper-2 px-5 py-4 text-left text-[1.0625rem] leading-[1.45] font-bold text-ink active:bg-neutral-line"
                >
                  {branch.fallbackOption ?? branch.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function CueResponder({
  scenario,
  session,
  cue,
  attempt,
  micCheck,
  focusFirstCue = false,
  chosenAlternative,
  anchor,
  demoExamples,
  demoOpen,
  onDemoClose,
  onSubmit,
  onListeningChange,
}: CueResponderProps) {
  const [sentenceOpen, setSentenceOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const promptRef = useRef<HTMLHeadingElement | null>(null);
  const focusFirstRef = useRef(focusFirstCue);
  const focusedKeyRef = useRef("");
  const {
    phase,
    text,
    notice,
    start,
    stop,
    reset,
    setText,
    markSubmitting,
  } = useTapSpeechCapture({ onCaptureStart: stopSpeaking });

  const resetKey = `${cue.id}-${attempt}`;
  const options = useMemo(
    () =>
      shuffleWithSeed(
        cueOptions(scenario, session),
        seedOf(`${scenario.id}|${cue.id}|${session.startedAt}`),
      ),
    [cue.id, scenario, session],
  );
  const listening = phase === "requesting" || phase === "listening";
  const unavailable =
    micCheck === "no" || phase === "denied" || phase === "unsupported";
  const reviewing = manualOpen || phase === "review";

  useEffect(() => {
    reset();
    setManualOpen(false);
    setSentenceOpen(false);
  }, [reset, resetKey]);

  useEffect(() => {
    onListeningChange?.(listening);
    return () => onListeningChange?.(false);
  }, [listening, onListeningChange]);

  useEffect(() => {
    if (focusedKeyRef.current === resetKey) return;
    const first = focusedKeyRef.current.length === 0;
    focusedKeyRef.current = resetKey;
    if (first && !focusFirstRef.current) return;
    promptRef.current?.focus({ preventScroll: true });
  }, [resetKey]);

  const startVoice = useCallback(() => {
    setManualOpen(false);
    setText("");
    start();
  }, [setText, start]);

  const sendText = useCallback(() => {
    const utterance = text.trim();
    if (!utterance) return;
    markSubmitting();
    onSubmit({ utterance, viaButton: false });
    reset();
    setManualOpen(false);
  }, [markSubmitting, onSubmit, reset, text]);

  const pick = useCallback(
    (branchId: string) => {
      markSubmitting();
      setSentenceOpen(false);
      onSubmit({ branchId, viaButton: true });
      reset();
    },
    [markSubmitting, onSubmit, reset],
  );

  const pickAlternative = useCallback(
    (sentence: string) => {
      markSubmitting();
      setSentenceOpen(false);
      onSubmit({ utterance: sentence, viaButton: true });
      reset();
    },
    [markSubmitting, onSubmit, reset],
  );

  const openManual = useCallback(() => {
    reset();
    setManualOpen(true);
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  }, [reset]);

  const fillExample = useCallback(
    (example: RuleDemoExample) => {
      onDemoClose();
      reset();
      setManualOpen(true);
      setText(example.sentence);
      window.requestAnimationFrame(() => textareaRef.current?.focus());
    },
    [onDemoClose, reset, setText],
  );

  return (
    <section className="border-t border-line bg-paper px-[18px] pt-5 pb-[calc(24px_+_var(--chim-safe-b))]">
      {anchor}
      <h2
        ref={promptRef}
        tabIndex={-1}
        className="text-center text-[1.1875rem] leading-[1.45] font-bold text-ink"
      >
        {cue.prompt}
      </h2>

      {reviewing ? (
        <div className="mt-4">
          {notice && (
            <p
              role="status"
              className="mb-3 rounded-panel bg-warn-soft px-4 py-3 text-[1rem] leading-[1.6] font-semibold text-warn-ink"
            >
              {notice}
            </p>
          )}
          <label htmlFor="cue-utterance" className="block text-[1.0625rem] font-bold text-ink">
            말씀하신 내용이 맞나요?
          </label>
          <textarea
            ref={textareaRef}
            id="cue-utterance"
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={3}
            placeholder="여기에 답할 말을 적어 주세요."
            className="mt-2 w-full rounded-panel border-2 border-line-strong bg-paper px-4 py-3 text-[1.0625rem] leading-[1.6] text-ink placeholder:text-ink-muted focus:border-brand-700"
          />
          <BigButton onClick={sendText} disabled={!text.trim()} size="lg" block className="mt-3">
            이대로 보내기
          </BigButton>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {!unavailable && (
              <button
                type="button"
                onClick={startVoice}
                className="min-h-[56px] rounded-card bg-paper-2 px-3 text-[0.9375rem] font-bold text-ink"
              >
                다시 말하기
              </button>
            )}
            <button
              type="button"
              onClick={() => setSentenceOpen(true)}
              className={cx(
                "min-h-[56px] rounded-card bg-paper-2 px-3 text-[0.9375rem] font-bold text-ink",
                unavailable && "col-span-2",
              )}
            >
              문장 고르기
            </button>
          </div>
        </div>
      ) : listening ? (
        <div className="mt-5 flex flex-col items-center">
          <p className="text-[1.8125rem] leading-[1.3] font-bold text-brand-800">
            {phase === "requesting" ? "마이크를 준비하고 있어요" : "듣고 있어요"}
          </p>
          <p className="mt-2 min-h-[3.2em] w-full rounded-panel bg-paper-2 px-4 py-3 text-center text-[1.0625rem] leading-[1.6] text-ink-soft">
            {text.trim() || "천천히 말씀해 주세요."}
          </p>
          <div className="mt-7 mb-6">
            <MicButton size="xl" pressed label="말하기 끝" onClick={stop} />
          </div>
          <p className="text-[1.1875rem] font-bold text-ink">말하기 끝</p>
          <p className="mt-1 text-[0.9375rem] leading-[1.45] text-ink-soft">
            다 말씀하셨으면 버튼을 한 번 누르세요.
          </p>
        </div>
      ) : unavailable ? (
        <div className="mt-4">
          <p
            role="status"
            className="rounded-panel bg-warn-soft px-4 py-3 text-[1rem] leading-[1.6] font-semibold text-warn-ink"
          >
            {notice ?? "마이크를 쓰기 어려워도 괜찮아요. 문장을 골라 끝까지 연습할 수 있어요."}
          </p>
          <BigButton onClick={() => setSentenceOpen(true)} size="lg" block className="mt-4">
            문장 골라 답하기
          </BigButton>
          <button
            type="button"
            onClick={openManual}
            className="mt-2 min-h-[56px] w-full rounded-field text-[0.9375rem] font-bold text-ink-soft underline underline-offset-4"
          >
            직접 입력하기
          </button>
        </div>
      ) : (
        <div className="mt-5 flex flex-col items-center">
          {notice && (
            <p
              role="status"
              className="mb-5 w-full rounded-panel bg-warn-soft px-4 py-3 text-[1rem] leading-[1.6] font-semibold text-warn-ink"
            >
              {notice}
            </p>
          )}
          <div className="mt-3 mb-6">
            <MicButton
              size="xl"
              label="말하기 시작"
              disabled={micCheck === "unknown"}
              onClick={startVoice}
            />
          </div>
          <p className="text-[1.1875rem] font-bold text-ink">
            {micCheck === "unknown" ? "마이크 확인 중" : "말하기 시작"}
          </p>
          <p className="mt-1 text-[0.9375rem] leading-[1.45] text-ink-soft">
            버튼을 한 번 누르고 천천히 말씀하세요.
          </p>
          <BigButton
            onClick={() => setSentenceOpen(true)}
            variant="secondary"
            size="lg"
            block
            className="mt-6"
          >
            문장 골라 답하기
          </BigButton>
          <button
            type="button"
            onClick={openManual}
            className="mt-2 min-h-[56px] w-full rounded-field text-[0.9375rem] font-bold text-ink-soft underline underline-offset-4"
          >
            직접 입력하기
          </button>
        </div>
      )}

      {sentenceOpen && (
        <SentenceSheet
          options={options}
          chosenAlternative={chosenAlternative}
          onPick={pick}
          onPickAlternative={pickAlternative}
          onClose={() => setSentenceOpen(false)}
        />
      )}

      {demoOpen && demoExamples.length > 0 && (
        <RuleDemoSheet
          prompt={cue.prompt}
          examples={demoExamples}
          onFill={fillExample}
          onClose={onDemoClose}
        />
      )}
    </section>
  );
}

export default CueResponder;
