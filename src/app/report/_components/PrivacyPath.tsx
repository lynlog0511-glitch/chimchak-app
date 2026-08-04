import { Card, cx } from "@/components";

export interface PrivacyPathProps {
  /**
   * 지금까지 통과한 마지막 단계의 번호(1~5).
   * 1 마이크 · 2 기기 안 처리 · 3 1차 가명처리 · 4 2차 가명처리 · 5 저장
   */
  reached: number;
  className?: string;
}

const PATH: { n: number; title: string; desc: string }[] = [
  { n: 1, title: "마이크", desc: "버튼을 누르는 동안에만 켜집니다. 상시 청취는 없습니다." },
  {
    n: 2,
    title: "기기 안 처리",
    desc: "가명처리와 초안 만들기는 기기 안에서 합니다. 음성 인식만 브라우저 내장 기능을 씁니다.",
  },
  { n: 3, title: "1차 가명처리", desc: "성명·번호·기관명·주소·생년을 가립니다." },
  { n: 4, title: "2차 가명처리", desc: "확정 직전에 한 번 더 검사합니다." },
  { n: 5, title: "저장", desc: "확정한 텍스트만 이 기기에 남습니다." },
];

/**
 * 보고 내용이 지나가는 경로를 단계로 보여 줍니다.
 * 「기기 밖으로 나가는 것은 가명처리 2단을 통과한 텍스트뿐」이라는 경계를 화면에 고정 표시합니다.
 */
export function PrivacyPath({ reached, className }: PrivacyPathProps) {
  return (
    <section aria-label="보고 내용이 지나가는 경로" className={className}>
      <p className="text-base font-extrabold text-ink">
        이 보고가 지나가는 길 — 개인정보는 이 한 줄로만 움직입니다
      </p>

      <ol className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {PATH.map((step) => {
          const done = step.n < reached;
          const active = step.n === reached;
          return (
            <li key={step.n}>
              <div
                aria-current={active ? "step" : undefined}
                className={cx(
                  "flex h-full flex-col rounded-card border p-3.5",
                  active
                    ? "border-brand-300 bg-brand-50"
                    : done
                      ? "border-ok-line bg-ok-soft"
                      : "border-line bg-white",
                )}
              >
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={cx(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-chip text-sm font-extrabold",
                      active
                        ? "bg-brand-700 text-white"
                        : done
                          ? "bg-ok text-white"
                          : "bg-neutral-soft text-ink-muted",
                    )}
                  >
                    {done ? "✓" : step.n}
                  </span>
                  <span className="text-base font-bold text-ink">{step.title}</span>
                </span>
                <span className="mt-2 text-sm leading-relaxed text-ink-soft">{step.desc}</span>
              </div>
            </li>
          );
        })}
      </ol>

      <Card tone="warn" className="mt-3">
        <p className="text-base leading-relaxed font-bold text-warn-ink">
          기기 밖으로 나가는 것은 가명처리 2단을 통과한 텍스트뿐입니다.
        </p>
        <p className="mt-2 text-base leading-relaxed text-ink">
          말한 음성과 원문은 이 기기 안에만 있고 저장하지 않습니다. 가명처리 대상은
          성명·번호·기관명·주소·생년이며, 처리 후에도 가명정보로 다룹니다.
        </p>
      </Card>
    </section>
  );
}

export default PrivacyPath;
