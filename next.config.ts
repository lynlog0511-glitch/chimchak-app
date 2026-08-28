import type { NextConfig } from "next";

/**
 * 침착(ChimChak) Next 설정.
 *
 * headers()가 하는 일은 두 가지입니다.
 *  ① **같은 바이트를 두 번 받지 않게 하는 것** — 동봉 음성 4.9MB와 서브셋 폰트 429KB는
 *    앱 용량의 대부분이면서 내용이 바뀌지 않습니다. 기본값(`no-store`에 가까운 재검증)으로 두면
 *    화면을 옮길 때마다 조건부 요청이 왕복하고, 행사장 회선에서는 그 왕복이 그대로
 *    음성 첫 재생 지연으로 나타납니다.
 *  ② **나갈 곳이 없다는 사실을 헤더로 못 박는 것** — 아래 보안 헤더입니다.
 */

/** 개발 서버에서만 풀어 주는 자리가 있습니다 — 배포 빌드에는 들어가지 않습니다. */
const isDev = process.env.NODE_ENV !== "production";

/**
 * 콘텐츠 보안 정책(CSP).
 *
 * 브라우저는 다른 도메인을 부르지 않습니다. 화면 코드에서 `fetch(`를 쓰는 곳은 셋
 * (`src/lib/onlineCoach.ts`·`onlineVary.ts`·`onlineFree.ts`)이고, 셋 다 부르는 주소는 같은
 * 도메인의 `/api/coach` 하나입니다 — 상류 제공사는 그 뒤에서 **서버가** 부릅니다
 * (`src/app/api/coach/route.ts`).
 *
 * 그래서 `connect-src`는 온라인 코칭을 켜든 끄든 `'self'` 하나입니다. 한때 여기에는
 * `NEXT_PUBLIC_LLM_ORIGIN`을 읽어 허용 origin 한 칸을 더하는 분기가 있었습니다. 그 분기가
 * 사라진 것이 서버 프록시 전환의 증명입니다 — 브라우저가 나갈 곳이 늘지 않았고, 늘 필요가
 * 없어졌으므로 목록도 다시 좁아졌습니다.
 *
 * 좁히지 못한 자리는 두 곳이고, 둘 다 사유를 적어 둡니다.
 *
 * · `script-src`의 `'unsafe-inline'` — 프레임워크가 하이드레이션 데이터를 인라인 <script>로
 *   심습니다. 빼면 화면이 뜨자마자 죽습니다. 없애려면 요청마다 값이 달라지는 nonce가 필요한데,
 *   그 값은 정적 HTML을 서비스워커에 저장해 두는 이 앱의 오프라인 경로와 맞지 않습니다.
 * · `media-src`의 `data:` — 오디오 잠금 해제에 쓰는 무음 WAV가 data URI입니다
 *   (src/lib/speech.ts의 SILENT_WAV). 여기를 `'self'`로만 두면 무음 재생이 차단되어
 *   **응급 안내의 자동 낭독이 조용히 자막만 남습니다**. 재생 자체가 죽는 것보다 위험한,
 *   무대에서 가장 알아채기 어려운 형태입니다.
 *
 * `style-src`의 `'unsafe-inline'`은 게이지 폭처럼 값이 계산되는 인라인 style 속성 때문입니다.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  // 개발 서버의 HMR은 eval을 씁니다. 배포 빌드에서는 붙지 않습니다.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "media-src 'self' data:",
  "font-src 'self'",
  /* 개발 서버의 HMR 소켓(ws:)만 예외이고, 배포 빌드에서는 붙지 않습니다.
     온라인 코칭을 켜도 이 줄은 그대로입니다 — 브라우저가 부르는 곳은 같은 출처뿐입니다. */
  `connect-src 'self'${isDev ? " ws:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  /* 플러그인 객체(<object>·<embed>)는 이 앱이 한 번도 쓰지 않습니다. 적어 두지 않으면
     `default-src 'self'`로 폴백되어 동일 출처 객체가 허용된 상태로 남습니다 — 쓰지 않는 문은
     열어 둘 이유가 없습니다. */
  "object-src 'none'",
  /* 폼 전송지를 같은 출처로 묶습니다. 이 앱에는 서버로 보내는 폼이 없지만, 스크립트 주입이
     한 번 성공했을 때 값을 남의 주소로 실어 보내는 길을 CSP 쪽에서 막아 두는 자리입니다. */
  "form-action 'self'",
].join("; ");

/**
 * 전 경로 공통 보안 헤더.
 *
 * `Permissions-Policy`의 마이크만 열어 둡니다 — 훈련 화면의 음성 인식이 쓰는 유일한 장치이고,
 * 카메라·위치는 이 앱이 한 번도 요청하지 않으므로 빈 목록으로 잠급니다.
 *
 * ※ **`Strict-Transport-Security`가 여기 없는 이유**를 적어 둡니다. HSTS는 배포 플랫폼
 *   (Vercel 등)이 도메인 단위로 붙여 주므로 앱이 다시 적을 필요가 없습니다. 다만 **자체 호스팅으로
 *   옮기면 그 순간 조용히 사라집니다** — 이 목록만 보고 옮기면 아무 경고 없이 빠지는 헤더라,
 *   옮기는 사람이 앞단(nginx·로드밸런서)에서 직접 붙이도록 이 문장을 남깁니다.
 *   `X-Frame-Options`는 위 CSP의 `frame-ancestors 'none'`이 대신하므로 일부러 두지 않습니다.
 */
const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,

  /* 프레임워크 이름과 버전대를 응답 헤더로 알리지 않습니다(`X-Powered-By: Next.js`).
     막아 주는 공격은 없지만, 알릴 이유도 없는 정보입니다. */
  poweredByHeader: false,

  async headers() {
    return [
      {
        /* 모든 화면·자산에 같은 보안 헤더를 붙입니다. 아래 캐시 규칙과는 키가 겹치지 않아
           같은 주소에 두 규칙이 함께 적용됩니다. */
        source: "/(.*)",
        headers: SECURITY_HEADERS,
      },
      {
        /*
         * 사전 합성 음성 — 파일 이름이 곧 내용 해시입니다(scripts/synthesize-audio.py).
         * 대사가 바뀌면 파일 이름이 바뀌므로, 같은 이름의 파일은 영원히 같은 내용입니다.
         * `.mp3`만 골라 잡습니다 — 같은 폴더의 manifest.json은 이름이 고정이라 제외해야 합니다.
         */
        source: "/audio/:file(.*\\.mp3)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        /*
         * 음성 매니페스트 — 이름이 고정이고 대사를 다시 합성할 때마다 내용이 바뀝니다.
         * 여기에 immutable을 걸면 새 대사의 음성 파일을 영영 못 찾습니다(자막만 남습니다).
         * 그래서 매번 재검증하되, 바뀌지 않았으면 304로 끝나게 둡니다.
         */
        source: "/audio/manifest.json",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
      {
        /*
         * 동봉 폰트.
         *
         * ※ 파일 이름에 해시가 없습니다. 서브셋을 다시 만들어 **내용이 바뀌면 파일 이름의 버전도
         *   함께 올려야 합니다**(scripts/subset-font.py가 끝에 다시 알려 줍니다).
         *   이름을 그대로 두고 내용만 바꾸면 이미 받아 간 기기는 1년 동안 옛 폰트를 씁니다.
         */
        source: "/fonts/:file*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        /*
         * 서비스워커 본체는 절대 캐시하지 않습니다.
         * 캐시되면 새 빌드의 CACHE_NAME이 기기에 닿지 못해, 죽은 청크를 지우려고 만든
         * 빌드 해시 주입(scripts/stamp-sw.mjs)이 통째로 무력해집니다.
         */
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
