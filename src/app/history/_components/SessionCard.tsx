import type { SessionRecord } from "@/types";
import { BigButton, Card } from "@/components";
import { StatusMark } from "@/components/icons";
import { formatDateTime, verdictMark, verdictNote } from "./format";

export interface SessionCardProps {
  record: SessionRecord;
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
 * 훈련 세션 1건 카드.
 * 표시는 충족 목록 · 코칭 요약 · 판정 문구까지이며, 점수·등급·순위·백분위는 표시하지 않습니다.
 * 판정 마크는 StatusMark가 그립니다 — 이모지를 쓰지 않습니다.
 *
 * 크기 체계(§3): 시나리오 제목 18px · 충족/코칭 문장 16px · 시각과 유형 등 메타 13px.
 * 형태(§1-2·§1-5): 판정은 필(배지) 대신 마크+텍스트 한 줄로, 메타는 세로 선 대신 점으로 나눕니다.
 */
export function SessionCard({ record }: SessionCardProps) {
  const hasGreen = record.greenChecks.length > 0;
  const hasCoaching = record.coachingPoints.length > 0;

  return (
    <Card className="h-full">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="chim-caption font-semibold text-ink-muted">
            {formatDateTime(record.startedAt)}
          </p>
          <h3 className="mt-1 text-[1.125rem] leading-snug font-extrabold text-ink">
            {record.scenarioTitle}
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="chim-caption font-semibold text-ink-muted">{record.typeLabel}</span>
          <MetaDot />
          <StatusMark kind={verdictMark(record.verdict)} label={record.verdict} size="md" />
        </div>
      </div>

      {/* 이번 회차가 어디로 끝났는지 — 보더 없이 옅은 면 하나로 묶습니다(§7). */}
      <div className="mt-3 rounded-card bg-paper-2 px-4 py-3">
        <p className="chim-body font-bold text-ink">{record.endingTitle}</p>
        <p className="chim-meta mt-1 leading-relaxed text-ink-soft">
          {verdictNote(record.verdict)}
        </p>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div>
          <p className="chim-label flex items-center gap-1.5 font-extrabold text-ok-ink">
            <StatusMark kind="met" size="sm" />
            충족한 것
          </p>
          {/* 항목마다 색 상자를 두지 않고 hairline으로만 나눕니다. */}
          {hasGreen ? (
            <ul className="chim-hairline mt-2 border-t border-line">
              {record.greenChecks.map((item, index) => (
                <li key={`${record.id}-green-${index}`} className="chim-body py-2.5 text-ink">
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p className="chim-meta mt-2 leading-relaxed text-ink-muted">
              이번 회차에는 기록된 충족 항목이 없습니다. 같은 상황을 한 번 더 연습해 보세요.
            </p>
          )}
        </div>

        <div>
          <p className="chim-label flex items-center gap-1.5 font-extrabold text-ink-soft">
            <StatusMark kind="coach" size="sm" />
            다음에 살려 볼 것
          </p>
          {hasCoaching ? (
            <ul className="chim-hairline mt-2 border-t border-line">
              {record.coachingPoints.map((item, index) => (
                <li key={`${record.id}-coach-${index}`} className="chim-body py-2.5 text-ink">
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p className="chim-meta mt-2 leading-relaxed text-ink-muted">
              따로 코칭이 남지 않았습니다. 흐름을 잘 지키셨습니다.
            </p>
          )}
        </div>
      </div>

      {record.cfCount > 0 && (
        <p className="chim-body mt-5 flex gap-2 rounded-card bg-danger-soft px-4 py-3 font-semibold text-danger-ink">
          <StatusMark kind="stop" size="sm" className="mt-1" />
          <span>
            안전과 직결된 구간에서 즉시 중단 안내를 받으셨습니다. 대안 행동을 확인하신 뒤 같은
            시나리오를 다시 연습해 보세요.
          </span>
        </p>
      )}

      {/* 메타 정보는 칩도 세로 선도 쓰지 않고 작은 텍스트 한 줄로 둡니다. */}
      <div className="chim-caption mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold text-ink-muted">
        <span>
          대화 <span className="chim-num">{record.turnCount}</span>턴
        </span>
        {record.retriesUsed > 0 && (
          <>
            <MetaDot />
            <span>다시 해보기 사용</span>
          </>
        )}
        <MetaDot />
        <span>마친 시각 {formatDateTime(record.endedAt)}</span>
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
