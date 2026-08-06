"use client";

import { useEffect, useState } from "react";
import { buildCompletionSummary, loadReports } from "@/lib/storage";
import { formatElapsedDuration, isDisplayableElapsed } from "../../history/_components/format";

/**
 * 기관 안내 화면의 「이 기기에서 잰 값」 패널.
 *
 * 여기 나오는 숫자는 **이 화면을 위해 새로 만든 값이 아니라**, 앱이 평소 재고 있는 값 그대로입니다.
 * 이수 시수는 확인서와 같은 계산(`buildCompletionSummary`)을, 기록 작성 소요는 확정한 보고에
 * 이미 저장돼 있는 `elapsedSec`를 씁니다. 없는 값은 없다고 적고 추정치로 채우지 않습니다.
 *
 * 외부 요청 수는 브라우저의 리소스 타이밍을 그대로 읽습니다 — 이 패널 자체도 네트워크를 쓰지 않습니다.
 */

/** 손으로 기록지를 쓸 때 걸리는 시간 — 현직 인터뷰 실측(보고 확정 화면과 같은 기준). */
const HAND_WRITTEN_TEXT = "20~30분";

interface LiveNumbers {
  completionCount: number;
  completionSec: number;
  reportCount: number;
  /** 확정한 보고의 입력→확정 소요 중앙값(초). 잰 회차가 없으면 undefined */
  reportMedianSec?: number;
  /** 외부 출처로 나간 요청 수 — 셀 수 없는 브라우저면 undefined */
  crossRequests?: number;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] as number;
  return Math.round((((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2) * 10) / 10;
}

/** 이 화면이 열린 뒤 브라우저가 실제로 보낸 요청 중 다른 출처로 나간 건수. */
function countCrossOriginRequests(): number | undefined {
  if (typeof performance === "undefined" || typeof performance.getEntriesByType !== "function") {
    return undefined;
  }
  try {
    const selfOrigin = window.location.origin;
    let cross = 0;
    for (const entry of performance.getEntriesByType("resource")) {
      const name = entry.name;
      if (!name || name.startsWith("data:") || name.startsWith("blob:")) continue;
      try {
        const url = new URL(name, selfOrigin);
        if (url.protocol !== "http:" && url.protocol !== "https:") continue;
        if (url.origin !== selfOrigin) cross += 1;
      } catch {
        /* 주소를 읽지 못한 항목은 세지 않습니다 */
      }
    }
    return cross;
  } catch {
    return undefined;
  }
}

/** 「약 N시간 N분」 — 확인서의 총 이수 시수와 같은 표기입니다. */
function formatTotalDuration(totalSec: number): string {
  const minutes = Math.round(totalSec / 60);
  if (minutes < 1) return "약 1분 미만";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `약 ${hours}시간 ${rest}분` : `약 ${rest}분`;
}

function Row({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <li className="py-[12px]">
      <p className="text-[0.75rem] leading-[1.5] font-bold tracking-[0.06em] text-ink-muted">
        {label}
      </p>
      <p className="mt-[4px] text-[1rem] leading-[1.45] font-bold text-ink">{value}</p>
      <p className="mt-[3px] text-[0.8438rem] leading-[1.7] text-ink-soft">{note}</p>
    </li>
  );
}

export function OrgLiveNumbers() {
  const [numbers, setNumbers] = useState<LiveNumbers | null>(null);

  useEffect(() => {
    const summary = buildCompletionSummary();
    const elapsed = loadReports()
      .map((report) => report.elapsedSec)
      .filter(isDisplayableElapsed);
    setNumbers({
      completionCount: summary.totalCount,
      completionSec: summary.totalSec,
      reportCount: elapsed.length,
      reportMedianSec: elapsed.length > 0 ? median(elapsed) : undefined,
      crossRequests: countCrossOriginRequests(),
    });
  }, []);

  if (!numbers) {
    return (
      <p className="mt-[8px] text-[0.8125rem] leading-[1.6] text-ink-soft">
        이 기기에 남은 값을 읽는 중입니다.
      </p>
    );
  }

  const {
    completionCount,
    completionSec,
    reportCount,
    reportMedianSec,
    crossRequests,
  } = numbers;

  return (
    <div>
      <ul className="chim-hairline mt-[8px] border-y border-line">
        <Row
          label="이수 시수"
          value={
            completionCount > 0
              ? `${completionCount}회 · ${formatTotalDuration(completionSec)}`
              : "아직 없음"
          }
          note={
            completionCount > 0
              ? "훈련을 마친 회차의 시작·종료 시각으로 잰 값입니다. 이수 확인서에 그대로 실립니다(회차당 30분까지만 셉니다)."
              : "훈련을 한 번 마치시면 이 자리에 실측 이수 시수가 찍히고, 같은 값이 이수 확인서로 인쇄됩니다."
          }
        />
        <Row
          label="기록 한 건 작성 시간"
          value={
            reportMedianSec !== undefined
              ? `${formatElapsedDuration(Math.round(reportMedianSec))} · 손으로 쓰면 ${HAND_WRITTEN_TEXT}`
              : `아직 없음 · 손으로 쓰면 ${HAND_WRITTEN_TEXT}`
          }
          note={
            reportMedianSec !== undefined
              ? `이 기기에서 확정한 ${reportCount}건의 중앙값입니다 — 처음 적기 시작한 순간부터 확정까지를 앱이 직접 쟀습니다. 비교 기준 ${HAND_WRITTEN_TEXT}은 현직 인터뷰 실측치입니다.`
              : `보고를 한 건 확정하시면 이 자리에 실측 소요가 찍힙니다. 비교 기준 ${HAND_WRITTEN_TEXT}은 현직 인터뷰 실측치입니다.`
          }
        />
        <Row
          label="외부로 나간 요청"
          value={crossRequests === undefined ? "잴 수 없는 브라우저" : `${crossRequests}건`}
          note={
            crossRequests === undefined
              ? "이 브라우저는 요청 계측을 지원하지 않습니다. 개발자도구 네트워크 탭으로 직접 확인해 주십시오."
              : "이 화면이 열린 뒤 다른 출처로 나간 요청 수입니다. 서버·계정·외부 API가 없으므로 훈련·응급·보고 어디에서도 늘지 않습니다."
          }
        />
      </ul>
      <p className="mt-[10px] text-[0.8438rem] leading-[1.7] text-ink-soft">
        위 세 값은 지금 보고 계신 기기 한 대의 값입니다. 기관 전체 합계를 자동으로 모으는 관리자
        화면은 아직 없습니다 — 지금은 각자 확인서를 인쇄하거나 이수 사실 파일을 내려받아 모으는
        방식입니다.
      </p>
    </div>
  );
}

export default OrgLiveNumbers;
