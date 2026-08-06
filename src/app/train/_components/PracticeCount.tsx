"use client";

import { useEffect, useState } from "react";
import { cx } from "@/components";
import { isDemoRecord } from "@/lib/demoSeed";
import { loadSessions } from "@/lib/storage";

export interface PracticeCountProps {
  /** 시나리오 id ("CHK-A01") — 대소문자는 가리지 않습니다. */
  scenarioId: string;
  className?: string;
}

/**
 * 「해 본 횟수 N」 — 훈련 목록 카드 하단 한 조각 (시안 7a).
 *
 * 기록은 기기(localStorage)에만 있으므로 **마운트한 뒤에** 읽습니다 —
 * 서버 렌더 결과와 어긋나지 않게, 읽기 전에는 아무 글자도 내지 않습니다.
 * 세면서 보는 것은 판정 결과 개수뿐입니다(발화 원문은 저장돼 있지 않습니다).
 */
export function PracticeCount({ scenarioId, className }: PracticeCountProps) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const key = scenarioId.trim().toUpperCase();
    // 시연용 예시 회차는 세지 않습니다 — 이 조각에는 「예시」 표시를 붙일 자리가 없어서,
    // 섞이면 진짜 연습 횟수처럼 읽힙니다.
    setCount(
      loadSessions().filter(
        (record) => !isDemoRecord(record) && record.scenarioId.toUpperCase() === key,
      ).length,
    );
  }, [scenarioId]);

  return (
    <span className={cx("chim-num text-[0.7813rem] leading-[1.45] text-ink-faint", className)}>
      {count === null ? "" : count > 0 ? `해 본 횟수 ${count}` : "아직 안 해봄"}
    </span>
  );
}

export default PracticeCount;
