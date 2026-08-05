"use client";

import { useEffect, useRef } from "react";
import { WaveBars } from "@/components";
import { cx } from "@/components/utils";
import { EMOTION_RING, EMOTION_TEXT, type EmotionLevel } from "./constants";
import { InlineCoaching } from "./InlineCoaching";
import { RecordDraftPreview } from "./RecordDraftPreview";
import type { LogItem } from "./sessionMachine";

type LineItem = Extract<LogItem, { kind: "line" }>;
type Speaker = LineItem["speaker"];

export interface DialogueEmotion {
  level: EmotionLevel;
  /** 이름줄에 붙는 상태어 — 「조금 불안」 */
  word: string;
}

export interface DialogueLogProps {
  items: LogItem[];
  /** 게이지 이름 — 인라인 코칭의 델타 칩 문구에 씁니다 */
  gaugeLabel: string;
  /**
   * 지금 인물의 감정 상태.
   * **마지막 대사에만** 붙습니다 — 지나간 대사에 지금 감정을 덧칠하지 않습니다.
   */
  emotion?: DialogueEmotion;
  /** 마지막 대사를 지금 읽어 주고 있는지 (TTS) */
  speaking?: boolean;
  className?: string;
}

/** 화자별 표시 규칙 — 등장인물 대사에는 항상 AI 생성·가상 인물 표기가 붙습니다. */
function isCharacter(speaker: Speaker): boolean {
  return speaker === "elder" || speaker === "guardian" || speaker === "dispatcher";
}

/** 게이지가 설명하는 인물 — 119 상황실에는 감정 상태어를 붙이지 않습니다. */
function hasEmotion(speaker: Speaker): boolean {
  return speaker === "elder" || speaker === "guardian";
}

/**
 * 아바타에 새길 한 글자.
 * 역할어("보호자" 등)와 괄호 주석을 걷어낸 뒤, 홀로 떨어져 있는 성씨 한 글자를 먼저 찾습니다.
 *
 * @example initialOf("박 어르신")     // "박"
 * @example initialOf("보호자 김 씨")  // "김"
 * @example initialOf("119 상황실")    // "상"
 */
const ROLE_PREFIX = ["보호자", "요양보호사", "간호사", "센터장", "가족", "따님", "아드님"];

function initialOf(name: string): string {
  let base = name.replace(/\([^)]*\)/g, " ").trim();
  for (const word of ROLE_PREFIX) {
    if (base.startsWith(word)) {
      base = base.slice(word.length).trim();
      break;
    }
  }
  const surname = base.split(/\s+/).find((token) => /^[가-힣]$/.test(token));
  if (surname) return surname;
  const hangul = base.match(/[가-힣]/);
  if (hangul) return hangul[0];
  const other = base.match(/[A-Za-z0-9]/);
  return other ? other[0] : "";
}

/**
 * 화자 아바타 — 38px 원 하나 (시안 4a).
 * 사진도 아이콘도 쓰지 않고 한 글자만 새깁니다. 사전 검수 안내는 붉은 면에 「안」.
 * 감정 링은 지금 말하고 있는 인물에게만 붙고, 뜻은 옆의 상태어가 전합니다.
 */
function SpeakerAvatar({
  speaker,
  name,
  ring,
}: {
  speaker: Speaker;
  name: string;
  ring?: string;
}) {
  if (speaker === "protocol") {
    return (
      <span
        aria-hidden
        className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-danger-soft text-[14px] font-bold text-danger-ink"
      >
        안
      </span>
    );
  }

  return (
    <span
      aria-hidden
      style={ring ? { boxShadow: ring } : undefined}
      className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-paper-out text-[14px] font-bold text-ink-soft"
    >
      {initialOf(name)}
    </span>
  );
}

