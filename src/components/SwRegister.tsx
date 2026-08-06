"use client";

import { useEffect } from "react";

/**
 * 서비스워커 등록 컴포넌트.
 *
 * `public/sw.js`를 등록해 응급 화면(`/emergency`, `/emergency/p-01`~`p-05`)을
 * 기기에 저장해 둡니다. 서버가 죽거나 네트워크가 끊겨도 그 화면들은 그대로 열립니다.
 *
 * 원칙
 * - **프로덕션 빌드에서만** 등록합니다. 개발 서버에서는 HMR과 캐시가 충돌해 화면이 낡은 채로
 *   남을 수 있어 일부러 건너뜁니다.
 *   → 그래서 오프라인 동작을 시연하실 때는 반드시 `npm run build && npm run start` 로 띄우셔야 합니다.
 *     `npm run dev` 로 띄우면 서비스워커가 없어 네트워크를 끊었을 때 화면이 열리지 않습니다.
 *     (응급 화면의 안내 문구는 등록 여부를 실제로 확인해 사실대로 표시합니다 — OfflineStatus.tsx)
 * - 미지원 브라우저·차단된 환경(사생활 보호 모드 등)에서는 조용히 통과합니다.
 *   등록 실패는 무시하며, 데모 중 콘솔 에러가 남지 않게 합니다.
 * - 첫 화면 렌더링과 경쟁하지 않도록 `load` 이후에 등록합니다.
 * - 저장이 끝나면 `SW_READY_EVENT` 를 창에 알립니다. 응급 화면의 안내 배지가
 *   새로고침 없이 "저장 완료"로 바뀌도록 하기 위한 신호입니다.
 * - 화면에 그리는 것은 없습니다(항상 null 반환).
 */

/** 서비스워커 저장이 끝났음을 알리는 창 이벤트 이름입니다. */
export const SW_READY_EVENT = "chimchak:sw-ready";

/**
 * 새 버전이 넘겨받은 뒤에도 **다시 읽지 않을** 화면입니다.
 *
 * 응급 프로토콜과 훈련 진행은 사람이 한 번에 끝까지 가는 흐름입니다. 그 도중에 화면을 새로
 * 읽으면 재생 중이던 음성이 끊기고 진행 단계가 처음으로 돌아갑니다 —
 * 배포 한 번 때문에 낙상 대응 안내를 듣던 사람이 1단계로 튕기는 일은 없어야 합니다.
 *
 * 새로고침을 건너뛰어도 손해가 없습니다. `controllerchange` 시점에는 이미 새 서비스워커가
 * 이 문서를 맡고 있어서, **다음 화면 이동부터 새 자산이 나갑니다.**
 * 지금 문서는 이미 메모리에 올라온 청크로 끝까지 멀쩡히 돕니다.
 */
const NO_RELOAD_PATHS = [/^\/emergency\/p-/, /^\/train\/[^/]+/];

function isInterruptionSensitive(pathname: string): boolean {
  return NO_RELOAD_PATHS.some((pattern) => pattern.test(pathname));
}

export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    let done = false;
    /** 새로고침은 딱 한 번만 — 반복 새로고침 고리를 원천 차단합니다. */
    let reloaded = false;
    /**
     * 이 문서를 이미 맡고 있던 서비스워커가 있었는지.
     *
     * 처음 설치될 때도 `controllerchange`는 한 번 뜹니다(sw.js가 skipWaiting·clients.claim을
     * 부르므로). 그때 새로고침하면 첫 방문자가 이유 없이 화면이 한 번 깜빡이는 것을 봅니다.
     * **이미 맡고 있던 워커가 있었을 때만** = 진짜 갱신일 때만 다시 읽습니다.
     */
    const hadController = Boolean(navigator.serviceWorker.controller);
    /**
     * 새 워커가 실제로 설치되는 것을 이 탭에서 두 눈으로 봤는지.
     *
     * `controllerchange`는 새 버전 말고도 뜹니다 — 다른 탭이 등록을 지웠다가 다시 걸거나,
     * 브라우저가 워커를 재기동해도 올라옵니다. 그때까지 새로고침하면 사용자는
     * 이유를 알 수 없는 깜빡임을 봅니다. 그래서 `updatefound`로 **새 워커가 설치되는 것을
     * 확인한 경우에만** 새로고침을 허락합니다.
     */
    let sawNewWorker = false;

    const onControllerChange = (): void => {
      if (reloaded || !hadController || !sawNewWorker) return;
      if (isInterruptionSensitive(window.location.pathname)) return;
      reloaded = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const register = (): void => {
      if (done) return;
      done = true;
      try {
        void navigator.serviceWorker
          .register("/sw.js", { scope: "/" })
          .then((registration) => {
            // 새 버전이 내려오기 시작하는 순간입니다.
            // sw.js가 install 끝에 skipWaiting()을 부르므로 설치가 끝나면 곧바로
            // activate → controllerchange 로 이어지고, 위 핸들러가 한 번만 새로고침합니다.
            registration.addEventListener("updatefound", () => {
              if (registration.installing) sawNewWorker = true;
            });

            return navigator.serviceWorker.ready.then(() => {
              // 저장이 끝난 시점을 화면에 알립니다(응급 화면 배지가 사실대로 바뀝니다).
              window.dispatchEvent(new Event(SW_READY_EVENT));
            });
          })
          .catch(() => undefined);
      } catch {
        /* 등록 실패는 무시합니다 — 앱 동작에는 영향이 없습니다. */
      }
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }

    return () => {
      window.removeEventListener("load", register);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  return null;
}

export default SwRegister;
