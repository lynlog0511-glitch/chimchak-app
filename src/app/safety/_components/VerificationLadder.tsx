import type { ReactNode } from "react";
import {
  GUARD_BENCHMARK,
  LADDER_ORIGIN_NOTE,
  PILOT_PREREGISTERED,
  PILOT_SCOPE,
  VERIFICATION_LADDER,
} from "@/data/pilotResults";
import { cx } from "@/components/utils";
import { PlanTag } from "./PlanTag";

/**
 * 검증 계단 ①~④ — 「무엇을 어디까지 재 봤는가」를 네 칸으로 세워 두는 자리입니다.
 *
 * 이 화면에는 이미 실측 패널이 둘 있습니다(외부 요청 계측·규칙 엔진 재실행). 그런데 그 둘은
 * **이 기기에서 잴 수 있는 것**만 다룹니다. 근거 가드와 사투리는 앱 밖 하네스에서 쟀고,
 * 파일럿은 아직 재지 않았습니다 — 세 종류의 값이 한 화면에 있는데 구분이 없으면, 재 본 것과
 * 옮겨 적은 것과 하겠다고 한 것이 전부 같은 무게로 읽힙니다.
 *
 * 그래서 칸마다 **출처를 문장으로** 답니다(`LADDER_ORIGIN_NOTE`). ①에는 기존 재실행 카드를
 * 그대로 끼워 넣고, ④에는 「계획」 표를 답니다 — ④에는 숫자가 한 칸도 없습니다.
 *
 * 형태는 이 화면의 나머지와 같습니다 — 보더·그림자 없이 hairline 행,
 * 눈금은 번호·출처 12.5 / 본문 15 / 계단 이름 17.
 */

export interface VerificationLadderProps {
  /** ① 칸에 끼워 넣을 조각 — 규칙 엔진 재실행 카드가 들어옵니다. */
  proof?: ReactNode;
  className?: string;
}

/** 계단 번호 옆 상태 — 「실측 완료」와 「진행 중」 두 낱말만 씁니다. */
const STATE_LABEL = {
  measured: "실측 완료",
  running: "진행 중",
} as const;

/** ② 상세 — 조건 두 줄을 나란히 놓습니다. 옮겨 적은 값이라 숫자를 키우지 않습니다. */
function GuardTable() {
  return (
    <div className="mt-3 rounded-card bg-paper-2 p-4">
      <p className="text-[0.7813rem] leading-[1.5] font-bold tracking-[0.04em] text-ink-muted">
        같은 모델 · 같은 {GUARD_BENCHMARK.questionCount}문항 · 다른 것은 근거 가드 하나
      </p>
      <ul className="chim-hairline mt-2 border-y border-line">
        {GUARD_BENCHMARK.rows.map((row) => (
          <li key={row.condition} className="py-3">
            <p className="text-[0.9375rem] leading-[1.5] font-bold text-ink">{row.condition}</p>
            <dl className="mt-2 space-y-2">
              <div className="flex items-baseline gap-3">
                <dt className="min-w-0 flex-1 text-[0.9375rem] leading-[1.5] text-ink-muted">
                  허용 목록 밖 인용
                </dt>
                <dd className="chim-num flex-none text-[0.9375rem] leading-[1.5] font-extrabold text-ink">
                  {row.outside}
                </dd>
              </div>
              <div className="flex items-baseline gap-3">
                <dt className="min-w-0 flex-1 text-[0.9375rem] leading-[1.5] text-ink-muted">
                  정답 근거 인용
                </dt>
                <dd className="chim-num flex-none text-[0.9375rem] leading-[1.5] font-extrabold text-ink">
                  {row.correct}
                </dd>
              </div>
              <div className="flex items-baseline gap-3">
                <dt className="min-w-0 flex-1 text-[0.9375rem] leading-[1.5] text-ink-muted">
                  판정 대상 · 폐기
                </dt>
                <dd className="flex-none text-[0.9375rem] leading-[1.5] text-ink">
                  {row.judged} · {row.blocked}
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[0.7813rem] leading-[1.6] text-ink-muted">
        문항 구성은 {GUARD_BENCHMARK.composition}입니다. {GUARD_BENCHMARK.limit}
      </p>
    </div>
  );
}

/** ④ 상세 — 결과가 없으므로 「무엇을 미리 정해 두었는가」만 적습니다. */
function PilotPlan() {
  return (
    <div className="mt-3 rounded-card bg-paper-2 p-4">
      <p className="text-[0.9375rem] leading-[1.6] text-ink">
        범위는 {PILOT_SCOPE}입니다. 아래 두 항목은 결과를 보고 고른 것이 아니라 측정 전에 정해
        둔 것이라, 파일럿이 끝나면 이 목록 그대로 답해야 합니다.
      </p>
      <ul className="chim-hairline mt-3 border-y border-line">
        {PILOT_PREREGISTERED.map((item) => (
          <li key={item.t} className="py-3">
            <p className="text-[0.9375rem] leading-[1.45] font-bold text-ink">{item.t}</p>
            <p className="mt-1 text-[0.9375rem] leading-[1.6] text-ink-muted">{item.d}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function VerificationLadder({ proof, className }: VerificationLadderProps) {
  return (
    <ol className={cx("chim-hairline border-y border-line", className)}>
      {VERIFICATION_LADDER.map((step) => (
        <li key={step.id} className="py-5">
          <p className="text-[0.7813rem] leading-[1.5] font-bold tracking-[0.04em] text-ink-muted">
            <span className="chim-num">{step.no}</span> · {STATE_LABEL[step.state]}
            {step.measuredAt && ` · 실측 ${step.measuredAt}`}
          </p>
          <p className="mt-1 text-[1.0625rem] leading-[1.4] font-extrabold text-ink">
            {step.title}
            {step.origin === "not-yet" && <PlanTag className="ml-2" />}
          </p>
          <p className="mt-2 text-[0.9375rem] leading-[1.65] text-ink-soft">{step.hypothesis}</p>
          <p className="mt-2 text-[0.9375rem] leading-[1.65] text-ink">{step.result}</p>
          <p className="mt-2 text-[0.7813rem] leading-[1.6] text-ink-muted">
            {LADDER_ORIGIN_NOTE[step.origin]}
          </p>

          {step.id === "guard" && <GuardTable />}
          {step.id === "pilot" && <PilotPlan />}
          {step.id === "rules" && proof}

          <p className="mt-3 text-[0.7813rem] leading-[1.6] text-ink-faint">
            남은 과제 · {step.remaining}
          </p>
        </li>
      ))}
    </ol>
  );
}

export default VerificationLadder;
