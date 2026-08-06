"use client";

import { INLINE_DISCLAIMER_TEXT } from "@/components/InlineDisclaimer";

export interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/* 이 화면은 layout.tsx를 대체하므로 globals.css가 적용되지 않습니다 —
   토큰 이름 대신 v4 §1의 값을 인라인으로 직접 적습니다.

   여기만 글자 크기가 px 고정입니다(앱 전체는 rem — 설정 「크게/아주 크게」에 연동됩니다).
   루트 레이아웃 자체가 무너진 뒤에 뜨는 화면이라, 설정을 읽어 오는 코드에도 기대지 않고
   무엇이 깨져 있든 같은 크기로 뜨는 쪽을 택했습니다. 담는 것은 사과 한 줄·복구 버튼·고지뿐이라
   확대가 필요한 읽을거리가 없습니다. */
const INK = "#191f1e";
const INK_SOFT = "#454f4c";
const INK_MUTED = "#8a918e";
const PAPER = "#ffffff";
const PAPER_2 = "#f5f6f6";
const PAPER_OUT = "#f1f2f0";
const LINE = "#eef0ef";
const BRAND_700 = "#157f75";
const DANGER_INK = "#b03636";

/** 버튼 공통 — 터치 56px · r14 · 라벨 17px w700 (v4 §2 CTA). */
const buttonBase = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 56,
  padding: "0 20px",
  borderRadius: 14,
  border: "none",
  fontSize: 17,
  fontWeight: 700,
  textDecoration: "none",
  cursor: "pointer",
} as const;

/**
 * 최상위 오류 화면 (루트 레이아웃 자체가 실패했을 때).
 *
 * 이 화면은 layout.tsx를 대체하므로 html·body를 직접 그리고, 공통 컴포넌트·CSS에 기대지
 * 않고도 고지 문구(v4 §0 — 모든 화면에 1회 이상)를 반드시 표시합니다.
 * 골격은 다른 화면과 같습니다 — 지면 밖 `#f1f2f0`, 가운데 430px 흰 화면, 22px 제목.
 */
export default function GlobalError({ reset }: GlobalErrorProps) {
  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: PAPER_OUT,
          color: INK,
          fontFamily:
            "'Pretendard Variable', 'Pretendard Variable Full', Pretendard, system-ui, -apple-system, 'Segoe UI', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif",
          lineHeight: 1.6,
          wordBreak: "keep-all",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            minHeight: "100vh",
            maxWidth: 430,
            margin: "0 auto",
            background: PAPER,
            borderLeft: `1px solid ${LINE}`,
            borderRight: `1px solid ${LINE}`,
            boxSizing: "border-box",
          }}
        >
          <main style={{ flex: 1, padding: "24px 20px 0" }}>
            <h1
              style={{
                margin: 0,
                fontSize: 22,
                lineHeight: 1.3,
                fontWeight: 800,
                letterSpacing: "-0.01em",
              }}
            >
              화면을 여는 중 문제가 생겼습니다
            </h1>
            <p style={{ margin: "3px 0 0", fontSize: 12.5, color: INK_MUTED }}>
              잠시 후 다시 시도해 주세요
            </p>

            <div
              style={{
                marginTop: 16,
                padding: "14px 15px",
                borderRadius: 14,
                background: PAPER_2,
              }}
            >
              <p style={{ margin: 0, fontSize: 13.5, color: INK_SOFT }}>
                급하신 상황이라면 아래에서 응급 안내를 바로 여실 수 있습니다. 응급 안내는 검수된
                고정 문구로 되어 있고, 연결이 끊겨도 열리도록 기기에 저장해 둡니다.
              </p>
            </div>

            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                type="button"
                onClick={reset}
                style={{ ...buttonBase, background: BRAND_700, color: "#fff" }}
              >
                다시 시도하기
              </button>
              <a href="/emergency" style={{ ...buttonBase, background: DANGER_INK, color: "#fff" }}>
                응급 안내 열기
              </a>
              <a href="/" style={{ ...buttonBase, background: PAPER_2, color: INK }}>
                홈으로 돌아가기
              </a>
            </div>
          </main>

          <p
            role="note"
            style={{
              margin: 0,
              padding: "24px 20px 24px",
              textAlign: "center",
              color: INK_MUTED,
              fontSize: 11.5,
              lineHeight: 1.6,
            }}
          >
            {INLINE_DISCLAIMER_TEXT}
          </p>
        </div>
      </body>
    </html>
  );
}
