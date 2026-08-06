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
   * readable = `ink-muted`(2.54:1이던 시안 톤을 6.27:1로 올린 값) · faint = `extra-faint`(2.54:1).
   * 고지는 "읽어야 하는 문장"이라 기본값이 readable입니다.
   * faint는 같은 뜻의 고지가 그 화면에 이미 읽히는 크기로 한 번 더 있을 때만 쓰세요.
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
  tone = "readable",
  className,
}: InlineDisclaimerProps) {
  return (
    <p
      role="note"
      className={cx(
        "text-center leading-[1.6]",
        size === "sm" ? "text-[0.6875rem]" : "text-[0.6875rem]",
        tone === "faint" ? "text-extra-faint" : "text-ink-muted",
        className,
      )}
    >
      {text}
    </p>
  );
}

export default InlineDisclaimer;
