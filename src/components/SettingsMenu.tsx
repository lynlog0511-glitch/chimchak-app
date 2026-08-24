"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import {
  DEFAULT_SETTINGS,
  FONT_SCALE_OPTIONS,
  ONLINE_COACHING_NOTICE,
  ONLINE_COACHING_OPTIONS,
  ONLINE_MODE_LABEL,
  SPEECH_RATE_OPTIONS,
  SPEECH_RATE_VALUE,
  getSettings,
  setOnlineCoaching,
  setSetting,
  subscribeSettings,
  type ChimchakSettings,
  type FontScale,
  type OnlineCoachingSettings,
  type SpeechRate,
} from "@/lib/settings";
import { isSpeechPlaybackSupported, speak, stopSpeaking } from "@/lib/speech";
/* 앱의 오버레이 문법(마운트 초점·Esc·Tab 가두기·배경 스크롤 잠금)은 훅 하나로 통일돼 있습니다
   (⚑CF 시트·종료 확인·규칙 시연 시트가 같은 훅을 씁니다 — 평가 UI/UX mi7).
   한때 이 훅은 `app/train/_components`에 살았고 공용 컴포넌트인 여기서 그 안쪽을 거꾸로 가져다
   썼습니다 — 지금은 공용 자리로 옮겼습니다(부채 감사 · 역방향 의존 해소). */
import { useModalDismiss } from "./useModalDismiss";
import { cx } from "./utils";

/** 「음성 빠르기」를 고르면 곧바로 이 한 문장을 읽어 줍니다 — 귀로 확인하고 고르시라고요. */
const SAMPLE_TEXT = "지금 이 빠르기로 안내해 드립니다.";

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
 *
 * 「고를 수 없는 보기」는 이 팝오버에 더 이상 없습니다 — 온라인 코칭 켜기에 붙어 있던
 * 연결값 조건이 서버 프록시로 옮겨 가면서 사라졌습니다.
 */
function OptionButton({ label, selected, onSelect }: OptionButtonProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cx(
        "chim-label min-h-[48px] flex-1 rounded-[14px] px-2",
        "transition-colors duration-150 ease-soft",
        selected
          ? "bg-brand-700 font-bold text-white active:bg-brand-800"
          : "bg-neutral-soft text-ink hover:bg-neutral-line active:bg-neutral-line",
      )}
    >
      {label}
    </button>
  );
}

export interface SettingsMenuProps {
  className?: string;
  /**
   * 여는 버튼에 적을 낱말.
   * 홈 상단 바에서는 「설정」, 훈련 세션 헤더에서는 「글자 크기」로 부릅니다 —
   * 세션 안에서는 이 팝오버를 여는 까닭이 사실상 글자 크기 하나이기 때문입니다(평가 초보 m2).
   */
  label?: string;
  /**
   * 팝오버를 어디에 맞출지.
   *
   * - `trigger`(기본): 여는 버튼의 오른쪽 끝에 맞춥니다 — 홈 상단 바처럼 버튼이 화면 오른쪽 끝에 있을 때.
   * - `screen`: 화면 오른쪽 끝에 맞춥니다 — 세션 헤더처럼 버튼 오른쪽에 다른 액션이 더 있을 때입니다.
   *   버튼에 맞추면 320px 팝오버가 390px 화면의 왼쪽 밖으로 57px 밀려납니다.
   */
  align?: "trigger" | "screen";
}

interface SettingsPanelProps {
  panelId: string;
  settings: ChimchakSettings;
  voiceSupported: boolean;
  align: "trigger" | "screen";
  /** `screen`일 때 팝오버가 설 세로 위치(px) — 여는 순간 버튼 아래를 실측한 값입니다. */
  screenTop: number;
  onFontScale: (value: FontScale) => void;
  onSpeechRate: (value: SpeechRate) => void;
  onOnlineCoaching: (patch: Partial<OnlineCoachingSettings>) => void;
  onDismiss: () => void;
  /** 팝오버 안 링크로 화면을 옮길 때 — 닫기만 하고 초점은 트리거로 되돌리지 않습니다. */
  onNavigate: () => void;
}

