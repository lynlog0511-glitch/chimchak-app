"use client";

import { useEffect, useState } from "react";
import { cx } from "@/components";
import { isDemoRecord } from "@/lib/demoSeed";
import { loadSessions } from "@/lib/storage";
import { countUnexplored, messagePrint } from "./unexplored";

export interface UnexploredCountProps {
  /** 시나리오 id ("CHK-A01") — 대소문자는 가리지 않습니다. */
  scenarioId: string;
  /** 이 시나리오의 갈래 지문표 (`scenarioBranchPrints`가 서버에서 만든 문자열) */
  prints: string;
  className?: string;
}

/**
 * 「안 가 본 갈래 N곳」 — 훈련 목록 카드 하단 한 줄.
 *
 * **완주하신 적이 있는 카드에만** 섭니다. 아직 한 번도 안 하신 상황에 「안 가 본 갈래 32곳」이
 * 붙으면, 고르기도 전에 남은 분량 통지가 됩니다 — 처음 오신 분께 이 화면이 해야 할 말은
 * 그것이 아닙니다. 반대로 한 판 마치신 분께는 「같은 상황을 왜 또 하나」에 답이 필요합니다
 * (2026-08-25 · 페르소나 교육생 P2). 엔딩 마지막에 드리는 「이번에 고르지 않은 갈래」 한 줄과
 * 같은 사실을, 다음에 열러 오셨을 때 카드에서 한 번 더 말해 드리는 자리입니다.
 *
 * 기록은 기기(localStorage)에만 있으므로 **마운트한 뒤에** 읽습니다 — 서버 렌더 결과와
 * 어긋나지 않게, 읽기 전에는 아무 글자도 내지 않습니다. 시연용 예시 회차는 세지 않습니다
 * (`PracticeCount`와 같은 규율 — 예시가 진짜 이력으로 읽히면 안 됩니다).
 *
 * 세는 것은 갈래 수뿐이고 점수·등급·달성률은 만들지 않습니다. 전부 가 보셨으면 줄이 사라집니다 —
 * 「0곳 남음」은 알려 줄 것이 없는 줄입니다.
 */
export function UnexploredCount({ scenarioId, prints, className }: UnexploredCountProps) {
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const key = scenarioId.trim().toUpperCase();
    const records = loadSessions().filter(
      (record) => !isDemoRecord(record) && record.scenarioId.toUpperCase() === key,
    );
    if (records.length === 0) {
      setLeft(null);
      return;
    }
    const seen = new Set<string>();
    for (const record of records) {
      for (const message of [...record.greenChecks, ...record.coachingPoints]) {
        seen.add(messagePrint(message));
      }
    }
    setLeft(countUnexplored(prints, seen));
  }, [prints, scenarioId]);

  if (left === null || left <= 0) return null;

  return (
    <span
      className={cx("block text-[0.7813rem] leading-[1.45] text-ink-muted", className)}
    >
      안 가 본 갈래 <span className="chim-num font-bold">{left}</span>곳 — 다른 대답이면 다르게
      흘러가요
    </span>
  );
}

export default UnexploredCount;
