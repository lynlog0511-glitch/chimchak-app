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
 * 예전에는 설계 문서 검증 계단 ①의 숫자를 옮겨 적기만 했습니다. 옮겨 적은 값은 보시는 분이
 * 그 자리에서 반증할 수 없어서, 경계 케이스를 저장소에 커밋하고(src/data/ruleBoundaryCases.ts)
 * 버튼 한 번으로 **지금 이 브라우저에서** 다시 돌리게 했습니다. 위 칸은 설계 문서 값,
 * 아래 칸은 방금 이 기기에서 잰 값입니다 — 섞지 않습니다.
 *
 * **둘을 크기로 갈라 놓았습니다**: 옮겨 적은 값은 작은 표(15px)에 그대로 두고,
 * 방금 잰 값만 40px 숫자로 세웁니다. 앞의 라이브 계측 패널과 같은 문법이라, 화면을 훑기만 해도
 * 「큰 숫자는 지금 잰 것」이라는 규칙이 눈에 남습니다.
 *
 * 항목 수는 문장에 적어 두지 않고 엔진에서 세어 옵니다(engine/coverage.ts).
 * 설계 배정표(rubric.ts의 12항목)가 아니라 **지금 코드가 실제로 판정하는 항목**을 셉니다.
 *
 * 형태는 v4 §2 — 보더·그림자 없이 면(r14) 하나 + 헤어라인 행.
 */

export interface RuleEngineProofProps {
  className?: string;
}

/** 설계 문서 검증 계단 ① 실행 로그 — 옮겨 적은 값입니다(이 화면에서 잰 값이 아닙니다). */
const QUOTED_ROWS: readonly { k: string; v: string }[] = [
  { k: "경계 케이스", v: "30 / 30 전수 통과" },
  { k: "판정 지연 (p95)", v: "0.11 ms" },
  { k: "실행 일자", v: "2026. 7. 27." },
];

function Row({ k, v, tone }: { k: string; v: string; tone?: "warn" }) {
  return (
    <div className="flex items-baseline gap-3 py-3">
      <dt className="min-w-0 flex-1 text-[0.9375rem] leading-[1.5] text-ink-muted">{k}</dt>
      <dd
        className={cx(
          "chim-num flex-none text-[0.9375rem] leading-[1.5] font-extrabold",
          tone === "warn" ? "text-danger-ink" : "text-ink",
        )}
      >
        {v}
      </dd>
    </div>
  );
}

/** 방금 잰 값 한 칸 — 숫자와 단위를 갈라 두어야 40px 숫자 옆에 단위가 눌러앉습니다. */
function MeasuredStat({
  value,
  unit,
  label,
  tone,
}: {
  value: string;
  unit: string;
  label: string;
  tone?: "warn";
}) {
  return (
    <div className="rounded-card bg-paper p-4">
      <p
        className={cx(
          "chim-num text-[2.5rem] leading-[1.05] font-extrabold tracking-[-0.03em]",
          tone === "warn" ? "text-danger-ink" : "text-ink",
        )}
      >
        {value}
        <span className="text-[0.9375rem] font-semibold text-ink-muted"> {unit}</span>
      </p>
      <p className="mt-2 text-[0.7813rem] leading-[1.5] text-ink-muted">{label}</p>
    </div>
  );
}

/** 소수점 두 자리 — 0.00으로 찍히면 눈금보다 빠르다는 뜻이라 그렇게 적습니다. */
function ms(value: number): { value: string; unit: string } {
  return value >= 0.005
    ? { value: value.toFixed(2), unit: "ms" }
    : { value: "0.01", unit: "ms 미만" };
}

