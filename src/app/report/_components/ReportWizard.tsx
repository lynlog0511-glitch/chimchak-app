"use client";

import { useEffect, useRef, useState } from "react";
import { formatElapsedDuration } from "@/lib/duration";
import type { RecordDraft } from "@/types";
import { BigButton, EyebrowLabel } from "@/components";
import { maskText } from "@/engine/masking";
import { extractDraft, recomputeMissing } from "@/engine/record";
import { SAVE_FAILED_BODY, SAVE_FAILED_TITLE, saveReport, type SavedReport } from "@/lib/storage";
import { DraftForm } from "./DraftForm";
import { DraftRows } from "./DraftRows";
import { MaskReview, applyManualMask, type ManualMaskSpan } from "./MaskReview";
import { PrivacyPath } from "./PrivacyPath";
import {
  CURRENT_KEY,
  PENDING_KEY,
  clearDraftSlot,
  joinDrafts,
  promoteHeldDraft,
  writeDraftSlot,
} from "./reportDraft";
import { StepBar } from "./StepBar";
import { VoiceInput } from "./VoiceInput";

/** 60분 초과·0초 이하는 측정 오류로 보고 표시하지 않는다(진단서 기준). */
const MAX_DISPLAYABLE_ELAPSED_SEC = 60 * 60;

/**
 * 초 단위 소요시간을 "N분 N초"로 표시합니다(1분 미만이면 "N초"만).
 *
 * @example formatElapsedDuration(102) // "1분 42초"
 */

const EMPTY_DRAFT: RecordDraft = recomputeMissing({
  time: "",
  who: "",
  what: "",
  action: "",
  status: "",
  missing: [],
});

/* ── 확정 전 원문 임시 보관 ───────────────────────────────
   왜 두는가. 이 앱은 standalone PWA이고 하단 탭바 말고는 크롬이 없습니다. 안드로이드에서
   뒤로 제스처는 「한 단계 되돌리기」의 기본 문법인데, 위저드 단계가 `useState`로만 있으면
   ②·③에서 뒤로를 누르는 순간 /report를 통째로 벗어나고 말로 3분 불러넣은 보고가 사라집니다
   (페르소나 UI/UX high). 아래 두 장치가 그 사고를 사고로 끝냅니다.

   ① 단계마다 히스토리 항목을 쌓아 시스템 뒤로를 「한 단계 되돌리기」로 만듭니다.
   ② 그래도 화면을 벗어난 경우를 대비해 **원문만** 세션 저장소에 둡니다.

   왜 localStorage가 아니라 sessionStorage인가. 이것은 확정 **전** 원문, 곧 아직 가리지 않은
   글입니다. 남길 이유는 「방금 실수로 나갔다」 하나뿐이라 그 탭이 살아 있는 동안으로 수명을
   좁힙니다 — 탭을 닫으면 사라지고, 확정하시면 즉시 지웁니다.
   (저장 항목이므로 `/legal`의 「기기 안에 남는 것」 목록에도 적어 두었습니다.)

   칸은 **둘**입니다 — 지금 적는 글(CURRENT_KEY)과 맡아 둔 지난 글(PENDING_KEY). 한 칸을 두
   회차가 다투던 동안에는 가드 한 줄의 방향이 어느 쪽 글을 죽일지 정했고, 그 방향이 라운드마다
   뒤집혔습니다(페르소나 FE med ×2). 나눈 이유와 승격 규칙은 `./reportDraft`에 적어 두었고,
   재현 절차는 tests/reportDraft.test.ts가 그대로 밟습니다 — 이 화면에는 그 칸을 **언제** 쓰고
   언제 지우는지만 남깁니다. */

