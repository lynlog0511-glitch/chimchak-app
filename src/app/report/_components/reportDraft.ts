/**
 * 확정 전 원문 임시 보관 — /report 위저드가 쓰는 세션 저장소 두 칸.
 *
 * 왜 두는가. 이 앱은 standalone PWA이고 하단 탭바 말고는 크롬이 없습니다. 확정하기 전에 화면을
 * 벗어나면 말로 3분 불러넣은 보고가 그대로 사라지므로, **가리기 전 원문**만 그 탭이 살아 있는
 * 동안 맡아 둡니다. localStorage가 아니라 sessionStorage인 이유가 그것입니다 — 남길 이유는
 * 「방금 실수로 나갔다」 하나뿐이라, 탭을 닫으면 사라지고 확정하시면 즉시 지웁니다.
 *
 * ── 왜 칸이 둘인가 (2026-08-26) ─────────────────────────────
 * 한 칸을 두 회차가 다투면, 가드 한 줄의 방향이 어느 쪽 글을 죽일지 정합니다. 실제로 두 번
 * 그랬습니다 — 가드에 `text.length === 0`이 붙어 있던 동안에는 카드가 떠 있는데 한 글자만 쳐도
 * **맡아 둔 지난 글**이 그 글자에 덮였고, 그 조건을 걷어내자 이번에는 고르시기 전까지 보관이
 * 통째로 꺼져 **지금 부르신 글**이 한 글자도 남지 않았습니다(페르소나 FE med ×2).
 * 손실의 방향만 바뀌었을 뿐, 원인은 「칸이 하나」였습니다.
 *
 *   · CURRENT_KEY — **지금 적는 글.** 원문이 바뀔 때마다 조건 없이 여기에 적습니다.
 *   · PENDING_KEY — **맡아 둔 지난 글.** 「이어서 / 새로」 카드가 읽는 칸이고, 카드를
 *     고르시기 전까지 쓰기 쪽이 건드리지 않습니다.
 *
 * 두 칸이 서로를 덮지 못하므로 쓰기 가드 자체가 없어집니다. 승격은 화면이 다시 열릴 때 한 번
 * 일어납니다(`promoteHeldDraft`) — 돌아오셨다는 것은 지난 회차가 확정 없이 끝났다는 뜻입니다.
 *
 * CURRENT가 옛 이름(`…draft.v1`)을 그대로 쓰는 것은 일부러입니다. 그 칸의 뜻이 처음부터
 * 「지금 적는 글」이었으므로, 이미 열려 있던 탭에 남아 있던 글도 다음 승격에서 그대로 맡아 둔
 * 글이 됩니다 — 옮겨 적는 코드가 따로 필요 없습니다.
 *
 * 컴포넌트 밖 모듈로 둔 이유는 하나 더 있습니다. 이 저장소의 회귀 그물에는 컴포넌트 러너가
 * 없어서, 위저드 안에 두면 손실 방향이 또 뒤집혀도 아무도 잡지 못합니다. 여기 있으면 지금
 * 있는 vitest가 그대로 재현 절차를 밟습니다(tests/reportDraft.test.ts).
 */

/** 지금 적는 글 — 원문이 바뀔 때마다 갱신합니다. */
export const CURRENT_KEY = "chimchak.report.draft.v1";
/** 맡아 둔 지난 글 — 「적으시던 보고가 있습니다」 카드가 읽는 칸입니다. */
export const PENDING_KEY = "chimchak.report.draft.pending.v1";

function session(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.sessionStorage;
  } catch {
    /* 사생활 보호 모드·저장 공간 차단 — 임시 보관만 못 할 뿐 작성은 그대로 이어집니다 */
    return undefined;
  }
}

export function readDraftSlot(key: string): string {
  try {
    return session()?.getItem(key) ?? "";
  } catch {
    return "";
  }
}

/** 공백뿐인 글은 지웁니다 — 빈 칸을 남겨 두면 다음 승격이 그것을 「맡아 둔 글」로 읽습니다. */
export function writeDraftSlot(key: string, text: string): void {
  try {
    if (text.trim().length === 0) session()?.removeItem(key);
    else session()?.setItem(key, text);
  } catch {
    /* 위와 같음 */
  }
}

export function clearDraftSlot(key: string): void {
  try {
    session()?.removeItem(key);
  } catch {
    /* 위와 같음 */
  }
}

/**
 * 두 원문을 시간 순으로 잇습니다 — 먼저 적으신 글이 앞입니다.
 *
 * 예전 이음 규칙은 `text.length > 0 ? `${pending}\n${text}` : pending` 이었습니다. 길이만 보므로
 * 스페이스나 줄바꿈 하나만 들어 있어도 「글이 있다」로 읽어, 맡아 둔 글 뒤에 빈 줄과 공백이 붙은
 * 채 가리기 단계로 넘어갔습니다(가리기 화면 첫 줄이 빈 줄이 되고, 5요소 추출도 그 공백을 함께
 * 봅니다). 양쪽을 다듬어 잇고, 한쪽이 공백뿐이면 다른 쪽만 남깁니다.
 * 이음쇠는 그대로 줄바꿈 하나입니다 — 말로 부른 두 토막을 한 문단으로 붙이면 문장이 엉킵니다.
 */
export function joinDrafts(earlier: string, later: string): string {
  const head = earlier.trim();
  const tail = later.trim();
  if (head.length === 0) return tail;
  if (tail.length === 0) return head;
  return `${head}\n${tail}`;
}

/**
 * 화면이 다시 열릴 때의 승격 — 「지금 적는 글」을 「맡아 둔 글」로 올리고 지금 칸을 비웁니다.
 * 맡아 둔 값을 돌려줍니다(없으면 빈 문자열).
 *
 * 두 칸에 글이 다 있으면(카드를 고르지 않은 채 또 나가신 경우) 시간 순으로 이어 한 칸에 담습니다 —
 * 어느 쪽도 버리지 않는 것이 이 장치의 유일한 목적입니다.
 * 여러 번 불러도 결과가 같습니다(개발 서버의 StrictMode 이중 실행): 두 번째 호출은 이미 비워진
 * 「지금」 칸과 방금 올린 「맡아 둔」 칸을 다시 이을 뿐입니다.
 */
export function promoteHeldDraft(): string {
  const held = joinDrafts(readDraftSlot(PENDING_KEY), readDraftSlot(CURRENT_KEY));
  writeDraftSlot(PENDING_KEY, held);
  clearDraftSlot(CURRENT_KEY);
  return held;
}
