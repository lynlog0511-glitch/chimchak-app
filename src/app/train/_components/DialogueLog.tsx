"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";
import { WaveBars } from "@/components";
import { cx } from "@/components/utils";
import { VARIED_LINE_LABEL, VARIED_LINE_NOTE } from "@/lib/onlineVary";
import {
  EMOTION_RING,
  EMOTION_TEXT,
  initialOf,
  triggerStageLine,
  type EmotionLevel,
} from "./constants";
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
   * 소리가 켜져 있는지 — 로그 리전을 읽어 줄지 말지를 가릅니다.
   *
   * 이 앱은 같은 대사를 **소리로도** 읽습니다. `role="log"`에 `aria-live="polite"`까지 걸면
   * 스크린리더를 쓰시는 분은 어르신 대사 한 줄을 두 번 듣습니다 — 앱이 한 번, 스크린리더가
   * 한 번. 게다가 한 턴에 「말하는 중」 빈 말풍선 → 실제 대사 → 코칭 카드로 리전이 세 번
   * 발화합니다(FE 검증). 소리와 낭독 중 **하나만** 말하게 합니다.
   */
  voiceOn?: boolean;
  /**
   * 로그 바닥을 가리는 하단 도킹 높이(px).
   * 모바일에서는 컴포저가 화면 아래에 붙어 있으므로, 그 높이만큼 여백을 두고 스크롤합니다.
   */
  bottomInset?: number;
  /**
   * 로그 꼬리가 도크에 가려졌는지 볼 때 쓰는 **고정** 하단 여백(px) — 도크 상한(45dvh)입니다.
   *
   * 실제 도크 높이(`bottomInset`)를 쓰면 앵커가 뜨는 순간 도크가 두꺼워지고, 그 값이 바뀌어
   * 관찰자가 다시 만들어지며, 정리 단계가 방금 켠 앵커를 도로 끕니다(자기취소 루프 · 평가 UI/UX m2).
   * 이 값은 뷰포트 크기와 화면 폭에만 반응하므로 앵커가 떠도 흔들리지 않습니다.
   */
  tailInset?: number;
  /** 새 내용이 쌓일 때 자동으로 자리를 잡을지 (엔딩에서는 화면이 직접 자리를 잡습니다) */
  autoScroll?: boolean;
  /**
   * 아직 펴지 않고 「말하는 중」으로 붙들어 둔 대사의 키.
   *
   * 로그의 **맨 끝 항목**이 이 키를 가진 인물 대사일 때만 듣습니다 — 그 자리에는 대사 대신
   * 같은 모양의 빈 말풍선과 점 셋을 두고, 부모가 시간을 다 재면 그때 대사가 들어섭니다.
   * 뒤에 이미 코칭이 붙은 대사는 붙들지 않습니다(코칭까지 함께 가려지기 때문입니다).
   */
  pendingLineKey?: string;
  /**
   * 로그 끝(새 대사 아래로 이어지는 코칭·돌발 변수)이 화면 밖에 있는지 알려 줍니다 —
   * 컴포저 위 「이어지는 코칭 보기 ↓」 앵커용입니다.
   */
  onTailOffscreen?: (offscreen: boolean) => void;
  /** 「이어지는 코칭 보기」를 누르셨을 때 로그 끝으로 데려갈 함수를 담아 둘 자리 */
  scrollToTailRef?: RefObject<(() => void) | null>;
  /**
   * 이번 세션에서 **같은 뜻으로 다시 쓰인** 대사 — 로그 키 → 화면에 세울 문장.
   *
   * 로그가 들고 있는 것은 언제나 검수 앵커입니다(`sessionMachine`은 대사를 만들지 않습니다).
   * 여기 담긴 키의 말풍선만 그 문장 대신 이 문장을 펴고, 그 사실을 「변주」 표기로 밝힙니다 —
   * 바뀐 것을 조용히 바꾸지 않는 것이 이 prop이 있는 까닭입니다(`src/lib/onlineVary.ts`).
   */
  variations?: ReadonlyMap<string, string>;
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

