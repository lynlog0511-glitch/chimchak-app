"use client";

import { useMemo } from "react";
import { RUBRIC } from "@/data/rubric";
import { SCENARIOS } from "@/data/scenarios";
import { JUDGE_LABEL } from "./judgeLabel";
import { cx } from "@/components/utils";

/**
 * 설계 문서에 적은 숫자를 **이 화면이 직접 세어** 보여 주는 칸입니다.
 *
 * 문서에는 「상황 42개」·「분기 172개」·「판정 주체 배정」 같은 숫자가 적혀 있는데, 화면에도
 * 같은 숫자를 문장으로 옮겨 적으면 두 곳이 조용히 어긋납니다(시나리오를 하나 더하면 문서만
 * 낡습니다). 그래서 이 칸은 상수를 두지 않고, 브라우저에 실린 시나리오·루브릭 데이터를
 * 열 때마다 그대로 셉니다 — 데이터가 늘면 이 숫자도 같이 바뀝니다.
 *
 * 이 화면의 다른 실측 패널과 달리 숫자를 40px로 세우지 않습니다. 세는 대상이 「지금 잰 성능」이
 * 아니라 **앱에 실려 있는 분량**이라, 같은 크기로 올리면 무게가 뒤바뀝니다.
 */

export interface CountedFactsProps {
  className?: string;
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline gap-3 py-3">
      <dt className="min-w-0 flex-1 text-[0.9375rem] leading-[1.5] text-ink-muted">{k}</dt>
      <dd className="chim-num flex-none text-[0.9375rem] leading-[1.5] font-extrabold text-ink">
        {v}
      </dd>
    </div>
  );
}

export function CountedFacts({ className }: CountedFactsProps) {
  const counted = useMemo(() => {
    const cues = SCENARIOS.flatMap((scenario) => scenario.turns).filter((turn) => turn.cue);
    const branches = cues.reduce((sum, turn) => sum + (turn.cue?.branches.length ?? 0), 0);
    const judge = { rule: 0, llm: 0, both: 0 };
    for (const item of RUBRIC) judge[item.judge] += 1;
    return {
      scenarios: SCENARIOS.length,
      cues: cues.length,
      branches,
      rubric: RUBRIC.length,
      judge,
    };
  }, []);

  return (
    <section
      aria-labelledby="counted-facts-title"
      className={cx("rounded-card bg-paper-2 p-4", className)}
    >
      <h3 id="counted-facts-title" className="text-[1.0625rem] leading-[1.4] font-extrabold text-ink">
        설계 문서에 적은 숫자를 이 기기에서 다시 셉니다
      </h3>
      <p className="mt-2 text-[0.9375rem] leading-[1.6] text-ink-soft">
        아래 값은 문장에 적어 둔 상수가 아닙니다. 이 화면이 열릴 때 앱에 실린 시나리오·루브릭
        데이터를 그대로 세어 표시합니다.
      </p>

      <dl className="chim-hairline mt-3 border-y border-line">
        <Row k="열린 시나리오" v={`${counted.scenarios}종`} />
        <Row k="응답해야 하는 상황(CUE)" v={`${counted.cues}개`} />
        <Row k="갈라지는 분기" v={`${counted.branches}개`} />
        <Row k="루브릭 항목" v={`${counted.rubric}항목`} />
      </dl>

      <p className="mt-4 text-[0.7813rem] leading-[1.5] font-bold tracking-[0.04em] text-ink-muted">
        루브릭 {counted.rubric}항목의 판정 주체 배정
      </p>
      <dl className="chim-hairline mt-1 border-y border-line">
        <Row k={JUDGE_LABEL.llm.long} v={`${counted.judge.llm}항목`} />
        <Row k={JUDGE_LABEL.rule.long} v={`${counted.judge.rule}항목`} />
        <Row k={JUDGE_LABEL.both.long} v={`${counted.judge.both}항목`} />
      </dl>

      <p className="mt-3 text-[0.7813rem] leading-[1.6] text-ink-muted">
        이 배정은 <b className="font-bold">설계상의 배정</b>입니다. 알파에는 생성 호출이 0건이라,
        AI 칸으로 배정한 항목도 지금은 검수된 시나리오 규칙표가 판정합니다.
      </p>
    </section>
  );
}

export default CountedFacts;
