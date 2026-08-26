"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * 앱 안에서 화면을 옮긴 횟수 — **모듈 변수 하나**입니다(저장 키를 새로 만들지 않습니다).
 *
 * 문서가 새로 로드되면 0으로 시작합니다. 그 사실이 정확히 우리가 알고 싶은 것입니다 —
 * 「이 문서는 앱 안에서 열렸는가, 아니면 주소·홈 화면 아이콘으로 곧장 열렸는가」.
 * `DocCloseButton`의 「닫기」가 이 값으로 뒤로 갈지 폴백으로 갈지를 가릅니다.
 *
 * 왜 `document.referrer`가 아닌가: referrer는 **문서 로드 시점에만** 정해지고 App Router의
 * 소프트 내비게이션으로는 갱신되지 않습니다. PWA 홈 화면 실행에서는 세션 내내 빈 문자열이라,
 * 그 판정에 기대면 이 제품의 **주 배포 형태에서만** 「닫기」가 무력해집니다(페르소나 FE med).
 * 앱 안 이동은 앱이 직접 세는 것이 가장 짧고 확실한 사실입니다.
 */
let inAppNavigations = 0;

/** 이 문서가 열린 뒤 앱 안에서 화면을 한 번이라도 옮겼는가. */
export function hasNavigatedWithinApp(): boolean {
  return inAppNavigations > 0;
}

/**
 * 화면 **사이**의 초점 — 라우트가 바뀌면 새 화면의 h1로 초점을 옮깁니다.
 *
 * 이 앱은 화면 **안**의 초점 관리가 촘촘합니다(위저드 단계 전환·턴 교대·오버레이 여닫기 모두
 * 초점을 옮기고 되돌립니다). 그런데 화면 사이만 비어 있어서, 라우트를 하나 넘을 때마다
 * 그 정성이 초기화되고 `activeElement`가 BODY로 떨어졌습니다(페르소나 UI/UX 실측).
 * 키보드로 쓰시는 분은 이동할 때마다 「본문으로 건너뛰기」부터 다시 눌러야 했습니다.
 *
 * ## 화면 제목 공지는 왜 여기서 하지 않는가
 *
 * **프레임워크가 이미 하고 있기 때문입니다.** Next App Router는 라우트가 바뀔 때마다
 * `document.title`을 shadow DOM 안 `role="alert" aria-live="assertive"` 노드에 넣습니다
 * (`next/dist/client/components/app-router-announcer.js` — 이 저장소의 빌드 산출물
 * `.next/static/chunks/main-*.js`에도 `next-route-announcer`로 실려 있는 것을 확인했습니다).
 * 여기서 같은 제목을 `aria-live="polite"`로 한 번 더 넣으면 보조기기 사용자에게는 같은 문장이
 * 두 번 들립니다 — 이번 라운드에서 함께 줄이고 있는 「라이브 리전 중복」을 우리 손으로 하나 더
 * 만드는 셈입니다. 그래서 **비어 있던 절반(초점)만** 채웁니다.
 * 프레임워크가 이 동작을 거두는 날에는 여기에 sr-only 리전 하나를 더하면 됩니다.
 *
 * ## 초점 대상
 *
 * `#chim-content`(PageShell의 `main`) 안의 첫 h1입니다. 화면 제목은 `ScreenHeader`가 기본으로
 * h1으로 그리므로 거의 모든 화면에 있고, 없으면 `main` 자신으로 물러섭니다.
 * `preventScroll: true`라 초점만 옮기고 화면은 스크롤하지 않습니다 — 새 화면은 이미 맨 위에서
 * 시작하고, 여기서 한 번 더 끌면 화면이 흔들립니다(모션 최소 규율).
 */
export function RouteFocus(): null {
  const pathname = usePathname();
  /** 직전 경로 — `null`은 「아직 한 번도 안 봤다」(첫 로드)입니다. */
  const seen = useRef<string | null>(null);

  useEffect(() => {
    const path = pathname ?? "/";
    if (seen.current === null) {
      /* 첫 로드는 제외합니다 — 문서가 막 열린 자리라 초점은 브라우저 몫이고,
         스크린리더도 새 문서를 스스로 읽습니다. */
      seen.current = path;
      return undefined;
    }
    if (seen.current === path) return undefined;
    seen.current = path;
    inAppNavigations += 1;

    let raf = 0;
    const move = (retry: boolean): void => {
      const main = document.getElementById("chim-content");
      const target = main?.querySelector<HTMLElement>("h1") ?? main;
      if (!target) {
        /* 스트리밍으로 본문이 한 프레임 늦게 붙는 화면이 있습니다 — 한 번만 더 봅니다. */
        if (retry) raf = window.requestAnimationFrame(() => move(false));
        return;
      }
      /* 제목은 원래 초점을 받는 요소가 아니므로 받을 수 있게만 열어 둡니다(탭 순서에는 들어가지
         않습니다). 한 번 붙은 속성은 그대로 두어도 무해하고, 되돌아온 화면에서 다시 씁니다. */
      if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    };
    move(true);

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [pathname]);

  return null;
}

export default RouteFocus;
