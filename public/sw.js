/*
 * 침착(ChimChak) 서비스워커
 *
 * 목적은 하나입니다 — **서버가 죽어도, 회선이 끊겨도 화면은 열린다.**
 * 설치 시점에 응급 라우트 5종과 목록 화면, 훈련 한 바퀴(시나리오 선택 → 세션 5종 → 보고 → 기록),
 * 매니페스트·아이콘·폰트를 미리 저장해 두고, 네트워크가 끊기면 저장해 둔 화면을 그대로 돌려줍니다.
 *
 * 캐시 전략
 *  - 화면 이동(navigate): 네트워크 우선(상한 NETWORK_TIMEOUT_MS) → 상한을 넘거나 실패하면
 *    캐시 → 그래도 없으면 네트워크를 끝까지 기다렸다가 /emergency 로 대체
 *  - 정적 자산(/_next/static, 아이콘, 매니페스트 등): 캐시 우선 → 없으면 네트워크
 *  - 사전 합성 음성(/audio/): 캐시 우선. 내용이 바뀌면 파일 이름이 바뀌므로 갱신 걱정이 없습니다.
 *  - 그 밖의 GET: 네트워크 우선 → 실패 시 캐시
 *
 * 지키는 규칙
 *  - GET·동일 출처 요청만 다룹니다. 외부로 나가는 요청은 건드리지 않습니다.
 *  - POST 응답은 저장하지 않습니다. **쿼리스트링이 붙은 GET 응답도 저장하지 않습니다** —
 *    찾을 때만 ignoreSearch로 같은 화면을 씁니다(?from=train 이 붙어도 저장본은 하나).
 *  - 프레임워크 내부 데이터 요청(?_rsc=)은 빌드마다 값이 달라져 캐시하지 않습니다.
 *
 * 등록은 프로덕션 빌드에서만 이뤄집니다(src/components/SwRegister.tsx).
 */

/*
 * 캐시 이름 — 빌드마다 자동으로 바뀝니다.
 *
 * `__CHIMCHAK_BUILD__` 자리는 `npm run build` 직전에 scripts/stamp-sw.mjs가
 * 소스 내용 해시로 바꿔 넣습니다. activate 단계가 이름이 다른 캐시를 전부 지우므로,
 * 새 빌드가 올라가면 이전 빌드의 죽은 `/_next/static/...` 청크가 함께 사라집니다.
 *
 * 손으로 버전을 올리던 때(`chimchak-v4`)에는 올리는 것을 잊는 순간
 * 낡은 HTML과 새 청크가 섞여 오프라인 화면이 조용히 깨졌습니다. 그 실수를 없앤 자리입니다.
 *
 * 개발 서버에서는 서비스워커를 아예 등록하지 않으므로(SwRegister.tsx),
 * 치환되지 않은 플레이스홀더가 그대로 남아 있어도 문제가 없습니다.
 */
const CACHE_NAME = "chimchak-__CHIMCHAK_BUILD__";

/**
 * 오프라인에서도 반드시 열려야 하는 화면·자산 목록입니다.
 *
 * 이 목록은 src/data/protocols.ts(P-01~P-05)·src/data/scenarios/index.ts(SCENARIOS)와
 * 같은 순서·같은 건수를 유지해야 합니다. 서비스워커는 번들 밖 정적 파일이라 데이터를 import할 수
 * 없어, 어긋남은 tests/swPrecache.test.ts가 대신 잡습니다.
 */
