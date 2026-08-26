import { cx } from "@/components/utils";
import { PROTOCOL_NOTICE } from "@/data/protocols";
import type { ProtocolStep } from "@/types";

/**
 * 응급 재생기(시안 6d)의 공통 조각.
 *
 * 같은 프로토콜이 **두 곳**에서 재생됩니다 — 단독 화면 `/emergency/[id]` 과 훈련 세션 안 L3 구간.
 * 두 화면이 서로 다른 얼굴을 하면 "같은 안내"라는 사실이 흐려지므로, 진행바·파형·자막 상태줄·
 * 컨트롤 규격·각주를 여기 한 곳에 두고 양쪽이 가져다 씁니다.
 *
 * 재생 로직은 `useProtocolPlayback`이 그대로 담당합니다 — 이 파일에는 표시만 있습니다.
 */

/* ── 세그먼트 진행바 (가이드 §4.2 · 시안 6d) ────────────────────
   CUE·단계 수만큼 flex 균등 3px 막대, gap 3px. 응급은 danger 톤입니다.
   남은 칸은 시안 6d의 `#f3d4d3`에 가장 가까운 토큰 `danger-line`(#f3c3c1)을 씁니다 —
   `danger-soft`(#fdeeed)는 3px 막대에서 흰 지면과 구분되지 않아 진행 자체가 보이지 않습니다.
   진행률이지 점수가 아니므로 안전 규칙(점수 비표시)에 걸리지 않습니다. */
export interface ProtocolSegmentsProps {
  steps: ProtocolStep[];
  index: number;
  className?: string;
}

export function ProtocolSegments({ steps, index, className }: ProtocolSegmentsProps) {
  const total = steps.length;

  return (
    <div
      className={cx("flex gap-[3px]", className)}
      role="progressbar"
      aria-label="안내 진행"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={index + 1}
      aria-valuetext={`전체 ${total}단계 중 ${index + 1}단계`}
    >
      {steps.map((step, i) => (
        <span
          key={step.id}
          aria-hidden
          className={cx(
            "h-[3px] flex-1 rounded-full transition-colors duration-300",
            i <= index ? "bg-danger" : "bg-danger-line",
          )}
        />
      ))}
    </div>
  );
}

/* ── 파형 (시안 6d) ──────────────────────────────────────────
   3px 세로 막대 4개(높이 7·12·5·10 · 간격 2px). 게이지가 아니라 **상태 표시**라
   막대 높이에 값의 뜻을 싣지 않습니다. 흔들림은 `chim-wave-bar`가 맡고,
   `prefers-reduced-motion`에서는 globals.css의 전역 규칙이 즉시 멈춥니다. */
const WAVE_BARS = [
  { h: 7, soft: false },
  { h: 12, soft: false },
  { h: 5, soft: true },
  { h: 10, soft: false },
] as const;

export function ProtocolWave({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cx("inline-flex flex-none items-end gap-[2px]", className)}>
      {WAVE_BARS.map((bar, i) => (
        <span
          key={i}
          className={cx(
            "chim-wave-bar block w-[3px] rounded-[1px]",
            bar.soft ? "bg-danger/60" : "bg-danger",
          )}
          style={{ height: bar.h, animationDelay: `${i * 110}ms` }}
        />
      ))}
    </span>
  );
}

/* ── 자막 상태줄 ────────────────────────────────────────────
   시안 6d의 「읽어 주는 중 — 자막과 같은 속도」입니다.
   소리가 나지 않는 상태(음성 끔·미지원·일시정지·침묵 단계)에서 이 문장을 그대로 두면
   화면이 사실과 다른 말을 하게 되므로, 상태별로 문장을 바꿉니다. */
export type ReadingState = "reading" | "caption" | "paused" | "done";

const READING_TEXT: Record<Exclude<ReadingState, "reading">, string> = {
  caption: "자막으로 안내 중입니다. 소리 없이 같은 속도로 넘어갑니다",
  paused: "잠시 멈췄습니다. 「이어서 듣기」를 누르면 계속합니다",
  done: "안내를 마쳤습니다. 화면은 이대로 두셔도 됩니다",
};

