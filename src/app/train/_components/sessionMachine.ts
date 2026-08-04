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
import { PROTOCOL_HANDOFF_BODY, PROTOCOL_HANDOFF_TITLE } from "./constants";

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
  | { type: "restart" };

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
