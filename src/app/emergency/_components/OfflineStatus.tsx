"use client";

import { useCallback, useEffect, useState } from "react";
import { IconClock, IconOffline, IconSave } from "@/components/icons";
import { SW_READY_EVENT } from "@/components/SwRegister";
import {
  PROTOCOL_OFFLINE_PENDING_NOTICE,
  PROTOCOL_OFFLINE_READY_NOTICE,
} from "@/data/protocols";

type NetState = "unknown" | "online" | "offline";

/** 연결이 끊겨도 열려야 하는 화면 목록입니다. `public/sw.js` 의 precache 목록과 같습니다. */
const OFFLINE_ROUTES = [
  "/emergency",
  "/emergency/p-01",
  "/emergency/p-02",
  "/emergency/p-03",
  "/emergency/p-04",
  "/emergency/p-05",
];

/**
 * 기기 저장(서비스워커 등록 + 응급 5종 캐시)이 **실제로** 끝났는지 확인합니다.
 * 등록만 되고 캐시가 비어 있으면 "저장 완료"라고 말할 수 없으므로 둘 다 확인합니다.
 */
async function measureOfflineReady(): Promise<boolean> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;
  if (typeof caches === "undefined") return false;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration?.active) return false;

    const hits = await Promise.all(
      OFFLINE_ROUTES.map((url) =>
        caches
          .match(url, { ignoreSearch: true })
          .then((hit) => Boolean(hit))
          .catch(() => false),
      ),
    );
    return hits.every(Boolean);
  } catch {
    return false;
  }
}

/**
 * 응급 화면의 오프라인 안내 — **이 화면에 하나만 뜨는 배지**입니다.
 *
 * 예전에는 "서버가 죽어도 열립니다"라는 정적 초록 배지와 "기기 저장은 아직 준비되지
 * 않았습니다"라는 주황 경고가 같이 떠서 화면이 서로 반대말을 했습니다. 그래서 지금은
 * 서비스워커 등록과 응급 5종 캐시를 **실측한 뒤** 둘 중 하나만 표시합니다.
 *
 * - 저장 완료 → 초록 확인 문구 (이때만 "연결이 끊겨도 열립니다"라고 말합니다)
 * - 미등록·저장 전 → 주황 안내 하나만 (초록 배지는 아예 뜨지 않습니다)
 *
 * 서버 렌더링 시점에는 알 수 없으므로 마운트 이후에만 그립니다(수화 불일치 방지).
 */
export function OfflineStatus() {
  const [state, setState] = useState<NetState>("unknown");
  const [ready, setReady] = useState<boolean | null>(null);

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

  const measure = useCallback((alive: { current: boolean }) => {
    void measureOfflineReady().then((value) => {
      if (alive.current) setReady(value);
    });
  }, []);

  useEffect(() => {
    const alive = { current: true };
    const run = (): void => measure(alive);

    run();

    // 저장이 끝나는 순간을 놓치지 않도록, 등록 완료 신호에도 다시 확인합니다.
    window.addEventListener(SW_READY_EVENT, run);
    const sw = typeof navigator !== "undefined" ? navigator.serviceWorker : undefined;
    sw?.addEventListener("controllerchange", run);

    return () => {
      alive.current = false;
      window.removeEventListener(SW_READY_EVENT, run);
      sw?.removeEventListener("controllerchange", run);
    };
  }, [measure]);

  if (state === "unknown" || ready === null) return null;

  const offline = state === "offline";

  if (ready) {
    return (
      <p
        role="status"
        className="flex items-start gap-2.5 rounded-card border border-ok-line bg-ok-soft px-4 py-3 text-base leading-relaxed font-extrabold text-ok-ink md:text-lg"
      >
        {offline ? (
          <IconOffline className="mt-1 h-5 w-5 shrink-0" />
        ) : (
          <IconSave className="mt-1 h-5 w-5 shrink-0" />
        )}
        <span>
          {offline
            ? "지금 네트워크가 끊겨 있습니다. 응급 안내 5종은 이 기기에 저장되어 있어 그대로 사용하실 수 있습니다."
            : PROTOCOL_OFFLINE_READY_NOTICE}
        </span>
      </p>
    );
  }

  return (
    <p
      role="status"
      className="flex items-start gap-2.5 rounded-card border border-warn-line bg-warn-soft px-4 py-3 text-base leading-relaxed font-bold text-warn-ink"
    >
      {offline ? (
        <IconOffline className="mt-1 h-5 w-5 shrink-0" />
      ) : (
        <IconClock className="mt-1 h-5 w-5 shrink-0" />
      )}
      <span>
        {offline
          ? "지금 네트워크가 끊겨 있습니다. 이 화면은 이미 열려 있어 그대로 보실 수 있지만, 기기 저장은 아직 준비되지 않았습니다."
          : PROTOCOL_OFFLINE_PENDING_NOTICE}
      </span>
    </p>
  );
}

export default OfflineStatus;
