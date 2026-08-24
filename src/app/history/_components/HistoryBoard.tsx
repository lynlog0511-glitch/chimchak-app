"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ScenarioType, SessionRecord } from "@/types";
import { EyebrowLabel, InlineDisclaimer } from "@/components";
import { IconClock, IconSprout, StatusMark } from "@/components/icons";
import { DEMO_SEED_SUMMARY, clearDemoRecords, isDemoRecord } from "@/lib/demoSeed";
import {
  clearReports,
  clearSessions,
  loadReports,
  loadSessions,
  type StoredReport,
} from "@/lib/storage";
import { CoverageGrid } from "./CoverageGrid";
import { TYPE_SHORT_LABELS } from "./format";
import { nextTrainingSentence, pickNextTraining, trainHref } from "./nextTraining";
import type { NextTrainingReason, ScenarioTypeMap } from "./nextTraining";
import { ReportList } from "./ReportList";
import { TrainingRow } from "./TrainingRow";
import { WeeklySummaryCard } from "./WeeklySummaryCard";

/* 다음 훈련 추천 규칙은 `./nextTraining`에 있습니다 — 성장 기록과 훈련 엔딩이 같은 순수 함수를 씁니다.
   훈련 엔딩 화면(`train/_components/EndingPanel`)이 이 파일 경로로 가져다 쓰고 있어,
   이름은 여기서 그대로 다시 내보냅니다(경로를 바꾸지 않기 위해서입니다). */
export {
  NEXT_TRAINING_CANDIDATES,
  NEXT_TRAINING_REASON_TEXT,
  WEAKNESS_THEMES,
  classifyCoaching,
  nextTrainingSentence,
  pickNextTraining,
  trainHref,
} from "./nextTraining";
export type {
  NextTrainingCandidate,
  NextTrainingPick,
  NextTrainingReason,
  PickNextTrainingOptions,
  ScenarioTypeMap,
  WeaknessTheme,
  WeaknessThemeDef,
} from "./nextTraining";

/**
 * 추천 이유 옆 마크 — 훈련 엔딩 화면이 계속 쓰는 조각이라 그대로 둡니다.
 * (성장 기록 화면은 시안 5c에 따라 아이콘 없이 문장형 추천 카드만 씁니다.)
 */
