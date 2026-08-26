import type { Metadata } from "next";
import { ChevronGlyph } from "@/components/icons";
import Link from "next/link";
import type { ScenarioType } from "@/types";
import { EyebrowLabel, InlineDisclaimer, PageShell, ScreenHeader } from "@/components";
import { SOURCE_DOCS } from "@/data/docs";
import {
  getMatrixRow,
  MATRIX_LEVEL_LABELS,
  MATRIX_TYPE_LABELS,
  SCENARIO_MATRIX,
} from "@/data/matrix";
import { getActiveScenarios, SCENARIOS } from "@/data/scenarios";
import {
  FREE_ENTRY_EYEBROW,
  FREE_ENTRY_SUMMARY,
  FREE_ENTRY_TITLE,
  FREE_PRACTICE_HREF,
} from "@/lib/onlineFree";
import { FICTION_NOTICE, scenarioHref } from "./_components/constants";
import { PracticeCount } from "./_components/PracticeCount";
import { UnexploredCount } from "./_components/UnexploredCount";
import { scenarioBranchPrints } from "./_components/unexplored";

/* ── 훈련 목록 = 시안 7a ───────────────────────────────────────
   위에서부터: 헤더(훈련 + 한 줄) → 열린 시나리오 카드 → 「전체 12종 편성표 ⌄」 접힘 행
   → 가상 인물 고지 한 줄 → 인라인 고지.
   카드 수는 데이터(getActiveScenarios)에서 옵니다 — 시나리오가 늘면 카드도 함께 늡니다.

   카드는 시안의 인라인 값 그대로입니다 — paper-2 면 radius 14, 15/16px 안쪽 여백,
   eyebrow 12/700 muted · 제목 17/700 · 한 줄 요약 13.5 ink-soft · 하단 [해 본 횟수 | 연습하기 ›].
   **루브릭 코드(LO/RE/SA/CO)는 이 화면에 노출하지 않습니다**(가이드 v4 §4.10) —
   12종 편성표와 학습목표 원문은 각각 접힘 안에 있습니다.
   ─────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: "훈련",
  description:
    "치매 행동·응급 판단·갈등 대응을 말로 연습합니다. 정답 시험이 아니라 말이 나오게 만드는 연습입니다.",
};

/** 카드 eyebrow의 유형 낱말 — 시안 7a의 표기입니다(데이터의 긴 유형명 대신 목록용 짧은 말). */
const TYPE_SHORT: Record<ScenarioType, string> = {
  BPSD: "치매 행동",
  EMERGENCY: "응급 판단",
  CONFLICT: "갈등 대응",
  RISK: "위험 판단",
};

/** 매트릭스 세로축 라벨(「① BPSD」)을 카드와 같은 낱말로 옮깁니다. */
const MATRIX_TYPE_SHORT: Record<string, string> = {
  "① BPSD": "치매 행동",
  "② 응급": "응급 판단",
  "③ 갈등": "갈등 대응",
  "④ 위험 판단": "위험 판단",
};

/**
 * 카드 한 줄 요약 — 시안 7a의 카피입니다.
 * 데이터(`scenario.summary`)는 설계 문서용 문장이라 목록에서는 이 짧은 말을 씁니다.
 * 모르는 시나리오가 들어오면 데이터 쪽 요약으로 물러섭니다.
 */
const CARD_SUMMARY: Record<string, string> = {
  "CHK-A01": "저녁마다 집에 가겠다는 어르신 — 막지 않고 말로 방향 바꾸기",
  "CHK-A02": "새벽에 출근하시겠다는 어르신 — 다른 분들을 깨우지 않고 원인 찾기",
  /* 이 카드의 핵심은 「하지 않는 것이 대응인 순간」입니다 — 넘어지신 어르신이 손을 내미실 때,
     일으켜 드리는 대신 관찰하고 알리는 쪽을 고르는 훈련이라는 사실이 목록에서 먼저 보여야 합니다. */
  "CHK-B01": "넘어지신 어르신이 손을 내미실 때 — 일으키지 않고 관찰과 보고로 가기",
  "CHK-B02": "기침이 멎는 순간을 알아채기 — 진짜 응급이 되면 AI가 빠집니다",
  /* 폭언·호칭 격하는 이 시나리오 S3의 실제 장면입니다(chk-c01.ts T2 「이모님, 유난이시네」).
     요약에서 빼 두면 카드가 「거절 연습」으로만 읽혀, 정작 준비해 온 상황과 대조되지 않습니다. */
  "CHK-C01": "폭언·호칭 격하에 흔들리지 않고, 해 드릴 수 없는 일을 관계를 지키며 거절하기",
  "CHK-C02": "원인을 모르는 멍 앞에서 — 단정하지 않고 기록으로 답하기",
};

