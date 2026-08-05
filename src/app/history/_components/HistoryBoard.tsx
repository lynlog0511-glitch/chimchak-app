"use client";

import { useEffect, useMemo, useState } from "react";
import type { ScenarioType, SessionRecord } from "@/types";
import { BigButton, Card } from "@/components";
import { IconArrowRight, IconClock, IconSprout, StatusMark } from "@/components/icons";
import {
  clearReports,
  clearSessions,
  loadReports,
  loadSessions,
  type StoredReport,
} from "@/lib/storage";
import { CoverageGrid, type ScenarioTypeMap } from "./CoverageGrid";
import { ReportList } from "./ReportList";
import { SessionCard } from "./SessionCard";

/* ── 다음 훈련 추천 (순수 함수) ────────────────────────────────
   성장 기록과 훈련 엔딩 화면이 **같은 규칙**을 쓰도록 여기 한 곳에 둡니다.
   (훈련 엔딩 화면 `train/_components/EndingPanel` 이 이 함수를 가져다 씁니다.)

   규칙 — 1순위 아직 완주 이력이 없는 유형 → 2순위 최근 세션들에서 코칭이 가장 많이 남은 유형
        → 3순위 마지막 훈련이 가장 오래된 유형.
   대상은 지금 훈련할 수 있는 활성 시나리오뿐이고, 베타로 이연된 유형(위험 판단)은 후보에서 뺍니다.
   점수·등급은 물론 “코칭 몇 개” 같은 개수도 화면으로 나가지 않습니다 — 유형 하나와 이유 한 줄까지입니다. */

/** 추천 후보 — 훈련 화면으로 바로 넘어가는 데 필요한 최소 정보만 담습니다. */
export interface NextTrainingCandidate {
  /** 시나리오 id (대문자 표기) */
  id: string;
  title: string;
  type: ScenarioType;
  typeLabel: string;
}

/** 왜 추천했는지 — 화면에는 한 줄 문구로만 나갑니다. */
export type NextTrainingReason = "untried" | "coaching" | "stale";

export interface NextTrainingPick {
  candidate: NextTrainingCandidate;
  reason: NextTrainingReason;
  /** 추천 이유 한 줄 (숫자 없음) */
  reasonText: string;
}

/**
 * 추천 후보 표 — 지금 훈련할 수 있는 활성 3종입니다.
 *
 * 시나리오 데이터 전체(대사·분기 그래프)를 브라우저 번들로 내려보내지 않기 위해
 * 추천에 필요한 네 가지만 여기 적어 둡니다. 활성 시나리오가 늘면 이 표에 한 줄을 더합니다.
 * 유형④(위험 판단)는 베타 이연이라 후보에 넣지 않습니다.
 */
export const NEXT_TRAINING_CANDIDATES: NextTrainingCandidate[] = [
  {
    id: "CHK-A01",
    title: "현관 앞, 집에 가야 해요",
    type: "BPSD",
    typeLabel: "치매 행동심리증상(BPSD)",
  },
  { id: "CHK-B02", title: "점심 식사 중 사레", type: "EMERGENCY", typeLabel: "응급 초기 대응" },
  { id: "CHK-C01", title: "온 김에 반찬 좀", type: "CONFLICT", typeLabel: "이용자·보호자 갈등 화법" },
];

/** 추천 이유 문구 — 새 문구는 여기 한 곳에만 둡니다. */
export const NEXT_TRAINING_REASON_TEXT: Record<NextTrainingReason, string> = {
  untried: "아직 해보지 않은 유형입니다",
  coaching: "코칭이 남은 유형입니다",
  stale: "가장 오래전에 연습한 유형입니다",
};

/** 2순위 판단에 쓰는 “최근 세션” 범위 — 오래전 회차까지 끌고 오지 않습니다. */
const RECENT_SESSION_WINDOW = 5;

function upperId(id: string): string {
  return id.trim().toUpperCase();
}

