/**
 * 침착(ChimChak) 표시·음성 설정.
 *
 * 원칙
 * - 기기 안(localStorage)에만 저장한다. 서버 전송·외부 API 호출은 0건이다.
 * - 저장하는 것은 **취향값 두 개뿐**이다(글자 크기·음성 빠르기). 발화 원문·개인정보는 들어오지 않는다.
 * - SSR 가드: 서버 렌더링 중에는 조용히 기본값으로 동작하고 document를 건드리지 않는다.
 * - 글자 크기는 html의 font-size를 바꾸는 방식이다. 디자인 토큰과 컴포넌트가 전부 rem 기준이라
 *   루트 한 곳만 올리면 화면 전체가 비례해서 커진다(글자·터치 타겟·여백이 함께 커진다).
 *   globals.css의 `html { font-size: 16px }` 는 그대로 두고, 인라인 스타일로만 덮어쓴다.
 *
 * @example
 * initSettings();                       // AppHeader 마운트 시 1회
 * setSetting("fontScale", "large");     // 즉시 18px로 반영 + 저장
 * getSpeechRateValue();                 // 0.95 (speech.ts가 speak()의 기본 rate로 사용)
 */

/** 글자 크기 — 표준 16px / 크게 18px / 아주 크게 20px (루트 기준, 나머지는 rem 비례) */
export type FontScale = "standard" | "large" | "xlarge";

/** 음성 빠르기 — 느리게 0.8 / 표준 0.95 / 빠르게 1.1 */
export type SpeechRate = "slow" | "standard" | "fast";

export interface ChimchakSettings {
  fontScale: FontScale;
  speechRate: SpeechRate;
}

export const SETTINGS_KEY = "chimchak.settings.v1";

export const DEFAULT_SETTINGS: ChimchakSettings = {
  fontScale: "standard",
  speechRate: "standard",
};

/** 루트 font-size(px). rem 기반이라 이 값 하나가 화면 전체 비율을 정한다. */
export const FONT_SCALE_PX: Record<FontScale, number> = {
  standard: 16,
  large: 18,
  xlarge: 20,
};

/** SpeechSynthesisUtterance.rate 값 */
export const SPEECH_RATE_VALUE: Record<SpeechRate, number> = {
  slow: 0.8,
  standard: 0.95,
  fast: 1.1,
};

/** 설정 화면에 그대로 쓰는 표기(존댓말·한국어) */
export const FONT_SCALE_OPTIONS: ReadonlyArray<{ value: FontScale; label: string }> = [
  { value: "standard", label: "표준" },
  { value: "large", label: "크게" },
  { value: "xlarge", label: "아주 크게" },
];

export const SPEECH_RATE_OPTIONS: ReadonlyArray<{ value: SpeechRate; label: string }> = [
  { value: "slow", label: "느리게" },
  { value: "standard", label: "표준" },
  { value: "fast", label: "빠르게" },
];

/* ── 내부 상태 ─────────────────────────────────────────── */

/**
 * 마지막으로 읽은 설정.
 * speak()는 문장마다 이 값을 물어보므로, 매번 localStorage를 파싱하지 않도록 캐시해 둔다.
 * 서버에서는 캐시를 채우지 않는다(요청 간에 값이 섞이지 않게).
 */
let cache: ChimchakSettings | null = null;

type Listener = (settings: ChimchakSettings) => void;
const listeners = new Set<Listener>();

function getStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function isFontScale(value: unknown): value is FontScale {
  return value === "standard" || value === "large" || value === "xlarge";
}

function isSpeechRate(value: unknown): value is SpeechRate {
  return value === "slow" || value === "standard" || value === "fast";
}

/** 저장된 값이 낡았거나 손상됐어도 기본값으로 안전하게 메운다. */
function normalize(raw: unknown): ChimchakSettings {
  if (typeof raw !== "object" || raw === null) return { ...DEFAULT_SETTINGS };
  const record = raw as Record<string, unknown>;
  return {
    fontScale: isFontScale(record.fontScale) ? record.fontScale : DEFAULT_SETTINGS.fontScale,
    speechRate: isSpeechRate(record.speechRate) ? record.speechRate : DEFAULT_SETTINGS.speechRate,
  };
}

