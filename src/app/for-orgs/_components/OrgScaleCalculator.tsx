"use client";

import { useId, useMemo, useState } from "react";
import {
  DEFAULT_MONTHLY_REPORTS,
  DEFAULT_STAFF_COUNT,
  HAND_WRITTEN_MAX,
  HAND_WRITTEN_MIN,
  HAND_WRITTEN_SOURCE,
  HAND_WRITTEN_TEXT,
} from "./assumptions";

/**
 * 기관 규모로 환산해 보는 칸.
 *
 * 왜 두는가: 이 화면이 주는 값은 1인 기준뿐이라, 결재 문서에 옮길 숫자를 만들려면 결재자가
 * 화면 밖에서 직접 곱해야 했습니다. 곱셈은 앱이 하는 편이 낫지만, **가정값을 감추면 안 됩니다** —
 * 인원·건수·1건당 절감분과 산식을 화면에 그대로 펴 놓고, 기관 값으로 바꾸면 그 자리에서 다시 셉니다.
 *
 * 세 가지 규칙.
 *  1. **가격은 적지 않습니다** — 시간 단위 합계까지입니다. 단가는 기관 사정이라 여기서 정할 수 없습니다.
 *  2. **저장하지 않습니다** — 입력값은 이 화면의 상태로만 있다가 화면을 닫으면 사라집니다.
 *  3. **1건당 절감분은 실측이 있을 때만 셉니다** — 이 기기에서 잰 값이 없으면 계산을 지어내지 않고
 *     무엇이 있어야 세는지만 적습니다.
 */

/** 한 해를 세는 달 수 — 산식에 그대로 노출되는 상수입니다. */
const MONTHS_PER_YEAR = 12;

function parseCount(text: string, max: number): number | undefined {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return undefined;
  const value = Number.parseInt(trimmed, 10);
  if (value < 0 || value > max) return undefined;
  return value;
}

/** 「약 N시간」 — 시수는 결재 서식이 묻는 단위라 시간으로만 냅니다(분 단위는 산식 줄에 남습니다). */
function formatHours(minutes: number): string {
  const hours = minutes / 60;
  if (hours < 1) return "약 1시간 미만";
  return `약 ${Math.round(hours).toLocaleString("ko-KR")}시간`;
}

/** 1건당 앱 소요 표기 — 소수 첫째 자리까지만 씁니다(중앙값이라 「약」을 떼지 않습니다). */
function formatMinutes(minutes: number): string {
  return `약 ${Math.round(minutes * 10) / 10}분`;
}

function Field({
  id,
  label,
  unit,
  value,
  onChange,
  note,
}: {
  id: string;
  label: string;
  unit: string;
  value: string;
  onChange: (next: string) => void;
  note: string;
}) {
  return (
    <div className="min-w-0 flex-1">
      <label htmlFor={id} className="text-[0.8438rem] leading-[1.45] font-bold text-ink">
        {label}
      </label>
      <div className="mt-[6px] flex items-center gap-[8px]">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="chim-num min-h-[48px] w-full min-w-0 rounded-[14px] border border-line-strong bg-white px-[13px] text-[0.9375rem] leading-[1.6] font-bold text-ink focus:border-brand-400"
        />
        <span className="flex-none text-[0.8438rem] leading-[1.45] text-ink-soft">{unit}</span>
      </div>
      <p className="mt-[4px] text-[0.7813rem] leading-[1.6] text-ink-soft">{note}</p>
    </div>
  );
}

export interface OrgScaleCalculatorProps {
  /** 이 기기에서 잰 기록 1건 작성 소요(초) 중앙값. 잰 회차가 없으면 넘기지 않습니다. */
  measuredSec?: number;
}

