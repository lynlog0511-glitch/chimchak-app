"use client";

import { useEffect, useRef, useState } from "react";
import type {
  PointerEvent as ReactPointerEvent,
  KeyboardEvent as ReactKeyboardEvent,
  Ref,
} from "react";
import { BigButton, MicButton, StatusDot, WaveBars } from "@/components";
import { createRecognizer, type Recognizer } from "@/lib/speech";
import { EXAMPLE_FILL_TITLE, EXAMPLE_NOTICE, REPORT_EXAMPLES } from "./examples";

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
  /**
   * 이 단계의 제목에 붙는 ref — 단계가 바뀔 때 위저드가 여기로 초점을 옮깁니다.
   * (스크린리더가 새 단계 제목을 읽고, 화면도 맨 위에서 시작합니다.)
   */
  headingRef?: Ref<HTMLHeadingElement>;
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
 * 예시 채우기 버튼의 공통 클래스 — 기존 두 버튼이 쓰던 값 그대로입니다(48px 타깃 포함).
 * 글자색만 갈립니다: 맨 앞 한 종은 잉크로 세우고(시연에서 먼저 누르는 문장), 나머지는 한 단 물러섭니다.
 */
const EXAMPLE_BUTTON_CLASS =
  "flex min-h-[48px] items-center rounded-[14px] bg-paper-2 px-4 text-[0.8438rem] font-semibold transition-colors duration-150 active:bg-neutral-line";

/**
 * 1단계 입력 화면 (v4 언어 · 시안 4a⑦·4b의 마이크와 녹음 패널을 그대로 씁니다).
 *
 * 마이크는 **누르고 있는 동안에만** 인식하고, 타이핑 입력은 항상 열려 있습니다.
 * 음성 인식이 되지 않는 환경에서도 타이핑만으로 끝까지 진행할 수 있습니다.
 */
