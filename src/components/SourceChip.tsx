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
 * 크기 체계(§3): 칩은 UI 크롬이라 13.5px(`chim-caption`)입니다.
 * 접근성 코어 예외는 코어 콘텐츠(대사·CUE·응급 자막·CTA)에만 적용됩니다 — 칩은 해당하지 않습니다.
 * 다만 터치 타겟 48px은 여기서도 불변입니다 — 다만 **칩이 아니라 바깥 래퍼**가 가집니다.
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

  /* 틸 계조는 **두 단**뿐입니다 — 면 `brand-50` + 글자 `brand-800`.
     예전에는 한 칩 안에 brand-50(면)·brand-600(§)·brand-300(·)·brand-800(글자) 네 단이 있었고,
     그중 구분점 `·`은 brand-300이라 대비 1.9:1로 어차피 보이지도 않았습니다.
     계조를 줄여도 뜻은 그대로입니다 — 「근거」는 굵기가, 문서명은 자리가 이미 가르고 있습니다. */
  /* 줄어드는 칸은 **문서명 하나**입니다. 「§ 근거 ·」 세 조각에 `flex-none`이 없으면 폭이 좁아질 때
     이들도 함께 눌려, `overflow-wrap: anywhere`(globals.css의 body 규칙)를 만난 「근거」가
     「근 / 거」 두 줄로 접힙니다 — 칩 높이가 그 자리에서 20px 늘어납니다. */
  const label = (
    <>
      <span aria-hidden="true" className="flex-none">
        §
      </span>
      <span className="flex-none font-semibold">근거</span>
      <span aria-hidden="true" className="flex-none">
        ·
      </span>
      <span className="min-w-0 truncate">{resolvedTitle}</span>
    </>
  );

  /* 근거 칩은 한 화면에 여러 개가 붙습니다 — 보더를 빼고 아주 옅은 틸 면 하나로만 둡니다(§1-4·§5).
     글자는 13.5px(UI 크롬), 대비는 brand-50 위 brand-800으로 7:1을 넘습니다.

     ── 터치 영역은 래퍼가, 칩은 칩 크기로 (2026-08-25) ──────────────
     예전에는 `min-h-[48px]`가 **칩 자체**에 걸려 있어서, 13.5px 글자 한 줄짜리 라벨이
     본문 글자의 3.5배 높이인 48px 로젠지로 그려졌습니다 — 칩이 아니라 버튼 덩어리로 읽혔고,
     brand-50 면이 그만큼 넓어져 「틸은 화면당 2곳 이하」라는 §0·§1의 절제가 브리핑에서
     무너졌습니다. 같은 문제를 /safety의 목차 칩이 이미 옳게 풀어 두었기에 그 구조를 따릅니다:
     바깥 래퍼가 48px 터치 영역을 먹고, 안쪽 칩은 py-1.5(≈30px)로 칩 크기를 지킵니다. */
  const chipClass = cx(
    "chim-caption inline-flex max-w-full items-center gap-1.5 rounded-chip bg-brand-50 px-3.5 py-1.5 text-brand-800",
    interactive && "transition-colors duration-150 group-hover:bg-brand-100 group-active:bg-brand-100",
  );

  if (!interactive) {
    return <span className={cx(chipClass, className)}>{label}</span>;
  }

  return (
    <span ref={wrapRef} className="relative inline-block max-w-full align-middle">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className={cx("group flex min-h-[48px] max-w-full items-center", className)}
        title="근거 문서 설명 보기"
      >
        <span className={chipClass}>{label}</span>
      </button>

      {/* 팝오버는 "떠 있는 것"이므로 그림자(shadow-panel)를 쓰는 유일한 자리입니다. */}
      {open && (
        <span
          id={panelId}
          role="dialog"
          aria-label="근거 문서 설명"
          className="animate-pop-in absolute bottom-full left-0 z-50 mb-2 block w-[min(22rem,80vw)] rounded-panel bg-white p-4 text-left shadow-panel"
        >
          <span className="chim-body block font-bold text-ink">{resolvedTitle}</span>
          {resolvedKind && (
            <span className="chim-caption mt-1 inline-flex items-center rounded-chip bg-paper-2 px-2 py-0.5 font-semibold text-ink-soft">
              {resolvedKind}
            </span>
          )}
          {resolvedNote && (
            <span className="chim-caption mt-2 block leading-[1.6] text-ink-soft">
              {resolvedNote}
            </span>
          )}
          <span className="chim-caption mt-2 block leading-[1.6] text-ink-muted">
            {unresolved
              ? "문서 정보를 불러오지 못해 문서 번호로 표시했습니다. 근거 문서 목록에서 확인해 주세요."
              : "근거 문서 목록에 등록된 문서입니다. 목록 밖 문서는 인용하지 않습니다."}
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="chim-caption mt-3 inline-flex min-h-[48px] items-center rounded-field bg-neutral-soft px-4 font-semibold text-ink-soft transition-colors duration-150 hover:bg-neutral-line active:bg-neutral-line"
          >
            닫기
          </button>
        </span>
      )}
    </span>
  );
}

export default SourceChip;
