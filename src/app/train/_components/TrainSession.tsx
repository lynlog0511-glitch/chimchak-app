"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { BigButton } from "@/components";
import { useModalDismiss, useOverlayTransition } from "@/components/useModalDismiss";
import { cx } from "@/components/utils";
import { buildRecord, currentCue, currentTurn, protocolIdOf, resolveEnding } from "@/engine";
import { startCueCoaching } from "@/lib/onlineCoach";
import { isLineVaryActive, varyLine } from "@/lib/onlineVary";
import { subscribeSettings } from "@/lib/settings";
import { getStageMode, subscribeStageMode } from "@/lib/stageMode";
import {
  isRecognitionSupported,
  isSpeechSynthesisSupported,
  primeVoices,
  speak,
  stopSpeaking,
} from "@/lib/speech";
import { useVoicePresence } from "@/app/emergency/_components/useProtocolPlayback";
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
import { CueResponder } from "./CueResponder";
import { EndingPanel } from "./EndingPanel";
import { InlineCoaching } from "./InlineCoaching";
import { ProtocolInline } from "./ProtocolInline";
import { SessionHeader } from "./SessionHeader";
import type { MicCheck } from "./constants";
import {
  isSpokenLine,
  lineHoldMs,
  lineSpokenAloud,
  settleHoldMs,
  varyArrival,
  varyTargetOf,
  type LinePlayback,
} from "./lineArrival";
import { ruleDemoExamplesFor, RULE_DEMO_TITLE } from "./ruleDemoExamples";
import { cueProgress } from "./sessionProgress";
import {
  initialTrainState,
  makeTrainReducer,
  parseDemoPreset,
  type CriticalReplyOption,
  type CriticalInterruptState,
  type LogItem,
} from "./sessionMachine";

/**
 * 소리가 켜진 채로 세션에 들어오신 낭독 사용자께 **한 번만** 드리는 안내.
 *
 * 소리 기본값이 켜짐이라 대화 로그 리전은 `aria-live="off"`로 내려가 있고, 어르신 대사는
 * 앱의 TTS가 읽습니다. 그 상태에서는 스크린리더 사용자에게 앱 목소리와 리더 목소리가 겹치는데,
 * 벗어나는 길(헤더의 「소리 끄기」)이 있다는 사실을 알려 드리는 곳이 화면 어디에도 없었습니다 —
 * Tab으로 우연히 닿기 전까지는 막힌 길입니다(3차 페르소나 UI/UX med · 이 제품의 중심 장면).
 * 화면에는 아무것도 늘리지 않고 `sr-only` 한 줄로만 전합니다.
 */
const VOICE_ON_NOTICE =
  "어르신 대사를 소리로 읽어 드리고 있습니다. 화면 위 「소리 끄기」를 누르시면 글로 전해 드립니다.";

/** 화면 움직임을 줄여 달라고 설정하신 분인지 (DialogueLog의 스크롤 규칙과 같은 질의입니다) */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * 대사 도착 효과(아래 효과 ①)가 쓰는 훅 — **그리기 전에** 도는 자리입니다.
 *
 * 이 효과가 하는 일 가운데 하나가 「보관소에 이 앵커의 변주가 이미 있는가」를 보고, 있으면
 * 그 문장을 세우는 것입니다. `useEffect`(그린 뒤)로 두면 붙들지 않는 화면 — 움직임 줄임 ·
 * 시연 빨리감기 · 소리 끔 — 에서는 앵커가 **한 번 그려진 뒤에** 문장이 얹혀, 읽고 계신 문장이
 * 눈앞에서 바뀌는 「교체」가 됩니다. 이 앱이 명시적으로 금지한 모양입니다.
 * `useLayoutEffect`로 두면 같은 커밋 안에서 상태가 바뀌고 브라우저는 **한 번만** 그리므로,
 * 그 대사는 **처음부터** 변주문으로 섭니다.
 *
 * 서버 렌더에서는 `useLayoutEffect`가 아무 일도 하지 않고 경고만 남기므로 그 자리에서는
 * `useEffect`를 씁니다. 값이 모듈 로드 시 한 번 정해지므로 훅 호출 순서는 바뀌지 않습니다.
 */
const useLineArrivalEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

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
          "relative w-full max-w-[380px] rounded-panel bg-paper p-5 shadow-panel",
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
  /**
   * 이 시나리오가 여는 응급 프로토콜 — L3 진입 시 여기서 골라 인라인 재생합니다.
   * 목록 전체가 아니라 **이 화면이 쓰는 것만** 옵니다(train/[id]/page.tsx의 `protocolsFor`).
   */
  protocols: EmergencyProtocol[];
}

type CurrentLine = Extract<LogItem, { kind: "line" }>;

