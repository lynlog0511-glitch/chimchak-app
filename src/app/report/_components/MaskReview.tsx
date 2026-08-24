"use client";

import { useMemo, useState } from "react";
import type { Ref } from "react";
import type { MaskResult, MaskSpan } from "@/types";
import { BigButton, ChevronGlyph, EyebrowLabel, cx } from "@/components";
import {
  MASK_KIND_LABELS,
  MASK_KIND_REASONS,
  MASK_TOKENS,
  countByKind,
  maskSpansOnOriginal,
  maskText,
  type MaskKind,
} from "@/engine/masking";
import { extractDraft } from "@/engine/record";
import { DraftRows } from "./DraftRows";
import { PrivacyPath } from "./PrivacyPath";
import { StickyCtaBar, usePassedBlock } from "./StickyCtaBar";

/** 손으로 가린 자리 — 좌표는 **원문 기준**입니다(엔진의 masked 좌표와 섞지 않습니다). */
export interface ManualMaskSpan {
  start: number;
  end: number;
  kind: MaskKind;
}

export interface MaskReviewProps {
  /** 1단계에서 입력한 원문 */
  text: string;
  /** 사용자가 직접 가린 자리 — 저장 경로도 같은 값을 씁니다 */
  manual: ManualMaskSpan[];
  onManualChange: (next: ManualMaskSpan[]) => void;
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

/* ── 자동 결과 + 손으로 가린 자리 ─────────────────────────────
   엔진(`masking.ts`)은 건드리지 않습니다. 자동 규칙이 내놓은 원문 좌표 위에 수동 자리를 얹고,
   겹치는 자동 자리는 수동 쪽에 양보시킨 뒤 같은 방식으로 치환 문자열을 만듭니다.
   수동 자리가 하나도 없으면 `maskText()` 결과와 글자 하나까지 같습니다. */

interface MergedSpan {
  start: number;
  end: number;
  kind: MaskKind;
  /** 손으로 가린 자리면 `manual` 배열에서의 위치 */
  manualIndex?: number;
}

function mergeSpans(text: string, manual: ManualMaskSpan[]): MergedSpan[] {
  const picked: MergedSpan[] = manual.map((span, manualIndex) => ({ ...span, manualIndex }));
  for (const span of maskSpansOnOriginal(text)) {
    const clash = picked.some((p) => span.start < p.end && p.start < span.end);
    if (!clash) picked.push({ start: span.start, end: span.end, kind: span.kind });
  }
  return picked.sort((a, b) => a.start - b.start);
}

/**
 * 자동 가림에 수동 가림을 더한 최종 결과. 저장 경로(`ReportWizard`)도 이 함수를 씁니다 —
 * 화면에 보이는 글과 기기에 남는 글이 갈라지지 않게 하는 유일한 방법입니다.
 *
 * @example applyManualMask("영자씨가 나가셨어요", [{ start: 0, end: 3, kind: "성명" }]).masked
 * // "[대상자]가 나가셨어요"
 */
export function applyManualMask(text: string, manual: ManualMaskSpan[]): MaskResult {
  if (!text) return { masked: "", spans: [] };
  if (manual.length === 0) return maskText(text);

  let masked = "";
  let cursor = 0;
  const spans: MaskSpan[] = [];
  for (const span of mergeSpans(text, manual)) {
    if (span.start < cursor) continue;
    masked += text.slice(cursor, span.start);
    const start = masked.length;
    const replaced = MASK_TOKENS[span.kind];
    masked += replaced;
    spans.push({ start, end: masked.length, kind: span.kind, replaced });
    cursor = span.end;
  }
  masked += text.slice(cursor);
  return { masked, spans };
}

/* ── 화면 조각 ────────────────────────────────────────────────
   가림 결과 문단은 **원문 좌표**로 그립니다. 가린 자리는 칩으로 바뀌고 나머지는 원문 그대로라,
   보이는 글자는 저장될 문자열과 같으면서도 낱말마다 원문 어디인지를 알 수 있습니다. */

type DisplayPart =
  | { type: "text"; text: string }
  | { type: "word"; text: string; start: number; end: number }
  | { type: "chip"; text: string; kind: MaskKind; manualIndex?: number };

/** 낱말 앞뒤 문장부호는 가림에서 뺍니다 — 「어르신이,」에서 쉼표까지 가리면 문장이 무너집니다. */
const LEADING_PUNCT = /^[("'\[{]+/;
const TRAILING_PUNCT = /[.,!?…"')\]}·:;]+$/;

function splitWords(text: string, from: number, to: number): DisplayPart[] {
  const parts: DisplayPart[] = [];
  const slice = text.slice(from, to);
  const re = /\s+|\S+/g;
  let m = re.exec(slice);
  while (m !== null) {
    const raw = m[0];
    const at = from + m.index;
    if (/^\s/.test(raw)) {
      parts.push({ type: "text", text: raw });
    } else {
      const head = LEADING_PUNCT.exec(raw)?.[0] ?? "";
      const rest = raw.slice(head.length);
      const tail = TRAILING_PUNCT.exec(rest)?.[0] ?? "";
      const body = rest.slice(0, rest.length - tail.length);
      if (head.length > 0) parts.push({ type: "text", text: head });
      if (body.length === 0) {
        if (rest.length > 0) parts.push({ type: "text", text: rest });
      } else {
        const start = at + head.length;
        parts.push({ type: "word", text: body, start, end: start + body.length });
        if (tail.length > 0) parts.push({ type: "text", text: tail });
      }
    }
    m = re.exec(slice);
  }
  return parts;
}

function buildDisplay(text: string, spans: MergedSpan[]): DisplayPart[] {
  const parts: DisplayPart[] = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.start < cursor) continue;
    if (span.start > cursor) parts.push(...splitWords(text, cursor, span.start));
    parts.push({
      type: "chip",
      text: tokenWord(span.kind),
      kind: span.kind,
      manualIndex: span.manualIndex,
    });
    cursor = span.end;
  }
  if (cursor < text.length) parts.push(...splitWords(text, cursor, text.length));
  return parts;
}

interface OriginalPart {
  text: string;
  kind?: MaskKind;
}

/** 원문을 가림 구간 기준으로 쪼갭니다(원문 대조용). */
function splitOriginal(text: string, spans: MergedSpan[]): OriginalPart[] {
  const parts: OriginalPart[] = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.start < cursor) continue;
    if (span.start > cursor) parts.push({ text: text.slice(cursor, span.start) });
    parts.push({ text: text.slice(span.start, span.end), kind: span.kind });
    cursor = span.end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts;
}

const CHIP_CLASS =
  "mx-[1px] rounded-[6px] bg-brand-tint px-[7px] py-[1px] font-bold text-brand-on-tint";

/**
 * 2단계 「가리기」 화면 — 시안 6e.
 *
 * 무엇이 왜 가려졌는지를 **인라인으로** 보여 줍니다: 기기 밖으로 나갈 글을 그대로 한 문단 띄우고,
 * 가려진 자리에는 brand-tint 칩(대상자·기관·번호…)을 앉힌 뒤 아래 한 줄 범례로 규칙을 밝힙니다.
 * 원문 대조와 종류별 사유는 접힘 행 안에 그대로 남겨 두었습니다 — 기능은 한 곳도 줄이지 않았습니다.
 *
 * 자동 규칙은 사전에 없는 이름을 놓칩니다. 그때 화면이 할 수 있는 말이 「돌아가서 고쳐 오세요」뿐이면
 * 가려지지 않은 이름이 그대로 저장됩니다. 그래서 **낱말을 눌러 직접 가리는 길**을 함께 둡니다 —
 * 엔진은 그대로 두고, 손으로 고른 자리를 자동 결과 위에 얹기만 합니다.
 */
export function MaskReview({
  text,
  manual,
  onManualChange,
  onBack,
  onNext,
  headingRef,
}: MaskReviewProps) {
  /** 낱말을 눌러 가리는 모드. 평소에는 읽는 문단이고, 켜야만 낱말이 버튼이 됩니다. */
  const [picking, setPicking] = useState(false);
  /** 종류를 고치는 중인 수동 자리 */
  const [editing, setEditing] = useState<number | null>(null);

  const merged = useMemo(() => mergeSpans(text, manual), [text, manual]);
  const result = useMemo(() => applyManualMask(text, manual), [text, manual]);
  const display = useMemo(() => buildDisplay(text, merged), [text, merged]);
  const parts = useMemo(() => splitOriginal(text, merged), [text, merged]);
  const counts = useMemo(() => countByKind(result.spans), [result]);
  /** 다음 화면에서 만들 초안을 미리 보여 줍니다 — 같은 결정론 함수라 결과가 어긋나지 않습니다. */
  const preview = useMemo(() => extractDraft(result.masked), [result.masked]);
  const foundKinds = KIND_ORDER.filter((kind) => (counts[kind] ?? 0) > 0);
  const total = merged.length;
  /** 가림 결과(문단 + 범례)를 지나셨는지 — 그전까지 도킹한 CTA는 보조 색으로 물러섭니다. */
  const { markerRef, passed } = usePassedBlock();

  const editingSpan = editing !== null ? manual[editing] : undefined;

  /** 누른 낱말을 가립니다. 기본은 이름([대상자])이고, 종류는 칩을 한 번 더 눌러 바꿉니다. */
  const maskWord = (start: number, end: number): void => {
    onManualChange([...manual, { start, end, kind: "성명" }]);
    setEditing(manual.length);
  };

  const changeKind = (index: number, kind: MaskKind): void => {
    onManualChange(manual.map((span, i) => (i === index ? { ...span, kind } : span)));
  };

  const undoManual = (index: number): void => {
    onManualChange(manual.filter((_, i) => i !== index));
    setEditing(null);
  };

  return (
    <div>
      {/* 이 화면의 주인공 — 기기 밖으로 나갈 글 한 문단 */}
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-[0.7813rem] leading-[1.45] font-bold tracking-normal text-ink-muted"
      >
        {total > 0
          ? "이렇게 가렸어요 — 확정 뒤에 남는 건 이 글뿐입니다"
          : "가릴 항목을 찾지 못했어요 — 확정 뒤에 남는 건 이 글뿐입니다"}
      </h2>

      <div className="mt-[8px] mb-[10px] rounded-[14px] bg-paper-2 px-4 py-[15px] text-[1rem] leading-[1.85] text-ink">
        {display.map((part, index) => {
          if (part.type === "text") return <span key={index}>{part.text}</span>;

          if (part.type === "chip") {
            const label = MASK_KIND_LABELS[part.kind];
            const manualIndex = part.manualIndex;
            if (picking && manualIndex !== undefined) {
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => setEditing(manualIndex)}
                  aria-label={`직접 가린 ${label} — 종류 바꾸기 또는 되돌리기`}
                  className={cx(CHIP_CLASS, "align-baseline underline underline-offset-[5px]")}
                >
                  {part.text}
                </button>
              );
            }
            return (
              <strong key={index} className={CHIP_CLASS}>
                {part.text}
                <span className="sr-only">
                  {" "}
                  ({label} 가림{manualIndex !== undefined ? " · 직접 가림" : ""})
                </span>
              </strong>
            );
          }

          if (!picking) return <span key={index}>{part.text}</span>;
          /* 누르는 자리는 낱말 하나라 48px 사각형이 될 수 없습니다. 대신 위아래 여백을 손가락 크기로
             넓히고(줄 높이는 그대로), 종류를 고르는 버튼들이 48px을 지킵니다. */
          return (
            <button
              key={index}
              type="button"
              onClick={() => maskWord(part.start, part.end)}
              aria-label={`${part.text} 가리기`}
              className="-mx-[3px] -my-[7px] rounded-[6px] px-[3px] py-[7px] align-baseline underline decoration-dotted underline-offset-[5px] active:bg-brand-tint"
            >
              {part.text}
            </button>
          );
        })}
      </div>

