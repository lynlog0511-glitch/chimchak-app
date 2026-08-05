"use client";

import { useCallback, useEffect, useState } from "react";
import { StatusDot, cx, type StatusTone } from "@/components";
import { SW_READY_EVENT } from "@/components/SwRegister";
import { PROTOCOL_OFFLINE_PENDING_NOTICE } from "@/data/protocols";

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

/** 시안 5b의 부제 문구 — 저장이 **실측으로 확인된 뒤에만** 이 문장을 씁니다. */
const READY_LINE = "기기에 저장됨 — 연결이 끊겨도 열립니다";

/** 저장은 끝났는데 지금 연결이 끊긴 경우 — 사실을 그대로 적습니다. */
const READY_OFFLINE_LINE = "지금 연결이 끊겼습니다 — 기기에 저장된 안내로 그대로 열립니다";

/** 확인 중 — 서버 렌더 시점에는 알 수 없어 자리만 잡아 둡니다(레이아웃이 튀지 않게). */
const CHECKING_LINE = "기기 저장 상태를 확인하고 있습니다";

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
 * 응급 화면 제목 아래 한 줄 — 시안 5b의 「● 기기에 저장됨 — 연결이 끊겨도 열립니다」입니다.
 *
 * 문구를 미리 단정하지 않습니다. 서비스워커 등록과 응급 5종 캐시를 **실측한 뒤**
 * 저장 완료(초록)·저장 전(주황)·확인 중(회색) 중 하나만 표시합니다.
 * 색은 옆 문장을 거들 뿐이고, 뜻은 언제나 글자가 전합니다.
 *
 * `ScreenHeader`의 `subtitle`로 넘겨 쓰도록 인라인 요소(span)만 그립니다.
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

  const checking = state === "unknown" || ready === null;
  const offline = state === "offline";

  let tone: StatusTone = "neutral";
  let text = CHECKING_LINE;
  let color = "text-ink-muted";

  if (!checking) {
    if (ready) {
      tone = "ok";
      color = "text-ok-ink";
      text = offline ? READY_OFFLINE_LINE : READY_LINE;
    } else {
      tone = "warn";
      color = "text-warn-ink";
      text = PROTOCOL_OFFLINE_PENDING_NOTICE;
    }
  }

  return (
    <span role="status" className={cx("flex items-start gap-[5px] text-[12.5px] leading-[1.5]", color)}>
      <StatusDot tone={tone} className="mt-[6px]" />
      <span>{text}</span>
    </span>
  );
}

export default OfflineStatus;
