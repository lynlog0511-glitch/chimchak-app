/**
 * ESLint 최소본 — CI 게이트 4 (`npm run lint`).
 *
 * 왜 두는가: tsc가 볼 수 있는 사각은 이미 다 보고 있습니다(strict 통과·미사용 지역 변수 0).
 * 남은 사각이 정확히 훅 생명주기와 접근성입니다 — 이 앱의 결함은 useEffect 의존성과 aria 표기에서
 * 나오는데, 그 계열은 타입 검사에도 엔진 회귀 검사에도 걸리지 않습니다.
 *
 * 켜는 것은 `next/core-web-vitals`(= @next/next 권장 + react-hooks + jsx-a11y) 하나뿐입니다.
 * 여기서 새 규칙을 만들지 않습니다 — 게이트는 「지금 코드가 에러 0으로 통과하는 선」에서 출발하고,
 * 그 위에 무엇을 더 켤지는 파일럿 전환 때 따로 정합니다.
 *
 * 끈 규칙은 아래 두 개뿐이고, 둘 다 사유가 「지금 걸려서」가 아니라 「이 저장소에서는 규칙이
 * 가리키는 방향이 반대라서」입니다. 사유가 사라지면 그 줄도 함께 지웁니다.
 */

import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  {
    // 생성물·정적 자산·빌드 도구 스크립트는 검사 대상이 아닙니다.
    ignores: [".next/**", "out/**", "node_modules/**", "public/**", "scripts/**", "next-env.d.ts"],
  },

  ...compat.extends("next/core-web-vitals"),

  {
    rules: {
      /**
       * exhaustive-deps는 **경고로 둡니다**(끄지 않습니다).
       * 감사 권고대로 error가 아닌 warn으로 출발해 목록만 확보합니다. 지금 걸리는 건수는 0이고,
       * 앞으로 생기면 CI를 붉히지 않으면서 로그에 남습니다 — `--max-warnings`를 걸지 않는 이유입니다.
       */
      "react-hooks/exhaustive-deps": "warn",

      /**
       * off ① `@next/next/no-img-element`
       * 사유: 이 앱은 next/image를 쓰지 않습니다(참조 0건). 이미지 최적화 경로를 열지 않는 것이
       * 오프라인 시연·의존성 노출면 판단이라, 「img 대신 Image를 쓰라」는 권고가 여기서는 반대
       * 방향입니다. 실제 이미지 자산도 public/icon.svg 하나뿐입니다.
       */
      "@next/next/no-img-element": "off",
    },
  },

  {
    files: ["src/app/global-error.tsx"],
    rules: {
      /**
       * off ② `@next/next/no-html-link-for-pages` (이 파일에서만)
       * 사유: global-error는 루트 레이아웃째로 대체되는 화면이라 앱 셸이 이미 무너진 뒤에 그려집니다.
       * 그 상태에서 next/link의 클라이언트 전환에 기대면 「응급 안내 열기」가 눌리지 않을 수 있어,
       * 여기서는 일부러 전체 문서를 다시 받는 `<a>`를 씁니다. 응급 화면으로 나가는 길이라
       * 라우팅 최적화보다 확실히 열리는 쪽이 먼저입니다.
       */
      "@next/next/no-html-link-for-pages": "off",
    },
  },

  {
    files: ["tests/**"],
    rules: {
      /**
       * off ③ `react-hooks/rules-of-hooks` (tests 안에서만)
       * 사유: 회귀 검사는 node 환경이고 React가 한 줄도 없습니다. 저장소 스텁을 갈아 끼우는
       * 도우미 이름(`useDevice` = 「이 기기를 쓴다」)이 훅 작명 규칙에 걸릴 뿐입니다.
       * 소스(src/**)에서는 이 규칙이 그대로 에러로 살아 있습니다.
       */
      "react-hooks/rules-of-hooks": "off",
    },
  },
];

export default config;
