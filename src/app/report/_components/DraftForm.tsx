"use client";

import type { RecordDraft } from "@/types";
import { BigButton, Card, SourceChip, cx } from "@/components";
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
 * 3단계 기록 초안 화면.
 * 5요소를 편집할 수 있고, 비어 있는 칸은 「채워 주세요」로 강조합니다.
 * 확정은 사용자가 직접 눌러야만 일어납니다.
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
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold text-ink md:text-xl">
              3. 급여제공기록지 초안을 확인하고 고쳐 주세요
            </h2>
            <p className="mt-2 text-base leading-relaxed text-ink-soft">
              가명처리를 마친 문장에서 5요소를 나눠 담았습니다. 기기 안의 규칙으로 나눈 초안이라
              어색한 곳이 있을 수 있습니다. 사실과 다르면 바로 고쳐 주세요.
            </p>
          </div>
          <SourceChip docId="DOC-NOTI-002" />
        </div>

        {missingCount > 0 && (
          <p
            role="status"
            className="mt-4 rounded-field border border-warn-line bg-warn-soft px-4 py-3 text-base leading-relaxed font-bold text-warn-ink"
          >
            비어 있는 칸이 {missingCount}곳 있습니다 — {draft.missing.join(" · ")}. 아래에서 채워
            주세요.
          </p>
        )}

        <div className="mt-5 space-y-4">
          {SLOTS.map((slot, index) => {
            const label = RECORD_SLOT_LABELS[slot.key];
            const value = draft[slot.key];
            const empty = value.trim().length === 0;
            const fieldId = `draft-${slot.key}`;
            const hintId = `${fieldId}-hint`;
            const shared = cx(
              "mt-2 w-full rounded-field border-2 bg-white p-3.5 text-base leading-relaxed text-ink placeholder:text-ink-muted/70 focus:outline-none",
              empty ? "border-warn focus:border-warn-ink" : "border-line focus:border-brand-400",
            );

            return (
              <div
                key={slot.key}
                className={cx(
                  "rounded-card border p-4",
                  empty ? "border-warn-line bg-warn-soft/60" : "border-line bg-paper-2/60",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-chip bg-brand-100 text-sm font-extrabold text-brand-800"
                  >
                    {index + 1}
                  </span>
                  <label htmlFor={fieldId} className="text-base font-extrabold text-ink">
                    {label}
                  </label>
                  {empty && (
                    <span className="rounded-chip border border-warn-line bg-white px-2.5 py-0.5 text-sm font-extrabold text-warn-ink">
                      채워 주세요
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

                {empty && (
                  <p id={hintId} className="mt-2 text-sm leading-relaxed font-semibold text-warn-ink">
                    {RECORD_SLOT_HINTS[slot.key]}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <PrivacyPath reached={4} />

      <Card tone="brand">
        <h3 className="text-base font-extrabold text-brand-900">확정은 사용자가 누릅니다</h3>
        <p className="mt-2 text-base leading-relaxed text-ink">
          사용자가 확정한 뒤에만 기관 시스템으로 전달됩니다. 확정 직전에 2차 가명처리를 한 번 더
          돌리고, 이 기기의 저장소에만 남깁니다. 최종 기록의 내용과 책임은 작성하신 분에게
          있습니다.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-between">
          <BigButton variant="secondary" onClick={onBack}>
            가명처리 화면으로 돌아가기
          </BigButton>
          <BigButton size="lg" onClick={onConfirm} disabled={allEmpty}>
            이대로 확정하기
          </BigButton>
        </div>
        {allEmpty && (
          <p className="mt-3 text-sm font-semibold text-ink-muted">
            5요소가 모두 비어 있어 아직 확정할 수 없습니다. 한 칸이라도 채워 주세요.
          </p>
        )}
      </Card>
    </div>
  );
}

export default DraftForm;
