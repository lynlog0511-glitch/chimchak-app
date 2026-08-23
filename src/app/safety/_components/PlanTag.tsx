import { cx } from "@/components/utils";

/**
 * 「계획」 표 — 아직 구현하지 않은 설계에 다는 작은 라벨입니다.
 *
 * 이 화면은 「지금 되는 것」과 「설계까지 한 것」이 같은 말투로 섞이면 신뢰를 통째로 잃습니다.
 * /train의 「5종 열림 · 7종 준비 중」과 같은 문법을, 기관 기능 쪽에도 그대로 씁니다.
 *
 * 공용 `Badge` 대신 여기서 직접 그리는 이유는 **무게** 하나입니다 — 이 라벨은 장식이 아니라
 * 「이건 아직 없습니다」라는 사실이라, 문장에 딸린 칩이 아니라 문장과 같은 급으로 읽혀야 합니다.
 * 그래서 글자색을 ink-soft(약 8.5:1)로 세우고, 크기는 이 화면의 메타 눈금(12.5px)에 맞춥니다.
 */

export interface PlanTagProps {
  className?: string;
}

export function PlanTag({ className }: PlanTagProps) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-chip border border-line-strong px-2 py-[1px]",
        "align-[2px] text-[0.7813rem] leading-[1.5] font-bold whitespace-nowrap text-ink-soft",
        className,
      )}
    >
      계획
    </span>
  );
}

export default PlanTag;
