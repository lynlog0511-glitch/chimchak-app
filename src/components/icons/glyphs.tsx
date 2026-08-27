import type { CSSProperties, ReactNode } from "react";
import { cx } from "../utils";

/* ─────────────────────────────────────────────────────────────
   텍스트 글리프 대체 SVG (심미 c36 · mi45)

   왜 필요한가 — 동봉 폰트에 **없는 글자**를 화면에 쓰고 있었습니다.
   public/fonts/PretendardVariable.woff2 의 cmap을 fontTools로 열어 재확인한 결과:

     U+2304 '⌄' (펼침 마커)  → MISSING   ← 8/6 전 렌더 지점 ChevronGlyph로 배선 완료
     U+2691 '⚑' (CF 깃발)    → MISSING
     U+21BA '↺' (재훈련)     → PRESENT
     U+2713 '✓' (충족)       → PRESENT
     U+2039 '‹' · U+203A '›' → PRESENT

   즉 폴백이 실제로 일어나는 것은 '⌄'와 '⚑' 둘뿐입니다(평가 원본의 「↺·⌄」 중 ↺는 오기).
   '⌄'는 OS 심볼 폰트로 떨어져 획 굵기·자폭·베이스라인이 주변 Pretendard와 어긋나고,
   거기에 걸린 rotate-180이 글자 상자 기준으로 돌아 어긋남을 두 배로 키웁니다 —
   심사위원 노트북이 Windows냐 Mac이냐에 따라 다른 모양이 뜨는, 통제 불가능한 시연 변수입니다.

   여기 있는 글리프는 24×24 viewBox 안에서 **상하좌우가 대칭**이라
   rotate-180이 정확히 광학 중심으로 돕니다.

   ※ 쓰는 쪽 규칙은 아이콘과 같습니다 — 글리프 단독 사용 금지, 언제나 옆에 텍스트 라벨.
   ───────────────────────────────────────────────────────────── */

/** mi45 — 크기 토큰은 두 종만 남깁니다. 14(본문 옆) / 20(행 우측·큰 라벨 옆). */
export type GlyphSize = "sm" | "md";

export const GLYPH_PX: Record<GlyphSize, number> = {
  sm: 14,
  md: 20,
};

/* ※ 2026-08-26에 `CIRCLE_MARK_PX`(54px 원 안 마크의 광학 보정 24/22)와 `CHECK_PATH`
     (24×24 상자를 채우는 체크)를 지웠습니다 — 둘 다 참조 0건이었습니다. 엔딩의 54px 원은
     `EndingPanel`이 텍스트 `✓`/`↺`로 그리고 있어 두 상수를 읽는 자리가 없었고, `CHECK_PATH`의
     유일한 소비처였던 `CheckGlyph`·`IconCheck`도 같은 날 참조 0건으로 지웠습니다(가이드 §9-9).
     기하가 다시 필요해지면 **쓰는 자리와 함께** 되살립니다. */

/** 반지름 8.6 원 안에 들어가는 작은 체크 — `StatusMark`의 채운 원 안에서 씁니다. */
export const CHECK_PATH_IN_CIRCLE = "m8.2 12.3 2.6 2.6 5-5.4";

export interface GlyphProps {
  /**
   * 14px(`"sm"`) · 20px(`"md"`) 두 종이 기본입니다.
   * 그 밖의 크기는 px 숫자로 주되, 시안이 지정한 값일 때만 그렇게 하세요.
   * (2026-08-27: 여기 있던 「원 안 마크는 `CIRCLE_MARK_PX`를 쓰면 됩니다」를 지웠습니다 —
   *  같은 파일 위쪽이 그 상수를 지웠다고 적고 있는데 열세 줄 아래에서 그것을 쓰라고 안내하고
   *  있었습니다. 이 저장소는 주석을 다음 사람의 근거로 쓰므로, 지운 이름을 가리키는 안내는
   *  값이 틀린 코드보다 오래 해롭습니다 — 7차 페르소나 디자이너 low.)
   */
  size?: GlyphSize | number;
  /** 색은 `text-*`로 상속됩니다. */
  className?: string;
  /**
   * 기본 1.5 — 아이콘 시스템(IconBase 1.75)과 한 벌입니다.
   *
   * 예전 기본값은 2였습니다. 14px 글리프에서 상대 무게 2/14 = 0.143인데 탭바 아이콘은
   * 1.75/22 = 0.080이라 **1.8배 무거웠고**, /train 한 화면에서 하단 내비 아이콘은 얌전한데
   * 「전체 12종 편성표 ⌄」 옆 작은 셰브론만 새까맣게 튀었습니다.
   * 작은 글리프의 상대 무게를 조금 올려 주는 것은 옳은 광학 보정이지만 1.8배는 보정이 아닙니다 —
   * 1.5는 14px에서 0.107(1.34배)로, 정상적인 보정 범위입니다.
   */
  strokeWidth?: number;
}

interface GlyphBaseProps extends GlyphProps {
  children: ReactNode;
  style?: CSSProperties;
}

function GlyphBase({ size = "sm", className, strokeWidth = 1.5, children, style }: GlyphBaseProps) {
  const px = typeof size === "number" ? size : GLYPH_PX[size];

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={px}
      height={px}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cx("inline-block shrink-0 align-middle", className)}
      style={style}
    >
      {children}
    </svg>
  );
}

export interface ChevronGlyphProps extends GlyphProps {
  /** 펼쳐진 상태 — 180° 돌아 위를 봅니다(도형이 대칭이라 축이 정확히 가운데입니다). */
  open?: boolean;
}

/**
 * 펼침 마커 — 폰트에 없는 `⌄`(U+2304)의 대체물입니다.
 *
 * 접이식 행의 라벨 **오른쪽 끝**에 두고, 상태는 `open`으로만 바꿉니다.
 * `<details>`와 함께 쓸 때는 `<summary>` 안에 넣고 `open` 속성과 같은 값을 주세요.
 * 회전 트랜지션은 `prefers-reduced-motion`에서 globals.css가 정지시킵니다.
 *
 * @example <span>전체 12종 편성표 <ChevronGlyph open={open} className="text-ink-ghost" /></span>
 */
export function ChevronGlyph({ open = false, size, className, strokeWidth }: ChevronGlyphProps) {
  return (
    <GlyphBase
      size={size}
      strokeWidth={strokeWidth}
      className={cx("transition-transform duration-150 ease-soft", open && "rotate-180", className)}
    >
      {/* x 6→18 · y 9→15 — 두 축 모두 중심이 (12,12)라 rotate-180이 제자리에서 돕니다. */}
      <path d="m6 9 6 6 6-6" />
    </GlyphBase>
  );
}

/* ※ `RotateGlyph`(↺)·`CheckGlyph`(✓)도 2026-08-26에 지웠습니다 — 참조 0건이었습니다.
     엔딩의 54px 원은 텍스트 글리프로 그리고 있고(`EndingPanel`), 판정 표기는 `StatusMark`가
     마크와 판정어를 한 벌로 묶어 그립니다. 살아 있는 글리프는 `ChevronGlyph` 하나뿐입니다 —
     그것만 폰트에 **없는 글자**(U+2304)를 대신하기 때문입니다. */
