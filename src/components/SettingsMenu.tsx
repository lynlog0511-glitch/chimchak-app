"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import {
  AI_DIALOGUE_LABEL,
  AI_DIALOGUE_NOTICE,
  DEFAULT_SETTINGS,
  FONT_SCALE_OPTIONS,
  ONLINE_COACHING_NOTICE,
  ONLINE_MODE_LABEL,
  SPEECH_RATE_OPTIONS,
  SPEECH_RATE_VALUE,
  SWITCH_OPTIONS,
  getSettings,
  setAiDialogue,
  setOnlineCoaching,
  setSetting,
  subscribeSettings,
  type AiDialogueSettings,
  type ChimchakSettings,
  type FontScale,
  type OnlineCoachingSettings,
  type SpeechRate,
} from "@/lib/settings";
import { isSpeechPlaybackSupported, speak, stopSpeaking } from "@/lib/speech";
/* 앱의 오버레이 문법(마운트 초점·Esc·시스템 뒤로·Tab 가두기·배경 스크롤 잠금)은 훅 하나로
   통일돼 있습니다(⚑CF 시트·종료 확인·규칙 시연 시트가 같은 훅을 씁니다 — 평가 UI/UX mi7).
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
 * 「고를 수 없는 보기」는 이 팝오버에 더 이상 없습니다 — 발화 전송 켜기에 붙어 있던
 * 연결값 조건이 서버 프록시로 옮겨 가면서 사라졌습니다.
 */
function OptionButton({ label, selected, onSelect }: OptionButtonProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cx(
        "chim-label min-h-[48px] flex-1 rounded-card px-2",
        "transition-colors duration-150 ease-soft",
        selected
          ? "bg-brand-700 font-bold text-paper active:bg-brand-800"
          : "bg-paper-2 text-ink hover:bg-neutral-line active:bg-neutral-line",
      )}
    >
      {label}
    </button>
  );
}

export interface SettingsMenuProps {
  className?: string;
  /**
   * 팝오버를 어디에 맞출지.
   *
   * - `trigger`(기본): 여는 버튼의 오른쪽 끝에 맞춥니다 — 홈 상단 바처럼 버튼이 화면 오른쪽 끝에 있을 때.
   * - `screen`: **화면(`.chim-screen`) 오른쪽 끝**에 맞춥니다 — 세션 헤더처럼 버튼 오른쪽에
   *   다른 액션이 더 있을 때입니다. 버튼에 맞추면 320px 팝오버가 390px 화면의 왼쪽 밖으로
   *   57px 밀려납니다.
   */
  align?: "trigger" | "screen";
}

/**
 * 여는 버튼을 찾을 표식 — 화면 안 다른 자리에서 이 팝오버를 열 때 씁니다.
 *
 * 표식을 두는 이유는 하나입니다. 안내 문장이 「화면 오른쪽 위 설정에서…」라고 적어 두었으면,
 * 그 문장 옆 버튼도 **그 자리의 그 버튼**을 열어야 합니다 — 카드 안에 두 번째 팝오버를 세우면
 * 다음에 혼자 오셨을 때 찾아갈 자리가 달라집니다.
 *
 * ※ 2026-08-27 실측: **밖에서 읽는 자리가 0건입니다.** 유일한 소비처였던 홈 첫 방문 카드의
 *   「설정 열기」가 그날 3버튼 인라인으로 바뀌면서 사라졌습니다(`FirstVisitHint`).
 *   그래도 이름과 표식을 남깁니다 — §9-9의 「참조 0 = 삭제」는 **규격**(색·아이콘·컴포넌트)에
 *   대한 규칙이고, 이것은 규격이 아니라 이 컴포넌트가 자기 트리거를 여는 **약속된 손잡이**라
 *   지우면 다음 소비처가 각자 방식으로 트리거를 찾습니다(그게 이 표식이 막으려던 것입니다).
 *   다음 라운드 후보가 이미 있습니다 — /guide·/for-orgs 바닥의 설정 진입점(7차 UI/UX P2).
 *   그때도 0건이면 그때 지우는 편이 맞습니다.
 */
export const SETTINGS_TRIGGER_ATTR = "data-chim-settings-trigger";

