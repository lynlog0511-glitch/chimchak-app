"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { BigButton, InlineDisclaimer } from "@/components";
import { cx } from "@/components/utils";
import { buildRecord, currentCue, currentTurn, protocolIdOf, resolveEnding } from "@/engine";
import { isRecognitionSupported, primeVoices, speak, stopSpeaking } from "@/lib/speech";
import {
  clearProgress,
  loadProgress,
  saveProgress,
  saveSession,
  type SessionProgress,
} from "@/lib/storage";
import type { EmergencyProtocol, Scenario } from "@/types";
import { BriefingPanel } from "./BriefingPanel";
import { CriticalInterrupt } from "./CriticalInterrupt";
import { CueResponder } from "./CueResponder";
import { DialogueLog } from "./DialogueLog";
import { EndingPanel } from "./EndingPanel";
import { ProtocolInline } from "./ProtocolInline";
import { SessionHeader } from "./SessionHeader";
import { SessionProgressBar } from "./SessionProgressBar";
import { SessionRail } from "./SessionRail";
import {
  EMOTION_WORD,
  emotionLevel,
  FICTION_NOTICE,
  SESSION_STATUS_ENDED,
  SESSION_STATUS_PROTOCOL,
  sessionSubtitle,
} from "./constants";
import { cueProgress } from "./sessionProgress";
import {
  initialTrainState,
  makeTrainReducer,
  type CriticalInterruptState,
  type LogItem,
} from "./sessionMachine";

export interface TrainSessionProps {
  scenario: Scenario;
  /** 응급 프로토콜 전체 — L3 진입 시 여기서 골라 인라인 재생합니다 */
  protocols: EmergencyProtocol[];
}

/**
 * 훈련 세션 화면 (시안 3a 골격 + 4a 디테일 + 4b 말하는 중).
 *
 * 브리핑 → 대화(CUE 응답·인라인 코칭) → (필요 시) L3 응급 프로토콜 → 보고·기록 → 엔딩 순으로 흐릅니다.
 * 판정과 상태 전이는 전부 엔진이 하고, 이 컴포넌트는 화면 전환·음성·저장만 담당합니다.
 *
 * 골격은 **컴팩트 헤더 + 세그먼트 진행바 + 스크롤되는 대화 + 붙박이 입력 도크** 넷입니다.
 * 게이지 숫자 막대와 계층 표시기는 화면에서 걷어냈습니다 — 계층은 헤더 상태 점과 L3 전환 문구가,
 * 감정은 아바타 링과 이름줄 상태어가 대신합니다.
 */
