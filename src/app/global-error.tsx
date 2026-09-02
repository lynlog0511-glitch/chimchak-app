"use client";

import { useEffect } from "react";
import { INLINE_DISCLAIMER_TEXT } from "@/components/InlineDisclaimer";
import {
  DEFAULT_SETTINGS,
  FONT_SCALE_PERCENT,
  applyFontScale,
  getSettings,
} from "@/lib/settings";

export interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/* 이 화면은 layout.tsx를 대체하므로 globals.css가 적용되지 않습니다 — 토큰 대신 v4 §1의 값을
   인라인으로 적습니다. 글자는 px로 고정하지 않고 rem을 써 브라우저와 이미 적용된 루트 글자
   크기를 그대로 따릅니다. 오류 상황의 안내·복구 문구도 모두 기본 16px 이상을 지킵니다. */
const INK = "#191f1e";
const INK_SOFT = "#454f4c";
const INK_MUTED = "#5a625f";
const PAPER = "#ffffff";
const PAPER_2 = "#f5f6f6";
const PAPER_OUT = "#f1f2f0";
const LINE = "#eef0ef";
const BRAND_700 = "#157f75";
const DANGER_INK = "#b03636";

/** 버튼 공통 — 고령 사용자 기본 터치 64px · r14 · 라벨 17px w700. */
const buttonBase = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 64,
  padding: "0 1.25rem",
  borderRadius: "0.875rem",
  border: "none",
  fontSize: "1.0625rem",
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
  useEffect(() => {
    applyFontScale(getSettings().fontScale);
  }, []);

  return (
    <html
      lang="ko"
      style={{ fontSize: FONT_SCALE_PERCENT[DEFAULT_SETTINGS.fontScale] }}
    >
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
          <main style={{ flex: 1, padding: "1.5rem 1.25rem 0" }}>
            <h1
              style={{
                margin: 0,
                fontSize: "1.375rem",
                lineHeight: 1.3,
                fontWeight: 800,
                letterSpacing: "-0.01em",
              }}
            >
              화면을 여는 중 문제가 생겼습니다
            </h1>
            <p style={{ margin: "0.25rem 0 0", fontSize: "1rem", color: INK_MUTED }}>
              잠시 후 다시 시도해 주세요
            </p>

            <div
              style={{
                marginTop: "1rem",
                padding: "0.875rem 1rem",
                borderRadius: "0.875rem",
                background: PAPER_2,
              }}
            >
              <p style={{ margin: 0, fontSize: "1rem", color: INK_SOFT }}>
                급하신 상황이라면 아래에서 응급 안내를 바로 여실 수 있습니다. 응급 안내는 미리
                적어 둔 고정 문구로 되어 있고, 연결이 끊겨도 열리도록 기기에 저장해 둡니다.
              </p>
            </div>

            <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
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
              padding: "1.5rem 1.25rem",
              textAlign: "center",
              color: INK_MUTED,
              fontSize: "1rem",
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
