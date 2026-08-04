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

/** 마이크 첫 사용 안내를 이미 보셨는지 기억하는 자리 (기기 안에만 남습니다) */
const MIC_INTRO_KEY = "chimchak.micIntro.v1";

/** 마이크 권한 상태 — permissions API가 없는 브라우저는 "unknown"으로 둡니다. */
type MicPermission = "unknown" | "prompt" | "granted" | "denied";

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
  const [micIntroOpen, setMicIntroOpen] = useState(false);
  const [micPermission, setMicPermission] = useState<MicPermission>("unknown");
  const recognizerRef = useRef<Recognizer | null>(null);
  /** 권한 팝업이 떠 있는 첫 회에만 인식을 끊지 않고 안내로 대신합니다 */
  const micGraceUsedRef = useRef(false);

  const options = useMemo(() => cueOptions(scenario, session), [scenario, session]);
  const reportMode = useMemo(() => isReportCue(scenario, cue), [scenario, cue]);
  const resetKey = `${cue.id}-${attempt}`;
  const secondsLeft = useCountdown(cue.waitSec, resetKey);
  const timeUp = secondsLeft <= 0;

  /* ── 진행 표시 — 점수가 아니라 '지금 몇 번째 상황인가'입니다 ── */

  // 분모는 cue가 붙은 턴 수(대략치)입니다. 고르신 분기에 따라 실제로 지나는 상황 수는 달라집니다.
  const cueTurnCount = useMemo(
    () => scenario.turns.filter((turn) => Boolean(turn.cue)).length,
    [scenario],
  );
  const answeredCueIds = useMemo(() => {
    const seen = new Set<string>();
    for (const event of session.events) {
      if (event.cueId) seen.add(event.cueId);
    }
    return seen;
  }, [session.events]);
  // 같은 CUE를 다시 하고 계시면 번호가 되돌아가지 않도록 이미 센 것으로 봅니다.
  const stepIndex = answeredCueIds.has(cue.id)
    ? Math.max(1, answeredCueIds.size)
    : answeredCueIds.size + 1;
  const stepTotal = Math.max(cueTurnCount, stepIndex);
  const stepRatio = stepTotal > 0 ? Math.min(1, stepIndex / stepTotal) : 0;

  useEffect(() => {
    setText("");
    setNotice(null);
  }, [resetKey]);

  useEffect(() => {
    return () => {
      recognizerRef.current?.stop();
    };
  }, []);

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
   * permissions API가 없는 브라우저에서는 조용히 넘어가고, 안내 카드만으로 충분합니다.
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
        // 이 브라우저는 마이크 권한 조회를 지원하지 않습니다 — 안내 카드로 대신합니다.
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
        "브라우저가 마이크 사용을 허용할지 묻고 있습니다. ‘허용’을 누르신 뒤 버튼을 다시 눌러 말씀해 주세요. 마이크 없이 아래 보기 버튼만으로도 끝까지 진행하실 수 있습니다.",
      );
      return;
    }
    stopListening();
  }, [micPermission, stopListening]);

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
      {/* 진행 표시 — 점수가 아니라 위치 안내입니다 (퍼센트·등급 표기 없음) */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 rounded-chip border border-brand-200 bg-brand-50 px-3 py-1 text-sm font-bold text-brand-800">
            <span aria-hidden="true">▸</span>
            {stepIndex}번째 상황 · 약 {stepTotal}개 중
          </span>
          <span className="text-sm leading-relaxed text-ink-muted">
            고르시는 길에 따라 상황 수는 달라질 수 있습니다
          </span>
        </div>
        <div
          className="mt-2 h-1.5 w-full overflow-hidden rounded-chip bg-brand-100"
          role="img"
          aria-label={`약 ${stepTotal}개 상황 가운데 ${stepIndex}번째를 진행하고 있습니다`}
        >
          <span
            className="block h-full rounded-chip bg-brand-400 transition-[width] duration-300 ease-soft"
            style={{ width: `${Math.round(stepRatio * 100)}%` }}
          />
        </div>
      </div>

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

      {/* 마이크 첫 사용 안내 — 세션에서 처음 한 번만 나옵니다 */}
      {micSupported && micIntroOpen && (
        <div className="rounded-card border-2 border-brand-200 bg-brand-50 p-4">
          <h3 className="flex items-center gap-2 text-base font-extrabold text-brand-900">
            <span aria-hidden="true">🎙</span>
            마이크를 처음 쓰실 때
          </h3>
          <p className="mt-2 text-base leading-relaxed font-semibold text-brand-800">
            마이크 버튼을 누르면 브라우저가 마이크 허용을 물어봅니다. ‘허용’을 누르신 뒤 버튼을 다시
            눌러 말씀해 주세요. 마이크 없이 아래 보기 버튼만으로도 끝까지 진행됩니다.
          </p>
          <div className="mt-3">
            <BigButton onClick={closeMicIntro} variant="secondary" className="w-full sm:w-auto">
              알겠습니다
            </BigButton>
          </div>
        </div>
      )}

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
            onPointerUp={releaseMic}
            onPointerCancel={stopListening}
            onPointerLeave={() => {
              if (listening) releaseMic();
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
                releaseMic();
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
