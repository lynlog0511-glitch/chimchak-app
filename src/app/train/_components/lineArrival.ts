/**
 * 대사가 도착한 순간에 갈리는 두 가지 — **변주를 청할지**와 **화면이 몇 초 붙들지**.
 *
 * 예전에는 이 둘이 한 효과 안의 한 덩어리였습니다(TrainSession의 「말하는 중」 효과).
 * 붙들 이유가 없는 세 경우 — 소리를 꺼 두셨을 때·움직임을 줄여 달라고 하셨을 때·시연
 * 빨리감기 중일 때 — 에는 조기 반환이 먼저 걸렸고, 그 아래에 변주 호출부가 있었습니다.
 * 그래서 **그 세 경우에는 요청 자체가 한 번도 나가지 않았습니다**. 「어르신 말투는 기본이
 * 「매번 조금씩 다르게」입니다」라고 적어 둔 화면이, 근무 시간 밖·공용 공간에서 소리를 끄는 가장 흔한 사용 조건에서
 * 조용히 거짓이 되는 자리였습니다(13차 심사석 ai_cto high).
 *
 * 지금은 결정이 함수로 갈려 있습니다.
 *  · `varyTargetOf` — 무엇을 청할지. **재생 상태를 인자로 받지 않습니다.** 그것이 이 분리입니다.
 *  · `varyArrival`  — 그 대사에 **요청이 실제로 나가는가**(아니면 보관소에 이미 있는가).
 *  · `lineHoldMs`   — 화면이 몇 초 붙들지. 재생 상태만 봅니다.
 *  · `settleHoldMs` — 답이 대기창 안에 왔을 때 **언제 펼지**.
 *  · `lineSpokenAloud` — 그 문장이 **실제로 소리로 읽히는가**(리전·「읽어 주는 중」이 함께 보는 값).
 *
 * 화면 쪽 규율은 그대로입니다.
 *  · 상한은 `VARY_LINE_HOLD_MS`(1200ms)이고, 그 안에 오지 않으면 검수 앵커로 넘어갑니다.
 *  · **이미 편 대사는 갈아 끼우지 않습니다** — 늦게 도착한 답은 보관소에만 들어갑니다
 *    (그 판단은 부르는 쪽이 「이 대사를 이미 폈는가」로 합니다).
 *  · 붙들 이유가 없는 세 경우는 여전히 **한 프레임도 붙들지 않습니다**(`lineHoldMs`가 0).
 *    달라진 것은 그 세 경우에도 요청은 나간다는 사실 하나뿐입니다.
 *
 * ── 보관소를 **먼저** 보는 이유 (2026-08-28) ──────────────
 * 14차까지 이 파일은 「0을 돌려주는 경우에도 같은 지점으로 되돌아오시면 그 문장이 그 자리에서
 * 바로 섭니다」라고 적어 두었는데, **거짓이었습니다.** 붙들지 않는 화면에서는 박자 효과가 같은
 * 커밋에서 동기로 대사를 펴 버리고, 보관소를 읽는 `varyLine`의 반환은 그보다 한 마이크로태스크
 * 늦게 도착해 「이미 편 대사」 가드에 걸렸습니다 — 즉 움직임 줄임·시연 빨리감기 기기에서는
 * 두 번째·세 번째 회차에도 변주가 **영구히** 서지 못했습니다(15차 demo·critic high).
 *
 * 그래서 순서를 바꿉니다: 대사가 도착하면 **보관소를 먼저 동기로 봅니다**(`varyArrival`).
 * 적중이면 붙들 것도 청할 것도 없고, 그 대사는 **처음부터** 변주문으로 섭니다 — 이미 편 문장을
 * 뒤늦게 갈아 끼우는 것이 아니라, 펴는 순간의 문장이 그것입니다. 규율은 손상되지 않습니다.
 * 붙드는 대상은 **인플라이트 요청뿐**입니다.
 *
 * ── 무전송 경계 ────────────────────────────────────────────
 * `recentContextLines`가 이 앱에서 **학습자 발화가 상류로 나가지 않게 하는 자리**입니다.
 * 「매번 조금씩 다르게」가 동의 칸 없이 기본값인 근거가 통째로 이 함수에 얹혀 있는데도
 * 화면 파일 안의 사설 함수라 회귀 검사가 한 번도 부르지 못했습니다(13차 심사석 sec_expert P0).
 * 여기서 export하고, `tests/onlineVary.test.ts`의 「무전송 경계」가 실제 세션 로그로 잽니다.
 */

