"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BigButton, InlineDisclaimer, MicButton, StatusDot, WaveBars } from "@/components";
import { cx } from "@/components/utils";
import { cueOptions } from "@/engine";
import { getSettings, subscribeSettings, type FontScale } from "@/lib/settings";
import { createRecognizer, stopSpeaking, type Recognizer } from "@/lib/speech";
import type { CueDef, Scenario, SessionState } from "@/types";
import {
  MIC_CHECKING_LINE,
  WAIT_NO_AUTO_ADVANCE,
  WAIT_WORD,
  waitLevel,
  type MicCheck,
} from "./constants";
import { RecordDraftPreview } from "./RecordDraftPreview";
import { RuleDemoSheet } from "./RuleDemoSheet";
import type { RuleDemoExample } from "./ruleDemoExamples";
import { isReportCue } from "./sessionMachine";

export interface CueResponderProps {
  scenario: Scenario;
  session: SessionState;
  cue: CueDef;
  /** CUE 시도 횟수 — 값이 바뀌면 입력창과 대기 타이머를 초기화합니다 */
  attempt: number;
  /** 음성 인식 가능 여부 — 마운트 전에는 `unknown`이고, 그동안에는 단정하지 않습니다 */
  micCheck: MicCheck;
  /**
   * 이 도크가 **사용자가 버튼을 눌러 만든 화면 교체**로 열렸는지 (브리핑의 「시작하기」·
   * 「이어서 하기」, 응급 프로토콜을 마치고 대화로 돌아온 자리).
   *
   * 참이면 **첫 CUE 지시문도** 초점을 받습니다. 마운트되는 순간의 값만 씁니다 — 도중에 바뀌어도
   * 이미 열린 도크의 초점 규칙은 흔들리지 않습니다.
   */
  focusFirstCue?: boolean;
  /**
   * ⚑CF 시트에서 고르신 대안 문장.
   * 같은 CUE로 돌아왔을 때 **보기 목록 맨 위에 그대로** 다시 세워, 버튼만으로도 이어가실 수 있게 합니다.
   */
  chosenAlternative?: string;
  /** 컴포저 맨 위에 얹을 한 줄 (「새로 말씀하셨어요 ↑」 앵커) */
  anchor?: ReactNode;
  /**
   * 지금 CUE에서 발동하는 규칙 엔진 시연 예시 — 시트 내용입니다.
   *
   * 여는 버튼은 **컴포저 밖**(대화 로그 아래)에 있습니다. 도크 안에 두었을 때는
   * 제안 버튼 셋보다 아래로 밀려 어느 글자 크기에서도 접힘선 밑에 숨었습니다.
   */
  demoExamples: RuleDemoExample[];
  /** 시연 시트가 떠 있는지 (여는 것은 부모, 닫는 것은 이 컴포넌트도 합니다) */
  demoOpen: boolean;
  onDemoClose: () => void;
  onSubmit: (input: { utterance?: string; branchId?: string; viaButton: boolean }) => void;
  /** 말하는 중(시안 4b)일 때 본문을 흐리게 하려고 부모에게 알립니다 */
  onListeningChange?: (listening: boolean) => void;
}

/** 마이크 첫 사용 안내를 이미 보셨는지 기억하는 자리 (기기 안에만 남습니다) */
const MIC_INTRO_KEY = "chimchak.micIntro.v1";

/** 마이크 권한 상태 — permissions API가 없는 브라우저는 "unknown"으로 둡니다. */
type MicPermission = "unknown" | "prompt" | "granted" | "denied";

/**
 * 도크(컴포저)가 가져갈 수 있는 세로 상한 — **전 뷰포트 공통**입니다.
 *
 * 예전에는 넓은 폭 전용이었습니다. 그래서 좁은 폭에서는 도크가 뷰포트의 60%(표준 504/844),
 * 「아주 크게」에서 75%(633/844)까지 부풀어 대화 로그 가시 띠가 262px·114px로 고정됐습니다 —
 * **접근성 설정을 켤수록 읽을 면적이 줄어드는 역전**입니다(평가 UI/UX m1·초보 c2 실측).
 *
 * 그래서 글자가 커질수록 상한을 한 단계씩 내립니다. 헤더가 함께 커지는 것까지 셈에 넣으면
 * 어느 설정에서도 로그 가시 영역이 45dvh 이상 남습니다
 * (표준 100−9.4−45 ≈ 46 · 크게 100−10.4−42 ≈ 48 · 아주 크게 100−11.5−40 ≈ 49dvh).
 * 상한을 넘는 만큼은 도크 안쪽에서 스크롤되므로 보기·입력은 전부 닿습니다.
 */
const DOCK_MAX_H: Record<FontScale, string> = {
  standard: "max-h-[45dvh]",
  large: "max-h-[42dvh]",
  xlarge: "max-h-[40dvh]",
};

