import type { ReactNode } from "react";
import { cx } from "./utils";

/**
 * 아이브로가 쓸 수 있는 잉크 — **이 표가 목록의 전부**입니다.
 *
 * 색을 `className`으로 받지 않는 이유는 아래 컴포넌트 주석에 적혀 있습니다(같은 속성이 두 번
 * 붙는 길을 아예 막습니다). 새 색이 필요하면 여기에 한 줄을 더하고 가이드 §9-15를 함께 고칩니다 —
 * 그 마찰이 아이브로 색이 화면마다 늘어나는 것을 막습니다.
 */
export type EyebrowTone = "muted" | "brand" | "danger" | "ok" | "soft";

/**
 * 톤 → 잉크 클래스. 값 하나가 여기 한 번만 적힙니다.
 *
 * `brand`가 **800**인 것은 규칙입니다 — 「지면이 흰색이 아닌 순간이 있으면 brand-800」
 * (globals.css의 `--color-brand-700` 주석 · 가이드 §9-8). 아이브로는 회색 카드 위에도 서므로
 * 700을 열어 두지 않습니다. 실제로 `/safety` 문서 목록의 아이브로 하나가 700이었고,
 * 같은 화면의 형제 둘은 800이었습니다(7차 페르소나 디자이너 low).
 */
const TONE: Record<EyebrowTone, string> = {
  muted: "text-ink-muted",
  brand: "text-brand-800",
  danger: "text-danger-ink",
  ok: "text-ok-ink",
  /** 기본보다 한 단 진한 중성 — 「다시 볼 것」처럼 잘못이 아니지만 눈이 가야 하는 목록 위. */
  soft: "text-ink-soft",
};

export interface EyebrowLabelProps {
  children: ReactNode;
  /** 여백·레이아웃만 넘깁니다. **색 클래스는 받지 않습니다** — 아래 주석과 `tone` 참고. */
  className?: string;
  id?: string;
  /** 잉크 — 기본은 `muted`입니다. 값 목록은 위 `EyebrowTone`이 전부입니다. */
  tone?: EyebrowTone;
}

/**
 * 섹션 아이브로 — **12.5px / 700 / `ink-muted` / letter-spacing +.06em**이 정본입니다.
 * 「세 가지를 합니다」·「유형별로 해 본 것」·「최근 훈련」처럼 목록 위에 놓는 한 줄입니다.
 *
 * 제목이 아니라 **라벨**이므로 h2로 쓰지 않습니다. 목차 구조가 필요하면 `id`를 주고
 * 리스트 쪽에서 `aria-labelledby`로 가리키세요.
 *
 * 여백(`mt-4`)은 `className`으로 넘기고, **색은 `tone`으로 고릅니다**.
 *
 * ── 색이 prop인 이유 (2026-08-27) ────────────────────────────
 * 한동안 이 자리에는 「색이 다른 변형은 `className`으로 넘기세요」라고 적혀 있었습니다.
 * 그런데 `cx`(`components/utils.ts`)는 tailwind-merge가 아니라 **문자열 이어붙이기**이고,
 * 이 컴포넌트가 기본 색 클래스를 이미 들고 있습니다. 그래서 결과 class는
 * `… text-ink-muted text-brand-800` 꼴이 되고, 두 규칙은 같은 레이어·같은 명시도(0,1,0)라
 * **생성된 CSS에서 뒤에 나오는 쪽**이 이깁니다. Tailwind는 유틸리티를 알파벳 순으로 내보내므로
 * `.text-ink-muted`가 `.text-brand-700`·`.text-brand-800`·`.text-danger-ink`보다 **뒤**에 서고,
 * 새로 만든 색 변형 여섯 중 **다섯이 무효**였습니다(7차 페르소나 FE med — 빌드 산출물 CSS의
 * 바이트 위치로 확인된 자리입니다. 소스 문자열로는 완전히 정상으로 보입니다).
 *
 * 컴포넌트가 문서로 약속한 것을 구현이 지킬 수 없는 상태였으므로, **약속하는 쪽을 고쳤습니다** —
 * 색 클래스를 기본값에서 떼고 `tone` 한 칸으로 받습니다. 이러면 같은 속성이 두 번 붙는 길이
 * 아예 막히고, 「어느 쪽이 이기는가」가 CSS 출력 순서에 달리지 않습니다.
 * `tests/designScale.test.ts`의 ⑯이 「`<EyebrowLabel`의 `className`에 `text-` 색 클래스가
 * 오지 않는다」를 못 박습니다 — 다음에 손으로 색을 넘기면 그 자리에서 걸립니다.
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
 * 7차 실측 잔여는 **9곳이고 전부 그 인라인 예외**입니다(파일·개수는 게이트 ⑮에 등재).
 * 게이트는 이제 자간 없는 사본도 봅니다 — 자간을 키로만 삼던 동안 `ProtocolAddressCard`의
 * 「방문지 주소」 한 줄이 같은 파일의 `<EyebrowLabel>` 옆에서 400/자간 0/ink-faint로 살아남았고,
 * 그것이 5차에 「먼저 이것부터」로 이름까지 댄 자리였습니다(7차 페르소나 디자이너 P0).
 */
export function EyebrowLabel({ children, className, id, tone = "muted" }: EyebrowLabelProps) {
  return (
    <p
      id={id}
      className={cx("text-[0.7813rem] leading-[1.45] font-bold tracking-[0.06em]", TONE[tone], className)}
    >
      {children}
    </p>
  );
}

export default EyebrowLabel;
