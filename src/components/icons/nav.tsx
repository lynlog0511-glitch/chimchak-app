import { IconBase, type IconProps } from "./IconBase";

/* ─────────────────────────────────────────────────────────────
   네비게이션·개념 아이콘
   상단 네비/하단 탭바/섹션 표제에서 쓰는 아이콘 묶음입니다.
   ───────────────────────────────────────────────────────────── */

/** 홈 */
export function IconHome({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <path d="M3.5 10.4 12 3.6l8.5 6.8" />
      <path d="M5.6 9.2V19a1.4 1.4 0 0 0 1.4 1.4h10a1.4 1.4 0 0 0 1.4-1.4V9.2" />
      <path d="M9.8 20.4v-5.2h4.4v5.2" />
    </IconBase>
  );
}

/** 대화·훈련 (말풍선) */
export function IconChat({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <path d="M4.6 4.8h14.8a1.6 1.6 0 0 1 1.6 1.6v8.4a1.6 1.6 0 0 1-1.6 1.6H10l-4.4 3.4v-3.4h-1A1.6 1.6 0 0 1 3 14.8V6.4a1.6 1.6 0 0 1 1.6-1.6Z" />
    </IconBase>
  );
}

/** 응급 (경광등) */
export function IconSiren({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <path d="M7.6 16.4V14a4.4 4.4 0 0 1 8.8 0v2.4" />
      <path d="M5.4 16.4h13.2a1 1 0 0 1 1 1v2.1a1 1 0 0 1-1 1H5.4a1 1 0 0 1-1-1v-2.1a1 1 0 0 1 1-1Z" />
      <path d="M12 3.4v2.2" />
      <path d="M5.6 6 7.1 7.5" />
      <path d="M18.4 6 16.9 7.5" />
    </IconBase>
  );
}

/** 기록 (급여제공기록지 · 클립보드) */
export function IconNote({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <path d="M8.8 4.6H7A1.5 1.5 0 0 0 5.5 6.1V19a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5V6.1a1.5 1.5 0 0 0-1.5-1.5h-1.8" />
      <path d="M9.6 3h4.8a1 1 0 0 1 1 1v1.7a1 1 0 0 1-1 1H9.6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M9 11.6h6" />
      <path d="M9 15.4h4" />
    </IconBase>
  );
}

/** 성장 (새싹) */
export function IconSprout({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <path d="M12 20.6v-8.2" />
      <path d="M12 12.4C12 9 9.6 6.6 6.2 6.6c0 3.4 2.4 5.8 5.8 5.8Z" />
      <path d="M12 12.4c0-2.9 2.1-5 5-5 0 2.9-2.1 5-5 5Z" />
      <path d="M7.4 20.6h9.2" />
    </IconBase>
  );
}

/** 안전 설계 (방패) */
export function IconShield({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <path d="M12 3.2 4.9 6v5.4c0 4.3 2.9 7.6 7.1 9.4 4.2-1.8 7.1-5.1 7.1-9.4V6L12 3.2Z" />
    </IconBase>
  );
}

/** 검증된 안전 (방패+체크) */
export function IconShieldCheck({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <path d="M12 3.2 4.9 6v5.4c0 4.3 2.9 7.6 7.1 9.4 4.2-1.8 7.1-5.1 7.1-9.4V6L12 3.2Z" />
      <path d="m9 11.9 2.2 2.2 4-4.3" />
    </IconBase>
  );
}

/** 근거 문서 */
export function IconDocument({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <path d="M6.6 3.5h6.9l4.9 4.9V19a1.5 1.5 0 0 1-1.5 1.5H6.6A1.5 1.5 0 0 1 5.1 19V5a1.5 1.5 0 0 1 1.5-1.5Z" />
      <path d="M13.3 3.6v4.9h4.9" />
      <path d="M8.6 13.4h6.8" />
      <path d="M8.6 16.7h4.4" />
    </IconBase>
  );
}

/** 한 사람 (어르신·학습자) */
export function IconUser({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <circle cx="12" cy="8" r="3.8" />
      <path d="M4.9 20.3c0-3.6 3.2-5.7 7.1-5.7s7.1 2.1 7.1 5.7" />
    </IconBase>
  );
}

/** 여러 사람 (보호자·동료) */
export function IconUsers({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <circle cx="9.6" cy="8" r="3.5" />
      <path d="M3.2 20.3c0-3.4 2.9-5.5 6.4-5.5s6.4 2.1 6.4 5.5" />
      <path d="M16.3 4.9a3.5 3.5 0 0 1 0 6.4" />
      <path d="M17.6 15.1c2.1.7 3.2 2.4 3.2 4.5" />
    </IconBase>
  );
}

/** 돌봄 (손 위의 마음) */
export function IconHeartHand({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <path d="M12 7.9c1.4-1.6 4.6-1 4.6 1.7 0 2-2.4 3.8-4.6 5.4-2.2-1.6-4.6-3.4-4.6-5.4 0-2.7 3.2-3.3 4.6-1.7Z" />
      <path d="M4.6 19.7c1.9-2.5 4.4-3.7 7.4-3.7s5.5 1.2 7.4 3.7" />
    </IconBase>
  );
}

/**
 * AI 생성 표시 — 반짝임(sparkle) 대신 절제된 기하 마름모 하나만 씁니다.
 * 작은 크기(15~16px)에서도 형태가 뭉개지지 않게 내부 장식을 두지 않았습니다.
 */
export function IconAi({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <path d="M12 3.6 20.4 12 12 20.4 3.6 12 12 3.6Z" />
    </IconBase>
  );
}
