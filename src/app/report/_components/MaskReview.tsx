"use client";

import { useMemo } from "react";
import type { Ref } from "react";
import type { MaskSpan } from "@/types";
import { BigButton, ChevronGlyph, EyebrowLabel } from "@/components";
import {
  MASK_KIND_LABELS,
  MASK_KIND_REASONS,
  MASK_TOKENS,
  countByKind,
  maskSpansOnOriginal,
  maskText,
  splitMasked,
  type MaskKind,
} from "@/engine/masking";
import { extractDraft } from "@/engine/record";
import { DraftRows } from "./DraftRows";
import { PrivacyPath } from "./PrivacyPath";
import { StickyCtaBar, usePassedBlock } from "./StickyCtaBar";

export interface MaskReviewProps {
  /** 1단계에서 입력한 원문 */
  text: string;
  onBack: () => void;
  onNext: () => void;
  /** 이 단계의 제목에 붙는 ref — 단계가 바뀔 때 위저드가 여기로 초점을 옮깁니다. */
  headingRef?: Ref<HTMLHeadingElement>;
}

const KIND_ORDER: MaskKind[] = ["성명", "번호", "기관명", "주소", "생년"];

/**
 * 범례 왼쪽 — 「무엇이」 가려졌는지. 오른쪽(치환 결과)은 엔진의 `MASK_TOKENS`에서 그대로 가져옵니다.
 * 규칙이 바뀌면 범례도 따라 바뀌도록 손으로 적어 두지 않았습니다.
 */
const KIND_SOURCE: Record<MaskKind, string> = {
  성명: "성명",
  번호: "연락처·6자리 이상 숫자",
  기관명: "기관명",
  주소: "주소",
  생년: "생년월일",
};

/** 화면에 보이는 치환어 — 저장 문자열은 대괄호를 그대로 두고, 여기서만 벗깁니다. */
function tokenWord(kind: MaskKind): string {
  return MASK_TOKENS[kind].replace(/[[\]]/g, "");
}

interface OriginalPart {
  text: string;
  kind?: MaskKind;
}

/** 원문을 가림 구간 기준으로 쪼갭니다(원문 대조용). */
function splitOriginal(text: string, spans: MaskSpan[]): OriginalPart[] {
  const parts: OriginalPart[] = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.start > cursor) parts.push({ text: text.slice(cursor, span.start) });
    parts.push({ text: text.slice(span.start, span.end), kind: span.kind });
    cursor = span.end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts;
}

/**
 * 2단계 「가리기」 화면 — 시안 6e.
 *
 * 무엇이 왜 가려졌는지를 **인라인으로** 보여 줍니다: 기기 밖으로 나갈 글을 그대로 한 문단 띄우고,
 * 가려진 자리에는 brand-tint 칩(대상자·기관·번호…)을 앉힌 뒤 아래 한 줄 범례로 규칙을 밝힙니다.
 * 원문 대조와 종류별 사유는 접힘 행 안에 그대로 남겨 두었습니다 — 기능은 한 곳도 줄이지 않았습니다.
 */
