"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { BigButton, InlineDisclaimer, SettingsMenu } from "@/components";
import { useModalDismiss, useOverlayTransition } from "@/components/useModalDismiss";
import { cx } from "@/components/utils";
import { buildRecord, currentCue, currentTurn, protocolIdOf, resolveEnding } from "@/engine";
import { startCueCoaching } from "@/lib/onlineCoach";
import {
  VARY_ADAPTER_NOTE,
  VARY_MAX_RECENT_LINES,
  isLineVaryActive,
  isVariableSpeaker,
  varyLine,
} from "@/lib/onlineVary";
import { subscribeSettings } from "@/lib/settings";
import { isRecognitionSupported, primeVoices, speak, stopSpeaking } from "@/lib/speech";
import { useWakeLock } from "@/lib/wakeLock";
import {
  clearProgress,
  loadProgress,
  saveProgress,
  saveSession,
  SESSION_SAVE_FAILED_BODY,
  type SessionProgress,
} from "@/lib/storage";
import type { CueDef, EmergencyProtocol, Scenario } from "@/types";
import { BriefingPanel } from "./BriefingPanel";
import { CriticalInterrupt } from "./CriticalInterrupt";
import { CueResponder, DOCK_MAX_RATIO } from "./CueResponder";
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
  GENERATION_ADAPTER_NOTE,
  SESSION_STATUS_ENDED,
  SESSION_STATUS_PROTOCOL,
  sessionSubtitle,
  TAIL_ANCHOR,
} from "./constants";
import { ruleDemoExamplesFor, RULE_DEMO_TITLE } from "./ruleDemoExamples";
import { cueProgress } from "./sessionProgress";
import {
  initialTrainState,
  makeTrainReducer,
  parseDemoPreset,
  type CriticalInterruptState,
  type LogItem,
} from "./sessionMachine";

/**
 * 새 대사를 「말하는 중」으로 붙들어 두는 시간(ms).
 *
 * 어르신이 말을 고르는 짧은 사이입니다 — 대화의 박자를 만드는 것이 목적이지
 * 기다리게 하는 것이 목적이 아니므로, 낭독 한 문장(수 초)보다 훨씬 짧게 잡습니다.
 * 아래 세 경우에는 **한 프레임도 붙들지 않습니다** — 소리를 꺼 두셨을 때(세션 헤더의 「소리 끄기」),
 * 움직임을 줄여 달라고 하셨을 때(`prefers-reduced-motion`), 시연 빨리감기 중일 때.
 * 버튼만으로 완주하시는 분이 이 연출 때문에 느려지지 않도록, 끄는 자리를 화면 안에 둔 셈입니다.
 */
const SPEAKING_HOLD_MS = 800;

/**
 * 대사 변주를 기다리는 **화면 쪽** 상한(ms).
 *
 * 이미 있던 「말하는 중」 800ms와 **겹칩니다** — 변주는 그 박자 안에서 끝나야 값이 있습니다.
 * 400ms가 더 붙을 수 있는 것이 전부이고, 그 안에 오지 않으면 검수 앵커로 그대로 넘어갑니다.
 * 늦게 도착한 답은 화면을 건드리지 못하고 보관소에만 들어갑니다(같은 지점을 다시 하실 때 씁니다) —
 * 이미 편 대사를 뒤늦게 갈아 끼우면 읽고 계신 문장이 눈앞에서 바뀝니다.
 */
const VARY_LINE_HOLD_MS = 1200;

/**
 * 「말하는 중」을 붙일 대사인지.
 * 상황 안내(system)와 검수된 고정 안내(protocol)는 사람이 말을 고르는 자리가 아니므로 그대로 폅니다.
 */
function isSpokenLine(item: LogItem | undefined): item is Extract<LogItem, { kind: "line" }> {
  if (!item || item.kind !== "line") return false;
  return item.speaker === "elder" || item.speaker === "guardian" || item.speaker === "dispatcher";
}

