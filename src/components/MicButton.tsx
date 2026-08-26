import type { KeyboardEventHandler, PointerEventHandler } from "react";
import { cx } from "./utils";

export type MicButtonSize = "md" | "lg";

/* 시안 4a(52px 대기) · 4b(64px 녹음 중) 도형.
   마이크는 v4에서 유일하게 "그려서" 쓰는 도형입니다 — 아이콘 폰트도 SVG 세트도 쓰지 않습니다.

   ── 받침 = U자 크래들 (2026-08-25) ─────────────────────────────
   예전 받침은 폭 14 · 높이 2의 **막대**였습니다. 2px 막대는 「받침」이 아니라 밑줄로 읽혀,
   52px 원 안이 「알약 + 밑줄」, 즉 마이크보다 문단 기호에 가까워 보였습니다.
   지금은 캡슐 아래에 좌·우·아래 2px 테두리만 남긴 반원(폭 16 · 높이 6 · radius 0 0 8 8)을
   두고 그 아래에 2px 스템을 세웁니다 — 20px 남짓으로 줄여도 마이크로 읽힙니다.

   ── 치수는 rem (2026-08-25) ────────────────────────────────────
   마이크는 코어 경로에서 손끝이 닿아야 하는 컨트롤이라 「아주 크게」에서 함께 커져야 합니다.
   px로 두면 글자만 25% 커지고 마이크는 그대로라, 그 설정이 실제로 쓸 만해지지 않습니다.
   (터치 타겟 48/54/56px처럼 **물리 치수**로 고정하는 자리와는 다릅니다 — 여기는 이미
    52/64px로 하한을 크게 넘겨 두었고, 줄어드는 방향으로는 움직이지 않습니다.) */
interface MicSpec {
  /** 원 지름 — 52px / 64px에 해당하는 rem */
  box: string;
  capW: string;
  capH: string;
  capR: string;
  /** U자 크래들 바깥 폭·높이·아래 모서리 반지름 */
  cradleW: string;
  cradleH: string;
  cradleR: string;
  /** 크래들 테두리 굵기 = 스템 굵기 */
  stroke: string;
  stemH: string;
  gap: string;
}

const SPEC: Record<MicButtonSize, MicSpec> = {
  md: {
    box: "3.25rem" /* 52 */,
    capW: "0.625rem" /* 10 */,
    capH: "1rem" /* 16 */,
    capR: "0.3125rem" /* 5 */,
    cradleW: "1rem" /* 16 */,
    cradleH: "0.375rem" /* 6 */,
    cradleR: "0.5rem" /* 8 */,
    stroke: "0.125rem" /* 2 */,
    stemH: "0.1875rem" /* 3 */,
    gap: "0.125rem" /* 2 */,
  },
  lg: {
    box: "4rem" /* 64 */,
    capW: "0.6875rem" /* 11 */,
    capH: "1.125rem" /* 18 */,
    capR: "0.375rem" /* 6 */,
    cradleW: "1.125rem" /* 18 */,
    cradleH: "0.4375rem" /* 7 */,
    cradleR: "0.5625rem" /* 9 */,
    stroke: "0.125rem" /* 2 */,
    stemH: "0.21875rem" /* 3.5 */,
    gap: "0.1875rem" /* 3 */,
  },
};

/** 대기(md) 옅은 링 3px / 녹음(lg) 이중 링 8px + 16px */
const RING: Record<MicButtonSize, string> = {
  md: "0 0 0 3px var(--color-brand-tint)",
  lg: "0 0 0 8px var(--color-brand-tint), 0 0 0 16px var(--color-brand-50)",
};

