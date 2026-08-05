import { cx } from "@/components/utils";

export interface SessionProgressBarProps {
  /** 지금 진행 중인 상황 번호 (1부터) — 이 번호까지 칸이 채워집니다 */
  index: number;
  /** 전체 칸 수 (대략치) */
  total: number;
  className?: string;
}

/**
 * 세그먼트 진행바 (시안 4a① · 3px 칸 · 간격 3px).
 *
 * 퍼센트도 점수도 아닙니다 — **몇째 상황인지**만 알려 주는 위치 표시입니다.
 * 색만으로 뜻을 전하지 않도록 스크린리더에는 문장으로 읽어 드립니다.
 */
export function SessionProgressBar({ index, total, className }: SessionProgressBarProps) {
  const count = Math.max(1, Math.round(total));
  const done = Math.max(0, Math.min(count, Math.round(index)));

  return (
    <div
      role="img"
      aria-label={`약 ${count}개 상황 가운데 ${done}번째를 진행하고 있습니다`}
      className={cx("flex gap-[3px]", className)}
    >
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={cx(
            "h-[3px] flex-1 rounded-[2px] transition-colors duration-300 ease-soft",
            i < done ? "bg-brand-600" : "bg-line",
          )}
        />
      ))}
    </div>
  );
}

export default SessionProgressBar;
