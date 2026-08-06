/*
 * 침착(ChimChak) 서비스워커
 *
 * 목적은 하나입니다 — **서버가 죽어도 응급 화면은 열린다.**
 * 설치 시점에 응급 라우트 5종과 목록 화면, 매니페스트·아이콘을 미리 저장해 두고,
 * 네트워크가 끊기면 저장해 둔 화면을 그대로 돌려줍니다.
 *
 * 캐시 전략
 *  - 화면 이동(navigate): 네트워크 우선 → 실패 시 캐시 → 그래도 없으면 /emergency 로 대체
 *  - 정적 자산(/_next/static, 아이콘, 매니페스트 등): 캐시 우선 → 없으면 네트워크
 *  - 사전 합성 음성(/audio/): 캐시 우선. 내용이 바뀌면 파일 이름이 바뀌므로 갱신 걱정이 없습니다.
 *  - 그 밖의 GET: 네트워크 우선 → 실패 시 캐시
 *
 * 지키는 규칙
 *  - GET·동일 출처 요청만 다룹니다. 외부로 나가는 요청은 건드리지 않습니다.
 *  - 개인정보가 담길 수 있는 POST·쿼리 응답은 저장하지 않습니다.
 *  - 프레임워크 내부 데이터 요청(?_rsc=)은 빌드마다 값이 달라져 캐시하지 않습니다.
 *
 * 등록은 프로덕션 빌드에서만 이뤄집니다(src/components/SwRegister.tsx).
 */

/* 캐시 이름의 버전을 올리면 이전 캐시는 activate 단계에서 전부 지워집니다. */
const CACHE_NAME = "chimchak-v4";

/** 오프라인에서도 반드시 열려야 하는 화면·자산 목록입니다. */
const PRECACHE_URLS = [
  "/",
  "/emergency",
  "/emergency/p-01",
  "/emergency/p-02",
  "/emergency/p-03",
  "/emergency/p-04",
  "/emergency/p-05",
  "/manifest.webmanifest",
  "/icon.svg",
  "/fonts/PretendardVariable.woff2",
];

/** 저장된 화면이 하나도 없을 때 마지막으로 보여 줄 화면입니다. */
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
    const response = await fetch(new Request(AUDIO_MANIFEST_URL, { cache: "reload" }));
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
          const audio = await fetch(new Request(url, { cache: "reload" }));
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
            const response = await fetch(new Request(url, { cache: "reload" }));
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
            const response = await fetch(new Request(href, { cache: "reload" }));
            if (response && response.ok) await cache.put(href, response);
          } catch {
            /* 개별 실패는 무시합니다. */
          }
        }),
      );

      // 응급 프로토콜 음성 — 실패해도 설치는 계속됩니다.
      await precacheEmergencyAudio(cache);

      await self.skipWaiting();
    })(),
  );
});

/* ── 활성화 ───────────────────────────────────────────────── */

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
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

/** 네트워크 우선 — 실패하면 저장해 둔 화면을 돌려줍니다. */
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (isCacheable(response)) {
      const copy = response.clone();
      cache.put(request, copy).catch(() => undefined);
    }
    return response;
  } catch {
    // 쿼리스트링(?from=train 등)이 붙어도 같은 화면을 찾도록 ignoreSearch를 씁니다.
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === "navigate") {
      const fallback = await cache.match(OFFLINE_FALLBACK_URL);
      if (fallback) return fallback;
    }
    return offlineResponse();
  }
}

/** 캐시 우선 — 저장된 것이 있으면 네트워크를 기다리지 않습니다. */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: false });
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (isCacheable(response)) {
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
