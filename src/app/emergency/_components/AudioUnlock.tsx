"use client";

import { useEffect } from "react";
import { unlockAudio } from "@/lib/speech";

/**
 * 이 화면에서 처음 누르시는 순간, 오디오 요소의 재생 잠금을 풀어 둡니다. 화면에는 아무것도 그리지 않습니다.
 *
 * 왜 목록 화면에서 미리 푸는가: 웹킷(아이폰 사파리)은 자동재생 제한을 **미디어 요소 단위**로,
 * 그것도 **사용자 제스처 안에서 play()가 불린 요소**에만 풉니다. 재생기 화면(`/emergency/[id]`)은
 * 열리자마자 1단계를 스스로 읽기 시작하는데, 그 시점에는 누르신 손가락이 이미 떠난 뒤입니다.
 * 목록에서 프로토콜을 고르시는 그 탭이 이 동선의 **확실한 첫 제스처**이므로, 여기서 풀어 두면
 * 다음 화면의 첫 문장이 검수된 목소리 그대로 나옵니다.
 *
 * 이미 풀렸거나 소리가 나는 중이면 `unlockAudio()`가 즉시 물러나므로, 재생을 방해하지 않습니다.
 * 실패해도 화면은 그대로 갑니다 — 재생기에는 「눌러서 소리 시작」과 자막 자동 진행이 남아 있습니다.
 */
export function AudioUnlock() {
  useEffect(() => {
    const unlock = (): void => unlockAudio();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  return null;
}

export default AudioUnlock;
