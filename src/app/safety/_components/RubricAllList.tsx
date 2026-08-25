import type { RubricArea, RubricItem } from "@/types";
import { AREA_LABELS, getRubricByArea } from "@/data/rubric";
import { cx } from "@/components/utils";
import { JUDGE_LABEL } from "./judgeLabel";

/**
 * 판정 기준 — 루브릭 30항목 전체 보기.
 *
 * 「핵심 자산은 루브릭 30항목」이라고 말해 놓고 30항목을 볼 수 있는 화면이 없으면,
 * 그 말은 확인할 수 없는 주장입니다. 그래서 `src/data/rubric.ts`의 원본을 영역별로 그대로 폅니다.
 *
 * **행동지표 문장만** 냅니다 — 4점 척도 앵커와 점수는 내부 전용이라 여기에도 내지 않습니다
 * (§3-1 점수 미표시). 「점수는 안 보여 드리지만 기준은 전부 공개합니다」가 이 절의 문장입니다.
 *
 * 기본은 접힘입니다(30줄이라 펴 두면 아래 절들이 밀립니다). 손잡이 높이는 48px,
 * 펼침 표시는 앱의 다른 접힘과 같은 `›` 회전을 씁니다.
 */

/** 설계서 §4.3 순서 — E1 SA · E2 CO · E3 RE · E4 CL. */
const AREA_ORDER: readonly RubricArea[] = ["SA", "CO", "RE", "CL"];

export interface RubricAllListProps {
  className?: string;
}

/**
 * 항목마다 붙는 판정 주체 칩 — 「이 문장을 누가 판정하도록 배정했는가」.
 *
 * 기준 문장만 펴 두면 「그래서 이건 AI가 봅니까, 규칙이 봅니까」가 바로 다음 질문입니다.
 * 그 답이 목록 밖 어딘가에 있으면 확인할 수 없는 주장이 되므로, 항목 옆에 그대로 답니다.
 * 무게는 「계획」 표와 같은 눈금(12.5px 테두리 칩)이되, 색 면은 쓰지 않습니다.
 */
function JudgeTag({ judge }: { judge: RubricItem["judge"] }) {
  return (
    <span className="mr-2 inline-flex items-center rounded-chip border border-line-strong px-2 py-[1px] align-[2px] text-[0.7813rem] leading-[1.5] font-bold whitespace-nowrap text-ink-muted">
      {JUDGE_LABEL[judge].short}
    </span>
  );
}

export function RubricAllList({ className }: RubricAllListProps) {
  const groups = AREA_ORDER.map((area) => ({
    area,
    label: AREA_LABELS[area],
    items: getRubricByArea(area),
  }));
  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <details className={cx("group rounded-card bg-paper-2", className)}>
      <summary className="flex min-h-[48px] cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1 text-[1.0625rem] leading-[1.4] font-extrabold text-ink">
          판정 기준 — 루브릭 {total}항목 전체 보기
        </span>
        <span
          aria-hidden
          className="flex-none text-[1.0625rem] leading-none text-ink-ghost transition-transform duration-150 ease-soft group-open:rotate-90"
        >
          ›
        </span>
      </summary>

      <div className="px-4 pb-4">
        <p className="text-[0.9375rem] leading-[1.6] text-ink-muted">
          점수·등급·앵커는 내부 전용이라 화면에 내지 않습니다. 대신 판정의 기준이 되는 행동지표
          문장은 한 줄도 빼지 않고 그대로 공개합니다.
        </p>
        <p className="mt-2 text-[0.7813rem] leading-[1.6] text-ink-muted">
          항목 앞의 표는 판정 주체 배정입니다. {JUDGE_LABEL.rule.long} · {JUDGE_LABEL.llm.long} ·{" "}
          {JUDGE_LABEL.both.long}. 지금 배포본에는 생성 호출이 0건이라, AI로 배정한 항목도 검수된
          시나리오 규칙표가 판정합니다.
        </p>

        <div className="mt-4 space-y-5">
          {groups.map((group) => (
            <section key={group.area} aria-label={group.label}>
              <p className="text-[0.7813rem] leading-[1.5] font-bold tracking-[0.06em] text-ink-muted">
                {group.label} · {group.items.length}항목
              </p>
              <ul className="chim-hairline mt-1 border-y border-line">
                {group.items.map((item) => (
                  <li key={item.id} className="py-3 text-[0.9375rem] leading-[1.6] text-ink">
                    <JudgeTag judge={item.judge} />
                    {item.indicator}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </details>
  );
}

export default RubricAllList;
