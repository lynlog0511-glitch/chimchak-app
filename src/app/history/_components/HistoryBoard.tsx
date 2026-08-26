"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ScenarioType, SessionRecord } from "@/types";
import { EyebrowLabel, InlineDisclaimer, cx } from "@/components";
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
      {/* 시연용 예시가 섞여 있으면 화면이 먼저 밝힙니다 — 예시가 증빙으로 오인되면 안 됩니다.
          지우기는 예시만 지우고, 이 기기의 진짜 기록과 이수 시수는 그대로 둡니다. */}
      {demoShown && (
        <section
          aria-labelledby="demo-notice-title"
          className="mb-4 rounded-card bg-warn-soft px-4 py-[14px]"
        >
          <h2
            id="demo-notice-title"
            className="text-[0.9375rem] leading-[1.45] font-extrabold text-warn-ink"
          >
            체험용 예시 기록이 표시되고 있습니다
          </h2>
          <p className="mt-[5px] text-[0.8438rem] leading-[1.6] text-ink-soft">
            화면 확인을 위해 심어 둔 {DEMO_SEED_SUMMARY}이 아래 목록에 섞여 있습니다. 해당 행에는
            「예시」 표시가 붙고, 이수 확인서에는 「예시 미리보기」로 인쇄됩니다. 실제 이수 시수
            누계에는 들어가지 않습니다.
          </p>
          <button
            type="button"
            onClick={handleClearDemo}
            className="mt-[10px] flex min-h-[48px] w-full items-center justify-center rounded-card bg-paper text-[0.9375rem] font-bold text-ink transition-colors duration-150 active:bg-paper-2"
          >
            예시 기록 한 번에 지우기
          </button>
          <p className="mt-[6px] text-[0.7813rem] leading-[1.6] text-ink-soft">
            예시만 지웁니다. 직접 완주하신 기록과 이수 시수는 그대로 남습니다.
          </p>
        </section>
      )}

      {/* 다음엔 이 장면 — 추천 규칙은 순수 함수가 정하고, 여기서는 장면 이름과 이유 한 줄만 답니다.
          tint 면 위 글자는 `brand-on-tint`(#0f3f3a · tint 위 10.3:1) **한 단**입니다(2026-08-25).
          예전에는 한 카드 안에 brand-700(eyebrow)·brand-900(제목)·brand-800(본문)·brand-700(CTA)
          네 단이 얹혀 있어 카드 하나가 팔레트 견본처럼 보였습니다 — 가이드 §1은 tint 면 위
          텍스트를 brand-on-tint 한 단으로 지정합니다. 위계는 크기와 굵기가 만듭니다. */}
      {suggestion && (
        <Link
          href={trainHref(suggestion.candidate.id)}
          aria-label={`${suggestion.candidate.title} 훈련으로 가기. ${nextTrainingSentence(suggestion)}`}
          /* 좌우 여백은 이 화면의 다른 면 카드들과 같은 rem 한 값입니다(px-4 = 1rem).
             2026-08-26에 px-[15px]에서 옮겼습니다 — 한 화면에 세로로 쌓이는 카드 셋이
             15px(px 고정)·16px(rem) 두 단위계로 갈려 있어, 「아주 크게」에서 어긋남이
             1px에서 5px로 벌어졌습니다(페르소나 디자이너 med). */
          className="mb-4 flex min-h-[48px] items-center gap-[10px] rounded-card bg-brand-tint px-4 py-[14px] transition-colors duration-150 active:bg-mint-200"
        >
          <span className="min-w-0 flex-1">
            {/* 링크 안이라 문단(EyebrowLabel)을 넣을 수 없는 자리입니다 —
                크기·자간은 그 컴포넌트와 같은 값으로 맞춰 둡니다(12.5px / 700 / +.06em). */}
            <span className="block text-[0.7813rem] leading-[1.45] font-bold tracking-[0.06em] text-brand-on-tint">
              다음엔 이 장면
            </span>
            {/* 장면 이름을 먼저 세웁니다 — 어디로 가는지가 이유보다 먼저 읽혀야 합니다. */}
            <span className="mt-[2px] block text-[0.9375rem] leading-[1.45] font-bold text-brand-on-tint">
              {suggestion.candidate.title}
            </span>
            {/* 왜 이 장면인지 — 최근 코칭이 가리킨 항목을 그대로 문장으로 답니다(숫자 없음). */}
            <span className="mt-[3px] block text-[0.8438rem] leading-[1.6] text-brand-on-tint">
              {nextTrainingSentence(suggestion)}
            </span>
          </span>
          <span className="flex-none text-[0.9375rem] font-bold whitespace-nowrap text-brand-on-tint">
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
      />
      {/* 채점표 커버리지 한 줄 — 유형 4칸이 「무엇을 몇 번」이라면, 이 줄은 「어디까지 지나왔나」
          입니다. 세 종만 돌려도 30항목이 한 번씩 다 나온다는 편성 원칙을 화면이 직접 세어
          확인해 줍니다(페르소나 PM med). 숫자는 둘까지이고 점수·등급은 여전히 없습니다. */}
      <p className="mt-[8px] mb-[18px] text-[0.8438rem] leading-[1.6] text-ink-soft">
        {rubricCoverageSentence(rubricCoverage)}
      </p>

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
          <p className="text-[1.0625rem] leading-[1.45] font-bold text-ink">
            아직 완주한 훈련이 없습니다
          </p>
          {/* 고정 문구(「정답을 맞히는 시험이 아니라…」)를 이 자리에서 걷었습니다(2026-08-26).
              한 글자도 바꾸지 않고 **자리만** 줄인 것입니다 — 문구는 홈 히어로·/guide·첫 브리핑
              세 곳에 그대로 있습니다. 네 번째로 읽히면 안심이 아니라 「왜 자꾸 이 말을 하지,
              진짜 시험인가 보다」가 됩니다(현직 검증 · /train 부제에서 같은 이유로 이미 뺀 자리).
              이력 화면의 빈 상태가 할 말은 따로 있습니다 — **여기에 무엇이 남는가**입니다. */}
          <p className="mt-[3px] text-[0.7813rem] leading-[1.6] text-ink-soft">
            한 번 마치시면 이 자리에 잘한 것과 다시 볼 것이 문장으로 남습니다. 점수·등급은
            남지 않습니다.
          </p>
          {/* 링크 셋(여기·「기관 담당자용 안내」·「음성 보고하러 가기」)의 글자는 brand-800입니다.
              정본 지면은 흰색이지만 **눌리는 순간 paper-2**가 되고, 그 면에서 brand-700은
              4.49:1(AA 하한 4.5)입니다 — 「지면이 흰색이 아닌 순간이 있으면 brand-800」이
              globals.css와 가이드 §9-8이 적은 한 줄이고, 이제 게이트도 변형 접두가 붙은 면을
              함께 셉니다(5차 페르소나 디자이너 low — 문서·게이트·실코드 3단 어긋남). */}
          <Link
            href="/train"
            className="mt-[6px] inline-flex min-h-[48px] items-center rounded-field text-[0.9375rem] font-bold text-brand-800 transition-colors duration-150 active:bg-paper-2"
          >
            첫 훈련 시작하기 ›
          </Link>
        </div>
      )}

      {/* 이수 확인서 — 인쇄용 화면으로 나갑니다(이수 사실만 담습니다). */}
      <Link
        href="/history/certificate"
        className="mt-4 flex min-h-[50px] w-full items-center justify-center rounded-card bg-paper-2 text-[0.9375rem] font-bold text-ink transition-colors duration-150 active:bg-neutral-line"
      >
        이수 확인서 만들기
      </Link>
      {/* 안심 문구는 고지가 아니라 읽으라고 두는 줄입니다 — 크기·대비를 한 단계 올려 둡니다. */}
      <p className="mt-[8px] text-center text-[0.8438rem] leading-[1.6] text-ink-soft">
        확인서에는 이수 사실만 담깁니다. 판정과 대화 내용은 담기지 않습니다.
      </p>
      {/* 기관 담당자는 이 화면까지 따라오는 일이 잦습니다 — 탭바에는 두지 않고 여기서만 엽니다. */}
      <p className="mt-[6px] text-center">
        <Link
          href="/for-orgs"
          className="inline-flex min-h-[48px] items-center rounded-field text-[0.8438rem] font-bold text-brand-800 transition-colors duration-150 active:bg-paper-2"
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
          <p className="text-[1.0625rem] leading-[1.45] font-bold text-ink">
            아직 확정한 기록이 없습니다
          </p>
          <p className="mt-[3px] text-[0.7813rem] leading-[1.6] text-ink-soft">
            오늘 있었던 일을 말로 보고하시면 이름·번호를 가린 뒤 급여제공기록지 5요소 초안이
            만들어집니다.
          </p>
          <Link
            href="/report"
            className="mt-[6px] inline-flex min-h-[48px] items-center rounded-field text-[0.9375rem] font-bold text-brand-800 transition-colors duration-150 active:bg-paper-2"
          >
            음성 보고하러 가기 ›
          </Link>
        </div>
      )}

      {/* 이 기록이 어디에 쓰이는지 — 면 카드 한 장으로 조용히 둡니다. */}
      <div className="mt-7 rounded-card bg-paper-2 px-4 py-[14px]">
        <EyebrowLabel>이 기록이 쓰이는 곳</EyebrowLabel>
        <p className="mt-[8px] text-[0.8438rem] leading-[1.6] text-ink-soft">
          훈련 이력은 이 기기에만 쌓입니다. 기관에서 요구하는 보수교육·직무평가 증빙으로 쓰실 수
          있도록 이수 여부와 이수 일시를 중심으로 남깁니다. 내부 판정 결과와 대화 내용은 기관
          관리자에게 공개되지 않고 인사평가에 연동하지 않습니다.
        </p>
        {/* 오독 방지 — 확인서 하단 각주와 같은 문장을 여기에도 둡니다(경계는 두 곳에서 같아야 합니다). */}
        <p className="mt-[8px] text-[0.8438rem] leading-[1.6] font-bold text-ink">
          이 기록과 이수 확인서는 앱 기록 기반이며 법정 보수교육 이수 인정이 아닙니다 — 기관 자체
          직무교육·정기평가 내부 증빙용입니다.
        </p>
        <p className="mt-[8px] text-[0.8438rem] leading-[1.6] text-ink-soft">
          훈련 속 인물은 전원 가상이며, 대사는 검수된 문장을 바탕으로 합니다. 하신 말씀 원문은
          어디에도 저장하지 않습니다.
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
                  className="flex min-h-[48px] flex-1 items-center justify-center rounded-card bg-danger-ink text-[0.9375rem] font-bold text-paper transition-colors duration-150 active:brightness-95"
                >
                  네, 지웁니다
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="flex min-h-[48px] flex-1 items-center justify-center rounded-card bg-paper text-[0.9375rem] font-bold text-ink-soft transition-colors duration-150 active:bg-neutral-line"
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
