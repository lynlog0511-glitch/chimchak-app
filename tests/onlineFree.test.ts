/**
 * 자유 대화 연습 — src/lib/onlineFree.ts + src/app/api/coach/route.ts (`task: "free"`)
 *
 * 이 파일이 지키는 것은 다섯이다.
 *  ① **응급은 이 모드에 없다.** 유형 목록에 오르지 않는다는 사실을 데이터로 확인한다(L3 원칙).
 *  ② **생성문은 기기 안 가드를 지나야 화면에 닿는다.** 형식·길이·표현·위험 신호 넉 단이고,
 *    위험 신호는 앵커 대비가 아니라 **절대 기준**이다. 걸리면 한 번 더 청하고, 그래도 걸리면
 *    고정 대체 문구가 선다 — 걸린 문장이 화면에 서는 경우가 하나도 없어야 한다.
 *  ③ **학습자 발화는 보내기 전에 규칙 사전을 지난다.** ⚑CF면 대화를 멈추는 자리가 있어야 한다.
 *  ④ **꺼져 있거나 오프라인이면 네트워크 호출이 0건이다.**
 *  ⑤ **대화는 저장되지 않는다.** 저장소에 남는 것이 연습 횟수 한 칸뿐임을 몸통으로 잰다.
 *
 * 실제 네트워크 호출은 0건이다. fetch는 전부 주입한 가짜다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/coach/route";
import { CITABLE_DOC_IDS, NON_CITABLE_DOC_IDS } from "@/data/docs";
import { checkCritical } from "@/engine/rules";
import { BANNED_PHRASES, MODEL_IDENTITY_WORDS, findBannedExpression } from "@/lib/onlineCoach";
import {
  FREE_BLOCK_LABEL,
  FREE_ENDPOINT,
  FREE_FALLBACK_LINE,
  FREE_HINT_MAX,
  FREE_HISTORY_LINE_MAX,
  FREE_HISTORY_MAX_LINES,
  FREE_LINE_MAX,
  FREE_MAX_TURNS,
  FREE_PERSONA_MAX,
  FREE_PRACTICE_KEY,
  FREE_SEED_TYPES,
  FREE_SITUATION_MAX,
  FREE_SUMMARY_FAILED,
  FREE_SUMMARY_MAX,
  applyLineGuards,
  applySetupGuards,
  applySummaryGuards,
  buildHistory,
  buildReplyRequest,
  buildSetupRequest,
  buildSummaryRequest,
  bumpPracticeCount,
  checkLearnerUtterance,
  readPracticeCount,
  requestFreeLine,
  requestFreeSetup,
  requestFreeSummary,
  seedLine,
  type FreeSceneContext,
  type FreeSeed,
} from "@/lib/onlineFree";
import type { OnlineCoachingSettings } from "@/lib/settings";

/* ── 도구 ──────────────────────────────────────────────── */

const ON: OnlineCoachingSettings = { enabled: true };
const OFF: OnlineCoachingSettings = { enabled: false };

const SEED: FreeSeed = { type: "BPSD", level: 2, hint: "목욕을 거부하십니다" };

const SITUATION =
  "저녁 목욕 시간입니다. 박 어르신께서 욕실 앞에서 걸음을 멈추고 팔짱을 끼신 채 서 계십니다.";
const PERSONA = "박 어르신 — 80대, 씻는 일이 부끄럽고 번거로워 마음이 굳어 계십니다.";

const SCENE: FreeSceneContext = {
  seed: SEED,
  situation: SITUATION,
  persona: PERSONA,
  turns: [
    { speaker: "learner", text: "어르신, 오늘은 물만 잠깐 묻히고 나오실까요?" },
    { speaker: "character", text: "싫다니까. 나 안 씻어." },
  ],
};

/** 가드 넉 단을 모두 지나는 기준 대사 */
const GOOD_LINE = "싫다고 했잖아요. 오늘은 그냥 두세요.";

/** `/api/coach`가 돌려주는 몸통 한 벌을 흉내 낸다. */
function relayed(body: Record<string, unknown>, ok = true): Response {
  return { ok, json: async () => body } as unknown as Response;
}

