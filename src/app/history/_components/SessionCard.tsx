import type { SessionRecord } from "@/types";
import { Badge, BigButton, Card } from "@/components";
import { formatDateTime, verdictNote, verdictTone } from "./format";

export interface SessionCardProps {
  record: SessionRecord;
}

/**
 * 훈련 세션 1건 카드.
 * 표시는 🟢 충족 목록 · ⚪ 코칭 요약 · 판정 문구까지이며, 점수·등급·순위·백분위는 표시하지 않습니다.
 */
export function SessionCard({ record }: SessionCardProps) {
  const hasGreen = record.greenChecks.length > 0;
  const hasCoaching = record.coachingPoints.length > 0;

  return (
    <Card className="h-full">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink-muted">
            {formatDateTime(record.startedAt)}
          </p>
          <h3 className="mt-1 text-lg font-extrabold text-ink">{record.scenarioTitle}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{record.typeLabel}</Badge>
          <Badge tone={verdictTone(record.verdict)} size="md">
            {record.verdict}
          </Badge>
        </div>
      </div>

      <p className="mt-3 rounded-field border border-line bg-paper-2/70 px-4 py-3 text-base leading-relaxed text-ink">
        <span className="font-bold">{record.endingTitle}</span>
        <span className="mt-1 block text-ink-soft">{verdictNote(record.verdict)}</span>
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-base font-extrabold text-ok-ink">🟢 충족한 것</p>
          {hasGreen ? (
            <ul className="mt-2 space-y-2">
              {record.greenChecks.map((item, index) => (
                <li
                  key={`${record.id}-green-${index}`}
                  className="rounded-field border border-ok-line bg-ok-soft px-3.5 py-2.5 text-base leading-relaxed text-ink"
                >
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-base leading-relaxed text-ink-soft">
              이번 회차에는 기록된 충족 항목이 없습니다. 같은 상황을 한 번 더 연습해 보세요.
            </p>
          )}
        </div>

        <div>
          <p className="text-base font-extrabold text-ink-soft">⚪ 다음에 살려 볼 것</p>
          {hasCoaching ? (
            <ul className="mt-2 space-y-2">
              {record.coachingPoints.map((item, index) => (
                <li
                  key={`${record.id}-coach-${index}`}
                  className="rounded-field border border-line bg-white px-3.5 py-2.5 text-base leading-relaxed text-ink"
                >
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-base leading-relaxed text-ink-soft">
              따로 코칭이 남지 않았습니다. 흐름을 잘 지키셨습니다.
            </p>
          )}
        </div>
      </div>

      {record.cfCount > 0 && (
        <p className="mt-4 rounded-field border border-danger-line bg-danger-soft px-4 py-3 text-base leading-relaxed font-bold text-danger-ink">
          🔴 안전과 직결된 구간에서 즉시 중단 안내를 받으셨습니다. 대안 행동을 확인하신 뒤 같은
          시나리오를 다시 연습해 보세요.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="rounded-chip border border-line bg-white px-3 py-1 text-sm font-semibold text-ink-soft">
          대화 {record.turnCount}턴
        </span>
        {record.retriesUsed > 0 && (
          <span className="rounded-chip border border-line bg-white px-3 py-1 text-sm font-semibold text-ink-soft">
            다시 해보기 사용
          </span>
        )}
        <span className="rounded-chip border border-line bg-white px-3 py-1 text-sm font-semibold text-ink-soft">
          마친 시각 {formatDateTime(record.endedAt)}
        </span>
      </div>

      <div className="mt-5">
        <BigButton href={`/train/${record.scenarioId.toLowerCase()}`} variant="secondary">
          같은 상황 다시 연습하기
        </BigButton>
      </div>
    </Card>
  );
}

export default SessionCard;
