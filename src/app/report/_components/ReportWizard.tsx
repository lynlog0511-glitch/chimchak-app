"use client";

import { useRef, useState } from "react";
import type { RecordDraft } from "@/types";
import { Badge, BigButton, Card } from "@/components";
import { maskText } from "@/engine/masking";
import { RECORD_SLOT_LABELS, extractDraft, recomputeMissing, type RecordSlot } from "@/engine/record";
import { saveReport, type StoredReport } from "@/lib/storage";
import { DraftForm } from "./DraftForm";
import { MaskReview } from "./MaskReview";
import { PrivacyPath } from "./PrivacyPath";
import { StepBar } from "./StepBar";
import { VoiceInput } from "./VoiceInput";

/** 60분 초과·0초 이하는 측정 오류로 보고 표시하지 않는다(진단서 기준). */
const MAX_DISPLAYABLE_ELAPSED_SEC = 60 * 60;

/**
 * 초 단위 소요시간을 "N분 N초"로 표시합니다(1분 미만이면 "N초"만).
 *
 * @example formatElapsed(102) // "1분 42초"
 */
function formatElapsed(totalSec: number): string {
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return minutes > 0 ? `${minutes}분 ${seconds}초` : `${seconds}초`;
}

const SLOT_ORDER: RecordSlot[] = ["time", "who", "what", "action", "status"];

const EMPTY_DRAFT: RecordDraft = recomputeMissing({
  time: "",
  who: "",
  what: "",
  action: "",
  status: "",
  missing: [],
});

/** 가명처리 토큰([대상자] 등)만 강조해서 보여 줍니다. */
function TokenText({ text }: { text: string }) {
  const parts = text.split(/(\[(?:대상자|번호|기관|주소|생년)\])/g);
  return (
    <>
      {parts.map((part, index) =>
        /^\[(?:대상자|번호|기관|주소|생년)\]$/.test(part) ? (
          <strong
            key={index}
            className="mx-0.5 rounded-chip border border-brand-300 bg-brand-100 px-2 py-0.5 font-extrabold text-brand-900"
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

/**
 * 음성 보고 → 기록 코칭 3단계 위저드.
 *
 * 1) 입력   : 마이크(누르는 동안 인식) 또는 타이핑
 * 2) 가명처리: 무엇을 왜 가렸는지 원문 위에 표시
 * 3) 초안   : 급여제공기록지 5요소를 고치고 확정(이 기기에만 저장)
 *
 * 모든 처리는 브라우저 안에서 끝나며 외부 호출이 0건입니다.
 */
export function ReportWizard() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<RecordDraft>(EMPTY_DRAFT);
  const [saved, setSaved] = useState<StoredReport | null>(null);
  /** 2차 가명처리에서 추가로 가린 건수 */
  const [secondPassCount, setSecondPassCount] = useState(0);
  /** 실제 입력 시작 시각(첫 타이핑 또는 마이크 시작). 예시 문장 채우기는 포함하지 않는다. */
  const inputStartRef = useRef<number | null>(null);

  const markInputStart = (): void => {
    if (inputStartRef.current === null) inputStartRef.current = Date.now();
  };

  const goDraft = (): void => {
    setDraft(extractDraft(maskText(text).masked));
    setStep(3);
  };

  const confirm = (): void => {
    // 2차 가명처리 — 사용자가 손으로 고친 칸까지 저장 직전에 한 번 더 검사합니다.
    const time = maskText(draft.time);
    const who = maskText(draft.who);
    const what = maskText(draft.what);
    const action = maskText(draft.action);
    const status = maskText(draft.status);
    const body = maskText(maskText(text).masked);

    const extraSpans = [
      ...time.spans,
      ...who.spans,
      ...what.spans,
      ...action.spans,
      ...status.spans,
      ...body.spans,
    ];

    const firstSpans = maskText(text).spans;
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
      <div className="space-y-6">
        <StepBar current={3} finished />

        <Card tone="ok">
          <div className="flex flex-wrap items-center gap-3">
            <span aria-hidden="true" className="text-2xl leading-none">
              🟢
            </span>
            <h2 className="text-lg font-extrabold text-ok-ink md:text-xl">확정했습니다</h2>
            <Badge tone="ok">이 기기에만 저장</Badge>
          </div>
          <p className="mt-3 text-base leading-relaxed text-ink">
            사용자가 확정한 뒤에만 기관 시스템으로 전달됩니다. 지금 남은 것은 가명처리 2단을 통과한
            텍스트뿐이며, 말씀하신 음성과 원문은 저장하지 않았습니다.
          </p>
          <p className="mt-2 text-base leading-relaxed text-ink-soft">
            {secondPassCount > 0
              ? `저장 직전 2차 검사에서 ${secondPassCount}곳을 더 가렸습니다.`
              : "저장 직전 2차 검사에서 추가로 가릴 항목은 나오지 않았습니다."}
          </p>
          {showElapsed && (
            <p className="mt-2 text-base leading-relaxed text-ink-soft">
              이번 기록 {formatElapsed(saved.elapsedSec as number)} · 손으로 쓰면 20~30분(현직
              인터뷰 실측)
            </p>
          )}
        </Card>

        <Card>
          <h3 className="text-base font-extrabold text-ink">확정한 기록 초안</h3>
          <dl className="mt-3 divide-y divide-line rounded-card border border-line bg-paper-2/60">
            {SLOT_ORDER.map((slot) => {
              const value = saved.draft[slot];
              return (
                <div key={slot} className="px-4 py-3">
                  <dt className="text-sm font-bold text-ink-muted">{RECORD_SLOT_LABELS[slot]}</dt>
                  <dd className="mt-1 text-base leading-relaxed text-ink">
                    {value.trim().length > 0 ? (
                      <TokenText text={value} />
                    ) : (
                      <span className="font-semibold text-warn-ink">
                        비어 있는 채로 확정하셨습니다
                      </span>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </Card>

        {/* 저장까지 끝났으므로 5단계 전부 완료 표시 */}
        <PrivacyPath reached={6} />

        <div className="flex flex-col gap-3 sm:flex-row">
          <BigButton href="/history" size="lg">
            성장 기록에서 확인하기
          </BigButton>
          <BigButton onClick={reset} variant="secondary" size="lg">
            새 보고 작성하기
          </BigButton>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <StepBar current={step} />

      {step === 1 && (
        <VoiceInput
          value={text}
          onChange={setText}
          onNext={() => setStep(2)}
          onInputStart={markInputStart}
        />
      )}

      {step === 2 && <MaskReview text={text} onBack={() => setStep(1)} onNext={goDraft} />}

      {step === 3 && (
        <DraftForm
          draft={draft}
          onChange={setDraft}
          onBack={() => setStep(2)}
          onConfirm={confirm}
        />
      )}
    </div>
  );
}

export default ReportWizard;
