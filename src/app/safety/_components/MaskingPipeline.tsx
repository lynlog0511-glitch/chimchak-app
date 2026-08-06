import { cx } from "@/components/utils";
import { PlanTag } from "./PlanTag";

export interface MaskingStep {
  /** 단계 이름 (예: 1차 가명처리) */
  step: string;
  /** 그 단계에서 **지금** 일어나는 일 */
  desc: string;
  /** 설계는 끝났지만 아직 구현하지 않은 부분 — 「계획」 배지를 달아 구현물과 갈라 놓습니다. */
  plan?: string;
}

export interface MaskingPipelineProps {
  steps: readonly MaskingStep[];
  className?: string;
}

/**
 * 가명처리 경로 — 개인정보가 지나가는 길을 번호 붙은 세로 목록으로 보여 줍니다.
 *
 * v4에서 화면 폭이 430px 앱 프레임으로 고정되면서, 6단계를 가로로 늘어놓던 장식 파이프라인
 * 줄은 걷어냈습니다(칸 하나가 65px이라 단계 이름이 두 줄로 접혔고, 그 줄은 아래 목록과
 * 같은 내용을 aria-hidden으로 되풀이할 뿐이었습니다). 내용은 그대로입니다.
 *
 * 형태는 v4 §2 리스트 문법 — 아이콘 없이 [번호 + 단계 이름 + 한 문장], 행 사이 hairline.
 * 눈금은 이 화면의 것과 같습니다 — 단계 이름 17 · 설명 15 · 번호 15(tabular).
 *
 * @example <MaskingPipeline steps={PRIVACY_STEPS} />
 */
export function MaskingPipeline({ steps, className }: MaskingPipelineProps) {
  return (
    <ol className={cx("chim-hairline border-y border-line", className)}>
      {steps.map((s, i) => (
        <li key={s.step} className="flex gap-3 py-4">
          <span
            aria-hidden
            className="chim-num w-[1rem] flex-none text-[0.9375rem] leading-[1.4] font-extrabold text-brand-700"
          >
            {i + 1}
          </span>
          <div className="min-w-0">
            <p className="text-[1.0625rem] leading-[1.4] font-extrabold text-ink">{s.step}</p>
            <p className="mt-1 text-[0.9375rem] leading-[1.6] text-ink-muted">{s.desc}</p>
            {/* 「지금 되는 것」 아래에 「계획」을 따로 세웁니다 — 같은 문단에 섞으면 구별되지 않습니다. */}
            {s.plan && (
              <p className="mt-2 text-[0.9375rem] leading-[1.6] text-ink-muted">
                <PlanTag className="mr-2" />
                {s.plan}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

export default MaskingPipeline;
