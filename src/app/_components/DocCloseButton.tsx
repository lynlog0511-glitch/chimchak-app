"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export interface DocCloseButtonProps {
  /**
   * 돌아갈 이력이 없을 때 갈 곳 — 각 화면이 지금 쓰고 있는 하드코딩 목적지 그대로입니다
   * (`/guide` → `/`, `/legal` → `/guide`). 링크를 직접 열었거나 새 탭으로 들어오신 경우입니다.
   */
  fallbackHref: string;
  className?: string;
}

/**
 * 문서 화면(`/guide`·`/legal`)의 「닫기」 — **왔던 곳으로** 돌아갑니다.
 *
 * 왜 고쳤는가. 「닫기」는 사용자 사전에서 「왔던 곳으로 돌아간다」입니다. 그런데 두 화면의
 * 닫기는 실제 진입 경로가 아니라 하드코딩된 상위로 갔습니다 — 홈 하단에서 「약관·개인정보」로
 * 곧장 들어온 분이 닫기를 누르면 가 본 적 없는 /guide에 떨어집니다. 탭바도 없는 화면이라
 * 그 순간 앱 안에서 자기 위치를 잃습니다(페르소나 UI/UX med).
 *
 * 그래서 이력이 있으면 `router.back()`, 없으면 지금까지의 목적지로 갑니다.
 * 이력 유무는 서버가 알 수 없으므로 마운트 뒤에 한 번만 재고, 재기 전에는 폴백 쪽으로 둡니다 —
 * 「모르는 동안에는 지금까지 하던 대로」가 이 화면들의 기존 동작과 같습니다.
 *
 * 앵커(`/guide#…`)로 들어오신 경우에도 앞 화면이 있으면 그 화면으로 돌아갑니다.
 */
export function DocCloseButton({ fallbackHref, className }: DocCloseButtonProps) {
  const router = useRouter();
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    /* history.length는 새 탭에서도 1이 아닐 수 있어(리다이렉트 등) 단독으로는 못 믿습니다.
       앱 안에서 넘어온 경우에는 Next가 히스토리를 쌓으므로 length가 늘고, 링크를 직접 열면
       같은 출처의 referrer가 없습니다 — 둘 다 맞을 때만 뒤로 갑니다. */
    const sameOrigin =
      typeof document !== "undefined" &&
      document.referrer.length > 0 &&
      document.referrer.startsWith(window.location.origin);
    setCanGoBack(window.history.length > 1 && sameOrigin);
  }, []);

  return (
    <button
      type="button"
      onClick={() => {
        if (canGoBack) router.back();
        else router.push(fallbackHref);
      }}
      className={className}
    >
      닫기
    </button>
  );
}

export default DocCloseButton;
