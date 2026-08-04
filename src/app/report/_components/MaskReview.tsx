"use client";

import { useMemo } from "react";
import type { MaskSpan } from "@/types";
import { BigButton, Card, cx } from "@/components";
import {
  MASK_KIND_LABELS,
  MASK_KIND_REASONS,
  countByKind,
  maskSpansOnOriginal,
  maskText,
  splitMasked,
  type MaskKind,
} from "@/engine/masking";
import { PrivacyPath } from "./PrivacyPath";

export interface MaskReviewProps {
  /** 1단계에서 입력한 원문 */
  text: string;
  onBack: () => void;
  onNext: () => void;
}

/** 종류별 하이라이트 색 — 아이콘 없이 색과 텍스트 라벨을 함께 씁니다. */
const KIND_STYLE: Record<MaskKind, string> = {
  성명: "border-brand-300 bg-brand-100 text-brand-900",
  번호: "border-warn-line bg-warn-soft text-warn-ink",
  기관명: "border-line-strong bg-mint-200 text-brand-900",
  주소: "border-danger-line bg-danger-soft text-danger-ink",
  생년: "border-neutral-line bg-neutral-soft text-ink",
};

const KIND_ORDER: MaskKind[] = ["성명", "번호", "기관명", "주소", "생년"];

interface OriginalPart {
  text: string;
  kind?: MaskKind;
  replaced?: string;
}

/** 원문을 가림 구간 기준으로 쪼갭니다(하이라이트 렌더링용). */
function splitOriginal(text: string, spans: MaskSpan[]): OriginalPart[] {
  const parts: OriginalPart[] = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.start > cursor) parts.push({ text: text.slice(cursor, span.start) });
    parts.push({ text: text.slice(span.start, span.end), kind: span.kind, replaced: span.replaced });
    cursor = span.end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts;
}

/**
 * 2단계 가명처리 확인 화면.
 * 원문 위에 무엇을 가렸는지 색으로 표시하고, 기기 밖으로 나가는 텍스트를 나란히 보여 줍니다.
 */
export function MaskReview({ text, onBack, onNext }: MaskReviewProps) {
  const originalSpans = useMemo(() => maskSpansOnOriginal(text), [text]);
  const result = useMemo(() => maskText(text), [text]);
  const parts = useMemo(() => splitOriginal(text, originalSpans), [text, originalSpans]);
  const maskedParts = useMemo(() => splitMasked(result), [result]);
  const counts = useMemo(() => countByKind(result.spans), [result]);
  const foundKinds = KIND_ORDER.filter((kind) => (counts[kind] ?? 0) > 0);
  const total = result.spans.length;

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold text-ink md:text-xl">
            2. 무엇을 가렸는지 먼저 확인해 주세요
          </h2>
          <span className="text-sm font-bold text-ink-muted">
            이 원문은 이 기기 안에만 있습니다
          </span>
        </div>

        <p className="mt-2 text-base leading-relaxed text-ink-soft">
          {total > 0
            ? `말씀하신 내용에서 ${total}곳을 가렸습니다. 색이 칠해진 부분이 가려지는 곳이고, 옆에 적힌 것이 대신 들어갈 표기입니다.`
            : "가릴 항목을 찾지 못했습니다. 이름·연락처·기관명·주소·생년이 들어 있다면 앞 단계로 돌아가 다시 확인해 주세요."}
        </p>

        <p className="mt-4 rounded-card border border-line bg-paper-2 p-4 text-base leading-loose text-ink">
          {parts.map((part, index) =>
            part.kind ? (
              <mark
                key={index}
                className={cx(
                  "mx-0.5 inline-flex flex-wrap items-baseline gap-1 rounded-chip border px-2 py-0.5 align-baseline",
                  KIND_STYLE[part.kind],
                )}
              >
                <span className="line-through decoration-2">{part.text}</span>
                <span className="text-[0.78em] font-extrabold whitespace-nowrap">
                  {MASK_KIND_LABELS[part.kind]} → {part.replaced}
                </span>
              </mark>
            ) : (
              <span key={index}>{part.text}</span>
            ),
          )}
        </p>

        {foundKinds.length > 0 && (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {foundKinds.map((kind) => (
              <li
                key={kind}
                className="flex items-start gap-2 rounded-field border border-line bg-white p-3"
              >
                <span
                  className={cx(
                    "shrink-0 rounded-chip border px-2.5 py-0.5 text-sm font-extrabold",
                    KIND_STYLE[kind],
                  )}
                >
                  {MASK_KIND_LABELS[kind]} {counts[kind]}곳
                </span>
                <span className="text-sm leading-relaxed text-ink-soft">
                  {MASK_KIND_REASONS[kind]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* 색 배경을 걷어냅니다 — 이 화면의 색 블록은 아래 경계 안내 하나로 충분합니다. */}
      <Card>
        <h3 className="text-base font-extrabold text-brand-900">
          기기 밖으로 나가는 텍스트는 여기까지입니다
        </h3>
        <p className="mt-3 rounded-card border border-line bg-paper-2 p-4 text-base leading-loose text-ink">
          {maskedParts.map((part, index) =>
            part.masked ? (
              <strong
                key={index}
                className="mx-0.5 rounded-chip border border-brand-300 bg-brand-100 px-2 py-0.5 font-extrabold text-brand-900"
              >
                {part.text}
              </strong>
            ) : (
              <span key={index}>{part.text}</span>
            ),
          )}
        </p>
        <p className="mt-3 text-base leading-relaxed text-ink">
          이 문장은 아직 저장되지 않았습니다. 다음 화면에서 초안을 확인하고 확정하실 때 한 번 더
          검사한 뒤에 저장합니다.
        </p>
      </Card>

      <PrivacyPath reached={3} />

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <BigButton variant="secondary" onClick={onBack}>
          앞으로 돌아가 고치기
        </BigButton>
        <BigButton size="lg" onClick={onNext}>
          기록 초안 만들기
        </BigButton>
      </div>
    </div>
  );
}

export default MaskReview;
