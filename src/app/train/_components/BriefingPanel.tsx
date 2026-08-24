"use client";

import type { ReactNode } from "react";
import { ChevronGlyph } from "@/components/icons";
import { unlockAudio } from "@/lib/speech";
import Link from "next/link";
import { BigButton, InlineDisclaimer, SourceChip } from "@/components";
import { progressStepCount, type SessionProgress } from "@/lib/storage";
import type { PersonaDef, Scenario, ScenarioType } from "@/types";
import { FICTION_NOTICE, initialOf, PRACTICE_LINE, ROLE_LABEL } from "./constants";

export interface BriefingPanelProps {
  scenario: Scenario;
  /** 마이크를 쓸 수 있는 환경인지 — 폴백 안내 문구를 바꿉니다 */
  micSupported: boolean;
  onStart: () => void;
  /** 이 시나리오에 진행하던 훈련이 남아 있으면 맨 위에 「이어서 하기」 카드를 띄웁니다 */
  checkpoint?: SessionProgress | null;
  onResume?: () => void;
}

/** 브리핑 eyebrow의 유형 낱말 — 시안 6f의 표기(「치매 행동 대응」)를 씁니다. */
const TYPE_BRIEF: Record<ScenarioType, string> = {
  BPSD: "치매 행동 대응",
  EMERGENCY: "응급 초기 대응",
  CONFLICT: "이용자·보호자 갈등 화법",
  RISK: "위험 판단",
};

const COUNT_WORD = ["", "한", "두", "세", "네", "다섯", "여섯", "일곱", "여덟", "아홉", "열"];

/** 「여섯 상황」 — 열 이하는 한글 수사로, 그보다 많으면 숫자로 적습니다. */
function countWord(n: number): string {
  return COUNT_WORD[n] ?? String(n);
}

/**
 * 이 상황에서 학습자가 말하게 되는 지점의 수.
 * 돌발 변수 턴은 조건이 맞을 때만 열리므로 세지 않습니다 — 세션 헤더의 「N째 상황」과 같은 기준입니다.
 */
function situationCount(scenario: Scenario): number {
  return scenario.turns.filter((turn) => turn.cue && !turn.isTrigger).length;
}

/**
 * 학습목표에서 코드 표기를 걷어냅니다 — 「LO-1 …합니다. (RE-01, RE-02)」 → 「…합니다.」
 * 루브릭 코드는 기본 화면에 내지 않고 「이 훈련의 설계 보기」 안에서 원문 그대로 보여 드립니다(가이드 v4 §4.10).
 */
function objectiveText(raw: string): string {
  return raw
    .replace(/^LO-\d+\s*/, "")
    .replace(/\s*\([^()]*\)\s*$/, "")
    .trim();
}

/**
 * 제약 조건에서 코드 표기를 걷어냅니다 — 「C1 서비스 종료 20분 전입니다 …」 → 「서비스 종료 20분 전입니다 …」
 * (학습목표의 `objectiveText`와 같은 규칙입니다 — 데이터는 그대로 두고 표시부에서만 지웁니다.)
 */
function constraintText(raw: string): string {
  return raw.replace(/^C\d+\s*/, "").trim();
}

/**
 * 「이 훈련의 설계 보기」 안에서는 번호를 살려 두되, 코드가 아니라 **말**로 적습니다 —
 * 「C1 서비스 종료 20분 전입니다」 → 「제약 1 · 서비스 종료 20분 전입니다」.
 * 번호를 지우지 않는 이유는 이 접힘이 조건들을 서로 가리키며 읽는 자리이기 때문이고,
 * C를 지우는 이유는 그 글자가 이 앱 어디에서도 설명되지 않는 저작용 표기이기 때문입니다.
 *
 * @example constraintDetail("C1 서비스 종료 20분 전입니다.") // "제약 1 · 서비스 종료 20분 전입니다."
 * @example constraintDetail("현관 도어락은 안에서 열립니다.") // 그대로
 */
function constraintDetail(raw: string): string {
  const text = raw.trim();
  const match = /^C(\d+)\s*([\s\S]*)$/.exec(text);
  if (!match) return text;
  return `제약 ${match[1]} · ${match[2].trim()}`;
}

/** 「박 어르신 (가상 인물)」 → 「박 어르신」 — 한 줄 소개에서 괄호가 두 번 나오지 않게 합니다. */
function plainName(name: string): string {
  return name.replace(/\s*\((?:가상 인물|사용자 본인)\)\s*/g, " ").trim();
}

