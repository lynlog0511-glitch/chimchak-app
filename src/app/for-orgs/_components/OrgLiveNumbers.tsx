"use client";

import { useCallback, useEffect, useState } from "react";
import { formatTotalDuration } from "@/lib/duration";
import { BigButton, EyebrowLabel } from "@/components";
import { clearDemoRecords, hasDemoRecords, isDemoRecord, seedDemoRecords } from "@/lib/demoSeed";
import {
  buildCompletionSummary,
  loadCompletionTally,
  loadReports,
  loadSessions,
} from "@/lib/storage";
import { formatElapsedDuration, isDisplayableElapsed } from "../../history/_components/format";
import { HAND_WRITTEN_SOURCE, HAND_WRITTEN_TEXT } from "./assumptions";
import { OrgScaleCalculator } from "./OrgScaleCalculator";

/**
 * 기관 안내 화면의 「이 기기에서 잰 값」 패널.
 *
 * 여기 나오는 숫자는 **이 화면을 위해 새로 만든 값이 아니라**, 앱이 평소 재고 있는 값 그대로입니다.
 * 이수 시수는 확인서와 같은 계산(`buildCompletionSummary`)을, 기록 작성 소요는 확정한 보고에
 * 이미 저장돼 있는 `elapsedSec`를 씁니다. 없는 값은 없다고 적고 추정치로 채우지 않습니다.
 *
 * 외부 출처 요청 수는 브라우저의 리소스 타이밍을 그대로 읽습니다 — 이 패널 자체도 네트워크를 쓰지 않습니다.
 * 세는 것은 **교차 출처뿐**입니다(`countCrossOriginRequests`). 같은 주소의 `/api/coach`는 이 계수에
 * 잡히지 않으므로, 이 숫자를 「서버가 없다」의 근거로 쓰면 안 됩니다 — 무엇을 재는지와 무엇을
 * 증명하지 못하는지를 행 설명이 같은 자리에서 밝힙니다.
 *
 * 8/6 보강 — **빈 패널을 없애되 예시로 속이지 않는다.** 깨끗한 기기로 데모 주소만 받아 여신
 * 결재자에게는 세 줄 중 두 줄이 「아직 없음」이었고, 값을 채울 경로는 링크 없는 발표자 화면뿐이었습니다.
 * 그래서 이 패널에 예시 채우기·지우기를 두되, 예시가 있는 동안에는 경고줄을 그대로 켜 둡니다.
 * 실주행 값이 이미 있는 기기에서는 채우기 버튼을 아예 내보내지 않습니다 — 실측을 예시로 덮지 않습니다.
 */

