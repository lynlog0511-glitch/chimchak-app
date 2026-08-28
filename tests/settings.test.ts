/**
 * 설정 — src/lib/settings.ts
 *
 * 이 파일이 지키는 것은 하나다: **스위치가 둘로 갈린 날(2026-08-28)의 마이그레이션 불변식.**
 *
 *  ① 이미 켜 둔 사람의 동의 범위가 줄지 않는다 — 옛 스위치를 켠 기기는 갈라진 뒤에도
 *    코칭 보조와 대사 변주를 함께 받는다.
 *  ② 켜지 않은 사람에게 **발화 전송이 새로 켜지지 않는다** — `onlineCoaching`이 참이 되는 길은
 *    저장된 `true` 하나뿐이다. 이 앱에서 사용자의 말이 기기 밖으로 나가는 문이라 가장 무거운 줄이다.
 *  ③ 사용자가 **직접 끈 어르신 연기**를 새 기본값이 다시 켜 주지 않는다.
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
  it("저장된 값이 없으면 어르신 연기는 켜짐, 발화 전송은 꺼짐이다", async () => {
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
      name: "④ 새 값 — 사용자가 끈 어르신 연기는 꺼진 채로 남는다",
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

  it("어르신 연기를 켜는 것이 발화 전송을 켜지 않는다", async () => {
    const settings = await withStored({ onlineCoaching: { enabled: false } });
    const next = settings.setAiDialogue({ enabled: true });

    expect(next.aiDialogue.enabled).toBe(true);
    expect(next.onlineCoaching.enabled).toBe(false);
    expect(settings.loadSettings().onlineCoaching.enabled).toBe(false);
  });

  it("발화 전송을 끄는 것이 어르신 연기를 끄지 않는다", async () => {
    const settings = await withStored({ onlineCoaching: { enabled: true } });
    const next = settings.setOnlineCoaching({ enabled: false });

    expect(next.onlineCoaching.enabled).toBe(false);
    expect(next.aiDialogue.enabled).toBe(true);
  });
});

/* ── 사용자가 끈 값은 남는다 ───────────────────────────── */

describe("끈 값의 왕복 — 새 기본값이 사용자의 선택을 덮지 않는다", () => {
  it("어르신 연기를 끄면 저장되고, 다시 읽어도 꺼짐이다", async () => {
    const settings = await withStored(undefined);
    settings.setAiDialogue({ enabled: false });

    // 같은 모듈에서 한 번, 저장된 문자열을 새 모듈이 다시 읽어 한 번.
    expect(settings.loadSettings().aiDialogue.enabled).toBe(false);

    vi.resetModules();
    const reloaded = await import("@/lib/settings");
    expect(reloaded.loadSettings().aiDialogue.enabled).toBe(false);
  });

  it("끈 뒤 다시 켜면 켜진 채로 남는다", async () => {
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

  it("어르신 연기 고지는 발화가 나가지 않는다고 적는다", async () => {
    const settings = await withStored(undefined);

    expect(settings.AI_DIALOGUE_NOTICE).toContain("하신 말씀은 나가지 않습니다");
  });

  it("발화 전송 고지는 전송 범위 셋(가명처리·상황 훈련 한 문장·자유 연습)을 그대로 들고 있다", async () => {
    const settings = await withStored(undefined);

    expect(settings.ONLINE_COACHING_NOTICE).toContain("가명처리");
    expect(settings.ONLINE_COACHING_NOTICE).toContain("그 한 문장뿐입니다");
    expect(settings.ONLINE_COACHING_NOTICE).toContain("자유 연습");
  });

  it("두 스위치가 같은 켜기·끄기 두 낱말을 쓴다", async () => {
    const settings = await withStored(undefined);

    expect(settings.SWITCH_OPTIONS.map((option) => option.label)).toEqual(["끄기", "켜기"]);
  });
});

/* ── 변주가 보는 칸 ────────────────────────────────────── */

describe("isLineVaryActive — 보는 칸은 어르신 연기 하나다", () => {
  it("저장된 값이 없으면(기본 상태) 비응급 시나리오에서 돈다", async () => {
    await withStored(undefined);
    const { isLineVaryActive } = await import("@/lib/onlineVary");
    const { CHK_A01 } = await import("@/data/scenarios/chk-a01");

    expect(isLineVaryActive(CHK_A01)).toBe(true);
  });

  it("응급 유형은 켜 두어도 돌지 않는다 (L3 원칙)", async () => {
    await withStored(undefined);
    const { isLineVaryActive } = await import("@/lib/onlineVary");
    const { CHK_B01 } = await import("@/data/scenarios/chk-b01");

    expect(isLineVaryActive(CHK_B01)).toBe(false);
  });

  it("어르신 연기를 끄면 발화 전송이 켜져 있어도 돌지 않는다", async () => {
    await withStored({ aiDialogue: { enabled: false }, onlineCoaching: { enabled: true } });
    const { isLineVaryActive } = await import("@/lib/onlineVary");
    const { CHK_A01 } = await import("@/data/scenarios/chk-a01");

    expect(isLineVaryActive(CHK_A01)).toBe(false);
  });

  it("발화 전송만 꺼져 있어도 어르신 연기는 그대로 돈다 (옛 스위치를 안 켠 기기)", async () => {
    await withStored({ onlineCoaching: { enabled: false } });
    const { isLineVaryActive } = await import("@/lib/onlineVary");
    const { CHK_A01 } = await import("@/data/scenarios/chk-a01");

    expect(isLineVaryActive(CHK_A01)).toBe(true);
  });

  it("varyLine은 어르신 연기가 꺼져 있으면 네트워크를 부르지 않고 앵커를 돌려준다", async () => {
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
