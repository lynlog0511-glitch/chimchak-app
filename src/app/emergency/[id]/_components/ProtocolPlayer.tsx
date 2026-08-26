"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ProtocolStep } from "@/types";
import { BackGlyph, EyebrowLabel, cx } from "@/components";
import { isSpeechPlaybackSupported, primeVoices, stopSpeaking } from "@/lib/speech";
import { Call119Bar } from "../../_components/Call119Bar";
import {
  CONTROL_OUTLINE,
  CONTROL_PRIMARY,
  CONTROL_QUIET,
  ProtocolFootnote,
  ProtocolReadingLine,
  ProtocolSegments,
  nextStepPreview,
  type ReadingState,
} from "../../_components/PlayerParts";
import { ProtocolAddressCard } from "../../_components/ProtocolAddressCard";
import { useAutoplayGuard, useProtocolPlayback } from "../../_components/useProtocolPlayback";

export interface ProtocolPlayerProps {
  title: string;
  steps: ProtocolStep[];
  /** 「‹ 안내 종료」가 돌아갈 곳 */
  backHref: string;
}

/**
 * 응급 프로토콜 단계별 재생기 (시안 6d · 가이드 §4.8).
 *
 * - 검수된 고정 문구를 **음성 + 대형 자막**으로 순서대로 재생합니다(자막 없는 음성은 만들지 않습니다).
 * - 한 단계를 다 읽으면 자동으로 다음 단계로 넘어갑니다. 잠시 멈춤·이전·다음은 언제든 수동 조작할 수 있습니다.
 * - 음성 합성을 쓸 수 없는 기기에서도 자막이 같은 속도로 자동 진행되어 안내가 끊기지 않습니다.
 * - 마지막 침묵 단계에서는 소리를 내지 않고 화면만 유지합니다.
 *
 * 화면의 주인은 자막입니다 — 그래서 제목을 13px 한 줄로 낮추고, 상단에는 **119 버튼·진행바만** 남깁니다.
 * 119 버튼은 스크롤과 무관하게 자리를 지킵니다(안전 규칙 §3-5 상시 노출).
 *
 * 이 화면에서는 생성 호출이 한 건도 일어나지 않습니다. 데이터에 적힌 문구를 그대로 읽을 뿐입니다.
 * 진행 규칙은 훈련 세션 안의 L3 구간과 **같은 훅**(`useProtocolPlayback`)에서 옵니다.
 */
