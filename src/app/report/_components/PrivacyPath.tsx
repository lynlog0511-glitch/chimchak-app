import { EyebrowLabel, cx } from "@/components";

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
 * 보고 내용이 지나가는 경로 (v4 언어).
 *
 * 「기기 밖으로 나가는 것은 가명처리 2단을 통과한 텍스트뿐」이라는 경계를 화면에 고정 표시합니다.
 * 형태는 세그먼트 5칸 + hairline 행이고, 색 면은 마지막 경계 안내 하나뿐입니다.
 */
export function PrivacyPath({ reached, className }: PrivacyPathProps) {
  return (
    <section aria-label="보고 내용이 지나가는 경로" className={className}>
      <EyebrowLabel className="mb-[8px]">이 보고가 지나가는 길</EyebrowLabel>

      <div aria-hidden className="flex gap-[5px]">
        {PATH.map((step) => (
          <span
            key={step.n}
            className={cx(
              "h-[3px] flex-1 rounded-full",
              step.n <= reached ? "bg-brand-600" : "bg-line",
            )}
          />
        ))}
      </div>

      <ol className="chim-hairline mt-[10px] border-t border-line">
        {PATH.map((step) => {
          const done = step.n < reached;
          const active = step.n === reached;
          return (
            <li key={step.n} aria-current={active ? "step" : undefined} className="py-[9px]">
              <p
                className={cx(
                  "text-[0.8438rem] leading-[1.45] font-bold",
                  active ? "text-brand-800" : done ? "text-ink" : "text-tertiary",
                )}
              >
                <span className="chim-num">{step.n}</span>. {step.title}
                {active && <span className="ml-[6px] text-[0.6875rem] font-bold">지금 여기</span>}
                <span className="sr-only">
                  {done ? " 지나온 단계" : active ? " 현재 단계" : " 다음 단계"}
                </span>
              </p>
              <p
                className={cx(
                  "mt-[2px] text-[0.7813rem] leading-[1.6]",
                  step.n <= reached ? "text-ink-soft" : "text-tertiary",
                )}
              >
                {step.desc}
              </p>
            </li>
          );
        })}
      </ol>

      {/* 이 화면에서 색 면으로 남기는 블록은 이 경계 안내 하나입니다. */}
      <div className="mt-[14px] rounded-[14px] bg-warn-soft px-4 py-[14px]">
        <p className="text-[0.8438rem] leading-[1.6] font-bold text-warn-ink">
          이 데모에서는 기기 밖으로 나가는 것이 없습니다.
        </p>
        <p className="mt-[6px] text-[0.7813rem] leading-[1.6] text-ink-soft">
          말한 음성과 원문은 이 기기 안에만 있고 저장하지 않습니다. 가명처리 대상은
          성명·번호·기관명·주소·생년이며, 처리 후에도 가명정보로 다룹니다.
        </p>
        {/* 「기기 밖으로 나가는 것은 …뿐입니다」는 나가는 경로가 있다는 뜻으로 읽힙니다 —
            연동이 아직 없으므로 지금 사실과 설계 약속을 나눠 적습니다. */}
        <p className="mt-[6px] text-[0.7813rem] leading-[1.6] text-ink-soft">
          기관 시스템 연동은 설계 단계입니다. 연동하게 되더라도 기기 밖으로 나가는 것은 가명처리
          2단을 통과한 텍스트뿐이도록 설계했습니다.
        </p>
      </div>
    </section>
  );
}

export default PrivacyPath;
