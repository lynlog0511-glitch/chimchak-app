import type { RecordDraft } from "@/types";
import { cx } from "@/components";
import { RECORD_SLOT_LABELS, RECORD_SLOT_QUESTIONS, type RecordSlot } from "@/engine/record";

/** 급여제공기록지 5요소의 화면 순서 (설계서 CL-01·CL-03) */
export const DRAFT_SLOT_ORDER: RecordSlot[] = ["time", "who", "what", "action", "status"];

/**
 * 빈 칸에 붙는 짧은 되물음 — 「지금은 어떠신가요?」처럼 질문 한마디만 답니다.
 *
 * 문구는 엔진의 `RECORD_SLOT_QUESTIONS` **한 곳**에서 옵니다(2026-08-25).
 * 예전에는 같은 뜻의 질문이 이 파일과 엔진에 따로 적혀 있어, 초안 화면(`DraftForm`)과
 * 확정 화면(`DraftRows`)이 같은 칸을 조금씩 다른 말로 물었습니다. 이름만 여기 남깁니다 —
 * 이 화면들이 부르는 이름이라 호출부를 흔들지 않습니다.
 */
export const SLOT_PROMPTS: Record<RecordSlot, string> = RECORD_SLOT_QUESTIONS;

/** 가명처리 토큰 한 개인지 판정 (g 플래그 없음 — lastIndex 상태를 만들지 않습니다) */
const TOKEN_ONE = /^\[(?:대상자|번호|기관|주소|생년)\]$/;
/** split용 — 캡처 그룹이 있어야 토큰 자체도 결과 배열에 남습니다. */
const TOKEN_SPLIT = /(\[(?:대상자|번호|기관|주소|생년)\])/g;

/**
 * 가명처리 토큰을 시안 6e의 **인라인 칩**(brand-tint 면 · r6 · 700)으로 보여 줍니다.
 *
 * 대괄호는 화면에서만 벗깁니다 — 저장되는 문자열은 `[대상자]` 그대로입니다.
 *
 * @example <TokenText text="[대상자]께서 어지럼을 말씀하셨습니다" />
 */
export function TokenText({ text }: { text: string }) {
  return (
    <>
      {text.split(TOKEN_SPLIT).map((part, index) =>
        TOKEN_ONE.test(part) ? (
          <strong
            key={index}
            className="mx-[1px] rounded-[6px] bg-brand-tint px-[7px] py-[1px] font-bold text-brand-on-tint"
          >
            {part.slice(1, -1)}
          </strong>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}

export interface DraftRowsProps {
  draft: RecordDraft;
  /**
   * 빈 칸 표기.
   * `prompt` = 그 칸을 묻는 질문 한마디(아직 고칠 수 있는 화면),
   * `confirmed` = 「비어 있는 채로 확정하셨습니다」(확정 후 화면).
   */
  empty?: "prompt" | "confirmed";
  className?: string;
}

/**
 * 기록 초안 다섯 칸 — 시안 6e의 헤어라인 행입니다.
 *
 * 라벨 64px muted + 값 600, 행 사이만 헤어라인(마지막 행 아래는 선 없음).
 * 빈 칸은 warn-ink 700 질문 한마디로 말합니다 — 점수가 아니라 다음에 채울 자리 안내입니다.
 * 지시문(「채워 주세요」)을 앞에 붙이지 않습니다: 빈 칸이 다섯이면 같은 말이 다섯 번
 * 늘어서고, 남은 것이 숙제로 읽힙니다(2026-08-26 · 페르소나 PM low).
 *
 * @example <DraftRows draft={draft} />
 */
export function DraftRows({ draft, empty = "prompt", className }: DraftRowsProps) {
  return (
    <dl className={cx("chim-hairline", className)}>
      {DRAFT_SLOT_ORDER.map((slot) => {
        const value = draft[slot];
        const isEmpty = value.trim().length === 0;
        return (
          <div key={slot} className="flex gap-[10px] px-[2px] py-[11px] text-[0.9375rem] leading-[1.6]">
            <dt className="w-[64px] flex-none whitespace-nowrap text-ink-muted">
              {RECORD_SLOT_LABELS[slot]}
            </dt>
            <dd className="min-w-0 flex-1 font-semibold text-ink">
              {isEmpty ? (
                <span className="font-bold text-warn-ink">
                  {empty === "prompt" ? SLOT_PROMPTS[slot] : "비어 있는 채로 확정하셨습니다"}
                </span>
              ) : (
                <TokenText text={value} />
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export default DraftRows;