export function MaskReview({ text, onBack, onNext, headingRef }: MaskReviewProps) {
  const result = useMemo(() => maskText(text), [text]);
  const originalSpans = useMemo(() => maskSpansOnOriginal(text), [text]);
  const parts = useMemo(() => splitOriginal(text, originalSpans), [text, originalSpans]);
  const maskedParts = useMemo(() => splitMasked(result), [result]);
  const counts = useMemo(() => countByKind(result.spans), [result]);
  /** 다음 화면에서 만들 초안을 미리 보여 줍니다 — 같은 결정론 함수라 결과가 어긋나지 않습니다. */
  const preview = useMemo(() => extractDraft(result.masked), [result.masked]);
  const foundKinds = KIND_ORDER.filter((kind) => (counts[kind] ?? 0) > 0);
  const total = result.spans.length;
  /** 가림 결과(문단 + 범례)를 지나셨는지 — 그전까지 도킹한 CTA는 보조 색으로 물러섭니다. */
  const { markerRef, passed } = usePassedBlock();

  return (
    <div>
      {/* 이 화면의 주인공 — 기기 밖으로 나갈 글 한 문단 */}
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-[0.7813rem] leading-[1.45] font-bold tracking-normal text-ink-muted"
      >
        {total > 0
          ? "이렇게 가렸어요 — 기기 밖으로 나가는 건 이 글뿐입니다"
          : "가릴 항목을 찾지 못했어요 — 기기 밖으로 나가는 건 이 글뿐입니다"}
      </h2>

      <div className="mt-[8px] mb-[10px] rounded-[14px] bg-paper-2 px-4 py-[15px] text-[1rem] leading-[1.85] text-ink">
        {maskedParts.map((part, index) =>
          part.masked && part.kind ? (
            <strong
              key={index}
              className="mx-[1px] rounded-[6px] bg-brand-tint px-[7px] py-[1px] font-bold text-brand-on-tint"
            >
              {part.text.replace(/[[\]]/g, "")}
              <span className="sr-only"> ({MASK_KIND_LABELS[part.kind]} 가림)</span>
            </strong>
          ) : (
            <span key={index}>{part.text}</span>
          ),
        )}
      </div>

      {foundKinds.length > 0 ? (
        <p className="mb-4 text-[0.7813rem] leading-[1.6] text-ink-muted">
          {foundKinds.map((kind, index) => (
            <span key={kind}>
              {index > 0 && " · "}
              {KIND_SOURCE[kind]} → <b className="font-bold text-ink-soft">{tokenWord(kind)}</b>
            </span>
          ))}
        </p>
      ) : (
        <p className="mb-4 text-[0.7813rem] leading-[1.6] text-ink-muted">
          이름·연락처·기관명·주소·생년이 들어 있다면 「다시 말하기」로 돌아가 확인해 주세요.
        </p>
      )}

      {/* 가림 결과가 끝나는 자리. 여기까지 눈이 닿으면 아래 도킹 CTA가 주 색이 됩니다. */}
      <div ref={markerRef} aria-hidden className="h-px" />

      {/* 다섯 칸 초안 미리보기 — 고치는 것은 다음 화면입니다. */}
      <EyebrowLabel>기록 초안 — 다섯 칸</EyebrowLabel>
      <DraftRows draft={preview} className="mt-[2px]" />
      <p className="mt-[10px] text-[0.7813rem] leading-[1.6] text-ink-soft">
        아직 저장되지 않았습니다. 다음 화면에서 고치고 확정하실 때 한 번 더 검사한 뒤에 이 기기에만
        남깁니다.
      </p>

      {/* 원문 대조 · 종류별 사유 — 시안에는 없지만 기능은 그대로 두고 접어 둡니다. */}
      {total > 0 && (
        <details className="group mt-4 border-y border-line">
          <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 rounded-field px-[2px] text-[0.9375rem] leading-[1.45] font-semibold text-ink transition-colors duration-150 active:bg-paper-2 [&::-webkit-details-marker]:hidden">
            <span>
              말씀하신 원문과 나란히 보기 — <span className="chim-num">{total}</span>곳
            </span>
            {/* 동봉 Pretendard cmap에 U+2304 `⌄`가 없어 OS 심볼 폰트로 떨어지던 자리입니다.
                글리프는 상하대칭이라 group-open의 rotate-180이 광학 중심에서 돕니다. */}
            <ChevronGlyph className="text-faint group-open:rotate-180" />
          </summary>

          <div className="pb-4">
            <EyebrowLabel>말씀하신 원문 · 이 기기 안에만 있습니다</EyebrowLabel>
            <p className="mt-[8px] rounded-[14px] bg-paper-2 px-4 py-[14px] text-[1rem] leading-[1.85] text-ink">
              {parts.map((part, index) =>
                part.kind ? (
                  <mark
                    key={index}
                    className="mx-[2px] inline-flex flex-wrap items-baseline gap-[4px] rounded-[6px] bg-brand-tint px-[6px] py-[1px] align-baseline text-brand-on-tint"
                  >
                    <span className="line-through decoration-1">{part.text}</span>
                    <span className="text-[0.8em] font-bold whitespace-nowrap">
                      → {tokenWord(part.kind)}
                    </span>
                  </mark>
                ) : (
                  <span key={index}>{part.text}</span>
                ),
              )}
            </p>

            <ul className="chim-hairline mt-[10px] border-t border-line">
              {foundKinds.map((kind) => (
                <li
                  key={kind}
                  className="flex flex-wrap items-baseline gap-x-[10px] gap-y-[2px] py-[10px]"
                >
                  <span className="flex-none text-[0.7813rem] leading-[1.45] font-bold text-ink">
                    {MASK_KIND_LABELS[kind]} <span className="chim-num">{counts[kind]}</span>곳
                  </span>
                  <span className="min-w-[11rem] flex-1 text-[0.7813rem] leading-[1.6] text-ink-soft">
                    {MASK_KIND_REASONS[kind]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}

      {/* 전진 CTA는 화면 아래에 도킹합니다 — 가림 결과를 다 읽기 전에는 보조 색으로 물러서 있되
          누르는 것을 막지는 않습니다. 바 아래에 남는 `PrivacyPath`가 sticky가 움직일 자리입니다. */}
      <StickyCtaBar>
        <BigButton size="lg" block variant={passed ? "primary" : "secondary"} onClick={onNext}>
          확인으로 넘어가기
        </BigButton>
        <BigButton variant="ghost" block className="mt-1" onClick={onBack}>
          다시 말하기
        </BigButton>
      </StickyCtaBar>

      <PrivacyPath reached={3} className="mt-6" />
    </div>
  );
}

export default MaskReview;
