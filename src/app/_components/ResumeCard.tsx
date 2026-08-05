"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cx } from "@/components";
import { loadAllProgress, progressStepCount, type SessionProgress } from "@/lib/storage";

/** 홈에서 이어서 하기를 걸 수 있는 시나리오 한 줄 — 제목·경로만 서버에서 넘겨받습니다. */
export interface ResumeScenario {
  /** 대문자 id ("CHK-A01") */
  id: string;
  title: string;
  /** 브리핑 경로 ("/train/chk-a01") */
  href: string;
}

export interface ResumeCardProps {
  /**
   * 시나리오 표.
   * 체크포인트에는 시나리오 id만 남고 제목은 없습니다(대사·발화를 저장하지 않으므로).
   * 시나리오 데이터 전체를 클라이언트 번들로 끌어오지 않으려고 서버에서 이 표만 받습니다.
   */
  scenarios: readonly ResumeScenario[];
  className?: string;
}

interface Resumable {
  scenario: ResumeScenario;
  step: number;
}

/** 가장 최근에 저장된 체크포인트 1건 — 모르는 시나리오 id는 건너뜁니다. */
function pickLatest(
  rows: readonly SessionProgress[],
  scenarios: readonly ResumeScenario[],
): Resumable | null {
  let best: SessionProgress | undefined;
  let bestScenario: ResumeScenario | undefined;

  for (const row of rows) {
    const scenario = scenarios.find((s) => s.id.toUpperCase() === row.scenarioId.toUpperCase());
    if (!scenario) continue;
    // savedAt은 ISO 문자열이라 문자열 비교만으로 최신순이 그대로 나옵니다.
    if (!best || row.savedAt > best.savedAt) {
      best = row;
      bestScenario = scenario;
    }
  }

  if (!best || !bestScenario) return null;
  return { scenario: bestScenario, step: progressStepCount(best) };
}

/**
 * 홈 「하던 훈련」 카드 (시안 5a).
 *
 * 진행 중인 체크포인트가 **있을 때만** 나타납니다 — 없으면 아무것도 그리지 않습니다.
 * 체크포인트는 기기(localStorage)에만 있으므로 마운트 뒤에 읽습니다(서버 렌더 결과와 어긋나지 않게).
 *
 * 카드가 담는 것은 시나리오 제목과 진행 위치뿐입니다 — 말씀하신 내용은 어디에도 저장돼 있지 않습니다.
 */
export function ResumeCard({ scenarios, className }: ResumeCardProps) {
  const [resumable, setResumable] = useState<Resumable | null>(null);

  useEffect(() => {
    setResumable((prev) => {
      const next = pickLatest(loadAllProgress(), scenarios);
      // 값이 같으면 이전 객체를 그대로 돌려줍니다(불필요한 리렌더·루프 방지).
      if (!next) return prev === null ? prev : null;
      if (prev && prev.scenario.id === next.scenario.id && prev.step === next.step) return prev;
      return next;
    });
  }, [scenarios]);

  if (!resumable) return null;

  const { scenario, step } = resumable;
  const stepLabel = `${step}번째 상황까지`;

  return (
    <Link
      href={scenario.href}
      aria-label={`하던 훈련 이어서 하기 — ${scenario.title}, ${stepLabel}`}
      className={cx(
        "flex min-h-[48px] items-center gap-[10px] rounded-[14px] bg-paper-2 px-[15px] py-[13px]",
        "transition-colors duration-150 ease-soft active:bg-neutral-line",
        className,
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[0.75rem] leading-[1.5] text-ink-muted">하던 훈련</span>
        <span className="mt-[2px] block text-[0.9063rem] leading-[1.4] font-bold text-ink">
          {scenario.title} <span className="font-medium text-ink-muted">· {stepLabel}</span>
        </span>
      </span>
      <span aria-hidden className="flex-none text-[0.875rem] font-bold text-brand-700">
        이어서 ›
      </span>
    </Link>
  );
}

export default ResumeCard;
