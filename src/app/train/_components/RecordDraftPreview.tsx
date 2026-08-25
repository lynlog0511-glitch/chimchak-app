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
import { cx } from "@/components/utils";

const SLOT_ORDER: RecordSlot[] = ["time", "who", "what", "action", "status"];

export interface RecordDraftPreviewProps {
  /** 학습자 발화 원문 — 화면 안에서만 쓰고 저장하지 않습니다 */
  source: string;
  /** 입력 중 미리보기(도크) / 제출 후 기록(대화 흐름) */
  variant?: "live" | "logged";
  className?: string;
}

/**
 * 보고·기록 CUE 전용 미니 기록 초안.
 *
 * 발화를 먼저 가명처리(`maskText`)한 뒤, 가명처리된 문장에서 급여제공기록지 5요소를
 * 뽑아(`extractDraft`) 보여 줍니다. 저장되는 것은 가명처리된 텍스트뿐이며,
 * 이 화면에서는 어떤 것도 기기 밖으로 나가지 않습니다.
 *
 * 표기는 대화 흐름을 끊지 않도록 면 하나(v4)로만 둡니다 — 보더도 그림자도 쓰지 않습니다.
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

  /* 도크(회색 면 위)에서는 흰 안쪽 면, 대화 흐름에서는 옅은 틸 면 위에 흰 안쪽 면을 씁니다. */
  const outer = variant === "live" ? "bg-paper-2" : "bg-tint";

  return (
    <div className={cx("rounded-card p-4", outer, className)}>
      <p className="text-[0.7813rem] leading-[1.45] font-bold tracking-[0.06em] text-ink-muted">
        기록 초안 미리보기 · 급여제공기록지 5요소
      </p>
      <p className="mt-1 text-[0.7813rem] leading-[1.6] text-ink-muted">
        말씀하신 내용에서 개인을 특정할 수 있는 부분을 먼저 가린 뒤 초안을 만들었습니다.
      </p>

      {/* 기록 초안 본문은 코어 콘텐츠입니다 — 17px 하한(§3). */}
      <p className="mt-2.5 rounded-card bg-white px-3.5 py-3 text-[1.0625rem] leading-[1.6] text-ink">
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
        <ul className="mt-2 space-y-1 text-[0.7813rem] leading-[1.6] text-ink-soft">
          {kinds.map((kind) => (
            <li key={kind} className="flex gap-2">
              <span className="shrink-0 font-bold text-warn-ink">{kind}</span>
              <span>{MASK_KIND_REASONS[kind]}</span>
            </li>
          ))}
        </ul>
      )}

      <dl className="mt-3 grid gap-1.5">
        {SLOT_ORDER.map((slot) => {
          const value = draft[slot].trim();
          const filled = value.length > 0;
          return (
            <div
              key={slot}
              className={cx(
                "flex gap-2 rounded-card px-3 py-2 text-[0.8438rem] leading-[1.6]",
                filled ? "bg-white" : "bg-warn-soft",
              )}
            >
              <dt className="w-[3.5rem] flex-none font-bold text-ink-muted">
                {RECORD_SLOT_LABELS[slot]}
              </dt>
              <dd className={cx("min-w-0 flex-1", filled ? "text-ink" : "font-semibold text-warn-ink")}>
                {filled ? value : RECORD_SLOT_HINTS[slot]}
              </dd>
            </div>
          );
        })}
      </dl>

      {draft.missing.length > 0 && (
        <p className="mt-2 text-[0.7813rem] leading-[1.6] font-semibold text-warn-ink">
          비어 있는 항목: {draft.missing.join(" · ")} — 한 문장만 덧붙이시면 기록지에 그대로 옮길 수
          있습니다.
        </p>
      )}
    </div>
  );
}

export default RecordDraftPreview;
