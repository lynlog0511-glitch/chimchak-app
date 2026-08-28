/**
 * 대사가 도착한 순간에 갈리는 두 가지 — **변주를 청할지**와 **화면이 몇 초 붙들지**.
 *
 * 예전에는 이 둘이 한 효과 안의 한 덩어리였습니다(TrainSession의 「말하는 중」 효과).
 * 붙들 이유가 없는 세 경우 — 소리를 꺼 두셨을 때·움직임을 줄여 달라고 하셨을 때·시연
 * 빨리감기 중일 때 — 에는 조기 반환이 먼저 걸렸고, 그 아래에 변주 호출부가 있었습니다.
 * 그래서 **그 세 경우에는 요청 자체가 한 번도 나가지 않았습니다**. 「어르신 연기는 기본으로
 * 켭니다」라고 적어 둔 화면이, 근무 시간 밖·공용 공간에서 소리를 끄는 가장 흔한 사용 조건에서
 * 조용히 거짓이 되는 자리였습니다(13차 심사석 ai_cto high).
 *
 * 지금은 두 결정이 두 함수입니다.
 *  · `varyTargetOf` — 무엇을 청할지. **재생 상태를 인자로 받지 않습니다.** 그것이 이 분리입니다.
 *  · `lineHoldMs`   — 화면이 몇 초 붙들지. 재생 상태만 봅니다.
 *
 * 화면 쪽 규율은 그대로입니다.
 *  · 상한은 `VARY_LINE_HOLD_MS`(1200ms)이고, 그 안에 오지 않으면 검수 앵커로 넘어갑니다.
 *  · **이미 편 대사는 갈아 끼우지 않습니다** — 늦게 도착한 답은 보관소에만 들어갑니다
 *    (그 판단은 부르는 쪽이 「이 대사를 이미 폈는가」로 합니다).
 *  · 붙들 이유가 없는 세 경우는 여전히 **한 프레임도 붙들지 않습니다**(`lineHoldMs`가 0).
 *    달라진 것은 그 세 경우에도 요청은 나간다는 사실 하나뿐입니다.
 *
 * ── 무전송 경계 ────────────────────────────────────────────
 * `recentContextLines`가 이 앱에서 **학습자 발화가 상류로 나가지 않게 하는 자리**입니다.
 * 어르신 연기가 동의 칸 없이 기본으로 켜져 있는 근거가 통째로 이 함수에 얹혀 있는데도
 * 화면 파일 안의 사설 함수라 회귀 검사가 한 번도 부르지 못했습니다(13차 심사석 sec_expert P0).
 * 여기서 export하고, `tests/onlineVary.test.ts`의 「무전송 경계」가 실제 세션 로그로 잽니다.
 */

import { VARY_MAX_RECENT_LINES, isVariableSpeaker } from "@/lib/onlineVary";
import type { TurnDef } from "@/types";
import type { LogItem } from "./sessionMachine";

/* ── 박자 ──────────────────────────────────────────────── */

/**
 * 새 대사를 「말하는 중」으로 붙들어 두는 시간(ms).
 *
 * 어르신이 말을 고르는 짧은 사이입니다 — 대화의 박자를 만드는 것이 목적이지
 * 기다리게 하는 것이 목적이 아니므로, 낭독 한 문장(수 초)보다 훨씬 짧게 잡습니다.
 * 아래 세 경우에는 **한 프레임도 붙들지 않습니다** — 소리를 꺼 두셨을 때(세션 헤더의 「소리 끄기」),
 * 움직임을 줄여 달라고 하셨을 때(`prefers-reduced-motion`), 시연 빨리감기 중일 때.
 * 버튼만으로 완주하시는 분이 이 연출 때문에 느려지지 않도록, 끄는 자리를 화면 안에 둔 셈입니다.
 */
export const SPEAKING_HOLD_MS = 800;

