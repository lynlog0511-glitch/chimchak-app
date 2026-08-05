import { Card } from "@/components";
import { RECORD_SLOT_LABELS, type RecordSlot } from "@/engine/record";
import type { StoredReport } from "@/lib/storage";
import {
  MASK_TOKEN_SPLIT,
  formatDateTime,
  formatElapsedDuration,
  isDisplayableElapsed,
  isMaskToken,
} from "./format";

export interface ReportListProps {
  reports: StoredReport[];
}

const SLOT_ORDER: RecordSlot[] = ["time", "who", "what", "action", "status"];

/** 가명처리 토큰만 강조합니다. 채움만 쓰고 보더는 두지 않습니다(§1-4). */
function TokenText({ text }: { text: string }) {
  const parts = text.split(MASK_TOKEN_SPLIT);
  return (
    <>
      {parts.map((part, index) =>
        isMaskToken(part) ? (
          <strong
            key={index}
            className="mx-0.5 rounded-chip bg-brand-100 px-1.5 py-0.5 font-extrabold text-brand-900"
          >
            {part}
          </strong>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}

/** 메타 항목 사이 구분점 — 세로 선 대신 점 하나로 둡니다(§1-2). 장식이므로 조용하게. */
function MetaDot() {
  return (
    <span aria-hidden="true" className="text-ink-muted/55">
      ·
    </span>
  );
}

/**
 * 확정한 기록 1건.
 *
 * 크기 체계(§3): 기록 본문과 5요소 값은 코어 콘텐츠라 17px, 라벨·메타는 13~14px 크롬입니다.
 * 형태(§1-5): 소요시간·통과 표기는 필(배지) 대신 작은 텍스트로 둡니다.
 */
function ReportItem({ report }: { report: StoredReport }) {
  const counts = Object.entries(report.maskedCounts ?? {}).filter(([, value]) => value > 0);

  return (
    <Card className="h-full">
      <div className="chim-caption flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold text-ink-muted">
        <span>{formatDateTime(report.createdAt)}</span>
        {isDisplayableElapsed(report.elapsedSec) && (
          <>
            <MetaDot />
            <span>{formatElapsedDuration(report.elapsedSec)} 만에 작성</span>
          </>
        )}
        <MetaDot />
        <span className="text-brand-800">가명처리 2단 통과</span>
      </div>

      {/* 확정한 기록 본문 — 보더 없이 옅은 면 위에 코어 크기로 둡니다. */}
      <p className="chim-core-sm mt-3 rounded-card bg-paper-2 p-4 leading-loose text-ink">
        <TokenText text={report.maskedText} />
      </p>

      {/* 가림 건수는 칩이 아니라 작은 텍스트 한 줄로 둡니다. */}
      {counts.length > 0 && (
        <ul className="chim-caption mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold text-ink-muted">
          {counts.map(([kind, value], index) => (
            <li key={kind} className="flex items-center gap-2">
              {index > 0 && <MetaDot />}
              <span>
                {kind} <span className="chim-num">{value}</span>곳 가림
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* 5요소는 표에 가까운 목록이라 상자 대신 hairline으로만 행을 나눕니다(§7). */}
      <dl className="chim-hairline mt-4">
        {SLOT_ORDER.map((slot) => {
          const value = report.draft[slot];
          return (
            <div key={slot} className="py-3 first:pt-0 last:pb-0">
              <dt className="chim-meta font-bold text-ink-muted">{RECORD_SLOT_LABELS[slot]}</dt>
              <dd className="chim-core-sm mt-1 text-ink">
                {value.trim().length > 0 ? (
                  <TokenText text={value} />
                ) : (
                  <span className="chim-meta font-semibold text-warn-ink">비어 있습니다</span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </Card>
  );
}

/**
 * 확정한 기록 목록.
 * 저장된 것은 가명처리를 마친 텍스트뿐이며, 원문·음성은 남아 있지 않습니다.
 */
export function ReportList({ reports }: ReportListProps) {
  return (
    <ul className="grid gap-4 lg:grid-cols-2">
      {reports.map((report) => (
        <li key={report.id}>
          <ReportItem report={report} />
        </li>
      ))}
    </ul>
  );
}

export default ReportList;
