"use client";

import { useEffect, useRef } from "react";
import { AiBadge, FeedbackCard } from "@/components";
import { IconAlert, IconShield } from "@/components/icons";
import { cx } from "@/components/utils";
import type { LogItem } from "./sessionMachine";
import { RecordDraftPreview } from "./RecordDraftPreview";

type LineItem = Extract<LogItem, { kind: "line" }>;
type Speaker = LineItem["speaker"];

export interface DialogueLogProps {
  items: LogItem[];
  className?: string;
}

/** 화자별 표시 규칙 — 등장인물 대사에는 항상 AI 배지와 가상 인물 고지가 붙습니다. */
function isCharacter(speaker: Speaker): boolean {
  return speaker === "elder" || speaker === "guardian" || speaker === "dispatcher";
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
 * 화자 아바타 — 42px 원형.
 * 색은 아껴 씁니다: 어르신만 틸 톤, 보호자·상황실은 잉크 톤.
 * 사전 검수 안내(protocol)는 이니셜 대신 방패 스트로크, 상황 안내(system)는 아바타가 없습니다.
 * 의미는 옆의 화자 이름이 전달하므로 아바타 자체는 장식(aria-hidden)입니다.
 *
 * v3 §1-4: 테두리 대신 면으로만 구분합니다 — 원이 이미 형태를 만들고 있어 선이 필요 없습니다.
 */
function SpeakerAvatar({ speaker, name }: { speaker: Speaker; name: string }) {
  if (speaker === "system") return null;

  if (speaker === "protocol") {
    return (
      <span
        aria-hidden="true"
        className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger-ink"
      >
        <IconShield className="h-[22px] w-[22px]" />
      </span>
    );
  }

  const elder = speaker === "elder";

  return (
    <span
      aria-hidden="true"
      className={cx(
        "flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full text-[1.0625rem] font-extrabold",
        elder ? "bg-brand-100 text-brand-800" : "bg-neutral-soft text-ink-soft",
      )}
    >
      {initialOf(name)}
    </span>
  );
}

/**
 * 로그 한 줄.
 *
 * 세 가지 표기 체계를 일부러 다르게 씁니다.
 *  · 인물 대사 — 아바타 + 왼쪽 위 꼬리 말풍선 (사전 검수 안내도 같은 문법, 바탕 면만 다름)
 *  · 상황 안내 — 말풍선도 카드도 아닌 지문(들여쓰기 + 이탤릭, 세로줄 없음)
 *  · 판정(FeedbackCard) — 마크·판정어 한 줄 + 한 톤 내린 바탕
 *
 * 크기(§3): 대사는 코어 콘텐츠라 18px(모바일)/20px(md↑)이 하한이고,
 * 화자 이름·부가 표기 같은 UI 크롬은 13~15px로 내려 대사가 혼자 크게 보이도록 둡니다.
 */
function LineBubble({ item }: { item: LineItem }) {
  const character = isCharacter(item.speaker);
  const protocol = item.speaker === "protocol";
  const system = item.speaker === "system";

  const speakerRow = (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="chim-label font-extrabold text-ink">{item.speakerName}</span>
      {character ? (
        <AiBadge />
      ) : (
        // 메타 정보는 칩으로 감싸지 않고 작은 텍스트로 둡니다(한 화면의 필 형태 수를 줄입니다).
        <span
          className={cx("chim-caption font-semibold", protocol ? "text-danger-ink" : "text-ink-muted")}
        >
          {protocol ? "검수된 고정 안내 · AI 생성 아님" : "상황 안내"}
        </span>
      )}
    </div>
  );

  /* 대사 — 이 화면의 주인공입니다(코어 18→20px). */
  const body = (
    <>
      <p className="chim-core font-semibold text-ink md:text-[1.25rem]">{item.text}</p>
      {item.note && (
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-muted italic">{item.note}</p>
      )}
    </>
  );

  const trigger = item.triggerName ? (
    <p className="chim-caption mb-2 flex items-center gap-2 font-extrabold text-warn-ink">
      <IconAlert className="h-[18px] w-[18px] shrink-0" />
      돌발 변수 · {item.triggerName}
    </p>
  ) : null;

  /* 상황 안내는 말하는 사람이 없습니다 — 세로줄 액센트 대신 들여쓰기와 이탤릭만 둡니다(§1-2). */
  if (system) {
    return (
      <div className="animate-fade-up">
        {trigger}
        <div className="max-w-[46rem] pl-4">
          {speakerRow}
          <div className="mt-1.5">
            <p className="text-[0.9375rem] leading-relaxed text-ink-soft italic">{item.text}</p>
            {item.note && (
              <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-muted italic">
                {item.note}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      {trigger}

      <div className="flex items-start gap-3">
        <SpeakerAvatar speaker={item.speaker} name={item.speakerName} />

        <div className="min-w-0 flex-1">
          {speakerRow}

          <div
            className={cx(
              // 꼬리는 왼쪽 위 모서리 하나만 접습니다. 보더도 그림자도 없이 면으로만 세웁니다(§5).
              "mt-1.5 max-w-[46rem] rounded-card rounded-tl-sm p-4 md:p-5",
              protocol ? "bg-danger-soft" : "bg-white",
            )}
          >
            {body}
          </div>
        </div>
      </div>
    </div>
  );
}

function LearnerBubble({ item }: { item: Extract<LogItem, { kind: "learner" }> }) {
  return (
    <div className="animate-fade-up flex justify-end">
      <div className="min-w-0 max-w-[42rem]">
        <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
          <span className="chim-label font-extrabold text-ink">내 응답</span>
          <span className="chim-caption font-semibold text-ink-muted">
            {item.viaButton ? "버튼 선택" : "말하기·직접 입력"}
          </span>
        </div>

        {/* 학습자 발화는 꼬리가 오른쪽 위 — 인물 말풍선과 방향·면으로 구분됩니다. */}
        <div className="mt-1.5 rounded-card rounded-tr-sm bg-brand-50 p-4 md:p-5">
          <p className="chim-core font-semibold text-ink md:text-[1.25rem]">{item.text}</p>
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

/** 로그에서 가장 마지막 피드백 항목의 키 (없으면 빈 문자열) */
function latestFeedbackKey(items: LogItem[]): string {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    if (item && item.kind === "feedback") return item.key;
  }
  return "";
}

/**
 * 대화 로그.
 * AI 대사 · 학습자 발화 · 턴 피드백 · 기록 초안 · 전환 안내를 시간 순으로 쌓습니다.
 *
 * 응답을 보내신 직후에는 **방금 생긴 피드백 카드**를 화면 한가운데로 끌어옵니다.
 * (모바일에서 피드백과 새 대사가 화면 위쪽 밖에 남는 문제를 막기 위한 처리입니다.)
 * 그 밖의 경우에는 마지막 줄이 보이도록 로그 안쪽만 내립니다.
 */
export function DialogueLog({ items, className }: DialogueLogProps) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const feedbackRef = useRef<HTMLDivElement | null>(null);
  const shownFeedbackKeyRef = useRef<string>("");

  const feedbackKey = latestFeedbackKey(items);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;

    // 다시 하기로 로그가 비워지면 기억을 지웁니다 (키가 같은 값으로 되돌아와도 다시 옮겨 드리도록).
    if (feedbackKey.length === 0) shownFeedbackKeyRef.current = "";

    const target = feedbackRef.current;
    if (feedbackKey.length > 0 && target && shownFeedbackKeyRef.current !== feedbackKey) {
      shownFeedbackKeyRef.current = feedbackKey;
      // 새로 붙은 카드가 자리를 잡은 뒤에 옮겨야 위치가 어긋나지 않습니다.
      const frame = window.requestAnimationFrame(() => {
        target.scrollIntoView({ block: "center", behavior: scrollBehavior() });
      });
      return () => window.cancelAnimationFrame(frame);
    }

    box.scrollTop = box.scrollHeight;
    return undefined;
  }, [items, feedbackKey]);

  return (
    <div
      ref={boxRef}
      role="log"
      aria-live="polite"
      aria-label="대화 기록"
      className={cx(
        // 모바일에서는 뷰포트에 맞춰 낮춥니다 — 로그가 화면을 다 먹고 응답부가 밀리는 것을 막습니다.
        // 로그는 지면 위에 그대로 놓입니다. 상자를 두르면 말풍선 상자와 겹쳐 서식처럼 보입니다(§1-4).
        "max-h-[min(22rem,38vh)] space-y-5 overflow-y-auto p-1 md:max-h-[36rem]",
        className,
      )}
    >
      {items.map((item) => {
        switch (item.kind) {
          case "line":
            return <LineBubble key={item.key} item={item} />;
          case "learner":
            return <LearnerBubble key={item.key} item={item} />;
          case "feedback":
            return (
              <div key={item.key} ref={item.key === feedbackKey ? feedbackRef : undefined}>
                <FeedbackCard
                  ok={item.feedback.ok}
                  critical={item.feedback.criticalFail}
                  message={item.feedback.message}
                  docId={item.feedback.docId}
                  label={item.feedback.branchLabel}
                  // 「이 판정이 나온 이유」 — 판정 경로와 걸린 루브릭 항목을 접이식으로 밝힙니다.
                  trace={item.feedback.trace}
                  className="animate-fade-up"
                />
              </div>
            );
          case "draft":
            return (
              <RecordDraftPreview key={item.key} source={item.source} className="animate-fade-up" />
            );
          case "notice":
            // 전환 안내는 액센트 바 없이 아주 옅은 면 하나로만 둡니다(§1-2).
            return (
              <div
                key={item.key}
                className={cx(
                  "animate-fade-up rounded-card px-4 py-3",
                  item.tone === "danger" ? "bg-danger-soft" : "bg-brand-50",
                )}
              >
                <p
                  className={cx(
                    "chim-body font-bold",
                    item.tone === "danger" ? "text-danger-ink" : "text-brand-800",
                  )}
                >
                  {item.text}
                </p>
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

export default DialogueLog;
