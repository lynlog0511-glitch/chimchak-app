"use client";

import { useState } from "react";
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
import { useProtocolPlayback } from "@/app/emergency/_components/useProtocolPlayback";
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

  const steps = protocol.steps;
  const playback = useProtocolPlayback({ steps, voiceOn: ttsOn, enabled: started });
  const { index, step, total, silent, isFirst, isLast, playing } = playback;
  const preview = nextStepPreview(steps, index);

  if (!started) {
    return (
      <div className={cx("animate-fade-up rounded-card bg-danger-soft p-4", className)}>
        <p className="text-[12px] leading-[1.5] font-bold tracking-[0.06em] text-danger-ink">
          전환
        </p>
        <h2 className="mt-1 text-[19px] leading-[1.35] font-extrabold text-danger-ink">
          {PROTOCOL_HANDOFF_TITLE}
        </h2>
        <p className="mt-2 text-[15px] leading-[1.6] font-bold text-ink">{PROTOCOL_HANDOFF_BODY}</p>
        <p className="mt-2 text-[13px] leading-[1.7] text-ink-soft">
          지금부터는 대화가 아니라 안내입니다. 사전에 검수된 문구를 순서대로 읽어 드리고, 몸으로
          하는 동작은 안내하지 않습니다. 그 부분은 119 상황실이 목소리로 직접 지도합니다.
        </p>

        <div className="mt-4 space-y-2">
          <Call119Bar />
          <BigButton onClick={() => setStarted(true)} size="lg" block variant="danger">
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
      : ttsOn
        ? "reading"
        : "caption";

  return (
    <div className={cx("animate-fade-up", className)}>
      {/* 상단 — 계층 표시 + 「{프로토콜명} · N / M」 + danger 진행바 + 119 버튼.
          응급 구간에서 119 버튼은 스크롤과 무관하게 상시 노출됩니다(안전 규칙 §3-5). */}
      <div className="sticky top-0 z-20 -mx-[18px] bg-paper px-[18px] pt-1 pb-3">
        <div className="flex items-center gap-3">
          <p className="flex-none text-[12px] leading-[1.5] font-bold tracking-[0.06em] text-danger-ink">
            L3 · 실전 응급 · 생성 0건
          </p>
          {/* 제목이 길어도 「N / M」은 잘리지 않습니다 — 잘리는 쪽은 언제나 제목입니다. */}
          <p className="ml-auto flex min-w-0 items-baseline gap-[5px] text-[13px] leading-[1.4] font-bold text-ink-soft">
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

        <p
          aria-live="polite"
          className="mt-3 text-[29px] leading-[1.45] font-extrabold tracking-[-0.015em] text-ink md:text-[40px]"
        >
          {silent ? "안내를 마쳤습니다. 지금은 말을 걸지 않겠습니다." : step?.voice}
        </p>

        {/* 화면 보조 문구 — 데이터의 `screen`은 사용자가 그대로 읽는 문장입니다(레이아웃 지시문 아님). */}
        {step?.screen && (
          <p className="mt-3 text-[15px] leading-[1.65] text-ink-soft">{step.screen}</p>
        )}

        {step?.address && <ProtocolAddressCard address={step.address} className="mt-4" />}

        {preview && (
          <p className="mt-4 text-[13.5px] leading-[1.6] text-tertiary">다음 — {preview}</p>
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
        <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 text-[13px] font-semibold text-ink-soft [&::-webkit-details-marker]:hidden">
          <span>이 앱이 하지 않는 것</span>
          <span
            aria-hidden
            className="text-[12px] text-faint transition-transform duration-150 group-open:rotate-180"
          >
            ⌄
          </span>
        </summary>
        <ul className="chim-hairline pb-2">
          {protocol.notDoing.map((item) => (
            <li key={item.what} className="py-2.5">
              <p className="text-[14px] leading-[1.5] font-bold text-ink">{item.what}</p>
              <p className="mt-1 text-[12.5px] leading-[1.65] text-ink-soft">왜 — {item.why}</p>
              <p className="mt-0.5 text-[12.5px] leading-[1.65] text-brand-800">
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
