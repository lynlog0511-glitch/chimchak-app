"use client";

import { useRef } from "react";
import type { Ref } from "react";
import { BigButton, ChevronGlyph, StatusDot, WaveBars } from "@/components";
import { useTapSpeechCapture } from "@/lib/useTapSpeechCapture";
import { EXAMPLE_FILL_TITLE, EXAMPLE_NOTICE, REPORT_EXAMPLES } from "./examples";
import { StickyCtaBar } from "./StickyCtaBar";

export interface VoiceInputProps {
  value: string;
  onChange: (next: string) => void;
  /** 다음 단계(개인정보 확인)로 이동 */
  onNext: () => void;
  /** 실제 입력이 시작된 최초 시점을 기록하는 호출부 콜백 */
  onInputStart: () => void;
  /** 단계가 바뀌면 위저드가 이 제목으로 초점을 옮깁니다. */
  headingRef?: Ref<HTMLHeadingElement>;
}

const EXAMPLE_BUTTON_CLASS =
  "flex min-h-[48px] items-center rounded-card bg-paper-2 px-4 text-[0.9375rem] font-semibold text-ink-soft transition-colors duration-150 active:bg-neutral-line";

/**
 * 돌봄 기록 1단계 — 탭으로 받아쓰기 시작/종료 후 글을 검토합니다.
 *
 * 마이크 결과는 편집칸에만 더합니다. 멈추기나 인식 종료가 다음 단계로 자동 이동시키지 않으며,
 * 사용자가 「개인정보 확인하기」를 직접 눌러야만 위저드가 전진합니다.
 */
