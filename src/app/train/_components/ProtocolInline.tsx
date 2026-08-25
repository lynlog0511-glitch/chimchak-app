"use client";

import { useEffect, useState } from "react";
import { ChevronGlyph } from "@/components/icons";
import { BigButton } from "@/components";
import { cx } from "@/components/utils";
import { Call119Bar } from "@/app/emergency/_components/Call119Bar";
import {
  CONTROL_OUTLINE,
  CONTROL_PRIMARY,
  ProtocolFootnote,
  ProtocolReadingLine,
  ProtocolSegments,
  nextStepPreview,
  type ReadingState,
} from "@/app/emergency/_components/PlayerParts";
import { ProtocolAddressCard } from "@/app/emergency/_components/ProtocolAddressCard";
import {
  useAutoplayGuard,
  useProtocolPlayback,
} from "@/app/emergency/_components/useProtocolPlayback";
import { isSpeechPlaybackSupported, unlockAudio } from "@/lib/speech";
import type { EmergencyProtocol } from "@/types";
import { PROTOCOL_HANDOFF_BODY, PROTOCOL_HANDOFF_TITLE } from "./constants";

export interface ProtocolInlineProps {
  protocol: EmergencyProtocol;
  /** 음성 자동 낭독 여부 — 자막은 항상 화면에 남습니다 */
  ttsOn: boolean;
  /** 마지막 단계까지 마친 뒤 세션으로 돌아갑니다 */
  onDone: () => void;
  className?: string;
}

/**
 * 훈련 세션 안에서 재생하는 L3 응급 프로토콜.
 *
 * 이 구간에는 생성 호출이 없습니다. 사전 검수된 고정 문구를 순서대로 음성과 자막으로 재생하고,
 * 119 버튼을 상시 노출합니다. 신체 술기 동작은 어떤 단계에서도 안내하지 않습니다.
 *
 * 얼굴과 재생 규칙 모두 단독 화면(`/emergency/[id]`)과 같습니다 —
 * 표시는 `PlayerParts`(시안 6d), 진행은 `useProtocolPlayback`을 함께 씁니다.
 * 두 화면이 같은 P-02를 서로 다르게 보여 주면 "같은 안내"라는 사실이 흐려지기 때문입니다.
 */
