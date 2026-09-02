"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { cx } from "@/components";

/**
 * 하단 탭바 **위에** 도킹하는 자리.
 *
 * 높이는 여기서 계산하지 않습니다 — `TabBar`가 마운트 뒤 자기 `offsetHeight`를
 * `--chim-tabbar-h`에 적고, 이 바는 그 값을 읽기만 합니다(값 하나·주인 하나).
 *
 * 예전에는 이 자리에 61px이 리터럴로 박혀 있었고, 그 근거로 적힌 계산이 두 군데 틀렸습니다 —
 * 링크 하한은 48px이 아니라 `min-h-[54px]`이고, `pt-1`·`pb-2`는 px가 아니라 rem(0.25rem 배수)이라
 * 「전부 px 고정값」이 아니었습니다. 실제 값은 기본 16px 루트에서 1+4+54+8 = **67px**이고,
 * 「아주 크게」(125%)에서는 링크 내용이 min-h 바닥을 넘겨 **76px**까지 자랍니다. 그래서 도킹 바
 * 하단이 6~15px씩 탭바에 가려져 있었습니다(페르소나 FE med — 1차 지적이 2차까지 생존한 자리).
 *
 * safe-area는 탭바가 자기 padding으로 따로 먹으므로 여기서 한 번 더 더해 줍니다.
 * 탭바는 어느 폭에서도 서므로 이 오프셋도 한 값입니다. 기본값 67px은 탭바가 아직 값을 적기 전
 * (첫 페인트) 한 프레임 동안만 쓰이고, `globals.css`의 `:root` 선언과 같은 수입니다.
 */
const DOCK_POSITION = "sticky bottom-[calc(var(--chim-tabbar-h,67px)_+_var(--chim-safe-b))]";

export interface StickyCtaBarProps {
  children: ReactNode;
  className?: string;
  /** 1단계 입력 뒤에는 편집 중에도 계속 보이도록 앱 프레임 하단에 고정합니다. */
  fixed?: boolean;
}

/**
 * 위저드 2·3단계의 전진 CTA를 화면 아래에 도킹하는 바 (엔딩 패널·⚑CF 시트와 같은 문법).
 *
 * 「탈출구는 언제나 화면 안에」가 이 앱의 규칙인데 위저드만 예외였습니다 —
 * 390×844에서 2단계 「확인으로 넘어가기」가 y=1452(페이지 1753px), 3단계 「이대로 확정하기」가
 * y=1578(1879px)이라 화면 1.7개를 내려야 닿았습니다(평가 UI/UX mi72).
 *
 * **이 바 아래에는 반드시 흐르는 내용이 남아 있어야 합니다.** sticky 요소는 부모의
 * 패딩 박스 안에서만 움직이므로, 마지막 자식으로 두면 움직일 자리가 0이 되어 붙지 않습니다.
 * 두 단계 모두 `PrivacyPath`(이 보고가 지나가는 길)를 바 아래로 내려 그 자리를 만들었습니다.
 */
export function StickyCtaBar({ children, className, fixed = false }: StickyCtaBarProps) {
  const barRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!fixed) return undefined;
    const node = barRef.current;
    if (!node) return undefined;

    const root = document.documentElement;
    const updateHeight = (): void => {
      root.style.setProperty("--chim-report-cta-h", `${Math.ceil(node.offsetHeight)}px`);
    };

    updateHeight();
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateHeight);
    observer?.observe(node);
    window.addEventListener("resize", updateHeight);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateHeight);
      root.style.removeProperty("--chim-report-cta-h");
    };
  }, [fixed]);

  return (
    <div
      ref={barRef}
      className={cx(
        fixed
          ? "fixed bottom-[calc(var(--chim-tabbar-h,67px)_+_var(--chim-safe-b))] left-1/2 z-20 w-[min(100vw,var(--chim-frame-w))] -translate-x-1/2 px-[var(--chim-pad-x)]"
          : DOCK_POSITION,
        fixed
          ? "border-t border-line bg-paper pt-3.5 pb-3.5"
          : "z-10 mt-5 border-t border-line bg-paper pt-3.5 pb-3.5",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * 「이 블록을 지나셨는지」를 한 번만 기록합니다.
 *
 * 반환한 ref를 **지나야 하는 블록의 끝**에 놓으면, 그 끝이 실제로 눈에 닿은 순간 `passed`가
 * true가 되고 다시는 false로 돌아가지 않습니다. 도킹한 CTA는 그전까지 보조 색으로 물러서 있다가
 * 이때 주 색이 됩니다 — 버튼을 잠그지는 않습니다(언제든 누를 수 있습니다).
 *
 * 아래 30%를 관측 영역에서 뺀 것은 그 자리를 도킹 바와 탭바가 가리고 있기 때문입니다
 * (390×844에서 둘이 합쳐 약 200px). 그래서 블록이 짧아 첫 화면에 통째로 들어오는 경우에는
 * 마운트 즉시 true가 됩니다 — 스크롤할 것이 없으니 이미 다 보신 것이 맞습니다.
 */
export function usePassedBlock(): {
  markerRef: RefObject<HTMLDivElement | null>;
  passed: boolean;
} {
  const markerRef = useRef<HTMLDivElement | null>(null);
  const [passed, setPassed] = useState(false);

  useEffect(() => {
    const node = markerRef.current;
    if (!node) return undefined;
    if (typeof IntersectionObserver === "undefined") {
      // 관측을 못 하는 환경에서는 색으로 물러서 있지 않습니다 — 판단할 근거가 없으니까요.
      setPassed(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setPassed(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -30% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { markerRef, passed };
}

export default StickyCtaBar;
