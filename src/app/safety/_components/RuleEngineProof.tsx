"use client";

import { useCallback, useState } from "react";
import {
  RULE_ENGINE_CF_ITEM_IDS,
  RULE_ENGINE_ITEM_IDS,
  runEngineSelfCheck,
  type EngineSelfCheckResult,
} from "@/engine";
import {
  CALL_DELAY_BOUNDARY_CASES,
  EVIDENCE_BOUNDARY_CASES,
  RULE_BOUNDARY_CASES,
} from "@/data/ruleBoundaryCases";
import { EVIDENCE_GUARD } from "@/data/evidenceGuard";
import { BigButton } from "@/components";
import { cx } from "@/components/utils";

/**
 * 규칙 엔진 검증 카드 — **인용치와 실측치를 나란히** 둡니다.
 *
 * 예전에는 기획서 [그림 7]의 숫자를 옮겨 적기만 했습니다. 옮겨 적은 값은 심사위원이
 * 그 자리에서 반증할 수 없어서, 경계 케이스를 저장소에 커밋하고(src/data/ruleBoundaryCases.ts)
 * 버튼 한 번으로 **지금 이 브라우저에서** 다시 돌리게 했습니다. 위 칸은 기획서 값,
 * 아래 칸은 방금 이 기기에서 잰 값입니다 — 섞지 않습니다.
 *
 * 항목 수는 문장에 적어 두지 않고 엔진에서 세어 옵니다(engine/coverage.ts).
 * 설계 배정표(rubric.ts의 12항목)가 아니라 **지금 코드가 실제로 판정하는 항목**을 셉니다.
 *
 * 형태는 v4 §2 — 보더·그림자 없이 면(r14) 하나 + 헤어라인 행. 큰 숫자 타일은 쓰지 않습니다.
 */

export interface RuleEngineProofProps {
  className?: string;
}

/** 기획서 [그림 7] 실행 로그 — 옮겨 적은 값입니다(이 화면에서 잰 값이 아닙니다). */
const QUOTED_ROWS: readonly { k: string; v: string }[] = [
  { k: "경계 케이스", v: "30 / 30 전수 통과" },
  { k: "판정 지연 (p95)", v: "0.11 ms" },
  { k: "실행 일자", v: "2026. 7. 27." },
];

function Row({ k, v, tone }: { k: string; v: string; tone?: "warn" }) {
  return (
    <div className="flex items-baseline gap-[10px] py-[10px]">
      <dt className="min-w-0 flex-1 text-[0.8125rem] leading-[1.5] text-ink-muted">{k}</dt>
      <dd
        className={cx(
          "chim-num flex-none text-[0.9063rem] leading-[1.5] font-extrabold",
          tone === "warn" ? "text-danger-ink" : "text-ink",
        )}
      >
        {v}
      </dd>
    </div>
  );
}

/** 소수점 두 자리 — 0.00으로 찍히면 눈금보다 빠르다는 뜻이라 그렇게 적습니다. */
function ms(value: number): string {
  return value >= 0.005 ? `${value.toFixed(2)} ms` : "0.01 ms 미만";
}

function measuredRows(result: EngineSelfCheckResult): { k: string; v: string; tone?: "warn" }[] {
  const rows = result.groups.map((group) => ({
    k: group.label,
    v: `${group.passed} / ${group.total} 통과`,
    tone: group.passed === group.total ? undefined : ("warn" as const),
  }));
  rows.push({ k: `판정 지연 (p95 · ${result.repeat}회 평균)`, v: ms(result.p95Ms), tone: undefined });
  rows.push({
    k: "실행 시각",
    v: new Date(result.ranAt).toLocaleTimeString("ko-KR", { hour12: false }),
    tone: undefined,
  });
  return rows;
}

