"use client";

import { useEffect, useRef } from "react";
import { WaveBars } from "@/components";
import { cx } from "@/components/utils";
import { FREE_FALLBACK_NOTE } from "@/lib/onlineFree";
import { SCENE_FIRST_MOVE, SCENE_PERSONA_LABEL, SCENE_SITUATION_LABEL } from "./constants";

/** 화면이 들고 있는 대화 한 줄 — 저장되지 않고, 화면을 벗어나면 사라집니다. */
export interface ChatItem {
  id: number;
  speaker: "character" | "learner";
  text: string;
  /** 생성문이 대조에 걸려 고정 문구로 대체된 대사인가 */
  replaced?: boolean;
}

export interface FreeDialogueProps {
  situation: string;
  persona: string;
  items: readonly ChatItem[];
  /** 인물이 답을 고르고 있는 중 (빈 말풍선 + 점 셋) */
  pending: boolean;
  /** 지금 대사를 읽어 주고 있는지 (마지막 인물 대사에만 붙습니다) */
  speaking: boolean;
  className?: string;
}

/** 인물 이름줄에 새길 한 글자 — 소개 문장 앞머리의 성씨 한 자를 찾습니다. */
function initialOf(persona: string): string {
  const surname = persona.trim().split(/\s+/)[0]?.replace(/[^가-힣]/g, "") ?? "";
  return surname.slice(0, 1) || "인";
}

/** 이름줄에 적을 짧은 이름 — 소개 문장의 첫 토막(쉼표·줄표 앞)만 씁니다. */
function shortName(persona: string): string {
  const head = persona.trim().split(/[,—·(]/)[0]?.trim() ?? "";
  return head.length > 0 && head.length <= 20 ? head : "등장인물";
}

function SpeakingDots() {
  return (
    <span aria-hidden className="flex items-end gap-[5px]">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="chim-wave-bar block h-[7px] w-[7px] rounded-full bg-brand-400"
          style={{ animationDelay: `${index * 110}ms` }}
        />
      ))}
    </span>
  );
}

/**
 * 자유 연습의 대화 로그.
 *
 * 말풍선 문법은 훈련 화면(`DialogueLog`)과 **같습니다** — 인물은 왼쪽 위 꼬리에 회색 면,
 * 학습자는 오른쪽 위 꼬리에 틸 면, 지문은 말풍선이 아니라 가운데 한 줄입니다.
 * 다른 것은 말풍선 아래 출처 줄뿐입니다. 훈련은 「AI 생성 · 가상 인물」이라고 적고 그 문장이
 * 검수 앵커임을 함께 밝히지만, 이 모드의 대사는 앵커가 없는 **즉흥 생성문**이라 그렇게 적습니다.
 * 고정 문구로 대체된 대사에는 대체했다는 사실을 그 자리에 붙입니다.
 */
export function FreeDialogue({
  situation,
  persona,
  items,
  pending,
  speaking,
  className,
}: FreeDialogueProps) {
  const tailRef = useRef<HTMLDivElement | null>(null);
  const lastCharacterId = [...items].reverse().find((item) => item.speaker === "character")?.id;

  useEffect(() => {
    // 아직 아무 말도 오가지 않았으면 자리를 옮기지 않습니다 — 장면이 막 만들어진 순간에
    // 화면이 아래로 튀면, 방금 만들어진 상황 지문을 읽기도 전에 지나칩니다.
    if (items.length === 0 && !pending) return;
    const behavior: ScrollBehavior =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth";
    tailRef.current?.scrollIntoView({ behavior, block: "end" });
  }, [items.length, pending]);

  const name = shortName(persona);

  return (
    <div className={className}>
      {/* 상황 지문 — 말풍선이 아니라 무대 지문입니다(가운데 정렬 회색 면). */}
      <section className="rounded-card bg-paper-2 px-4 py-[15px]">
        <p className="text-[0.7813rem] leading-[1.45] font-bold text-ink-muted">
          {SCENE_SITUATION_LABEL}
        </p>
        <p className="mt-1 text-[1.0625rem] leading-[1.6] text-ink">{situation}</p>
        <p className="mt-3 text-[0.7813rem] leading-[1.45] font-bold text-ink-muted">
          {SCENE_PERSONA_LABEL}
        </p>
        <p className="mt-1 text-[0.9375rem] leading-[1.6] text-ink-soft">{persona}</p>
        <p className="mt-2 text-[0.6875rem] leading-[1.45] text-ink-faint">
          이 상황과 인물은 경량 LLM이 방금 만든 것입니다 · 가상 인물
        </p>
      </section>

      {items.length === 0 && !pending && (
        <p className="mt-4 text-center text-[0.8438rem] leading-[1.6] text-ink-muted">
          {SCENE_FIRST_MOVE}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-4">
        {items.map((item) =>
          item.speaker === "character" ? (
            <div key={item.id} className="animate-fade-up flex gap-2.5">
              <span
                aria-hidden
                className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-paper-out text-[0.8438rem] font-bold text-ink-soft"
              >
                {initialOf(persona)}
              </span>
              <div className="min-w-0 max-w-[85%]">
                <div className="mb-[4px] flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[0.7813rem] leading-[1.45] text-ink-muted">
                  <span>{name}</span>
                  {speaking && item.id === lastCharacterId && (
                    <span className="ml-0.5 inline-flex items-baseline gap-1.5">
                      <WaveBars count={3} className="relative top-[1px]" />
                      <span className="text-[0.6875rem] font-semibold text-brand-600">
                        읽어 주는 중
                      </span>
                    </span>
                  )}
                </div>
                <div className="rounded-[4px_18px_18px_18px] bg-paper-2 px-[15px] py-[12px] text-[1.0625rem] leading-[1.6] text-ink">
                  {item.text}
                </div>
                <p className="mt-1 text-[0.6875rem] leading-[1.45] text-ink-faint">
                  {item.replaced ? FREE_FALLBACK_NOTE : "즉흥 생성 · 가상 인물"}
                </p>
              </div>
            </div>
          ) : (
            <div key={item.id} className="animate-fade-up flex justify-end">
              <div className="min-w-0 max-w-[85%]">
                <div className="rounded-[18px_4px_18px_18px] bg-tint px-[15px] py-[12px] text-[1.0625rem] leading-[1.6] text-deep">
                  {item.text}
                </div>
                <p className="mt-1 text-right text-[0.6875rem] leading-[1.45] text-ink-faint">
                  내 응답 · 판정하지 않습니다
                </p>
              </div>
            </div>
          ),
        )}

        {pending && (
          <div className="animate-pop-in flex gap-2.5">
            <span
              aria-hidden
              className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-paper-out text-[0.8438rem] font-bold text-ink-soft"
            >
              {initialOf(persona)}
            </span>
            <div className="min-w-0 max-w-[85%]">
              <div className="mb-[4px] text-[0.7813rem] leading-[1.45] text-ink-muted">{name}</div>
              <div
                className={cx(
                  "rounded-[4px_18px_18px_18px] bg-paper-2 px-[15px] py-[12px]",
                  "text-[1.0625rem] leading-[1.6]",
                )}
              >
                <span className="flex h-[1.6em] items-center">
                  <SpeakingDots />
                  <span className="sr-only">말하는 중</span>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div ref={tailRef} aria-hidden className="h-px" />
    </div>
  );
}

export default FreeDialogue;
