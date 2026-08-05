"use client";

import { useEffect, useState } from "react";
import type { ProtocolStep } from "@/types";
import { Badge, BigButton, Call119Button, Card } from "@/components";
import { IconNext, IconPause, IconPlay, IconPrev } from "@/components/icons";
import { isSpeechSynthesisSupported, primeVoices, stopSpeaking } from "@/lib/speech";
import { ProtocolAddressCard } from "../../_components/ProtocolAddressCard";
import { useProtocolPlayback } from "../../_components/useProtocolPlayback";

export interface ProtocolPlayerProps {
  protocolId: string;
  title: string;
  steps: ProtocolStep[];
}

/**
 * 응급 프로토콜 단계별 재생기.
 *
 * - 검수된 고정 문구를 **음성 + 대형 자막**으로 순서대로 재생합니다(자막 없는 음성은 만들지 않습니다).
 * - 한 단계를 다 읽으면 자동으로 다음 단계로 넘어갑니다. 일시정지·이전·다음은 언제든 수동 조작할 수 있습니다.
 * - 음성 합성을 쓸 수 없는 기기에서도 자막이 같은 속도로 자동 진행되어 안내가 끊기지 않습니다.
 * - 마지막 침묵 단계에서는 소리를 내지 않고 화면만 유지합니다.
 *
 * 이 화면에서는 생성 호출이 한 건도 일어나지 않습니다. 데이터에 적힌 문구를 그대로 읽을 뿐입니다.
 *
 * 진행 규칙은 훈련 세션 안의 L3 구간과 **같은 훅**(`useProtocolPlayback`)에서 옵니다.
 */
