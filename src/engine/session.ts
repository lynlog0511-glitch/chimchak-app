/**
 * 침착(ChimChak) 세션 엔진.
 *
 * 시나리오 그래프를 걷는 범용 상태 머신이다. React 의존 없음·UI 없음·순수 함수 지향이며,
 * SessionState는 항상 새 객체로 돌려준다(불변 업데이트).
 * 시나리오는 코드가 아니라 데이터(src/data)이므로 이 파일은 데이터를 import하지 않는다.
 *
 * 한 턴의 처리 순서
 * 1) rules.checkCritical(발화) — ⚑CF면 즉시 인터럽트 (같은 CUE 재시도 가능)
 * 2) classify로 분기 결정 (버튼 선택은 그 분기를 그대로 사용)
 * 3) 분기가 ⚑CF면 인터럽트
 * 4) 게이지 반영 (0~max 클램프) → 위기치 도달 시 위기 엔딩
 * 5) 루브릭 누적 (항목별 낮은 점수 우선). 여기서 CO-03(119 지연)만은 문장이 아니라
 *    **경과 시간**으로 판정한다(timing.ts) — 시계는 이 턴에 들어온 시각부터 흐른다.
 *    누적 직전에 근거 가드(evidence.ts)를 지난다: 근거 문서가 화이트리스트 밖이면
 *    점수를 매기지 않고 「공식 지침에서 근거를 찾지 못했습니다…」만 내보낸다.
 * 6) next 처리 — "end:"면 엔딩, "protocol:"이면 status='protocol'
 *
 * 판정 우선순위는 이 파일에서 바뀌지 않는다: ⚑CF → 재훈련 고정 → 재훈련 권고 → 턴 그래프
 * 엔딩 → 내부 산식(§4.6). 위 두 장치는 5)의 점수 누적에만 관여한다.
 */

import type {
  BranchDef,
  CueDef,
  EndingDef,
  RubricHit,
  Scenario,
  SessionEvent,
  SessionRecord,
  SessionState,
  TurnDef,
  TurnFeedback,
} from "@/types";
import { classifyInput, defaultBranch, findBranch, type ClassifySource } from "./classify";
import { checkEvidence, type EvidenceGuard } from "./evidence";
import { advisoryHits, checkAdvisory, checkCritical, getRule } from "./rules";
import { collectCoaching, collectGreenChecks, judgeInternal, lowestScore, mergeHits, isMet } from "./scoring";
import { activeSeconds, currentTurnEnteredAt, isCallHandoff, judgeCallDelay } from "./timing";

const END_PREFIX = "end:";
const PROTOCOL_PREFIX = "protocol:";

/** 분기 데이터에 문구가 없을 때 쓰는 기본 문구 (점수·등급 표현 없음) */
const DEFAULT_PRAISE = "지금처럼 이어가 주세요.";
const DEFAULT_COACHING = "다음에는 조금 다른 방식으로 시도해 보시면 좋겠습니다.";

export interface SubmitInput {
  /** 자유 발화(음성 인식 결과 또는 타이핑) */
  utterance?: string;
  /** 버튼 폴백으로 고른 분기 id */
  branchId?: string;
  /** 버튼으로 입력했는지 */
  viaButton: boolean;
}

export interface SubmitOptions {
  /**
   * 근거 문서 화이트리스트 가드. 넘기지 않으면 아무것도 막지 않는다(기존 동작 그대로).
   * 넘기면 목록 밖 문서를 근거로 든 판정은 **중단**되고 고정 문구만 나간다(evidence.ts).
   */
  evidence?: EvidenceGuard;
}

/* ── 판정 경로 흔적 (「이 판정이 나온 이유」 화면용) ───────── */

/**
 * 판정이 어느 경로로 나왔는지.
 * - `rule`            : 규칙 사전(rules.ts)이 단독으로 잡았다 (결정론 · 생성 없음)
 * - `criticalPattern` : ⚑CF 분기의 판정 신호에 걸렸다
 * - `pattern`         : 시나리오 분기의 판정 신호에 걸렸다
 * - `button`          : 학습자가 보기 버튼으로 분기를 직접 골랐다
 * - `default`         : 어느 신호에도 걸리지 않아 기본 분기로 처리했다
 */