/* ── 히스토리 표식 ─────────────────────────────────────────
   항목에 싣는 것은 셋입니다 — 단계 번호·회차 표식·그 회차에서 쌓은 깊이.
   Next가 쓰는 내부 상태는 그대로 펼쳐 이어 받고 옆에 얹기만 합니다(우리 열쇠만 남기면
   라우터가 그 항목을 자기 것으로 알아보지 못합니다).

   회차 표식을 싣는 이유. 확정한 뒤 「새 보고 작성하기」로 다시 시작하면 화면은 1단계인데
   히스토리에는 지난 회차의 항목이 그대로 남아 있습니다. 그 항목의 단계 번호를 믿으면
   뒤로가 3단계(확인)로 전진합니다 — 뒤로를 눌렀는데 가 본 적 없는 화면이 뜨던 자리입니다.
   회차가 다르면 단계 번호를 믿지 않습니다.

   깊이를 싣는 이유. 예전에는 popstate가 방향을 보지 않고 카운터를 1씩 깎았습니다. 브라우저
   앞으로에서도 같은 줄이 돌아, 2단계에 서 있는데 카운터가 0이 되고 화면 안 「다시 말하기」와
   시스템 뒤로가 서로 다른 곳으로 갔습니다. 깊이를 항목이 들고 있으면 어느 방향으로 오든
   지금 자리의 값이 곧 정답이라, 셀 상태가 하나 줄어듭니다.

   ── 손으로 밟아 확인하는 자리(2026-08-26 지적의 재현 절차 그대로) ──────────
   ① 확정 → 「새 보고 작성하기」 → 시스템 뒤로.
      전: E2{step:2}를 읽어 2단계(가리기)가 원문 없이 떴습니다.
      후: 확정이 겹을 접어 히스토리에 E1만 남고, 첫 뒤로가 /report를 벗어납니다.
   ② 확정 → 「새 보고 작성하기」 → 1단계에서 「다음」 → 시스템 뒤로.
      전: E3{step:3}을 읽어 뒤로가 3단계(확인)로 **전진**했습니다.
      후: 새 회차 표식이라 E3을 무시하고 1단계로 돌아옵니다(전진 없음).
   ③ 2단계 → 브라우저 뒤로 → 브라우저 앞으로 → 화면 안 「다시 말하기」.
      전: 카운터가 0으로 깎여 setStep(1)만 돌고, 이후 시스템 뒤로가 /report를 통째로 벗어났습니다.
      후: E2가 자기 깊이 1을 들고 있어 history.back()으로 갑니다(두 조작이 같은 길).
   ④ 확정 화면에서 시스템 뒤로 한 번.
      전: 쌓아 둔 2겹만큼 두 번 무반응이었습니다.
      후: 접었으므로 한 번에 화면을 벗어납니다.
   ⑤ 위저드 중간에서 새로고침한 뒤 뒤로.
      회차 표식이 새로 발급돼 지난 항목이 전부 남의 것이 되므로, 뒤로가 1단계로만 갑니다
      (전진하지 않습니다). 접기는 이 경우 지난 항목까지 닿지 못합니다 — 남는 경계입니다. */
const HISTORY_STEP_KEY = "chimchakReportStep";
const HISTORY_RUN_KEY = "chimchakReportRun";
const HISTORY_DEPTH_KEY = "chimchakReportDepth";

interface HistoryMark {
  step: 2 | 3;
  run: string;
  depth: number;
}

/** 우리가 심은 항목이면 표식을, 아니면 null을 돌려줍니다(세 값이 다 맞을 때만 인정합니다). */
function markFromHistoryState(state: unknown): HistoryMark | null {
  if (typeof state !== "object" || state === null) return null;
  const record = state as Record<string, unknown>;
  const step = record[HISTORY_STEP_KEY];
  const run = record[HISTORY_RUN_KEY];
  const depth = record[HISTORY_DEPTH_KEY];
  if (step !== 2 && step !== 3) return null;
  if (typeof run !== "string" || run.length === 0) return null;
  if (typeof depth !== "number" || !Number.isInteger(depth) || depth < 1) return null;
  return { step, run, depth };
}

