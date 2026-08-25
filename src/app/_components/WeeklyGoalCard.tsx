"use client";

import { useEffect, useId, useState } from "react";
import { Card, EyebrowLabel, cx } from "@/components";
import {
  WEEKLY_GOAL_CHOICES,
  goalStatusLine,
  loadWeeklyGoalProgress,
  saveWeeklyGoal,
  type WeeklyGoalProgress,
} from "@/lib/goals";

export interface WeeklyGoalCardProps {
  /** 카드에 붙는 클래스 — 홈이 위아래 간격을 잡습니다(카드는 자기 margin을 들지 않습니다). */
  className?: string;
}

/**
 * 홈 「이번 주 목표」 카드.
 *
 * 담는 것은 **횟수 사실** 하나입니다 — 「이번 주 2/3회」와 남은 횟수 한 줄까지이고,
 * 점수·등급·순위는 만들지 않습니다(PROJECT_BRIEF §3-1). 점 표시도 같은 사실을 눈으로
 * 한 번 더 말하는 것뿐이라 장식으로 두고(aria-hidden), 뜻은 위 문장이 전합니다.
 *
 * **미달을 꾸짖지 않습니다.** 0회인 주에도 문장은 「아직 이번 주가 남아 있습니다」에서 멈추고,
 * 아직 한 회차도 마치지 않은 분께는 「첫 회차를 마치시면 여기에 쌓입니다」로 갈립니다 —
 * 처음 열어 보신 분의 첫 화면에 빚처럼 읽히는 숫자를 세우지 않으려는 자리입니다.
 *
 * 목표 변경은 **카드 안 접이식**입니다. 설정 팝오버로 보내지 않는 이유는 하나입니다:
 * 주 몇 회로 둘지는 이 카드를 보는 순간에만 떠오르는 판단이라, 화면을 옮기면 그 자리에서
 * 사라집니다. 대신 설정 화면의 선택 문법(48px 칸 + 틸 채움 하나로만 알림)을 그대로 빌려 씁니다.
 *
 * 서버 컴포넌트인 `app/page.tsx`의 첫 렌더와 수화 결과를 맞추기 위해, 마운트 전에는 아무것도
 * 그리지 않고 `useEffect`에서만 기기 저장소를 읽습니다(「하던 훈련」·첫 방문 안내와 같은 방식).
 */