/**
 * 팝오버 본체 — **열려 있는 동안에만** 마운트됩니다.
 *
 * 초점 규칙은 앱의 다른 오버레이와 같은 `useModalDismiss` 한 벌입니다:
 * 열리면 「글자 크기」 라벨로 초점이 가고, Esc로 닫히며, Tab이 팝오버 밖으로 빠지지 않고,
 * 닫으면 열었던 버튼으로 초점이 돌아옵니다. 예전에는 이 화면만 예외라 열어도 초점이 트리거에
 * 남고 Tab이 그대로 새어 나갔습니다 — 하필 고령 사용자가 가장 먼저 여는 화면입니다(평가 UI/UX mi7).
 */
function SettingsPanel({
  panelId,
  settings,
  voiceSupported,
  align,
  screenTop,
  onFontScale,
  onSpeechRate,
  onOnlineCoaching,
  onDismiss,
  onNavigate,
}: SettingsPanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const fontLabelRef = useRef<HTMLParagraphElement | null>(null);
  const fontLabelId = `${panelId}-font`;
  const speechLabelId = `${panelId}-speech`;
  const onlineLabelId = `${panelId}-online`;
  const toScreen = align === "screen";
  const online = settings.onlineCoaching;

  useModalDismiss({ panelRef, initialFocusRef: fontLabelRef, onDismiss });

  return (
    <div
      id={panelId}
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="표시·음성·온라인 모드 설정"
      /* 세션 헤더의 액션 줄은 `whitespace-nowrap`이라, 팝오버 안 문장이 한 줄로 늘어나지 않도록
         여기서 줄바꿈을 되돌립니다. */
      style={toScreen ? { top: `${screenTop}px` } : undefined}
      className={cx(
        "z-50 w-[min(20rem,calc(100vw-2rem))] whitespace-normal",
        toScreen ? "fixed right-3" : "absolute top-full right-0 mt-2",
        "rounded-panel bg-white p-4 shadow-panel",
        /* 글자 크기 「아주 크게」에서는 세 절과 고지 문장만으로도 팝오버가 화면을 넘칩니다.
           밖으로 밀려나는 대신 여기서만 세로로 스크롤합니다(실측 기준). */
        "max-h-[calc(100dvh-5rem)] overflow-y-auto overscroll-contain",
        /* 등장 180ms — 예전에는 이 팝오버만 모션이 0ms라 「툭」 나타났습니다.
           바텀시트(240ms)와 팝오버(180ms) 두 단만 씁니다(모션 감사 6). */
        "animate-pop-in",
      )}
    >
      <div>
        <p id={fontLabelId} ref={fontLabelRef} tabIndex={-1} className="chim-label text-ink">
          글자 크기
        </p>
        <div role="group" aria-labelledby={fontLabelId} className="mt-2 flex gap-2">
          {FONT_SCALE_OPTIONS.map((option) => (
            <OptionButton
              key={option.value}
              label={option.label}
              selected={settings.fontScale === option.value}
              onSelect={() => onFontScale(option.value)}
            />
          ))}
        </div>
        {/* 이 한 줄은 **지킬 수 있게 된 뒤에야** 그대로 둡니다.
            한때는 화면의 글자 크기가 전부 px로 박혀 있어서 「아주 크게」를 눌러도 버튼 라벨
            하나만 커졌습니다(평가 초보 c20 실측 — 지문·항목·칩·고지·h1 전부 그대로).
            지금은 src의 크기 지정이 남김없이 rem이라 루트 16→18→20px이 화면 전체에 그대로
            비례합니다. 예외는 둘뿐이고 둘 다 읽을거리가 아닙니다 —
            안전 페이지 접이식 흐름도(같은 내용이 바로 위에 텍스트로 있습니다)와
            루트 레이아웃이 무너졌을 때 뜨는 오류 화면입니다. */}
        {/* 「언제든 되돌릴 수 있습니다」는 각주가 아니라 안심 문구입니다 —
            글자를 키우려다 화면을 망칠까 봐 손을 못 대는 분께 하는 약속이라
            13px(chim-caption)이 아니라 안심 문구 규격 15px + ink-soft로 둡니다(가이드 §7-8). */}
        <p className="mt-2 text-[0.9375rem] leading-[1.6] text-ink-soft">
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
              onSelect={() => onSpeechRate(option.value)}
            />
          ))}
        </div>
        <p className="mt-2 text-[0.9375rem] leading-[1.6] text-ink-soft">
          {voiceSupported
            ? "누르시면 예시 문장을 한 번 읽어 드립니다. 훈련 대사와 응급 안내 낭독에 함께 적용됩니다."
            : "이 기기에서는 음성 낭독을 지원하지 않습니다. 안내 문구는 화면 자막으로 그대로 보실 수 있습니다."}
        </p>
      </div>

      {/* ── 온라인 모드 (실험) ────────────────────────────────
          기본은 꺼짐입니다. 켜기 전까지 이 앱이 기기 밖으로 보내는 요청은 0건이고,
          켠 뒤에 달라지는 것은 **코칭 문장**과 **어르신·보호자 대사의 말맛** 둘뿐입니다 —
          판정·게이지·기록은 그대로 결정론 엔진이 내린 값입니다
          (/safety의 「AI가 쓰이는 자리」 표와 같은 사실).

          절 이름에 두 자리를 다 적는 이유는 하나입니다: 스위치는 하나인데 여는 문이 둘이면,
          이름이 하나만 말하는 순간 나머지 하나는 사용자가 허락한 적 없는 일이 됩니다.

          한때 이 자리에는 주소·모델 이름·API 키 입력칸 셋이 있었습니다. 지금은 없습니다 —
          키는 서버 환경변수에만 두고 브라우저는 같은 도메인 `/api/coach`만 부릅니다.
          그래서 사용자가 고를 것이 스위치 하나로 줄었고, 켜기에 조건이 붙지 않습니다. */}
      <div className="mt-5 border-t border-line pt-4">
        <p id={onlineLabelId} className="chim-label text-ink">
          {ONLINE_MODE_LABEL}
        </p>
        <div role="group" aria-labelledby={onlineLabelId} className="mt-2 flex gap-2">
          {ONLINE_COACHING_OPTIONS.map((option) => (
            <OptionButton
              key={option.label}
              label={option.label}
              selected={online.enabled === option.value}
              onSelect={() => onOnlineCoaching({ enabled: option.value })}
            />
          ))}
        </div>
        <p className="mt-2 text-[0.9375rem] leading-[1.6] text-ink-soft">
          {ONLINE_COACHING_NOTICE}
        </p>
        <p className="mt-3 text-[0.7813rem] leading-[1.5] text-ink-muted">
          켜도 판정·게이지·기록은 달라지지 않습니다. 미분류로 넘어간 턴에만 코칭 문장이 한 줄
          더해지고, 근거 가드를 통과하지 못한 문장은 화면에 나가지 않습니다. 대사 변주는
          형식·길이·숫자·금지 표현, 그리고 앵커에 없던 위험 신호(판정 규칙 엔진을 그대로 다시
          씁니다)를 기기 안에서 확인한 뒤에만 화면에 서고, 한 단이라도 지나지 못하면 검수 문장이
          그대로 나옵니다. 연결이 준비돼 있지 않으면 아무것도 나가지 않습니다.
        </p>
      </div>

      <p className="mt-5 rounded-field bg-paper-2 px-3 py-2 text-[0.9375rem] leading-[1.6] text-ink-soft">
        설정은 이 기기에만 저장됩니다.
      </p>

      {/* 처음 오신 분이 가장 자주 여는 화면이 설정입니다 — 글자를 키우려고 들어왔다가
          「그래서 이걸 어떻게 쓰는가」를 물을 자리가 여기밖에 없습니다. 버튼으로 세우지 않고
          조용한 텍스트 한 줄로만 둡니다(설정을 고치러 온 분의 흐름을 끊지 않으려고요). */}
      <Link
        href="/guide"
        onClick={onNavigate}
        className="mt-1 inline-flex min-h-[48px] items-center text-[0.8438rem] leading-[1.45] font-semibold text-ink-muted underline decoration-1 underline-offset-[3px] transition-colors duration-150 hover:text-brand-800"
      >
        처음 오신 분께
      </Link>
    </div>
  );
}

