"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { SourceDoc } from "@/types";
import { useSourceDoc } from "./SourceDocsContext";
import { cx } from "./utils";

export interface SourceChipProps {
  /** 근거 문서 ID (예: "DOC-GUIDE-001") */
  docId: string;
  /**
   * 문서 제목 직접 지정.
   * 데이터가 아직 주입되지 않은 화면(랜딩 예시 등)에서 쓰며, 조회 결과보다 우선합니다.
   */
  title?: string;
  /** 제목과 함께 보여 줄 보충 설명 직접 지정 */
  note?: string;
  kind?: SourceDoc["kind"];
  className?: string;
  /** 팝오버 없이 라벨만 보여 주고 싶을 때 */
  interactive?: boolean;
}

/**
 * 근거 출처 칩.
 * 표시 우선순위: `title` prop → 컨텍스트의 문서 제목 → docId.
 * 어떤 경우에도 화면이 비지 않도록 안전하게 대체 표기합니다.
 *
 * 크기 체계(§3): 칩은 UI 크롬이라 14px입니다.
 * 접근성 코어 예외는 코어 콘텐츠(대사·CUE·응급 자막·CTA)에만 적용됩니다 — 칩은 해당하지 않습니다.
 * 다만 터치 타겟 48px은 여기서도 불변입니다.
 *
 * @example <SourceChip docId="DOC-GUIDE-001" />
 * @example <SourceChip docId="DOC-GUIDE-001" title="중앙치매센터 치매 대응 매뉴얼" />
 */
export function SourceChip({
  docId,
  title,
  note,
  kind,
  className,
  interactive = true,
}: SourceChipProps) {
  const doc = useSourceDoc(docId);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement | null>(null);
  const panelId = useId();

  const resolvedTitle = title ?? doc?.title ?? docId;
  const resolvedNote = note ?? doc?.note;
  const resolvedKind = kind ?? doc?.kind;
  /** 문서 정보를 못 찾았고 제목도 안 받았으면 ID로만 표기합니다. */
  const unresolved = !doc && !title;

  useEffect(() => {
    if (!open) return;
    function onDocDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = (
    <>
      <span aria-hidden="true" className="text-brand-600">
        §
      </span>
      <span className="font-semibold">근거</span>
      <span aria-hidden="true" className="text-brand-300">
        ·
      </span>
      <span className="truncate">{resolvedTitle}</span>
    </>
  );

  /* 근거 칩은 한 화면에 여러 개가 붙습니다 — 보더를 빼고 아주 옅은 틸 면 하나로만 둡니다(§1-4·§5).
     글자는 14px(UI 크롬), 대비는 brand-50 위 brand-800으로 7:1을 넘습니다.
     터치 타겟 48px은 불변이라 높이는 그대로 두고 시각적 무게만 낮췄습니다. */
  const chipClass = cx(
    "chim-meta inline-flex max-w-full items-center gap-1.5 rounded-chip bg-brand-50 px-3.5 py-1 text-brand-800",
    interactive && "min-h-[48px] hover:bg-brand-100 transition-colors duration-150",
    className,
  );

  if (!interactive) {
    return <span className={chipClass}>{label}</span>;
  }

  return (
    <span ref={wrapRef} className="relative inline-block max-w-full align-middle">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className={chipClass}
        title="근거 문서 설명 보기"
      >
        {label}
      </button>

      {/* 팝오버는 "떠 있는 것"이므로 그림자(shadow-panel)를 쓰는 유일한 자리입니다. */}
      {open && (
        <span
          id={panelId}
          role="dialog"
          aria-label="근거 문서 설명"
          className="animate-fade-up absolute bottom-full left-0 z-50 mb-2 block w-[min(22rem,80vw)] rounded-panel bg-white p-4 text-left shadow-panel"
        >
          <span className="chim-body block font-bold text-ink">{resolvedTitle}</span>
          {resolvedKind && (
            <span className="chim-caption mt-1 inline-flex items-center rounded-chip bg-paper-2 px-2 py-0.5 font-semibold text-ink-soft">
              {resolvedKind}
            </span>
          )}
          {resolvedNote && (
            <span className="chim-meta mt-2 block leading-relaxed text-ink-soft">
              {resolvedNote}
            </span>
          )}
          <span className="chim-meta mt-2 block leading-relaxed text-ink-muted">
            {unresolved
              ? "문서 정보를 불러오지 못해 문서 번호로 표시했습니다. 근거 문서 화이트리스트에서 확인해 주세요."
              : "근거 문서 화이트리스트에 등록된 문서입니다. 목록 밖 문서는 인용하지 않습니다."}
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="chim-meta mt-3 inline-flex min-h-[48px] items-center rounded-field bg-neutral-soft px-4 font-semibold text-ink-soft hover:bg-neutral-line"
          >
            닫기
          </button>
        </span>
      )}
    </span>
  );
}

export default SourceChip;