const PRECACHE_URLS = [
  "/",

  // 응급 — 서버가 죽어도 가장 먼저 열려야 하는 화면입니다.
  "/emergency",
  "/emergency/p-01",
  "/emergency/p-02",
  "/emergency/p-03",
  "/emergency/p-04",
  "/emergency/p-05",

  // 훈련 한 바퀴 — 고르고, 한 판 돌고, 보고를 적고, 기록을 확인하는 데까지입니다.
  // 여기를 비워 두면 오프라인에서 /train 주소가 아래 네비게이션 폴백에 걸려 응급 화면으로
  // 바뀝니다. 화면은 뜨니 아무도 눈치채지 못한 채, 「인터넷이 끊겨도 훈련 한 바퀴」라는
  // 약속만 무대에서 조용히 어긋납니다.
  "/train",
  "/train/chk-a01",
  "/train/chk-a02",
  "/train/chk-b01",
  "/train/chk-b02",
  "/train/chk-c01",
  "/train/chk-c02",
  "/report",
  "/history",
  // 도움말도 오프라인에서 열립니다 — 처음 오신 분이 회선 없는 자리에서 헤매지 않게.
  "/guide",
  // 온라인 전용 화면들도 게이트 화면(지금 오프라인입니다 안내)은 오프라인에서 떠야 합니다 —
  // 목록에 없으면 폴백이 응급 화면을 대신 돌려줘 주소와 화면이 어긋납니다.
  "/practice",
  "/console",

  // 발표 중 곧바로 이어 여는 화면 — 비행기 모드 시연 직후 「안전 설계는요?」로 열리는 자리들입니다.
  // 목록에 없으면 폴백이 응급 화면을 돌려줘, 주소는 /safety인데 화면이 다른 몇 초가 생깁니다.
  "/safety",
  "/for-orgs",
  "/legal",
  "/history/certificate",

  "/manifest.webmanifest",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  // 원본 2.0MB가 아니라 서브셋 429KB만 담습니다. 응급 화면 글자는 전부 서브셋 안에 있고,
  // 설치 때 2.0MB를 더 받는 것은 정작 급할 때 쓸 회선을 미리 써 버리는 일입니다.
  "/fonts/PretendardVariable.subset.woff2",
];

/**
 * 설치 때 HTTP 캐시를 건너뛰고 새로 받아야 하는 것은 **HTML 화면뿐**입니다.
 *
 * 예전에는 목록 전체를 `cache: "reload"`로 받았습니다. 그러면 방금 화면을 그리며 이미 받아 둔
 * 폰트·아이콘·매니페스트·해시 붙은 청크를 설치 단계가 한 번 더 내려받습니다 —
 * 같은 바이트를 두 번 받는 셈이고, 행사장 회선에서는 그대로 체감 지연이 됩니다.
 * 주소가 곧 버전인 자산(해시 파일명·서브셋 폰트·아이콘)은 기본 fetch로 받아
 * 브라우저 HTTP 캐시를 그대로 재사용합니다.
 */
const URL_VERSIONED = /\.(?:css|js|mjs|json|svg|png|jpg|jpeg|webp|avif|ico|woff2?|ttf|mp3|webmanifest)$/i;

function installRequest(url) {
  return URL_VERSIONED.test(url) ? new Request(url) : new Request(url, { cache: "reload" });
}

/**
 * 요청한 화면이 저장되어 있지 않을 때 마지막으로 보여 줄 화면입니다.
 *
 * 위 목록에 있는 주소는 자기 화면이 그대로 열리므로 여기까지 오지 않습니다.
 * 여기 걸리는 것은 **목록 밖 화면**(`/check`·`/practice/…` 상세처럼 목록에 올리지 않은 주소,
 * 그리고 앞으로 새로 생길 화면)을 오프라인에서 처음 여는 경우뿐이고, 그때는 주소와 다른 화면이
 * 뜹니다 — 그래도 응급 안내로 가는 길이 막히는 것보다 낫습니다.
 *
 * ※ 예시를 갱신했습니다: `/safety`·`/for-orgs`·`/legal`·`/history/certificate`는 위 목록에
 *   들어왔으므로 더는 「목록 밖」의 예가 아닙니다(페르소나 PM low — 목록을 늘리며 이 주석만
 *   낡아 있었습니다).
 */
const OFFLINE_FALLBACK_URL = "/emergency";

/**
 * 저장한 HTML에서 참조하는 정적 자산(/_next/static/...) 주소를 뽑아냅니다.
 *
 * HTML만 저장해 두면, 오프라인에서 화면은 뜨지만 하이드레이션에 필요한 청크가 없어
 * 단계 자동 진행·음성·이전/다음 버튼이 전부 죽고 정적 자막만 남습니다.
 * 홈에서 넘어오는 next/link 프리페치는 `?_rsc=` 요청이라 캐시에 담기지 않으므로,
 * 설치 단계에서 HTML을 읽어 자산 주소를 직접 수집합니다.
 */
