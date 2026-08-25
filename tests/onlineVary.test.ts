/**
 * 대사 변주 — src/lib/onlineVary.ts + src/app/api/coach/route.ts (`task: "vary"`)
 *
 * 이 파일이 지키는 것은 셋이다.
 *  ① **막히면 언제나 검수 앵커가 화면에 선다.** 형식·길이·숫자·표현 넉 단 가운데 하나라도
 *    걸리면 돌아오는 문장은 원문이다 — 화면이 표류하는 경우가 하나도 없어야 한다.
 *  ② **응급 유형은 통째로 빠진다.** L3 원칙이 코드에도 그대로 있는지 데이터로 확인한다.
 *  ③ **학습자 발화는 나가지 않는다.** 변주 요청 몸통에 그 칸이 아예 없다는 사실을 몸통으로 잰다.
 *
 * 실제 네트워크 호출은 0건이다. fetch는 전부 주입한 가짜다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/coach/route";
import { COACH_RATE_LIMITS } from "@/lib/coachLimits";
import { CHK_A01 } from "@/data/scenarios/chk-a01";
import { CHK_B01 } from "@/data/scenarios/chk-b01";
import { CHK_C02 } from "@/data/scenarios/chk-c02";
import { getActiveScenarios } from "@/data/scenarios";
import { checkCritical } from "@/engine/rules";
import { BANNED_PHRASES, MODEL_IDENTITY_WORDS, buildCoachRequest } from "@/lib/onlineCoach";
import {
  VARY_ANCHOR_MAX,
  VARY_BLOCK_LABEL,
  VARY_ENDPOINT,
  VARY_MAX_RECENT_LINES,
  VARY_MAX_RATIO,
  VARY_MIN_RATIO,
  applyVaryGuards,
  buildVaryRequest,
  clearVariationCache,
  isLineVaryActive,
  isVariableSpeaker,
  requestLineVariation,
  varyLine,
  type LineVaryContext,
  type LineVaryRequest,
} from "@/lib/onlineVary";
import type { OnlineCoachingSettings } from "@/lib/settings";

/* ── 도구 ──────────────────────────────────────────────── */

const ON: OnlineCoachingSettings = { enabled: true };
const OFF: OnlineCoachingSettings = { enabled: false };

/** 앵커 한 줄 — 숫자가 없어 「새 숫자」 가드를 또렷하게 잴 수 있다. */
const ANCHOR = "집에 가야 해요. 우리 애기 밥 줘야 하는데 이러고 있으면 어떡해요.";

/**
 * 같은 뜻으로 다시 쓴 한 줄 — 가드 여섯 단을 전부 지나는 기준 문장이다.
 *
 * 한때 이 자리는 "…왜 자꾸 붙잡아요."였다. 가드 ⑥이 서면서 그 문장은 막힌다 —
 * 앵커에는 없던 「붙잡」이 규칙 사전에 걸리기 때문이다. 어르신의 하소연을 막는 것이
 * 지나쳐 보이지만, 그 문장은 **앵커에 없던 일(붙잡혔다)을 새로 만든 문장**이기도 하다.
 * 그래서 문장을 고쳤다(가드를 좁히지 않았다). 막히는 쪽의 실측은 아래 가드 ⑥ 검사에 남긴다.
 */
const VARIED = "집에 가야 한다니까. 우리 애기 밥 줘야 하는데 이러고 있으면 어쩌라는 거예요.";

const REQUEST: LineVaryRequest = {
  scenarioSummary: "현관 앞 귀가 요구",
  persona: "박 어르신 (가상 인물) — 알츠하이머형 치매 중등도",
  anchor: ANCHOR,
  recentLines: ["박 어르신: 나 지금 가야 해."],
};

/** 길이만 재는 문장 한 줄 (숫자도 금지 표현도 들어 있지 않다). */
function filler(length: number): string {
  return "가".repeat(Math.max(0, length));
}

/** 앵커 길이의 몇 배 — 경계 검사에서는 올림·내림을 직접 골라 쓴다. */
function ratioLength(ratio: number): number {
  return ANCHOR.length * ratio;
}

/** `/api/coach`가 돌려주는 몸통 한 벌을 흉내 낸다. */
function relayed(body: Record<string, unknown>, ok = true): Response {
  return { ok, json: async () => body } as unknown as Response;
}