/**
 * 도크가 가져갈 수 있는 **최대** 비율(=`DOCK_MAX_H.standard`).
 *
 * 로그 꼬리가 도크에 가려졌는지 보는 관찰자가 이 값 하나만 씁니다 —
 * 실제 도크 높이를 쓰면 앵커가 뜨는 순간 도크가 두꺼워져 관찰자가 다시 만들어지고,
 * 그 정리 단계가 방금 켠 앵커를 도로 끕니다(자기취소 루프 · 평가 UI/UX m2).
 * 글자 크기와 무관한 고정값이라 앵커가 떠도 값이 흔들리지 않습니다.
 */
export const DOCK_MAX_RATIO = 0.45;

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

/* ── 보기 순서 섞기 ─────────────────────────────────────────
   시나리오 데이터는 저작 편의상 **좋은 보기부터** 적혀 있습니다(cueOptions는 그 순서를 그대로
   돌려줍니다). 그대로 그리면 두 번째 턴쯤에 「맨 위가 정답」이 보이고, 그때부터는 어르신 대사를
   읽지 않고 첫 버튼만 누르게 됩니다 — 4분 동안 입에서 나온 말이 하나도 없게 됩니다(교육생 검증).

   그래서 **표시부에서만** 섞습니다. 데이터 순서는 그대로 두고, 세션마다 한 번 정해지는 시드로
   순서를 결정합니다. 같은 세션 안에서는 CUE마다 순서가 고정되므로, ⚑CF 뒤 같은 지점으로
   돌아오셔도 방금 보신 자리에 같은 보기가 있습니다. 한 판을 새로 시작하시면 새 순서입니다. */

