import { cx } from "@/components";

/**
 * 데스크톱 홈 오른쪽 「실물 증거」 카드 (시안 7c).
 *
 * 말로 설명하는 대신 **훈련 한 턴을 그대로** 보여 줍니다 —
 * 어르신 말풍선 하나, 내 대답 하나, 그리고 그 자리에서 붙는 코칭 한 줄.
 *
 * 안에 든 대사·코칭·출처는 지어낸 예시가 아니라 CHK-A01 「현관 앞, 집에 가야 해요」의
 * 검수된 원문입니다(`src/data/scenarios/chk-a01.ts` — T1 대사 / D1-c 감정 인정형 제안·칭찬 / DOC-GUIDE-001).
 * 데이터를 읽어 오지 않고 상수로 두는 이유는, 이 카드가 **정지 화면**이기 때문입니다 —
 * 시나리오 표를 클라이언트로 끌어오지 않으려는 것이기도 합니다.
 *
 * px·hex는 시안 그대로입니다: 폭 360 · 보더 1px · r18 · 그림자 `0 8px 30px rgba(25,31,30,.06)`
 * (가이드 §3이 허용하는 그림자 3곳 중 하나) · 말풍선 r4/14/14/14 · 본문 13.5px.
 */

/** 박 어르신 T1 원문 — 한 글자도 바꾸지 않습니다. */
const ELDER_LINE = "아이고… 나 지금 가야 돼. 우리 애기 학교에서 오면 밥을 줘야 하는데.";

/** D1-c(감정 인정형) 제안 문장 — 학습자가 실제로 고를 수 있는 답입니다. */
const LEARNER_LINE = "애기 밥 챙겨주셔야 하는구나, 마음이 급하시겠어요";

/** D1-c 칭찬 문장과 그 판정 근거 문서. */
const PRAISE = "집에 가고 싶은 마음을 먼저 알아주셨습니다.";
const PRAISE_DOC = "중앙치매센터 치매환자 행동심리증상 대응 매뉴얼";

export interface SessionPreviewCardProps {
  className?: string;
}

export function SessionPreviewCard({ className }: SessionPreviewCardProps) {
  return (
    <figure
      className={cx(
        "w-[360px] flex-none rounded-[18px] border border-line px-5 pt-5 pb-4",
        "shadow-[0_8px_30px_rgba(25,31,30,0.06)]",
        className,
      )}
    >
      <figcaption className="mb-3 text-[11.5px] leading-[1.4] font-bold tracking-[0.05em] text-ink-muted">
        90초면 첫 판정까지 — 실제 화면
      </figcaption>

      {/* 어르신 — 아바타 30px + 감정 링(불안). 말풍선은 화자 쪽 모서리만 4px입니다. */}
      <div className="mb-[10px] flex gap-2">
        <span
          aria-hidden
          className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-chip bg-paper-out text-[12px] font-bold text-ink-soft shadow-[0_0_0_2px_#f0c987]"
        >
          박
        </span>
        <p className="rounded-[4px_14px_14px_14px] bg-paper-2 px-3 py-[9px] text-[13.5px] leading-[1.55] text-ink">
          <span className="sr-only">박 어르신(가상 인물): </span>
          {ELDER_LINE}
        </p>
      </div>

      {/* 학습자 — 틸 면 + 딥 텍스트. 채움이 아니라 면입니다(채움은 CTA·마이크 전용). */}
      <div className="mb-3 flex justify-end">
        <p className="max-w-[85%] rounded-[14px_4px_14px_14px] bg-brand-tint px-3 py-[9px] text-[13.5px] leading-[1.55] text-brand-on-tint">
          <span className="sr-only">나의 대답: </span>
          {LEARNER_LINE}
        </p>
      </div>

      {/* 코칭 한 줄 — 박스 없이 헤어라인 위에 ✓ 배지 + 한 문장 + 출처(v4 §4.4). */}
      <div className="flex gap-[7px] border-t border-line pt-[11px]">
        <span
          aria-hidden
          className="relative top-[1px] flex h-[15px] w-[15px] flex-none items-center justify-center rounded-chip bg-ok text-[9.5px] font-extrabold text-white"
        >
          ✓
        </span>
        <p className="text-[12.5px] leading-[1.55] text-ink-soft">
          <b className="font-bold text-ok-ink">충족</b> — {PRAISE}{" "}
          <span className="text-tertiary">· {PRAISE_DOC}</span>
        </p>
      </div>
    </figure>
  );
}

export default SessionPreviewCard;
