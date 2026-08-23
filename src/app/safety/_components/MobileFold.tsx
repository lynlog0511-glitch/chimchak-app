"use client";

import { useCallback, useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { cx } from "@/components/utils";
import { SAFETY_TOC_EVENT } from "./tocEvent";

/**
 * 모바일에서만 접히는 섹션 손잡이.
 *
 * 이 화면은 증명서라 내용을 줄일 수 없는데, 430px 폭에서 세로로 이어 붙이면 15,000px가 넘습니다
 * (19화면). 그래서 **지우는 대신 접습니다** — 섹션 제목이 그대로 손잡이가 되고, 기본 펼침으로
 * 두는 것은 화면의 주장에 해당하는 셋(실측 패널·3계층 다이어그램·검증 계단)뿐입니다.
 *
 * 데스크톱(md↑)에서는 접지 않습니다. 폭이 넉넉해 문서로 읽히는 자리이고, 인쇄·검색(Ctrl+F)에서
 * 접힌 내용이 사라지지 않아야 하기 때문입니다. 그래서 화살표를 숨기고 누름도 막습니다.
 *
 * 자바스크립트가 없거나 아직 붙지 않은 순간에는 **펼침**이 기본값입니다 — 접는 것은 편의이고
 * 안 접히는 쪽이 안전하기 때문입니다(서버가 그린 화면과 첫 렌더가 같아 깜빡임도 없습니다).
 *
 * `handle`에는 **문단 태그를 넣지 않습니다** — `<summary>`가 담을 수 있는 것은 구절 내용과
 * 제목 하나뿐이라, 번호 줄은 `<span className="block">`으로 넘깁니다.
 */

export interface MobileFoldProps {
  /** 섹션 id — 목차 칩이 이 id로 「펴 주세요」를 보냅니다. */
  id: string;
  /** 손잡이에 들어가는 것 — 번호(span)와 제목(h2) 줄입니다. */
  handle: ReactNode;
  /** 모바일에서도 접지 않을 섹션(이 화면의 주장에 해당하는 칸) */
  alwaysOpen?: boolean;
  children: ReactNode;
  className?: string;
}

export function MobileFold({
  id,
  handle,
  alwaysOpen = false,
  children,
  className,
}: MobileFoldProps) {
  const [open, setOpen] = useState(true);
  /** 지금 폭에서 접을 수 있는지 — 데스크톱에서는 손잡이를 눌러도 접히지 않습니다. */
  const [foldable, setFoldable] = useState(false);

  useEffect(() => {
    if (alwaysOpen) return;
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = (): void => {
      setFoldable(mq.matches);
      setOpen(!mq.matches);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [alwaysOpen]);

  /* 목차 칩으로 뛰어온 항목은 폅니다 — 접힌 채로 두면 「눌렀는데 아무 일도 없는」 화면이 됩니다. */
  useEffect(() => {
    if (alwaysOpen) return;
    const openIfMine = (target: string): void => {
      if (target === id) setOpen(true);
    };
    const onToc = (event: Event): void => {
      openIfMine((event as CustomEvent<string>).detail);
    };
    const onHash = (): void => {
      const raw = window.location.hash.slice(1);
      // 주소창에 손으로 적어 넣은 값도 들어올 수 있어, 해독에 실패하면 원문 그대로 봅니다.
      let target = raw;
      try {
        target = decodeURIComponent(raw);
      } catch {
        /* 잘못된 % 표기 — 원문으로 비교합니다 */
      }
      openIfMine(target);
    };
    onHash();
    window.addEventListener(SAFETY_TOC_EVENT, onToc);
    window.addEventListener("hashchange", onHash);
    return () => {
      window.removeEventListener(SAFETY_TOC_EVENT, onToc);
      window.removeEventListener("hashchange", onHash);
    };
  }, [alwaysOpen, id]);

  const onSummaryClick = useCallback(
    (event: MouseEvent<HTMLElement>): void => {
      if (!foldable) event.preventDefault();
    },
    [foldable],
  );

  if (alwaysOpen) {
    return (
      <div className={className}>
        {handle}
        <div className="mt-5">{children}</div>
      </div>
    );
  }

  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className={cx("group", className)}
    >
      <summary
        onClick={onSummaryClick}
        // 접히지 않는 폭에서는 초점이 멈출 이유가 없습니다 — 눌러도 아무 일이 일어나지 않으니까요.
        tabIndex={foldable ? undefined : -1}
        className={cx(
          "relative block list-none pr-8 [&::-webkit-details-marker]:hidden",
          foldable ? "cursor-pointer" : "cursor-default",
        )}
      >
        {handle}
        <span
          aria-hidden
          className="absolute top-1/2 right-0 -translate-y-1/2 text-[1.0625rem] leading-none text-ink-ghost transition-transform duration-150 ease-soft group-open:rotate-90 md:hidden"
        >
          ›
        </span>
      </summary>
      <div className="mt-5">{children}</div>
    </details>
  );
}

export default MobileFold;
