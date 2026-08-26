/**
 * 침착 아이콘 시스템 배럴.
 *
 * 규격(가이드 v4 §3): 24×24 viewBox · stroke=currentColor · strokeWidth 1.75 ·
 * strokeLinecap/Join=round · fill=none · aria-hidden 기본.
 * 색은 `text-*`로 상속되고, 크기는 `className`의 `h-` `w-` 유틸로 조정합니다(기본 24px).
 *
 * 규칙: **아이콘 단독 사용 금지** — 항상 텍스트 라벨과 함께 씁니다.
 *
 * ── 2026-08-26 정리 ──────────────────────────────────────────
 * 이 배럴은 한때 43종을 내보냈고 그중 **소비처가 있는 것은 아홉**이었습니다
 * (5차 페르소나 디자이너 low — 「아이콘 시스템이 다스리는 대상 대부분이 화면에 없다」).
 * 「죽은 규격은 남기지 않는다」(가이드 §9-9)를 아이콘에도 그대로 적용해,
 * 참조 0건이던 서른아홉을 지웠습니다 — `action.tsx`(16종)·`status.tsx`(11종) 두 파일과
 * `nav.tsx`의 개념 아이콘 여덟, `glyphs.tsx`의 `CheckGlyph`·`RotateGlyph`·`CHECK_PATH`·
 * `CIRCLE_MARK_PX`입니다. 같은 날 소비처가 함께 죽은 셋(IconSprout·IconClock·IconDot)도
 * 지웠습니다 — `IconDot`은 `TierIndicator`(렌더 0건)가, 나머지 둘은 `NextTrainingReasonMark`
 * (참조 0건)가 유일한 소비처였습니다.
 *
 * 남은 것은 **화면에 실제로 서는 것들뿐**입니다:
 *   · 탭바 5종(`nav.tsx`) — 광학 상자·잉크 면적 규율은 그 파일 주석에 있습니다.
 *   · `ChevronGlyph` — 동봉 폰트에 **없는 글자** `⌄`(U+2304)의 대체물입니다.
 *   · `StatusMark` — 판정 마크(마크 + 판정어 한 벌).
 * 새 아이콘이 필요해지면 **쓰는 자리와 함께** 그립니다. 미리 그려 두지 않습니다.
 *
 * @example
 * import { StatusMark } from "@/components/icons";
 * <StatusMark kind="met" label="충족" />
 */

export { IconBase } from "./IconBase";
export type { IconProps } from "./IconBase";

/* 하단 탭바 5칸 — 아이콘은 언제나 장식이고 의미는 라벨이 전합니다(가이드 §9-12). */
export { IconHome, IconChat, IconSiren, IconNote, IconHistory } from "./nav";

/* 판정 마크 — 초록 원·흰 원·빨강 원 이모지의 표준 대체물 */
export { StatusMark, STATUS_MARK_LABEL } from "./StatusMark";
export type { StatusMarkProps, StatusMarkKind, StatusMarkSize } from "./StatusMark";

/* 텍스트 글리프 대체물 — 동봉 폰트에 **없는** `⌄`(U+2304)를 SVG로 통일합니다.
   `⌄`를 쓰는 자리(편성표·브리핑 details·엔딩 「외 N개」·CF 대안 다시 보기·규칙 예시)는
   `<ChevronGlyph open={…} />`로 쓰면 폴백도, rotate-180의 축 어긋남도 함께 사라집니다. */
export { ChevronGlyph } from "./glyphs";
export type { GlyphProps, GlyphSize, ChevronGlyphProps } from "./glyphs";
/* `GLYPH_PX`(14/20)는 배럴에서 내보내지 않습니다 — 밖에서 읽는 자리가 0건이고, 크기는
   `<ChevronGlyph size="sm|md" />`로 고르는 것이 이 컴포넌트의 문법입니다. */
