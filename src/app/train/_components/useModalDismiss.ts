"use client";

import { useEffect, type RefObject } from "react";

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

/**
 * 전면 시트·모달의 초점 규칙 한 벌 — **마운트 초점 · Esc 닫기 · Tab 가두기**.
 *
 * ⚑CF 바텀시트에만 있던 세 가지를 훅으로 빼 둡니다. 같은 화면 안에서 모달 문법이
 * 두 종류로 갈리면(초점이 배경에 남고 Esc가 듣지 않는 모달) 키보드·스크린리더 사용자가
 * 모달 밖을 조작하게 됩니다 — 평가 UI/UX m5 실측에서 「종료」 확인 모달이 그 상태였습니다.
 *
 * 배경을 `aria-hidden`으로 덮는 것은 여는 쪽 화면의 몫입니다(이 훅은 초점만 다룹니다).
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

export default useModalDismiss;
