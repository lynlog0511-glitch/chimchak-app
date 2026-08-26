"use client";

import { useEffect, useState } from "react";
import { EyebrowLabel, cx } from "@/components";

/**
 * 홈 화면 추가 안내 — `/emergency` 목록 아래 한 블록.
 *
 * 응급 안내는 **찾는 데 걸리는 시간**이 곧 성능입니다. 브라우저를 열고 주소를 치는 경로가 남아 있으면
 * 오프라인 저장이 아무리 잘 돼 있어도 그 몇 초가 그대로 남습니다. 홈 화면에 아이콘이 있으면
 * 한 번에 열립니다(매니페스트에 「응급 음성 안내」 바로가기도 함께 들어 있습니다).
 *
 * 브라우저마다 추가하는 길이 다르므로 **지금 이 기기에서 실제로 되는 길만** 적습니다.
 *  - 설치 프롬프트를 잡았으면(크로미엄 계열) 버튼 하나.
 *  - iOS 사파리는 프롬프트가 없으므로 공유 → 「홈 화면에 추가」 두 단계를 글로 적습니다.
 *  - 이미 홈 화면에서 열었거나 어느 쪽도 아니면 아무것도 그리지 않습니다 —
 *    안 되는 길을 적어 두면 그 자체가 틀린 안내가 됩니다.
 *
 * 서버 렌더와 수화 결과를 맞추기 위해 마운트 전에는 항상 `null`을 반환합니다.
 */

/** 크로미엄 계열의 설치 프롬프트 이벤트 — 표준 타입 정의에는 아직 없습니다. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Route = "none" | "prompt" | "ios";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  if (iosStandalone === true) return true;
  return window.matchMedia?.("(display-mode: standalone)").matches === true;
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // 아이패드는 사파리 UA가 Macintosh로 나오므로 터치 지점 수로 갈라냅니다.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export function InstallHint({ className }: { className?: string }) {
  const [route, setRoute] = useState<Route>("none");
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone()) return undefined;
    if (isIos()) setRoute("ios");

    const onPrompt = (event: Event): void => {
      // 기본 배너를 막고 우리가 고른 자리에서 같은 프롬프트를 엽니다.
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
      setRoute("prompt");
    };
    const onInstalled = (): void => {
      setPromptEvent(null);
      setRoute("none");
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async (): Promise<void> => {
    const event = promptEvent;
    if (!event) return;
    // 프롬프트는 한 번만 쓸 수 있습니다 — 추가하셨든 아니든 이 블록은 조용히 접습니다.
    setPromptEvent(null);
    setRoute("none");
    try {
      await event.prompt();
      await event.userChoice;
    } catch {
      /* 브라우저가 프롬프트를 거절한 경우 — 화면은 이미 접혔습니다 */
    }
  };

  if (route === "none") return null;

  return (
    <div className={cx("rounded-card bg-paper-2 px-4 py-[14px]", className)}>
      <EyebrowLabel>홈 화면에 추가</EyebrowLabel>
      <p className="mt-[6px] text-[0.9375rem] leading-[1.6] font-bold text-ink">
        아이콘 하나로 이 안내를 엽니다
      </p>
      <p className="mt-[6px] text-[0.8438rem] leading-[1.6] text-ink-soft">
        홈 화면에 추가해 두시면 브라우저에서 주소를 찾지 않고 바로 열립니다. 앱 장터를 거치지 않고,
        이 기기에 저장된 안내를 그대로 씁니다.
      </p>

      {route === "prompt" ? (
        <>
          <button
            type="button"
            onClick={() => void install()}
            className="mt-3 flex min-h-[48px] w-full items-center justify-center rounded-card bg-paper-2 px-5 text-[1.0625rem] font-semibold text-ink transition-colors duration-150 active:bg-neutral-line"
          >
            홈 화면에 추가
          </button>
          <p className="mt-[8px] text-[0.7813rem] leading-[1.6] text-ink-muted">
            누르면 브라우저가 추가 여부를 한 번 더 묻습니다. 기기에 따라, 추가한 아이콘을 길게
            누르면 「응급 음성 안내」 바로가기가 함께 나옵니다.
          </p>
        </>
      ) : (
        <ol className="mt-3 space-y-[6px] text-[0.8438rem] leading-[1.6] text-ink">
          <li>
            <span className="chim-num mr-[6px] font-bold text-brand-800">1</span>
            사파리의 공유 버튼을 누릅니다.
          </li>
          <li>
            <span className="chim-num mr-[6px] font-bold text-brand-800">2</span>
            목록에서 「홈 화면에 추가」를 고릅니다.
          </li>
        </ol>
      )}
    </div>
  );
}

export default InstallHint;
