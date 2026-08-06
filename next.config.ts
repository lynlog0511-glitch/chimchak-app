import type { NextConfig } from "next";

/**
 * 침착(ChimChak) Next 설정.
 *
 * headers()의 목적은 하나입니다 — **같은 바이트를 두 번 받지 않게 하는 것**.
 * 동봉 음성 4.9MB와 서브셋 폰트 429KB는 앱 용량의 대부분이면서 내용이 바뀌지 않습니다.
 * 기본값(`no-store`에 가까운 재검증)으로 두면 화면을 옮길 때마다 조건부 요청이 왕복하고,
 * 행사장 회선에서는 그 왕복이 그대로 음성 첫 재생 지연으로 나타납니다.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,

  async headers() {
    return [
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
