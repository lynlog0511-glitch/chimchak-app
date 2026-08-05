import { cx } from "@/components";

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
 * 기록 코칭 3단계 진행 표시 — **세그먼트 3칸**입니다 (v4 §3 세션 진행바와 같은 문법).
 *
 * 칸마다 상자를 두르지 않고 3px 막대 세 개로만 위치를 알리고,
 * 지금 무엇을 하는 단계인지는 아래 한 줄로 말합니다.
 */
export function StepBar({ current, finished = false }: StepBarProps) {
  const active = STEPS.find((step) => step.n === current) ?? STEPS[0];

  return (
    <nav aria-label="기록 코칭 진행 단계">
      <div aria-hidden className="flex gap-[5px]">
        {STEPS.map((step) => (
          <span
            key={step.n}
            className={cx(
              "h-[3px] flex-1 rounded-full",
              finished || step.n <= current ? "bg-brand-600" : "bg-line",
            )}
          />
        ))}
      </div>

      <p className="mt-[8px] text-[12px] leading-[1.5] text-ink-muted">
        {finished ? (
          <span className="font-bold text-brand-800">3단계 모두 마쳤습니다</span>
        ) : (
          <>
            <span className="chim-num font-bold text-brand-800">{active.n}</span>
            <span className="chim-num"> / {STEPS.length}</span>{" "}
            <span className="font-bold text-ink">· {active.title}</span> — {active.desc}
          </>
        )}
      </p>
    </nav>
  );
}

export default StepBar;