/**
 * 대사 한 줄.
 *
 *  · 인물 대사 — 아바타 + 이름줄 + 왼쪽 위 꼬리 말풍선(면 `#f5f6f6`) + 「AI 생성 · 가상 인물」
 *  · 사전 검수 안내 — 같은 문법, 붉은 면 + 「검수된 고정 안내 · AI 생성 아님」
 *  · 상황 안내 — 말풍선이 아니라 무대 지문(가운데 12.5px)
 */
function LineBubble({
  item,
  live,
  emotion,
  speaking,
}: {
  item: LineItem;
  live: boolean;
  emotion?: DialogueEmotion;
  speaking?: boolean;
}) {
  const character = isCharacter(item.speaker);
  const protocol = item.speaker === "protocol";
  const system = item.speaker === "system";

  const trigger = item.triggerName ? (
    <p className="mb-2 text-center text-[12px] leading-[1.5] font-bold text-warn-ink">
      돌발 변수 · {item.triggerName}
    </p>
  ) : null;

  /* 상황 안내는 말하는 사람이 없습니다 — 지문으로 가운데에 조용히 둡니다. */
  if (system) {
    return (
      <div className="animate-fade-up">
        {trigger}
        <p className="text-center text-[12.5px] leading-[1.6] text-tertiary">{item.text}</p>
        {item.note && (
          <p className="mt-1 text-center text-[12px] leading-[1.6] text-faint">{item.note}</p>
        )}
      </div>
    );
  }

  const showEmotion = live && emotion && hasEmotion(item.speaker);

  return (
    <div className="animate-fade-up">
      {trigger}

      <div className="flex gap-2.5">
        <SpeakerAvatar
          speaker={item.speaker}
          name={item.speakerName}
          ring={showEmotion ? EMOTION_RING[emotion.level] : undefined}
        />

        <div className="min-w-0 max-w-[85%]">
          <div className="mb-[5px] flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[12.5px] leading-[1.4] text-ink-muted">
            <span>{item.speakerName}</span>
            {showEmotion && (
              <>
                <span aria-hidden>·</span>
                <span className={cx("font-semibold", EMOTION_TEXT[emotion.level])}>
                  {emotion.word}
                </span>
              </>
            )}
            {protocol && (
              <>
                <span aria-hidden>·</span>
                <span className="font-semibold text-danger-ink">검수된 고정 안내</span>
              </>
            )}
            {live && speaking && (
              <span className="ml-0.5 inline-flex items-baseline gap-1.5">
                <WaveBars count={3} className="relative top-[1px]" />
                <span className="text-[11px] font-semibold text-brand-600">읽어 주는 중</span>
              </span>
            )}
          </div>

          {/* 대사는 이 화면의 주인공입니다 — 17px/1.6, 꼬리는 왼쪽 위 한 모서리만. */}
          <div
            className={cx(
              "rounded-[4px_18px_18px_18px] px-[15px] py-[13px] text-[17px] leading-[1.6]",
              protocol ? "bg-danger-soft text-ink" : "bg-paper-2 text-ink",
            )}
          >
            {item.text}
            {item.note && (
              <span className="mt-1.5 block text-[13.5px] leading-[1.55] text-ink-muted italic">
                {item.note}
              </span>
            )}
          </div>

          <p className="mt-1 text-[11px] leading-[1.5] text-faint">
            {protocol
              ? "검수된 고정 안내 · AI 생성 아님"
              : character
                ? `AI 생성 · 가상 인물${live ? " · 방금" : ""}`
                : ""}
          </p>
        </div>
      </div>
    </div>
  );
}

function LearnerBubble({ item }: { item: Extract<LogItem, { kind: "learner" }> }) {
  return (
    <div className="animate-fade-up flex justify-end">
      <div className="min-w-0 max-w-[85%]">
        <div
          className="rounded-[18px_4px_18px_18px] bg-tint px-[15px] py-[13px] text-[17px] leading-[1.6] text-deep"
        >
          {item.text}
        </div>
        <p className="mt-1 text-right text-[11px] leading-[1.5] text-faint">
          내 응답 · {item.viaButton ? "버튼 선택" : "말하기·직접 입력"}
        </p>
      </div>
    </div>
  );
}