export function VoiceInput({
  value,
  onChange,
  onNext,
  onInputStart,
  headingRef,
}: VoiceInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const { phase, text, notice, start, stop, reset, setText, supported } = useTapSpeechCapture({
    initialText: value,
    onTextChange: onChange,
    onCaptureStart: onInputStart,
  });

  const capturing = phase === "requesting" || phase === "listening";
  const empty = text.trim().length === 0;
  const unavailable = phase === "unsupported";

  const micCaption =
    phase === "requesting"
      ? "마이크 사용을 확인하고 있어요. 멈추려면 다시 눌러 주세요."
      : phase === "listening"
        ? "듣고 있어요. 말씀을 마치면 다시 눌러 주세요."
        : phase === "review"
          ? "받아쓰기를 멈췄어요. 아래 글을 확인하고 고쳐 주세요."
          : phase === "denied"
            ? "마이크가 허용되지 않았어요. 아래 칸에 글자로 적어도 됩니다."
            : phase === "error"
              ? "받아쓰기가 멈췄어요. 다시 시도하거나 글자로 적어 주세요."
              : unavailable
                ? "이 기기에서는 받아쓰기를 쓸 수 없어요. 아래 칸에 글자로 적어 주세요."
                : "한 번 누르면 듣기 시작하고, 다시 누르면 멈춥니다.";

  const focusTextarea = (): void => {
    if (capturing) stop();
    textareaRef.current?.scrollIntoView({ block: "center" });
    textareaRef.current?.focus();
  };

  return (
    <div>
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-[1.1875rem] leading-[1.3] font-bold tracking-[-0.015em] text-ink"
      >
        오늘 있었던 일을 말하거나 적어 주세요
      </h2>
      <p className="mt-[6px] text-[1rem] leading-[1.6] text-ink-soft">
        정리하지 않으셔도 됩니다. 기억나는 대로 말씀하시면 개인정보를 가리고 돌봄 기록의 다섯
        칸으로 나눠 드립니다.
      </p>

      <section aria-labelledby="report-voice-title" className="mt-4 rounded-panel bg-paper-2 p-4">
        <h3 id="report-voice-title" className="text-[1rem] leading-[1.45] font-bold text-ink">
          말로 입력하기
        </h3>

        {capturing && (
          <div className="mt-[10px] rounded-field bg-paper px-[14px] py-[12px]">
            <p className="flex items-center gap-[7px] text-[0.9375rem] leading-[1.45] font-bold text-danger-ink">
              <StatusDot tone="danger" size={8} />
              {phase === "requesting" ? "마이크 연결 중" : "듣고 있어요"}
              {phase === "listening" && <WaveBars count={5} className="ml-[2px]" />}
            </p>
          </div>
        )}

        <BigButton
          size="lg"
          block
          variant={capturing ? "danger" : empty ? "primary" : "secondary"}
          className="mt-3"
          onClick={capturing ? stop : start}
          disabled={unavailable}
          ariaLabel={capturing ? "받아쓰기 멈추기" : "말로 입력 시작"}
        >
          {phase === "requesting"
            ? "연결 멈추기"
            : phase === "listening"
              ? "받아쓰기 멈추기"
              : phase === "review"
                ? "이어서 말하기"
                : phase === "denied" || phase === "error"
                  ? "마이크 다시 시도"
                  : "말로 입력 시작"}
        </BigButton>
        <p className="mt-[8px] text-center text-[0.9375rem] leading-[1.45] text-ink-soft">
          {micCaption}
        </p>

        {notice && (phase === "review" || phase === "denied" || phase === "error" || unavailable) && (
          <p className="mt-[10px] rounded-field bg-warn-soft px-[14px] py-[10px] text-[0.9375rem] leading-[1.6] font-semibold text-warn-ink">
            {notice}
          </p>
        )}

        <p role="status" className="sr-only">
          {notice ?? micCaption}
        </p>
      </section>

      {empty && (
        <div className="mt-5 min-h-[116px]">
          <div className="border-t border-line bg-paper pt-3.5 pb-3.5">
            <BigButton size="lg" block onClick={onNext} disabled>
              개인정보 확인하기
            </BigButton>
            <p className="mt-[6px] text-center text-[0.9375rem] leading-[1.45] text-ink-muted">
              말씀하시거나 적어 주시면 다음 단계로 갈 수 있습니다
            </p>
          </div>
        </div>
      )}

      <div className="mt-5">
        <label htmlFor="report-utterance" className="text-[1rem] leading-[1.45] font-bold text-ink">
          입력된 내용
        </label>
        <textarea
          id="report-utterance"
          ref={textareaRef}
          value={text}
          onFocus={() => {
            if (capturing) stop();
          }}
          onChange={(event) => {
            onInputStart();
            setText(event.target.value);
          }}
          rows={5}
          placeholder="예) 오후 4시 40분쯤 어르신이 현관 앞에서 집에 가야 한다며 나가려 하셨습니다."
          className="mt-[6px] w-full rounded-card border border-line-strong bg-paper-2 p-[14px] text-[1.0625rem] leading-[1.6] text-ink placeholder:text-ink-faint"
        />
        <div className="mt-[2px] flex justify-end">
          <button
            type="button"
            onClick={reset}
            disabled={empty}
            className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-field px-2 text-[0.9375rem] font-semibold text-ink-muted transition-colors duration-150 active:bg-paper-2 disabled:opacity-45"
          >
            지우기
          </button>
        </div>
      </div>

      <details className="group mt-4 border-y border-line">
        <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-3 rounded-field px-[2px] text-[1rem] leading-[1.45] font-bold text-ink transition-colors duration-150 active:bg-paper-2 [&::-webkit-details-marker]:hidden">
          <span>예시 문장 보기</span>
          <ChevronGlyph className="text-ink-ghost group-open:rotate-180" />
        </summary>
        <div className="pb-4">
          <p className="text-[0.9375rem] leading-[1.6] text-ink-soft">{EXAMPLE_FILL_TITLE}</p>
          <div className="mt-[8px] flex flex-wrap gap-2">
            {REPORT_EXAMPLES.map((example) => (
              <button
                key={example.id}
                type="button"
                onClick={() => setText(example.text)}
                aria-label={`${example.label} ${EXAMPLE_FILL_TITLE} — ${example.hint}`}
                className={EXAMPLE_BUTTON_CLASS}
              >
                {example.label}
              </button>
            ))}
          </div>
          <p className="mt-[8px] text-[0.8438rem] leading-[1.6] text-ink-soft">{EXAMPLE_NOTICE}</p>
        </div>
      </details>

      <details className="group mt-2 border-b border-line">
        <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-3 rounded-field px-[2px] text-[1rem] leading-[1.45] font-bold text-ink transition-colors duration-150 active:bg-paper-2 [&::-webkit-details-marker]:hidden">
          <span>개인정보 안내 보기</span>
          <ChevronGlyph className="text-ink-ghost group-open:rotate-180" />
        </summary>
        <div className="pb-4">
          <p className="text-[1rem] leading-[1.6] text-ink">
            마이크로 말씀하시면 휴대폰 회사(예: 삼성·구글)가 말을 글자로 바꿔 주는 기능을 씁니다.
            글자로 적으시면 그마저도 밖으로 나가지 않습니다.
          </p>
          <p className="mt-[6px] text-[1rem] leading-[1.6] text-ink-soft">
            어느 쪽이든 원문은 이 기기 안에서만 다루고 저장하지 않습니다. 다음 화면에서 무엇을
            가리는지 확인한 뒤 저장 단계로 갑니다.
          </p>
          <button
            type="button"
            onClick={focusTextarea}
            className="mt-[10px] flex min-h-[48px] w-full items-center justify-center rounded-card bg-paper-2 px-4 text-[1rem] font-bold text-ink transition-colors duration-150 active:bg-neutral-line"
          >
            글자로 적기
          </button>
        </div>
      </details>

      {!supported && phase === "idle" && (
        <p className="sr-only">마이크 지원 여부를 확인하고 있습니다.</p>
      )}

      {!empty && (
        <StickyCtaBar fixed>
          <BigButton size="lg" block onClick={onNext} disabled={capturing}>
            {capturing ? "먼저 받아쓰기를 멈춰 주세요" : "개인정보 확인하기"}
          </BigButton>
        </StickyCtaBar>
      )}
    </div>
  );
}

export default VoiceInput;