export type TraceSource = ClassifySource | "rule";

/**
 * 턴 피드백에 붙는 판정 근거.
 *
 * `src/types/index.ts`(리드 소유)는 수정하지 않으므로 엔진 안에 두는 지역 확장 타입이다.
 * 점수·등급·앵커는 **담지 않는다** — 화면 표기 금지 규칙(브리프 §3-1) 때문이며,
 * 화면은 여기 담긴 경로 라벨과 루브릭 항목 id·행동지표 문장까지만 보여 준다.
 */
export interface FeedbackTrace {
  source: TraceSource;
  /** 분기 판정 신호 중 실제로 걸린 문자열 (예: "집에 가야") */
  matchedPattern?: string;
  /**
   * 요소 개수 판정(보고 CUE)에서 실제로 걸린 요소 이름 — 예: ["시각", "행위·조치", "현재 상태"].
   * 이 값이 있으면 「무엇이 들어 있어서 이 판정이 나왔는가」를 화면이 그대로 말할 수 있다.
   */
  matchedElements?: string[];
  /** 규칙 사전에서 발동한 규칙 id (예: "CF-RESTRAINT") */
  ruleId?: string;
  /** 규칙 이름 (예: "신체 자유 제한") */
  ruleLabel?: string;
  /** 이 턴에서 걸린 루브릭 항목 id 목록 (점수는 담지 않는다) */
  itemIds?: string[];
  /** 함께 적용된 코칭 규칙 이름 목록 (⚑CF 아님) */
  advisoryLabels?: string[];
  /**
   * CO-03 시간 규칙이 실제로 잰 초 — 응급 신호가 뜬 순간부터 119 연결까지(timing.ts).
   * 이 값이 있으면 「119 지연은 규칙 엔진이 시간으로 판정했다」는 뜻이다.
   */
  callDelaySec?: number;
  /** 근거 문서가 화이트리스트 밖이라 판정을 멈췄다 (evidence.ts) */
  evidenceBlocked?: boolean;
  /**
   * 선행 조건 게이트가 다른 분기로 옮겼을 때, **원래 걸렸던** 분기 id.
   * 맞는 말이지만 순서가 일렀다는 뜻이다(BranchDef.requiresPriorBranchIds).
   */
  gatedFrom?: string;
}

/** 판정 근거를 함께 실어 나르는 TurnFeedback (계약은 그대로, 필드만 옵셔널로 확장) */
export type TracedFeedback = TurnFeedback & { trace?: FeedbackTrace };

export interface SubmitResult {
  state: SessionState;
  feedback: TracedFeedback;
  /** true면 ⚑CF 인터럽트 — 화면은 전면 모달을 띄우고 advanceAfterCF()로 재시도시킨다 */
  interrupted: boolean;
}

/** 같은 항목이 여러 번 걸려도 한 번만 남긴다 (표시용) */
function uniqueItemIds(hits: RubricHit[]): string[] {
  const out: string[] = [];
  for (const hit of hits) {
    if (!out.includes(hit.itemId)) out.push(hit.itemId);
  }
  return out;
}

/* ── 조회 ──────────────────────────────────────────────── */

/**
 * 세션을 시작한다.
 *
 * @example
 * const state = startSession(scenario);
 * state.status; // "running"
 */
export function startSession(s: Scenario): SessionState {
  return {
    scenarioId: s.id,
    currentTurnId: s.entryTurnId,
    gauge: s.gauge.start,
    status: "running",
    events: [],
    scores: {},
    cfCount: 0,
    retrainAdvice: false,
    retriesUsed: 0,
    startedAt: Date.now(),
  };
}

/**
 * 현재 턴. 프로토콜 구간이거나 종료 상태면 undefined일 수 있다.
 *
 * @example
 * currentTurn(scenario, state)?.text;
 */
export function currentTurn(s: Scenario, state: SessionState): TurnDef | undefined {
  return s.turns.find((t) => t.id === state.currentTurnId);
}

/**
 * 현재 턴의 CUE (없으면 자동 진행 턴).
 *
 * @example
 * currentCue(scenario, state)?.prompt;
 */
export function currentCue(s: Scenario, state: SessionState): CueDef | undefined {
  return currentTurn(s, state)?.cue;
}

