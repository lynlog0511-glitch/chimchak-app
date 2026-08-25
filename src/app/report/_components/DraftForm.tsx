"use client";

import type { Ref } from "react";
import type { RecordDraft } from "@/types";
import { BigButton, SourceChip, cx } from "@/components";
import { RECORD_SLOT_LABELS, recomputeMissing, type RecordSlot } from "@/engine/record";
import { SLOT_PROMPTS } from "./DraftRows";
import { PrivacyPath } from "./PrivacyPath";
import { StickyCtaBar, usePassedBlock } from "./StickyCtaBar";

export interface DraftFormProps {
  draft: RecordDraft;
  onChange: (next: RecordDraft) => void;
  onBack: () => void;
  onConfirm: () => void;
  /** 이 단계의 제목에 붙는 ref — 단계가 바뀔 때 위저드가 여기로 초점을 옮깁니다. */
  headingRef?: Ref<HTMLHeadingElement>;
}

interface SlotSpec {
  key: RecordSlot;
  multiline: boolean;
  placeholder: string;
}

const SLOTS: SlotSpec[] = [
  { key: "time", multiline: false, placeholder: "예) 오후 4시 40분쯤" },
  { key: "who", multiline: false, placeholder: "예) [대상자]" },
  {
    key: "what",
    multiline: true,
    placeholder: "예) 현관 앞에서 신발을 신고 나가려 하셨습니다.",
  },
  {
    key: "action",
    multiline: true,
    placeholder: "예) 거실 불을 켜 드리고 따뜻한 물을 드리며 화장실로 안내해 드렸습니다.",
  },
  {
    key: "status",
    multiline: true,
    placeholder: "예) 지금은 진정되어 소파에 앉아 계십니다.",
  },
];

/**
 * 3단계 기록 초안 화면 (v4 언어).
 *
 * 5요소를 편집할 수 있고, 비어 있는 칸은 「채워 주세요」로 강조합니다.
 * 확정은 사용자가 직접 눌러야만 일어납니다 — 그 규칙은 그대로입니다.
 */