/** 여는 버튼에 적는 낱말 — **전 화면 한 낱말**입니다. 아래 컴포넌트 주석 참고. */
const TRIGGER_LABEL = "설정";

interface SettingsPanelProps {
  panelId: string;
  settings: ChimchakSettings;
  voiceSupported: boolean;
  align: "trigger" | "screen";
  /** `screen`일 때 팝오버가 설 세로 위치(px) — 여는 순간 버튼 아래를 실측한 값입니다. */
  screenTop: number;
  /**
   * `screen`일 때 **창 오른쪽 끝과 화면 오른쪽 끝 사이**(px) — 여는 순간 실측합니다.
   * 480px↑에서 화면이 430px 기둥으로 설 때 이 값이 지면 폭의 절반이고, 그 아래에서는 0입니다.
   *
   * 기준은 이 패널이 뜬 **뒤**의 좌표계입니다 — 배경 스크롤 잠금이 세로 스크롤바를 없애며
   * 뷰포트가 넓어지므로, 재는 쪽에서 그 폭(gutter)을 함께 얹어 넘깁니다(트리거의 `onClick` 주석).
   */
  screenGap: number;
  onFontScale: (value: FontScale) => void;
  onSpeechRate: (value: SpeechRate) => void;
  onAiDialogue: (patch: Partial<AiDialogueSettings>) => void;
  onOnlineCoaching: (patch: Partial<OnlineCoachingSettings>) => void;
  onDismiss: () => void;
  /** 팝오버 안 링크로 화면을 옮길 때 — 닫기만 하고 초점은 트리거로 되돌리지 않습니다. */
  onNavigate: () => void;
}

/**
 * 팝오버 본체 — **열려 있는 동안에만** 마운트됩니다.
 *
 * 초점 규칙은 앱의 다른 오버레이와 같은 `useModalDismiss` 한 벌입니다:
 * 열리면 「글자 크기」 라벨로 초점이 가고, Esc와 안드로이드 뒤로로 닫히며, Tab이 팝오버 밖으로
 * 빠지지 않고, 닫으면 열었던 버튼으로 초점이 돌아옵니다. 예전에는 이 화면만 예외라 열어도 초점이
 * 트리거에 남고 Tab이 그대로 새어 나갔습니다 — 하필 고령 사용자가 가장 먼저 여는 화면입니다
 * (평가 UI/UX mi7).
 */
