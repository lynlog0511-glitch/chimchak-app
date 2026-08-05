import { IconArrowRight } from "@/components/icons";
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
 * 가명처리 경로 — 개인정보가 지나가는 길을 화살표 파이프라인 한 줄로 보여 줍니다.
 *
 * md 이상: 단계 이름만 한 줄로 이어 붙인 파이프라인 + 아래에 단계별 설명 목록.
 * md 미만: 파이프라인을 접고 세로 목록만 남깁니다(가로 스크롤 없음).
 *
 * 파이프라인 줄은 목록과 같은 내용이라 보조기기에서는 한 번만 읽히게 했습니다.
 *
 * v3 반영: 단계 칩은 보더 대신 옅은 면(`paper-2`)으로 세웁니다(§7).
 * 크기는 단계 이름 15px·설명 15px·번호 13px — 표와 같은 단으로 두어 본문(16)보다 조용하게(§3).
 *
 * @example <MaskingPipeline steps={PRIVACY_STEPS} />
 */
export function MaskingPipeline({ steps, className }: MaskingPipelineProps) {
  return (
    <div className={cx(className)}>
      {/* 한 줄 파이프라인 — 아래 목록과 같은 내용이므로 보조기기에서는 건너뜁니다. */}
      <div className="hidden items-stretch gap-1.5 md:flex" aria-hidden="true">
        {steps.map((s, i) => (
          <div key={s.step} className="flex flex-1 items-stretch gap-1.5">
            {i > 0 && (
              <span className="flex shrink-0 items-center">
                <IconArrowRight className="h-5 w-5 text-ink-muted" />
              </span>
            )}
            <span className="flex flex-1 flex-col items-center justify-center rounded-field bg-paper-2 px-2 py-3 text-center">
              <span className="chim-num chim-caption font-bold text-brand-700">{i + 1}</span>
              <span className="mt-0.5 text-[0.9375rem] leading-snug font-bold text-ink">
                {s.step}
              </span>
            </span>
          </div>
        ))}
      </div>

      <ol className="border-b border-line md:mt-6">
        {steps.map((s, i) => (
          <li key={s.step} className="grid gap-x-8 border-t border-line py-4 md:grid-cols-12">
            <p className="flex items-baseline gap-2 md:col-span-4">
              <span className="chim-num chim-caption font-extrabold text-brand-700">{i + 1}</span>
              <span className="chim-body font-extrabold text-ink">{s.step}</span>
            </p>
            <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-soft md:col-span-8 md:mt-0">
              {s.desc}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default MaskingPipeline;
