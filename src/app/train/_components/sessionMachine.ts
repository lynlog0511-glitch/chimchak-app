/**
 * 훈련 세션 화면 상태 머신.
 *
 * 판정(⚑CF·루브릭·게이지·엔딩)은 전부 엔진(`src/engine`)이 합니다.
 * 이 파일은 화면에 필요한 것 — 대화 로그, 인터럽트 모달, L3 전환, 재시도 — 만 관리합니다.
 * 시나리오 데이터를 해석하거나 대사를 지어내지 않습니다(대사는 데이터의 앵커 문구 그대로).
 */

import type { BranchDef, CueDef, PersonaDef, Scenario, SessionState, TurnDef } from "@/types";
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
import type { SubmitOptions, TracedFeedback } from "@/engine";
import { EVIDENCE_GUARD } from "@/data/evidenceGuard";
import type { SessionProgress } from "@/lib/storage";
import { PROTOCOL_HANDOFF_BODY, PROTOCOL_HANDOFF_TITLE, UNCLEAR_REPEAT_COACHING } from "./constants";

/**
 * 판정에 붙는 근거는 화이트리스트 안에서만 나옵니다.
 * 목록 밖 문서 id를 만나면 엔진이 판정을 멈추고 「공식 지침에서 근거를 찾지 못했습니다…」를
 * 그대로 띄웁니다(engine/evidence.ts). 알파 데이터는 전부 목록 안이라 지금은 발동하지 않고,
 * 새 분기·새 규칙이 목록 밖 문서를 들고 들어오는 순간에만 걸립니다.
 */
const SUBMIT_OPTIONS: SubmitOptions = { evidence: EVIDENCE_GUARD };

/* ── 이어서 하기 문구 ──────────────────────────────────────── */

/** 복원된 로그 맨 위에 한 줄 붙습니다 — 지금 보시는 기록이 되짚어 만든 것임을 밝힙니다. */
export const RESTORED_LOG_NOTICE = "이어서 하기로 되살린 기록입니다.";

/** 되살릴 수 없는 구간이 있었을 때의 문구 (규칙 사전이 단독으로 잡은 ⚑CF 등) */
export const RESTORED_LOG_NOTICE_PARTIAL =
  "이어서 하기로 되살린 기록입니다. 되살리지 못한 구간은 건너뛰었습니다.";

/**
 * 음성·타이핑으로 답하신 턴의 자리 표기.
 * 발화 원문은 저장하지 않으므로(브리프 §2) 되살릴 때는 이 문구로 대신합니다.
 */
export const RESTORED_UTTERANCE = "(직접 말씀하신 응답)";

/**
 * 멈춰 세웠던 지점(⚑CF)에서 저장된 훈련을 이어서 열었을 때의 한 줄.
 *
 * 몇 시간 뒤 돌아오신 분이 처음 보는 화면이 「잠깐, 여기서 멈춥니다」 시트가 되지 않도록,
 * 시트는 다시 띄우지 않고 **그 CUE 대기 상태**로 되돌린 뒤 로그에 이 문장만 남깁니다.
 */
export const RESUMED_AT_CF_NOTICE = "지난번에 멈췄던 장면입니다.";

/* ── 시연 프리셋 (?demo=) ─────────────────────────────────── */

/**
 * 발표용 빨리감기 지점.
 *  - `cf`  : ⚑CF가 열리는 CUE **직전**
 *  - `l3`  : L3 응급 안내로 넘어가는 CUE **직전** (B02)
 *  - `end` : 엔딩으로 끝나는 CUE **직전**
 *
 * 엔진은 손대지 않습니다 — 시나리오 데이터에서 고른 분기 id를 `submitResponse`로 그대로 재생합니다.
 */
export type DemoPreset = "cf" | "l3" | "end";

const DEMO_PRESETS: readonly DemoPreset[] = ["cf", "l3", "end"];

/**
 * `?demo=` 쿼리 값을 프리셋으로 읽습니다. 모르는 값이면 `undefined` — 쿼리가 없을 때와 같습니다.
 *
 * @example parseDemoPreset("L3") // "l3"
 * @example parseDemoPreset("아무거나") // undefined
 */
export function parseDemoPreset(value: string | null | undefined): DemoPreset | undefined {
  if (!value) return undefined;
  const key = value.trim().toLowerCase();
  return DEMO_PRESETS.find((preset) => preset === key);
}

/** 자동 재생한 구간을 숨기지 않습니다 — 로그 맨 위에 그대로 밝힙니다. */
export const DEMO_LOG_BANNER =
  "시연용 빨리감기 — 여기까지 자동 재생했습니다. 이 시연은 기록에 남지 않습니다";

/** 분기의 루브릭 평균 점수 — 자동 재생은 「잘 대응한 갈래」를 따라갑니다. */
function branchQuality(branch: BranchDef): number {
  if (branch.rubricHits.length === 0) return 0;
  let sum = 0;
  for (const hit of branch.rubricHits) sum += hit.score;
  return sum / branch.rubricHits.length;
}

