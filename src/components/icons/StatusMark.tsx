import { CHECK_PATH_IN_CIRCLE } from "./glyphs";
import { cx } from "../utils";

export type StatusMarkKind = "met" | "coach" | "stop";
export type StatusMarkSize = "sm" | "md" | "lg";

/**
 * 판정 2단계(+즉시 중단)의 표준 표기 문구.
 * FeedbackCard가 이미 쓰고 있는 문구 그대로입니다 — 새 문구를 만들지 않습니다.
 */
export const STATUS_MARK_LABEL: Record<StatusMarkKind, string> = {
  met: "충족",
  coach: "코칭",
  stop: "즉시 중단",
};

export interface StatusMarkProps {
  /** met=채운 원+체크 · coach=빈 원 · stop=정지 마크 */
  kind: StatusMarkKind;
  /**
   * 마크 옆에 함께 노출할 텍스트.
   * 주지 않으면 마크만 그리므로, 호출부가 반드시 옆에 텍스트 라벨을 두어야 합니다(아이콘 단독 금지).
   */
  label?: string;
  size?: StatusMarkSize;
  /** 라벨을 굵게(기본) 대신 보통 굵기로 */
  quiet?: boolean;
  className?: string;
}

const MARK_SIZE: Record<StatusMarkSize, string> = {
  sm: "h-[18px] w-[18px]",
  md: "h-5 w-5",
  lg: "h-6 w-6",
};

/* 판정어는 UI 크롬입니다 — 13 / 15 / 17px.
   코어 콘텐츠(대사·CUE·응급 자막·CTA)의 18px+ 규칙은 여기에 적용되지 않습니다. */
const LABEL_SIZE: Record<StatusMarkSize, string> = {
  sm: "text-[0.8125rem]",
  md: "text-[0.9375rem]",
  lg: "text-[1.0625rem]",
};

/** 마크 자체의 색 — 도형이므로 대비 3:1 기준을 씁니다. */
const MARK_COLOR: Record<StatusMarkKind, string> = {
  met: "text-ok",
  coach: "text-ink-muted",
  stop: "text-danger",
};

/** 라벨 색 — 작은 글자이므로 대비 4.5:1을 넘는 `*-ink` 계열을 씁니다. */
const LABEL_COLOR: Record<StatusMarkKind, string> = {
  met: "text-ok-ink",
  coach: "text-ink-soft",
  stop: "text-danger-ink",
};

function MarkShape({ kind, className }: { kind: StatusMarkKind; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cx("shrink-0", className)}
    >
      {kind === "met" && (
        <>
          <circle cx="12" cy="12" r="8.6" fill="currentColor" stroke="none" />
          {/* 흰 체크는 도형 위 그래픽 — ok(#1E9E6A) 대비 3.4:1로 3:1 기준을 넘습니다.
              기하는 glyphs.tsx 한 곳에만 둡니다(텍스트 ✓와 이원화되지 않도록 — 심미 mi45). */}
          <path d={CHECK_PATH_IN_CIRCLE} stroke="#ffffff" strokeWidth={2.2} />
        </>
      )}
      {kind === "coach" && <circle cx="12" cy="12" r="8.2" />}
      {kind === "stop" && (
        <>
          <circle cx="12" cy="12" r="8.2" />
          <path d="M8.1 12h7.8" />
        </>
      )}
    </svg>
  );
}

/**
 * 판정 표기 표준 마크 — 전 화면에서 초록 원·흰 원·빨강 원 이모지를 대체합니다.
 * 점수·등급은 어떤 경우에도 표시하지 않으며, 2단계 의미 체계(충족/코칭)는 그대로입니다.
 *
 * @example <StatusMark kind="met" label="충족" />
 * @example <StatusMark kind="coach" size="sm" /> <span>코칭</span>
 */
export function StatusMark({
  kind,
  label,
  size = "md",
  quiet = false,
  className,
}: StatusMarkProps) {
  if (!label) {
    return <MarkShape kind={kind} className={cx(MARK_SIZE[size], MARK_COLOR[kind], className)} />;
  }

  return (
    <span className={cx("inline-flex items-center gap-1.5 align-middle", className)}>
      <MarkShape kind={kind} className={cx(MARK_SIZE[size], MARK_COLOR[kind])} />
      <span
        className={cx(
          LABEL_SIZE[size],
          LABEL_COLOR[kind],
          quiet ? "font-semibold" : "font-extrabold",
        )}
      >
        {label}
      </span>
    </span>
  );
}

export default StatusMark;
