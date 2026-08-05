"use client";

import { useEffect, useRef, useState } from "react";
import type { SessionRecord } from "@/types";
import { BigButton, InlineDisclaimer } from "@/components";
import { loadSessions } from "@/lib/storage";
import { formatDate, formatDateTime } from "../../_components/format";

/**
 * 인쇄 전용 규칙 — 화면 껍데기(버튼·상단 바)를 빼고 확인서만 종이에 남깁니다.
 * 전역 CSS(`globals.css`)는 셸 팀 소유라 건드리지 않고, 이 화면에서만 쓰는 규칙을 여기 둡니다.
 */
const PRINT_CSS = `
@media print {
  @page { margin: 16mm; }
  html, body { background: #ffffff !important; }
  .chim-frame { background: #ffffff !important; }
  .chim-screen {
    max-width: none !important;
    min-height: 0 !important;
    border-inline: 0 !important;
  }
  .chim-pad { padding-inline: 0 !important; }
  [data-noprint] { display: none !important; }
  [data-print-sheet] {
    border: 0 !important;
    border-radius: 0 !important;
    padding: 0 !important;
  }
}
`;

/** 확인서 한 줄 — 시나리오 하나에 대한 이수 사실입니다(판정·대화는 담지 않습니다). */
interface CertificateLine {
  scenarioId: string;
  title: string;
  typeLabel: string;
  count: number;
  /** 가장 최근에 마친 시각 (ISO) */
  lastEndedAt: string;
}

/**
 * 회차 기록을 시나리오별 이수 사실로 접습니다.
 *
 * 남기는 것은 **시나리오·완료일·횟수** 세 가지뿐입니다 —
 * 판정(verdict)·엔딩·충족/코칭 문장·대화 내용은 어떤 형태로도 옮기지 않습니다.
 */
function buildLines(records: SessionRecord[]): CertificateLine[] {
  const map = new Map<string, CertificateLine>();
  for (const record of records) {
    const key = record.scenarioId.trim().toUpperCase();
    const at = record.endedAt || record.startedAt;
    const found = map.get(key);
    if (found) {
      found.count += 1;
      if (new Date(at).getTime() > new Date(found.lastEndedAt).getTime()) {
        found.lastEndedAt = at;
      }
      continue;
    }
    map.set(key, {
      scenarioId: key,
      title: record.scenarioTitle,
      typeLabel: record.typeLabel,
      count: 1,
      lastEndedAt: at,
    });
  }
  return [...map.values()].sort(
    (a, b) => new Date(b.lastEndedAt).getTime() - new Date(a.lastEndedAt).getTime(),
  );
}

/**
 * 이수 확인서 — 인쇄용 화면 (v4 §3 성장).
 *
 * 「이수 확인서 만들기」에서 넘어오면 확인서를 그리고 곧바로 인쇄 창을 엽니다.
 * 종이에 남는 것은 **이수 사실뿐**입니다 — 시나리오·완료일·이수 횟수까지이고,
 * 판정 결과와 대화 내용은 담기지 않습니다.
 */
