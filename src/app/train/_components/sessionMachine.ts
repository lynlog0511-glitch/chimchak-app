/**
 * 훈련 세션 화면 상태 머신.
 *
 * 판정(⚑CF·루브릭·게이지·엔딩)은 전부 엔진(`src/engine`)이 합니다.
 * 이 파일은 화면에 필요한 것 — 대화 로그, 인터럽트 모달, L3 전환, 재시도 — 만 관리합니다.
 * 시나리오 데이터를 해석하거나 대사를 지어내지 않습니다(대사는 데이터의 앵커 문구 그대로).
 */

import type { CueDef, PersonaDef, Scenario, SessionState, TurnDef } from "@/types";
import {
  advanceAfterCF,
  advanceAuto,
  criticalAlternatives,
  currentTurn,
  findBranch,
  protocolIdOf,
  resumeFromProtocol,
  retrySession,
  startSession,
  submitResponse,
} from "@/engine";
import type { TracedFeedback } from "@/engine";
import type { SessionProgress } from "@/lib/storage";
import { PROTOCOL_HANDOFF_BODY, PROTOCOL_HANDOFF_TITLE } from "./constants";

/* ── 이어서 하기 문구 ──────────────────────────────────────── */

/** 복원된 로그 맨 위에 한 줄 붙습니다 — 지금 보시는 기록이 되짚어 만든 것임을 밝힙니다. */
export const RESTORED_LOG_NOTICE = "이어서 하기로 복원된 기록입니다.";

/** 되살릴 수 없는 구간이 있었을 때의 문구 (규칙 사전이 단독으로 잡은 ⚑CF 등) */
export const RESTORED_LOG_NOTICE_PARTIAL =
  "이어서 하기로 복원된 기록입니다. 되살리지 못한 구간은 건너뛰었습니다.";

/**
 * 음성·타이핑으로 답하신 턴의 자리 표기.
 * 발화 원문은 저장하지 않으므로(브리프 §2) 되살릴 때는 이 문구로 대신합니다.
 */
export const RESTORED_UTTERANCE = "(직접 말씀하신 응답)";

/* ── 로그 ──────────────────────────────────────────────── */

export type LogItem =
  | {
      key: string;
      kind: "line";
      speaker: TurnDef["speaker"];
      speakerName: string;
      text: string;
      note?: string;
      triggerName?: string;
    }
  | { key: string; kind: "learner"; text: string; viaButton: boolean }
  | { key: string; kind: "feedback"; feedback: TracedFeedback }
  | { key: string; kind: "draft"; source: string }
  | { key: string; kind: "notice"; text: string; tone: "brand" | "danger" };

export interface CriticalInterruptState {
  feedback: TracedFeedback;
  alternatives: string[];
}

export interface TrainState {
  phase: "briefing" | "session" | "ended";
  session: SessionState;
  log: LogItem[];
  /** ⚑CF 전면 인터럽트 — null이 아니면 모달을 띄웁니다 */
  critical: CriticalInterruptState | null;
  /** 마지막 턴 피드백 (게이지 변동 안내용) */
  lastFeedback: TracedFeedback | null;
  /** 게이지 애니메이션 트리거 — 값이 바뀔 때마다 다시 그립니다 */
  gaugeTick: number;
  /**
   * 채점이 일어난 횟수 — 계층 표시기(L2 점등) 신호로만 씁니다.
   * ⚑CF 인터럽트도 규칙 엔진이 판정한 것이므로 함께 셉니다. 화면에는 숫자를 표시하지 않습니다.
   */
  judgeTick: number;
  /** CUE 시도 횟수 — 대기 타이머·입력창 초기화 키로 씁니다 */
  attempt: number;
  seq: number;
}

export type TrainAction =
  | { type: "start" }
  | { type: "submit"; input: { utterance?: string; branchId?: string; viaButton: boolean } }
  | { type: "retryAfterCritical" }
  | { type: "protocolDone" }
  | { type: "restart" }
  /** 저장해 둔 결정 목록을 순서대로 다시 넣어 진행 상태를 되짚습니다 */
  | { type: "resume"; progress: SessionProgress };

