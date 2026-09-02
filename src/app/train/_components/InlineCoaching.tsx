"use client";

import { useEffect, useId, useState } from "react";
import { SourceChip, useSourceDoc } from "@/components";
import { ChevronGlyph, STATUS_MARK_LABEL, type StatusMarkKind } from "@/components/icons";
import { cx } from "@/components/utils";
import { getRubricItem } from "@/data/rubric";
import type { FeedbackTrace, TracedFeedback } from "@/engine";
import {
  getCoaching,
  subscribeCoaching,
  type OnlineCoachOutcome,
} from "@/lib/onlineCoach";
import {
  COACH_HEAD,
  gaugeDeltaChip,
} from "./constants";
import { splitCoachingMessage } from "./coachingCopy";

export interface InlineCoachingProps {
  feedback: TracedFeedback;
  /** 게이지 이름 — 델타 칩 문구에 씁니다 (초조도 / 긴장도) */
  gaugeLabel: string;
  className?: string;
}

/* ── 확인 항목을 학습자의 말로 ──────────────────────────────
   루브릭 항목의 행동지표는 채점자가 읽는 문장이라 전부 「…했는가」로 끝납니다. 그대로 접힘 안에
   두면, 「시험이 아닙니다」를 다섯 번 읽고 들어온 화면에서 코드가 붙은 평가표가 나옵니다
   (현직·교육생 검증 — 「RE-01이 뭔지 이 앱 어디에도 설명이 없어 채점표 냄새만 남는다」).
   데이터(src/data/rubric.ts)는 그대로 두고 **표시부에서만** 두 가지를 바꿉니다.
    ① 코드(RE-01)를 떼고 문장만 남깁니다 — 코드가 필요한 자리는 /check와 /for-orgs가 따로 있습니다.
    ② 「…했는가」를 할 일 서술로 바꿉니다("…인정했는가" → "…인정하기").
   꼬리에 붙은 괄호(예시·판정 방법)는 떼어 두었다가 그대로 다시 붙입니다. */

const INDICATOR_TAILS: readonly (readonly [RegExp, string])[] = [
  [/하지 않았는가$/, "하지 않기"],
  [/않았는가$/, "않기"],
  [/기재되었는가$/, "기재하기"],
  [/상태였는가$/, "상태로 두기"],
  [/지켰는가$/, "지키기"],
  [/했는가$/, "하기"],
];

/**
 * 행동지표 한 줄을 할 일 서술로 바꿉니다.
 *
 * @example
 * asTodo("사실을 정정하기 전에 대상자의 정서를 언어로 인정했는가"); // "…인정하기"
 * @example
 * asTodo("지시형 대신 2개 이하의 선택지를 제공했는가"); // "…제공하기"
 */
export function asTodo(indicator: string): string {
  const text = indicator.trim();
  const withTail = /^([\s\S]*?)(\s*\([^()]*\))$/.exec(text);
  const head = (withTail?.[1] ?? text).trim();
  const tail = withTail?.[2] ?? "";
  for (const [pattern, replacement] of INDICATOR_TAILS) {
    if (pattern.test(head)) return `${head.replace(pattern, replacement)}${tail}`;
  }
  return text;
}

/**
 * 이 판정을 실제로 실행한 판정기 이름 — 「시나리오 규칙표 / 규칙 사전 / 시간 규칙」 세 낱말만 씁니다.
 *
 * 이름은 `cfVerdictSourceLine`(constants.ts)과 같은 낱말을 쓰고, /safety 01의 「규칙 사전이
 * 문장으로, 119 지연은 경과 초로」와 같은 갈래입니다. 셋을 한 낱말로 뭉뚱그리지 않는 이유는,
 * 버튼만으로 시연하면 규칙 사전이 실행되지 않기 때문입니다(session.ts:282 — 자유 발화 조건).
 * 그 사실을 감추는 대신 어느 판정기가 돌았는지 매 턴 그대로 적습니다.
 */
function pathEngines(trace: FeedbackTrace): string[] {
  const engines = [trace.source === "rule" ? "규칙 사전" : "시나리오 규칙표"];
  // 자유 발화에서는 분기 판정 위에 규칙 사전 코칭이 함께 얹힙니다.
  if (trace.advisoryLabels && trace.advisoryLabels.length > 0 && !engines.includes("규칙 사전")) {
    engines.push("규칙 사전");
  }
  // CO-03은 문장이 아니라 경과 초로 잽니다(timing.ts). 버튼 경로에서도 실행됩니다.
  if (typeof trace.callDelaySec === "number") engines.push("시간 규칙");
  return engines;
}

/** 접힘 손잡이 줄에 상시 노출하는 판정 경로 — 「시나리오 규칙표 · 시간 규칙」. */
function pathBadge(trace: FeedbackTrace): string {
  return pathEngines(trace).join(" · ");
}

