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

export { NAV_ITEMS, matchesNav } from "./navItems";
export type { NavItem, TabKey } from "./navItems";

export { SettingsBoot } from "./SettingsBoot";

export { SettingsMenu } from "./SettingsMenu";
export type { SettingsMenuProps } from "./SettingsMenu";

/* 전면 오버레이 문법 한 벌 — 초점·Esc·Tab 가두기·배경 스크롤 잠금 + 240ms 등장/퇴장.
   시트·모달·팝오버가 전부 이 두 훅을 씁니다(모달 문법이 화면마다 갈리지 않도록). */
export { useModalDismiss, useOverlayTransition, OVERLAY_MS } from "./useModalDismiss";
export type { ModalDismissOptions, OverlayTransition } from "./useModalDismiss";

/* ── 화면 조각 (v4 §2·§3) ──────────────────────────────────── */

export { ScreenHeader } from "./ScreenHeader";
export type { ScreenHeaderProps } from "./ScreenHeader";

/* 뒤로 표식 `‹` 한 벌 — 라벨 옆 17px / 단독 19px, 색은 ink-soft 하나. */
export { BackGlyph } from "./BackGlyph";
export type { BackGlyphProps, BackGlyphSize } from "./BackGlyph";

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

export { SourceChip } from "./SourceChip";
export type { SourceChipProps } from "./SourceChip";

export { SourceDocsProvider, useSourceDocs, useSourceDoc } from "./SourceDocsContext";
export type { SourceDocsProviderProps } from "./SourceDocsContext";

export { DEFAULT_SOURCE_DOCS } from "./sourceDocsDefault";

export { SwRegister } from "./SwRegister";

export { cx } from "./utils";

/*
 * v3에서 넘어온 조각 여섯은 **파일째 지웠습니다**(2026-08-06).
 *   AppHeader · DisclaimerBar — v4에서 전역 헤더와 전역 고정 고지 바를 없앴습니다.
 *     상단 바는 `ScreenHeader`/`SessionTopBar`가, 고지는 `InlineDisclaimer`가 대신합니다.
 *   Gauge — 세션 우측 레일이 자체 구현을 쓰고 있었습니다(그 레일도 2026-08-25에 사라졌습니다 —
 *     전 뷰포트 앱 프레임에서는 둘째 칸이 설 자리가 없습니다).
 *   FeedbackCard — 세션 안에서는 `InlineCoaching`이, 이력 화면에서는 각 행이 직접 그립니다.
 *   AiBadge — 「AI 생성 · 가상 인물」 표기는 말풍선(`DialogueLog`)이 직접 답니다.
 *   illustrations/MiniChart — 어느 화면도 그리지 않았습니다.
 *
 * 지운 이유는 번들이 아니라(배럴 export는 트리셰이킹됩니다) **유지보수**입니다. 렌더 0건인
 * 조각이 살아 있는 API처럼 재수출돼 있으면 다음 사람이 「어딘가 쓰인다」를 믿고 계속 끌고 가고,
 * 실제로 그려지지도 않는 화면이 평가와 리팩터링 판단에 섞입니다.
 * 되살려야 할 일이 생기면 이 줄의 날짜로 이력에서 꺼내 쓰십시오.
 *
 * 같은 이유로 `Call119Button`도 **파일째 지웠습니다**(2026-08-23).
 * 119 버튼은 응급·훈련 세 자리 모두 `emergency/_components/Call119Bar`가 그리고 있었고,
 * 이 조각은 어디서도 렌더되지 않은 채 캡션 상수만 내주고 있었습니다.
 * 캡션 문구·크기(`CALL_119_CAPTION`·`CALL_119_CAPTION_CLASS`)와 그 역사 기록은
 * 실제로 쓰는 쪽인 `Call119Bar.tsx`로 그대로 옮겼습니다.
 */

/**
 * 아이콘 시스템 — v4 시안은 아이콘을 거의 쓰지 않습니다(탭바는 텍스트, 리스트는 `›`).
 * 남은 화면(안전·점검 등)이 아직 참조하므로 그대로 재수출합니다.
 */
export * from "./icons";
