/**
 * 설정 — src/lib/settings.ts
 *
 * 이 파일이 지키는 것은 하나다: **스위치가 둘로 갈린 날(2026-08-28)의 마이그레이션 불변식.**
 *
 *  ① 이미 켜 둔 사람의 동의 범위가 줄지 않는다 — 옛 스위치를 켠 기기는 갈라진 뒤에도
 *    코칭 보조와 대사 변주를 함께 받는다.
 *  ② 켜지 않은 사람에게 **발화 전송이 새로 켜지지 않는다** — `onlineCoaching`이 참이 되는 길은
 *    저장된 `true` 하나뿐이다. 이 앱에서 사용자의 말이 기기 밖으로 나가는 문이라 가장 무거운 줄이다.
 *  ③ 사용자가 **직접 고른 「검수 문장 그대로」**를 새 기본값이 되돌려 주지 않는다.
 *
 * 마이그레이션 코드가 따로 없는 것이 이 설계의 요점이다 — 읽는 잣대 둘(`!== false` / `=== true`)이
 * 갈라져 있고, 옛 값과 새 값이 같은 함수를 지나 각자 옳은 자리에 떨어진다. 그래서 검사도
 * 「변환을 한 번 돌렸는가」가 아니라 **「저장된 값 X를 읽으면 무엇이 되는가」**를 잰다.
 *
 * 브라우저 환경(jsdom)을 끌어오지 않고 최소 localStorage 스텁만 심는다(storage.test.ts와 같은 규율).
 * 모듈 안 캐시(`cache`)가 검사끼리 새지 않도록 검사마다 모듈을 새로 들인다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* ── localStorage 스텁 ─────────────────────────────────── */