/**
 * status가 'protocol'일 때 재생할 프로토콜 id.
 *
 * @example
 * protocolIdOf({ ...state, currentTurnId: "protocol:P-02" }); // "P-02"
 */
export function protocolIdOf(state: SessionState): string | undefined {
  if (!state.currentTurnId.startsWith(PROTOCOL_PREFIX)) return undefined;
  return state.currentTurnId.slice(PROTOCOL_PREFIX.length);
}

/**
 * 확정된 엔딩 정의.
 *
 * @example
 * endingOf(scenario, state)?.verdict; // "충족"
 */
export function endingOf(s: Scenario, state: SessionState): EndingDef | undefined {
  if (!state.endingId) return undefined;
  return s.endings.find((e) => e.id === state.endingId);
}

/** 세션이 끝났는지 */
export function isFinished(state: SessionState): boolean {
  return state.status === "ended";
}

/* ── 내부 헬퍼 ─────────────────────────────────────────── */

function clampGauge(s: Scenario, value: number): number {
  return Math.max(0, Math.min(s.gauge.max, value));
}

function neutralFeedback(): TurnFeedback {
  return {
    branchId: "__none",
    branchLabel: "진행 없음",
    ok: true,
    criticalFail: false,
    message: "",
    gaugeDelta: 0,
    rubricHits: [],
  };
}

function pushEvent(state: SessionState, event: SessionEvent): SessionEvent[] {
  return [...state.events, event];
}

/** next 문자열을 상태 변화로 옮긴다 */
function applyNext(state: SessionState, next: string): SessionState {
  if (!next || next.length === 0) return state;
  if (next.startsWith(END_PREFIX)) {
    return { ...state, status: "ended", endingId: next.slice(END_PREFIX.length) };
  }
  if (next.startsWith(PROTOCOL_PREFIX)) {
    return { ...state, status: "protocol", currentTurnId: next };
  }
  return { ...state, currentTurnId: next };
}

/** 게이지가 위기치에 닿았는지 */
function reachedCrisis(s: Scenario, gauge: number): boolean {
  return gauge >= s.gauge.crisisAt;
}

/* ── 진행 ──────────────────────────────────────────────── */

/**
 * CUE가 없는 턴(자동 진행 턴)을 다음으로 넘긴다.
 * autoNext가 "end:"·"protocol:"이면 그대로 처리한다.
 *
 * @example
 * const next = advanceAuto(scenario, state);
 */
export function advanceAuto(s: Scenario, state: SessionState): SessionState {
  if (state.status !== "running") return state;
  const turn = currentTurn(s, state);
  if (!turn || turn.cue) return state;
  if (!turn.autoNext) return { ...state, status: "ended" };
  return applyNext(state, turn.autoNext);
}

/**
 * 학습자 응답을 처리한다.
 *
 * @example
 * const r = submitResponse(scenario, state, { utterance: "마음이 급하시겠어요", viaButton: false });
 * r.feedback.ok;      // true → 🟢
 * r.interrupted;      // false
 *
 * @example
 * const cf = submitResponse(scenario, state, { utterance: "문을 잠그겠습니다", viaButton: false });
 * cf.interrupted;             // true (⚑CF 인터럽트)
 * cf.state.status;            // "interrupted"
 * cf.state.currentTurnId;     // 그대로 — 같은 CUE를 다시 시도할 수 있다
 */