/* 아바타 한 글자를 뽑는 규칙은 `constants.ts`에 있습니다 —
   브리핑 인물 카드가 같은 함수로 같은 글자를 그립니다(같은 사람은 같은 얼굴이어야 합니다). */

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
        className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-danger-soft text-[0.8438rem] font-bold text-danger-ink"
      >
        안
      </span>
    );
  }

  return (
    <span
      aria-hidden
      style={ring ? { boxShadow: ring } : undefined}
      className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-paper-out text-[0.8438rem] font-bold text-ink-soft"
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
  variedText,
  showFiction = false,
}: {
  item: LineItem;
  live: boolean;
  emotion?: DialogueEmotion;
  speaking?: boolean;
  /** 검수 앵커 대신 이 문장을 폅니다 — 있으면 「변주」 표기가 함께 붙습니다 */
  variedText?: string;
  /**
   * 이 말풍선에 「가상 인물」을 적을지.
   *
   * 첫 인물 대사와 **화자가 바뀐 자리**에만 붙습니다. 같은 사람이 이어 말하는 동안 매 줄마다
   * 되풀이하면 고지가 배경 무늬가 되어 정작 읽어야 할 때 읽히지 않습니다(고지는 유지하되
   * 빈도만 줄이는 자리 — 문구는 한 글자도 바꾸지 않습니다).
   */
  showFiction?: boolean;
}) {
  const character = isCharacter(item.speaker);
  const protocol = item.speaker === "protocol";
  const system = item.speaker === "system";
  const varied = variedText !== undefined && variedText !== item.text;
  /* 저작용 분기 id는 화면에 내지 않습니다 — 데이터는 그대로입니다. */
  const text = stripInternalIds(variedText ?? item.text);
  const note = item.note ? stripInternalIds(item.note) : undefined;

  /* 돌발 변수 — 설계 표기(「T-2 보호자 전화」)가 아니라 무대 지문 한 줄로 섭니다.
     자리·크기는 상황 안내 지문과 같은 단(12.5px 가운데)이고, 색은 한 단 더 물러난 ink-faint입니다 —
     이 줄은 읽어야 할 내용이 아니라 **박자**이기 때문입니다. */
  const trigger = item.triggerName ? (
    <p className="mb-2 text-center text-[0.7813rem] leading-[1.6] text-ink-faint">
      {triggerStageLine(item.triggerName)}
    </p>
  ) : null;

  /* 상황 안내는 말하는 사람이 없습니다 — 지문으로 가운데에 조용히 둡니다. */
  if (system) {
    return (
      <div className="animate-fade-up">
        {trigger}
        <p className="text-center text-[0.7813rem] leading-[1.6] text-tertiary">{text}</p>
        {note && <p className="mt-1 text-center text-[0.7813rem] leading-[1.6] text-ink-faint">{note}</p>}
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
          <div className="mb-[4px] flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[0.7813rem] leading-[1.45] text-ink-muted">
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
              "rounded-[4px_18px_18px_18px] px-[15px] py-[12px] text-[1.0625rem] leading-[1.6]",
              protocol ? "bg-danger-soft text-ink" : "bg-paper-2 text-ink",
            )}
          >
            {text}
            {note && (
              <span className="mt-1.5 block text-[0.8438rem] leading-[1.6] text-ink-muted italic">
                {note}
              </span>
            )}
          </div>

          {/* 출처 한 줄 — 이 말풍선의 문장이 **실제로 어디서 왔는지**만 적는 자리입니다.
              예전에는 인물 대사마다 「AI 생성 · 가상 인물」이 붙었는데, 기본 빌드에서 그 문장은
              검수된 시나리오 데이터를 그대로 편 것이라 「AI 생성」이 사실이 아니었습니다 —
              매 줄마다 붙는 부정확한 표기는 정작 진짜 생성이 붙은 턴에서 아무 신호도 주지 못합니다.
              지금 규칙은 둘입니다:
               · 「AI 생성」은 이번 턴에 실제로 생성이 붙었을 때만(= 대사 변주). 코칭 쪽 생성은
                 인라인 코칭 덩어리가 자기 자리에서 같은 낱말로 밝힙니다(InlineCoaching).
               · 「가상 인물」은 첫 대사와 화자가 바뀐 자리에만(문구는 그대로, 빈도만 줄입니다).
              둘 다 없으면 이 줄은 아예 그리지 않습니다 — 빈 각주 자리가 남지 않게.
              「방금」은 표기의 꼬리말이라 표기가 있을 때만 따라 붙습니다. 홀로 남으면 매 턴 마지막
              말풍선에 각주 한 줄이 새로 생기는데, 그 줄이 말하는 「가장 아래가 가장 최근」은
              대화 화면에서 이미 자리가 말하고 있습니다. */}
          {protocol ? (
            <p className="mt-1 text-[0.6875rem] leading-[1.45] text-ink-faint">
              검수된 고정 안내 · AI 생성 아님
            </p>
          ) : (
            character &&
            (varied || showFiction) && (
              <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 text-[0.6875rem] leading-[1.45] text-ink-faint">
                {varied && (
                  <span>
                    AI 생성 · <span className="font-semibold">{VARIED_LINE_LABEL}</span>
                    <span className="sr-only"> — {VARIED_LINE_NOTE}</span>
                  </span>
                )}
                {varied && showFiction && <span aria-hidden>·</span>}
                {showFiction && <span>가상 인물</span>}
                {live && <span aria-hidden>·</span>}
                {live && <span>방금</span>}
              </p>
            )
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 「말하는 중」 점 셋.
 *
 * 새 속도를 만들지 않으려고 파형 막대와 **같은 루프**(`chim-wave-bar` 900ms)를 씁니다 —
 * 점마다 110ms씩 늦게 출발해 왼쪽에서 오른쪽으로 한 번씩 부풀었다 가라앉습니다.
 * 이모지도 문자 기호도 아닌 도형이고, 뜻은 옆의 「말하는 중」(sr-only)이 전합니다.
 * reduced-motion에서는 전역 규칙이 즉시 멈춥니다 — 그래도 이 자리는 부모가 아예
 * 붙들지 않으므로(TrainSession), 점이 멈춘 채 남아 있는 화면은 생기지 않습니다.
 */
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
 * 대사가 들어서기 직전의 빈 말풍선 (시안 4a 말풍선 + 「말하는 중」).
 *
 * 예전에는 응답을 보내는 순간 다음 대사가 통째로 튀어나왔습니다 — 어르신이 말을 고르는
 * 시간이 화면에 없어서, 대화라기보다 카드가 넘어가는 느낌이었습니다.
 * 자리·아바타·이름줄은 실제 대사와 **같은 모양**이라, 대사가 들어설 때 자리가 튀지 않습니다.
 */
function PendingBubble({ item, emotion }: { item: LineItem; emotion?: DialogueEmotion }) {
  const showEmotion = emotion && hasEmotion(item.speaker);

  return (
    <div className="animate-pop-in">
      <div className="flex gap-2.5">
        <SpeakerAvatar
          speaker={item.speaker}
          name={item.speakerName}
          ring={showEmotion ? EMOTION_RING[emotion.level] : undefined}
        />

        <div className="min-w-0 max-w-[85%]">
          <div className="mb-[4px] flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[0.7813rem] leading-[1.45] text-ink-muted">
            <span>{item.speakerName}</span>
            {showEmotion && (
              <>
                <span aria-hidden>·</span>
                <span className={cx("font-semibold", EMOTION_TEXT[emotion.level])}>
                  {emotion.word}
                </span>
              </>
            )}
          </div>

          {/* 크기는 실제 대사 한 줄과 같습니다 — 같은 글자 크기·행간·여백을 걸고, 점이 놓이는 줄만
              1.6em로 잡아 둡니다. 픽셀 고정값을 쓰면 「크게」·「아주 크게」에서 이 자리만 안 자라
              대사가 들어설 때 말풍선이 한 번 튑니다. */}
          <div className="rounded-[4px_18px_18px_18px] bg-paper-2 px-[15px] py-[12px] text-[1.0625rem] leading-[1.6]">
            <span className="flex h-[1.6em] items-center">
              <SpeakingDots />
              <span className="sr-only">말하는 중</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 내가 한 말.
 *
 * 「내 응답 · 버튼 선택」 각주는 걷어냈습니다 — 오른쪽에 붙은 틴트 말풍선이 이미 「내 말」이라고
 * 말하고 있고, 버튼으로 골랐는지 말로 했는지는 방금 그렇게 하신 분이 가장 잘 아십니다.
 * (판정 경로가 입력 방식에 따라 갈린다는 사실은 코칭의 「무엇을 보고 정했나요」 안에 남아 있습니다.)
 */
function LearnerBubble({ item }: { item: Extract<LogItem, { kind: "learner" }> }) {
  return (
    <div className="animate-fade-up flex justify-end">
      <div className="min-w-0 max-w-[85%]">
        <div
          className="rounded-[18px_4px_18px_18px] bg-tint px-[15px] py-[12px] text-[1.0625rem] leading-[1.6] text-deep"
        >
          {item.text}
        </div>
      </div>
    </div>
  );
}

/** 화면 움직임을 줄여 달라고 설정하신 분께는 부드러운 스크롤 대신 즉시 이동합니다. */
function scrollBehavior(): ScrollBehavior {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "auto";
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

/**
 * 「가상 인물」 고지를 적을 말풍선의 키.
 *
 * 첫 인물 대사와 **화자가 바뀐 자리**만 담습니다. 같은 분이 이어 말하는 동안에는 다시 적지
 * 않습니다 — 고지는 사라지지 않고, 되풀이만 그칩니다(문구 자체는 한 글자도 바뀌지 않습니다).
 * 검수된 고정 안내(protocol)가 한 번 지나가면 흐름이 끊긴 것으로 보고 다음 인물 대사에 다시 답니다.
 */
function fictionStampKeys(items: LogItem[]): Set<string> {
  const keys = new Set<string>();
  let previous: Speaker | null = null;
  for (const item of items) {
    if (item.kind !== "line") continue;
    if (item.speaker === "protocol") {
      previous = null;
      continue;
    }
    if (!isCharacter(item.speaker)) continue;
    if (item.speaker !== previous) keys.add(item.key);
    previous = item.speaker;
  }
  return keys;
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
 * 스크롤은 바깥(모바일은 페이지, md↑는 세션 본문)이 담당합니다. 새 인물 대사가 붙으면
 * **그 대사를 가시 띠 맨 위**에 세우고, 아래로 이어지는 코칭·돌발 변수는 앵커로 부릅니다.
 *
 * 새 대사는 곧바로 튀어나오지 않고 **「말하는 중」 빈 말풍선**을 한 박자 거쳐 들어섭니다
 * (`pendingLineKey` — 시간을 재는 것은 부모인 TrainSession입니다). 붙들려 있는 동안에는
 * 그 대사를 목록에서 빼고 세므로, 자동 스크롤이 아직 보이지 않는 대사를 미리 당기지 않습니다.
 *
 * 온라인 모드에서 같은 뜻으로 다시 쓰인 대사는 `variations`가 들고 옵니다. 이 컴포넌트가 하는
 * 일은 둘뿐입니다 — 그 문장을 펴는 것, 그리고 **바뀌었다는 사실을 말풍선에 적는 것**입니다.
 */
export function DialogueLog({
  items,
  gaugeLabel,
  emotion,
  speaking = false,
  voiceOn = false,
  bottomInset = 0,
  tailInset = 0,
  autoScroll = true,
  pendingLineKey,
  onTailOffscreen,
  scrollToTailRef,
  variations,
  className,
}: DialogueLogProps) {
  const endRef = useRef<HTMLDivElement | null>(null);
  const latestLineRef = useRef<HTMLDivElement | null>(null);
  /** 이미 자리를 잡아 드린 로그 끝 — 새 내용 없이 도크 높이만 바뀌었을 때 다시 움직이지 않게 합니다. */
  const settledTailRef = useRef<string | null>(null);
  /** 이미 맨 위에 세워 드린 대사 — 같은 턴 안에서 두 번 끌어당기지 않습니다. */
  const settledLineRef = useRef<string | null>(null);

  /**
   * 「말하는 중」으로 붙들고 있는 마지막 대사.
   *
   * 조건은 셋입니다 — 로그의 **맨 끝**이고, 인물 대사이고, 부모가 지목한 키일 것.
   * 그 대사만 목록에서 빼고 같은 자리에 빈 말풍선을 세웁니다. 아래 스크롤·앵커 계산이
   * 전부 「보이는 것」 기준으로 돌아야 하므로, 여기서 한 번만 갈라 두고 그 뒤로는
   * `shown`만 씁니다(붙들린 대사가 자동 스크롤을 미리 당기지 않게).
   */
  const tail = items[items.length - 1];
  const held =
    pendingLineKey &&
    tail &&
    tail.kind === "line" &&
    tail.key === pendingLineKey &&
    isCharacter(tail.speaker)
      ? tail
      : undefined;
  const shown = held ? items.slice(0, -1) : items;

  const lineKey = latestLineKey(shown);
  /* 「가상 인물」이 붙는 자리 — 목록이 바뀔 때마다 한 번만 훑습니다(항목 수십 개 규모입니다). */
  const fictionKeys = fictionStampKeys(shown);
  /* 로그 끝을 가리키는 표 — 개수까지 넣어 「처음부터 다시」로 로그가 줄어든 경우도 새 상태로 봅니다.
     붙들고 있는 대사는 아직 로그 끝이 아니므로 `shown` 기준으로 셉니다. */
  const tailKey = `${shown.length}:${shown[shown.length - 1]?.key ?? ""}`;

  /** 로그 끝(이어지는 코칭)까지 데려갑니다 — 컴포저 위 앵커가 부릅니다. */
  const goToTail = useCallback(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: scrollBehavior() });
  }, []);

  useEffect(() => {
    if (!scrollToTailRef) return undefined;
    scrollToTailRef.current = goToTail;
    return () => {
      scrollToTailRef.current = null;
    };
  }, [goToTail, scrollToTailRef]);

  /**
   * 응답을 보내신 직후에는 **이번 턴에 새로 붙은 인물 대사**를 가시 띠 맨 위에 세웁니다.
   *
   * 로그 바닥(`block:'end'`)에 맞추면, 한 턴이 만드는 증분(실측 450px)이 가시 띠(262px)보다
   * 커서 정작 답해야 할 새 대사가 매 턴 띠 위로 밀려났습니다(평가 UI/UX m2 실측).
   * 대사를 맨 위에 세우면 코칭·돌발 변수는 그 아래로 이어지므로 스크롤로 자연히 닿고,
   * 화면 밖에 남는 동안에는 「이어지는 코칭 보기 ↓」 앵커가 길을 남깁니다.
   * 새 대사가 없는 갱신(내 말풍선·초안 미리보기 등)에서는 예전처럼 바닥에 맞춥니다.
   */
  useEffect(() => {
    if (!autoScroll) return undefined;
    /* 새 내용이 없으면 자리를 건드리지 않습니다. 앵커가 뜨면 도크가 두꺼워져 `bottomInset`이
       바뀌는데, 그때 다시 스크롤하면 방금 맨 위에 세운 대사를 도로 바닥으로 끌어내립니다. */
    if (settledTailRef.current === tailKey) return undefined;
    settledTailRef.current = tailKey;
    const behavior = scrollBehavior();
    const fresh = lineKey.length > 0 && settledLineRef.current !== lineKey;
    settledLineRef.current = lineKey;
    const frame = window.requestAnimationFrame(() => {
      const line = fresh ? latestLineRef.current : null;
      if (line) {
        line.scrollIntoView({ block: "start", behavior });
        return;
      }
      endRef.current?.scrollIntoView({ block: "end", behavior });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [autoScroll, bottomInset, lineKey, tailKey]);

  /**
   * 로그 끝이 화면 밖이면 아래로 이어지는 내용이 남아 있다는 뜻입니다 — 앵커를 띄웁니다.
   * 도킹된 컴포저에 가려진 부분은 보이지 않는 것으로 셉니다.
   *
   * 가림 폭은 **도크 상한(`tailInset`)** 하나로 고정합니다. 예전에는 실측 도크 높이를 썼는데,
   * 앵커가 도크 안에 렌더되므로 앵커가 뜨는 순간 도크가 두꺼워지고 → 이 효과가 다시 돌고 →
   * 정리 단계의 `onTailOffscreen(false)`가 방금 켠 앵커를 껐습니다. 꼬리가 확실히 접힘 아래인
   * 상태에서 3초를 재도 앵커가 DOM에 한 번도 뜨지 않던 자리입니다(평가 UI/UX m2 실측).
   *
   * 12px은 되돌아올 여지입니다 — 앵커를 눌러 꼬리를 도크 바로 위까지 끌어왔을 때
   * 경계에 딱 걸려 앵커가 그대로 남는 것을 막습니다.
   */
  const observersRef = useRef(0);
  useEffect(() => {
    if (!onTailOffscreen) return undefined;
    const node = endRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      onTailOffscreen(false);
      return undefined;
    }
    // 자동 스크롤이 흘러가는 동안 앵커가 깜빡이지 않도록, 「안 보인다」는 잠시 기다렸다 알립니다.
    let timer = 0;
    const margin = Math.max(0, Math.round(tailInset) - 12);
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;
        window.clearTimeout(timer);
        if (entry.isIntersecting) {
          onTailOffscreen(false);
          return;
        }
        timer = window.setTimeout(() => onTailOffscreen(true), 600);
      },
      { rootMargin: `0px 0px -${margin}px 0px`, threshold: 0 },
    );
    observersRef.current += 1;
    observer.observe(node);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      observersRef.current -= 1;
      /* 앵커 상태를 끄는 것은 **관찰자가 아예 사라졌을 때(언마운트·대화 종료)** 뿐입니다.
         다음 틱에 확인해, 곧바로 새 관찰자가 붙는 재실행에서는 켜 둔 상태를 건드리지 않습니다. */
      window.setTimeout(() => {
        if (observersRef.current === 0) onTailOffscreen(false);
      }, 0);
    };
  }, [onTailOffscreen, tailInset]);

  return (
    <div
      role="log"
      /* 소리를 켜 두신 동안에는 리전을 읽지 않습니다 — role="log"만 남습니다.
         「소리 끄기」를 누르셨을 때만 polite로 올려, 새 대사가 글로 전해집니다. */
      aria-live={voiceOn ? "off" : "polite"}
      aria-label="대화 기록"
      className={cx("space-y-[18px]", className)}
    >
      {shown.map((item) => {
        switch (item.kind) {
          case "line":
            return (
              <div
                key={item.key}
                ref={item.key === lineKey ? latestLineRef : undefined}
                /* 페이지가 스크롤되고 헤더가 위에 도킹돼 있습니다 —
                   그 실측 높이(--session-head-h)만큼 비워야 대사가 헤더 밑에 깔리지 않습니다. */
                className="scroll-mt-[calc(var(--session-head-h,0px)_+_12px)]"
              >
                <LineBubble
                  item={item}
                  live={item.key === lineKey}
                  emotion={emotion}
                  speaking={speaking}
                  variedText={variations?.get(item.key)}
                  showFiction={fictionKeys.has(item.key)}
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
                  "animate-fade-up rounded-card px-4 py-3 text-[0.8438rem] leading-[1.6] font-bold",
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
      {/* 대사가 들어서기 직전 — 같은 자리에 빈 말풍선과 점 셋만 둡니다. */}
      {/* 「말하는 중」 자리 표시자는 **시각적 박자 연출**이지 읽을 내용이 아닙니다 —
          같은 대사가 곧 실제 말풍선으로 들어서므로 리전이 두 번 발화하지 않게 감춥니다. */}
      {held && (
        <div aria-hidden>
          <PendingBubble item={held} emotion={emotion} />
        </div>
      )}
      {/* 스크롤 바닥 — 하단에 도킹된 컴포저 높이만큼 여백을 두고 멈춥니다.
          앵커를 눌러 여기까지 왔을 때는 「가려졌다」고 보는 띠(`tailInset`)도 반드시 넘어서야
          앵커가 제 할 일을 마치고 사라집니다 — 그래서 둘 중 큰 값을 씁니다. */}
      <div
        ref={endRef}
        aria-hidden
        className="h-px"
        style={{
          scrollMarginBottom: `${Math.max(0, Math.round(bottomInset), Math.round(tailInset))}px`,
        }}
      />
    </div>
  );
}

export default DialogueLog;