function CurrentLineCard({
  line,
  text,
  waiting,
  speaking,
  spokenAloud,
}: {
  line: CurrentLine;
  text: string;
  waiting: boolean;
  speaking: boolean;
  spokenAloud: boolean;
}) {
  const heading =
    line.speaker === "elder"
      ? "어르신이 말씀하셨어요"
      : line.speaker === "guardian"
        ? "보호자가 말씀했어요"
        : line.speaker === "dispatcher"
          ? "상황실에서 말씀했어요"
          : "지금 상황이에요";

  return (
    <section
      aria-label="현재 대사"
      aria-live={spokenAloud ? "off" : "polite"}
      aria-atomic="true"
      className="rounded-panel bg-paper-2 px-5 py-5"
    >
      <div className="flex items-center gap-2">
        <span aria-hidden className="h-3 w-3 flex-none rounded-full bg-brand-600" />
        <h2 className="text-[1rem] leading-[1.45] font-bold text-brand-800">{heading}</h2>
        {speaking && <span className="ml-auto text-[0.9375rem] font-bold text-brand-800">읽는 중</span>}
      </div>
      {line.note && (
        <p className="mt-3 text-[0.9375rem] leading-[1.45] text-ink-soft">{line.note}</p>
      )}
      <p className="mt-3 text-[1.375rem] leading-[1.45] font-bold tracking-[-0.015em] text-ink">
        {waiting ? "잠시만 기다려 주세요…" : `“${text}”`}
      </p>
    </section>
  );
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
  /**
   * 「소리가 실제로 나는가」 — 정의는 응급 두 화면과 **같은 한 벌**에서 옵니다
   * (`useVoicePresence`). 이 화면이 쓰는 값은 `spokenAloud` 하나입니다.
   *
   * 예전에는 이 화면만 사용자 스위치(`ttsOn`) 그 자체를 리전 게이트로 넘겼습니다. 그런데 이
   * 세션에는 자동재생 가드가 아예 없었고 `ttsOn`은 지원·차단 판정 없이 `useState(true)`로
   * 시작했으므로, 「소리가 난다」를 세 자리가 세 가지로 세고 있었습니다 — 하필 이 화면의 대사는
   * **변주된 문장**이라 동봉 음성 매니페스트에 없고, `speechSynthesis`가 없는 기기에서는
   * `speak()`가 소리 없이 즉시 끝납니다(`lib/speech.ts`). 그 순간 로그는 `aria-live="off"`라
   * 앱 목소리도 리더 목소리도 없는 구간이 생겼습니다(7차 페르소나 UI/UX P0).
   */
  const { spokenAloud } = useVoicePresence(ttsOn);
  const [synthesisReady, setSynthesisReady] = useState(true);
  useEffect(() => {
    setSynthesisReady(isSpeechSynthesisSupported());
  }, []);
  /**
   * 이 기기에 **브라우저 낭독**(`speechSynthesis`)이 있는가 — 변주문 한 줄이 여기 걸립니다.
   *
   * `spokenAloud`가 답하는 것은 「이 기기가 소리를 낼 수 있는가」이고, 그 답은 동봉 오디오만
   * 있어도 참입니다. 검수 앵커는 실제로 그 표에 있어 소리가 나지만 **변주문은 그 표에
   * 없습니다** — 새로 쓰인 문장이라 열쇠가 없고, 브라우저 낭독이 없으면 `speak()`가 소리 없이
   * 즉시 끝납니다. 그 한 갈래를 재는 값이고, 쓰는 곳은 `lineSpokenAloud` 하나입니다.
   *
   * 서버·첫 페인트에서는 잴 수 없으므로 「된다」로 시작합니다 —
   * 「안 된다」로 시작하면 지원하는 기기에서 첫 대사만 리전이 두 번 말합니다.
   */
  /**
   * 이 세션 화면이 **사용자가 버튼을 눌러** 열렸는지 (「시작하기」·「이어서 하기」).
   *
   * 브리핑에서 그 버튼을 누르면 `BriefingPanel`이 통째로 언마운트되므로 눌린 버튼이 사라지고
   * 초점이 `document.body`로 떨어집니다 — 라우트 전환과 성격이 같은 화면 교체인데, 앱 안에서
   * 초점이 사라지는 자리가 하필 제품의 중심 장면이었습니다(3차 페르소나 UI/UX med).
   * 이 값이 참일 때 입력 도크가 **첫 CUE 지시문**으로 초점을 옮깁니다(`CueResponder`의
   * `focusFirstCue`). 문서가 막 열린 첫 마운트(주소로 곧장 들어와 이미 진행 중인 판을 복원하는
   * 경우 등)는 거짓이라 초점을 건드리지 않습니다 — `RouteFocus`가 첫 로드를 제외하는 것과
   * 같은 판단 기준입니다.
   */
  const [startedByUser, setStartedByUser] = useState(false);
  /** 소리 켜짐 안내(`VOICE_ON_NOTICE`)를 이미 내보냈는지 — 세션당 한 번입니다. */
  const [voiceNotice, setVoiceNotice] = useState("");
  const voiceNoticeSentRef = useRef(false);
  /* 마이크 판정은 마운트 뒤에 납니다 — 그전까지는 「모른다」로 둡니다(constants.ts `MicCheck`). */
  const [micCheck, setMicCheck] = useState<MicCheck>("unknown");
  /** 이 기기에 남아 있는 진행 체크포인트 — 브리핑에서 「이어서 하기」로 안내합니다 */
  const [checkpoint, setCheckpoint] = useState<SessionProgress | null>(null);
  /** ‹ 로 브리핑으로 되돌아가 있는 중인지 (세션 상태는 그대로 두고 화면만 바꿉니다) */
  const [atBriefing, setAtBriefing] = useState(false);
  /** 말하는 중 — 본문을 흐리게 합니다 (시안 4b) */
  const [, setListening] = useState(false);
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

  /* ── 대사 변주 (설정 「어르신 말투 · 매번 조금씩 다르게」 — 기본값) ──
     로그가 들고 있는 것은 언제나 검수 앵커입니다. 다시 쓰인 문장은 여기 따로 담아 두고,
     말풍선과 낭독만 그 문장을 봅니다 — 판정·게이지·기록은 앵커도 변주도 보지 않습니다.

     같은 것을 상태와 ref 두 벌로 드는 이유는 하나입니다: 화면은 렌더에서 읽고(상태),
     낭독 효과는 **펴지는 그 순간** 읽습니다(ref). ref가 없으면 변주가 도착한 커밋과 대사가
     펴지는 커밋 사이에서 자막과 소리가 한 문장 어긋날 수 있습니다. */
  const [variations, setVariations] = useState<ReadonlyMap<string, string>>(() => new Map());
  const variationsRef = useRef<Map<string, string>>(new Map());
  /** 말투가 「매번 조금씩 다르게」이고 이 시나리오가 변주 대상인지 (응급 유형은 통째로 빠집니다) */
  const [varyOn, setVaryOn] = useState(false);
  /** 이번 회차에 변주를 이미 청한 대사 — 같은 대사에 두 번 청하지 않습니다 */
  const varyAskedRef = useRef<string>("");
  /**
   * 지금 도는 변주 요청 한 건 — **요청 효과가 적고, 박자 효과가 읽습니다.**
   *
   * 여기 실리는 것은 **상류로 실제 요청이 나간 대사뿐**입니다(`varyArrival`이 `"ask"`).
   * 보관소 적중·오프라인·인물 프로필 없음은 여기 오지 않습니다 — 그 대사들은 붙들 이유가
   * 없고, 14차에는 구분 없이 실려 소리를 끄신 분이 얻는 것 없이 매 대사 700ms를 치렀습니다.
   *
   * `settle`은 박자 효과가 걸어 두는 자리입니다. 답이 도착하면 그 자리에서 남은 박자만
   * 지키고 대사를 폅니다 — 변주가 빨리 왔다고 대사가 튀어나오면 안 됩니다. 인자는 **문장이
   * 실제로 바뀌었는가**입니다: 바뀌지 않았으면 붙들 이유 자체가 사라지므로 박자 효과가
   * 「변주를 안 청했을 때의 시간」으로 되돌립니다(`settleHoldMs`).
   * 붙들지 않는 화면(움직임 줄임 등)에서는 아무도 걸어 두지 않으므로 그냥 비어 있습니다.
   */
  const varyWaitRef = useRef<{
    key: string;
    startedAt: number;
    settle?: (varied: boolean) => void;
  } | null>(null);

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

  /**
   * 회차가 새로 시작될 때 대사 박자·낭독 표시를 **통째로** 비웁니다 — 로그 키가 0부터 다시
   * 세어지므로(`sessionMachine`의 `line-${seq}-${turn.id}`) 남겨 두면 지난 회차의 기억이
   * 새 회차의 첫 대사에 그대로 붙습니다.
   *
   * 비우는 것은 다섯입니다.
   *  · `shown`·`pending` — 남기면 첫 대사가 「말하는 중」 없이 튀어나옵니다.
   *  · `asked`·`wait`   — 남기면 지난 회차에 이미 청했다고 기억해 **변주를 아예 청하지 않습니다**.
   *  · `spoken`         — 남기면 **첫 대사가 소리 없이 지나갑니다.** 키가 지난 회차와 글자 그대로
   *    같아 낭독 효과가 조기 반환하고, 그동안 화면의 sr-only 안내는 「소리로 읽어 드리고
   *    있습니다」로 남아 낭독 사용자에게 두 사실이 어긋납니다(15차 newcode high).
   *
   * 이 다섯을 **한 함수**에 모아 두는 것이 그 결함의 재발을 막는 자리입니다 — 14차에는
   * `spoken`만 이 함수 밖에 있었고, 세 진입 경로(처음부터·다시 하기·이어서 하기) 가운데
   * 「처음부터」만 그 한 줄을 빠뜨렸습니다.
   */
  const resetLineTiming = useCallback(() => {
    stopSpeaking();
    setSpeakingKey("");
    spokenKeyRef.current = "";
    shownLineRef.current = "";
    pendingLineRef.current = "";
    setPendingLineKey("");
    varyAskedRef.current = "";
    varyWaitRef.current = null;
  }, []);

  /* 서버에서는 설정을 알 수 없으므로 「꺼짐」으로 시작해 마운트한 다음 실제 값으로 바꿉니다.
     이 값은 **화면에 그려지지 않고** 아래 효과의 가드로만 쓰이므로(말풍선은 `variations`가 든
     문장만 봅니다), 기본값이 켬으로 바뀐 뒤에도 서버 렌더와 어긋날 자리가 없습니다.
     첫 대사도 놓치지 않습니다 — 이 효과가 먼저 돌아 값을 켜면 아래 효과가 `varyOn` 의존으로
     한 번 더 도는데, 그때는 아직 `shownLineRef`가 비어 있어 그 대사를 다시 집습니다. */
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

  /** 엔딩 패널 — 완주 직후 이 자리를 화면 맨 위로 끌어옵니다 */
  const endingRef = useRef<HTMLDivElement | null>(null);

  /**
   * sticky 헤더가 **실제로 가리는 높이**를 CSS 변수(--session-head-h)로 흘려 보냅니다.
   * L3의 sticky 119 바가 이 값만큼 내려앉아 헤더와 겹치지 않고, 대사·엔딩의 `scroll-mt`도
   * 같은 값을 씁니다 — 부제 줄바꿈·글자 크기 설정으로 헤더 높이가 변하므로 실측을 씁니다.
   *
   * 담기는 값은 **도킹 기준선 + 실측 높이**입니다. 헤더가 `top-[var(--chim-safe-t)]`에 붙게 된
   * 뒤로는 높이만 담으면 노치 기기에서 그 기준선만큼 셋 다 어긋납니다(119 바가 헤더 밑단을
   * 덮고, 대사가 헤더에 깔립니다). 노치가 없는 기기에서는 기준선이 0이라 예전 값 그대로입니다.
   *
   * 2026-08-27: 적는 자리를 세션 상자에서 **html**로 옮겼습니다. 네 번째 소비자가 생겼는데
   * 그것이 `.chim-screen--fill main`의 `scroll-padding-top`이고, 그 `main`은 세션 상자의
   * **부모**라 상자에 적은 변수를 볼 수 없기 때문입니다(사용자 지정 속성은 아래로만 상속됩니다).
   * 세션을 벗어나면 아래 정리에서 거둡니다 — 탭바가 `--chim-tabbar-h`에 쓰는 규율과 같습니다.
   */
  const headBoxRef = useRef<HTMLDivElement | null>(null);
  /* 마운트 시점에는 브리핑 화면이라 두 ref가 비어 있습니다 — []로 걸면 영영 실행되지 않습니다.
     세션 화면이 실제로 렌더된 뒤(atBriefing false) 다시 시도하도록 화면 상태를 의존성에 둡니다. */
  const inSessionView = state.phase !== "briefing" && !atBriefing;

  /* 훈련이 도는 동안에는 화면이 저절로 꺼지지 않게 붙듭니다 —
     말로 답하는 구간에서는 몇 십 초씩 화면에 손이 닿지 않아, 어르신 대사 도중에 화면이 꺼집니다.
     브리핑·엔딩·이탈 시에는 풀립니다. 미지원·거부 기기에서는 아무 일도 일어나지 않습니다. */
  useWakeLock(inSessionView && state.phase !== "ended");

  /**
   * 소리 켜짐 안내 — 세션 화면에 들어온 뒤 **한 프레임 늦게** 리전을 채웁니다.
   *
   * 리전은 값이 바뀌어야 발화하므로, 상자가 먼저 DOM에 있어야 합니다. 마운트와 같은 커밋에
   * 문장을 넣으면 「처음부터 그 내용이던 상자」라 아무 일도 일어나지 않습니다.
   * 한 번만 내보내는 이유는, 이 문장이 상태 보고가 아니라 **길 안내**이기 때문입니다 —
   * 같은 안내가 턴마다 되풀이되면 정작 들어야 하는 어르신 대사를 밀어냅니다.
   *
   * 「한 번만」 표식은 **프레임 안에서** 세웁니다. 예약 전에 세우면 취소된 프레임이 표식만 남기고
   * 가는데, 하필 개발 서버의 StrictMode 이중 마운트가 정확히 그 순서를 밟습니다 —
   * ① 첫 실행이 표식을 세우고 예약 ② cleanup이 그 프레임을 취소 ③ 둘째 실행이 표식을 보고 조기
   * 반환. 결과는 세션 내내 빈 상자이고, 프로덕션에서만 도는 코드는 다음 사람이 죽은 줄로 읽고
   * 지우기 좋습니다(페르소나 FE low). 안으로 옮기면 dev·prod가 같은 결과를 냅니다 —
   * 실제로 발화한 프레임만 표식을 남기고, 취소된 프레임은 아무것도 남기지 않습니다.
   *
   * ── 채우는 자리와 **비우는 자리**가 한 곳입니다 (2026-08-27) ──
   * 예전에는 채우기만 하고 비우지 않아, 소리를 끄신 뒤에도 이 줄이 「…읽어 드리고 있습니다.
   * 화면 위 「소리 끄기」를 누르시면…」으로 남았습니다. 그 순간 헤더 버튼은 「소리 켜기」라,
   * 순서대로 훑는 낭독에서 두 줄이 서로 다른 사실을 말했습니다(7차 페르소나 FE low).
   *
   * 조건도 `ttsOn`에서 `spokenAloud`로 옮겼습니다. 그래야 아래 대화 로그 리전과 **조건이 정확히
   * 정반대**가 되어 「둘이 같은 순간에 말하지 않는다」가 참으로 남습니다 — `ttsOn`인데 기기가
   * 자동재생을 막았거나 낭독을 못 하는 경우, 예전 조건에서는 이 줄이 「소리로 읽어 드리고
   * 있습니다」라고 말하는 동안 로그도 `polite`로 함께 말했습니다.
   */
  useEffect(() => {
    if (!inSessionView) return undefined;
    if (!spokenAloud) {
      /* 소리가 나지 않게 된 순간 이 줄은 사실이 아닙니다 — 비우고, 다시 소리가 나면 한 번 더
         안내하도록 표식도 풉니다(사용자가 상태를 바꾼 자리라 「턴마다 되풀이」가 아닙니다). */
      setVoiceNotice("");
      voiceNoticeSentRef.current = false;
      return undefined;
    }
    if (voiceNoticeSentRef.current) return undefined;
    const frame = window.requestAnimationFrame(() => {
      voiceNoticeSentRef.current = true;
      setVoiceNotice(VOICE_ON_NOTICE);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [inSessionView, spokenAloud]);

  useEffect(() => {
    if (!inSessionView) return undefined;
    const head = headBoxRef.current;
    const root = document.documentElement;
    if (!head || typeof ResizeObserver === "undefined") return undefined;
    const apply = () => {
      const stickyTop = parseFloat(window.getComputedStyle(head).top) || 0;
      root.style.setProperty("--session-head-h", `${stickyTop + head.offsetHeight}px`);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(head);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--session-head-h");
    };
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
     시트 자체와 「입력창에 채우기」는 그대로 CueResponder가 맡습니다.

     2026-08-24 — 이 행은 **시연 스위치 뒤로** 들어갔습니다(`src/lib/stageMode.ts`).
     라벨 그대로 발표·시연용 장치인데, 평상시에도 대화 끝에 남아 있어 훈련하러 오신 분이
     자기 대화 아래에서 「발표·시연용」이라는 말을 읽게 되어 있었습니다. 스위치는 발표자 화면
     (/check)에 있고, 꺼져 있는 동안 이 자리의 노출은 0px입니다 — 시트를 여는 문이 여기 하나뿐이라
     행을 닫으면 시트도 함께 닫힙니다. */
  /** 무대에서만 켜는 표시 — 서버·기본값은 꺼짐이라 첫 렌더가 어긋나지 않습니다. */
  const [stageOn, setStageOn] = useState(false);
  useEffect(() => {
    setStageOn(getStageMode());
    return subscribeStageMode(setStageOn);
  }, []);

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
    setMicCheck(isRecognitionSupported() ? "yes" : "no");
    primeVoices();
    return () => stopSpeaking();
  }, []);

  /**
   * ① 변주 — **대사가 도착한 그 순간의 독립 경로입니다.** (그리기 전 · `useLineArrivalEffect`)
   *
   * 예전에는 이 호출이 아래 박자 효과 **안**에 있었고, 그 효과는 붙들 이유가 없는 세 경우
   * (소리 끔·움직임 줄임·시연 빨리감기)에 조기 반환했습니다. 결과는 「말투 기본값이 매번
   * 조금씩 다르게」라는 사실이
   * 소리를 끄는 순간 **호출 0건**으로 조용히 거짓이 되는 것이었습니다 — 근무 시간 밖·공용
   * 공간에서 소리를 끄는 것은 이 앱이 상정한 사용 맥락에서 예외가 아닙니다
   * (13차 심사석 ai_cto high). 지금은 청하는 자리와 붙드는 자리가 갈렸습니다:
   * 무엇을 청할지는 `varyTargetOf`가 정하고 **재생 상태를 보지 않으며**, 몇 초 붙들지는
   * 아래 효과가 `lineHoldMs`로 정합니다.
   *
   * ── 여기서 갈리는 세 갈래 (`varyArrival`) ──────────────
   *  · **보관소 적중** — 청하지도 붙들지도 않고 그 문장을 **지금** 세웁니다. 이 효과가 그리기
   *    전에 도는 이유가 이것입니다: 그린 뒤에 세우면 「이미 편 대사를 갈아 끼우는」 모양이
   *    되는데, 그 규율이 이 화면의 상위 규율입니다. 14차까지는 이 갈래가 아예 없어, 붙들지
   *    않는 기기(움직임 줄임·시연 빨리감기)에서는 **두 번째·세 번째 회차에도** 변주가 영영
   *    서지 못했습니다 — 보관소에 문장을 두고도 그랬습니다(15차 demo·critic high).
   *  · **요청** — `varyWaitRef`를 세우고 상류에 청합니다. 붙드는 대상은 이 갈래뿐입니다.
   *  · **부르지 않음**(오프라인·인물 프로필 없음 등) — 아무것도 세우지 않습니다. 세우면
   *    소리를 끄신 분이 얻는 것 없이 대사마다 700ms를 치릅니다(15차 a11y high ②).
   *
   * 박자 효과보다 **먼저** 돌아야 같은 커밋에서 `varyWaitRef`가 채워집니다 — 이 효과가
   * layout, 아래 둘이 passive라 순서는 선언 순서와 실행 순서 양쪽으로 고정돼 있습니다
   * (셋의 순서가 그대로 이 화면의 규약입니다: 요청 → 박자 → 낭독).
   *
   * 늦게 도착한 답의 규칙은 그대로입니다 — **이미 편 대사는 갈아 끼우지 않습니다.**
   * 그 답은 보관소에만 남고, 같은 지점으로 되돌아오시면 위 첫째 갈래가 그것을 세웁니다.
   */
  useLineArrivalEffect(() => {
    const target = varyTargetOf(state.log, varyOn);
    if (!target) return undefined;
    // 같은 대사에 두 번 청하지 않습니다 — 이 효과는 설정이 바뀔 때도 다시 돕니다.
    if (varyAskedRef.current === target.key) return undefined;
    varyAskedRef.current = target.key;

    const context = {
      scenario,
      speaker: target.speaker,
      anchor: target.anchor,
      recentLines: target.recentLines,
    };
    const arrival = varyArrival(context);
    if (arrival.kind === "cached") {
      /* 그리기 전입니다 — 이 대사는 **처음부터** 이 문장으로 섭니다(교체가 아닙니다). */
      applyVariation(target.key, arrival.text);
      return undefined;
    }
    if (arrival.kind === "skip") return undefined;

    varyWaitRef.current = { key: target.key, startedAt: Date.now() };

    let cancelled = false;
    void varyLine(context).then((outcome) => {
      const wait = varyWaitRef.current;
      if (wait?.key === target.key) {
        varyWaitRef.current = null;
        /* 붙들고 있는 화면이 있으면 남은 박자만 지키고 폅니다.
           문장이 바뀌지 않았으면 붙들 이유가 사라졌다는 뜻이라, 박자 효과가
           「변주를 안 청했을 때의 시간」으로 되돌립니다(`settleHoldMs`). */
        wait.settle?.(outcome.varied);
      }
      if (cancelled) return;
      // 이미 편 대사는 바꾸지 않습니다 — 늦게 온 답은 보관소에만 남아 다음 방문에 쓰입니다.
      if (shownLineRef.current === target.key) return;
      if (outcome.varied) applyVariation(target.key, outcome.text);
    });

    return () => {
      cancelled = true;
    };
  }, [applyVariation, scenario, state.log, varyOn]);

  /**
   * ② 박자 — 새 대사가 도착하면 한 박자 붙듭니다(「말하는 중」 빈 말풍선 → 대사 + 낭독).
   *
   * 붙드는 것은 **로그 맨 끝의 인물 대사** 하나뿐입니다. 뒤에 코칭이 이미 붙은 대사는
   * 붙들면 코칭까지 함께 가려지므로 그대로 폅니다(반응 대사 → 코칭 → 「말하는 중」 → 다음 대사 순서).
   * 낭독 효과보다 **먼저** 선언돼 있어야 같은 커밋에서 ref가 채워집니다 — 순서를 바꾸지 마세요.
   *
   * 붙들 시간은 `lineHoldMs` 하나가 정합니다 — **그 안에서 끝나는 값도 `settleHoldMs`가
   * 냅니다.** 0이면 한 프레임도 붙들지 않습니다: 버튼만으로 완주하시는 분이 연출 때문에
   * 느려지지 않는다는 규율은 그대로입니다. 위 효과가 **요청을 낸** 대사라면 상한이 1200ms
   * (소리 없는 화면은 700ms)로 올라가고, 답이 그 안에 오면 `settle`이 그 상한을 **넘지 않는**
   * 선에서 남은 박자만 지키고 폅니다. 답이 앵커 그대로면 붙들 이유가 사라졌다는 뜻이라
   * 변주를 안 청했을 때의 박자로 되돌아갑니다(소리 켬 800ms · 소리 없음 0ms).
   *
   * 보는 재생 상태는 `ttsOn`(헤더 스위치)이 아니라 **`spokenAloud`**입니다 —
   * 「소리가 난다」의 정의는 이 앱에 하나뿐이고(`useVoicePresence`), 14차 신규 코드가 그 값을
   * 우회해 자동재생이 막힌 기기·낭독을 못 하는 기기에서 소리가 나지 않는데도 대사를
   * 800~1200ms 「말하는 중」으로 붙들고 있었습니다(15차 a11y med).
   *
   * `varyOn`을 함께 보는 것은 배선 때문이기도 합니다. 마운트 커밋에서는 설정을 아직 읽기
   * 전이라 `varyOn`이 거짓이고, 다음 커밋에서 참이 되어도 `state.log`는 그대로라 예전 의존성
   * (`[state.log, ttsOn]`)으로는 이 효과가 **다시 돌지 않았습니다** — 세션 첫 대사만 상한이
   * 800ms이고 `settle`이 배선되지 않던 자리입니다. 무대에서 판정단이 가장 먼저 보는 한 줄이
   * 유일하게 33% 짧은 창을 쓰고 있었습니다(15차 critic med).
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

    /* 붙드는 것은 **상류에 요청이 나간 대사**뿐입니다 — 위 효과가 그때만 `varyWaitRef`를
       세웁니다. `varyOn`을 함께 보는 것은 스위치가 꺼진 순간 그 자리가 빌 수 없다는 사실을
       적은 것이자, 스위치가 켜지는 커밋에 이 효과가 다시 돌게 하는 의존성입니다. */
    const wait = varyOn && varyWaitRef.current?.key === key ? varyWaitRef.current : null;
    const playback: LinePlayback = {
      spokenAloud,
      reducedMotion: prefersReducedMotion(),
      demoMode: demoFastForwardRef.current,
      varying: wait !== null,
    };
    const hold = lineHoldMs(playback);
    /* 소리가 나지 않거나 · 움직임을 줄이셨거나 · 시연 빨리감기 중이면 곧바로 폅니다.
       변주 요청은 위 효과가 이미 띄웠고, 보관소에 있던 문장도 이미 세워 두었습니다 —
       여기서 정하는 것은 화면의 박자뿐입니다. */
    if (hold === 0) {
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

    /* 상한을 먼저 걸어 둡니다 — 답이 늦어도 화면은 그 상한에서 반드시 다음으로 넘어갑니다. */
    holdFor(hold);
    if (wait) {
      /* 남은 박자는 그대로 지키되 **이 대사에 걸린 상한을 넘지 않습니다** —
         목표 시각을 정하는 것은 `settleHoldMs` 하나입니다(직접 상수를 쓰지 마세요). */
      wait.settle = (varied) =>
        holdFor(settleHoldMs(playback, varied) - (Date.now() - wait.startedAt));
    }

    return () => {
      cancelled = true;
      if (wait) wait.settle = undefined;
      window.clearTimeout(timer);
    };
  }, [spokenAloud, state.log, varyOn]);

  /**
   * ③ 낭독 — 화면에 **선 문장 그대로**를 읽습니다.
   *
   * 읽을 문장은 `variations`가 든 것이 있으면 그것입니다. 변주문은 동봉 음성 매니페스트에
   * 없으므로 `speak()`가 브라우저 낭독으로 넘어갑니다 — 정상 경로이고, 자막과 소리는 언제나
   * 같습니다. 다만 그 브라우저 낭독마저 없는 기기에서는 `speak()`가 **소리 없이 즉시**
   * 끝납니다. 그때 「읽어 주는 중」을 세우면 화면이 거짓말을 하고, 로그 리전도 입을 닫은 채
   * 남습니다 — 그래서 표시와 리전이 `lineSpokenAloud` **한 값**을 함께 봅니다
   * (아래 `logSpokenAloud`가 리전 쪽입니다 · 15차 a11y high).
   */
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
    const text = variationsRef.current.get(key) ?? lastLine.text;
    let cancelled = false;
    /* 「읽어 주는 중」은 **실제로 소리가 나는 문장에만** 답니다(이름줄 파형 포함). */
    if (
      lineSpokenAloud({
        spokenAloud,
        varied: text !== lastLine.text,
        synthesis: synthesisReady,
      })
    ) {
      setSpeakingKey(key);
    }
    void speak(text).then(() => {
      if (cancelled) return;
      setSpeakingKey((current) => (current === key ? "" : current));
    });
    return () => {
      cancelled = true;
    };
  }, [pendingLineKey, spokenAloud, state.log, synthesisReady, ttsOn]);

  /**
   * 소리 스위치 — 낭독 안내 줄(sr-only)은 **여기서 손대지 않습니다.**
   *
   * 그 줄의 주인은 위 `spokenAloud` 효과 하나입니다. 스위치를 끄면 `spokenAloud`가 거짓이 되어
   * 그 효과가 줄을 비우므로, 안내와 버튼 라벨(「소리 끄기」/「소리 켜기」)이 저절로 같은 사실을
   * 말합니다. 여기서도 비우면 같은 값을 두 곳이 쓰게 되고, 그것이 이 라운드에 고친 종류의
   * 어긋남을 다시 만드는 길입니다.
   */
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
    /* 시연 프리셋(?demo=)으로 씨를 뿌린 회차는 성장 기록에 남기지 않습니다 —
       자동 재생이 만든 「잘한 것」이 실사용 이력에 섞이면 그 자체가 부정직한 데이터입니다.
       보는 표식은 **회차 기준**(`demoSeededRef`)이라, 발표자가 도중부터 직접 이어 하셔도
       그 회차의 앞부분은 여전히 자동 재생이 만든 것이므로 계속 막힙니다. */
    if (demoSeededRef.current) return;
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
    /* 프리셋으로 씨를 뿌린 회차에서는 체크포인트를 건드리지 않습니다 — 발표 직전 리허설이
       발표자(또는 사용자)의 실제 진행 상태를 덮어쓰는 사고를 막습니다(위와 같은 회차 기준). */
    if (demoSeededRef.current) return;
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
      /* 발표자가 직접 고르셨습니다 — 여기서부터는 자동으로 지나가는 구간이 아니므로
         빨리감기를 놓습니다(`demoFastForwardRef` 주석). 저장 억제는 회차가 끝날 때까지 그대로입니다. */
      demoFastForwardRef.current = false;
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
       첫 대사가 「말하는 중」 없이 튀어나오고, 낭독 키까지 같아 **소리 없이 지나갑니다**.
       셋(처음부터·다시 하기·이어서 하기)이 같은 함수를 쓰는 것이 그 결함을 막는 자리입니다. */
    resetLineTiming();
    resetVariations();
    /* 프리셋으로 열린 탭이어도 여기서 시작하는 판에는 자동으로 지나간 구간이 없습니다 —
       빨리감기도 저장 억제도 함께 풉니다. */
    demoSeededRef.current = false;
    demoFastForwardRef.current = false;
    setCheckpoint(null);
    setAtBriefing(false);
    setCriticalScene(null);
    setChosenAlternative("");
    /* 눌린 버튼이 이 커밋에서 사라집니다 — 초점을 받아 줄 자리를 도크에 알립니다. */
    setStartedByUser(true);
    dispatch({ type: "start" });
    scrollToTop();
  }, [resetLineTiming, resetVariations, scenario.id, scrollToTop]);

  /**
   * 시연 프리셋 — `/train/[id]?demo=cf|l3|end`.
   *
   * 쿼리를 **마운트 뒤에** 한 번만 읽습니다(쿼리가 없으면 이 경로를 타지 않아 동작이 완전히 같습니다).
   * 재생은 엔진의 `submitResponse`가 그대로 하고, 지나간 구간은 로그 맨 위 배너로 밝힙니다.
   */
  const demoAppliedRef = useRef(false);
  /**
   * 이 회차가 **프리셋으로 씨를 뿌린 판**인가 — 켜져 있으면 체크포인트·성장 기록 어디에도
   * 저장하지 않습니다. 자동으로 지나간 구간이 만든 「잘한 것」이 실사용 이력에 섞이면 그
   * 자체가 부정직한 데이터이기 때문입니다.
   *
   * 이 표식은 **회차가 끝날 때까지** 유지됩니다 — 발표자가 도중부터 직접 이어 하더라도 그
   * 회차의 앞부분은 여전히 자동 재생이 만든 것입니다. 푸는 자리는 판을 새로 여는 셋
   * (처음부터·다시 하기·이어서 하기)뿐이고, 그 셋은 지나간 구간 없이 시작합니다.
   */
  const demoSeededRef = useRef(false);
  /**
   * 아직 **자동으로 지나간 구간 안**인가 — 화면 박자를 0으로 접습니다(`lineHoldMs`).
   *
   * 빨리감기의 의도는 「발표자가 고른 지점까지 빨리 가는 것」이지 「그 뒤로 이 탭을 영구히
   * 다르게 만드는 것」이 아닙니다. 14차까지 이 표식은 마운트 때 켜지면 어느 핸들러도 되돌리지
   * 않아서, 프리셋으로 연 탭에서는 **발표자가 직접 고른 뒤 도착하는 반응 대사도 · ⚑CF 재시도도 ·
   * 「처음부터」로 되돌린 회차도** 전부 변주 표기가 붙지 않았습니다. 요청은 그대로 나가므로
   * 리허설을 돌릴수록 쿼터만 쓰고 화면에는 아무것도 남지 않았고, 빠져나올 길은 주소에서 쿼리를
   * 떼고 새로 들어오는 것뿐인데 그 사실이 화면 어디에도 없었습니다(15차 demo high).
   *
   * 지금은 **사용자 조작이 시작되는 지점에서 풉니다** — 그 지점부터는 자동 재생이 아니라
   * 사람이 하는 훈련이고, 화면도 평상시 박자로 돌아갑니다.
   */
  const demoFastForwardRef = useRef(false);

  useEffect(() => {
    if (demoAppliedRef.current) return;
    demoAppliedRef.current = true;
    if (typeof window === "undefined") return;
    const preset = parseDemoPreset(new URLSearchParams(window.location.search).get("demo"));
    if (!preset) return;
    demoSeededRef.current = true;
    demoFastForwardRef.current = true;
    setCheckpoint(null);
    setAtBriefing(false);
    setCriticalScene(null);
    setChosenAlternative("");
    dispatch({ type: "demo", preset });
  }, []);

  const handleRestart = useCallback(() => {
    if (
      typeof window !== "undefined" &&
      !window.confirm("지금까지의 진행을 지우고 처음부터 다시 할까요?")
    ) {
      return;
    }
    resetLineTiming();
    resetVariations();
    demoSeededRef.current = false;
    demoFastForwardRef.current = false;
    clearProgress(scenario.id);
    setCheckpoint(null);
    setAtBriefing(false);
    setCriticalScene(null);
    setChosenAlternative("");
    dispatch({ type: "restart" });
    scrollToTop();
  }, [resetLineTiming, resetVariations, scenario.id, scrollToTop]);

  /**
   * ⚑CF 시트를 닫고 같은 장면으로 돌아갑니다.
   * 대안을 고르셨으면 그 문구를 로그에 한 줄로 남기고, **보기 맨 위에 그 문장을 다시 세웁니다** —
   * 대안을 골라 놓고 버튼으로 다시 고를 수 없으면 「버튼만으로 끝까지」 약속이 그 지점에서 깨집니다.
   */
  const handleRetryAfterCritical = useCallback((alternative?: string) => {
    /* ⚑CF 뒤 재시도도 사용자 조작입니다 — 「즉시 중단 장면」 프리셋으로 들어가 재시도를
       보여 드리는 동선이 여기서 평상시 박자로 돌아옵니다(`demoFastForwardRef` 주석). */
    demoFastForwardRef.current = false;
    setChosenAlternative((alternative ?? "").trim());
    dispatch({ type: "retryAfterCritical", alternative });
  }, []);

  /** 안전한 추천 문장은 확인 한 번으로 같은 장면에 제출해 흐름을 이어 갑니다. */
  const handleRecommendedReply = useCallback(
    (option: CriticalReplyOption) => {
      demoFastForwardRef.current = false;
      setChosenAlternative("");
      dispatch({ type: "retryAfterCritical" });
      handleSubmit({ branchId: option.branchId, viaButton: true });
    },
    [handleSubmit],
  );

  /** 이어서 하기 — 저장해 둔 결정 목록을 엔진에 순서대로 다시 넣습니다. */
  const handleResume = useCallback(() => {
    if (!checkpoint) return;
    resetLineTiming();
    resetVariations();
    demoSeededRef.current = false;
    demoFastForwardRef.current = false;
    dispatch({ type: "resume", progress: checkpoint });
    setCheckpoint(null);
    setAtBriefing(false);
    setChosenAlternative("");
    /* 「이어서 하기」도 같은 화면 교체입니다 — 「시작하기」와 초점 처리를 가르지 않습니다. */
    setStartedByUser(true);
    scrollToTop();
  }, [checkpoint, resetLineTiming, resetVariations, scrollToTop]);

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
        micCheck={micCheck}
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
  const statusText = ended ? "완료" : inProtocol ? "응급 연습" : `${progress.index} / ${progress.total}단계`;
  const currentLine = [...state.log]
    .reverse()
    .find((item): item is CurrentLine => item.kind === "line");
  const currentLineText = currentLine
    ? (variations.get(currentLine.key) ?? currentLine.text)
    : "";
  const currentLineSpokenAloud = lineSpokenAloud({
    spokenAloud,
    varied: Boolean(currentLine && variations.has(currentLine.key)),
    synthesis: synthesisReady,
  });

  const interrupted = state.critical !== null;
  const composing = Boolean(cue && turn && !ended && !inProtocol);
  /* 전면 모달이 떠 있는 동안 배경 세션은 보조기술에서도 물러납니다 —
     그러지 않으면 Tab이 뒤쪽 세션으로 빠져나갑니다(⚑CF만 걸려 있던 규칙을 종료 모달까지 넓힙니다). */
  const behindModal = interrupted || exitOpen;

  return (
    <>
      {/* ⚑CF 시트가 떠 있는 동안 세션은 뒤로 물러납니다 (시안 6c — 배경 .25 + 딤 .32).

          **페이지 스크롤 하나**(가이드 §5). 대화가 251px 창에 갇혀 있던 구조를 걷어내고,
          컴포저만 화면 아래에 도킹합니다 — 내용이 길면 페이지가 늘어나는 것이 정상입니다.
          (2026-08-25: md↑ 뷰포트 고정 2단(시안 7d — 대화 + 우측 레일)을 걷어냈습니다.
           앱 프레임이 어느 폭에서도 430px이라 둘째 칸이 설 자리가 없습니다.) */}
      <div
        aria-hidden={behindModal || undefined}
        className={cx(
          "flex min-h-[calc(100dvh_-_var(--chim-safe-t))] flex-col",
          /* 배경이 물러나는 것도 시트·딤과 **같은 240ms**입니다 — 예전에는 여기만 0s 하드컷이라
             ⚑CF의 첫 프레임이 「멈춰 세웠다」가 아니라 「화면이 깜빡했다」로 읽혔습니다(모션 감사 2).
             물러나는 깊이는 시안 6c의 .25입니다(옛 구현값 .30에서 한 단 더 내려 딤 강화와 짝을 맞춥니다) —
             ⚑CF는 이 앱에서 화면이 사람을 멈춰 세우는 유일한 자리라, 그 한 번은 분명해야 합니다. */
          "transition-opacity duration-[240ms] ease-out",
          interrupted && "pointer-events-none opacity-25",
        )}
      >
        {/* 헤더를 상단에 도킹합니다 — 「종료」(이탈 경로)·진행바·계층 상태점은
            스크롤 중에도 보여야 합니다. L3의 sticky 119 바는 이 아래(top-[3.25rem])에 겹겹이 섭니다.

            도킹 기준선은 0이 아니라 안전 영역 아래입니다(2026-08-26) — `viewportFit: "cover"`
            아래에서 조상의 `padding-top`은 sticky의 기준선을 옮기지 못하므로, `top-0`이면
            세션 제목과 「종료」가 상태바·다이내믹 아일랜드 밑으로 들어갑니다(페르소나 FE). */}
        <div
          ref={headBoxRef}
          className="sticky top-[var(--chim-safe-t)] z-30 flex-none bg-paper px-[18px]"
        >
          {/* 노치 띠 — 헤더 위로 지나가는 대화가 화면 색에 덮이게 합니다. 높이가 `--chim-safe-t`라
              노치 없는 기기·데스크톱에서는 0px이고, 프레임 폭으로 잘라 두어 480px↑에서
              지면(paper-out) 위로 흰 띠가 번지지 않습니다.
              `fixed`라 헤더 실측 높이(--session-head-h)에는 들어가지 않습니다. */}
          <div
            aria-hidden
            className="pointer-events-none fixed inset-x-0 top-0 mx-auto h-[var(--chim-safe-t)] max-w-[var(--chim-frame-w)] bg-paper"
          />
          <SessionHeader
            title={scenario.title}
            status={statusText}
            statusTone={ended ? "neutral" : inProtocol ? "danger" : "brand"}
            backHref={ended ? "/train" : undefined}
            onBack={ended ? undefined : handleBackToBriefing}
            backLabel="뒤로"
            action={
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={toggleTts}
                  aria-pressed={ttsOn}
                  className="flex min-h-[48px] items-center rounded-field px-1.5 text-[0.8438rem] font-bold text-ink-soft transition-colors duration-150 active:bg-paper-2"
                >
                  {ttsOn ? "소리 끄기" : "소리 켜기"}
                </button>
                {!ended && (
                  <button
                    type="button"
                    onClick={() => setExitOpen(true)}
                    className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-field px-1.5 text-[0.8438rem] font-bold text-ink-soft transition-colors duration-150 active:bg-paper-2"
                  >
                    그만하기
                  </button>
                )}
              </div>
            }
          />
        </div>

        {/* 낭독 사용자를 위한 한 줄 — 화면에는 나오지 않습니다(`VOICE_ON_NOTICE` 주석 참고).
            **소리가 실제로 날 때만** 말하는 리전이라, 소리가 나지 않을 때만 말하는 대화 로그
            리전(`DialogueLog`의 `aria-live`)과 같은 순간에 겹치지 않습니다 — 두 자리가 `spokenAloud`
            **한 값**의 참·거짓으로 갈리므로 이 「겹치지 않는다」는 주장이 사실입니다(2026-08-27).
            이 화면의 「동시에 발화 가능한 리전 수」는 이 줄이 생겨도 늘지 않습니다.

            2026-08-28 — 로그 쪽이 보는 값이 그 값을 **문장 하나만큼 더 좁힌** `logSpokenAloud`로
            바뀌었습니다(변주문은 동봉 음성이 없어 브라우저 낭독이 없으면 소리가 나지 않습니다).
            그래서 둘은 더 이상 한 값의 정확한 여집합이 아닙니다 — 동봉 오디오만 있는 기기에서
            변주문이 서면 `spokenAloud`는 참인데 `logSpokenAloud`는 거짓입니다. 그래도 **같은
            순간에 말하지는 않습니다**: 이 줄은 「소리가 나기 시작한 순간」에 한 번만 값이 바뀌고
            (세션 진입·소리 다시 켬), 대사가 도착할 때는 내용이 그대로라 아무 말도 하지 않습니다.
            진입 프레임에는 로그 리전이 갓 마운트돼 처음부터 있던 내용을 알리지 않습니다.
            새 리전을 들일 때 확인할 것은 「값이 반대인가」가 아니라 **「말이 나가는 순간이
            겹치는가」**입니다.

            상자와 내용이 함께 생기지 않게 합니다 — 알림과 함께 리전이 생기면 읽지 않는 리더가
            있어서, 빈 상자가 먼저 서 있어야 다음 문장이 「바뀐 줄」로 읽힙니다. 그래서 여기에는
            조건부 마운트(`{cond && …}`)를 두지 않고, 세션 화면이 그려지는 동안에는 조건 없이
            섭니다. 다만 **브리핑 화면에는 없습니다** — 위쪽 `state.phase === "briefing"` 갈래가
            따로 반환하므로, 이 상자는 세션 화면과 함께 마운트되고 그 한 프레임 뒤에 내용이
            채워집니다(그 한 프레임이 위 `useEffect`의 rAF입니다). */}
        <p role="status" className="sr-only">
          {voiceNotice}
        </p>

        <div className="flex-1 px-[18px] pt-5 pb-6">
          {scenario.type === "EMERGENCY" && !ended && (
            <p className="mb-4 rounded-panel bg-danger-soft px-4 py-3 text-[1rem] leading-[1.45] font-bold text-danger-ink">
              지금은 응급 상황 연습입니다. 실제 신고로 연결되지 않습니다.
            </p>
          )}

          {!ended && !inProtocol && currentLine && (
            <CurrentLineCard
              line={currentLine}
              text={currentLineText}
              waiting={pendingLineKey === currentLine.key}
              speaking={speakingKey === currentLine.key}
              spokenAloud={currentLineSpokenAloud}
            />
          )}

          {!ended && !inProtocol && state.lastFeedback && !state.critical && (
            <InlineCoaching
              feedback={state.lastFeedback}
              gaugeLabel={scenario.gauge.label}
              className="mt-4"
            />
          )}

          {/* 규칙 엔진 시연 진입 — 컴포저 밖, 대화 로그 바로 아래입니다.
              발표자가 찾는 자리이자, 평소에는 대화 끝에 조용히 남는 한 줄입니다.
              헤어라인 하나로 대화와 갈라 둡니다 — 시연 장치가 대사처럼 읽히지 않게.
              (시트는 body로 포털되므로 여기서 열어도 뜨는 자리는 같습니다.) */}
          {stageOn && composing && demoExamples.length > 0 && (
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
            <div ref={endingRef} className="scroll-mt-[calc(var(--session-head-h,0px)_+_12px)]">
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

        {/* 입력 도크 — 대화 중에만 섭니다. 그 밖의 구간에서는 고지 한 줄만 남깁니다.
            화면 아래에 붙어 있습니다(sticky) — 어느 폭에서도 같습니다. */}
        {composing && cue && turn ? (
          <div className="sticky bottom-0 z-20">
            <CueResponder
              scenario={scenario}
              session={state.session}
              cue={cue}
              attempt={state.attempt}
              micCheck={micCheck}
              /* 「시작하기」·「이어서 하기」로 열린 화면이면 첫 CUE 지시문도 초점을 받습니다
                 (`startedByUser` 주석 참고). 도크가 마운트되는 순간의 값만 씁니다. */
              focusFirstCue={startedByUser}
              chosenAlternative={chosenAlternative || undefined}
              demoExamples={demoExamples}
              /* 스위치를 끄면 시트도 함께 닫힙니다 — 열어 둔 채 꺼도 화면에 남지 않게. */
              demoOpen={stageOn && ruleDemoOpen}
              onDemoClose={closeRuleDemo}
              onSubmit={handleSubmit}
              onListeningChange={setListening}
            />
          </div>
        ) : null}
      </div>

      {/* 종료 확인 — ⚑CF 시트와 같은 훅으로 초점·Esc·Tab을 다룹니다(모달 문법 하나로 통일) */}
      {exitOpen && <ExitConfirm onClose={closeExit} />}

      {/* ⚑CF 즉시 중단 — 바텀시트 (시안 6c) */}
      {state.critical && (
        <CriticalInterrupt
          feedback={state.critical.feedback}
          replyOptions={state.critical.replyOptions}
          onRetry={handleRetryAfterCritical}
          onRecommendedReply={handleRecommendedReply}
        />
      )}
    </>
  );
}

export default TrainSession;
