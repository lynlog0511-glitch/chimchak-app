/**
 * 가림 인라인 칩 — **한 벌**입니다 (가이드 §4.9 · 시안 6e).
 *
 * 가명처리 토큰(`[대상자]`·`[번호]`·`[기관]`·`[주소]`·`[생년]`)이 문장 한가운데 설 때 쓰는
 * 칩 하나의 규격입니다: **brand-tint 면 · 반지름 6px · 700 · `brand-on-tint` 잉크.**
 *
 * 왜 상수인가. 같은 마스킹 토큰을 그리는 자리가 네 곳인데 **세 벌**로 갈려 있었습니다 —
 * /report 둘은 `mx-[1px] px-[7px] font-bold`, /history 하나는 `mx-[2px] px-[5px] font-extrabold`
 * (게다가 잉크 이름이 `brand-900`이었습니다), /report 원문 대조의 두 조각짜리 칩은
 * `mx-[2px] px-[6px]`에 굵기 무지정이었습니다. 값이 굵기·좌우 여백·잉크 이름 세 축으로 갈리면
 * /report에서 본 칩과 /history에서 본 칩이 같은 것임을 눈이 한 번에 잇지 못합니다
 * (7차 페르소나 디자이너 P1).
 *
 * 여기 없는 것은 **레이아웃**뿐입니다. 원문 대조 칩은 한 칩 안에 두 조각(원문 취소선 + 치환어)을
 * 담느라 `inline-flex gap-[4px]`가 더 붙는데, 그 자리만 `cx`로 덮고 사유를 옆에 적습니다.
 *
 * 쓰는 자리: `report/_components/DraftRows.tsx` · `report/_components/MaskReview.tsx`(둘) ·
 * `history/_components/ReportList.tsx`.
 */
export const MASK_CHIP_CLASS =
  "mx-[1px] rounded-[6px] bg-brand-tint px-[7px] py-[1px] font-bold text-brand-on-tint";