export function ProtocolReadingLine({
  state,
  className,
}: {
  state: ReadingState;
  className?: string;
}) {
  if (state === "reading") {
    return (
      <p
        className={cx(
          "flex items-center gap-[6px] text-[0.7813rem] leading-[1.45] font-bold text-danger-ink",
          className,
        )}
      >
        <ProtocolWave />
        <span>읽어 주는 중 — 자막과 같은 속도</span>
      </p>
    );
  }

  return (
    <p className={cx("text-[0.7813rem] leading-[1.45] font-bold text-ink-muted", className)}>
      {READING_TEXT[state]}
    </p>
  );
}

/* ── 다음 단계 예고 (시안 6d 「다음 — …」) ─────────────────────
   다음 단계 **음성의 첫 구절**만 잘라 미리 보여 줍니다. 문구를 새로 짓지 않습니다 —
   검수된 고정 문구의 앞부분을 그대로 잘라 쓰고, 길면 말줄임으로만 줄입니다. */
const PREVIEW_MAX = 26;

export function nextStepPreview(steps: ProtocolStep[], index: number): string | null {
  const next = steps[index + 1];
  if (!next) return null;

  const text = next.voice.trim();
  if (text.length === 0) return "안내를 마치고 화면만 남깁니다";

  const stop = text.indexOf(".");
  const clause = (stop > 0 ? text.slice(0, stop) : text).trim();
  return clause.length > PREVIEW_MAX ? `${clause.slice(0, PREVIEW_MAX)}…` : clause;
}

/* ── 컨트롤 규격 (시안 6d) ────────────────────────────────────
   [이전 | 잠시 멈춤] 아웃라인(line-strong 1px, 흰 바탕) + [다음 단계] 틸 채움(flex 1.4).
   최소 높이 52px — 손이 바쁜 상황에서 눌리는 크기입니다(터치 48px+ 하한을 넘깁니다). */
const CONTROL_BASE =
  "flex min-h-[52px] items-center justify-center rounded-card px-3 text-[0.9375rem] " +
  "transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45";

export const CONTROL_OUTLINE = `${CONTROL_BASE} flex-1 border border-line-strong bg-paper font-semibold text-ink-soft active:bg-paper-2`;

/** 이 화면의 유일한 틸 채움입니다(119는 danger, 나머지는 아웃라인 — 가이드 §0 「화면당 2곳 이하」).
    채움은 brand-600이 아니라 **brand-700**입니다 — globals.css의 토큰 주석대로 「흰 글자 얹는 채움」은 700입니다.
    600(#17948a) 위 흰 15px/700은 3.72:1이고, 15px는 굵어도 큰 글자(18.66px)에 못 들어 4.5:1이 적용됩니다. */
export const CONTROL_PRIMARY = `${CONTROL_BASE} flex-[1.4] bg-brand-700 font-bold text-paper active:bg-brand-800`;

/** 부수 조작 — 텍스트만. 48px 터치는 지킵니다. */
export const CONTROL_QUIET =
  "flex min-h-[48px] flex-1 items-center justify-center rounded-field px-2 text-[0.8438rem] font-semibold " +
  "text-ink-muted transition-colors duration-150 active:bg-paper-2 disabled:cursor-not-allowed disabled:opacity-45";

/* ── 각주 2줄 (시안 6d 하단 · 가이드 §4.8) ────────────────────
   생성 통제와 술기 경계를 재생 화면에서 한 번 더 못박습니다. 문구는 데이터 상수 그대로입니다.

   크기·자리는 시안 6d(11px 가운데 정렬)를 따르되 **색만 한 단계 진하게** 씁니다 —
   시안의 `#b6bcb9`(현 토큰값 #9aa5a2, 2.54:1)는 흰 지면에서 AA에 못 미쳐, 「AI 생성 아님」·「술기는 119가 지도」처럼
   안전을 단언하는 문장에는 쓰지 않습니다(장식 각주가 아니라 읽혀야 하는 고지입니다). */
export function ProtocolFootnote({ className }: { className?: string }) {
  return (
    <p className={cx("text-center text-[0.6875rem] leading-[1.6] text-ink-muted", className)}>
      {PROTOCOL_NOTICE}
      <br />
      신체 술기는 119 상황실이 목소리로 직접 지도합니다
    </p>
  );
}