import {
  VARY_MAX_RECENT_LINES,
  buildVaryRequest,
  getCachedVariation,
  isLineVaryActive,
  isVariableSpeaker,
  type LineVaryContext,
} from "@/lib/onlineVary";
import type { AiDialogueSettings } from "@/lib/settings";
import type { TurnDef } from "@/types";
import type { LogItem } from "./sessionMachine";

/* ── 박자 ──────────────────────────────────────────────── */

/**
 * 새 대사를 「말하는 중」으로 붙들어 두는 시간(ms).
 *
 * 어르신이 말을 고르는 짧은 사이입니다 — 대화의 박자를 만드는 것이 목적이지
 * 기다리게 하는 것이 목적이 아니므로, 낭독 한 문장(수 초)보다 훨씬 짧게 잡습니다.
 * 아래 세 경우에는 **한 프레임도 붙들지 않습니다** — 소리가 실제로 나지 않을 때(헤더의
 * 「소리 끄기」·자동재생 차단·낭독 미지원을 한 값으로 셉니다),
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
 * 보는 것은 셋뿐입니다: 이 세션에서 변주가 도는가(`varyOn` — 「어르신 말투」 + 응급 유형 제외),
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

/* ── 요청이 실제로 나가는가 (보관소 먼저) ───────────────── */

/**
 * 대사가 도착했을 때 갈리는 세 갈래.
 *
 * `varyLine`의 **동기 앞부분**을 그대로 미리 세어 둔 값입니다 — 그 함수는 꺼져 있거나·오프라인
 * 이거나·보관소에 있거나·요청을 조립할 수 없으면 네트워크에 닿지 않고 즉시 돌아옵니다.
 * 화면은 그 사실을 `await` 없이 알아야 합니다: 모르면 **요청도 내지 않은 대사를 붙들고**
 * (소리 끔 700ms·소리 켬 1200ms) 아무것도 얻지 못한 채 그 시간을 치릅니다(15차 a11y high).
 */
export type VaryArrival =
  /** 보관소에 이미 있습니다 — 청할 것도 붙들 것도 없고, 그 문장으로 **처음부터** 폅니다 */
  | { kind: "cached"; text: string }
  /** 요청이 나갑니다 — 이 대사만 붙듭니다 */
  | { kind: "ask" }
  /** 부르지 않습니다(꺼짐·오프라인·인물 프로필 없음 등) — 붙들지 않습니다 */
  | { kind: "skip" };

/**
 * 이 대사에 요청이 실제로 나가는가 — `varyLine`을 부르기 **전에** 같은 답을 냅니다.
 *
 * 순서까지 `varyLine`과 같습니다(스위치 → 오프라인 → 보관소 → 요청 조립). 두 자리가 갈리면
 * 화면이 빈 박자를 붙들거나(청하지 않았는데 붙듦) 이미 있는 문장을 못 펴므로,
 * `tests/lineArrival.test.ts`가 **실제 `varyLine`의 호출 수와 대조**해 둘을 함께 묶어 둡니다.
 *
 * @example varyArrival({ scenario, speaker: "elder", anchor, recentLines }).kind // "ask"
 */
export function varyArrival(
  context: LineVaryContext,
  settings?: AiDialogueSettings,
): VaryArrival {
  const anchor = context.anchor.trim();
  if (!isLineVaryActive(context.scenario, settings)) return { kind: "skip" };
  // 오프라인이면 애초에 부르지 않습니다 — 훈련은 네트워크 없이 끝까지 돌아야 합니다.
  if (typeof navigator !== "undefined" && navigator.onLine === false) return { kind: "skip" };
  const cached = getCachedVariation(context.scenario.id, anchor);
  /* 보관소에는 **통과한 문장만** 담깁니다. 그래도 앵커와 같으면 변주가 아니므로 청하지 않고
     넘어가는 쪽(skip)으로 셉니다 — 「변주」 표기가 앵커에 붙는 일이 없게. */
  if (cached !== undefined) {
    return cached === anchor ? { kind: "skip" } : { kind: "cached", text: cached };
  }
  if (!buildVaryRequest(context)) return { kind: "skip" };
  return { kind: "ask" };
}

