/**
 * 침착(ChimChak) 표시·음성·온라인 모드 설정.
 *
 * 원칙
 * - 기기 안(localStorage)에만 저장한다. 저장한 값이 어디론가 전송되는 일은 없다.
 * - 담기는 것은 셋이다: 취향값 두 개(글자 크기·음성 빠르기)와 **온라인 모드 스위치 하나**.
 *   스위치는 켜짐/꺼짐 한 칸뿐이고 기본값은 꺼짐이다. 예전에는 여기에 사용자가 입력한
 *   엔드포인트 주소·모델 이름·API 키가 함께 담겼다 — 지금 그 셋은 서버 환경변수로 옮겼고,
 *   브라우저에는 어떤 키도 두지 않는다(src/app/api/coach/route.ts).
 * - 발화 원문·개인정보는 여기 들어오지 않는다.
 * - SSR 가드: 서버 렌더링 중에는 조용히 기본값으로 동작하고 document를 건드리지 않는다.
 * - 글자 크기는 html의 font-size를 **백분율**로 바꾸는 방식이다. 백분율이라 브라우저·OS의
 *   글꼴 설정 위에 곱해진다 — 이미 크게 써 오신 분의 설정을 덮어쓰지 않는다.
 *   globals.css는 루트 font-size를 아예 선언하지 않고, 여기서 인라인 스타일로만 얹는다.
 * - 글자와 **그 값에서 파생되는 것**(rem 크기·rem 간격·마이크 버튼·탭 아이콘)은 함께 커진다.
 *   반면 임의값 px로 잡힌 간격과 터치 타겟 하한(48/54/56px)은 그대로다 — 그건 물리 치수이고,
 *   이미 하한을 넘겨 두었으므로 줄어드는 방향으로는 움직이지 않는다.
 *
 * @example
 * initSettings();                       // 첫 페인트 직후 1회(부팅은 layout.tsx의 동기 스크립트)
 * setSetting("fontScale", "large");     // 즉시 112.5%로 반영 + 저장
 * getSpeechRateValue();                 // 0.95 (speech.ts가 speak()의 기본 rate로 사용)
 */

/** 글자 크기 — 표준 100% / 크게 112.5% / 아주 크게 125% (브라우저 기본 글꼴에 곱한다) */
export type FontScale = "standard" | "large" | "xlarge";

/** 음성 빠르기 — 느리게 0.8 / 표준 0.95 / 빠르게 1.1 */
export type SpeechRate = "slow" | "standard" | "fast";

/**
 * 온라인 모드(경량 LLM) 스위치 — **기본은 꺼짐**이다.
 *
 * 칸이 하나뿐인 이유가 이 절의 전부다. 상류 주소·모델 이름·키는 서버 환경변수에만 있고,
 * 브라우저는 그 셋을 알지 못한 채 같은 도메인 `/api/coach`만 부른다. 사용자가 정하는 것은
 * 「내 발화를 밖으로 내보낼 것인가」 하나이고, 그 하나는 사용자 손에 있어야 한다.
 *
 * 이 스위치 하나가 여는 자리는 둘이다 — **코칭 한 문장**(미분류 턴)과 **어르신 대사 변주**
 * (검수 앵커를 같은 뜻으로 다시 쓰기 · 응급 유형 제외). 칸을 둘로 쪼개지 않은 이유는 사용자가
 * 정할 것이 여전히 하나이기 때문이다: 「이 앱이 네트워크를 쓰게 할 것인가」.
 * 이름이 `onlineCoaching`인 것은 저장된 값과의 약속이라 그대로 둔다(마이그레이션 없음).
 */
export interface OnlineCoachingSettings {
  enabled: boolean;
}

export interface ChimchakSettings {
  fontScale: FontScale;
  speechRate: SpeechRate;
  onlineCoaching: OnlineCoachingSettings;
}

export const SETTINGS_KEY = "chimchak.settings.v1";

/**
 * 온라인 코칭 기본값 — 서버에 무엇이 설정돼 있든 항상 꺼짐에서 출발한다.
 * 켜는 것은 사람이 하는 일이고, 이 기본값이 화면들이 적어 둔 「생성 호출 0건」의 기준이다.
 */
