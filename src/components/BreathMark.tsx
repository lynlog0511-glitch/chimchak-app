import { cx } from "./utils";

/**
 * 호흡 마크 — 침착의 전역 유일 심볼.
 *
 * 점 세 개의 간격이 점점 넓어집니다: 숨을 고르며 침착해지는 리듬입니다.
 * 장식 아이콘 금지 원칙(가이드 §0) 아래에서 이 마크 하나만 예외로 승격합니다 —
 * 홈 히어로·엔딩·앱 아이콘이 같은 마크를 씁니다(여러 개 만들지 않습니다).
 *
 * 앞 두 점은 brand-600 채움, 마지막 점은 tint 면 + brand-600 테두리 —
 * 아직 고르는 중인 숨 하나를 남겨 둔 모양입니다.
 *
 * 애니메이션은 여기에 넣지 않습니다. 쓰는 쪽이 `.breath-dot-1/2/3` 클래스로
 * 자기 화면의 모션 규율(prefers-reduced-motion 포함) 안에서 답니다.
 */
export function BreathMark({
  className,
  height = 14,
  label,
}: {
  className?: string;
  /** px 단위 렌더 높이 — 폭은 비율(6:1)로 따라옵니다. */
  height?: number;
  /** 스크린리더 라벨. 장식으로 쓸 때는 생략(aria-hidden 처리). */
  label?: string;
}) {
  return (
    <svg
      viewBox="0 0 96 16"
      height={height}
      width={height * 6}
      className={cx("block", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <circle className="breath-dot-1" cx="10" cy="8" r="4" fill="var(--color-brand-600)" />
      <circle className="breath-dot-2" cx="38" cy="8" r="4" fill="var(--color-brand-600)" />
      <circle
        className="breath-dot-3"
        cx="74"
        cy="8"
        r="4"
        fill="var(--color-brand-tint)"
        stroke="var(--color-brand-600)"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export default BreathMark;
