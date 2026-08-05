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

/**
 * 기록 코칭 3단계 위저드의 진행 표시줄입니다.
 *
 * 크기 체계(§3): 이 줄은 화면의 주인공이 아니라 UI 크롬이라 제목 14px · 설명 13px입니다.
 * 형태(§1-4·§7): 칸마다 상자를 두르지 않고, 얇은 상단 레일 하나로 진행 상태만 알립니다.
 */
export function StepBar({ current, finished = false }: StepBarProps) {
  return (
    <nav aria-label="기록 코칭 진행 단계">
      <ol className="grid gap-x-5 gap-y-3 sm:grid-cols-3">
        {STEPS.map((step) => {
          const done = finished || step.n < current;
          const active = !finished && step.n === current;
          return (
            <li key={step.n}>
              <div
                aria-current={active ? "step" : undefined}
                className={cx(
                  "flex h-full items-start gap-2.5 border-t-2 pt-3 transition-colors duration-150",
                  active ? "border-brand-600" : done ? "border-ok" : "border-line",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cx(
                    "chim-num chim-caption flex h-6 w-6 shrink-0 items-center justify-center rounded-chip font-extrabold",
                    active
                      ? "bg-brand-700 text-white"
                      : done
                        ? "bg-ok-soft text-ok-ink"
                        : "bg-neutral-soft text-ink-muted",
                  )}
                >
                  {done ? <IconCheck className="h-4 w-4" /> : step.n}
                </span>
                <span className="min-w-0">
                  <span
                    className={cx("chim-meta block font-bold", active ? "text-ink" : "text-ink-soft")}
                  >
                    <span className="sr-only">
                      {done ? "완료된 단계 " : active ? "현재 단계 " : "다음 단계 "}
                    </span>
                    {step.n}. {step.title}
                  </span>
                  <span className="chim-caption mt-0.5 block text-ink-muted">{step.desc}</span>
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
