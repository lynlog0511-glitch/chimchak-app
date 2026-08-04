"use client";

import { useMemo } from "react";
import type { MaskSpan } from "@/types";
import {
  extractDraft,
  MASK_KIND_REASONS,
  maskText,
  RECORD_SLOT_HINTS,
  RECORD_SLOT_LABELS,
  splitMasked,
  type RecordSlot,
} from "@/engine";
import { IconNote } from "@/components/icons";
import { cx } from "@/components/utils";

const SLOT_ORDER: RecordSlot[] = ["time", "who", "what", "action", "status"];

export interface RecordDraftPreviewProps {
  /** 학습자 발화 원문 — 화면 안에서만 쓰고 저장하지 않습니다 */
  source: string;
  /** 입력 중 미리보기(연한 톤) / 제출 후 기록(진한 톤) */
  variant?: "live" | "logged";
  className?: string;
}

/**
 * 보고·기록 CUE 전용 미니 기록 초안.
 *
 * 발화를 먼저 가명처리(`maskText`)한 뒤, 가명처리된 문장에서 급여제공기록지 5요소를
 * 뽑아(`extractDraft`) 보여 줍니다. 저장되는 것은 가명처리된 텍스트뿐이며,
 * 이 화면에서는 어떤 것도 기기 밖으로 나가지 않습니다.
 */
export function RecordDraftPreview({
  source,
  variant = "logged",
  className,
}: RecordDraftPreviewProps) {
  const { masked, spans, parts, draft } = useMemo(() => {
    const result = maskText(source);
    return {
      masked: result.masked,
      spans: result.spans,
      parts: splitMasked(result),
      draft: extractDraft(result.masked),
    };
  }, [source]);

  const kinds = useMemo(() => {
    const seen: MaskSpan["kind"][] = [];
    for (const span of spans) {
      if (!seen.includes(span.kind)) seen.push(span.kind);
    }
    return seen;
  }, [spans]);

  if (masked.trim().length === 0) return null;

  return (
    <div
      className={cx(
        "rounded-card border p-4 md:p-5",
        variant === "live" ? "border-line bg-paper-2" : "border-brand-200 bg-white",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <IconNote className="h-5 w-5 shrink-0 text-brand-700" />
        <h4 className="text-base font-extrabold text-ink">기록 초안 미리보기</h4>
        <span className="border-l border-line pl-2.5 text-sm font-semibold text-ink-muted">
          급여제공기록지 5요소
        </span>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        말씀하신 내용에서 개인을 특정할 수 있는 부분을 먼저 가린 뒤 초안을 만들었습니다.
      </p>

      <p className="mt-3 rounded-field border border-line bg-white p-3 text-base leading-relaxed text-ink">
        {parts.map((part, index) =>
          part.masked ? (
            <mark
              key={index}
              className="rounded-chip bg-warn-soft px-1.5 py-0.5 font-bold text-warn-ink"
              title={part.kind ? MASK_KIND_REASONS[part.kind] : undefined}
            >
              {part.text}
            </mark>
          ) : (
            <span key={index}>{part.text}</span>
          ),
        )}
      </p>

      {kinds.length > 0 && (
        <ul className="mt-2.5 space-y-1 text-sm leading-relaxed text-ink-soft">
          {kinds.map((kind) => (
            <li key={kind} className="flex gap-2">
              <span className="shrink-0 font-bold text-warn-ink">{kind}</span>
              <span>{MASK_KIND_REASONS[kind]}</span>
            </li>
          ))}
        </ul>
      )}

      <dl className="mt-4 grid gap-2 sm:grid-cols-2">
        {SLOT_ORDER.map((slot) => {
          const value = draft[slot].trim();
          const filled = value.length > 0;
          return (
            <div
              key={slot}
              className={cx(
                "rounded-field border p-3",
                filled ? "border-line bg-white" : "border-dashed border-warn-line bg-warn-soft",
              )}
            >
              <dt className="text-sm font-bold text-ink-muted">{RECORD_SLOT_LABELS[slot]}</dt>
              <dd
                className={cx(
                  "mt-0.5 text-base leading-relaxed",
                  filled ? "text-ink" : "font-semibold text-warn-ink",
                )}
              >
                {filled ? value : RECORD_SLOT_HINTS[slot]}
              </dd>
            </div>
          );
        })}
      </dl>

      {draft.missing.length > 0 && (
        <p className="mt-3 text-sm leading-relaxed font-semibold text-warn-ink">
          비어 있는 항목: {draft.missing.join(" · ")} — 한 문장만 덧붙이시면 기록지에 그대로 옮길 수
          있습니다.
        </p>
      )}
    </div>
  );
}

export default RecordDraftPreview;
