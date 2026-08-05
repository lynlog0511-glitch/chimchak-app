"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cx } from "@/components/utils";

/**
 * 안전 설계 목차 칩 (시안 7b 상단).
 *
 * 이 화면은 길어질 수밖에 없는 화면입니다(표·화이트리스트·권한까지 다 있어야 하니까요).
 * 그래서 맨 위에 **가로로 흐르는 칩 한 줄**을 두고, 지금 읽고 있는 항목을 잉크 채움으로 표시합니다.
 * 칩을 누르면 해당 항목으로 이동합니다(앵커 — 스크롤 동작은 브라우저가, reduced-motion도 브라우저가).
 *
 * 시안 px: 칩 12px(활성 700 / 비활성 600) · 패딩 7/12 · pill · 간격 6px ·
 * 활성 `#191f1e` 채움 + 흰 글자 / 비활성 `#f5f6f6` 면 + `#454f4c` 글자.
 * 다만 **터치 영역은 48px**이라, 보이는 알약은 시안 크기 그대로 두고 링크 자체를 48px 높이로 세웠습니다.
 *
 * 스크롤을 따라 위에 붙습니다(붙었을 때만 아래 헤어라인이 생깁니다) —
 * 붙지 않으면 활성 표시를 볼 일이 없어서, 목차가 목차 구실을 못 합니다.
 */

export interface TocItem {
  /** 섹션 요소의 id */
  id: string;
  /** 칩에 적히는 말 */
  label: string;
}

export interface SafetyTocProps {
  items: readonly TocItem[];
  className?: string;
}

export function SafetyToc({ items, className }: SafetyTocProps) {
  const [active, setActive] = useState<string>(items[0]?.id ?? "");
  const [stuck, setStuck] = useState(false);

  const barRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const chipRefs = useRef<Record<string, HTMLAnchorElement | null>>({});

  /* 지금 읽고 있는 항목 찾기 — 칩 바 바로 아래를 기준선으로 두고,
     그 선을 이미 지나간 섹션 중 마지막 것을 활성으로 봅니다. */
  useEffect(() => {
    let raf = 0;

    const update = (): void => {
      raf = 0;
      const bar = barRef.current;
      const barRect = bar?.getBoundingClientRect();
      if (barRect) setStuck(barRect.top <= 0.5);

      const line = (barRect?.height ?? 0) + 12;
      let current = items[0]?.id ?? "";
      for (const item of items) {
        const el = document.getElementById(item.id);
        if (el && el.getBoundingClientRect().top <= line) current = item.id;
      }
      setActive(current);
    };

    const onScroll = (): void => {
      if (raf) return;
      raf = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [items]);

  /* 활성 칩이 가로 스크롤 밖으로 나가면 살짝 끌어옵니다(칩 줄 안에서만 움직입니다). */
  useEffect(() => {
    const chip = chipRefs.current[active];
    const scroller = scrollerRef.current;
    if (!chip || !scroller) return;

    const left = chip.offsetLeft;
    const right = left + chip.offsetWidth;
    const viewLeft = scroller.scrollLeft;
    const viewRight = viewLeft + scroller.clientWidth;

    if (left < viewLeft + 8) {
      scroller.scrollLeft = Math.max(0, left - 8);
    } else if (right > viewRight - 8) {
      scroller.scrollLeft = right - scroller.clientWidth + 8;
    }
  }, [active]);

  const handleClick = useCallback((id: string): void => {
    // 눌린 즉시 활성 표시를 옮깁니다 — 스크롤이 끝나기를 기다리지 않게.
    setActive(id);
  }, []);

  if (items.length === 0) return null;

  return (
    <div
      ref={barRef}
      className={cx(
        "sticky top-0 z-20 -mx-[20px] bg-paper px-[20px] pt-[8px] pb-[8px]",
        stuck && "border-b border-line",
        className,
      )}
    >
      <nav aria-label="안전 설계 목차">
        <div
          ref={scrollerRef}
          className="relative flex gap-[6px] overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((item) => {
            const isActive = item.id === active;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                ref={(el) => {
                  chipRefs.current[item.id] = el;
                }}
                aria-current={isActive ? "true" : undefined}
                onClick={() => handleClick(item.id)}
                className="flex min-h-[48px] flex-none items-center"
              >
                <span
                  className={cx(
                    "rounded-chip px-[12px] py-[7px] text-[0.75rem] leading-[1.4] whitespace-nowrap",
                    "transition-colors duration-150 ease-soft",
                    isActive
                      ? "bg-ink font-bold text-white"
                      : "bg-paper-2 font-semibold text-ink-soft",
                  )}
                >
                  {item.label}
                </span>
              </a>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export default SafetyToc;
