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

/**
 * 루브릭 완료본을 고친 날 — `src/data/rubric.ts`의 CL-01 교체 사유 주석과 같은 날짜입니다.
 *
 * 이 줄이 왜 있는가: 이 카드는 머리말에 「감수 **완료본을 고친 사실**도 여기 적습니다」라고
 * 자기 규칙을 세워 두었고, 응급 안내 쪽에는 그 규칙대로 「수정 뒤 재확인」 행이 있습니다.
 * 그런데 2026-08-26에 **1차 감수 완료본인 루브릭 30항목 중 CL-01의 지표와 앵커 넷을 전면
 * 개정**하고도 그 사실이 이 원장에 없었습니다 — 화면이 「1차 감수 완료 · 7. 25.」만 말하는
 * 동안, 그 완료본의 한 항목은 개정된 채 재확인을 기다리는 상태였습니다.
 * 심사위원이 「감수는 어떻게 관리합니까」에 이 팀이 내미는 물건이 하필 이 목록입니다
 * (7차 페르소나 PM med).
 *
 * 고친 내용 자체는 옳은 교정입니다 — 채택선이 3요소인데 지표가 「5요소를 모두」라고 적어
 * 한 화면이 세 말을 하던 자리를 없앴습니다(사유 전문은 `rubric.ts`의 CL-01 주석).
 * 여기 적는 것은 그 판단이 아니라 **재확인이 아직 안 끝났다는 사실**입니다.
 */
const RUBRIC_REVISED_ON = "2026. 8. 26.";

/** 개정된 루브릭 항목 — 늘면 이 배열에 더하고, 재확인이 끝나면 비웁니다(빈 배열이면 줄이 사라집니다). */
const RUBRIC_REVISED_IDS: readonly string[] = ["CL-01"];

export function ReviewLedger({ className }: ReviewLedgerProps) {
  const done = PROTOCOLS.filter((p) => isReviewed(p.reviewed));
  const pending = PROTOCOLS.length - done.length;
  const doneTitles = done.map((p) => p.title).join(" · ");
  /* 고친 줄 수도 데이터에서 셉니다 — 주소를 크게 띄우는 단계가 그 줄을 가진 단계입니다. */
  const revisedLines = PROTOCOLS.reduce(
    (sum, p) => sum + p.steps.filter((step) => typeof step.address === "string").length,
    0,
  );
  /* 개정 항목도 **데이터에 실제로 있는 것만** 셉니다 — 루브릭에서 사라진 id를 화면이 계속
     부르지 않게(응급 안내 줄이 `reviewed`를 세는 것과 같은 규율입니다). */
  const revisedRubricIds = RUBRIC_REVISED_IDS.filter((id) =>
    RUBRIC.some((item) => item.id === id),
  );

  const rows: readonly { k: string; v: string }[] = [
    {
      k: `루브릭 ${RUBRIC.length}항목`,
      v: "1차 감수 완료 — 현직 요양보호사(경력 5년) · 2026. 7. 25.",
    },
    /* 개정된 항목이 없어지면(재확인이 끝나면) 이 줄도 함께 사라집니다 — 응급 안내 쪽 「수정 뒤
       재확인」 행과 같은 문법입니다. 항목 수도 데이터가 아니라 위 목록에서 셉니다. */
    ...(revisedRubricIds.length > 0
      ? [
          {
            k: "루브릭 수정 뒤 재확인",
            v: `${RUBRIC_REVISED_ON} 1차 감수 완료본 가운데 ${revisedRubricIds.length}항목(${revisedRubricIds.join(" · ")})의 지표와 앵커를 고쳤습니다. 채택선이 3요소인데 지표가 「5요소를 모두」라고 적어 한 화면이 세 말을 하던 자리를 없앤 교정이며, 고친 항목은 현직 재확인을 기다립니다.`,
          },
        ]
      : []),
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