/** 프로필 첫 마디만 — 「자격 취득 2개월 · 이 가정 배정 3일차 …」 → 「자격 취득 2개월」 */
function shortProfile(profile: string): string {
  const head = profile.split("·")[0] ?? "";
  return head
    .trim()
    .replace(/입니다\.?$/, "")
    .replace(/[.·]$/, "")
    .trim();
}

/**
 * 상황 카드 아래 한 줄 — 「나 — 배정 3주차 · 박 어르신 — AI가 연기하는 가상 인물」.
 * 나머지 인물은 「등장인물 자세히」 접힘 안에 있습니다.
 */
function castLine(personas: readonly PersonaDef[]): string {
  const learner = personas.find((p) => p.role === "learner");
  const counterpart = personas.find((p) => p.role !== "learner");
  const parts: string[] = [];
  if (learner) {
    const short = shortProfile(learner.profile);
    parts.push(short ? `나 — ${short}` : "나");
  }
  if (counterpart) parts.push(`${plainName(counterpart.name)} — AI가 연기하는 가상 인물`);
  return parts.join(" · ");
}

/** 접이식 한 칸 — 시안 6f의 접힘 행(14.5px/600 + ⌄)입니다. 터치 영역은 48px을 지킵니다. */
function Fold({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group border-t border-line">
      <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 rounded-field px-[2px] py-[12px] text-[0.9375rem] leading-[1.45] font-semibold text-ink transition-colors duration-150 active:bg-paper-2 [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <ChevronGlyph size="sm" className="flex-none text-ink-ghost group-open:rotate-180" />
      </summary>
      <div className="px-[2px] pb-5">{children}</div>
    </details>
  );
}

/**
 * 저장 시각 표기 — "8월 5일 오후 2:13".
 * 브라우저에서만 그려지므로(체크포인트를 기기에서 읽어 옵니다) 서버·클라이언트 표기가 어긋날 일이 없습니다.
 */
function formatSavedAt(iso: string): string {
  if (!iso) return "";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(at);
  } catch {
    return "";
  }
}

/**
 * 「이어서 하기」 — 진행하던 훈련이 남아 있을 때만 맨 위에 섭니다.
 * 조용한 안내라 면 하나(`#f5f6f6`)에 얹고 배지도 액센트도 쓰지 않습니다.
 *
 * 「처음부터」는 여기에 두지 않습니다 — 같은 동작을 하는 버튼이 화면에 둘이면
 * 그중 가장 크고 채워진 버튼이 이어하기를 조용히 날립니다(평가 UI/UX m6 실측).
 * 다시 시작하는 길은 아래 주 버튼 한 곳으로 모읍니다.
 */
function ResumeBlock({
  progress,
  onResume,
}: {
  progress: SessionProgress;
  onResume: () => void;
}) {
  const savedAt = formatSavedAt(progress.savedAt);
  const step = progressStepCount(progress);
  const meta = savedAt ? `${step}번째 상황까지 · ${savedAt} 저장` : `${step}번째 상황까지`;

  return (
    <div className="rounded-[14px] bg-paper-2 px-4 py-[16px]">
      <h2 className="text-[0.9375rem] leading-[1.45] font-bold text-ink">진행하던 훈련이 있습니다</h2>
      <p className="mt-1 text-[0.7813rem] leading-[1.45] font-semibold text-ink-muted">{meta}</p>
      <p className="mt-2 text-[0.7813rem] leading-[1.6] text-ink-muted">
        저장해 둔 것은 어느 갈래를 고르셨는지와 진행 위치뿐입니다. 말씀하신 내용은 기기에도 남기지
        않았습니다.
      </p>
      <div className="mt-3">
        <BigButton
          onClick={() => {
            unlockAudio();
            onResume();
          }}
          block
        >
          이어서 하기
        </BigButton>
      </div>
    </div>
  );
}

/**
 * 시나리오 시작 전 브리핑 = 시안 6f.
 *
 * **시작 버튼이 첫 화면 안에 들어옵니다** — 기본 노출은 네 가지뿐입니다:
 * 상황 지문 카드(지문 · 지금 걸려 있는 것 한 줄 · 인물 한 줄) · 고정 문구 ·
 * 누르기 전 안내 두 줄 · 「훈련 시작하기」.
 * 학습목표·인물 상세·응답 방법(마이크 권한 안내)·설계(루브릭 코드·근거 문서·제약 조건)는
 * 전부 ⌄ 접힘 안에 있습니다.
 */
