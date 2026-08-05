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
 *
 * 크기 체계(§3): 라벨은 14px 크롬, 사용자가 읽고 고칠 값은 코어 17px입니다.
 * 형태(§1-4): 칸마다 상자를 두르지 않습니다 — 보더가 남는 곳은 입력 필드 자체뿐이고,
 * 비어 있는 칸은 그 필드의 보더 색과 라벨 옆 문구로만 알립니다.
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
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h2 className="chim-h2 text-ink">3. 급여제공기록지 초안을 확인하고 고쳐 주세요</h2>
            <p className="chim-meta mt-2 max-w-2xl leading-relaxed text-ink-muted">
              가명처리를 마친 문장에서 5요소를 나눠 담았습니다. 기기 안의 규칙으로 나눈 초안이라
              어색한 곳이 있을 수 있습니다. 사실과 다르면 바로 고쳐 주세요.
            </p>
          </div>
          <SourceChip docId="DOC-NOTI-002" />
        </div>

        {missingCount > 0 && (
          <p
            role="status"
            className="chim-label mt-5 rounded-field bg-warn-soft px-4 py-3 leading-relaxed text-warn-ink"
          >
            비어 있는 칸이 {missingCount}곳 있습니다 — {draft.missing.join(" · ")}. 아래에서 채워
            주세요.
          </p>
        )}

        <div className="mt-6 space-y-5">
          {SLOTS.map((slot) => {
            const label = RECORD_SLOT_LABELS[slot.key];
            const value = draft[slot.key];
            const empty = value.trim().length === 0;
            const fieldId = `draft-${slot.key}`;
            const hintId = `${fieldId}-hint`;
            const shared = cx(
              "chim-core-sm mt-1.5 w-full rounded-field border bg-white p-3.5 text-ink placeholder:text-ink-muted/70 focus:outline-none",
              empty ? "border-warn-line focus:border-warn-ink" : "border-line-strong focus:border-brand-400",
            );

            return (
              <div key={slot.key}>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <label htmlFor={fieldId} className="chim-meta font-bold text-ink-muted">
                    {label}
                  </label>
                  {empty && (
                    <span className="chim-caption font-extrabold text-warn-ink">채워 주세요</span>
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
                  <p id={hintId} className="chim-caption mt-1.5 leading-relaxed text-warn-ink">
                    {RECORD_SLOT_HINTS[slot.key]}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <PrivacyPath reached={4} />

      <Card>
        <h3 className="chim-h3 text-ink">확정은 사용자가 누릅니다</h3>
        <p className="chim-meta mt-2 max-w-3xl leading-relaxed text-ink-soft">
          사용자가 확정한 뒤에만 기관 시스템으로 전달됩니다. 확정 직전에 2차 가명처리를 한 번 더
          돌리고, 이 기기의 저장소에만 남깁니다. 최종 기록의 내용과 책임은 작성하신 분에게
          있습니다.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <BigButton variant="secondary" onClick={onBack}>
            가명처리 화면으로 돌아가기
          </BigButton>
          <BigButton size="lg" onClick={onConfirm} disabled={allEmpty}>
            이대로 확정하기
          </BigButton>
        </div>
        {allEmpty && (
          <p className="chim-caption mt-3 font-semibold text-ink-muted">
            5요소가 모두 비어 있어 아직 확정할 수 없습니다. 한 칸이라도 채워 주세요.
          </p>
        )}
      </Card>
    </div>
  );
}

export default DraftForm;
