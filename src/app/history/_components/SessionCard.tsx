import type { SessionRecord } from "@/types";
import { Badge, BigButton, Card } from "@/components";
import { StatusMark } from "@/components/icons";
import { formatDateTime, verdictNote, verdictTone } from "./format";

export interface SessionCardProps {
  record: SessionRecord;
}

/**
 * 훈련 세션 1건 카드.
 * 표시는 충족 목록 · 코칭 요약 · 판정 문구까지이며, 점수·등급·순위·백분위는 표시하지 않습니다.
 * 판정 마크는 StatusMark가 그립니다 — 이모지를 쓰지 않습니다.
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
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="text-sm font-semibold text-ink-muted">{record.typeLabel}</span>
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
          <p className="flex items-center gap-1.5 text-base font-extrabold text-ok-ink">
            <StatusMark kind="met" size="sm" />
            충족한 것
          </p>
          {/* 항목마다 색 상자를 두지 않고 hairline으로만 나눕니다. */}
          {hasGreen ? (
            <ul className="chim-hairline mt-2 border-t border-line">
              {record.greenChecks.map((item, index) => (
                <li
                  key={`${record.id}-green-${index}`}
                  className="py-2.5 text-base leading-relaxed text-ink"
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
          <p className="flex items-center gap-1.5 text-base font-extrabold text-ink-soft">
            <StatusMark kind="coach" size="sm" />
            다음에 살려 볼 것
          </p>
          {hasCoaching ? (
            <ul className="chim-hairline mt-2 border-t border-line">
              {record.coachingPoints.map((item, index) => (
                <li
                  key={`${record.id}-coach-${index}`}
                  className="py-2.5 text-base leading-relaxed text-ink"
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
        <p className="mt-4 flex gap-2 rounded-field border border-danger-line bg-white px-4 py-3 text-base leading-relaxed font-bold text-danger-ink">
          <StatusMark kind="stop" size="sm" className="mt-0.5" />
          <span>
            안전과 직결된 구간에서 즉시 중단 안내를 받으셨습니다. 대안 행동을 확인하신 뒤 같은
            시나리오를 다시 연습해 보세요.
          </span>
        </p>
      )}

      {/* 메타 정보는 칩이 아니라 hairline으로 나눈 작은 텍스트로 둡니다. */}
      <div className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm font-semibold text-ink-muted">
        <span>
          대화 <span className="chim-num">{record.turnCount}</span>턴
        </span>
        {record.retriesUsed > 0 && (
          <span className="border-l border-line pl-2.5">다시 해보기 사용</span>
        )}
        <span className="border-l border-line pl-2.5">
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
