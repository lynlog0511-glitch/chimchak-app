"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  DEFAULT_SETTINGS,
  FONT_SCALE_OPTIONS,
  SPEECH_RATE_OPTIONS,
  SPEECH_RATE_VALUE,
  getSettings,
  setSetting,
  subscribeSettings,
  type ChimchakSettings,
  type FontScale,
  type SpeechRate,
} from "@/lib/settings";
import { isSpeechSynthesisSupported, speak, stopSpeaking } from "@/lib/speech";
import { IconBase, type IconProps } from "./icons";
import { cx } from "./utils";

/** 「음성 빠르기」를 고르면 곧바로 이 한 문장을 읽어 줍니다 — 귀로 확인하고 고르시라고요. */
const SAMPLE_TEXT = "지금 이 빠르기로 안내해 드립니다.";

/**
 * 설정 아이콘(톱니).
 * 아이콘 세트에 톱니가 없어 이 파일 안에서만 쓰는 지역 아이콘으로 둡니다.
 * 규격은 시스템과 동일합니다(§4): IconBase 사용 · 24×24 · stroke 1.75 · currentColor.
 */
function IconGear({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <circle cx="12" cy="12" r="3.2" />
      <circle cx="12" cy="12" r="6" />
      <path d="M18 12h1.8" />
      <path d="m16.2 7.8 1.3-1.3" />
      <path d="M12 6V4.2" />
      <path d="M7.8 7.8 6.5 6.5" />
      <path d="M6 12H4.2" />
      <path d="m7.8 16.2-1.3 1.3" />
      <path d="M12 18v1.8" />
      <path d="m16.2 16.2 1.3 1.3" />
    </IconBase>
  );
}

interface OptionButtonProps {
  label: string;
  selected: boolean;
  onSelect: () => void;
}

/**
 * 설정 선택 버튼.
 * 선택 상태는 **틸 채움 + 흰 글자**입니다(brand-700은 흰 글자에서 AA를 넘습니다).
 * 비선택은 회색 면 — 보더를 두르지 않습니다(§1-4, §5).
 * 터치 타겟 48px은 여기서도 불변입니다.
 */
function OptionButton({ label, selected, onSelect }: OptionButtonProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cx(
        "chim-label min-h-[48px] flex-1 rounded-[12px] px-2",
        "transition-colors duration-150 ease-soft",
        selected
          ? "bg-brand-700 font-bold text-white"
          : "bg-neutral-soft text-ink hover:bg-neutral-line",
      )}
    >
      {label}
    </button>
  );
}

export interface SettingsMenuProps {
  className?: string;
}

/**
 * 표시·음성 설정 팝오버.
 *
 * 헤더 우측에 놓여 데스크톱·모바일 어디서나 같은 자리에서 열립니다(탭바에는 두지 않습니다 —
 * 탭바 5칸은 이동용이고, 설정은 이동이 아니기 때문입니다).
 *
 * 담는 것은 두 가지뿐입니다.
 * - **글자 크기**: 루트 font-size를 16/18/20px로 바꿉니다. 토큰이 전부 rem이라 화면이 통째로 비례합니다.
 * - **음성 빠르기**: `speak()`의 기본 rate가 됩니다. 고르는 즉시 예시 문장을 한 번 읽어 확인시켜 줍니다.
 *
 * 형태는 v3 문법입니다: 흰 면·무보더·팝오버 그림자(shadow-panel), 라벨 15px, 버튼 48px,
 * 선택은 틸 채움 하나로만 알립니다(체크 아이콘·보더·색 바 없음).
 *
 * @example <SettingsMenu />
 */
