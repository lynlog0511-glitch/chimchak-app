"use client";

import { useId, useState } from "react";
import Link from "next/link";
import type { EndingDef, SessionRecord } from "@/types";
import { EyebrowLabel, type EyebrowTone } from "@/components";
import { isDemoRecord } from "@/lib/demoSeed";
import { formatDateTime, formatShortDate, verdictNote } from "./format";
import { trainHref } from "./nextTraining";

export interface TrainingRowProps {
  record: SessionRecord;
  /** 「8월 5일 · 치매 행동」의 뒷부분 — 짧은 유형 라벨입니다. */
  typeLabel: string;
}

/** 앞으로 나아가는 마무리 — 이때만 「다시 볼 것 없이 마치셨어요」로 접어도 사실과 어긋나지 않습니다. */
const FORWARD_VERDICTS: readonly EndingDef["verdict"][] = ["충족", "부분 충족"];

/** 옛 기록에는 없을 수 있는 값이라 읽는 쪽에서 막아 둡니다(하위 호환 — 없으면 표시를 생략). */
function cfCountOf(record: SessionRecord): number {
  return typeof record.cfCount === "number" && record.cfCount > 0 ? record.cfCount : 0;
}

function endingTitleOf(record: SessionRecord): string {
  return typeof record.endingTitle === "string" ? record.endingTitle.trim() : "";
}

/**
 * 회차 한 줄의 요약 — 「잘한 것 5 · 다시 볼 것 1 — 감정 인정 먼저」 (시안 5c).
 * 개수 표기는 사용자가 확정한 예외이고(§4), 그 밖의 점수·등급·순위는 만들지 않습니다.
 *
 * ⚑CF로 멈춘 회차는 코칭 문구 목록이 비어 있어도 「다시 볼 것 없이 마치셨어요」로 접히면 안 됩니다 —
 * 접힌 줄만 보고 지나가는 사람에게 그 한 줄이 회차의 전부이기 때문입니다.
 * 그래서 멈춘 회차는 **그날의 마무리 제목**(검수된 고정 문구)을 그대로 싣습니다.
 */
function summaryTail(record: SessionRecord): string {
  const ending = endingTitleOf(record);
  if (cfCountOf(record) > 0 && ending.length > 0) return ending;

  const first = record.coachingPoints[0];
  if (first && first.trim().length > 0) return first.trim();

  // 다시 보기 문법으로 끝난 회차(재시도·재훈련 권고 등)도 「없이 마치셨어요」로 요약하지 않습니다.
  if (!FORWARD_VERDICTS.includes(record.verdict) && ending.length > 0) return ending;
  return "다시 볼 것 없이 마치셨어요";
}

