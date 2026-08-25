"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cx } from "@/components/utils";
import { SAFETY_TOC_EVENT } from "./tocEvent";

/**
 * 접히는 섹션 손잡이.
 *
 * 이 화면은 증명서라 내용을 줄일 수 없는데, 430px 폭에서 세로로 이어 붙이면 15,000px가 넘습니다
 * (19화면). 그래서 **지우는 대신 접습니다** — 섹션 제목이 그대로 손잡이가 되고, 기본 펼침으로
 * 두는 것은 화면의 주장에 해당하는 셋(실측 패널·3계층 다이어그램·검증 계단)뿐입니다.
 *
 * 2026-08-25: 예전에는 md↑에서 펴 둔 채 누름도 막았습니다. 앱 프레임이 어느 뷰포트에서도
 * 430px이라 「폭이 넉넉해 문서로 읽히는 자리」가 더는 없습니다 — **모든 폭에서 접힙니다**.
 * 인쇄에서는 브라우저가 `<details>`를 접힌 그대로 내보내므로, 이 화면을 종이로 남기실 때는
 * 필요한 섹션을 펴신 뒤 인쇄해 주십시오(목차 칩·해시로 오면 해당 섹션은 자동으로 펴집니다).
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
  /** 접지 않을 섹션(이 화면의 주장에 해당하는 칸) */
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

  /* 첫 렌더는 펼침(서버가 그린 화면과 같음)이고, 수화 직후 접습니다 —
     자바스크립트가 없는 화면에는 접힌 채 갇히는 내용이 남지 않습니다. */
  useEffect(() => {
    if (alwaysOpen) return;
    setOpen(false);
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
      <summary className="relative block cursor-pointer list-none pr-8 [&::-webkit-details-marker]:hidden">
        {handle}
        <span
          aria-hidden
          className="absolute top-1/2 right-0 -translate-y-1/2 text-[1.0625rem] leading-none text-ink-ghost transition-transform duration-150 ease-soft group-open:rotate-90"
        >
          ›
        </span>
      </summary>
      <div className="mt-5">{children}</div>
    </details>
  );
}

export default MobileFold;