/** 첫 카드에만 붙는 안내 — 어디부터 해야 할지 묻지 않게 합니다(시안 7a). */
const FIRST_CARD_HINT = "처음이라면 여기부터";

/**
 * 카드 한 글자 마커 — 응급 5종 목록과 같은 스캔 장치입니다(42px · radius 12).
 *
 * 아이콘도 이모지도 쓰지 않습니다. 옆 제목이 뜻을 전하므로 마커는 **어디쯤인지 눈이 먼저 찾는
 * 표식**이고, 보조기술에는 읽히지 않습니다. 글자는 그 상황에서 가장 먼저 보이는 장면 하나입니다.
 */
const CARD_MARK: Record<string, string> = {
  "CHK-A01": "현", // 현관
  "CHK-A02": "새", // 새벽
  "CHK-B01": "손", // 내미신 손
  "CHK-B02": "사", // 사레
  "CHK-C01": "반", // 반찬
  "CHK-C02": "멍",
};

/**
 * 대사 감수가 끝나지 않은 시나리오 — 카드 하단에 한 줄로 적습니다.
 *
 * 「열렸다」와 「감수까지 끝났다」는 다른 말입니다. 둘을 같은 얼굴로 두면 나머지 표기의
 * 신뢰도 함께 떨어지므로, 감수 대기 상태를 카드에서 먼저 밝힙니다.
 * (/safety 「현직 감수 현황」의 시나리오 대사 줄과 같은 사실을 가리킵니다.)
 *
 * 자리는 2026-08-24에 옮겼습니다 — 예전에는 eyebrow 끝에 「알파 초안 — 현직 감수 대기」로
 * 붙어, 제목보다 먼저 읽히는 자리에서 개발 단계 이름을 말하고 있었습니다.
 * 사실은 그대로 두고 **말과 자리만** 바꿉니다: 뜻은 「사람이 더 볼 것이 남았다」 하나뿐이고,
 * 그 말이 연습을 막지 않도록 카드 맨 아래 각주 단으로 내립니다.
 *
 * 목록은 손으로 적지 않습니다 — 원천은 시나리오 데이터의 `reviewPending` 필드 하나이고,
 * /check 「시나리오 감수 상태」 항목도 같은 필드를 셉니다(8/24 단일화).
 */
const REVIEW_PENDING_LABEL = "전문가 검토를 받고 있어요";
/**
 * 무엇이 검토 중이고 무엇은 아닌지 — 한 줄로 갈라 적습니다.
 *
 * 예전에는 「전문가 검토를 받고 있어요」 한 줄뿐이라, 읽으신 분이 「그럼 여기서 배운 건 아직 안
 * 맞을 수도 있다는 건가」로 받았습니다(현직 검증). 배운 대로 현장에서 했다가 어긋나면 책임은
 * 그분이 집니다. 솔직하게 밝힌 자리를 지우지 않고, 판단할 수 있게 범위를 적습니다.
 */
const REVIEW_PENDING_SCOPE =
  "현직 선생님들이 보고 계신 것은 어르신 대사 표현이에요. 판정 근거 문서는 확정본이에요.";
const REVIEW_PENDING_IDS: string[] = SCENARIOS.filter((s) => s.reviewPending).map((s) => s.id);

