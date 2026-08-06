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
 * v3 §5: 주황 마크도, 주황 배경도 없습니다. 옅은 면(`paper-2`) 위 13px 잉크 뮤트 한 줄 —
 * **존재하되 조용히**입니다. 색으로 경고하는 자리는 응급 화면의 119 버튼 하나뿐입니다.
 * 문구는 한 글자도 바꾸지 않았습니다.
 *
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
      <div className="chim-container py-2">
        {/* UI 크롬 최하단 위계 — 13px. ink-muted(#5a625f)는 paper-2 위에서 5.79:1로 AA를 넘습니다. */}
        <p className="chim-caption text-center leading-snug text-ink-muted">{DISCLAIMER_TEXT}</p>
      </div>
    </div>
  );
}

export default DisclaimerBar;
