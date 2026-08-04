import { cx } from "./utils";

/** 전 화면 하단에 고정 노출되는 고지 문구 (안전 규칙 §3-2). */
export const DISCLAIMER_TEXT =
  "본 서비스는 훈련·교육 목적이며 119 신고 및 의료인의 진단·처방을 대체하지 않습니다.";

export interface DisclaimerBarProps {
  className?: string;
  /** 고정(fixed) 대신 문서 흐름 안에 넣고 싶을 때 false */
  fixed?: boolean;
}

/**
 * 하단 고정 고지 바.
 * 모바일에서는 하단 탭바 위에 얹히도록 `.chim-disclaimer`가 위치를 잡습니다.
 */
export function DisclaimerBar({ className, fixed = true }: DisclaimerBarProps) {
  return (
    <div
      role="note"
      aria-label="서비스 고지"
      className={cx(
        // 모바일 하단 탭바(z-50)가 이 바의 아래 여백을 덮어야 하므로 z-40을 유지합니다.
        // 전면 인터럽트(z-50)가 이 바를 가리는 구간에서는 모달이 고지 문구를 자체적으로 표시합니다.
        "z-40 border-t border-warn-line bg-warn-soft/95 backdrop-blur",
        fixed && "chim-disclaimer fixed inset-x-0",
        className,
      )}
    >
      {/* 안전상 가장 중요한 문구이므로 고령 사용자 기준(본문 18px)에 맞춰 키웁니다. */}
      <p className="chim-container flex items-center justify-center gap-2 py-2 text-center text-sm leading-snug font-semibold text-warn-ink md:text-base">
        <span aria-hidden="true">!</span>
        <span>{DISCLAIMER_TEXT}</span>
      </p>
    </div>
  );
}

export default DisclaimerBar;
