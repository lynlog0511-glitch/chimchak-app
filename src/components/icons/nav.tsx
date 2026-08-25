import { IconBase, type IconProps } from "./IconBase";

/* ─────────────────────────────────────────────────────────────
   네비게이션·개념 아이콘
   상단 네비/하단 탭바/섹션 표제에서 쓰는 아이콘 묶음입니다.

   ── 탭바 5종의 광학 상자 (2026-08-25) ────────────────────────
   홈·훈련·응급·보고·이력은 탭바에서 **등간격으로 나란히** 서기 때문에 크기 편차가
   가장 잘 보이는 자리입니다. 예전 도형 폭은 보고 13.0 · 이력 14.8 · 응급 15.2 ·
   홈 17.0 · 훈련 18.0으로 최대/최소 38% 차이였고, 22px 렌더에서 4.6px이 벌어졌습니다.

   지금은 24 viewBox 안 **20×20(x·y 2~22)** 을 공통 광학 상자로 두고 면적이 같아
   보이도록 배급합니다 — 사각형에 가까운 홈·보고는 상자보다 한 단 작게, 원형인 이력은
   상자에 꽉, 가로로 긴 훈련 말풍선은 폭을 줄이고 높이를 보강했습니다.
   **세로 중심은 다섯 종 모두 12.0입니다**(예전에는 11.6~12.3으로 흩어져 있었습니다).

     홈 3.2~20.8(17.6) · 훈련 3.7~20.3(16.6) · 응급 3.4~20.6(17.2)
     보고 4.1~19.9(15.8) · 이력 2.7~21.3(18.6, 원이라 상자에 꽉)

   각 아이콘의 `filled` 실루엣은 위 **중심선 상자 그대로** 그렸습니다(바깥 가장자리가 아니라).
   면은 선보다 무겁게 읽히므로 바깥 가장자리에 맞추면 활성 칸만 커 보입니다.
   ───────────────────────────────────────────────────────────── */

/** 홈 */
export function IconHome({ className, strokeWidth, filled }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth} filled={filled}>
      {filled ? (
        <path d="M12.7 3.55a1.1 1.1 0 0 0-1.4 0L3.5 10.2a1.1 1.1 0 0 0-.3.75V19.1a1.6 1.6 0 0 0 1.6 1.6h4.9v-5.4h4.6v5.4h4.9a1.6 1.6 0 0 0 1.6-1.6v-8.15a1.1 1.1 0 0 0-.3-.75Z" />
      ) : (
        <>
          <path d="M3.2 10.6 12 3.3l8.8 7.3" />
          <path d="M5.5 9.3V19.3a1.4 1.4 0 0 0 1.4 1.4h10.2a1.4 1.4 0 0 0 1.4-1.4V9.3" />
          <path d="M9.7 20.7v-5.4h4.6v5.4" />
        </>
      )}
    </IconBase>
  );
}

/** 대화·훈련 (말풍선) */
export function IconChat({ className, strokeWidth, filled }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth} filled={filled}>
      {/* 말풍선은 닫힌 도형이라 채움/비움이 같은 패스를 씁니다. */}
      <path d="M5.3 3.3h13.4a1.6 1.6 0 0 1 1.6 1.6v10.5a1.6 1.6 0 0 1-1.6 1.6H10.6l-4.4 3.7V17H5.3a1.6 1.6 0 0 1-1.6-1.6V4.9a1.6 1.6 0 0 1 1.6-1.6Z" />
    </IconBase>
  );
}

/** 응급 (경광등) */
export function IconSiren({ className, strokeWidth, filled }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth} filled={filled}>
      {filled ? (
        <>
          <path d="M4.4 16.5h15.2a1 1 0 0 1 1 1v2.2a1 1 0 0 1-1 1H4.4a1 1 0 0 1-1-1v-2.2a1 1 0 0 1 1-1Z" />
          <path d="M7.1 16.5V13.8a4.9 4.9 0 0 1 9.8 0v2.7Z" />
          {/* 안테나·불빛은 채움에서도 선으로 남깁니다 — 면으로 그리면 뭉툭한 막대가 됩니다. */}
          <path d="M12 3.3v2.3" stroke="currentColor" strokeWidth={1.75} />
          <path d="M5.4 5.9 7 7.5" stroke="currentColor" strokeWidth={1.75} />
          <path d="M18.6 5.9 17 7.5" stroke="currentColor" strokeWidth={1.75} />
        </>
      ) : (
        <>
          <path d="M7.1 16.5V13.8a4.9 4.9 0 0 1 9.8 0v2.7" />
          <path d="M4.4 16.5h15.2a1 1 0 0 1 1 1v2.2a1 1 0 0 1-1 1H4.4a1 1 0 0 1-1-1v-2.2a1 1 0 0 1 1-1Z" />
          <path d="M12 3.3v2.3" />
          <path d="M5.4 5.9 7 7.5" />
          <path d="M18.6 5.9 17 7.5" />
        </>
      )}
    </IconBase>
  );
}