function fetchReturning(body: Record<string, unknown>): {
  fetchImpl: typeof fetch;
  calls: Array<{ url: string; init: RequestInit | undefined }>;
} {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const fetchImpl = (async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return relayed(body);
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

/** 변주문 한 줄을 실은 중계 응답 */
function varyReply(line: string): Record<string, unknown> {
  return { status: "ok", content: JSON.stringify({ line }) };
}

/** 어르신·보호자 대사가 있는 첫 턴 (실제 시나리오 데이터에서 가져온다) */
function firstElderLine(): string {
  const turn = CHK_A01.turns.find((item) => item.speaker === "elder" && item.text.length > 0);
  if (!turn) throw new Error("CHK-A01에 어르신 대사가 없습니다");
  return turn.text;
}

function contextFor(anchor: string): LineVaryContext {
  return { scenario: CHK_A01, speaker: "elder", anchor, recentLines: [] };
}

/* ── 대상 가리기 ───────────────────────────────────────── */

describe("변주 대상", () => {
  it("어르신과 보호자만 대상이다 (119 상황실·상황 안내·고정 안내는 아니다)", () => {
    expect(isVariableSpeaker("elder")).toBe(true);
    expect(isVariableSpeaker("guardian")).toBe(true);
    expect(isVariableSpeaker("dispatcher")).toBe(false);
    expect(isVariableSpeaker("system")).toBe(false);
    expect(isVariableSpeaker("protocol")).toBe(false);
  });

  it("응급 유형 시나리오는 켜 두어도 돌지 않는다 (L3 원칙)", () => {
    expect(CHK_B01.type).toBe("EMERGENCY");
    expect(isLineVaryActive(CHK_B01, ON)).toBe(false);
    expect(isLineVaryActive(CHK_A01, ON)).toBe(true);
  });

  it("응급이 아닌 시나리오에는 프로토콜로 넘어가는 길이 없다 (L3 배제는 데이터 규약이다)", () => {
    /* 변주가 유형 단위로 빠지는 근거는 「응급 시나리오에서만 고정 프로토콜이 재생된다」는
       데이터 규약이다. 어느 날 비응급 시나리오에 protocol: 분기가 하나 생기면, 그 장면의
       앞뒤 대사는 변주 대상인데 그 사이에 고정 프로토콜이 끼는 앞뒤 안 맞는 화면이 된다.
       규약을 주석이 아니라 검사로 못 박아 둔다. */
    let checked = 0;
    for (const scenario of getActiveScenarios()) {
      if (scenario.type === "EMERGENCY") continue;
      for (const turn of scenario.turns) {
        if (turn.autoNext !== undefined) {
          expect(turn.autoNext.startsWith("protocol:"), `${scenario.id} ${turn.id}`).toBe(false);
          checked += 1;
        }
        for (const branch of turn.cue?.branches ?? []) {
          expect(branch.next.startsWith("protocol:"), `${scenario.id} ${branch.id}`).toBe(false);
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("꺼져 있으면 어느 시나리오도 돌지 않는다", () => {
    expect(isLineVaryActive(CHK_A01, OFF)).toBe(false);
  });

  it("요청을 만들 수 없는 자리는 undefined다", () => {
    expect(buildVaryRequest({ ...contextFor(""), anchor: "   " })).toBeUndefined();
    expect(buildVaryRequest({ ...contextFor(ANCHOR), speaker: "dispatcher" })).toBeUndefined();
    expect(buildVaryRequest({ ...contextFor(ANCHOR), scenario: CHK_B01 })).toBeUndefined();
    // 상한을 넘는 길이는 대사가 아니라 지문에 가깝다 — 애초에 청하지 않는다.
    expect(buildVaryRequest(contextFor("가".repeat(VARY_ANCHOR_MAX + 1)))).toBeUndefined();
  });

  it("요청에는 인물 프로필과 앵커 원문이 담기고, 맥락은 세 줄까지다", () => {
    const request = buildVaryRequest({
      scenario: CHK_A01,
      speaker: "elder",
      anchor: ANCHOR,
      recentLines: ["한 줄", "두 줄", "세 줄", "네 줄"],
    });
    expect(request?.anchor).toBe(ANCHOR);
    expect(request?.persona).toContain("박 어르신");
    expect(request?.recentLines).toHaveLength(VARY_MAX_RECENT_LINES);
    // 가장 가까운 세 줄을 남긴다.
    expect(request?.recentLines[2]).toBe("네 줄");
  });
});

/* ── 가드 ①~⑤ ─────────────────────────────────────────── */

describe("가드 (앵커 대비)", () => {
  it("같은 뜻으로 다시 쓴 문장은 통과한다", () => {
    const outcome = applyVaryGuards(JSON.stringify({ line: VARIED }), ANCHOR);
    expect(outcome.varied).toBe(true);
    expect(outcome.text).toContain("애기 밥");
    expect(outcome.blocked).toBeUndefined();
  });

  it("① JSON이 깨지면 앵커가 그대로 선다", () => {
    const outcome = applyVaryGuards("집에 가야 해요", ANCHOR);
    expect(outcome.blocked).toBe("format");
    expect(outcome.varied).toBe(false);
    expect(outcome.text).toBe(ANCHOR);
  });

  it("① 대사가 비어 있으면 막는다", () => {
    expect(applyVaryGuards('{"line":"   "}', ANCHOR).blocked).toBe("format");
    expect(applyVaryGuards('{"coaching":"엉뚱한 칸"}', ANCHOR).blocked).toBe("format");
  });

  it("② 너무 짧으면 막는다 (요약은 같은 뜻이 아니다)", () => {
    const outcome = applyVaryGuards(
      JSON.stringify({ line: filler(Math.floor(ratioLength(VARY_MIN_RATIO)) - 1) }),
      ANCHOR,
    );
    expect(outcome.blocked).toBe("length");
    expect(outcome.text).toBe(ANCHOR);
  });

  it("② 너무 길면 막는다 (부풀리기도 같은 뜻이 아니다)", () => {
    const outcome = applyVaryGuards(
      JSON.stringify({ line: filler(Math.ceil(ratioLength(VARY_MAX_RATIO)) + 1) }),
      ANCHOR,
    );
    expect(outcome.blocked).toBe("length");
  });

  it("② 60%·160% 경계는 통과한다", () => {
    const shortest = filler(Math.ceil(ratioLength(VARY_MIN_RATIO)));
    const longest = filler(Math.floor(ratioLength(VARY_MAX_RATIO)));
    expect(applyVaryGuards(JSON.stringify({ line: shortest }), ANCHOR).varied).toBe(true);
    expect(applyVaryGuards(JSON.stringify({ line: longest }), ANCHOR).varied).toBe(true);
  });

  it("③ 앵커에 없던 숫자가 생기면 막는다", () => {
    const outcome = applyVaryGuards('{"line":"집에 가야 해요. 3시까지 애기 밥을 줘야 하는데."}', ANCHOR);
    expect(outcome.blocked).toBe("number");
    expect(outcome.blockedDetail).toContain("3");
    expect(outcome.text).toBe(ANCHOR);
  });

  it("③ 앵커에 있던 숫자는 그대로 써도 통과한다", () => {
    const anchor = "3시에 우리 애가 학교에서 온단 말이에요.";
    const outcome = applyVaryGuards('{"line":"3시면 우리 애가 학교에서 돌아온다니까요."}', anchor);
    expect(outcome.varied).toBe(true);
  });

  it("③ 자릿수를 늘려 붙인 숫자도 새 숫자로 본다", () => {
    const anchor = "4시에 데리러 온대요.";
    // 「4」가 앵커에 있다고 「40」이 통과하면 안 된다.
    expect(applyVaryGuards('{"line":"40분 뒤에 데리러 온다니까요."}', anchor).blocked).toBe("number");
  });

  it("③ 전각·아랍-인도 숫자로 적어 보낸 새 숫자도 막는다", () => {
    /* 아라비아 숫자만 세던 자리다. 「５」·「٥」로 적으면 새 숫자가 그대로 지나갔다. */
    const anchor = "4시에 데리러 온대요.";
    expect(applyVaryGuards('{"line":"５시에 데리러 온다니까요."}', anchor).blocked).toBe("number");
    expect(applyVaryGuards('{"line":"٥시에 데리러 온다니까요."}', anchor).blocked).toBe("number");
  });

  it("③ 표기만 다른 같은 숫자는 통과한다 (전각·아랍-인도를 0~9로 접어 센다)", () => {
    /* 접지 않으면 앵커의 「4」와 변주문의 「４」가 서로 다른 숫자로 세어져 옳은 변주가 막힌다. */
    const anchor = "4시에 데리러 온대요.";
    expect(applyVaryGuards('{"line":"４시에 데리러 온다니까요."}', anchor).varied).toBe(true);
    expect(applyVaryGuards('{"line":"٤시에 데리러 온다니까요."}', anchor).varied).toBe(true);
  });

  it("③ 한글 수사는 숫자로 세지 않는다 (「한 번」이 새 숫자가 되면 정상 변주가 통째로 막힌다)", () => {
    const anchor = "집에 좀 보내 줘요. 자꾸 이러지 말고요.";
    const outcome = applyVaryGuards(
      JSON.stringify({ line: "집에 좀 보내 줘요. 한 번만 봐주면 안 돼요?" }),
      anchor,
    );
    expect(outcome.blocked).toBeUndefined();
    expect(outcome.varied).toBe(true);
  });

  it("④ 금지 표현 8종은 하나도 통과하지 못한다", () => {
    for (const phrase of BANNED_PHRASES) {
      const line = `${phrase}${filler(ANCHOR.length - phrase.length)}`;
      const outcome = applyVaryGuards(JSON.stringify({ line }), ANCHOR);
      expect(outcome.blocked, phrase).toBe("phrase");
      expect(outcome.text, phrase).toBe(ANCHOR);
    }
  });

  it("④ 띄어쓰기를 늘려도 금지 표현은 빠져나가지 못한다", () => {
    const line = `증상   완화${filler(ANCHOR.length - 7)}`;
    expect(applyVaryGuards(JSON.stringify({ line }), ANCHOR).blocked).toBe("phrase");
  });

  it("④ 반대로 붙여 써도 빠져나가지 못한다 (양쪽 공백을 지우고 대조한다)", () => {
    /* 늘리는 우회만 막고 줄이는 우회를 열어 두면 체에 구멍이 하나 남는다. */
    for (const head of ["증상완화", "AI주치의", "인지개선", "위험도판정"]) {
      const line = `${head}${filler(ANCHOR.length - head.length)}`;
      expect(applyVaryGuards(JSON.stringify({ line }), ANCHOR).blocked, head).toBe("phrase");
    }
  });

  it("④ 어르신 입에서 모델 정체어가 나오면 막는다 (목록 전수)", () => {
    for (const word of MODEL_IDENTITY_WORDS) {
      const head = `저는 ${word}이라 잘 모르겠어요`;
      const line = `${head}${filler(ANCHOR.length - head.length)}`;
      expect(applyVaryGuards(JSON.stringify({ line }), ANCHOR).blocked, word).toBe("phrase");
    }
  });

  it("④ 붙여 쓴 정체어와 대문자로 적은 영어 상투구도 막는다", () => {
    for (const head of ["저는 언어모델이라 잘 모르겠어요", "As an AI, 저는 잘 모르겠어요"]) {
      const line = `${head}${filler(ANCHOR.length - head.length)}`;
      expect(applyVaryGuards(JSON.stringify({ line }), ANCHOR).blocked, head).toBe("phrase");
    }
  });

  it("⑤ 앵커와 똑같이 돌아오면 막지 않는다 — 다만 바뀐 것이 없으니 표기도 없다", () => {
    const outcome = applyVaryGuards(JSON.stringify({ line: ANCHOR }), ANCHOR);
    expect(outcome.blocked).toBeUndefined();
    expect(outcome.varied).toBe(false);
    expect(outcome.text).toBe(ANCHOR);
  });
});

/* ── 가드 ⑥ 위험 신호 대조 ─────────────────────────────── */

/**
 * 판정 규칙 엔진을 **재사용해서** 앵커 대비로 대조한다. 여기서 재는 것은 셋이다.
 *  ① 앵커에 없던 ⚑CF 신호가 새로 생기면 막는가
 *  ② 앵커가 이미 들고 있는 신호는 그대로 두는가 (그 요구를 거절하는 것이 그 장면의 과제다)
 *  ③ **그물의 실제 폭은 어디까지인가** — 규칙 사전 밖 표현은 지나간다. 이 사실을 검사로 못 박아
 *     두지 않으면 화면 문구가 조용히 가드보다 커진다.
 */
describe("가드 ⑥ (앵커에 없던 위험 신호)", () => {
  /** C02 보호자 앵커 — 그 자체로 ⚑CF 신호를 달고 있는 **정상 검수 대사**다. */
  const RESTRAINT_ANCHOR =
    "밤에 혼자 일어나시다 그런 거면, 침대에 묶어두든지 방문을 잠그든지 하세요. 그게 안전한 거 아니에요?";

  it("앵커에 없던 ⚑CF 신호가 새로 생기면 막는다", () => {
    const line = "집에 가야 해요. 우리 애기 밥 줘야 하는데, 약을 두 알 드리라던데.";
    const outcome = applyVaryGuards(JSON.stringify({ line }), ANCHOR, CHK_A01.type);
    expect(outcome.blocked).toBe("safety");
    expect(outcome.blockedDetail).toContain("두 알 드리");
    expect(outcome.varied).toBe(false);
    expect(outcome.text).toBe(ANCHOR);
  });

  it("앵커가 이미 들고 있는 신호는 막지 않는다 (억제를 요구하는 보호자 앵커를 죽이지 않는다)", () => {
    // 이 문장은 실제 C02 데이터의 보호자 대사다 — 데이터가 바뀌면 여기서 먼저 걸린다.
    const turn = CHK_C02.turns.find((item) => item.text === RESTRAINT_ANCHOR);
    expect(turn?.speaker).toBe("guardian");
    expect(checkCritical(RESTRAINT_ANCHOR, { scenarioType: CHK_C02.type }).cf).toBe(true);

    const line =
      "밤에 혼자 일어나시다 그런 거면 침대에 묶어두든가 방문을 잠가 두든가 하세요. 그게 안전한 거 아닙니까?";
    const outcome = applyVaryGuards(JSON.stringify({ line }), RESTRAINT_ANCHOR, CHK_C02.type);
    expect(outcome.blocked).toBeUndefined();
    expect(outcome.varied).toBe(true);
  });

  it("어르신의 하소연이라도 앵커에 없던 신호면 막는다 (아는 값이다 — 막히면 앵커가 선다)", () => {
    /* "왜 자꾸 붙잡아요"는 나무랄 말이 아니지만, 앵커에 없던 일(붙잡혔다)을 새로 만든 문장이다.
       가드를 좁히는 대신 이 값을 적어 둔다 — 막혀도 화면에는 검수 문장이 그대로 선다. */
    const line = "집에 가야 해요. 우리 애기 밥 줘야 하는데 왜 자꾸 붙잡아요, 정말.";
    const outcome = applyVaryGuards(JSON.stringify({ line }), ANCHOR, CHK_A01.type);
    expect(outcome.blocked).toBe("safety");
    expect(outcome.text).toBe(ANCHOR);
  });

  it("규칙 사전 밖 표현은 이 단을 지나간다 — 그물이지 벽이 아니다 (실측)", () => {
    /* 화면 문구(설정·AI 지도)가 이 폭을 넘어서지 않게 붙잡아 두는 검사다.
       사전은 적어 둔 활용형에만 닿는다 — engine/rules.ts가 항목으로 적어 둔 한계 그대로이고,
       판정 엔진은 여기서 넓히지 않는다(재사용만 한다). */
    const passes = ["혈압약을 더 드셔야 한대요", "인슐린 맞으라던데", "병원 가지 말고 그냥 누워 계시래요"];
    for (const tail of passes) {
      const line = `집에 가야 해요. 우리 애기 밥 줘야 하는데, ${tail}.`;
      const outcome = applyVaryGuards(JSON.stringify({ line }), ANCHOR, CHK_A01.type);
      expect(outcome.blocked, tail).toBeUndefined();
    }
    // 같은 뜻을 사전에 적힌 활용형으로 말하면 그대로 걸린다 — 사전이 도는 것 자체는 확인된다.
    for (const tail of ["혈압약을 더 드리라던데요", "인슐린을 놓으라던데"]) {
      const line = `집에 가야 해요. 우리 애기 밥 줘야 하는데, ${tail}.`;
      expect(applyVaryGuards(JSON.stringify({ line }), ANCHOR, CHK_A01.type).blocked, tail).toBe(
        "safety",
      );
    }
  });

  it("짧게 밀어 넣은 지시문은 그 앞의 길이 가드가 먼저 막는다", () => {
    /* 가드는 단마다 다른 것을 본다. 공격 문장이 그대로 오면 길이 비율에서 먼저 걸린다. */
    for (const line of [
      "약을 두 알 드리라던데",
      "혈압약을 더 드셔야 한대요",
      "인슐린 맞으라던데",
      "병원 가지 말고 그냥 누워 계시래요",
    ]) {
      expect(applyVaryGuards(JSON.stringify({ line }), ANCHOR, CHK_A01.type).blocked, line).toBe(
        "length",
      );
    }
  });

  it("막은 단 이름은 화면·점검이 같은 낱말을 본다", () => {
    expect(VARY_BLOCK_LABEL.safety).toBe("위험 신호 대조");
  });
});

/* ── 호출·폴백 ─────────────────────────────────────────── */

describe("requestLineVariation", () => {
  it("꺼져 있으면 부르지 않는다 (네트워크 호출 0건)", async () => {
    const { fetchImpl, calls } = fetchReturning(varyReply("다시 쓴 대사"));
    const outcome = await requestLineVariation(REQUEST, OFF, { fetchImpl });
    expect(calls).toHaveLength(0);
    expect(outcome.varied).toBe(false);
    expect(outcome.text).toBe(ANCHOR);
    expect(outcome.fallback).toBe("disabled");
  });

  it("같은 도메인 /api/coach만 부르고, 몸통에 학습자 발화 칸이 없다", async () => {
    const { fetchImpl, calls } = fetchReturning(varyReply(VARIED));
    const outcome = await requestLineVariation(REQUEST, ON, { fetchImpl });
    expect(outcome.varied).toBe(true);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(VARY_ENDPOINT);
    expect(VARY_ENDPOINT.startsWith("/")).toBe(true);
    expect((calls[0]?.init?.headers as Record<string, string>).Authorization).toBeUndefined();

    const body = JSON.parse(String(calls[0]?.init?.body)) as Record<string, unknown>;
    expect(body.task).toBe("vary");
    expect(body.anchor).toBe(ANCHOR);
    // 대사를 다시 쓰는 데 학습자의 말은 필요하지 않다 — 실을 칸 자체가 없다.
    expect(body.utterance).toBeUndefined();
    expect(body.model).toBeUndefined();
    expect(body.messages).toBeUndefined();
  });

  it("응답이 늦으면 앵커가 그대로 선다", async () => {
    const fetchImpl = ((_url: unknown, init?: RequestInit) =>
      new Promise<Response>((_resolve, rejectPromise) => {
        init?.signal?.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          rejectPromise(error);
        });
      })) as unknown as typeof fetch;

    const outcome = await requestLineVariation(REQUEST, ON, { fetchImpl, timeoutMs: 10 });
    expect(outcome.fallback).toBe("timeout");
    expect(outcome.varied).toBe(false);
    expect(outcome.text).toBe(ANCHOR);
  });

  it("서버 설정이 없거나·한도를 넘었거나·상류가 실패해도 앵커가 그대로 선다", async () => {
    for (const [body, reason] of [
      [{ status: "unconfigured" }, "config"],
      [{ status: "rate_limited" }, "rate_limited"],
      [{ status: "upstream" }, "http"],
      [{ unexpected: true }, "http"],
    ] as const) {
      const { fetchImpl } = fetchReturning(body);
      const outcome = await requestLineVariation(REQUEST, ON, { fetchImpl });
      expect(outcome.fallback, JSON.stringify(body)).toBe(reason);
      expect(outcome.text, JSON.stringify(body)).toBe(ANCHOR);
    }
  });

  it("연결이 끊기거나 오류 응답이 와도 앵커가 그대로 선다", async () => {
    const down = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    expect((await requestLineVariation(REQUEST, ON, { fetchImpl: down })).fallback).toBe("network");

    const bad = (async () => relayed({ status: "invalid" }, false)) as unknown as typeof fetch;
    const outcome = await requestLineVariation(REQUEST, ON, { fetchImpl: bad });
    expect(outcome.fallback).toBe("http");
    expect(outcome.text).toBe(ANCHOR);
  });
});

/* ── varyLine (화면이 부르는 자리) ─────────────────────── */

describe("varyLine", () => {
  beforeEach(() => {
    clearVariationCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearVariationCache();
  });

  it("응급 유형에서는 부르지 않는다 (네트워크 호출 0건)", async () => {
    const { fetchImpl, calls } = fetchReturning(varyReply("무엇이든"));
    const anchor = "숨이 막혀요.";
    const outcome = await varyLine(
      { scenario: CHK_B01, speaker: "elder", anchor, recentLines: [] },
      { fetchImpl, settings: ON },
    );
    expect(calls).toHaveLength(0);
    expect(outcome.text).toBe(anchor);
    expect(outcome.varied).toBe(false);
  });

  it("꺼져 있으면 부르지 않는다", async () => {
    const { fetchImpl, calls } = fetchReturning(varyReply("무엇이든"));
    const outcome = await varyLine(contextFor(ANCHOR), { fetchImpl, settings: OFF });
    expect(calls).toHaveLength(0);
    expect(outcome.text).toBe(ANCHOR);
  });

  it("오프라인이면 부르지 않는다 — 훈련은 회선 없이 끝까지 돈다", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const { fetchImpl, calls } = fetchReturning(varyReply("무엇이든"));
    const outcome = await varyLine(contextFor(ANCHOR), { fetchImpl, settings: ON });
    expect(calls).toHaveLength(0);
    expect(outcome.fallback).toBe("offline");
    expect(outcome.text).toBe(ANCHOR);
  });

  it("같은 앵커로 되돌아오면 받아 둔 문장을 다시 쓴다 (호출은 한 번뿐)", async () => {
    const varied = VARIED;
    const { fetchImpl, calls } = fetchReturning(varyReply(varied));

    const first = await varyLine(contextFor(ANCHOR), { fetchImpl, settings: ON });
    const second = await varyLine(contextFor(ANCHOR), { fetchImpl, settings: ON });

    expect(first.text).toBe(varied);
    expect(second.text).toBe(varied);
    expect(second.varied).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it("막힌 답은 보관하지 않는다 — 다음 방문에서 다시 청한다", async () => {
    const { fetchImpl, calls } = fetchReturning(varyReply("짧게"));
    await varyLine(contextFor(ANCHOR), { fetchImpl, settings: ON });
    await varyLine(contextFor(ANCHOR), { fetchImpl, settings: ON });
    expect(calls).toHaveLength(2);
  });
});

/* ── 서버 라우트 (/api/coach · task: "vary") ───────────── */

describe("/api/coach (task: vary)", () => {
  const KEY = "server-only-key-abcdefgh";
  let calls: Array<{ url: string; init: RequestInit | undefined }>;
  let ipSeed = 0;

  function stubUpstream(reply: () => Response): Array<{ url: string; init: RequestInit | undefined }> {
    const seen: Array<{ url: string; init: RequestInit | undefined }> = [];
    const impl = (async (url: unknown, init?: RequestInit) => {
      seen.push({ url: String(url), init });
      return reply();
    }) as unknown as typeof fetch;
    vi.stubGlobal("fetch", impl);
    return seen;
  }

  function upstreamReply(content: string): Response {
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content } }] }),
    } as unknown as Response;
  }

  /**
   * 검사마다 새 IP — 「같은 IP 분당 한도」에 서로 걸리지 않게 한다.
   *
   * 헤더 두 개(`origin`·`content-type`)는 브라우저가 붙여 주는 것이다. 라우트가 그 둘을 보고
   * 다른 출처의 요청을 403으로 끊으므로, 앱이 실제로 보내는 모양을 그대로 흉내 낸다.
   */
  function coachRequest(body: unknown, ip = `10.1.0.${(ipSeed += 1)}`): Request {
    return new Request("https://chimchak.invalid/api/coach", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        origin: "https://chimchak.invalid",
        "x-forwarded-for": ip,
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
  }

  function validBody(): Record<string, unknown> {
    const request = buildVaryRequest(contextFor(firstElderLine()));
    if (!request) throw new Error("변주 요청을 만들지 못했습니다");
    return { task: "vary", ...request };
  }

  beforeEach(() => {
    calls = stubUpstream(() => upstreamReply('{"line":"다시 쓴 대사입니다."}'));
    vi.stubEnv("COACH_BASE_URL", "https://coach.invalid/v1");
    vi.stubEnv("COACH_MODEL", "tiny-coach-1");
    vi.stubEnv("COACH_API_KEY", KEY);
    vi.stubEnv("COACH_DAILY_CAP", "600");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("설정이 없으면 상류를 부르지 않고 unconfigured를 돌려준다", async () => {
    vi.stubEnv("COACH_MODEL", "");
    const response = await POST(coachRequest(validBody()));
    expect(await response.json()).toEqual({ status: "unconfigured" });
    expect(calls).toHaveLength(0);
  });

  it("정상 요청은 상류 원문을 그대로 중계한다 (가드는 돌리지 않는다)", async () => {
    const response = await POST(coachRequest(validBody()));
    const body = (await response.json()) as { status: string; content: string };
    expect(body.status).toBe("ok");
    expect(body.content).toContain("다시 쓴 대사");
  });

  it("변주 프롬프트에는 인물과 앵커가 실리고, 생성 상한은 코칭보다 낮다", async () => {
    await POST(coachRequest(validBody()));
    const init = calls[0]?.init as RequestInit;
    const sent = JSON.parse(String(init.body)) as {
      model: string;
      max_tokens: number;
      messages: Array<{ role: string; content: string }>;
    };
    expect(sent.model).toBe("tiny-coach-1");
    expect(sent.max_tokens).toBeLessThanOrEqual(200);
    expect(sent.messages[0]?.content).toContain("연기");
    // 근거 문서 목록은 코칭의 것이다 — 대사를 다시 쓰는 자리에 들어갈 이유가 없다.
    expect(sent.messages[0]?.content).not.toContain("DOC-GUIDE-001");
    expect(sent.messages[1]?.content).toContain(firstElderLine());
  });

  it("기대 형태가 아니면 400으로 끊고 상류를 부르지 않는다", async () => {
    const cases: unknown[] = [
      { task: "vary" },
      { task: "vary", ...validBody(), anchor: "" },
      { task: "vary", ...validBody(), anchor: "가".repeat(VARY_ANCHOR_MAX + 1) },
      { task: "vary", ...validBody(), persona: "가".repeat(601) },
      { task: "vary", ...validBody(), recentLines: "배열이 아닙니다" },
      { task: "vary", ...validBody(), recentLines: ["한", "두", "세", "네"] },
      // 모르는 작업 이름은 조용히 코칭으로 처리하지 않는다.
      { ...validBody(), task: "translate" },
    ];
    for (const body of cases) {
      const response = await POST(coachRequest(body));
      expect(response.status, JSON.stringify(body)).toBe(400);
      expect(await response.json()).toEqual({ status: "invalid" });
    }
    expect(calls).toHaveLength(0);
  });

  it("아는 칸만 새로 조립해 보낸다 — 끼워 넣은 학습자 발화는 상류에 닿지 않는다", async () => {
    await POST(
      coachRequest({ ...validBody(), utterance: "제가 직접 말한 문장", model: "몰래-바꾼-모델" }),
    );
    const sent = String((calls[0]?.init as RequestInit).body);
    expect(sent).not.toContain("제가 직접 말한 문장");
    expect(sent).not.toContain("몰래-바꾼-모델");
  });

  it("한도 계수기는 코칭과 하나를 나눠 쓴다 (비용은 요청 수로 나간다)", async () => {
    const ip = "10.1.9.9";
    const limit = COACH_RATE_LIMITS.perIpPerMinute;
    const statuses: string[] = [];
    // 변주로 분당 몫을 다 쓰면, 같은 IP의 **코칭** 요청도 그 자리에서 막힌다.
    for (let i = 0; i < limit; i += 1) {
      const response = await POST(coachRequest(validBody(), ip));
      statuses.push(((await response.json()) as { status: string }).status);
    }
    expect(statuses).toEqual(Array(limit).fill("ok"));

    const cueTurn = CHK_A01.turns.find((turn) => turn.cue);
    if (!cueTurn?.cue) throw new Error("CHK-A01에 CUE가 있는 턴이 없습니다");
    const coaching = await POST(
      coachRequest(buildCoachRequest(CHK_A01, cueTurn.cue, "무슨 일이신지 여쭤봤습니다"), ip),
    );
    expect(await coaching.json()).toEqual({ status: "rate_limited" });
    expect(calls).toHaveLength(limit);
  });

  it("열려 있는 모든 시나리오의 어르신·보호자 대사가 검증을 지난다", async () => {
    /* 상한(앵커 400자·프로필 600자)이 실제 데이터보다 좁으면, 어느 날 변주가 조용히 400으로
       끊깁니다 — 화면에는 아무 표시도 나지 않는 고장입니다. */
    let checked = 0;
    for (const scenario of getActiveScenarios()) {
      if (scenario.type === "EMERGENCY") continue;
      for (const turn of scenario.turns) {
        if (!isVariableSpeaker(turn.speaker) || turn.text.trim().length === 0) continue;
        const request = buildVaryRequest({
          scenario,
          speaker: turn.speaker,
          anchor: turn.text,
          recentLines: [],
        });
        expect(request, `${scenario.id} ${turn.id}`).toBeDefined();
        const response = await POST(coachRequest({ task: "vary", ...request }));
        expect(((await response.json()) as { status: string }).status, turn.id).toBe("ok");
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});
