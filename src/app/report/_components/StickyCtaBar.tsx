"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { cx } from "@/components";

/**
 * 하단 탭바가 차지하는 높이.
 * `TabBar`는 `pt-1(4) + 링크 min-h 48 + pb-2(8) + 헤어라인 1` = 61px이고 전부 px 고정값이라
 * 글자 크기 설정(16/18/20px)을 바꿔도 값이 변하지 않습니다. safe-area는 탭바가 자기 padding으로
 * 따로 먹으므로 여기서 한 번 더 더해 줍니다.
 * 탭바는 어느 폭에서도 서므로 이 오프셋도 한 값입니다.
 */
const DOCK_POSITION = "sticky bottom-[calc(61px_+_var(--chim-safe-b))]";

export interface StickyCtaBarProps {
  children: ReactNode;
  className?: string;
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
export function StickyCtaBar({ children, className }: StickyCtaBarProps) {
  return (
    <div
      className={cx(
        DOCK_POSITION,
        "z-10 mt-5 border-t border-line bg-paper pt-3.5 pb-3.5",
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