export function submitResponse(
  s: Scenario,
  state: SessionState,
  input: SubmitInput,
  options: SubmitOptions = {},
): SubmitResult {
  const turn = currentTurn(s, state);
  const cue = turn?.cue;
  if (!turn || !cue || state.status !== "running") {
    return { state, feedback: neutralFeedback(), interrupted: false };
  }

  const utterance = (input.utterance ?? "").trim();
  const at = Date.now();

  // 1) 규칙 판정 우선 — 자유 발화에만 적용한다.
  //    버튼으로 분기를 직접 고른 경우에는 시나리오 데이터의 판정을 그대로 따른다.
  if (utterance.length > 0 && !input.branchId) {
    const critical = checkCritical(utterance, {
      scenarioType: s.type,
      cueId: cue.id,
      appliedRubric: s.appliedRubric,
    });
    if (critical.cf) {
      // 규칙은 '탐지', 문구는 '데이터'가 맡는다.
      // 같은 CUE에 같은 루브릭 항목의 ⚑CF 분기가 있으면 설계서가 고정으로 지정한
      // 그 분기의 문구·대안·근거를 쓴다(§3.1 G의 조문 고지, §3.2 "다시 해보시겠어요?").
      const dataBranch = critical.itemId
        ? cue.branches.find(
            (b) => b.criticalFail === true && b.rubricHits.some((h) => h.itemId === critical.itemId),
          )
        : undefined;
      const hits: RubricHit[] = critical.itemId ? [{ itemId: critical.itemId, score: 1 }] : [];
      // ⚑CF 문구는 검수된 고정 문구라 근거 검색과 무관하다. 다만 **인용**은 가드를 지나야
      // 하므로, 화이트리스트 밖 문서 id는 칩으로 내보내지 않는다(문구는 그대로 남긴다).
      const cfEvidence = checkEvidence(dataBranch?.docId ?? critical.docId, options.evidence);
      const feedback: TracedFeedback = {
        branchId: dataBranch?.id ?? `rule:${critical.ruleId ?? "CF"}`,
        branchLabel: dataBranch?.label ?? critical.label ?? "치명적 실패",
        ok: false,
        criticalFail: true,
        message: dataBranch?.cfMessage ?? critical.reason ?? "",
        docId: cfEvidence.docId,
        gaugeDelta: 0,
        rubricHits: hits,
        // 규칙 사전이 단독으로 잡은 판정 — 분기 데이터를 거치지 않았음을 화면이 그대로 밝힌다.
        trace: {
          source: "rule",
          ruleId: critical.ruleId,
          ruleLabel: critical.label,
          matchedPattern: critical.matched,
          itemIds: uniqueItemIds(hits),
          evidenceBlocked: cfEvidence.allowed ? undefined : true,
        },
      };
      const event: SessionEvent = {
        turnId: turn.id,
        cueId: cue.id,
        utterance,
        viaButton: input.viaButton,
        feedback,
        at,
      };
      // ⚑CF 점수는 scores에 병합하지 않는다. cfCount가 §4.6 규칙 1)로 이미 종합 판정을
      // '재훈련'으로 고정하므로, 여기서 항목 점수까지 1점으로 굳히면 인터럽트 화면의
      // "같은 장면에서 다시 해 보기 / 점수는 매기지 않습니다"와 어긋난다.
      const nextState: SessionState = {
        ...state,
        status: "interrupted",
        cfCount: state.cfCount + 1,
        events: pushEvent(state, event),
      };
      return { state: nextState, feedback, interrupted: true };
    }
  }

  // 2) 분기 결정
  const classified = classifyInput(cue, { utterance, branchId: input.branchId });
  let branch = classified.branch;

  /* 2.5) 선행 조건 게이트 — 「맞는 말인데 순서가 일렀다」를 가른다.
     같은 말도 앞에 무엇이 있었느냐로 어르신의 반응이 달라진다. 감정을 먼저 알아드리지 않고
     곧바로 배뇨를 확인하면 현장에서는 반발이 돌아온다(현직 검증).
     조건은 데이터가 적고(requiresPriorBranchIds·unmetBranchId) 여기서는 세션 기록만 본다 —
     SessionState에 새 필드를 두지 않는다.
     버튼으로 고른 경우에도 똑같이 적용한다. 이것은 「버튼보다 앞서는 판정」이 아니라
     그 분기 데이터 자신이 적어 둔 조건이다. */
  const gate = branch.requiresPriorBranchIds;
  let gatedFrom: string | undefined;
  if (gate && gate.length > 0 && branch.unmetBranchId) {
    const passed = new Set<string>();
    for (const event of state.events) {
      if (event.feedback && !event.feedback.criticalFail) passed.add(event.feedback.branchId);
    }
    if (!gate.some((id) => passed.has(id))) {
      const unmet = findBranch(cue, branch.unmetBranchId);
      if (unmet) {
        gatedFrom = branch.id;
        branch = unmet;
      }
    }
  }

  // 3) 분기 자체가 ⚑CF
  if (branch.criticalFail) {
    const hits = branch.rubricHits.length > 0 ? branch.rubricHits : [];
    const branchEvidence = checkEvidence(branch.docId, options.evidence);
    const feedback: TracedFeedback = {
      branchId: branch.id,
      branchLabel: branch.label,
      ok: false,
      criticalFail: true,
      message: branch.cfMessage ?? branch.coaching ?? "잠시 멈추겠습니다. 지금 선택은 허용되지 않는 행동입니다.",
      docId: branchEvidence.docId,
      gaugeDelta: 0,
      rubricHits: hits,
      trace: {
        source: classified.source,
        matchedPattern: classified.matchedPattern,
        matchedElements: classified.matchedElements,
        itemIds: uniqueItemIds(hits),
        evidenceBlocked: branchEvidence.allowed ? undefined : true,
        gatedFrom,
      },
    };
    const event: SessionEvent = {
      turnId: turn.id,
      cueId: cue.id,
      utterance: utterance.length > 0 ? utterance : branch.fallbackOption,
      viaButton: input.viaButton,
      feedback,
      at,
    };
    // (위와 같은 이유로 ⚑CF 점수는 scores에 병합하지 않는다 — 재시도 시 되돌아온다.)
    const nextState: SessionState = {
      ...state,
      status: "interrupted",
      cfCount: state.cfCount + 1,
      events: pushEvent(state, event),
    };
    return { state: nextState, feedback, interrupted: true };
  }

  // 4) 게이지 반영 (0~max 클램프)
  const gauge = clampGauge(s, state.gauge + branch.gaugeDelta);

  // 5) 루브릭 누적 — 분기 판정 + 규칙 코칭(자유 발화에만) + 119 지연(시간 규칙)
  const advisories =
    utterance.length > 0 && !input.branchId
      ? checkAdvisory(utterance, {
          scenarioType: s.type,
          cueId: cue.id,
          appliedRubric: s.appliedRubric,
        })
      : [];
  // CO-03은 문장이 아니라 **시간**으로 판정한다(timing.ts). 이 분기를 고른 순간이
  // 「119 연결」이고, 시계는 응급 신호가 뜬 순간 — 이 턴에 들어온 시각 — 부터 흐른다.
  const callDelay = isCallHandoff(branch.rubricHits)
    ? judgeCallDelay(at - currentTurnEnteredAt(state.events, turn.id, state.startedAt))
    : undefined;

  const judged: RubricHit[] = [
    ...branch.rubricHits,
    ...advisoryHits(advisories),
    ...(callDelay ? [{ itemId: callDelay.itemId, score: callDelay.score }] : []),
  ];

  const low = lowestScore(judged);
  const judgedOk = low === undefined ? branch.gaugeDelta <= 0 && !branch.coaching : isMet(low);
  const advisoryMessage = advisories[0]?.message;
  const judgedMessage = judgedOk
    ? branch.praise ?? DEFAULT_PRAISE
    : branch.coaching ?? callDelay?.message ?? advisoryMessage ?? DEFAULT_COACHING;

  // 근거 가드 — 목록 밖 문서를 근거로 든 판정은 **여기서 멈춘다**. 점수는 누적하지 않고
  // (판정 자체가 없었던 것으로 둔다) 고정 문구만 내보낸다.
  const evidence = checkEvidence(
    branch.docId ?? (judgedOk ? undefined : advisories[0]?.docId),
    options.evidence,
  );
  const hits: RubricHit[] = evidence.allowed ? judged : [];
  const ok = evidence.allowed ? judgedOk : false;
  const message = evidence.allowed ? judgedMessage : (evidence.notice ?? judgedMessage);
  const scores = mergeHits(state.scores, hits);

  const advisoryLabels = advisories
    .map((finding) => finding.label)
    .filter((label, index, all) => all.indexOf(label) === index);
  const feedback: TracedFeedback = {
    branchId: branch.id,
    branchLabel: branch.label,
    ok,
    criticalFail: false,
    message,
    docId: evidence.docId,
    gaugeDelta: branch.gaugeDelta,
    rubricHits: hits,
    trace: {
      source: classified.source,
      matchedPattern: classified.matchedPattern,
      matchedElements: classified.matchedElements,
      itemIds: uniqueItemIds(hits),
      advisoryLabels: advisoryLabels.length > 0 ? advisoryLabels : undefined,
      callDelaySec: callDelay?.elapsedSec,
      evidenceBlocked: evidence.allowed ? undefined : true,
      gatedFrom,
    },
  };

  const event: SessionEvent = {
    turnId: turn.id,
    cueId: cue.id,
    utterance: utterance.length > 0 ? utterance : branch.fallbackOption,
    viaButton: input.viaButton,
    feedback,
    at,
  };

  let nextState: SessionState = {
    ...state,
    gauge,
    scores,
    events: pushEvent(state, event),
    retrainAdvice: state.retrainAdvice || branch.retrainAdvice === true,
  };

  // 6) 위기 엔딩 → next 처리
  if (reachedCrisis(s, gauge)) {
    nextState = { ...nextState, status: "ended", endingId: s.gauge.crisisEndingId };
    return { state: nextState, feedback, interrupted: false };
  }

  nextState = applyNext(nextState, branch.next);
  return { state: nextState, feedback, interrupted: false };
}

