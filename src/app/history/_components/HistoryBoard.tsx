"use client";

import { useEffect, useState } from "react";
import type { ScenarioType, SessionRecord } from "@/types";
import { BigButton, Card } from "@/components";
import { StatusMark } from "@/components/icons";
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

export interface HistoryBoardProps {
  /** 시나리오 id(대문자) → 유형. 서버에서 만들어 넘겨받습니다. */
  typeByScenarioId: ScenarioTypeMap;
  /** 지금 훈련할 수 있는 유형 목록 */
  activeTypes: ScenarioType[];
}

/** 섹션 제목 + 설명 */
function SectionHead({ title, lead }: { title: string; lead: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-xl font-extrabold text-ink md:text-2xl">{title}</h2>
      <p className="mt-2 max-w-3xl text-base leading-relaxed text-ink-soft">{lead}</p>
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

  if (!loaded) {
    return (
      <Card tone="quiet">
        <p className="text-base leading-relaxed text-ink-soft">
          이 기기에 저장된 기록을 불러오는 중입니다.
        </p>
      </Card>
    );
  }

  const isEmpty = sessions.length === 0 && reports.length === 0;

  if (isEmpty) {
    return (
      <div className="space-y-6">
        <Card tone="brand">
          <p className="text-lg leading-relaxed font-extrabold text-brand-900">
            아직 쌓인 기록이 없습니다. 첫 훈련부터 시작해 보시겠어요?
          </p>
          <p className="mt-3 text-base leading-relaxed text-ink">
            정답을 맞히는 시험이 아니라, 말이 나오게 만드는 연습입니다. 한 번 해 보시면 이 자리에{" "}
            <StatusMark kind="met" size="sm" quiet label="충족" />한 것과{" "}
            <StatusMark kind="coach" size="sm" quiet label="다음에 살려 볼 것" />이 문장으로
            남습니다.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
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

        <Card tone="quiet">
          <p className="text-base leading-relaxed text-ink">
            훈련 이력은 이 기기에만 쌓입니다. 기관에서 요구하는 보수교육·직무평가 증빙으로 쓰실 수
            있도록 이수 여부와 이수 일시를 중심으로 남기며, 내부 판정 결과와 대화 원문은 기관
            관리자에게 공개되지 않습니다.
          </p>
        </Card>
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
            <p className="text-base leading-relaxed text-ink">
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
            <p className="text-base leading-relaxed text-ink">
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
        <h2 className="text-base font-extrabold text-ink">이 기록이 무엇에 쓰이는지</h2>
        <p className="mt-2 text-base leading-relaxed text-ink">
          훈련 이력은 이 기기에만 쌓입니다. 기관에서 요구하는 보수교육·직무평가 증빙으로 쓰실 수
          있도록 이수 여부와 이수 일시를 중심으로 남깁니다. 내부 판정 결과와 대화 원문, 발화 원문은
          기관 관리자에게 공개되지 않으며, 인사평가에 연동하지 않습니다.
        </p>

        <div className="mt-5 border-t border-line pt-4">
          {confirmClear ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <p className="text-base font-bold text-danger-ink">
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