/**
 * 대사 변주를 기다리는 **화면 쪽** 상한(ms).
 *
 * 이미 있던 「말하는 중」 800ms와 **겹칩니다** — 변주는 그 박자 안에서 끝나야 값이 있습니다.
 * 400ms가 더 붙을 수 있는 것이 전부이고, 그 안에 오지 않으면 검수 앵커로 그대로 넘어갑니다.
 * 늦게 도착한 답은 화면을 건드리지 못하고 보관소에만 들어갑니다(같은 지점을 다시 하실 때 씁니다) —
 * 이미 편 대사를 뒤늦게 갈아 끼우면 읽고 계신 문장이 눈앞에서 바뀝니다.
 */
export const VARY_LINE_HOLD_MS = 1200;

/**
 * 「말하는 중」을 붙일 대사인지.
 * 상황 안내(system)와 검수된 고정 안내(protocol)는 사람이 말을 고르는 자리가 아니므로 그대로 폅니다.
 */
export function isSpokenLine(
  item: LogItem | undefined,
): item is Extract<LogItem, { kind: "line" }> {
  if (!item || item.kind !== "line") return false;
  return item.speaker === "elder" || item.speaker === "guardian" || item.speaker === "dispatcher";
}

/* ── 무전송 경계 ───────────────────────────────────────── */

/**
 * 변주 요청에 실어 보낼 직전 맥락 두어 줄.
 *
 * 담는 것은 **인물·상황 대사뿐**입니다(`kind: "line"`). 학습자 발화(`kind: "learner"`)는
 * 여기서 걸러집니다 — 맥락으로 실으면 편하지만, 그 순간 「기기 밖으로 나가는 말씀은 미분류 턴의
 * 가명처리된 한 문장뿐」이라는 약속이 조용히 넓어집니다. 넓히지 않는 쪽을 고른 자리이고,
 * **이 함수가 그 경계입니다.**
 *
 * 피드백(`feedback`)·기록 초안(`draft`)·안내(`notice`)도 같은 줄에서 함께 걸립니다.
 * 초안은 학습자 발화를 원문으로 삼아 만들어지므로, 그 갈래가 열리면 경계가 도로 뚫립니다.
 *
 * @example recentContextLines(log, "line-3-T2") // ["박 어르신: 나 지금 가야 해."]
 */
export function recentContextLines(log: readonly LogItem[], exceptKey: string): string[] {
  const out: string[] = [];
  for (let i = log.length - 1; i >= 0 && out.length < VARY_MAX_RECENT_LINES; i -= 1) {
    const item = log[i];
    if (!item || item.kind !== "line" || item.key === exceptKey) continue;
    if (item.text.trim().length === 0) continue;
    out.push(`${item.speakerName}: ${item.text}`);
  }
  return out.reverse();
}

/* ── 청할 대사 고르기 (재생 상태와 무관) ────────────────── */

/** 변주를 청할 한 대사 — 로그 맨 끝에서 꺼낸 네 칸입니다. */
export interface VaryTarget {
  /** 로그 항목 키 — 부르는 쪽이 「이 대사를 이미 폈는가」를 이 키로 봅니다 */
  key: string;
  speaker: TurnDef["speaker"];
  /** 검수 앵커 원문 */
  anchor: string;
  /** 직전 인물 대사 두어 줄 — 위 경계를 지난 것들뿐입니다 */
  recentLines: string[];
}

/**
 * 지금 변주를 청할 대사 — 없으면 `undefined`입니다.
 *
 * **인자에 재생 상태가 없습니다.** 소리·움직임·시연 빨리감기는 화면이 몇 초 붙드느냐를 정할 뿐,
 * 요청을 낼지 말지를 정하지 않습니다. 그 둘이 한 덩어리였던 것이 13차에 고친 결합입니다 —
 * 이 서명이 그 분리를 붙들고 있으므로, 여기에 재생 상태 인자를 더하는 변경은 되돌리는 변경입니다.
 *
 * 보는 것은 셋뿐입니다: 어르신 연기가 이 세션에서 도는가(`varyOn` — 설정 + 응급 유형 제외),
 * 로그 맨 끝이 인물 대사인가, 그 화자가 변주 대상인가(어르신·보호자).
 *
 * @example varyTargetOf(log, true)?.speaker // "elder"
 * @example varyTargetOf(log, false)         // undefined (스위치가 꺼져 있습니다)
 */