/**
 * 변주 요청에 실어 보낼 직전 맥락 두어 줄.
 *
 * 담는 것은 **인물·상황 대사뿐**입니다. 학습자 발화(`kind: "learner"`)는 여기서 걸러집니다 —
 * 맥락으로 실으면 편하지만, 그 순간 「기기 밖으로 나가는 말씀은 미분류 턴의 가명처리된 한 문장뿐」
 * 이라는 약속이 조용히 넓어집니다. 넓히지 않는 쪽을 고른 자리이고, 이 함수가 그 경계입니다.
 */
function recentContextLines(log: LogItem[], exceptKey: string): string[] {
  const out: string[] = [];
  for (let i = log.length - 1; i >= 0 && out.length < VARY_MAX_RECENT_LINES; i -= 1) {
    const item = log[i];
    if (!item || item.kind !== "line" || item.key === exceptKey) continue;
    if (item.text.trim().length === 0) continue;
    out.push(`${item.speakerName}: ${item.text}`);
  }
  return out.reverse();
}

/** 화면 움직임을 줄여 달라고 설정하신 분인지 (DialogueLog의 스크롤 규칙과 같은 질의입니다) */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * 「종료」 확인 모달.
 *
 * 예전에는 `role="dialog"`만 선언해 두고 초점 이동·Esc·Tab 트랩·배경 비활성이 전부 없었습니다 —
 * 바로 옆 ⚑CF 시트는 셋 다 갖추고 있어 같은 화면 안에서 모달 문법이 두 종류로 갈렸습니다
 * (평가 UI/UX m5 실측: 열린 직후 activeElement=BODY, Esc 후에도 dialog 잔존).
 * 지금은 같은 `useModalDismiss` 훅을 쓰고, 배경 세션 박스에는 여는 쪽에서 `aria-hidden`을 겁니다.
 *
 * 등장·퇴장도 시트와 **같은 240ms**입니다. 예전에는 이 모달만 `animate-fade-up`(500ms)이라,
 * 세션 헤더의 버튼 셋을 차례로 눌러 보면 하나는 즉시 뜨고 하나는 500ms 뒤에 뜨고 ⚑CF는 240ms에
 * 올라왔습니다 — 개별로는 미세하지만 연속으로 보면 「같은 앱이 아닌 것 같은」 감각을 만듭니다
 * (모션 감사 6). 오버레이 등장은 두 단(시트 240ms · 팝오버 180ms)뿐입니다.
 */
