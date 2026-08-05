import { cx } from "./utils";

export type StatusTone = "brand" | "ok" | "warn" | "danger" | "neutral";

const TONE: Record<StatusTone, string> = {
  brand: "bg-brand-600", // 「대화 단계 · AI는 어르신 역만 맡습니다」
  ok: "bg-ok", // 「기기에 저장됨」
  warn: "bg-warn",
  danger: "bg-danger", // 「듣고 있어요」 녹음 점
  neutral: "bg-faint",
};

export interface StatusDotProps {
  tone?: StatusTone;
  /** 지름(px) — 시안 기본 6px, 녹음 패널만 8px */
  size?: number;
  /**
   * 점만으로 뜻을 전하지 않도록 옆에 항상 텍스트를 둡니다.
   * 텍스트를 둘 수 없는 자리에서만 이 라벨을 주세요(스크린리더 전용).
   */
  label?: string;
  className?: string;
}

/**
 * 상태 점 — 6px 원 하나. v4에서 남은 몇 안 되는 도형 신호입니다.
 *
 * 색은 언제나 **옆의 텍스트를 거드는 역할**이고, 색만으로 정보를 전하지 않습니다.
 *
 * @example
 * <span className="flex items-center gap-[5px] text-[0.7813rem] text-ok-ink">
 *   <StatusDot tone="ok" />기기에 저장됨 — 연결이 끊겨도 열립니다
 * </span>
 */
export function StatusDot({ tone = "brand", size = 6, label, className }: StatusDotProps) {
  return (
    <span
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      className={cx("inline-block flex-none rounded-full", TONE[tone], className)}
      style={{ width: size, height: size }}
    />
  );
}

export default StatusDot;
