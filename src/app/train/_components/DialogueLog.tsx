"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";
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
  /**
   * 로그 바닥을 가리는 하단 도킹 높이(px).
   * 모바일에서는 컴포저가 화면 아래에 붙어 있으므로, 그 높이만큼 여백을 두고 스크롤합니다.
   */
  bottomInset?: number;
  /** 새 내용이 쌓일 때 자동으로 바닥까지 내려갈지 (엔딩에서는 화면이 직접 자리를 잡습니다) */
  autoScroll?: boolean;
  /**
   * 최신 인물 대사가 화면 밖에 있는지 알려 줍니다 — 컴포저 위 「새로 말씀하셨어요」 앵커용.
   * 두 번째 인자는 그 대사의 화자입니다.
   */
  onLatestLineOffscreen?: (offscreen: boolean, speaker: Speaker) => void;
  /** 「새로 말씀하셨어요」를 누르셨을 때 그 대사로 데려갈 함수를 담아 둘 자리 */
  scrollToLatestLineRef?: RefObject<(() => void) | null>;
  className?: string;
}

/**
 * 저작용 내부 분기 id를 화면 문장에서 걷어냅니다 — 「원인 탐색(D2-a)을 수행한」 → 「원인 탐색을 수행한」.
 *
 * 데이터(`src/data`)는 그대로 두고 **표시부에서만** 지웁니다(가이드 §4.10 · §7-7).
 * 「(가상 인물)」처럼 사람이 읽는 괄호는 건드리지 않습니다.
 *
 * @example stripInternalIds("원인 탐색(D2-a)을 수행한") // "원인 탐색을 수행한"
 * @example stripInternalIds("박 어르신 (가상 인물)")    // "박 어르신 (가상 인물)"
 */
export function stripInternalIds(text: string): string {
  return text.replace(/\s*\([A-Z]{1,4}-?\d+(?:-[0-9A-Za-z]+)?\)/g, "");
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
        className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-danger-soft text-[0.875rem] font-bold text-danger-ink"
      >
        안
      </span>
    );
  }

  return (
    <span
      aria-hidden
      style={ring ? { boxShadow: ring } : undefined}
      className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-paper-out text-[0.875rem] font-bold text-ink-soft"
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
  /* 저작용 분기 id는 화면에 내지 않습니다 — 데이터는 그대로입니다. */
  const text = stripInternalIds(item.text);
  const note = item.note ? stripInternalIds(item.note) : undefined;

  const trigger = item.triggerName ? (
    <p className="mb-2 text-center text-[0.75rem] leading-[1.5] font-bold text-warn-ink">
      돌발 변수 · {item.triggerName}
    </p>
  ) : null;

  /* 상황 안내는 말하는 사람이 없습니다 — 지문으로 가운데에 조용히 둡니다. */
  if (system) {
    return (
      <div className="animate-fade-up">
        {trigger}
        <p className="text-center text-[0.7813rem] leading-[1.6] text-tertiary">{text}</p>
        {note && <p className="mt-1 text-center text-[0.75rem] leading-[1.6] text-faint">{note}</p>}
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
          <div className="mb-[5px] flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[0.7813rem] leading-[1.4] text-ink-muted">
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
                <span className="text-[0.6875rem] font-semibold text-brand-600">읽어 주는 중</span>
              </span>
            )}
          </div>

          {/* 대사는 이 화면의 주인공입니다 — 17px/1.6, 꼬리는 왼쪽 위 한 모서리만. */}
          <div
            className={cx(
              "rounded-[4px_18px_18px_18px] px-[15px] py-[13px] text-[1.0625rem] leading-[1.6]",
              protocol ? "bg-danger-soft text-ink" : "bg-paper-2 text-ink",
            )}
          >
            {text}
            {note && (
              <span className="mt-1.5 block text-[0.8438rem] leading-[1.55] text-ink-muted italic">
                {note}
              </span>
            )}
          </div>

          <p className="mt-1 text-[0.6875rem] leading-[1.5] text-faint">
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
          className="rounded-[18px_4px_18px_18px] bg-tint px-[15px] py-[13px] text-[1.0625rem] leading-[1.6] text-deep"
        >
          {item.text}
        </div>
        <p className="mt-1 text-right text-[0.6875rem] leading-[1.5] text-faint">
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

/** 마지막 대사 항목의 키 — 감정 링·TTS 표시가 붙는 자리입니다. */
function latestLineKey(items: LogItem[]): string {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    if (item && item.kind === "line") return item.key;
  }
  return "";
}

/** 마지막 대사의 화자 — 앵커 문구(「어르신이 새로 말씀하셨어요」)를 고르는 데 씁니다. */
function latestLineSpeaker(items: LogItem[]): Speaker {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    if (item && item.kind === "line") return item.speaker;
  }
  return "system";
}

