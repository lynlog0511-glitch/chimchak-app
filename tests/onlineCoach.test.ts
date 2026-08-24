/**
 * 온라인 코칭 — src/lib/onlineCoach.ts + src/app/api/coach/route.ts
 *
 * 이 파일이 지키는 것은 둘이다.
 *  ① **밖에서 받아 온 문장은 가드 넉 단을 지나기 전에는 화면에 닿지 못한다.** 기획서가
 *    「가짜 근거 72% → 0%」로 적은 장치가 그 가드이고, 여기서 네 단을 하나씩 때려 본다.
 *    서버를 하나 세운 뒤에도 이 네 단은 **기기 안에서** 돈다 — 그 사실도 함께 잰다.
 *  ② **브라우저가 부르는 곳은 같은 도메인 `/api/coach` 하나다.** 주소·모델 이름·키가 화면
 *    코드에 없다는 사실이 이 전환의 전부라, 보낸 자리와 보낸 몸통을 그대로 확인한다.
 *
 * 실제 네트워크 호출은 0건이다. fetch는 전부 주입한 가짜다 —
 * 오프라인 시연 준비와 같은 원칙으로, 회귀 검사도 회선 없이 끝까지 돈다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NO_SOURCE_MESSAGE } from "@/data/docs";
import { CHK_A01 } from "@/data/scenarios/chk-a01";
import { getActiveScenarios } from "@/data/scenarios";
import { POST } from "@/app/api/coach/route";
import {
  BANNED_PHRASES,
  COACHING_MAX_LENGTH,
  COACH_ENDPOINT,
  MODEL_IDENTITY_WORDS,
  applyGuards,
  buildCoachRequest,
  chatCompletionsUrl,
  citableDocRefs,
  findBannedExpression,
  readChatCompletionContent,
  requestOnlineCoaching,
  type OnlineCoachRequest,
} from "@/lib/onlineCoach";
import type { OnlineCoachingSettings } from "@/lib/settings";
import type { CueDef } from "@/types";

/* ── 도구 ──────────────────────────────────────────────── */

/** 설정에 남은 것은 스위치 하나뿐이다 — 주소도 모델 이름도 키도 여기 없다. */
const CONFIG: OnlineCoachingSettings = { enabled: true };

const REQUEST: OnlineCoachRequest = {
  scenarioSummary: "현관 앞 귀가 요구",
  cuePrompt: "첫 응답 — 무엇이라고 말하시겠습니까?",
  utterance: "무슨 일이 있으셨는지 여쭤봤습니다",
  indicators: ["RE-01 — 감정을 먼저 받아 준다"],
  docs: citableDocRefs(),
};

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

/** 상류(chat-completions)가 돌려주는 몸통 한 벌 — 라우트 검사에서만 쓴다. */
function upstreamReply(content: string): Response {
  return {
    ok: true,
    json: async () => ({ choices: [{ message: { content } }] }),
  } as unknown as Response;
}

/** 첫 CUE — 실제 시나리오 데이터에서 가져온다(요청 만들기 검사용). */
function firstCue(): CueDef {
  const turn = CHK_A01.turns.find((item) => item.cue);
  if (!turn?.cue) throw new Error("CHK-A01에 CUE가 있는 턴이 없습니다");
  return turn.cue;
}

/* ── 주소 만들기 ───────────────────────────────────────── */

describe("chatCompletionsUrl", () => {
  it("앞부분만 준 주소에 경로를 이어 붙인다", () => {
    expect(chatCompletionsUrl("https://coach.invalid/v1")).toBe(
      "https://coach.invalid/v1/chat/completions",
    );
    expect(chatCompletionsUrl("https://coach.invalid/v1/")).toBe(
      "https://coach.invalid/v1/chat/completions",
    );
  });

  it("이미 전체 주소면 그대로 쓴다 (경로가 두 번 붙지 않는다)", () => {
    expect(chatCompletionsUrl("https://coach.invalid/v1/chat/completions")).toBe(
      "https://coach.invalid/v1/chat/completions",
    );
  });
});

/* ── 요청 만들기 ───────────────────────────────────────── */

