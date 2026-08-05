"use client";

import { useMemo } from "react";
import type { MaskSpan } from "@/types";
import { BigButton, cx } from "@/components";
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

/**
 * 종류별 하이라이트 — 아이콘 없이 옅은 면과 텍스트 라벨을 함께 씁니다.
 * 채움 위에 다시 선을 두르면 서식처럼 보이므로 보더는 두지 않습니다.
 */
const KIND_STYLE: Record<MaskKind, string> = {
  성명: "bg-tint text-brand-900",
  번호: "bg-warn-soft text-warn-ink",
  기관명: "bg-mint-200 text-brand-900",
  주소: "bg-danger-soft text-danger-ink",
  생년: "bg-neutral-line text-ink",
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
 * 2단계 가명처리 확인 화면 (v4 언어).
 *
 * 원문 위에 무엇을 가렸는지 색으로 표시하고, 기기 밖으로 나가는 텍스트를 나란히 보여 줍니다.
 * **가명처리 시각화는 한 곳도 줄이지 않았습니다** — 면과 글자 크기만 시안 문법으로 바꿨습니다.
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
    <div>
      <h2 className="text-[17px] leading-[1.45] font-bold text-ink">
        무엇을 가렸는지 먼저 확인해 주세요
      </h2>
      <p className="mt-[6px] text-[12.5px] leading-[1.7] text-ink-muted">
        {total > 0
          ? `말씀하신 내용에서 ${total}곳을 가렸습니다. 색이 칠해진 부분이 가려지는 곳이고, 옆에 적힌 것이 대신 들어갈 표기입니다.`
          : "가릴 항목을 찾지 못했습니다. 이름·연락처·기관명·주소·생년이 들어 있다면 앞 단계로 돌아가 다시 확인해 주세요."}
      </p>

      {/* 원문 — 이 화면 안에만 있고 저장되지 않습니다. */}
      <div className="mt-4 rounded-[14px] bg-paper-2 px-4 py-[14px]">
        <p className="text-[12px] leading-[1.5] font-bold tracking-[0.06em] text-ink-muted">
          말씀하신 원문 · 이 기기 안에만 있습니다
        </p>
        <p className="mt-[8px] text-[14.5px] leading-[1.9] text-ink">
          {parts.map((part, index) =>
            part.kind ? (
              <mark
                key={index}
                className={cx(
                  "mx-[2px] inline-flex flex-wrap items-baseline gap-1 rounded-[8px] px-[6px] py-[1px] align-baseline",
                  KIND_STYLE[part.kind],
                )}
              >
                <span className="line-through decoration-2">{part.text}</span>
                <span className="text-[0.8em] font-extrabold whitespace-nowrap">
                  {MASK_KIND_LABELS[part.kind]} → {part.replaced}
                </span>
              </mark>
            ) : (
              <span key={index}>{part.text}</span>
            ),
          )}
        </p>
      </div>

      {/* 종류별 이유 — 상자 대신 hairline 행으로 나눕니다. */}
      {foundKinds.length > 0 && (
        <ul className="chim-hairline mt-4 border-t border-line">
          {foundKinds.map((kind) => (
            <li key={kind} className="flex flex-wrap items-baseline gap-x-[10px] gap-y-1 py-[10px]">
              <span
                className={cx(
                  "shrink-0 rounded-[8px] px-[8px] py-[2px] text-[12px] font-extrabold",
                  KIND_STYLE[kind],
                )}
              >
                {MASK_KIND_LABELS[kind]} {counts[kind]}곳
              </span>
              <span className="min-w-[11rem] flex-1 text-[12.5px] leading-[1.6] text-ink-soft">
                {MASK_KIND_REASONS[kind]}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5">
        <h3 className="text-[15px] leading-[1.45] font-bold text-ink">
          기기 밖으로 나가는 텍스트는 여기까지입니다
        </h3>
        <p className="mt-[8px] rounded-[14px] bg-paper-2 px-4 py-[14px] text-[14.5px] leading-[1.9] text-ink">
          {maskedParts.map((part, index) =>
            part.masked ? (
              <strong
                key={index}
                className="mx-[2px] rounded-[6px] bg-tint px-[5px] py-[1px] font-extrabold text-brand-900"
              >
                {part.text}
              </strong>
            ) : (
              <span key={index}>{part.text}</span>
            ),
          )}
        </p>
        <p className="mt-[8px] text-[12.5px] leading-[1.7] text-ink-soft">
          이 문장은 아직 저장되지 않았습니다. 다음 화면에서 초안을 확인하고 확정하실 때 한 번 더
          검사한 뒤에 저장합니다.
        </p>
      </div>

      <PrivacyPath reached={3} className="mt-6" />

      <BigButton size="lg" block className="mt-5" onClick={onNext}>
        기록 초안 만들기
      </BigButton>
      <BigButton variant="secondary" block className="mt-2" onClick={onBack}>
        앞으로 돌아가 고치기
      </BigButton>
    </div>
  );
}

export default MaskReview;
