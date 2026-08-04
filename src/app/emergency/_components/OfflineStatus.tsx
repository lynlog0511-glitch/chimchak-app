"use client";

import { useEffect, useState } from "react";

type NetState = "unknown" | "online" | "offline";

/**
 * 현재 네트워크 상태 + 기기 저장(서비스워커 등록) 상태 안내.
 *
 * 응급 화면은 서비스워커가 기기에 저장해 둘 때에만 연결이 끊겨도 열립니다.
 * 그래서 "저장해 두었습니다"라고 단정하지 않고, **등록 여부를 실제로 확인한 뒤** 문구를 고릅니다.
 * (개발 서버에서는 서비스워커를 등록하지 않으므로 이때는 사실대로 안내합니다.)
 * 서버 렌더링 시점에는 알 수 없으므로 마운트 이후에만 그립니다(수화 불일치 방지).
 */
export function OfflineStatus() {
  const [state, setState] = useState<NetState>("unknown");
  const [cached, setCached] = useState<boolean | null>(null);

  useEffect(() => {
    const update = (): void => {
      setState(navigator.onLine ? "online" : "offline");
    };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      setCached(false);
      return;
    }
    void navigator.serviceWorker
      .getRegistration()
      .then((registration) => {
        if (alive) setCached(Boolean(registration?.active));
      })
      .catch(() => {
        if (alive) setCached(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (state === "unknown" || cached === null) return null;

  const offline = state === "offline";
  const message = offline
    ? cached
      ? "지금 네트워크가 끊겨 있습니다. 이 화면과 응급 안내 5종은 기기에 저장되어 있어 그대로 사용하실 수 있습니다."
      : "지금 네트워크가 끊겨 있습니다. 이 화면은 이미 열려 있어 그대로 보실 수 있지만, 기기 저장은 아직 준비되지 않았습니다."
    : cached
      ? "네트워크에 연결되어 있습니다. 응급 안내 5종이 이 기기에 저장되어 있어, 연결이 끊겨도 이 화면은 열립니다."
      : "네트워크에 연결되어 있습니다. 기기 저장은 아직 준비되지 않았습니다 — 응급 안내 5종을 한 번씩 열어 두시면 연결이 끊겨도 열립니다.";

  return (
    <p
      role="status"
      className={
        offline || !cached
          ? "flex items-start gap-2 rounded-card border border-warn-line bg-warn-soft px-4 py-3 text-base leading-relaxed font-bold text-warn-ink"
          : "flex items-start gap-2 rounded-card border border-line bg-white px-4 py-3 text-base leading-relaxed text-ink-soft"
      }
    >
      <span aria-hidden="true">{offline ? "📴" : cached ? "📶" : "⏳"}</span>
      <span>{message}</span>
    </p>
  );
}

export default OfflineStatus;
