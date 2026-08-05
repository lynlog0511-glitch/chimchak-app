import { cx } from "./utils";

/**
 * 인라인 고지 문구 (시안 4a·4b 하단).
 * v3의 전역 고정 바 문구(`DISCLAIMER_TEXT`)와 뜻은 같고, 시안의 짧은 카피를 그대로 씁니다.
 * **한 글자도 바꾸지 마세요.**
 */
export const INLINE_DISCLAIMER_TEXT =
  "훈련·교육 목적이며 119 신고, 의료인의 진단·처방을 대체하지 않습니다";

export interface InlineDisclaimerProps {
  /** 문구 교체 — 필수 고지를 지우는 용도로 쓰지 마세요(보태는 경우에만). */
  text?: string;
  /** sm 10.5px(세션 도크) · md 11.5px(목록 화면 하단) */
  size?: "sm" | "md";
  /**
   * faint = 시안 값 `#b6bcb9` · readable = `ink-muted`(#8a918e).
   * 흰 배경에서 faint는 대비가 낮습니다 — 이 문구가 그 화면의 **유일한** 고지라면 readable을 쓰세요.
   */
  tone?: "faint" | "readable";
  className?: string;
}

/**
 * 화면 안에 놓는 고지 한 줄 (v4 §0).
 *
 * 전역 고정 고지 바가 사라졌으므로 **모든 화면에 최소 한 번**은 이 조각이 있어야 합니다.
 * 자리는 시안 기준으로 세션 입력 도크 아래·목록 화면 맨 아래입니다.
 *
 * @example <InlineDisclaimer className="mt-[10px]" />
 */
export function InlineDisclaimer({
  text = INLINE_DISCLAIMER_TEXT,
  size = "sm",
  tone = "faint",
  className,
}: InlineDisclaimerProps) {
  return (
    <p
      role="note"
      className={cx(
        "text-center leading-[1.6]",
        size === "sm" ? "text-[10.5px]" : "text-[11.5px]",
        tone === "faint" ? "text-extra-faint" : "text-ink-muted",
        className,
      )}
    >
      {text}
    </p>
  );
}

export default InlineDisclaimer;
