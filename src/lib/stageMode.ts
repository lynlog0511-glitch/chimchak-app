/**
 * 시연 스위치 — **무대에서만 켜는 표시** 하나.
 *
 * 앱에는 사용자가 아니라 발표자를 위해 있는 장치가 몇 개 있습니다(규칙 엔진 예시 문장 시트가
 * 그렇습니다). 그것들이 평상시 화면에 남아 있으면, 훈련을 하러 오신 분이 「이건 내 것이 아니구나」
 * 하는 문장을 대화 한가운데에서 읽게 됩니다. 그래서 자리를 옮기는 대신 **문 하나를 답니다** —
 * 켜져 있을 때만 그 장치들이 렌더되고, 꺼져 있으면 노출은 0px입니다.
 *
 * 원칙
 * - 기기 안(localStorage)에만 남습니다. 저장하는 값은 켜짐/꺼짐 한 칸뿐이고 기본값은 꺼짐입니다.
 * - SSR 가드: 서버 렌더 중에는 조용히 꺼짐으로 동작하고 저장소를 건드리지 않습니다.
 *   기본값이 꺼짐이라 서버 렌더 결과와 첫 클라이언트 렌더가 어긋나지 않습니다(settings.ts와 같은 규칙).
 * - 스위치 UI는 여기 두지 않습니다 — 발표자 화면(/check)이 이 함수들을 가져다 씁니다.
 *   키 문자열 `chimchak.stage.v1` 이 그 화면과의 유일한 약속입니다.
 *
 * @example
 * getStageMode();        // false (기본값)
 * setStageMode(true);    // 무대 장치가 열립니다
 * subscribeStageMode(fn); // 다른 탭에서 켜도 같은 값을 받습니다
 */

/** 이 기기에 남는 유일한 칸 — /check의 스위치와 공유하는 키입니다. */
export const STAGE_MODE_KEY = "chimchak.stage.v1";

const ON = "on";
const OFF = "off";

type Listener = (enabled: boolean) => void;

const listeners = new Set<Listener>();

/**
 * 마지막으로 읽은 값.
 * 렌더마다 저장소를 파싱하지 않으려고 들고 있습니다 — 서버에서는 채우지 않습니다.
 */
let cache: boolean | null = null;

function getStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/**
 * 지금 시연 스위치가 켜져 있는지.
 * 서버·저장소 차단 환경에서는 언제나 꺼짐입니다.
 *
 * @example getStageMode(); // false
 */
export function getStageMode(): boolean {
  if (cache !== null) return cache;
  const storage = getStorage();
  if (!storage) return false;
  try {
    const enabled = storage.getItem(STAGE_MODE_KEY) === ON;
    cache = enabled;
    return enabled;
  } catch {
    return false;
  }
}

/**
 * 스위치를 바꿉니다: 캐시 갱신 → 저장 → 구독자 통지.
 * 저장이 막힌 기기(시크릿 모드 등)에서도 이번 세션 동안은 그대로 켜져 있습니다.
 *
 * @example setStageMode(true); // true
 */
export function setStageMode(enabled: boolean): boolean {
  cache = enabled;
  const storage = getStorage();
  try {
    storage?.setItem(STAGE_MODE_KEY, enabled ? ON : OFF);
  } catch {
    /* 저장 공간 부족·사생활 보호 모드 — 조용히 무시합니다(이번 세션에만 유지됩니다) */
  }
  for (const listener of listeners) listener(enabled);
  return enabled;
}

/**
 * 스위치 변경 구독. 해제 함수를 돌려줍니다.
 *
 * 같은 탭의 변경(`setStageMode`)과 다른 탭의 변경(`storage` 이벤트)을 모두 받습니다 —
 * 발표자가 /check를 다른 탭에 띄워 두고 켜는 동선이 실제 시연 동선이기 때문입니다.
 *
 * @example useEffect(() => subscribeStageMode(setOn), []);
 */
export function subscribeStageMode(listener: Listener): () => void {
  listeners.add(listener);

  const onStorage = (event: StorageEvent) => {
    // key가 null이면 저장소 전체가 지워진 것입니다 — 그때도 다시 읽습니다.
    if (event.key !== null && event.key !== STAGE_MODE_KEY) return;
    cache = null;
    listener(getStageMode());
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}