/**
 * 판정기 이름만으로는 모자란 사실 한 마디.
 * 버튼으로 고르신 턴은 규칙 사전이 아니라 시나리오 규칙표가 판정하므로 그대로 적습니다.
 */
function pathQualifier(trace: FeedbackTrace): string | null {
  if (trace.source === "button") return "고르신 보기 그대로";
  if (trace.source === "default") return "기본 안내";
  return null;
}

/**
 * 판정 경로 한 줄 — 무엇이 이 판정을 내렸는지 **사람이 읽는 말로** 밝힙니다.
 *
 * 예전에는 「규칙 사전 단독 판정 (결정론 · 생성 없음)」처럼 설계 문서의 낱말이 그대로 있었습니다.
 * 이 줄이 답하는 질문은 「왜 이 판정인가요?」이고, 그 질문을 누른 분이 알고 싶은 것은
 * 판정기의 계보가 아니라 **내 말의 어디가 걸렸는가**입니다.
 */
function pathLabel(trace: FeedbackTrace): string {
  // 보고 구간은 어떤 낱말이 걸렸는지가 아니라 **몇 가지가 담겼는지**로 갈립니다.
  // 그 판정에 「말씀 속 …가 맞았습니다」를 쓰면 사실과 다르게 읽힙니다.
  const elements = trace.matchedElements;
  if (elements && elements.length > 0) {
    return `말씀에 ${elements.join(", ")} ${elements.length}가지가 담겨 있어 그 개수로 갈렸습니다`;
  }
  switch (trace.source) {
    case "rule":
      return "말씀 속 표현이 규칙 사전에 그대로 있었습니다";
    case "criticalPattern":
    case "pattern":
      return trace.matchedPattern
        ? `말씀 속 「${trace.matchedPattern}」가 이 상황에 적어 둔 갈래와 맞았습니다`
        : "이 상황에 적어 둔 갈래와 맞았습니다";
    case "button":
      return "고르신 보기에 정해 둔 판정을 그대로 따랐습니다";
    case "default":
    default:
      return "적어 둔 갈래 어디에도 맞지 않아 기본 안내로 드렸습니다";
  }
}

/** 경로별 한 줄 보충 설명 */
function pathNote(trace: FeedbackTrace): string {
  switch (trace.source) {
    case "rule":
      return "규칙 사전은 미리 적어 둔 표입니다. 이 판정에는 AI가 쓰이지 않았습니다.";
    case "criticalPattern":
      return "안전에 곧바로 걸리는 갈래를 먼저 살펴 걸렀습니다.";
    case "pattern":
      return "이 상황에 미리 적어 둔 문장을 그대로 보여 드립니다.";
    case "button":
      return "보기로 고르신 턴은 이 상황의 표가 판정하고, 규칙 사전은 직접 말씀하신 문장만 봅니다. 둘 다 AI 없이 정해 둔 표를 따릅니다.";
    case "default":
    default:
      return "조금 더 구체적으로 말씀해 보시면 판정이 달라집니다.";
  }
}

/* ── 온라인 코칭 (설정에서 켠 경우에만) ────────────────────
   기본 빌드에서는 이 아래가 통째로 렌더되지 않습니다 — 붙을 코칭이 없기 때문입니다.
   켠 경우에도 **판정·게이지·기록은 이미 결정론 엔진이 내린 그대로**이고, 여기 붙는 것은
   문장 한 덩어리뿐입니다. 그 사실을 라벨에 그대로 적습니다. */

/**
 * 이 판정에 붙은 온라인 코칭을 구독합니다.
 *
 * 열쇠는 판정 결과 객체 자체입니다(`@/lib/onlineCoach`의 WeakMap). 대화 로그를 통과하는
 * prop 배선을 새로 뚫지 않으려는 선택이고, 화면을 벗어나면 코칭도 함께 사라집니다.
 * 응답이 늦어도 이 훅은 아무것도 막지 않습니다 — 도착하기 전까지는 그냥 없는 것입니다.
 */
function useOnlineCoaching(feedback: TracedFeedback): OnlineCoachOutcome | undefined {
  const [outcome, setOutcome] = useState<OnlineCoachOutcome | undefined>(undefined);
  useEffect(() => {
    setOutcome(getCoaching(feedback));
    return subscribeCoaching(() => setOutcome(getCoaching(feedback)));
  }, [feedback]);
  return outcome;
}

/**
 * 라벨 한 줄 — 무엇이 이 문장을 썼고, 가드를 지났는지 지지 못했는지 그대로 적습니다.
 *
 * 낱말은 말풍선의 표기와 하나로 맞춥니다(DialogueLog) — 실제로 생성이 붙은 자리에만 「AI 생성」이
 * 붙고, 그 낱말은 화면 어디서나 같은 뜻입니다. 모델 계층을 가리키던 예전 표기는 훈련하시는 분께
 * 아무것도 알려 주지 않는 개발 낱말이었습니다.
 */
