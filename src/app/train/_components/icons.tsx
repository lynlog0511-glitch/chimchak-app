import { IconBase, type IconProps } from "@/components/icons";

/* ─────────────────────────────────────────────────────────────
   훈련 화면 전용 아이콘.

   공용 배럴(`@/components/icons`)에 없는 것만 여기에 둡니다.
   규격은 공용과 동일합니다 — 24×24 viewBox · stroke=currentColor ·
   strokeWidth 1.75 · round cap/join · fill none · aria-hidden.
   (공용 폴더는 design 에이전트 소유라 이쪽에 둡니다.)
   ───────────────────────────────────────────────────────────── */

/** 보기 버튼 고르기 — 손가락 대신 절제된 포인터 하나만 씁니다. */
export function IconPointer({ className, strokeWidth }: IconProps) {
  return (
    <IconBase className={className} strokeWidth={strokeWidth}>
      <path d="M6.6 3.6v13.2l3.3-3.2 2.2 4.8 2.4-1.1-2.2-4.7h4.6L6.6 3.6Z" />
    </IconBase>
  );
}