/**
 * ⚑CF 인터럽트에서 대안을 확인한 뒤, 같은 CUE를 다시 시도한다.
 * (재시도 횟수는 내부적으로만 센다 — 화면에 벌점처럼 표시하지 않는다.)
 *
 * @example
 * const retried = advanceAfterCF(scenario, cfState);
 * retried.status;        // "running"
 * retried.currentTurnId; // 같은 CUE
 */
export function advanceAfterCF(s: Scenario, state: SessionState): SessionState {
  if (state.status !== "interrupted") return state;
  const turn = currentTurn(s, state);
  return {
    ...state,
    status: "running",
    currentTurnId: turn ? turn.id : state.currentTurnId,
    retriesUsed: state.retriesUsed + 1,
  };
}

/**
 * ⚑CF 인터럽트 화면에 띄울 대안 행동 3개.
 * 규칙에서 발동했으면 규칙 사전에서, 분기에서 발동했으면 시나리오 데이터에서 가져온다.
 *
 * @example
 * criticalAlternatives(scenario, state, feedback); // ["동의를 구한 뒤 손을 잡아 드리고 …", …]
 */
export function criticalAlternatives(s: Scenario, state: SessionState, feedback: TurnFeedback): string[] {
  if (feedback.branchId.startsWith("rule:")) {
    const rule = getRule(feedback.branchId.slice("rule:".length));
    return rule?.alternatives ?? [];
  }
  const cue = currentCue(s, state);
  if (!cue) return [];
  const branch = findBranch(cue, feedback.branchId);
  return branch?.cfAlternatives ?? [];
}

