"use client";

import { useId, useState } from "react";
import Link from "next/link";
import type { SessionRecord } from "@/types";
import { cx } from "@/components";
import { formatDateTime, formatShortDate, verdictNote } from "./format";
import { trainHref } from "./nextTraining";

export interface TrainingRowProps {
  record: SessionRecord;
  /** 「8월 5일 · 치매 행동」의 뒷부분 — 짧은 유형 라벨입니다. */
  typeLabel: string;
}

/**
 * 회차 한 줄의 요약 — 「잘한 것 5 · 다시 볼 것 1 — 감정 인정 먼저」 (시안 5c).
 * 개수 표기는 사용자가 확정한 예외이고(§4), 그 밖의 점수·등급·순위는 만들지 않습니다.
 */
function summaryTail(record: SessionRecord): string {
  const first = record.coachingPoints[0];
  if (first && first.trim().length > 0) return first.trim();
  return "다시 볼 것 없이 마치셨어요";
}

/**
 * 최근 훈련 행 (시안 5c).
 *
 * 행은 [날짜·유형 12px / 제목 15.5px w700 / 잘한 것·다시 볼 것 요약 12.5px] + 우측 「다시 ›」이고,
 * 행 아래는 hairline 1px입니다. 카드로 감싸지 않습니다.
 *
 * 왼쪽을 누르면 그 회차에서 **충족한 것과 다음에 살려 볼 것 문장**이 면 카드로 펼쳐집니다 —
 * 시안의 줄 문법을 지키면서도 회차 내용이 사라지지 않게 둔 자리입니다.
 * 발화 원문은 애초에 저장하지 않으므로 여기에도 없습니다.
 */
export function TrainingRow({ record, typeLabel }: TrainingRowProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const green = record.greenChecks.length;
  const coaching = record.coachingPoints.length;

  return (
    <div className="border-b border-line">
      <div className="flex items-center gap-3 px-[2px] py-[6px]">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-controls={panelId}
          className="min-h-[48px] min-w-0 flex-1 py-2 text-left"
        >
          <span className="block text-[12px] leading-[1.4] text-tertiary">
            {formatShortDate(record.startedAt)} · {typeLabel}
          </span>
          <span className="mt-[2px] block text-[15.5px] leading-[1.35] font-bold text-ink">
            {record.scenarioTitle}
          </span>
          <span className="mt-[3px] line-clamp-2 block text-[12.5px] leading-[1.5] text-ink-soft">
            <span className="font-bold text-ok-ink">잘한 것 {green}</span> · 다시 볼 것 {coaching} —{" "}
            {summaryTail(record)}
          </span>
          <span className="mt-[3px] block text-[11.5px] leading-[1.4] text-tertiary">
            {open ? "접기" : "자세히 보기"}
          </span>
        </button>

        <Link
          href={trainHref(record.scenarioId)}
          aria-label={`${record.scenarioTitle} 다시 연습하기`}
          className="flex min-h-[48px] flex-none items-center px-2 text-[13px] font-bold whitespace-nowrap text-brand-700"
        >
          다시 ›
        </Link>
      </div>

      {open && (
        <div id={panelId} className="mb-[14px] rounded-[14px] bg-paper-2 px-4 py-[14px]">
          <p className="text-[13px] leading-[1.5] font-bold text-ink">{record.endingTitle}</p>
          <p className="mt-[3px] text-[12.5px] leading-[1.6] text-ink-soft">
            {verdictNote(record.verdict)}
          </p>

          <RowList
            label="잘한 것"
            labelClass="text-ok-ink"
            items={record.greenChecks}
            empty="이번 회차에는 기록된 항목이 없습니다."
          />
          <RowList
            label="다시 볼 것"
            labelClass="text-ink-soft"
            items={record.coachingPoints}
            empty="따로 남은 것이 없습니다. 흐름을 잘 지키셨습니다."
          />

          {record.cfCount > 0 && (
            <p className="mt-[14px] rounded-[12px] bg-danger-soft px-3 py-[10px] text-[12.5px] leading-[1.6] font-semibold text-danger-ink">
              안전과 직결된 구간에서 즉시 중단 안내를 받으셨습니다. 대안 행동을 확인하신 뒤 같은
              상황을 다시 연습해 보세요.
            </p>
          )}

          <p className="mt-[12px] text-[11.5px] leading-[1.5] text-tertiary">
            대화 <span className="chim-num">{record.turnCount}</span>턴
            {record.retriesUsed > 0 && " · 다시 해보기 사용"} · 마친 시각{" "}
            {formatDateTime(record.endedAt)}
          </p>
          <p className="mt-[4px] text-[11.5px] leading-[1.5] text-tertiary">
            대사는 가상 인물의 AI 생성 문장이며, 말씀하신 발화 원문은 저장하지 않습니다.
          </p>
        </div>
      )}
    </div>
  );
}

function RowList({
  label,
  labelClass,
  items,
  empty,
}: {
  label: string;
  labelClass: string;
  items: string[];
  empty: string;
}) {
  return (
    <div className="mt-[14px]">
      <p
        className={cx(
          "text-[12px] leading-[1.5] font-bold tracking-[0.06em]",
          labelClass,
        )}
      >
        {label}
      </p>
      {items.length > 0 ? (
        <ul className="chim-hairline mt-[4px] border-t border-line">
          {items.map((item, index) => (
            <li key={index} className="py-[8px] text-[13px] leading-[1.6] text-ink">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-[4px] text-[12.5px] leading-[1.6] text-tertiary">{empty}</p>
      )}
    </div>
  );
}

export default TrainingRow;