export function CertificateSheet() {
  const [loaded, setLoaded] = useState(false);
  const [lines, setLines] = useState<CertificateLine[]>([]);
  const [issuedAt, setIssuedAt] = useState("");
  const printedRef = useRef(false);

  useEffect(() => {
    const records = loadSessions();
    setLines(buildLines(records));
    setIssuedAt(new Date().toISOString());
    setLoaded(true);
  }, []);

  /** 확인서가 다 그려진 다음에 한 번만 인쇄 창을 엽니다(개발 모드의 이중 실행도 막습니다). */
  useEffect(() => {
    if (!loaded || printedRef.current || lines.length === 0) return;
    printedRef.current = true;
    const timer = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(timer);
  }, [loaded, lines.length]);

  const total = lines.reduce((sum, line) => sum + line.count, 0);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      {!loaded ? (
        <p className="mt-4 text-[12.5px] leading-[1.6] text-tertiary">
          이 기기에 저장된 이수 사실을 불러오는 중입니다.
        </p>
      ) : lines.length === 0 ? (
        <div className="mt-4">
          <div className="rounded-[14px] bg-paper-2 px-4 py-[14px]">
            <p className="text-[14.5px] leading-[1.5] font-bold text-ink">
              아직 이수한 훈련이 없습니다
            </p>
            <p className="mt-[3px] text-[12.5px] leading-[1.6] text-ink-soft">
              시나리오를 하나 마치시면 이 자리에 시나리오·완료일·이수 횟수가 담긴 확인서가
              만들어집니다.
            </p>
          </div>
          <BigButton href="/train" size="lg" block className="mt-4">
            훈련 시작하기
          </BigButton>
          <BigButton href="/history" variant="secondary" block className="mt-2">
            성장 기록으로 돌아가기
          </BigButton>
          <InlineDisclaimer size="md" tone="readable" className="mt-6 mb-3" />
        </div>
      ) : (
        <div className="mt-4">
          <section
            data-print-sheet
            aria-labelledby="certificate-title"
            className="rounded-[14px] border border-line-strong px-4 py-[18px]"
          >
            <h2 id="certificate-title" className="text-[18px] leading-[1.35] font-extrabold text-ink">
              침착 훈련 이수 확인서
            </h2>
            <p className="mt-[3px] text-[12px] leading-[1.5] text-tertiary">
              발급일 {formatDate(issuedAt)} · 이 기기에 저장된 기록으로 만들었습니다
            </p>

            <p className="mt-[14px] text-[13.5px] leading-[1.7] text-ink-soft">
              아래 시나리오를 끝까지 진행하셨음을 확인합니다. 합계{" "}
              <span className="chim-num font-bold text-brand-800">{total}</span>회 ·{" "}
              <span className="chim-num font-bold text-brand-800">{lines.length}</span>종입니다.
            </p>

            <ul className="chim-hairline mt-[14px] border-t border-line">
              {lines.map((line) => (
                <li key={line.scenarioId} className="py-[12px]">
                  <p className="text-[12px] leading-[1.4] text-tertiary">
                    <span className="chim-num">{line.scenarioId}</span> · {line.typeLabel}
                  </p>
                  <p className="mt-[2px] text-[15px] leading-[1.4] font-bold text-ink">
                    {line.title}
                  </p>
                  <p className="mt-[3px] text-[12.5px] leading-[1.6] text-ink-soft">
                    이수 <span className="chim-num font-bold">{line.count}</span>회 · 최근 완료{" "}
                    {formatDateTime(line.lastEndedAt)}
                  </p>
                </li>
              ))}
            </ul>

            <div className="mt-[16px] border-t border-line pt-[12px]">
              <p className="text-[12px] leading-[1.7] text-ink-soft">
                이 확인서에는 이수 사실만 담습니다 — 판정 결과와 대화 내용은 포함하지 않으며,
                말씀하신 발화 원문은 저장하지 않습니다.
              </p>
              <p className="mt-[4px] text-[12px] leading-[1.7] text-ink-soft">
                훈련 시나리오의 인물·기관은 전원 가상이고 대사는 AI가 생성한 문장입니다. 실제
                인물·기관과 무관합니다.
              </p>
              <InlineDisclaimer size="md" tone="readable" className="mt-[10px]" />
            </div>
          </section>

          <div data-noprint>
            <BigButton onClick={() => window.print()} size="lg" block className="mt-4">
              인쇄하기 · PDF로 저장
            </BigButton>
            <BigButton href="/history" variant="secondary" block className="mt-2">
              성장 기록으로 돌아가기
            </BigButton>
            <p className="mt-[10px] text-center text-[11.5px] leading-[1.5] text-tertiary">
              인쇄 창이 바로 열립니다. 닫으셨다면 위 버튼으로 다시 여실 수 있습니다.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

export default CertificateSheet;