export function NextTrainingReasonMark({ reason }: { reason: NextTrainingReason }) {
  if (reason === "coaching" || reason === "weakness") return <StatusMark kind="coach" size="sm" />;
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

/** 회차의 짧은 유형 라벨 — 실제 시나리오 표를 먼저 보고, 없으면 기록에 적힌 라벨을 씁니다. */
function shortTypeLabel(record: SessionRecord, map: ScenarioTypeMap): string {
  const type = map[record.scenarioId.trim().toUpperCase()];
  return type ? TYPE_SHORT_LABELS[type] : record.typeLabel;
}

/**
 * 성장 기록 화면 본문 (시안 5c).
 *
 * 추천 카드 → 유형별 4칸 → 최근 훈련 행 → 이수 확인서 → 확정한 기록 순서입니다.
 * localStorage 는 브라우저에만 있으므로 마운트 뒤에 읽습니다(서버 렌더 결과와 어긋나지 않게).
 * 표시는 「잘한 것 N · 다시 볼 것 N」과 문장까지이며, 점수·등급·순위·백분위는 만들지 않습니다.
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
   * 시연용 예시만 지웁니다 — 같은 기기에 쌓인 진짜 기록과 이수 시수는 건드리지 않습니다.
   * (예시는 애초에 이수 누계에 들어가 있지 않으므로 시수는 심기 전 값 그대로 남습니다.)
   */
  const handleClearDemo = (): void => {
    clearDemoRecords();
    setSessions(loadSessions());
    setReports(loadReports());
  };

  const demoSessionCount = sessions.filter(isDemoRecord).length;
  const demoReportCount = reports.filter(isDemoRecord).length;
  const demoShown = demoSessionCount + demoReportCount > 0;

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
      <p className="mt-4 text-[0.7813rem] leading-[1.6] text-tertiary">
        이 기기에 저장된 기록을 불러오는 중입니다.
      </p>
    );
  }

  return (
    <div className="mt-4">
      {/* 시연용 예시가 섞여 있으면 화면이 먼저 밝힙니다 — 예시가 증빙으로 오인되면 안 됩니다.
          지우기는 예시만 지우고, 이 기기의 진짜 기록과 이수 시수는 그대로 둡니다. */}
      {demoShown && (
        <section
          aria-labelledby="demo-notice-title"
          className="mb-4 rounded-[14px] bg-warn-soft px-4 py-[14px]"
        >
          <h2
            id="demo-notice-title"
            className="text-[0.9375rem] leading-[1.45] font-extrabold text-warn-ink"
          >
            시연용 예시 기록이 표시되고 있습니다
          </h2>
          <p className="mt-[5px] text-[0.8438rem] leading-[1.7] text-ink-soft">
            발표 시연을 위해 심어 둔 {DEMO_SEED_SUMMARY}이 아래 목록에 섞여 있습니다. 해당 행에는
            「예시」 표시가 붙고, 이수 확인서에는 「예시 미리보기」로 인쇄됩니다. 실제 이수 시수
            누계에는 들어가지 않습니다.
          </p>
          <button
            type="button"
            onClick={handleClearDemo}
            className="mt-[10px] flex min-h-[48px] w-full items-center justify-center rounded-[14px] border border-line-strong bg-white text-[0.9375rem] font-bold text-ink transition-colors duration-150 active:bg-paper-2"
          >
            예시 기록 한 번에 지우기
          </button>
          <p className="mt-[6px] text-[0.7813rem] leading-[1.6] text-ink-soft">
            예시만 지웁니다 — 직접 완주하신 기록과 이수 시수는 그대로 남습니다.
          </p>
        </section>
      )}

      {/* 다음엔 이 장면 — 추천 규칙은 순수 함수가 정하고, 여기서는 장면 이름과 이유 한 줄만 답니다. */}
      {suggestion && (
        <Link
          href={trainHref(suggestion.candidate.id)}
          aria-label={`${suggestion.candidate.title} 훈련으로 가기 — ${nextTrainingSentence(suggestion)}`}
          className="mb-4 flex min-h-[48px] items-center gap-[10px] rounded-[14px] bg-tint px-[15px] py-[14px] transition-colors duration-150 active:bg-mint-200"
        >
          <span className="min-w-0 flex-1">
            {/* 링크 안이라 문단(EyebrowLabel)을 넣을 수 없는 자리입니다 —
                크기·자간은 그 컴포넌트와 같은 값으로 맞춰 둡니다(12.5px / 700 / +.06em). */}
            <span className="block text-[0.7813rem] leading-[1.45] font-bold tracking-[0.06em] text-brand-700">
              다음엔 이 장면
            </span>
            {/* 장면 이름을 먼저 세웁니다 — 어디로 가는지가 이유보다 먼저 읽혀야 합니다. */}
            <span className="mt-[2px] block text-[0.9375rem] leading-[1.4] font-bold text-brand-900">
              {suggestion.candidate.title}
            </span>
            {/* 왜 이 장면인지 — 최근 코칭이 가리킨 항목을 그대로 문장으로 답니다(숫자 없음). */}
            <span className="mt-[3px] block text-[0.8438rem] leading-[1.6] text-brand-800">
              {nextTrainingSentence(suggestion)}
            </span>
          </span>
          <span className="flex-none text-[0.9375rem] font-bold whitespace-nowrap text-brand-700">
            가기 ›
          </span>
        </Link>
      )}

      {/* 이번 주 — 누계(커버리지)와 회차 목록 사이에 놓는 시간 축 한 장입니다. */}
      <WeeklySummaryCard
        records={sessions}
        typeByScenarioId={typeByScenarioId}
        className="mb-[18px]"
      />

      <EyebrowLabel className="mb-2">유형별로 해 본 것</EyebrowLabel>
      <CoverageGrid
        records={sessions}
        typeByScenarioId={typeByScenarioId}
        activeTypes={activeTypes}
        className="mb-[18px]"
      />

      <EyebrowLabel className="mb-[2px]">최근 훈련</EyebrowLabel>
      {sessions.length > 0 ? (
        <div className="chim-rows">
          {sessions.map((record) => (
            <TrainingRow
              key={record.id}
              record={record}
              typeLabel={shortTypeLabel(record, typeByScenarioId)}
            />
          ))}
        </div>
      ) : (
        <div className="border-b border-line px-[2px] py-[14px]">
          <p className="text-[1.0625rem] leading-[1.5] font-bold text-ink">
            아직 완주한 훈련이 없습니다
          </p>
          <p className="mt-[3px] text-[0.7813rem] leading-[1.6] text-ink-soft">
            정답을 맞히는 시험이 아니라 말이 나오게 만드는 연습입니다. 한 번 마치시면 이 자리에
            잘한 것과 다시 볼 것이 문장으로 남습니다.
          </p>
          <Link
            href="/train"
            className="mt-[6px] inline-flex min-h-[48px] items-center rounded-field text-[0.9375rem] font-bold text-brand-700 transition-colors duration-150 active:bg-paper-2"
          >
            첫 훈련 시작하기 ›
          </Link>
        </div>
      )}

      {/* 이수 확인서 — 인쇄용 화면으로 나갑니다(이수 사실만 담습니다). */}
      <Link
        href="/history/certificate"
        className="mt-4 flex min-h-[50px] w-full items-center justify-center rounded-[14px] border border-line-strong bg-white text-[0.9375rem] font-bold text-ink transition-colors duration-150 active:bg-paper-2"
      >
        이수 확인서 만들기
      </Link>
      {/* 안심 문구는 고지가 아니라 읽으라고 두는 줄입니다 — 크기·대비를 한 단계 올려 둡니다. */}
      <p className="mt-[8px] text-center text-[0.8438rem] leading-[1.6] text-ink-soft">
        확인서에는 이수 사실만 담깁니다 — 판정·대화 내용 없음
      </p>
      {/* 기관 담당자는 이 화면까지 따라오는 일이 잦습니다 — 탭바에는 두지 않고 여기서만 엽니다. */}
      <p className="mt-[6px] text-center">
        <Link
          href="/for-orgs"
          className="inline-flex min-h-[48px] items-center rounded-field text-[0.8438rem] font-bold text-brand-700 transition-colors duration-150 active:bg-paper-2"
        >
          기관 담당자용 안내 보기 ›
        </Link>
      </p>

      {/* 확정한 기록 — 최근 훈련과 같은 리스트 문법입니다. */}
      <EyebrowLabel className="mt-7 mb-[2px]">확정한 기록</EyebrowLabel>
      {reports.length > 0 ? (
        <ReportList reports={reports} />
      ) : (
        <div className="border-b border-line px-[2px] py-[14px]">
          <p className="text-[1.0625rem] leading-[1.5] font-bold text-ink">
            아직 확정한 기록이 없습니다
          </p>
          <p className="mt-[3px] text-[0.7813rem] leading-[1.6] text-ink-soft">
            오늘 있었던 일을 말로 보고하시면 가명처리를 거쳐 급여제공기록지 5요소 초안이
            만들어집니다.
          </p>
          <Link
            href="/report"
            className="mt-[6px] inline-flex min-h-[48px] items-center rounded-field text-[0.9375rem] font-bold text-brand-700 transition-colors duration-150 active:bg-paper-2"
          >
            음성 보고하러 가기 ›
          </Link>
        </div>
      )}

      {/* 이 기록이 어디에 쓰이는지 — 면 카드 한 장으로 조용히 둡니다. */}
      <div className="mt-7 rounded-[14px] bg-paper-2 px-4 py-[14px]">
        <EyebrowLabel>이 기록이 쓰이는 곳</EyebrowLabel>
        <p className="mt-[8px] text-[0.8438rem] leading-[1.7] text-ink-soft">
          훈련 이력은 이 기기에만 쌓입니다. 기관에서 요구하는 보수교육·직무평가 증빙으로 쓰실 수
          있도록 이수 여부와 이수 일시를 중심으로 남기며, 내부 판정 결과와 대화 내용은 기관
          관리자에게 공개되지 않고 인사평가에 연동하지 않습니다.
        </p>
        {/* 오독 방지 — 확인서 하단 각주와 같은 문장을 여기에도 둡니다(경계는 두 곳에서 같아야 합니다). */}
        <p className="mt-[8px] text-[0.8438rem] leading-[1.7] font-bold text-ink">
          이 기록과 이수 확인서는 앱 기록 기반이며 법정 보수교육 이수 인정이 아닙니다 — 기관 자체
          직무교육·정기평가 내부 증빙용입니다.
        </p>
        <p className="mt-[8px] text-[0.8438rem] leading-[1.7] text-ink-soft">
          훈련 대사는 가상 인물의 AI 생성 문장이며, 말씀하신 발화 원문은 어디에도 저장하지 않습니다.
        </p>

        <div className="mt-[14px] border-t border-line pt-[12px]">
          {confirmClear ? (
            <div>
              <p className="text-[0.7813rem] leading-[1.6] font-bold text-danger-ink">
                이 기기에 저장된 훈련 이력과 확정 기록을 모두 지울까요? 되돌릴 수 없습니다.
              </p>
              {/* 증빙 원본이 이 기기 한 벌뿐이라, 지우기 전에 남길 방법을 먼저 알려 드립니다. */}
              <p className="mt-[6px] text-[0.7813rem] leading-[1.6] text-ink-soft">
                이수 횟수와 이수 시수 누계도 함께 지워집니다. 확인서로 인쇄하거나 파일로 내려받아
                두지 않은 이수 사실은 되살릴 수 없습니다.
              </p>
              <div className="mt-[10px] flex gap-2">
                <button
                  type="button"
                  onClick={handleClear}
                  className="flex min-h-[48px] flex-1 items-center justify-center rounded-[14px] bg-danger-ink text-[0.9375rem] font-bold text-white transition-colors duration-150 active:brightness-95"
                >
                  네, 지웁니다
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="flex min-h-[48px] flex-1 items-center justify-center rounded-[14px] bg-white text-[0.9375rem] font-bold text-ink-soft transition-colors duration-150 active:bg-paper-2"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="flex min-h-[48px] items-center rounded-field text-[0.8438rem] font-bold text-ink-soft transition-colors duration-150 active:bg-paper-2"
            >
              이 기기의 기록 지우기
            </button>
          )}
        </div>
      </div>

      <InlineDisclaimer size="md" tone="readable" className="mt-6 mb-3" />
    </div>
  );
}

export default HistoryBoard;
