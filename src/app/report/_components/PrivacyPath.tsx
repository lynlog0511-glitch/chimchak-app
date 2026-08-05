import { cx } from "@/components";
import { IconCheck } from "@/components/icons";

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
 *
 * 크기 체계(§3): 다섯 칸은 참고 정보라 제목 14px · 설명 13px로 조용히 둡니다.
 * 대신 마지막 경계 안내 한 문장만 17px로 세워, 이 화면에서 읽어야 할 것을 하나로 좁힙니다.
 * 형태(§1-2·§1-4): 칸마다 상자를 두르지 않고 얇은 상단 레일로만 진행 상태를 알립니다.
 */
export function PrivacyPath({ reached, className }: PrivacyPathProps) {
  return (
    <section aria-label="보고 내용이 지나가는 경로" className={className}>
      <p className="chim-label text-ink">
        이 보고가 지나가는 길 — 개인정보는 이 한 줄로만 움직입니다
      </p>

      <ol className="mt-3 grid gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-5">
        {PATH.map((step) => {
          const done = step.n < reached;
          const active = step.n === reached;
          return (
            <li key={step.n}>
              <div
                aria-current={active ? "step" : undefined}
                className={cx(
                  "flex h-full flex-col border-t-2 pt-2.5",
                  active ? "border-brand-600" : done ? "border-ok" : "border-line",
                )}
              >
                <span className="flex items-center gap-2">
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
                  <span
                    className={cx("chim-meta font-bold", active ? "text-ink" : "text-ink-soft")}
                  >
                    {step.title}
                  </span>
                </span>
                <span className="chim-caption mt-1.5 block leading-relaxed text-ink-muted">
                  {step.desc}
                </span>
              </div>
            </li>
          );
        })}
      </ol>

      {/* 이 화면에서 색 면으로 남기는 블록은 이 경계 안내 하나입니다(§1-3). 보더는 쓰지 않습니다. */}
      <div className="mt-4 rounded-card bg-warn-soft p-4 md:p-5">
        <p className="chim-core-sm font-bold text-warn-ink">
          기기 밖으로 나가는 것은 가명처리 2단을 통과한 텍스트뿐입니다.
        </p>
        <p className="chim-meta mt-2 leading-relaxed text-ink-soft">
          말한 음성과 원문은 이 기기 안에만 있고 저장하지 않습니다. 가명처리 대상은
          성명·번호·기관명·주소·생년이며, 처리 후에도 가명정보로 다룹니다.
        </p>
      </div>
    </section>
  );
}

export default PrivacyPath;
