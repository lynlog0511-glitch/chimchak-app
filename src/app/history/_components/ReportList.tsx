"use client";

import { useId, useState } from "react";
import { cx } from "@/components";
import { RECORD_SLOT_LABELS, type RecordSlot } from "@/engine/record";
import type { StoredReport } from "@/lib/storage";
import {
  MASK_TOKEN_SPLIT,
  formatElapsedDuration,
  formatShortDate,
  isDisplayableElapsed,
  isMaskToken,
} from "./format";

export interface ReportListProps {
  reports: StoredReport[];
}

const SLOT_ORDER: RecordSlot[] = ["time", "who", "what", "action", "status"];

/**
 * 가명처리 토큰만 강조합니다 — 무엇이 가려졌는지가 한눈에 보여야 하므로
 * 성장 기록에서도 이 표시는 그대로 유지합니다. 채움만 쓰고 보더는 두지 않습니다.
 */
function TokenText({ text }: { text: string }) {
  const parts = text.split(MASK_TOKEN_SPLIT);
  return (
    <>
      {parts.map((part, index) =>
        isMaskToken(part) ? (
          <strong
            key={index}
            className="mx-[2px] rounded-[6px] bg-tint px-[5px] py-[1px] font-extrabold text-brand-900"
          >
            {part}
          </strong>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}

/** 목록 행의 한 줄 요약 — 확정 본문의 첫 문장까지만 씁니다. */
function firstSentence(text: string): string {
  const trimmed = text.trim();
  const idx = trimmed.indexOf(". ");
  if (idx === -1) return trimmed;
  return trimmed.slice(0, idx + 1);
}

/**
 * 확정한 기록 1건 — 최근 훈련과 **같은 리스트 문법**입니다(시안 5c).
 * 누르면 확정 본문과 5요소가 면 카드로 펼쳐집니다.
 */
function ReportRow({ report }: { report: StoredReport }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const counts = Object.entries(report.maskedCounts ?? {}).filter(([, value]) => value > 0);
  const maskedTotal = counts.reduce((sum, [, value]) => sum + value, 0);
  const filled = SLOT_ORDER.filter((slot) => report.draft[slot].trim().length > 0).length;

  return (
    <div className="border-b border-line">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex min-h-[48px] w-full items-center gap-3 px-[2px] py-[14px] text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[0.75rem] leading-[1.4] text-tertiary">
            {formatShortDate(report.createdAt)} · 가명처리 2단 통과
            {isDisplayableElapsed(report.elapsedSec) &&
              ` · ${formatElapsedDuration(report.elapsedSec)} 만에 작성`}
          </span>
          <span className="mt-[2px] line-clamp-2 block text-[0.9688rem] leading-[1.35] font-bold text-ink">
            {firstSentence(report.maskedText)}
          </span>
          <span className="mt-[3px] block text-[0.7813rem] leading-[1.5] text-ink-soft">
            5요소 {filled}칸 채움 · {maskedTotal > 0 ? `${maskedTotal}곳 가림` : "가릴 항목 없음"}
          </span>
        </span>
        <span
          aria-hidden
          className={cx(
            "flex-none text-[1.0625rem] leading-none text-faint transition-transform duration-150",
            open && "rotate-90",
          )}
        >
          ›
        </span>
      </button>

      {open && (
        <div id={panelId} className="mb-[14px] rounded-[14px] bg-paper-2 px-4 py-[14px]">
          <p className="text-[0.75rem] leading-[1.5] font-bold tracking-[0.06em] text-ink-muted">
            확정한 본문
          </p>
          <p className="mt-[6px] text-[0.8438rem] leading-[1.8] text-ink">
            <TokenText text={report.maskedText} />
          </p>

          {counts.length > 0 && (
            <p className="mt-[10px] text-[0.7188rem] leading-[1.5] text-tertiary">
              {counts.map(([kind, value]) => `${kind} ${value}곳`).join(" · ")} 가림
            </p>
          )}

          <dl className="chim-hairline mt-[14px] border-t border-line">
            {SLOT_ORDER.map((slot) => {
              const value = report.draft[slot];
              return (
                <div key={slot} className="py-[10px]">
                  <dt className="text-[0.7188rem] leading-[1.4] font-bold text-ink-muted">
                    {RECORD_SLOT_LABELS[slot]}
                  </dt>
                  <dd className="mt-[2px] text-[0.8438rem] leading-[1.6] text-ink">
                    {value.trim().length > 0 ? (
                      <TokenText text={value} />
                    ) : (
                      <span className="text-[0.7813rem] font-semibold text-warn-ink">
                        비어 있습니다
                      </span>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>

          <p className="mt-[10px] text-[0.7188rem] leading-[1.5] text-tertiary">
            남아 있는 것은 가명처리를 마친 텍스트뿐이며, 음성과 원문은 저장하지 않았습니다.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * 확정한 기록 목록.
 * 저장된 것은 가명처리를 마친 텍스트뿐이며, 원문·음성은 남아 있지 않습니다.
 */
export function ReportList({ reports }: ReportListProps) {
  return (
    <div className="chim-rows">
      {reports.map((report) => (
        <ReportRow key={report.id} report={report} />
      ))}
    </div>
  );
}

export default ReportList;
