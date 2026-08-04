import { IconBase, type IconProps } from "./IconBase";

/* ─────────────────────────────────────────────────────────────
   동작·재생·입력 아이콘
   응급 프로토콜 재생기, 음성 입력, 다운로드 등 조작 지점에서 씁니다.
   ───────────────────────────────────────────────────────────── */

/** 마이크 */
export function IconMic({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <path d="M12 3.4a2.9 2.9 0 0 1 2.9 2.9v5.4a2.9 2.9 0 0 1-5.8 0V6.3A2.9 2.9 0 0 1 12 3.4Z" />
      <path d="M18.3 11.4a6.3 6.3 0 0 1-12.6 0" />
      <path d="M12 17.7v3" />
      <path d="M8.6 20.7h6.8" />
    </IconBase>
  );
}

/** 음성 파형 — 인식 중 표시·낭독 표시 */
export function IconWave({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <path d="M3.6 10.8v2.4" />
      <path d="M7.8 8.2v7.6" />
      <path d="M12 5.2v13.6" />
      <path d="M16.2 8.2v7.6" />
      <path d="M20.4 10.8v2.4" />
    </IconBase>
  );
}

/** 소리 켜짐 (TTS 낭독 ON) */
export function IconVolume({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <path d="M11.4 4.6 6.8 8.4H3.9a1 1 0 0 0-1 1v5.2a1 1 0 0 0 1 1h2.9l4.6 3.8V4.6Z" />
      <path d="M15.4 9.2a4 4 0 0 1 0 5.6" />
      <path d="M18.2 6.4a8 8 0 0 1 0 11.2" />
    </IconBase>
  );
}

/** 소리 꺼짐 (TTS 낭독 OFF) */
export function IconVolumeOff({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <path d="M11.4 4.6 6.8 8.4H3.9a1 1 0 0 0-1 1v5.2a1 1 0 0 0 1 1h2.9l4.6 3.8V4.6Z" />
      <path d="m15.8 9.8 4.8 4.8" />
      <path d="m20.6 9.8-4.8 4.8" />
    </IconBase>
  );
}

/** 재생 */
export function IconPlay({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <path d="M8.2 5.6 19 12 8.2 18.4V5.6Z" />
    </IconBase>
  );
}

/** 일시정지 */
export function IconPause({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <path d="M9.4 5.4v13.2" />
      <path d="M14.6 5.4v13.2" />
    </IconBase>
  );
}

/** 이전 단계 */
export function IconPrev({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <path d="M17 6.2 9.6 12 17 17.8V6.2Z" />
      <path d="M6.6 5.8v12.4" />
    </IconBase>
  );
}

/** 다음 단계 */
export function IconNext({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <path d="M7 6.2 14.4 12 7 17.8V6.2Z" />
      <path d="M17.4 5.8v12.4" />
    </IconBase>
  );
}

/** 다시 하기 */
export function IconRefresh({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <path d="M20.2 11.4a8.2 8.2 0 1 0-.7 4.6" />
      <path d="M20.6 6.4v5h-5" />
    </IconBase>
  );
}

/** 전화 (119 신고) */
export function IconPhone({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <path d="M6.4 3.6h2.7l1.6 4-2 1.3a11.6 11.6 0 0 0 6.4 6.4l1.3-2 4 1.6v2.7a1.9 1.9 0 0 1-2.1 1.9C10.6 18.8 5.2 13.4 4.5 5.7a1.9 1.9 0 0 1 1.9-2.1Z" />
    </IconBase>
  );
}

/** 잠금 (미개방 시나리오) */
export function IconLock({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <path d="M6.6 10.4h10.8a1.1 1.1 0 0 1 1.1 1.1v7.4a1.1 1.1 0 0 1-1.1 1.1H6.6a1.1 1.1 0 0 1-1.1-1.1v-7.4a1.1 1.1 0 0 1 1.1-1.1Z" />
      <path d="M8.7 10.4V7.8a3.3 3.3 0 0 1 6.6 0v2.6" />
    </IconBase>
  );
}

/** 내려받기 */
export function IconDownload({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <path d="M12 3.8v10.6" />
      <path d="m7.6 10.2 4.4 4.4 4.4-4.4" />
      <path d="M4.8 19.6h14.4" />
    </IconBase>
  );
}

/** 저장 (기기 안에 남김) */
export function IconSave({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <path d="M5.9 4.4h9.6l3.6 3.6v10.1a1.5 1.5 0 0 1-1.5 1.5H5.9a1.5 1.5 0 0 1-1.5-1.5V5.9a1.5 1.5 0 0 1 1.5-1.5Z" />
      <path d="M8.2 4.4v4.2h6.4V4.4" />
      <path d="M8.2 19.6v-5.2h7.6v5.2" />
    </IconBase>
  );
}

/** 키보드 입력 (버튼·타이핑 폴백) */
export function IconKeyboard({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <path d="M4.1 6.4h15.8a1.3 1.3 0 0 1 1.3 1.3v8.6a1.3 1.3 0 0 1-1.3 1.3H4.1a1.3 1.3 0 0 1-1.3-1.3V7.7a1.3 1.3 0 0 1 1.3-1.3Z" />
      <path d="M7 10h.01" />
      <path d="M10.4 10h.01" />
      <path d="M13.6 10h.01" />
      <path d="M17 10h.01" />
      <path d="M8.4 14h7.2" />
    </IconBase>
  );
}

/** 시각·소요 시간 */
export function IconClock({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 7.2V12l3.2 1.9" />
    </IconBase>
  );
}

/** 오프라인 (네트워크 없음) */
export function IconOffline({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <path d="M5.4 10.6a9.3 9.3 0 0 1 4.1-2.2" />
      <path d="M14.6 8.5a9.3 9.3 0 0 1 4 2.1" />
      <path d="M8.2 13.9a5.4 5.4 0 0 1 2-1.2" />
      <path d="M14 12.8a5.4 5.4 0 0 1 1.8 1.1" />
      <path d="M12 17.8h.01" />
      <path d="m3.8 3.8 16.4 16.4" />
    </IconBase>
  );
}
