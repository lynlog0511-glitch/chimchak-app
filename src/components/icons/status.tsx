import { CHECK_PATH } from "./glyphs";
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

/** 원 안의 체크 */
export function IconCheckCircle({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="m8.3 12.2 2.5 2.5 4.9-5.2" />
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

/** 아래 화살표 머리 — 접이식 열림 표시 */
export function IconChevronDown({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <path d="m6.2 9.4 5.8 5.8 5.8-5.8" />
    </IconBase>
  );
}

/** 오른쪽 화살표 머리 */
export function IconChevronRight({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <path d="m9.4 6.2 5.8 5.8-5.8 5.8" />
    </IconBase>
  );
}

/** 왼쪽 화살표 머리 */
export function IconChevronLeft({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <path d="M14.6 6.2 8.8 12l5.8 5.8" />
    </IconBase>
  );
}