/** 정해진 몸통들을 차례로 돌려주는 가짜 fetch (마지막 값은 계속 반복한다) */
function fetchSequence(bodies: Array<Record<string, unknown>>): {
  fetchImpl: typeof fetch;
  calls: Array<{ url: string; init: RequestInit | undefined }>;
} {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const fetchImpl = (async (url: unknown, init?: RequestInit) => {
    const body = bodies[Math.min(calls.length, bodies.length - 1)] ?? {};
    calls.push({ url: String(url), init });
    return relayed(body);
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

const reply = (payload: Record<string, unknown>): Record<string, unknown> => ({
  status: "ok",
  content: JSON.stringify(payload),
});

/** 길이만 재는 문장 한 줄 (숫자도 금지 표현도 들어 있지 않다) */
function filler(length: number): string {
  return "가".repeat(Math.max(0, length));
}

/* ── 유형 목록 ─────────────────────────────────────────── */

describe("연습 유형", () => {
  it("응급은 목록에 아예 없다 (L3 원칙 — 실시간 응급을 즉흥에 맡기지 않는다)", () => {
    const values = FREE_SEED_TYPES.map((item) => item.value);
    expect(values).toContain("BPSD");
    expect(values).toContain("CONFLICT");
    expect(values).not.toContain("EMERGENCY");
    expect(values).not.toContain("RISK");
  });

  it("시드는 유형·난이도·적어 주신 한 줄을 한 줄로 편다", () => {
    expect(seedLine(SEED)).toBe("치매 행동 · 중급 — 목욕을 거부하십니다");
    expect(seedLine({ ...SEED, hint: "   " })).toBe("치매 행동 · 중급");
  });

  it("고정 대체 문구 자체가 가드에 걸리지 않는다 (걸리면 대체가 대체를 부른다)", () => {
    expect(checkCritical(FREE_FALLBACK_LINE).cf).toBe(false);
    expect(findBannedExpression(FREE_FALLBACK_LINE)).toBeUndefined();
    expect(FREE_FALLBACK_LINE.length).toBeLessThanOrEqual(FREE_LINE_MAX);
  });
});

/* ── 요청 몸통 ─────────────────────────────────────────── */

describe("요청 몸통", () => {
  it("상황 만들기 요청에는 시드 한 줄만 담긴다 (아직 상황도 인물도 없다)", () => {
    const request = buildSetupRequest(SEED);
    expect(request).toEqual({ stage: "setup", seed: "치매 행동 · 중급 — 목욕을 거부하십니다" });
  });

  it("대사 요청에는 상황·인물·대화가 담긴다", () => {
    const request = buildReplyRequest(SCENE);
    expect(request.stage).toBe("reply");
    expect(request.situation).toBe(SITUATION);
    expect(request.persona).toBe(PERSONA);
    expect(request.history).toEqual([
      "학습자: 어르신, 오늘은 물만 잠깐 묻히고 나오실까요?",
      "인물: 싫다니까. 나 안 씻어.",
    ]);
    // 근거 문서 목록은 마무리 요약에만 나간다 — 대사를 만드는 자리에 들어갈 이유가 없다.
    expect((request as { docs?: unknown }).docs).toBeUndefined();
  });

  it("마무리 요약 요청에만 인용 가능 문서 목록이 붙는다", () => {
    const request = buildSummaryRequest(SCENE);
    expect(request.stage).toBe("summary");
    expect(request.docs.map((doc) => doc.id).sort()).toEqual([...CITABLE_DOC_IDS].sort());
    // 인용 금지 문서는 애초에 목록에 없다.
    for (const id of NON_CITABLE_DOC_IDS) {
      expect(request.docs.map((doc) => doc.id)).not.toContain(id);
    }
  });

  it("학습자 발화는 가명처리를 지나 나간다 (인물 대사는 그대로다)", () => {
    const history = buildHistory([
      { speaker: "learner", text: "010-1234-5678로 연락드릴게요" },
      { speaker: "character", text: "010은 무슨 010이야." },
    ]);
    expect(history[0]).toBe("학습자: [번호]로 연락드릴게요");
    expect(history[0]).not.toContain("1234");
    // 인물 대사는 이미 밖에서 만들어져 온 문장이라 가리지 않는다.
    expect(history[1]).toContain("010");
  });

  it("「상황 만들기」 한 줄도 가명처리를 지나 나간다 (세 요청 모두 같은 시드 한 줄을 쓴다)", () => {
    const seed: FreeSeed = { ...SEED, hint: "010-1234-5678로 연락 오십니다" };
    const scene: FreeSceneContext = { ...SCENE, seed };
    const requests = [buildSetupRequest(seed), buildReplyRequest(scene), buildSummaryRequest(scene)];
    for (const request of requests) {
      expect(request.seed).toContain("[번호]");
      expect(request.seed).not.toContain("1234");
    }
  });

  it("시드 한 줄은 **가리고 나서** 자른다 (먼저 자르면 이름이 경계에서 토막 나 규칙이 놓친다)", () => {
    // 자르기가 먼저면 번호가 상한 자리에서 반토막 나 「1234」가 그대로 실려 나간다.
    const hint = `${filler(FREE_HINT_MAX - 8)}010-1234-5678`;
    const line = seedLine({ ...SEED, hint });
    expect(line).toContain("[번호]");
    expect(line).not.toContain("1234");
  });

  it("대화가 길어져도 마지막 몇 줄만 나가고, 한 줄 길이도 상한을 넘지 않는다", () => {
    const turns = Array.from({ length: FREE_HISTORY_MAX_LINES + 6 }, (_, index) => ({
      speaker: (index % 2 === 0 ? "learner" : "character") as "learner" | "character",
      text: `${index}번째 말 ${filler(FREE_HISTORY_LINE_MAX)}`,
    }));
    const history = buildHistory(turns);
    expect(history).toHaveLength(FREE_HISTORY_MAX_LINES);
    for (const line of history) {
      expect(line.length).toBeLessThanOrEqual(FREE_HISTORY_LINE_MAX);
    }
  });

  it("최대 차례는 열두 번이다", () => {
    expect(FREE_MAX_TURNS).toBe(12);
  });
});

/* ── 가드: 상황·인물 ───────────────────────────────────── */

describe("가드 — 상황 지문·인물 소개", () => {
  const good = JSON.stringify({ situation: SITUATION, persona: PERSONA });

  it("정상 생성문은 통과한다", () => {
    const outcome = applySetupGuards(good, "BPSD");
    expect(outcome.status).toBe("ok");
    expect(outcome.situation).toBe(SITUATION);
    expect(outcome.persona).toBe(PERSONA);
  });

  it("① JSON이 깨지거나 칸이 비면 막는다", () => {
    expect(applySetupGuards("상황입니다", "BPSD").blocked).toBe("format");
    expect(applySetupGuards('{"situation":"있음"}', "BPSD").blocked).toBe("format");
    expect(applySetupGuards('{"situation":"  ","persona":"있음"}', "BPSD").blocked).toBe("format");
  });

  it("② 길이 상한을 넘으면 막는다", () => {
    const long = JSON.stringify({
      situation: filler(FREE_SITUATION_MAX + 1),
      persona: PERSONA,
    });
    expect(applySetupGuards(long, "BPSD").blocked).toBe("length");

    const longPersona = JSON.stringify({
      situation: SITUATION,
      persona: filler(FREE_PERSONA_MAX + 1),
    });
    expect(applySetupGuards(longPersona, "BPSD").blocked).toBe("length");
  });

  it("③ 금지 표현 8종과 모델 정체어는 하나도 통과하지 못한다", () => {
    for (const phrase of [...BANNED_PHRASES, ...MODEL_IDENTITY_WORDS]) {
      const raw = JSON.stringify({ situation: `${SITUATION} ${phrase}`, persona: PERSONA });
      expect(applySetupGuards(raw, "BPSD").blocked, phrase).toBe("phrase");
    }
  });

  it("④ ⚑CF 신호가 붙은 장면을 만들어 오면 막는다 (절대 기준 — 대조할 앵커가 없다)", () => {
    const raw = JSON.stringify({
      situation: "박 어르신이 자꾸 나가려 하셔서 현관문을 잠가 두었습니다.",
      persona: PERSONA,
    });
    const outcome = applySetupGuards(raw, "BPSD");
    expect(outcome.blocked).toBe("safety");
    expect(outcome.situation).toBe("");
  });

  it("막은 단 이름은 화면·점검이 같은 낱말을 본다", () => {
    expect(FREE_BLOCK_LABEL.safety).toBe("위험 신호 대조");
    expect(FREE_BLOCK_LABEL.evidence).toBe("근거 가드");
  });
});

/* ── 가드: 인물 대사 ───────────────────────────────────── */

describe("가드 — 인물 대사", () => {
  it("정상 대사는 통과한다", () => {
    const outcome = applyLineGuards(JSON.stringify({ line: GOOD_LINE }), "BPSD");
    expect(outcome.status).toBe("ok");
    expect(outcome.text).toBe(GOOD_LINE);
  });

  it("막히면 어느 단에서든 고정 대체 문구가 선다 (걸린 문장은 화면에 서지 않는다)", () => {
    const cases: Array<[string, string]> = [
      ["대사입니다", "format"],
      [JSON.stringify({ line: filler(FREE_LINE_MAX + 1) }), "length"],
      [JSON.stringify({ line: "그거 먹으면 증상 완화된다던데." }), "phrase"],
      [JSON.stringify({ line: "저는 인공지능이라 잘 모르겠네요." }), "phrase"],
    ];
    for (const [raw, blocked] of cases) {
      const outcome = applyLineGuards(raw, "BPSD");
      expect(outcome.blocked, raw).toBe(blocked);
      expect(outcome.status, raw).toBe("replaced");
      expect(outcome.text, raw).toBe(FREE_FALLBACK_LINE);
    }
  });

  it("④ 인물 입에서 ⚑CF 신호가 나오면 막는다", () => {
    const outcome = applyLineGuards(
      JSON.stringify({ line: "아까 약을 두 알 드리라던데, 그거나 갖다 줘요." }),
      "BPSD",
    );
    expect(outcome.blocked).toBe("safety");
    expect(outcome.text).toBe(FREE_FALLBACK_LINE);
  });
});

/* ── 가드: 마무리 요약 ─────────────────────────────────── */

describe("가드 — 마무리 요약", () => {
  const citable = CITABLE_DOC_IDS[0];

  it("근거를 지난 요약만 화면에 닿는다", () => {
    const raw = JSON.stringify({
      summary: "먼저 이유를 여쭤보신 대목이 좋았습니다. 다음에는 한 가지만 제안해 보십시오.",
      docId: citable,
    });
    const outcome = applySummaryGuards(raw);
    expect(outcome.status).toBe("ok");
    expect(outcome.docId).toBe(citable);
  });

  it("근거를 달지 않은 요약은 막지 않는다 (인용 자체가 없다)", () => {
    const raw = JSON.stringify({ summary: "말문을 여신 것만으로 충분합니다.", docId: null });
    const outcome = applySummaryGuards(raw);
    expect(outcome.status).toBe("ok");
    expect(outcome.docId).toBeUndefined();
  });

  it("목록 밖 문서를 근거로 들면 요약 전체를 버린다 (L2 원칙)", () => {
    const raw = JSON.stringify({ summary: "좋았습니다.", docId: "DOC-없는것-999" });
    const outcome = applySummaryGuards(raw);
    expect(outcome.blocked).toBe("evidence");
    expect(outcome.message).toBe(FREE_SUMMARY_FAILED);
  });

  it("인용 금지 문서도 막힌다", () => {
    for (const id of NON_CITABLE_DOC_IDS) {
      const raw = JSON.stringify({ summary: "좋았습니다.", docId: id });
      expect(applySummaryGuards(raw).blocked, id).toBe("evidence");
    }
  });

  it("형식·표현·길이에서 막혀도 지어내지 않고 못 만들었다고 적는다", () => {
    expect(applySummaryGuards("요약입니다").message).toBe(FREE_SUMMARY_FAILED);
    expect(
      applySummaryGuards(JSON.stringify({ summary: "임상적으로 검증된 방법입니다." })).blocked,
    ).toBe("phrase");
    expect(
      applySummaryGuards(JSON.stringify({ summary: filler(FREE_SUMMARY_MAX + 1) })).blocked,
    ).toBe("length");
  });
});

/* ── 학습자 발화의 ⚑CF ────────────────────────────────── */

describe("학습자 발화 — 멈추는 자리", () => {
  it("⚑CF면 멈춘다 (전역 사전 · 유형 맥락만 넘긴다)", () => {
    const check = checkLearnerUtterance("문을 잠그겠습니다", "BPSD");
    expect(check.cf).toBe(true);
    expect(check.ruleId).toBeDefined();
    // 시트가 세울 것들 — 왜 멈췄는지와 대신 할 수 있는 말.
    expect((check.reason ?? "").length).toBeGreaterThan(0);
    expect((check.alternatives ?? []).length).toBeGreaterThan(0);
  });

  it("부정 표현은 멈추지 않는다 (규칙 엔진을 그대로 재사용한다)", () => {
    expect(checkLearnerUtterance("문을 잠그지 않겠습니다", "BPSD").cf).toBe(false);
    expect(checkLearnerUtterance("무슨 일이신지 여쭤보겠습니다", "BPSD").cf).toBe(false);
  });

  it("⚑CF에 걸린 말은 요청으로 나가지 않는다 (부르는 자리 앞에서 걸린다)", async () => {
    /* 화면(PracticeClient)은 `checkLearnerUtterance`가 참이면 요청을 만들지 않는다.
       그 순서를 여기서 데이터로 못 박아 둔다 — 걸린 발화는 요청 몸통에 실릴 일이 없다. */
    const utterance = "문을 잠그겠습니다";
    expect(checkLearnerUtterance(utterance, "BPSD").cf).toBe(true);

    const { fetchImpl, calls } = fetchSequence([reply({ line: GOOD_LINE })]);
    // 걸리지 않은 발화만 대화에 쌓여 요청이 된다.
    const request = buildReplyRequest(SCENE);
    await requestFreeLine(request, ON, "BPSD", { fetchImpl });
    const body = JSON.parse(String(calls[0]?.init?.body)) as { history: string[] };
    expect(body.history.join(" ")).not.toContain(utterance);
  });
});

/* ── 재시도와 대체 문구 ────────────────────────────────── */

describe("재시도 — 안전 대조에 걸렸을 때", () => {
  const cfLine = reply({ line: "아까 약을 두 알 드리라던데, 그거나 갖다 줘요." });

  it("한 번 더 청해서 통과하면 그 문장을 쓴다 (호출 두 번)", async () => {
    const { fetchImpl, calls } = fetchSequence([cfLine, reply({ line: GOOD_LINE })]);
    const outcome = await requestFreeLine(buildReplyRequest(SCENE), ON, "BPSD", { fetchImpl });
    expect(calls).toHaveLength(2);
    expect(outcome.status).toBe("ok");
    expect(outcome.text).toBe(GOOD_LINE);
    expect(outcome.retried).toBe(true);
  });

  it("두 번 다 걸리면 고정 대체 문구가 선다 (세 번째로 청하지 않는다)", async () => {
    const { fetchImpl, calls } = fetchSequence([cfLine]);
    const outcome = await requestFreeLine(buildReplyRequest(SCENE), ON, "BPSD", { fetchImpl });
    expect(calls).toHaveLength(2);
    expect(outcome.status).toBe("replaced");
    expect(outcome.text).toBe(FREE_FALLBACK_LINE);
    expect(outcome.blocked).toBe("safety");
    expect(outcome.retried).toBe(true);
  });

  it("안전이 아닌 단에서 막히면 다시 청하지 않는다 (같은 값이 돌아오고 값만 두 번 든다)", async () => {
    const { fetchImpl, calls } = fetchSequence([reply({ line: filler(FREE_LINE_MAX + 1) })]);
    const outcome = await requestFreeLine(buildReplyRequest(SCENE), ON, "BPSD", { fetchImpl });
    expect(calls).toHaveLength(1);
    expect(outcome.blocked).toBe("length");
    expect(outcome.text).toBe(FREE_FALLBACK_LINE);
  });

  it("상황 만들기도 같은 규칙이다 — 두 번 걸리면 장면을 세우지 않는다", async () => {
    const cfSetup = reply({
      situation: "박 어르신이 자꾸 나가려 하셔서 현관문을 잠가 두었습니다.",
      persona: PERSONA,
    });
    const { fetchImpl, calls } = fetchSequence([cfSetup]);
    const outcome = await requestFreeSetup(buildSetupRequest(SEED), ON, "BPSD", { fetchImpl });
    expect(calls).toHaveLength(2);
    expect(outcome.status).toBe("blocked");
    expect(outcome.blocked).toBe("safety");
    // 고정 장면을 대신 세우지 않는다 — 그 자리는 검수된 시나리오 여섯 종이 맡는다.
    expect(outcome.situation).toBe("");
    expect(outcome.persona).toBe("");
  });
});

/* ── 부르지 않는 자리 ──────────────────────────────────── */

describe("부르지 않는 자리 (네트워크 호출 0건)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("온라인 모드가 꺼져 있으면 세 요청 모두 부르지 않는다", async () => {
    const { fetchImpl, calls } = fetchSequence([reply({ line: GOOD_LINE })]);

    const setup = await requestFreeSetup(buildSetupRequest(SEED), OFF, "BPSD", { fetchImpl });
    const line = await requestFreeLine(buildReplyRequest(SCENE), OFF, "BPSD", { fetchImpl });
    const summary = await requestFreeSummary(buildSummaryRequest(SCENE), OFF, { fetchImpl });

    expect(calls).toHaveLength(0);
    expect(setup.fallback).toBe("disabled");
    expect(line.fallback).toBe("disabled");
    expect(summary.fallback).toBe("disabled");
    // 받지 못한 대사는 말풍선을 만들지 않는다 — 빈 문자열이다.
    expect(line.text).toBe("");
    expect(summary.message).toBe(FREE_SUMMARY_FAILED);
  });

  it("오프라인이면 부르지 않는다 (대화 도중 회선이 끊긴 자리도 같다)", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const { fetchImpl, calls } = fetchSequence([reply({ line: GOOD_LINE })]);
    const outcome = await requestFreeLine(buildReplyRequest(SCENE), ON, "BPSD", { fetchImpl });
    expect(calls).toHaveLength(0);
    expect(outcome.fallback).toBe("offline");
    expect(outcome.text).toBe("");
  });

  it("서버에 상류 설정이 없으면 한 번 부르고 조용히 물러선다", async () => {
    const { fetchImpl, calls } = fetchSequence([{ status: "unconfigured" }]);
    const outcome = await requestFreeSetup(buildSetupRequest(SEED), ON, "BPSD", { fetchImpl });
    expect(calls).toHaveLength(1);
    expect(outcome.fallback).toBe("config");
    expect(outcome.status).toBe("fallback");
  });

  it("한도·상류 실패·낯선 모양도 화면을 표류시키지 않는다", async () => {
    for (const [body, reason] of [
      [{ status: "rate_limited" }, "rate_limited"],
      [{ status: "upstream" }, "http"],
      [{ unexpected: true }, "http"],
    ] as const) {
      const { fetchImpl } = fetchSequence([body]);
      const outcome = await requestFreeLine(buildReplyRequest(SCENE), ON, "BPSD", { fetchImpl });
      expect(outcome.fallback, JSON.stringify(body)).toBe(reason);
      expect(outcome.text, JSON.stringify(body)).toBe("");
    }
  });

  it("응답이 늦으면 조용히 물러선다", async () => {
    const fetchImpl = ((_url: unknown, init?: RequestInit) =>
      new Promise<Response>((_resolve, rejectPromise) => {
        init?.signal?.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          rejectPromise(error);
        });
      })) as unknown as typeof fetch;
    const outcome = await requestFreeLine(buildReplyRequest(SCENE), ON, "BPSD", {
      fetchImpl,
      timeoutMs: 10,
    });
    expect(outcome.fallback).toBe("timeout");
  });

  it("같은 도메인 한 곳만 부르고, 키를 붙이지 않는다", async () => {
    const { fetchImpl, calls } = fetchSequence([reply({ line: GOOD_LINE })]);
    await requestFreeLine(buildReplyRequest(SCENE), ON, "BPSD", { fetchImpl });
    expect(calls[0]?.url).toBe(FREE_ENDPOINT);
    expect(FREE_ENDPOINT.startsWith("/")).toBe(true);
    expect((calls[0]?.init?.headers as Record<string, string>).Authorization).toBeUndefined();

    const body = JSON.parse(String(calls[0]?.init?.body)) as Record<string, unknown>;
    expect(body.task).toBe("free");
    expect(body.stage).toBe("reply");
    expect(body.model).toBeUndefined();
    expect(body.messages).toBeUndefined();
  });
});