export function ProtocolPlayer({ protocolId, title, steps }: ProtocolPlayerProps) {
  const [voiceOn, setVoiceOn] = useState(true);
  const [ttsSupported, setTtsSupported] = useState(true);

  const playback = useProtocolPlayback({ steps, voiceOn });
  const { index, step, total, silent, playing, goTo, togglePlaying, replay, restart } = playback;
  const voiceText = step ? step.voice.trim() : "";

  useEffect(() => {
    primeVoices();
    setTtsSupported(isSpeechSynthesisSupported());
  }, []);

  const progress = total > 0 ? Math.round(((index + 1) / total) * 100) : 0;
  const emphasize = Boolean(step?.emphasize119);

  return (
    <div className="space-y-6">
      {/* 진행바 — 이 화면의 주인공은 자막이므로 진행 표시는 조용한 크롬 크기로 둡니다(§3). */}
      <div>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="chim-label chim-num text-ink">
            전체 {total}단계 중 <span className="text-brand-800">{index + 1}단계</span>
          </p>
          <p className="chim-caption text-ink-muted">
            {playing ? "자동으로 다음 단계로 넘어갑니다" : "일시정지 상태입니다"}
          </p>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-chip bg-line"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={index + 1}
          aria-valuetext={`전체 ${total}단계 중 ${index + 1}단계`}
        >
          <span
            aria-hidden="true"
            className="block h-full rounded-chip bg-brand-600 transition-[width] duration-500 ease-soft"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 1단계 119 확대 연출 — 색 마커·깜빡임 없이 문장 크기와 버튼 크기로만 말합니다(§1-2). */}
      {emphasize && (
        <Card tone="danger">
          <p className="chim-cue text-center text-danger-ink">먼저 119부터 누르세요</p>
          <div className="mt-4">
            <Call119Button size="xl" />
          </div>
        </Card>
      )}

      {/* 대형 자막 — 이 화면 전체에서 가장 큰 글자입니다(코어 중의 코어, §3). */}
      <Card tone={silent ? "quiet" : "default"}>
        {/* 필은 단계 번호 하나만 — 진행 수치와 침묵 표시는 가운뎃점으로 이어 붙인 작은 텍스트입니다. */}
        <div className="chim-caption flex flex-wrap items-center gap-x-2 gap-y-1 font-bold text-ink-muted">
          <Badge tone="neutral">{step ? step.id : protocolId}</Badge>
          <span className="chim-num">
            {index + 1} / {total}
          </span>
          {silent && (
            <>
              <span aria-hidden="true">·</span>
              <span>의도된 침묵</span>
            </>
          )}
        </div>

        <p aria-live="polite" className="chim-subtitle mt-4 text-ink">
          {silent ? "안내 음성을 여기서 멈춥니다." : voiceText}
        </p>

        {silent && (
          <p className="chim-core mt-3 text-ink-soft">
            지금부터는 119 상황실 지시에 따르세요. 화면은 이대로 두셔도 됩니다.
          </p>
        )}

        {step?.screen && (
          <p className="chim-core-sm mt-5 border-t border-line pt-4 text-ink-soft">
            {step.screen}
          </p>
        )}

        {step?.address && <ProtocolAddressCard address={step.address} />}
      </Card>

      {/* 조작 */}
      <div>
        {/* 좁은 화면에서는 재생 버튼을 한 줄 전체로 두어 글자가 접히지 않게 합니다. */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
          <BigButton
            onClick={togglePlaying}
            variant="primary"
            size="lg"
            block
            className="order-1 col-span-2 whitespace-nowrap sm:order-2 sm:col-span-1"
          >
            {playing ? (
              <>
                <IconPause className="h-5 w-5" /> 일시정지
              </>
            ) : (
              <>
                <IconPlay className="h-5 w-5" /> 재생
              </>
            )}
          </BigButton>
          {/* 보조 조작은 한 단계 작은 크기(17px·48px 터치)로 두어 재생 버튼이 주인공이 되게 합니다. */}
          <BigButton
            onClick={() => goTo(index - 1)}
            variant="secondary"
            size="md"
            disabled={index === 0}
            block
            className="order-2 whitespace-nowrap sm:order-1"
          >
            <IconPrev className="h-5 w-5" /> 이전
          </BigButton>
          <BigButton
            onClick={() => goTo(index + 1)}
            variant="secondary"
            size="md"
            disabled={index === total - 1}
            block
            className="order-3 whitespace-nowrap"
          >
            다음 <IconNext className="h-5 w-5" />
          </BigButton>
        </div>

        <div className="mt-3 flex flex-wrap gap-1">
          <BigButton onClick={replay} variant="ghost" disabled={silent || !ttsSupported || !voiceOn}>
            이 단계 다시 듣기
          </BigButton>
          <BigButton
            onClick={() => {
              stopSpeaking();
              setVoiceOn((prev) => !prev);
            }}
            variant="ghost"
            disabled={!ttsSupported}
          >
            {voiceOn ? "음성 끄기(자막만)" : "음성 켜기"}
          </BigButton>
          <BigButton onClick={restart} variant="ghost">
            처음부터 다시
          </BigButton>
        </div>

        {!ttsSupported && (
          <p className="chim-body mt-3 rounded-card bg-warn-soft px-4 py-3 font-semibold text-warn-ink">
            이 기기에서는 음성 안내를 사용할 수 없습니다. 자막이 같은 속도로 자동 진행되니 화면을
            보고 따라 주세요.
          </p>
        )}
      </div>

      {/* 전체 단계 목록 — 위계가 낮은 목록이라 카드 대신 흰 면 한 장 + hairline으로 나눕니다(§7). */}
      <section aria-labelledby="steps-heading">
        <h2 id="steps-heading" className="chim-h3 mb-3 text-ink">
          전체 단계 — {title}
        </h2>
        {/* 배경은 li가 지고 버튼은 그 위를 채웁니다 — 컨테이너에 overflow-hidden을 걸지 않아
            키보드 포커스 링(3px·offset 2px)이 잘리지 않습니다. */}
        <ol className="chim-hairline rounded-card bg-white">
          {steps.map((s, i) => {
            const current = i === index;
            return (
              <li
                key={s.id}
                className={[
                  "transition-colors duration-150 first:rounded-t-card last:rounded-b-card",
                  // 아직 지나지 않은 단계도 흐리게 두지 않습니다.
                  // (불투명도를 걸면 본문 대비가 WCAG AA 4.5:1 아래로 떨어집니다.)
                  current ? "bg-brand-50" : "hover:bg-paper-2",
                ].join(" ")}
              >
                <button
                  type="button"
                  onClick={() => goTo(i)}
                  aria-current={current ? "step" : undefined}
                  className="flex min-h-[48px] w-full items-start gap-3 px-4 py-3 text-left"
                >
                  <span
                    aria-hidden="true"
                    className={[
                      "chim-caption chim-num mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-chip font-extrabold",
                      // 흰 숫자를 얹는 채움은 4.5:1을 넘는 brand-700(4.9:1)을 씁니다.
                      current ? "bg-brand-700 text-white" : "bg-neutral-soft text-ink-soft",
                    ].join(" ")}
                  >
                    {i + 1}
                  </span>
                  <span
                    className={[
                      "chim-label leading-relaxed",
                      current ? "font-bold text-ink" : "font-normal text-ink-soft",
                    ].join(" ")}
                  >
                    {s.voice.trim().length > 0 ? s.voice : "(음성 없음 — 의도된 침묵 단계)"}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

export default ProtocolPlayer;