export const DEFAULT_ONLINE_COACHING: OnlineCoachingSettings = { enabled: false };

export const DEFAULT_SETTINGS: ChimchakSettings = {
  fontScale: "standard",
  speechRate: "standard",
  onlineCoaching: DEFAULT_ONLINE_COACHING,
};

/**
 * 루트 font-size — **백분율**이다(2026-08-25에 px에서 바꿨다).
 *
 * 백분율은 부모, 즉 브라우저 기본 글꼴 크기에 **곱해진다**. 그래서
 * - 기본 16px 브라우저: 16 / 18 / 20px — 예전 px 값과 한 픽셀도 다르지 않다.
 * - 휴대폰·브라우저에서 이미 글꼴을 크게 설정해 둔 분: 그 크기 위에 한 단 더 커진다.
 *
 * px로 못 박았을 때는 두 번째 경우가 통째로 무시됐다 — 다른 앱은 다 커졌는데 이 앱만 작으니
 * 「내 설정이 안 먹는다」가 아니라 「이 앱이 작다」로 읽히고, 그 상태에서 앱 안 설정을 스스로
 * 찾아 들어갈 확률은 낮다. 주 사용자가 중고령이라고 명시한 앱에서 이 방향은 반대였다.
 * (`globals.css`의 `html { font-size }` 선언과 `-webkit-text-size-adjust`도 같은 날 지웠다.)
 */
