"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BigButton } from "@/components";
import {
  DEMO_SEED_SUMMARY,
  clearDemoRecords,
  countDemoRecords,
  demoSeededAt,
  seedDemoRecords,
} from "@/lib/demoSeed";
import { formatDateTime } from "@/app/history/_components/format";
import { DemoJumpPanel } from "./DemoJumpPanel";

interface SeedState {
  sessions: number;
  reports: number;
  seededAt?: string;
}

function readState(): SeedState {
  const counts = countDemoRecords();
  const at = demoSeededAt();
  return at ? { ...counts, seededAt: at } : { sessions: counts.sessions, reports: counts.reports };
}

/**
 * 시연용 예시 기록 심기·지우기 (발표자 전용).
 *
 * 무대에서 「성장 기록」과 「이수 확인서」까지 보여 드리려면 완주 이력이 이미 있어야 하는데,
 * 깨끗한 기기에서는 두 화면이 빈 상태입니다. 실주행으로 채우면 발표 시간을 넘기므로 여기서
 * 예시를 심어 둡니다. 이 화면은 심사 동선에 없는 발표자 전용 화면이라 여기가 적소입니다.
 *
 * 정직성 — 심은 것은 전부 「예시」로 표시됩니다. 성장 기록에는 안내줄과 행마다 표시가 붙고,
 * 이수 확인서는 「예시 미리보기」가 되며 발급번호 자리에 「예시 — 발급되지 않음」이 인쇄됩니다.
 * 이수 시수 누계에는 한 회차도 들어가지 않으므로, 지우면 심기 전 숫자로 그대로 돌아옵니다.
 */
export function DemoSeedPanel() {
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<SeedState>({ sessions: 0, reports: 0 });
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setMounted(true);
    setState(readState());
  }, []);

  const handleSeed = useCallback(() => {
    const planted = seedDemoRecords();
    setState(readState());
    setNotice(
      planted.skipped > 0
        ? "이 기기에 기록이 이미 가득 차 있어 예시를 다 넣지 못했습니다. 진짜 기록을 밀어내지 않으려고 넣지 않은 것입니다."
        : "예시 기록을 심었습니다. 성장 기록과 이수 확인서에서 확인하실 수 있습니다.",
    );
  }, []);

  const handleClear = useCallback(() => {
    clearDemoRecords();
    setState(readState());
    setNotice("예시 기록을 지웠습니다. 이 기기의 진짜 기록과 이수 시수는 그대로입니다.");
  }, []);

  const seeded = mounted && state.sessions + state.reports > 0;

  return (
    <>
      <section aria-labelledby="demo-seed-title" className="mt-[18px] rounded-[14px] bg-paper-2 px-4 py-[14px]">
        <h2 id="demo-seed-title" className="text-[0.8438rem] leading-[1.45] font-extrabold text-ink">
          시연용 예시 기록
        </h2>

        <p aria-live="polite" className="mt-[5px] text-[0.7813rem] leading-[1.6] text-ink-soft">
          {!mounted
            ? "이 기기의 상태를 확인하는 중입니다…"
            : seeded
              ? `예시 훈련 ${state.sessions}회 · 예시 보고 ${state.reports}건이 심겨 있습니다.${
                  state.seededAt ? ` 심은 시각 ${formatDateTime(state.seededAt)}.` : ""
                }`
              : "지금은 심겨 있지 않습니다. 깨끗한 기기에서는 성장 기록과 이수 확인서가 빈 화면입니다."}
        </p>

        <div className="mt-[12px] flex flex-wrap gap-2">
          <BigButton onClick={handleSeed} variant="secondary" disabled={!mounted}>
            예시 기록 심기
          </BigButton>
          <BigButton onClick={handleClear} variant="secondary" disabled={!mounted || !seeded}>
            예시 기록 지우기
          </BigButton>
        </div>

        {notice.length > 0 && (
          <p aria-live="polite" className="mt-[10px] text-[0.7813rem] leading-[1.6] font-semibold text-ink">
            {notice}
          </p>
        )}

        <p className="mt-[12px] text-[0.7813rem] leading-[1.6] text-ink-soft">
          심는 것: {DEMO_SEED_SUMMARY}. 화면에는 전부 「예시」로 표시되고, 이수 확인서는 「예시
          미리보기」가 되어 발급번호 자리에 「예시 — 발급되지 않음」이 인쇄됩니다.
        </p>
        <p className="mt-[6px] text-[0.7813rem] leading-[1.6] text-ink-soft">
          이수 시수 누계에는 넣지 않습니다 — 지우시면 이 기기의 이수 회차와 시수는 심기 전 값으로
          그대로 돌아옵니다. 지우기는 예시만 지우고 진짜 기록은 남깁니다.
        </p>

        <div className="mt-[10px] flex flex-wrap gap-x-4">
          <Link
            href="/history"
            className="inline-flex min-h-[48px] items-center rounded-field text-[0.8438rem] font-bold text-brand-700 transition-colors duration-150 active:bg-paper-2"
          >
            성장 기록 열기 ›
          </Link>
          <Link
            href="/history/certificate"
            className="inline-flex min-h-[48px] items-center rounded-field text-[0.8438rem] font-bold text-brand-700 transition-colors duration-150 active:bg-paper-2"
          >
            이수 확인서 열기 ›
          </Link>
        </div>
      </section>

      {/* 시연 프리셋(?demo=) 진입점 — 예시 시드 바로 아래가 발표자 도구의 자리입니다.
          (/check/page.tsx는 다른 구역 파일이라 건드리지 않고 여기서 이어 붙입니다.) */}
      <DemoJumpPanel />
    </>
  );
}

export default DemoSeedPanel;