export function ProtocolPlayer({ title, steps, backHref }: ProtocolPlayerProps) {
  const [voiceOn, setVoiceOn] = useState(true);
  const [ttsSupported, setTtsSupported] = useState(true);
  /** 자동재생 정책은 훈련 세션 안 L3 구간과 **같은 가드**에서 옵니다. */
  const { soundBlocked, unblock } = useAutoplayGuard();

  /* 차단된 동안에는 낭독을 시도하지 않습니다 — 소리를 내지 못하는 낭독을 기다리다
     자막 진행까지 멈추면 안내 자체가 죽습니다. 자막은 같은 속도로 계속 넘어갑니다. */
  const voiceActive = voiceOn && !soundBlocked;
  const playback = useProtocolPlayback({ steps, voiceOn: voiceActive });
  const {
    index,
    step,
    total,
    silent,
    playing,
    resumedFromHidden,
    goTo,
    togglePlaying,
    replay,
    restart,
  } = playback;
  const voiceText = step ? step.voice.trim() : "";
  const preview = nextStepPreview(steps, index);

  useEffect(() => {
    primeVoices();
    setTtsSupported(isSpeechPlaybackSupported());
  }, []);

  /* 상태줄은 지금 실제로 일어나는 일만 말합니다 — 소리가 없는데 「읽어 주는 중」이라고 하지 않습니다. */
  const readingState: ReadingState = silent
    ? "done"
    : !playing
      ? "paused"
      : voiceActive && ttsSupported
        ? "reading"
        : "caption";

  /** 소리를 켤 수 있는데 자동으로 시작하지 못한 상태 — 한 번 누르면 그 자리에서 소리가 납니다. */
  const needsTapToStart = soundBlocked && ttsSupported && voiceOn && !silent;

  return (
    <div>
      {/* 상단 — 「‹ 안내 종료」 + 「{프로토콜명} · N / M」 + danger 진행바 + 119 버튼.
          스크롤해도 이 덩어리는 화면에 남습니다.

          도킹 기준선은 0이 아니라 **안전 영역 아래**입니다(2026-08-26). `viewportFit: "cover"`
          (layout.tsx)로 레이아웃 뷰포트가 노치 밑까지 확장되는데, sticky의 `top`은 스크롤포트
          상단을 기준으로 하므로 조상(`.chim-screen`)의 `padding-top: var(--chim-safe-t)`이
          이 기준선을 옮겨 주지 못합니다. `top-0`이던 동안에는 스크롤하는 순간 「{프로토콜명} ·
          N / M」과 119 버튼이 상태바·다이내믹 아일랜드 아래로 들어갔습니다 — 아이폰 시연에서
          가장 먼저 눈에 띄는 자리입니다(페르소나 FE, 1차·2차 연속 지적).
          예전 해법이던 `.chim-topbar` 유틸리티는 「참조 0건」으로 지워졌으므로 변수를 직접 씁니다. */}
      <div className="sticky top-[var(--chim-safe-t)] z-30 -mx-[20px] bg-paper px-[20px] pt-[2px] pb-3">
        {/* 노치 띠 — 바 위로 지나가는 내용을 화면 색으로 덮습니다. 높이가 `--chim-safe-t`라
            노치 없는 기기·데스크톱에서는 0px이고, 프레임 폭으로 잘라 두어 480px↑에서
            지면(paper-out) 위로 흰 띠가 번지지 않습니다. */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 top-0 mx-auto h-[var(--chim-safe-t)] max-w-[var(--chim-frame-w)] bg-paper"
        />
        <div className="flex items-center gap-3">
          <Link
            href={backHref}
            className="-ml-2 flex min-h-[48px] items-center gap-[4px] px-2 text-[0.8438rem] font-semibold text-ink-muted transition-colors duration-150 active:text-ink"
          >
            <BackGlyph />
            안내 종료
          </Link>
          {/* 제목이 길어도 「N / M」은 잘리지 않습니다 — 잘리는 쪽은 언제나 제목입니다. */}
          <p className="ml-auto flex min-w-0 items-baseline gap-[4px] text-[0.8438rem] leading-[1.45] font-bold text-ink-soft">
            <span className="min-w-0 truncate">{title}</span>
            <span className="chim-num flex-none">
              · {index + 1} / {total}
            </span>
          </p>
        </div>

        <ProtocolSegments steps={steps} index={index} />

        {/* 119 버튼은 단계와 무관하게 같은 크기(58px)로 늘 같은 자리에 있습니다.
            데이터의 `emphasize119`가 가리키는 1단계에서는 자막 자체가 「지금 119를 누르세요」라
            버튼을 키워 상단 높이를 흔들 이유가 없습니다 — 강조는 29px 자막이 이미 하고 있습니다. */}
        <Call119Bar className="mt-3" />
      </div>

      {/* 본문 — 이 화면 전체에서 가장 큰 글자는 자막 하나뿐입니다. */}
      <div className="pt-4 pb-6">
        {/* 화면이 가려졌다가 돌아온 자리 — 이 화면의 1단계는 사용자를 전화 앱으로 내보냅니다.
            돌아왔을 때 앱이 스스로 이어 가면, 통화하는 동안 몇 단계가 지나갔는지 아무도
            보장하지 못한 채 화면만 앞서 갑니다. 그래서 **자동으로 재개하지 않고** 지금 어디에
            멈춰 있는지 적은 뒤 두 버튼을 세웁니다(페르소나 UI/UX high). */}
        {resumedFromHidden && (
          <div
            role="status"
            className="mb-3 rounded-card bg-warn-soft px-4 py-[14px]"
          >
            <p className="text-[1.0625rem] leading-[1.45] font-bold text-warn-ink">
              119 통화 중이셨나요?
            </p>
            <p className="mt-[4px] text-[0.9375rem] leading-[1.6] text-ink">
              <span className="chim-num">{index + 1}</span>단계에서 멈춰 있습니다. 아래에서 고르시면
              그 자리부터 이어 갑니다.
            </p>
            <div className="mt-[10px] flex gap-2">
              <button
                type="button"
                onClick={replay}
                disabled={silent || !ttsSupported || !voiceOn}
                className={CONTROL_OUTLINE}
              >
                이 단계 다시 듣기
              </button>
              <button type="button" onClick={togglePlaying} className={CONTROL_PRIMARY}>
                이어서
              </button>
            </div>
          </div>
        )}

        <ProtocolReadingLine state={readingState} />

        {/* 바로가기로 곧바로 열면 제스처가 없어 소리가 막힙니다. 그 사실을 적고, 한 번 누를 자리를 둡니다.
            누르는 순간 낭독이 다시 켜지므로(voiceActive) 이 자리에서 소리가 시작됩니다. */}
        {needsTapToStart && (
          <div className="mt-2">
            <button
              type="button"
              onClick={unblock}
              className="flex min-h-[52px] w-full items-center justify-center rounded-card border border-line-strong bg-paper px-3 text-[0.9375rem] font-bold text-ink transition-colors duration-150 active:bg-paper-2"
            >
              눌러서 소리 시작
            </button>
            <p className="mt-[6px] text-[0.8438rem] leading-[1.6] text-ink-soft">
              이 기기가 소리를 자동으로 시작하지 못했습니다. 누르지 않으셔도 자막은 같은 속도로
              계속 넘어갑니다.
            </p>
          </div>
        )}

        <p
          aria-live="polite"
          className="mt-3 text-[1.8125rem] leading-[1.45] font-extrabold tracking-[-0.015em] text-ink"
        >
          {silent ? "안내 음성을 여기서 멈춥니다." : voiceText}
        </p>

        {/* 화면 보조 문구 — 데이터의 `screen`은 사용자가 그대로 읽는 문장입니다(레이아웃 지시문 아님). */}
        {step?.screen && (
          <p className="mt-3 text-[0.9375rem] leading-[1.6] text-ink-soft">{step.screen}</p>
        )}

        {/* 주소 단계인지는 데이터의 `step.address`가 가르고, 화면에 서는 값은 이 기기에 적어
            두신 주소입니다 — 연습용 예시 주소는 카드가 쓰지 않으므로 넘기지 않습니다.
            재생 화면에서는 **보여 주기만** 합니다(2026-08-26). 저장 칸은 `/emergency` 목록의
            `ProtocolAddressPanel` 한 곳에 있습니다 — 어르신 앞에서 화면이 도로명 주소를 타자로
            치라고 하면 그 손이 어르신에게서 떨어집니다(페르소나 현직 P0, 3차). */}
        {step?.address && <ProtocolAddressCard className="mt-4" />}

        {preview && (
          <p className="mt-4 text-[0.8438rem] leading-[1.6] text-ink-faint">다음 — {preview}</p>
        )}
      </div>

      {/* 컨트롤 — 아웃라인 둘 + 틸 채움 하나. 지금 누를 것 하나만 채움입니다. */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
          className={CONTROL_OUTLINE}
        >
          이전
        </button>
        <button type="button" onClick={togglePlaying} className={CONTROL_OUTLINE}>
          {playing ? "잠시 멈춤" : "이어서 듣기"}
        </button>
        <button
          type="button"
          onClick={() => goTo(index + 1)}
          disabled={index === total - 1}
          className={CONTROL_PRIMARY}
        >
          다음 단계
        </button>
      </div>

      <ProtocolFootnote className="mt-3" />

      {/* 아래는 재생을 방해하지 않는 보조 영역입니다 — 위계를 낮춰 선 하나로만 나눕니다. */}
      {!ttsSupported && (
        <p className="mt-5 rounded-card bg-warn-soft px-4 py-3 text-[0.8438rem] leading-[1.6] font-semibold text-warn-ink">
          이 기기에서는 음성 안내를 사용할 수 없습니다. 자막이 같은 속도로 자동 진행되니 화면을 보고
          따라 주세요.
        </p>
      )}

      <div className="mt-5 flex gap-1 border-t border-line pt-2">
        <button
          type="button"
          onClick={replay}
          disabled={silent || !ttsSupported || !voiceOn}
          className={CONTROL_QUIET}
        >
          이 단계 다시 듣기
        </button>
        <button
          type="button"
          onClick={() => {
            stopSpeaking();
            setVoiceOn((prev) => !prev);
          }}
          disabled={!ttsSupported}
          className={CONTROL_QUIET}
        >
          {voiceOn ? "음성 끄기(자막만)" : "음성 켜기"}
        </button>
        <button type="button" onClick={restart} className={CONTROL_QUIET}>
          처음부터 다시
        </button>
      </div>

      {/* 전체 단계 — 위계가 낮은 목록이라 카드 없이 선으로만 나눕니다. */}
      <section aria-labelledby="steps-heading" className="mt-8">
        <EyebrowLabel id="steps-heading">전체 단계 · {title}</EyebrowLabel>
        <div className="chim-rows mt-1">
          {steps.map((s, i) => {
            const current = i === index;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => goTo(i)}
                aria-current={current ? "step" : undefined}
                className="flex min-h-[48px] w-full items-center gap-3 border-b border-line px-[2px] py-3 text-left transition-colors duration-150 active:bg-paper-2"
              >
                <span
                  aria-hidden
                  className={cx(
                    "chim-num flex h-7 w-7 flex-none items-center justify-center rounded-[9px] text-[0.7813rem] font-extrabold",
                    /* 빨강은 119 버튼 하나로 족합니다 — 지금 단계 표시는 danger **면**으로만(5b 마커와 같은 언어). */
                    current ? "bg-danger-soft text-danger-ink" : "bg-paper-2 text-ink-muted",
                  )}
                >
                  {i + 1}
                </span>
                <span
                  className={cx(
                    "min-w-0 flex-1 text-[0.9375rem] leading-[1.6]",
                    current ? "font-bold text-ink" : "text-ink-soft",
                  )}
                >
                  {s.voice.trim().length > 0 ? s.voice : "(음성 없이 화면만 남는 단계입니다)"}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default ProtocolPlayer;
