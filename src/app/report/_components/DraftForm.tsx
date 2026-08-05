"use client";

import type { RecordDraft } from "@/types";
import { BigButton, SourceChip, cx } from "@/components";
import {
  RECORD_SLOT_HINTS,
  RECORD_SLOT_LABELS,
  recomputeMissing,
  type RecordSlot,
} from "@/engine/record";
import { PrivacyPath } from "./PrivacyPath";

export interface DraftFormProps {
  draft: RecordDraft;
  onChange: (next: RecordDraft) => void;
  onBack: () => void;
  onConfirm: () => void;
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
export function DraftForm({ draft, onChange, onBack, onConfirm }: DraftFormProps) {
  const setSlot = (key: RecordSlot, value: string): void => {
    const next: RecordDraft = { ...draft };
    next[key] = value;
    onChange(recomputeMissing(next));
  };

  const missingCount = draft.missing.length;
  const allEmpty = missingCount === SLOTS.length;

  return (
    <div>
      <h2 className="text-[17px] leading-[1.45] font-bold text-ink">
        급여제공기록지 초안을 확인하고 고쳐 주세요
      </h2>
      <p className="mt-[6px] text-[12.5px] leading-[1.7] text-ink-muted">
        가명처리를 마친 문장에서 5요소를 나눠 담았습니다. 기기 안의 규칙으로 나눈 초안이라 어색한
        곳이 있을 수 있습니다. 사실과 다르면 바로 고쳐 주세요.
      </p>
      <div className="mt-[8px]">
        <SourceChip docId="DOC-NOTI-002" />
      </div>

      {missingCount > 0 && (
        <p
          role="status"
          className="mt-4 rounded-[14px] bg-warn-soft px-4 py-[12px] text-[13px] leading-[1.6] font-semibold text-warn-ink"
        >
          비어 있는 칸이 {missingCount}곳 있습니다 — {draft.missing.join(" · ")}. 아래에서 채워
          주세요.
        </p>
      )}

      <div className="mt-4 space-y-4">
        {SLOTS.map((slot) => {
          const label = RECORD_SLOT_LABELS[slot.key];
          const value = draft[slot.key];
          const empty = value.trim().length === 0;
          const fieldId = `draft-${slot.key}`;
          const hintId = `${fieldId}-hint`;
          const shared = cx(
            "mt-[6px] w-full rounded-[14px] border bg-white p-[13px] text-[15px] leading-[1.7] text-ink placeholder:text-tertiary focus:outline-none",
            empty
              ? "border-warn-line focus:border-warn-ink"
              : "border-line-strong focus:border-brand-400",
          );

          return (
            <div key={slot.key}>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <label htmlFor={fieldId} className="text-[13px] leading-[1.5] font-bold text-ink">
                  {label}
                </label>
                {empty && (
                  <span className="text-[11.5px] font-extrabold text-warn-ink">채워 주세요</span>
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

              {empty && (
                <p id={hintId} className="mt-[5px] text-[11.5px] leading-[1.6] text-warn-ink">
                  {RECORD_SLOT_HINTS[slot.key]}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <PrivacyPath reached={4} className="mt-6" />

      <div className="mt-6 rounded-[14px] bg-paper-2 px-4 py-[14px]">
        <p className="text-[14px] leading-[1.5] font-bold text-ink">확정은 사용자가 누릅니다</p>
        <p className="mt-[6px] text-[12.5px] leading-[1.7] text-ink-soft">
          사용자가 확정한 뒤에만 기관 시스템으로 전달됩니다. 확정 직전에 2차 가명처리를 한 번 더
          돌리고, 이 기기의 저장소에만 남깁니다. 최종 기록의 내용과 책임은 작성하신 분에게
          있습니다.
        </p>
      </div>

      <BigButton size="lg" block className="mt-4" onClick={onConfirm} disabled={allEmpty}>
        이대로 확정하기
      </BigButton>
      {allEmpty && (
        <p className="mt-[6px] text-center text-[11.5px] leading-[1.5] text-tertiary">
          5요소가 모두 비어 있어 아직 확정할 수 없습니다. 한 칸이라도 채워 주세요
        </p>
      )}
      <BigButton variant="secondary" block className="mt-2" onClick={onBack}>
        가명처리 화면으로 돌아가기
      </BigButton>
    </div>
  );
}

export default DraftForm;
