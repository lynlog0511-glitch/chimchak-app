"use client";

import { useEffect, useRef, useState } from "react";
import { formatElapsedDuration } from "@/lib/duration";
import type { RecordDraft } from "@/types";
import { BigButton, EyebrowLabel } from "@/components";
import { maskText } from "@/engine/masking";
import { extractDraft, recomputeMissing } from "@/engine/record";
import { SAVE_FAILED_BODY, SAVE_FAILED_TITLE, saveReport, type SavedReport } from "@/lib/storage";
import { DraftForm } from "./DraftForm";
import { DraftRows } from "./DraftRows";
import { MaskReview, applyManualMask, type ManualMaskSpan } from "./MaskReview";
import { PrivacyPath } from "./PrivacyPath";
import { StepBar } from "./StepBar";
import { VoiceInput } from "./VoiceInput";

/** 60분 초과·0초 이하는 측정 오류로 보고 표시하지 않는다(진단서 기준). */
const MAX_DISPLAYABLE_ELAPSED_SEC = 60 * 60;

/**
 * 초 단위 소요시간을 "N분 N초"로 표시합니다(1분 미만이면 "N초"만).
 *
 * @example formatElapsedDuration(102) // "1분 42초"
 */

const EMPTY_DRAFT: RecordDraft = recomputeMissing({
  time: "",
  who: "",
  what: "",
  action: "",
  status: "",
  missing: [],
});

/**
 * 음성 보고 → 기록 코칭 3단계 위저드 (시안 6e 언어).
 *
 * 1) 말하기: 마이크(누르는 동안 인식) 또는 타이핑
 * 2) 가리기: 무엇이 왜 가려졌는지 인라인 칩과 범례로 표시(자동이 놓친 자리는 눌러서 직접 가림)
 * 3) 확인  : 급여제공기록지 5요소를 고치고 확정(이 기기에만 저장)
 *
 * 모든 처리는 브라우저 안에서 끝나며 외부 호출이 0건입니다.
 * 재구현에서 바뀐 것은 면·글자 크기뿐이고, 단계·검사·저장 규칙은 그대로입니다.
 */
