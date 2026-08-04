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
 *
 * 주황 배경으로 화면 아래를 통째로 물들이던 것을 옅은 지면 + 잉크 텍스트로 바꾸고,
 * 경고의 무게는 왼쪽 4px 주황 마크 하나에 담습니다. 문구는 그대로입니다.
 * 모바일에서는 하단 탭바 위에 얹히도록 `.chim-disclaimer`가 위치를 잡습니다.
 * (높이는 globals.css의 `--chim-disclaimer-h` 주석에 실측 근거가 있습니다.)
 */
export function DisclaimerBar({ className, fixed = true }: DisclaimerBarProps) {
  return (
    <div
      role="note"
      aria-label="서비스 고지"
      className={cx(
        // 모바일 하단 탭바(z-50)가 이 바의 아래 여백을 덮어야 하므로 z-40을 유지합니다.
        // 전면 인터럽트(z-50)가 이 바를 가리는 구간에서는 모달이 고지 문구를 자체적으로 표시합니다.
        "z-40 border-t border-line bg-paper-2",
        fixed && "chim-disclaimer fixed inset-x-0",
        className,
      )}
    >
      <div className="chim-container flex items-stretch justify-center gap-2 py-2">
        {/* 경고를 알리는 유일한 색 — 4px 주황 마크 */}
        <span aria-hidden="true" className="w-[4px] shrink-0 rounded-full bg-warn" />
        {/* 안전상 가장 중요한 문구이므로 고령 사용자 기준(본문 18px)에 맞춰 키웁니다. */}
        <p className="text-center text-sm leading-snug font-semibold text-ink md:text-base">
          {DISCLAIMER_TEXT}
        </p>
      </div>
    </div>
  );
}

export default DisclaimerBar;