/**
 * 최근 훈련 행 (시안 5c).
 *
 * 행은 [날짜·유형 12.5px / 제목 17px w700 / 요약 13.5px] + 우측 「다시 ›」이고,
 * 행 아래는 hairline 1px입니다. 카드로 감싸지 않습니다.
 * 크기는 가이드 §2 눈금(11 / 12.5 / 13.5 / 15 / 17)에서만 고릅니다 — 12·13·15.5px 같은
 * 중간값은 위계를 만들지 못하고 편차만 남기므로 쓰지 않습니다.
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
  /** ⚑CF로 멈춘 지점 수 — 숫자로만 두지 않고 「다시 볼 장면 N곳」 문장으로 적습니다(등급이 아닙니다). */
  const cfScenes = cfCountOf(record);
  /** 시연용으로 심어 둔 예시 회차 — 행에서 바로 구분되어야 증빙으로 오인되지 않습니다. */
  const isExample = isDemoRecord(record);

  return (
    <div className="border-b border-line">
      <div className="flex items-center gap-3 px-[2px] py-[6px]">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-controls={panelId}
          className="min-h-[48px] min-w-0 flex-1 rounded-field py-2 text-left transition-colors duration-150 active:bg-paper-2"
        >
          <span className="block text-[0.7813rem] leading-[1.45] text-ink-faint">
            {isExample && <span className="font-bold text-warn-ink">예시 · </span>}
            {formatShortDate(record.startedAt)} · {typeLabel}
          </span>
          <span className="mt-[2px] block text-[1.0625rem] leading-[1.3] font-bold text-ink">
            {record.scenarioTitle}
          </span>
          {/* 접힌 줄이 회차의 전부입니다 — 멈춘 지점과 마무리 제목이 여기서 빠지면 요약이 사실과 어긋납니다.
              0인 항목은 아예 적지 않습니다(「다시 볼 것 0」이 「없었다」로 읽히지 않도록). */}
          <span className="mt-[3px] line-clamp-2 block text-[0.8438rem] leading-[1.45] text-ink-soft">
            <span className="font-bold text-ok-ink">잘한 것 {green}</span>
            {cfScenes > 0 && (
              <span className="font-bold text-warn-ink"> · 다시 볼 장면 {cfScenes}곳</span>
            )}
            {coaching > 0 && ` · 다시 볼 것 ${coaching}`} — {summaryTail(record)}
          </span>
          <span className="mt-[3px] block text-[0.7813rem] leading-[1.45] text-ink-faint">
            {open ? "접기" : "자세히 보기"}
          </span>
        </button>

        {/* 「다시 ›」의 글자는 brand-800입니다 — 행 자체는 흰 지면이지만 눌리면 paper-2가 되고,
            그 면에서 brand-700은 4.49:1로 AA 하한(4.5)을 넘지 못합니다.
            규칙은 「지면이 흰색이 아닌 순간이 있으면 brand-800」 한 줄입니다(가이드 §9-8). */}
        <Link
          href={trainHref(record.scenarioId)}
          aria-label={`${record.scenarioTitle} 다시 연습하기`}
          className="flex min-h-[48px] flex-none items-center rounded-field px-2 text-[0.9375rem] font-bold whitespace-nowrap text-brand-800 transition-colors duration-150 active:bg-paper-2"
        >
          다시 ›
        </Link>
      </div>

      {open && (
        <div id={panelId} className="mb-[14px] rounded-card bg-paper-2 px-4 py-[14px]">
          {isExample && (
            <p className="mb-[10px] text-[0.7813rem] leading-[1.6] font-bold text-warn-ink">
              체험용으로 심어 둔 예시 회차입니다. 실제로 완주하신 기록이 아니고, 이수 시수
              누계에도 들어가지 않습니다.
            </p>
          )}
          <p className="text-[0.9375rem] leading-[1.45] font-bold text-ink">{record.endingTitle}</p>
          <p className="mt-[3px] text-[0.7813rem] leading-[1.6] text-ink-soft">
            {verdictNote(record.verdict)}
          </p>

          <RowList
            label="잘한 것"
            labelTone="ok"
            items={record.greenChecks}
            empty="이번 회차에는 기록된 항목이 없습니다."
          />
          <RowList
            label="다시 볼 것"
            labelTone="soft"
            items={record.coachingPoints}
            empty="따로 남은 것이 없습니다. 흐름을 잘 지키셨습니다."
          />

          {cfScenes > 0 && (
            <p className="mt-[14px] rounded-field bg-danger-soft px-3 py-[10px] text-[0.7813rem] leading-[1.6] font-semibold text-danger-ink">
              안전과 직결된 구간에서 즉시 중단 안내를 받으셨습니다. 대안 행동을 확인하신 뒤 같은
              상황을 다시 연습해 보세요.
            </p>
          )}

          <p className="mt-[12px] text-[0.7813rem] leading-[1.45] text-ink-faint">
            주고받은 대화 <span className="chim-num">{record.turnCount}</span>번
            {record.retriesUsed > 0 && " · 다시 해 보기 사용"} · 마친 시각{" "}
            {formatDateTime(record.endedAt)}
          </p>
          {/* 안심 문구 — 캡션 등급(11.5px ink-faint)에서 읽히는 등급으로 올려 둡니다. */}
          <p className="mt-[6px] text-[0.7813rem] leading-[1.6] text-ink-soft">
            훈련 속 인물은 전원 가상이며, 대사는 검수된 문장을 바탕으로 합니다. 하신 말씀 원문은
            저장하지 않습니다.
          </p>
        </div>
      )}
    </div>
  );
}

function RowList({
  label,
  labelTone,
  items,
  empty,
}: {
  label: string;
  labelTone: EyebrowTone;
  items: string[];
  empty: string;
}) {
  return (
    <div className="mt-[14px]">
      {/* 아이브로는 손으로 짓지 않고 규격 컴포넌트를 씁니다 — 색은 `tone` 한 칸으로 고릅니다
          (className으로 색을 넘기면 기본 잉크와 이어붙어 CSS 출력 순서가 승자를 정합니다). */}
      <EyebrowLabel tone={labelTone}>{label}</EyebrowLabel>
      {items.length > 0 ? (
        <ul className="chim-hairline mt-[4px] border-t border-line">
          {items.map((item, index) => (
            <li key={index} className="py-[8px] text-[0.8438rem] leading-[1.6] text-ink">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-[4px] text-[0.7813rem] leading-[1.6] text-ink-faint">{empty}</p>
      )}
    </div>
  );
}

export default TrainingRow;
