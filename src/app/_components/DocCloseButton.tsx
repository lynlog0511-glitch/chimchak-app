"use client";

import { useRouter } from "next/navigation";
import { hasNavigatedWithinApp } from "@/components/RouteFocus";

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
 * 왜 있는가. 「닫기」는 사용자 사전에서 「왔던 곳으로 돌아간다」입니다. 그런데 두 화면의
 * 닫기는 실제 진입 경로가 아니라 하드코딩된 상위로 갔습니다 — 홈 하단에서 「약관·개인정보」로
 * 곧장 들어온 분이 닫기를 누르면 가 본 적 없는 /guide에 떨어집니다. 탭바도 없는 화면이라
 * 그 순간 앱 안에서 자기 위치를 잃습니다(페르소나 UI/UX med).
 *
 * ## 판정은 「앱 안에서 옮겨 왔는가」 하나입니다
 *
 * 이 판정이 `document.referrer`였던 동안에는 고치려던 그 버그가 **주 배포 형태에서만**
 * 그대로 재현됐습니다(페르소나 FE med — 우리 수정이 만든 회귀). referrer는 문서 로드 시점에만
 * 정해지고 소프트 내비게이션으로는 갱신되지 않아서, PWA 홈 화면 실행처럼 referrer가 빈 세션에서는
 * `canGoBack`이 영원히 거짓이었습니다. `history.length`도 단독으로는 못 믿습니다 —
 * 리다이렉트·새 탭에서도 1이 아닐 수 있습니다.
 *
 * 그래서 앱이 자기 이동을 직접 셉니다(`RouteFocus`의 `hasNavigatedWithinApp`). 값이 참이면
 * **이 문서에 앱 안에서 들어온 것이 확실하므로** `router.back()`이 반드시 앱 안 화면으로
 * 돌아갑니다. 거짓이면 이 문서가 세션의 첫 화면이므로 지금까지의 목적지로 갑니다.
 * 새 저장 키도, 새 표식도 만들지 않습니다.
 *
 * 판정 시점은 **누르는 순간**입니다. 마운트 때 재서 상태에 담아 두면 「아직 모르는 동안」이라는
 * 구간이 생기고, 그 구간의 답이 폴백이라 빠른 손가락에서만 틀립니다. 누르는 시점에는 언제나
 * 답이 확정되어 있습니다.
 *
 * ## 수동 검증 절차 (컴포넌트 테스트가 없는 저장소라 절차로 남깁니다)
 *
 * 1. 홈 화면에 설치한 PWA(또는 새 탭에 주소 직접 입력)로 `/legal`을 곧장 엽니다 →
 *    「닫기」 → `/guide`로 갑니다(폴백). 예전에는 이 경로만 됐습니다.
 * 2. 같은 PWA에서 홈(`/`)을 열고 하단 「약관·개인정보」로 `/legal`에 들어갑니다 →
 *    「닫기」 → **홈으로 돌아갑니다**. 예전에는 여기서 /guide로 떨어졌습니다.
 * 3. 홈 → `/guide` → 본문 링크로 `/legal` → 「닫기」 → `/guide`(왔던 곳).
 *
 * 남는 경계 하나: 직접 진입한 뒤 앱 안을 한 바퀴 돌아 **브라우저 뒤로**로 이 문서에 되돌아온
 * 경우입니다. 그때는 이동 횟수가 이미 0보다 커서 `back()`이 앱 밖으로 나갈 수 있습니다.
 * 이 자리에서 사실과 다른 답을 하지 않으려면 이력 스택 자체를 읽어야 하는데, 브라우저는
 * 그 열람을 허용하지 않습니다 — 흔한 경로가 아니라 여기까지를 선으로 둡니다.
 */
export function DocCloseButton({ fallbackHref, className }: DocCloseButtonProps) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (hasNavigatedWithinApp()) router.back();
        else router.push(fallbackHref);
      }}
      className={className}
    >
      닫기
    </button>
  );
}

export default DocCloseButton;
