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
        /* 라운드·면·좌우 여백은 홈의 다른 회색 카드(첫 방문 안내·안전 설계 카드)와 같은 값입니다.
           좌우는 **rem 한 값**(px-4 = 1rem)입니다 — 예전에는 px-[15px]이라 「아주 크게」(125%)에서
           옆 카드의 px-4가 20px로 자라는 동안 이 카드만 15px에 멈춰, 세로로 쌓인 카드들의
           글자 왼쪽 끝이 5px씩 어긋났습니다(2026-08-26 페르소나 디자이너 med).
           글자와 나란히 서는 치수는 rem이라는 이 앱의 규칙(MicButton·TabBar)이 여백에도 같습니다. */
        "flex min-h-[48px] items-center gap-[10px] rounded-card bg-paper-2 px-4 py-[14px]",
        // 눌림 = 면 한 단 + 1.5% 축소를 한 박자에. hover는 마우스에서 「눌리는 카드」임을 알립니다.
        // 대비: ink #191f1e 위 neutral-line 13.4:1 · ink-muted 4.94:1 — 둘 다 AA 통과.
        "chim-press hover:bg-neutral-line active:bg-neutral-line",
        className,
      )}
    >
      <span className="min-w-0 flex-1">
        {/* 행간은 3단 사다리(1.3/1.45/1.6)의 「밀집」 단으로 맞췄습니다 — 1.5·1.4가 섞여 있던 자리입니다.
            크기는 12.5 / 17 / 13.5입니다. 예전에는 12 / 14.5 / 14로 **세 개가 전부 눈금 밖**이었고,
            13.5와 14.5는 비율 1.07이라 지각 역치 아래여서 위계를 만들지 못했습니다 —
            재방문 사용자의 첫 터치 대상인 이 카드가 그냥 어정쩡하게 뭉개져 있던 자리입니다.
            제목이 코어 경로(누르면 훈련이 이어집니다)라 17px을 씁니다. */}
        <span className="block text-[0.7813rem] leading-[1.45] text-ink-muted">하던 훈련</span>
        <span className="mt-[2px] block text-[1.0625rem] leading-[1.45] font-bold text-ink">
          {scenario.title}{" "}
          {/* 진행 위치는 세션마다 바뀌는 숫자라 자리폭을 고정합니다 —
              한 자리에서 두 자리로 넘어갈 때 제목 줄이 흔들리지 않게. */}
          <span className="chim-num font-medium text-ink-muted">· {stepLabel}</span>
        </span>
      </span>
      {/* 색이 brand-800인 이유 — 이 카드의 면은 paper-2이고 눌리면 neutral-line 한 단 더
          어두워집니다. brand-700은 흰 지면에서만 AA(4.86:1)이고 여기서는 4.49:1(눌림 3.90:1)로
          미달입니다. brand-800은 같은 두 면에서 6.27:1 · 5.45:1입니다(2026-08-26 실측).
          「흰 지면이 아니면 brand-800」 — globals.css의 brand-700 주석이 정본이고,
          designScale 게이트가 이 조합의 재유입을 셉니다. */}
      <span aria-hidden className="flex-none text-[0.8438rem] font-bold text-brand-800">
        이어서 ›
      </span>
    </Link>
  );
}

export default ResumeCard;