describe("buildCoachRequest", () => {
  it("발화를 가명처리한 뒤에만 담는다", () => {
    const request = buildCoachRequest(CHK_A01, firstCue(), "01012345678로 연락드리겠습니다");
    expect(request.utterance).not.toContain("01012345678");
    expect(request.utterance).toContain("[번호]");
  });

  it("인용 가능 문서 7종만 목록에 담는다 (표준교재는 들어가지 않는다)", () => {
    const request = buildCoachRequest(CHK_A01, firstCue(), "네");
    expect(request.docs).toHaveLength(7);
    expect(request.docs.map((doc) => doc.id)).not.toContain("DOC-EDU-000");
    for (const doc of request.docs) expect(doc.title.length).toBeGreaterThan(0);
  });
});

/* ── 가드 ①~④ ─────────────────────────────────────────── */

describe("가드 체인", () => {
  it("정상 응답은 통과하고 근거 문서를 달고 나온다", () => {
    const outcome = applyGuards(
      '{"coaching":"먼저 어르신의 마음을 받아 주신 점이 좋았습니다. 다음에는 이유를 한 번 더 여쭤봐 주세요.","docId":"DOC-GUIDE-001"}',
    );
    expect(outcome.status).toBe("ok");
    expect(outcome.docId).toBe("DOC-GUIDE-001");
    expect(outcome.message).toContain("여쭤봐 주세요");
    expect(outcome.steps).toHaveLength(4);
    expect(outcome.steps.every((step) => step.passed)).toBe(true);
  });

  it("코드 울타리와 군말이 섞여 있어도 JSON 한 덩어리를 꺼낸다", () => {
    const outcome = applyGuards(
      '네, 알겠습니다.\n```json\n{"coaching":"이유를 한 번 더 여쭤봐 주세요.","docId":null}\n```',
    );
    expect(outcome.status).toBe("ok");
    expect(outcome.docId).toBeUndefined();
  });

  it("① JSON이 깨지면 막고 고정 문구를 낸다", () => {
    const outcome = applyGuards("코칭: 이유를 여쭤보세요");
    expect(outcome.status).toBe("blocked");
    expect(outcome.blocked).toBe("format");
    expect(outcome.message).toBe(NO_SOURCE_MESSAGE);
    // 막힌 단이 마지막이고, 뒤 단은 아예 실행되지 않는다.
    expect(outcome.steps).toHaveLength(1);
    expect(outcome.steps[0]?.passed).toBe(false);
  });

  it("① 코칭 문장이 비어 있으면 막는다", () => {
    const outcome = applyGuards('{"coaching":"   ","docId":"DOC-GUIDE-001"}');
    expect(outcome.blocked).toBe("format");
  });

  it("② 목록 밖 문서를 근거로 들면 막는다", () => {
    const outcome = applyGuards(
      '{"coaching":"이유를 한 번 더 여쭤봐 주세요.","docId":"DOC-없는것-999"}',
    );
    expect(outcome.status).toBe("blocked");
    expect(outcome.blocked).toBe("evidence");
    expect(outcome.message).toBe(NO_SOURCE_MESSAGE);
    expect(outcome.blockedLabel).toContain("DOC-없는것-999");
  });

  it("② 인용 금지 문서(표준교재)도 목록 밖으로 막는다", () => {
    const outcome = applyGuards(
      '{"coaching":"이유를 한 번 더 여쭤봐 주세요.","docId":"DOC-EDU-000"}',
    );
    expect(outcome.blocked).toBe("evidence");
  });

  it("③ 금지 표현 8종은 하나도 통과하지 못한다", () => {
    for (const phrase of BANNED_PHRASES) {
      const outcome = applyGuards(`{"coaching":"${phrase}에 도움이 됩니다.","docId":"DOC-GUIDE-001"}`);
      expect(outcome.status, phrase).toBe("blocked");
      expect(outcome.blocked, phrase).toBe("phrase");
      expect(outcome.message, phrase).toBe(NO_SOURCE_MESSAGE);
    }
  });

  it("③ 띄어쓰기를 늘려도 금지 표현은 빠져나가지 못한다", () => {
    const outcome = applyGuards('{"coaching":"증상   완화에 도움이 됩니다.","docId":"DOC-GUIDE-001"}');
    expect(outcome.blocked).toBe("phrase");
  });

  it("③ 반대로 붙여 써도 빠져나가지 못한다 (양쪽 공백을 지우고 대조한다)", () => {
    /* 늘리는 우회(「증상  완화」)만 막고 줄이는 우회(「증상완화」)를 열어 두면
       체에 구멍이 하나 남는다 — 한국어에서 띄어쓰기는 붙여도 그대로 읽힌다. */
    for (const phrase of ["증상완화", "AI주치의", "인지개선", "임상적으로검증된"]) {
      const outcome = applyGuards(`{"coaching":"${phrase} 사례입니다.","docId":"DOC-GUIDE-001"}`);
      expect(outcome.blocked, phrase).toBe("phrase");
      expect(outcome.message, phrase).toBe(NO_SOURCE_MESSAGE);
    }
  });

  it("③ 스스로의 정체를 밝히면 막는다 (목록 전수)", () => {
    /* 모델 이름은 이제 브라우저가 알지 못한다(서버 환경변수에만 있다).
       남은 방어선은 일반 명사 목록이고, 그 목록이 **항목마다** 도는지를 잰다. */
    for (const word of MODEL_IDENTITY_WORDS) {
      const outcome = applyGuards(
        `{"coaching":"저는 ${word}이라 확답은 어렵습니다.","docId":"DOC-GUIDE-001"}`,
      );
      expect(outcome.blocked, word).toBe("phrase");
    }
  });

  it("③ 붙여 쓴 정체어와 대문자로 적은 영어 상투구도 막는다", () => {
    for (const head of ["저는 언어모델이라", "As an AI, 저는"]) {
      const outcome = applyGuards(
        `{"coaching":"${head} 확답은 어렵습니다.","docId":"DOC-GUIDE-001"}`,
      );
      expect(outcome.blocked, head).toBe("phrase");
    }
  });

  it("③ 이 체는 시나리오 대사·검수 코칭을 한 줄도 걸지 않는다 (과탐 전수 확인)", () => {
    /* 목록에 단독 일반 명사(「인공지능」·「챗봇」…)를 더할 때마다 물어야 하는 것은 하나다 —
       **우리가 이미 화면에 띄우고 있는 문장이 여기 걸리지 않는가.** 걸리는 낱말을 넣으면
       그날부터 정상 문장이 조용히 고정 문구로 바뀐다. 그래서 데이터를 전수로 훑는다. */
    let checked = 0;
    for (const scenario of getActiveScenarios()) {
      const lines: string[] = [];
      for (const turn of scenario.turns) {
        lines.push(turn.text);
        for (const branch of turn.cue?.branches ?? []) {
          lines.push(branch.aiReaction, branch.coaching ?? "", branch.praise ?? "");
        }
      }
      for (const line of lines) {
        if (line.trim().length === 0) continue;
        checked += 1;
        expect(findBannedExpression(line), `${scenario.id} · ${line}`).toBeUndefined();
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("③ 정상 코칭 문장은 이 단을 그대로 지난다 (과탐 확인)", () => {
    for (const coaching of [
      "먼저 어르신의 마음을 한 번 더 알아드려 보세요.",
      "다음에는 이유를 여쭤본 뒤에 함께 앉아 보시면 좋겠습니다.",
      "관찰하신 내용을 사실대로 기록에 남겨 주세요.",
    ]) {
      const outcome = applyGuards(`{"coaching":"${coaching}","docId":"DOC-GUIDE-001"}`);
      expect(outcome.status, coaching).toBe("ok");
    }
  });

  it("④ 길이 상한을 넘으면 막는다", () => {
    const long = "가".repeat(COACHING_MAX_LENGTH + 1);
    const outcome = applyGuards(`{"coaching":"${long}","docId":"DOC-GUIDE-001"}`);
    expect(outcome.status).toBe("blocked");
    expect(outcome.blocked).toBe("length");
    expect(outcome.message).toBe(NO_SOURCE_MESSAGE);
    // 앞 세 단은 지났다는 사실이 결과에 남는다.
    expect(outcome.steps.filter((step) => step.passed)).toHaveLength(3);
  });

  it("④ 상한과 같은 길이는 통과한다 (경계)", () => {
    const exact = "가".repeat(COACHING_MAX_LENGTH);
    const outcome = applyGuards(`{"coaching":"${exact}","docId":null}`);
    expect(outcome.status).toBe("ok");
  });
});

/* ── 응답 읽기 ─────────────────────────────────────────── */

describe("readChatCompletionContent", () => {
  it("본문 문자열만 꺼낸다", () => {
    expect(readChatCompletionContent({ choices: [{ message: { content: "한 문장" } }] })).toBe(
      "한 문장",
    );
  });

  it("모양이 낯설면 undefined다 (문장을 지어내지 않는다)", () => {
    expect(readChatCompletionContent({ unexpected: true })).toBeUndefined();
    expect(readChatCompletionContent({ choices: [] })).toBeUndefined();
    expect(readChatCompletionContent(null)).toBeUndefined();
  });
});

/* ── 호출·폴백 ─────────────────────────────────────────── */

describe("requestOnlineCoaching", () => {
  it("꺼져 있으면 부르지 않는다 (네트워크 호출 0건)", async () => {
    const { fetchImpl, calls } = fetchReturning({ status: "ok", content: "x" });
    const outcome = await requestOnlineCoaching(REQUEST, { enabled: false }, { fetchImpl });
    expect(calls).toHaveLength(0);
    expect(outcome.status).toBe("fallback");
    expect(outcome.fallback).toBe("disabled");
    expect(outcome.message).toBe("");
  });

  it("같은 도메인 /api/coach만 부른다 — 키도 모델 이름도 싣지 않는다", async () => {
    const { fetchImpl, calls } = fetchReturning({
      status: "ok",
      content: '{"coaching":"이유를 한 번 더 여쭤봐 주세요.","docId":"DOC-GUIDE-001"}',
    });
    const outcome = await requestOnlineCoaching(REQUEST, CONFIG, { fetchImpl });
    expect(outcome.status).toBe("ok");
    expect(outcome.docId).toBe("DOC-GUIDE-001");

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(COACH_ENDPOINT);
    expect(COACH_ENDPOINT.startsWith("/")).toBe(true);

    const headers = calls[0]?.init?.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();

    // 몸통은 buildCoachRequest 산출물 그대로다 — 상류 프롬프트는 서버가 짠다.
    const body = JSON.parse(String(calls[0]?.init?.body)) as Record<string, unknown>;
    expect(body.utterance).toBe(REQUEST.utterance);
    expect(body.model).toBeUndefined();
    expect(body.messages).toBeUndefined();
    expect(String(calls[0]?.init?.body)).not.toContain("DOC-EDU-000");
  });

  it("가명처리를 지난 발화만 몸통에 실린다", async () => {
    const { fetchImpl, calls } = fetchReturning({
      status: "ok",
      content: '{"coaching":"이유를 한 번 더 여쭤봐 주세요.","docId":null}',
    });
    const request = buildCoachRequest(CHK_A01, firstCue(), "01012345678로 연락드리겠습니다");
    await requestOnlineCoaching(request, CONFIG, { fetchImpl });
    const body = String(calls[0]?.init?.body);
    expect(body).not.toContain("01012345678");
    expect(body).toContain("[번호]");
  });

  it("서버에 상류 설정이 없으면 조용히 결정론으로 되돌아간다", async () => {
    const { fetchImpl } = fetchReturning({ status: "unconfigured" });
    const outcome = await requestOnlineCoaching(REQUEST, CONFIG, { fetchImpl });
    expect(outcome.status).toBe("fallback");
    expect(outcome.fallback).toBe("config");
    expect(outcome.message).toBe("");
  });

  it("호출 한도를 넘으면 조용히 결정론으로 되돌아간다 (화면 문구 없음)", async () => {
    const { fetchImpl } = fetchReturning({ status: "rate_limited" });
    const outcome = await requestOnlineCoaching(REQUEST, CONFIG, { fetchImpl });
    expect(outcome.status).toBe("fallback");
    expect(outcome.fallback).toBe("rate_limited");
    expect(outcome.message).toBe("");
    expect(outcome.steps).toHaveLength(0);
  });

  it("상류가 실패했다는 응답도 조용한 폴백이다", async () => {
    const { fetchImpl } = fetchReturning({ status: "upstream" });
    const outcome = await requestOnlineCoaching(REQUEST, CONFIG, { fetchImpl });
    expect(outcome.status).toBe("fallback");
    expect(outcome.message).toBe("");
  });

  it("응답이 늦으면 조용히 결정론으로 되돌아간다 (화면 문구 없음)", async () => {
    /* 상한을 넘기면 AbortController가 요청을 끊는다 — 그때의 거부를 그대로 흉내 낸다. */
    const fetchImpl = ((_url: unknown, init?: RequestInit) =>
      new Promise<Response>((_resolve, rejectPromise) => {
        init?.signal?.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          rejectPromise(error);
        });
      })) as unknown as typeof fetch;

    const outcome = await requestOnlineCoaching(REQUEST, CONFIG, { fetchImpl, timeoutMs: 10 });
    expect(outcome.status).toBe("fallback");
    expect(outcome.fallback).toBe("timeout");
    expect(outcome.message).toBe("");
    expect(outcome.steps).toHaveLength(0);
  });

  it("연결이 끊기면 조용히 결정론으로 되돌아간다", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const outcome = await requestOnlineCoaching(REQUEST, CONFIG, { fetchImpl });
    expect(outcome.fallback).toBe("network");
    expect(outcome.message).toBe("");
  });

  it("오류 응답도 조용한 폴백으로 다룬다", async () => {
    const fetchImpl = (async () => relayed({ status: "invalid" }, false)) as unknown as typeof fetch;
    const outcome = await requestOnlineCoaching(REQUEST, CONFIG, { fetchImpl });
    expect(outcome.fallback).toBe("http");
  });

  it("응답 모양이 낯설면 문장을 지어내지 않는다", async () => {
    const { fetchImpl } = fetchReturning({ unexpected: true });
    const outcome = await requestOnlineCoaching(REQUEST, CONFIG, { fetchImpl });
    expect(outcome.status).toBe("fallback");
    expect(outcome.message).toBe("");
  });
});

/* ── 서버 라우트 (/api/coach) ──────────────────────────── */

/**
 * 라우트는 키를 붙여 중계만 한다. 여기서 재는 것은 셋이다.
 *  · 기대 형태가 아니면 상류를 부르지 않고 400으로 끊는가
 *  · 서버 설정이 없으면 조용히 unconfigured인가
 *  · 한도를 넘으면 상류를 부르지 않는가, 그리고 키가 응답에 새지 않는가
 *
 * 호출 한도는 인스턴스 메모리에 쌓이므로, 검사마다 **다른 IP**를 써서 서로를 밀어내지 않게 한다.
 */
describe("/api/coach", () => {
  const KEY = "server-only-key-abcdefgh";
  const OK_CONTENT = '{"coaching":"이유를 한 번 더 여쭤봐 주세요.","docId":"DOC-GUIDE-001"}';
  let calls: Array<{ url: string; init: RequestInit | undefined }>;
  let ipSeed = 0;

  /** 전역 fetch를 가짜로 바꾸고, 상류로 나간 호출을 그대로 모아 둔다. */
  function stubUpstream(reply: () => Response): Array<{ url: string; init: RequestInit | undefined }> {
    const seen: Array<{ url: string; init: RequestInit | undefined }> = [];
    const impl = (async (url: unknown, init?: RequestInit) => {
      seen.push({ url: String(url), init });
      return reply();
    }) as unknown as typeof fetch;
    vi.stubGlobal("fetch", impl);
    return seen;
  }

  /** 검사마다 새 IP — 「같은 IP 분당 6회」에 서로 걸리지 않게 한다. */
  function coachRequest(body: unknown, ip = `10.0.0.${(ipSeed += 1)}`): Request {
    return new Request("https://chimchak.invalid/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
  }

  /** 클라이언트가 실제로 보내는 몸통 — buildCoachRequest 산출물이다. */
  function validBody(): OnlineCoachRequest {
    return buildCoachRequest(CHK_A01, firstCue(), "무슨 일이 있으셨는지 여쭤봤습니다");
  }

  beforeEach(() => {
    calls = stubUpstream(() => upstreamReply(OK_CONTENT));
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
    vi.stubEnv("COACH_BASE_URL", "");
    const response = await POST(coachRequest(validBody()));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "unconfigured" });
    expect(calls).toHaveLength(0);
  });

  it("정상 요청은 상류 원문을 그대로 중계한다 (가드는 돌리지 않는다)", async () => {
    const response = await POST(coachRequest(validBody()));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string; content: string };
    expect(body.status).toBe("ok");
    // 서버는 문장을 검사하지 않는다 — 그 일은 기기 안 applyGuards가 한다.
    expect(body.content).toContain("여쭤봐 주세요");
    expect(applyGuards(body.content).status).toBe("ok");
  });

  it("키는 상류 헤더에만 붙고 응답에는 실리지 않는다", async () => {
    const response = await POST(coachRequest(validBody()));
    expect(await response.text()).not.toContain(KEY);

    expect(calls).toHaveLength(1);
    const init = calls[0]?.init as RequestInit;
    expect(calls[0]?.url).toBe("https://coach.invalid/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);

    // 상류로 나가는 몸통에는 서버가 짠 프롬프트와 서버가 고른 모델 이름이 들어간다.
    const sent = JSON.parse(String(init.body)) as {
      model: string;
      max_tokens: number;
      messages: Array<{ role: string; content: string }>;
    };
    expect(sent.model).toBe("tiny-coach-1");
    expect(sent.max_tokens).toBeLessThanOrEqual(400);
    expect(sent.messages[0]?.content).toContain("DOC-GUIDE-001");
    expect(sent.messages[0]?.content).not.toContain("DOC-EDU-000");
    expect(sent.messages[1]?.content).toContain("무슨 일이 있으셨는지");
  });

  it("기대 형태가 아니면 400으로 끊고 상류를 부르지 않는다", async () => {
    const cases: unknown[] = [
      "이건 JSON이 아닙니다",
      { utterance: "발화만 있습니다" },
      { ...validBody(), utterance: "" },
      { ...validBody(), utterance: "가".repeat(501) },
      { ...validBody(), indicators: "배열이 아닙니다" },
      { ...validBody(), docs: [{ id: "DOC-GUIDE-001" }] },
    ];
    for (const body of cases) {
      const response = await POST(coachRequest(body));
      expect(response.status, JSON.stringify(body)).toBe(400);
      expect(await response.json()).toEqual({ status: "invalid" });
    }
    expect(calls).toHaveLength(0);
  });

  it("발화 상한(500자)까지는 받는다 (경계)", async () => {
    const response = await POST(coachRequest({ ...validBody(), utterance: "가".repeat(500) }));
    expect(response.status).toBe(200);
    expect(((await response.json()) as { status: string }).status).toBe("ok");
  });

  it("열려 있는 모든 CUE의 요청이 검증을 지난다", async () => {
    /* 상한(발화 500자·지표 12개·문서 16종)이 실제 데이터보다 좁으면, 시나리오가 늘어난 어느 날
       코칭이 조용히 400으로 끊깁니다 — 화면에는 아무 표시도 나지 않는 고장입니다. */
    for (const scenario of getActiveScenarios()) {
      for (const turn of scenario.turns) {
        if (!turn.cue) continue;
        const body = buildCoachRequest(scenario, turn.cue, "무슨 일이 있으셨는지 여쭤봤습니다");
        const response = await POST(coachRequest(body));
        expect(((await response.json()) as { status: string }).status, scenario.id).toBe("ok");
      }
    }
  });

  it("아는 칸만 새로 조립해 보낸다 — 몸통에 끼워 넣은 값은 상류에 닿지 않는다", async () => {
    await POST(coachRequest({ ...validBody(), model: "몰래-바꾼-모델", extra: "끼워 넣은 값" }));
    const sent = String((calls[0]?.init as RequestInit).body);
    expect(sent).not.toContain("몰래-바꾼-모델");
    expect(sent).not.toContain("끼워 넣은 값");
  });

  it("같은 IP가 분당 상한을 넘기면 상류를 부르지 않는다", async () => {
    const ip = "10.9.9.9";
    const statuses: string[] = [];
    for (let i = 0; i < 8; i += 1) {
      const response = await POST(coachRequest(validBody(), ip));
      statuses.push(((await response.json()) as { status: string }).status);
    }
    expect(statuses.slice(0, 6)).toEqual(Array(6).fill("ok"));
    expect(statuses.slice(6)).toEqual(["rate_limited", "rate_limited"]);
    expect(calls).toHaveLength(6);
  });

  it("배포 전체 하루 상한을 넘기면 IP가 달라도 막는다", async () => {
    vi.stubEnv("COACH_DAILY_CAP", "1");
    const response = await POST(coachRequest(validBody(), "10.8.8.8"));
    expect(await response.json()).toEqual({ status: "rate_limited" });
    expect(calls).toHaveLength(0);
  });

  it("상류가 실패하면 upstream을 돌려준다 (문장을 지어내지 않는다)", async () => {
    stubUpstream(() => ({ ok: false, status: 500 }) as unknown as Response);
    const response = await POST(coachRequest(validBody()));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "upstream" });
  });

  it("상류 응답 모양이 낯설어도 upstream으로 끝난다", async () => {
    stubUpstream(
      () => ({ ok: true, json: async () => ({ unexpected: true }) }) as unknown as Response,
    );
    const response = await POST(coachRequest(validBody()));
    expect(await response.json()).toEqual({ status: "upstream" });
  });

  it("어떤 경우에도 캐시하지 않는다", async () => {
    const response = await POST(coachRequest(validBody()));
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
