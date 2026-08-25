/**
 * 서비스워커 프리캐시 목록 — public/sw.js
 *
 * 오프라인에서 열려야 하는 주소는 세 곳에 적혀 있다. sw.js의 PRECACHE_URLS, /check 화면의
 * 점검 목록(src/app/check/_components/checks.ts), 그리고 각 라우트의 generateStaticParams다.
 * 뒤의 둘은 데이터(SCENARIOS·PROTOCOLS·SCENARIO_MATRIX)에서 만들어지지만, sw.js는 번들 밖
 * 정적 파일이라 import를 할 수 없어 **손으로 적은 목록 하나**가 남는다.
 *
 * 시나리오가 한 종 늘고 그 한 줄을 빠뜨리는 날, 증상은 에러가 아니다. 오프라인에서 /train
 * 주소가 서비스워커의 마지막 폴백에 걸려 응급 화면으로 바뀐다 — 화면은 뜨므로 아무도 실패라고
 * 느끼지 못한 채 「인터넷이 끊겨도 훈련 한 바퀴」만 조용히 어긋난다. 그 한 줄을 여기서 잡는다.
 *
 * 브라우저를 띄우지 않는다. 파일을 읽어 배열 리터럴을 파싱하고 데이터와 대조할 뿐이다.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SCENARIO_MATRIX } from "@/data/matrix";
import { PROTOCOLS } from "@/data/protocols";
import { SCENARIOS } from "@/data/scenarios";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = join(ROOT, "public");
const SW_SOURCE = readFileSync(join(PUBLIC_DIR, "sw.js"), "utf8");

/** sw.js에서 배열 리터럴을 읽어 온다 — 줄 주석은 지우고 따옴표 안만 거둔다. */
function readStringArray(source: string, name: string): string[] {
  const block = source.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`));
  if (!block?.[1]) throw new Error(`public/sw.js에서 ${name} 배열을 찾지 못했다`);
  const withoutComments = block[1]
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
  return [...withoutComments.matchAll(/"([^"]*)"/g)].map((match) => match[1] ?? "");
}

/** sw.js에서 문자열 상수 하나를 읽어 온다. */
function readStringConst(source: string, name: string): string {
  const match = source.match(new RegExp(`const ${name} = "([^"]*)";`));
  if (!match?.[1]) throw new Error(`public/sw.js에서 ${name} 상수를 찾지 못했다`);
  return match[1];
}

const PRECACHE_URLS = readStringArray(SW_SOURCE, "PRECACHE_URLS");

/** 응급 안내 — 목록 화면 + 프로토콜 5종. */
const EMERGENCY_ROUTES = [
  "/emergency",
  ...PROTOCOLS.map((protocol) => `/emergency/${protocol.id.toLowerCase()}`),
];

/** 훈련 한 바퀴 — 고르고, 한 판 돌고, 보고를 적고, 기록을 확인하는 데까지. */
const TRAINING_ROUTES = [
  "/train",
  ...SCENARIOS.map((scenario) => `/train/${scenario.id.toLowerCase()}`),
  "/report",
  "/history",
];

/**
 * 발표 중 곧바로 이어 여는 화면 — 비행기 모드 시연 **직후**에 열리는 자리다.
 *
 * 「그럼 안전 설계는 어떻게 되나요」로 /safety를 열었는데 응급 안내가 뜨면, 발표자도 심사위원도
 * 몇 초 동안 무슨 일이 났는지 모른다(주소는 /safety인데 화면이 다르다). 온라인에서 한 번 열어
 * 두면 회피되지만, 그 회피를 사람의 기억에 맡기지 않으려고 목록에 담고 여기서 못 박는다.
 */
const PRESENTATION_ROUTES = ["/safety", "/for-orgs", "/legal", "/history/certificate"];

describe("PRECACHE_URLS 파싱", () => {
  it("목록을 읽어 온다", () => {
    expect(PRECACHE_URLS.length).toBeGreaterThan(10);
    expect(PRECACHE_URLS.every((url) => url.startsWith("/"))).toBe(true);
  });

  it("같은 주소가 두 번 들어 있지 않다", () => {
    expect([...new Set(PRECACHE_URLS)]).toEqual(PRECACHE_URLS);
  });
});

