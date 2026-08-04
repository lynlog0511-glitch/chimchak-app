"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Badge, BigButton, Card, Gauge } from "@/components";
import { cx } from "@/components/utils";
import { buildRecord, currentCue, currentTurn, protocolIdOf, resolveEnding } from "@/engine";
import { isRecognitionSupported, primeVoices, speak, stopSpeaking } from "@/lib/speech";
import { saveSession } from "@/lib/storage";
import type { EmergencyProtocol, Scenario } from "@/types";
import { BriefingPanel } from "./BriefingPanel";
import { CriticalInterrupt } from "./CriticalInterrupt";
import { CueResponder } from "./CueResponder";
import { DialogueLog } from "./DialogueLog";
import { EndingPanel } from "./EndingPanel";
import { ProtocolInline } from "./ProtocolInline";
import { TierIndicator } from "./TierIndicator";
import { FICTION_NOTICE, TIER_LABEL, TIER_TONE, TYPE_TONE } from "./constants";
import { initialTrainState, makeTrainReducer, type LogItem } from "./sessionMachine";

export interface TrainSessionProps {
  scenario: Scenario;
  /** 응급 프로토콜 전체 — L3 진입 시 여기서 골라 인라인 재생합니다 */
  protocols: EmergencyProtocol[];
}

/** 게이지 변동을 말로 알려 줍니다 (숫자·점수 표기 없음). */
function gaugeNotice(label: string, delta: number): string | null {
  if (delta > 0) return `${label}가 올라갔습니다.`;
  if (delta < 0) return `${label}가 가라앉았습니다.`;
  return null;
}

/**
 * 훈련 세션 화면.
 *
 * 브리핑 → 대화(CUE 응답·턴 피드백) → (필요 시) L3 응급 프로토콜 → 보고·기록 → 엔딩 순으로 흐릅니다.
 * 판정과 상태 전이는 전부 엔진이 하고, 이 컴포넌트는 화면 전환·음성·저장만 담당합니다.
 */