interface LiveNumbers {
  /** 시연용 예시 기록이 섞여 있는가 — 참이면 패널이 그 사실을 함께 적습니다. */
  demoSeeded: boolean;
  /** 예시가 아닌 진짜 기록·보고·누계가 이 기기에 하나라도 있는가 */
  hasReal: boolean;
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


/** 이 기기의 값을 한 번에 읽어 옵니다 — 예시를 심거나 지운 직후에도 같은 함수로 다시 읽습니다. */
function readNumbers(): LiveNumbers {
  const summary = buildCompletionSummary();
  const sessions = loadSessions();
  const reports = loadReports();
  const elapsed = reports.map((report) => report.elapsedSec).filter(isDisplayableElapsed);
  const hasReal =
    sessions.some((row) => !isDemoRecord(row)) ||
    reports.some((row) => !isDemoRecord(row)) ||
    loadCompletionTally().count > 0;
  return {
    completionCount: summary.totalCount,
    completionSec: summary.totalSec,
    reportCount: elapsed.length,
    reportMedianSec: elapsed.length > 0 ? median(elapsed) : undefined,
    crossRequests: countCrossOriginRequests(),
    demoSeeded: hasDemoRecords(),
    hasReal,
  };
}

function Row({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <li className="py-[12px]">
      <EyebrowLabel>
        {label}
      </EyebrowLabel>
      <p className="mt-[4px] text-[1.0625rem] leading-[1.45] font-bold text-ink">{value}</p>
      <p className="mt-[3px] text-[0.8438rem] leading-[1.6] text-ink-soft">{note}</p>
    </li>
  );
}

export function OrgLiveNumbers() {
  const [numbers, setNumbers] = useState<LiveNumbers | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setNumbers(readNumbers());
  }, []);

  const handleSeed = useCallback(() => {
    const planted = seedDemoRecords();
    setNumbers(readNumbers());
    setNotice(
      planted.sessions.length > 0 || planted.reports.length > 0
        ? "예시 값을 채웠습니다. 아래 숫자는 실측이 아니라 예시이며, 「예시 지우기」로 되돌릴 수 있습니다."
        : "이 기기에 기록이 이미 가득 차 있어 예시를 넣지 않았습니다. 예시가 들어가면 진짜 기록이 밀려날 수 있습니다.",
    );
  }, []);

  const handleClear = useCallback(() => {
    clearDemoRecords();
    setNumbers(readNumbers());
    setNotice("예시를 지웠습니다. 이 기기의 진짜 기록과 이수 시수는 그대로입니다.");
  }, []);

  if (!numbers) {
    return (
      <p className="mt-[8px] text-[0.8438rem] leading-[1.6] text-ink-soft">
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
    demoSeeded,
    hasReal,
  } = numbers;

  return (
    <div>
      {demoSeeded && (
        <p className="mt-[8px] text-[0.8438rem] leading-[1.6] font-semibold text-warn-ink">
          지금은 예시 기록이 섞여 있는 값입니다. 아래 「예시 지우기」를 누르시면 실측만
          남습니다.
        </p>
      )}
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
              ? "훈련을 마친 회차에서 문항을 진행한 시간을 잰 값입니다. 이수 확인서에 그대로 실립니다(정지 구간은 문항당 3분까지, 한 회차는 30분까지만 셉니다)."
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
              ? `이 기기에서 확정한 ${reportCount}건의 중앙값입니다. 처음 적기 시작한 순간부터 확정까지를 앱이 직접 쟀습니다. 비교 기준 ${HAND_WRITTEN_TEXT}은 ${HAND_WRITTEN_SOURCE}`
              : `보고를 한 건 확정하시면 이 자리에 실측 소요가 찍힙니다. 비교 기준 ${HAND_WRITTEN_TEXT}은 ${HAND_WRITTEN_SOURCE}`
          }
        />
        <Row
          label="외부 출처로 나간 요청"
          value={crossRequests === undefined ? "잴 수 없는 브라우저" : `${crossRequests}건`}
          note={
            crossRequests === undefined
              ? "이 브라우저는 요청 계측을 지원하지 않습니다. 개발자도구 네트워크 탭으로 직접 확인해 주십시오."
              : "이 화면이 열린 뒤 다른 주소로 나간 요청 수입니다. 세는 것은 다른 주소뿐이라, 같은 주소의 침착 서버로 가는 요청은 여기에 잡히지 않습니다. 훈련의 대사 변주가 그 자리를 씁니다."
          }
        />
      </ul>

      {/* 값을 채울 경로 — 실주행 값이 있는 기기에는 채우기 버튼을 내보내지 않습니다.
          예시로 실측을 덮는 일이 없어야 이 패널이 계속 「잰 값」일 수 있습니다. */}
      {(!hasReal || demoSeeded) && (
        <div className="mt-[12px]">
          <div className="flex flex-wrap gap-2">
            {!hasReal && !demoSeeded && (
              <BigButton onClick={handleSeed} variant="secondary">
                예시 값으로 채워 보기
              </BigButton>
            )}
            {demoSeeded && (
              <BigButton onClick={handleClear} variant="secondary">
                예시 지우기
              </BigButton>
            )}
          </div>
          {!hasReal && !demoSeeded && (
            <p className="mt-[8px] text-[0.8438rem] leading-[1.6] text-ink-soft">
              아직 이 기기에서 훈련을 마친 적이 없어 두 줄이 비어 있습니다. 예시 값을 채우면 화면이
              어떻게 채워지는지 보실 수 있고, 채운 값은 예시로 표시되며 이수 확인서에는 발급번호가
              만들어지지 않습니다.
            </p>
          )}
          {notice.length > 0 && (
            <p
              aria-live="polite"
              className="mt-[8px] text-[0.8438rem] leading-[1.6] font-semibold text-ink"
            >
              {notice}
            </p>
          )}
        </div>
      )}

      <OrgScaleCalculator measuredSec={reportMedianSec} />

      <p className="mt-[10px] text-[0.8438rem] leading-[1.6] text-ink-soft">
        위 세 값은 지금 보고 계신 기기 한 대의 값입니다. 기관 전체 합계를 자동으로 모으는 관리자
        화면은 아직 없습니다. 지금은 각자 확인서를 인쇄하거나 이수 사실 파일을 내려받아 모으는
        방식이고, 받은 파일은 이수 확인서 화면에서 한 기기로 합치실 수 있습니다.
      </p>
    </div>
  );
}

export default OrgLiveNumbers;
