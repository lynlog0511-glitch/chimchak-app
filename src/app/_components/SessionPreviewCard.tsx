import { cx } from "@/components";
import { StatusMark } from "@/components/icons";

/**
 * 데스크톱 홈 오른쪽 「이렇게 진행됩니다」 카드 (시안 7c).
 *
 * 말로 설명하는 대신 **훈련 한 턴을 그대로** 보여 줍니다 —
 * 어르신 말풍선 하나, 내 대답 하나, 그리고 그 자리에서 붙는 코칭 한 줄.
 *
 * 이 카드는 **lg↑에서만** 섭니다. 숨김 클래스를 부르는 쪽에 맡기지 않고 여기 안에 둔 이유는,
 * 360px 고정폭이 모바일 화면에서 가로 스크롤을 만들기 때문입니다 — 한 번 데스크톱 전용으로
 * 정한 카드가 호출 한 줄의 실수로 모바일에 되살아나지 않게 합니다(가이드 §5).
 *
 * 안에 든 대사·코칭·출처는 지어낸 예시가 아니라 CHK-A01 「현관 앞, 집에 가야 해요」의
 * 검수된 원문입니다(`src/data/scenarios/chk-a01.ts` — T1 대사 / D1-c 감정 인정형 제안·칭찬 / DOC-GUIDE-001).
 * 데이터를 읽어 오지 않고 상수로 두는 이유는, 이 카드가 **정지 화면**이기 때문입니다 —
 * 시나리오 표를 클라이언트로 끌어오지 않으려는 것이기도 합니다.
 *
 * px·hex는 시안 그대로입니다: 폭 360 · 보더 1px · 그림자 `0 8px 30px rgba(25,31,30,.06)`
 * (가이드 §3이 허용하는 그림자 3곳 중 하나) · 말풍선 r4/14/14/14 · 본문 13.5px.
 *
 * 2026-08-24 시각 통일 — 홈에 함께 서는 카드들과 한 언어로 맞춘 세 가지입니다.
 *  1. 카드 라운드 18 → 14. 홈의 다른 카드(「하던 훈련」·첫 방문 안내·3계층 밴드)가 전부 14라
 *     이 카드만 둥글어 다른 앱에서 오려 붙인 것처럼 보였습니다(가이드 §3 「카드·버튼 14px」).
 *     안쪽 말풍선 14는 그대로 둡니다 — 바깥보다 안쪽이 더 둥글면 모서리가 겹쳐 보입니다.
 *  2. 행간을 1.45/1.6 두 단으로 정리(가이드 §2 8/6 교정의 3단 사다리).
 *  3. 코칭 마크를 손으로 그린 원+텍스트 ✓에서 `StatusMark`(훈련 화면과 같은 컴포넌트)로.
 *     폰트가 그리던 체크와 앱의 다른 체크(SVG)가 한 화면에서 굵기·기울기가 달랐습니다(mi45).
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
        /* 데스크톱 전용입니다 — 숨김을 부르는 쪽이 아니라 **카드가 스스로** 들고 있습니다.
           360px 고정폭 카드라 모바일에 서면 가로 스크롤이 생기고, 첫 화면의 주인공(고정 문구)
           아래에 같은 크기의 글자 덩어리가 하나 더 붙어 위계가 무너집니다(가이드 §5). */
        "hidden lg:block",
        "w-[360px] flex-none rounded-card border border-line px-5 pt-5 pb-4",
        "shadow-[0_8px_30px_rgba(25,31,30,0.06)]",
        className,
      )}
    >
      {/* 예전 머리말은 「실제 훈련 화면 — 한 턴이면 첫 판정이 옵니다」였습니다.
          「실제」·「첫 판정」은 이것이 진짜 화면임을 **심사자에게** 증명하는 말이라,
          정작 처음 오신 분에게는 무엇을 보라는 안내가 되지 못했습니다.
          카드가 하는 일(한 턴이 어떻게 굴러가는지 보여 주기)을 그대로 적습니다. */}
      <figcaption className="mb-3 text-[0.7188rem] leading-[1.45] font-bold tracking-[0.05em] text-ink-muted">
        이렇게 진행됩니다
      </figcaption>

      {/* 어르신 — 아바타 30px + 감정 링(불안). 말풍선은 화자 쪽 모서리만 4px입니다. */}
      <div className="mb-[10px] flex gap-2">
        <span
          aria-hidden
          className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-chip bg-paper-out text-[0.75rem] font-bold text-ink-soft shadow-[0_0_0_2px_var(--color-emotion-ring)]"
        >
          박
        </span>
        <p className="rounded-[4px_14px_14px_14px] bg-paper-2 px-3 py-[9px] text-[0.8438rem] leading-[1.6] text-ink">
          <span className="sr-only">박 어르신(가상 인물): </span>
          {ELDER_LINE}
        </p>
      </div>

      {/* 학습자 — 틸 면 + 딥 텍스트. 채움이 아니라 면입니다(채움은 CTA·마이크 전용). */}
      <div className="mb-3 flex justify-end">
        <p className="max-w-[85%] rounded-[14px_4px_14px_14px] bg-brand-tint px-3 py-[9px] text-[0.8438rem] leading-[1.6] text-brand-on-tint">
          <span className="sr-only">나의 대답: </span>
          {LEARNER_LINE}
        </p>
      </div>

      {/* 코칭 한 줄 — 박스 없이 헤어라인 위에 ✓ 배지 + 한 문장 + 출처(v4 §4.4). */}
      {/* gap 5px — 마크가 18px 상자 안의 12.9px 원이라 좌우로 2.5px씩 여백을 이미 갖고 있습니다.
          시안의 7px을 그대로 두면 광학 간격이 9.5px가 되어 문장이 한 칸 밀려 보입니다. */}
      <div className="flex gap-[5px] border-t border-line pt-[11px]">
        {/* 코칭 마크는 훈련 화면이 쓰는 것과 **같은 컴포넌트**입니다 — 손으로 그린 원+텍스트 ✓ 대신.
            여기는 훈련 한 턴을 그대로 옮겨 둔 카드라, 마크가 실물과 다르면 카드가 거짓말을 합니다.
            뜻은 옆의 「충족」이 전하므로 라벨 없이 마크만 세웁니다(마크 단독 아님). */}
        <StatusMark kind="met" size="sm" className="relative top-[1px]" />
        <p className="text-[0.7813rem] leading-[1.6] text-ink-soft">
          <b className="font-bold text-ok-ink">충족</b> — {PRAISE}{" "}
          <span className="text-tertiary">· {PRAISE_DOC}</span>
        </p>
      </div>
    </figure>
  );
}

export default SessionPreviewCard;