describe("오프라인에서 열려야 하는 화면", () => {
  it("홈 화면이 들어 있다", () => {
    expect(PRECACHE_URLS).toContain("/");
  });

  it.each(EMERGENCY_ROUTES)("응급 %s 가 들어 있다", (route) => {
    expect(PRECACHE_URLS).toContain(route);
  });

  it.each(TRAINING_ROUTES)("훈련 %s 가 들어 있다", (route) => {
    expect(PRECACHE_URLS).toContain(route);
  });

  it.each(PRESENTATION_ROUTES)("발표 중 여는 %s 가 들어 있다", (route) => {
    expect(PRECACHE_URLS).toContain(route);
  });

  it("네비게이션 폴백 화면 자신도 저장 대상이다", () => {
    // 폴백 주소가 캐시에 없으면 오프라인 마지막 단계가 503 안내문으로 떨어진다.
    expect(PRECACHE_URLS).toContain(readStringConst(SW_SOURCE, "OFFLINE_FALLBACK_URL"));
  });
});

describe("없는 화면을 저장하려 들지 않는다", () => {
  it("훈련 주소는 전부 실재하는 시나리오다", () => {
    const listed = PRECACHE_URLS.filter((url) => url.startsWith("/train/"));
    expect(listed.sort()).toEqual(
      SCENARIOS.map((scenario) => `/train/${scenario.id.toLowerCase()}`).sort(),
    );
  });

  it("응급 주소는 전부 실재하는 프로토콜이다", () => {
    const listed = PRECACHE_URLS.filter((url) => url.startsWith("/emergency/"));
    expect(listed.sort()).toEqual(
      PROTOCOLS.map((protocol) => `/emergency/${protocol.id.toLowerCase()}`).sort(),
    );
  });

  it("파일 주소는 public/ 에 실제로 있다", () => {
    const files = PRECACHE_URLS.filter((url) => /\.[a-z0-9]+$/i.test(url));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(existsSync(join(PUBLIC_DIR, file)), `${file} 이 public/ 에 없다`).toBe(true);
    }
  });
});

describe("네트워크 우선 전략의 상한", () => {
  it("화면 이동이 네트워크를 무한정 기다리지 않는다", () => {
    // 상한이 없으면 「신호는 잡히는데 응답이 오지 않는 회선」에서 브라우저 기본 시간(수십 초)까지
    // 흰 화면이 유지된다. 저장해 둔 응급 화면이 바로 옆에 있는데도 그렇다.
    expect(SW_SOURCE).toMatch(/const NETWORK_TIMEOUT_MS = [\d_]+;/);
    const ms = Number((SW_SOURCE.match(/const NETWORK_TIMEOUT_MS = ([\d_]+);/)?.[1] ?? "0").replace(/_/g, ""));
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThanOrEqual(3_000);
  });
});

describe("빌드 도구와의 약속", () => {
  it("캐시 이름 자리는 stamp-sw.mjs가 찾는 형식 그대로다", () => {
    // prebuild(scripts/stamp-sw.mjs)가 이 정규식으로 해시를 갈아 끼운다.
    // 형식이 바뀌면 캐시 이름이 빌드마다 고정되어, 새 빌드에서도 죽은 청크가 기기에 남는다.
    expect(SW_SOURCE).toMatch(/const CACHE_NAME = "chimchak-[^"]*";/);
  });
});

describe("/check 화면이 쓰는 목록", () => {
  it("매트릭스에 열린 시나리오와 SCENARIOS가 같다", () => {
    // checks.ts의 훈련 라우트는 SCENARIO_MATRIX에서 만들어진다 — 둘이 어긋나면
    // 저장되지 않은 화면을 두고 「전부 저장됨」이라고 말하는 점검이 된다.
    const fromMatrix = SCENARIO_MATRIX.map((cell) => cell.scenarioId).filter(
      (id): id is string => typeof id === "string",
    );
    expect(fromMatrix.map((id) => id.toUpperCase()).sort()).toEqual(
      SCENARIOS.map((scenario) => scenario.id.toUpperCase()).sort(),
    );
  });
});
