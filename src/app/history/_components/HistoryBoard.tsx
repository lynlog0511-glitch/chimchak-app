"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ScenarioType, SessionRecord } from "@/types";
import { BigButton, ChevronGlyph, EyebrowLabel, InlineDisclaimer, cx } from "@/components";
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
import { countRubricCoverage, rubricCoverageSentence } from "./rubricCoverage";
import type { ScenarioRubricMap } from "./rubricCoverage";
import { nextTrainingSentence, pickNextTraining, trainHref } from "./nextTraining";
import type { ScenarioTypeMap } from "./nextTraining";
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

/* ※ 2026-08-26에 `NextTrainingReasonMark`(추천 이유 옆 마크)를 지웠습니다 — **참조 0건**이었고,
     그런데도 주석은 「훈련 엔딩 화면이 계속 쓰는 조각이라 그대로 둡니다」라고 적고 있었습니다.
     엔딩 화면은 이유를 문장으로만 적고(`nextTrainingSentence`), 이 화면도 시안 5c에 따라
     아이콘 없이 문장형 추천 카드만 씁니다 — 가리키는 자리가 이미 없는 근거였습니다.
     함께 소비처가 사라진 `IconSprout`·`IconClock`도 아이콘 배럴에서 지웠습니다(가이드 §9-9).
     이유별 마크가 다시 필요해지면 **쓰는 자리와 함께** 되살립니다. */

export interface HistoryBoardProps {
  /** 시나리오 id(대문자) → 유형. 서버에서 만들어 넘겨받습니다. */
  typeByScenarioId: ScenarioTypeMap;
  /** 지금 훈련할 수 있는 유형 목록 */
  activeTypes: ScenarioType[];
  /** 시나리오 id(대문자) → 적용 루브릭 항목 id 목록. 지나온 항목을 세는 데만 씁니다. */
  rubricByScenarioId: ScenarioRubricMap;
  /** 채점표 전체 항목 수 — 화면이 직접 세어 적습니다(손으로 적어 두지 않습니다). */
  rubricTotal: number;
}

