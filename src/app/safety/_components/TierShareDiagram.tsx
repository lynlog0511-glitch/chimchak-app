import { cx } from "@/components/utils";

/**
 * AI 지분 막대 (시안 7b) — "위험할수록 AI의 지분이 줄어듭니다"를 문장이 아니라 **그림**으로 보입니다.
 *
 * 세 줄뿐입니다. L1은 길고, L2는 3분의 1이며, L3은 **아예 없습니다**(0%).
 * 0% 막대는 눈에 보이지 않으므로 뜻은 오른쪽 「생성 0건」이 danger-ink로 대신 말합니다 —
 * 색과 길이가 사라져도 문장은 남습니다.
 *
 * px·hex는 시안 그대로입니다: 카드 보더 1px r14 · 라벨 56px/12.5 · 막대 h10 r5 · 우측 주석 70px/11.5.
 * 막대는 장식(aria-hidden)이고, 화면낭독기에는 줄마다 한 문장을 따로 읽어 줍니다.
 */

interface TierRow {
  /** L1 대화 · L2 채점 · L3 응급 */
  label: string;
  /** 막대 길이 = AI가 쥐는 지분 */
  pct: number;
  /** 막대 색 (틸 → 옅은 틸 → 빨강) */
  bar: string;
  /** 오른쪽 한 마디 */
  note: string;
  /** 그 한 마디의 톤 — L3만 강조합니다. */
  noteClass?: string;
  /** 화면낭독기에 읽어 줄 한 문장 */
  say: string;
}

const ROWS: readonly TierRow[] = [
  {
    label: "L1 대화",
    pct: 88,
    bar: "bg-brand-600",
    note: "역할 연기만",
    say: "L1 대화 단계 — AI 지분 88퍼센트, 어르신 역할 연기만 맡습니다.",
  },
  {
    label: "L2 채점",
    pct: 34,
    bar: "bg-brand-400",
    note: "규칙 사전",
    say: "L2 채점 단계 — AI 지분 34퍼센트, 나머지는 규칙 사전이 판정합니다.",
  },
  {
    label: "L3 응급",
    pct: 0,
    bar: "bg-danger",
    note: "생성 0건",
    noteClass: "font-bold text-danger-ink",
    say: "L3 응급 단계 — AI 지분 0퍼센트, 생성 0건입니다.",
  },
];

export interface TierShareDiagramProps {
  className?: string;
}

export function TierShareDiagram({ className }: TierShareDiagramProps) {
  return (
    <div className={cx("rounded-[14px] border border-line px-[15px] py-[14px]", className)}>
      <ul>
        {ROWS.map((row, i) => (
          <li
            key={row.label}
            className={cx("flex items-center gap-[10px]", i < ROWS.length - 1 && "mb-[11px]")}
          >
            <span className="w-[56px] flex-none text-[12.5px] leading-[1.4] font-bold text-ink">
              {row.label}
            </span>
            <span
              aria-hidden
              className="h-[10px] min-w-0 flex-1 overflow-hidden rounded-[5px] bg-paper-out"
            >
              <span
                className={cx("block h-full rounded-[5px]", row.bar)}
                style={{ width: `${row.pct}%` }}
              />
            </span>
            <span
              className={cx(
                "w-[70px] flex-none text-right text-[11.5px] leading-[1.4] text-ink-muted",
                row.noteClass,
              )}
            >
              {row.note}
            </span>
            <span className="sr-only">{row.say}</span>
          </li>
        ))}
      </ul>

      <p className="mt-[10px] border-t border-line pt-[9px] text-[12px] leading-[1.6] text-ink-muted">
        근거를 찾지 못하면 생성을 멈추고 이렇게 말합니다 — 「공식 지침에서 근거를 찾지
        못했습니다」
      </p>
    </div>
  );
}

export default TierShareDiagram;