export function SettingsMenu({ className }: SettingsMenuProps) {
  const [open, setOpen] = useState(false);
  const [settings, setSettingsState] = useState<ChimchakSettings>(DEFAULT_SETTINGS);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  /**
   * 예시 문장을 재생한 적이 있는지.
   * 닫을 때 무조건 stopSpeaking()을 부르면, 응급 프로토콜을 낭독하는 도중에 설정을 열었다 닫은
   * 사용자의 안내까지 끊어 버립니다. 우리가 시작한 소리만 우리가 멈춥니다.
   */
  const samplePlayedRef = useRef(false);
  const panelId = useId();
  const fontLabelId = `${panelId}-font`;
  const speechLabelId = `${panelId}-speech`;

  // 저장된 값은 마운트 뒤에 읽습니다(서버 렌더 결과와 어긋나지 않게).
  useEffect(() => {
    setSettingsState(getSettings());
    setVoiceSupported(isSpeechSynthesisSupported());
    return subscribeSettings(setSettingsState);
  }, []);

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (samplePlayedRef.current) {
      stopSpeaking();
      samplePlayedRef.current = false;
    }
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  // 바깥 클릭·ESC로 닫기
  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event: Event): void => {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) return;
      close(false);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") close(true);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  const chooseFontScale = (value: FontScale): void => {
    setSettingsState(setSetting("fontScale", value));
  };

  const chooseSpeechRate = (value: SpeechRate): void => {
    setSettingsState(setSetting("speechRate", value));
    // 고른 빠르기를 귀로 바로 확인시켜 줍니다(진행 중이던 발화는 speak()가 취소합니다).
    samplePlayedRef.current = true;
    void speak(SAMPLE_TEXT, { rate: SPEECH_RATE_VALUE[value] });
  };

  return (
    <div ref={rootRef} className={cx("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? panelId : undefined}
        onClick={() => (open ? close(true) : setOpen(true))}
        className={cx(
          "chim-meta inline-flex min-h-[48px] items-center gap-1.5 px-2 font-semibold",
          "transition-colors duration-150",
          open ? "text-brand-800" : "text-ink-soft hover:text-brand-800",
        )}
      >
        <IconGear className="h-5 w-5" />
        설정
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="표시·음성 설정"
          className={cx(
            "absolute top-full right-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))]",
            "rounded-panel bg-white p-4 shadow-panel",
          )}
        >
          <div>
            <p id={fontLabelId} className="chim-label text-ink">
              글자 크기
            </p>
            <div role="group" aria-labelledby={fontLabelId} className="mt-2 flex gap-2">
              {FONT_SCALE_OPTIONS.map((option) => (
                <OptionButton
                  key={option.value}
                  label={option.label}
                  selected={settings.fontScale === option.value}
                  onSelect={() => chooseFontScale(option.value)}
                />
              ))}
            </div>
            <p className="chim-caption mt-2 text-ink-muted">
              화면 전체 글자가 함께 커집니다. 언제든 되돌릴 수 있습니다.
            </p>
          </div>

          <div className="mt-5">
            <p id={speechLabelId} className="chim-label text-ink">
              음성 빠르기
            </p>
            <div role="group" aria-labelledby={speechLabelId} className="mt-2 flex gap-2">
              {SPEECH_RATE_OPTIONS.map((option) => (
                <OptionButton
                  key={option.value}
                  label={option.label}
                  selected={settings.speechRate === option.value}
                  onSelect={() => chooseSpeechRate(option.value)}
                />
              ))}
            </div>
            <p className="chim-caption mt-2 text-ink-muted">
              {voiceSupported
                ? "누르시면 예시 문장을 한 번 읽어 드립니다. 훈련 대사와 응급 안내 낭독에 함께 적용됩니다."
                : "이 기기에서는 음성 낭독을 지원하지 않습니다. 안내 문구는 화면 자막으로 그대로 보실 수 있습니다."}
            </p>
          </div>

          <p className="chim-caption mt-5 rounded-field bg-paper-2 px-3 py-2 text-ink-muted">
            설정은 이 기기에만 저장됩니다.
          </p>
        </div>
      )}
    </div>
  );
}

export default SettingsMenu;
