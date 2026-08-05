"use client";

import { useEffect, useState } from "react";
import type { SessionRecord } from "@/types";
import { BigButton, InlineDisclaimer, cx } from "@/components";
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

/** 한 회차를 이수 시간으로 셀 때의 상한 — 자리를 비우고 방치한 회차가 시수를 부풀리지 않게 합니다. */
const MAX_SESSION_SEC = 30 * 60;

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
 * 회차 하나의 이수 시간(초).
 *
 * `endedAt − startedAt`이고, 회차당 30분을 넘으면 30분까지만 셉니다 —
 * 화면을 열어 둔 채 자리를 비운 회차가 「시수」를 부풀리는 것을 막기 위해서입니다.
 * 시각이 없거나 거꾸로면 0으로 둡니다.
 *
 * @example sessionSeconds({ startedAt: "...T10:00:00Z", endedAt: "...T10:04:00Z" }) // 240
 */
function sessionSeconds(record: SessionRecord): number {
  const start = new Date(record.startedAt).getTime();
  const end = new Date(record.endedAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  const sec = Math.round((end - start) / 1000);
  if (sec <= 0) return 0;
  return Math.min(sec, MAX_SESSION_SEC);
}

/**
 * 총 이수 시수 표기 — 「약 N시간 N분」.
 *
 * 증빙 서식은 언제나 시간 단위로 묻는데 「N회」는 그 칸에 옮겨 적을 수 없습니다.
 * 반올림한 값이라 「약」을 떼지 않습니다. 0초 이하는 호출부에서 먼저 걸러 씁니다.
 *
 * @example formatTotalDuration(4530) // "약 1시간 16분"
 * @example formatTotalDuration(720)  // "약 12분"
 */
function formatTotalDuration(totalSec: number): string {
  const minutes = Math.round(totalSec / 60);
  if (minutes < 1) return "약 1분 미만";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `약 ${hours}시간 ${rest}분` : `약 ${rest}분`;
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
 * 종이에 인쇄되는 기입 칸 — 값이 있으면 값을, 없으면 **빈 밑줄**을 인쇄합니다.
 * 비워 두고 손으로 적어도 되도록 밑줄은 언제나 남깁니다.
 */
function FillField({
  label,
  value,
  className,
}: {
  label: string;
  value?: string;
  className?: string;
}) {
  const filled = (value ?? "").trim();
  return (
    <span className={cx("flex min-w-0 items-baseline gap-[8px]", className)}>
      <span className="flex-none text-[0.75rem] leading-[1.5] font-bold text-ink-muted">{label}</span>
      {/* 빈 칸일 때 들어가는 것은 줄바꿈 없는 공백(U+00A0) 하나입니다 —
          밑줄의 높이를 잃지 않게 두는 자리이고, 손으로 적으실 칸입니다. */}
      <span className="min-w-[80px] flex-1 border-b border-ink-muted pb-[3px] text-[0.875rem] leading-[1.5] font-bold text-ink">
        {filled.length > 0 ? filled : " "}
      </span>
    </span>
  );
}

/**
 * 이수 확인서 — 인쇄용 화면 (v4 §3 성장).
 *
 * 「이수 확인서 만들기」에서 넘어오면 확인서를 그립니다. 종이에 남는 것은 **이수 사실뿐**입니다 —
 * 시나리오·완료일·이수 횟수·이수 시수까지이고, 판정 결과와 대화 내용은 담기지 않습니다.
 *
 * 성명·소속은 인쇄 직전에 이 화면에서만 받습니다. 상태로만 들고 있다가 인쇄에 실어 보내고,
 * 저장소에는 쓰지 않습니다 — 화면을 닫으면 사라집니다(개인정보 최소수집).
 * 그래서 화면을 열자마자 인쇄 창을 띄우지 않고, 채워 넣은 뒤 직접 누르시게 두었습니다.
 */
export function CertificateSheet() {
  const [loaded, setLoaded] = useState(false);
  const [lines, setLines] = useState<CertificateLine[]>([]);
  const [issuedAt, setIssuedAt] = useState("");
  const [totalSec, setTotalSec] = useState(0);
  /** 인쇄에만 실리는 값 — 저장하지 않습니다. */
  const [learnerName, setLearnerName] = useState("");
  const [learnerOrg, setLearnerOrg] = useState("");

  useEffect(() => {
    const records = loadSessions();
    setLines(buildLines(records));
    setTotalSec(records.reduce((sum, record) => sum + sessionSeconds(record), 0));
    setIssuedAt(new Date().toISOString());
    setLoaded(true);
  }, []);

  const total = lines.reduce((sum, line) => sum + line.count, 0);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      {!loaded ? (
        <p className="mt-4 text-[0.8125rem] leading-[1.6] text-ink-soft">
          이 기기에 저장된 이수 사실을 불러오는 중입니다.
        </p>
      ) : lines.length === 0 ? (
        <div className="mt-4">
          <div className="rounded-[14px] bg-paper-2 px-4 py-[14px]">
            <p className="text-[0.9063rem] leading-[1.5] font-bold text-ink">
              아직 이수한 훈련이 없습니다
            </p>
            <p className="mt-[3px] text-[0.8125rem] leading-[1.6] text-ink-soft">
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
          {/* 인쇄 직전 기입란 — 여기 적은 값은 종이에만 실리고 저장되지 않습니다.
              확인서 시트가 보더 1px 카드라 이 블록은 면을 깔지 않습니다(가이드 §3 — 한 화면에서 혼용 금지). */}
          <div data-noprint className="border-b border-line px-[2px] pb-[18px]">
            <p className="text-[0.875rem] leading-[1.5] font-bold text-ink">
              인쇄 전에 성명·소속을 채우실 수 있습니다
            </p>
            <p className="mt-[4px] text-[0.8125rem] leading-[1.7] text-ink-soft">
              여기 적으신 내용은 <b className="font-bold text-ink">저장되지 않습니다</b> — 이 화면의
              인쇄에만 실리고, 화면을 닫으면 사라집니다. 비워 두시면 확인서에 빈 밑줄로 인쇄되어
              손으로 적으실 수 있습니다.
            </p>

            <div className="mt-[12px] flex flex-col gap-[12px] sm:flex-row">
              <div className="min-w-0 flex-1">
                <label
                  htmlFor="certificate-name"
                  className="text-[0.8125rem] leading-[1.5] font-bold text-ink"
                >
                  성명
                </label>
                <input
                  id="certificate-name"
                  type="text"
                  value={learnerName}
                  onChange={(event) => setLearnerName(event.target.value)}
                  autoComplete="off"
                  placeholder="이수하신 분 성함"
                  className="mt-[6px] min-h-[48px] w-full rounded-[14px] border border-line-strong bg-white px-[13px] text-[0.9375rem] leading-[1.6] text-ink placeholder:text-tertiary focus:border-brand-400 focus:outline-none"
                />
              </div>
              <div className="min-w-0 flex-1">
                <label
                  htmlFor="certificate-org"
                  className="text-[0.8125rem] leading-[1.5] font-bold text-ink"
                >
                  소속
                </label>
                <input
                  id="certificate-org"
                  type="text"
                  value={learnerOrg}
                  onChange={(event) => setLearnerOrg(event.target.value)}
                  autoComplete="off"
                  placeholder="예) ○○주야간보호센터"
                  className="mt-[6px] min-h-[48px] w-full rounded-[14px] border border-line-strong bg-white px-[13px] text-[0.9375rem] leading-[1.6] text-ink placeholder:text-tertiary focus:border-brand-400 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <section
            data-print-sheet
            aria-labelledby="certificate-title"
            className="mt-4 rounded-[14px] border border-line-strong px-4 py-[18px]"
          >
            <h2 id="certificate-title" className="text-[1.125rem] leading-[1.35] font-extrabold text-ink">
              침착 훈련 이수 확인서
            </h2>
            <p className="mt-[3px] text-[0.7813rem] leading-[1.5] text-ink-soft">
              발급일 {formatDate(issuedAt)} · 이 기기에 저장된 기록으로 만들었습니다
            </p>

            {/* 누가 이수했는지 — 이 두 칸이 없으면 자료철에 끼울 수 없는 무기명 인쇄물이 됩니다. */}
            <div className="mt-[14px] flex flex-col gap-[12px] border-t border-line pt-[14px] sm:flex-row sm:gap-[20px]">
              <FillField label="성명" value={learnerName} className="flex-1" />
              <FillField label="소속" value={learnerOrg} className="flex-1" />
            </div>

            <p className="mt-[14px] text-[0.8438rem] leading-[1.7] text-ink-soft">
              아래 시나리오를 끝까지 진행하셨음을 확인합니다. 합계{" "}
              <span className="chim-num font-bold text-brand-800">{total}</span>회 ·{" "}
              <span className="chim-num font-bold text-brand-800">{lines.length}</span>종입니다.
            </p>
            {/* 증빙 서식은 언제나 시간으로 묻습니다 — 「N회」만으로는 옮겨 적을 칸이 없습니다. */}
            <p className="mt-[6px] text-[0.8438rem] leading-[1.7] text-ink-soft">
              {totalSec > 0 ? (
                <>
                  총 이수 시수{" "}
                  <span className="chim-num font-bold text-brand-800">
                    {formatTotalDuration(totalSec)}
                  </span>
                  입니다.
                </>
              ) : (
                <>총 이수 시수는 이 기기에 남은 시각으로는 계산되지 않았습니다.</>
              )}
            </p>

            <ul className="chim-hairline mt-[14px] border-t border-line">
              {lines.map((line) => (
                <li key={line.scenarioId} className="py-[12px]">
                  <p className="text-[0.75rem] leading-[1.4] text-ink-muted">
                    <span className="chim-num">{line.scenarioId}</span> · {line.typeLabel}
                  </p>
                  <p className="mt-[2px] text-[0.9375rem] leading-[1.4] font-bold text-ink">
                    {line.title}
                  </p>
                  <p className="mt-[3px] text-[0.7813rem] leading-[1.6] text-ink-soft">
                    이수 <span className="chim-num font-bold">{line.count}</span>회 · 최근 완료{" "}
                    {formatDateTime(line.lastEndedAt)}
                  </p>
                </li>
              ))}
            </ul>

            {/* 서명란 — 종이로 오가는 서식이라 확인자·일자 칸을 비워 인쇄합니다. */}
            <div className="mt-[16px] border-t border-line pt-[14px]">
              <p className="text-[0.8125rem] leading-[1.5] font-bold text-ink">
                위 이수 사실을 확인합니다
              </p>
              <div className="mt-[12px] flex flex-col gap-[14px] sm:flex-row sm:gap-[20px]">
                <FillField label="확인자 서명" className="flex-1" />
                <FillField label="일자" className="flex-1" />
              </div>
            </div>

            <div className="mt-[16px] border-t border-line pt-[12px]">
              <p className="text-[0.7813rem] leading-[1.7] font-bold text-ink">
                본 확인서는 앱 기록 기반이며 법정 보수교육 이수 인정이 아닙니다 — 기관 자체
                직무교육·정기평가 내부 증빙용입니다.
              </p>
              <p className="mt-[6px] text-[0.7813rem] leading-[1.7] text-ink-soft">
                총 이수 시수는 이 기기에 남은 시작·종료 시각으로 계산한 실측치이며, 한 회차가 30분을
                넘으면 30분까지만 셉니다.
              </p>
              <p className="mt-[6px] text-[0.7813rem] leading-[1.7] text-ink-soft">
                이 확인서에는 이수 사실만 담습니다 — 판정 결과와 대화 내용은 포함하지 않으며,
                말씀하신 발화 원문은 저장하지 않습니다.
              </p>
              <p className="mt-[6px] text-[0.7813rem] leading-[1.7] text-ink-soft">
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
            <p className="mt-[10px] text-center text-[0.8125rem] leading-[1.6] text-ink-soft">
              성명·소속을 채우신 뒤 위 버튼을 누르시면 인쇄 창이 열립니다. 적으신 내용은 저장되지
              않습니다.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

export default CertificateSheet;
