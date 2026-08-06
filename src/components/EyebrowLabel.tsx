import type { ReactNode } from "react";
import { cx } from "./utils";

export interface EyebrowLabelProps {
  children: ReactNode;
  className?: string;
  id?: string;
}

/**
 * 섹션 아이브로 — 12px w700 `ink-muted`, letter-spacing .06em (v4 §2).
 * 「세 가지를 합니다」·「유형별로 해 본 것」·「최근 훈련」처럼 목록 위에 놓는 한 줄입니다.
 *
 * 제목이 아니라 **라벨**이므로 h2로 쓰지 않습니다. 목차 구조가 필요하면 `id`를 주고
 * 리스트 쪽에서 `aria-labelledby`로 가리키세요.
 */
export function EyebrowLabel({ children, className, id }: EyebrowLabelProps) {
  return (
    <p
      id={id}
      className={cx("text-[0.7813rem] leading-[1.45] font-bold tracking-[0.06em] text-ink-muted", className)}
    >
      {children}
    </p>
  );
}

export default EyebrowLabel;
