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
 * 이 앱은 외부 API를 부르지 않고(화면 코드 src/ 전체에 `fetch(` 0건 — 서비스워커의 동일 출처
 * 요청이 전부입니다), 외부 스크립트·폰트·이미지도 싣지 않습니다. 그래서 넓게 적어 둘 이유가
 * 없습니다 — 이미 참인 사실을 그대로 옮겼습니다.
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
  // 개발 서버의 HMR 소켓(ws:)도 배포 빌드에서는 붙지 않습니다.
  `connect-src 'self'${isDev ? " ws:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
].join("; ");

/**
 * 전 경로 공통 보안 헤더.
 *
 * `Permissions-Policy`의 마이크만 열어 둡니다 — 훈련 화면의 음성 인식이 쓰는 유일한 장치이고,
 * 카메라·위치는 이 앱이 한 번도 요청하지 않으므로 빈 목록으로 잠급니다.
 */
const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,

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
