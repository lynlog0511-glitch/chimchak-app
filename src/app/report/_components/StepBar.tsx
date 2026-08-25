import { cx } from "@/components";

export interface StepBarProps {
  /** 현재 단계 (1 말하기 · 2 가리기 · 3 확인) */
  current: 1 | 2 | 3;
  /** 확정까지 마쳤는지 — true면 3단계도 완료로 표시합니다. */
  finished?: boolean;
}

const STEPS: { n: 1 | 2 | 3; mark: string; label: string }[] = [
  { n: 1, mark: "①", label: "말하기" },
  { n: 2, mark: "②", label: "가리기" },
  { n: 3, mark: "③", label: "확인" },
];

/**
 * 기록 코칭 3단계 인디케이터 — 시안 6e의 **텍스트 + 헤어라인**입니다.
 *
 * 세그먼트 막대를 쓰지 않습니다: 「① 말하기 ✓ — ② 가리기 — ③ 확인」 한 줄이
 * 지나온 곳·지금 있는 곳·남은 곳을 그대로 말합니다(완료 ok-ink ✓ · 활성 brand-700 800 · 대기 ink-disabled).
 *
 * 색만으로 상태를 말하지 않도록 ✓ 기호와 스크린리더 문구를 함께 둡니다.
 *
 * 2026-08-25 대기 단계 색 교정. 「② 가리기」·「③ 확인」이 `ink-disabled`(#9aa5a2 · 흰 지면
 * 2.54:1)였습니다 — globals.css 주석이 「읽어야 하는 고지에는 쓰지 마세요」라고 못 박은
 * 토큰입니다. 하필 이 두 낱말이 「말한 내용을 가린 뒤에 저장한다」는 순서를 예고하는,
 * 이 화면이 주는 가장 큰 안심입니다. 앞으로 뭘 할지가 안 보이면 스텝 바가 스텝 바 노릇을
 * 못 합니다(페르소나 디자이너 low).
 * 대기는 `ink-muted`(6.27:1)로 올리고, 「지금 여기」는 색이 아니라 **굵기**로 가릅니다 —
 * 완료는 ✓ + ok-ink가 이미 따로 서 있어 세 상태가 갈립니다.
 */
export function StepBar({ current, finished = false }: StepBarProps) {
  return (
    <nav aria-label="기록 코칭 진행 단계">
      <ol className="flex items-center gap-[8px] text-[0.7813rem] leading-[1.45] font-semibold">
        {STEPS.map((step, index) => {
          const done = finished || step.n < current;
          const active = !finished && step.n === current;
          return (
            <li
              key={step.n}
              aria-current={active ? "step" : undefined}
              className={cx(
                "flex items-center gap-[8px]",
                index > 0 ? "min-w-0 flex-1" : "flex-none",
              )}
            >
              {index > 0 && <span aria-hidden className="h-px flex-1 bg-line" />}
              <span
                className={cx(
                  "flex-none whitespace-nowrap",
                  done
                    ? "text-ok-ink"
                    : active
                      ? "font-extrabold text-brand-700"
                      : "text-ink-muted",
                )}
              >
                <span aria-hidden>{step.mark} </span>
                {step.label}
                {done && <span aria-hidden> ✓</span>}
                <span className="sr-only">
                  {" "}
                  {step.n}단계 · {done ? "마쳤습니다" : active ? "지금 여기입니다" : "아직입니다"}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default StepBar;