/* ── 헬퍼 ──────────────────────────────────────────────── */

function lineItem(turn: TurnDef, seq: number): LogItem {
  return {
    key: `line-${seq}-${turn.id}`,
    kind: "line",
    speaker: turn.speaker,
    speakerName: turn.speakerName,
    text: turn.text,
    note: turn.stageDirection,
    triggerName: turn.isTrigger ? turn.triggerName : undefined,
  };
}

/** "박 어르신 (가상 인물)" → "박 어르신" (가상 인물 고지는 배지가 따로 합니다) */
function shortName(persona: PersonaDef): string {
  return persona.name.replace(/\s*\(가상 인물\)/g, "").trim();
}

/**
 * 학습자 응답에 대한 반응 대사의 화자.
 *
 * 돌발 변수 턴은 화자가 'system'(상황 안내)이지만, 그 턴의 반응 대사는 등장인물의 말입니다.
 * AI 대사에는 항상 AI 배지가 붙어야 하므로, 이런 경우 등장인물로 되돌려 표시합니다.
 */
function reactionSpeaker(
  scenario: Scenario,
  turn: TurnDef,
): { speaker: TurnDef["speaker"]; speakerName: string } {
  if (turn.speaker !== "system" || !turn.isTrigger) {
    return { speaker: turn.speaker, speakerName: turn.speakerName };
  }
  const persona =
    scenario.personas.find((item) => item.role === "care_recipient") ??
    scenario.personas.find((item) => item.role === "guardian");
  if (!persona) return { speaker: turn.speaker, speakerName: turn.speakerName };
  return {
    speaker: persona.role === "guardian" ? "guardian" : "elder",
    speakerName: shortName(persona),
  };
}

/**
 * 보고·기록 CUE인지 — 이 구간에서는 입력 발화를 가명처리하고 기록 5요소 초안을 미리 보여 줍니다.
 *
 * @example isReportCue(CHK_A01, cue) // CUE-4~6이면 true
 */
export function isReportCue(scenario: Scenario, cue: CueDef): boolean {
  const prompts = scenario.reportCues;
  if (!prompts || prompts.length === 0) return false;
  const target = cue.prompt.trim();
  return prompts.some((prompt) => prompt.trim() === target);
}

/**
 * 현재 턴의 대사를 로그에 넣고, CUE가 없는 자동 진행 턴이면 다음 턴까지 이어서 넣습니다.
 * (돌발 변수 단서 턴처럼 학습자 응답 없이 지나가는 턴을 위한 처리입니다.)
 */
function enterCurrent(
  scenario: Scenario,
  session: SessionState,
  log: LogItem[],
  seq: number,
): { session: SessionState; log: LogItem[]; seq: number } {
  let nextSession = session;
  let nextLog = log;
  let nextSeq = seq;

  // 데이터가 잘못 이어져 있어도 화면이 멈추지 않도록 상한을 둡니다.
  for (let guard = 0; guard < 12; guard += 1) {
    if (nextSession.status !== "running") break;
    const turn = currentTurn(scenario, nextSession);
    if (!turn) break;

    nextLog = [...nextLog, lineItem(turn, nextSeq)];
    nextSeq += 1;
    if (turn.cue) break;

    const advanced = advanceAuto(scenario, nextSession);
    if (advanced.currentTurnId === nextSession.currentTurnId && advanced.status === nextSession.status) {
      break;
    }
    nextSession = advanced;
  }

  return { session: nextSession, log: nextLog, seq: nextSeq };
}

function phaseOf(session: SessionState): TrainState["phase"] {
  return session.status === "ended" ? "ended" : "session";
}