/** 저장소를 읽지 못한 채 이만큼 지나면 다른 말을 겁니다(ms). */
const LOAD_STALL_MS = 3000;

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
export function HistoryBoard({
  typeByScenarioId,
  activeTypes,
  rubricByScenarioId,
  rubricTotal,
}: HistoryBoardProps) {
  const [loaded, setLoaded] = useState(false);
  const [stalled, setStalled] = useState(false);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [reports, setReports] = useState<StoredReport[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    setSessions(loadSessions());
    setReports(loadReports());
    setLoaded(true);
  }, []);

  /* 수화가 끝내 오지 않는 기기가 있습니다. 그때 화면에 남는 것이 「불러오는 중입니다」 하나면,
     이 탭은 영원히 읽는 중인 화면이 됩니다 — 하필 「내가 쌓아 온 것」을 확인하러 오는 탭입니다.
     3초가 지나도 그대로면 무엇을 하실 수 있는지로 말을 바꿉니다(페르소나 UI/UX med). */
  useEffect(() => {
    if (loaded) return;
    const timer = window.setTimeout(() => setStalled(true), LOAD_STALL_MS);
    return () => window.clearTimeout(timer);
  }, [loaded]);

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

  /** 이력이 지나온 채점표 항목 수 — 새로 저장하는 값 없이 세션 기록에서 셉니다. */
  const rubricCoverage = useMemo(
    () => countRubricCoverage(sessions, rubricByScenarioId, rubricTotal),
    [rubricByScenarioId, rubricTotal, sessions],
  );
  const recentSessions = sessions.slice(0, 3);
  const olderSessions = sessions.slice(3);

  if (!loaded) {
    /* 이 화면에서 지금 글자는 이것 하나뿐입니다 — 가장 작고 흐린 단(12.5px·ink-faint)에 두는 것은
       방향이 반대라 15px 읽히는 톤으로 올렸습니다(페르소나 UI/UX med).

       ── 골격을 함께 그립니다(2026-08-26) ─────────────────────────
       기록은 이 기기의 저장소에 있어 서버가 값을 모릅니다. 그래도 **모양은 압니다** —
       추천 카드 한 장, 유형 4칸, 최근 훈련 몇 줄이라는 뼈대는 값과 무관하게 늘 같습니다.
       예전에는 이 자리에 문장 한 줄만 있어서, 서버 HTML의 `<main>` 안 글자가 65자였습니다.
       하필 「내가 쌓아 온 것」을 보러 오는 탭이라 그 공백이 「아직 로딩」이 아니라
       「아무것도 없다」로 읽혔습니다(페르소나 UI/UX P1).
       움직이지 않는 회색 면입니다 — `animate-pulse`를 쓰지 않는 것은 이 앱의 모션 최소 규율이고,
       기다리는 화면이 깜빡이면 중고령 사용자에게는 「고장」으로 읽히기 때문입니다.
       (2026-08-26: 이 문장을 적은 날 저장소에 `animate-pulse`가 한 자리 남아 있었습니다 —
        `TierIndicator`의 L2 칩입니다. **화면에 나간 적은 없습니다**: 그 컴포넌트는 임포트가
        0건이라 렌더되지 않았고, 지금은 파일째 지웠습니다. 즉 「출고되던 점멸을 껐다」가 아니라
        「출고되기 전에 규칙으로 막았다」가 맞습니다 — 주석이 다음 사람의 근거로 읽히는
        코드베이스에서는 근거 문장이 사실과 어긋나는 편이 값이 틀린 코드보다 오래 해롭습니다
        (5차 페르소나 디자이너 med). 규칙 자체는 그대로 유효하고, 이제 문장이 아니라
        `tests/designScale.test.ts`가 0건으로 셉니다. 이 선언은 「기다리는 화면에는」으로
        좁히지 않고 앱 전체 규율로 그대로 둡니다.)
       낭독에는 위 한 줄만 갑니다(골격은 `aria-hidden`).

       치수는 **rem**입니다 — 골격 막대 둘은 각각 13.5px 캡션 줄과 17px 제목 줄을 대신하는데,
       px로 굳어 있으면 앱의 「글자 크기」를 올렸을 때 실제 내용만 25% 자라고 골격은 그대로라
       골격→내용 전환에서 점프가 가장 큰 배율이 「아주 크게」가 됩니다(페르소나 디자이너 low).
       하필 이 탭이 중고령 사용자가 자기 기록을 확인하러 오는 자리입니다.
       (같은 판단을 이미 적어 둔 자리: MicButton.tsx · TabBar.tsx — 「글자와 짝지어 서는
        장식 기하는 rem」.) */
    return (
      <div className="mt-4">
        <p role="status" className="text-[0.9375rem] leading-[1.6] text-ink-soft">
          {stalled
            ? "이 기기의 저장소를 읽지 못했습니다. 화면을 새로고침해 주세요."
            : "이 기기에 저장된 기록을 불러오는 중입니다."}
        </p>

        <div aria-hidden className="mt-4">
          {/* 다음엔 이 장면 — 카드 한 장 (5.75rem = 기본 배율 92px) */}
          <div className="mb-4 h-[5.75rem] rounded-card bg-paper-2" />
          {/* 유형별로 해 본 것 — 4칸 한 줄 (4.75rem = 76px) */}
          <div className="mb-[18px] flex overflow-hidden rounded-card bg-paper-2">
            {[0, 1, 2, 3].map((cell) => (
              <div
                key={cell}
                /* 칸을 가르는 선은 실제 4칸과 같은 값입니다(회색 면 위에서는 `line`이 묻힙니다). */
                className={cx("h-[4.75rem] flex-1", cell > 0 && "border-l border-line-strong")}
              />
            ))}
          </div>
          {/* 최근 훈련 — 행 3줄. 막대 높이는 대신하는 글자 줄과 같은 눈금입니다
              (0.8125rem ≈ 13.5px 캡션 · 1.0625rem = 17px 제목). */}
          <div className="chim-hairline border-t border-line">
            {[0, 1, 2].map((row) => (
              <div key={row} className="py-[14px]">
                <div className="h-[0.8125rem] w-[38%] rounded-field bg-paper-2" />
                <div className="mt-[8px] h-[1.0625rem] w-[72%] rounded-field bg-paper-2" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4">
      {demoShown && (
        <section
          aria-labelledby="demo-notice-title"
          className="mb-4 rounded-card bg-warn-soft px-4 py-[14px]"
        >
          <h2 id="demo-notice-title" className="text-[1rem] leading-[1.45] font-extrabold text-warn-ink">
            체험용 예시 기록이 표시되고 있습니다
          </h2>
          <p className="mt-[5px] text-[0.9375rem] leading-[1.6] text-ink-soft">
            화면 확인을 위해 심어 둔 {DEMO_SEED_SUMMARY}이 섞여 있습니다. 「예시」 표시는 실제
            이수 시수에 들어가지 않으며, 지우기는 아래 데이터 관리에서 할 수 있습니다.
          </p>
        </section>
      )}

      <BigButton href="/report" size="lg" block>
        돌봄 기록 만들기
      </BigButton>

      <section aria-labelledby="recent-practice-title" className="mt-7">
        <h2 id="recent-practice-title" className="text-[1.0625rem] leading-[1.45] font-bold text-ink">
          최근 연습
        </h2>
        {recentSessions.length > 0 ? (
          <div className="chim-rows mt-[2px]">
            {recentSessions.map((record) => (
              <TrainingRow
                key={record.id}
                record={record}
                typeLabel={shortTypeLabel(record, typeByScenarioId)}
              />
            ))}
          </div>
        ) : (
          <div className="border-b border-line px-[2px] py-[14px]">
            <p className="text-[1.0625rem] leading-[1.45] font-bold text-ink">
              아직 마친 연습이 없습니다
            </p>
            <p className="mt-[4px] text-[0.9375rem] leading-[1.6] text-ink-soft">
              한 번 마치면 잘한 것과 다시 볼 것이 문장으로 남습니다. 점수와 등급은 남지 않습니다.
            </p>
            <Link
              href="/train"
              className="mt-[6px] inline-flex min-h-[48px] items-center rounded-field text-[1rem] font-bold text-brand-800 transition-colors duration-150 active:bg-paper-2"
            >
              첫 연습 시작하기 ›
            </Link>
          </div>
        )}
      </section>

      <section aria-labelledby="care-records-title" className="mt-7">
        <h2 id="care-records-title" className="text-[1.0625rem] leading-[1.45] font-bold text-ink">
          저장한 돌봄 기록
        </h2>
        {reports.length > 0 ? (
          <ReportList reports={reports} />
        ) : (
          <div className="border-b border-line px-[2px] py-[14px]">
            <p className="text-[1.0625rem] leading-[1.45] font-bold text-ink">
              아직 저장한 돌봄 기록이 없습니다
            </p>
            <p className="mt-[4px] text-[0.9375rem] leading-[1.6] text-ink-soft">
              위 버튼에서 오늘 있었던 일을 말하거나 적으면, 개인정보를 확인한 뒤 이 기기에
              저장할 수 있습니다.
            </p>
          </div>
        )}
      </section>

      <details className="group mt-7 border-y border-line">
        <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-3 rounded-field px-[2px] text-[1.0625rem] leading-[1.45] font-bold text-ink transition-colors duration-150 active:bg-paper-2 [&::-webkit-details-marker]:hidden">
          <span>연습 현황·데이터 관리</span>
          <ChevronGlyph className="text-ink-ghost group-open:rotate-180" />
        </summary>
        <div className="pb-5">
          {suggestion && (
            <Link
              href={trainHref(suggestion.candidate.id)}
              aria-label={`${suggestion.candidate.title} 연습으로 가기. ${nextTrainingSentence(suggestion)}`}
              className="mb-4 flex min-h-[48px] items-center gap-[10px] rounded-card bg-brand-tint px-4 py-[14px] transition-colors duration-150 active:bg-mint-200"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[0.9375rem] leading-[1.45] font-bold text-brand-on-tint">
                  다음 연습 · {suggestion.candidate.title}
                </span>
                <span className="mt-[3px] block text-[0.9375rem] leading-[1.6] text-brand-on-tint">
                  {nextTrainingSentence(suggestion)}
                </span>
              </span>
              <span className="flex-none text-[0.9375rem] font-bold whitespace-nowrap text-brand-on-tint">
                가기 ›
              </span>
            </Link>
          )}

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
          />
          <p className="mt-[8px] text-[0.9375rem] leading-[1.6] text-ink-soft">
            {rubricCoverageSentence(rubricCoverage)}
          </p>

          {olderSessions.length > 0 && (
            <div className="mt-5">
              <EyebrowLabel className="mb-[2px]">지난 연습</EyebrowLabel>
              <div className="chim-rows">
                {olderSessions.map((record) => (
                  <TrainingRow
                    key={record.id}
                    record={record}
                    typeLabel={shortTypeLabel(record, typeByScenarioId)}
                  />
                ))}
              </div>
            </div>
          )}
          <section className="mt-5 border-t border-line pt-5" aria-labelledby="data-management-title">
            <h2
              id="data-management-title"
              className="mb-3 text-[1rem] leading-[1.45] font-bold text-ink"
            >
              데이터 관리
            </h2>
          <Link
            href="/history/certificate"
            className="flex min-h-[56px] w-full items-center justify-center rounded-card bg-paper-2 text-[1rem] font-bold text-ink transition-colors duration-150 active:bg-neutral-line"
          >
            이수 확인서 만들기
          </Link>
          <p className="mt-[8px] text-[0.9375rem] leading-[1.6] text-ink-soft">
            확인서에는 이수 사실만 담기며 판정과 대화 내용은 담기지 않습니다.
          </p>
          <Link
            href="/for-orgs"
            className="mt-[6px] inline-flex min-h-[48px] items-center rounded-field text-[0.9375rem] font-bold text-brand-800 transition-colors duration-150 active:bg-paper-2"
          >
            기관 담당자용 안내 보기 ›
          </Link>

          <div className="mt-4 rounded-card bg-paper-2 px-4 py-[14px]">
            <EyebrowLabel>이 기록이 쓰이는 곳</EyebrowLabel>
            <p className="mt-[8px] text-[0.9375rem] leading-[1.6] text-ink-soft">
              연습 기록은 이 기기에만 쌓입니다. 이수 여부와 일시는 기관 자체 직무교육의 내부
              증빙에 쓸 수 있지만, 법정 보수교육 이수 인정은 아닙니다. 판정과 대화 내용은 기관
              관리자에게 공개하거나 인사평가에 연결하지 않습니다.
            </p>

            {demoShown && (
              <button
                type="button"
                onClick={handleClearDemo}
                className="mt-[12px] flex min-h-[48px] w-full items-center justify-center rounded-card bg-paper text-[1rem] font-bold text-ink transition-colors duration-150 active:bg-neutral-line"
              >
                예시 기록만 지우기
              </button>
            )}

            <div className="mt-[14px] border-t border-line pt-[12px]">
              {confirmClear ? (
                <div>
                  <p className="text-[1rem] leading-[1.6] font-bold text-danger-ink">
                    이 기기의 연습 기록과 돌봄 기록을 모두 지울까요? 되돌릴 수 없습니다.
                  </p>
                  <p className="mt-[6px] text-[0.9375rem] leading-[1.6] text-ink-soft">
                    이수 횟수와 시간도 함께 지워집니다. 방문지 주소와 확정 전 원문은 포함되지
                    않으므로 각각 응급 안내와 돌봄 기록 만들기 화면에서 따로 지워 주세요.
                  </p>
                  <div className="mt-[10px] flex gap-2">
                    <button
                      type="button"
                      onClick={handleClear}
                      className="flex min-h-[64px] flex-1 items-center justify-center rounded-card bg-danger-ink text-[1rem] font-bold text-paper transition-colors duration-150 active:brightness-95"
                    >
                      네, 지웁니다
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClear(false)}
                      className="flex min-h-[48px] flex-1 items-center justify-center rounded-card bg-paper text-[1rem] font-bold text-ink-soft transition-colors duration-150 active:bg-neutral-line"
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="flex min-h-[48px] items-center rounded-field text-[0.9375rem] font-bold text-ink-soft transition-colors duration-150 active:bg-paper"
                >
                  이 기기의 기록 지우기
                </button>
              )}
            </div>
          </div>
          </section>
          <InlineDisclaimer size="md" tone="readable" className="mt-5" />
        </div>
      </details>
    </div>
  );
}

export default HistoryBoard;