/* ── 저장 (대화는 남지 않는다) ─────────────────────────── */

describe("저장 — 남는 것은 연습 횟수 한 칸뿐", () => {
  class MemoryStorage {
    map = new Map<string, string>();
    get length(): number {
      return this.map.size;
    }
    key(index: number): string | null {
      return [...this.map.keys()][index] ?? null;
    }
    getItem(key: string): string | null {
      return this.map.get(key) ?? null;
    }
    setItem(key: string, value: string): void {
      this.map.set(key, value);
    }
    removeItem(key: string): void {
      this.map.delete(key);
    }
    clear(): void {
      this.map.clear();
    }
  }

  let store: MemoryStorage;

  beforeEach(() => {
    store = new MemoryStorage();
    (globalThis as { window?: unknown }).window = { localStorage: store };
  });

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it("세어 두는 것은 횟수뿐이고, 열쇠는 세션 기록과 다르다", () => {
    expect(readPracticeCount()).toBe(0);
    expect(bumpPracticeCount()).toBe(1);
    expect(bumpPracticeCount()).toBe(2);
    expect(readPracticeCount()).toBe(2);

    expect([...store.map.keys()]).toEqual([FREE_PRACTICE_KEY]);
    expect(FREE_PRACTICE_KEY).toBe("chimchak.practice.v1");
    // 성장 기록·이수 확인서가 읽는 열쇠와 겹치지 않는다.
    expect(FREE_PRACTICE_KEY).not.toBe("chimchak.sessions.v1");
    expect(JSON.parse(store.getItem(FREE_PRACTICE_KEY) ?? "{}")).toEqual({ count: 2 });
  });

  it("대화 어느 조각도 저장소에 닿지 않는다", () => {
    bumpPracticeCount();
    const dump = JSON.stringify([...store.map.entries()]);
    for (const fragment of [
      SITUATION,
      PERSONA,
      GOOD_LINE,
      "목욕을 거부",
      "어르신, 오늘은 물만",
    ]) {
      expect(dump, fragment).not.toContain(fragment);
    }
  });

  it("손상된 값이 들어 있어도 0으로 읽는다", () => {
    store.setItem(FREE_PRACTICE_KEY, "{{{");
    expect(readPracticeCount()).toBe(0);
    store.setItem(FREE_PRACTICE_KEY, JSON.stringify({ count: -3 }));
    expect(readPracticeCount()).toBe(0);
  });
});

