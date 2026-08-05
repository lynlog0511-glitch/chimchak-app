"use client";

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
    <p className="mb-2 text-[12px] leading-[1.4] font-bold tracking-[0.05em] text-ink-muted">
      {children}
    </p>
  );
}

/** 문서 제목의 괄호 주석을 떼어 레일 한 줄에 담기 좋게 만듭니다. */
function shortDocTitle(title: string): string {
  return title.replace(/\s*\([^)]*\)\s*$/, "").trim();
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
      className={cx("w-[270px] flex-none overflow-y-auto bg-[#fbfcfc] px-6 py-6", className)}
    >
      <RailLabel>상황</RailLabel>
      <p className="mb-[18px] text-[13px] leading-[1.6] text-ink-soft">{scenario.summary}</p>

      <RailLabel>{gaugeRailLabel(scenario)}</RailLabel>
      {/* 칸 수는 눈으로만 읽는 신호입니다 — 뜻은 아래 상태어가 전합니다(숫자는 내보내지 않습니다). */}
      <div aria-hidden className="mb-[5px] flex gap-[3px]">
        {Array.from({ length: gauge.max }, (_, i) => (
          <span
            key={i}
            className={cx(
              "h-2 flex-1 rounded-[3px] transition-colors duration-[250ms] ease-soft",
              i < filled
                ? emotion.level === "crisis"
                  ? "bg-warn"
                  : "bg-brand-400"
                : "bg-line",
            )}
          />
        ))}
      </div>
      <p className={cx("mb-[18px] text-[12.5px] leading-[1.5] font-semibold", EMOTION_TEXT[emotion.level])}>
        {emotion.word}
        {deltaSentence && ` — ${deltaSentence}`}
      </p>

      <RailLabel>지금까지의 코칭</RailLabel>
      {coachings.length > 0 ? (
        <ul className="mb-[18px]">
          {coachings.map((item) => (
            <li
              key={item.key}
              className="flex gap-1.5 border-b border-line pt-[9px] pb-[9px] text-[12.5px] leading-[1.55] text-ink-soft first:pt-0 last:border-b-0 last:pb-0"
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
        <p className="mb-[18px] text-[12.5px] leading-[1.55] text-tertiary">
          아직 판정된 응답이 없습니다.
        </p>
      )}

      {docTitles.length > 0 && (
        <p className="border-t border-line pt-2.5 text-[11.5px] leading-[1.6] text-tertiary">
          근거 문서 — {docTitles.join(" · ")}
        </p>
      )}
    </aside>
  );
}

export default SessionRail;
