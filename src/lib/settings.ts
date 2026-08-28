/**
 * 침착(ChimChak) 표시·음성·AI 설정.
 *
 * 원칙
 * - 기기 안(localStorage)에만 저장한다. 저장한 값이 어디론가 전송되는 일은 없다.
 * - 담기는 것은 넷이다: 취향값 두 개(글자 크기·음성 빠르기)와 **AI 스위치 두 개**.
 *   예전에는 여기에 사용자가 입력한 엔드포인트 주소·모델 이름·API 키가 함께 담겼다 —
 *   지금 그 셋은 서버 환경변수로 옮겼고, 브라우저에는 어떤 키도 두지 않는다
 *   (src/app/api/coach/route.ts).
 *
 * ── 스위치를 왜 둘로 갈랐는가 (2026-08-28) ─────────────────────────────
 * 가르는 잣대는 기능이 아니라 **하신 말씀이 기기 밖으로 나가는가** 하나다.
 *  · `aiDialogue` — 어르신·보호자 **대사 변주**. 나가는 것은 검수 앵커·인물 프로필·상황 요약·
 *    직전 인물 대사뿐이고 **학습자 발화는 요청 몸통에 칸 자체가 없다**(`onlineVary.ts`).
 *    개인정보가 나가지 않으므로 동의 게이트가 붙을 자리가 아니고, 그래서 **기본이 켬**이다.
 *    네트워크·서버가 준비돼 있지 않으면 조용히 검수 앵커로 접힌다(무결성 불변).
 *  · `onlineCoaching` — **발화 전송 동의**. 미분류 턴의 코칭 보조와 자유 연습에서 하신 말씀이
 *    가림 처리를 지나 서버를 거친다. 이 칸만 **기본이 꺼짐**이고, 켜는 것은 사람이 하는 일이다.
 * 한 칸이던 시절의 이름을 그대로 두는 것은 **저장된 값과의 약속**이다(열쇠를 바꾸면 이미 동의를
 * 켜 둔 기기의 값이 통째로 사라진다). 이름은 낡았고 뜻은 좁아졌으니, 화면 라벨이 그 뜻을 적는다.
 *
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
 * AI 어르신 연기(대사 변주) 스위치 — **기본은 켬**이다.
 *
 * 켬으로 두는 근거는 취향이 아니라 **나가는 것의 목록**이다. 변주 요청이 싣는 것은 시나리오 한 줄
 * 요약·인물 프로필·검수 앵커 원문·직전 인물 대사뿐이고, 전부 이 앱이 이미 화면에 띄우고 있으며
 * 앱 번들에 그대로 들어 있는 문장이다. **학습자 발화는 요청 형식에 칸 자체가 없다**
 * (`src/lib/onlineVary.ts`의 `LineVaryRequest` — 서버도 그 네 칸만 받고 나머지는 400으로 끊는다).
 * 개인정보가 나가지 않는 자리에 동의 게이트를 세우면, 정작 동의가 필요한 자리(`onlineCoaching`)와
 * 같은 무게로 읽혀 두 자리가 함께 흐려진다.
 *
 * 켜 두어도 화면이 표류하지 않는 이유: 서버에 상류가 없거나·오프라인이거나·가드에 걸리면
 * 조용히 **검수 앵커**가 선다. 응급 유형은 켜 두어도 통째로 빠진다(L3 원칙).
 */
export interface AiDialogueSettings {
  enabled: boolean;
}

/**
 * **발화 전송 동의** 스위치 — 기본은 꺼짐이다. 이름은 한 칸이던 시절의 것이다.
 *
 * 이 칸이 여는 자리는 둘이고, 둘 다 **하신 말씀이 기기 밖으로 나간다**는 성질을 공유한다 —
 * 미분류 턴의 코칭 보조(가명처리를 지난 발화 한 문장)와 자유 연습(주고받는 대화). 그래서
 * 이 칸은 기능 묶음이 아니라 **동의 한 칸**이고, 켜는 것도 끄는 것도 사용자 손에 있어야 한다.
 *
 * 대사 변주는 2026-08-28에 이 칸에서 빠져 `aiDialogue`로 갔다. 학습자 발화가 나가지 않는 기능이
 * 발화 전송 동의 뒤에 서 있으면, 동의를 켜는 사람은 실제보다 넓은 것을 허락한다고 읽고, 끄는
 * 사람은 개인정보와 무관한 기능까지 함께 잃는다. 열쇠 이름은 저장된 값과의 약속이라 그대로 둔다.
 */