/** 자동 재생이 고를 분기 — ⚑CF·재훈련 권고 분기는 지나가지 않습니다. */
function demoBranch(cue: CueDef): BranchDef | undefined {
  const safe = cue.branches.filter(
    (branch) => branch.criticalFail !== true && branch.retrainAdvice !== true,
  );
  const pool = safe.length > 0 ? safe : cue.branches;
  let best: BranchDef | undefined;
  for (const branch of pool) {
    if (!best) {
      best = branch;
      continue;
    }
    const delta = branchQuality(branch) - branchQuality(best);
    if (delta > 0 || (delta === 0 && branch.gaugeDelta < best.gaugeDelta)) best = branch;
  }
  return best;
}

/** 이 CUE에서 자동 재생을 멈출지 — 보여 드릴 장면 「직전」에서 손을 뗍니다. */
function demoStopsBefore(
  cue: CueDef,
  preset: DemoPreset,
  chosen: BranchDef | undefined,
): boolean {
  if (preset === "cf") return cue.branches.some((branch) => branch.criticalFail === true);
  if (preset === "l3") return cue.branches.some((branch) => branch.next.startsWith("protocol:"));
  return Boolean(chosen && chosen.next.startsWith("end:"));
}

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
  /** ⚑CF 시트에서 고르신 대안 문구 — 로그에 남길 뿐, 발화로 전송하지는 않습니다 */
  | { type: "retryAfterCritical"; alternative?: string }
  | { type: "protocolDone" }
  | { type: "restart" }
  /** 저장해 둔 결정 목록을 순서대로 다시 넣어 진행 상태를 되짚습니다 */
  | { type: "resume"; progress: SessionProgress }
  /** 시연용 빨리감기 — 프리셋 지점 직전까지 분기를 자동으로 재생합니다 */
  | { type: "demo"; preset: DemoPreset };

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

/**
 * 같은 CUE에서 미분류가 **연달아 몇 번째**인지 셉니다 (세션 이벤트만 보고, 새 상태 필드 없음).
 *
 * 미분류가 같은 자리에 머물게 되면서 생긴 자리입니다 — 같은 문구가 매번 똑같이 돌아오면
 * 「연속을 세고 있지 않다」로 읽힙니다(교육생 3차). 다른 갈래를 한 번이라도 지나면 0으로
 * 돌아갑니다: 연속이 아니면 반복이 아니기 때문입니다.
 *
 * @example consecutiveUnclear(events, "CUE-1", "D1-n") // 2 — 이번이 두 번째 연속 미분류
 */
