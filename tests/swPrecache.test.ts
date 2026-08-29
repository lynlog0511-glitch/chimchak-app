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
// postbuild 게이트의 판정 함수 — 산출물 없이 가짜 원문으로 시험한다(아래 마지막 블록).
import { PLACEHOLDER, stampProblem } from "../scripts/verify-sw-stamp.mjs";

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

/**
 * 응급 안내 — 목록 화면 + 프로토콜 전 종.
 *
 * 건수를 여기 적지 않는 것이 이 배열의 요점이다. 프로토콜이 한 종 늘면 이 목록이 먼저 늘고,
 * sw.js가 따라오지 않으면 아래 두 블록이 양쪽에서 잡는다 — 「데이터에 있는데 목록에 없다」와
 * 「목록에 있는데 데이터에 없다」. 2026-08-30 P-06(문 잠김·무응답)이 그 경로로 들어왔다.
 */
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
  /*
   * 여기서 보는 것은 **형식뿐이다 — public/sw.js의 「값」은 단언하지 않는다.**
   *
   * 이 파일이 읽는 것은 러너가 도는 순간의 **작업 트리**인데, 그 값은 빌드가 제자리에서 바꾼다.
   * prebuild(scripts/stamp-sw.mjs)가 캐시 이름 자리에 내용 해시를 박고 되돌리지 않는다 —
   * 되돌리면 `npm run start`가 되돌아간 파일을 서빙해 오프라인 시연이 그대로 깨지기 때문이고,
   * 그 판단은 그 스크립트 머리 주석에 적혀 있다. 그래서 값을 단언하면 검사 결과가 「지금 이 트리가
   * 빌드 전인가 후인가」에 묶인다 — 클린 체크아웃에서 초록이면 빌드 뒤에 붉고, 그 반대로 뒤집어도
   * 마찬가지다. 어느 방향이든 팀이 실제로 밟는 절차(오프라인 시연 = `npm run build && npm start`)
   * 한쪽이 붉어진다. 두 라운드 연속으로 방향만 바뀐 자리라(페르소나 FE med ×2) 값 단언을 걷는다.
   *
   * 역할 분담 — 셋은 보는 대상이 다르므로 어느 하나가 다른 것을 대신하지 못한다.
   *  · 여기(소스 형식): 캐시 이름 줄이 stamp-sw.mjs가 찾는 **모양**인지만 본다. 플레이스홀더도
   *    스탬프된 해시도 통과한다 — 스탬프 전후 어느 상태에서 돌려도 같은 결과가 나와야 한다.
   *  · postbuild(scripts/verify-sw-stamp.mjs): **산출물의 값**을 본다. 빌드가 끝난 시점에 실제로
   *    서빙될 파일에 해시가 박혔는지 확인하고, 플레이스홀더가 남아 있으면 빌드를 실패시킨다.
   *    (그 판정 함수는 아래 블록에서 가짜 원문으로 따로 시험한다 — 산출물이 없어도 도는 검사다.)
   *  · 커밋 위생(사람이 밟는 절차): 저장소의 정본은 **플레이스홀더**다. 스탬프된 sw.js가 커밋되면
   *    이후 빌드에서 캐시 이름이 고정돼 캐시 무효화가 죽는다(8/25 실사고). 그러니 빌드하고
   *    `npm start` 시연까지 끝난 뒤, 커밋 전에 public/sw.js를 플레이스홀더로 되돌린다.
   * **테스트가 세 번째 몫까지 맡으려 들면** 단언이 작업 트리 상태에 묶여 러너가 시점을 탄다.
   */
  const CACHE_NAME_LINE = /const CACHE_NAME = "chimchak-[^"]*";/;

  it("캐시 이름 자리는 stamp-sw.mjs가 찾는 형식 그대로다", () => {
    // prebuild(scripts/stamp-sw.mjs)가 이 정규식으로 해시를 갈아 끼운다.
    // 형식이 바뀌면 캐시 이름이 빌드마다 고정되어, 새 빌드에서도 죽은 청크가 기기에 남는다.
    expect(SW_SOURCE).toMatch(CACHE_NAME_LINE);
  });

  it("그 형식 검사는 스탬프 전후 어느 상태에서도 같은 결과를 낸다", () => {
    /* 이 블록이 빌드 시점을 타지 않는다는 사실 자체를 못 박아 둔다 — 다음 사람이 여기에
       값 단언을 다시 들이면(예: 플레이스홀더여야 한다·해시여야 한다) 이 두 줄과 어긋난다. */
    expect(`const CACHE_NAME = "chimchak-${PLACEHOLDER}";`).toMatch(CACHE_NAME_LINE);
    expect('const CACHE_NAME = "chimchak-bd6e1c635e38";').toMatch(CACHE_NAME_LINE);
  });
});

describe("postbuild 스탬프 검증(scripts/verify-sw-stamp.mjs)", () => {
  /* 산출물을 만들지 않고 **가짜 원문**으로 판정 함수만 시험한다 — 빌드는 이 러너의 몫이 아니다.
     여기서 `SW_SOURCE`를 넣어 보지 않는 이유는 위 블록의 역할 분담 주석에 적어 두었다:
     작업 트리의 sw.js는 빌드가 제자리에서 바꾸는 파일이라, 그 값을 단언하는 순간 검사가
     「지금 트리가 빌드 전인가 후인가」를 재게 된다. 값은 postbuild가 산출물에 대해 본다. */
  it("해시가 박힌 원문은 통과한다", () => {
    expect(stampProblem('const CACHE_NAME = "chimchak-bd6e1c635e38";')).toBeNull();
  });

  it("치환되지 않은 플레이스홀더는 걸린다", () => {
    const problem = stampProblem(`const CACHE_NAME = "chimchak-${PLACEHOLDER}";`);
    expect(problem).toContain("플레이스홀더");
  });

  it("빈 값도 걸린다", () => {
    expect(stampProblem('const CACHE_NAME = "chimchak-";')).toContain("비어 있");
  });

  it("캐시 이름 줄 자체가 없으면 걸린다", () => {
    expect(stampProblem("const CACHE = 'chimchak-x';")).toContain("찾지 못했");
  });

  it("주석이 플레이스홀더를 설명하는 것만으로는 걸리지 않는다", () => {
    /* sw.js 머리 주석은 「`__CHIMCHAK_BUILD__` 자리는 …」이라고 그 이름을 문자열로 적어 둔다.
       파일 전체를 훑는 방식이었다면 정상 빌드가 언제나 실패했을 자리다. */
    const source = `/* ${PLACEHOLDER} 자리는 prebuild가 채웁니다. */\nconst CACHE_NAME = "chimchak-abc123";`;
    expect(stampProblem(source)).toBeNull();
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