export function RuleEngineProof({ className }: RuleEngineProofProps) {
  const [result, setResult] = useState<EngineSelfCheckResult | null>(null);
  const [running, setRunning] = useState(false);

  const totalCases =
    RULE_BOUNDARY_CASES.length + CALL_DELAY_BOUNDARY_CASES.length + EVIDENCE_BOUNDARY_CASES.length;

  const run = useCallback(() => {
    setRunning(true);
    // 판정은 동기 함수라 곧바로 끝납니다. 버튼이 눌린 것이 화면에 보이도록 한 틱만 미룹니다.
    window.setTimeout(() => {
      setResult(
        runEngineSelfCheck({
          ruleCases: RULE_BOUNDARY_CASES,
          callDelayCases: CALL_DELAY_BOUNDARY_CASES,
          evidenceCases: EVIDENCE_BOUNDARY_CASES,
          evidenceGuard: EVIDENCE_GUARD,
        }),
      );
      setRunning(false);
    }, 0);
  }, []);

  const failed = result ? result.total - result.passed : 0;

  return (
    <section
      aria-labelledby="rule-engine-proof-title"
      className={cx("rounded-[14px] bg-paper-2 px-[15px] py-[14px]", className)}
    >
      <h3
        id="rule-engine-proof-title"
        className="text-[0.875rem] leading-[1.45] font-extrabold text-ink"
      >
        규칙 엔진 검증 — 경계 케이스
      </h3>
      <p className="mt-[6px] text-[0.8125rem] leading-[1.6] text-ink-soft">
        규칙 사전과 시간 규칙이 단독으로 판정하는 {RULE_ENGINE_ITEM_IDS.length}항목(그중 안전
        직결 {RULE_ENGINE_CF_ITEM_IDS.length}항목)을 경계 문장으로 때려 본 기록입니다. 아래
        「지금 돌려보기」를 누르면 같은 케이스를 이 기기에서 다시 돌립니다.
      </p>

      <p className="mt-[12px] text-[0.75rem] leading-[1.5] font-bold text-ink-muted">
        기획서 [그림 7] 실행 로그 — 옮겨 적은 값
      </p>
      <dl className="chim-hairline mt-[4px] border-y border-line">
        {QUOTED_ROWS.map((row) => (
          <Row key={row.k} k={row.k} v={row.v} />
        ))}
      </dl>

      <div className="mt-[14px] flex flex-wrap items-center gap-3">
        <BigButton onClick={run} variant="secondary" disabled={running}>
          {running ? "돌리는 중…" : `지금 이 브라우저에서 ${totalCases}건 돌려보기`}
        </BigButton>
      </div>

      {result && (
        <>
          <p className="mt-[12px] text-[0.75rem] leading-[1.5] font-bold text-brand-800">
            방금 이 기기에서 잰 값
          </p>
          <dl className="chim-hairline mt-[4px] border-y border-line">
            {measuredRows(result).map((row) => (
              <Row key={row.k} k={row.k} v={row.v} tone={row.tone} />
            ))}
          </dl>
          <p aria-live="polite" className="mt-[8px] text-[0.8125rem] leading-[1.6] text-ink">
            {failed === 0
              ? `${result.total}건 전수 통과했습니다. 케이스 목록은 저장소(src/data/ruleBoundaryCases.ts)에 그대로 있습니다.`
              : `${failed}건이 기대와 다르게 판정됐습니다.`}
          </p>
          {result.groups
            .flatMap((group) => group.failures)
            .map((failure) => (
              <p key={failure} className="mt-[4px] text-[0.75rem] leading-[1.6] text-danger-ink">
                {failure}
              </p>
            ))}
        </>
      )}

      {/* 출처와 한계를 같은 크기로 적습니다 — 두 칸의 숫자가 섞여 읽히면 안 되는 값입니다. */}
      <p className="mt-[9px] text-[0.75rem] leading-[1.6] text-ink-soft">
        위 칸은 기획서에 실린 값이고, 아래 칸은 방금 이 브라우저에서 잰 값입니다. 기기 성능에
        따라 지연 값은 달라집니다 — 통과 건수는 기기와 무관하게 같아야 합니다.
      </p>
    </section>
  );
}

export default RuleEngineProof;
