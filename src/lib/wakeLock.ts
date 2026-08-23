import { useEffect } from "react";

type WakeLockNavigator = Navigator & {
  wakeLock?: { request(type: "screen"): Promise<WakeLockSentinel> };
};

/**
 * 화면 꺼짐 방지(Screen Wake Lock).
 * 훈련 세션·응급 안내처럼 손을 대지 않고 진행되는 화면에서만 켠다.
 * 미지원 브라우저·정책 거부 시에는 조용히 아무것도 하지 않는다(진행에 영향 없음).
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === "undefined") return;
    const nav = navigator as WakeLockNavigator;
    if (!nav.wakeLock) return;

    let sentinel: WakeLockSentinel | null = null;
    let disposed = false;

    const acquire = async () => {
      try {
        const s = await nav.wakeLock!.request("screen");
        if (disposed) {
          await s.release().catch(() => {});
          return;
        }
        sentinel = s;
      } catch {
        // 배터리 절약 모드 등으로 거부될 수 있다 — 실패해도 세션은 그대로 진행된다.
      }
    };

    // 탭 전환·잠금 해제 후 돌아오면 잠금이 풀려 있으므로 다시 잡는다.
    const onVisibility = () => {
      if (document.visibilityState === "visible") void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinel?.release().catch(() => {});
      sentinel = null;
    };
  }, [active]);
}
