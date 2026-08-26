import type { ReactNode } from "react";
import { cx } from "./utils";

/**
 * 카드 면 — 이름이 곧 지면 토큰입니다(2026-08-25에 `default`→`paper` · `quiet`→`paper-2`로
 * 고쳤습니다). 화면들이 손으로 쓰는 클래스와 같은 낱말이라, 옮겨 붙일 때 뜻이 흔들리지 않습니다.
 */
export type CardTone = "paper" | "paper-2" | "brand" | "ok" | "warn" | "danger";

export interface CardProps {
  children: ReactNode;
  className?: string;
  /**
   * 카드 면 — 기본은 흰 카드(`paper`)입니다.
   *
   * **면 카드는 `tone="paper-2"` 한 줄로 씁니다.** 손으로 `rounded-card bg-paper-2`를 적지 마세요 —
   * 그렇게 만든 면 카드가 지금 77곳이고, 값이 맞는 이유가 컴포넌트가 아니라 사람의 주의라
   * 다음 리디자인 때 눈금 통일 작업을 처음부터 다시 해야 합니다(2차 페르소나 디자이너 P2).
   */
  tone?: CardTone;
  /** 내부 여백을 끄고 직접 채우고 싶을 때 false */
  padded?: boolean;
  /** 마우스 오버 시 면이 살짝 바뀌는 효과 (링크 카드용) */
  hoverable?: boolean;
  /**
   * 1px 보더를 옵트인으로 켭니다. 기본은 **무보더**(v3 §5·§7).
   * 지면이 흰색인 구간에 흰 카드를 놓아 구분이 정말 불가능할 때만 켜세요.
   */
  border?: boolean;
  id?: string;
}

/** 면(surface) — 지면 위에서 흰 카드가 그 자체로 구분됩니다. */
const TONE: Record<CardTone, string> = {
  paper: "bg-paper",
  "paper-2": "bg-paper-2",
  brand: "bg-brand-50",
  ok: "bg-ok-soft",
  warn: "bg-warn-soft",
  danger: "bg-danger-soft",
};

/** 보더는 옵트인일 때만 — 톤에 맞는 선 하나로 끝냅니다. */
const TONE_BORDER: Record<CardTone, string> = {
  paper: "border border-line",
  "paper-2": "border border-line",
  brand: "border border-brand-200",
  ok: "border border-ok-line",
  warn: "border border-warn-line",
  danger: "border border-danger-line",
};

/**
 * 공용 카드 컨테이너.
 * radius 14px(`--radius-card`) · **무보더·무그림자**가 기본값이고, 구분은 지면과의 면 차이로 합니다(§7).
 * (그림자는 떠 있는 것 — 모달·팝오버 — 에만 씁니다.)
 *
 * **사용 규칙**: 면 카드는 손으로 `rounded-card bg-paper-2`를 적지 말고 `<Card tone="paper-2">`로
 * 쓰세요 — 라운드·면·여백이 한 곳에서 정해져야 다음 리디자인이 파일 하나로 끝납니다.
 *
 * 정보 위계가 낮은 목록·표라면 카드로 감싸지 말고 `.chim-hairline` 구분선을 쓰세요.
 * 한 뷰포트에 카드가 4장 넘게 보이면 카드를 줄이거나 리스트로 바꾸는 편이 낫습니다(§6).
 *
 * 접근성 코어 예외(§3): 카드 안에 놓이더라도 코어 콘텐츠(대사·CUE·응급 자막·CTA)는 사다리 위쪽 단
 * (17px 이상 — `.chim-core-sm` 17 · 섹션 19 · 자막 29)을 유지합니다.
 * (2026-08-26: 여기 「18px+」라고 적혀 있던 것을 고쳤습니다. 18은 사다리 열두 값에 없는 값이라,
 *  공용 컴포넌트가 `tests/designScale.test.ts`가 막는 값을 권하고 있었습니다 — 페르소나 디자이너 P1.)
 *
 * @example <Card tone="paper-2" padded={false} className="px-[15px] py-[14px]">…</Card>
 */
export function Card({
  children,
  className,
  tone = "paper",
  padded = true,
  hoverable = false,
  border = false,
  id,
}: CardProps) {
  return (
    <div
      id={id}
      className={cx(
        "rounded-card",
        TONE[tone],
        border && TONE_BORDER[tone],
        padded && "p-5",
        /* 2026-08-24: hover/active를 `brand-50`(옅은 틸) → 회색 두 단으로 바꿨습니다.
           카드에 마우스를 얹었다고 화면의 틸 지분이 하나 늘어나면 §0의 「틸은 화면당 2곳 이하」가
           포인터 위치에 따라 깨집니다. 눌림 표현은 회색 면(리스트 행·「하던 훈련」 카드)과 같은 결로
           통일하고, 손끝의 답은 `.chim-press`의 1.5% 축소가 맡습니다.
           대비: ink #191f1e 위 paper-2 14.7:1 · neutral-line 13.4:1 — 둘 다 AA 통과.
           ※ tone="paper-2"(이미 그 면)인 카드에는 hoverable을 켜지 마세요 — hover가 무변화입니다. */
        hoverable && "chim-press hover:bg-paper-2 active:bg-neutral-line",
        className,
      )}
    >
      {children}
    </div>
  );
}

export default Card;