function timeOf(iso: string | undefined): number {
  if (!iso) return 0;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

export interface PickNextTrainingOptions {
  /** 후보에서 빼 둘 시나리오 (방금 마친 회차 등) */
  excludeScenarioId?: string;
  /** 지금 훈련할 수 있는 유형 — 주면 이 유형만 남깁니다 */
  activeTypes?: ScenarioType[];
  /** 시나리오 id(대문자) → 유형. 주면 기록 해석에 먼저 씁니다 */
  typeByScenarioId?: ScenarioTypeMap;
  /** 후보 표 교체 (확장·검증용) */
  candidates?: NextTrainingCandidate[];
}

/**
 * 다음에 해보시면 좋을 훈련을 하나만 고릅니다. 고를 것이 없으면 `undefined`.
 *
 * 같은 입력이면 같은 결과가 나오는 순수 함수이고, 무작위·가중치·점수는 쓰지 않습니다.
 *
 * @example
 * pickNextTraining([]) // => 첫 후보 + "아직 해보지 않은 유형입니다"
 * @example
 * pickNextTraining(records, { excludeScenarioId: "CHK-A01" }) // 방금 마친 회차는 빼고 고릅니다
 */
export function pickNextTraining(
  records: SessionRecord[],
  options: PickNextTrainingOptions = {},
): NextTrainingPick | undefined {
  const candidates = options.candidates ?? NEXT_TRAINING_CANDIDATES;
  const exclude = options.excludeScenarioId ? upperId(options.excludeScenarioId) : undefined;
  const activeTypes = options.activeTypes;
  const pool = candidates.filter(
    (item) =>
      upperId(item.id) !== exclude && (!activeTypes || activeTypes.includes(item.type)),
  );
  if (pool.length === 0) return undefined;

  const typeOf = (record: SessionRecord): ScenarioType | undefined => {
    const key = upperId(record.scenarioId ?? "");
    const mapped = options.typeByScenarioId?.[key];
    if (mapped) return mapped;
    return candidates.find((item) => upperId(item.id) === key)?.type;
  };

  // 저장 순서를 믿지 않고 마친 시각으로 다시 세웁니다 (최신 → 과거).
  const ordered = [...records].sort((a, b) => timeOf(b.endedAt) - timeOf(a.endedAt));

  const trainedTypes = new Set<ScenarioType>();
  const coachingLeft = new Map<ScenarioType, number>();
  const lastTrainedAt = new Map<ScenarioType, number>();

  ordered.forEach((record, index) => {
    const type = typeOf(record);
    if (!type) return;
    trainedTypes.add(type);

    const at = timeOf(record.endedAt) || timeOf(record.startedAt);
    if (at > (lastTrainedAt.get(type) ?? 0)) lastTrainedAt.set(type, at);

    if (index < RECENT_SESSION_WINDOW) {
      const left = Array.isArray(record.coachingPoints) ? record.coachingPoints.length : 0;
      coachingLeft.set(type, (coachingLeft.get(type) ?? 0) + left);
    }
  });

  // 1순위 — 아직 완주 이력이 없는 유형
  const untried = pool.find((item) => !trainedTypes.has(item.type));
  if (untried) {
    return {
      candidate: untried,
      reason: "untried",
      reasonText: NEXT_TRAINING_REASON_TEXT.untried,
    };
  }

  // 2순위 — 최근 세션들에서 코칭이 가장 많이 남은 유형 (동점이면 후보 표 순서)
  let coachingPick: NextTrainingCandidate | undefined;
  let coachingMax = 0;
  for (const item of pool) {
    const left = coachingLeft.get(item.type) ?? 0;
    if (left > coachingMax) {
      coachingMax = left;
      coachingPick = item;
    }
  }
  if (coachingPick) {
    return {
      candidate: coachingPick,
      reason: "coaching",
      reasonText: NEXT_TRAINING_REASON_TEXT.coaching,
    };
  }

  // 3순위 — 마지막 훈련이 가장 오래된 유형
  let stalePick = pool[0];
  if (!stalePick) return undefined;
  let staleAt = lastTrainedAt.get(stalePick.type) ?? 0;
  for (const item of pool.slice(1)) {
    const at = lastTrainedAt.get(item.type) ?? 0;
    if (at < staleAt) {
      stalePick = item;
      staleAt = at;
    }
  }
  return { candidate: stalePick, reason: "stale", reasonText: NEXT_TRAINING_REASON_TEXT.stale };
}

/** 훈련 상세 경로 — 라우트 파라미터는 소문자로 통일합니다. */
function trainHref(scenarioId: string): string {
  return `/train/${scenarioId.toLowerCase()}`;
}

/**
 * 추천 이유 옆 마크 — 이모지 대신 아이콘 시스템을 씁니다(라벨은 항상 옆에 있습니다).
 * 코칭 이유일 때만 판정 마크(빈 원)를 쓰고, 나머지는 뜻이 다른 아이콘으로 둡니다.
 * 훈련 엔딩 화면도 같은 마크를 쓰도록 함께 내보냅니다.
 */
export function NextTrainingReasonMark({ reason }: { reason: NextTrainingReason }) {
  if (reason === "coaching") return <StatusMark kind="coach" size="sm" />;
  if (reason === "stale") {
    return <IconClock className="h-[18px] w-[18px] shrink-0 text-ink-muted" />;
  }
  return <IconSprout className="h-[18px] w-[18px] shrink-0 text-brand-700" />;
}

export interface HistoryBoardProps {
  /** 시나리오 id(대문자) → 유형. 서버에서 만들어 넘겨받습니다. */
  typeByScenarioId: ScenarioTypeMap;
  /** 지금 훈련할 수 있는 유형 목록 */
  activeTypes: ScenarioType[];
}

/**
 * 섹션 제목 + 설명.
 * 크기 체계(§3): 제목은 섹션 제목(24~28px), 설명은 보조라 14px로 조용히 둡니다.
 */
function SectionHead({ title, lead }: { title: string; lead: string }) {
  return (
    <div className="mb-4">
      <h2 className="chim-h2 text-ink">{title}</h2>
      <p className="chim-meta mt-2 max-w-3xl leading-relaxed text-ink-muted">{lead}</p>
    </div>
  );
}

/**
 * 성장 기록 화면 본문.
 *
 * localStorage 는 브라우저에만 있으므로 마운트 뒤에 읽습니다(서버 렌더 결과와 어긋나지 않게).
 * 표시는 충족 / 코칭 두 가지와 판정 문구까지이며, 점수·등급·순위·백분위는 만들지 않습니다.
 * (판정 마크는 StatusMark — 이모지를 쓰지 않습니다.)
 */
export function HistoryBoard({ typeByScenarioId, activeTypes }: HistoryBoardProps) {
  const [loaded, setLoaded] = useState(false);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [reports, setReports] = useState<StoredReport[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    setSessions(loadSessions());
    setReports(loadReports());
    setLoaded(true);
  }, []);

  const handleClear = (): void => {
    clearSessions();
    clearReports();
    setSessions([]);
    setReports([]);
    setConfirmClear(false);
  };

  /**
   * 다음 훈련 추천 — 성장 기록이 막다른 길로 끝나지 않도록, 여기서 바로 이어 갈 곳을 하나 답니다.
   * 유형 판별은 서버에서 받은 실제 시나리오 표(typeByScenarioId)를 먼저 씁니다.
   */
  const suggestion = useMemo(
    () => pickNextTraining(sessions, { activeTypes, typeByScenarioId }),
    [activeTypes, sessions, typeByScenarioId],
  );

  if (!loaded) {
    return (
      <p className="chim-meta text-ink-muted">이 기기에 저장된 기록을 불러오는 중입니다.</p>
    );
  }

  const isEmpty = sessions.length === 0 && reports.length === 0;

  if (isEmpty) {
    return (
      <div className="space-y-6">
        <Card tone="brand">
          <p className="chim-h3 max-w-2xl text-brand-900">
            아직 쌓인 기록이 없습니다. 첫 훈련부터 시작해 보시겠어요?
          </p>
          <p className="chim-core-sm mt-3 max-w-3xl text-ink">
            정답을 맞히는 시험이 아니라, 말이 나오게 만드는 연습입니다. 한 번 해 보시면 이 자리에{" "}
            <StatusMark kind="met" size="sm" quiet label="충족" />한 것과{" "}
            <StatusMark kind="coach" size="sm" quiet label="다음에 살려 볼 것" />이 문장으로
            남습니다.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <BigButton href="/train" size="lg">
              첫 훈련 시작하기
            </BigButton>
            <BigButton href="/report" size="lg" variant="secondary">
              음성 보고 먼저 해보기
            </BigButton>
          </div>
        </Card>

        <section>
          <SectionHead
            title="유형 커버리지"
            lead="네 가지 유형을 골고루 연습하실 수 있도록, 어떤 유형을 얼마나 해보셨는지만 보여 드립니다."
          />
          <CoverageGrid
            records={[]}
            typeByScenarioId={typeByScenarioId}
            activeTypes={activeTypes}
          />
        </section>

        {/* 제도 설명은 카드 대신 캡션으로 낮춥니다 — 존재하되 조용히(§5·§6). */}
        <p className="chim-caption max-w-3xl leading-relaxed text-ink-muted">
          훈련 이력은 이 기기에만 쌓입니다. 기관에서 요구하는 보수교육·직무평가 증빙으로 쓰실 수
          있도록 이수 여부와 이수 일시를 중심으로 남기며, 내부 판정 결과와 대화 원문은 기관
          관리자에게 공개되지 않습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <section>
        <SectionHead
          title="유형 커버리지"
          lead="네 가지 유형을 골고루 연습하실 수 있도록, 어떤 유형을 얼마나 해보셨는지만 보여 드립니다. 잘하고 못하고를 나누지 않습니다."
        />
        <CoverageGrid
          records={sessions}
          typeByScenarioId={typeByScenarioId}
          activeTypes={activeTypes}
        />
      </section>

      {suggestion && (
        <section>
          <SectionHead
            title="다음 훈련 추천"
            lead="쌓인 기록을 보고 이어서 해보시면 좋을 상황을 하나만 골라 드립니다. 잘하고 못하고를 가르는 것이 아니라, 아직 덜 만나 보신 장면을 찾아 드리는 것입니다."
          />
          {/* 지면 위 흰 면 하나 — 보더도 액센트도 없이 카드 자체로 구분됩니다(§1-2·§7). */}
          <Card>
            <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
              <div className="min-w-0">
                <p className="chim-caption font-semibold text-ink-muted">
                  {suggestion.candidate.typeLabel}
                </p>
                <h3 className="chim-h3 mt-1 text-ink">{suggestion.candidate.title}</h3>
                <p className="chim-meta mt-2.5 inline-flex items-center gap-2 font-semibold text-ink-soft">
                  <NextTrainingReasonMark reason={suggestion.reason} />
                  {suggestion.reasonText}
                </p>
              </div>
              <BigButton href={trainHref(suggestion.candidate.id)} size="lg">
                이어서 연습하기
                <IconArrowRight className="h-5 w-5" />
              </BigButton>
            </div>
          </Card>
        </section>
      )}

      <section>
        <SectionHead
          title="훈련 이력"
          lead="회차마다 충족한 것과 다음에 살려 볼 것을 문장으로 남깁니다. 점수·등급·순위는 만들지 않고, 발화 원문도 저장하지 않습니다."
        />
        {sessions.length > 0 ? (
          <ul className="grid gap-4">
            {sessions.map((record) => (
              <li key={record.id}>
                <SessionCard record={record} />
              </li>
            ))}
          </ul>
        ) : (
          <Card tone="quiet">
            <p className="chim-core-sm max-w-2xl text-ink">
              아직 완주한 훈련이 없습니다. 시나리오를 하나 마치시면 이 자리에 회차가 쌓입니다.
            </p>
            <div className="mt-4">
              <BigButton href="/train">첫 훈련 시작하기</BigButton>
            </div>
          </Card>
        )}
      </section>

      <section>
        <SectionHead
          title="확정한 기록"
          lead="기록 코칭에서 직접 확정하신 급여제공기록지 초안입니다. 가명처리 2단을 통과한 텍스트만 남아 있습니다."
        />
        {reports.length > 0 ? (
          <ReportList reports={reports} />
        ) : (
          <Card tone="quiet">
            <p className="chim-core-sm max-w-2xl text-ink">
              아직 확정한 기록이 없습니다. 오늘 있었던 일을 말로 보고해 보시면 5요소 초안이
              만들어집니다.
            </p>
            <div className="mt-4">
              <BigButton href="/report" variant="secondary">
                음성 보고하러 가기
              </BigButton>
            </div>
          </Card>
        )}
      </section>

      <Card tone="quiet">
        <h2 className="chim-label text-ink">이 기록이 무엇에 쓰이는지</h2>
        <p className="chim-caption mt-2 max-w-3xl leading-relaxed text-ink-muted">
          훈련 이력은 이 기기에만 쌓입니다. 기관에서 요구하는 보수교육·직무평가 증빙으로 쓰실 수
          있도록 이수 여부와 이수 일시를 중심으로 남깁니다. 내부 판정 결과와 대화 원문, 발화 원문은
          기관 관리자에게 공개되지 않으며, 인사평가에 연동하지 않습니다.
        </p>

        <div className="mt-5 border-t border-line pt-4">
          {confirmClear ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <p className="chim-core-sm font-bold text-danger-ink">
                이 기기에 저장된 훈련 이력과 확정 기록을 모두 지울까요? 되돌릴 수 없습니다.
              </p>
              <div className="flex flex-wrap gap-3">
                <BigButton variant="danger" onClick={handleClear}>
                  네, 지웁니다
                </BigButton>
                <BigButton variant="ghost" onClick={() => setConfirmClear(false)}>
                  취소
                </BigButton>
              </div>
            </div>
          ) : (
            <BigButton variant="ghost" onClick={() => setConfirmClear(true)}>
              이 기기의 기록 지우기
            </BigButton>
          )}
        </div>
      </Card>
    </div>
  );
}

export default HistoryBoard;