export function TrainSession({ scenario, protocols }: TrainSessionProps) {
  const reducer = useMemo(() => makeTrainReducer(scenario), [scenario]);
  const [state, dispatch] = useReducer(reducer, scenario, initialTrainState);

  const [ttsOn, setTtsOn] = useState(true);
  const [micSupported, setMicSupported] = useState(false);
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
    if (!lastLine) return;
    if (spokenKeyRef.current === lastLine.key) return;
    spokenKeyRef.current = lastLine.key;
    if (!ttsOn) return;
    void speak(lastLine.text);
  }, [state.log, ttsOn]);

  const toggleTts = useCallback(() => {
    setTtsOn((value) => {
      if (value) stopSpeaking();
      return !value;
    });
  }, []);

  /* ── 저장 ─────────────────────────────────────────────── */

  useEffect(() => {
    if (!record) return;
    if (savedIdRef.current === record.id) return;
    savedIdRef.current = record.id;
    saveSession(record);
  }, [record]);

  /* ── 조작 ─────────────────────────────────────────────── */

  const handleSubmit = useCallback(
    (input: { utterance?: string; branchId?: string; viaButton: boolean }) => {
      stopSpeaking();
      dispatch({ type: "submit", input });
    },
    [],
  );

  /** 화면이 바뀔 때 페이지 맨 위부터 읽으실 수 있게 합니다. */
  const scrollToTop = useCallback(() => {
    if (typeof window === "undefined") return;
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  const handleStart = useCallback(() => {
    dispatch({ type: "start" });
    scrollToTop();
  }, [scrollToTop]);

  const handleRestart = useCallback(() => {
    stopSpeaking();
    spokenKeyRef.current = "";
    dispatch({ type: "restart" });
    scrollToTop();
  }, [scrollToTop]);

  /* ── 브리핑 ───────────────────────────────────────────── */

  if (state.phase === "briefing") {
    return (
      <BriefingPanel scenario={scenario} micSupported={micSupported} onStart={handleStart} />
    );
  }

  const notice = state.lastFeedback
    ? gaugeNotice(scenario.gauge.label, state.lastFeedback.gaugeDelta)
    : null;

  return (
    <div className="space-y-6">
      {/* 상단 — 시나리오·게이지·상황 지문 */}
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={TYPE_TONE[scenario.type]}>{scenario.typeLabel}</Badge>
          <Badge tone="neutral">{scenario.levelLabel}</Badge>
          {scenario.tiers.map((tier) => (
            <Badge key={tier} tone={TIER_TONE[tier]}>
              {TIER_LABEL[tier]}
            </Badge>
          ))}
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-2xl font-extrabold text-ink md:text-3xl">{scenario.title}</h1>
          <button
            type="button"
            onClick={toggleTts}
            aria-pressed={ttsOn}
            className={cx(
              "inline-flex min-h-[48px] items-center gap-2 rounded-field border-2 px-4 text-base font-bold transition-colors duration-150",
              ttsOn
                ? "border-brand-300 bg-brand-50 text-brand-800"
                : "border-line bg-white text-ink-muted",
            )}
          >
            <span aria-hidden="true">{ttsOn ? "🔊" : "🔇"}</span>
            <span>대사 읽어 주기 {ttsOn ? "켜짐" : "꺼짐"}</span>
          </button>
        </div>

        <Card padded={false} className="p-4 md:p-5">
          {/* 지금 어느 계층이 작동 중인지 — 채점 순간 L2, 응급 구간에서는 L3로 넘어갑니다 */}
          <TierIndicator
            tiers={scenario.tiers}
            status={state.session.status}
            judgeTick={state.judgeTick}
            className="mb-4"
          />

          <div key={state.gaugeTick} className="animate-gauge">
            <Gauge
              value={state.session.gauge}
              max={scenario.gauge.max}
              label={scenario.gauge.label}
              crisisAt={scenario.gauge.crisisAt}
            />
          </div>
          {notice && (
            <p
              key={`notice-${state.gaugeTick}`}
              className="animate-fade-up mt-2.5 text-base font-bold text-ink-soft"
              role="status"
            >
              {notice}
            </p>
          )}
          <p className="mt-3 border-t border-line pt-3 text-base leading-relaxed text-ink-soft">
            {scenario.context}
          </p>
          <p className="mt-2 text-sm leading-relaxed font-semibold text-ink-muted">
            {FICTION_NOTICE} · 화면의 소리는 모두 자막과 함께 나옵니다.
          </p>
        </Card>
      </header>

      {/* 대화 로그 */}
      <DialogueLog items={state.log} />

      {/* 응답부 / 프로토콜 / 엔딩 */}
      {state.phase === "ended" && record ? (
        <EndingPanel
          scenario={scenario}
          session={state.session}
          ending={ending}
          record={record}
          advisoryEnding={advisoryEnding}
          onRestart={handleRestart}
        />
      ) : state.session.status === "protocol" ? (
        protocol ? (
          <ProtocolInline
            protocol={protocol}
            ttsOn={ttsOn}
            onDone={() => dispatch({ type: "protocolDone" })}
          />
        ) : (
          <Card tone="danger">
            <p className="text-base leading-relaxed font-bold text-danger-ink">
              응급 안내를 불러오지 못했습니다. 아래 버튼으로 이어서 진행해 주세요.
            </p>
            <div className="mt-4">
              <BigButton onClick={() => dispatch({ type: "protocolDone" })} size="lg" block>
                이어서 인계·보고로 돌아가기
              </BigButton>
            </div>
          </Card>
        )
      ) : cue && turn ? (
        <CueResponder
          scenario={scenario}
          session={state.session}
          cue={cue}
          attempt={state.attempt}
          micSupported={micSupported}
          onSubmit={handleSubmit}
        />
      ) : null}

      {/* ⚑CF 전면 인터럽트 */}
      {state.critical && (
        <CriticalInterrupt
          feedback={state.critical.feedback}
          alternatives={state.critical.alternatives}
          onRetry={() => dispatch({ type: "retryAfterCritical" })}
        />
      )}
    </div>
  );
}

export default TrainSession;