      {foundKinds.length > 0 ? (
        <p className="mb-[10px] text-[0.7813rem] leading-[1.6] text-ink-muted">
          {foundKinds.map((kind, index) => (
            <span key={kind}>
              {index > 0 && " · "}
              {KIND_SOURCE[kind]} → <b className="font-bold text-ink-soft">{tokenWord(kind)}</b>
            </span>
          ))}
        </p>
      ) : (
        <p className="mb-[10px] text-[0.7813rem] leading-[1.6] text-ink-muted">
          이름·연락처·기관명·주소·생년이 남아 있는지 한 번 봐 주세요.
        </p>
      )}

      {/* 수동 가리기 — 사전에 없는 이름을 놓쳤을 때 화면 안에서 끝내는 길입니다. */}
      <div className="mb-4">
        <button
          type="button"
          onClick={() => {
            setPicking((value) => !value);
            setEditing(null);
          }}
          aria-pressed={picking}
          className={cx(
            "flex min-h-[48px] items-center rounded-[14px] px-4 text-[0.8438rem] font-semibold transition-colors duration-150",
            picking
              ? "bg-brand-tint text-brand-on-tint"
              : "bg-paper-2 text-ink active:bg-neutral-line",
          )}
        >
          {picking ? "직접 가리기 마치기" : "직접 가리기"}
        </button>
        <p className="mt-[8px] text-[0.7813rem] leading-[1.6] text-ink-muted">
          {picking
            ? "자동으로 못 찾은 이름은 눌러서 직접 가려 주세요. 가린 자리를 한 번 더 누르면 종류를 바꾸거나 되돌릴 수 있습니다."
            : "자동으로 못 찾은 이름은 눌러서 직접 가려 주세요."}
        </p>
      </div>

