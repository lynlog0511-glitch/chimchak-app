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
  L1: "bg-brand-tint text-brand-900",
  L2: "bg-warn-soft text-warn-ink",
  L3: "bg-danger-soft text-danger-ink",
};

/* 2026-08-26: `usePrefersReducedMotion` 훅을 지웠습니다 — 이 파일에서 그 값을 보던 것은
   활성 L2 칩의 `animate-pulse` 하나뿐이었고, 그 점멸을 뺐으므로 이 표시기에는 이제 움직이는
   것이 없습니다(면 색 전환 200ms 하나뿐이고 그것은 전역 reduced-motion 규칙이 이미 끊습니다).
   「감지해 두고 아무 데도 안 쓰는 훅」은 다음 사람에게 여기 모션이 있다는 거짓 신호가 됩니다. */

/**
 * 생성 통제 3계층 라이브 표시기.
 *
 * @deprecated v4(시안 4a)에서 **세션 화면에서는 쓰지 않습니다** — 큰 표시기가 대사 자리를 먹었습니다.
 * 지금 계층은 컴팩트 헤더의 상태 점 한 줄(「대화 단계 · AI는 …」 / 「응급 안내 · 생성 0건」)과
 * L3 전환 안내 문구가 대신 전합니다. 파일은 다른 화면(안전 설계 등)이 같은 언어를 다시 쓸 때를
 * 위해 남겨 둡니다.
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
                /* 2026-08-26: 활성 L2 칩의 `animate-pulse`를 뺐습니다.
                   가이드 §6은 「금지: 장식 루프」이고 globals.css의 등장 모션은 240ms·180ms
                   **두 단뿐**인데, animate-pulse는 Tailwind 기본값 2s 무한 반복이라 그 목록에
                   없는 셋째 어휘였습니다. 같은 날 /history 스켈레톤 주석이 「animate-pulse를
                   쓰지 않는 것이 이 앱의 모션 최소 규율」이라고 선언하고 있었으므로, 두 문장 중
                   하나는 틀린 상태였습니다(3차 페르소나 디자이너 low). 점멸을 빼는 쪽을 골랐습니다 —
                   활성 L2는 이미 **채움 아이콘·면 색·아래 문장** 셋으로 말하고 있어,
                   깜빡임이 더하는 정보가 없습니다. `reduced` 가드도 함께 필요 없어졌습니다. */
              )}
            >
              {/* 좁은 화면에서도 접히지 않게 계층 기호와 이름을 두 줄로 나눠 적습니다.
                  행간은 `.chim-caption`이 선언한 1.45(밀집 단)를 그대로 씁니다 — 예전에는
                  `leading-tight`(1.25)로 덮여 있었는데, 유틸리티 레이어가 뒤라 실제 출고값이
                  3단 사다리 밖이었습니다. 임의값만 세던 게이트가 프리셋 클래스를 못 보던
                  자리입니다(2026-08-26에 게이트를 넓혔습니다). */}
              <span className="chim-caption flex items-center justify-center gap-1.5 font-extrabold">
                <IconDot className="h-3 w-3" filled={isActive} />
                {tier}
              </span>
              <span className="chim-caption mt-0.5 font-semibold">
                {used ? TIER_SHORT[tier] : "쓰지 않음"}
              </span>
            </li>
          );
        })}
      </ol>

      {/* 대화 로그(aria-live)가 같은 내용을 이미 읽어 드리므로 여기서는 다시 읽지 않습니다.
          행간은 아래 문단 둘 다 `.chim-caption`의 1.45입니다 — `leading-relaxed`(1.625)는
          3단 사다리(1.3·1.45·1.6) 밖이라 걷었습니다(1.6에서 0.025 떨어진, 위계를 만들지 못하고
          편차만 만드는 구간입니다). */}
      <p
        className={cx(
          "chim-caption mt-2 font-semibold",
          inProtocol ? "text-danger-ink" : "text-ink-muted",
        )}
      >
        {active ? TIER_NOW_NOTE[active] : TIER_ENDED_NOTE}
      </p>

      {unused.length > 0 && (
        <p className="chim-caption mt-1 text-ink-muted">
          {unused.map((tier) => TIER_LABEL[tier]).join(" · ")} — {TIER_UNUSED_NOTE}
        </p>
      )}
    </section>
  );
}

export default TierIndicator;
