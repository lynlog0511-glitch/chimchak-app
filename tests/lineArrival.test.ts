/**
 * 대사 도착 계통 — src/app/train/_components/lineArrival.ts + 그 값을 쓰는 세 효과의 배선.
 *
 * 14차는 「요청」과 「박자」를 두 함수로 갈라 두고도 **둘을 잇는 자리**를 한 번도 재지 않았다.
 * 그래서 15차 감사에서 나온 결함이 전부 그 사이에 있었다 — 보관소에 문장을 두고도 못 펴고
 * (demo·critic high), 요청도 내지 않은 대사를 붙들고(a11y high), 이미 걸린 상한을 넘겨 붙들고
 * (newcode low), 세션 첫 대사만 배선이 빠지고(critic med), 재시작하면 첫 대사가 소리 없이
 * 지나갔다(newcode high). 이 파일은 그 다섯 자리를 각각 못 박는다.
 *
 * 브라우저를 띄우지 않는다. 순수 함수를 직접 부르거나(앞 절들), 그 함수를 쓰는 화면 파일의
 * 소스를 읽어 배선 한 줄을 문자열로 확인한다(마지막 절 — 한계는 그 절 머리에 적어 둔다).
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MUTED_VARY_HOLD_MS,
  SPEAKING_HOLD_MS,
  VARY_LINE_HOLD_MS,
  lineHoldMs,
  lineSpokenAloud,
  settleHoldMs,
  varyArrival,
  varyTargetOf,
  type LinePlayback,
} from "@/app/train/_components/lineArrival";
import {
  initialTrainState,
  makeTrainReducer,
  type LogItem,
} from "@/app/train/_components/sessionMachine";
import { CHK_A01 } from "@/data/scenarios/chk-a01";
import { CHK_B01 } from "@/data/scenarios/chk-b01";
import { clearVariationCache, getCachedVariation, varyLine } from "@/lib/onlineVary";
import type { LineVaryContext } from "@/lib/onlineVary";
import type { AiDialogueSettings } from "@/lib/settings";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const ON: AiDialogueSettings = { enabled: true };
const OFF: AiDialogueSettings = { enabled: false };

/** 어르신 대사 한 줄과 같은 뜻으로 다시 쓴 한 줄 — 가드 여섯 단을 전부 지난다. */
const ANCHOR = "집에 가야 해요. 우리 애기 밥 줘야 하는데 이러고 있으면 어떡해요.";
const VARIED = "집에 가야 한다니까. 우리 애기 밥 줘야 하는데 이러고 있으면 어쩌라는 거예요.";

function contextFor(anchor = ANCHOR, scenario = CHK_A01): LineVaryContext {
  return { scenario, speaker: "elder", anchor, recentLines: [] };
}

