import { ChevronGlyph, cx } from "@/components";

export interface PrivacyPathProps {
  /**
   * 지금까지 통과한 마지막 단계의 번호(1~5).
   * 1 마이크 · 2 기기 안 처리 · 3 가리기 · 4 확정 전 한 번 더 · 5 저장
   */
  reached: number;
  className?: string;
}

/**
 * 접힘 안쪽에서 보여 주는 경로 설명.
 *
 * 진행 막대는 다섯 칸 그대로이고, 설명 줄만 넷입니다 — 가리는 자리는 두 번이지만
 * 사용자에게는 「가리기」 한 가지 일이라 한 줄로 묶고, 두 번이라는 사실은 문장으로 적습니다.
 */
const PATH: { from: number; to: number; title: string; desc: string }[] = [
  { from: 1, to: 1, title: "마이크", desc: "버튼을 누르는 동안에만 켜집니다. 상시 청취는 없습니다." },
  {
    from: 2,
    to: 2,
    title: "기기 안에서 처리",
    desc: "가리기와 초안 만들기는 기기 안에서 합니다. 음성 인식만 브라우저 내장 기능을 씁니다.",
  },
  {
    from: 3,
    to: 4,
    title: "가리기",
    desc: "성명·번호·기관명·주소·생년을 가립니다. 한 번 가리고, 확정 전에 한 번 더 확인합니다.",
  },
  { from: 5, to: 5, title: "저장", desc: "확정한 글만 이 기기에 남습니다." },
];

/** 진행 막대 칸 번호 — 설명 줄이 넷으로 묶여도 눈금은 다섯 칸 그대로 둡니다. */
const SEGMENTS = [1, 2, 3, 4, 5];

/**
 * 보고 내용이 지나가는 경로.
 *
 * 화면에 상주하는 것은 요약 한 줄과 경계 안내뿐이고, 다섯 칸짜리 경로는 접어 둡니다 —
 * 보고를 쓰는 사람에게 필요한 것은 「어디로 가는가」 한 줄이고, 그 뒤의 단계는 보고 싶을 때만
 * 펼치면 됩니다. 펼침 표시의 회전은 `globals.css`가 reduced-motion에서 정지시킵니다.
 */
export function PrivacyPath({ reached, className }: PrivacyPathProps) {
  return (
    <section aria-label="보고 내용이 지나가는 경로" className={className}>
      {/* 기본으로 보이는 것은 이 한 줄입니다. */}
      <p className="text-[0.8438rem] leading-[1.6] font-semibold text-ink-soft">
        마이크 → 기기 안에서 가리기 → 가려진 글만 저장
      </p>

      <details className="group mt-[6px] border-y border-line">
        <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 rounded-field px-[2px] text-[0.8438rem] leading-[1.45] font-bold text-ink-soft transition-colors duration-150 active:bg-paper-2 [&::-webkit-details-marker]:hidden">
          <span>내 말이 어디로 가는지 보기</span>
          {/* 동봉 Pretendard cmap에 U+2304 `⌄`가 없어 SVG 글리프를 씁니다(MaskReview와 같은 조각). */}
          <ChevronGlyph className="text-faint group-open:rotate-180" />
        </summary>

        <div className="pb-4">
          <div aria-hidden className="flex gap-[5px]">
            {SEGMENTS.map((n) => (
              <span
                key={n}
                className={cx(
                  "h-[3px] flex-1 rounded-full",
                  n <= reached ? "bg-brand-600" : "bg-line",
                )}
              />
            ))}
          </div>

          <ol className="chim-hairline mt-[10px] border-t border-line">
            {PATH.map((step) => {
              const done = reached > step.to;
              const active = reached >= step.from && reached <= step.to;
              return (
                <li
                  key={step.title}
                  aria-current={active ? "step" : undefined}
                  className="py-[9px]"
                >
                  <p
                    className={cx(
                      "text-[0.8438rem] leading-[1.45] font-bold",
                      active ? "text-brand-800" : done ? "text-ink" : "text-tertiary",
                    )}
                  >
                    {step.title}
                    {active && <span className="ml-[6px] text-[0.6875rem] font-bold">지금 여기</span>}
                    <span className="sr-only">
                      {done ? " 지나온 단계" : active ? " 현재 단계" : " 다음 단계"}
                    </span>
                  </p>
                  <p
                    className={cx(
                      "mt-[2px] text-[0.7813rem] leading-[1.6]",
                      reached >= step.from ? "text-ink-soft" : "text-tertiary",
                    )}
                  >
                    {step.desc}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      </details>

      {/* 이 화면에서 색 면으로 남기는 블록은 이 경계 안내 하나입니다. */}
      <div className="mt-[14px] rounded-[14px] bg-warn-soft px-4 py-[14px]">
        <p className="text-[0.8438rem] leading-[1.6] font-bold text-warn-ink">
          지금은 기기 밖으로 나가는 것이 없습니다.
        </p>
        <p className="mt-[6px] text-[0.7813rem] leading-[1.6] text-ink-soft">
          말한 음성과 원문은 이 기기 안에만 있고 저장하지 않습니다. 가명처리 대상은
          성명·번호·기관명·주소·생년이며, 처리 후에도 가명정보로 다룹니다.
        </p>
        {/* 기관 시스템 이야기는 확정 화면의 「계획」 한 곳에서만 합니다 —
            같은 고백을 두 화면에서 되풀이하면 보고를 쓰는 자리가 로드맵 설명으로 바뀝니다. */}
      </div>
    </section>
  );
}

export default PrivacyPath;