/**
 * 되짚어 만든 로그에서, 음성·타이핑으로 답하셨던 턴의 표기를 바로잡습니다.
 *
 * 저장된 것은 분기 id뿐이라 되살린 발화 자리에는 보기 문구가 들어가 있습니다.
 * 실제로 하신 말씀이 아니므로 대체 표기로 바꾸고, 그 문장을 원문으로 삼는
 * 기록 초안 미리보기는 아예 다시 만들지 않습니다.
 *
 * @param from 이번 턴에서 새로 붙은 항목의 시작 위치
 */
function maskRestoredTurn(log: LogItem[], from: number): LogItem[] {
  const out: LogItem[] = [];
  for (let i = 0; i < log.length; i += 1) {
    const item = log[i];
    if (!item) continue;
    if (i < from) {
      out.push(item);
      continue;
    }
    if (item.kind === "learner") {
      out.push({ ...item, text: RESTORED_UTTERANCE });
      continue;
    }
    // 원문이 없으니 가명처리·5요소 추출을 다시 돌릴 수 없습니다.
    if (item.kind === "draft") continue;
    if (item.kind === "feedback") {
      // 어떤 판정 신호에 걸렸는지는 발화가 있어야 알 수 있습니다. 되살린 턴에
      // 「보기 버튼 선택」이라고 적으면 사실과 달라지므로 판정 경로는 붙이지 않습니다.
      const feedback: TracedFeedback = { ...item.feedback };
      delete feedback.trace;
      out.push({ ...item, feedback });
      continue;
    }
    out.push(item);
  }
  return out;
}

/** 저장값이 훼손돼 있어도 말이 되는 범위 안으로만 받습니다 (0 이상 정수, 상한 있음). */
function clampCount(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(Math.floor(value), 0), max);
}

/** 시나리오 진입 직후 상태 (브리핑 화면) */
export function initialTrainState(scenario: Scenario): TrainState {
  return {
    phase: "briefing",
    session: startSession(scenario),
    log: [],
    critical: null,
    lastFeedback: null,
    gaugeTick: 0,
    judgeTick: 0,
    attempt: 0,
    seq: 0,
  };
}

/* ── 리듀서 ────────────────────────────────────────────── */

/**
 * 시나리오를 고정한 리듀서를 만듭니다.
 *
 * @example
 * const reducer = useMemo(() => makeTrainReducer(scenario), [scenario]);
 * const [state, dispatch] = useReducer(reducer, scenario, initialTrainState);
 */
