/**
 * 침착 공유 컴포넌트 배럴.
 * 다른 에이전트는 `import { PageShell, BigButton } from "@/components";` 형태로 가져다 씁니다.
 * (개별 경로 import도 그대로 동작합니다.)
 */

export { AppHeader } from "./AppHeader";
export type { AppHeaderProps } from "./AppHeader";

export { DisclaimerBar, DISCLAIMER_TEXT } from "./DisclaimerBar";
export type { DisclaimerBarProps } from "./DisclaimerBar";

export { PageShell } from "./PageShell";
export type { PageShellProps } from "./PageShell";

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