/** `/api/coach` 중계 응답 한 벌과 **호출 수**를 함께 돌려준다(요청이 실제로 나갔는지를 센다). */
function countingFetch(line: string): { fetchImpl: typeof fetch; calls: string[] } {
  const calls: string[] = [];
  const fetchImpl = (async (url: unknown) => {
    calls.push(String(url));
    return {
      ok: true,
      json: async () => ({ status: "ok", content: JSON.stringify({ line }) }),
    } as unknown as Response;
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

/** `navigator.onLine`을 잠시 갈아 끼운다 — node 환경에는 없을 수도 있어 되돌리는 쪽까지 함께 든다. */
function withOnline(value: boolean, run: () => void): void {
  const had = "navigator" in globalThis;
  const before = (globalThis as { navigator?: unknown }).navigator;
  Object.defineProperty(globalThis, "navigator", {
    value: { onLine: value },
    configurable: true,
    writable: true,
  });
  try {
    run();
  } finally {
    if (had) {
      Object.defineProperty(globalThis, "navigator", {
        value: before,
        configurable: true,
        writable: true,
      });
    } else {
      delete (globalThis as { navigator?: unknown }).navigator;
    }
  }
}

/* ── ① 보관소를 먼저 본다 (demo·critic high) ─────────────── */

describe("보관소 적중은 붙들지 않고 처음부터 선다", () => {
  beforeEach(() => clearVariationCache());
  afterEach(() => clearVariationCache());

  it("보관소가 비어 있으면 「청한다」, 채워지면 「이미 있다」로 갈린다", async () => {
    expect(varyArrival(contextFor(), ON)).toEqual({ kind: "ask" });

    const { fetchImpl, calls } = countingFetch(VARIED);
    const outcome = await varyLine(contextFor(), { fetchImpl, settings: ON });
    expect(outcome.varied).toBe(true);
    expect(calls).toHaveLength(1);
    expect(getCachedVariation(CHK_A01.id, ANCHOR)).toBe(VARIED);

    // 같은 지점으로 되돌아온 상태 — 청할 것이 없고, 세울 문장이 이미 있다.
    expect(varyArrival(contextFor(), ON)).toEqual({ kind: "cached", text: VARIED });
  });

  it("hold가 0인 기기(움직임 줄임·시연 빨리감기)에서도 보관소 적중은 화면에 선다", async () => {
    const { fetchImpl } = countingFetch(VARIED);
    await varyLine(contextFor(), { fetchImpl, settings: ON });

    const arrival = varyArrival(contextFor(), ON);
    expect(arrival.kind).toBe("cached");

    /* 「캐시 적중이면 붙들지 않는다」가 이 결함의 핵심이다. 14차 배선에서는 이 대사도
       `varying: true`로 붙들려 있었고(요청 여부와 무관하게 varyWaitRef를 세웠다), hold가 0인
       기기에서는 붙들지 못한 채 앵커가 먼저 펴진 뒤 마이크로태스크로 돌아온 답이 「이미 편
       대사」 가드에 걸렸다 — 두 번째·세 번째 회차에도 변주가 영영 서지 못했다. */
    const varying = arrival.kind === "ask";
    expect(varying).toBe(false);
    for (const playback of [
      { spokenAloud: true, reducedMotion: true, demoMode: false, varying },
      { spokenAloud: true, reducedMotion: false, demoMode: true, varying },
      { spokenAloud: false, reducedMotion: false, demoMode: false, varying },
    ] satisfies LinePlayback[]) {
      expect(lineHoldMs(playback)).toBe(0);
    }
    // 붙들지 않는데도 세울 문장이 있다 — 그 문장이 「처음부터」 서는 근거다.
    expect(arrival.kind === "cached" ? arrival.text : "").toBe(VARIED);
  });
});

/* ── ② 요청을 낸 대사만 붙든다 (a11y high ②) ───────────── */

describe("varyArrival은 varyLine의 조기 반환과 어긋나지 않는다", () => {
  beforeEach(() => clearVariationCache());
  afterEach(() => clearVariationCache());

  /** 같은 맥락에 대해 두 함수를 함께 돌려, 「청한다고 본 것」과 「실제 호출 수」를 맞춰 본다. */
  async function agree(
    context: LineVaryContext,
    settings: AiDialogueSettings,
  ): Promise<{ predicted: boolean; called: number }> {
    const predicted = varyArrival(context, settings).kind === "ask";
    const { fetchImpl, calls } = countingFetch(VARIED);
    await varyLine(context, { fetchImpl, settings });
    return { predicted, called: calls.length };
  }

  it("스위치 꺼짐·응급 유형·인물 프로필 없음에서는 둘 다 「부르지 않음」이다", async () => {
    const off = await agree(contextFor(), OFF);
    expect(off).toEqual({ predicted: false, called: 0 });

    // 응급 유형은 켜 두어도 통째로 빠진다(L3 원칙).
    const emergency = await agree(contextFor(ANCHOR, CHK_B01), ON);
    expect(emergency).toEqual({ predicted: false, called: 0 });

    // 빈 앵커는 요청을 조립할 수 없다.
    const empty = await agree(contextFor("   "), ON);
    expect(empty).toEqual({ predicted: false, called: 0 });
  });

  it("오프라인에서는 둘 다 「부르지 않음」이다 — 훈련은 네트워크 없이 끝까지 돈다", async () => {
    let predicted = true;
    withOnline(false, () => {
      predicted = varyArrival(contextFor(), ON).kind === "ask";
    });
    expect(predicted).toBe(false);

    const { fetchImpl, calls } = countingFetch(VARIED);
    let done = Promise.resolve();
    withOnline(false, () => {
      done = varyLine(contextFor(), { fetchImpl, settings: ON }).then(() => undefined);
    });
    await done;
    expect(calls).toHaveLength(0);
  });

  it("보관소 적중에서도 호출은 0건이다 (그때 화면은 붙들 것이 아니라 세울 것이 있다)", async () => {
    const seed = countingFetch(VARIED);
    await varyLine(contextFor(), { fetchImpl: seed.fetchImpl, settings: ON });
    expect(seed.calls).toHaveLength(1);

    const again = await agree(contextFor(), ON);
    expect(again).toEqual({ predicted: false, called: 0 });
  });

  it("보통의 대사에서는 둘 다 「청한다」이다", async () => {
    const normal = await agree(contextFor(), ON);
    expect(normal).toEqual({ predicted: true, called: 1 });
  });
});

/* ── ③ 붙들 시간과 그 안에서 끝나는 시간 (newcode low · demo med) ── */

describe("settleHoldMs — 답이 대기창 안에 왔을 때 펼 시각", () => {
  const muted: LinePlayback = {
    spokenAloud: false,
    reducedMotion: false,
    demoMode: false,
    varying: true,
  };
  const voiced: LinePlayback = { ...muted, spokenAloud: true };

  it("이미 걸린 상한을 넘지 않는다 — 음소거 700ms가 800ms로 늘어나던 자리", () => {
    expect(lineHoldMs(muted)).toBe(MUTED_VARY_HOLD_MS);
    expect(settleHoldMs(muted, true)).toBe(MUTED_VARY_HOLD_MS);
    expect(settleHoldMs(muted, true)).toBeLessThanOrEqual(lineHoldMs(muted));
    // 14차 코드가 조건 없이 쓰던 값 — 상한보다 크다는 사실 자체를 못 박아 둔다.
    expect(SPEAKING_HOLD_MS).toBeGreaterThan(MUTED_VARY_HOLD_MS);
  });

  it("소리가 나는 화면은 상한 1200ms 안에서 대화의 박자 800ms를 지킨다", () => {
    expect(lineHoldMs(voiced)).toBe(VARY_LINE_HOLD_MS);
    expect(settleHoldMs(voiced, true)).toBe(SPEAKING_HOLD_MS);
  });

  it("변주가 오지 않았으면 「청하지 않았을 때의 박자」로 되돌아간다", () => {
    /* 서버 미설정·쿼터 소진·가드 차단은 앵커를 그대로 돌려준다. 그때까지 붙들고 있던 이유가
       사라지므로 음소거 화면은 0ms다 — 이 갈래가 없으면 인물 대사마다 0.7초짜리 **빈
       말풍선**이 서고 그 끝에 앵커가 나온다(15차 demo med). 소리가 나는 화면의 800ms는
       변주와 무관한 대화 연출이므로 그대로 남는다. */
    expect(settleHoldMs(muted, false)).toBe(0);
    expect(settleHoldMs(voiced, false)).toBe(SPEAKING_HOLD_MS);
  });

  it("붙들지 않는 화면에서는 어느 쪽이든 0이다", () => {
    for (const playback of [
      { ...voiced, reducedMotion: true },
      { ...voiced, demoMode: true },
    ] satisfies LinePlayback[]) {
      expect(lineHoldMs(playback)).toBe(0);
      expect(settleHoldMs(playback, true)).toBe(0);
      expect(settleHoldMs(playback, false)).toBe(0);
    }
  });
});

/* ── ④ 그 문장이 실제로 읽히는가 (a11y high ①) ─────────── */

describe("lineSpokenAloud — 리전과 「읽어 주는 중」이 함께 보는 값", () => {
  it("변주문은 브라우저 낭독이 없으면 소리가 나지 않는다 (동봉 음성에 열쇠가 없다)", () => {
    expect(lineSpokenAloud({ spokenAloud: true, varied: true, synthesis: false })).toBe(false);
    expect(lineSpokenAloud({ spokenAloud: true, varied: true, synthesis: true })).toBe(true);
  });

  it("검수 앵커는 동봉 오디오가 읽으므로 브라우저 낭독이 없어도 소리가 난다", () => {
    expect(lineSpokenAloud({ spokenAloud: true, varied: false, synthesis: false })).toBe(true);
  });

  it("기기가 소리를 내지 못하면 무엇이든 거짓이다 — 좁히기만 하고 넓히지 않는다", () => {
    for (const varied of [true, false]) {
      for (const synthesis of [true, false]) {
        expect(lineSpokenAloud({ spokenAloud: false, varied, synthesis })).toBe(false);
      }
    }
  });
});

/* ── ⑤ 세 효과의 배선 (소스 문자열) ────────────────────── */

/**
 * 여기 있는 검사들은 **소스를 문자열로 읽는다.** 이 저장소의 회귀망은 순수 함수만 보므로
 * (vitest 환경이 node이고 jsdom을 들이지 않는다), 위 함수들을 화면이 실제로 그렇게 쓰는지는
 * 달리 잴 방법이 없다. 15차 a11y low가 지적한 그대로다 — 1,385건이 통과해도 「둘을 잇는
 * 자리」의 회귀를 한 줄도 막지 못했다.
 *
 * 한계는 분명하다: 문자열이 있다는 것이 동작을 증명하지 않는다. 그래도 **없어지면 실패한다** —
 * 이 파일이 막으려는 것은 「고쳐 놓은 배선이 다음 커밋에서 조용히 사라지는 것」이다.
 */
describe("배선 (TrainSession · useModalDismiss 소스)", () => {
  const session = readFileSync(
    join(ROOT, "src/app/train/_components/TrainSession.tsx"),
    "utf8",
  );
  const modal = readFileSync(join(ROOT, "src/components/useModalDismiss.ts"), "utf8");

  it("회차 초기화 한 함수가 낭독 키까지 비운다 (재시작 첫 대사 무음 — newcode high)", () => {
    const body = session.slice(
      session.indexOf("const resetLineTiming = useCallback("),
      session.indexOf("/* 서버에서는 설정을 알 수 없으므로"),
    );
    expect(body).toContain("spokenKeyRef.current = \"\"");
    expect(body).toContain("shownLineRef.current = \"\"");
    expect(body).toContain("varyAskedRef.current = \"\"");
    expect(body).toContain("varyWaitRef.current = null");

    /* 세 진입 경로가 **모두** 이 함수 하나를 쓴다 — 14차에는 「처음부터」만 낭독 키를
       빠뜨렸고, 로그 키가 회차마다 0부터 다시 세어져 첫 대사가 소리 없이 지나갔다. */
    for (const handler of ["handleStart", "handleRestart", "handleResume"]) {
      const at = session.indexOf(`const ${handler} = useCallback(`);
      expect(at).toBeGreaterThan(-1);
      expect(session.slice(at, at + 900)).toContain("resetLineTiming()");
    }
    // 그 초기화가 세 곳에 흩어져 다시 갈리지 않도록, 핸들러 안에는 남겨 두지 않는다.
    expect(session.split("spokenKeyRef.current = \"\"")).toHaveLength(2);
  });

  it("박자 효과가 varyOn·spokenAloud를 본다 (첫 대사 배선 · 「소리가 난다」 정의)", () => {
    const at = session.indexOf("const playback: LinePlayback = {");
    expect(at).toBeGreaterThan(-1);
    const effect = session.slice(at, at + 1400);
    // 헤더 스위치(ttsOn)가 아니라 통일된 값을 넘긴다.
    expect(effect).toContain("spokenAloud,");
    expect(effect).not.toContain("ttsOn,");
    // 시연 빨리감기는 「회차 기준」이 아니라 「지나간 구간 기준」 표식을 본다.
    expect(effect).toContain("demoMode: demoFastForwardRef.current");
    // 목표 시각은 상수가 아니라 settleHoldMs가 낸다.
    expect(effect).toContain("settleHoldMs(playback, varied)");
    expect(effect).toContain("}, [spokenAloud, state.log, varyOn]);");
  });

  it("요청 효과가 보관소를 먼저 보고, 청한 대사에만 대기표를 세운다", () => {
    const at = session.indexOf("useLineArrivalEffect(() => {");
    expect(at).toBeGreaterThan(-1);
    const effect = session.slice(at, at + 1600);
    expect(effect).toContain("const arrival = varyArrival(context);");
    // 보관소 적중은 대기표 없이 곧바로 세운다.
    expect(effect.indexOf("arrival.kind === \"cached\"")).toBeLessThan(
      effect.indexOf("varyWaitRef.current = {"),
    );
    expect(effect).toContain("if (arrival.kind === \"skip\") return undefined;");
    expect(effect).toContain("wait.settle?.(outcome.varied)");
    /* 그리기 **전에** 도는 효과여야 보관소 문장이 「처음부터」 선다 —
       passive로 되돌리면 같은 문장이 「교체」가 된다. */
    expect(session).toContain("typeof window === \"undefined\" ? useEffect : useLayoutEffect");
  });

  it("로그 리전과 「읽어 주는 중」이 lineSpokenAloud 한 값을 함께 본다", () => {
    expect(session).toContain("spokenAloud={logSpokenAloud}");
    expect(session).toContain("const logSpokenAloud = lineSpokenAloud({");
    // 낭독 효과 쪽 — 소리가 나지 않는 문장에는 「읽어 주는 중」을 달지 않는다.
    const at = session.indexOf("if (lineSpokenAloud({ spokenAloud, varied: text !== lastLine.text");
    expect(at).toBeGreaterThan(-1);
    expect(session.slice(at, at + 200)).toContain("setSpeakingKey(key);");
  });

  it("시연 프리셋: 빨리감기는 조작 시작에서 풀리고, 저장 억제는 회차 끝까지 남는다", () => {
    // 저장 두 자리는 회차 기준 표식만 본다.
    expect(session).not.toContain("demoModeRef");
    expect(session.split("if (demoSeededRef.current) return;")).toHaveLength(3);
    // 사용자 조작이 시작되는 두 자리에서 빨리감기를 놓는다.
    for (const handler of ["const handleSubmit = useCallback(", "const handleRetryAfterCritical = useCallback("]) {
      const at = session.indexOf(handler);
      expect(at).toBeGreaterThan(-1);
      expect(session.slice(at, at + 700)).toContain("demoFastForwardRef.current = false;");
    }
  });

  it("초점 가두기: 초점이 목록 밖일 때도 양 끝으로 돌려보낸다 (첫 Shift+Tab 구멍)", () => {
    expect(modal).toContain("const at = active instanceof HTMLElement ? focusables.indexOf(active) : -1;");
    const at = modal.indexOf("if (at === -1) {");
    expect(at).toBeGreaterThan(-1);
    expect(modal.slice(at, at + 160)).toContain("(event.shiftKey ? last : first).focus();");
  });
});

/* ── ⑥ 대상 고르기는 그대로 (14차 분리 유지) ───────────── */

describe("varyTargetOf는 여전히 재생 상태를 보지 않는다", () => {
  it("로그 맨 끝의 인물 대사 하나만 고른다", () => {
    const reduce = makeTrainReducer(CHK_A01);
    const started = reduce(initialTrainState(CHK_A01), { type: "start" });
    const tail: LogItem | undefined = started.log[started.log.length - 1];
    expect(tail?.kind).toBe("line");

    const target = varyTargetOf(started.log, true);
    expect(target?.key).toBe(tail?.kind === "line" ? tail.key : "");
    expect(varyTargetOf(started.log, false)).toBeUndefined();
    // 서명에 재생 상태 인자가 없다 — 이 분리를 되돌리는 변경은 여기서 컴파일이 막는다.
    expect(varyTargetOf.length).toBe(2);
  });
});