function ExitConfirm({ onClose }: { onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const { entered, leave } = useOverlayTransition(onClose);
  const dismiss = useCallback(() => leave(), [leave]);

  useModalDismiss({ panelRef, initialFocusRef: titleRef, onDismiss: dismiss });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-exit-title"
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
    >
      {/* 딤 — 모달과 같은 240ms로 함께 여닫힙니다. */}
      <div
        aria-hidden
        className={cx(
          "absolute inset-0 bg-ink/55 transition-opacity duration-[240ms] ease-out",
          entered ? "opacity-100" : "opacity-0",
        )}
      />
      <button
        type="button"
        aria-label="닫기"
        onClick={dismiss}
        className="absolute inset-0 cursor-default"
      />
      <div
        ref={panelRef}
        className={cx(
          "relative w-full max-w-[380px] rounded-panel bg-white p-5 shadow-panel",
          "transition-[opacity,transform] duration-[240ms] ease-out",
          entered ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
        )}
      >
        <h2
          id="session-exit-title"
          ref={titleRef}
          tabIndex={-1}
          className="text-[1.0625rem] leading-[1.45] font-bold text-ink"
        >
          훈련을 끝낼까요?
        </h2>
        <p className="mt-2 text-[0.8438rem] leading-[1.6] text-ink-soft">
          지금까지 진행한 자리는 이 기기에 남아 있어, 다음에 이어서 하실 수 있습니다. 말씀하신
          내용은 저장하지 않습니다.
        </p>
        <div className="mt-4 space-y-2">
          <BigButton onClick={dismiss} size="lg" block>
            계속하기
          </BigButton>
          <BigButton href="/train" variant="secondary" block>
            끝내고 훈련 목록으로
          </BigButton>
        </div>
      </div>
    </div>
  );
}

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
  /** 이번 회차 저장이 막혔는가(시크릿 모드 등) — 엔딩에서 성공한 척하지 않기 위한 사실 표시 */
  const [sessionSaveFailed, setSessionSaveFailed] = useState(false);
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
   * 아직 펴지 않고 「말하는 중」으로 붙들어 둔 대사 — 렌더용 상태와 같은 커밋 안에서 읽히는 표시(ref) 한 쌍입니다.
   *
   * 상태 하나로는 낭독을 막지 못합니다: 붙드는 효과가 `setState`를 부른 그 커밋에서
   * 낭독 효과는 아직 **예전 값**을 보기 때문에, 붙들어 놓고도 소리가 먼저 나갑니다.
   * 그래서 같은 값을 ref에도 즉시 적어 두고, 낭독 쪽은 ref로 판단합니다.
   */
  const [pendingLineKey, setPendingLineKey] = useState("");
  const pendingLineRef = useRef<string>("");
  /** 이미 펴 드린 마지막 대사 — 같은 대사를 두 번 붙들지 않습니다 */
  const shownLineRef = useRef<string>("");

  /* ── 대사 변주 (온라인 모드) ──────────────────────────────
     로그가 들고 있는 것은 언제나 검수 앵커입니다. 다시 쓰인 문장은 여기 따로 담아 두고,
     말풍선과 낭독만 그 문장을 봅니다 — 판정·게이지·기록은 앵커도 변주도 보지 않습니다.

     같은 것을 상태와 ref 두 벌로 드는 이유는 하나입니다: 화면은 렌더에서 읽고(상태),
     낭독 효과는 **펴지는 그 순간** 읽습니다(ref). ref가 없으면 변주가 도착한 커밋과 대사가
     펴지는 커밋 사이에서 자막과 소리가 한 문장 어긋날 수 있습니다. */
  const [variations, setVariations] = useState<ReadonlyMap<string, string>>(() => new Map());
  const variationsRef = useRef<Map<string, string>>(new Map());
  /** 온라인 모드가 켜져 있고 이 시나리오가 변주 대상인지 (응급 유형은 통째로 빠집니다) */
  const [varyOn, setVaryOn] = useState(false);

  const applyVariation = useCallback((key: string, text: string) => {
    variationsRef.current.set(key, text);
    setVariations(new Map(variationsRef.current));
  }, []);

  /** 회차가 바뀌면 비웁니다 — 로그 키는 회차마다 0부터 다시 세므로 남겨 두면 남의 대사에 붙습니다. */
  const resetVariations = useCallback(() => {
    if (variationsRef.current.size === 0) return;
    variationsRef.current.clear();
    setVariations(new Map());
  }, []);

  /* 서버에서는 설정을 알 수 없으므로 「꺼짐」으로 그린 뒤 마운트한 다음 실제 값으로 바꿉니다
     (기본값이 꺼짐이라 서버 렌더 결과와 첫 클라이언트 렌더가 어긋나지 않습니다 — /safety와 같은 규칙). */
  useEffect(() => {
    const read = () => setVaryOn(isLineVaryActive(scenario));
    read();
    return subscribeSettings(read);
  }, [scenario]);

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
  /**
   * 로그 꼬리가 가려졌는지 재는 데 쓰는 **고정** 도크 높이 — 앵커가 없을 때의 값입니다.
   *
   * 앵커는 도크 안에 렌더되므로 앵커가 뜨면 도크가 두꺼워집니다. 그 값을 그대로 관찰자에 물리면
   * 「앵커가 뜬다 → 도크가 커진다 → 관찰자가 다시 만들어진다 → 앵커가 꺼진다」가 됩니다
   * (평가 UI/UX m2의 자기취소 루프). 그래서 앵커가 떠 있는 동안에는 이 값을 갱신하지 않습니다 —
   * 앵커가 스스로의 판단 근거를 바꾸지 못합니다.
   */
  const [dockLimit, setDockLimit] = useState(0);
  /** 지금 앵커가 떠 있는지 — 위 값의 갱신을 멈추는 표시(효과를 다시 돌리지 않으려고 ref로 둡니다) */
  const anchorShownRef = useRef(false);

  useEffect(() => {
    if (!dockNode) {
      setDockHeight(0);
      setDockLimit(0);
      return undefined;
    }
    const desktop = window.matchMedia("(min-width: 768px)");
    const measure = () => {
      const height = desktop.matches ? 0 : Math.round(dockNode.getBoundingClientRect().height);
      setDockHeight(height);
      if (anchorShownRef.current) return;
      /* 도크는 CSS로도 45dvh를 넘지 않지만, 관찰자 쪽 상한을 한 번 더 걸어 둡니다 —
         이 값이 커질수록 「가려졌다」고 보는 띠가 넓어집니다. */
      setDockLimit(Math.min(height, Math.round(window.innerHeight * DOCK_MAX_RATIO)));
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

  /** 새 대사 아래로 이어지는 코칭이 화면 밖일 때 컴포저 위에 뜨는 앵커 */
  const [tailOffscreen, setTailOffscreen] = useState(false);
  const scrollToTailRef = useRef<(() => void) | null>(null);
  /** 앵커가 뜨고 지는 순간 도크 높이 갱신을 멈추도록, 상태보다 **먼저** 표시를 바꿔 둡니다. */
  const handleTailOffscreen = useCallback((offscreen: boolean) => {
    anchorShownRef.current = offscreen;
    setTailOffscreen(offscreen);
  }, []);

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

  /* 훈련이 도는 동안에는 화면이 저절로 꺼지지 않게 붙듭니다 —
     말로 답하는 구간에서는 몇 십 초씩 화면에 손이 닿지 않아, 어르신 대사 도중에 화면이 꺼집니다.
     브리핑·엔딩·이탈 시에는 풀립니다. 미지원·거부 기기에서는 아무 일도 일어나지 않습니다. */
  useWakeLock(inSessionView && state.phase !== "ended");

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

  /* ── 규칙 엔진 시연 (발표용) ────────────────────────────────
     여는 행은 컴포저 밖 — 대화 로그 아래에 있습니다. 컴포저 안에 두었을 때는 제안 버튼
     셋보다 아래로 밀려 어느 글자 크기에서도 노출 0px이었습니다(375×812 실측).
     시트 자체와 「입력창에 채우기」는 그대로 CueResponder가 맡습니다. */
  const cueId = cue?.id;
  const demoExamples = useMemo(
    () => (cueId ? ruleDemoExamplesFor(scenario.type, cueId) : []),
    [cueId, scenario.type],
  );
  const [ruleDemoOpen, setRuleDemoOpen] = useState(false);
  const closeRuleDemo = useCallback(() => setRuleDemoOpen(false), []);
  /** 장면이 넘어가면 시트를 닫습니다 — 지난 장면의 예시가 새 장면에 남지 않게. */
  useEffect(() => {
    setRuleDemoOpen(false);
  }, [cueId, state.attempt]);

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

  /**
   * 새 대사가 도착하면 한 박자 붙듭니다 — 「말하는 중」 빈 말풍선 → 대사 + 낭독.
   *
   * 붙드는 것은 **로그 맨 끝의 인물 대사** 하나뿐입니다. 뒤에 코칭이 이미 붙은 대사는
   * 붙들면 코칭까지 함께 가려지므로 그대로 폅니다(반응 대사 → 코칭 → 「말하는 중」 → 다음 대사 순서).
   * 낭독 효과보다 **먼저** 선언돼 있어야 같은 커밋에서 ref가 채워집니다 — 순서를 바꾸지 마세요.
   *
   * 온라인 모드를 켜신 경우, 이 박자 **안에서** 대사 변주를 청합니다(어르신·보호자 대사만).
   * 붙드는 시간이 없는 세 경우(소리 끔·움직임 줄임·시연 빨리감기)에는 청하지 않습니다 —
   * 그때 변주를 기다리면 그것은 겹치는 연출이 아니라 **새로 만든 지연**입니다.
   */
  useEffect(() => {
    const tail = state.log[state.log.length - 1];
    const spoken = isSpokenLine(tail) ? tail : undefined;
    const key = spoken?.key ?? "";

    const reveal = () => {
      if (key.length > 0) shownLineRef.current = key;
      pendingLineRef.current = "";
      setPendingLineKey("");
    };

    if (key.length === 0 || shownLineRef.current === key) {
      pendingLineRef.current = "";
      setPendingLineKey("");
      return undefined;
    }
    /* 소리를 꺼 두셨거나 · 움직임을 줄이셨거나 · 시연 빨리감기 중이면 곧바로 폅니다. */
    if (!ttsOn || demoModeRef.current || prefersReducedMotion()) {
      reveal();
      return undefined;
    }

    pendingLineRef.current = key;
    setPendingLineKey(key);

    let cancelled = false;
    let revealed = false;
    let timer = 0;

    const revealNow = () => {
      if (cancelled || revealed) return;
      revealed = true;
      window.clearTimeout(timer);
      reveal();
    };
    const holdFor = (ms: number) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(revealNow, Math.max(0, ms));
    };

    const target = spoken && varyOn && isVariableSpeaker(spoken.speaker) ? spoken : undefined;
    if (!target) {
      holdFor(SPEAKING_HOLD_MS);
    } else {
      const startedAt = Date.now();
      /* 상한을 먼저 걸어 둡니다 — 답이 늦어도 화면은 1200ms에서 반드시 다음으로 넘어갑니다. */
      holdFor(VARY_LINE_HOLD_MS);
      void varyLine({
        scenario,
        speaker: target.speaker,
        anchor: target.text,
        recentLines: recentContextLines(state.log, key),
      }).then((outcome) => {
        // 이미 편 대사는 바꾸지 않습니다 — 늦게 온 답은 보관소에만 남아 다음 방문에 쓰입니다.
        if (cancelled || revealed) return;
        if (outcome.varied) applyVariation(key, outcome.text);
        // 남은 박자는 그대로 지킵니다 — 변주가 빨리 왔다고 대사가 튀어나오면 안 됩니다.
        holdFor(SPEAKING_HOLD_MS - (Date.now() - startedAt));
      });
    }

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [applyVariation, scenario, state.log, ttsOn, varyOn]);

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
    /* 「말하는 중」으로 붙들고 있는 동안에는 읽지 않습니다 — 자막보다 소리가 먼저 나가면
       화면에 없는 문장을 듣게 됩니다. 펴지는 순간 이 효과가 다시 돌아 그때 읽습니다. */
    if (pendingLineRef.current === lastLine.key) return undefined;
    if (spokenKeyRef.current === lastLine.key) return undefined;
    spokenKeyRef.current = lastLine.key;
    if (!ttsOn) return undefined;

    const key = lastLine.key;
    let cancelled = false;
    setSpeakingKey(key);
    /* 화면에 선 문장을 그대로 읽습니다 — 변주된 대사는 동봉 음성 매니페스트에 없으므로
       speak()가 브라우저 낭독으로 넘어갑니다(정상 경로입니다. 자막과 소리는 언제나 같습니다). */
    void speak(variationsRef.current.get(key) ?? lastLine.text).then(() => {
      if (cancelled) return;
      setSpeakingKey((current) => (current === key ? "" : current));
    });
    return () => {
      cancelled = true;
    };
  }, [state.log, ttsOn, pendingLineKey]);

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
    // 저장이 막힌 기기(시크릿 모드 등)에서는 성공한 척하지 않습니다 — 엔딩에 사실대로 세웁니다.
    setSessionSaveFailed(!saveSession(record));
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

  /**
   * 방금 직접 말씀하신 발화와 그때의 장면.
   * 온라인 코칭을 켠 경우, 판정이 **중립 미분류**로 떨어졌을 때만 이 한 쌍을 씁니다.
   * (버튼으로 고르신 턴은 발화가 없으므로 여기 담기지 않습니다.)
   */
  const askedRef = useRef<{ utterance: string; cue: CueDef } | null>(null);

  const handleSubmit = useCallback(
    (input: { utterance?: string; branchId?: string; viaButton: boolean }) => {
      stopSpeaking();
      setSpeakingKey("");
      setChosenAlternative("");
      const spoken = (input.utterance ?? "").trim();
      askedRef.current = cue && spoken.length > 0 ? { utterance: spoken, cue } : null;
      dispatch({ type: "submit", input });
    },
    [cue],
  );

  /**
   * 온라인 코칭 — **미분류로 떨어진 턴에서만** 한 문장을 더 청합니다.
   *
   * 설정에서 꺼져 있거나(기본값) 오프라인이면 아무 일도 일어나지 않습니다. 판정·게이지·기록은
   * 이 지점에서 이미 끝나 있고, 도착한 문장은 코칭 덩어리 아래에 붙기만 합니다
   * (`InlineCoaching` — 근거 가드를 통과하지 못하면 고정 문구로 바뀝니다).
   */
  useEffect(() => {
    const feedback = state.lastFeedback;
    const asked = askedRef.current;
    if (!feedback || !asked) return;
    askedRef.current = null;
    // 규칙 사전·분기 신호에 걸린 판정은 근거가 이미 분명합니다 — 덧붙이지 않습니다.
    if (feedback.trace?.source !== "default") return;
    void startCueCoaching(feedback, {
      scenario,
      cue: asked.cue,
      utterance: asked.utterance,
    });
  }, [scenario, state.lastFeedback]);

  const closeExit = useCallback(() => setExitOpen(false), []);

  /** 화면이 바뀔 때 페이지 맨 위부터 읽으실 수 있게 합니다. */
  const scrollToTop = useCallback(() => {
    if (typeof window === "undefined") return;
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  /** 처음부터 — 남아 있던 체크포인트는 지웁니다. */
  const handleStart = useCallback(() => {
    clearProgress(scenario.id);
    /* 「처음부터」는 로그 키까지 되돌아갑니다 — 지난 회차에 이미 폈던 키라고 기억하고 있으면
       첫 대사가 「말하는 중」 없이 튀어나옵니다. */
    shownLineRef.current = "";
    pendingLineRef.current = "";
    resetVariations();
    setCheckpoint(null);
    setAtBriefing(false);
    setCriticalScene(null);
    setChosenAlternative("");
    dispatch({ type: "start" });
    scrollToTop();
  }, [resetVariations, scenario.id, scrollToTop]);

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
    shownLineRef.current = "";
    pendingLineRef.current = "";
    resetVariations();
    clearProgress(scenario.id);
    setCheckpoint(null);
    setAtBriefing(false);
    setCriticalScene(null);
    setChosenAlternative("");
    dispatch({ type: "restart" });
    scrollToTop();
  }, [resetVariations, scenario.id, scrollToTop]);

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
    shownLineRef.current = "";
    pendingLineRef.current = "";
    resetVariations();
    dispatch({ type: "resume", progress: checkpoint });
    setCheckpoint(null);
    setAtBriefing(false);
    setChosenAlternative("");
    scrollToTop();
  }, [checkpoint, resetVariations, scrollToTop]);

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
  /* 전면 모달이 떠 있는 동안 배경 세션은 보조기술에서도 물러납니다 —
     그러지 않으면 Tab이 뒤쪽 세션으로 빠져나갑니다(⚑CF만 걸려 있던 규칙을 종료 모달까지 넓힙니다). */
  const behindModal = interrupted || exitOpen;

  return (
    <>
      {/* ⚑CF 시트가 떠 있는 동안 세션은 뒤로 물러납니다 (시안 6c — 배경 .25 + 딤 .32).

          **모바일: 페이지 스크롤 하나**(가이드 §5). 대화가 251px 창에 갇혀 있던 구조를 걷어내고,
          컴포저만 화면 아래에 도킹합니다 — 내용이 길면 페이지가 늘어나는 것이 정상입니다.
          **md↑**: 시안 7d 그대로 뷰포트에 고정된 2단(대화 + 레일)입니다. */}
      <div
        ref={sessionBoxRef}
        aria-hidden={behindModal || undefined}
        className={cx(
          "flex min-h-[calc(100dvh_-_var(--chim-safe-t))] flex-col",
          "md:h-[calc(100dvh_-_var(--chim-safe-t))] md:min-h-0 md:overflow-hidden",
          /* 배경이 물러나는 것도 시트·딤과 **같은 240ms**입니다 — 예전에는 여기만 0s 하드컷이라
             ⚑CF의 첫 프레임이 「멈춰 세웠다」가 아니라 「화면이 깜빡했다」로 읽혔습니다(모션 감사 2).
             물러나는 깊이는 시안 6c의 .25입니다(옛 구현값 .30에서 한 단 더 내려 딤 강화와 짝을 맞춥니다) —
             ⚑CF는 이 앱에서 화면이 사람을 멈춰 세우는 유일한 자리라, 그 한 번은 분명해야 합니다. */
          "transition-opacity duration-[240ms] ease-out",
          interrupted && "pointer-events-none opacity-25",
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
                {/* 글자 크기 — 세션 안에는 진입점이 0건이라, 대사가 작다고 느낀 분이 훈련을 나갔다가
                    홈까지 가서 설정하고 돌아와야 했습니다(평가 UI/UX mi5 · 초보 m2).
                    「소리 끄기」와 같은 문법의 텍스트 버튼 하나로 같은 팝오버를 엽니다. */}
                <SettingsMenu label="글자 크기" align="screen" />
                {/* 헤더의 텍스트 버튼도 눌리면 면이 한 단 어두워집니다 —
                    Tailwind v4는 hover를 `@media (hover:hover)`에 가두므로, 터치 기기에서
                    피드백이 남는 곳은 `active:`뿐입니다(모션 감사 1). */}
                <button
                  type="button"
                  onClick={toggleTts}
                  aria-pressed={ttsOn}
                  className="flex min-h-[48px] items-center rounded-field px-2 text-[0.8438rem] font-semibold text-ink-muted transition-colors duration-150 active:bg-paper-2"
                >
                  {ttsOn ? "소리 끄기" : "소리 켜기"}
                </button>
                {!ended && (
                  <button
                    type="button"
                    onClick={() => setExitOpen(true)}
                    className="flex min-h-[48px] items-center rounded-field px-2 text-[0.8438rem] font-semibold text-ink-muted transition-colors duration-150 active:bg-paper-2"
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
                "flex-1 px-[18px] pt-4 pb-6 transition-opacity duration-200 md:min-h-0 md:overflow-y-auto md:overscroll-contain md:px-8 md:pt-6",
                listening && "pointer-events-none opacity-45",
              )}
            >
              <div className="md:mx-auto md:max-w-[560px]">
                <p className="text-center text-[0.7813rem] leading-[1.6] text-tertiary">
                  {scenario.context}
                </p>
                {/* 가상 인물 고지 — 화면마다 한 번은 또렷하게 남습니다(말풍선의 「AI 생성 · 가상 인물」과 별도). */}
                <p className="mt-1 text-center text-[0.6875rem] leading-[1.6] text-ink-muted">
                  {FICTION_NOTICE}
                </p>
                {/* 생성 자리 한 줄 — 가상 인물 고지와 같은 문법(같은 크기·같은 자리)으로 답니다.
                    이 화면이 「생성 0건」이라고 적는 까닭과, 경량 LLM 어댑터가 어디부터 붙는지가
                    같은 문장 안에 있어야 소개와 화면 표기가 어긋나 보이지 않습니다.

                    온라인 모드를 켜신 세션에서는 문장을 갈아 세웁니다 — 「대사는 검수된 시나리오
                    문장」이라는 단언을 그대로 두면, 바로 아래 말풍선의 「변주」 표기와 어긋납니다. */}
                <p className="mt-1 text-center text-[0.6875rem] leading-[1.6] text-ink-muted">
                  {varyOn ? VARY_ADAPTER_NOTE : GENERATION_ADAPTER_NOTE}
                </p>

                {/* 고지는 로그 위에 한 번 둡니다 — 예전에는 입력 도크 안에 상주해
                    상시 안내문 넉 줄(141px)의 한 몫을 하고 있었습니다(평가 UI/UX m1). */}
                <InlineDisclaimer tone="readable" className="mt-1 mb-4" />

                <DialogueLog
                  items={state.log}
                  gaugeLabel={scenario.gauge.label}
                  emotion={emotion}
                  speaking={speakingKey.length > 0}
                  bottomInset={dockHeight}
                  tailInset={dockLimit}
                  autoScroll={!ended}
                  pendingLineKey={pendingLineKey}
                  onTailOffscreen={composing ? handleTailOffscreen : undefined}
                  scrollToTailRef={scrollToTailRef}
                  variations={variations}
                />

                {/* 규칙 엔진 시연 진입 — 컴포저 밖, 대화 로그 바로 아래입니다.
                    발표자가 찾는 자리이자, 평소에는 대화 끝에 조용히 남는 한 줄입니다.
                    헤어라인 하나로 대화와 갈라 둡니다 — 시연 장치가 대사처럼 읽히지 않게.
                    (시트는 body로 포털되므로 여기서 열어도 뜨는 자리는 같습니다.) */}
                {composing && demoExamples.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setRuleDemoOpen(true)}
                    aria-haspopup="dialog"
                    className="mt-3 flex min-h-[48px] w-full items-center justify-between gap-3 rounded-field border-t border-line px-1 pt-1 text-left text-[0.8438rem] font-semibold text-ink-muted transition-colors duration-150 hover:bg-paper-2 active:bg-paper-2"
                  >
                    <span>{RULE_DEMO_TITLE}</span>
                    <span aria-hidden className="flex-none text-[0.8438rem] text-ink-ghost">
                      ›
                    </span>
                  </button>
                )}

                {ended && record ? (
                  /* 대사 줄과 같은 규칙으로 헤더 실측 높이를 비웁니다 —
                     `scroll-mt-3`만 두면 완주 직후 ✓ 54px 마크의 87%가 sticky 헤더에 깔립니다
                     (「아주 크게」에서는 제목 줄까지 통째로 — 평가 UI/UX mi3 실측). */
                  <div
                    ref={endingRef}
                    className="scroll-mt-[calc(var(--session-head-h,0px)_+_12px)] md:scroll-mt-3"
                  >
                    {sessionSaveFailed && (
                      <p className="mt-6 rounded-card bg-warn-soft px-4 py-3 text-[0.9375rem] leading-[1.6] text-warn-ink">
                        {SESSION_SAVE_FAILED_BODY}
                      </p>
                    )}
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
                    tailOffscreen ? (
                      <button
                        type="button"
                        onClick={() => scrollToTailRef.current?.()}
                        className="flex min-h-[48px] w-full items-center justify-center gap-1.5 border-b border-line bg-tint px-[18px] text-[0.8438rem] leading-[1.45] font-bold text-brand-800 transition-colors duration-150 active:bg-mint-200 md:px-8"
                      >
                        {TAIL_ANCHOR}
                        <span aria-hidden>↓</span>
                      </button>
                    ) : null
                  }
                  demoExamples={demoExamples}
                  demoOpen={ruleDemoOpen}
                  onDemoClose={closeRuleDemo}
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

      {/* 종료 확인 — ⚑CF 시트와 같은 훅으로 초점·Esc·Tab을 다룹니다(모달 문법 하나로 통일) */}
      {exitOpen && <ExitConfirm onClose={closeExit} />}

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