export interface OnlineCoachingSettings {
  enabled: boolean;
}

export interface ChimchakSettings {
  fontScale: FontScale;
  speechRate: SpeechRate;
  /** AI 어르신 연기(대사 변주) — 발화가 나가지 않는 자리. 기본 켬. */
  aiDialogue: AiDialogueSettings;
  /** 발화 전송 동의(코칭 보조·자유 연습) — 하신 말씀이 나가는 자리. 기본 꺼짐. */
  onlineCoaching: OnlineCoachingSettings;
}

export const SETTINGS_KEY = "chimchak.settings.v1";

/** 어르신 연기 기본값 — **켬**. 근거는 위 인터페이스 주석(나가는 것의 목록)이다. */
export const DEFAULT_AI_DIALOGUE: AiDialogueSettings = { enabled: true };

/**
 * 발화 전송 동의 기본값 — 서버에 무엇이 설정돼 있든 항상 꺼짐에서 출발한다.
 * 켜는 것은 사람이 하는 일이고, 이 기본값이 화면들이 적어 둔 「하신 말씀은 나가지 않습니다」의 기준이다.
 */
export const DEFAULT_ONLINE_COACHING: OnlineCoachingSettings = { enabled: false };

export const DEFAULT_SETTINGS: ChimchakSettings = {
  fontScale: "standard",
  speechRate: "standard",
  aiDialogue: DEFAULT_AI_DIALOGUE,
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
 * 어르신 연기 칸을 안전한 범위로 되돌린다 — **읽는 잣대가 아래 발화 전송 칸과 반대다.**
 *
 * 여기서는 `!== false`, 아래에서는 `=== true`다. 대칭이 아닌 것이 이 두 줄의 전부이고,
 * 마이그레이션도 이 비대칭 하나로 끝난다.
 *  · 칸이 **없으면** 켬 — 이 칸이 생기기 전에 저장된 기기(전원)가 여기로 들어온다. 새 기본값이다.
 *  · `false`로 **적혀 있으면** 끔 — 사용자가 직접 끈 값이고, 다시 켜 주지 않는다.
 * 반대로 적으면(`=== true`) 스스로 끈 적 없는 기기가 매번 꺼진 상태로 읽히고, 대칭으로 맞추면
 * (`!== false`) 발화 전송이 **동의 없이 켜진다**. 두 잣대가 갈라져 있는 것이 그 둘을 동시에 막는다.
 */
function normalizeAiDialogue(raw: unknown): AiDialogueSettings {
  if (typeof raw !== "object" || raw === null) return { ...DEFAULT_AI_DIALOGUE };
  return { enabled: (raw as Record<string, unknown>).enabled !== false };
}

/**
 * 발화 전송 동의를 안전한 범위로 되돌린다.
 *
 * 읽는 칸은 `enabled` 하나뿐이고, **저장된 값이 또렷하게 `true`일 때만 참**이다(위 함수와 반대).
 * 손상됐거나·없거나·다른 꼴이면 꺼짐이다 — 동의는 기본값으로 얻어지는 것이 아니다.
 *
 * 예전 방식으로 저장된 주소·모델 이름·키가 아직 남아 있어도 **조용히 버린다** — 다시 저장하는
 * 순간 그 칸들은 사라지고, 그 사이에도 어디에도 쓰이지 않는다.
 * (키를 옮기지 않고 버리는 쪽을 고른 이유: 서버로 올려 줄 자리가 없고, 올려 줘서도 안 된다.)
 */
function normalizeOnlineCoaching(raw: unknown): OnlineCoachingSettings {
  if (typeof raw !== "object" || raw === null) return { ...DEFAULT_ONLINE_COACHING };
  return { enabled: (raw as Record<string, unknown>).enabled === true };
}

/**
 * 저장된 값이 낡았거나 손상됐어도 기본값으로 안전하게 메운다.
 *
 * 스위치 한 칸이 둘로 갈린 날(2026-08-28)의 **마이그레이션이 곧 이 함수**다. 따로 버전 번호를
 * 올리거나 한 번 돌고 마는 변환 코드를 두지 않았다 — 저장 열쇠(`SETTINGS_KEY`)를 그대로 두고
 * 읽는 잣대 둘을 갈라 두면, 옛 값과 새 값이 같은 함수를 지나 각자 옳은 자리에 떨어진다.
 * 옮기는 코드가 없으면 「한 번 돌았는가」를 관리할 자리도 없다.
 *
 * 저장된 네 상태가 어디로 가는지 (변환 없이, 읽을 때마다 같은 답):
 *  | 저장된 값                                   | aiDialogue | onlineCoaching |
 *  | 없음(첫 방문·저장소 차단)                    | 켬         | 꺼짐            |
 *  | 옛 값 `onlineCoaching:{enabled:true}`        | 켬         | **켬(유지)**    |
 *  | 옛 값 `onlineCoaching:{enabled:false}`·없음  | 켬         | 꺼짐            |
 *  | 새 값 `aiDialogue:{enabled:false}`           | **끔(유지)**| 저장된 그대로   |
 *
 * 지키는 불변식 둘 — 이 표의 존재 이유다.
 *  ① **이미 켜 둔 사람의 동의 범위가 줄지 않는다.** 옛 스위치를 켠 기기는 코칭 보조와 변주를
 *    함께 받고 있었고, 갈라진 뒤에도 둘 다 그대로 받는다.
 *  ② **켜지 않은 사람에게 발화 전송이 새로 켜지지 않는다.** 옛 스위치가 꺼짐이던 기기에서
 *    `onlineCoaching`은 어떤 경로로도 참이 되지 않는다 — 참으로 만드는 길은 저장된 `true` 하나뿐이다.
 */
function normalize(raw: unknown): ChimchakSettings {
  if (typeof raw !== "object" || raw === null) return freshDefaults();
  const record = raw as Record<string, unknown>;
  return {
    fontScale: isFontScale(record.fontScale) ? record.fontScale : DEFAULT_SETTINGS.fontScale,
    speechRate: isSpeechRate(record.speechRate) ? record.speechRate : DEFAULT_SETTINGS.speechRate,
    aiDialogue: normalizeAiDialogue(record.aiDialogue),
    onlineCoaching: normalizeOnlineCoaching(record.onlineCoaching),
  };
}

/** 중첩된 객체까지 새로 만든 기본값 — 얕은 복사로 기본값 객체가 공유되지 않게 한다. */
function freshDefaults(): ChimchakSettings {
  return {
    ...DEFAULT_SETTINGS,
    aiDialogue: { ...DEFAULT_AI_DIALOGUE },
    onlineCoaching: { ...DEFAULT_ONLINE_COACHING },
  };
}

/** 밖으로 내보내는 복사본 — 호출자가 손대도 캐시가 흔들리지 않게 한다. */
function copy(settings: ChimchakSettings): ChimchakSettings {
  return {
    ...settings,
    aiDialogue: { ...settings.aiDialogue },
    onlineCoaching: { ...settings.onlineCoaching },
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

/* ── AI 스위치 둘 ──────────────────────────────────────── */

/** 켜고 끄는 두 낱말 — 두 스위치가 **같은 두 칸**을 쓴다(형식이 갈리면 하나만 특별해 보인다). */
export const SWITCH_OPTIONS: ReadonlyArray<{ value: boolean; label: string }> = [
  { value: false, label: "끄기" },
  { value: true, label: "켜기" },
];

/** 어르신 연기 절 이름 — 이 스위치가 하는 일 하나를 그대로 적는다. */
export const AI_DIALOGUE_LABEL = "AI 어르신 연기";

/**
 * 어르신 연기 고지 — **동의 문구가 아니다.**
 *
 * 두 문장이 각각 다른 일을 한다. ① 무엇을 하는가(검수 대사를 같은 뜻으로 다시 말한다),
 * ② 무엇이 나가지 않는가(**하신 말씀**). ②를 앞이 아니라 뒤에 두는 이유: 이 절을 읽는 분이
 * 바로 아래 절(발화 전송 동의)과 헷갈리지 않게 하려면, 두 절이 **같은 낱말로 서로를 가리켜야**
 * 한다. 그래서 아래 고지도 「하신 말씀」이라는 같은 낱말을 쓴다.
 */
export const AI_DIALOGUE_NOTICE =
  "검수된 대사를 같은 뜻으로 다시 말합니다. 하신 말씀은 나가지 않습니다 — 나가는 것은 검수해 둔 대사 원문과 인물·상황 소개뿐입니다. 응급 상황 훈련은 제외이고, 연결이 없으면 검수된 대사가 그대로 나옵니다.";

/** 이 스위치가 켜져 있는지 (설정 한 벌을 넘겨 물을 수도 있다) */
export function isAiDialogueActive(settings: ChimchakSettings = getSettings()): boolean {
  return settings.aiDialogue.enabled;
}

/**
 * 어르신 연기 스위치를 바꾼다.
 *
 * @example setAiDialogue({ enabled: false });
 */
export function setAiDialogue(patch: Partial<AiDialogueSettings>): ChimchakSettings {
  const current = getSettings();
  return updateSettings({
    ...current,
    aiDialogue: { ...current.aiDialogue, ...patch },
  });
}

/**
 * 발화 전송 동의 절 이름 — **무엇이 나가는지를 이름 안에 적는다.**
 *
 * 예전 이름은 「온라인 모드 — 코칭·대사 변주·자유 연습」이었다. 스위치가 하나이던 동안에는
 * 여는 자리 셋을 나열하는 것이 정직이었지만, 지금은 그 나열이 두 가지로 거짓이 된다 —
 * 변주는 이 칸이 열지 않고, 「온라인」이라는 낱말은 **회선의 문제**로 읽혀 정작 이 칸의 성질
 * (하신 말씀이 나간다)을 가린다. 이름이 하는 일은 목록을 세는 것이 아니라 성질을 적는 것이다.
 */
export const ONLINE_MODE_LABEL = "AI 코칭·자유 연습 — 하신 말씀이 가림 처리 후 서버를 거칩니다";

/**
 * 발화 전송 동의 고지 — 무엇이 어디로 나가는지 밝힌다. **동의를 받는 자리의 문장**이다.
 *
 * 네 문장이 각각 다른 일을 한다. ① 코칭 보조에서 나가는 것(가명처리를 지난 발화 한 문장),
 * ② 그래서 상황 훈련에서 기기 밖으로 나가는 학습자의 말은 ①의 한 문장뿐이라는 사실,
 * ③ 같은 스위치가 여는 자유 연습에서는 주고받는 대화가 추가로 나간다는 사실,
 * ④ 대사 변주는 이 칸이 아니라는 사실.
 * ③을 빼면 이 절의 고지가 실제 전송 범위보다 좁아진다 — 동의를 받는 자리이므로 함께 적는다.
 *
 * ④는 2026-08-28에 들어왔다. 예전에는 이 자리에 「어르신 대사는 검수 원문이 나가 다시 쓰여
 * 돌아옵니다」가 있었다 — 같은 스위치가 열던 자리라 여기 적는 것이 맞았다. 지금은 다른 스위치이므로
 * 그 문장을 위 절로 옮기고, 대신 **여기 없다는 사실**을 한 줄로 남긴다. 옮기면서 아무 말도 남기지
 * 않으면, 이 칸을 끈 분이 「대사도 함께 껐다」고 읽는다(전송 범위를 실제보다 **넓게** 읽는 쪽이라
 * 안전해 보이지만, 그 오해는 끄지 않아도 될 기능을 끄게 만든다).
 * 나가는 것의 범위를 말하는 대목(①②③)은 법령 대조를 지난 문장이라 **뜻을 바꾸지 않는다**.
 */
export const ONLINE_COACHING_NOTICE =
  "켜면 인식이 닿지 않은 발화가 가명처리된 뒤 침착 서버를 거쳐 외부 AI로 전송됩니다. 상황 훈련에서 기기 밖으로 나가는 말씀은 그 한 문장뿐입니다. 자유 연습을 여시면 그 화면의 안내에 따라 주고받는 대화가 가림 처리를 지나 같은 경로로 추가 전송됩니다. 어르신 대사 변주는 위의 다른 스위치이고, 하신 말씀은 그쪽으로 나가지 않습니다.";

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
 * 이 기기에서 **발화 전송**에 동의해 두었는지.
 *
 * 「켜져 있다」와 「실제로 문장이 온다」는 이제 다른 말이다 — 서버에 상류 설정이 없으면 요청은
 * 그대로 조용히 검수 코칭으로 되돌아가고, 브라우저는 그 사실을 미리 알 방법이 없다.
 * 그래서 이 함수가 답하는 것은 **사용자가 무엇을 허락했는가** 하나뿐이고, /safety의 표는
 * 그 사실을 그대로 적는다.
 */
export function isOnlineCoachingActive(settings: ChimchakSettings = getSettings()): boolean {
  return settings.onlineCoaching.enabled;
}