export function WeeklyGoalCard({ className }: WeeklyGoalCardProps) {
  const [progress, setProgress] = useState<WeeklyGoalProgress | null>(null);
  const [open, setOpen] = useState(false);
  /** 목표를 바꿨는데 이 기기에 남지 않은 경우 — 되는 척하지 않고 한 줄로 밝힙니다. */
  const [saveFailed, setSaveFailed] = useState(false);
  const titleId = useId();
  const groupId = useId();

  useEffect(() => {
    setProgress(loadWeeklyGoalProgress());
  }, []);

  const handlePick = (perWeek: number) => {
    const stored = saveWeeklyGoal(perWeek);
    const next = loadWeeklyGoalProgress();
    setSaveFailed(!stored);
    // 저장이 막힌 기기에서도 화면은 **고르신 값**으로 둡니다 — 이번 방문 동안은 그 값이 목표이고,
    // 남지 않았다는 사실은 아래 한 줄이 따로 말합니다(고른 적 없는 숫자로 되돌려 놓지 않습니다).
    setProgress(
      stored ? next : { ...next, goal: perWeek, remaining: Math.max(0, perWeek - next.done) },
    );
    setOpen(false);
  };

  if (!progress) return null;

  const { goal, done } = progress;
  const filled = Math.min(done, goal);

  return (
    /* 라운드·면·여백은 홈의 다른 회색 카드(첫 방문 안내·「하던 훈련」·3계층 밴드)와 같은 값입니다. */
    <Card tone="quiet" padded={false} className={cx("px-[15px] py-[14px]", className)}>
      <section aria-labelledby={titleId}>
        <EyebrowLabel id={titleId}>이번 주 목표</EyebrowLabel>

        {/* 「2/3회」는 눈으로 읽는 표기이고, 낭독으로는 슬래시가 뜻을 잃습니다 —
            보이는 쪽을 장식으로 두고 문장 하나를 따로 들려 드립니다. */}
        <p className="mt-[6px] text-[1.0625rem] leading-[1.3] font-bold text-ink">
          <span aria-hidden>
            이번 주 <span className="chim-num">{done}</span>/
            <span className="chim-num">{goal}</span>회
          </span>
          <span className="sr-only">
            이번 주 목표 {goal}회 가운데 {done}회 마치셨습니다.
          </span>
        </p>

        {/* 진행 점 — 채운 회차만큼 진해집니다. 색은 잉크 두 단뿐입니다:
            홈의 틸 채움은 주 CTA와 3계층 밴드 둘로 이미 차 있어(가이드 §0 「틸은 화면당 2곳 이하」),
            여기서 세 번째 틸을 들이면 첫 화면의 시선 순서가 무너집니다. */}
        <span aria-hidden className="mt-[10px] flex items-center gap-[6px]">
          {Array.from({ length: goal }, (_, index) => (
            <span
              key={index}
              className={cx(
                "h-[8px] w-[8px] rounded-full",
                index < filled ? "bg-ink" : "bg-line-strong",
              )}
            />
          ))}
        </span>

        <p className="mt-[8px] text-[0.8438rem] leading-[1.6] text-ink-soft">
          {goalStatusLine(progress)}
        </p>

        {/* 접이식 — 닫혀 있을 때 이 카드가 차지하는 것은 위 세 줄뿐입니다. */}
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-controls={groupId}
          className="mt-[2px] inline-flex min-h-[48px] items-center rounded-field text-[0.8438rem] leading-[1.45] font-semibold text-ink-muted underline decoration-1 underline-offset-[3px] transition-colors duration-150 ease-soft hover:text-brand-800"
        >
          {open ? "접기" : "목표 바꾸기"}
        </button>

        {open && (
          <div id={groupId} className="mt-[2px]">
            {/* 고르러 들어오신 분이 읽고 판단하는 한 줄이라 라벨 규격(15px/600)으로 둡니다 —
                설정 팝오버의 「글자 크기」·「음성 빠르기」와 같은 등급입니다. */}
            <p id={`${groupId}-label`} className="chim-label text-ink">
              한 주에 몇 회로 둘까요
            </p>
            {/* 선택 문법은 설정 팝오버의 칸(`components/SettingsMenu.tsx`의 OptionButton)과 같습니다 —
                48px 칸 · 고른 칸만 틸 채움(brand-700 위 흰 글자, AA 4.86:1) · 체크 아이콘 없음.
                7칸이 좁은 화면에서도 한 줄에 서도록 격자로 두고, 높이는 48px을 그대로 지킵니다. */}
            <div
              role="group"
              aria-labelledby={`${groupId}-label`}
              className="mt-2 grid grid-cols-7 gap-[6px]"
            >
              {WEEKLY_GOAL_CHOICES.map((choice) => {
                const selected = choice === goal;
                return (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => handlePick(choice)}
                    aria-pressed={selected}
                    aria-label={`주 ${choice}회`}
                    className={cx(
                      "chim-num chim-label min-h-[48px] rounded-card px-1",
                      "transition-colors duration-150 ease-soft",
                      selected
                        ? "bg-brand-700 font-bold text-white active:bg-brand-800"
                        : "bg-white text-ink hover:bg-neutral-line active:bg-neutral-line",
                    )}
                  >
                    {choice}
                  </button>
                );
              })}
            </div>
            {/* 안심 문구 — 각주가 아니라 「눌러도 되는가」에 답하는 줄이라 보조 본문 단(13.5px)에 둡니다. */}
            <p className="mt-2 text-[0.8438rem] leading-[1.6] text-ink-muted">
              목표는 이 기기에만 저장됩니다. 언제든 바꾸실 수 있습니다.
            </p>
          </div>
        )}

        {/* 저장이 막힌 기기에 「바꿨습니다」라고만 말하지 않습니다 — 다음에 열었을 때 목표가
            되돌아가 있는 이유를 사용자가 알 길이 없기 때문입니다(`lib/storage`의 실패 문구와 같은 규율). */}
        {saveFailed && (
          <p className="mt-[8px] text-[0.8438rem] leading-[1.6] font-semibold text-warn-ink">
            브라우저에서 사이트 데이터 저장이 막혀 있어, 바꾸신 목표가 이 기기에 남지 않았습니다.
            이번 방문 동안에만 적용됩니다.
          </p>
        )}
      </section>
    </Card>
  );
}

export default WeeklyGoalCard;
