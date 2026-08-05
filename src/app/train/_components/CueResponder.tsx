"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BigButton, InlineDisclaimer, MicButton, StatusDot, WaveBars } from "@/components";
import { cx } from "@/components/utils";
import { cueOptions } from "@/engine";
import { getSettings, subscribeSettings, type FontScale } from "@/lib/settings";
import { createRecognizer, stopSpeaking, type Recognizer } from "@/lib/speech";
import type { CueDef, Scenario, SessionState } from "@/types";
import { RecordDraftPreview } from "./RecordDraftPreview";
import {
  RULE_DEMO_HINT,
  RULE_DEMO_NO_CRITICAL_NOTE,
  RULE_DEMO_NOTE,
  RULE_DEMO_TITLE,
  ruleDemoExamplesFor,
  type RuleDemoExample,
} from "./ruleDemoExamples";
import { isReportCue } from "./sessionMachine";

export interface CueResponderProps {
  scenario: Scenario;
  session: SessionState;
  cue: CueDef;
  /** CUE 시도 횟수 — 값이 바뀌면 입력창과 대기 타이머를 초기화합니다 */
  attempt: number;
  /** 음성 인식 가능 여부 (마운트 후 판정된 값) */
  micSupported: boolean;
  /**
   * ⚑CF 시트에서 고르신 대안 문장.
   * 같은 CUE로 돌아왔을 때 **보기 목록 맨 위에 그대로** 다시 세워, 버튼만으로도 이어가실 수 있게 합니다.
   */
  chosenAlternative?: string;
  /** 컴포저 맨 위에 얹을 한 줄 (「새로 말씀하셨어요 ↑」 앵커) */
  anchor?: ReactNode;
  onSubmit: (input: { utterance?: string; branchId?: string; viaButton: boolean }) => void;
  /** 말하는 중(시안 4b)일 때 본문을 흐리게 하려고 부모에게 알립니다 */
  onListeningChange?: (listening: boolean) => void;
}

/** 마이크 첫 사용 안내를 이미 보셨는지 기억하는 자리 (기기 안에만 남습니다) */
const MIC_INTRO_KEY = "chimchak.micIntro.v1";

/** 마이크 권한 상태 — permissions API가 없는 브라우저는 "unknown"으로 둡니다. */
type MicPermission = "unknown" | "prompt" | "granted" | "denied";

/**
 * md↑ 2단 화면에서 도크(컴포저)가 가져갈 수 있는 세로 상한.
 *
 * 데스크톱 세션은 뷰포트 높이 안에 갇혀 있고, 대화 로그가 남는 자리를 나눠 씁니다.
 * 글자 크기를 키우면 CUE 질문·제안 버튼·입력바가 함께 커져 도크가 두꺼워지는데,
 * 상한을 62dvh로 고정해 두면 그만큼 로그가 깎입니다 —
 * **접근성 설정을 켤수록 읽을 면적이 줄어드는 역전**이 생깁니다(평가 UI/UX m7 실측).
 * 그래서 글자가 커질수록 도크 상한을 한 단계씩 내려 로그 면적을 지킵니다.
 * 도크 안쪽은 스크롤되므로 상한을 내려도 보기·입력은 전부 닿습니다.
 *
 * 모바일에는 상한이 없습니다 — 페이지 스크롤 하나로 흐르기 때문입니다(가이드 §5).
 */
const DOCK_MAX_H: Record<FontScale, string> = {
  standard: "md:max-h-[62dvh]",
  large: "md:max-h-[54dvh]",
  xlarge: "md:max-h-[48dvh]",
};

/**
 * 지금 설정된 글자 크기. 서버 렌더에서는 「표준」으로 두고 마운트 뒤에 실제 값으로 맞춥니다
 * (설정은 기기 안 localStorage에만 있어 서버가 알 수 없습니다).
 */
