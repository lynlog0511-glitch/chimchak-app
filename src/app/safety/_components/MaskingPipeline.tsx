import { cx } from "@/components/utils";

export interface MaskingStep {
  /** 단계 이름 (예: 1차 가명처리) */
  step: string;
  /** 그 단계에서 실제로 일어나는 일 */
  desc: string;
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
 *
 * @example <MaskingPipeline steps={PRIVACY_STEPS} />
 */
export function MaskingPipeline({ steps, className }: MaskingPipelineProps) {
  return (
    <ol className={cx("chim-hairline border-y border-line", className)}>
      {steps.map((s, i) => (
        <li key={s.step} className="flex gap-[10px] py-[13px]">
          <span
            aria-hidden
            className="chim-num w-[13px] flex-none text-[13px] leading-[1.5] font-extrabold text-brand-700"
          >
            {i + 1}
          </span>
          <div className="min-w-0">
            <p className="text-[14px] leading-[1.45] font-bold text-ink">{s.step}</p>
            <p className="mt-[2px] text-[12.5px] leading-[1.6] text-ink-muted">{s.desc}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default MaskingPipeline;