export function BriefingPanel({
  scenario,
  micSupported,
  onStart,
  checkpoint,
  onResume,
}: BriefingPanelProps) {
  const situations = situationCount(scenario);
  const eyebrow = [
    TYPE_BRIEF[scenario.type],
    `약 ${scenario.durationMin}분`,
    situations > 0 ? `${countWord(situations)} 상황` : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" · ");

  const cast = castLine(scenario.personas);
  /**
   * 상황 한 줄 더 — 이 장면에서 **지금 몸으로 걸리는 것** 하나입니다.
   *
   * 지문은 눈에 보이는 것(시각·자리·기온)을 적고, 이 줄은 그 위에 얹힌 압박을 적습니다
   * (「서비스 종료 20분 전」·「야간 단독 근무」). 새로 지어낸 문장이 아니라 시나리오
   * 데이터의 제약 조건 첫 항목 그대로이고, 나머지 제약은 아래 「이 훈련의 설계 보기」에 있습니다.
   */
  const pressure = scenario.constraints[0] ? constraintText(scenario.constraints[0]) : "";
  /** 이어할 진행이 남아 있는 화면인지 — 아래 주 버튼의 뜻이 「처음부터」로 바뀝니다. */
  const resuming = Boolean(checkpoint && onResume);

  /* 고정 문구는 한 글자도 바꾸지 않고, 시안처럼 가운데 한 마디만 굵게 둡니다.
     문구가 바뀌어 갈라지지 않으면 그대로 한 덩어리로 나갑니다. */
  const EMPHASIS = "말이 나오게 만드는 연습";
  const [lineHead, lineTail] = PRACTICE_LINE.split(EMPHASIS);
  const splitOk = typeof lineTail === "string";

  return (
    <div className="mx-auto w-full max-w-[600px] px-5 pb-10">
      {/* 상단 — 시안 6f는 제목을 얹지 않고 돌아갈 곳만 적습니다(제목은 아래 h1이 맡습니다). */}
      <div className="pt-1 pb-1">
        <Link
          href="/train"
          className="-ml-[2px] inline-flex min-h-[48px] items-center gap-[10px] rounded-field pr-2 text-[0.8438rem] leading-none font-semibold text-ink-muted transition-colors duration-150 hover:text-ink active:bg-paper-2"
        >
          <span aria-hidden className="text-[1.375rem] leading-none text-ink-soft">
            ‹
          </span>
          훈련 목록
        </Link>
      </div>

      {/* 진행하던 훈련이 있으면 브리핑보다 먼저 보여 드립니다 — 「처음부터」는 새로 시작하는 것과 같습니다. */}
      {checkpoint && onResume && (
        <div className="mb-5">
          <ResumeBlock progress={checkpoint} onResume={onResume} />
        </div>
      )}

      <p className="text-[0.7813rem] leading-[1.45] font-bold tracking-[0.06em] text-ink-muted">
        {eyebrow}
      </p>
      <h1 className="mt-[6px] text-[1.375rem] leading-[1.3] font-extrabold tracking-[-0.02em] text-ink">
        {scenario.title}
      </h1>

      {/* 상황 지문 — 이 화면에서 면(paper-2)을 쓰는 곳은 여기 하나입니다. */}
      <div className="mt-[14px] rounded-[14px] bg-paper-2 px-4 py-[16px]">
        <p className="text-[0.9375rem] leading-[1.6] text-ink">{scenario.context}</p>
        {pressure && (
          <p className="mt-2 text-[0.9375rem] leading-[1.6] text-ink-soft">
            <b className="font-bold text-ink">지금 걸려 있는 것</b> · {pressure}
          </p>
        )}
        {cast && <p className="mt-2 text-[0.7813rem] leading-[1.6] text-ink-muted">{cast}</p>}
      </div>

      {/* 고정 문구 — 안전 규칙에 걸린 문장입니다. 한 글자도 바꾸지 마세요. */}
      <p className="mt-[10px] text-[0.8438rem] leading-[1.6] text-ink-soft">
        {splitOk ? (
          <>
            {lineHead}
            <b className="font-bold">{EMPHASIS}</b>
            {lineTail}
          </>
        ) : (
          PRACTICE_LINE
        )}{" "}
        틀려도 벌점은 없습니다.
      </p>

      {/* 누르기 전에 알아 두실 것 두 줄 — 한 덩어리로 묶어 둡니다.
          예전에는 두 줄이 서로 떨어진 문단이라, 아래 시작 버튼까지 네 덩어리가 같은 간격으로
          늘어서 있었습니다(어느 것이 「읽을 것」이고 어느 것이 「할 것」인지 형태가 말해 주지 않았습니다).
          지금은 읽을 것끼리 붙이고, 할 것 앞에만 한 단 넓은 여백을 둡니다.

          ① 겁을 없애는 문장은 **결정하는 자리 바로 위**에 둡니다 —
             화면 맨 아래 11.5px 각주로는 시작 버튼을 누르는 순간 눈에 들어오지 않았습니다.
          ② 소리 예고 — 시작 버튼을 누르는 순간 대사가 그대로 재생됩니다(TrainSession의 ttsOn 기본값).
             어르신 댁이나 대중교통에서 누르는 분께는 이 사실이 먼저 필요합니다(평가 초보 m4).
             끄는 자리(세션 헤더의 「소리 끄기」)까지 같은 줄에 알려 드립니다. */}
      <div className="mt-[14px] space-y-1.5">
        <p className="text-[1rem] leading-[1.6] font-semibold text-ink-soft">
          마이크가 없어도 버튼만으로 끝까지 할 수 있어요.
        </p>
        <p className="text-[0.9375rem] leading-[1.6] text-ink-soft">
          시작하면 어르신 목소리가 나옵니다 — 소리 끄기는 화면 위에 있어요.
        </p>
      </div>

      {/* 시작 버튼은 접힘보다 위, 첫 화면 안에 있습니다(시안 6f의 핵심).
          진행하던 훈련이 남아 있을 때는 이 버튼이 곧 「처음부터」입니다 —
          라벨을 그대로 두면 화면에서 가장 큰 버튼이 위의 이어하기를 조용히 지웁니다.
          위 문단들과의 간격(20px)이 이 화면에서 가장 넓습니다 — 버튼이 제 구역에 혼자 섭니다. */}
      <div className="mt-5">
        {/* 첫 탭의 제스처 콜스택 안에서 오디오 잠금을 풀어야 아이폰에서 이후 자동 낭독이 됩니다. */}
        <BigButton
          onClick={() => {
            unlockAudio();
            onStart();
          }}
          size="lg"
          block
          className="font-bold"
        >
          {resuming ? "처음부터 다시 시작" : "훈련 시작하기"}
        </BigButton>
        {resuming && (
          <p className="mt-2 text-[0.8438rem] leading-[1.6] text-ink-soft">
            누르시면 위에 남아 있는 진행은 지워집니다. 이어서 하시려면 위의 「이어서 하기」를 눌러
            주세요.
          </p>
        )}
      </div>

      <div className="mt-4 border-b border-line">
        <Fold title={`오늘 연습할 것 ${scenario.objectives.length}가지`}>
          <ul className="space-y-2">
            {scenario.objectives.map((objective) => (
              <li key={objective} className="flex gap-2 text-[0.8438rem] leading-[1.6] text-ink-soft">
                <span aria-hidden className="flex-none text-ink-ghost">
                  ·
                </span>
                <span>{objectiveText(objective)}</span>
              </li>
            ))}
          </ul>
        </Fold>

        <Fold title="등장인물 자세히">
          <p className="text-[0.7813rem] leading-[1.6] font-semibold text-ink-muted">{FICTION_NOTICE}</p>
          {/* 인물 카드 머리에 38px 아바타 원 — 세션 말풍선의 아바타와 **같은 함수·같은 값**입니다
              (`initialOf` · bg-paper-out · 13.5px w700 ink-soft). 브리핑에서 본 「박」이 몇 초 뒤
              대화 왼쪽에 그대로 서 있어야, 두 화면이 같은 사람을 말하고 있다는 것이 형태로 읽힙니다.
              사진도 아이콘도 없이 한 글자뿐인 것도 같은 이유입니다 — 얼굴을 지어내지 않습니다. */}
          <ul className="mt-3 space-y-3">
            {scenario.personas.map((persona) => (
              <li key={persona.name} className="flex gap-2.5">
                <span
                  aria-hidden
                  className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-paper-out text-[0.8438rem] font-bold text-ink-soft"
                >
                  {initialOf(persona.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.8438rem] leading-[1.45] font-bold text-ink">
                    {plainName(persona.name)}
                    <span className="ml-2 text-[0.7813rem] font-semibold text-ink-muted">
                      {ROLE_LABEL[persona.role]}
                    </span>
                  </span>
                  <span className="mt-1 block text-[0.8438rem] leading-[1.6] text-ink-soft">
                    {persona.profile}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Fold>

        <Fold title="응답 방법 · 마이크 권한 안내">
          <ul className="space-y-2.5 text-[0.8438rem] leading-[1.6] text-ink-soft">
            <li>
              <span className="font-bold text-ink">말하기 — </span>
              {micSupported
                ? "마이크 버튼을 처음 누르면 브라우저가 마이크 허용을 물어봅니다. ‘허용’을 누르신 뒤, 버튼을 꾹 누른 채로 말씀하시고 다 말씀하시면 손을 떼세요. 허용하지 않으셔도 버튼과 직접 입력으로 끝까지 하실 수 있습니다."
                : "이 기기에서는 음성 인식을 쓸 수 없습니다. 버튼과 직접 입력만으로 끝까지 진행하실 수 있습니다."}
            </li>
            <li>
              <span className="font-bold text-ink">고르기 — </span>
              말하기가 어려우시면 제안 버튼을 고르셔도 됩니다. 버튼은 항상 열려 있습니다.
            </li>
            <li>
              <span className="font-bold text-ink">직접 입력 — </span>
              입력창에 문장을 적어 보내셔도 됩니다.
            </li>
            <li>
              <span className="font-bold text-ink">여유 시간 — </span>
              여유 시간이 표시되지만, 시간이 지나도 자동으로 넘어가지 않습니다. 천천히 하셔도
              됩니다.
            </li>
          </ul>
        </Fold>

        {/* 루브릭 코드·근거 문서·제약 조건은 전부 이 안에 있습니다(가이드 v4 §4.10). */}
        <Fold title="이 훈련의 설계 보기">
          {/* 「루브릭」은 이 앱 어디에서도 사용자에게 설명한 적이 없는 낱말입니다.
              가리키는 것은 같습니다 — 이 훈련에서 사람이 확인하는 항목들. 그러면 그 말로 적습니다.
              (인라인 코칭의 접힘도 같은 낱말 「확인한 항목」을 씁니다.) */}
          <p className="text-[0.7813rem] leading-[1.6] font-bold tracking-[0.06em] text-ink-muted">
            학습목표와 확인 항목
          </p>
          <ul className="mt-2 space-y-1.5">
            {scenario.objectives.map((objective) => (
              <li key={objective} className="text-[0.8438rem] leading-[1.6] text-ink-soft">
                {objective}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[0.7813rem] leading-[1.6] text-ink-muted">
            이 상황에서 보는 항목은 {scenario.appliedRubric.length}개이며, 점수와 등급은 화면에
            내지 않습니다.
          </p>

          <p className="mt-4 text-[0.7813rem] leading-[1.6] font-bold tracking-[0.06em] text-ink-muted">
            이 상황의 제약 조건
          </p>
          <ul className="mt-2 space-y-1.5">
            {scenario.constraints.map((constraint) => (
              <li
                key={constraint}
                className="flex gap-2 text-[0.8438rem] leading-[1.6] text-ink-soft"
              >
                <span aria-hidden className="flex-none text-ink-ghost">
                  ·
                </span>
                <span>{constraintDetail(constraint)}</span>
              </li>
            ))}
          </ul>

          <p className="mt-4 text-[0.7813rem] leading-[1.6] font-bold tracking-[0.06em] text-ink-muted">
            판정 근거 문서
          </p>
          <p className="mt-2 text-[0.8438rem] leading-[1.6] text-ink-soft">
            피드백에는 아래 문서에서 확인한 내용만 붙습니다. 근거를 찾지 못하면 “공식 지침에서
            근거를 찾지 못했습니다. 담당 간호사 또는 기관에 확인해 주세요.”라고 그대로 말씀드립니다.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {scenario.sourceDocs.map((docId) => (
              <SourceChip key={docId} docId={docId} />
            ))}
          </div>
        </Fold>
      </div>

      <p className="mt-3 text-[0.6875rem] leading-[1.6] text-ink-faint">{FICTION_NOTICE}</p>

      <InlineDisclaimer size="md" tone="readable" className="mt-5" />
    </div>
  );
}

export default BriefingPanel;