/* ── 붙들 시간 정하기 (재생 상태만) ─────────────────────── */

/** 지금 이 기기의 재생 상태 — 대사를 붙들지 말지는 이 넷으로만 정합니다. */
export interface LinePlayback {
  /**
   * **소리가 실제로 나는가** — `useVoicePresence`의 `spokenAloud` 그대로입니다.
   *
   * 14차에는 이 칸의 이름이 `ttsOn`이었고 헤더 스위치 상태를 그대로 받았습니다. 그래서
   * 자동재생이 막힌 동안이나 낭독을 못 하는 기기에서 **소리가 하나도 나지 않는데도** 대사를
   * 「말하는 중」으로 800~1200ms 붙들고, 정작 그 구간에 쓰라고 만든 음소거 카브아웃(700ms)은
   * 적용되지 않았습니다 — 「소리가 난다」의 네 번째 정의가 이 칸에서 생겨나 있었습니다
   * (15차 a11y med). 이름을 그 값의 이름으로 되돌려, 우회가 우회처럼 보이게 둡니다.
   */
  spokenAloud: boolean;
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
 *
 * 「실제로 청한 대사에 한해」를 **참으로 만드는 것은 `varyArrival`**입니다. 14차에는 이 문장이
 * 적혀만 있었고, 부르는 쪽이 `varyLine`의 조기 반환 넷을 몰라 오프라인·보관소 적중·인물 프로필
 * 없음에서도 이 700ms를 얻는 것 없이 치렀습니다(15차 a11y high ②).
 */
export const MUTED_VARY_HOLD_MS = 700;

/**
 * 대사를 「말하는 중」으로 붙들 시간(ms) — **0이면 곧바로 폅니다.**
 *
 * `varying`이 참인 것은 **인플라이트 요청이 있는 대사뿐**입니다(`varyArrival`이 `"ask"`를
 * 돌려준 경우). 보관소 적중은 붙들지 않습니다 — 붙들 것 없이 이미 그 문장으로 펴집니다.
 *
 * 0을 돌려주는 경우에도 변주 요청은 이미 나가 있습니다(`varyTargetOf` 쪽이 정합니다).
 * 그때 도착한 답은 화면을 건드리지 못하고 보관소로 갑니다 — 이미 편 대사는 바꾸지 않는다는
 * 규율이 먼저입니다. 그리고 **같은 지점으로 되돌아오시면 그 대사는 처음부터 변주문으로
 * 섭니다** — 갈아 끼우는 것이 아니라, 도착하는 순간 보관소를 먼저 보기 때문입니다
 * (위 `varyArrival`. 14차까지 이 문장은 거짓이었습니다 — 파일 머리의 「보관소를 먼저」 절).
 *
 * 소리 끔에서 변주 대기 중일 때만 예외로 짧게 붙듭니다(`MUTED_VARY_HOLD_MS`) —
 * 시연 빨리감기와 움직임 줄임은 그 예외보다 우선합니다(둘 다 「기다리지 않겠다」는
 * 명시적 선택이라, 변주 한 문장을 위해 그 선택을 덮지 않습니다).
 *
 * @example lineHoldMs({ spokenAloud: true, reducedMotion: false, demoMode: false, varying: true }) // 1200
 * @example lineHoldMs({ spokenAloud: false, reducedMotion: false, demoMode: false, varying: true }) // 700
 * @example lineHoldMs({ spokenAloud: false, reducedMotion: false, demoMode: false, varying: false }) // 0
 */
export function lineHoldMs(playback: LinePlayback): number {
  if (playback.demoMode || playback.reducedMotion) return 0;
  if (!playback.spokenAloud) return playback.varying ? MUTED_VARY_HOLD_MS : 0;
  return playback.varying ? VARY_LINE_HOLD_MS : SPEAKING_HOLD_MS;
}

/**
 * 답이 대기창 **안에** 도착했을 때 그 대사를 펼 시각(ms · 대사 도착 시점 기준).
 *
 * 두 경우를 가릅니다.
 *  · **변주가 왔다** — 사람이 읽을 문장이 바뀌었으므로 박자는 지킵니다. 다만 그 대사에
 *    이미 걸린 상한을 **넘지 않습니다**: 음소거 화면의 상한은 700ms인데 14차 코드는 조건 없이
 *    800ms(`SPEAKING_HOLD_MS`)로 다시 걸어, 「붙들 시간은 `lineHoldMs` 하나가 정합니다」라는
 *    규율이 그 한 줄에서만 깨져 있었습니다(15차 newcode low · a11y high ①).
 *  · **변주가 오지 않았다**(미설정·쿼터 소진·가드 차단·회선 실패) — 붙들 **이유가 사라졌으므로**
 *    애초에 변주를 청하지 않았을 때의 박자로 되돌아갑니다. 소리 켬은 그대로 800ms(대화의 박자는
 *    변주와 무관한 연출입니다), 음소거는 0ms입니다. 이 갈래가 없으면 서버 키가 없는 기기에서
 *    인물 대사마다 0.7초짜리 **빈 말풍선**이 서고, 그 끝에 앵커가 나옵니다 — 관객에게는
 *    「생각하는 척만 하는 앱」으로 보이는 자리입니다(15차 demo med).
 *
 * @example settleHoldMs({ spokenAloud: false, reducedMotion: false, demoMode: false, varying: true }, true)  // 700
 * @example settleHoldMs({ spokenAloud: false, reducedMotion: false, demoMode: false, varying: true }, false) // 0
 */
export function settleHoldMs(playback: LinePlayback, varied: boolean): number {
  if (!varied) return lineHoldMs({ ...playback, varying: false });
  return Math.min(lineHoldMs(playback), SPEAKING_HOLD_MS);
}

/* ── 그 문장이 실제로 읽히는가 ──────────────────────────── */

/** 이 대사 한 줄이 소리로 나가는지를 가르는 셋. */
export interface LineVoice {
  /**
   * **이 기기에서** 소리가 나는가 — `useVoicePresence`의 `spokenAloud`를 그대로 받습니다.
   * 여기서 그 질문을 다시 정의하지 않습니다(정의는 그 훅 하나입니다).
   */
  spokenAloud: boolean;
  /** 이 대사가 변주문인가 — 새로 쓰인 문장이라 동봉 음성 매니페스트에 **열쇠가 없습니다** */
  varied: boolean;
  /** 브라우저 낭독(`speechSynthesis`)이 이 기기에 있는가 */
  synthesis: boolean;
}

/**
 * 이 대사가 **실제로 소리로 읽히는가** — 로그 리전과 「읽어 주는 중」 표시가 함께 보는 값.
 *
 * `useVoicePresence`가 답하는 것은 「이 기기가 소리를 낼 수 있는가」입니다. 그 함수는
 * `speechSynthesis`가 없어도 동봉 오디오(응급 매니페스트)가 있으면 참을 돌려줍니다 — 옳은
 * 답입니다. 검수 앵커는 실제로 그 표에 있어 소리가 납니다.
 *
 * 그런데 **변주문은 그 표에 없습니다.** 새로 쓰인 문장이라 열쇠가 없고, `speak()`는 표에서
 * 못 찾으면 브라우저 낭독으로 넘어갑니다. 그 낭독마저 없는 기기에서는 소리 없이 즉시
 * 끝나는데(`lib/speech.ts`), 그 순간 로그 리전은 「소리가 나니 나는 조용히 있겠다」로
 * `aria-live="off"`에 있었습니다 — 앱 목소리도 리더 목소리도 없는 구간입니다
 * (7차 페르소나 UI/UX P0이 「닫혔다」고 세 곳에 적힌 채 열려 있던 자리 · 15차 a11y high).
 *
 * 여기서 더하는 것은 기기 판단이 아니라 **문장 단위의 조건 하나**입니다: 낼 소리가 이 문장에
 * 있는가. 그래서 위 훅의 「쓰는 자리는 자기 판단을 하지 않습니다」는 그대로 참입니다.
 *
 * @example lineSpokenAloud({ spokenAloud: true, varied: true, synthesis: false }) // false (자막이 유일한 경로)
 * @example lineSpokenAloud({ spokenAloud: true, varied: false, synthesis: false }) // true (동봉 오디오가 읽습니다)
 */
export function lineSpokenAloud(voice: LineVoice): boolean {
  if (!voice.spokenAloud) return false;
  return voice.varied ? voice.synthesis : true;
}
