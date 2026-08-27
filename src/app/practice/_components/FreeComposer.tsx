"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { BigButton, InlineDisclaimer, MicButton } from "@/components";
import { cx } from "@/components/utils";
import { MASK_PARTIAL_NOTICE, hasPartialMask, maskText } from "@/engine/masking";
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

  /**
   * 가림 규칙이 값의 **일부만** 물고 지나갔는지 — 보내기 전에 한 줄로 밝힙니다.
   *
   * 이 판정은 여태 /report 2단계에만 서 있었습니다. 그런데 거기에는 사람이 한 글자씩 보는 검토
   * 단계가 있고(「직접 가리기」), 여기에는 없습니다. **정작 문자열이 기기 밖으로 나가는 경로에서
   * 그 신호가 빠져 있던 자리**입니다.
   *
   * 보내는 순간이 아니라 **적는 동안** 세웁니다 — 보낸 뒤에 알려 주면 할 수 있는 일이 없고,
   * 지금은 고쳐서 보내는 길이 손에 닿습니다. 판정은 순수 함수라 원문을 어디에도 남기지 않고,
   * 화면의 입력창은 그대로입니다(자기 기기 안에서 자기가 한 말을 가릴 이유가 없습니다).
   */
  const partialMask = useMemo(() => {
    const text = value.trim();
    return text.length > 0 && hasPartialMask(maskText(text));
  }, [value]);

  /**
   * 이 컴포저가 **말로 전하는 한 줄** — 우선순위 상자 하나입니다.
   *
   * 2026-08-27에 조건부 리전 둘을 이 상자 하나로 합쳤습니다. 두 가지가 함께 걸려 있던 자리입니다.
   * ① 「리전은 늘 그려 둔다」 — 알림과 함께 리전이 생기면 읽지 않는 리더가 있는데, 두 줄 다
   *    `{조건 && <p role="status">}` 꼴이라 문장이 생기는 순간 상자도 함께 태어났습니다.
   *    하필 그중 하나(부분 가림 경고)는 **문자열이 기기 밖으로 나가는 유일한 경로**에서 보내기
   *    전에 알리려고 만든 줄이라, 낭독에 닿지 않으면 만든 이유가 사라집니다.
   * ② 「세는 단위는 동시에 발화할 수 있는 리전의 수」 — 이 화면에는 대화 로그 리전이 새로
   *    생겼으므로(`FreeDialogue`), 컴포저가 리전 둘을 더 들면 셋이 됩니다.
   * (5차에 파일·행까지 이름이 오른 넷 중 둘 · 7차 페르소나 UI/UX P0·low)
   *
   * 순서는 **급한 것부터**입니다 — 서버가 못 받은 사정(`notice`) → 마이크(`micNotice`) →
   * 보내기 전 경고(`partialMask`). 보이는 줄은 아래 두 자리가 그대로 맡습니다(화면 전용).
   */
  const liveNotice = notice ?? micNotice ?? (!closed && partialMask ? MASK_PARTIAL_NOTICE : "");

  return (
    <section className="mt-5 border-t border-line pt-3">
      {/* 처음부터 빈 상자로 서 있어야 다음 문장이 「바뀐 줄」로 읽힙니다 — 서버 렌더부터 섭니다. */}
      <p role="status" className="sr-only">
        {liveNotice}
      </p>
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
            {/* 입력 상자의 반지름은 `rounded-chip`(999px)입니다 — 예전에는 `rounded-[18px]`이라
                높이는 rem(`min-h-12` = 3rem)인데 반지름만 px에 묶여, 「아주 크게」(125%)에서
                높이가 3.75rem으로 자라도 모서리는 18px에 머물러 양 끝이 반원이 아니었습니다.
                옆 화면의 같은 역할(세션 컴포저 `CueResponder`)이 8/26에 같은 이유로 먼저
                고쳐졌는데 이 형제만 남아 있었습니다 — 규칙은 값이 아니라 **조합**입니다:
                rem 높이 + px 반지름은 배율이 오르면 반드시 어긋납니다(5차 페르소나 디자이너 low).
                이제 반지름 게이트가 허용 목록이라, 토큰 없는 px 반지름은 사유와 함께 등재하지
                않는 한 통과하지 못합니다. */}
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
                "min-h-12 min-w-0 flex-1 resize-none rounded-chip border border-line-strong bg-paper-2",
                "px-4 py-3 text-[1.0625rem] leading-[1.45] text-ink placeholder:text-ink-muted",
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
              듣고 있어요. 손을 떼면 멈춰요. 보내기 전에 고치실 수 있어요.
            </p>
          )}

          {/* 부분 가림 경고 — /report 2단계와 **같은 문장**입니다(engine/masking.ts).
              말은 위 우선순위 상자가 맡으므로 여기에는 `role`을 달지 않습니다. */}
          {partialMask && (
            <p className="mt-2 text-[0.8438rem] leading-[1.6] font-semibold text-warn-ink">
              {MASK_PARTIAL_NOTICE}
            </p>
          )}

          <BigButton block disabled={!canSend} onClick={onSend} className="mt-2.5">
            {COMPOSER_SEND}
          </BigButton>
        </>
      )}

      {/* 화면 전용 — 말은 위 우선순위 상자 하나가 맡습니다. */}
      {(micNotice || notice) && (
        <p className="mt-2.5 text-[0.9375rem] leading-[1.6] text-warn-ink">
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