const ONLINE_HEAD_PASSED = "AI 생성 코칭 · 근거 가드 통과";
const ONLINE_HEAD_BLOCKED = "AI 생성 코칭 · 근거 가드가 막았습니다";

function OnlineCoachingBlock({ outcome }: { outcome: OnlineCoachOutcome }) {
  const blocked = outcome.status === "blocked";
  /* 막힌 경우에만 어디까지 지났는지 함께 적습니다 — 사유를 이해하는 데 쓰이는 정보입니다.
     통과한 경우의 단 이름 나열은 훈련하시는 분의 다음 행동에 쓰이지 않아 적지 않습니다. */
  const passedSteps = outcome.steps.filter((step) => step.passed).map((step) => step.label);
  return (
    <div className="mt-2 rounded-card bg-paper-2 px-3.5 py-3">
      <p
        className={cx(
          "text-[0.6875rem] leading-[1.45] font-bold",
          blocked ? "text-warn-ink" : "text-ink-muted",
        )}
      >
        {blocked ? ONLINE_HEAD_BLOCKED : ONLINE_HEAD_PASSED}
      </p>
      <p className="mt-1 text-[0.9375rem] leading-[1.6] text-ink">{outcome.message}</p>
      {blocked ? (
        <p className="mt-1 text-[0.7813rem] leading-[1.45] text-ink-muted">
          차단 사유 · {outcome.blockedLabel}
          {passedSteps.length > 0 && ` (지난 단 — ${passedSteps.join(" · ")})`}
        </p>
      ) : (
        outcome.docId && <SourceChip docId={outcome.docId} className="mt-1.5" />
      )}
      <p className="mt-1.5 text-[0.6875rem] leading-[1.45] text-ink-muted">
        판정·어르신 상태·기록은 위 그대로입니다. 이 문장 하나만 더해졌습니다.
      </p>
    </div>
  );
}

/**
 * 턴 판정 — **카드가 아니라 대화 흐름에 붙는 인라인 한 덩어리**입니다 (시안 4a⑤).
 *
 * [✓ 마크] [충족 · 침착의 코칭] [초조도 한 칸 ↓]
 *          코칭 한 문장
 *          근거 문서 · 무엇을 보고 정했나요  ← 누르면 판정 근거가 펼쳐집니다
 *
 * 점수·등급·백분위는 어떤 형태로도 만들지 않습니다. 판정어는 「충족 / 코칭 / 즉시 중단」 세 낱말뿐입니다.
 */