export function makeTrainReducer(scenario: Scenario) {
  return function reduce(state: TrainState, action: TrainAction): TrainState {
    switch (action.type) {
      case "start": {
        const fresh = startSession(scenario);
        const entered = enterCurrent(scenario, fresh, [], 0);
        return {
          phase: phaseOf(entered.session),
          session: entered.session,
          log: entered.log,
          critical: null,
          lastFeedback: null,
          gaugeTick: 0,
          judgeTick: 0,
          attempt: 0,
          seq: entered.seq,
        };
      }

      case "submit": {
        if (state.phase !== "session" || state.session.status !== "running") return state;
        const turn = currentTurn(scenario, state.session);
        const cue = turn?.cue;
        if (!turn || !cue) return state;

        const result = submitResponse(scenario, state.session, action.input);
        const branch = findBranch(cue, result.feedback.branchId);

        let seq = state.seq;
        let log = state.log;

        const spoken = (action.input.utterance ?? "").trim();
        const said = spoken.length > 0 ? spoken : (branch?.fallbackOption ?? branch?.label ?? "");
        if (said.length > 0) {
          log = [
            ...log,
            { key: `me-${seq}`, kind: "learner", text: said, viaButton: action.input.viaButton },
          ];
          seq += 1;

          // 보고·기록 구간에서는 발화를 가명처리해 기록 초안으로 옮겨 드립니다.
          if (isReportCue(scenario, cue)) {
            log = [...log, { key: `draft-${seq}`, kind: "draft", source: said }];
            seq += 1;
          }
        }

        if (branch && branch.aiReaction.trim().length > 0) {
          const voice = reactionSpeaker(scenario, turn);
          log = [
            ...log,
            {
              key: `react-${seq}`,
              kind: "line",
              speaker: voice.speaker,
              speakerName: voice.speakerName,
              text: branch.aiReaction,
              note: branch.aiReactionNote,
            },
          ];
          seq += 1;
        }

        if (result.interrupted) {
          // 전면 모달은 잠시 뒤 닫히지만, 어떤 규칙이 왜 멈춰 세웠는지는 로그에 남겨 둡니다
          // (피드백 카드의 「이 판정이 나온 이유」로 나중에 다시 확인하실 수 있게).
          if (result.feedback.message.trim().length > 0) {
            log = [...log, { key: `fb-${seq}`, kind: "feedback", feedback: result.feedback }];
            seq += 1;
          }
          return {
            ...state,
            session: result.state,
            log,
            seq,
            critical: {
              feedback: result.feedback,
              alternatives: criticalAlternatives(scenario, result.state, result.feedback),
            },
            lastFeedback: result.feedback,
            judgeTick: state.judgeTick + 1,
          };
        }

        if (result.feedback.message.trim().length > 0) {
          log = [...log, { key: `fb-${seq}`, kind: "feedback", feedback: result.feedback }];
          seq += 1;
        }

        if (result.state.status === "protocol") {
          log = [
            ...log,
            {
              key: `handoff-${seq}`,
              kind: "notice",
              text: `${PROTOCOL_HANDOFF_TITLE} · ${PROTOCOL_HANDOFF_BODY}`,
              tone: "danger",
            },
          ];
          seq += 1;
          return {
            ...state,
            phase: "session",
            session: result.state,
            log,
            seq,
            critical: null,
            lastFeedback: result.feedback,
            gaugeTick: state.gaugeTick + 1,
            judgeTick: state.judgeTick + 1,
            attempt: state.attempt + 1,
          };
        }

        const entered =
          result.state.status === "running"
            ? enterCurrent(scenario, result.state, log, seq)
            : { session: result.state, log, seq };

        return {
          ...state,
          phase: phaseOf(entered.session),
          session: entered.session,
          log: entered.log,
          seq: entered.seq,
          critical: null,
          lastFeedback: result.feedback,
          gaugeTick: state.gaugeTick + 1,
          judgeTick: state.judgeTick + 1,
          attempt: state.attempt + 1,
        };
      }

      case "retryAfterCritical": {
        if (state.session.status !== "interrupted") return state;
        const resumed = advanceAfterCF(scenario, state.session);
        return {
          ...state,
          session: resumed,
          critical: null,
          lastFeedback: null,
          attempt: state.attempt + 1,
          log: [
            ...state.log,
            {
              key: `again-${state.seq}`,
              kind: "notice",
              text: "같은 지점에서 다시 해보겠습니다. 벌점은 없습니다.",
              tone: "brand",
            },
          ],
          seq: state.seq + 1,
        };
      }

      case "protocolDone": {
        if (state.session.status !== "protocol") return state;
        const protocolId = protocolIdOf(state.session);
        // 프로토콜 자리표시 턴의 autoNext가 복귀 지점입니다 (B02는 T4 = 119 상황실 인계).
        const placeholder = protocolId
          ? scenario.turns.find((turn) => turn.id === protocolId)
          : undefined;
        const resumeTurnId = placeholder?.autoNext ?? "";
        const resumed = resumeFromProtocol(scenario, state.session, resumeTurnId);

        let log: LogItem[] = [
          ...state.log,
          {
            key: `resume-${state.seq}`,
            kind: "notice",
            text: "고정 안내가 끝났습니다. 이어서 인계·보고를 진행합니다.",
            tone: "brand",
          },
        ];
        let seq = state.seq + 1;

        if (resumed.status === "running") {
          const entered = enterCurrent(scenario, resumed, log, seq);
          log = entered.log;
          seq = entered.seq;
          return {
            ...state,
            phase: phaseOf(entered.session),
            session: entered.session,
            log,
            seq,
            critical: null,
            // 프로토콜 진입 직전 턴의 게이지 변동 안내가 복귀 뒤까지 남지 않도록 지웁니다.
            lastFeedback: null,
            attempt: state.attempt + 1,
          };
        }

        return {
          ...state,
          phase: phaseOf(resumed),
          session: resumed,
          log,
          seq,
          critical: null,
          lastFeedback: null,
          attempt: state.attempt + 1,
        };
      }

      /**
       * 이어서 하기 — 저장해 둔 결정 목록을 엔진에 순서대로 다시 넣습니다.
       *
       * 판정은 그대로 엔진이 다시 합니다(화면이 결과를 지어내지 않습니다).
       * 다만 규칙 사전이 단독으로 잡았던 ⚑CF처럼 시나리오 분기로 되돌릴 수 없는 결정은
       * 되살리지 못합니다 — 그 턴은 건너뛰고, 로그 맨 위에 그 사실을 밝힙니다.
       * (⚑CF 인터럽트는 같은 CUE에 머무르므로 건너뛰어도 이후 순서는 어긋나지 않습니다.
       *  다만 ⚑CF 횟수는 체크포인트에 적힌 값을 함께 살려 종합 판정이 느슨해지지 않게 합니다.)
       */
      case "resume": {
        const begun = reduce(state, { type: "start" });
        const decisions = action.progress.decisions;
        let next = begun;
        let replayed = 0;
        let skipped = 0;

        for (const decision of decisions) {
          // 앞 결정이 ⚑CF·L3로 이어졌으면 먼저 그 구간을 지나갑니다.
          if (next.session.status === "interrupted") next = reduce(next, { type: "retryAfterCritical" });
          if (next.session.status === "protocol") next = reduce(next, { type: "protocolDone" });
          if (next.phase !== "session" || next.session.status !== "running") break;

          const turn = currentTurn(scenario, next.session);
          const cue = turn?.cue;
          if (!turn || !cue) break;
          // 시나리오 데이터가 바뀌어 순서가 어긋나면 거기까지만 되살립니다.
          if (decision.turnId.length > 0 && decision.turnId !== turn.id) break;
          if (!findBranch(cue, decision.branchId)) {
            skipped += 1;
            continue;
          }

          const before = next.log.length;
          const after = reduce(next, {
            type: "submit",
            input: { branchId: decision.branchId, viaButton: decision.viaButton },
          });
          if (after === next) break;
          next = decision.viaButton ? after : { ...after, log: maskRestoredTurn(after.log, before) };
          replayed += 1;
        }

        // 한 턴도 되살리지 못했으면 그냥 처음부터 시작하는 편이 정직합니다.
        if (replayed === 0) return begun;

        // 되살리지 못한 ⚑CF가 있어도 횟수만은 사실대로 남깁니다.
        // (새로고침 한 번으로 ⚑CF가 없던 일이 되면 안 됩니다. 판정 자체는 그대로 엔진이 한 것입니다.)
        const cfCount = Math.max(
          next.session.cfCount,
          clampCount(action.progress.cfCount, decisions.length),
        );
        const retriesUsed = Math.max(
          next.session.retriesUsed,
          clampCount(action.progress.retriesUsed, 99),
        );

        return {
          ...next,
          session: { ...next.session, cfCount, retriesUsed },
          log: [
            {
              key: "resume-notice",
              kind: "notice",
              text: skipped > 0 ? RESTORED_LOG_NOTICE_PARTIAL : RESTORED_LOG_NOTICE,
              tone: "brand",
            },
            ...next.log,
          ],
        };
      }

      case "restart": {
        const fresh = retrySession(scenario, state.session);
        const entered = enterCurrent(scenario, fresh, [], 0);
        return {
          phase: phaseOf(entered.session),
          session: entered.session,
          log: entered.log,
          critical: null,
          lastFeedback: null,
          gaugeTick: 0,
          judgeTick: 0,
          attempt: 0,
          seq: entered.seq,
        };
      }

      default:
        return state;
    }
  };
}
