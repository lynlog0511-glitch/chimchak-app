/**
 * 목차 칩 → 접힌 섹션 사이의 신호.
 *
 * 모바일에서 이 화면의 섹션은 기본이 접힘입니다(19화면을 세로로 이어 붙이지 않으려고요).
 * 그런데 목차 칩은 앵커라, 접힌 섹션으로 뛰면 제목 줄에 닿고 내용은 그대로 접혀 있습니다 —
 * 「눌렀는데 아무 일도 없는」 상태가 됩니다. 그래서 칩이 눌린 항목 id를 창에 한 번 알리고,
 * 그 id를 가진 섹션이 스스로 펴집니다.
 *
 * 주소창의 `#항목`으로 바로 들어오신 경우는 `hashchange`와 첫 렌더가 같은 일을 합니다.
 */
export const SAFETY_TOC_EVENT = "chimchak:safety-toc";

/** 칩이 눌렸음을 알립니다(브라우저의 앵커 이동은 그대로 둡니다). */
export function announceTocTarget(id: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<string>(SAFETY_TOC_EVENT, { detail: id }));
}