/** 회차 표식 — 같은 문서에 남아 있는 지난 회차 항목과 구분되기만 하면 됩니다. */
function newRunId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 음성 보고 → 기록 코칭 3단계 위저드 (시안 6e 언어).
 *
 * 1) 말하기: 마이크(누르는 동안 인식) 또는 타이핑
 * 2) 가리기: 무엇이 왜 가려졌는지 인라인 칩과 범례로 표시(자동이 놓친 자리는 눌러서 직접 가림)
 * 3) 확인  : 급여제공기록지 5요소를 고치고 확정(이 기기에만 저장)
 *
 * 모든 처리는 브라우저 안에서 끝나며 외부 호출이 0건입니다.
 * 재구현에서 바뀐 것은 면·글자 크기뿐이고, 단계·검사·저장 규칙은 그대로입니다.
 */
export function ReportWizard() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [text, setText] = useState("");
  /** 2단계에서 손으로 가린 자리(원문 좌표). 저장 경로도 이 값을 함께 씁니다. */
  const [manual, setManual] = useState<ManualMaskSpan[]>([]);
  const [draft, setDraft] = useState<RecordDraft>(EMPTY_DRAFT);
  const [saved, setSaved] = useState<SavedReport | null>(null);
  /** 2차 가명처리에서 추가로 가린 건수 */
  const [secondPassCount, setSecondPassCount] = useState(0);
  /** 실제 입력 시작 시각(첫 타이핑 또는 마이크 시작). 예시 문장 채우기는 포함하지 않는다. */
  const inputStartRef = useRef<number | null>(null);
  /**
   * 지난번에 적으시던 원문 — 있으면 1단계 위에 「이어서 / 새로 적기」를 세웁니다.
   * 자동으로 되돌려 넣지 않습니다: 무엇이 들어올지 모르는 칸에 글이 저절로 채워져 있으면
   * 사용자가 그 글의 임자를 알 수 없습니다. 고르시게 두는 편이 정직합니다.
   */
  const [pendingDraft, setPendingDraft] = useState("");
  /**
   * 이 회차가 **맡아 둔 글을 이어서** 쓴 회차인지.
   *
   * 이어서 쓰신 회차는 처음 적기 시작한 순간을 알 수 없습니다. 그때 시계를 다시 켜면
   * 실제보다 짧은 값이 나오고, 그 값이 하필 이 앱의 유일한 절감 근거 자리에 올라갑니다.
   * 그래서 재지 않고, 재지 않았다는 사실을 확정 화면에 적습니다.
   */
  const [resumedDraft, setResumedDraft] = useState(false);
  /** 세션 저장소를 읽기 전에는 입력 UI를 열지 않습니다 — 복원 카드와 마이크의 깜빡임 방지. */
  const [restored, setRestored] = useState(false);
  /**
   * 이 회차의 표식. 확정 뒤 「새 보고 작성하기」로 다시 시작하면 새 값을 받습니다.
   * 렌더 중에 한 번만 발급합니다 — 화면에 그리는 값이 아니라 수화 어긋남이 생기지 않습니다.
   */
  const runIdRef = useRef("");
  if (runIdRef.current.length === 0) runIdRef.current = newRunId();
  /**
   * 지금 서 있는 히스토리 항목의 깊이 — 이 회차에서 우리가 쌓은 겹 수입니다(0이면 /report 첫 항목).
   * 화면 안 「이전」이 시스템 뒤로와 같은 길을 쓰게 하고, 확정 때 접을 겹 수도 이 값입니다.
   */
  const depthRef = useRef(0);
  /** 확정 뒤에는 뒤로가 단계를 되돌리지 않습니다(이미 저장을 마친 화면입니다). */
  const savedRef = useRef(false);
  savedRef.current = saved !== null;

  /**
   * 지금 화면의 제목. 단계가 바뀌면 여기로 초점을 옮깁니다.
   * 각 단계 컴포넌트가 자기 h2에 이 ref를 붙이므로, 항상 **지금 보이는** 제목 하나만 가리킵니다.
   */
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  /** 마지막으로 보여 준 화면. 첫 렌더에서는 스크롤·초점을 건드리지 않습니다. */
  const shownRef = useRef<string | null>(null);

  /**
   * 단계 전환 시 화면 맨 위로 되돌리고 새 단계 제목을 읽어 줍니다.
   *
   * 이걸 하지 않으면 ②로 넘어갔을 때 가림 결과 문단 중간에 떨어지고,
   * 확정 뒤에는 「확정했습니다」가 뷰포트 위로 밀려나 확정 사실 자체가 화면에서 사라집니다.
   * 값이 실제로 바뀐 때만 움직이므로, 같은 화면에서 효과가 다시 돌아도 초점을 빼앗지 않습니다.
   */
  useEffect(() => {
    const shown = saved ? "confirmed" : `step-${step}`;
    if (shownRef.current === shown) return;
    const first = shownRef.current === null;
    shownRef.current = shown;
    if (first) return;
    window.scrollTo(0, 0);
    headingRef.current?.focus();
  }, [step, saved]);

  /* 지난번에 적으시던 글이 남아 있는지 — 마운트 뒤에 한 번만 봅니다(서버에는 세션 저장소가 없습니다).
     이 화면으로 돌아오셨다는 것은 지난 회차가 확정 없이 화면을 벗어난 채 끝났다는 뜻입니다.
     그래서 「지금 적는 글」 칸에 남아 있던 것을 **맡아 둔 글** 칸으로 올리고, 지금 칸은 비웁니다.
     두 칸에 글이 다 있으면(카드를 고르지 않은 채 또 나가신 경우) 시간 순으로 이어 한 칸에
     담습니다 — 어느 쪽도 버리지 않는 것이 이 장치의 유일한 목적입니다.
     StrictMode의 이중 실행에서도 결과가 같습니다: 두 번째 실행은 이미 비워진 「지금」 칸과
     방금 올린 「맡아 둔」 칸을 다시 이을 뿐이라 같은 값이 나옵니다. */
  useEffect(() => {
    const held = promoteHeldDraft();
    if (held.length > 0) setPendingDraft(held);
    setRestored(true);
  }, []);

  /* 원문이 바뀔 때마다 「지금 적는 글」 칸을 갱신합니다. 여기 담기는 것은 **가리기 전 원문**이고,
     확정하시면 지웁니다.

     가드가 없습니다 — 카드가 떠 있든 아니든, 고르셨든 아니든 지금 치신 글은 언제나 남습니다.
     맡아 둔 글은 다른 칸에 있어 이 쓰기가 닿지 못하므로, 예전처럼 「어느 쪽을 죽일지」를
     여기서 정할 일이 없습니다. `saved`만 봅니다(확정 뒤에는 지운 칸을 다시 채우지 않습니다). */
  useEffect(() => {
    if (!restored || saved) return;
    writeDraftSlot(CURRENT_KEY, text);
  }, [text, saved, restored]);

  /* 시스템 뒤로 = 한 단계 되돌리기.
     방향을 세지 않습니다 — 도착한 항목이 자기 깊이와 단계를 들고 있으므로, 뒤로든 앞으로든
     그 값을 그대로 씁니다. 회차가 다르거나 우리 표식이 없는 항목이면 단계 번호를 믿지 않고
     첫 단계로만 둡니다(전진은 절대 하지 않습니다). */
  useEffect(() => {
    const onPop = (event: PopStateEvent): void => {
      const mark = markFromHistoryState(event.state);
      if (!mark || mark.run !== runIdRef.current) {
        /* 우리가 심지 않았거나 지난 회차의 항목입니다. 지난 회차 항목은 확정 때 접으므로
           보통 남지 않습니다 — 접기가 막힌 환경에서도 뒤로가 전진하지 않게 하는 보루입니다. */
        depthRef.current = 0;
        if (!savedRef.current) setStep(1);
        return;
      }
      depthRef.current = mark.depth;
      // 확정을 마친 화면에서는 뒤로가 단계를 되돌리지 않습니다 — 저장은 이미 끝났습니다.
      if (savedRef.current) return;
      setStep(mark.step);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  /** 다음 단계로 — 히스토리에 한 겹 쌓아 시스템 뒤로가 여기로 돌아오게 합니다. */
  const goStepForward = (next: 2 | 3): void => {
    try {
      const depth = depthRef.current + 1;
      window.history.pushState(
        {
          ...window.history.state,
          [HISTORY_STEP_KEY]: next,
          [HISTORY_RUN_KEY]: runIdRef.current,
          [HISTORY_DEPTH_KEY]: depth,
        },
        "",
      );
      depthRef.current = depth;
    } catch {
      /* 히스토리를 쓸 수 없는 환경 — 단계 전환만 하고 조용히 넘어갑니다 */
    }
    setStep(next);
  };

  /** 화면 안 「이전」 — 시스템 뒤로와 같은 길을 씁니다(두 조작이 다른 결과를 내지 않게). */
  const goStepBack = (fallback: 1 | 2): void => {
    if (depthRef.current > 0) {
      window.history.back();
      return;
    }
    setStep(fallback);
  };

  /**
   * 확정 직후, 이 회차가 쌓아 둔 히스토리 겹을 접습니다.
   *
   * 접지 않으면 확정 화면에서 시스템 뒤로가 쌓아 둔 겹 수만큼 아무 일도 하지 않습니다.
   * 저장이 끝난 화면에서 단계를 되돌리지 않는 판단은 옳지만, 안드로이드 스탠드얼론에서
   * 뒤로 제스처가 두 번 먹통인 것은 사용자에게 고장으로 읽힙니다. 접고 나면 첫 뒤로가
   * 곧바로 /report를 벗어납니다.
   *
   * 순서가 중요합니다. 먼저 지금 항목의 표식을 지우고(되감기가 막힌 환경에서도 이 항목만은
   * 위저드로 되돌아가지 않게), 그다음 쌓은 깊이만큼 되감습니다. 되감기는 우리가 쌓은 겹까지만
   * 하므로 /report를 벗어나지 않습니다.
   */
  const foldWizardHistory = (): void => {
    try {
      const current = window.history.state as Record<string, unknown> | null;
      const cleaned: Record<string, unknown> = { ...current };
      delete cleaned[HISTORY_STEP_KEY];
      delete cleaned[HISTORY_RUN_KEY];
      delete cleaned[HISTORY_DEPTH_KEY];
      window.history.replaceState(cleaned, "");
      const depth = depthRef.current;
      depthRef.current = 0;
      if (depth > 0) window.history.go(-depth);
    } catch {
      /* 히스토리를 쓸 수 없는 환경 — 접지 못할 뿐, 저장은 이미 끝났습니다 */
    }
  };

  /**
   * 「이어서 / 새로」 물음을 매듭짓습니다 — 맡아 둔 칸을 비우고 화면에서 카드를 접습니다.
   *
   * 네 자리에서 부릅니다(새로 적기 · 이어서 적기 · 확정 · 새 회차). 「이어서」로 오는 경우
   * 그 글은 이미 「지금 적는 글」로 옮겨 간 뒤라, 이 칸에서 지워도 사라지는 것이 없습니다.
   * 「지금 적는 글」 칸은 건드리지 않습니다 — 카드가 떠 있는 동안 치신 글은 어느 쪽을 고르셔도
   * 그대로 남습니다.
   */
  const settlePending = (): void => {
    clearDraftSlot(PENDING_KEY);
    setPendingDraft("");
  };

  const markInputStart = (): void => {
    if (inputStartRef.current === null) inputStartRef.current = Date.now();
  };

  /** 원문이 바뀌면 손으로 가린 좌표는 더 이상 그 글을 가리키지 않습니다 — 함께 버립니다. */
  const updateText = (next: string): void => {
    setText(next);
    setManual([]);
  };

  const goDraft = (): void => {
    setDraft(extractDraft(applyManualMask(text, manual).masked));
    goStepForward(3);
  };

  const confirm = (): void => {
    // 2차 가명처리 — 사용자가 손으로 고친 칸까지 저장 직전에 한 번 더 검사합니다.
    const time = maskText(draft.time);
    const who = maskText(draft.who);
    const what = maskText(draft.what);
    const action = maskText(draft.action);
    const status = maskText(draft.status);
    // 1차 = 자동 규칙 + 2단계에서 손으로 가린 자리. 그 결과를 다시 한 번 규칙에 태웁니다.
    const firstPass = applyManualMask(text, manual);
    const body = maskText(firstPass.masked);

    const extraSpans = [
      ...time.spans,
      ...who.spans,
      ...what.spans,
      ...action.spans,
      ...status.spans,
      ...body.spans,
    ];

    const firstSpans = firstPass.spans;
    const counts: Record<string, number> = {};
    for (const span of [...firstSpans, ...extraSpans]) {
      counts[span.kind] = (counts[span.kind] ?? 0) + 1;
    }

    const finalDraft = recomputeMissing({
      time: time.masked,
      who: who.masked,
      what: what.masked,
      action: action.masked,
      status: status.masked,
      missing: [],
    });

    /* 이어서 쓰신 회차는 시작 시각을 알 수 없으므로 재지 않습니다(위 `resumedDraft` 참조). */
    const elapsedSec =
      !resumedDraft && inputStartRef.current !== null
        ? Math.round((Date.now() - inputStartRef.current) / 1000)
        : undefined;

    const stored = saveReport({
      maskedText: body.masked,
      draft: finalDraft,
      maskedCounts: counts,
      elapsedSec,
    });

    setSecondPassCount(extraSpans.length);
    setDraft(finalDraft);
    setSaved(stored);
    /* 확정과 동시에 임시 보관을 두 칸 다 지웁니다 — 남길 이유가 사라진 순간입니다.
       카드를 고르지 않은 채 확정까지 오신 경우 맡아 둔 지난 글도 여기서 함께 사라집니다.
       남는 경계이지만, 이 화면에서 한 벌을 확정하고도 지난 글을 계속 들고 있으면 다음 회차
       첫 화면에 또 카드가 서게 됩니다 — 되찾을 문을 닫는 자리는 여기 하나로 둡니다. */
    clearDraftSlot(CURRENT_KEY);
    settlePending();
    foldWizardHistory();
  };

  const reset = (): void => {
    setText("");
    setManual([]);
    setDraft(EMPTY_DRAFT);
    setSaved(null);
    setSecondPassCount(0);
    inputStartRef.current = null;
    setResumedDraft(false);
    clearDraftSlot(CURRENT_KEY);
    settlePending();
    /* 새 회차입니다 — 표식을 새로 발급해, 접히지 않고 남은 지난 회차 항목이 있더라도
       그 단계 번호가 이 회차의 뒤로에 끼어들지 못하게 합니다. */
    runIdRef.current = newRunId();
    depthRef.current = 0;
    setStep(1);
  };

  if (saved) {
    const showElapsed =
      typeof saved.elapsedSec === "number" &&
      saved.elapsedSec > 0 &&
      saved.elapsedSec <= MAX_DISPLAYABLE_ELAPSED_SEC;

    return (
      <div>
        <StepBar current={3} finished />

        {/* 확정 직후의 주인공은 이 한 줄입니다. */}
        <div className="mt-[18px]">
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="text-[1.1875rem] leading-[1.45] font-extrabold text-ok-ink"
          >
            {saved && !saved.persisted ? SAVE_FAILED_TITLE : "저장했습니다"}
          </h2>
          <EyebrowLabel tone="ok" className="mt-[3px]">
            {saved && !saved.persisted ? "저장되지 않음" : "이 기기에만 저장"}
          </EyebrowLabel>
          {saved && !saved.persisted && (
            <p className="mt-[10px] text-[0.9375rem] leading-[1.6] text-warn-ink">{SAVE_FAILED_BODY}</p>
          )}
          <p className="mt-[10px] text-[0.8438rem] leading-[1.6] text-ink">
            지금 남은 것은 두 번 가린 글뿐입니다. 말씀하신 음성과 원문은 저장하지
            않았습니다.
          </p>
          {/* 기관 시스템 이야기는 앱을 통틀어 이 한 곳에서만 합니다 —
              「전달됩니다」를 현재형으로 쓰면 없는 기능을 있다고 적는 셈이라 「계획」 칩을 답니다. */}
          <p className="mt-[8px] text-[0.8438rem] leading-[1.6] text-ink-soft">
            <span className="mr-[6px] inline-flex items-center rounded-chip border border-line-strong px-[7px] py-[1px] align-[2px] text-[0.6875rem] leading-[1.45] font-bold whitespace-nowrap text-ink-soft">
              계획
            </span>
            기관 시스템으로 보내는 기능은 아직 없습니다. 연동하게 되더라도 확정 버튼을 누르신
            뒤에, 가려진 글만 나갑니다.
          </p>
          <p className="mt-[8px] text-[0.7813rem] leading-[1.6] text-ink-soft">
            {secondPassCount > 0
              ? `저장 직전 2차 검사에서 ${secondPassCount}곳을 더 가렸습니다.`
              : "저장 직전 2차 검사에서 추가로 가릴 항목은 나오지 않았습니다."}
          </p>
        </div>

        {/*
          앱에서 유일한 절감 근거입니다. 예시 문장으로 시작하면 소요시간을 재지 않는데,
          그때 이 블록이 통째로 사라지면 「그래서 얼마나 줄었나」에 답할 화면이 0이 됩니다.
          비교 기준(손으로 쓰면 20~30분)은 항상 두고, 실측이 있을 때만 앞에 병기합니다.
        */}
        <div className="mt-[14px] rounded-card bg-paper-2 px-4 py-[14px]">
          <EyebrowLabel>걸린 시간</EyebrowLabel>
          <p className="mt-[6px] text-[0.9375rem] leading-[1.6] font-bold text-ink">
            {showElapsed && (
              <>
                이번 기록{" "}
                <span className="chim-num text-brand-800">
                  {formatElapsedDuration(saved.elapsedSec as number)}
                </span>{" "}
                ·{" "}
              </>
            )}
            손으로 쓰면 <span className="chim-num text-brand-800">20~30분</span>
          </p>
          <p className="mt-[6px] text-[0.7813rem] leading-[1.6] text-ink-soft">
            20~30분은 현장에서 일하시는 분들께 직접 여쭤 들은 값입니다.{" "}
            {showElapsed
              ? "이번 기록 시간은 처음 적기 시작한 순간부터 확정까지를 이 기기에서 잰 값입니다."
              : resumedDraft
                ? "이번 회차는 적으시던 글을 이어서 마쳐, 처음 적기 시작한 순간을 알 수 없어 재지 않았습니다."
                : "이번 회차는 예시 문장으로 시작해 소요 시간을 재지 않았습니다."}
          </p>
        </div>

        <EyebrowLabel className="mt-6">저장한 돌봄 기록 — 다섯 칸</EyebrowLabel>
        <DraftRows draft={saved.draft} empty="confirmed" className="mt-[2px]" />

        {/* 저장까지 끝났으므로 5단계 전부 완료 표시 */}
        <PrivacyPath reached={6} className="mt-6" />

        <BigButton href="/history" size="lg" block className="mt-5">
          내 기록에서 확인하기
        </BigButton>
        <BigButton onClick={reset} variant="secondary" block className="mt-2">
          새 돌봄 기록 만들기
        </BigButton>
      </div>
    );
  }

  if (!restored) {
    return (
      <p role="status" className="py-8 text-center text-[1rem] font-semibold text-ink-soft">
        작성 중이던 기록을 확인하고 있어요
      </p>
    );
  }

  return (
    <div>
      <StepBar current={step} />

      {/* 적으시던 글이 남아 있을 때 — 자동으로 채우지 않고 먼저 고르시게 둡니다.
          이 선택 전에는 새 입력창을 함께 보여 주지 않습니다. 「이어서 적기」와 말하기 시작이
          동시에 주 행동으로 보이면 무엇부터 눌러야 하는지 다시 판단해야 하기 때문입니다. */}
      {step === 1 && pendingDraft.length > 0 && (
        <section
          aria-labelledby="report-resume-title"
          className="mt-[14px] rounded-card bg-paper-2 px-4 py-[14px]"
        >
          <h2
            id="report-resume-title"
            className="text-[1.0625rem] leading-[1.45] font-bold text-ink"
          >
            적으시던 보고가 있습니다
          </h2>
          <p className="mt-[5px] text-[0.9375rem] leading-[1.6] text-ink-soft">
            확정하기 전에 이 화면을 벗어나셔서, 적으시던 글을 잠시 맡아 두었습니다. 이어서
            하시겠어요?
          </p>
          <div className="mt-[10px] flex gap-2">
            <button
              type="button"
              onClick={() => {
                /* 맡아 둔 지난 글만 지우고 빈 입력 화면을 엽니다. */
                settlePending();
              }}
              className="flex min-h-[64px] flex-1 items-center justify-center rounded-card border border-line-strong bg-paper text-[1rem] font-semibold text-ink-soft transition-colors duration-150 active:bg-paper-2"
            >
              새로 적기
            </button>
            <button
              type="button"
              onClick={() => {
                /* 여기서 시계를 켜지 않습니다 — 이어서 적으신 회차의 「걸린 시간」은
                   처음 적기 시작한 순간을 알 수 없어, 재면 실제보다 짧게 나옵니다.
                   앱에서 유일한 절감 근거라 짧게 나오는 쪽이 더 위험합니다.
                   그래서 이 회차는 아예 재지 않고, 그 사실을 확정 화면에 적습니다. */
                setResumedDraft(true);
                /* 복원 직전 메모리의 글이 있더라도 손실 없이 잇습니다. */
                updateText(joinDrafts(pendingDraft, text));
                settlePending();
              }}
              className="flex min-h-[64px] flex-[1.4] items-center justify-center rounded-card bg-brand-700 text-[1rem] font-bold text-paper transition-colors duration-150 active:bg-brand-800"
            >
              이어서 적기
            </button>
          </div>
        </section>
      )}

      <div className="mt-[18px]">
        {step === 1 && pendingDraft.length === 0 && (
          <VoiceInput
            value={text}
            onChange={updateText}
            onNext={() => goStepForward(2)}
            onInputStart={markInputStart}
            headingRef={headingRef}
          />
        )}

        {step === 2 && (
          <MaskReview
            text={text}
            manual={manual}
            onManualChange={setManual}
            onBack={() => goStepBack(1)}
            onNext={goDraft}
            headingRef={headingRef}
          />
        )}

        {step === 3 && (
          <DraftForm
            draft={draft}
            onChange={setDraft}
            onBack={() => goStepBack(2)}
            onConfirm={confirm}
            headingRef={headingRef}
          />
        )}
      </div>
    </div>
  );
}

export default ReportWizard;