/* ── 서버 라우트 (/api/coach · task: "free") ───────────── */

describe("/api/coach (task: free)", () => {
  let calls: Array<{ url: string; init: RequestInit | undefined }>;
  let ipSeed = 0;

  function stubUpstream(content: string): Array<{ url: string; init: RequestInit | undefined }> {
    const seen: Array<{ url: string; init: RequestInit | undefined }> = [];
    const impl = (async (url: unknown, init?: RequestInit) => {
      seen.push({ url: String(url), init });
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content } }] }),
      } as unknown as Response;
    }) as unknown as typeof fetch;
    vi.stubGlobal("fetch", impl);
    return seen;
  }

  /** 검사마다 새 IP — 「같은 IP 분당 6회」에 서로 걸리지 않게 한다. */
  function freeRequest(body: unknown, ip = `10.2.0.${(ipSeed += 1)}`): Request {
    return new Request("https://chimchak.invalid/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
  }

  function sentBody(): {
    model: string;
    max_tokens: number;
    temperature: number;
    messages: Array<{ role: string; content: string }>;
  } {
    return JSON.parse(String((calls[0]?.init as RequestInit).body));
  }

  beforeEach(() => {
    calls = stubUpstream('{"line":"싫다니까."}');
    vi.stubEnv("COACH_BASE_URL", "https://coach.invalid/v1");
    vi.stubEnv("COACH_MODEL", "tiny-coach-1");
    vi.stubEnv("COACH_API_KEY", "server-only-key-abcdefgh");
    vi.stubEnv("COACH_DAILY_CAP", "600");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("설정이 없으면 상류를 부르지 않고 unconfigured를 돌려준다", async () => {
    vi.stubEnv("COACH_MODEL", "");
    const response = await POST(freeRequest({ task: "free", ...buildSetupRequest(SEED) }));
    expect(await response.json()).toEqual({ status: "unconfigured" });
    expect(calls).toHaveLength(0);
  });

  it("상황 만들기 — 시드가 실리고 생성 상한이 가장 넉넉하다", async () => {
    await POST(freeRequest({ task: "free", ...buildSetupRequest(SEED) }));
    const sent = sentBody();
    expect(sent.model).toBe("tiny-coach-1");
    expect(sent.max_tokens).toBe(400);
    expect(sent.messages[0]?.content).toContain("상황 작가");
    expect(sent.messages[1]?.content).toContain("목욕을 거부하십니다");
    // 근거 문서 목록은 이 단계에 들어갈 이유가 없다.
    expect(sent.messages[0]?.content).not.toContain(CITABLE_DOC_IDS[0] ?? "DOC-");
  });

  it("대사 — 상황·인물·대화가 실리고 생성 상한은 변주와 같은 크기다", async () => {
    await POST(freeRequest({ task: "free", ...buildReplyRequest(SCENE) }));
    const sent = sentBody();
    expect(sent.max_tokens).toBe(200);
    expect(sent.messages[0]?.content).toContain("연기");
    expect(sent.messages[1]?.content).toContain(SITUATION);
    expect(sent.messages[1]?.content).toContain("싫다니까");
  });

  it("마무리 요약 — 인용 가능 문서 목록이 실리고 온도가 내려간다", async () => {
    await POST(freeRequest({ task: "free", ...buildSummaryRequest(SCENE) }));
    const sent = sentBody();
    expect(sent.max_tokens).toBe(300);
    expect(sent.temperature).toBeLessThanOrEqual(0.2);
    expect(sent.messages[0]?.content).toContain(CITABLE_DOC_IDS[0] ?? "DOC-");
    expect(sent.messages[0]?.content).toContain("채점하지 않습니다");
  });

  it("기대 형태가 아니면 400으로 끊고 상류를 부르지 않는다", async () => {
    const reply2 = buildReplyRequest(SCENE);
    const cases: unknown[] = [
      { task: "free" },
      { task: "free", stage: "setup" },
      { task: "free", stage: "옆길", seed: "치매 행동" },
      { task: "free", ...reply2, situation: "" },
      { task: "free", ...reply2, persona: filler(FREE_PERSONA_MAX + 1) },
      { task: "free", ...reply2, history: "배열이 아닙니다" },
      {
        task: "free",
        ...reply2,
        history: Array.from({ length: FREE_HISTORY_MAX_LINES + 1 }, () => "한 줄"),
      },
      { task: "free", ...reply2, history: [filler(FREE_HISTORY_LINE_MAX + 1)] },
      { task: "free", ...buildSummaryRequest(SCENE), docs: "목록이 아닙니다" },
    ];
    for (const body of cases) {
      const response = await POST(freeRequest(body));
      expect(response.status, JSON.stringify(body).slice(0, 80)).toBe(400);
      expect(await response.json()).toEqual({ status: "invalid" });
    }
    expect(calls).toHaveLength(0);
  });

  it("아는 칸만 새로 조립해 보낸다 — 끼워 넣은 값은 상류에 닿지 않는다", async () => {
    await POST(
      freeRequest({
        task: "free",
        ...buildReplyRequest(SCENE),
        utterance: "몰래-끼운-발화",
        model: "몰래-바꾼-모델",
        docs: [{ id: "DOC-몰래", title: "몰래 넣은 문서" }],
      }),
    );
    const raw = String((calls[0]?.init as RequestInit).body);
    expect(raw).not.toContain("몰래-끼운-발화");
    expect(raw).not.toContain("몰래-바꾼-모델");
    expect(raw).not.toContain("몰래 넣은 문서");
  });

  it("한도 계수기는 코칭·변주와 하나를 나눠 쓴다 (비용은 요청 수로 나간다)", async () => {
    const ip = "10.2.9.9";
    const statuses: string[] = [];
    for (let i = 0; i < 15; i += 1) {
      const response = await POST(freeRequest({ task: "free", ...buildReplyRequest(SCENE) }, ip));
      statuses.push(((await response.json()) as { status: string }).status);
    }
    expect(statuses).toEqual(Array(15).fill("ok"));

    const sixteenth = await POST(freeRequest({ task: "free", ...buildSetupRequest(SEED) }, ip));
    expect(await sixteenth.json()).toEqual({ status: "rate_limited" });
    expect(calls).toHaveLength(15);
  });

  it("긴 대화도 몸통 상한에 걸리지 않는다 (걸리면 화면에 표시 없는 고장이 된다)", async () => {
    /* 자유 연습에는 대화 이력이 통째로 실린다. 최대치를 실제로 한 번 통과시켜 둔다. */
    const turns = Array.from({ length: FREE_HISTORY_MAX_LINES }, (_, index) => ({
      speaker: (index % 2 === 0 ? "learner" : "character") as "learner" | "character",
      text: filler(FREE_HISTORY_LINE_MAX - 8),
    }));
    const body = {
      task: "free",
      ...buildSummaryRequest({ ...SCENE, turns }),
    };
    expect(JSON.stringify(body).length).toBeGreaterThan(8_192);
    const response = await POST(freeRequest(body));
    expect(((await response.json()) as { status: string }).status).toBe("ok");
  });

  it("코칭·변주의 몸통 상한은 예전 그대로다 (계약 불변)", async () => {
    const oversized = { task: "vary", filler: filler(9_000) };
    const response = await POST(freeRequest(oversized));
    expect(response.status).toBe(400);
    expect(calls).toHaveLength(0);
  });
});
