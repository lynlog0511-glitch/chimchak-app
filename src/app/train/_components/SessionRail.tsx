"use client";

import { useEffect, useRef, useState } from "react";
import { useSourceDocs } from "@/components";
import { cx } from "@/components/utils";
import type { Scenario, SessionState } from "@/types";
import {
  EMOTION_TEXT,
  gaugeDeltaSentence,
  gaugeRailLabel,
  type EmotionLevel,
} from "./constants";
import type { LogItem } from "./sessionMachine";

export interface SessionRailProps {
  scenario: Scenario;
  session: SessionState;
  /** 지금 인물의 감정 상태 — 대화 말풍선의 상태어와 같은 낱말을 씁니다 */
  emotion: { level: EmotionLevel; word: string };
  /** 방금 판정의 게이지 변동 — 「방금 한 칸 내려갔어요」 */
  lastDelta?: number;
  log: LogItem[];
  className?: string;
}

/** 레일 섹션 라벨 — 12px w700, ink-muted, +0.05em (가이드 §2). */
function RailLabel({ children }: { children: string }) {
  return (
    <p className="mb-2 text-[0.7813rem] leading-[1.45] font-bold tracking-[0.05em] text-ink-muted">
      {children}
    </p>
  );
}

/** 문서 제목의 괄호 주석을 떼어 레일 한 줄에 담기 좋게 만듭니다. */
function shortDocTitle(title: string): string {
  return title.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

/** 화면 움직임을 줄여 달라고 설정하신 분인지 — 강조 한 번도 걸지 않습니다. */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** 강조가 남아 있는 시간(ms) — 색이 한 번 짙어졌다 제자리로 돌아옵니다(전환 자체는 250ms). */
const GAUGE_PULSE_MS = 620;

/**
 * 게이지가 방금 어느 쪽으로 움직였는지.
 * 뜻은 옆 문장(「방금 한 칸 내려갔어요」)이 전하므로 표식 자체는 장식으로 둡니다.
 */
function deltaArrow(delta: number): string {
  return delta < 0 ? "↓" : "↑";
}

/**
 * 데스크톱 세션의 우측 레일 (시안 7d · 270px).
 *
 * 대화가 좁아진 만큼 **곁에 두면 좋은 것**만 담습니다 — 상황 한 줄, 감정 게이지,
 * 지금까지의 코칭, 근거 문서. 새 정보를 만들지 않고 화면에 이미 있는 것을 모아 둔 자리입니다.
 * 모바일에는 나타나지 않습니다(상황·감정·코칭이 본문 안에 그대로 있습니다).
 */
export function SessionRail({
  scenario,
  session,
  emotion,
  lastDelta,
  log,
  className,
}: SessionRailProps) {
  const docs = useSourceDocs();
  const gauge = scenario.gauge;
  const filled = Math.max(0, Math.min(gauge.max, Math.round(session.gauge)));
  const deltaSentence = typeof lastDelta === "number" ? gaugeDeltaSentence(lastDelta) : null;
  const crisis = emotion.level === "crisis";

  /**
   * 방금 칸이 움직였을 때의 짧은 강조 — 채워진 칸이 한 단 짙어졌다 제자리로 돌아옵니다.
   *
   * 예전에는 칸 수만 조용히 바뀌어서, 대화를 읽는 동안 옆에서 일어난 변화를 놓치기 쉬웠습니다
   * (문장 「방금 한 칸 내려갔어요」는 있었지만 눈이 그리로 가지 않았습니다).
   * 색 전환은 이미 있던 250ms 그대로이고, 여기서는 짙은 색을 얼마나 붙들지만 정합니다.
   * 움직임을 줄여 달라고 하신 분께는 아예 걸지 않습니다 — 전역 규칙이 전이를 끊으면
   * 짙은 색이 「깜빡」으로만 남아 오히려 더 큰 움직임이 됩니다.
   */
  const [pulse, setPulse] = useState(false);
  const seenGaugeRef = useRef<number | null>(null);

  useEffect(() => {
    const previous = seenGaugeRef.current;
    seenGaugeRef.current = filled;
    if (previous === null || previous === filled) return undefined;
    if (prefersReducedMotion()) return undefined;
    setPulse(true);
    const timer = window.setTimeout(() => setPulse(false), GAUGE_PULSE_MS);
    return () => window.clearTimeout(timer);
  }, [filled]);

  const docTitles = scenario.sourceDocs
    .map((id) => docs.find((doc) => doc.id === id)?.title)
    .filter((title): title is string => typeof title === "string")
    .map(shortDocTitle);

  /* 지금까지의 코칭 — 판정이 난 순서대로, 마지막 넷만 (레일이 대화보다 길어지지 않게). */
  const coachings = log
    .flatMap((item) => (item.kind === "feedback" ? [item] : []))
    .slice(-4)
    .map((item) => ({
      key: item.key,
      ok: item.feedback.ok && !item.feedback.criticalFail,
      stop: item.feedback.criticalFail,
      text: item.feedback.message,
    }));

  return (
    <aside
      aria-label="이번 상황 요약"
      className={cx("w-[270px] flex-none overflow-y-auto overscroll-contain bg-paper-rail px-6 py-6", className)}
    >
      <RailLabel>상황</RailLabel>
      <p className="mb-[18px] text-[0.8438rem] leading-[1.6] text-ink-soft">{scenario.summary}</p>

      {/* 게이지 한 덩어리 — 위기 가까이에서는 이 면이 옅은 붉은 톤으로 물듭니다.
          여백·자리는 늘 같고 **색만** 250ms로 바뀝니다(위기에서만 상자가 생기면 옆 문단이 밀립니다).
          안쪽 여백(10px)만큼 바깥에서 되물러 두어, 레일의 18px 리듬은 그대로입니다 —
          커지는 것은 칠해지는 면이지 자리가 아닙니다.
          붉은 면 하나 말고 테두리·액센트 바·글로우는 더하지 않습니다(가이드 §7-2·§7-4). */}
      <div
        className={cx(
          "-mx-2 -mt-2.5 mb-[8px] rounded-card px-2 py-2.5 transition-colors duration-[250ms] ease-soft",
          crisis ? "bg-danger-soft" : "bg-transparent",
        )}
      >
        <RailLabel>{gaugeRailLabel(scenario)}</RailLabel>
        {/* B02처럼 상황 자체가 악화하는 시나리오에서는 대응이 옳아도 게이지가 오릅니다 —
            「잘했는데 왜 올라가지」 오독을 이 한 줄이 막습니다(평가 심사 렌즈 지적). */}
        <p className="mb-[6px] text-[0.7813rem] leading-[1.45] text-ink-faint">
          어르신 상태예요 — 대응 평가가 아닙니다
        </p>
        {/* 칸 수는 눈으로만 읽는 신호입니다 — 뜻은 아래 상태어가 전합니다(숫자는 내보내지 않습니다). */}
        <div aria-hidden className="mb-[4px] flex gap-[3px]">
          {Array.from({ length: gauge.max }, (_, i) => (
            <span
              key={i}
              className={cx(
                "h-2 flex-1 rounded-[3px] transition-colors duration-[250ms] ease-soft",
                i < filled
                  ? crisis
                    ? pulse
                      ? "bg-danger"
                      : "bg-warn"
                    : pulse
                      ? "bg-brand-600"
                      : "bg-brand-400"
                  : "bg-line",
              )}
            />
          ))}
        </div>
        <p
          className={cx(
            "text-[0.7813rem] leading-[1.45] font-semibold",
            EMOTION_TEXT[emotion.level],
          )}
        >
          {emotion.word}
          {deltaSentence && typeof lastDelta === "number" && (
            <>
              {" — "}
              {/* 방향 표식 — 뜻은 바로 뒤 문장이 전하므로 읽어 주지는 않습니다(중복 낭독 방지). */}
              <span aria-hidden>{deltaArrow(lastDelta)} </span>
              {deltaSentence}
            </>
          )}
        </p>
        {/* 위기 한 칸 앞 — 겁을 주는 대신 **다음에 무슨 일이 일어나는지**만 적습니다.
            엔진은 게이지가 위기값에 닿는 순간 이번 상황을 그 자리에서 마무리합니다(session.ts). */}
        {crisis && session.status === "running" && (
          <p className="mt-1.5 text-[0.7813rem] leading-[1.6] text-danger-ink">
            한 칸 더 오르면 이번 상황은 여기서 마무리됩니다.
          </p>
        )}
      </div>

      <RailLabel>지금까지의 코칭</RailLabel>
      {coachings.length > 0 ? (
        <ul className="mb-[18px]">
          {coachings.map((item) => (
            <li
              key={item.key}
              className="flex gap-1.5 border-b border-line pt-[8px] pb-[8px] text-[0.7813rem] leading-[1.6] text-ink-soft first:pt-0 last:border-b-0 last:pb-0"
            >
              <span
                aria-hidden
                className={cx(
                  "flex-none font-bold",
                  item.stop ? "text-danger-ink" : item.ok ? "text-ok-ink" : "text-warn-ink",
                )}
              >
                {item.ok ? "✓" : "·"}
              </span>
              {/* 마크는 도형이므로 판정어를 소리로도 남깁니다(색·기호만으로 뜻을 전하지 않습니다). */}
              <span className="sr-only">
                {item.stop ? "즉시 중단" : item.ok ? "충족" : "코칭"}
              </span>
              <span className="min-w-0 flex-1">{item.text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-[18px] text-[0.7813rem] leading-[1.6] text-tertiary">
          아직 판정된 응답이 없습니다.
        </p>
      )}

      {docTitles.length > 0 && (
        <p className="border-t border-line pt-2.5 text-[0.6875rem] leading-[1.6] text-tertiary">
          근거 문서 — {docTitles.join(" · ")}
        </p>
      )}
    </aside>
  );
}

export default SessionRail;