/**
 * 대화 — 메신저 문법으로 쌓입니다 (시안 3a·4a).
 * 지문 → AI 말풍선 → 내 말풍선 → 인라인 코칭 순서로 흐르고, 카드는 쓰지 않습니다.
 *
 * 스크롤은 바깥(모바일은 페이지, md↑는 세션 본문)이 담당합니다. 새 내용이 쌓이면 언제나
 * **로그 바닥**까지 내려 드리고, 하단에 도킹된 컴포저 높이만큼은 여백으로 비워 둡니다.
 */
export function DialogueLog({
  items,
  gaugeLabel,
  emotion,
  speaking = false,
  bottomInset = 0,
  autoScroll = true,
  onLatestLineOffscreen,
  scrollToLatestLineRef,
  className,
}: DialogueLogProps) {
  const endRef = useRef<HTMLDivElement | null>(null);
  const latestLineRef = useRef<HTMLDivElement | null>(null);

  const lineKey = latestLineKey(items);
  const lineSpeaker = latestLineSpeaker(items);

  /** 최신 인물 대사로 데려갑니다 — 컴포저 위 앵커가 부릅니다. */
  const goToLatestLine = useCallback(() => {
    latestLineRef.current?.scrollIntoView({ block: "start", behavior: scrollBehavior() });
  }, []);

  useEffect(() => {
    if (!scrollToLatestLineRef) return undefined;
    scrollToLatestLineRef.current = goToLatestLine;
    return () => {
      scrollToLatestLineRef.current = null;
    };
  }, [goToLatestLine, scrollToLatestLineRef]);

  /**
   * 응답을 보내신 직후에는 **로그 바닥**까지 내려 드립니다.
   * 이전에는 「직전 코칭 행」을 화면 가운데로 끌어왔는데, 그 뒤에 붙은 새 대사·돌발 변수 안내가
   * 창 밖에 남아 못 본 내용에 답하게 되는 일이 있었습니다(가이드 §5 · 평가 c1).
   * 하단 도킹된 컴포저 높이만큼은 `scroll-margin`으로 비워 둡니다.
   */
  useEffect(() => {
    if (!autoScroll) return undefined;
    const behavior = scrollBehavior();
    const frame = window.requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ block: "end", behavior });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [items, autoScroll, bottomInset]);

  /**
   * 새로 등장한 인물 대사가 화면 밖에 있으면 회수 경로(앵커)를 남깁니다.
   * 도킹된 컴포저에 가려진 부분은 보이지 않는 것으로 셉니다.
   */
  useEffect(() => {
    if (!onLatestLineOffscreen) return undefined;
    const node = latestLineRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      onLatestLineOffscreen(false, lineSpeaker);
      return undefined;
    }
    // 자동 스크롤이 흘러가는 동안 앵커가 깜빡이지 않도록, 「안 보인다」는 잠시 기다렸다 알립니다.
    let timer = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;
        window.clearTimeout(timer);
        if (entry.isIntersecting) {
          onLatestLineOffscreen(false, lineSpeaker);
          return;
        }
        timer = window.setTimeout(() => onLatestLineOffscreen(true, lineSpeaker), 600);
      },
      { rootMargin: `0px 0px -${Math.max(0, Math.round(bottomInset))}px 0px`, threshold: 0 },
    );
    observer.observe(node);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      onLatestLineOffscreen(false, lineSpeaker);
    };
  }, [lineKey, lineSpeaker, bottomInset, onLatestLineOffscreen]);

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
              <div
                key={item.key}
                ref={item.key === lineKey ? latestLineRef : undefined}
                className="scroll-mt-3"
              >
                <LineBubble
                  item={item}
                  live={item.key === lineKey}
                  emotion={emotion}
                  speaking={speaking}
                />
              </div>
            );
          case "learner":
            return <LearnerBubble key={item.key} item={item} />;
          case "feedback":
            return (
              <InlineCoaching
                key={item.key}
                feedback={item.feedback}
                gaugeLabel={gaugeLabel}
                className="animate-fade-up"
              />
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
                  "animate-fade-up rounded-card px-4 py-3 text-[0.8125rem] leading-[1.6] font-bold",
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
      {/* 스크롤 바닥 — 하단에 도킹된 컴포저 높이만큼 여백을 두고 멈춥니다. */}
      <div
        ref={endRef}
        aria-hidden
        className="h-px"
        style={{ scrollMarginBottom: `${Math.max(0, Math.round(bottomInset))}px` }}
      />
    </div>
  );
}

export default DialogueLog;