/** 화면 움직임을 줄여 달라고 설정하신 분께는 부드러운 스크롤 대신 즉시 이동합니다. */
function scrollBehavior(): ScrollBehavior {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "auto";
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

/** 로그에서 가장 마지막 피드백 항목의 키 (없으면 빈 문자열) */
function latestFeedbackKey(items: LogItem[]): string {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    if (item && item.kind === "feedback") return item.key;
  }
  return "";
}

/** 마지막 대사 항목의 키 — 감정 링·TTS 표시가 붙는 자리입니다. */
function latestLineKey(items: LogItem[]): string {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    if (item && item.kind === "line") return item.key;
  }
  return "";
}

/**
 * 대화 — 메신저 문법으로 쌓입니다 (시안 3a·4a).
 * 지문 → AI 말풍선 → 내 말풍선 → 인라인 코칭 순서로 흐르고, 카드는 쓰지 않습니다.
 *
 * 스크롤은 바깥(세션 본문)이 담당합니다. 응답을 보내신 직후에는 **방금 생긴 코칭**을
 * 화면 한가운데로 끌어오고, 그 밖에는 마지막 줄이 보이도록 내려 드립니다.
 */
export function DialogueLog({
  items,
  gaugeLabel,
  emotion,
  speaking = false,
  className,
}: DialogueLogProps) {
  const endRef = useRef<HTMLDivElement | null>(null);
  const feedbackRef = useRef<HTMLDivElement | null>(null);
  const shownFeedbackKeyRef = useRef<string>("");

  const feedbackKey = latestFeedbackKey(items);
  const lineKey = latestLineKey(items);

  useEffect(() => {
    // 다시 하기로 로그가 비워지면 기억을 지웁니다 (키가 같은 값으로 되돌아와도 다시 옮겨 드리도록).
    if (feedbackKey.length === 0) shownFeedbackKeyRef.current = "";

    const behavior = scrollBehavior();
    const target = feedbackRef.current;
    const isNewFeedback =
      feedbackKey.length > 0 && Boolean(target) && shownFeedbackKeyRef.current !== feedbackKey;
    if (isNewFeedback) shownFeedbackKeyRef.current = feedbackKey;

    const frame = window.requestAnimationFrame(() => {
      if (isNewFeedback && target) {
        target.scrollIntoView({ block: "center", behavior });
        return;
      }
      endRef.current?.scrollIntoView({ block: "end", behavior });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [items, feedbackKey]);

  return (
    <div
      role="log"
      aria-live="polite"
      aria-label="대화 기록"
      className={cx("space-y-[18px]", className)}
    >
      {items.map((item) => {
        switch (item.kind) {
          case "line":
            return (
              <LineBubble
                key={item.key}
                item={item}
                live={item.key === lineKey}
                emotion={emotion}
                speaking={speaking}
              />
            );
          case "learner":
            return <LearnerBubble key={item.key} item={item} />;
          case "feedback":
            return (
              <div key={item.key} ref={item.key === feedbackKey ? feedbackRef : undefined}>
                <InlineCoaching
                  feedback={item.feedback}
                  gaugeLabel={gaugeLabel}
                  className="animate-fade-up"
                />
              </div>
            );
          case "draft":
            return (
              <RecordDraftPreview key={item.key} source={item.source} className="animate-fade-up" />
            );
          case "notice":
            /* 전환 안내 — 면 하나에 한 줄. L3 전환만 붉은 면을 씁니다. */
            return (
              <div
                key={item.key}
                className={cx(
                  "animate-fade-up rounded-card px-4 py-3 text-[13px] leading-[1.6] font-bold",
                  item.tone === "danger"
                    ? "bg-danger-soft text-danger-ink"
                    : "bg-tint text-brand-800",
                )}
              >
                {item.text}
              </div>
            );
          default:
            return null;
        }
      })}
      <div ref={endRef} aria-hidden className="h-px" />
    </div>
  );
}

export default DialogueLog;