export function ProtocolInline({ protocol, ttsOn, onDone, className }: ProtocolInlineProps) {
  const [started, setStarted] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(true);
  /** 자동재생 정책은 단독 화면(`/emergency/[id]`)과 **같은 가드**에서 옵니다. */
  const { soundBlocked, unblock } = useAutoplayGuard();

  useEffect(() => {
    setTtsSupported(isSpeechPlaybackSupported());
  }, []);

  const steps = protocol.steps;
  /* 차단된 동안에는 낭독을 시도하지 않습니다 — 소리를 내지 못하는 낭독을 기다리다
     자막 진행까지 멈추면 안내 자체가 죽습니다. 자막은 같은 속도로 계속 넘어갑니다. */
  const voiceActive = ttsOn && !soundBlocked;
  const playback = useProtocolPlayback({ steps, voiceOn: voiceActive, enabled: started });
  const { index, step, total, silent, isFirst, isLast, playing } = playback;
  const preview = nextStepPreview(steps, index);

  if (!started) {
    return (
      <div className={cx("animate-fade-up rounded-card bg-danger-soft p-4", className)}>
        <p className="text-[0.7813rem] leading-[1.45] font-bold tracking-[0.06em] text-danger-ink">
          전환
        </p>
        <h2 className="mt-1 text-[1.1875rem] leading-[1.3] font-extrabold text-danger-ink">
          {PROTOCOL_HANDOFF_TITLE}
        </h2>
        <p className="mt-2 text-[0.9375rem] leading-[1.6] font-bold text-ink">{PROTOCOL_HANDOFF_BODY}</p>
        <p className="mt-2 text-[0.8438rem] leading-[1.6] text-ink-soft">
          지금부터는 대화가 아니라 안내입니다. 사전에 검수된 문구를 순서대로 읽어 드리고, 몸으로
          하는 동작은 안내하지 않습니다. 그 부분은 119 상황실이 목소리로 직접 지도합니다.
        </p>

        <div className="mt-4 space-y-2">
          <Call119Bar />
          {/* 이 탭이 이 구간의 **확실한 첫 제스처**입니다 — 그 자리에서 오디오 요소 잠금을 풀어 두면
              아이폰에서도 이후 단계의 자동 낭독이 검수된 목소리 그대로 이어집니다. */}
          <BigButton
            onClick={() => {
              unlockAudio();
              setStarted(true);
            }}
            size="lg"
            block
            variant="danger"
          >
            응급 안내 시작하기
          </BigButton>
        </div>
      </div>
    );
  }

  /* 상태줄은 지금 실제로 일어나는 일만 말합니다 — 소리가 없는데 「읽어 주는 중」이라고 하지 않습니다. */
  const readingState: ReadingState = silent
    ? "done"
    : !playing
      ? "paused"
      : voiceActive && ttsSupported
        ? "reading"
        : "caption";

  /** 소리를 켤 수 있는데 자동으로 시작하지 못한 상태 — 한 번 누르면 그 자리에서 소리가 납니다. */
  const needsTapToStart = soundBlocked && ttsSupported && ttsOn && !silent;

  return (
    <div className={cx("animate-fade-up", className)}>
      {/* 상단 — 계층 표시 + 「{프로토콜명} · N / M」 + danger 진행바 + 119 버튼.
          응급 구간에서 119 버튼은 스크롤과 무관하게 상시 노출됩니다(안전 규칙 §3-5). */}
      {/* 세션 헤더(sticky z-30)가 위에 있으므로 그 실측 높이만큼 내려앉습니다 — 이중 스택. */}
      <div
        className="sticky z-20 -mx-[18px] bg-paper px-[18px] pt-1 pb-3"
        style={{ top: "var(--session-head-h, 0px)" }}
      >
        <div className="flex items-center gap-3">
          <p className="flex-none text-[0.7813rem] leading-[1.45] font-bold tracking-[0.06em] text-danger-ink">
            실전 응급 · 생성 0건
          </p>
          {/* 제목이 길어도 「N / M」은 잘리지 않습니다 — 잘리는 쪽은 언제나 제목입니다. */}
          <p className="ml-auto flex min-w-0 items-baseline gap-[4px] text-[0.8438rem] leading-[1.45] font-bold text-ink-soft">
            <span className="min-w-0 truncate">{protocol.title}</span>
            <span className="chim-num flex-none">
              · {index + 1} / {total}
            </span>
          </p>
        </div>

        <ProtocolSegments steps={steps} index={index} className="mt-2" />

        {/* 119 버튼은 단계와 무관하게 같은 크기(58px)로 늘 같은 자리에 있습니다 — 단독 화면과 같은 규칙입니다. */}
        <Call119Bar className="mt-3" />
      </div>

      {/* 본문 — 이 구간에서 가장 큰 글자는 자막 하나뿐입니다. */}
      <div className="pt-4 pb-6">
        <ProtocolReadingLine state={readingState} />

        {/* 소리가 막힌 채로 「읽어 주는 중」이라고 적지 않습니다. 한 번 누를 자리를 두되,
            누르지 않으셔도 자막은 같은 속도로 계속 넘어갑니다(안내가 볼모가 되지 않습니다). */}
        {needsTapToStart && (
          <div className="mt-2">
            <button
              type="button"
              onClick={unblock}
              className="flex min-h-[52px] w-full items-center justify-center rounded-[14px] border border-line-strong bg-paper px-3 text-[0.9375rem] font-bold text-ink transition-colors duration-150 active:bg-paper-2"
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
          {silent ? "안내를 마쳤습니다. 지금은 말을 걸지 않겠습니다." : step?.voice}
        </p>

        {/* 화면 보조 문구 — 데이터의 `screen`은 사용자가 그대로 읽는 문장입니다(레이아웃 지시문 아님). */}
        {step?.screen && (
          <p className="mt-3 text-[0.9375rem] leading-[1.6] text-ink-soft">{step.screen}</p>
        )}

        {step?.address && <ProtocolAddressCard address={step.address} className="mt-4" />}

        {preview && (
          <p className="mt-4 text-[0.8438rem] leading-[1.6] text-tertiary">다음 — {preview}</p>
        )}
      </div>

      {/* 컨트롤 — 아웃라인 둘 + 틸 채움 하나. 지금 누를 것 하나만 채움입니다. */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={playback.goPrev}
          disabled={isFirst}
          className={CONTROL_OUTLINE}
        >
          이전
        </button>
        <button type="button" onClick={playback.togglePlaying} className={CONTROL_OUTLINE}>
          {playing ? "잠시 멈춤" : "이어서 듣기"}
        </button>
        <button
          type="button"
          onClick={playback.goNext}
          disabled={isLast}
          className={CONTROL_PRIMARY}
        >
          다음 단계
        </button>
      </div>

      <ProtocolFootnote className="mt-3" />

      <details className="group mt-5 border-t border-line">
        <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 rounded-field text-[0.8438rem] font-semibold text-ink-soft transition-colors duration-150 active:bg-paper-2 [&::-webkit-details-marker]:hidden">
          <span>이 앱이 하지 않는 것</span>
          <ChevronGlyph size="sm" className="text-faint group-open:rotate-180" />
        </summary>
        <ul className="chim-hairline pb-2">
          {protocol.notDoing.map((item) => (
            <li key={item.what} className="py-2.5">
              <p className="text-[0.8438rem] leading-[1.45] font-bold text-ink">{item.what}</p>
              <p className="mt-1 text-[0.7813rem] leading-[1.6] text-ink-soft">왜 — {item.why}</p>
              <p className="mt-0.5 text-[0.7813rem] leading-[1.6] text-brand-800">
                대신 — {item.instead}
              </p>
            </li>
          ))}
        </ul>
      </details>

      <BigButton
        onClick={onDone}
        size="lg"
        block
        variant={isLast ? "primary" : "secondary"}
        className="mt-4"
      >
        {isLast ? "안내를 마치고 인계·보고로 돌아가기" : "지금 인계·보고로 돌아가기"}
      </BigButton>
    </div>
  );
}

export default ProtocolInline;
