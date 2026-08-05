/**
 * 침착 공유 컴포넌트 배럴.
 * 다른 에이전트는 `import { PageShell, ScreenHeader } from "@/components";` 형태로 가져다 씁니다.
 * (개별 경로 import도 그대로 동작합니다.)
 */

/* ── 앱 셸 (v4 §0) ─────────────────────────────────────────── */

export { PageShell } from "./PageShell";
export type { PageShellProps } from "./PageShell";

export { TabBar } from "./TabBar";
export type { TabBarProps } from "./TabBar";

export { TopNav } from "./TopNav";
export type { TopNavProps } from "./TopNav";

export { NAV_ITEMS, matchesNav } from "./navItems";
export type { NavItem, TabKey } from "./navItems";

export { SettingsBoot } from "./SettingsBoot";

export { SettingsMenu } from "./SettingsMenu";
export type { SettingsMenuProps } from "./SettingsMenu";

/* ── 화면 조각 (v4 §2·§3) ──────────────────────────────────── */

export { ScreenHeader } from "./ScreenHeader";
export type { ScreenHeaderProps } from "./ScreenHeader";

export { SessionTopBar } from "./SessionTopBar";
export type { SessionTopBarProps } from "./SessionTopBar";

export { InlineDisclaimer, INLINE_DISCLAIMER_TEXT } from "./InlineDisclaimer";
export type { InlineDisclaimerProps } from "./InlineDisclaimer";

export { ListRow, ListRows } from "./ListRow";
export type { ListRowProps, ListRowsProps, ListRowSize } from "./ListRow";

export { MarkerSquare } from "./MarkerSquare";
export type { MarkerSquareProps, MarkerTone } from "./MarkerSquare";

export { EyebrowLabel } from "./EyebrowLabel";
export type { EyebrowLabelProps } from "./EyebrowLabel";

export { MicButton } from "./MicButton";
export type { MicButtonProps, MicButtonSize } from "./MicButton";

export { WaveBars } from "./WaveBars";
export type { WaveBarsProps } from "./WaveBars";

export { StatusDot } from "./StatusDot";
export type { StatusDotProps, StatusTone } from "./StatusDot";

/* ── 기존 조각 ─────────────────────────────────────────────── */

export { BigButton } from "./BigButton";
export type { BigButtonProps, BigButtonVariant, BigButtonSize } from "./BigButton";

export { Card } from "./Card";
export type { CardProps, CardTone } from "./Card";

export { Badge } from "./Badge";
export type { BadgeProps, BadgeTone } from "./Badge";

export { AiBadge } from "./AiBadge";
export type { AiBadgeProps } from "./AiBadge";

export { SourceChip } from "./SourceChip";
export type { SourceChipProps } from "./SourceChip";

export { SourceDocsProvider, useSourceDocs, useSourceDoc } from "./SourceDocsContext";
export type { SourceDocsProviderProps } from "./SourceDocsContext";

export { DEFAULT_SOURCE_DOCS } from "./sourceDocsDefault";

export { Gauge } from "./Gauge";
export type { GaugeProps } from "./Gauge";

export { FeedbackCard } from "./FeedbackCard";
export type { FeedbackCardProps } from "./FeedbackCard";

export { Call119Button } from "./Call119Button";
export type { Call119ButtonProps } from "./Call119Button";

export { SwRegister } from "./SwRegister";

export { cx } from "./utils";

/**
 * @deprecated v4에서 **전역 헤더·전역 고정 고지 바를 없앴습니다**.
 * `AppHeader`는 어디에서도 렌더하지 마세요(파일은 이력 보존용으로만 남겨 둡니다) —
 * 상단 바는 `ScreenHeader`/`SessionTopBar`, 고지는 `InlineDisclaimer`가 대신합니다.
 * `DISCLAIMER_TEXT`는 global-error처럼 셸 밖에서 문구만 필요할 때 계속 씁니다.
 */
export { AppHeader } from "./AppHeader";
export type { AppHeaderProps } from "./AppHeader";

export { DisclaimerBar, DISCLAIMER_TEXT } from "./DisclaimerBar";
export type { DisclaimerBarProps } from "./DisclaimerBar";

/**
 * 아이콘 시스템 — v4 시안은 아이콘을 거의 쓰지 않습니다(탭바는 텍스트, 리스트는 `›`).
 * 남은 화면(안전·점검 등)이 아직 참조하므로 그대로 재수출합니다.
 */
export * from "./icons";
