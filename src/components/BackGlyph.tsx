import { cx } from "./utils";

/** 라벨 옆(`inline`)이냐 단독 아이콘 버튼(`solo`)이냐 — 두 단이면 충분합니다. */
export type BackGlyphSize = "inline" | "solo";

export interface BackGlyphProps {
  size?: BackGlyphSize;
  /** 색을 바꿔야 할 때만. 기본은 `ink-soft`입니다. */
  className?: string;
}

/**
 * 뒤로 표식 `‹` — 가이드 §3이 정식 아이콘으로 지정한 문자 기호입니다.
 *
 * 이 앱에서 가장 자주 눌리는 표식이고, 글리프라 자간·베어링이 크기에 그대로 비례합니다.
 * 그런데 실제 크기가 화면마다 세 종이었습니다 — 세션 헤더 17px · 응급 재생기 19px ·
 * 브리핑 **22px**, 색도 `ink-soft`와 `ink-muted`로 갈렸습니다. 훈련 목록 → 브리핑 → 세션으로
 * 3연속 이동하면 같은 자리의 같은 표식이 22 → 17로 튀는 걸 그대로 보게 됩니다.
 *
 * 그래서 두 단만 남깁니다.
 * - `inline` 17px — 13.5px 라벨(「훈련 목록」·「안내 종료」) 옆에 설 때.
 * - `solo` 19px — 라벨 없이 혼자 서는 아이콘 버튼(세션 헤더).
 *
 * 색은 `ink-soft` 한 단입니다. 터치 영역(48px)은 이 조각이 아니라 **감싸는 버튼/링크**가
 * 가집니다 — 글리프는 언제나 장식이라 `aria-hidden`이고, 이름은 감싸는 쪽의 `aria-label`이
 * 전달합니다(§4 아이콘 단독 사용 금지).
 *
 * @example
 * <Link href="/train" aria-label="훈련 목록" className="flex min-h-[48px] items-center gap-[10px]">
 *   <BackGlyph /> 훈련 목록
 * </Link>
 * @example
 * <button aria-label="뒤로" className="flex h-12 w-12 items-center justify-center">
 *   <BackGlyph size="solo" />
 * </button>
 */
export function BackGlyph({ size = "inline", className }: BackGlyphProps) {
  return (
    <span
      aria-hidden
      className={cx(
        "leading-none text-ink-soft",
        size === "solo" ? "text-[1.1875rem]" : "text-[1.0625rem]",
        className,
      )}
    >
      ‹
    </span>
  );
}

export default BackGlyph;