/** 기록 (급여제공기록지 · 클립보드) */
export function IconNote({ className, strokeWidth, filled }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth} filled={filled}>
      {filled ? (
        /* 판 + 집게가 한 덩어리이고, 집게 아래 홈과 두 줄만 evenodd로 파냅니다. */
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M8.7 3.2h6.6a1 1 0 0 1 1 1v.6h2.1a1.5 1.5 0 0 1 1.5 1.5V19.3a1.5 1.5 0 0 1-1.5 1.5H5.6a1.5 1.5 0 0 1-1.5-1.5V6.3a1.5 1.5 0 0 1 1.5-1.5h2.1v-.6a1 1 0 0 1 1-1ZM9.3 5.3a.7.7 0 0 0 0 1.4h5.4a.7.7 0 0 0 0-1.4H9.3ZM7.6 11a.9.9 0 0 0 0 1.8h8.8a.9.9 0 0 0 0-1.8H7.6Zm0 3.8a.9.9 0 0 0 0 1.8h5.9a.9.9 0 0 0 0-1.8H7.6Z"
        />
      ) : (
        <>
          <path d="M9 4.8H5.6A1.5 1.5 0 0 0 4.1 6.3V19.3a1.5 1.5 0 0 0 1.5 1.5h12.8a1.5 1.5 0 0 0 1.5-1.5V6.3a1.5 1.5 0 0 0-1.5-1.5H15" />
          <path d="M8.7 3.2h6.6a1 1 0 0 1 1 1v1.8a1 1 0 0 1-1 1H8.7a1 1 0 0 1-1-1V4.2a1 1 0 0 1 1-1Z" />
          <path d="M7.6 11.9h8.8" />
          <path d="M7.6 15.7h5.9" />
        </>
      )}
    </IconBase>
  );
}

/**
 * 이력 (시계 + 되감기 화살표) — 하단 탭바 「이력」 칸.
 *
 * 호의 종점과 꺾쇠 꼭짓점이 **한 점(2.7, 6.9)에서 만납니다**. 예전에는 호가 꺾쇠의
 * 가로획 한가운데에 0.3 위로 얹혀 있어 화살촉이 아니라 원 옆에 붙은 ⌐ 브래킷으로 읽혔고,
 * 라운드캡 탓에 호 끝 오른쪽에 뭉툭한 돌기가 하나 남았습니다.
 * 지금은 호 끝에서 꼭짓점까지 명시적 직선(`L2.7 6.9`)으로 내려 세웁니다.
 *
 * 채움 변형은 **시계 판을 채우고 바늘을 파낸** 모양입니다. 되감기 꺾쇠는 선 도형이라
 * 면 안에서는 판에 먹히므로 채움에서는 두지 않습니다 — 뜻은 옆 라벨 「이력」이 전합니다
 * (§4 아이콘 단독 사용 금지). 채운 판은 선보다 무겁게 읽히므로 지름을 17.2로 한 단 줄였습니다.
 */
export function IconHistory({ className, strokeWidth, filled }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth} filled={filled}>
      {filled ? (
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M12 3.4a8.6 8.6 0 1 0 0 17.2 8.6 8.6 0 0 0 0-17.2Zm.9 3.9v4.6l3.4 2.1-.95 1.55-4.25-2.6V7.3h1.8Z"
        />
      ) : (
        <>
          <path d="M2.7 12a9.3 9.3 0 1 0 3.1-6.9L2.7 6.9" />
          <path d="M2.7 2.7v4.2h4.2" />
          <path d="M12 7.3v5.1l3.6 2.2" />
        </>
      )}
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
