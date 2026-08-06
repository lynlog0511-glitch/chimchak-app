import { cx } from "@/components/utils";

/**
 * 생성 허용 범위 막대 — "위험할수록 AI의 지분이 줄어듭니다"를 문장이 아니라 **그림**으로 보입니다.
 *
 * 예전에는 L1 88% · L2 34%로 그렸습니다. 그런데 「AI 지분」의 정의도 88·34의 도출 방법도
 * 코드·화면 어디에도 없었습니다 — 바로 위 칸이 실측치를 자랑하는 화면에서 근거 없는 정밀
 * 수치는 나머지 숫자의 신뢰까지 갉아먹습니다. 그래서 **퍼센트를 지웠습니다**(화면낭독기
 * 문장에서도 지웠습니다).
 *
 * 대신 막대는 **비율이 아니라 순서**를 말합니다. 세 칸짜리 트랙에 「넓음(3칸) · 좁힘(1칸) ·
 * 없음(0칸)」을 채웁니다. 이 순서는 바로 아래 3계층 표에서 한 줄씩 확인할 수 있는 사실이고,
 * L3의 0만 유일하게 숫자로 단언할 수 있는 값이라 그 자리에만 「0건」을 답니다.
 *
 * 0 행은 그리지 않으면 「빈 트랙」이 되고, 빈 것은 「0」이 아니라 「데이터 없음」으로 읽힙니다.
 * 그래서 L3 행에만 트랙 맨 왼쪽 0 지점에 3px danger 마커를 둡니다.
 *
 * px·hex는 시안 그대로입니다: 카드 보더 1px r14 · 라벨 56px/12.5 · 막대 h10 r5 · 우측 주석 70px/11.5.
 * 다만 **글자와 그 글자가 앉는 칸의 폭**은 rem으로 적었습니다(3.5rem·4.375rem =
 * 16px 기준으로 56·70px 그대로). 설정에서 글자를 키우면 칸도 같이 넓어져 주석이 두 줄로
 * 접히면서 세 줄의 막대 시작점이 어긋나는 일이 없습니다.
 * 막대는 장식(aria-hidden)이고, 화면낭독기에는 줄마다 한 문장을 따로 읽어 줍니다.
 */

/** 트랙 칸 수 — 「넓음 · 좁힘 · 없음」 세 단계라 셋으로 나눕니다. */
const STEPS = 3;

interface TierRow {
  /** L1 대화 · L2 채점 · L3 응급 */
  label: string;
  /** 채운 칸 수 = 생성이 허용된 범위의 순서 (비율이 아닙니다) */
  filled: number;
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
    filled: 3,
    bar: "bg-brand-600",
    note: "역할 연기만",
    say: "L1 대화 단계 — 허용 범위가 가장 넓습니다. 어르신 역할 연기만 맡습니다.",
  },
  {
    label: "L2 채점",
    filled: 1,
    bar: "bg-brand-400",
    note: "규칙 사전",
    say: "L2 채점 단계 — 범위를 좁혔습니다. 판정은 규칙 사전이 합니다.",
  },
  {
    label: "L3 응급",
    filled: 0,
    bar: "bg-danger",
    note: "생성 0건",
    noteClass: "font-bold text-danger-ink",
    say: "L3 응급 단계 — 허용 범위가 없습니다. 생성 호출 0건입니다.",
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
            <span aria-hidden className="flex min-w-0 flex-1 gap-[3px]">
              {Array.from({ length: STEPS }, (_, step) => (
                <span
                  key={step}
                  className={cx(
                    "relative h-[10px] min-w-0 flex-1 rounded-[5px]",
                    step < row.filled ? row.bar : "bg-paper-out",
                  )}
                >
                  {/* 0 지점 마커 — 채운 칸이 없어도 「여기가 0이다」는 눈에 남습니다. */}
                  {row.filled === 0 && step === 0 && (
                    <span className="absolute inset-y-0 left-0 w-[3px] rounded-[5px] bg-danger" />
                  )}
                </span>
              ))}
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
        막대는 비율이 아니라 잠근 범위의 순서입니다 — 넓음 · 좁힘 · 없음. 근거 문서가
        화이트리스트 밖이면 판정을 멈추고 「공식 지침에서 근거를 찾지 못했습니다」로 넘깁니다.
      </p>
    </div>
  );
}

export default TierShareDiagram;