/**
 * 프로토콜(L3) 재생을 마치고 시나리오로 돌아온다.
 *
 * @example
 * const back = resumeFromProtocol(scenario, state, "T4");
 * back.status; // "running"
 */
export function resumeFromProtocol(s: Scenario, state: SessionState, resumeTurnId: string): SessionState {
  if (state.status !== "protocol") return state;
  if (resumeTurnId.startsWith(END_PREFIX)) {
    return { ...state, status: "ended", endingId: resumeTurnId.slice(END_PREFIX.length) };
  }
  const exists = s.turns.some((t) => t.id === resumeTurnId);
  if (!exists) return { ...state, status: "ended" };
  return { ...state, status: "running", currentTurnId: resumeTurnId };
}

/**
 * 무응답으로 대기 시간이 지났을 때 기본 분기로 진행시킨다.
 * (데모 배려: 훈련 화면은 자동 호출하지 말고 버튼 폴백을 강조하는 쪽을 권장한다.)
 *
 * @example
 * const r = applyTimeout(scenario, state);
 */
export function applyTimeout(s: Scenario, state: SessionState): SubmitResult {
  const cue = currentCue(s, state);
  if (!cue) return { state, feedback: neutralFeedback(), interrupted: false };
  return submitResponse(s, state, { branchId: defaultBranch(cue).id, viaButton: true });
}

/**
 * 재시도 1회(무벌점) — 같은 시나리오를 처음부터 다시 시작한다.
 *
 * @example
 * const fresh = retrySession(scenario, endedState);
 * fresh.retriesUsed; // 이전 + 1
 */