export function OrgScaleCalculator({ measuredSec }: OrgScaleCalculatorProps) {
  const staffId = useId();
  const monthlyId = useId();
  const [staffText, setStaffText] = useState(String(DEFAULT_STAFF_COUNT));
  const [monthlyText, setMonthlyText] = useState(String(DEFAULT_MONTHLY_REPORTS));

  const staff = parseCount(staffText, 9999);
  const monthly = parseCount(monthlyText, 999);
  const appMinutes = measuredSec !== undefined ? measuredSec / 60 : undefined;

  const result = useMemo(() => {
    if (staff === undefined || monthly === undefined || appMinutes === undefined) return undefined;
    if (staff === 0 || monthly === 0) return undefined;
    const savedLow = Math.max(0, HAND_WRITTEN_MIN - appMinutes);
    const savedHigh = Math.max(0, HAND_WRITTEN_MAX - appMinutes);
    const records = staff * monthly * MONTHS_PER_YEAR;
    return {
      records,
      savedLow,
      savedHigh,
      lowText: formatHours(records * savedLow),
      highText: formatHours(records * savedHigh),
    };
  }, [staff, monthly, appMinutes]);

  return (
    <section
      aria-labelledby={`${staffId}-title`}
      className="mt-[14px] rounded-[14px] bg-paper-2 px-4 py-[14px]"
    >
      <h3 id={`${staffId}-title`} className="text-[0.9375rem] leading-[1.45] font-bold text-ink">
        우리 기관 규모로 환산해 보기
      </h3>
      <p className="mt-[4px] text-[0.8438rem] leading-[1.6] text-ink-soft">
        위 1인 실측값에 인원과 건수를 곱해 연간 절감 시수만 냅니다. 여기 적으신 값은{" "}
        <b className="font-bold text-ink">저장되지 않습니다</b> — 화면을 닫으면 사라집니다.
      </p>

      <div className="mt-[12px] flex flex-col gap-[12px] sm:flex-row sm:gap-[16px]">
        <Field
          id={staffId}
          label="우리 기관 인원"
          unit="명"
          value={staffText}
          onChange={setStaffText}
          note={`기본값 ${DEFAULT_STAFF_COUNT}명은 이 화면의 파일럿 제안 규모입니다.`}
        />
        <Field
          id={monthlyId}
          label="1인 월 보고 건수"
          unit="건"
          value={monthlyText}
          onChange={setMonthlyText}
          note={`기본값 ${DEFAULT_MONTHLY_REPORTS}건은 주 1건으로 잡은 가정값입니다.`}
        />
      </div>

      <div aria-live="polite" className="mt-[14px] border-t border-line pt-[12px]">
        {appMinutes === undefined ? (
          <p className="text-[0.8438rem] leading-[1.6] text-ink-soft">
            1건당 절감분은 이 기기에서 잰 값이 있어야 셉니다. 보고를 한 건 확정하시거나 위의 예시
            값을 채우시면 이 자리에 연간 합계가 나옵니다 — 없는 값으로 곱하지는 않습니다.
          </p>
        ) : result === undefined ? (
          <p className="text-[0.8438rem] leading-[1.6] text-ink-soft">
            인원과 월 보고 건수를 1 이상의 숫자로 적어 주십시오.
          </p>
        ) : (
          <>
            <p className="text-[0.7813rem] leading-[1.45] font-bold tracking-[0.06em] text-ink-muted">
              연간 절감 시수 추정치
            </p>
            <p className="chim-num mt-[4px] text-[1.375rem] leading-[1.3] font-extrabold text-ink">
              {result.lowText} ~ {result.highText}
            </p>
            <p className="mt-[6px] text-[0.8438rem] leading-[1.6] text-ink-soft">
              산식: {staff}명 × 월 {monthly}건 × {MONTHS_PER_YEAR}개월 ={" "}
              <span className="chim-num">{result.records.toLocaleString("ko-KR")}</span>건, 1건당{" "}
              {HAND_WRITTEN_TEXT} − {formatMinutes(appMinutes)} ={" "}
              <span className="chim-num">
                {Math.round(result.savedLow * 10) / 10}~{Math.round(result.savedHigh * 10) / 10}분
              </span>{" "}
              절감으로 잡은 값입니다.
            </p>
          </>
        )}
      </div>

      <p className="mt-[10px] text-[0.7813rem] leading-[1.6] text-ink-soft">
        1건당 앱 소요는 이 기기의 실측 중앙값이고, 비교 기준 {HAND_WRITTEN_TEXT}은{" "}
        {HAND_WRITTEN_SOURCE} 인원·건수는 가정값이므로 결재 문서에 옮기실 때 이 두 값을 함께
        적어 주십시오. 기기·통신·교육 시간 같은 도입 비용은 이 계산에 들어 있지 않습니다.
      </p>
    </section>
  );
}

export default OrgScaleCalculator;
