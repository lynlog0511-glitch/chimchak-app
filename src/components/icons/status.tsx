import { CHECK_PATH, CHECK_PATH_IN_CIRCLE } from "./glyphs";
import { IconBase, type IconProps } from "./IconBase";

/* ─────────────────────────────────────────────────────────────
   상태·방향 아이콘
   판정 마크(StatusMark)는 별도 파일에 있습니다 — 여기는 원자 단위 아이콘입니다.
   ───────────────────────────────────────────────────────────── */

/** 체크 — 기하는 `glyphs.tsx`의 `CHECK_PATH` 하나뿐입니다(텍스트 ✓와 이원화 방지 · 심미 mi45). */
export function IconCheck({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <path d={CHECK_PATH} />
    </IconBase>
  );
}

/** 원 안의 체크 — 체크 기하는 `StatusMark`의 채운 원 안 체크와 **같은 상수**를 씁니다.
    (2026-08-24: 여기에만 자체 좌표 `m8.3 12.2 2.5 2.5 4.9-5.2`가 따로 있어,
     같은 화면에 두 종류의 원 안 체크가 나란히 설 수 있었습니다 — mi45가 없앤 이원화의 재발.) */
export function IconCheckCircle({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <circle cx="12" cy="12" r="8.2" />
      <path d={CHECK_PATH_IN_CIRCLE} />
    </IconBase>
  );
}

export interface IconDotProps extends IconProps {
  /** true면 채운 원, false면 빈 원. 판정 2단계(충족/코칭) 표기의 기본 도형입니다. */
  filled?: boolean;
}

/**
 * 채운 원 / 빈 원.
 * 판정 표시에는 되도록 `StatusMark`를 쓰고, 이 아이콘은 목록 불릿 등 일반 용도로 씁니다.
 */
export function IconDot({ className, strokeWidth, filled = false }: IconDotProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <circle cx="12" cy="12" r="6.2" fill={filled ? "currentColor" : "none"} />
    </IconBase>
  );
}

/** 중단·정지 (원 안의 가로 막대) */
export function IconStop({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M8.1 12h7.8" />
    </IconBase>
  );
}

/** 주의 (삼각형 안 느낌표) */
export function IconAlert({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <path d="M10.7 4.5 2.7 18.6a1.5 1.5 0 0 0 1.3 2.2h16a1.5 1.5 0 0 0 1.3-2.2L13.3 4.5a1.5 1.5 0 0 0-2.6 0Z" />
      <path d="M12 10v4.2" />
      <path d="M12 17.6h.01" />
    </IconBase>
  );
}

/** 안내 (원 안 i) */
export function IconInfo({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 11.2v4.8" />
      <path d="M12 8.2h.01" />
    </IconBase>
  );
}

/** 닫기 */
export function IconX({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <path d="m6.2 6.2 11.6 11.6" />
      <path d="M17.8 6.2 6.2 17.8" />
    </IconBase>
  );
}

/** 오른쪽 화살표 */
export function IconArrowRight({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <path d="M4.4 12h15.2" />
      <path d="m13.4 5.8 6.2 6.2-6.2 6.2" />
    </IconBase>
  );
}

/* 셰브론 3형제 — 2026-08-24 교정.
   세 도형 다 팔 길이는 5.8로 같았는데 **중심이 저마다 어긋나** 있었습니다
   (아래 12.3 · 오른쪽 12.3 · 왼쪽 11.7). 24 상자 안에서 광학 중심이 다르면
   같은 행에 나란히 놓았을 때 한쪽만 아래로/왼쪽으로 처져 보이고, 회전을 걸면 축까지 어긋납니다.
   이제 셋 다 중심이 정확히 (12,12)이고, `glyphs.tsx`의 `ChevronGlyph`(6→18 · 9→15)와 같은 결입니다. */

/** 아래 화살표 머리 — 접이식 열림 표시 */
export function IconChevronDown({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <path d="m6.2 9.1 5.8 5.8 5.8-5.8" />
    </IconBase>
  );
}

/** 오른쪽 화살표 머리 */
export function IconChevronRight({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <path d="m9.1 6.2 5.8 5.8-5.8 5.8" />
    </IconBase>
  );
}

/** 왼쪽 화살표 머리 */
export function IconChevronLeft({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <path d="M14.9 6.2 9.1 12l5.8 5.8" />
    </IconBase>
  );
}