/* ── 읽기·쓰기 ─────────────────────────────────────────── */

/**
 * 저장된 설정을 읽는다. 서버·저장소 차단 환경에서는 기본값을 돌려준다.
 *
 * @example
 * const { fontScale } = loadSettings();
 */
export function loadSettings(): ChimchakSettings {
  const storage = getStorage();
  if (!storage) return { ...DEFAULT_SETTINGS };
  try {
    const raw = storage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return normalize(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * 현재 설정(캐시 우선). 렌더 중에 부담 없이 부를 수 있다.
 *
 * @example
 * const settings = getSettings();
 */
export function getSettings(): ChimchakSettings {
  if (cache) return { ...cache };
  const loaded = loadSettings();
  if (getStorage()) cache = loaded;
  return { ...loaded };
}

/**
 * 설정을 저장한다(로컬 전용).
 *
 * @example
 * saveSettings({ fontScale: "large", speechRate: "slow" });
 */
export function saveSettings(settings: ChimchakSettings): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* 저장 공간 부족·사생활 보호 모드 — 조용히 무시한다(설정은 이번 세션에만 유지된다) */
  }
}

/* ── 적용 ──────────────────────────────────────────────── */

/**
 * 글자 크기를 화면에 반영한다. 루트 font-size만 바꾸면 rem 기반 레이아웃이 통째로 비례한다.
 *
 * @example
 * applyFontScale("xlarge"); // html { font-size: 20px }
 */
export function applyFontScale(scale: FontScale): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.fontSize = `${FONT_SCALE_PX[scale]}px`;
  root.dataset.chimFontScale = scale;
}

/**
 * 설정 전체를 화면에 반영한다(음성 빠르기는 speak()가 읽어 가므로 별도 DOM 작업이 없다).
 *
 * @example
 * applySettings(getSettings());
 */
export function applySettings(settings: ChimchakSettings): void {
  applyFontScale(settings.fontScale);
}

/**
 * 저장된 설정을 읽어 즉시 적용한다. 여러 번 불러도 안전하다(멱등).
 * 화면이 그려지기 전에 부를수록 깜빡임이 줄어든다 — AppHeader가 가장 이른 지점이다.
 *
 * @example
 * useEffect(() => { initSettings(); }, []);
 */
export function initSettings(): ChimchakSettings {
  const settings = getSettings();
  applySettings(settings);
  return settings;
}

/* ── 변경·구독 ─────────────────────────────────────────── */

function emit(settings: ChimchakSettings): void {
  for (const listener of listeners) {
    listener({ ...settings });
  }
}

/**
 * 설정을 통째로 바꾼다: 캐시 갱신 → 저장 → 화면 반영 → 구독자 통지.
 *
 * @example
 * updateSettings({ fontScale: "large", speechRate: "fast" });
 */
export function updateSettings(next: ChimchakSettings): ChimchakSettings {
  const settings = normalize(next);
  cache = settings;
  saveSettings(settings);
  applySettings(settings);
  emit(settings);
  return { ...settings };
}

/**
 * 항목 하나만 바꾼다.
 *
 * @example
 * setSetting("speechRate", "slow");
 */
export function setSetting<K extends keyof ChimchakSettings>(
  key: K,
  value: ChimchakSettings[K],
): ChimchakSettings {
  return updateSettings({ ...getSettings(), [key]: value });
}

/**
 * 설정 변경 구독. 해제 함수를 돌려준다.
 *
 * @example
 * useEffect(() => subscribeSettings(setLocalState), []);
 */
export function subscribeSettings(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/* ── 음성 ──────────────────────────────────────────────── */

/**
 * 지금 설정된 낭독 속도(SpeechSynthesisUtterance.rate).
 * speech.ts의 speak()가 rate를 따로 받지 않았을 때 이 값을 쓴다.
 *
 * @example
 * getSpeechRateValue(); // 0.8 (느리게)
 */
export function getSpeechRateValue(): number {
  return SPEECH_RATE_VALUE[getSettings().speechRate];
}
