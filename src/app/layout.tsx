import type { Metadata, Viewport } from "next";
import { SettingsBoot } from "@/components/SettingsBoot";
import { SwRegister } from "@/components/SwRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "침착 ChimChak — 돌보는 사람을 훈련시키는 AI 시뮬레이터",
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
  formatDetection: { telephone: true },
  openGraph: {
    type: "website",
    siteName: "침착 ChimChak",
    title: "침착 ChimChak — 돌보는 사람을 훈련시키는 AI 시뮬레이터",
    description:
      "정답을 맞히는 시험이 아니라, 말이 나오게 만드는 연습입니다. AI는 어르신 역만 맡고 판정은 법령·공단 지침이 합니다.",
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
    // suppressHydrationWarning: 글자 크기 설정(src/lib/settings.ts)이 하이드레이션 전에
    // <html>에 font-size·data-chim-font-scale을 심습니다. 서버 HTML에는 없는 속성이라
    // React가 불일치로 경고하지만, 사용자 설정을 첫 페인트부터 적용하기 위한 의도된 차이입니다.
    <html lang="ko" suppressHydrationWarning>
      {/* 지면은 앱 프레임 밖 배경(#f1f2f0)입니다 — 화면(흰 면)은 PageShell이 그립니다. */}
      <body className="min-h-dvh bg-paper-out antialiased">
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
