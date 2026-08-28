"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

export interface ModalDismissOptions {
  /** 초점을 가둘 범위 — 이 안의 요소들 사이에서만 Tab이 돕니다 */
  panelRef: RefObject<HTMLElement | null>;
  /**
   * 열리는 순간 초점을 받을 자리.
   * 넘기지 않으면 범위 자체(`panelRef`)에 초점을 둡니다 — 그 요소에 `tabIndex={-1}`이 필요합니다.
   */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Esc를 누르셨을 때 — 시트·모달을 닫는 동작 하나만 넘깁니다 */
  onDismiss: () => void;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/* ── 배경 스크롤 잠금 ─────────────────────────────────────────
   오버레이가 떠 있는 동안 뒤 페이지가 따라 움직이면 「멈춰 세웠다」는 상태가 물리적으로 부정됩니다
   (⚑CF 시트가 떠 있는 채로 문서가 2670px 자유롭게 스크롤되던 자리 — 모션 감사 3).

   잠그는 수단은 **body를 `position: fixed`로 띄우는 쪽**입니다. 예전에는 `body { overflow: hidden }`
   한 줄이었는데, iOS Safari는 문서 스크롤의 주체가 `documentElement`라 body의 overflow로는 멈추지
   않습니다 — 시트 안쪽(`overscroll-contain`)이 아니라 딤·헤더·버튼 행처럼 스크롤 컨테이너가 아닌
   자리를 끌면 뒤 세션이 그대로 따라 움직였습니다(평가 FE m7). 주 사용 기기가 아이폰인 앱에서
   의도가 그 기기에서만 안 지켜지던 자리입니다. `html`에도 함께 걸어 두 겹으로 막습니다.

   띄우는 동안 문서 스크롤은 0으로 접히므로 **푸는 쪽에서 원래 자리로 되돌립니다** — 예전 코드가
   「흘렀을 때만」 되돌리던 보정(savedScrollY)이 이제 상시 경로가 됩니다.

   잠금은 **문서 하나에 한 벌**입니다. 오버레이가 겹쳐 뜰 수 있으므로(세션 헤더의 설정 팝오버를
   열어 둔 채 ⚑CF가 뜨는 경우) 참조 수를 세고, 마지막 하나가 닫힐 때만 원래 값으로 되돌립니다.
   데스크톱에서 스크롤바가 사라지며 생기는 가로 흔들림은 그 폭만큼 padding으로 메웁니다
   (모바일의 오버레이 스크롤바에서는 폭이 0이라 아무 일도 하지 않습니다). */
interface SavedBodyStyle {
  overflow: string;
  paddingRight: string;
  position: string;
  top: string;
  left: string;
  right: string;
  width: string;
}

let lockCount = 0;
let savedBody: SavedBodyStyle | null = null;
let savedRootOverflow = "";
let savedScrollX = 0;
let savedScrollY = 0;

function lockBodyScroll(): () => void {
  if (typeof document === "undefined") return () => {};
  if (lockCount === 0) {
    const body = document.body;
    const root = document.documentElement;
    savedBody = {
      overflow: body.style.overflow,
      paddingRight: body.style.paddingRight,
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
    };
    savedRootOverflow = root.style.overflow;
    savedScrollX = window.scrollX;
    savedScrollY = window.scrollY;
    // 스크롤바 폭은 **감추기 전에** 재야 합니다.
    const gutter = window.innerWidth - root.clientWidth;
    root.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `${-savedScrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    if (gutter > 0) body.style.paddingRight = `${gutter}px`;
  }
  lockCount += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount > 0) return;
    const body = document.body;
    const root = document.documentElement;
    if (savedBody) {
      body.style.overflow = savedBody.overflow;
      body.style.paddingRight = savedBody.paddingRight;
      body.style.position = savedBody.position;
      body.style.top = savedBody.top;
      body.style.left = savedBody.left;
      body.style.right = savedBody.right;
      body.style.width = savedBody.width;
      savedBody = null;
    }
    /* 문서가 다시 스크롤될 수 있게 만든 **뒤에** 자리를 되돌립니다.
       (`behavior: "auto"`를 명시해 html의 smooth 스크롤을 타지 않게 합니다.) */
    root.style.overflow = savedRootOverflow;
    window.scrollTo({ top: savedScrollY, left: savedScrollX, behavior: "auto" });
  };
}

/* ── 시스템 뒤로 가기 ─────────────────────────────────────────
   오버레이가 열리는 동안 히스토리 항목을 **한 겹** 밀어 넣습니다. 안드로이드에서 바텀시트를 닫는
   첫 동작은 뒤로 제스처인데, 예전에는 Esc·바깥 클릭만 있고 뒤로는 페이지 자체를 벗어났습니다 —
   하필 「실수로 훈련을 버리지 않게」 세워 둔 종료 확인 모달이 뒤로 한 번에 우회되던 자리입니다
   (평가 UI/UX m2). 데스크톱 문법만 챙기고 실제 사용 기기의 문법이 비어 있던 셈입니다.

   규칙은 셋입니다.
   1. 열 때 `pushState` 한 겹 — 주소는 그대로 두고 표시만 얹습니다(Next 라우터의 상태를 함께
      들고 가야 되돌아왔을 때 라우터가 화면을 다시 그리지 않습니다).
   2. `popstate`가 오면 `onDismiss` — 그리고 곧바로 청취를 끊습니다. 뒤로를 두 번 누르시면
      두 번째는 「이 화면을 떠나기」가 되어야지, 같은 시트를 두 번 닫으려 들면 안 됩니다.
   3. Esc·바깥 클릭·버튼으로 닫혀 언마운트될 때는 `history.back()`으로 그 한 겹을 걷습니다 —
      **우리가 밀어 넣은 항목이 아직 맨 위일 때만**입니다. 화면이 그 사이 다른 곳으로 옮겨 갔거나
      (「끝내고 훈련 목록으로」) 위에 다른 오버레이가 얹혀 있으면 손대지 않습니다.

   우리가 부른 `back()`이 되돌려 보내는 `popstate`는 우리 것이므로, 그때 마침 열려 있는 다른
   오버레이가 자기가 닫히라는 신호로 오해하지 않게 한 번 걸러 냅니다(연속 열림·닫힘, 겹친 시트). */
const HISTORY_KEY = "__chimOverlay";

/** 오버레이마다 다른 번호 — 「지금 맨 위가 내가 밀어 넣은 항목인가」를 이것으로 가립니다. */
let historySeq = 0;
/** 우리가 부른 `back()`이 몇 건 돌아올 차례인지. */
let selfBackPending = 0;
/** 지금 처리 중인 `popstate`가 우리가 부른 `back()`의 것인지 — 같은 이벤트를 보는 청취자들이 함께 읽습니다. */
let popIsSelf = false;
let watcherInstalled = false;

function readHistoryToken(): number | undefined {
  const state: unknown = window.history.state;
  if (state === null || typeof state !== "object") return undefined;
  const token = (state as Record<string, unknown>)[HISTORY_KEY];
  return typeof token === "number" ? token : undefined;
}

/**
 * 걸러 내는 청취자를 **한 번만** 답니다.
 * 오버레이보다 먼저 달리고 떼지 않으므로 언제나 먼저 실행됩니다 — 뒤이어 실행되는 오버레이 쪽에서
 * `popIsSelf`를 그대로 읽을 수 있습니다. 되돌리는 것은 `setTimeout`으로 미룹니다:
 * 마이크로태스크는 청취자 **사이사이**에 끼어들어 한 이벤트 안에서 값이 바뀝니다.
 */
function installSelfBackWatcher(): void {
  if (watcherInstalled || typeof window === "undefined") return;
  watcherInstalled = true;
  window.addEventListener("popstate", () => {
    if (selfBackPending <= 0) return;
    selfBackPending -= 1;
    popIsSelf = true;
    window.setTimeout(() => {
      popIsSelf = false;
    }, 0);
  });
}

/**
 * 전면 시트·모달의 규칙 한 벌 —
 * **마운트 초점 · Esc 닫기 · 시스템 뒤로 닫기 · Tab 가두기 · 배경 스크롤 잠금**.
 *
 * ⚑CF 바텀시트에만 있던 것을 훅으로 빼 둡니다. 같은 화면 안에서 모달 문법이
 * 두 종류로 갈리면(초점이 배경에 남고 Esc가 듣지 않는 모달) 키보드·스크린리더 사용자가
 * 모달 밖을 조작하게 됩니다 — 평가 UI/UX m5 실측에서 「종료」 확인 모달이 그 상태였습니다.
 *
 * 안드로이드 뒤로 제스처도 여기서 함께 받습니다. 이 훅을 쓰는 오버레이(⚑CF 시트 · 종료 확인 ·
 * 규칙 시연 시트 · 자유 연습 중단 · 설정 팝오버)는 **소비처를 고치지 않아도** 그 문법을 함께
 * 얻습니다 — 히스토리 한 겹을 여기서 밀고 걷기 때문입니다(위 「시스템 뒤로 가기」 절).
 *
 * 배경을 `aria-hidden`으로 덮는 것은 여는 쪽 화면의 몫입니다(이 훅은 초점·스크롤·히스토리만 다룹니다).
 *
 * ※ 파일 위치: 예전에는 `app/train/_components`에 있었고 공용 컴포넌트(`SettingsMenu`)가
 *   그 안쪽을 거꾸로 가져다 썼습니다. 다루는 것이 초점·스크롤뿐이라 화면 종류를 가리지 않으므로
 *   공용 자리로 옮겼습니다(부채 감사 — 역방향 의존 해소).
 */
export function useModalDismiss({
  panelRef,
  initialFocusRef,
  onDismiss,
}: ModalDismissOptions): void {
  /* 히스토리 효과는 **여닫는 순간에 한 번씩만** 돌아야 합니다(닫는 함수가 새로 만들어질 때마다
     항목이 한 겹씩 더 쌓이면 뒤로를 여러 번 눌러야 나가집니다). 그래서 최신 값만 참조로 넘깁니다. */
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  useEffect(() => {
    /* 닫은 뒤에는 열기 전 자리로 초점을 돌려 드립니다 — 그러지 않으면 모달을 닫을 때마다
       초점이 BODY로 떨어져 화면 처음부터 Tab을 다시 눌러야 합니다.
       (열었던 버튼이 그 사이 사라졌다면 아무 일도 하지 않고, 화면 쪽 규칙이 초점을 잡습니다.) */
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // 시트가 아직 화면 아래에 있는 동안 초점을 주므로 스크롤은 막습니다(문서가 튀지 않게).
    const target = initialFocusRef?.current ?? panelRef.current;
    target?.focus({ preventScroll: true });
    return () => {
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [initialFocusRef, panelRef]);

  useEffect(() => lockBodyScroll(), []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    installSelfBackWatcher();

    const token = (historySeq += 1);
    /** 뒤로로 닫혔는지 — 그렇다면 걷을 항목이 이미 없습니다. */
    let closedByPop = false;

    const base: Record<string, unknown> =
      window.history.state !== null && typeof window.history.state === "object"
        ? (window.history.state as Record<string, unknown>)
        : {};
    window.history.pushState({ ...base, [HISTORY_KEY]: token }, "", window.location.href);

    const onPopState = (): void => {
      // 우리가 부른 back()이 돌아온 것 — 방금 열린(또는 아래 깔린) 다른 오버레이를 대신 닫지 않습니다.
      if (popIsSelf) return;
      closedByPop = true;
      window.removeEventListener("popstate", onPopState);
      onDismissRef.current();
    };
    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("popstate", onPopState);
      if (closedByPop) return;
      /* 우리가 밀어 넣은 항목이 맨 위일 때만 걷습니다.
         화면이 옮겨 갔거나(라우터가 새 항목을 얹은 뒤) 위에 다른 오버레이가 있으면
         여기서 back()을 부르는 순간 남의 항목이 걷힙니다. */
      if (readHistoryToken() !== token) return;
      selfBackPending += 1;
      window.history.back();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        onDismiss();
        return;
      }
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      const at = active instanceof HTMLElement ? focusables.indexOf(active) : -1;
      /* 초점이 이 목록 **밖**에 있는 경우가 열린 직후의 정상 상태입니다 — 두 오버레이 모두
         `initialFocusRef`로 `tabIndex={-1}` 요소를 주기 때문입니다(설정 팝오버는 「글자 크기」
         문단, 종료 확인은 제목 `<h2>`). 그 둘은 `FOCUSABLE`에 잡히지 않으므로 `focusables[0]`이
         아니고, 예전 코드는 「첫 칸인가·끝 칸인가」만 보아 **연 직후 첫 Shift+Tab에 아무 개입도
         하지 않았습니다** — 브라우저 기본 동작이 초점을 패널 밖(팝오버는 「설정」 트리거,
         종료 확인은 패널 밖 전면 「닫기」 버튼)으로 내보내고, 한 번 더 누르면 배경 문서로
         샙니다(15차 a11y med). 이 앱이 스스로 「Tab이 팝오버 밖으로 빠지지 않는다」고 적어 둔
         자리입니다. 목록 밖이면 표준 수법대로 양 끝으로 돌려보냅니다 — Shift+Tab은 끝,
         Tab은 처음. (제목·패널 자체에서 그냥 Tab을 누른 경우와 결과가 같으므로 손해가 없습니다.) */
      if (at === -1) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && at === 0) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && at === focusables.length - 1) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onDismiss, panelRef]);
}

/** 오버레이 등장·퇴장 시간 — 바텀시트와 확인 모달이 같은 값을 씁니다(모션 감사 6의 「두 단」 중 위 단). */
export const OVERLAY_MS = 240;

export interface OverlayTransition<A extends unknown[]> {
  /** 들어와 있는지 — `entered ? "translate-y-0" : "translate-y-full"` 처럼 씁니다 */
  entered: boolean;
  /**
   * 닫기 — 먼저 퇴장 모션을 태우고 240ms 뒤에 원래 콜백을 부릅니다(그때 언마운트됩니다).
   * 두 번 눌러도 한 번만 나갑니다.
   */
  leave: (...args: A) => void;
}

/**
 * 전면 오버레이의 **등장·퇴장 한 벌**.
 *
 * 예전에는 시트가 240ms로 올라오기만 하고 닫을 때는 그 자리에서 사라졌습니다 —
 * 「멈춰 세웠다」가 「없던 일」처럼 되돌아가던 자리입니다(모션 감사 2).
 * 초점 복귀는 `useModalDismiss`가 언마운트 시점에 하므로, 여기서는 순서만 지켜 주면 됩니다.
 *
 * reduced-motion에서는 전역 CSS가 모션을 즉시 끝내므로 기다리지 않고 곧바로 닫습니다.
 */
export function useOverlayTransition<A extends unknown[]>(
  onLeft: (...args: A) => void,
  durationMs: number = OVERLAY_MS,
): OverlayTransition<A> {
  const [entered, setEntered] = useState(false);
  const leavingRef = useRef(false);
  const timerRef = useRef<number | undefined>(undefined);
  const onLeftRef = useRef(onLeft);

  useEffect(() => {
    onLeftRef.current = onLeft;
  });

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setEntered(true));
    return () => {
      window.cancelAnimationFrame(frame);
      if (timerRef.current !== undefined) window.clearTimeout(timerRef.current);
    };
  }, []);

  const leave = useCallback(
    (...args: A) => {
      if (leavingRef.current) return;
      leavingRef.current = true;
      setEntered(false);
      const reduced =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) {
        onLeftRef.current(...args);
        return;
      }
      timerRef.current = window.setTimeout(() => onLeftRef.current(...args), durationMs);
    },
    [durationMs],
  );

  return { entered, leave };
}

export default useModalDismiss;
