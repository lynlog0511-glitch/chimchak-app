import type { CSSProperties, ReactNode } from "react";
import { cx } from "../utils";

/* ─────────────────────────────────────────────────────────────
   텍스트 글리프 대체 SVG (심미 c36 · mi45)

   왜 필요한가 — 동봉 폰트에 **없는 글자**를 화면에 쓰고 있었습니다.
   public/fonts/PretendardVariable.woff2 의 cmap을 fontTools로 열어 재확인한 결과:

     U+2304 '⌄' (펼침 마커)  → MISSING   ← 11곳에서 렌더 중
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

/**
 * 54px 원 안 마크의 **광학 보정** — 시안 6a·6b가 지정한 값입니다.
 *
 * ✓는 24px, ↺는 자폭이 넓어 22px로 한 단 내립니다. 둘을 같은 값으로 맞추면
 * 재훈련 엔딩(↺)의 원만 꽉 차 보여 충족 엔딩(✓)과 무게가 달라집니다.
 * 주석으로 두면 다음 사람이 「같은 값으로 통일」하며 지우므로 상수로 남깁니다.
 *
 * @example <RotateGlyph size={CIRCLE_MARK_PX.rotate} />
 */
export const CIRCLE_MARK_PX = {
  check: 24,
  rotate: 22,
} as const;

/* 체크 도형은 두 벌이 필요합니다 — 상자를 꽉 채우는 것과 원 안에 들어가는 것.
   두 값이 서로 다른 파일에 흩어져 있던 것이 「StatusMark의 SVG ✓ vs 텍스트 ✓」 이원화의 뿌리였습니다.
   기하는 여기 한 곳에만 둡니다. */

/** 24×24 상자를 채우는 체크 — 단독 글리프·54px 원 안 마크용. */
export const CHECK_PATH = "m4.6 12.4 5 5L19.4 6.8";

/** 반지름 8.6 원 안에 들어가는 작은 체크 — `StatusMark`의 채운 원 안에서 씁니다. */
export const CHECK_PATH_IN_CIRCLE = "m8.2 12.3 2.6 2.6 5-5.4";

export interface GlyphProps {
  /**
   * 14px(`"sm"`) · 20px(`"md"`) 두 종이 기본입니다.
   * 그 밖의 크기는 px 숫자로 주되, 시안이 지정한 값일 때만 그렇게 하세요
   * (원 안 마크는 `CIRCLE_MARK_PX`를 쓰면 됩니다).
   */
  size?: GlyphSize | number;
  /** 색은 `text-*`로 상속됩니다. */
  className?: string;
  /** 기본 2 — 24 viewBox 기준이라 14px에서 약 1.17px로 그려집니다(Pretendard 획과 비슷). */
  strokeWidth?: number;
}

interface GlyphBaseProps extends GlyphProps {
  children: ReactNode;
  style?: CSSProperties;
}

function GlyphBase({ size = "sm", className, strokeWidth = 2, children, style }: GlyphBaseProps) {
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

/**
 * 재훈련 마크 — `↺`(U+21BA)의 SVG 대체물입니다.
 *
 * 폰트에 글자 자체는 있지만(폴백 아님), 엔딩 원 안에서 ✓(SVG)와 나란히 서기 때문에
 * 한쪽만 폰트가 그리면 획 굵기가 어긋납니다. 54px 원 안에서는 `CIRCLE_MARK_PX.rotate`(22px)를 쓰세요.
 *
 * @example <RotateGlyph size={CIRCLE_MARK_PX.rotate} className="text-warn-ink" />
 */
export function RotateGlyph({ size, className, strokeWidth }: GlyphProps) {
  return (
    <GlyphBase size={size} className={className} strokeWidth={strokeWidth}>
      {/* 반시계 방향 열린 원 — 중심 (12,12) 반지름 8, 오른쪽 위가 트여 있습니다. */}
      <path d="M12 4a8 8 0 1 0 5.66 2.34" />
      {/* 화살촉 — 원 꼭대기에서 왼쪽(반시계)을 가리킵니다. */}
      <path d="M15.3 6.3 12 4l3.3-2.3" />
    </GlyphBase>
  );
}

/**
 * 충족 체크 — 텍스트 `✓`의 대체물입니다.
 *
 * 판정 표기(코칭 행·엔딩 라벨)에는 이 글리프 대신 **`StatusMark`를 쓰세요** —
 * 마크와 판정어("충족")를 한 벌로 묶어 두어야 색만으로 뜻이 전해지지 않습니다.
 * 이 글리프는 판정이 아닌 자리(엔딩 54px 원, 목록 앞 작은 배지)에서만 씁니다.
 *
 * @example <span className="…원…"><CheckGlyph size={CIRCLE_MARK_PX.check} /></span>
 */
export function CheckGlyph({ size, className, strokeWidth }: GlyphProps) {
  return (
    <GlyphBase size={size} className={className} strokeWidth={strokeWidth}>
      <path d={CHECK_PATH} />
    </GlyphBase>
  );
}
