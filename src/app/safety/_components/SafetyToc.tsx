"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cx } from "@/components/utils";
import { announceTocTarget } from "./tocEvent";

/**
 * 긴 문서 화면의 목차 칩 (시안 7b 상단) — /safety와 /legal이 같은 조각을 씁니다.
 *
 * 이 화면들은 길어질 수밖에 없는 화면입니다(표·화이트리스트·권한까지 다 있어야 하니까요).
 * 그래서 맨 위에 **가로로 흐르는 칩 한 줄**을 두고, 지금 읽고 있는 항목을 잉크 채움으로 표시합니다.
 * 칩을 누르면 해당 항목으로 이동합니다(앵커 — 스크롤 동작은 브라우저가, reduced-motion도 브라우저가).
 *
 * 눈금은 이 화면의 메타 단(12.5px · 활성 700 / 비활성 600) · 패딩 8/12 · pill · 간격 8px ·
 * 활성 잉크 채움 + 흰 글자 / 비활성 paper-2 면 + ink-soft 글자.
 * 다만 **터치 영역은 48px**이라, 보이는 알약은 그 크기 그대로 두고 링크 자체를 48px 높이로 세웠습니다.
 *
 * 스크롤을 따라 위에 붙습니다(붙었을 때만 아래 헤어라인이 생깁니다) —
 * 붙지 않으면 활성 표시를 볼 일이 없어서, 목차가 목차 구실을 못 합니다.
 *
 * 오른쪽 끝에는 **12px 페이드**가 섭니다(2026-08-25). 이 줄은 스크롤바를 일부러 숨긴 가로
 * 스크롤러라, 390px에서 실측하면 559px 중 350px만 보입니다 — 37%가 존재 자체로 감춰져 있어
 * 처음 들어온 사람은 앞 세 항목만 있는 문서로 읽습니다(2차 페르소나 UI/UX P1).
 * 활성 칩을 끌어오는 아래 보정은 **이미 스크롤을 시작한 사람**을 위한 장치이고, 이 페이드는
 * 아직 시작하지 않은 사람에게 「뒤에 더 있다」를 말합니다.
 * 끝까지 밀면 사라집니다 — 더 없을 때도 남아 있으면 페이드가 거짓말을 합니다.
 */

export interface TocItem {
  /** 섹션 요소의 id */
  id: string;
  /** 칩에 적히는 말 */
  label: string;
}

export interface SafetyTocProps {
  items: readonly TocItem[];
  /** 스크린리더가 읽는 목차 이름 — 한 앱에 목차가 둘이라 화면 이름을 붙입니다. */
  label?: string;
  className?: string;
}

export function SafetyToc({ items, label = "목차", className }: SafetyTocProps) {
  const [active, setActive] = useState<string>(items[0]?.id ?? "");
  const [stuck, setStuck] = useState(false);
  /** 칩 줄 오른쪽에 아직 볼 것이 남았는지 — 페이드를 켜고 끄는 사실입니다. */
  const [moreRight, setMoreRight] = useState(false);

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
      /* 붙는 자리는 0이 아니라 **이 바에 실제로 걸린 `top`**입니다 — 노치 기기에서는
         `var(--chim-safe-t)`만큼 내려가 있습니다. 0으로 못 박아 두면 그 기기에서만
         `stuck`이 영원히 거짓이 되어 바닥 헤어라인이 뜨지 않습니다.
         계산된 값을 읽으므로 노치가 없는 기기·데스크톱에서는 예전 그대로 0입니다. */
      const stickyTop = bar ? parseFloat(window.getComputedStyle(bar).top) || 0 : 0;
      if (barRect) setStuck(barRect.top <= stickyTop + 0.5);

      const line = stickyTop + (barRect?.height ?? 0) + 12;
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

  /* 오른쪽에 아직 남았는지 — 칩 줄 자신의 스크롤과 폭 변화만 봅니다.
     여백 2px은 브라우저마다 다른 소수점 반올림 때문입니다(끝에 닿았는데 1px이 남는 일). */
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const update = (): void => {
      setMoreRight(scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 2);
    };

    update();
    scroller.addEventListener("scroll", update, { passive: true });
    /* 글자 크기 3단·회전·프레임 폭 변화로 칩 줄의 폭이 바뀌면 다시 잽니다.
       (ResizeObserver가 없는 환경에서도 위 첫 계산과 스크롤 갱신은 그대로 동작합니다.) */
    const ro =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    ro?.observe(scroller);
    return () => {
      scroller.removeEventListener("scroll", update);
      ro?.disconnect();
    };
  }, [items]);

  const handleClick = useCallback((id: string): void => {
    // 눌린 즉시 활성 표시를 옮깁니다 — 스크롤이 끝나기를 기다리지 않게.
    setActive(id);
    // 모바일에서 그 항목이 접혀 있으면 먼저 폅니다(앵커 이동은 브라우저가 그대로 합니다).
    announceTocTarget(id);
  }, []);

  if (items.length === 0) return null;

  /* 도킹 기준선은 0이 아니라 안전 영역 아래입니다(2026-08-26) — `viewportFit: "cover"`
     아래에서 조상의 `padding-top`은 sticky의 기준선을 옮기지 못하므로, `top-0`이면
     목차 칩이 상태바·다이내믹 아일랜드 밑으로 들어갑니다(페르소나 FE). */
  return (
    <div
      ref={barRef}
      className={cx(
        "sticky top-[var(--chim-safe-t)] z-20 -mx-[20px] bg-paper px-[20px] py-2",
        stuck && "border-b border-line",
        className,
      )}
    >
      {/* 노치 띠 — 바 위로 지나가는 내용을 화면 색으로 덮습니다. 높이가 `--chim-safe-t`라
          노치 없는 기기·데스크톱에서는 0px이고, 프레임 폭으로 잘라 두어 480px↑에서
          지면(paper-out) 위로 흰 띠가 번지지 않습니다. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 mx-auto h-[var(--chim-safe-t)] max-w-[var(--chim-frame-w)] bg-paper"
      />
      <nav aria-label={label} className="relative">
        {/* 「뒤에 더 있다」 — 12px 페이드 한 겹.
            그라디언트는 **화면 지면(paper) 한 색에서 투명으로**만 갑니다(가이드 §7 그라데이션
            금지의 예외가 아니라, 색이 하나라 장식이 아닌 스크롤 신호이기 때문입니다).
            스크롤러 **바깥**에 두는 이유는 안쪽 절대위치 상자는 내용과 함께 밀려나기 때문입니다.
            Tailwind 그라디언트 유틸 대신 한 줄 CSS로 적습니다 — 색이 하나뿐이라
            `from-*`/`to-*` 두 유틸로 나누면 오히려 무엇을 하는지 흐려집니다. */}
        <span
          aria-hidden
          className={cx(
            "pointer-events-none absolute inset-y-0 right-0 z-10 w-[12px]",
            "[background:linear-gradient(to_left,var(--color-paper),rgb(255_255_255_/_0))]",
            "transition-opacity duration-150 ease-soft",
            moreRight ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          ref={scrollerRef}
          className="flex gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
                    "rounded-chip px-3 py-2 text-[0.7813rem] leading-[1.45] whitespace-nowrap",
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