export function ReportWizard() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [text, setText] = useState("");
  /** 2단계에서 손으로 가린 자리(원문 좌표). 저장 경로도 이 값을 함께 씁니다. */
  const [manual, setManual] = useState<ManualMaskSpan[]>([]);
  const [draft, setDraft] = useState<RecordDraft>(EMPTY_DRAFT);
  const [saved, setSaved] = useState<SavedReport | null>(null);
  /** 2차 가명처리에서 추가로 가린 건수 */
  const [secondPassCount, setSecondPassCount] = useState(0);
  /** 실제 입력 시작 시각(첫 타이핑 또는 마이크 시작). 예시 문장 채우기는 포함하지 않는다. */
  const inputStartRef = useRef<number | null>(null);

  /**
   * 지금 화면의 제목. 단계가 바뀌면 여기로 초점을 옮깁니다.
   * 각 단계 컴포넌트가 자기 h2에 이 ref를 붙이므로, 항상 **지금 보이는** 제목 하나만 가리킵니다.
   */
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  /** 마지막으로 보여 준 화면. 첫 렌더에서는 스크롤·초점을 건드리지 않습니다. */
  const shownRef = useRef<string | null>(null);

  /**
   * 단계 전환 시 화면 맨 위로 되돌리고 새 단계 제목을 읽어 줍니다.
   *
   * 이걸 하지 않으면 ②로 넘어갔을 때 가림 결과 문단 중간에 떨어지고,
   * 확정 뒤에는 「확정했습니다」가 뷰포트 위로 밀려나 확정 사실 자체가 화면에서 사라집니다.
   * 값이 실제로 바뀐 때만 움직이므로, 같은 화면에서 효과가 다시 돌아도 초점을 빼앗지 않습니다.
   */
  useEffect(() => {
    const shown = saved ? "confirmed" : `step-${step}`;
    if (shownRef.current === shown) return;
    const first = shownRef.current === null;
    shownRef.current = shown;
    if (first) return;
    window.scrollTo(0, 0);
    headingRef.current?.focus();
  }, [step, saved]);

  const markInputStart = (): void => {
    if (inputStartRef.current === null) inputStartRef.current = Date.now();
  };

  /** 원문이 바뀌면 손으로 가린 좌표는 더 이상 그 글을 가리키지 않습니다 — 함께 버립니다. */
  const updateText = (next: string): void => {
    setText(next);
    setManual([]);
  };

  const goDraft = (): void => {
    setDraft(extractDraft(applyManualMask(text, manual).masked));
    setStep(3);
  };

  const confirm = (): void => {
    // 2차 가명처리 — 사용자가 손으로 고친 칸까지 저장 직전에 한 번 더 검사합니다.
    const time = maskText(draft.time);
    const who = maskText(draft.who);
    const what = maskText(draft.what);
    const action = maskText(draft.action);
    const status = maskText(draft.status);
    // 1차 = 자동 규칙 + 2단계에서 손으로 가린 자리. 그 결과를 다시 한 번 규칙에 태웁니다.
    const firstPass = applyManualMask(text, manual);
    const body = maskText(firstPass.masked);

    const extraSpans = [
      ...time.spans,
      ...who.spans,
      ...what.spans,
      ...action.spans,
      ...status.spans,
      ...body.spans,
    ];

    const firstSpans = firstPass.spans;
    const counts: Record<string, number> = {};
    for (const span of [...firstSpans, ...extraSpans]) {
      counts[span.kind] = (counts[span.kind] ?? 0) + 1;
    }

    const finalDraft = recomputeMissing({
      time: time.masked,
      who: who.masked,
      what: what.masked,
      action: action.masked,
      status: status.masked,
      missing: [],
    });

    const elapsedSec =
      inputStartRef.current !== null
        ? Math.round((Date.now() - inputStartRef.current) / 1000)
        : undefined;

    const stored = saveReport({
      maskedText: body.masked,
      draft: finalDraft,
      maskedCounts: counts,
      elapsedSec,
    });

    setSecondPassCount(extraSpans.length);
    setDraft(finalDraft);
    setSaved(stored);
  };

  const reset = (): void => {
    setText("");
    setManual([]);
    setDraft(EMPTY_DRAFT);
    setSaved(null);
    setSecondPassCount(0);
    inputStartRef.current = null;
    setStep(1);
  };

  if (saved) {
    const showElapsed =
      typeof saved.elapsedSec === "number" &&
      saved.elapsedSec > 0 &&
      saved.elapsedSec <= MAX_DISPLAYABLE_ELAPSED_SEC;

    return (
      <div>
        <StepBar current={3} finished />

        {/* 확정 직후의 주인공은 이 한 줄입니다. */}
        <div className="mt-[18px]">
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="text-[1.1875rem] leading-[1.45] font-extrabold text-ok-ink"
          >
            {saved && !saved.persisted ? SAVE_FAILED_TITLE : "확정했습니다"}
          </h2>
          <EyebrowLabel className="mt-[3px] text-ok-ink">
            {saved && !saved.persisted ? "저장되지 않음" : "이 기기에만 저장"}
          </EyebrowLabel>
          {saved && !saved.persisted && (
            <p className="mt-[10px] text-[0.9375rem] leading-[1.6] text-warn-ink">{SAVE_FAILED_BODY}</p>
          )}
          <p className="mt-[10px] text-[0.8438rem] leading-[1.6] text-ink">
            지금 남은 것은 가명처리 2단을 통과한 텍스트뿐이며, 말씀하신 음성과 원문은 저장하지
            않았습니다.
          </p>
          {/* 기관 시스템 이야기는 앱을 통틀어 이 한 곳에서만 합니다 —
              「전달됩니다」를 현재형으로 쓰면 없는 기능을 있다고 적는 셈이라 「계획」 칩을 답니다. */}
          <p className="mt-[8px] text-[0.8438rem] leading-[1.6] text-ink-soft">
            <span className="mr-[6px] inline-flex items-center rounded-chip border border-line-strong px-[7px] py-[1px] align-[2px] text-[0.6875rem] leading-[1.45] font-bold whitespace-nowrap text-ink-soft">
              계획
            </span>
            기관 시스템으로 보내는 기능은 아직 없습니다. 나중에 생기더라도 확정 버튼을 누르신
            뒤에, 가려진 글만 나갑니다.
          </p>
          <p className="mt-[8px] text-[0.7813rem] leading-[1.6] text-ink-soft">
            {secondPassCount > 0
              ? `저장 직전 2차 검사에서 ${secondPassCount}곳을 더 가렸습니다.`
              : "저장 직전 2차 검사에서 추가로 가릴 항목은 나오지 않았습니다."}
          </p>
        </div>

        {/*
          앱에서 유일한 절감 근거입니다. 예시 문장으로 시작하면 소요시간을 재지 않는데,
          그때 이 블록이 통째로 사라지면 「그래서 얼마나 줄었나」에 답할 화면이 0이 됩니다.
          비교 기준(손으로 쓰면 20~30분)은 항상 두고, 실측이 있을 때만 앞에 병기합니다.
        */}
        <div className="mt-[14px] rounded-[14px] bg-paper-2 px-4 py-[14px]">
          <EyebrowLabel>걸린 시간</EyebrowLabel>
          <p className="mt-[6px] text-[0.9375rem] leading-[1.6] font-bold text-ink">
            {showElapsed && (
              <>
                이번 기록{" "}
                <span className="chim-num text-brand-800">
                  {formatElapsedDuration(saved.elapsedSec as number)}
                </span>{" "}
                ·{" "}
              </>
            )}
            손으로 쓰면 <span className="chim-num text-brand-800">20~30분</span>
          </p>
          <p className="mt-[6px] text-[0.7813rem] leading-[1.6] text-ink-soft">
            20~30분은 현장에서 일하시는 분들께 직접 여쭤 들은 값입니다.{" "}
            {showElapsed
              ? "이번 기록 시간은 처음 적기 시작한 순간부터 확정까지를 이 기기에서 잰 값입니다."
              : "이번 회차는 예시 문장으로 시작해 소요 시간을 재지 않았습니다."}
          </p>
        </div>

        <EyebrowLabel className="mt-6">확정한 기록 초안 — 다섯 칸</EyebrowLabel>
        <DraftRows draft={saved.draft} empty="confirmed" className="mt-[2px]" />

        {/* 저장까지 끝났으므로 5단계 전부 완료 표시 */}
        <PrivacyPath reached={6} className="mt-6" />

        <BigButton href="/history" size="lg" block className="mt-5">
          성장 기록에서 확인하기
        </BigButton>
        <BigButton onClick={reset} variant="secondary" block className="mt-2">
          새 보고 작성하기
        </BigButton>
      </div>
    );
  }

  return (
    <div>
      <StepBar current={step} />

      <div className="mt-[18px]">
        {step === 1 && (
          <VoiceInput
            value={text}
            onChange={updateText}
            onNext={() => setStep(2)}
            onInputStart={markInputStart}
            headingRef={headingRef}
          />
        )}

        {step === 2 && (
          <MaskReview
            text={text}
            manual={manual}
            onManualChange={setManual}
            onBack={() => setStep(1)}
            onNext={goDraft}
            headingRef={headingRef}
          />
        )}

        {step === 3 && (
          <DraftForm
            draft={draft}
            onChange={setDraft}
            onBack={() => setStep(2)}
            onConfirm={confirm}
            headingRef={headingRef}
          />
        )}
      </div>
    </div>
  );
}

export default ReportWizard;