/** 문자열 → 32비트 시드 (FNV-1a) */
function seedOf(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** 시드 하나로 같은 순서를 다시 만드는 셔플 (mulberry32 + 피셔–예이츠) */
function shuffleWithSeed<T>(items: readonly T[], seed: number): T[] {
  const out = items.slice();
  let state = seed || 1;
  for (let i = out.length - 1; i > 0; i -= 1) {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    const j = Math.floor(r * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * 버튼만으로 오신 턴 수가 이 값에 이르면 **한 번만** 조용한 한 줄을 붙입니다.
 * (직접 말씀하신 턴이 한 번이라도 있으면 붙지 않습니다.)
 */
const BUTTON_ONLY_HINT_AT = 2;

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
 *
 * 도크 안은 **위·가운데·아래 세 켜**입니다. CUE 지시문과 여유는 위 켜에 붙박이로 서고,
 * 가운데 켜(제안 버튼·입력창)만 상한을 넘는 만큼 스크롤하며, 마이크·보내기는 아래 켜에 남습니다.
 * 예전에는 지시문·여유·시연 진입까지 전부 가운데 켜에 있어서, 정작 눌러야 하는 제안 버튼
 * 셋째 개가 10.8px만 남고 잘렸습니다(375×812 실측 clientH 246 / scrollH 349).
 */
export function CueResponder({
  scenario,
  session,
  cue,
  attempt,
  micCheck,
  focusFirstCue = false,
  chosenAlternative,
  anchor,
  demoExamples,
  demoOpen,
  onDemoClose,
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
  /** 이번 녹음에서 확정된 말 조각의 누적본 — 침묵 뒤에 이어 말해도 앞말이 남게 */
  const committedRef = useRef("");
  /** 현재 입력값 미러 — 새 녹음이 이 문장에 이어 붙는 출발점 */
  const textRef = useRef("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  /** 스크롤되는 보기 목록 — 아래에 더 남아 있는지 여기서 잽니다 */
  const listRef = useRef<HTMLDivElement | null>(null);
  const listInnerRef = useRef<HTMLDivElement | null>(null);
  /** 목록 아래에 아직 보이지 않는 것이 남아 있는지 — 「아래로 더 있어요」 한 줄의 조건 */
  const [moreBelow, setMoreBelow] = useState(false);
  /** 권한 팝업이 떠 있는 첫 회에만 인식을 끊지 않고 안내로 대신합니다 */
  const micGraceUsedRef = useRef(false);
  /** 지금 화면의 CUE 지시문 — 턴이 넘어가면 여기로 초점을 옮깁니다 */
  const promptRef = useRef<HTMLHeadingElement | null>(null);
  /** 마지막으로 초점을 옮긴 CUE. 첫 렌더에서는(아래 조건이 아니면) 초점을 건드리지 않습니다. */
  const focusedCueRef = useRef<string | null>(null);
  /** 이 도크가 열린 까닭 — **마운트 시점의 값**만 붙들어 둡니다(위 prop 주석 참고). */
  const focusFirstCueRef = useRef(focusFirstCue);
  /**
   * 마이크 버튼을 감싸는 상자 — 대기(52px)와 녹음 중(64px)은 **서로 다른 서브트리**라,
   * `listening`이 바뀌는 순간 누르고 계시던 버튼이 언마운트되고 초점이 BODY로 떨어집니다.
   * 키보드·스위치로 쓰시는 분은 한 턴 말할 때마다 초점을 잃고, 다음 마이크까지 문서 맨 위부터
   * 다시 Tab으로 내려와야 합니다(FE 검증). 두 자리에 같은 ref를 걸어 두고, 전환이 끝나면
   * 새로 마운트된 버튼으로 초점을 옮깁니다. (MicButton은 공용 컴포넌트라 ref를 받지 않아,
   * 감싼 상자에서 버튼을 찾아 갑니다.)
   */
  const micWrapRef = useRef<HTMLDivElement | null>(null);
  /** 마이크에서 시작한 전환일 때만 초점을 옮깁니다 — 다른 이유로 초점을 빼앗지 않습니다. */
  const micPressedRef = useRef(false);

  /* 세션 시작 시각이 시드입니다 — 같은 판(⚑CF 뒤 재시도 포함) 안에서는 값이 바뀌지 않고,
     한 판을 새로 시작하면 새 값이 됩니다. CUE id를 함께 넣어 턴마다 다른 순서를 만듭니다. */
  const options = useMemo(
    () =>
      shuffleWithSeed(
        cueOptions(scenario, session),
        seedOf(`${scenario.id}|${cue.id}|${session.startedAt}`),
      ),
    [scenario, session, cue.id],
  );
  const reportMode = useMemo(() => isReportCue(scenario, cue), [scenario, cue]);
  const filledExample = demoExamples.find((example) => example.id === filledExampleId);
  const resetKey = `${cue.id}-${attempt}`;
  const secondsLeft = useCountdown(cue.waitSec, resetKey);
  const waitState = waitLevel(secondsLeft, cue.waitSec);

  /* 버튼만으로 오셨는지 — 브리핑과 가이드가 「마이크 없이 버튼만으로 끝까지」를 여러 번
     약속하는데, 버튼으로 고른 턴은 규칙 사전이 돌지 않습니다(session.ts — 자유 발화 조건).
     그 사실이 접힘 안에만 있으면, 버튼만 쓰신 분은 이 앱이 자랑하는 두 가지를 다 못 받고
     그 사실도 모릅니다(현직 검증). 세 번째 턴에 한 번만 조용히 알려 드립니다. */
  const buttonTurns = session.events.filter((event) => event.viaButton).length;
  const spokenTurns = session.events.filter((event) => !event.viaButton && event.utterance).length;
  const showButtonOnlyHint =
    micCheck === "yes" && spokenTurns === 0 && buttonTurns === BUTTON_ONLY_HINT_AT;
  /** 입력창이 열려 있는 상태 — 인식 결과가 들어오면 저절로 열립니다(전송 전 확인). */
  const composing = expanded || text.trim().length > 0;
  /** 보기 목록이 스냅해도 되는 상태 — 목록 안에 보기 말고 다른 것이 없을 때뿐입니다. */
  const listSnaps = !composing && !micIntroOpen && notice === null;

  useEffect(() => {
    setText("");
    committedRef.current = "";
    textRef.current = "";
    setExpanded(false);
    setNotice(null);
    setFilledExampleId(null);
    // 마이크 안내는 누르신 그 턴에서만 유효합니다 — 턴이 넘어가면 도크를 다시 비웁니다.
    setMicIntroOpen(false);
  }, [resetKey]);

  /**
   * 턴이 넘어가면 새 CUE 지시문으로 초점을 옮깁니다 (/report 위저드의 headingRef와 같은 규칙).
   *
   * 누른 보기 버튼이 언마운트되면서 초점이 BODY로 떨어지면, 다음 보기까지 가려고
   * 스킵 링크·‹·소리 끄기·종료·로그 전체를 매 턴 다시 Tab으로 지나야 합니다(평가 UI/UX m4 실측).
   * 스크롤은 로그가 따로 잡으므로 여기서는 움직이지 않습니다.
   *
   * **첫 CUE는 두 가지 경우가 섞여 있습니다.** 하나는 문서가 막 열린 자리(주소로 곧장 들어와
   * 진행 중인 판이 복원된 경우)이고, 다른 하나는 사용자가 「시작하기」를 눌러 브리핑을 통째로
   * 갈아 끼운 자리입니다. 앞은 초점을 건드리면 안 되고(읽는 자리를 빼앗습니다), 뒤는 라우트
   * 전환과 성격이 같아 **반드시** 옮겨야 합니다 — 누른 버튼이 사라져 초점이 BODY로 떨어지는
   * 자리인데 하필 이 제품의 중심 장면이었습니다(3차 페르소나 UI/UX med).
   * 둘을 가르는 값은 부모만 알 수 있으므로 `focusFirstCue`로 받습니다
   * (`RouteFocus`가 첫 로드를 제외하는 것과 같은 판단 기준입니다).
   */
  useEffect(() => {
    if (focusedCueRef.current === resetKey) return;
    const first = focusedCueRef.current === null;
    focusedCueRef.current = resetKey;
    if (first && !focusFirstCueRef.current) return;
    promptRef.current?.focus({ preventScroll: true });
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

  /**
   * 마이크 안내를 이미 보신 적이 있는지 (기기에 남아 있는 표시).
   *
   * 읽어 두기만 하고 **여는 것은 마이크 버튼을 처음 누르시는 순간**입니다(아래 `beginPress`).
   * 세션에 들어오는 것만으로 띄우면 첫 턴 도크가 160px 부풀고 「알겠습니다」 한 번을 먼저
   * 요구합니다 — 버튼만으로 끝까지 가실 분에게는 존재 자체가 불필요한 관문입니다(평가 초보 mi72).
   */
  const micIntroSeenRef = useRef(false);
  /** 열린 안내 카드 — 도크가 상한에 걸려 스크롤될 때 카드가 접힌 자리에 숨지 않게 붙듭니다. */
  const micIntroRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!micIntroOpen) return;
    // 초점은 옮기지 않습니다 — 스페이스/엔터로 마이크를 누르신 경우 그 keyup이 곧바로
    // 「알겠습니다」를 눌러 버려, 읽기도 전에 안내가 닫힙니다.
    micIntroRef.current?.scrollIntoView({ block: "nearest" });
  }, [micIntroOpen]);

  useEffect(() => {
    if (micCheck !== "yes") return;
    try {
      micIntroSeenRef.current = window.localStorage.getItem(MIC_INTRO_KEY) === "1";
    } catch {
      // 저장소를 쓸 수 없는 환경에서는 누르실 때 한 번 더 안내해 드립니다(안내가 없는 것보다 안전합니다).
      micIntroSeenRef.current = false;
    }
  }, [micCheck]);

  const closeMicIntro = useCallback(() => {
    setMicIntroOpen(false);
    micIntroSeenRef.current = true;
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
        // 인식기가 침묵을 건너뛰며 계속 듣게 되면서(speech.ts continuous+재시작),
        // 한 번의 녹음에서 확정 조각이 여러 번 온다. 마지막 조각으로 덮어쓰면
        // 말 고르기 전에 하신 말씀이 사라지므로, 확정분은 쌓고 중간 인식만 얹어 보여 준다.
        onResult: (result, isFinal) => {
          if (isFinal) {
            const joined = committedRef.current
              ? `${committedRef.current} ${result}`.trim()
              : result;
            committedRef.current = joined;
            textRef.current = joined;
            setText(joined);
          } else {
            setText(
              committedRef.current ? `${committedRef.current} ${result}`.trim() : result,
            );
          }
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
    // 이미 적혀 있던 문장(직접 입력·이전 녹음분)에 새 말이 이어 붙습니다 — 앞말을 지우지 않게.
    committedRef.current = textRef.current;
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
    // 사파리·파이어폭스는 permissions.query가 microphone을 몰라 "unknown"에 머뭅니다 —
    // 그 기기에서도 첫 안내가 한 번은 뜨도록 조건을 넓힙니다(1회 제한은 ref가 지킵니다).
    if ((micPermission === "prompt" || micPermission === "unknown") && !micGraceUsedRef.current) {
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
    // 마이크를 처음 누르시는 순간 — 조작법을 먼저 펴 드리고, 이번 누름은 녹음으로 넘기지 않습니다.
    // 「알겠습니다」를 누르신 뒤 다시 누르시면 그때부터는 바로 녹음으로 들어갑니다.
    if (!micIntroSeenRef.current) {
      setMicIntroOpen(true);
      return;
    }
    pressingRef.current = true;
    micPressedRef.current = true;
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

  /**
   * 마이크 트리가 바뀐 뒤 새로 마운트된 버튼으로 초점을 되돌립니다.
   * `fillExample`이 쓰는 것과 같은 방법입니다(`requestAnimationFrame` 뒤에 focus).
   */
  useEffect(() => {
    if (!micPressedRef.current) return;
    const id = window.requestAnimationFrame(() => {
      micWrapRef.current?.querySelector("button")?.focus({ preventScroll: true });
      // 손을 뗀 뒤(대기 마이크로 돌아온 뒤)에는 표시를 내려 둡니다.
      if (!listening) micPressedRef.current = false;
    });
    return () => window.cancelAnimationFrame(id);
  }, [listening]);

  const send = useCallback(() => {
    const utterance = text.trim();
    if (utterance.length === 0) return;
    stopListening();
    setText("");
    committedRef.current = "";
    textRef.current = "";
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
      committedRef.current = "";
      textRef.current = "";
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
      committedRef.current = "";
      textRef.current = "";
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
      onDemoClose();
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
    [onDemoClose, stopListening],
  );

  const openInput = useCallback(() => {
    setExpanded(true);
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  /**
   * 보기 목록 아래에 아직 못 보신 것이 남아 있는지 잽니다.
   *
   * 가이드가 그림자·그라데이션을 금지하므로(§7-4·§3) 「여기 더 있다」는 신호를
   * 헤어라인과 문장 한 줄로만 전합니다. 마이크·직접 입력 행은 이 목록 **밖**에 있어
   * 어떤 글자 크기에서도 접힘 아래로 내려가지 않습니다.
   */
  useEffect(() => {
    const node = listRef.current;
    if (!node) return undefined;
    const measure = () => {
      // 8px은 소수점 반올림으로 생기는 잔여분입니다 — 그보다 크면 진짜 남은 내용입니다.
      setMoreBelow(node.scrollHeight - node.scrollTop - node.clientHeight > 8);
    };
    measure();
    node.addEventListener("scroll", measure, { passive: true });
    const observer =
      typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure);
    observer?.observe(node);
    // 목록 자체가 길어지는 것(안내 카드·입력창 펼침)도 잡습니다.
    if (listInnerRef.current) observer?.observe(listInnerRef.current);
    return () => {
      node.removeEventListener("scroll", measure);
      observer?.disconnect();
    };
  }, [listening]);

  /* ── 말하는 중 (시안 4b) ─────────────────────────────────── */

  if (listening) {
    return (
      <div className="flex-none border-t border-line bg-paper">
        <div className="w-full px-[18px] pt-3.5 pb-7">
          <p className="mb-3.5 text-[1.0625rem] leading-[1.45] font-bold text-ink">{cue.prompt}</p>

          <div className="rounded-panel bg-paper-2 px-4 py-3.5">
            <div className="mb-2 flex items-center gap-1.5">
              <StatusDot tone="danger" size={8} />
              <span className="text-[0.7813rem] leading-[1.45] font-bold text-ink-soft">
                듣고 있어요
              </span>
              <WaveBars count={5} className="ml-auto" />
            </div>
            <p aria-live="polite" className="text-[1.0625rem] leading-[1.6] text-ink">
              {text.trim().length > 0 ? (
                <>
                  <span aria-hidden>“</span>
                  {text}
                  <span className="text-ink-faint" aria-hidden>
                    …”
                  </span>
                </>
              ) : (
                <span className="text-ink-faint">말씀을 기다리고 있어요</span>
              )}
              <span
                aria-hidden
                className="relative top-[3px] ml-0.5 inline-block h-[17px] w-[2px] bg-brand-600"
              />
            </p>
          </div>

          <div ref={micWrapRef} className="mt-3 mb-1.5 flex justify-center">
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

          {/* 손을 떼면 **전송이 아니라 확인**입니다 — 실제 전송은 「이 내용으로 답하기」를
              누르셔야 일어납니다. 버튼 aria 라벨·바로 아래 한 줄과 같은 사실을 적습니다
              (셋 중 하나만 「전송돼요」라고 적혀 있으면 손을 떼기가 무서워집니다). */}
          <p className="text-center text-[0.8438rem] leading-[1.45] font-semibold text-ink-soft">
            손을 떼면 확인 화면으로 넘어가요
          </p>
          <p className="mt-1 text-center text-[0.7813rem] leading-[1.45] text-ink-faint">
            잘못 들렸다면 보내기 전에 고칠 수 있어요
          </p>

          <InlineDisclaimer tone="readable" className="mt-3" />
        </div>
      </div>
    );
  }

  /* ── 기본 (시안 4a) ──────────────────────────────────────── */

  return (
    <div
      className={cx(
        "flex flex-none flex-col border-t border-line bg-paper",
        // 앵커까지 포함한 도크 전체에 상한을 겁니다 — 로그가 남는 자리를 지키는 값입니다.
        DOCK_MAX_H[fontScale],
      )}
    >
      {anchor && <div className="flex-none">{anchor}</div>}

      {/* ① 붙박이 머리 — CUE 지시문과 여유. **스크롤 밖**(`flex-none`)입니다.
          답해야 하는 질문이 답하는 도중에 위로 밀려 사라지지 않고, 스크롤이 필요한 만큼은
          아래 ②(제안 버튼·입력창)가 전부 가져갑니다. 예전에는 이 셋이 한 상자에 있어
          지시문 76px이 목록 몫을 먼저 떼어 갔습니다. */}
      <div className="w-full flex-none px-[18px] pt-3">
        {/* 지시문은 코어 콘텐츠입니다 — 17px w700 (§3).
            턴이 넘어가면 초점이 여기로 옵니다(tabIndex={-1}). */}
        <h2
          ref={promptRef}
          tabIndex={-1}
          className="text-[1.0625rem] leading-[1.45] font-bold text-ink"
        >
          {cue.prompt}
        </h2>
        {/* 여유 표시 — 가이드 §4.5대로 **텍스트 한 줄**입니다.
            한때 줄어드는 진행 막대였습니다. 고갈되는 막대는 전 세계 공통으로 「시간 없다」는
            신호라, 글자가 다독이는 옆에서 움직임이 재촉했습니다 — 붙어 있으면 움직임이 이깁니다
            (디자이너 검증). 처음 말이 안 나와 몇 초 굳어 계신 분이 정확히 그 막대를 보십니다.
            숫자는 `tabular-nums`로 자리를 고정해, 초가 바뀔 때 이 줄이 밀리지 않게 합니다.
            0이 되면 숫자 대신 상태어 한 마디가 섭니다 — 「여유 0초」는 재촉이 됩니다.
            다독이는 말은 바로 아래 한 줄(WAIT_NO_AUTO_ADVANCE)이 계속 들고 있습니다. */}
        <p className="mt-1 text-[0.7813rem] leading-[1.45] text-ink-disabled">
          {secondsLeft > 0 ? (
            <span className="tabular-nums">여유 {secondsLeft}초</span>
          ) : (
            WAIT_WORD[waitState]
          )}
        </p>
        <p className="mt-0.5 text-[0.8438rem] leading-[1.45] text-ink-soft">
          {WAIT_NO_AUTO_ADVANCE}
        </p>
      </div>

      {/* ② 스크롤되는 목록 — 제안 버튼과 입력창이 여기 있습니다.
          상한을 넘는 만큼은 여기서만 스크롤되고, 마이크·직접 입력 행은 아래 ③에 따로 섭니다.
          예전에는 이 상자가 도크의 전부여서 「크게」·「아주 크게」에서 마이크와 직접 입력이
          접힘선 아래로 내려갔습니다(18px 마이크 bottom 855 > 도크 844 · 20px 152px 감춤 — 평가 UI/UX m1).

          스냅은 **보기만 늘어서 있는 상태에서만** 겁니다. 입력창·마이크 안내·오류 안내가 열려 있을 때
          걸면, 그것들을 화면 안으로 넣으려고 우리가 옮긴 스크롤을 스냅이 도로 제안 버튼 쪽으로
          끌어당깁니다. `scroll-pt`는 스냅이 위쪽 여백을 먹지 않게 하는 값입니다. */}
      <div
        ref={listRef}
        className={cx(
          "min-h-0 w-full flex-1 overflow-y-auto overscroll-contain px-[18px] pt-2.5 pb-1.5",
          listSnaps && "snap-y snap-proximity scroll-pt-2.5",
        )}
      >
        <div ref={listInnerRef}>
          {/* 마이크 첫 사용 안내 — 세션 진입이 아니라 **마이크 버튼을 처음 누르시는 순간**에 열립니다.
              열리면 도크가 상한에 걸려 있어도 이 카드가 보이도록 스스로 화면 안으로 들어옵니다.
              읽어야 하는 문장이라 15px 아래로 내리지 않습니다(가이드 §7-8). */}
          {/* 이 카드는 더 이상 자기 리전이 아닙니다 — 도크의 알림은 아래 sr-only 리전 하나로
              모았습니다(같은 화면에 리전이 넷이면 TTS와 겹쳐 두 목소리가 엇갈립니다). */}
          {micCheck === "yes" && micIntroOpen && (
            <div ref={micIntroRef} className="mb-2.5 rounded-panel bg-brand-tint px-4 py-3.5">
              <h3 className="text-[1rem] leading-[1.45] font-bold text-brand-800">
                마이크를 처음 쓰실 때
              </h3>
              {/* 실제 조작은 푸시투토크입니다 — 안내도 그대로 적습니다(평가 초보 m28). */}
              <p className="mt-1 text-[0.9375rem] leading-[1.6] text-ink-soft">
                마이크 버튼을 처음 누르면 브라우저가 마이크 허용을 물어봅니다. ‘허용’을 누르신 뒤,
                버튼을 꾹 누른 채로 말씀하시고 다 말씀하시면 손을 떼세요. 마이크 없이 아래 버튼만으로도
                끝까지 진행됩니다.
              </p>
              <button
                type="button"
                onClick={closeMicIntro}
                className="mt-2 min-h-[48px] w-full rounded-card bg-white text-[0.9375rem] font-semibold text-ink transition-colors duration-150 active:bg-paper-2"
              >
                알겠습니다
              </button>
            </div>
          )}

          {/* 경고 줄도 자기 리전을 갖지 않습니다 — 문장은 아래 공용 리전이 전합니다. */}
          {notice && (
            <p className="mb-2.5 rounded-card bg-warn-soft px-3.5 py-2.5 text-[0.7813rem] leading-[1.6] font-semibold text-warn-ink">
              {notice}
            </p>
          )}

          {/* 제안 버튼 — 항상 노출되는 폴백입니다.
              ⚑CF에서 고르신 대안이 있으면 **맨 위에 같은 문법으로** 다시 세웁니다 —
              대안을 골라 놓고 그 문장을 버튼으로 다시 못 고르면 「버튼만으로 끝까지」가 깨집니다. */}
          {/* 제안 버튼 라벨은 17px입니다 — 버튼만으로 완주하시는 분이 4분 내내 읽고 **판단해서 누르는**
              유일한 텍스트인데, 읽기만 하는 대사·지시문(17px)보다 작았습니다(평가 초보 m3 실측 15px).
              세로 여백은 min-h 48px이 지키므로 한 줄짜리 보기의 크기는 그대로이고,
              두 줄로 넘어가는 긴 보기만 4px씩 낮아집니다.
              `snap-start`는 목록이 끝내 잘릴 때 **잘린 보기가 sliver로 남지 않게** 하는 장치입니다 —
              10.8px만 남아 테두리처럼 읽히던 자리(375×812 실측)를 없앱니다. */}
          {/* 버튼만으로 오신 분께 드리는 한 줄 — 재촉이 아니라 사실입니다.
              카드도 색면도 두지 않고, 보기 목록 위에 조용히 한 줄로만 섭니다. */}
          {showButtonOnlyHint && (
            <p className="mb-2 text-[0.8438rem] leading-[1.6] text-ink-muted">
              지금까지는 보기로만 하셨어요. 한 번만 직접 말해 보시면 규칙 사전이 그 말씀을 보고
              다르게 짚어 드려요.
            </p>
          )}

          {(options.length > 0 || chosenAlternative) && (
            <ul className="mb-2 flex flex-col gap-[6px]">
              {chosenAlternative && (
                <li key="cf-alternative" className="snap-start">
                  <button
                    type="button"
                    onClick={() => sendAlternative(chosenAlternative)}
                    className="min-h-[48px] w-full rounded-card border border-line-strong bg-white px-[15px] py-2 text-left text-[1.0625rem] leading-[1.45] font-medium text-ink transition-colors duration-150 hover:bg-paper-2 active:bg-paper-2"
                  >
                    {chosenAlternative}
                  </button>
                </li>
              )}
              {options.map((branch) => (
                <li key={branch.id} className="snap-start">
                  <button
                    type="button"
                    onClick={() => pick(branch.id)}
                    className="min-h-[48px] w-full rounded-card border border-line-strong bg-white px-[15px] py-2 text-left text-[1.0625rem] leading-[1.45] font-medium text-ink transition-colors duration-150 hover:bg-paper-2 active:bg-paper-2"
                  >
                    {branch.fallbackOption}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* 직접 입력 겸 인식 결과 확인 — 보내기 전에 고치실 수 있습니다.
              보내기 버튼과 마이크는 아래 고정 행(③)에 있습니다. */}
          {composing && (
            <div>
              <label
                htmlFor="cue-utterance"
                className="block text-[0.7813rem] leading-[1.45] font-semibold text-ink-muted"
              >
                인식된 내용 확인 · 직접 입력
              </label>
              <textarea
                id="cue-utterance"
                ref={textareaRef}
                value={text}
                onChange={(event) => {
                  setText(event.target.value);
                  // 다음 녹음이 이 문장에 이어 붙도록 누적 출발점도 함께 맞춥니다.
                  textRef.current = event.target.value;
                  committedRef.current = event.target.value;
                  // 직접 손대신 뒤에는 "예시를 채웠습니다" 안내를 걷어 냅니다.
                  setFilledExampleId(null);
                }}
                rows={3}
                placeholder="여기에 하실 말씀을 적으시거나, 말씀하신 내용을 확인해 주세요."
                className="mt-1 w-full rounded-card border border-line-strong bg-paper-2 px-3.5 py-3 text-[1.0625rem] leading-[1.6] text-ink placeholder:text-ink-faint"
              />

              {reportMode && text.trim().length > 0 && (
                <RecordDraftPreview source={text} variant="live" className="mt-2.5" />
              )}

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setText("");
                    committedRef.current = "";
                    textRef.current = "";
                    setFilledExampleId(null);
                  }}
                  disabled={text.length === 0}
                  className="min-h-[48px] rounded-field px-1 text-[0.8438rem] font-semibold text-ink-muted transition-colors duration-150 active:bg-paper-2 disabled:opacity-45"
                >
                  지우기
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setText("");
                    committedRef.current = "";
                    textRef.current = "";
                    setExpanded(false);
                    setFilledExampleId(null);
                  }}
                  className="min-h-[48px] rounded-field px-1 text-[0.8438rem] font-semibold text-ink-muted transition-colors duration-150 active:bg-paper-2"
                >
                  입력창 접기
                </button>
              </div>
            </div>
          )}

          {/* 마이크를 못 쓰는 기기에서는 비활성 마이크 버튼의 까닭을 그 자리에서 적어 둡니다.
              (쓸 수 있는 기기의 조작 설명은 첫 회 안내 카드에만 둡니다 — 도크에 상주시키면
               상시 안내문이 도크 141px을 먹고 로그를 몰아냅니다. 평가 UI/UX m1.)

              판정이 나기 전(`unknown`)에도 마이크 버튼은 잠겨 있습니다 — 그 짧은 사이에
              「쓸 수 없습니다」라고 단정하면 되는 기기에서도 거짓말이 됩니다. 모르는 동안에는
              모른다고 적고, 대신 지금 쓸 수 있는 길을 같은 줄에서 알려 드립니다
              (2026-08-25 · /report 음성 입력과 같은 문법). */}
          {micCheck !== "yes" && (
            <p className="mt-2 text-[0.8438rem] leading-[1.6] text-ink-muted">
              {micCheck === "unknown"
                ? `${MIC_CHECKING_LINE}. 위 버튼과 직접 입력은 지금도 그대로 쓰실 수 있습니다.`
                : "이 기기에서는 음성 인식을 쓸 수 없습니다. 위 버튼과 직접 입력만으로 끝까지 진행하실 수 있습니다."}
            </p>
          )}

          {/* 규칙 엔진 시연을 여는 행은 이 목록에 없습니다 — 대화 로그 아래(TrainSession)에 있습니다.
              도크 안에서는 제안 버튼 셋보다 아래라 어느 글자 크기에서도 접힘선 밑이었습니다(노출 0px).
              시트는 body로 포털되므로 여는 자리와 상관없이 같은 자리에 뜹니다. */}

          {/* ── 이 도크의 **유일한** 라이브 리전 ─────────────────────────
              예전에는 마이크 첫 사용 안내 카드·경고 줄·이 문장이 각자 `role="status"`를 달고
              있었습니다. 세션 화면에는 대화 로그(`role="log"`)도 함께 살아 있어, TTS가 어르신
              대사를 읽는 동안 리전 넷이 번갈아 발화했습니다 — 보조기기 사용자에게는 두 목소리가
              엇갈립니다(페르소나 FE low, 1차 지적 후 오히려 늘었던 자리).
              지금은 화면에 보이는 세 조각이 각자 그려지고, **읽어 주는 일은 이 상자 하나**가
              맡습니다. 빈 문자열일 때도 상자는 남겨 둬야 다음 문장이 바뀐 줄로 읽힙니다.
              먼저 알려야 하는 것부터 고릅니다 — 방금 일어난 일(예시 채움) → 막아선 일(경고) →
              열린 안내(마이크 첫 사용). */}
          <p role="status" className="sr-only">
            {filledExample
              ? `${filledExample.ruleLabel} 예시 문장을 입력창에 채웠습니다. 보내시려면 이 내용으로 답하기 버튼을 눌러 주세요.`
              : (notice ??
                (micCheck === "yes" && micIntroOpen
                  ? "마이크를 처음 쓰실 때 안내가 열렸습니다. 마이크 버튼을 꾹 누른 채로 말씀하시고, 다 말씀하시면 손을 떼세요. 마이크 없이 아래 버튼만으로도 끝까지 진행됩니다."
                  : ""))}
          </p>
          {filledExample && (
            <p
              aria-hidden
              className="mt-2 rounded-card bg-brand-tint px-3.5 py-2.5 text-[0.8438rem] leading-[1.6] font-semibold text-brand-800"
            >
              입력창에 채워 드렸습니다. 아직 보내지 않았습니다. 아래 「이 내용으로 답하기」를
              누르시면 규칙 엔진이 판정합니다.
            </p>
          )}
        </div>
      </div>

      {/* ③ 항상 보이는 하단 행 — 스크롤 밖(`flex-none`)이라 16/18/20px 어느 설정에서도
          마이크와 직접 입력이 도크 안에 그대로 남습니다.
          위 목록에 못 보신 것이 남아 있으면 헤어라인 아래 한 줄로 알려 드립니다
          (그림자·그라데이션은 가이드가 금지합니다 — §7-4·§3). */}
      <div className="w-full flex-none border-t border-line px-[18px] pt-2.5 pb-[calc(28px_+_var(--chim-safe-b))]">
        {/* 예전에는 `aria-hidden`이었습니다 — 목록이 잘렸다는 사실이 화면을 보는 분에게만 갔습니다.
            보기 목록은 스크린리더에서도 잘려 있으므로(스크롤 상자 안의 항목) 같은 사실을 같이 전합니다.
            `aria-live`는 걸지 않습니다 — 스크롤할 때마다 읽히면 안내가 아니라 소음이 됩니다. */}
        {moreBelow && (
          <p className="mb-2 text-[0.8438rem] leading-[1.45] font-semibold text-ink-muted">
            보기가 아래로 더 있어요
          </p>
        )}

        <div className="flex items-center gap-2">
          {composing ? (
            <BigButton
              onClick={send}
              disabled={text.trim().length === 0}
              block
              className="min-w-0 flex-1"
            >
              이 내용으로 답하기
            </BigButton>
          ) : (
            /* 대기 — 입력 pill + 마이크 (시안 4a).
               pill에 line-strong 1px 보더를 둘러 「눌러야 하는 것」임을 형태로 말합니다
               (보더가 없을 때는 비활성 입력칸으로 읽혔습니다 — 평가 초보 mi72).
               반지름은 `rounded-chip`(= `--radius-chip` 999px)입니다. 예전에는 `rounded-[24px]`라
               높이(h-12 = 3rem)만 배율을 따라가고 반지름은 px에 묶여, 「아주 크게」(125%)에서
               높이 60px·반지름 24px이 되어 양 끝이 반원이 아니었습니다. 바로 옆 MicButton은
               `rounded-full` + rem 지름이라 언제나 완전한 원이고, 같은 줄에서 둘의 곡률 문법이
               갈리던 자리입니다(2026-08-26 페르소나 디자이너 low). */
            <button
              type="button"
              onClick={openInput}
              className="h-12 min-w-0 flex-1 rounded-chip border border-line-strong bg-paper-2 px-4 text-left text-[0.9375rem] text-ink-muted transition-colors duration-150 active:bg-neutral-line"
            >
              직접 입력…
            </button>
          )}
          <div ref={micWrapRef} className="flex-none">
            <MicButton
              label="누르고 있는 동안 말하기"
              disabled={micCheck !== "yes"}
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
        </div>
      </div>

      {demoOpen && demoExamples.length > 0 && (
        <RuleDemoSheet
          prompt={cue.prompt}
          examples={demoExamples}
          onFill={fillExample}
          onClose={onDemoClose}
        />
      )}
    </div>
  );
}

export default CueResponder;
