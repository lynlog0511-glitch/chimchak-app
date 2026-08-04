"use client";

import { DISCLAIMER_TEXT } from "@/components/DisclaimerBar";

export interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * 최상위 오류 화면 (루트 레이아웃 자체가 실패했을 때).
 *
 * 이 화면은 layout.tsx를 대체하므로 html·body를 직접 그리고,
 * 공통 컴포넌트에 기대지 않고도 고정 고지(안전 규칙 §3-2)를 반드시 표시합니다.
 */
export default function GlobalError({ reset }: GlobalErrorProps) {
  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#F7FAF9",
          color: "#1F3D3B",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif",
          fontSize: 18,
          lineHeight: 1.6,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <main style={{ flex: 1, maxWidth: 720, margin: "0 auto", padding: "3rem 1.25rem" }}>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800 }}>
            화면을 여는 중 문제가 생겼습니다
          </h1>
          <p style={{ marginTop: "1rem" }}>
            잠시 후 다시 시도해 주세요. 급하신 상황이라면 아래에서 응급 안내를 바로 여실 수
            있습니다.
          </p>
          <div style={{ marginTop: "2rem", display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
            <button
              type="button"
              onClick={reset}
              style={{
                minHeight: 56,
                padding: "0 1.5rem",
                borderRadius: 14,
                border: "none",
                background: "#17948A",
                color: "#fff",
                fontSize: "1rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              다시 시도하기
            </button>
            <a
              href="/emergency"
              style={{
                minHeight: 56,
                display: "inline-flex",
                alignItems: "center",
                padding: "0 1.5rem",
                borderRadius: 14,
                background: "#D64545",
                color: "#fff",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              응급 안내 열기
            </a>
            <a
              href="/"
              style={{
                minHeight: 56,
                display: "inline-flex",
                alignItems: "center",
                padding: "0 1.5rem",
                borderRadius: 14,
                border: "2px solid #C9DEDB",
                color: "#1F3D3B",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              홈으로 돌아가기
            </a>
          </div>
        </main>
        <p
          role="note"
          style={{
            margin: 0,
            padding: "0.75rem 1.25rem",
            textAlign: "center",
            background: "#FDF1E6",
            borderTop: "1px solid #F0D3B6",
            color: "#8A4B12",
            fontSize: "1rem",
          }}
        >
          {DISCLAIMER_TEXT}
        </p>
      </body>
    </html>
  );
}