function consecutiveUnclear(
  events: readonly SessionState["events"][number][],
  cueId: string,
  defaultBranchId: string,
): number {
  let count = 0;
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (!event || event.cueId !== cueId) break;
    // ⚑CF 인터럽트는 대화 턴이 아닙니다(buildRecord와 같은 규약) — 연속을 끊지 않고 건너뜁니다.
    if (event.feedback?.criticalFail === true) continue;
    if (event.feedback?.branchId !== defaultBranchId) break;
    count += 1;
  }
  return count;
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

        const result = submitResponse(scenario, state.session, action.input, SUBMIT_OPTIONS);
        const branch = findBranch(cue, result.feedback.branchId);

        /* 같은 자리에서 **두 번째** 미분류부터는 화면 문구만 갈아 끼웁니다.
           판정도 게이지도 기록도 그대로 엔진이 낸 것이고, 바뀌는 것은 이 회차 화면에 서는
           한 줄뿐입니다(성장 기록에는 시나리오 데이터의 문구가 그대로 남습니다).
           되묻지 않는다는 원칙 안에서 할 수 있는 것은 보기 쪽을 한 단 세우는 것뿐입니다. */
        const feedback: TracedFeedback =
          !result.feedback.criticalFail &&
          result.feedback.branchId === cue.defaultBranchId &&
          consecutiveUnclear(result.state.events, cue.id, cue.defaultBranchId) >= 2
            ? { ...result.feedback, message: UNCLEAR_REPEAT_COACHING }
            : result.feedback;

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
          if (feedback.message.trim().length > 0) {
            log = [...log, { key: `fb-${seq}`, kind: "feedback", feedback }];
            seq += 1;
          }
          return {
            ...state,
            session: result.state,
            log,
            seq,
            critical: {
              feedback,
              alternatives: criticalAlternatives(scenario, result.state, feedback),
            },
            lastFeedback: feedback,
            judgeTick: state.judgeTick + 1,
          };
        }

        if (feedback.message.trim().length > 0) {
          log = [...log, { key: `fb-${seq}`, kind: "feedback", feedback }];
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
            lastFeedback: feedback,
            gaugeTick: state.gaugeTick + 1,
            judgeTick: state.judgeTick + 1,
            attempt: state.attempt + 1,
          };
        }

        /* 같은 CUE에 머무는 경우(미분류)에는 턴 대사를 다시 붙이지 않습니다.
           미분류 분기의 next가 같은 턴을 가리키므로, 그대로 두면 어르신 대사가 한 번 더
           낭독되고 로그에도 같은 줄이 겹쳐 쌓입니다. 되묻는 반응(aiReaction)은 위에서
           이미 붙었고, 보기 버튼도 그대로 열려 있습니다. */
        const stayed =
          result.state.status === "running" &&
          result.state.currentTurnId === state.session.currentTurnId;
        const entered =
          result.state.status === "running" && !stayed
            ? enterCurrent(scenario, result.state, log, seq)
            : { session: result.state, log, seq };

        return {
          ...state,
          phase: phaseOf(entered.session),
          session: entered.session,
          log: entered.log,
          seq: entered.seq,
          critical: null,
          lastFeedback: feedback,
          gaugeTick: state.gaugeTick + 1,
          judgeTick: state.judgeTick + 1,
          attempt: state.attempt + 1,
        };
      }

      case "retryAfterCritical": {
        if (state.session.status !== "interrupted") return state;
        const resumed = advanceAfterCF(scenario, state.session);
        const picked = (action.alternative ?? "").trim();
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
              text:
                picked.length > 0
                  ? `「${picked}」 — 이 대안으로 같은 지점에서 다시 해보겠습니다. 점수는 매기지 않습니다.`
                  : "같은 지점에서 다시 해보겠습니다. 점수는 매기지 않습니다.",
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
       * 시간으로 내리는 판정(CO-03 119 지연)은 되짚는 속도로 다시 재므로 항상 충족이 됩니다 —
       * 저장하는 것이 분기 id뿐이라 그때 흐른 초를 되살릴 수 없고, 없는 지연을 지어내는 것보다
       * 재시작한 세션에서 다시 재는 편이 정직합니다.
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

        /* 멈춰 세웠던 지점에서 저장된 경우 — ⚑CF 시트를 다시 띄우지 않습니다.
           몇 시간 뒤 돌아오신 분이 처음 보는 화면이 전면 인터럽트가 되지 않도록,
           그 CUE 대기 상태로 되돌리고 무슨 자리인지만 로그에 한 줄로 밝힙니다. */
        if (next.session.status === "interrupted") {
          next = {
            ...next,
            session: advanceAfterCF(scenario, next.session),
            critical: null,
            lastFeedback: null,
            attempt: next.attempt + 1,
            log: [
              ...next.log,
              {
                key: `resume-cf-${next.seq}`,
                kind: "notice",
                text: RESUMED_AT_CF_NOTICE,
                tone: "brand",
              },
            ],
            seq: next.seq + 1,
          };
        }

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

      /**
       * 시연용 빨리감기 — 프리셋이 가리키는 장면 **직전**까지 자동으로 재생합니다.
       *
       * 판정은 전부 엔진이 다시 합니다(`submit`을 그대로 돌립니다). 화면이 결과를 지어내지 않고,
       * 자동으로 지나간 구간은 로그 맨 위 배너로 밝힙니다 — 쿼리가 없으면 이 경로를 타지 않습니다.
       */
      case "demo": {
        const begun = reduce(state, { type: "start" });
        let next = begun;
        let played = 0;

        // 데이터가 잘못 이어져 있어도 화면이 멈추지 않도록 상한을 둡니다.
        for (let guard = 0; guard < 24; guard += 1) {
          if (next.session.status === "protocol") {
            const done = reduce(next, { type: "protocolDone" });
            if (done === next) break;
            next = done;
            continue;
          }
          // 자동 재생은 ⚑CF를 지나가지 않습니다(안전 분기만 고릅니다). 만나면 거기서 손을 뗍니다.
          if (next.phase !== "session" || next.session.status !== "running") break;

          const turn = currentTurn(scenario, next.session);
          const cue = turn?.cue;
          if (!turn || !cue) break;

          const branch = demoBranch(cue);
          // 첫 CUE에서 곧바로 멈추면 빨리감기가 아무 일도 하지 않습니다 —
          // 한 턴은 반드시 재생한 뒤부터 「직전」을 셉니다(A01은 CUE-1에도 ⚑CF 분기가 있습니다).
          if (played > 0 && demoStopsBefore(cue, action.preset, branch)) break;
          if (!branch) break;

          const after = reduce(next, {
            type: "submit",
            input: { branchId: branch.id, viaButton: true },
          });
          if (after === next) break;
          next = after;
          played += 1;
        }

        // 한 턴도 재생하지 않았으면 그냥 처음부터입니다 — 배너를 붙이지 않습니다.
        if (played === 0) return begun;

        return {
          ...next,
          log: [
            { key: "demo-banner", kind: "notice", text: DEMO_LOG_BANNER, tone: "brand" },
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
