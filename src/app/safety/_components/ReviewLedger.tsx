import { PROTOCOLS } from "@/data/protocols";
import { RUBRIC } from "@/data/rubric";
import { cx } from "@/components/utils";

/**
 * 현직 감수 현황 — **끝난 것과 안 끝난 것을 한자리에** 적습니다.
 *
 * 「현직 감수를 받았습니다」만 적어 두면 어디까지 받았는지 알 수 없고,
 * 진행 중인 것을 완료로 적으면 나머지 기록까지 못 믿게 됩니다. 그래서 두 줄을 같이 놓습니다.
 *
 * 응급 안내 줄은 `src/data/protocols.ts`의 `reviewed` 문자열을 세어서 만듭니다 —
 * 데이터가 바뀌면 이 카드도 같이 바뀝니다(손으로 적은 숫자가 아닙니다).
 *
 * 감수 **완료본을 고친 사실**도 여기 적습니다. 완료 종수만 세면 화면은 「1종 감수 완료」라고
 * 말하는데, 그 1종이 방금 고쳐져 재확인을 기다리는 중일 수 있습니다. 고친 줄 수도 데이터에서
 * 세고, 날짜만 상수로 둡니다.
 */

export interface ReviewLedgerProps {
  className?: string;
}

/** 감수 완료로 세는 기준 — protocols.ts의 `reviewed`가 「감수 완료」로 시작하는 항목입니다. */
function isReviewed(reviewed: string): boolean {
  return reviewed.startsWith("감수 완료");
}

/**
 * 감수 완료본을 고친 날 — `src/data/protocols.ts` 머리 주석의 수정 기록과 같은 날짜입니다.
 *
 * 고친 줄은 주소 단계 음성이고, 그 안에는 유일한 감수 완료본(P-02)이 들어 있습니다.
 * 화면이 「1종 감수 완료」만 말하고 이 사실을 빼면, 진행 중인 것을 완료로 적는 셈입니다 —
 * 이 카드가 스스로 하지 말라고 적어 둔 일입니다(페르소나 PM low).
 */
const REVISED_ON = "2026. 8. 25.";

export function ReviewLedger({ className }: ReviewLedgerProps) {
  const done = PROTOCOLS.filter((p) => isReviewed(p.reviewed));
  const pending = PROTOCOLS.length - done.length;
  const doneTitles = done.map((p) => p.title).join(" · ");
  /* 고친 줄 수도 데이터에서 셉니다 — 주소를 크게 띄우는 단계가 그 줄을 가진 단계입니다. */
  const revisedLines = PROTOCOLS.reduce(
    (sum, p) => sum + p.steps.filter((step) => typeof step.address === "string").length,
    0,
  );

  const rows: readonly { k: string; v: string }[] = [
    {
      k: `루브릭 ${RUBRIC.length}항목`,
      v: "1차 감수 완료 — 현직 요양보호사(경력 5년) · 2026. 7. 25.",
    },
    {
      k: "시나리오 대사",
      v: "먼저 연 3종은 2차 교차 감수가 진행 중이며, 아직 끝나지 않았습니다. 뒤에 더한 3종(CHK-A02·CHK-B01·CHK-C02)은 초안으로, 현직 감수 대기 상태임을 훈련 카드에도 그대로 적었습니다.",
    },
    {
      k: `응급 안내 ${PROTOCOLS.length}종`,
      v:
        done.length > 0
          ? `${done.length}종 감수 완료 — ${doneTitles} · 나머지 ${pending}종은 2차 감수 대기`
          : `${PROTOCOLS.length}종 모두 2차 감수 대기`,
    },
    /* 고친 줄이 없어지면(주소 단계가 사라지면) 이 줄도 함께 사라집니다 — 화면이
       「0줄을 고쳤습니다」라고 말하지 않게. */
    ...(revisedLines > 0
      ? [
          {
            k: "응급 안내 수정 뒤 재확인",
            v:
              `${REVISED_ON} 주소 단계 음성 ${revisedLines}줄을 고쳤습니다. 방문지 주소를 미리 적어 두지 않으신 분께도 참이 되도록 바꾼 문장입니다. ` +
              (done.length > 0
                ? `감수 완료본도 이 ${revisedLines}줄에 들어 있어, 지금은 현직 재확인을 기다립니다.`
                : "고친 줄은 모두 현직 재확인을 기다립니다."),
          },
        ]
      : []),
  ];

  return (
    <section
      aria-labelledby="review-ledger-title"
      className={cx("rounded-card bg-paper-2 p-4", className)}
    >
      <h3 id="review-ledger-title" className="text-[1.0625rem] leading-[1.45] font-extrabold text-ink">
        현직 감수 현황
      </h3>

      <dl className="chim-hairline mt-3 border-y border-line">
        {rows.map((row) => (
          <div key={row.k} className="py-3">
            <dt className="text-[0.9375rem] leading-[1.45] font-bold text-ink">{row.k}</dt>
            <dd className="mt-1 text-[0.9375rem] leading-[1.6] text-ink-soft">{row.v}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-3 text-[0.7813rem] leading-[1.6] text-ink-muted">
        끝난 것과 안 끝난 것을 같이 적습니다. 진행 중인 것을 완료로 적어 두면, 이 화면의 나머지
        기록도 믿을 수 없게 됩니다.
      </p>
    </section>
  );
}

export default ReviewLedger;