/**
 * 표시·음성 설정 팝오버.
 *
 * 트리거는 **텍스트 버튼**뿐입니다(시안 5a) — 톱니 아이콘은 쓰지 않고 13.5px w600 `ink-muted`
 * 한 낱말로만 둡니다. 탭바에는 두지 않습니다 — 탭바 5칸은 이동용이고, 설정은 이동이 아닙니다.
 * 자리는 둘입니다: 홈 상단 바의 「설정」과 훈련 세션 헤더의 「글자 크기」(`label`·`align` 참고).
 * 세션 안에 진입점이 없으면, 대사가 작다고 느낀 분이 훈련을 나갔다가 홈까지 가서 설정하고
 * 다시 들어와야 합니다 — 노안이 있는 분께는 그 길이 사실상 막힌 길입니다(평가 UI/UX mi5 · 초보 m2).
 *
 * 담는 것은 셋입니다.
 * - **글자 크기**: 루트 font-size를 16/18/20px로 바꿉니다. 토큰이 전부 rem이라 화면이 통째로 비례합니다.
 * - **음성 빠르기**: `speak()`의 기본 rate가 됩니다. 고르는 즉시 예시 문장을 한 번 읽어 확인시켜 줍니다.
 * - **온라인 모드 (실험)**: 기본 꺼짐. 켜기 전에는 이 앱이 기기 밖으로 요청을 보내지 않습니다.
 *   스위치 하나가 코칭 한 문장과 어르신·보호자 대사 변주 두 자리를 함께 엽니다.
 *   여기 있는 이유는 하나입니다 — 발화가 밖으로 나가는 스위치는 사용자 손에 있어야 하고,
 *   그 사실을 스위치 바로 옆에서 문장으로 밝혀야 합니다(`ONLINE_COACHING_NOTICE`).
 *   주소·모델 이름·API 키 입력칸 셋은 없어졌습니다. 키를 브라우저에 두지 않기로 하면서
 *   그 셋이 서버 환경변수로 옮겨 갔고, 사용자가 고를 것은 켜기/끄기 하나만 남았습니다.
 *
 * 맨 아래에는 「처음 오신 분께」(/guide)로 가는 조용한 텍스트 링크 한 줄이 있습니다.
 *
 * 형태는 v3 문법입니다: 흰 면·무보더·팝오버 그림자(shadow-panel), 라벨 15px, 버튼 48px,
 * 선택은 틸 채움 하나로만 알립니다(체크 아이콘·보더·색 바 없음).
 *
 * @example <SettingsMenu />
 */
