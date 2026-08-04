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

export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    let done = false;

    const register = (): void => {
      if (done) return;
      done = true;
      try {
        void navigator.serviceWorker
          .register("/sw.js", { scope: "/" })
          .then(() =>
            navigator.serviceWorker.ready.then(() => {
              // 저장이 끝난 시점을 화면에 알립니다(응급 화면 배지가 사실대로 바뀝니다).
              window.dispatchEvent(new Event(SW_READY_EVENT));
            }),
          )
          .catch(() => undefined);
      } catch {
        /* 등록 실패는 무시합니다 — 앱 동작에는 영향이 없습니다. */
      }
    };

    if (document.readyState === "complete") {
      register();
      return;
    }

    window.addEventListener("load", register, { once: true });
    return () => {
      window.removeEventListener("load", register);
    };
  }, []);

  return null;
}

export default SwRegister;