      {/* 종류 고르기 — 누른 낱말이 이름이 아니었을 때 바꾸는 자리입니다. */}
      {editing !== null && editingSpan && (
        <div className="mb-4 rounded-[14px] bg-paper-2 px-4 py-[14px]">
          <p className="text-[0.8438rem] leading-[1.45] font-bold text-ink">
            「{text.slice(editingSpan.start, editingSpan.end)}」 가림 — 이름이 아니면 종류를 바꿔
            주세요
          </p>
          <div className="mt-[10px] flex flex-wrap gap-2">
            {KIND_ORDER.map((kind) => {
              const active = editingSpan.kind === kind;
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => changeKind(editing, kind)}
                  aria-pressed={active}
                  className={cx(
                    "flex min-h-[48px] items-center rounded-[14px] px-4 text-[0.8438rem] font-semibold transition-colors duration-150",
                    active
                      ? "bg-brand-tint text-brand-on-tint"
                      : "bg-white text-ink-soft active:bg-neutral-line",
                  )}
                >
                  {tokenWord(kind)}
                </button>
              );
            })}
          </div>
          <div className="mt-[6px] flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => undoManual(editing)}
              className="flex min-h-[48px] items-center rounded-field px-2 text-[0.8438rem] font-semibold text-ink-muted transition-colors duration-150 active:bg-white"
            >
              가리기 되돌리기
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="flex min-h-[48px] items-center rounded-field px-2 text-[0.8438rem] font-semibold text-ink-muted transition-colors duration-150 active:bg-white"
            >
              닫기
            </button>
          </div>
        </div>
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