export function SettingsMenu({
  className,
  label = "설정",
  align = "trigger",
}: SettingsMenuProps) {
  const [open, setOpen] = useState(false);
  /** 화면 오른쪽에 맞출 때 팝오버가 설 세로 위치 — 여는 순간 한 번 잽니다(열린 뒤 튀지 않게). */
  const [screenTop, setScreenTop] = useState(0);
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

  // 저장된 값은 마운트 뒤에 읽습니다(서버 렌더 결과와 어긋나지 않게).
  useEffect(() => {
    setSettingsState(getSettings());
    setVoiceSupported(isSpeechPlaybackSupported());
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

  /** 닫기 — Esc는 `useModalDismiss`가 맡으므로 여기서는 바깥 클릭만 봅니다. */
  const dismiss = useCallback(() => close(true), [close]);

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event: Event): void => {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) return;
      close(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
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

  /** 스위치는 누르는 즉시 저장합니다 — 「저장」 버튼을 따로 두지 않습니다. */
  const changeOnlineCoaching = (patch: Partial<OnlineCoachingSettings>): void => {
    setSettingsState(setOnlineCoaching(patch));
  };

  return (
    <div ref={rootRef} className={cx("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? panelId : undefined}
        onClick={() => {
          if (open) {
            close(true);
            return;
          }
          const rect = triggerRef.current?.getBoundingClientRect();
          if (rect) setScreenTop(Math.round(rect.bottom + 8));
          setOpen(true);
        }}
        className={cx(
          "inline-flex min-h-[48px] items-center rounded-field px-2 text-[0.8438rem] font-semibold",
          "transition-colors duration-150 active:bg-paper-2",
          open ? "text-brand-800" : "text-ink-muted hover:text-brand-800",
        )}
      >
        {label}
      </button>

      {open && (
        <SettingsPanel
          panelId={panelId}
          settings={settings}
          voiceSupported={voiceSupported}
          align={align}
          screenTop={screenTop}
          onFontScale={chooseFontScale}
          onSpeechRate={chooseSpeechRate}
          onOnlineCoaching={changeOnlineCoaching}
          onDismiss={dismiss}
          /* 링크로 화면을 옮기는 길입니다 — 닫되 초점을 트리거로 되돌리지 않습니다.
             되돌리면 새 화면이 그려진 뒤 초점만 헤더 버튼에 남아 읽는 순서가 뒤집힙니다. */
          onNavigate={() => close(false)}
        />
      )}
    </div>
  );
}

export default SettingsMenu;