function collectStaticAssets(html) {
  const found = new Set();
  const pattern = /["'(](\/_next\/static\/[^"')\s\\]+)["')]/g;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const href = match[1];
    // JSON 안에 escape 되어 들어간 조각(/ 등)은 건너뜁니다.
    if (href.includes("\\")) continue;
    found.add(href);
  }
  return [...found];
}

/**
 * 이번 설치가 실제로 참조한 `/_next/static/...` 목록을 캐시 안에 적어 두는 자리입니다.
 *
 * 화면이 요청하는 주소가 아니라 **서비스워커가 자기에게 남기는 쪽지**입니다(그래서 이름 앞에
 * `__`를 붙여 앱 라우트와 겹치지 않게 했습니다). activate 단계의 청소가 이 목록을 기준으로
 * 「지금 빌드가 참조하지 않는 청크」를 가려냅니다.
 */
const ASSET_INDEX_URL = "/__chimchak-assets.json";

/**
 * 한 번의 청소에서 지우는 항목 수 상한.
 *
 * 정상 흐름에서는 빌드마다 캐시 이름이 통째로 바뀌어(prebuild 해시) 낡은 캐시가 한 번에
 * 사라지므로 여기까지 올 일이 거의 없습니다. 여기가 필요해지는 것은 **캐시 이름이 어긋난**
 * 상황입니다 — 그때는 한 캐시 안에 여러 빌드의 청크가 겹겹이 쌓입니다(페르소나 FE P2).
 * 상한을 두는 이유는 activate가 길어지면 그동안 화면이 옛 워커에 붙어 있기 때문입니다.
 * 다 못 지운 나머지는 다음 활성화에서 이어서 지웁니다.
 */
const PRUNE_LIMIT = 200;

const OFFLINE_MESSAGE =
  "네트워크가 끊겨 있고 이 화면은 아직 저장되지 않았습니다. 응급 안내 화면(/emergency)은 그대로 열립니다.";

/* ── 사전 합성 음성 ────────────────────────────────────────── */

/** 동봉 음성이 놓인 자리입니다. 이 아래는 전부 캐시 우선으로 다룹니다. */
const AUDIO_PREFIX = "/audio/";

/** 음성 매니페스트 — { "문장": { "f": "파일명", "e": 1(응급만) } } */
const AUDIO_MANIFEST_URL = "/audio/manifest.json";

/**
 * 응급 프로토콜 음성만 골라 미리 저장합니다.
 *
 * 훈련 대사까지 전부 담으면 설치가 몇 MB짜리 작업이 되고, 정작 급할 때 필요한 것은
 * 응급 안내 여섯 단계입니다. 그래서 매니페스트에서 `e: 1`만 추려 담습니다.
 * **매니페스트를 못 읽어도 설치는 그대로 성공합니다** — 음성이 없으면 화면은 자막으로 진행되고,
 * 온라인일 때 fetch 핸들러가 하나씩 캐시에 채워 넣습니다.
 */
async function precacheEmergencyAudio(cache) {
  try {
    const response = await fetch(installRequest(AUDIO_MANIFEST_URL));
    if (!response || !response.ok) return;
    const manifest = await response.clone().json();
    await cache.put(AUDIO_MANIFEST_URL, response);

    const files = new Set();
    for (const key of Object.keys(manifest)) {
      const entry = manifest[key];
      if (entry && entry.e === 1 && typeof entry.f === "string") files.add(entry.f);
    }

    await Promise.all(
      [...files].map(async (name) => {
        const url = AUDIO_PREFIX + name;
        try {
          if (await cache.match(url)) return;
          // 음성 파일명은 내용 해시입니다 — HTTP 캐시에 있으면 그대로 씁니다.
          const audio = await fetch(installRequest(url));
          if (audio && audio.ok) await cache.put(url, audio);
        } catch {
          /* 개별 실패는 무시합니다 — 나머지 단계는 계속 담습니다. */
        }
      }),
    );
  } catch {
    /* 매니페스트가 없거나 네트워크가 끊긴 상태 — 설치를 실패시키지 않습니다. */
  }
}