export const FONT_SCALE_PERCENT: Record<FontScale, string> = {
  standard: "100%",
  large: "112.5%" /* 기본 16px에서 18px */,
  xlarge: "125%" /* 기본 16px에서 20px */,
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

/**
 * 온라인 코칭 설정을 안전한 범위로 되돌린다.
 *
 * 읽는 칸은 `enabled` 하나뿐이다. 예전 방식으로 저장된 주소·모델 이름·키가 아직 남아 있어도
 * **조용히 버린다** — 다시 저장하는 순간 그 칸들은 사라지고, 그 사이에도 어디에도 쓰이지 않는다.
 * (키를 옮기지 않고 버리는 쪽을 고른 이유: 서버로 올려 줄 자리가 없고, 올려 줘서도 안 된다.)
 */
function normalizeOnlineCoaching(raw: unknown): OnlineCoachingSettings {
  if (typeof raw !== "object" || raw === null) return { ...DEFAULT_ONLINE_COACHING };
  return { enabled: (raw as Record<string, unknown>).enabled === true };
}

/** 저장된 값이 낡았거나 손상됐어도 기본값으로 안전하게 메운다. */
function normalize(raw: unknown): ChimchakSettings {
  if (typeof raw !== "object" || raw === null) return freshDefaults();
  const record = raw as Record<string, unknown>;
  return {
    fontScale: isFontScale(record.fontScale) ? record.fontScale : DEFAULT_SETTINGS.fontScale,
    speechRate: isSpeechRate(record.speechRate) ? record.speechRate : DEFAULT_SETTINGS.speechRate,
    onlineCoaching: normalizeOnlineCoaching(record.onlineCoaching),
  };
}

/** 중첩된 객체까지 새로 만든 기본값 — 얕은 복사로 기본값 객체가 공유되지 않게 한다. */
function freshDefaults(): ChimchakSettings {
  return { ...DEFAULT_SETTINGS, onlineCoaching: { ...DEFAULT_ONLINE_COACHING } };
}

/** 밖으로 내보내는 복사본 — 호출자가 손대도 캐시가 흔들리지 않게 한다. */
function copy(settings: ChimchakSettings): ChimchakSettings {
  return { ...settings, onlineCoaching: { ...settings.onlineCoaching } };
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
  if (!storage) return freshDefaults();
  try {
    const raw = storage.getItem(SETTINGS_KEY);
    if (!raw) return freshDefaults();
    return normalize(JSON.parse(raw));
  } catch {
    return freshDefaults();
  }
}

/**
 * 현재 설정(캐시 우선). 렌더 중에 부담 없이 부를 수 있다.
 *
 * @example
 * const settings = getSettings();
 */
export function getSettings(): ChimchakSettings {
  if (cache) return copy(cache);
  const loaded = loadSettings();
  if (getStorage()) cache = loaded;
  return copy(loaded);
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
 * 글자 크기를 화면에 반영한다. 루트 font-size만 바꾸면 rem 기반 값이 통째로 비례한다.
 *
 * @example
 * applyFontScale("xlarge"); // html { font-size: 125% }
 */
export function applyFontScale(scale: FontScale): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.fontSize = FONT_SCALE_PERCENT[scale];
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
    listener(copy(settings));
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
  return copy(settings);
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

/* ── 온라인 모드 ───────────────────────────────────────── */

/**
 * 설정 화면의 절 이름 — 스위치 하나가 여는 자리 **셋**을 이름에 그대로 적는다.
 * 「온라인 코칭」이라고만 적어 두면 어르신 대사가 바뀌는 것도, 자유 연습이 열리는 것도
 * 이름 밖의 일이 된다. 이름이 하나만 말하는 순간 나머지는 사용자가 허락한 적 없는 일이 된다.
 */
export const ONLINE_MODE_LABEL = "온라인 모드 — 코칭·대사 변주·자유 연습";

/**
 * 설정 화면에 그대로 쓰는 고지 — 무엇이 어디로 나가는지 밝힌다.
 *
 * 네 문장이 각각 다른 일을 한다. ① 코칭에서 나가는 것(가명처리를 지난 발화 한 문장),
 * ② 변주에서 나가는 것(검수해 둔 대사 원문 — **학습자 발화가 아니다**),
 * ③ 그래서 상황 훈련에서 기기 밖으로 나가는 학습자의 말은 ①의 한 문장뿐이라는 사실,
 * ④ 같은 스위치가 여는 자유 연습에서는 주고받는 대화가 추가로 나간다는 사실.
 * ③의 약속은 상황 훈련의 약속이고, 그 약속을 지키려고 변주는 학습자 발화를 맥락에 담지 않는다.
 * ④를 빼면 이 절의 고지가 실제 전송 범위보다 좁아진다 — 동의를 받는 자리가 여기이므로 함께 적는다.
 */
export const ONLINE_COACHING_NOTICE =
  "켜면 인식이 닿지 않은 발화가 가명처리된 뒤 침착 서버를 거쳐 외부 AI로 전송됩니다. 어르신·보호자 대사는 검수해 둔 원문이 나가 같은 뜻으로 다시 쓰여 돌아옵니다(응급 상황 훈련은 제외입니다). 상황 훈련에서 기기 밖으로 나가는 말씀은 첫 문장의 그 한 문장뿐입니다. 자유 연습을 여시면 그 화면의 안내에 따라 주고받는 대화가 가림 처리를 지나 같은 경로로 추가 전송됩니다.";

/** 켜고 끄는 두 낱말 — 다른 설정과 같은 두 칸 형식을 쓴다. */
export const ONLINE_COACHING_OPTIONS: ReadonlyArray<{ value: boolean; label: string }> = [
  { value: false, label: "끄기" },
  { value: true, label: "켜기" },
];

/** 지금 스위치 상태 (복사본) */
export function getOnlineCoaching(): OnlineCoachingSettings {
  return getSettings().onlineCoaching;
}

/**
 * 스위치를 바꾼다.
 *
 * @example setOnlineCoaching({ enabled: true });
 */
export function setOnlineCoaching(patch: Partial<OnlineCoachingSettings>): ChimchakSettings {
  const current = getSettings();
  return updateSettings({
    ...current,
    onlineCoaching: { ...current.onlineCoaching, ...patch },
  });
}

/**
 * 이 기기에서 온라인 모드를 켜 두었는지.
 *
 * 「켜져 있다」와 「실제로 문장이 온다」는 이제 다른 말이다 — 서버에 상류 설정이 없으면 요청은
 * 그대로 조용히 검수 코칭·검수 앵커로 되돌아가고, 브라우저는 그 사실을 미리 알 방법이 없다.
 * 그래서 이 함수가 답하는 것은 **사용자가 무엇을 허락했는가** 하나뿐이고, /safety의 표는
 * 그 사실을 그대로 적는다.
 */
export function isOnlineCoachingActive(settings: ChimchakSettings = getSettings()): boolean {
  return settings.onlineCoaching.enabled;
}