function useFontScale(): FontScale {
  const [scale, setScale] = useState<FontScale>("standard");

  useEffect(() => {
    setScale(getSettings().fontScale);
    return subscribeSettings((settings) => setScale(settings.fontScale));
  }, []);

  return scale;
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
 * 입력 도크 (시안 4a 하단 · 4b 말하는 중).
 *
 * 세 가지 길을 항상 동시에 열어 둡니다.
 *  ① 마이크를 누르고 있는 동안 말하기 → 인식된 문장을 **보내기 전에 고친 뒤** 전송
 *  ② 제안 버튼 (마이크가 없어도 끝까지 완주할 수 있게 하는 1급 시민)
 *  ③ 직접 입력 pill → 누르면 확장되는 입력창
 *
 * 도크는 화면 아래에 붙어 있고, 대화 본문은 그 위에서 따로 스크롤합니다.
 */
export function CueResponder({
  scenario,
  session,
  cue,
  attempt,
  micSupported,
  chosenAlternative,
  anchor,
  onSubmit,
  onListeningChange,
}: CueResponderProps) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [micIntroOpen, setMicIntroOpen] = useState(false);
  const [micPermission, setMicPermission] = useState<MicPermission>("unknown");
  /** 규칙 엔진 예시 문장을 방금 채워 넣었는지 (전송은 사용자가 직접 하십니다) */
  const [filledExampleId, setFilledExampleId] = useState<string | null>(null);
  /** 글자 크기 — 도크 상한을 여기에 맞춰 내립니다(로그 면적 역전 방지) */
  const fontScale = useFontScale();
  const recognizerRef = useRef<Recognizer | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  /** 권한 팝업이 떠 있는 첫 회에만 인식을 끊지 않고 안내로 대신합니다 */
  const micGraceUsedRef = useRef(false);

  const options = useMemo(() => cueOptions(scenario, session), [scenario, session]);
  const reportMode = useMemo(() => isReportCue(scenario, cue), [scenario, cue]);
  /** 지금 화면에서 실제로 발동하는 규칙 예시만 남깁니다 (유형·CUE 게이트 반영) */
  const demoExamples = useMemo(
    () => ruleDemoExamplesFor(scenario.type, cue.id),
    [scenario.type, cue.id],
  );
  const filledExample = demoExamples.find((example) => example.id === filledExampleId);
  const resetKey = `${cue.id}-${attempt}`;
  const secondsLeft = useCountdown(cue.waitSec, resetKey);
  const timeUp = secondsLeft <= 0;
  /** 입력창이 열려 있는 상태 — 인식 결과가 들어오면 저절로 열립니다(전송 전 확인). */
  const composing = expanded || text.trim().length > 0;

  useEffect(() => {
    setText("");
    setExpanded(false);
    setNotice(null);
    setFilledExampleId(null);
  }, [resetKey]);

  useEffect(() => {
    return () => {
      recognizerRef.current?.stop();
    };
  }, []);

  /** 말하는 중 상태를 부모(세션 화면)에게 알립니다 — 본문을 흐리게 하는 신호입니다. */
  useEffect(() => {
    onListeningChange?.(listening);
    return () => {
      if (listening) onListeningChange?.(false);
    };
  }, [listening, onListeningChange]);

  /** 세션 최초 1회 마이크 안내 — 기기에 본 적 있음이 남아 있으면 띄우지 않습니다. */
  useEffect(() => {
    if (!micSupported) return;
    let seen = false;
    try {
      seen = window.localStorage.getItem(MIC_INTRO_KEY) === "1";
    } catch {
      // 저장소를 쓸 수 없는 환경에서는 매번 안내해 드립니다 (안내가 없는 것보다 안전합니다).
      seen = false;
    }
    if (!seen) setMicIntroOpen(true);
  }, [micSupported]);

  const closeMicIntro = useCallback(() => {
    setMicIntroOpen(false);
    try {
      window.localStorage.setItem(MIC_INTRO_KEY, "1");
    } catch {
      // 저장에 실패해도 이번 화면에서는 안내를 닫아 드립니다.
    }
  }, []);

  /**
   * 마이크 권한이 아직 정해지지 않았는지(prompt) 살펴 둡니다.
   * permissions API가 없는 브라우저에서는 조용히 넘어가고, 안내 문구만으로 충분합니다.
   */
  useEffect(() => {
    const permissions = typeof navigator === "undefined" ? undefined : navigator.permissions;
    if (!permissions || typeof permissions.query !== "function") return;

    let cancelled = false;
    let status: PermissionStatus | null = null;
    const apply = () => {
      if (!cancelled && status) setMicPermission(status.state);
    };

    permissions
      .query({ name: "microphone" as PermissionName })
      .then((result) => {
        if (cancelled) return;
        status = result;
        apply();
        result.addEventListener("change", apply);
      })
      .catch(() => {
        // 이 브라우저는 마이크 권한 조회를 지원하지 않습니다 — 안내 문구로 대신합니다.
      });

    return () => {
      cancelled = true;
      status?.removeEventListener("change", apply);
    };
  }, []);

  const ensureRecognizer = useCallback((): Recognizer => {
    if (!recognizerRef.current) {
      recognizerRef.current = createRecognizer({
        onStart: () => {
          setListening(true);
          setNotice(null);
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
      setNotice(
        "이 기기에서는 음성 인식을 쓸 수 없습니다. 아래 버튼이나 직접 입력으로 진행해 주세요.",
      );
      return;
    }
    setNotice(null);
    recognizer.start();
  }, [ensureRecognizer, listening]);

  const stopListening = useCallback(() => {
    recognizerRef.current?.stop();
    setListening(false);
  }, []);

  /**
   * 마이크 버튼에서 손을 떼셨을 때.
   *
   * 권한이 아직 정해지지 않은 첫 회에는 브라우저 허용 팝업이 떠 있는 중이므로,
   * 인식을 끊지 않고 "허용 후 다시 눌러 주세요" 안내로 대신합니다.
   */
  const releaseMic = useCallback(() => {
    if (micPermission === "prompt" && !micGraceUsedRef.current) {
      micGraceUsedRef.current = true;
      setNotice(
        "브라우저가 마이크 사용을 허용할지 묻고 있습니다. ‘허용’을 누르신 뒤 버튼을 꾹 누른 채로 말씀해 주세요. 마이크 없이 아래 버튼만으로도 끝까지 진행하실 수 있습니다.",
      );
      return;
    }
    stopListening();
  }, [micPermission, stopListening]);

  /** 누르고 있는 동안 — 버튼이 52px↔64px로 자리를 옮겨도 손을 뗀 것을 놓치지 않기 위한 표시 */
  const pressingRef = useRef(false);

  const beginPress = useCallback(() => {
    pressingRef.current = true;
    startListening();
  }, [startListening]);

  const endPress = useCallback(() => {
    if (!pressingRef.current) return;
    pressingRef.current = false;
    releaseMic();
  }, [releaseMic]);

  /**
   * 손을 떼는 순간 마이크 버튼은 64px에서 52px 자리로 되돌아갑니다.
   * 그 사이 pointerup이 버튼 밖에서 일어나도 녹음이 끊기도록 창 전체에서 받습니다.
   */
  useEffect(() => {
    const onUp = () => endPress();
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === " " || event.key === "Enter") endPress();
    };
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [endPress]);

  const send = useCallback(() => {
    const utterance = text.trim();
    if (utterance.length === 0) return;
    stopListening();
    setText("");
    setExpanded(false);
    setNotice(null);
    setFilledExampleId(null);
    onSubmit({ utterance, viaButton: false });
  }, [onSubmit, stopListening, text]);

  /**
   * ⚑CF 시트에서 고르신 대안을 **그 문장 그대로** 보냅니다.
   * 판정은 규칙 엔진이 다시 합니다 — 화면이 결과를 미리 정하지 않습니다.
   */
  const sendAlternative = useCallback(
    (sentence: string) => {
      stopListening();
      setText("");
      setExpanded(false);
      setNotice(null);
      setFilledExampleId(null);
      onSubmit({ utterance: sentence, viaButton: true });
    },
    [onSubmit, stopListening],
  );

  const pick = useCallback(
    (branchId: string) => {
      stopListening();
      setText("");
      setExpanded(false);
      setNotice(null);
      setFilledExampleId(null);
      onSubmit({ branchId, viaButton: true });
    },
    [onSubmit, stopListening],
  );

  /**
   * 규칙 엔진 예시 문장을 입력창에 **채우기만** 합니다.
   * 전송은 사용자가 직접 「이 내용으로 답하기」를 눌러 정하십니다 (자동 전송하지 않습니다).
   */
  const fillExample = useCallback(
    (example: RuleDemoExample) => {
      stopListening();
      setNotice(null);
      setExpanded(true);
      setText(example.sentence);
      setFilledExampleId(example.id);
      window.requestAnimationFrame(() => {
        const node = textareaRef.current;
        if (!node) return;
        node.focus();
        const caret = example.sentence.length;
        node.setSelectionRange(caret, caret);
      });
    },
    [stopListening],
  );

  const openInput = useCallback(() => {
    setExpanded(true);
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  /* ── 말하는 중 (시안 4b) ─────────────────────────────────── */

  if (listening) {
    return (
      <div className="flex-none border-t border-line bg-paper">
        {/* md↑에서는 가운데 대화 폭(560px)에 맞춰 도크 안쪽만 좁힙니다 — 시안 7d */}
        <div className="mx-auto w-full max-w-[624px] px-[18px] pt-3.5 pb-7 md:px-8">
          <p className="mb-3.5 text-[1.0625rem] leading-[1.5] font-bold text-ink">{cue.prompt}</p>

          <div className="rounded-panel bg-paper-2 px-4 py-3.5">
            <div className="mb-2 flex items-center gap-1.5">
              <StatusDot tone="danger" size={8} />
              <span className="text-[0.7813rem] leading-[1.4] font-bold text-ink-soft">
                듣고 있어요
              </span>
              <WaveBars count={5} className="ml-auto" />
            </div>
            <p aria-live="polite" className="text-[1.0313rem] leading-[1.55] text-ink">
              {text.trim().length > 0 ? (
                <>
                  <span aria-hidden>“</span>
                  {text}
                  <span className="text-tertiary" aria-hidden>
                    …”
                  </span>
                </>
              ) : (
                <span className="text-tertiary">말씀을 기다리고 있어요</span>
              )}
              <span
                aria-hidden
                className="relative top-[3px] ml-0.5 inline-block h-[17px] w-[2px] bg-brand-600"
              />
            </p>
          </div>

          <div className="mt-3 mb-1.5 flex justify-center">
            <MicButton
              size="lg"
              pressed
              label="말하는 중 — 손을 떼면 전송 전 확인으로 넘어갑니다"
              onPointerUp={endPress}
              onPointerCancel={endPress}
              onKeyUp={(event) => {
                if (event.key === " " || event.key === "Enter") {
                  event.preventDefault();
                  endPress();
                }
              }}
            />
          </div>

          <p className="text-center text-[0.8125rem] leading-[1.5] font-semibold text-ink-soft">
            손을 떼면 전송돼요
          </p>
          <p className="mt-1 text-center text-[0.75rem] leading-[1.5] text-tertiary">
            잘못 들렸다면 보내기 전에 고칠 수 있어요
          </p>

          <InlineDisclaimer tone="readable" className="mt-3" />
        </div>
      </div>
    );
  }

  /* ── 기본 (시안 4a) ──────────────────────────────────────── */

  return (
    <div className="flex-none border-t border-line bg-paper">
      {anchor}
      {/* 모바일에서는 페이지 스크롤 하나입니다 — 도크 안에서 따로 스크롤하지 않습니다(가이드 §5).
          md↑ 2단 화면만 뷰포트에 고정되므로 거기서만 도크 높이에 상한을 둡니다.
          상한은 글자 크기를 따라 내려갑니다 — 62 / 54 / 48dvh (DOCK_MAX_H). */}
      <div
        className={cx(
          "mx-auto w-full max-w-[624px] px-[18px] pt-3.5 pb-[calc(28px_+_var(--chim-safe-b))] md:overflow-y-auto md:px-8",
          DOCK_MAX_H[fontScale],
        )}
      >
        <div className="mb-3 flex items-baseline gap-2">
          {/* 지시문은 코어 콘텐츠입니다 — 17px w700 (§3). */}
          <h2 className="min-w-0 flex-1 text-[1.0625rem] leading-[1.5] font-bold text-ink">
            {cue.prompt}
          </h2>
          {/* 재촉하지 않는 어휘의 카운트다운 — 안심 문구를 처음부터 나란히 둡니다.
              (예전에는 시간이 다 지난 뒤에야 「천천히」가 나와, 얼어붙는 그 몇 초 동안
               자동으로 넘어가지 않는다는 사실을 알 길이 없었습니다 — 평가 초보 m27.) */}
          <span className="flex-none text-right">
            {!timeUp && (
              <span className="chim-num block text-[0.75rem] leading-[1.5] font-semibold text-ink-muted">
                여유 {secondsLeft}초
              </span>
            )}
            <span className="block text-[0.75rem] leading-[1.5] font-semibold text-ink-soft">
              천천히 하셔도 됩니다
            </span>
          </span>
        </div>

        {/* 마이크 첫 사용 안내 — 세션에서 처음 한 번만 나옵니다 */}
        {micSupported && micIntroOpen && (
          <div className="mb-2.5 rounded-panel bg-tint px-4 py-3.5">
            <h3 className="text-[0.8125rem] leading-[1.5] font-bold text-brand-800">
              마이크를 처음 쓰실 때
            </h3>
            {/* 실제 조작은 푸시투토크입니다 — 안내도 그대로 적습니다(평가 초보 m28). */}
            <p className="mt-1 text-[0.7813rem] leading-[1.6] text-ink-soft">
              마이크 버튼을 처음 누르면 브라우저가 마이크 허용을 물어봅니다. ‘허용’을 누르신 뒤,
              버튼을 꾹 누른 채로 말씀하시고 다 말씀하시면 손을 떼세요. 마이크 없이 아래 버튼만으로도
              끝까지 진행됩니다.
            </p>
            <button
              type="button"
              onClick={closeMicIntro}
              className="mt-2 min-h-[48px] w-full rounded-[14px] bg-white text-[0.9375rem] font-semibold text-ink"
            >
              알겠습니다
            </button>
          </div>
        )}

        {notice && (
          <p
            role="status"
            className="mb-2.5 rounded-[14px] bg-warn-soft px-3.5 py-2.5 text-[0.7813rem] leading-[1.6] font-semibold text-warn-ink"
          >
            {notice}
          </p>
        )}

        {/* ② 제안 버튼 — 항상 노출되는 폴백입니다.
            ⚑CF에서 고르신 대안이 있으면 **맨 위에 같은 문법으로** 다시 세웁니다 —
            대안을 골라 놓고 그 문장을 버튼으로 다시 못 고르면 「버튼만으로 끝까지」가 깨집니다. */}
        {(options.length > 0 || chosenAlternative) && (
          <ul className="mb-2.5 flex flex-col gap-[7px]">
            {chosenAlternative && (
              <li key="cf-alternative">
                <button
                  type="button"
                  onClick={() => sendAlternative(chosenAlternative)}
                  className="min-h-[48px] w-full rounded-[14px] border border-line-strong bg-white px-[15px] py-2.5 text-left text-[0.9375rem] leading-[1.45] font-medium text-ink transition-colors duration-150 hover:bg-paper-2"
                >
                  {chosenAlternative}
                </button>
              </li>
            )}
            {options.map((branch) => (
              <li key={branch.id}>
                <button
                  type="button"
                  onClick={() => pick(branch.id)}
                  className="min-h-[48px] w-full rounded-[14px] border border-line-strong bg-white px-[15px] py-2.5 text-left text-[0.9375rem] leading-[1.45] font-medium text-ink transition-colors duration-150 hover:bg-paper-2"
                >
                  {branch.fallbackOption}
                </button>
              </li>
            ))}
          </ul>
        )}

        {composing ? (
          /* ③ 직접 입력 겸 인식 결과 확인 — 보내기 전에 고치실 수 있습니다 */
          <div>
            <label
              htmlFor="cue-utterance"
              className="block text-[0.75rem] leading-[1.5] font-semibold text-ink-muted"
            >
              인식된 내용 확인 · 직접 입력
            </label>
            <textarea
              id="cue-utterance"
              ref={textareaRef}
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                // 직접 손대신 뒤에는 "예시를 채웠습니다" 안내를 걷어 냅니다.
                setFilledExampleId(null);
              }}
              rows={3}
              placeholder="여기에 하실 말씀을 적으시거나, 말씀하신 내용을 확인해 주세요."
              className="mt-1 w-full rounded-panel border border-line-strong bg-white px-3.5 py-3 text-[1.0313rem] leading-[1.55] text-ink placeholder:text-tertiary focus:border-brand-400"
            />

            {reportMode && text.trim().length > 0 && (
              <RecordDraftPreview source={text} variant="live" className="mt-2.5" />
            )}

            <div className="mt-2.5 flex items-center gap-2">
              <BigButton
                onClick={send}
                disabled={text.trim().length === 0}
                block
                className="min-w-0 flex-1"
              >
                이 내용으로 답하기
              </BigButton>
              <MicButton
                label="누르고 있는 동안 말하기"
                disabled={!micSupported}
                onPointerDown={(event) => {
                  event.preventDefault();
                  beginPress();
                }}
                onKeyDown={(event) => {
                  if (event.repeat) return;
                  if (event.key === " " || event.key === "Enter") {
                    event.preventDefault();
                    beginPress();
                  }
                }}
              />
            </div>

            <div className="mt-1.5 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setText("");
                  setFilledExampleId(null);
                }}
                disabled={text.length === 0}
                className="min-h-[48px] px-1 text-[0.8125rem] font-semibold text-ink-muted disabled:opacity-45"
              >
                지우기
              </button>
              <button
                type="button"
                onClick={() => {
                  setText("");
                  setExpanded(false);
                  setFilledExampleId(null);
                }}
                className="min-h-[48px] px-1 text-[0.8125rem] font-semibold text-ink-muted"
              >
                입력창 접기
              </button>
            </div>
          </div>
        ) : (
          /* 대기 — 입력 pill + 마이크 (시안 4a).
             pill에 line-strong 1px 보더를 둘러 「눌러야 하는 것」임을 형태로 말합니다
             (보더가 없을 때는 비활성 입력칸으로 읽혔습니다 — 평가 초보 mi72). */
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openInput}
              className="h-12 min-w-0 flex-1 rounded-[24px] border border-line-strong bg-paper-2 px-4 text-left text-[0.9063rem] text-ink-muted"
            >
              직접 입력…
            </button>
            <MicButton
              label="누르고 있는 동안 말하기"
              disabled={!micSupported}
              onPointerDown={(event) => {
                event.preventDefault();
                beginPress();
              }}
              onKeyDown={(event) => {
                if (event.repeat) return;
                if (event.key === " " || event.key === "Enter") {
                  event.preventDefault();
                  beginPress();
                }
              }}
            />
          </div>
        )}

        {micSupported ? (
          /* 마이크 조작을 글자로도 적어 둡니다 — 아이콘만으로는 「눌렀다 떼기」로 읽힙니다. */
          <p className="mt-2 text-[0.75rem] leading-[1.6] text-ink-soft">
            마이크는 꾹 누르고 계신 동안만 듣습니다 — 손을 떼면 보내기 전에 고치실 수 있어요.
          </p>
        ) : (
          <p className="mt-2 text-[0.75rem] leading-[1.6] text-ink-muted">
            이 기기에서는 음성 인식을 쓸 수 없습니다. 위 버튼과 직접 입력만으로 끝까지 진행하실 수
            있습니다.
          </p>
        )}

        {/* 규칙 엔진 시연 장치 — 채우기만 하고 전송은 사용자가 직접 하십니다 */}
        {demoExamples.length > 0 && (
          <details className="group mt-2.5">
            <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 text-[0.7813rem] font-semibold text-ink-muted [&::-webkit-details-marker]:hidden">
              <span>{RULE_DEMO_TITLE}</span>
              <span
                aria-hidden
                className="text-[0.75rem] text-faint transition-transform duration-150 group-open:rotate-180"
              >
                ⌄
              </span>
            </summary>

            <div className="border-t border-line pt-3 pb-1">
              <p className="text-[0.75rem] leading-[1.6] font-semibold text-ink-soft">
                {RULE_DEMO_NOTE}
              </p>
              <p className="mt-1 text-[0.75rem] leading-[1.6] text-ink-muted">{RULE_DEMO_HINT}</p>

              <ul className="mt-2.5 space-y-2.5">
                {demoExamples.map((example) => (
                  <li key={example.id}>
                    <button
                      type="button"
                      onClick={() => fillExample(example)}
                      className={cx(
                        "w-full rounded-[14px] px-3.5 py-3 text-left transition-colors duration-150",
                        filledExampleId === example.id ? "bg-tint" : "bg-paper-2 hover:bg-tint",
                      )}
                    >
                      <span className="block text-[0.7188rem] leading-[1.5] font-bold text-ink-muted">
                        {example.kind === "critical" ? "즉시 중단" : "코칭"} · {example.ruleId} ·{" "}
                        {example.itemId} {example.ruleLabel}
                      </span>
                      <span className="mt-1 block text-[0.8438rem] leading-[1.55] font-semibold text-ink">
                        “{example.sentence}”
                      </span>
                    </button>
                    <p className="mt-1 px-1 text-[0.75rem] leading-[1.6] text-ink-muted">
                      {example.expectation}
                    </p>
                  </li>
                ))}
              </ul>

              {!demoExamples.some((example) => example.kind === "critical") && (
                <p className="mt-2.5 rounded-[14px] bg-paper-2 px-3.5 py-2.5 text-[0.75rem] leading-[1.6] text-ink-muted">
                  {RULE_DEMO_NO_CRITICAL_NOTE}
                </p>
              )}

              <p role="status" className="sr-only">
                {filledExample
                  ? `${filledExample.ruleLabel} 예시 문장을 입력창에 채웠습니다. 보내시려면 이 내용으로 답하기 버튼을 눌러 주세요.`
                  : ""}
              </p>
              {filledExample && (
                <p
                  aria-hidden
                  className="mt-2.5 rounded-[14px] bg-tint px-3.5 py-2.5 text-[0.75rem] leading-[1.6] font-semibold text-brand-800"
                >
                  입력창에 채워 드렸습니다. 아직 보내지 않았습니다 — 위의 「이 내용으로 답하기」를
                  누르시면 규칙 엔진이 판정합니다.
                </p>
              )}
            </div>
          </details>
        )}

        {/* 압박이 가장 큰 첫 몇 초에도 같은 자리에 있어야 하는 문장입니다 — 조건을 걷어냈습니다. */}
        <p className="mt-2 text-[0.75rem] leading-[1.6] text-ink-soft">
          시간이 지나도 자동으로 넘어가지 않습니다. 천천히 고르시거나 직접 답해 주세요.
        </p>

        <InlineDisclaimer tone="readable" className="mt-2.5" />
      </div>
    </div>
  );
}

export default CueResponder;