export interface MicButtonProps {
  /** md 52px(대기) · lg 64px(녹음 중) */
  size?: MicButtonSize;
  /** 누르고 있는 중 — `aria-pressed`가 함께 붙고 채움이 딥으로 바뀝니다. */
  pressed?: boolean;
  /** 채움만 딥(`mic-deep` #0f6b63)으로 강제 — 기본값은 `pressed`를 따릅니다. */
  deep?: boolean;
  /** 스크린리더 라벨 — 상태에 따라 「말하기」/「말하는 중, 손을 떼면 전송」처럼 바꿔 주세요. */
  label: string;
  disabled?: boolean;
  onClick?: () => void;
  onPointerDown?: PointerEventHandler<HTMLButtonElement>;
  onPointerUp?: PointerEventHandler<HTMLButtonElement>;
  onPointerCancel?: PointerEventHandler<HTMLButtonElement>;
  onPointerLeave?: PointerEventHandler<HTMLButtonElement>;
  /** 키보드로도 누르고 있기가 되게 하려면 keydown/keyup을 함께 주세요(Space·Enter). */
  onKeyDown?: KeyboardEventHandler<HTMLButtonElement>;
  onKeyUp?: KeyboardEventHandler<HTMLButtonElement>;
  className?: string;
}

/**
 * 마이크 버튼 (v4 §3 · 시안 4a⑦·4b).
 *
 * - 대기: 52px `brand-600` + 옅은 링 3px `tint` — "누를 곳"이라는 신호입니다.
 * - 녹음 중: 64px `mic-deep` + 이중 링(8px `tint` / 16px `brand-50`).
 *
 * 두 크기 모두 터치 타겟 48px을 넘습니다. 상태를 색으로만 전하지 않도록,
 * 옆에 「듣고 있어요」·「손을 떼면 전송돼요」 같은 텍스트를 항상 함께 두세요.
 *
 * @example
 * <MicButton label="말하기" onPointerDown={start} onPointerUp={stop} />
 * @example
 * <MicButton size="lg" pressed label="말하는 중 — 손을 떼면 전송됩니다" onPointerUp={stop} />
 */
export function MicButton({
  size = "md",
  pressed = false,
  deep,
  label,
  disabled = false,
  onClick,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  onPointerLeave,
  onKeyDown,
  onKeyUp,
  className,
}: MicButtonProps) {
  const spec = SPEC[size];
  const isDeep = deep ?? pressed;

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={onPointerLeave}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      className={cx(
        "flex flex-none flex-col items-center justify-center rounded-full",
        // 눌림 = 딥 채움 + 1.5% 축소를 한 박자(150ms)에 — `.chim-press`가 둘을 함께 전이시킵니다.
        // (여기에 `transition-colors`를 다시 걸면 축소가 즉시 튑니다. globals.css 주석 참조)
        "chim-press",
        // 포커스 링 offset을 2px → 5px로. 기본값이면 링이 마이크의 틸 링(md 3px) 위에 겹쳐
        // 그려져 「지금 포커스가 여기」라는 신호가 장식과 뒤섞입니다.
        // 대비: md는 5px 밖이 흰 지면(brand-600 3.72:1) · lg는 tint 링 위(3.30:1) — 도형 기준 3:1 통과.
        "focus-visible:outline-offset-[5px]",
        "disabled:cursor-not-allowed disabled:opacity-45",
        // 누르는 순간 곧바로 눌림 색으로 갑니다 — 상태(pressed)가 부모를 돌아 오기 전에도 손끝에 답합니다.
        isDeep ? "bg-mic-deep" : "bg-brand-600 active:bg-mic-deep",
        className,
      )}
      style={{
        width: spec.box,
        height: spec.box,
        boxShadow: RING[size],
        touchAction: "none",
      }}
    >
      {/* 마이크 헤드 */}
      <span
        aria-hidden
        className="block bg-white"
        style={{ width: spec.capW, height: spec.capH, borderRadius: spec.capR }}
      />
      {/* 받침 — U자 크래들(좌·우·아래 테두리만) */}
      <span
        aria-hidden
        className="block border-white"
        style={{
          width: spec.cradleW,
          height: spec.cradleH,
          marginTop: spec.gap,
          borderLeftWidth: spec.stroke,
          borderRightWidth: spec.stroke,
          borderBottomWidth: spec.stroke,
          borderBottomLeftRadius: spec.cradleR,
          borderBottomRightRadius: spec.cradleR,
        }}
      />
      {/* 스템 — 크래들 아래 짧은 기둥 */}
      <span
        aria-hidden
        className="block bg-white"
        style={{ width: spec.stroke, height: spec.stemH }}
      />
    </button>
  );
}

export default MicButton;
