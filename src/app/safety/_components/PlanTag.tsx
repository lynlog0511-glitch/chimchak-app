import { cx } from "@/components/utils";

/**
 * 「계획」 표 — 아직 구현하지 않은 설계에 다는 작은 라벨입니다.
 *
 * 이 화면은 「지금 되는 것」과 「설계까지 한 것」이 같은 말투로 섞이면 신뢰를 통째로 잃습니다.
 * /train의 「3종 열림 · 9종 준비 중」과 같은 문법을, 기관 기능 쪽에도 그대로 씁니다.
 *
 * 공용 `Badge`를 쓰지 않는 이유는 **대비** 하나입니다 —
 * neutral/outline의 글자색(ink-muted)은 흰 지면에서 3.2:1이라 작은 글자로는 AA에 못 미칩니다.
 * 이 라벨은 장식이 아니라 「이건 아직 없습니다」라는 사실이라, ink-soft(약 9:1)로 세웁니다.
 */

export interface PlanTagProps {
  className?: string;
}

export function PlanTag({ className }: PlanTagProps) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-chip border border-line-strong px-[7px] py-[1px]",
        "align-[2px] text-[0.7188rem] leading-[1.5] font-bold whitespace-nowrap text-ink-soft",
        className,
      )}
    >
      계획
    </span>
  );
}

export default PlanTag;