export function DraftForm({ draft, onChange, onBack, onConfirm, headingRef }: DraftFormProps) {
  const setSlot = (key: RecordSlot, value: string): void => {
    const next: RecordDraft = { ...draft };
    next[key] = value;
    onChange(recomputeMissing(next));
  };

  const missingCount = draft.missing.length;
  const allEmpty = missingCount === SLOTS.length;
  /**
   * 다섯 칸과 「확정은 사용자가 누릅니다」까지 지나셨는지.
   * 2단계에서 가림 결과가 하는 역할을 이 화면에서는 이 두 블록이 합니다 —
   * 확정이 무엇을 하는지 읽기 전에는 도킹한 CTA가 보조 색으로 물러섭니다.
   */
  const { markerRef, passed } = usePassedBlock();

  return (
    <div>
      <h2 ref={headingRef} tabIndex={-1} className="text-[1.0625rem] leading-[1.45] font-bold text-ink">
        급여제공기록지 초안을 확인하고 고쳐 주세요
      </h2>
      <p className="mt-[6px] text-[0.7813rem] leading-[1.6] text-ink-muted">
        가명처리를 마친 문장에서 5요소를 나눠 담았습니다. 기기 안의 규칙으로 나눈 초안이라 어색한
        곳이 있을 수 있습니다. 사실과 다르면 바로 고쳐 주세요.
      </p>
      <div className="mt-[8px]">
        <SourceChip docId="DOC-NOTI-002" />
      </div>

      {missingCount > 0 && (
        <p role="status" className="mt-4 text-[0.8438rem] leading-[1.6] font-bold text-warn-ink">
          비어 있는 칸이 <span className="chim-num">{missingCount}</span>곳 있습니다 —{" "}
          {draft.missing.join(" · ")}. 아래에서 채워 주세요.
        </p>
      )}

      <div className="mt-4 space-y-4">
        {SLOTS.map((slot) => {
          const label = RECORD_SLOT_LABELS[slot.key];
          const value = draft[slot.key];
          const empty = value.trim().length === 0;
          const fieldId = `draft-${slot.key}`;
          const hintId = `${fieldId}-hint`;
          /* 입력 글자는 17px(코어 단) — 16px 미만이면 iOS가 포커스 순간 화면을 강제로 확대합니다.
             다섯 칸을 차례로 옮겨 다니는 화면이라 확대·복귀가 칸마다 반복됩니다. */
          const shared = cx(
            "mt-[6px] w-full rounded-[14px] border bg-white p-[13px] text-[1.0625rem] leading-[1.6] text-ink placeholder:text-tertiary",
            empty
              ? "border-warn-line focus:border-warn-ink"
              : "border-line-strong focus:border-brand-400",
          );

          return (
            <div key={slot.key}>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <label htmlFor={fieldId} className="text-[0.8438rem] leading-[1.45] font-bold text-ink">
                  {label}
                </label>
                {empty && (
                  <span id={hintId} className="text-[0.7813rem] leading-[1.45] font-bold text-warn-ink">
                    채워 주세요 — {SLOT_PROMPTS[slot.key]}
                  </span>
                )}
              </div>

              {slot.multiline ? (
                <textarea
                  id={fieldId}
                  value={value}
                  onChange={(event) => setSlot(slot.key, event.target.value)}
                  rows={3}
                  placeholder={slot.placeholder}
                  aria-describedby={empty ? hintId : undefined}
                  className={shared}
                />
              ) : (
                <input
                  id={fieldId}
                  type="text"
                  value={value}
                  onChange={(event) => setSlot(slot.key, event.target.value)}
                  placeholder={slot.placeholder}
                  aria-describedby={empty ? hintId : undefined}
                  className={cx(shared, "min-h-[48px]")}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-[14px] bg-paper-2 px-4 py-[14px]">
        <p className="text-[0.8438rem] leading-[1.45] font-bold text-ink">
          확정은 직접 누르셔야 저장됩니다
        </p>
        <p className="mt-[6px] text-[0.7813rem] leading-[1.6] text-ink-soft">
          확정 직전에 2차 가명처리를 한 번 더 돌리고, 이 기기의 저장소에만 남깁니다. 최종 기록의
          내용과 책임은 작성하신 분에게 있습니다.
        </p>
        {/* 기관 연동은 아직 없습니다 — /safety가 「계획」 배지로 구분하는 것과 같은 표기를 씁니다.
            같은 문단 안에서 「전달됩니다」와 「이 기기에만 남깁니다」가 부딪히던 자리입니다. */}
        <p className="mt-[8px] text-[0.7813rem] leading-[1.6] text-ink-soft">
          <span className="mr-[6px] inline-flex items-center rounded-chip border border-line-strong px-[7px] py-[1px] align-[2px] text-[0.6875rem] leading-[1.45] font-bold whitespace-nowrap text-ink-soft">
            계획
          </span>
          기관 시스템으로 보내는 기능은 아직 없습니다. 연동하게 되더라도 확정 버튼을 누르신
          뒤에, 가려진 글만 나갑니다.
        </p>
      </div>

      {/* 확정이 무엇을 하는지 다 읽은 자리. 여기까지 눈이 닿으면 아래 도킹 CTA가 주 색이 됩니다. */}
      <div ref={markerRef} aria-hidden className="h-px" />

      {/* 전진 CTA 도킹 — 엔딩 패널과 같은 문법입니다. 바 아래에 남는 `PrivacyPath`가
          sticky가 움직일 자리이자, 확정 뒤에도 경로를 다시 확인할 수 있는 자리입니다. */}
      <StickyCtaBar>
        <BigButton
          size="lg"
          block
          variant={passed ? "primary" : "secondary"}
          onClick={onConfirm}
          disabled={allEmpty}
        >
          이대로 확정하기
        </BigButton>
        {allEmpty && (
          <p className="mt-[6px] text-center text-[0.8438rem] leading-[1.45] text-ink-muted">
            5요소가 모두 비어 있어 아직 확정할 수 없습니다. 한 칸이라도 채워 주세요
          </p>
        )}
        <BigButton variant="ghost" block className="mt-1" onClick={onBack}>
          가리기 화면으로 돌아가기
        </BigButton>
      </StickyCtaBar>

      <PrivacyPath reached={4} className="mt-6" />
    </div>
  );
}

export default DraftForm;
