"use client";

import { useState } from "react";
import { Badge, BigButton, Call119Button, Card } from "@/components";
import { cx } from "@/components/utils";
import { ProtocolAddressCard } from "@/app/emergency/_components/ProtocolAddressCard";
import { useProtocolPlayback } from "@/app/emergency/_components/useProtocolPlayback";
import { PROTOCOL_NOTICE } from "@/data/protocols";
import type { EmergencyProtocol } from "@/types";
import { PROTOCOL_HANDOFF_BODY, PROTOCOL_HANDOFF_TITLE } from "./constants";

export interface ProtocolInlineProps {
  protocol: EmergencyProtocol;
  /** 음성 자동 낭독 여부 — 자막은 항상 화면에 남습니다 */
  ttsOn: boolean;
  /** 마지막 단계까지 마친 뒤 세션으로 돌아갑니다 */
  onDone: () => void;
}

/**
 * 훈련 세션 안에서 재생하는 L3 응급 프로토콜.
 *
 * 이 구간에는 생성 호출이 없습니다. 사전 검수된 고정 문구를 순서대로 음성과 자막으로 재생하고,
 * 119 버튼을 상시 노출합니다. 신체 술기 동작은 어떤 단계에서도 안내하지 않습니다.
 *
 * 재생 로직은 단독 화면(`/emergency/[id]`)과 **같은 훅**(`useProtocolPlayback`)을 씁니다.
 * 낭독이 끝나기 전에 넘어가 문장이 잘리는 일이 없도록, 두 화면이 한 규칙으로 진행합니다.
 */
export function ProtocolInline({ protocol, ttsOn, onDone }: ProtocolInlineProps) {
  const [started, setStarted] = useState(false);

  const steps = protocol.steps;
  const playback = useProtocolPlayback({ steps, voiceOn: ttsOn, enabled: started });
  const { index, step, total, silent, isFirst, isLast, playing } = playback;

  if (!started) {
    return (
      <Card tone="danger" className="animate-fade-up text-center">
        <p className="text-sm font-extrabold tracking-wide text-danger-ink uppercase">전환</p>
        <h2 className="mt-2 text-2xl leading-snug font-extrabold text-danger-ink md:text-3xl">
          {PROTOCOL_HANDOFF_TITLE}
        </h2>
        <p className="mt-3 text-lg leading-relaxed font-bold text-ink">{PROTOCOL_HANDOFF_BODY}</p>
        <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-ink-soft">
          지금부터는 대화가 아니라 안내입니다. 사전에 검수된 문구를 순서대로 읽어 드리고, 몸으로
          하는 동작은 안내하지 않습니다. 그 부분은 119 상황실이 목소리로 직접 지도합니다.
        </p>

        <div className="mx-auto mt-5 max-w-md">
          <Call119Button size="lg" />
        </div>

        <div className="mx-auto mt-5 max-w-md">
          <BigButton onClick={() => setStarted(true)} size="lg" block variant="danger">
            응급 안내 시작하기
          </BigButton>
        </div>
      </Card>
    );
  }

  return (
    <Card tone="danger" className="animate-fade-up space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="danger">L3 · 실전 응급</Badge>
          <Badge tone="neutral">{protocol.id} · {protocol.title}</Badge>
        </div>
        <span className="text-sm font-bold text-danger-ink">
          {index + 1} / {total} 단계
        </span>
      </div>

      {/* 응급 구간에서는 119 버튼이 스크롤과 무관하게 상시 노출됩니다 (안전 규칙 §3-5).
          /emergency 의 StickyCallBar와 같은 규칙을 씁니다. */}
      <div className="sticky top-[4.5rem] z-30 -mx-1 space-y-3 rounded-card bg-white/95 p-1 backdrop-blur">
        <p className="rounded-field border border-danger-line bg-white px-3 py-2 text-sm font-bold text-danger-ink">
          {PROTOCOL_NOTICE}
        </p>
        <Call119Button size={step?.emphasize119 ? "xl" : "md"} />
      </div>

      <div
        aria-live="polite"
        className="min-h-[9rem] rounded-card border-2 border-danger-line bg-white p-5 text-center md:p-7"
      >
        {silent ? (
          <p className="text-lg leading-relaxed font-bold text-ink-soft">
            안내를 마쳤습니다. 지금은 말을 걸지 않겠습니다.
          </p>
        ) : (
          <p className="text-2xl leading-snug font-extrabold text-ink md:text-3xl">
            {step?.voice}
          </p>
        )}
        {step?.screen && (
          <p className="mt-3 text-base leading-relaxed text-ink-muted">{step.screen}</p>
        )}
        {step?.address && <ProtocolAddressCard address={step.address} />}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <BigButton onClick={playback.goPrev} variant="secondary" disabled={isFirst}>
          이전 단계
        </BigButton>
        <BigButton
          onClick={playback.togglePlaying}
          variant="secondary"
          className={cx(playing && "border-brand-400")}
        >
          {playing ? "자동 진행 멈추기" : "자동 진행 다시 하기"}
        </BigButton>
        <BigButton onClick={playback.goNext} variant="secondary" disabled={isLast}>
          다음 단계
        </BigButton>
        <BigButton onClick={playback.replay} variant="ghost" disabled={silent || !ttsOn}>
          이 단계 다시 듣기
        </BigButton>
      </div>

      <details className="rounded-card border border-line bg-white p-4">
        <summary className="cursor-pointer text-base font-extrabold text-ink">
          이 앱이 하지 않는 것
        </summary>
        <ul className="mt-3 space-y-3">
          {protocol.notDoing.map((item) => (
            <li key={item.what} className="border-t border-line pt-3 first:border-t-0 first:pt-0">
              <p className="text-base font-bold text-ink">{item.what}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">왜 — {item.why}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-brand-800">
                대신 — {item.instead}
              </p>
            </li>
          ))}
        </ul>
      </details>

      <BigButton onClick={onDone} size="lg" block variant={isLast ? "primary" : "secondary"}>
        {isLast ? "안내를 마치고 인계·보고로 돌아가기" : "지금 인계·보고로 돌아가기"}
      </BigButton>
    </Card>
  );
}

export default ProtocolInline;