/* ── 설치 ─────────────────────────────────────────────────── */

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // addAll은 하나라도 실패하면 설치 전체가 실패합니다.
      // 응급 화면 저장이 부분 실패해도 나머지는 남겨야 하므로 개별로 담습니다.
      const assets = new Set();
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            const response = await fetch(installRequest(url));
            if (!response || !response.ok) return;
            const type = response.headers.get("content-type") || "";
            if (type.includes("text/html")) {
              // 본문을 읽어야 하므로 복제한 뒤 저장합니다.
              const html = await response.clone().text();
              for (const href of collectStaticAssets(html)) assets.add(href);
            }
            await cache.put(url, response);
          } catch {
            /* 개별 실패는 무시합니다 — 설치는 계속 진행합니다. */
          }
        }),
      );

      // 저장한 화면들이 실제로 쓰는 청크·스타일까지 함께 담아야 오프라인에서도 살아 움직입니다.
      await Promise.all(
        [...assets].map(async (href) => {
          try {
            if (await cache.match(href)) return;
            // 청크 주소에는 빌드 해시가 박혀 있습니다 — 방금 화면이 받아 둔 것을 다시 씁니다.
            const response = await fetch(installRequest(href));
            if (response && response.ok) await cache.put(href, response);
          } catch {
            /* 개별 실패는 무시합니다. */
          }
        }),
      );

      /* 이번 빌드가 참조하는 자산 목록을 캐시에 적어 둡니다 — activate의 청소가 이것만 봅니다.
         **한 건도 못 모았으면 적지 않습니다**: 회선이 끊긴 채 설치되면 목록이 비는데, 그 빈
         목록을 적어 두면 다음 청소가 「아무것도 참조하지 않는다」고 읽고 멀쩡한 청크를 전부
         지웁니다. 못 적으면 청소만 건너뛸 뿐 설치는 그대로 성공합니다. */
      if (assets.size > 0) {
        try {
          await cache.put(
            ASSET_INDEX_URL,
            new Response(JSON.stringify([...assets]), {
              headers: { "content-type": "application/json" },
            }),
          );
        } catch {
          /* 쪽지를 못 남겨도 설치는 계속합니다. */
        }
      }

      // 응급 프로토콜 음성 — 실패해도 설치는 계속됩니다.
      await precacheEmergencyAudio(cache);

      await self.skipWaiting();
    })(),
  );
});

/* ── 활성화 ───────────────────────────────────────────────── */

/**
 * 지금 캐시 **안에서** 이번 빌드가 참조하지 않는 `/_next/static/...`을 지웁니다.
 *
 * 이름이 다른 캐시는 아래 activate가 통째로 지우므로 보통은 이 함수가 할 일이 없습니다.
 * 할 일이 생기는 것은 **캐시 이름이 어긋난 채 새 워커가 올라온 경우**입니다 — 그때는 한 캐시
 * 안에 지난 빌드의 죽은 청크와 이번 빌드의 청크가 함께 쌓이고, 상한이 없으면 배포마다 자랍니다
 * (페르소나 FE P2 — 1차 지적 13의 후반부).
 *
 * 기준은 설치 단계가 남긴 쪽지(`ASSET_INDEX_URL`) 하나뿐입니다. 쪽지가 없거나 비어 있으면
 * **아무것도 지우지 않습니다** — 판단할 근거가 없을 때는 남겨 두는 쪽이 안전합니다.
 * 실수로 지워도 온라인이면 fetch 핸들러가 다시 채우지만, 오프라인 시연 중이면 되돌릴 길이 없습니다.
 */
async function pruneStaleAssets() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const indexed = await cache.match(ASSET_INDEX_URL);
    if (!indexed) return;
    const list = await indexed.json();
    if (!Array.isArray(list) || list.length === 0) return;

    const keep = new Set(list);
    const requests = await cache.keys();
    let removed = 0;
    for (const request of requests) {
      if (removed >= PRUNE_LIMIT) break;
      const path = new URL(request.url).pathname;
      if (!path.startsWith("/_next/static/")) continue;
      if (keep.has(path)) continue;
      await cache.delete(request);
      removed += 1;
    }
  } catch {
    /* 청소는 부가 작업입니다 — 실패해도 화면은 그대로 열립니다. */
  }
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
      // 같은 이름의 캐시 안에 남은 지난 빌드 청크까지 거둡니다(위 함수 주석).
      await pruneStaleAssets();
      await self.clients.claim();
    })(),
  );
});