/** 그룹별 통과 건수와 실행 시각 — 큰 숫자 아래에서 내역을 확인하는 줄입니다. */
function detailRows(result: EngineSelfCheckResult): { k: string; v: string; tone?: "warn" }[] {
  const rows = result.groups.map((group) => ({
    k: group.label,
    v: `${group.passed} / ${group.total} 통과`,
    tone: group.passed === group.total ? undefined : ("warn" as const),
  }));
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
  const latency = result ? ms(result.p95Ms) : null;

  return (
    <section
      aria-labelledby="rule-engine-proof-title"
      className={cx("rounded-card bg-paper-2 p-4", className)}
    >
      <h3
        id="rule-engine-proof-title"
        className="text-[1.0625rem] leading-[1.4] font-extrabold text-ink"
      >
        규칙 엔진 검증 — 경계 케이스
      </h3>
      <p className="mt-2 text-[0.9375rem] leading-[1.6] text-ink-soft">
        규칙 사전과 시간 규칙이 단독으로 판정하는 {RULE_ENGINE_ITEM_IDS.length}항목(그중 안전
        직결 {RULE_ENGINE_CF_ITEM_IDS.length}항목)을 경계 문장으로 때려 본 기록입니다. 아래
        「지금 돌려보기」를 누르면 같은 케이스를 이 기기에서 다시 돌립니다. 설계 문서 시점의
        케이스는 30건이었고, 그 뒤 사투리 말씨·부정 표현 경계를 더해 지금은 실측 칸의 수만큼
        늘었습니다 — 그날 30건도 전부 그대로 들어 있습니다.
      </p>

      <p className="mt-4 text-[0.7813rem] leading-[1.5] font-bold tracking-[0.04em] text-ink-muted">
        설계 문서 검증 계단 ① 실행 로그 — 옮겨 적은 값
      </p>
      <dl className="chim-hairline mt-1 border-y border-line">
        {QUOTED_ROWS.map((row) => (
          <Row key={row.k} k={row.k} v={row.v} />
        ))}
      </dl>

      <div className="mt-4">
        <BigButton onClick={run} variant="secondary" disabled={running} block>
          {running ? "돌리는 중…" : `지금 이 브라우저에서 ${totalCases}건 돌려보기`}
        </BigButton>
      </div>

      {result && latency && (
        <>
          <p className="mt-5 text-[0.7813rem] leading-[1.5] font-bold tracking-[0.04em] text-brand-800">
            방금 이 기기에서 잰 값
          </p>
          <div className="mt-2 grid gap-2">
            <MeasuredStat
              value={`${result.passed} / ${result.total}`}
              unit="통과"
              label="경계 케이스"
              tone={failed === 0 ? undefined : "warn"}
            />
            <MeasuredStat
              value={latency.value}
              unit={latency.unit}
              label={`판정 지연 (p95 · ${result.repeat}회 평균)`}
            />
          </div>
          <dl className="chim-hairline mt-4 border-y border-line">
            {detailRows(result).map((row) => (
              <Row key={row.k} k={row.k} v={row.v} tone={row.tone} />
            ))}
          </dl>
          <p aria-live="polite" className="mt-3 text-[0.9375rem] leading-[1.6] text-ink">
            {failed === 0
              ? `${result.total}건 전수 통과했습니다. 케이스 목록은 앱 안에 그대로 담겨 있어, 언제 다시 돌려도 같은 목록으로 검사합니다.`
              : `${failed}건이 기대와 다르게 판정됐습니다.`}
          </p>
          {result.groups
            .flatMap((group) => group.failures)
            .map((failure) => (
              <p key={failure} className="mt-1 text-[0.9375rem] leading-[1.6] text-danger-ink">
                {failure}
              </p>
            ))}
        </>
      )}

      {/* 출처와 한계를 같은 크기로 적습니다 — 두 칸의 숫자가 섞여 읽히면 안 되는 값입니다. */}
      <p className="mt-4 text-[0.7813rem] leading-[1.6] text-ink-muted">
        위 칸은 설계 문서에 실린 값이고, 아래 칸은 방금 이 브라우저에서 잰 값입니다. 기기 성능에
        따라 지연 값은 달라집니다 — 통과 건수는 기기와 무관하게 같아야 합니다.
      </p>
    </section>
  );
}

export default RuleEngineProof;