/** 편성표 아래 한 줄 — 잠긴 칸이 언제 열리는지만 답합니다(자세한 사유는 /safety가 들고 있습니다). */
const MATRIX_PENDING_NOTE = "준비 중인 상황은 전문가 검토가 끝나는 대로 열립니다.";

function levelLabelOf(level: 1 | 2 | 3): string {
  return MATRIX_LEVEL_LABELS.find((l) => l.level === level)?.label ?? "";
}

/** 시나리오 id로 난이도 낱말을 찾습니다 — 편성표(matrix.ts)가 이미 들고 있는 값입니다. */
function levelOf(scenarioId: string): string | null {
  const cell = SCENARIO_MATRIX.find((item) => item.scenarioId === scenarioId);
  return cell ? levelLabelOf(cell.level) : null;
}

/**
 * 편성표 제목에서 저작용 코드를 걷어냅니다 — 데이터는 그대로 두고 표시부에서만 지웁니다
 * (카드의 `stripInternalIds`와 같은 규칙입니다).
 *
 * @example matrixTitle("A01 현관 앞 귀가 요구") // "현관 앞 귀가 요구"
 */
function matrixTitle(raw: string): string {
  return raw.replace(/^[A-Z]\d{2}\s+/, "").trim();
}

export default function TrainIndexPage() {
  const scenarios = getActiveScenarios();
  const openCount = SCENARIO_MATRIX.filter((cell) => cell.scenarioId).length;
  const lockedCount = SCENARIO_MATRIX.length - openCount;

  return (
    <PageShell sourceDocs={SOURCE_DOCS}>
      {/* 부제는 「지금 할 일」을 적는 자리입니다.
          예전에는 고정 문구(「정답 시험이 아닙니다 — 말이 나오게 만드는 연습」)가 여기에도 있어,
          홈·브리핑·자유 연습·이력까지 다섯 자리에서 같은 말이 되풀이됐습니다. 네 번째로 읽으면
          안심이 아니라 「왜 자꾸 이 말을 하지, 진짜 시험인가 보다」가 됩니다(현직 검증).
          고정 문구는 홈과 첫 브리핑 두 곳에 그대로 남아 있습니다 — 지운 것이 아니라 자리를
          줄인 것이고, 이 자리는 지금 할 일에 내줍니다. */}
      <ScreenHeader title="훈련" subtitle="오늘 한 판 · 4~6분이면 끝나요" />

      {/* 열린 시나리오 카드 — 이 화면에서 면(paper-2)을 쓰는 곳은 이 카드들뿐입니다. */}
      <section className="mt-4 space-y-[10px]" aria-label="지금 연습할 수 있는 상황">
        {scenarios.map((scenario, index) => {
          /* 난이도 한 낱말 — 편성표를 펴 봐야 알 수 있던 값을 카드로 올립니다.
             두 번째 판을 고르러 오셨을 때 여섯 장 중 무엇이 쉬운지 카드만 보고는 알 수 없었고,
             실습 경험이 없는 분께는 그 한 낱말이 두 번째 판을 열지 말지를 가릅니다(교육생 검증).
             값은 이미 데이터(matrix.ts)에 있어 새로 정할 것이 없습니다. */
          const eyebrow = [
            TYPE_SHORT[scenario.type],
            levelOf(scenario.id),
            `약 ${scenario.durationMin}분`,
            index === 0 ? FIRST_CARD_HINT : null,
          ]
            .filter((part): part is string => Boolean(part))
            .join(" · ");
          const reviewPending = REVIEW_PENDING_IDS.includes(scenario.id);
          const mark = CARD_MARK[scenario.id] ?? scenario.title.slice(0, 1);

          return (
            <Link
              key={scenario.id}
              href={scenarioHref(scenario.id)}
              /* 화면에 보이기만 해도 카드 5장의 브리핑을 미리 받아 오던 자리입니다.
                 훈련 화면은 시나리오 데이터와 대사를 함께 들고 오는 무거운 라우트라,
                 목록을 열자마자 다섯 벌이 동시에 날아가면 정작 눌러서 들어가는 한 벌이 뒤로 밀립니다.
                 `false`는 프리페치를 끄는 것이 아니라 **시점을 옮기는 것**입니다 —
                 뷰포트 진입에는 받지 않고, 손가락이 올라간(hover) 뒤에 받습니다. */
              prefetch={false}
              /* aria-label을 걷었습니다(2026-08-26 · 페르소나 UI/UX low).
                 링크에 aria-label이 있으면 그 문자열이 카드 안 내용을 **전부 대체**합니다 —
                 난이도·소요시간 eyebrow, 한 줄 요약, 해 본 횟수, 그리고 3차에 새로 넣은
                 「안 가 본 갈래 N곳」이 낭독에서 통째로 빠지고 있었습니다. 하필 그 줄은
                 「같은 상황을 왜 또 하나」에 답하려고 만든 줄이라, 정확히 그 답이 필요한
                 분께만 닿지 않는 구조였습니다. 카드에 정보를 더할 때마다 격차가 벌어지는
                 방향이라 지금 걷습니다 — 이름은 카드 안 내용이 그대로 만들고,
                 목적지만 맨 끝 `sr-only` 한 조각이 덧붙입니다. */
              className="flex items-start gap-[12px] rounded-card bg-paper-2 px-4 py-[15px] transition-colors duration-150 ease-soft active:bg-neutral-line"
            >
              {/* 한 글자 마커 — 응급 목록과 같은 42px·radius 12·17px w800입니다.
                  다른 점은 면 하나뿐입니다: 응급은 붉은 면 위 danger-ink이고, 여기는 카드가 이미
                  paper-2라 같은 값을 쓰면 마커가 카드에 잠깁니다. 그래서 마커가 카드의 지면(흰 면)을
                  가져가고 글자는 ink-soft로 둡니다 — 관계(한 단 다른 중립 면 + ink-soft)는 같습니다. */}
              <span
                aria-hidden
                className="flex h-[2.625rem] w-[2.625rem] flex-none items-center justify-center rounded-field bg-paper text-[1.0625rem] leading-[1.3] font-extrabold text-ink-soft"
              >
                {mark}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-[0.7813rem] leading-[1.45] font-bold text-ink-muted">
                  {eyebrow}
                </span>
                <span className="mt-[4px] block text-[1.0625rem] leading-[1.45] font-bold text-ink">
                  {scenario.title}
                </span>
                <span className="mt-[4px] block text-[0.8438rem] leading-[1.6] text-ink-soft">
                  {CARD_SUMMARY[scenario.id] ?? scenario.summary}
                </span>
                <span className="mt-[10px] flex items-center gap-3">
                  {/* 해 본 횟수는 기기(localStorage)에서만 읽습니다 — 마운트 뒤에 채워집니다. */}
                  <PracticeCount scenarioId={scenario.id} />
                  {/* 색이 brand-800인 이유 — 카드 면이 paper-2(눌리면 neutral-line)입니다.
                      brand-700은 흰 지면 전용이라 여기서 4.49:1 · 눌림 3.90:1로 AA 미달이고,
                      brand-800은 6.27:1 · 5.45:1입니다(globals.css의 brand-700 주석이 정본). */}
                  <span
                    aria-hidden
                    className="ml-auto text-[0.9375rem] leading-none font-bold text-brand-800"
                  >
                    연습하기 ›
                  </span>
                </span>
                {/* 완주하신 적이 있는 카드에만 서는 한 줄 — 「같은 상황을 왜 또 하나」에 답합니다.
                    갈래 수는 기기에 남은 회차 기록으로 브라우저가 세고(서버는 지문표만 넘깁니다),
                    한 번도 안 하신 카드에는 아예 붙지 않습니다. */}
                <UnexploredCount
                  scenarioId={scenario.id}
                  prints={scenarioBranchPrints(scenario)}
                  className="mt-[6px]"
                />
                {/* 감수 대기 — 카드에서 가장 조용한 줄입니다. 연습을 막는 말이 아니라 사실 한 줄입니다. */}
                {reviewPending && (
                  <span className="mt-[6px] block text-[0.7813rem] leading-[1.45] text-ink-faint">
                    {REVIEW_PENDING_LABEL}
                    <span className="mt-[2px] block">{REVIEW_PENDING_SCOPE}</span>
                  </span>
                )}
                {/* 목적지 — 눈으로는 「연습하기 ›」 셰브론이 말하고(그쪽은 aria-hidden),
                    낭독에는 이 한 조각이 말합니다. 카드 이름의 맨 끝에 붙습니다. */}
                <span className="sr-only">브리핑 열기</span>
              </span>
            </Link>
          );
        })}
      </section>

      {/* 전체 12종 편성표 — 기본은 접혀 있습니다. 펼치면 유형 4종 × 난이도 3단계 매트릭스입니다. */}
      <details className="group mt-4">
        <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 border-t border-line px-[2px] py-[13px] text-[0.9375rem] leading-[1.45] font-semibold text-ink [&::-webkit-details-marker]:hidden">
          <span>
            전체 {SCENARIO_MATRIX.length}종 편성표{" "}
            <span className="font-medium text-ink-faint">
              — {openCount}종 열림 · {lockedCount}종 준비 중
            </span>
          </span>
          <ChevronGlyph size="sm" className="flex-none text-ink-ghost group-open:rotate-180" />
        </summary>

        <div className="pb-2">
          {MATRIX_TYPE_LABELS.map((typeLabel) => (
            <section key={typeLabel} className="pt-[10px] pb-1">
              <EyebrowLabel>{MATRIX_TYPE_SHORT[typeLabel] ?? typeLabel}</EyebrowLabel>
              <ul className="mt-[2px]">
                {getMatrixRow(typeLabel).map((cell) => {
                  const open = Boolean(cell.scenarioId);
                  return (
                    <li
                      key={`${cell.typeLabel}-${cell.level}`}
                      className="flex items-baseline gap-[10px] border-b border-line py-[9px] last:border-b-0"
                    >
                      <span className="w-[30px] flex-none text-[0.7813rem] leading-[1.45] font-semibold text-ink-faint">
                        {levelLabelOf(cell.level)}
                      </span>
                      <span
                        className={`min-w-0 flex-1 text-[0.8438rem] leading-[1.45] ${open ? "font-semibold text-ink" : "text-ink-muted"}`}
                      >
                        {/* 저작용 코드(A01·B01·C00)는 화면에 내지 않습니다 — 난이도와 제목만 남깁니다.
                            데이터(`src/data/matrix.ts`)는 그대로이고, 지우는 것은 표시부뿐입니다. */}
                        {matrixTitle(cell.title)}
                      </span>
                      {/* 「열림」은 **상태어**입니다 — 이 행은 <li>라 누를 수 없습니다.
                          브랜드색으로 칠해 두면 목록에서 「여기가 열린 문」으로 읽혀 오조작을
                          부릅니다(1차·2차 페르소나 UI/UX 지적). 위계는 색이 아니라 굵기와
                          ink-soft ↔ ink-faint 두 단이 만듭니다. */}
                      <span
                        className={`flex-none text-[0.7188rem] leading-[1.45] font-semibold ${open ? "text-ink-soft" : "text-ink-faint"}`}
                      >
                        {open ? "열림" : "준비 중"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          {/* 여기 있던 두 문단(루브릭 30항목·생성 통제 3계층이 한 번씩 지나간다는 문단과,
              ④ 위험 판단 유형의 베타 이연 사유 문단)은 2026-08-24에 걷어냈습니다.
              둘 다 사실이지만 **심사에 답하는 문장**이라, 연습할 상황을 고르시는 화면에서
              가장 마지막으로 읽히는 자리를 차지하고 있었습니다.
              같은 내용은 /safety가 근거·실측과 함께 그대로 들고 있습니다 — 지운 것이 아니라
              자리를 옮긴 것이고, 이 화면에는 「언제 열리는가」 한 줄만 남깁니다. */}
          <p className="mt-[10px] text-[0.7188rem] leading-[1.6] text-ink-faint">
            {MATRIX_PENDING_NOTE}
          </p>
        </div>
      </details>

      {/* 자유 연습으로 들어가는 유일한 문 — 탭바에는 넣지 않습니다.
          위 카드들과 같은 문법(paper-2 면 · radius 14 · eyebrow → 제목 → 한 줄)을 쓰되,
          「검증된 여섯 종」과 나란히 놓지 않으려고 편성표 아래에 따로 세웁니다.
          카드에 적는 두 낱말(온라인 · 채점 없음)이 이 모드의 조건 전부입니다 —
          들어가 보고 나서야 「회선이 필요하다」를 알게 되지 않도록 문 앞에 적어 둡니다. */}
      <section className="mt-4 border-t border-line pt-4" aria-label="자유 연습">
        <Link
          href={FREE_PRACTICE_HREF}
          prefetch={false}
          /* 위 시나리오 카드와 같은 이유로 aria-label을 걷었습니다 — 이 카드에서 가려지던 것은
             한 줄 요약과 「온라인 모드가 필요해요」 한 줄이었습니다. 하필 그 줄이 「들어가 보고
             나서야 회선이 필요하다는 걸 알게 되지 않도록」 문 앞에 적어 둔 조건입니다. */
          className="block rounded-card bg-paper-2 px-4 py-[15px] transition-colors duration-150 ease-soft active:bg-neutral-line"
        >
          <span className="block text-[0.7813rem] leading-[1.45] font-bold text-ink-muted">
            {FREE_ENTRY_EYEBROW}
          </span>
          <span className="mt-[4px] block text-[1.0625rem] leading-[1.45] font-bold text-ink">
            {FREE_ENTRY_TITLE}
          </span>
          <span className="mt-[4px] block text-[0.8438rem] leading-[1.6] text-ink-soft">
            {FREE_ENTRY_SUMMARY}
          </span>
          <span className="mt-[10px] flex items-center gap-3">
            {/* 켜는 자리까지 적습니다 — 「온라인 모드를 켜야 열립니다」만 있으면, 와이파이에
                붙어 있는데 왜 안 열리는지·내가 뭘 잘못한 건지 알 길이 없습니다(현직 검증).
                들어가면 그 화면이 바로 켜는 버튼을 세워 줍니다(8/25 보강) — 홈으로 돌려보내지 않습니다. */}
            <span className="min-w-0 text-[0.7813rem] leading-[1.45] text-ink-faint">
              온라인 모드가 필요해요. 들어가시면 바로 켜실 수 있어요
            </span>
            {/* brand-800 — 위 시나리오 카드와 같은 면(paper-2)이라 같은 규칙입니다. */}
            <span aria-hidden className="ml-auto text-[0.9375rem] leading-none font-bold text-brand-800">
              열어 보기 ›
            </span>
          </span>
          <span className="sr-only">자유 연습 열기</span>
        </Link>
      </section>

      {/* 가상 인물 고지 한 줄 — 대사가 없는 화면이라 목록 끝에 조용히 답니다.

          그 옆에 「처음 오신 분께」로 가는 문을 하나 답니다. 이 앱에서 그 문은 홈 맨 아래 링크
          줄에만 있었는데, 처음 오신 분이 실제로 망설이는 자리는 홈이 아니라 **여섯 장 중 하나를
          고르는 이 화면**입니다(2026-08-25 · 페르소나 교육생). 카드 위로 올리면 목록을 가리므로,
          고지 줄과 같은 자리에서 한 줄로만 엽니다. */}
      <div className="mt-[10px] flex flex-wrap items-center justify-between gap-x-3">
        <p className="min-w-0 flex-1 text-[0.7188rem] leading-[1.6] text-ink-faint">
          {FICTION_NOTICE}
        </p>
        <Link
          href="/guide"
          prefetch={false}
          className="inline-flex min-h-[48px] flex-none items-center rounded-field text-[0.8438rem] leading-[1.45] font-bold text-brand-700 transition-colors duration-150 active:bg-paper-2"
        >
          처음 오신 분께 ›
        </Link>
      </div>

      <InlineDisclaimer size="md" tone="readable" className="mt-5 mb-6" />
    </PageShell>
  );
}
