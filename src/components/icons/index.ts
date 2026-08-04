/**
 * 침착 아이콘 시스템 배럴.
 *
 * 규격(DESIGN_DIRECTION §4): 24×24 viewBox · stroke=currentColor · strokeWidth 1.75 ·
 * strokeLinecap/Join=round · fill=none · aria-hidden 기본.
 * 색은 `text-*`로 상속되고, 크기는 `className`의 `h-` `w-` 유틸로 조정합니다(기본 24px).
 *
 * 규칙: **아이콘 단독 사용 금지** — 항상 텍스트 라벨과 함께 씁니다.
 * UI 크롬(네비·배지·상태·버튼)의 이모지는 전부 이 아이콘으로 교체합니다.
 *
 * @example
 * import { IconMic, StatusMark } from "@/components/icons";
 * <IconMic className="h-5 w-5 text-brand-700" /> 말하기
 * <StatusMark kind="met" label="충족" />
 */

export { IconBase } from "./IconBase";
export type { IconProps } from "./IconBase";

/* 네비게이션·개념 */
export {
  IconHome,
  IconChat,
  IconSiren,
  IconNote,
  IconSprout,
  IconShield,
  IconShieldCheck,
  IconDocument,
  IconUser,
  IconUsers,
  IconHeartHand,
  IconAi,
} from "./nav";

/* 동작·재생·입력 */
export {
  IconMic,
  IconWave,
  IconVolume,
  IconVolumeOff,
  IconPlay,
  IconPause,
  IconPrev,
  IconNext,
  IconRefresh,
  IconPhone,
  IconLock,
  IconDownload,
  IconSave,
  IconKeyboard,
  IconClock,
  IconOffline,
} from "./action";

/* 상태·방향 */
export {
  IconCheck,
  IconCheckCircle,
  IconDot,
  IconStop,
  IconAlert,
  IconInfo,
  IconX,
  IconArrowRight,
  IconChevronDown,
  IconChevronRight,
  IconChevronLeft,
} from "./status";
export type { IconDotProps } from "./status";

/* 판정 마크 — 초록 원·흰 원·빨강 원 이모지의 표준 대체물 */
export { StatusMark, STATUS_MARK_LABEL } from "./StatusMark";
export type { StatusMarkProps, StatusMarkKind, StatusMarkSize } from "./StatusMark";