export function InlineCoaching({ feedback, gaugeLabel, className }: InlineCoachingProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const kind: StatusMarkKind = feedback.criticalFail ? "stop" : feedback.ok ? "met" : "coach";
  const doc = useSourceDoc(feedback.docId);
  const chip = gaugeDeltaChip(gaugeLabel, feedback.gaugeDelta);
  const trace = feedback.trace;
  const online = useOnlineCoaching(feedback);
  const coaching = splitCoachingMessage(feedback.message);

  /* 걸린 루브릭 항목 — 행동지표 문장만 가져옵니다. 점수·앵커는 내부 전용이라 읽지 않습니다. */
  const basis = (trace?.itemIds ?? []).flatMap((itemId) => {
    const item = getRubricItem(itemId);
    return item ? [{ itemId, indicator: item.indicator, docId: item.docId }] : [];
  });

  const extraDocs = basis
    .map((entry) => entry.docId)
    .filter((id): id is string => typeof id === "string" && id !== feedback.docId)
    .filter((id, index, all) => all.indexOf(id) === index);

  const heading = feedback.criticalFail
    ? "잠깐 멈춰 주세요"
    : feedback.ok
      ? "좋았어요"
      : "이렇게 바꿔 보세요";

  return (
    <section
      className={cx(
        "rounded-panel px-5 py-4",
        feedback.ok ? "bg-brand-tint" : "bg-warn-soft",
        className,
      )}
      aria-label="방금 답변 코칭"
    >
      <h2 className={cx("text-[1.1875rem] leading-[1.3] font-bold", feedback.ok ? "text-brand-800" : "text-warn-ink")}>
        {heading}
      </h2>
      <p className="mt-2 text-[1.0625rem] leading-[1.6] text-ink">{coaching.lead}</p>

      {(coaching.detail || trace || doc || feedback.branchLabel.length > 0 || chip || online) && (
        <>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls={panelId}
            className="mt-2 flex min-h-[48px] w-full items-center rounded-field text-left text-[0.9375rem] font-bold text-ink-soft underline decoration-1 underline-offset-[4px]"
          >
            왜 그런가요?
            <ChevronGlyph
              size="sm"
              className={cx("ml-auto flex-none text-ink-muted", open && "rotate-180")}
            />
          </button>

          {open && (
            <div
              id={panelId}
              className="mt-2 space-y-3 border-t border-line pt-3 text-[0.9375rem] leading-[1.6] text-ink-soft"
            >
              {coaching.detail && <p className="font-semibold text-ink">{coaching.detail}</p>}
              <p className="font-semibold text-ink">
                {STATUS_MARK_LABEL[kind]} · {COACH_HEAD[kind]}
                {chip ? ` · ${chip}` : ""}
              </p>
              {online && <OnlineCoachingBlock outcome={online} />}
              {trace && (
                <>
            {/* 첫 줄은 **돌봄 근거**입니다 — 판정기의 계보가 아니라 「현장에서 무엇이 옳은가」를
                먼저 세웁니다. 걸린 항목이 있으면 그 항목의 할 일 한 문장, 없으면 근거 문서의
                해당 대목입니다. 판정 경위는 그 아래로 내려갑니다(교육생 검증). */}
            {basis[0] && (
              <div>
                <p className="text-[0.6875rem] font-bold text-ink-muted">이 자리의 돌봄 기준</p>
                <p className="mt-0.5 font-bold text-ink">{asTodo(basis[0].indicator)}</p>
              </div>
            )}

            <div>
              <p className="text-[0.6875rem] font-bold text-ink-muted">어떻게 정해졌나요</p>
              <p className="mt-0.5 font-bold text-ink">{pathLabel(trace)}</p>
              {trace.ruleLabel && (
                <p className="mt-0.5">
                  규칙 사전에 적힌 이름 — {trace.ruleLabel}
                  {trace.matchedPattern ? ` · 걸린 말 「${trace.matchedPattern}」` : ""}
                </p>
              )}
              <p className="mt-0.5">{pathNote(trace)}</p>
              {/* 시간 규칙은 문장이 아니라 경과 초로 잽니다(timing.ts) — 잰 값을 그대로 적습니다. */}
              {typeof trace.callDelaySec === "number" && (
                <p className="mt-0.5">
                  응급 신호가 보인 순간부터 119에 연결하기까지 {trace.callDelaySec}초가 걸렸고, 그
                  시간으로 판정했습니다.
                </p>
              )}
              {trace.advisoryLabels && trace.advisoryLabels.length > 0 && (
                <p className="mt-0.5">함께 짚어 드린 것 — {trace.advisoryLabels.join(" · ")}</p>
              )}
              {/* 겉줄에서 내려온 판정 경로 — 「무엇이 판정했는가」는 매 턴 그대로 남습니다.
                  자리만 한 겹 뒤로 옮겼고, 셈법과 낱말은 /safety 01과 같습니다. */}
              <p className="mt-0.5">
                판정한 것 — <span className="font-bold text-ink-soft">{pathBadge(trace)}</span>
                {pathQualifier(trace) ? ` · ${pathQualifier(trace)}` : ""}
              </p>
            </div>

            {basis.length > 0 && (
              <div>
                <p className="text-[0.6875rem] font-bold text-ink-muted">확인한 항목</p>
                {/* 코드(RE-01)는 떼고 문장만 둡니다 — 학습자 화면에서 그 기호는 아무 뜻도
                    없고, 붙어 있으면 그 자리가 채점표로 읽힙니다(현직·교육생 검증). */}
                <ul className="chim-hairline mt-0.5">
                  {basis.map((entry) => (
                    <li key={entry.itemId} className="flex gap-2 py-1.5 first:pt-0 last:pb-0">
                      <span aria-hidden className="shrink-0 text-ink-ghost">
                        ·
                      </span>
                      <span className="min-w-0 flex-1 text-ink">{asTodo(entry.indicator)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(feedback.docId || extraDocs.length > 0) && (
              <div>
                <p className="text-[0.6875rem] font-bold text-ink-muted">근거 문서</p>
                <p className="mt-0.5">
                  {[doc?.title ?? feedback.docId, ...extraDocs].filter(Boolean).join(" · ")}
                </p>
              </div>
            )}

            {/* 「외부로 나간 요청 0건」은 계측 문장이라 /safety가 실측과 함께 들고 있습니다.
                여기 남는 것은 같은 사실을 사람 말로 한 줄로 줄인 것뿐입니다. */}
            <p className="border-t border-line pt-2 font-semibold text-ink-muted">
              이 확인은 기기 안에서 했습니다
            </p>
                </>
              )}
              {!trace && (
                <p>{doc?.title ?? feedback.branchLabel}</p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default InlineCoaching;
