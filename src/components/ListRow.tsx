import type { ReactNode } from "react";
import Link from "next/link";
import { cx } from "./utils";

export type ListRowSize = "md" | "lg";

/** md — 홈 「세 가지를 합니다」 (제목 16px · 부제 13px) / lg — 응급 5종 (제목 17.5px · 부제 12.5px) */
const SIZE: Record<ListRowSize, { row: string; title: string; subtitle: string; gap: string }> = {
  md: {
    row: "py-[15px] px-[2px]",
    title: "text-[1rem]",
    subtitle: "text-[0.8125rem]",
    gap: "gap-3",
  },
  lg: {
    row: "py-4 px-[2px]",
    title: "text-[1.0938rem]",
    subtitle: "text-[0.7813rem]",
    gap: "gap-[13px]",
  },
};

export interface ListRowProps {
  title: ReactNode;
  /** 한 줄 요약 — 「일으키지 않고 확인부터 · 6단계」처럼 행동을 먼저 씁니다. */
  subtitle?: ReactNode;
  /** 좌측 요소 — `MarkerSquare` 등. 없으면 제목이 왼쪽 끝에 붙습니다(홈 리스트). */
  leading?: ReactNode;
  /** 우측 요소 — 기본은 `›`. 「이어서 ›」처럼 텍스트를 쓰려면 직접 주세요. */
  trailing?: ReactNode;
  href?: string;
  /** 클라이언트 컴포넌트에서만 넘기세요(서버 컴포넌트는 함수를 전달할 수 없습니다). */
  onClick?: () => void;
  size?: ListRowSize;
  /** 행 아래 hairline — 기본 true. `ListRows`로 감싸면 마지막 행의 선은 자동으로 지워집니다. */
  divider?: boolean;
  /** 링크 라벨이 제목만으로 부족할 때 */
  ariaLabel?: string;
  className?: string;
}

/**
 * 리스트 행 — **아이콘 없이** [제목 + 부제] + 우측 `›` (v4 §2).
 *
 * 행 사이는 hairline 1px, 터치 영역은 48px 이상입니다.
 * 카드로 감싸지 마세요 — 시안에서 목록은 카드가 아니라 선으로 나뉩니다.
 *
 * @example
 * <ListRows>
 *   <ListRow size="lg" href="/emergency/fall" leading={<MarkerSquare>낙</MarkerSquare>}
 *            title="낙상 — 의식 있음" subtitle="일으키지 않고 확인부터 · 6단계" />
 * </ListRows>
 */
export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  href,
  onClick,
  size = "md",
  divider = true,
  ariaLabel,
  className,
}: ListRowProps) {
  const s = SIZE[size];
  const base = cx(
    "flex w-full min-h-[48px] items-center text-left",
    s.row,
    s.gap,
    divider && "border-b border-line",
    (href || onClick) && "transition-colors duration-150 active:bg-paper-2",
    className,
  );

  const body = (
    <>
      {leading}
      <span className="min-w-0 flex-1">
        <span className={cx("block font-bold text-ink", s.title)}>{title}</span>
        {subtitle && (
          <span className={cx("mt-[2px] block leading-[1.5] text-ink-muted", s.subtitle)}>
            {subtitle}
          </span>
        )}
      </span>
      {trailing ?? (
        <span aria-hidden className="flex-none text-[1.0625rem] leading-none text-faint">
          ›
        </span>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} onClick={onClick} aria-label={ariaLabel} className={base}>
        {body}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-label={ariaLabel} className={base}>
        {body}
      </button>
    );
  }

  return <div className={base}>{body}</div>;
}

export interface ListRowsProps {
  children: ReactNode;
  className?: string;
  /** 목록에 이름을 붙일 때 — `EyebrowLabel`의 id를 가리키면 됩니다. */
  ariaLabelledBy?: string;
}

/**
 * 리스트 행 묶음 — 마지막 행의 hairline을 지웁니다(`.chim-rows`).
 * 행이 링크뿐이라면 시맨틱을 위해 이 안에서 `<ul>/<li>` 대신 그냥 행을 나열해도 됩니다.
 */
export function ListRows({ children, className, ariaLabelledBy }: ListRowsProps) {
  return (
    <div aria-labelledby={ariaLabelledBy} className={cx("chim-rows", className)}>
      {children}
    </div>
  );
}

export default ListRow;
