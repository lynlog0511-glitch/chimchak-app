"use client";

import { useEffect, useState } from "react";
import { IconDot } from "@/components/icons";
import { cx } from "@/components/utils";
import type { SessionStatus, Tier } from "@/types";
import {
  TIER_ENDED_NOTE,
  TIER_LABEL,
  TIER_NOW_NOTE,
  TIER_SHORT,
  TIER_UNUSED_NOTE,
} from "./constants";

export interface TierIndicatorProps {
  /** 이 시나리오가 실제로 쓰는 계층 (없는 계층은 흐리게 표시합니다) */
  tiers: Tier[];
  /** 세션 상태 — 'protocol'이면 L3(실전 응급)로 넘어갑니다 */
  status: SessionStatus;
  /** 턴 채점이 끝날 때마다 1씩 오릅니다 — 이 값이 바뀌면 L2가 잠깐 점등합니다 */
  judgeTick: number;
  className?: string;
}

const ORDER: Tier[] = ["L1", "L2", "L3"];

/** L2 점등 시간 (채점이 실제로 일어났다는 것만 알리고 곧 L1로 돌아옵니다) */
const JUDGE_LIGHT_MS = 1500;

/** 작동 중인 계층만 면으로 표시합니다 — 선은 쓰지 않습니다(§1-4). */
const ACTIVE_STYLE: Record<Tier, string> = {
  L1: "bg-brand-100 text-brand-900",
  L2: "bg-warn-soft text-warn-ink",
  L3: "bg-danger-soft text-danger-ink",
};

/** 화면 움직임을 줄여 달라고 설정하신 분께는 깜빡임 없이 색만 바꿔 드립니다. */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

/**
 * 생성 통제 3계층 라이브 표시기.
 *
 * 「위험할수록 AI의 지분을 줄인다」가 시연 중에 눈으로 보이도록, 지금 어느 계층이 작동 중인지만
 * 표시합니다. 평상시에는 L1, 턴 채점 직후에는 L2가 잠깐 점등하고, 응급 프로토콜 구간(status가
 * 'protocol')에서는 L3로 넘어가며 화면 톤이 danger로 바뀝니다.
 *
 * 점수·등급·순위·백분위는 어떤 형태로도 표시하지 않습니다 — 진행 막대나 숫자를 쓰지 않는 이유입니다.
 *
 * @example <TierIndicator tiers={scenario.tiers} status={session.status} judgeTick={judgeTick} />
 */
export function TierIndicator({ tiers, status, judgeTick, className }: TierIndicatorProps) {
  const [judging, setJudging] = useState(false);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (judgeTick <= 0) return undefined;
    setJudging(true);
    const timer = window.setTimeout(() => setJudging(false), JUDGE_LIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [judgeTick]);

  const inProtocol = status === "protocol";
  const finished = status === "ended";
  // ⚑CF 인터럽트는 규칙 사전이 붙잡아 세운 상태이므로, 모달이 떠 있는 동안 L2를 켜 둡니다.
  const judgingNow = judging || status === "interrupted";
  const active: Tier | null = finished ? null : inProtocol ? "L3" : judgingNow ? "L2" : "L1";
  // 실제로 작동 중인 계층은 시나리오 목록에 빠져 있더라도 흐리게 두지 않습니다(사실이 우선).
  const unused = ORDER.filter((tier) => !tiers.includes(tier) && tier !== active);

  return (
    <section
      aria-label="생성 통제 3계층 — 지금 작동 중인 계층"
      className={cx(
        // 계층 표시기는 코어가 아닙니다 — 보더를 빼고 옅은 면 하나에 13~14px로 앉힙니다(§3·§7).
        "rounded-field p-3",
        inProtocol ? "bg-danger-soft/60" : "bg-paper-2",
        className,
      )}
    >
      <p className="chim-caption font-bold text-ink-muted">생성 통제 계층</p>

      <ol className="mt-2 grid grid-cols-3 gap-2">
        {ORDER.map((tier) => {
          const isActive = tier === active;
          const used = isActive || tiers.includes(tier);
          return (
            <li
              key={tier}
              aria-current={isActive ? "step" : undefined}
              aria-label={used ? undefined : `${TIER_LABEL[tier]} — ${TIER_UNUSED_NOTE}`}
              className={cx(
                "flex min-h-[2.75rem] flex-col justify-center rounded-field px-2 py-1.5 text-center transition-colors duration-200",
                isActive
                  ? ACTIVE_STYLE[tier]
                  : used
                    ? "bg-white text-ink-muted"
                    : // 쓰지 않는 계층은 면만 한 단계 흐리게 둡니다.
                      // 글자까지 흐리게 하면 13px에서 대비 4.5:1이 깨집니다.
                      "bg-white/60 text-ink-muted",
                isActive && tier === "L2" && !reduced && "animate-pulse",
              )}
            >
              {/* 좁은 화면에서도 접히지 않게 계층 기호와 이름을 두 줄로 나눠 적습니다. */}
              <span className="chim-meta flex items-center justify-center gap-1.5 leading-tight font-extrabold">
                <IconDot className="h-3 w-3" filled={isActive} />
                {tier}
              </span>
              <span className="chim-caption mt-0.5 leading-tight font-semibold">
                {used ? TIER_SHORT[tier] : "쓰지 않음"}
              </span>
            </li>
          );
        })}
      </ol>

      {/* 대화 로그(aria-live)가 같은 내용을 이미 읽어 드리므로 여기서는 다시 읽지 않습니다. */}
      <p
        className={cx(
          "chim-caption mt-2 leading-relaxed font-semibold",
          inProtocol ? "text-danger-ink" : "text-ink-muted",
        )}
      >
        {active ? TIER_NOW_NOTE[active] : TIER_ENDED_NOTE}
      </p>

      {unused.length > 0 && (
        <p className="chim-caption mt-1 leading-relaxed text-ink-muted">
          {unused.map((tier) => TIER_LABEL[tier]).join(" · ")} — {TIER_UNUSED_NOTE}
        </p>
      )}
    </section>
  );
}

export default TierIndicator;
