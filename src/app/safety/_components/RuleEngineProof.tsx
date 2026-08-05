import { CRITICAL_FAIL_ITEM_IDS, RULE_JUDGED_ITEM_IDS } from "@/data/rubric";
import { cx } from "@/components/utils";

/**
 * 규칙 엔진 검증 — **실행 로그**를 그대로 적어 두는 카드입니다.
 *
 * 이 화면의 다른 숫자(「지금 이 기기에서 — 실시간 계측」)는 지금 재는 값이고,
 * 이 카드의 숫자는 **2026.7.27에 한 번 돌린 결과**입니다. 둘을 섞으면 안 되므로
 * 카드 안에 그 차이를 적었습니다 — 방금 잰 척하지 않습니다.
 *
 * 항목 수는 문장에 적어 두지 않고 `src/data/rubric.ts`에서 세어 옵니다(설계서 §5.2).
 * 데이터가 바뀌면 이 카드도 같이 바뀝니다.
 *
 * 형태는 v4 §2 — 보더·그림자 없이 면(r14) 하나 + 헤어라인 행. 큰 숫자 타일은 쓰지 않습니다
 * (실시간 계측 패널과 같은 문법을 쓰면 실측치로 오해되기 때문입니다).
 */

export interface RuleEngineProofProps {
  className?: string;
}

/** 실행 로그 한 줄 — [무엇을 쟀나 / 값]. 값은 tabular로 세웁니다. */
const LOG_ROWS: readonly { k: string; v: string }[] = [
  { k: "경계 케이스", v: "30 / 30 전수 통과" },
  { k: "판정 지연 (p95)", v: "0.11 ms" },
  { k: "실행 일자", v: "2026. 7. 27." },
];

export function RuleEngineProof({ className }: RuleEngineProofProps) {
  const ruleCount = RULE_JUDGED_ITEM_IDS.length;
  const cfCount = CRITICAL_FAIL_ITEM_IDS.length;

  return (
    <section
      aria-labelledby="rule-engine-proof-title"
      className={cx("rounded-[14px] bg-paper-2 px-[15px] py-[14px]", className)}
    >
      <h3
        id="rule-engine-proof-title"
        className="text-[0.875rem] leading-[1.45] font-extrabold text-ink"
      >
        규칙 엔진 검증 — 실행 로그
      </h3>
      <p className="mt-[6px] text-[0.8125rem] leading-[1.6] text-ink-soft">
        규칙 엔진이 단독으로 판정하는 {ruleCount}항목(그중 안전 직결 {cfCount}항목)을 경계
        문장으로 때려 본 기록입니다.
      </p>

      <dl className="chim-hairline mt-[10px] border-y border-line">
        {LOG_ROWS.map((row) => (
          <div key={row.k} className="flex items-baseline gap-[10px] py-[10px]">
            <dt className="min-w-0 flex-1 text-[0.8125rem] leading-[1.5] text-ink-muted">{row.k}</dt>
            <dd className="chim-num flex-none text-[0.9063rem] leading-[1.5] font-extrabold text-ink">
              {row.v}
            </dd>
          </div>
        ))}
      </dl>

      {/* 출처와 한계를 같은 크기로 적습니다 — 실측 패널의 숫자와 섞이면 안 되는 값이라, 캡션 톤으로 흘리지 않습니다. */}
      <p className="mt-[9px] text-[0.75rem] leading-[1.6] text-ink-soft">
        기획서 [그림 7] 실행 로그를 그대로 옮긴 값입니다. 이 화면에서 방금 잰 숫자가 아닙니다 —
        지금 재는 값은 위 「지금 이 기기에서 — 실시간 계측」 두 칸뿐입니다.
      </p>
    </section>
  );
}

export default RuleEngineProof;