export function VoiceInput({
  value,
  onChange,
  onNext,
  onInputStart,
  headingRef,
}: VoiceInputProps) {
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
    <div>
      <h2 ref={headingRef} tabIndex={-1} className="text-[1.0625rem] leading-[1.45] font-bold text-ink">
        오늘 있었던 일을 그대로 말씀해 주세요
      </h2>
      <p className="mt-[6px] text-[0.7813rem] leading-[1.6] text-ink-muted">
        정리해서 말하지 않으셔도 됩니다. 기억나는 대로 말씀하시면 기기 안에서 개인정보를 가리고,
        급여제공기록지 5요소로 나눠 드립니다.
      </p>

      {/* 말하기 도크 — 면 카드 한 장 위에 마이크만 세웁니다. */}
      <div
        onBlur={() => {
          if (listening) stopListening();
        }}
        className="mt-4 rounded-[16px] bg-paper-2 px-4 py-[18px]"
      >
        {listening && (
          <div className="mb-[14px] rounded-[12px] bg-white px-[14px] py-[12px]">
            <p className="flex items-center gap-[6px] text-[0.7813rem] leading-[1.45] font-bold text-danger-ink">
              <StatusDot tone="danger" size={8} />
              듣고 있어요
              <WaveBars count={5} className="ml-[2px]" />
            </p>
            {/* 실시간 자막은 읽어야 하는 문장입니다 — 가이드 §7.8의 15px 하한을 지킵니다
                (시안 4b의 16.5px 쪽으로 한 단 올린 값). */}
            <p aria-live="polite" className="mt-[6px] text-[0.9375rem] leading-[1.6] text-ink">
              {interim.length > 0 ? (
                <>
                  {interim}
                  <span aria-hidden className="ml-[1px] text-brand-600">
                    |
                  </span>
                </>
              ) : (
                <span className="text-tertiary">말씀을 기다리고 있어요.</span>
              )}
            </p>
          </div>
        )}

        <div className="flex flex-col items-center gap-[10px]">
          <MicButton
            size={listening ? "lg" : "md"}
            pressed={listening}
            label={
              listening
                ? "말하는 중 — 손을 떼면 받아쓰기가 멈춥니다"
                : "누르고 있는 동안 말씀을 받아 적습니다"
            }
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={stopListening}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
          />
          <p className="text-center text-[0.7813rem] leading-[1.45] font-semibold text-ink-soft">
            {listening
              ? "손을 떼면 받아쓰기가 멈춰요"
              : supported
                ? "누르고 있는 동안만 듣습니다 — 상시 청취는 없습니다"
                : "이 기기에서는 마이크를 쓸 수 없습니다. 아래 칸에 적어 주세요"}
          </p>
        </div>

        {notice && (
          <p
            role="status"
            className="mt-[12px] rounded-[12px] bg-warn-soft px-[14px] py-[10px] text-[0.7813rem] leading-[1.6] font-semibold text-warn-ink"
          >
            {notice}
          </p>
        )}
      </div>

      {/* 직접 적기 — 마이크가 없어도 여기까지만으로 끝까지 갑니다. */}
      <div className="mt-5">
        <label htmlFor="report-utterance" className="text-[0.8438rem] leading-[1.45] font-bold text-ink">
          보고 내용 (직접 적으셔도 됩니다)
        </label>
        <textarea
          id="report-utterance"
          value={value}
          onChange={(event) => {
            onInputStart();
            onChange(event.target.value);
          }}
          rows={7}
          placeholder="예) 오후 4시 40분쯤 어르신이 현관 앞에서 집에 가야 한다며 나가려 하셨습니다."
          /* 입력 글자는 17px(코어 단)입니다 — 16px 미만이면 iOS가 포커스 순간 화면을 강제로 확대하고,
             확대된 화면은 손으로 되돌려야 합니다(주 사용자가 중고령이라 그 되돌림이 곧 이탈입니다). */
          className="mt-[6px] w-full rounded-[14px] border border-line-strong bg-white p-[14px] text-[1.0625rem] leading-[1.6] text-ink placeholder:text-tertiary focus:border-brand-400"
        />

        {/* 지우기는 예시가 아니라 위 입력칸에 딸린 조작이라, 예시 목록에서 빼 칸 아래에 둡니다. */}
        <div className="mt-[2px] flex justify-end">
          <button
            type="button"
            onClick={() => onChange("")}
            disabled={empty}
            className="flex min-h-[48px] items-center rounded-field px-2 text-[0.8438rem] font-semibold text-ink-muted transition-colors duration-150 active:bg-paper-2 disabled:opacity-45"
          >
            지우기
          </button>
        </div>

        {/* 「예시로 채워 보기」는 여기서 한 번만 말하고, 버튼에는 상황 이름만 답니다. */}
        <p className="mt-[6px] text-[0.8438rem] leading-[1.45] font-bold text-ink">
          {EXAMPLE_FILL_TITLE}
        </p>

        <div className="mt-[6px] flex flex-wrap gap-2">
          {REPORT_EXAMPLES.map((example, index) => (
            <button
              key={example.id}
              type="button"
              onClick={() => onChange(example.text)}
              /* 라벨만으로는 이 예시로 무엇을 보는지가 화면에 남지 않아, 표가 들고 있는 한 줄 설명을
                 접근성 이름 뒤에 이어 붙입니다(보이는 라벨이 이름의 앞머리라 음성 조작과도 어긋나지 않습니다). */
              aria-label={`${example.label} ${EXAMPLE_FILL_TITLE} — ${example.hint}`}
              className={`${EXAMPLE_BUTTON_CLASS} ${index === 0 ? "text-ink" : "text-ink-soft"}`}
            >
              {example.label}
            </button>
          ))}
        </div>

        <p className="mt-[8px] text-[0.6875rem] leading-[1.6] text-tertiary">{EXAMPLE_NOTICE}</p>
      </div>

      <p className="mt-5 text-[0.7813rem] leading-[1.6] text-ink-soft">
        음성과 원문은 이 기기 안에서만 다루고 저장하지 않습니다. 다음 화면에서 무엇을 왜 가리는지
        먼저 확인하신 뒤에 진행됩니다.
      </p>

      <BigButton size="lg" block className="mt-4" onClick={onNext} disabled={empty}>
        가리기로 넘어가기
      </BigButton>
      {empty && (
        <p className="mt-[6px] text-center text-[0.7813rem] leading-[1.45] text-tertiary">
          말씀하시거나 적어 주시면 다음 단계로 넘어갈 수 있습니다
        </p>
      )}
    </div>
  );
}

export default VoiceInput;