/* ── 요청 가로채기 ────────────────────────────────────────── */

const STATIC_EXTENSION = /\.(?:css|js|mjs|json|svg|png|jpg|jpeg|webp|avif|ico|woff2?|ttf)$/i;

/** 내용이 바뀌지 않는(또는 해시가 붙는) 정적 자산인지 판별합니다. */
function isStaticAsset(url) {
  if (url.pathname.startsWith("/_next/static/")) return true;
  if (url.pathname === "/icon.svg") return true;
  if (url.pathname === "/manifest.webmanifest") return true;
  return STATIC_EXTENSION.test(url.pathname);
}

/** 저장해도 되는 응답인지 확인합니다(동일 출처 200 응답만). */
function isCacheable(response) {
  return Boolean(response) && response.ok && response.type === "basic";
}

function offlineResponse() {
  return new Response(OFFLINE_MESSAGE, {
    status: 503,
    statusText: "Service Unavailable",
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

/**
 * 네트워크를 기다리는 상한(ms).
 *
 * 상한이 없으면 「신호는 잡히는데 응답이 오지 않는 회선」에서 브라우저 기본 시간(수십 초)까지
 * 흰 화면이 유지됩니다 — 저장해 둔 응급 화면이 바로 옆에 있는데도요. 상한을 넘으면 캐시를
 * 먼저 돌려주고, 뒤늦게 온 응답은 다음 방문을 위해 캐시만 갱신합니다.
 */
const NETWORK_TIMEOUT_MS = 2_500;

/** 쿼리스트링이 붙은 요청인지 — 붙었으면 저장하지 않습니다(찾을 때만 ignoreSearch). */
function requestHasQuery(request) {
  try {
    return new URL(request.url).search.length > 0;
  } catch {
    return false;
  }
}

/** 네트워크 우선(상한 있음) — 늦거나 실패하면 저장해 둔 화면을 돌려줍니다. */
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  // 실패는 null로 눕혀 한 갈래로 다룹니다(미처리 거부가 남지 않게).
  const fetching = fetch(request)
    .then((response) => {
      if (isCacheable(response) && !requestHasQuery(request)) {
        cache.put(request, response.clone()).catch(() => undefined);
      }
      return response;
    })
    .catch(() => null);

  const raced = await Promise.race([
    fetching,
    new Promise((resolve) => {
      setTimeout(() => resolve("timeout"), NETWORK_TIMEOUT_MS);
    }),
  ]);
  if (raced && raced !== "timeout") return raced;

  // 저장해 둔 화면이 먼저입니다 — 폴백은 그다음입니다.
  // 쿼리스트링(?from=train 등)이 붙어도 같은 화면을 찾도록 ignoreSearch를 씁니다.
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;

  // 캐시가 없으면 상한을 접고 끝까지 기다립니다 — 늦은 응답이라도 빈 안내문보다 낫습니다.
  const late = await fetching;
  if (late) return late;

  if (request.mode === "navigate") {
    const fallback = await cache.match(OFFLINE_FALLBACK_URL);
    if (fallback) return fallback;
  }
  return offlineResponse();
}

/** 캐시 우선 — 저장된 것이 있으면 네트워크를 기다리지 않습니다. */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: false });
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (isCacheable(response) && !requestHasQuery(request)) {
      const copy = response.clone();
      cache.put(request, copy).catch(() => undefined);
    }
    return response;
  } catch {
    return offlineResponse();
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (url.origin !== self.location.origin) return;
  if (url.protocol !== "http:" && url.protocol !== "https:") return;
  if (url.searchParams.has("_rsc")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  // 사전 합성 음성 — 파일 이름이 내용에 묶여 있어 갱신을 신경 쓸 필요가 없습니다.
  // 한 번 재생한 대사는 그대로 남아, 다음부터는 네트워크 없이도 같은 목소리가 납니다.
  if (url.pathname.startsWith(AUDIO_PREFIX)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(networkFirst(request));
});