class MemoryStorage {
  private map = new Map<string, string>();

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

const KEY = "chimchak.settings.v1";

let store: MemoryStorage;

beforeEach(() => {
  store = new MemoryStorage();
  (globalThis as { window?: unknown }).window = { localStorage: store };
  // 모듈 안 캐시가 앞 검사의 값을 들고 넘어오지 않게 한다.
  vi.resetModules();
});

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

/** 저장소에 값을 심고 **새로 들인** 설정 모듈을 돌려준다. */
async function withStored(raw: unknown) {
  if (raw !== undefined) store.setItem(KEY, JSON.stringify(raw));
  return import("@/lib/settings");
}

/* ── 기본값 ────────────────────────────────────────────── */

describe("기본값 — 두 스위치는 서로 다른 곳에서 출발한다", () => {
  it("저장된 값이 없으면 어르신 말투는 「매번 조금씩 다르게」, 발화 전송은 꺼짐이다", async () => {
    const settings = await withStored(undefined);
    const loaded = settings.loadSettings();

    expect(loaded.aiDialogue.enabled).toBe(true);
    expect(loaded.onlineCoaching.enabled).toBe(false);
  });

  it("상수와 실제 기본값이 같다 (문서와 코드가 갈라지지 않게)", async () => {
    const settings = await withStored(undefined);

    expect(settings.DEFAULT_AI_DIALOGUE.enabled).toBe(true);
    expect(settings.DEFAULT_ONLINE_COACHING.enabled).toBe(false);
    expect(settings.DEFAULT_SETTINGS.aiDialogue.enabled).toBe(true);
    expect(settings.DEFAULT_SETTINGS.onlineCoaching.enabled).toBe(false);
  });

  it("저장소가 막힌 기기(window 없음)에서도 같은 기본값이 나온다", async () => {
    delete (globalThis as { window?: unknown }).window;
    const settings = await import("@/lib/settings");
    const loaded = settings.getSettings();

    expect(loaded.aiDialogue.enabled).toBe(true);
    expect(loaded.onlineCoaching.enabled).toBe(false);
  });
});

/* ── 마이그레이션 네 상태 ──────────────────────────────── */

describe("마이그레이션 — 저장된 네 상태가 각자 옳은 자리로 간다", () => {
  const CASES: ReadonlyArray<{
    name: string;
    stored: unknown;
    aiDialogue: boolean;
    onlineCoaching: boolean;
  }> = [
    {
      name: "① 없음 — 첫 방문",
      stored: { fontScale: "large", speechRate: "standard" },
      aiDialogue: true,
      onlineCoaching: false,
    },
    {
      name: "② 옛 값 켬 — 동의 범위가 줄지 않는다",
      stored: { fontScale: "standard", speechRate: "slow", onlineCoaching: { enabled: true } },
      aiDialogue: true,
      onlineCoaching: true,
    },
    {
      name: "③ 옛 값 끔 — 발화 전송이 새로 켜지지 않는다",
      stored: { fontScale: "standard", speechRate: "slow", onlineCoaching: { enabled: false } },
      aiDialogue: true,
      onlineCoaching: false,
    },
    {
      name: "④ 새 값 — 사용자가 고른 「검수 문장 그대로」는 그대로 남는다",
      stored: { aiDialogue: { enabled: false }, onlineCoaching: { enabled: true } },
      aiDialogue: false,
      onlineCoaching: true,
    },
  ];

  for (const item of CASES) {
    it(item.name, async () => {
      const settings = await withStored(item.stored);
      const loaded = settings.loadSettings();

      expect(loaded.aiDialogue.enabled).toBe(item.aiDialogue);
      expect(loaded.onlineCoaching.enabled).toBe(item.onlineCoaching);
    });
  }

  it("취향값 두 개는 마이그레이션에 휩쓸리지 않는다", async () => {
    const settings = await withStored({
      fontScale: "xlarge",
      speechRate: "fast",
      onlineCoaching: { enabled: true },
    });
    const loaded = settings.loadSettings();

    expect(loaded.fontScale).toBe("xlarge");
    expect(loaded.speechRate).toBe("fast");
  });

  it("읽어도 저장소를 다시 쓰지 않는다 — 변환 코드가 없다는 사실 그대로", async () => {
    const raw = JSON.stringify({ onlineCoaching: { enabled: true } });
    store.setItem(KEY, raw);
    const settings = await import("@/lib/settings");
    settings.loadSettings();
    settings.getSettings();

    expect(store.getItem(KEY)).toBe(raw);
  });
});

/* ── 동의 불변식 ───────────────────────────────────────── */

describe("동의 불변식 — 발화 전송은 저장된 true에서만 참이다", () => {
  const NOT_TRUE: ReadonlyArray<{ name: string; stored: unknown }> = [
    { name: "칸 자체가 없음", stored: { fontScale: "large" } },
    { name: "false", stored: { onlineCoaching: { enabled: false } } },
    { name: "문자열 \"true\"", stored: { onlineCoaching: { enabled: "true" } } },
    { name: "숫자 1", stored: { onlineCoaching: { enabled: 1 } } },
    { name: "객체가 아님", stored: { onlineCoaching: true } },
    { name: "null", stored: { onlineCoaching: null } },
    { name: "빈 객체", stored: {} },
    { name: "손상된 모양(배열)", stored: { onlineCoaching: [{ enabled: true }] } },
  ];

  for (const item of NOT_TRUE) {
    it(`${item.name} → 꺼짐`, async () => {
      const settings = await withStored(item.stored);

      expect(settings.loadSettings().onlineCoaching.enabled).toBe(false);
      expect(settings.isOnlineCoachingActive(settings.loadSettings())).toBe(false);
    });
  }

  it("저장된 문자열이 JSON이 아니어도 발화 전송은 꺼짐이다", async () => {
    store.setItem(KEY, "{이건 JSON이 아닙니다");
    const settings = await import("@/lib/settings");

    expect(settings.loadSettings().onlineCoaching.enabled).toBe(false);
    expect(settings.loadSettings().aiDialogue.enabled).toBe(true);
  });

  it("말투를 「매번 조금씩 다르게」로 두는 것이 발화 전송을 켜지 않는다", async () => {
    const settings = await withStored({ onlineCoaching: { enabled: false } });
    const next = settings.setAiDialogue({ enabled: true });

    expect(next.aiDialogue.enabled).toBe(true);
    expect(next.onlineCoaching.enabled).toBe(false);
    expect(settings.loadSettings().onlineCoaching.enabled).toBe(false);
  });

  it("발화 전송을 끄는 것이 말투를 「검수 문장 그대로」로 바꾸지 않는다", async () => {
    const settings = await withStored({ onlineCoaching: { enabled: true } });
    const next = settings.setOnlineCoaching({ enabled: false });

    expect(next.onlineCoaching.enabled).toBe(false);
    expect(next.aiDialogue.enabled).toBe(true);
  });
});

/* ── 사용자가 끈 값은 남는다 ───────────────────────────── */

describe("고른 값의 왕복 — 새 기본값이 사용자의 선택을 덮지 않는다", () => {
  it("「검수 문장 그대로」를 고르면 저장되고, 다시 읽어도 그대로다", async () => {
    const settings = await withStored(undefined);
    settings.setAiDialogue({ enabled: false });

    // 같은 모듈에서 한 번, 저장된 문자열을 새 모듈이 다시 읽어 한 번.
    expect(settings.loadSettings().aiDialogue.enabled).toBe(false);

    vi.resetModules();
    const reloaded = await import("@/lib/settings");
    expect(reloaded.loadSettings().aiDialogue.enabled).toBe(false);
  });

  it("바꾼 뒤 「매번 조금씩 다르게」로 되돌리면 그 값이 남는다", async () => {
    const settings = await withStored(undefined);
    settings.setAiDialogue({ enabled: false });
    settings.setAiDialogue({ enabled: true });

    vi.resetModules();
    const reloaded = await import("@/lib/settings");
    expect(reloaded.loadSettings().aiDialogue.enabled).toBe(true);
  });
});

/* ── 라벨과 고지 ───────────────────────────────────────── */

describe("라벨 — 이름이 성질을 적는다", () => {
  it("발화 전송 절 이름에 「하신 말씀」이 들어 있다", async () => {
    const settings = await withStored(undefined);

    expect(settings.ONLINE_MODE_LABEL).toContain("하신 말씀");
  });

  it("어르신 말투 절 이름에는 AI도 켜기/끄기도 없다", async () => {
    const settings = await withStored(undefined);

    expect(settings.AI_DIALOGUE_LABEL).toBe("어르신 말투");
    expect(settings.AI_DIALOGUE_LABEL).not.toContain("AI");
    expect(settings.AI_DIALOGUE_LABEL).not.toContain("연기");
  });

  /**
   * 2택은 **기본값이 앞**이다(글자 크기·음성 빠르기와 같은 차례). 차례가 뒤집히면 처음 여신
   * 분이 왼쪽 보기를 기본으로 읽는데, 왼쪽에 서 있는 것은 고르지 않은 갈래가 된다.
   */
  it("어르신 말투는 말투 이름 2택이고, 기본값(true)이 앞에 선다", async () => {
    const settings = await withStored(undefined);

    expect(settings.AI_DIALOGUE_OPTIONS.map((option) => option.label)).toEqual([
      "매번 조금씩 다르게",
      "검수 문장 그대로",
    ]);
    expect(settings.AI_DIALOGUE_OPTIONS[0].value).toBe(true);
    expect(settings.AI_DIALOGUE_OPTIONS[1].value).toBe(false);
    expect(settings.AI_DIALOGUE_OPTIONS.map((option) => option.label)).not.toContain("켜기");
    expect(settings.AI_DIALOGUE_OPTIONS.map((option) => option.label)).not.toContain("끄기");
  });

  /**
   * **이름에서 AI를 뺀 대신 고지가 받는다**는 약속이 이 검사다.
   * 항목 이름을 「어르신 말투」로 바꾼 것은 「꺼도 되는 기능」 프레임을 지우려는 것이지
   * 사실을 지우려는 것이 아니므로, AI라는 낱말이 고지에서까지 사라지면 개명이 은폐가 된다.
   */
  it("어르신 말투 고지는 AI라는 사실과 발화가 나가지 않는다는 사실을 함께 적는다", async () => {
    const settings = await withStored(undefined);

    expect(settings.AI_DIALOGUE_NOTICE).toContain("AI");
    expect(settings.AI_DIALOGUE_NOTICE).toContain("하신 말씀은 나가지 않습니다");
    expect(settings.AI_DIALOGUE_NOTICE).toContain("매번 조금씩 다르게");
    // 19차에 위험 판단 유형이 변주 제외에 합류하면서 고지도 두 유형을 함께 센다(AiMap과 한 목소리).
    expect(settings.AI_DIALOGUE_NOTICE).toContain("응급과 위험 판단 유형 훈련은 제외");
  });

  /**
   * 나가는 것은 **넷**이다 — /safety(§04 훈련 경로)·/legal(대사 변주 절)과 같은 수.
   * 한동안 이 고지만 「직전 인물 대사」를 빼고 「뿐입니다」로 닫아, 세 화면이 같은 목록을
   * 다르게 세고 있었다. 셋으로 줄면 여기서 걸린다.
   */
  it("어르신 말투 고지가 세는 「나가는 것」은 넷이다", async () => {
    const settings = await withStored(undefined);

    for (const item of ["대사 원문", "인물·상황 소개", "직전 인물 대사"]) {
      expect(settings.AI_DIALOGUE_NOTICE).toContain(item);
    }
  });

  it("발화 전송 고지는 전송 범위 셋(가명처리·상황 훈련 한 문장·자유 연습)을 그대로 들고 있다", async () => {
    const settings = await withStored(undefined);

    expect(settings.ONLINE_COACHING_NOTICE).toContain("가명처리");
    expect(settings.ONLINE_COACHING_NOTICE).toContain("그 한 문장뿐입니다");
    expect(settings.ONLINE_COACHING_NOTICE).toContain("자유 연습");
  });

  /**
   * 켜기/끄기가 남은 칸은 **정말로 동의를 켜고 끄는 칸 하나**뿐이다.
   * 한때는 두 칸이 이 두 낱말을 함께 썼는데, 위 칸이 말투 2택이 되면서 형식이 갈렸고
   * 그 갈림이 지금은 사실을 적는다(무게가 다른 물음은 다른 형식으로 묻는다).
   */
  it("켜기·끄기 두 낱말은 발화 전송 칸에만 남았다", async () => {
    const settings = await withStored(undefined);

    expect(settings.SWITCH_OPTIONS.map((option) => option.label)).toEqual(["끄기", "켜기"]);
  });

  /**
   * 낫표 인용은 축자여야 한다 — /guide와 자유 연습 문 앞이 낫표 안에 넣는 앞머리가
   * 전체 이름 안에 **그대로** 들어 있는지 잰다(15차 copy low).
   */
  it("발화 전송 절 이름의 앞머리는 전체 이름이 그대로 품는다", async () => {
    const settings = await withStored(undefined);

    expect(settings.ONLINE_MODE_LABEL.startsWith(settings.ONLINE_MODE_SHORT_LABEL)).toBe(true);
    expect(settings.ONLINE_MODE_SHORT_LABEL).toBe("AI 코칭·자유 연습");
  });

  /** 개명은 **문면·표시 계층에서만** 일어난다 — 저장 열쇠는 그대로다. */
  it("이름이 바뀌어도 저장 열쇠는 그대로다", async () => {
    const settings = await withStored(undefined);

    expect(settings.SETTINGS_KEY).toBe("chimchak.settings.v1");
  });
});

/* ── 변주가 보는 칸 ────────────────────────────────────── */

describe("isLineVaryActive — 보는 칸은 「어르신 말투」 하나다", () => {
  it("저장된 값이 없으면(기본 상태) 비응급 시나리오에서 돈다", async () => {
    await withStored(undefined);
    const { isLineVaryActive } = await import("@/lib/onlineVary");
    const { CHK_A01 } = await import("@/data/scenarios/chk-a01");

    expect(isLineVaryActive(CHK_A01)).toBe(true);
  });

  it("응급 유형은 어느 말투를 골라도 돌지 않는다 (L3 원칙)", async () => {
    await withStored(undefined);
    const { isLineVaryActive } = await import("@/lib/onlineVary");
    const { CHK_B01 } = await import("@/data/scenarios/chk-b01");

    expect(isLineVaryActive(CHK_B01)).toBe(false);
  });

  it("「검수 문장 그대로」면 발화 전송이 켜져 있어도 돌지 않는다", async () => {
    await withStored({ aiDialogue: { enabled: false }, onlineCoaching: { enabled: true } });
    const { isLineVaryActive } = await import("@/lib/onlineVary");
    const { CHK_A01 } = await import("@/data/scenarios/chk-a01");

    expect(isLineVaryActive(CHK_A01)).toBe(false);
  });

  it("발화 전송만 꺼져 있어도 변주는 그대로 돈다 (옛 스위치를 안 켠 기기)", async () => {
    await withStored({ onlineCoaching: { enabled: false } });
    const { isLineVaryActive } = await import("@/lib/onlineVary");
    const { CHK_A01 } = await import("@/data/scenarios/chk-a01");

    expect(isLineVaryActive(CHK_A01)).toBe(true);
  });

  it("varyLine은 말투가 「검수 문장 그대로」면 네트워크를 부르지 않고 앵커를 돌려준다", async () => {
    await withStored({ aiDialogue: { enabled: false }, onlineCoaching: { enabled: true } });
    const { varyLine } = await import("@/lib/onlineVary");
    const { CHK_A01 } = await import("@/data/scenarios/chk-a01");

    const fetchImpl = vi.fn();
    const anchor = "집에 가야 해요.";
    const outcome = await varyLine(
      { scenario: CHK_A01, speaker: "elder", anchor, recentLines: [] },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(outcome.text).toBe(anchor);
    expect(outcome.varied).toBe(false);
    expect(outcome.fallback).toBe("disabled");
  });
});
