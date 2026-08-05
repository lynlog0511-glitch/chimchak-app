import { cx } from "@/components/utils";

/**
 * AI 지분 막대 (시안 7b) — "위험할수록 AI의 지분이 줄어듭니다"를 문장이 아니라 **그림**으로 보입니다.
 *
 * 세 줄뿐입니다. L1은 길고, L2는 3분의 1이며, L3은 **아예 없습니다**(0%).
 *
 * 0% 행은 그리지 않으면 「빈 트랙」이 되고, 빈 것은 「0」이 아니라 「데이터 없음」으로 읽힙니다.
 * 그래서 L3 행에만 두 가지를 둡니다 — 막대 앞 자리에 tabular 「0%」(danger-ink)와,
 * 트랙 맨 왼쪽 0 지점에 3px danger 마커. 0이 결론이라는 것을 형태로 말합니다.
 * 숫자 칸은 세 줄 모두 같은 폭으로 비워 두어 막대 시작점이 어긋나지 않게 했습니다.
 *
 * px·hex는 시안 그대로입니다: 카드 보더 1px r14 · 라벨 56px/12.5 · 막대 h10 r5 · 우측 주석 70px/11.5.
 * 다만 **글자와 그 글자가 앉는 칸의 폭**은 rem으로 적었습니다(3.5rem·1.625rem·4.375rem =
 * 16px 기준으로 56·26·70px 그대로). 설정에서 글자를 키우면 칸도 같이 넓어져
 * 「역할 연기만」 같은 주석이 두 줄로 접히면서 세 줄의 막대 시작점이 어긋나는 일이 없습니다.
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
            <span className="w-[3.5rem] flex-none text-[0.7813rem] leading-[1.4] font-bold text-ink">
              {row.label}
            </span>
            {/* 0인 줄에만 숫자를 답니다. 칸은 세 줄 모두 잡아 두어 막대가 같은 x에서 시작합니다. */}
            <span
              aria-hidden
              className="chim-num w-[1.625rem] flex-none text-right text-[0.7188rem] leading-[1.4] font-bold text-danger-ink"
            >
              {row.pct === 0 ? "0%" : ""}
            </span>
            <span
              aria-hidden
              className="relative h-[10px] min-w-0 flex-1 overflow-hidden rounded-[5px] bg-paper-out"
            >
              <span
                className={cx("block h-full rounded-[5px]", row.bar)}
                style={{ width: `${row.pct}%` }}
              />
              {/* 0 지점 마커 — 길이가 0이어도 「여기가 0이다」는 눈에 남습니다. */}
              {row.pct === 0 && (
                <span className="absolute inset-y-0 left-0 w-[3px] rounded-[5px] bg-danger" />
              )}
            </span>
            <span
              className={cx(
                "w-[4.375rem] flex-none text-right text-[0.7188rem] leading-[1.4] text-ink-muted",
                row.noteClass,
              )}
            >
              {row.note}
            </span>
            <span className="sr-only">{row.say}</span>
          </li>
        ))}
      </ul>

      <p className="mt-[10px] border-t border-line pt-[9px] text-[0.75rem] leading-[1.6] text-ink-muted">
        근거를 찾지 못하면 생성을 멈추고 이렇게 말합니다 — 「공식 지침에서 근거를 찾지
        못했습니다」
      </p>
    </div>
  );
}

export default TierShareDiagram;