function SettingsPanel({
  panelId,
  settings,
  voiceSupported,
  align,
  screenTop,
  screenGap,
  onFontScale,
  onSpeechRate,
  onAiDialogue,
  onOnlineCoaching,
  onDismiss,
  onNavigate,
}: SettingsPanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const fontLabelRef = useRef<HTMLParagraphElement | null>(null);
  const fontLabelId = `${panelId}-font`;
  const speechLabelId = `${panelId}-speech`;
  const dialogueLabelId = `${panelId}-dialogue`;
  const onlineLabelId = `${panelId}-online`;
  const toScreen = align === "screen";
  const dialogue = settings.aiDialogue;
  const online = settings.onlineCoaching;

  useModalDismiss({ panelRef, initialFocusRef: fontLabelRef, onDismiss });

  return (
    <div
      id={panelId}
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      /* 팝오버 제목 — 여는 버튼(「설정」)이 좁힌 이름이 아니라 **담긴 것 전부**를 적습니다.
         이름과 내용이 어긋나면 낭독 사용자에게는 문 뒤에 무엇이 있는지 물어볼 자리가 없습니다. */
      aria-label="표시·음성·AI 설정"
      /* 세션 헤더의 액션 줄은 `whitespace-nowrap`이라, 팝오버 안 문장이 한 줄로 늘어나지 않도록
         여기서 줄바꿈을 되돌립니다.

         오른쪽 여백은 **창이 아니라 화면 기준**입니다. `fixed`는 뷰포트를 보므로 `right-3`만
         두면 480px↑에서 화면이 430px 기둥으로 서 있는 동안 팝오버만 창 오른쪽 끝에 붙습니다 —
         1440px 노트북에서 기둥 오른쪽 가장자리와 팝오버 사이가 170px 넘게 벌어져, 앱 밖 지면
         위에 320px 패널이 홀로 떠 있었습니다(3차 페르소나 UI/UX med · 심사가 벌어지는 폭입니다).
         그래서 실측한 지면 폭(`screenGap`)을 여기에 더합니다. 12px은 `right-3`과 같은 값이되
         `rem`으로 적어, 글자 크기 3단에서 다른 여백과 함께 늘어납니다. */
      style={
        toScreen
          ? { top: `${screenTop}px`, right: `calc(${screenGap}px + 0.75rem)` }
          : undefined
      }
      className={cx(
        "z-50 w-[min(20rem,calc(100vw-2rem))] whitespace-normal",
        toScreen ? "fixed" : "absolute top-full right-0 mt-2",
        "rounded-panel bg-paper p-4 shadow-panel",
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
            지금은 src의 크기 지정이 남김없이 rem이라 루트 100%→112.5%→125%가 화면 전체에
            그대로 비례합니다(백분율이라 브라우저·OS 글꼴 설정 **위에** 곱해집니다 —
            이미 크게 써 오신 분의 설정을 덮어쓰지 않습니다).
            예외는 둘뿐이고 둘 다 읽을거리가 아닙니다 —
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

      {/* ── AI 스위치 둘 ──────────────────────────────────────
          한 칸이던 것을 2026-08-28에 둘로 갈랐습니다. 가르는 잣대는 기능이 아니라
          **하신 말씀이 기기 밖으로 나가는가** 하나입니다 — 그것이 사용자가 실제로 정할 일이고,
          그 하나로 갈라야 두 칸의 무게가 서로 다르다는 사실이 화면에서 읽힙니다.
          한 칸이던 동안에는 발화가 나가지 않는 기능(대사 변주)이 동의 뒤에 서 있어서,
          동의를 켜는 분은 실제보다 넓은 것을 허락한다고 읽고, 끄는 분은 개인정보와 무관한
          기능까지 함께 잃었습니다.

          판정·게이지·기록은 어느 칸에서도 달라지지 않습니다 — 결정론 엔진이 내린 값 그대로입니다
          (/safety의 「AI가 쓰이는 자리」 표와 같은 사실).

          한때 이 자리에는 주소·모델 이름·API 키 입력칸 셋이 있었습니다. 지금은 없습니다 —
          키는 서버 환경변수에만 두고 브라우저는 같은 도메인 `/api/coach`만 부릅니다. */}

      {/* ① AI 어르신 연기 — **기본 켬**. 동의 칸이 아닙니다(나가는 것에 발화가 없습니다). */}
      <div className="mt-5 border-t border-line pt-4">
        <p id={dialogueLabelId} className="chim-label text-ink">
          {AI_DIALOGUE_LABEL}
        </p>
        <div role="group" aria-labelledby={dialogueLabelId} className="mt-2 flex gap-2">
          {SWITCH_OPTIONS.map((option) => (
            <OptionButton
              key={option.label}
              label={option.label}
              selected={dialogue.enabled === option.value}
              onSelect={() => onAiDialogue({ enabled: option.value })}
            />
          ))}
        </div>
        <p className="mt-2 text-[0.9375rem] leading-[1.6] text-ink-soft">
          {AI_DIALOGUE_NOTICE}
        </p>
        <p className="mt-3 text-[0.7813rem] leading-[1.45] text-ink-muted">
          바뀐 대사는 형식·길이·숫자·금지 표현, 그리고 검수 문장에 없던 위험 신호까지 기기 안에서
          확인한 뒤에만 화면에 나가고, 하나라도 지나지 못하면 검수 문장이 그대로 나옵니다. 바뀐
          대사에는 「변주」 표기가 붙습니다. 판정·게이지·기록은 달라지지 않습니다.
        </p>
      </div>

      {/* ② 발화 전송 동의 — **기본 꺼짐**. 켜는 것도 끄는 것도 사용자 손에 있어야 하는 칸이고,
          그 사실을 스위치 바로 옆에서 문장으로 밝힙니다(`ONLINE_COACHING_NOTICE`). */}
      <div className="mt-5 border-t border-line pt-4">
        <p id={onlineLabelId} className="chim-label text-ink">
          {ONLINE_MODE_LABEL}
        </p>
        <div role="group" aria-labelledby={onlineLabelId} className="mt-2 flex gap-2">
          {SWITCH_OPTIONS.map((option) => (
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
        <p className="mt-3 text-[0.7813rem] leading-[1.45] text-ink-muted">
          켜도 판정·게이지·기록은 달라지지 않습니다. 판정이 닿지 않은 말씀에만 코칭 문장이 한 줄
          더해지고, 근거를 확인하지 못한 문장은 화면에 나가지 않습니다. 연결이 준비돼 있지 않으면
          외부 AI로는 아무것도 전달되지 않습니다.
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
 * 자리는 홈 상단 바·훈련 세션 헤더·`ScreenHeader`를 쓰는 모든 화면의 오른쪽 위입니다.
 * 진입점이 홈과 세션 둘뿐이면, 대사가 작다고 느낀 분이 훈련을 나갔다가 홈까지 가서 설정하고
 * 다시 들어와야 합니다 — 노안이 있는 분께는 그 길이 사실상 막힌 길입니다(평가 UI/UX mi5 · m6 · 초보 m2).
 *
 * ## 이름은 전 화면 「설정」 하나입니다
 *
 * 한동안 낱말이 둘이었습니다 — 홈만 「설정」이고 세션 헤더와 `ScreenHeader`의 기본값은
 * 「글자 크기」였습니다(「그 자리에서 이 팝오버를 여는 까닭이 사실상 글자 크기 하나」라는 판단).
 * 그 판단이 틀린 자리가 팝오버 **안**에 있었습니다: 이 팝오버는 글자 크기 말고도 음성 빠르기·
 * AI 스위치 둘·「처음 오신 분께」를 담고 있어서, 세션 안에서 「이거 마이크 꼭 써야 하나」가
 * 궁금해진 분이 그 답이 든 문을 「글자 크기」라는 이름 때문에 지나쳤습니다(3차 페르소나 교육생).
 * 이름이 담긴 것보다 좁으면, 담긴 나머지는 없는 것과 같습니다.
 * 그래서 낱말을 **고를 수 없게** 두었습니다 — `label` prop을 없앴고, 트리거 문구는
 * 이 파일의 `TRIGGER_LABEL` 한 곳에만 있습니다.
 *
 * 담는 것은 넷입니다.
 * - **글자 크기**: 루트 font-size를 100/112.5/125%로 바꿉니다. 토큰이 전부 rem이라 화면이 통째로
 *   비례하고, 백분율이라 브라우저·OS 글꼴 설정 위에 곱해집니다(기본 16px 브라우저에서 16/18/20px).
 * - **음성 빠르기**: `speak()`의 기본 rate가 됩니다. 고르는 즉시 예시 문장을 한 번 읽어 확인시켜 줍니다.
 * - **AI 어르신 연기**: 기본 **켬**. 검수 대사를 같은 뜻으로 다시 말하게 합니다. 나가는 것에
 *   학습자 발화가 없어서 동의 칸이 아니고, 그래서 켜 둔 채로 시작합니다(`AI_DIALOGUE_NOTICE`).
 * - **AI 코칭·자유 연습**: 기본 **꺼짐**. 이 칸이 곧 **발화 전송 동의**입니다 — 하신 말씀이
 *   가림 처리를 지나 서버를 거치는 자리이고, 그런 스위치는 사용자 손에 있어야 하며 그 사실을
 *   스위치 바로 옆에서 문장으로 밝혀야 합니다(`ONLINE_COACHING_NOTICE`).
 *   주소·모델 이름·API 키 입력칸 셋은 없어졌습니다 — 키를 브라우저에 두지 않기로 하면서
 *   서버 환경변수로 옮겨 갔고, 사용자가 고를 것은 켜기/끄기뿐입니다.
 *
 * 맨 아래에는 「처음 오신 분께」(/guide)로 가는 조용한 텍스트 링크 한 줄이 있습니다.
 *
 * 형태는 v3 문법입니다: 흰 면·무보더·팝오버 그림자(shadow-panel), 라벨 15px, 버튼 48px,
 * 선택은 틸 채움 하나로만 알립니다(체크 아이콘·보더·색 바 없음).
 *
 * @example <SettingsMenu />
 */
export function SettingsMenu({ className, align = "trigger" }: SettingsMenuProps) {
  const [open, setOpen] = useState(false);
  /**
   * 화면 오른쪽에 맞출 때 팝오버가 설 자리 — 여는 순간 한 번 잽니다(열린 뒤 튀지 않게).
   * `top`은 버튼 아래, `gap`은 창 오른쪽 끝과 화면(`.chim-screen`) 오른쪽 끝 사이입니다.
   */
  const [screenPos, setScreenPos] = useState({ top: 0, gap: 0 });
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

  /** 닫기 — Esc와 안드로이드 뒤로는 `useModalDismiss`가 맡으므로 여기서는 바깥 클릭만 봅니다. */
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
  const changeAiDialogue = (patch: Partial<AiDialogueSettings>): void => {
    setSettingsState(setAiDialogue(patch));
  };

  const changeOnlineCoaching = (patch: Partial<OnlineCoachingSettings>): void => {
    setSettingsState(setOnlineCoaching(patch));
  };

  return (
    <div ref={rootRef} className={cx("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        {...{ [SETTINGS_TRIGGER_ATTR]: "" }}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? panelId : undefined}
        onClick={() => {
          if (open) {
            close(true);
            return;
          }
          const trigger = triggerRef.current;
          const rect = trigger?.getBoundingClientRect();
          if (rect) {
            /* 지면 폭은 **계산이 아니라 관측**입니다(탭바가 자기 높이를 재는 것과 같은 판단).
               `(100vw - 430px) / 2`로 되짚으면 430~479px 구간에서만 틀립니다 — 그 구간의
               화면은 아직 전폭이라 지면이 0인데, 식은 최대 24.5px을 답합니다. */
            const screen = trigger?.closest(".chim-screen");
            /* 폭은 `documentElement.clientWidth`로 잽니다 — `innerWidth`는 세로 스크롤바까지
               세는데 `fixed`와 `getBoundingClientRect`는 둘 다 스크롤바를 뺀 좌표계라,
               섞어 쓰면 데스크톱에서만 스크롤바 폭(약 15px)만큼 왼쪽으로 밀립니다. */
            const viewport = document.documentElement.clientWidth || window.innerWidth;
            /* 재는 시점이 **잠그기 전**이라 한 겹을 더 얹습니다.
               패널이 마운트되면 `useModalDismiss`가 배경 스크롤을 잠그면서
               `html{overflow:hidden}`으로 세로 스크롤바를 없애고, 그만큼 넓어진 폭은
               `body`의 `padding-right`로 메웁니다(useModalDismiss.ts:70-79) — 그래서 화면
               기둥은 제자리에 있는데 **뷰포트만** gutter만큼 넓어집니다. 팝오버는 `fixed`라
               넓어진 뷰포트의 오른쪽 끝을 기준으로 서므로, 잠그기 전 값을 그대로 쓰면 기둥
               경계를 그 폭만큼 넘어 걸칩니다(5차 페르소나 UI/UX low).
               잠긴 **뒤에** 다시 재는 길도 있지만, 그 값은 첫 페인트 다음에야 나오므로 패널이
               한 프레임 어긋난 자리에 떴다가 튑니다. gutter는 잠그는 쪽이 쓰는 식과 같은
               식으로 지금 알 수 있으니, 여기서 잠금 이후의 좌표계로 환산해 둡니다.
               macOS·iOS의 오버레이 스크롤바에서는 이 값이 0이라 아무 일도 하지 않습니다. */
            const gutter = Math.max(0, Math.round(window.innerWidth - viewport));
            const gap = screen
              ? Math.max(0, Math.round(viewport - screen.getBoundingClientRect().right)) + gutter
              : 0;
            setScreenPos({ top: Math.round(rect.bottom + 8), gap });
          }
          setOpen(true);
        }}
        className={cx(
          "inline-flex min-h-[48px] items-center rounded-field px-2 text-[0.8438rem] font-semibold",
          "transition-colors duration-150 active:bg-paper-2",
          open ? "text-brand-800" : "text-ink-muted hover:text-brand-800",
        )}
      >
        {TRIGGER_LABEL}
      </button>

      {open && (
        <SettingsPanel
          panelId={panelId}
          settings={settings}
          voiceSupported={voiceSupported}
          align={align}
          screenTop={screenPos.top}
          screenGap={screenPos.gap}
          onFontScale={chooseFontScale}
          onSpeechRate={chooseSpeechRate}
          onAiDialogue={changeAiDialogue}
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
