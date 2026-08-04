"use client";

import { useEffect, useRef } from "react";
import { AiBadge, FeedbackCard } from "@/components";
import { cx } from "@/components/utils";
import type { LogItem } from "./sessionMachine";
import { RecordDraftPreview } from "./RecordDraftPreview";

export interface DialogueLogProps {
  items: LogItem[];
  className?: string;
}

/** 화자별 표시 규칙 — 등장인물 대사에는 항상 AI 배지와 가상 인물 고지가 붙습니다. */
function isCharacter(speaker: Extract<LogItem, { kind: "line" }>["speaker"]): boolean {
  return speaker === "elder" || speaker === "guardian" || speaker === "dispatcher";
}

function LineBubble({ item }: { item: Extract<LogItem, { kind: "line" }> }) {
  const character = isCharacter(item.speaker);
  const protocol = item.speaker === "protocol";

  return (
    <div className="animate-fade-up">
      {item.triggerName && (
        <p className="mb-2 flex items-center gap-2 text-sm font-extrabold text-warn-ink">
          <span aria-hidden="true">⚡</span>
          돌발 변수 · {item.triggerName}
        </p>
      )}

      <div
        className={cx(
          "max-w-[46rem] rounded-card border p-4 shadow-soft md:p-5",
          character && "border-line bg-white",
          !character && !protocol && "border-line bg-paper-2",
          protocol && "border-danger-line bg-danger-soft",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-extrabold text-ink">{item.speakerName}</span>
          {character ? (
            <AiBadge />
          ) : (
            <span
              className={cx(
                "rounded-chip border px-2.5 py-0.5 text-sm font-semibold",
                protocol
                  ? "border-danger-line bg-white text-danger-ink"
                  : "border-line bg-white text-ink-muted",
              )}
            >
              {protocol ? "검수된 고정 안내 · AI 생성 아님" : "상황 안내"}
            </span>
          )}
        </div>

        <p className="mt-2.5 text-lg leading-relaxed font-semibold text-ink">{item.text}</p>

        {item.note && (
          <p className="mt-2 text-base leading-relaxed text-ink-muted italic">{item.note}</p>
        )}
      </div>
    </div>
  );
}

function LearnerBubble({ item }: { item: Extract<LogItem, { kind: "learner" }> }) {
  return (
    <div className="animate-fade-up flex justify-end">
      <div className="max-w-[42rem] rounded-card border border-brand-300 bg-brand-100 p-4 shadow-soft md:p-5">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="text-sm font-bold text-brand-800">내 응답</span>
          <span className="rounded-chip border border-brand-200 bg-white px-2 py-0.5 text-sm font-semibold text-brand-800">
            {item.viaButton ? "버튼 선택" : "말하기·직접 입력"}
          </span>
        </div>
        <p className="mt-2 text-lg leading-relaxed font-semibold text-brand-900">{item.text}</p>
      </div>
    </div>
  );
}

/**
 * 대화 로그.
 * AI 대사 · 학습자 발화 · 턴 피드백 · 기록 초안 · 전환 안내를 시간 순으로 쌓습니다.
 * 새 항목이 들어오면 마지막 줄이 보이도록 스크롤합니다.
 */
export function DialogueLog({ items, className }: DialogueLogProps) {
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    box.scrollTop = box.scrollHeight;
  }, [items]);

  return (
    <div
      ref={boxRef}
      role="log"
      aria-live="polite"
      aria-label="대화 기록"
      className={cx(
        "max-h-[30rem] space-y-4 overflow-y-auto rounded-card border border-line bg-paper p-4 md:max-h-[36rem] md:p-5",
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
              <FeedbackCard
                key={item.key}
                ok={item.feedback.ok}
                critical={item.feedback.criticalFail}
                message={item.feedback.message}
                docId={item.feedback.docId}
                label={item.feedback.branchLabel}
                className="animate-fade-up"
              />
            );
          case "draft":
            return <RecordDraftPreview key={item.key} source={item.source} className="animate-fade-up" />;
          case "notice":
            return (
              <p
                key={item.key}
                className={cx(
                  "animate-fade-up rounded-card border px-4 py-3 text-base leading-relaxed font-bold",
                  item.tone === "danger"
                    ? "border-danger-line bg-danger-soft text-danger-ink"
                    : "border-brand-200 bg-brand-50 text-brand-800",
                )}
              >
                {item.text}
              </p>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

export default DialogueLog;