export function varyTargetOf(log: readonly LogItem[], varyOn: boolean): VaryTarget | undefined {
  if (!varyOn) return undefined;
  const tail = log[log.length - 1];
  if (!isSpokenLine(tail)) return undefined;
  if (!isVariableSpeaker(tail.speaker)) return undefined;
  if (tail.text.trim().length === 0) return undefined;
  return {
    key: tail.key,
    speaker: tail.speaker,
    anchor: tail.text,
    recentLines: recentContextLines(log, tail.key),
  };
}

/* ── 붙들 시간 정하기 (재생 상태만) ─────────────────────── */

/** 지금 이 기기의 재생 상태 — 대사를 붙들지 말지는 이 넷으로만 정합니다. */
export interface LinePlayback {
  /** 소리로 읽어 드리는 중인가 (세션 헤더의 「소리 끄기」) */
  ttsOn: boolean;
  /** 움직임을 줄여 달라고 설정하셨는가 (`prefers-reduced-motion`) */
  reducedMotion: boolean;
  /** 시연 빨리감기(`?demo=`)로 자동 재생된 세션인가 */
  demoMode: boolean;
  /** 이 대사에 청한 변주가 아직 도는 중인가 */
  varying: boolean;
}

/**
 * 소리를 꺼 둔 화면이 **변주가 도는 동안만** 붙드는 시간(ms).
 *
 * 소리 끔은 원래 「한 프레임도 안 붙드는」 자리였는데, 그러면 앵커가 즉시 펴져 변주가
 * 도착해도 화면에 서지 못했습니다(이미 편 대사는 바꾸지 않는 규율). 무대에서 음소거로
 * 시연하는 경우가 실제로 흔하고, 사용자도 공용 공간에서 소리를 끄는 것이 기본 사용
 * 조건이라 — **변주를 실제로 청한 대사에 한해** 짧게 기다립니다(13차 심사석 ai_cto 2안,
 * 14차 리더 채택). 변주를 안 청한 대사·시연 빨리감기·움직임 줄임은 여전히 0입니다.
 */
export const MUTED_VARY_HOLD_MS = 700;

/**
 * 대사를 「말하는 중」으로 붙들 시간(ms) — **0이면 곧바로 폅니다.**
 *
 * 0을 돌려주는 경우에도 변주 요청은 이미 나가 있습니다(`varyTargetOf` 쪽이 정합니다).
 * 그때 도착한 답은 화면을 건드리지 못하고 보관소로 갑니다 — 이미 편 대사는 바꾸지 않는다는
 * 규율이 먼저입니다. 같은 지점으로 되돌아오시면 그 문장이 그 자리에서 바로 섭니다.
 *
 * 소리 끔에서 변주 대기 중일 때만 예외로 짧게 붙듭니다(`MUTED_VARY_HOLD_MS`) —
 * 시연 빨리감기와 움직임 줄임은 그 예외보다 우선합니다(둘 다 「기다리지 않겠다」는
 * 명시적 선택이라, 변주 한 문장을 위해 그 선택을 덮지 않습니다).
 *
 * @example lineHoldMs({ ttsOn: true, reducedMotion: false, demoMode: false, varying: true }) // 1200
 * @example lineHoldMs({ ttsOn: false, reducedMotion: false, demoMode: false, varying: true }) // 700
 * @example lineHoldMs({ ttsOn: false, reducedMotion: false, demoMode: false, varying: false }) // 0
 */
export function lineHoldMs(playback: LinePlayback): number {
  if (playback.demoMode || playback.reducedMotion) return 0;
  if (!playback.ttsOn) return playback.varying ? MUTED_VARY_HOLD_MS : 0;
  return playback.varying ? VARY_LINE_HOLD_MS : SPEAKING_HOLD_MS;
}
