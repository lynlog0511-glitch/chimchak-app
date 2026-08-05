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
import type { EmergencyProtocol, Scenario, TurnDef } from "@/types";
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
  NEW_LINE_ANCHOR,
  SESSION_STATUS_ENDED,
  SESSION_STATUS_PROTOCOL,
  sessionSubtitle,
} from "./constants";
import { cueProgress } from "./sessionProgress";
import {
  initialTrainState,
  makeTrainReducer,
  parseDemoPreset,
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

  /**
   * ⚑CF 시트에서 고르신 대안 문장.
   * 같은 CUE로 돌아왔을 때 보기 맨 위에 다시 세웁니다 — 다음 응답을 보내면 지웁니다.
   */
  const [chosenAlternative, setChosenAlternative] = useState<string>("");

  /* ── 하단 도킹 (모바일: 페이지 스크롤 하나 + 컴포저 도크) ─────────
     도크가 로그 바닥을 가리므로, 그 높이만큼을 스크롤 여백으로 로그에 알려 줍니다.
     md↑ 2단에서는 도크가 대화 아래 자기 자리에 서므로 가리는 것이 없어 0입니다. */
  const [dockNode, setDockNode] = useState<HTMLDivElement | null>(null);
  const [dockHeight, setDockHeight] = useState(0);

  useEffect(() => {
    if (!dockNode) {
      setDockHeight(0);
      return undefined;
    }
    const desktop = window.matchMedia("(min-width: 768px)");
    const measure = () => {
      setDockHeight(desktop.matches ? 0 : Math.round(dockNode.getBoundingClientRect().height));
    };
    measure();
    const observer =
      typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure);
    observer?.observe(dockNode);
    desktop.addEventListener("change", measure);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      desktop.removeEventListener("change", measure);
      window.removeEventListener("resize", measure);
    };
  }, [dockNode]);

  /** 새로 등장한 인물 대사가 화면 밖일 때 컴포저 위에 뜨는 앵커 */
  const [newLine, setNewLine] = useState<{ offscreen: boolean; speaker: TurnDef["speaker"] }>({
    offscreen: false,
    speaker: "system",
  });
  const scrollToLatestLineRef = useRef<(() => void) | null>(null);

  const handleLatestLineOffscreen = useCallback(
    (offscreen: boolean, speaker: TurnDef["speaker"]) => {
      setNewLine((prev) =>
        prev.offscreen === offscreen && prev.speaker === speaker ? prev : { offscreen, speaker },
      );
    },
    [],
  );

  /** 엔딩 패널 — 완주 직후 이 자리를 화면 맨 위로 끌어옵니다 */
  const endingRef = useRef<HTMLDivElement | null>(null);

  /**
   * 모바일 sticky 헤더의 실측 높이를 CSS 변수(--session-head-h)로 흘려 보냅니다.
   * L3의 sticky 119 바가 이 값만큼 내려앉아 헤더와 겹치지 않습니다 —
   * 부제 줄바꿈·글자 크기 설정으로 헤더 높이가 변하므로 고정값 대신 실측을 씁니다.
   */
  const sessionBoxRef = useRef<HTMLDivElement | null>(null);
  const headBoxRef = useRef<HTMLDivElement | null>(null);
  /* 마운트 시점에는 브리핑 화면이라 두 ref가 비어 있습니다 — []로 걸면 영영 실행되지 않습니다.
     세션 화면이 실제로 렌더된 뒤(atBriefing false) 다시 시도하도록 화면 상태를 의존성에 둡니다. */
  const inSessionView = state.phase !== "briefing" && !atBriefing;
  useEffect(() => {
    if (!inSessionView) return undefined;
    const head = headBoxRef.current;
    const box = sessionBoxRef.current;
    if (!head || !box || typeof ResizeObserver === "undefined") return undefined;
    const apply = () => box.style.setProperty("--session-head-h", `${head.offsetHeight}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(head);
    return () => ro.disconnect();
  }, [inSessionView]);

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
    /* 시연 프리셋(?demo=)으로 자동 재생한 세션은 성장 기록에 남기지 않습니다 —
       자동 재생이 만든 「잘한 것」이 실사용 이력에 섞이면 그 자체가 부정직한 데이터입니다. */
    if (demoModeRef.current) return;
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
    /* demo 모드에서는 체크포인트를 건드리지 않습니다 — 발표 직전 리허설이
       발표자(또는 사용자)의 실제 진행 상태를 덮어쓰는 사고를 막습니다. */
    if (demoModeRef.current) return;
    saveProgress(state.session);
  }, [state.phase, state.session]);

  /* ── 조작 ─────────────────────────────────────────────── */

  const handleSubmit = useCallback(
    (input: { utterance?: string; branchId?: string; viaButton: boolean }) => {
      stopSpeaking();
      setSpeakingKey("");
      setChosenAlternative("");
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
    setChosenAlternative("");
    dispatch({ type: "start" });
    scrollToTop();
  }, [scenario.id, scrollToTop]);

  /**
   * 시연 프리셋 — `/train/[id]?demo=cf|l3|end`.
   *
   * 쿼리를 **마운트 뒤에** 한 번만 읽습니다(쿼리가 없으면 이 경로를 타지 않아 동작이 완전히 같습니다).
   * 재생은 엔진의 `submitResponse`가 그대로 하고, 지나간 구간은 로그 맨 위 배너로 밝힙니다.
   */
  const demoAppliedRef = useRef(false);
  /** demo 모드 여부 — 켜지면 이 세션은 체크포인트·성장 기록 어디에도 저장되지 않습니다. */
  const demoModeRef = useRef(false);

  useEffect(() => {
    if (demoAppliedRef.current) return;
    demoAppliedRef.current = true;
    if (typeof window === "undefined") return;
    const preset = parseDemoPreset(new URLSearchParams(window.location.search).get("demo"));
    if (!preset) return;
    demoModeRef.current = true;
    setCheckpoint(null);
    setAtBriefing(false);
    setCriticalScene(null);
    setChosenAlternative("");
    dispatch({ type: "demo", preset });
  }, []);

  const handleRestart = useCallback(() => {
    stopSpeaking();
    setSpeakingKey("");
    spokenKeyRef.current = "";
    clearProgress(scenario.id);
    setCheckpoint(null);
    setAtBriefing(false);
    setCriticalScene(null);
    setChosenAlternative("");
    dispatch({ type: "restart" });
    scrollToTop();
  }, [scenario.id, scrollToTop]);

  /**
   * ⚑CF 시트를 닫고 같은 장면으로 돌아갑니다.
   * 대안을 고르셨으면 그 문구를 로그에 한 줄로 남기고, **보기 맨 위에 그 문장을 다시 세웁니다** —
   * 대안을 골라 놓고 버튼으로 다시 고를 수 없으면 「버튼만으로 끝까지」 약속이 그 지점에서 깨집니다.
   */
  const handleRetryAfterCritical = useCallback((alternative?: string) => {
    setChosenAlternative((alternative ?? "").trim());
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
    setChosenAlternative("");
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

  /**
   * 완주 직후 — 엔딩 패널을 화면 맨 위로 끌어옵니다.
   * 훈련을 끝내고도 축하도 다음 행동 버튼도 화면 밖 아래에 숨어 있던 자리입니다(평가 UX c2).
   */
  useEffect(() => {
    if (state.phase !== "ended") return undefined;
    /* 엔딩 패널이 이 커밋에서 갓 마운트되므로, ref가 잡힐 때까지 몇 프레임 재시도합니다.
       (첫 rAF에 ref가 비어 있으면 scrollTo(0,0) 폴백이 c2를 재현합니다 — 실측으로 확인된 함정) */
    let frame = 0;
    let tries = 0;
    const attempt = () => {
      const node = endingRef.current;
      if (node) {
        node.scrollIntoView({ block: "start", behavior: "auto" });
        return;
      }
      if (tries++ < 10) frame = window.requestAnimationFrame(attempt);
    };
    frame = window.requestAnimationFrame(attempt);
    return () => window.cancelAnimationFrame(frame);
  }, [state.phase]);

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
  const composing = Boolean(cue && turn && !ended && !inProtocol);

  return (
    <>
      {/* ⚑CF 시트가 떠 있는 동안 세션은 뒤로 물러납니다 (시안 6c — 배경 .25 + 딤 .32).

          **모바일: 페이지 스크롤 하나**(가이드 §5). 대화가 251px 창에 갇혀 있던 구조를 걷어내고,
          컴포저만 화면 아래에 도킹합니다 — 내용이 길면 페이지가 늘어나는 것이 정상입니다.
          **md↑**: 시안 7d 그대로 뷰포트에 고정된 2단(대화 + 레일)입니다. */}
      <div
        ref={sessionBoxRef}
        aria-hidden={interrupted || undefined}
        className={cx(
          "flex min-h-[calc(100dvh_-_var(--chim-safe-t))] flex-col",
          "md:h-[calc(100dvh_-_var(--chim-safe-t))] md:min-h-0 md:overflow-hidden",
          interrupted && "pointer-events-none opacity-30",
        )}
      >
        {/* 모바일에서 헤더를 상단에 도킹합니다 — 「종료」(이탈 경로)·진행바·계층 상태점은
            스크롤 중에도 보여야 합니다. L3의 sticky 119 바는 이 아래(top-[3.25rem])에 겹겹이 섭니다. */}
        <div
          ref={headBoxRef}
          className="sticky top-0 z-30 flex-none bg-paper px-[18px] md:static md:border-b md:border-line md:px-8"
        >
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
                  className="flex min-h-[48px] items-center px-2 text-[0.8125rem] font-semibold text-ink-muted"
                >
                  {ttsOn ? "소리 끄기" : "소리 켜기"}
                </button>
                {!ended && (
                  <button
                    type="button"
                    onClick={() => setExitOpen(true)}
                    className="flex min-h-[48px] items-center px-2 text-[0.875rem] font-semibold text-ink-muted"
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
        <div className="flex flex-1 flex-col md:min-h-0 md:flex-row">
          <div className="flex flex-1 flex-col md:min-h-0 md:border-r md:border-line">
            {/* 본문 — 지문과 대화. 말하는 중에는 옅어집니다(시안 4b).
                내부 스크롤 상자는 md↑에서만 켭니다. */}
            <div
              className={cx(
                "flex-1 px-[18px] pt-4 pb-6 transition-opacity duration-200 md:min-h-0 md:overflow-y-auto md:px-8 md:pt-6",
                listening && "pointer-events-none opacity-45",
              )}
            >
              <div className="md:mx-auto md:max-w-[560px]">
                <p className="text-center text-[0.7813rem] leading-[1.6] text-tertiary">
                  {scenario.context}
                </p>
                {/* 가상 인물 고지 — 화면마다 한 번은 또렷하게 남습니다(말풍선의 「AI 생성 · 가상 인물」과 별도). */}
                <p className="mt-1 mb-4 text-center text-[0.7188rem] leading-[1.6] text-ink-muted">
                  {FICTION_NOTICE}
                </p>

                <DialogueLog
                  items={state.log}
                  gaugeLabel={scenario.gauge.label}
                  emotion={emotion}
                  speaking={speakingKey.length > 0}
                  bottomInset={dockHeight}
                  autoScroll={!ended}
                  onLatestLineOffscreen={composing ? handleLatestLineOffscreen : undefined}
                  scrollToLatestLineRef={scrollToLatestLineRef}
                />

                {ended && record ? (
                  <div ref={endingRef} className="scroll-mt-3">
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
                  </div>
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
                      <p className="text-[0.9375rem] leading-[1.6] font-bold text-danger-ink">
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

            {/* 입력 도크 — 대화 중에만 섭니다. 그 밖의 구간에서는 고지 한 줄만 남깁니다.
                모바일에서는 화면 아래에 붙어 있고(sticky), md↑에서는 대화 아래 제자리에 섭니다. */}
            {composing && cue && turn ? (
              <div ref={setDockNode} className="sticky bottom-0 z-20 md:static md:flex-none">
                <CueResponder
                  scenario={scenario}
                  session={state.session}
                  cue={cue}
                  attempt={state.attempt}
                  micSupported={micSupported}
                  chosenAlternative={chosenAlternative || undefined}
                  anchor={
                    newLine.offscreen ? (
                      <button
                        type="button"
                        onClick={() => scrollToLatestLineRef.current?.()}
                        className="flex min-h-[48px] w-full items-center justify-center gap-1.5 border-b border-line bg-tint px-[18px] text-[0.8438rem] leading-[1.4] font-bold text-brand-800 md:px-8"
                      >
                        {NEW_LINE_ANCHOR[newLine.speaker]}
                        <span aria-hidden>↑</span>
                      </button>
                    ) : null
                  }
                  onSubmit={handleSubmit}
                  onListeningChange={setListening}
                />
              </div>
            ) : (
              <div className="border-t border-line bg-paper px-[18px] pt-3 pb-6 md:flex-none md:px-8">
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
            <h2 id="session-exit-title" className="text-[1.0625rem] leading-[1.4] font-bold text-ink">
              훈련을 끝낼까요?
            </h2>
            <p className="mt-2 text-[0.8125rem] leading-[1.6] text-ink-soft">
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
