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

   잠금은 **문서 하나에 한 벌**입니다. 오버레이가 겹쳐 뜰 수 있으므로(세션 헤더의 설정 팝오버를
   열어 둔 채 ⚑CF가 뜨는 경우) 참조 수를 세고, 마지막 하나가 닫힐 때만 원래 값으로 되돌립니다.
   데스크톱에서 스크롤바가 사라지며 생기는 가로 흔들림은 그 폭만큼 padding으로 메웁니다
   (모바일의 오버레이 스크롤바에서는 폭이 0이라 아무 일도 하지 않습니다). */
let lockCount = 0;
let savedOverflow = "";
let savedPaddingRight = "";
let savedScrollY = 0;

function lockBodyScroll(): () => void {
  if (typeof document === "undefined") return () => {};
  if (lockCount === 0) {
    const body = document.body;
    savedOverflow = body.style.overflow;
    savedPaddingRight = body.style.paddingRight;
    savedScrollY = window.scrollY;
    const gutter = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
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
    body.style.overflow = savedOverflow;
    body.style.paddingRight = savedPaddingRight;
    /* 잠그는 동안 브라우저가 스크롤 위치를 흘렸을 때만 되돌립니다.
       (`behavior: "auto"`를 명시해 html의 smooth 스크롤을 타지 않게 합니다.) */
    if (window.scrollY !== savedScrollY) window.scrollTo({ top: savedScrollY, behavior: "auto" });
  };
}

/**
 * 전면 시트·모달의 규칙 한 벌 — **마운트 초점 · Esc 닫기 · Tab 가두기 · 배경 스크롤 잠금**.
 *
 * ⚑CF 바텀시트에만 있던 것을 훅으로 빼 둡니다. 같은 화면 안에서 모달 문법이
 * 두 종류로 갈리면(초점이 배경에 남고 Esc가 듣지 않는 모달) 키보드·스크린리더 사용자가
 * 모달 밖을 조작하게 됩니다 — 평가 UI/UX m5 실측에서 「종료」 확인 모달이 그 상태였습니다.
 *
 * 배경을 `aria-hidden`으로 덮는 것은 여는 쪽 화면의 몫입니다(이 훅은 초점과 스크롤만 다룹니다).
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
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        onDismiss();
        return;
      }
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(FOCUSABLE);
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
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
