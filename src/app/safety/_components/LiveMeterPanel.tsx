"use client";

import { cx } from "@/components/utils";
import { countStoredProtocols, useLiveProof } from "./useLiveProof";

/**
 * 「지금 이 기기에서 — 실시간 계측」 요약 패널 (시안 7b 상단).
 *
 * 주장을 읽기 전에 **숫자부터** 보이는 자리입니다 — 두 칸뿐이고, 둘 다 실측치입니다.
 *  · 외부 출처 요청 N건  — 이 화면이 열린 뒤 다른 주소로 나간 요청 수
 *  · 기기에 저장된 응급 안내 N종 — 캐시에 실제로 들어 있는 응급 프로토콜 화면 수
 *
 * 계측은 `useLiveProof`가 합니다(상세 패널과 같은 값). 이 조각은 그리기만 합니다.
 * 값을 아직 재지 못한 첫 렌더에서는 `0`이 아니라 `—`를 씁니다 — 재기 전의 0은 사실이 아니니까요.
 *
 * px는 시안 그대로입니다: 면 r14 · 점 7px · 제목 12.5/700 · 숫자 22px tabular · 라벨 11.5px.
 */

export interface LiveMeterPanelProps {
  className?: string;
}

function MeterCell({
  value,
  unit,
  label,
  tone = "ink",
}: {
  value: string;
  unit: string;
  label: string;
  tone?: "ink" | "danger";
}) {
  return (
    <div className="min-w-0 flex-1 rounded-[10px] bg-paper px-[12px] py-[10px]">
      <p
        className={cx(
          "chim-num text-[1.375rem] leading-[1.2] font-extrabold tracking-[-0.02em]",
          tone === "danger" ? "text-danger-ink" : "text-ink",
        )}
      >
        {value}
        <span className="text-[0.75rem] font-semibold text-ink-muted"> {unit}</span>
      </p>
      <p className="mt-[1px] text-[0.7188rem] leading-[1.5] text-ink-muted">{label}</p>
    </div>
  );
}

export function LiveMeterPanel({ className }: LiveMeterPanelProps) {
  const { mounted, timingSupported, counts, cache } = useLiveProof();

  const clean = counts.cross === 0;
  const measuring = !mounted || cache.status === "measuring";
  const stored = countStoredProtocols(cache);

  const crossValue = mounted && timingSupported ? String(counts.cross) : "—";
  const storedValue = measuring ? "—" : String(stored);

  return (
    <section
      id="live-proof"
      aria-labelledby="live-meter-title"
      className={cx("rounded-[14px] bg-paper-2 px-[15px] py-[14px]", className)}
    >
      <div className="flex items-center gap-[6px]">
        <span
          aria-hidden
          className={cx(
            "h-[7px] w-[7px] flex-none rounded-chip",
            clean ? "bg-ok" : "bg-danger",
          )}
        />
        <h2 id="live-meter-title" className="text-[0.7813rem] leading-[1.5] font-bold text-ink">
          지금 이 기기에서 — 실시간 계측
        </h2>
      </div>

      <div className="mt-[9px] flex gap-[8px]" role="status" aria-live="polite">
        <MeterCell
          value={crossValue}
          unit="건"
          label="외부 출처 요청"
          tone={clean ? "ink" : "danger"}
        />
        <MeterCell value={storedValue} unit="종" label="기기에 저장된 응급 안내" />
      </div>

      {mounted && !clean && (
        <p className="mt-[8px] text-[0.7188rem] leading-[1.55] font-bold text-danger-ink">
          외부 출처 요청이 잡혔습니다 — 감추지 않고 아래 「데이터」 항목에 그대로 나열합니다.
        </p>
      )}

      {mounted && !measuring && stored === 0 && (
        <p className="mt-[8px] text-[0.7188rem] leading-[1.55] text-tertiary">
          지금 이 실행에서는 아직 저장 전입니다 — 응급 안내 저장은 프로덕션 실행에서 이뤄집니다.
        </p>
      )}

      <p className="mt-[8px] text-[0.7188rem] leading-[1.55] text-tertiary">
        의심되시면 개발자도구 네트워크 탭을 함께 봐 주세요
      </p>
    </section>
  );
}

export default LiveMeterPanel;
