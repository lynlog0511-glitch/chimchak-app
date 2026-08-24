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
  /**
   * 지우기를 누르신 뒤 한 번 더 여쭙는 중인지.
   *
   * 지우기는 되돌릴 수 없고, 하필 「심기」 바로 옆에 있습니다 — 무대 위에서 손이 미끄러지면
   * 방금 심은 예시가 사라진 채로 성장 기록을 여시게 됩니다. 그래서 한 걸음을 넣되,
   * 브라우저 확인창(`confirm`)이 아니라 화면 안에서 여쭙습니다 — 확인창은 무대 화면을 덮고,
   * 발표 중인 기기에서는 어떻게 보일지 예측하기 어렵습니다.
   */
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    setMounted(true);
    setState(readState());
  }, []);

  const handleSeed = useCallback(() => {
    const planted = seedDemoRecords();
    setState(readState());
    setConfirming(false);
    setNotice(
      planted.skipped > 0
        ? "이 기기에 기록이 이미 가득 차 있어 예시를 다 넣지 못했습니다. 진짜 기록을 밀어내지 않으려고 넣지 않은 것입니다."
        : "예시 기록을 심었습니다. 아래 순서대로 보여 주시면 됩니다.",
    );
  }, []);

  const handleClear = useCallback(() => {
    clearDemoRecords();
    setState(readState());
    setConfirming(false);
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
          <BigButton
            onClick={() => {
              setNotice("");
              setConfirming(true);
            }}
            variant="secondary"
            disabled={!mounted || !seeded || confirming}
          >
            예시 기록 지우기
          </BigButton>
        </div>

        {/* 한 번 더 여쭙는 자리 — 무엇이 사라지고 무엇이 남는지를 숫자까지 적고 나서 묻습니다.
            「정말 지우시겠습니까?」만으로는 무대 위에서 판단할 근거가 없습니다. */}
        {confirming && (
          <div className="mt-[12px] border-t border-line pt-[12px]">
            <p className="text-[0.8438rem] leading-[1.6] font-bold text-ink">
              예시 훈련 <span className="chim-num">{state.sessions}</span>회 · 예시 보고{" "}
              <span className="chim-num">{state.reports}</span>건을 지웁니다. 되돌릴 수 없습니다.
            </p>
            <p className="mt-[4px] text-[0.7813rem] leading-[1.6] text-ink-soft">
              지워지는 것은 예시뿐입니다 — 직접 완주하신 기록과 이수 시수, 확정하신 보고는 그대로
              남습니다. 다시 필요하시면 위 「예시 기록 심기」로 언제든 다시 심으실 수 있습니다.
            </p>
            <div className="mt-[10px] flex flex-wrap gap-2">
              <BigButton onClick={handleClear}>예, 예시만 지웁니다</BigButton>
              <BigButton onClick={() => setConfirming(false)} variant="secondary">
                아니요, 그대로 둡니다
              </BigButton>
            </div>
          </div>
        )}

        {/* 안내줄은 언제나 자리에 둡니다 — 문장이 생길 때 상자까지 함께 생기면
            화면 낭독기가 바뀐 줄을 읽어 주지 못하는 브라우저가 있습니다. */}
        <div role="status" aria-live="polite">
          {notice.length > 0 && (
            <p className="mt-[10px] text-[0.7813rem] leading-[1.6] font-semibold text-ink">
              {notice}
            </p>
          )}
        </div>

        <p className="mt-[12px] text-[0.7813rem] leading-[1.6] text-ink-soft">
          심는 것: {DEMO_SEED_SUMMARY}. 화면에는 전부 「예시」로 표시되고, 이수 확인서는 「예시
          미리보기」가 되어 발급번호 자리에 「예시 — 발급되지 않음」이 인쇄됩니다.
        </p>
        <p className="mt-[6px] text-[0.7813rem] leading-[1.6] text-ink-soft">
          이수 시수 누계에는 넣지 않습니다 — 지우시면 이 기기의 이수 회차와 시수는 심기 전 값으로
          그대로 돌아옵니다. 지우기는 예시만 지우고 진짜 기록은 남깁니다.
        </p>

        {/* 심고 나서 「그래서 어디로 가지」에 답하는 자리.
            예전에는 링크 두 개만 나란히 있어서, 어느 쪽을 먼저 열어야 하는지와 시연이 끝난 뒤
            무엇을 해야 하는지가 무대에서만 결정됐습니다. 순서를 화면에 적어 둡니다. */}
        <div className="mt-[12px] border-t border-line pt-[12px]">
          <p className="text-[0.7813rem] leading-[1.45] font-bold tracking-[0.06em] text-ink-muted">
            {seeded ? "심었습니다 · 이 순서로 보여 주십시오" : "심기 전에 · 지금 열면 보이는 것"}
          </p>
          <ol className="chim-hairline mt-[6px]">
            <li className="py-[4px]">
              <Link
                href="/history"
                className="inline-flex min-h-[48px] items-center rounded-field text-[0.8438rem] font-bold text-brand-700 transition-colors duration-150 active:bg-paper-2"
              >
                <span className="chim-num">1</span>. 성장 기록 열기 ›
              </Link>
              <p className="text-[0.7813rem] leading-[1.6] text-ink-soft">
                {seeded
                  ? "최근 훈련 행과 유형별 커버리지가 채워져 있습니다. 화면 맨 위 안내줄이 「체험용 예시 기록이 표시되고 있습니다」라고 먼저 밝히고, 행마다 「예시」 표시가 붙습니다."
                  : "지금은 빈 상태 화면이 열립니다 — 훈련을 권하는 빈 화면 자체를 보여 드리실 거라면 심지 않으셔도 됩니다."}
              </p>
            </li>
            <li className="py-[4px]">
              <Link
                href="/history/certificate"
                className="inline-flex min-h-[48px] items-center rounded-field text-[0.8438rem] font-bold text-brand-700 transition-colors duration-150 active:bg-paper-2"
              >
                <span className="chim-num">2</span>. 이수 확인서 열기 ›
              </Link>
              <p className="text-[0.7813rem] leading-[1.6] text-ink-soft">
                {seeded
                  ? "「예시 미리보기」로 열립니다. 발급번호 자리에 「예시 — 발급되지 않음」이 들어가고, 파일 내려받기는 잠깁니다. 인쇄 미리보기까지 열어 보시면 종이에도 표시가 남는 것을 보실 수 있습니다."
                  : "지금은 「아직 이수한 훈련이 없습니다」 화면이 열리고, 인쇄와 파일 내려받기는 나타나지 않습니다."}
              </p>
            </li>
            <li className="py-[4px]">
              {/* 3번은 이동이 아니라 이 화면에서 하는 일이라 링크가 아닙니다 —
                  누를 곳이 없으므로 48px 타깃도 잡지 않습니다. */}
              <p className="pt-[10px] text-[0.8438rem] leading-[1.45] font-bold text-ink">
                <span className="chim-num">3</span>. 시연이 끝나면 이 화면으로 돌아와 지우기
              </p>
              <p className="mt-[3px] text-[0.7813rem] leading-[1.6] text-ink-soft">
                위 「예시 기록 지우기」를 누르시면 한 번 더 여쭙고 예시만 지웁니다. 기기를 넘겨
                드리기 전에 지우시면, 다음 분이 보시는 화면은 이 기기의 진짜 기록뿐입니다.
              </p>
            </li>
          </ol>
        </div>
      </section>

      {/* 시연 프리셋(?demo=) 진입점 — 예시 시드 바로 아래가 발표자 도구의 자리입니다.
          (/check/page.tsx는 다른 구역 파일이라 건드리지 않고 여기서 이어 붙입니다.) */}
      <DemoJumpPanel />
    </>
  );
}

export default DemoSeedPanel;
