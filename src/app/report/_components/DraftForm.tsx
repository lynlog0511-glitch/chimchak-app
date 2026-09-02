"use client";

import type { Ref } from "react";
import type { RecordDraft } from "@/types";
import { BigButton, SourceChip, cx } from "@/components";
import {
  RECORD_SLOT_LABELS,
  RECORD_SLOT_QUESTIONS,
  recomputeMissing,
  type RecordSlot,
} from "@/engine/record";
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
 * 5요소를 편집할 수 있고, 비어 있는 칸에는 그 칸을 묻는 질문 한마디를 답니다.
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
      <h2 ref={headingRef} tabIndex={-1} className="text-[1.1875rem] leading-[1.3] font-bold tracking-[-0.015em] text-ink">
        저장할 돌봄 기록을 확인해 주세요
      </h2>
      <p className="mt-[6px] text-[0.9375rem] leading-[1.6] text-ink-soft">
        가린 문장에서 5요소를 나눠 담았습니다. 기기 안의 규칙으로 나눈 초안이라 어색한
        곳이 있을 수 있습니다. 사실과 다르면 바로 고쳐 주세요.
      </p>
      <div className="mt-[8px]">
        <SourceChip docId="DOC-NOTI-002" />
      </div>

      {/* 리전은 **늘 그려 둡니다** — 알림과 함께 리전이 생기면 읽지 않는 리더가 있습니다.
          그래서 말은 처음부터 비어 있는 이 sr-only 상자 하나가 맡고, 보이는 상자는 화면 전용으로
          둡니다(`ProtocolAddressCard`·`ProtocolPlayer`가 쓰는 그 문법입니다).
          5차에 파일·행까지 이름이 오른 조건부 리전 넷 중 하나였고, 6차가 새 자리 둘에서 이 규칙을
          지키는 동안 이름을 댄 넷은 그대로였습니다(7차 페르소나 UI/UX low). */}
      <p role="status" className="sr-only">
        {missingCount > 0
          ? `비어 있는 칸이 ${missingCount}곳 있습니다 — ${draft.missing.join(" · ")}. 아래에서 채워 주세요.`
          : ""}
      </p>
      {missingCount > 0 && (
        <p className="mt-4 text-[0.8438rem] leading-[1.6] font-bold text-warn-ink">
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
          /* 바닥은 1단계 입력칸과 같은 `paper-2`입니다 — 한 화면 안에서 글 쓰는 자리가
             흰 면과 회색 면으로 갈리면 같은 성격의 칸이 서로 다른 것으로 읽힙니다
             (가이드 §1 — 입력 필드는 paper-2 면 하나 · 페르소나 디자이너 low).
             `focus:border-brand-400`도 뗐습니다: 전역 포커스 outline(brand-600)과 겹쳐
             틸 두 겹이 번져 보였습니다. 「비어 있음」 경고 보더는 상태 표시라 그대로 둡니다. */
          const shared = cx(
            "mt-[6px] w-full rounded-card border bg-paper-2 p-[13px] text-[1.0625rem] leading-[1.6] text-ink placeholder:text-ink-faint",
            empty ? "border-warn-line focus:border-warn-ink" : "border-line-strong",
          );

          return (
            <div key={slot.key}>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <label htmlFor={fieldId} className="text-[0.8438rem] leading-[1.45] font-bold text-ink">
                  {label}
                </label>
                {/* 빈 칸에는 지시문이 아니라 **질문**만 답니다 — 「채워 주세요」가 다섯 번
                    늘어서면 남은 것이 숙제로 읽히는데, 물어보면 대답이 곧 그 칸의 값입니다
                    (2026-08-25 · 페르소나 PM P2). 문구는 엔진 상수 한 곳에서 옵니다.
                    2026-08-26 교정: 질문 앞에 「채워 주세요 — 」를 그대로 붙여 두어, 없애려던
                    표현이 빈 칸 수만큼 다시 늘어서 있었습니다. 지시문은 위 요약 한 줄이 맡습니다. */}
                {empty && (
                  <span id={hintId} className="text-[0.7813rem] leading-[1.45] font-bold text-warn-ink">
                    {RECORD_SLOT_QUESTIONS[slot.key]}
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

      <div className="mt-6 rounded-card bg-paper-2 px-4 py-[14px]">
        <p className="text-[0.8438rem] leading-[1.45] font-bold text-ink">
          확정은 직접 누르셔야 저장됩니다
        </p>
        <p className="mt-[6px] text-[0.7813rem] leading-[1.6] text-ink-soft">
          확정 직전에 한 번 더 가리고, 이 기기의 저장소에만 남깁니다. 최종 기록의
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
          이대로 저장하기
        </BigButton>
        {allEmpty && (
          <p className="mt-[6px] text-center text-[0.8438rem] leading-[1.45] text-ink-muted">
            5요소가 모두 비어 있어 아직 확정할 수 없습니다. 한 칸이라도 채워 주세요
          </p>
        )}
        <BigButton variant="ghost" block className="mt-1" onClick={onBack}>
          개인정보 확인으로 돌아가기
        </BigButton>
      </StickyCtaBar>

      <PrivacyPath reached={4} className="mt-6" />
    </div>
  );
}

export default DraftForm;