export function retrySession(s: Scenario, state: SessionState): SessionState {
  return { ...startSession(s), retriesUsed: state.retriesUsed + 1 };
}

/* ── 기록 ──────────────────────────────────────────────── */

/**
 * 설계서 §4.6 판정 규칙 1)·2)로 **강제되는** 판정.
 * ⚑CF 1건 이상이면 총점·엔딩과 무관하게 '재훈련', 재훈련 권고 조건이면 '재훈련 권고'.
 *
 * @example
 * forcedVerdict({ ...state, cfCount: 1 }); // "재훈련"
 */
function forcedVerdict(state: SessionState): EndingDef["verdict"] | undefined {
  if (state.cfCount > 0) return "재훈련";
  if (state.retrainAdvice) return "재훈련 권고";
  return undefined;
}

/**
 * 종료 화면·기록에 쓸 엔딩. §4.6 우선순위를 지킨다.
 *
 * ⚑CF·재훈련 권고가 있으면 시나리오의 해당 판정 엔딩(A01 E-CF / B02 E-재훈련 /
 * C01 E-재훈련권고)을 채택한다. 그렇지 않으면 턴 그래프가 확정한 엔딩을 그대로 쓴다.
 *
 * @example
 * resolveEnding(scenario, state)?.id; // "E-CF"
 */
export function resolveEnding(s: Scenario, state: SessionState): EndingDef | undefined {
  const graphEnding = endingOf(s, state);
  const forced = forcedVerdict(state);
  if (!forced) return graphEnding;
  return s.endings.find((e) => e.verdict === forced) ?? graphEnding;
}

/**
 * 세션을 성장 기록용 SessionRecord로 만든다. 발화 원문은 담지 않는다.
 *
 * 판정 우선순위는 설계서 §4.6 그대로다.
 * 1) ⚑CF 1건 이상 → 재훈련 2) 재훈련 권고 조건 → 재훈련 권고
 * 3) 턴 그래프가 확정한 엔딩 4) 없으면 내부 산식(judgeInternal)
 *
 * @example
 * const record = buildRecord(scenario, endedState);
 * record.verdict; // "충족"
 */
export function buildRecord(s: Scenario, state: SessionState): SessionRecord {
  const graphEnding = endingOf(s, state);
  const internal = judgeInternal({
    scores: state.scores,
    type: s.type,
    cfCount: state.cfCount,
    retrainAdvice: state.retrainAdvice,
  });
  const forced = forcedVerdict(state);
  const ending = resolveEnding(s, state);
  const verdict = forced ?? graphEnding?.verdict ?? internal.verdict;
  const endedAt = new Date();
  // ⚑CF 인터럽트는 대화 턴이 아니다(횟수는 cfCount로 따로 표시한다).
  const cueEvents = state.events.filter((e) => Boolean(e.cueId) && e.feedback?.criticalFail !== true);

  return {
    id: `${s.id}-${state.startedAt}-${state.retriesUsed}`,
    scenarioId: s.id,
    scenarioTitle: s.title,
    typeLabel: s.typeLabel,
    startedAt: new Date(state.startedAt).toISOString(),
    endedAt: endedAt.toISOString(),
    // 이수 시수로 세는 값은 벽시계가 아니라 **진행 시간**이다 — 사유 전문은 timing.ts.
    // 버튼으로만 완주한 회차도 턴마다 이벤트를 남기므로 같은 방식으로 세어진다.
    activeSec: activeSeconds(state.events, state.startedAt, endedAt.getTime()),
    verdict,
    endingTitle: ending?.title ?? "훈련 종료",
    greenChecks: collectGreenChecks(state.events),
    coachingPoints: collectCoaching(state.events),
    cfCount: state.cfCount,
    retriesUsed: state.retriesUsed,
    turnCount: cueEvents.length,
  };
}

/**
 * 훈련 화면이 버튼 폴백으로 노출할 분기 목록.
 *
 * @example
 * cueOptions(scenario, state).map(b => b.fallbackOption);
 */
export function cueOptions(s: Scenario, state: SessionState): BranchDef[] {
  const cue = currentCue(s, state);
  if (!cue) return [];
  return cue.branches.filter((b) => typeof b.fallbackOption === "string" && b.fallbackOption.length > 0);
}
