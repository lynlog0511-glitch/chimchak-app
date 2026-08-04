import type { Metadata, Viewport } from "next";
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
    <html lang="ko">
      <body className="min-h-screen antialiased">
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
