import type { KeyboardEventHandler, PointerEventHandler } from "react";
import { cx } from "./utils";

export type MicButtonSize = "md" | "lg";

/* 시안 4a(52px 대기) · 4b(64px 녹음 중) 도형 그대로.
   마이크는 v4에서 유일하게 "그려서" 쓰는 도형입니다 — 아이콘 폰트도 SVG 세트도 쓰지 않습니다. */
const SPEC: Record<
  MicButtonSize,
  { box: number; capW: number; capH: number; capR: number; barW: number; barGap: number }
> = {
  md: { box: 52, capW: 10, capH: 16, capR: 5, barW: 14, barGap: 2 },
  lg: { box: 64, capW: 11, capH: 18, capR: 6, barW: 16, barGap: 3 },
};

/** 대기(md) 옅은 링 3px / 녹음(lg) 이중 링 8px + 16px */
const RING: Record<MicButtonSize, string> = {
  md: "0 0 0 3px var(--color-tint)",
  lg: "0 0 0 8px var(--color-tint), 0 0 0 16px var(--color-brand-50)",
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
        "transition-colors duration-150 ease-soft",
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
      {/* 받침대 */}
      <span
        aria-hidden
        className="block rounded-[1px] bg-white"
        style={{ width: spec.barW, height: 2, marginTop: spec.barGap }}
      />
    </button>
  );
}

export default MicButton;
