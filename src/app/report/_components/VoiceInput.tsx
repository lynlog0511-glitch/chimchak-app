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
  "flex min-h-[48px] items-center rounded-card bg-paper-2 px-4 text-[0.8438rem] font-semibold transition-colors duration-150 active:bg-neutral-line";

/**
 * 마이크를 쓸 수 있는지 — **모르는 상태를 따로 둡니다**.
 *
 * 예전에는 `useState(false)`로 출발해, 서버가 내려주는 첫 화면에 「이 기기에서는 마이크를 쓸 수
 * 없습니다」가 그대로 박혀 있었습니다. 실제 판정은 마운트 뒤 `createRecognizer()`가 합니다.
 * 「말로 보고하면 기록 초안까지」를 보고 들어오신 분이 첫 글자로 「쓸 수 없습니다」를 읽으면,
 * 되는 기기인데도 그 몇 초 안에 타이핑 칸으로 가십니다(페르소나 현직 low · UI/UX high).
 *
 * 모르는 것은 모른다고 적습니다 — 같은 문법이 응급 저장 상태·자유 연습 게이트에 이미 있습니다.
 */
type MicCheck = "unknown" | "yes" | "no";

/** 마이크 조작 방식 — 꾹 누르기가 기본이고, 토글을 **병행**합니다. */
type MicMode = "hold" | "toggle";

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
  const [micCheck, setMicCheck] = useState<MicCheck>("unknown");
  const [micMode, setMicMode] = useState<MicMode>("hold");
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  /**
   * 받아쓰기 시작·정지를 낭독으로 전하는 문장 — 아래 **유일한 라이브 리전**이 읽습니다.
   * 처음에는 빈 문자열입니다: 화면이 열렸다는 이유로 말을 걸지 않습니다.
   */
  const [dictationNotice, setDictationNotice] = useState("");
  /** 「글자로 적기」로 옮겨 갈 자리 — 개인정보 안내 옆 버튼이 이 칸으로 초점을 보냅니다. */
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

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
        /* 끝났다는 사실은 **여기서 한 번만** 만듭니다 — `stopListening`은 듣고 있지 않을 때도
           불리는 자리가 있어(초점 이탈·키 떼기), 거기서 적으면 시작한 적 없는 정지가 발화됩니다.
           이 콜백은 사용자가 멈췄을 때만 옵니다(lib/speech — 침묵으로 브라우저가 끊은 것은
           조용히 다시 잇습니다). */
        setDictationNotice(
          "받아쓰기를 멈췄습니다. 적힌 내용은 아래 「보고 내용」 칸에서 고치실 수 있습니다.",
        );
      },
      onStart: () => setNotice(null),
    });
    recognizerRef.current = recognizer;
    setMicCheck(recognizer.supported ? "yes" : "no");
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
    setDictationNotice("받아쓰기를 시작했습니다. 말씀하시면 화면에 글로 적힙니다.");
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

  /** 토글 모드 — 한 번 눌러 시작, 다시 눌러 종료. 듣는 동안의 표시는 꾹 누르기와 같습니다. */
  const handleToggleClick = (): void => {
    if (listening) stopListening();
    else startListening();
  };

  const empty = value.trim().length === 0;
  const holdMode = micMode === "hold";

  /** 마이크 버튼 아래 한 줄 — 지금 실제로 일어나는 일만 적습니다. */
  const micCaption = listening
    ? holdMode
      ? "손을 떼면 받아쓰기가 멈춰요"
      : "다시 누르면 받아쓰기가 멈춰요"
    : micCheck === "unknown"
      ? "마이크를 확인하고 있어요"
      : micCheck === "yes"
        ? holdMode
          ? "누르고 있는 동안만 듣습니다. 상시 청취는 없습니다"
          : "누르시면 듣기 시작하고, 다시 누르면 멈춥니다. 상시 청취는 없습니다"
        : "이 기기에서는 마이크를 쓸 수 없습니다. 아래 칸에 적어 주세요";

  /** 「글자로 적기」 — 개인정보 안내 옆에서 곧바로 타이핑 칸으로 보냅니다. */
  const focusTextarea = (): void => {
    const field = textareaRef.current;
    if (!field) return;
    field.scrollIntoView({ block: "center" });
    field.focus();
  };

  return (
    <div>
      <h2 ref={headingRef} tabIndex={-1} className="text-[1.1875rem] leading-[1.3] font-bold tracking-[-0.015em] text-ink">
        오늘 있었던 일을 그대로 말씀해 주세요
      </h2>
      {/* 이 화면의 과업 지시문입니다 — 「무엇을 말하면 되는지」를 알려 주는 유일한 문장이라
          12.5px(메타 단)에서 15px로 올렸습니다. 이 화면은 15px 이상 본문이 한 줄도 없이
          12.5·13.5px에 몰려 있었습니다(페르소나 UI/UX med). */}
      <p className="mt-[6px] text-[0.9375rem] leading-[1.6] text-ink-soft">
        정리해서 말하지 않으셔도 됩니다. 기억나는 대로 말씀하시면 기기 안에서 개인정보를 가리고,
        급여제공기록지 5요소로 나눠 드립니다.
      </p>

      {/* 말하기 도크 — 면 카드 한 장 위에 마이크만 세웁니다.
          반지름은 `rounded-panel`입니다. 예전에는 같은 값을 `rounded-[16px]` 리터럴로 적고
          있었는데, 리터럴이 섞여 있으면 토큰(`--radius-panel`)을 고쳐도 이 한 장만 안 따라옵니다
          (2026-08-26 · 반지름 게이트가 거부 목록에서 허용 목록으로 뒤집히며 드러난 자리). */}
      <div
        onBlur={() => {
          /* 꾹 누르기에서만 초점이 빠지면 멈춥니다 — 손을 뗀 것과 같은 뜻이기 때문입니다.
             토글 모드에서는 「다시 누를 때까지 듣는다」가 약속이라, 초점이 옮겨 갔다고
             임의로 끊으면 화면이 한 말과 다르게 행동하게 됩니다. */
          if (listening && micMode === "hold") stopListening();
        }}
        className="mt-4 rounded-panel bg-paper-2 px-4 py-[18px]"
      >
        {listening && (
          <div className="mb-[14px] rounded-field bg-paper px-[14px] py-[12px]">
            <p className="flex items-center gap-[6px] text-[0.7813rem] leading-[1.45] font-bold text-danger-ink">
              <StatusDot tone="danger" size={8} />
              듣고 있어요
              <WaveBars count={5} className="ml-[2px]" />
            </p>
            {/* 실시간 자막은 읽어야 하는 문장입니다 — 가이드 §7.8의 15px 하한을 지킵니다
                (시안 4b의 16.5px 쪽으로 한 단 올린 값).
                **낭독은 하지 않습니다**: 인식 중간 결과라 글자가 들어올 때마다 바뀌고, 리전으로
                두면 낭독기가 부분 문장을 끝없이 다시 읽습니다. 눈으로 보는 확인용 자막이고,
                말로 전할 것은 아래 상자 하나가 맡습니다. */}
            <p className="mt-[6px] text-[0.9375rem] leading-[1.6] text-ink">
              {interim.length > 0 ? (
                <>
                  {interim}
                  <span aria-hidden className="ml-[1px] text-brand-600">
                    |
                  </span>
                </>
              ) : (
                <span className="text-ink-faint">말씀을 기다리고 있어요.</span>
              )}
            </p>
          </div>
        )}

        <div className="flex flex-col items-center gap-[10px]">
          {/* 조작 방식만 갈립니다 — 듣는 동안의 표시(빨간 점·파형·「듣고 있어요」·실시간 자막)는
              두 모드에서 똑같이 유지됩니다. 「누르고 있는 동안만 듣는다」는 약속을 조작으로
              증명한 설계는 그대로 두되, 하루 근무를 한 번에 불러넣는 이 화면에서는 20~40초를
              손가락으로 누르고 있어야 했습니다(페르소나 UI/UX med). 약속은 「듣는 동안 화면이
              반드시 그 사실을 표시한다」로도 지켜집니다. */}
          {holdMode ? (
            <MicButton
              size={listening ? "lg" : "md"}
              pressed={listening}
              label={
                listening
                  ? "말하는 중입니다. 손을 떼면 받아쓰기가 멈춥니다"
                  : "누르고 있는 동안 말씀을 받아 적습니다"
              }
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
              onPointerCancel={stopListening}
              onKeyDown={handleKeyDown}
              onKeyUp={handleKeyUp}
            />
          ) : (
            <MicButton
              size={listening ? "lg" : "md"}
              pressed={listening}
              label={
                listening
                  ? "받아쓰는 중입니다. 다시 누르면 멈춥니다"
                  : "누르면 말씀을 받아 적기 시작합니다"
              }
              onClick={handleToggleClick}
            />
          )}
          {/* 마이크 아래 한 줄 — 눈으로 읽는 설명입니다. 리전이 아닙니다:
              `listening`이 켜지는 바로 그 순간 문구가 바뀌어, 시작 알림과 겹쳐 발화했습니다.
              같은 내용은 마이크 버튼의 이름(`MicButton`의 `label`)이 이미 들고 있습니다. */}
          <p className="text-center text-[0.7813rem] leading-[1.45] font-semibold text-ink-soft">
            {micCaption}
          </p>
          {/* 모드 바꾸기 — 듣는 중에는 숨깁니다(조작 방식이 도중에 바뀌면 손이 갈 곳을 잃습니다). */}
          {micCheck === "yes" && !listening && (
            <button
              type="button"
              onClick={() => setMicMode(holdMode ? "toggle" : "hold")}
              className="flex min-h-[48px] items-center rounded-field px-2 text-[0.8438rem] font-semibold text-ink-muted underline underline-offset-4 transition-colors duration-150 active:bg-paper"
            >
              {holdMode
                ? "누르고 있기가 힘드시면 눌러서 시작·종료로 바꾸기"
                : "다시 누르고 있기로 바꾸기"}
            </button>
          )}
        </div>

        {/* 경고는 화면에만 그립니다 — 읽어 주는 일은 아래 상자가 맡습니다. */}
        {notice && (
          <p className="mt-[12px] rounded-field bg-warn-soft px-[14px] py-[10px] text-[0.7813rem] leading-[1.6] font-semibold text-warn-ink">
            {notice}
          </p>
        )}

        {/* ── 이 화면의 **유일한** 라이브 리전 ──────────────────────────
            예전에는 실시간 자막·마이크 아래 한 줄·경고 셋이 각자 리전이라, 받아쓰기를 시작하는
            순간 둘이 겹쳐 발화하고 이후에는 자막이 부분 문장으로 흘러넘쳤습니다
            (3차 페르소나 UI/UX low). 훈련 도크가 같은 문제를 「상자 하나가 우선순위로 삼킨다」로
            푼 처방을 그대로 옮겨 옵니다(`CueResponder`의 sr-only 상자).
            세는 단위는 `aria-live` 속성의 개수가 아니라 **동시에 발화할 수 있는 리전의 수**입니다
            (`DialogueLog` 주석에 정의를 적어 두었습니다).
            순서는 막아선 일(경고) → 방금 일어난 일(시작·정지)입니다. 빈 문자열일 때도 상자를
            남겨 둬야 다음 문장이 바뀐 줄로 읽힙니다. */}
        <p role="status" className="sr-only">
          {notice ?? dictationNotice}
        </p>
      </div>

      {/* 직접 적기 — 마이크가 없어도 여기까지만으로 끝까지 갑니다. */}
      <div className="mt-5">
        <label htmlFor="report-utterance" className="text-[0.8438rem] leading-[1.45] font-bold text-ink">
          보고 내용 (직접 적으셔도 됩니다)
        </label>
        <textarea
          id="report-utterance"
          ref={textareaRef}
          value={value}
          onChange={(event) => {
            onInputStart();
            onChange(event.target.value);
          }}
          rows={7}
          placeholder="예) 오후 4시 40분쯤 어르신이 현관 앞에서 집에 가야 한다며 나가려 하셨습니다."
          /* 입력 글자는 17px(코어 단)입니다 — 16px 미만이면 iOS가 포커스 순간 화면을 강제로 확대하고,
             확대된 화면은 손으로 되돌려야 합니다(주 사용자가 중고령이라 그 되돌림이 곧 이탈입니다).

             바닥은 흰색이 아니라 `paper-2`입니다: 흰 지면 위 흰 입력칸은 보더에만 기대어 「여기가
             적는 자리」를 말해야 해서 회색 면보다 약합니다(가이드 §1 — 입력 필드는 paper-2 면 하나).
             `focus:border-brand-400`은 뗐습니다 — 전역 포커스 outline(brand-600)과 2px 간격으로
             겹쳐 틸 두 겹이 번져 보였습니다(페르소나 디자이너 low). */
          className="mt-[6px] w-full rounded-card border border-line-strong bg-paper-2 p-[14px] text-[1.0625rem] leading-[1.6] text-ink placeholder:text-ink-faint"
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

        {/* 예시 고지 — 11px(각주 단)에서 12.5px로 올려 아래 개인정보 안내와 같은 단에 둡니다.
            화면이 길어지는 만큼은 위 과업 지시문을 올리며 상쇄합니다(페르소나 UI/UX med). */}
        <p className="mt-[8px] text-[0.7813rem] leading-[1.6] text-ink-faint">{EXAMPLE_NOTICE}</p>
      </div>

      {/* 개인정보 안내 — 이 화면이 신뢰를 얻는 두 문장 중 하나라 15px로 올립니다.
          그리고 **결론을 사람 말로 먼저** 놓습니다. 예전 문장은 「음성과 원문은 이 기기 안에서만
          다루고 저장하지 않습니다」로 마음을 놓게 한 뒤, 화면 끝 접힘에서 「제조사 서버를 경유할
          수 있고」로 다시 조였습니다 — 「제조사」도 「경유」도 어려운 말이라, 남는 인상은
          「그래서 내 말이 밖으로 나가긴 나간다」 하나였습니다(페르소나 현직 med).
          사실은 한 글자도 달라지지 않았습니다. 말을 바꿨고, 밖으로 안 나가는 길(타이핑)을
          그 자리에 버튼으로 세웠습니다. */}
      <div className="mt-5 rounded-card bg-paper-2 px-4 py-[14px]">
        <p className="text-[0.9375rem] leading-[1.6] text-ink">
          마이크로 말씀하시면 휴대폰 회사(예: 삼성·구글)가 말을 글자로 바꿔 주는 기능을 씁니다.
          글자로 적으시면 그마저도 밖으로 나가지 않습니다.
        </p>
        <p className="mt-[6px] text-[0.9375rem] leading-[1.6] text-ink-soft">
          어느 쪽이든 말씀하신 원문은 이 기기 안에서만 다루고 저장하지 않습니다. 다음 화면에서
          무엇을 왜 가리는지 먼저 확인하신 뒤에 넘어갑니다.
        </p>
        <button
          type="button"
          onClick={focusTextarea}
          className="mt-[8px] flex min-h-[48px] w-full items-center justify-center rounded-card border border-line-strong bg-paper text-[0.9375rem] font-bold text-ink transition-colors duration-150 active:bg-paper"
        >
          글자로 적기
        </button>
      </div>

      <BigButton size="lg" block className="mt-4" onClick={onNext} disabled={empty}>
        가리기로 넘어가기
      </BigButton>
      {empty && (
        <p className="mt-[6px] text-center text-[0.7813rem] leading-[1.45] text-ink-faint">
          말씀하시거나 적어 주시면 다음 단계로 넘어갈 수 있습니다
        </p>
      )}
    </div>
  );
}

export default VoiceInput;
