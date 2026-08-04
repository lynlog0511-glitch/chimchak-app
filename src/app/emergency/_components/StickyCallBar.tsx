import { Call119Button } from "@/components";
import { PROTOCOL_NOTICE } from "@/data/protocols";

export interface StickyCallBarProps {
  /** 아래쪽 여백을 없애고 싶을 때 false */
  spaced?: boolean;
}

/**
 * 응급 화면 상단에 고정되는 119 버튼 바.
 *
 * 스크롤을 아무리 내려도 화면에서 사라지지 않습니다(안전 규칙 §3-5 — 119 버튼 상시 노출).
 * 생성 통제 고지("사전 검수된 고정 문구 · AI 생성 아님")도 같이 붙여 상시 표시합니다.
 */
export function StickyCallBar({ spaced = true }: StickyCallBarProps) {
  return (
    <div
      className={[
        "sticky top-[4.5rem] z-30 rounded-card border-2 border-danger-line bg-white/95 p-3 shadow-card backdrop-blur md:top-[5rem]",
        spaced ? "mb-6" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Call119Button size="md" caption={false} />
      {/* 고정 고지는 상시 노출하고, 전화 앱 안내는 화면이 넓을 때만 덧붙입니다(모바일 높이 절약). */}
      <p className="mt-2 text-center text-sm leading-snug font-semibold text-ink-muted">
        {PROTOCOL_NOTICE}
        <span className="hidden md:inline">
          {" "}
          · 누르면 전화 앱이 열립니다(시연 모드에서는 실제 발신되지 않습니다).
        </span>
      </p>
    </div>
  );
}

export default StickyCallBar;
