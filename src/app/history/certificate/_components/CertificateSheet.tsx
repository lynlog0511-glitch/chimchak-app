"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BigButton, InlineDisclaimer, cx } from "@/components";
import { countDemoRecords } from "@/lib/demoSeed";
import { buildCompletionCsv, buildCompletionSummary, type CompletionSummary } from "@/lib/storage";
import { formatDate, formatDateTime } from "../../_components/format";
import { CompletionImportPanel } from "./CompletionImportPanel";

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
  /* 예시 표시는 종이에도 반드시 남아야 합니다 — 브라우저가 배경·연한 색을 지우지 못하게 못 박습니다. */
  [data-demo-watermark] {
    display: flex !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
`;

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
 * 이수 사실 파일을 이 기기에 내려받습니다.
 *
 * 파일을 만드는 곳은 브라우저 안이고 주소도 `blob:`이라 **외부로 나가는 요청이 없습니다**.
 * 담기는 것은 이수 사실뿐이며, 화면에 적으신 성명·소속은 파일에 넣지 않습니다(개인정보 최소).
 */
function downloadCsv(summary: CompletionSummary, issuedAt: string): void {
  const csv = buildCompletionCsv(summary, issuedAt);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `chimchak-completion-${summary.number}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
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
  const [summary, setSummary] = useState<CompletionSummary | null>(null);
  const [issuedAt, setIssuedAt] = useState("");
  /** 인쇄에만 실리는 값 — 저장하지 않습니다. */
  const [learnerName, setLearnerName] = useState("");
  const [learnerOrg, setLearnerOrg] = useState("");
  /**
   * 시연용 예시가 섞여 있는 동안에는 확인서가 **발급물이 아니라 미리보기**가 됩니다.
   * 여기서 켜지는 것: 워터마크(인쇄물 포함) · 「예시 — 발급되지 않음」 · 파일 내려받기 잠금.
   */
  const [demoCount, setDemoCount] = useState(0);

  useEffect(() => {
    setSummary(buildCompletionSummary());
    setIssuedAt(new Date().toISOString());
    setDemoCount(countDemoRecords().sessions);
    setLoaded(true);
  }, []);

  /** 이수 사실 파일을 합친 직후 — 합계·시수·발급번호가 모두 달라지므로 요약을 다시 읽습니다. */
  const handleImported = useCallback(() => {
    setSummary(buildCompletionSummary());
    setIssuedAt(new Date().toISOString());
  }, []);

  const isPreview = demoCount > 0;
  const lines = summary?.lines ?? [];
  const total = summary?.totalCount ?? 0;
  const totalSec = summary?.totalSec ?? 0;
  const hiddenCount = summary?.hiddenCount ?? 0;
  const importedCount = summary?.importedCount ?? 0;

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
          {/* 기기를 바꾸신 직후가 바로 이 빈 화면입니다 — 되돌려 넣는 칸이 여기 없으면
              「옮겨 두시면 됩니다」가 빈말이 됩니다. */}
          <CompletionImportPanel onImported={handleImported} />
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
            className={cx(
              "mt-4 rounded-[14px] border border-line-strong px-4 py-[18px]",
              isPreview && "relative overflow-hidden",
            )}
          >
            {/* 종이만 따로 돌아다녀도 예시인 줄 알아볼 수 있게 지면 자체에 표시를 얹습니다.
                읽어야 하는 문장은 아래 안내줄이 담당하므로 이 층은 장식으로 숨깁니다. */}
            {isPreview && (
              <div
                aria-hidden
                data-demo-watermark
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
              >
                <span className="rotate-[-24deg] text-[1.75rem] leading-none font-extrabold whitespace-nowrap text-warn-ink opacity-[0.16] md:text-[2.5rem]">
                  예시 — 발급되지 않음
                </span>
              </div>
            )}

            {isPreview && (
              <p className="mb-[12px] rounded-[12px] bg-warn-soft px-[12px] py-[10px] text-[0.875rem] leading-[1.7] font-bold text-warn-ink">
                예시 미리보기 — 시연용 예시 기록 {demoCount}회가 섞여 있습니다. 이 문서는 발급되지
                않았으며 증빙으로 쓸 수 없습니다. 성장 기록 위쪽 안내줄에서 예시를 지우시면 실제
                이수 사실로 다시 만들어집니다.
              </p>
            )}

            <h2 id="certificate-title" className="text-[1.125rem] leading-[1.35] font-extrabold text-ink">
              침착 훈련 이수 확인서
            </h2>
            <p className="mt-[3px] text-[0.7813rem] leading-[1.5] text-ink-soft">
              발급일 {formatDate(issuedAt)} · 이 기기에 저장된 기록으로 만들었습니다
            </p>

            {/* 자료철에 끼우는 문서라 번호와 발급주체가 있어야 대조·문의가 가능합니다.
                번호는 기록 집합에서 계산한 값이라 서버 없이도 재인쇄 시 같은 값이 나옵니다. */}
            <p className="mt-[8px] text-[0.8125rem] leading-[1.5] font-bold text-ink">
              발급번호{" "}
              {isPreview ? (
                <span className="text-warn-ink">예시 — 발급되지 않음</span>
              ) : (
                <span className="chim-num text-brand-800">{summary?.number ?? ""}</span>
              )}
            </p>
            {/* 번호가 무엇을 할 수 있고 무엇을 못 하는지 문서 스스로 적습니다 —
                자료철에 들어갈 종이가 자기 한계를 감추면, 감사에서 그 한계가 대신 발견됩니다. */}
            <p className="mt-[3px] text-[0.7813rem] leading-[1.6] text-ink-soft">
              {isPreview
                ? "예시 기록이 섞여 있는 동안에는 발급번호를 만들지 않습니다 — 대조할 원본이 실제 이수 사실이 아니기 때문입니다."
                : "같은 기록이면 재인쇄에도 같은 값이라 중복 제출 확인에 쓰실 수 있습니다. 다만 위조를 막는 장치는 아니며, 확인자 서명이 효력을 만듭니다."}
            </p>
            <p className="mt-[3px] text-[0.7813rem] leading-[1.6] text-ink-soft">
              발급: 침착(ChimChak) 훈련 앱 · 문의: 기관 도입 담당자 — 앱 안 「기관 도입 안내」
              화면에 절차를 적어 두었습니다.
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
            {/* 합계에 예시가 섞였다는 사실을 합계 바로 아래에서 밝힙니다 — 이 줄이 없으면
                숫자만 옮겨 적히고 예시라는 사실은 종이에서 사라집니다. */}
            {isPreview && (
              <p className="mt-[6px] text-[0.7813rem] leading-[1.7] font-bold text-warn-ink">
                이 합계에는 시연용 예시 <span className="chim-num">{demoCount}</span>회가 포함되어
                있습니다 — 이 기기의 실제 이수 시수 누계에는 반영되지 않은 회차입니다.
              </p>
            )}
            {/* 가져온 회차는 상세가 이 기기에 없지만 사유가 「50건 상한」과 다릅니다 —
                두 사유를 한 문장으로 뭉치면 종이가 사실과 다른 이유를 대게 됩니다. */}
            {importedCount > 0 && (
              <p className="mt-[6px] text-[0.7813rem] leading-[1.7] text-ink-soft">
                이 가운데 <span className="chim-num font-bold">{importedCount}</span>회는 다른
                기기의 이수 사실 파일에서 가져온 회차입니다 — 발급번호로 대조해 합쳤고, 같은
                번호는 두 번 더하지 않습니다. 가져온 회차의 상세는 이 기기에 남지 않습니다.
              </p>
            )}
            {/* 상세는 최근 50회까지만 남지만 합계·시수는 별도 누계로 세므로 줄지 않습니다.
                그 차이를 감추면 「목록을 세어 보니 합계와 다르다」가 됩니다. */}
            {hiddenCount > 0 && (
              <p className="mt-[6px] text-[0.7813rem] leading-[1.7] text-ink-soft">
                이 가운데 <span className="chim-num font-bold">{hiddenCount}</span>회는 상세가 이
                기기에 남아 있지 않습니다 — 최근 50회까지만 상세를 보관하고, 합계와 이수 시수는
                따로 누계로 세기 때문에 줄지 않습니다.
              </p>
            )}

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
              {/* 검증 책임이 어디에 있는지 문서 스스로 밝혀 둡니다 — 서버도 서명도 없는 문서라
                  「무엇을 근거로 확인하는가」에 종이 자체가 답해야 합니다. */}
              <p className="mt-[6px] text-[0.7813rem] leading-[1.7] text-ink-soft">
                이 확인서는 이수자 본인 기기에 남은 기록으로 만들어졌으며, 기관 확인자의 서명으로
                효력이 생깁니다.
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
            {/* 예시가 섞인 파일은 화면 표시를 잃은 채 자료철로 흘러갈 수 있어 내려받기를 잠급니다.
                인쇄물에는 워터마크가 남지만, CSV 한 장에는 남길 자리가 없습니다. */}
            {isPreview ? (
              <div className="mt-2 rounded-[14px] bg-paper-2 px-4 py-[14px]">
                <p className="text-[0.875rem] leading-[1.5] font-bold text-ink">
                  이수 사실 파일 내려받기는 잠겨 있습니다
                </p>
                <p className="mt-[4px] text-[0.8125rem] leading-[1.7] text-ink-soft">
                  예시가 섞인 파일이 증빙으로 돌아다니지 않도록 막아 두었습니다. 성장 기록 위쪽
                  안내줄에서 예시를 지우시면 다시 열립니다.
                </p>
              </div>
            ) : (
              <BigButton
                variant="secondary"
                block
                className="mt-2"
                onClick={() => {
                  if (summary) downloadCsv(summary, issuedAt);
                }}
              >
                이수 사실만 담긴 파일 내려받기
              </BigButton>
            )}
            <BigButton href="/history" variant="secondary" block className="mt-2">
              성장 기록으로 돌아가기
            </BigButton>
            <p className="mt-[10px] text-center text-[0.8125rem] leading-[1.6] text-ink-soft">
              성명·소속을 채우신 뒤 위 버튼을 누르시면 인쇄 창이 열립니다. 적으신 내용은 저장되지
              않습니다.
            </p>
            {!isPreview && (
              <p className="mt-[6px] text-center text-[0.8125rem] leading-[1.6] text-ink-soft">
                내려받는 파일에는 발급번호·시나리오·이수 횟수·이수 시수만 담깁니다 — 성명·소속과
                대화 내용은 들어가지 않습니다. 기기를 바꾸실 때 옮겨 두셨다가, 새 기기의 이 화면에서
                아래 칸으로 되돌려 넣으시면 됩니다.
              </p>
            )}

            <CompletionImportPanel onImported={handleImported} />
            <p className="mt-4 text-center">
              <Link
                href="/for-orgs"
                className="inline-flex min-h-[48px] items-center text-[0.8438rem] font-bold text-brand-700"
              >
                기관 담당자용 안내 보기 ›
              </Link>
            </p>
          </div>
        </div>
      )}
    </>
  );
}

export default CertificateSheet;
