import type { Metadata, Viewport } from "next";
import { SettingsBoot } from "@/components/SettingsBoot";
import { SwRegister } from "@/components/SwRegister";
import { FONT_SCALE_PX, SETTINGS_KEY } from "@/lib/settings";
import "./globals.css";

/**
 * 글자 크기를 **첫 페인트 전에** 심는 동기 스크립트.
 *
 * `SettingsBoot`는 모듈이 평가될 때 같은 일을 하지만, 그 시점은 청크가 도착해 실행되는 때 —
 * 즉 **첫 페인트 다음**입니다. 「아주 크게」(20px)를 골라 두신 분은 앱을 열 때마다 16px로 그려진
 * 화면을 한 번 보고, JS가 도착하면 화면 전체가 25% 커지며 레이아웃이 다시 흐릅니다. 이 설정을
 * 켤 분이 정확히 작은 글자가 안 보이는 분들이라 체감이 크고, 회선이 느릴수록 그 사이가 길어집니다.
 *
 * 그래서 다크 모드 깜빡임을 막는 것과 같은 패턴으로 `<head>`에서 동기로 한 번 심습니다.
 * 값과 키는 `src/lib/settings.ts`에서 가져오므로 두 곳에 숫자를 적지 않습니다.
 * `SettingsBoot`는 그대로 둡니다 — 하는 일이 같고 멱등이라, 여기서 이미 심었으면 같은 값을
 * 다시 쓸 뿐입니다(설정을 바꾼 뒤의 반영·리스너 배선은 여전히 그쪽 몫입니다).
 * CSP의 `script-src 'unsafe-inline'`은 프레임워크 때문에 이미 열려 있어 새로 뚫는 것이 없습니다.
 */
const FONT_SCALE_BOOT = `(function(){try{var r=JSON.parse(localStorage.getItem(${JSON.stringify(
  SETTINGS_KEY,
)})||"{}");var m=${JSON.stringify(FONT_SCALE_PX)};var px=m[r&&r.fontScale];if(px){var e=document.documentElement;e.style.fontSize=px+"px";e.dataset.chimFontScale=r.fontScale;}}catch(_){}})();`;

export const metadata: Metadata = {
  title: {
    default: "침착 ChimChak — 돌보는 사람을 위한 상황 훈련",
    template: "%s · 침착 ChimChak",
  },
  description:
    "치매·응급·갈등 상황을 AI와 반복 연습하고, 공식 대응 지침 기준으로 즉시 피드백을 받는 돌봄 훈련 서비스",
  applicationName: "침착 ChimChak",
  // PWA 매니페스트는 emergency 에이전트가 public/manifest.webmanifest로 생성합니다.
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "침착",
    statusBarStyle: "default",
  },
  /*
   * 전화번호 자동 인식을 **끕니다**(`<meta name="format-detection" content="telephone=no">`).
   *
   * 의도: 훈련 회차 번호·날짜처럼 숫자가 붙은 문자열을 iOS가 전화번호로 잡아 파란 링크로 바꾸는
   * 일을 막습니다. 실제로 눌러야 하는 번호는 119 하나뿐이고, 그 자리는 `Call119Bar.tsx`가
   * `href="tel:119"`로 명시해 두었으므로 이 설정과 무관하게 살아 있습니다.
   *
   * ※ 함정 하나를 적어 둡니다: Next의 구현은 **키가 있는지만 보고 값을 보지 않습니다**
   *   (`FormatDetectionMeta`가 `if (key in formatDetection)`로 `telephone=no`를 씁니다).
   *   즉 `true`로 적어도 결과는 `no`였습니다 — 예전 코드가 그 상태였고, 빌드도 타입도 화면도
   *   멀쩡해서 아무도 몰랐습니다. 자동 인식을 정말 켜고 싶어지면 값을 바꾸는 게 아니라
   *   **이 필드를 통째로 지워야** 합니다(메타가 아예 나가지 않아야 브라우저 기본이 켜집니다).
   */
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    siteName: "침착 ChimChak",
    title: "침착 ChimChak — 돌보는 사람을 위한 상황 훈련",
    description:
      "정답을 맞히는 시험이 아니라, 말이 나오게 만드는 연습입니다. 어르신 역은 AI가, 판정은 법령·공단 지침을 옮긴 규칙이 맡습니다.",
    locale: "ko_KR",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#17948a",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: 글자 크기 설정(src/lib/settings.ts)이 **첫 페인트 전에**
    // <html>에 font-size·data-chim-font-scale을 심습니다(아래 body 첫머리의 동기 스크립트).
    // 서버 HTML에는 없는 속성이라 React가 불일치로 경고하지만, 사용자 설정을 화면이 그려지는
    // 그 순간부터 적용하기 위한 의도된 차이입니다.
    <html lang="ko" suppressHydrationWarning>
      {/* 지면은 앱 프레임 밖 배경(#f1f2f0)입니다 — 화면(흰 면)은 PageShell이 그립니다. */}
      <body className="min-h-dvh bg-paper-out antialiased">
        {/* 저장된 글자 크기를 첫 페인트 전에 심습니다 — 위 FONT_SCALE_BOOT 주석 참조.
            문서 맨 앞의 동기 스크립트라 아래 내용이 그려지기 전에 실행됩니다(async가 아니므로
            React가 head로 끌어올리지도 않습니다 — 실행 시점이 곧 이 자리입니다). */}
        <script dangerouslySetInnerHTML={{ __html: FONT_SCALE_BOOT }} />
        {/* 동봉한 Pretendard를 첫 페인트 전에 받도록 프리로드 — React가 head로 끌어올립니다.
            **서브셋만** 프리로드합니다(429KB). 원본 2.0MB는 globals.css의 2순위 @font-face로 남아
            서브셋에 없는 글자를 실제로 그려야 할 때만 내려받습니다 — 미리 당기면 절감이 사라집니다. */}
        <link
          rel="preload"
          href="/fonts/PretendardVariable.subset.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        {children}
        {/* 전역 헤더가 사라졌으므로 글자 크기 설정은 여기서 부팅합니다(v3에서는 AppHeader가 했습니다). */}
        <SettingsBoot />
        <SwRegister />
      </body>
    </html>
  );
}
