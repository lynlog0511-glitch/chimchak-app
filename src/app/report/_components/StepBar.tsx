import { cx } from "@/components";
import { IconCheck } from "@/components/icons";

export interface StepBarProps {
  /** 현재 단계 (1 입력 · 2 가명처리 · 3 초안) */
  current: 1 | 2 | 3;
  /** 확정까지 마쳤는지 — true면 3단계도 완료로 표시합니다. */
  finished?: boolean;
}

const STEPS: { n: 1 | 2 | 3; title: string; desc: string }[] = [
  { n: 1, title: "말하기 · 쓰기", desc: "마이크는 누르는 동안만 켜집니다." },
  { n: 2, title: "가명처리 확인", desc: "무엇을 왜 가렸는지 보여 드립니다." },
  { n: 3, title: "기록 초안 확정", desc: "5요소를 채우고 확정합니다." },
];

/** 기록 코칭 3단계 위저드의 진행 표시줄입니다. */
export function StepBar({ current, finished = false }: StepBarProps) {
  return (
    <nav aria-label="기록 코칭 진행 단계">
      <ol className="grid gap-3 sm:grid-cols-3">
        {STEPS.map((step) => {
          const done = finished || step.n < current;
          const active = !finished && step.n === current;
          return (
            <li key={step.n}>
              <div
                aria-current={active ? "step" : undefined}
                className={cx(
                  // 색 배경은 '지금 단계' 하나에만 둡니다 — 끝난 단계는 선으로만 표시합니다.
                  "flex h-full items-start gap-3 rounded-card border p-4 transition-colors duration-150",
                  active
                    ? "border-brand-300 bg-brand-50"
                    : done
                      ? "border-ok-line bg-white"
                      : "border-line bg-white",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cx(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-chip text-base font-extrabold",
                    active
                      ? "bg-brand-700 text-white"
                      : done
                        ? "bg-ok text-white"
                        : "bg-neutral-soft text-ink-muted",
                  )}
                >
                  {done ? <IconCheck className="h-5 w-5" /> : step.n}
                </span>
                <span className="min-w-0">
                  <span className="block text-base font-extrabold text-ink">
                    <span className="sr-only">
                      {done ? "완료된 단계 " : active ? "현재 단계 " : "다음 단계 "}
                    </span>
                    {step.n}. {step.title}
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-ink-soft">
                    {step.desc}
                  </span>
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default StepBar;
