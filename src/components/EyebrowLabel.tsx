import type { ReactNode } from "react";
import { cx } from "./utils";

export interface EyebrowLabelProps {
  children: ReactNode;
  className?: string;
  id?: string;
}

/**
 * 섹션 아이브로 — **12.5px / 700 / `ink-muted` / letter-spacing +.06em**이 정본입니다.
 * 「세 가지를 합니다」·「유형별로 해 본 것」·「최근 훈련」처럼 목록 위에 놓는 한 줄입니다.
 *
 * 제목이 아니라 **라벨**이므로 h2로 쓰지 않습니다. 목차 구조가 필요하면 `id`를 주고
 * 리스트 쪽에서 `aria-labelledby`로 가리키세요.
 *
 * 색이 다른 변형(`text-brand-800`·`text-danger-ink` 등)과 여백(`mt-4`)은 `className`으로 넘기세요 —
 * 손으로 다시 적지 않습니다.
 *
 * ── 자간은 한 값입니다 (2026-08-26) ──────────────────────────
 * 가이드 §2 표는 「+0.05~0.06em」이라 **범위**로 적혀 있었고, 실코드는 그 범위 안에서 두 값으로
 * 갈려 있었습니다 — `tracking-[0.06em]` 손수 19줄 · `tracking-[0.04em]` 17줄로, 같은 역할의
 * 이름표가 화면마다 다르게 섰습니다(5차 페르소나 디자이너 med). 사다리를 열두 값으로 좁힌 것과
 * 같은 이유로 **.06em 한 값**으로 정하고, 손수 사본 스물여덟을 이 컴포넌트로 흡수했습니다.
 * (주석도 함께 고쳤습니다 — 예전에는 「12px」이라고 적었는데 실제 값은 12.5px이었습니다.)
 *
 * 남는 예외는 **문단을 넣을 수 없는 자리**뿐입니다 — 링크·`<summary>` 안의 `<span>`,
 * `<dl>`의 `<dt>`, 표의 `<th>`. 그 자리들은 같은 값을 인라인으로 적고 **사유를 주석으로 남깁니다**.
 * `tests/designScale.test.ts`의 「아이브로는 한 벌이다」가 파일·개수까지 못 박습니다 —
 * 새 손수 사본은 거기서 걸립니다.
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
