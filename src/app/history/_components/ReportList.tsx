import { Badge, Card } from "@/components";
import { RECORD_SLOT_LABELS, type RecordSlot } from "@/engine/record";
import type { StoredReport } from "@/lib/storage";
import { MASK_TOKEN_SPLIT, formatDateTime, isMaskToken } from "./format";

export interface ReportListProps {
  reports: StoredReport[];
}

const SLOT_ORDER: RecordSlot[] = ["time", "who", "what", "action", "status"];

/** 가명처리 토큰만 강조합니다. */
function TokenText({ text }: { text: string }) {
  const parts = text.split(MASK_TOKEN_SPLIT);
  return (
    <>
      {parts.map((part, index) =>
        isMaskToken(part) ? (
          <strong
            key={index}
            className="mx-0.5 rounded-chip border border-brand-300 bg-brand-100 px-2 py-0.5 font-extrabold text-brand-900"
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

/** 확정한 기록 1건. */
function ReportItem({ report }: { report: StoredReport }) {
  const counts = Object.entries(report.maskedCounts ?? {}).filter(([, value]) => value > 0);

  return (
    <Card className="h-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink-muted">{formatDateTime(report.createdAt)}</p>
        <Badge tone="brand">가명처리 2단 통과</Badge>
      </div>

      <p className="mt-3 rounded-card border border-line bg-paper-2/70 p-4 text-base leading-loose text-ink">
        <TokenText text={report.maskedText} />
      </p>

      {counts.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {counts.map(([kind, value]) => (
            <li
              key={kind}
              className="rounded-chip border border-line bg-white px-3 py-1 text-sm font-semibold text-ink-soft"
            >
              {kind} {value}곳 가림
            </li>
          ))}
        </ul>
      )}

      <dl className="mt-4 divide-y divide-line rounded-card border border-line bg-white">
        {SLOT_ORDER.map((slot) => {
          const value = report.draft[slot];
          return (
            <div key={slot} className="px-4 py-3">
              <dt className="text-sm font-bold text-ink-muted">{RECORD_SLOT_LABELS[slot]}</dt>
              <dd className="mt-1 text-base leading-relaxed text-ink">
                {value.trim().length > 0 ? (
                  <TokenText text={value} />
                ) : (
                  <span className="font-semibold text-warn-ink">비어 있습니다</span>
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