export function TrainSession({ scenario, protocols }: TrainSessionProps) {
  const reducer = useMemo(() => makeTrainReducer(scenario), [scenario]);
  const [state, dispatch] = useReducer(reducer, scenario, initialTrainState);

  const [ttsOn, setTtsOn] = useState(true);
  const [micSupported, setMicSupported] = useState(false);
  /** 이 기기에 남아 있는 진행 체크포인트 — 브리핑에서 「이어서 하기」로 안내합니다 */
  const [checkpoint, setCheckpoint] = useState<SessionProgress | null>(null);
  /** ‹ 로 브리핑으로 되돌아가 있는 중인지 (세션 상태는 그대로 두고 화면만 바꿉니다) */
  const [atBriefing, setAtBriefing] = useState(false);
  /** 말하는 중 — 본문을 흐리게 합니다 (시안 4b) */
  const [listening, setListening] = useState(false);
  /** 종료 확인 */
  const [exitOpen, setExitOpen] = useState(false);
  /**
   * 이번 훈련에서 마지막으로 멈춰 세웠던 ⚑CF 지점.
   * 시트가 닫힌 뒤에도 엔딩의 「다시 볼 장면」 카드가 **그때 보여 드린 근거와 대안 그대로**를
   * 다시 펴야 하므로, 시트에 넘긴 내용을 그대로 붙들어 둡니다.
   */
  const [criticalScene, setCriticalScene] = useState<CriticalInterruptState | null>(null);
  /** 지금 읽어 주고 있는 대사의 키 — 이름줄 파형·「읽어 주는 중」 표시에 씁니다 */
  const [speakingKey, setSpeakingKey] = useState("");
  const spokenKeyRef = useRef<string>("");
  const savedIdRef = useRef<string>("");

  const turn = currentTurn(scenario, state.session);
  const cue = state.session.status === "running" ? currentCue(scenario, state.session) : undefined;
  // 설계서 §4.6 우선순위(⚑CF·재훈련 권고 우선)를 반영한 엔딩입니다.
  const ending = resolveEnding(scenario, state.session);
  const protocolId = protocolIdOf(state.session);
  const protocol = protocolId
    ? protocols.find((item) => item.id.toUpperCase() === protocolId.toUpperCase())
    : undefined;

  const record = useMemo(
    () => (state.phase === "ended" ? buildRecord(scenario, state.session) : null),
    [scenario, state.phase, state.session],
  );

  const advisoryEnding = useMemo(() => {
    if (!state.session.retrainAdvice) return undefined;
    const advisory = scenario.endings.find((item) => item.verdict === "재훈련 권고");
    if (!advisory || advisory.id === ending?.id) return undefined;
    return advisory;
  }, [ending?.id, scenario.endings, state.session.retrainAdvice]);

  /* ── 음성 ─────────────────────────────────────────────── */

  useEffect(() => {
    setMicSupported(isRecognitionSupported());
    primeVoices();
    return () => stopSpeaking();
  }, []);

  useEffect(() => {
    let lastLine: Extract<LogItem, { kind: "line" }> | undefined;
    for (let i = state.log.length - 1; i >= 0; i -= 1) {
      const item = state.log[i];
      if (item && item.kind === "line") {
        lastLine = item;
        break;
      }
    }
    if (!lastLine) return undefined;
    if (spokenKeyRef.current === lastLine.key) return undefined;
    spokenKeyRef.current = lastLine.key;
    if (!ttsOn) return undefined;

    const key = lastLine.key;
    let cancelled = false;
    setSpeakingKey(key);
    void speak(lastLine.text).then(() => {
      if (cancelled) return;
      setSpeakingKey((current) => (current === key ? "" : current));
    });
    return () => {
      cancelled = true;
    };
  }, [state.log, ttsOn]);

  const toggleTts = useCallback(() => {
    setTtsOn((value) => {
      if (value) {
        stopSpeaking();
        setSpeakingKey("");
      }
      return !value;
    });
  }, []);

  /** ⚑CF 시트가 뜰 때마다 그 내용을 붙들어 둡니다 (엔딩의 「다시 볼 장면」 카드용). */
  useEffect(() => {
    if (state.critical) setCriticalScene(state.critical);
  }, [state.critical]);

  /* ── 저장 ─────────────────────────────────────────────── */

  useEffect(() => {
    if (!record) return;
    if (savedIdRef.current === record.id) return;
    savedIdRef.current = record.id;
    saveSession(record);
  }, [record]);

  /** 이 기기에 남아 있는 진행 체크포인트를 한 번만 읽어 옵니다. */
  useEffect(() => {
    setCheckpoint(loadProgress(scenario.id) ?? null);
  }, [scenario.id]);

  /**
   * 턴 결정마다 체크포인트를 갱신합니다.
   * 담기는 것은 판정된 분기 id·게이지·횟수뿐이고(발화 원문은 담지 않습니다),
   * 엔딩에 도달하면 `saveProgress`가 체크포인트를 지우고 세션 기록만 남깁니다.
   */
  useEffect(() => {
    if (state.phase === "briefing") return;
    saveProgress(state.session);
  }, [state.phase, state.session]);

  /* ── 조작 ─────────────────────────────────────────────── */

  const handleSubmit = useCallback(
    (input: { utterance?: string; branchId?: string; viaButton: boolean }) => {
      stopSpeaking();
      setSpeakingKey("");
      dispatch({ type: "submit", input });
    },
    [],
  );

  /** 화면이 바뀔 때 페이지 맨 위부터 읽으실 수 있게 합니다. */
  const scrollToTop = useCallback(() => {
    if (typeof window === "undefined") return;
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  /** 처음부터 — 남아 있던 체크포인트는 지웁니다. */
  const handleStart = useCallback(() => {
    clearProgress(scenario.id);
    setCheckpoint(null);
    setAtBriefing(false);
    setCriticalScene(null);
    dispatch({ type: "start" });
    scrollToTop();
  }, [scenario.id, scrollToTop]);

  const handleRestart = useCallback(() => {
    stopSpeaking();
    setSpeakingKey("");
    spokenKeyRef.current = "";
    clearProgress(scenario.id);
    setCheckpoint(null);
    setAtBriefing(false);
    setCriticalScene(null);
    dispatch({ type: "restart" });
    scrollToTop();
  }, [scenario.id, scrollToTop]);

  /**
   * ⚑CF 시트를 닫고 같은 장면으로 돌아갑니다.
   * 대안을 고르셨으면 그 문구를 로그에 한 줄로 남깁니다 — 발화로 전송하지는 않습니다.
   */
  const handleRetryAfterCritical = useCallback((alternative?: string) => {
    dispatch({ type: "retryAfterCritical", alternative });
  }, []);

  /** 이어서 하기 — 저장해 둔 결정 목록을 엔진에 순서대로 다시 넣습니다. */
  const handleResume = useCallback(() => {
    if (!checkpoint) return;
    stopSpeaking();
    setSpeakingKey("");
    spokenKeyRef.current = "";
    dispatch({ type: "resume", progress: checkpoint });
    setCheckpoint(null);
    setAtBriefing(false);
    scrollToTop();
  }, [checkpoint, scrollToTop]);

  /**
   * ‹ — 브리핑으로 돌아갑니다.
   * 세션 상태는 건드리지 않고, 기기에 저장해 둔 체크포인트를 다시 읽어
   * 브리핑에서 「이어서 하기」로 되돌아오실 수 있게 합니다.
   */
  const handleBackToBriefing = useCallback(() => {
    stopSpeaking();
    setSpeakingKey("");
    setListening(false);
    setCheckpoint(loadProgress(scenario.id) ?? null);
    setAtBriefing(true);
    scrollToTop();
  }, [scenario.id, scrollToTop]);

  /* ── 브리핑 ───────────────────────────────────────────── */

  if (state.phase === "briefing" || atBriefing) {
    return (
      <BriefingPanel
        scenario={scenario}
        micSupported={micSupported}
        onStart={handleStart}
        checkpoint={checkpoint}
        onResume={handleResume}
      />
    );
  }

  /* ── 세션 ─────────────────────────────────────────────── */

  const ended = state.phase === "ended";
  const inProtocol = state.session.status === "protocol";
  const progress = cueProgress(scenario, state.session, cue);
  const level = emotionLevel(scenario.gauge, state.session.gauge);
  const emotion = { level, word: EMOTION_WORD[scenario.gauge.label][level] };

  const statusText = ended
    ? SESSION_STATUS_ENDED
    : inProtocol
      ? SESSION_STATUS_PROTOCOL
      : sessionSubtitle(scenario, progress.index);

  const interrupted = state.critical !== null;

  return (
    <>
      {/* ⚑CF 시트가 떠 있는 동안 세션은 뒤로 물러납니다 (시안 6c — 배경 .25 + 딤 .32). */}
      <div
        aria-hidden={interrupted || undefined}
        className={cx(
          "flex min-h-0 flex-1 flex-col",
          interrupted && "pointer-events-none opacity-30",
        )}
      >
        <div className="flex-none px-[18px] md:border-b md:border-line md:px-8">
          <SessionHeader
            title={scenario.title}
            status={statusText}
            statusTone={ended ? "neutral" : inProtocol ? "danger" : "brand"}
            backHref={ended ? "/train" : undefined}
            onBack={ended ? undefined : handleBackToBriefing}
            backLabel={ended ? "훈련 목록으로" : "브리핑으로 돌아가기"}
            progress={progress}
            action={
              <div className="-mr-2 flex items-center">
                <button
                  type="button"
                  onClick={toggleTts}
                  aria-pressed={ttsOn}
                  className="flex min-h-[48px] items-center px-2 text-[13px] font-semibold text-ink-muted"
                >
                  {ttsOn ? "소리 끄기" : "소리 켜기"}
                </button>
                {!ended && (
                  <button
                    type="button"
                    onClick={() => setExitOpen(true)}
                    className="flex min-h-[48px] items-center px-2 text-[14px] font-semibold text-ink-muted"
                  >
                    종료
                  </button>
                )}
              </div>
            }
          />
          {/* 모바일 진행바 — 데스크톱에서는 헤더 안으로 들어갑니다(시안 7d). */}
          <SessionProgressBar index={progress.index} total={progress.total} className="md:hidden" />
        </div>

        {/* md↑ 2단 — 대화는 가운데 560px, 곁의 것은 오른쪽 270px 레일로 (시안 7d). */}
        <div className="flex min-h-0 flex-1">
          <div className="flex min-h-0 flex-1 flex-col md:border-r md:border-line">
            {/* 본문 — 지문과 대화. 말하는 중에는 옅어집니다(시안 4b). */}
            <div
              className={cx(
                "min-h-0 flex-1 overflow-y-auto px-[18px] pt-4 pb-6 transition-opacity duration-200 md:px-8 md:pt-6",
                listening && "pointer-events-none opacity-45",
              )}
            >
              <div className="md:mx-auto md:max-w-[560px]">
                <p className="text-center text-[12.5px] leading-[1.6] text-tertiary">
                  {scenario.context}
                </p>
                {/* 가상 인물 고지 — 화면마다 한 번은 또렷하게 남습니다(말풍선의 「AI 생성 · 가상 인물」과 별도). */}
                <p className="mt-1 mb-4 text-center text-[11.5px] leading-[1.6] text-ink-muted">
                  {FICTION_NOTICE}
                </p>

                <DialogueLog
                  items={state.log}
                  gaugeLabel={scenario.gauge.label}
                  emotion={emotion}
                  speaking={speakingKey.length > 0}
                />

                {ended && record ? (
                  <EndingPanel
                    scenario={scenario}
                    session={state.session}
                    ending={ending}
                    record={record}
                    advisoryEnding={advisoryEnding}
                    criticalFeedback={criticalScene?.feedback}
                    criticalAlternatives={criticalScene?.alternatives}
                    onRestart={handleRestart}
                    className="mt-6"
                  />
                ) : inProtocol ? (
                  protocol ? (
                    <ProtocolInline
                      protocol={protocol}
                      ttsOn={ttsOn}
                      onDone={() => dispatch({ type: "protocolDone" })}
                      className="mt-6"
                    />
                  ) : (
                    <div className="mt-6 rounded-card bg-danger-soft p-4">
                      <p className="text-[15px] leading-[1.6] font-bold text-danger-ink">
                        응급 안내를 불러오지 못했습니다. 아래 버튼으로 이어서 진행해 주세요.
                      </p>
                      <BigButton
                        onClick={() => dispatch({ type: "protocolDone" })}
                        size="lg"
                        block
                        className="mt-3"
                      >
                        이어서 인계·보고로 돌아가기
                      </BigButton>
                    </div>
                  )
                ) : null}
              </div>
            </div>

            {/* 입력 도크 — 대화 중에만 섭니다. 그 밖의 구간에서는 고지 한 줄만 남깁니다. */}
            {cue && turn && !ended && !inProtocol ? (
              <CueResponder
                scenario={scenario}
                session={state.session}
                cue={cue}
                attempt={state.attempt}
                micSupported={micSupported}
                onSubmit={handleSubmit}
                onListeningChange={setListening}
              />
            ) : (
              <div className="flex-none border-t border-line bg-paper px-[18px] pt-3 pb-6 md:px-8">
                <InlineDisclaimer tone="readable" />
              </div>
            )}
          </div>

          <SessionRail
            scenario={scenario}
            session={state.session}
            emotion={emotion}
            lastDelta={state.lastFeedback?.gaugeDelta}
            log={state.log}
            className="hidden md:block"
          />
        </div>
      </div>

      {/* 종료 확인 */}
      {exitOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="session-exit-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/55 p-4 sm:items-center"
        >
          <button
            type="button"
            aria-label="닫기"
            onClick={() => setExitOpen(false)}
            className="absolute inset-0 cursor-default"
          />
          <div className="animate-fade-up relative w-full max-w-[380px] rounded-panel bg-white p-5 shadow-panel">
            <h2 id="session-exit-title" className="text-[17px] leading-[1.4] font-bold text-ink">
              훈련을 끝낼까요?
            </h2>
            <p className="mt-2 text-[13px] leading-[1.6] text-ink-soft">
              지금까지 진행한 자리는 이 기기에 남아 있어, 다음에 이어서 하실 수 있습니다. 말씀하신
              내용은 저장하지 않습니다.
            </p>
            <div className="mt-4 space-y-2">
              <BigButton onClick={() => setExitOpen(false)} size="lg" block>
                계속하기
              </BigButton>
              <BigButton href="/train" variant="secondary" block>
                끝내고 훈련 목록으로
              </BigButton>
            </div>
          </div>
        </div>
      )}

      {/* ⚑CF 즉시 중단 — 바텀시트 (시안 6c) */}
      {state.critical && (
        <CriticalInterrupt
          feedback={state.critical.feedback}
          alternatives={state.critical.alternatives}
          onRetry={handleRetryAfterCritical}
        />
      )}
    </>
  );
}

export default TrainSession;
