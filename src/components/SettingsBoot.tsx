"use client";

import { useEffect } from "react";
import { initSettings } from "@/lib/settings";

/* 저장된 글자 크기는 화면이 그려지기 전에 적용될수록 깜빡임이 적습니다.
   v3에서는 AppHeader가 이 일을 했지만 v4에서 전역 헤더가 사라졌으므로,
   루트 레이아웃에 놓이는 이 조각이 대신 맡습니다(멱등이라 여러 번 불려도 안전합니다). */
initSettings();

/**
 * 표시 설정(글자 크기) 부팅기 — 화면에는 아무것도 그리지 않습니다.
 * `src/app/layout.tsx`에 한 번만 놓습니다.
 */
export function SettingsBoot() {
  useEffect(() => {
    initSettings();
  }, []);

  return null;
}

export default SettingsBoot;
