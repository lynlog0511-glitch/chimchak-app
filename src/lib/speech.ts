/**
 * 침착(ChimChak) 음성 라이브러리 — Web Speech API 얇은 래퍼.
 *
 * 원칙
 * - 브라우저 내장 API만 쓴다. **침착 서버로는 아무것도 보내지 않는다.**
 *   다만 음성 인식(STT)은 브라우저 내장 기능이며, 브라우저·기기에 따라 인식 처리가
 *   제조사 서버를 경유할 수 있다(webkitSpeechRecognition 계열). 이 파일은 그 사실을 숨기지 않고,
 *   타이핑 입력만으로도 전 구간을 완주할 수 있게 두는 것으로 경계를 지킨다.
 * - 미지원·권한 거부 환경에서는 조용히 no-op이고 supported=false를 돌려준다.
 *   훈련 화면은 언제나 **버튼 폴백만으로 완주 가능**해야 하므로, 이 파일이 실패해도 앱은 멈추지 않는다.
 * - TTS는 항상 자막(화면 텍스트)과 함께 쓴다. 소리만 있는 안내는 만들지 않는다.
 * - SSR 가드: 서버 렌더링 중에는 window가 없으므로 전부 안전하게 빠져나간다.
 * - 낭독 속도는 사용자 설정(설정 메뉴 「음성 빠르기」)을 따른다. 호출부는 아무것도 바꾸지 않아도 되고,
 *   특정 문장만 다른 속도로 읽어야 할 때만 opts.rate로 덮어쓴다.
 */

import { getSpeechRateValue } from "./settings";

/* ── 브라우저 타입 (lib.dom 유무와 무관하게 쓰기 위해 지역 정의) ── */

interface SpeechAlternativeLike {
  transcript: string;
  confidence: number;
}

interface SpeechResultLike {
  readonly length: number;
  isFinal: boolean;
  [index: number]: SpeechAlternativeLike;
}

interface SpeechResultListLike {
  readonly length: number;
  [index: number]: SpeechResultLike;
}

interface SpeechResultEventLike {
  resultIndex: number;
  results: SpeechResultListLike;
}

interface SpeechErrorEventLike {
  error: string;
  message?: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechResultEventLike) => void) | null;
  onerror: ((event: SpeechErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface SpeechWindow {
  webkitSpeechRecognition?: SpeechRecognitionCtor;
  SpeechRecognition?: SpeechRecognitionCtor;
  speechSynthesis?: SpeechSynthesis;
}

const LANG = "ko-KR";

function getWindow(): SpeechWindow | undefined {
  if (typeof window === "undefined") return undefined;
  return window as unknown as SpeechWindow;
}

function getRecognitionCtor(): SpeechRecognitionCtor | undefined {
  const w = getWindow();
  if (!w) return undefined;
  return w.webkitSpeechRecognition ?? w.SpeechRecognition;
}

/**
 * 음성 인식(STT)을 쓸 수 있는 환경인지.
 *
 * @example
 * if (!isRecognitionSupported()) setUseButtonsOnly(true);
 */
export function isRecognitionSupported(): boolean {
  return getRecognitionCtor() !== undefined;
}

/**
 * 음성 합성(TTS)을 쓸 수 있는 환경인지.
 *
 * @example
 * isSpeechSynthesisSupported(); // true
 */
export function isSpeechSynthesisSupported(): boolean {
  const w = getWindow();
  return Boolean(w?.speechSynthesis);
}

/* ── 인식(STT) ─────────────────────────────────────────── */

export interface RecognizerHandlers {
  /** 중간·최종 인식 결과. isFinal이 true면 확정 발화 */
  onResult: (text: string, isFinal: boolean) => void;
  /** 사용자에게 그대로 보여줄 수 있는 존댓말 오류 문구 */
  onError?: (message: string, code?: string) => void;
  /** 인식이 끝났을 때(정상 종료 포함) */
  onEnd?: () => void;
  /** 인식이 시작됐을 때 */
  onStart?: () => void;
}

export interface Recognizer {
  start(): void;
  stop(): void;
  /** 지원되지 않으면 false — 화면은 버튼 폴백만 노출한다 */
  supported: boolean;
}

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "마이크 권한이 허용되지 않았습니다. 아래 버튼으로 진행해 주세요.",
  "service-not-allowed": "이 기기에서 음성 인식이 허용되지 않았습니다. 아래 버튼으로 진행해 주세요.",
  "no-speech": "말소리를 듣지 못했습니다. 다시 말씀하시거나 아래 버튼을 눌러 주세요.",
  "audio-capture": "마이크를 찾지 못했습니다. 아래 버튼으로 진행해 주세요.",
  network: "네트워크 문제로 음성 인식이 멈췄습니다. 아래 버튼으로 진행해 주세요.",
  aborted: "음성 인식이 중단되었습니다. 다시 시도하시거나 아래 버튼을 눌러 주세요.",
};

function messageFor(code: string): string {
  return ERROR_MESSAGES[code] ?? "음성 인식이 중단되었습니다. 아래 버튼으로 진행해 주세요.";
}

/**
 * 음성 인식기를 만든다. 미지원 환경에서는 start/stop이 아무 일도 하지 않고 supported=false다.
 *
 * @example
 * const rec = createRecognizer({
 *   onResult: (text, isFinal) => { if (isFinal) submit(text); },
 *   onError: (msg) => setNotice(msg),
 * });
 * rec.supported ? rec.start() : showButtonsOnly();
 */
export function createRecognizer(handlers: RecognizerHandlers): Recognizer {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    return {
      supported: false,
      start: () => undefined,
      stop: () => undefined,
    };
  }

  let recognition: SpeechRecognitionLike | null = null;
  let running = false;

  const build = (): SpeechRecognitionLike => {
    const instance = new Ctor();
    instance.lang = LANG;
    instance.continuous = false;
    instance.interimResults = true;
    instance.maxAlternatives = 1;

    instance.onstart = () => {
      running = true;
      handlers.onStart?.();
    };

    instance.onresult = (event) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (!result) continue;
        const alternative = result[0];
        if (!alternative) continue;
        if (result.isFinal) final += alternative.transcript;
        else interim += alternative.transcript;
      }
      if (final.trim().length > 0) handlers.onResult(final.trim(), true);
      else if (interim.trim().length > 0) handlers.onResult(interim.trim(), false);
    };

    instance.onerror = (event) => {
      running = false;
      handlers.onError?.(messageFor(event.error), event.error);
    };

    instance.onend = () => {
      running = false;
      handlers.onEnd?.();
    };

    return instance;
  };

  return {
    supported: true,
    start: () => {
      try {
        if (running && recognition) return;
        recognition = build();
        recognition.start();
      } catch {
        running = false;
        handlers.onError?.("음성 인식을 시작하지 못했습니다. 아래 버튼으로 진행해 주세요.");
      }
    },
    stop: () => {
      try {
        recognition?.stop();
      } catch {
        /* 이미 멈춘 경우 — 무시 */
      } finally {
        running = false;
      }
    },
  };
}

/* ── 합성(TTS) ─────────────────────────────────────────── */

export interface SpeakOptions {
  /**
   * 기본 0.95 — 고령 사용자를 위해 조금 느리게.
   * 값을 주지 않으면 사용자 설정을 따른다(느리게 0.8 · 표준 0.95 · 빠르게 1.1).
   */
  rate?: number;
  pitch?: number;
  volume?: number;
  lang?: string;
}

let voicesCache: SpeechSynthesisVoice[] = [];

/**
 * 발화 세대 토큰.
 * speak()는 cancel() 직후 한 틱 미뤄 speak()를 실행하는데, 그 사이에 다음 speak()나
 * stopSpeaking()이 들어오면 예약된 발화가 그대로 큐에 쌓여 두 문장이 겹쳐 읽힌다.
 * (L3 응급 프로토콜은 사전 검수된 고정 문구를 정확히 하나씩 재생해야 한다.)
 * 세대 토큰을 올려 두면, 뒤늦게 깨어난 예약은 스스로 물러난다.
 */
let speakGeneration = 0;

function loadVoices(): SpeechSynthesisVoice[] {
  const w = getWindow();
  const synth = w?.speechSynthesis;
  if (!synth) return [];
  const voices = synth.getVoices();
  if (voices.length > 0) voicesCache = voices;
  return voicesCache;
}

/**
 * 한국어 보이스 품질 점수.
 *
 * 「목록의 첫 번째」를 잡으면 Windows 크롬에서 가장 로봇 같은 레거시(Microsoft Heami)가
 * 걸립니다 — 같은 브라우저에 훨씬 자연스러운 「Google 한국의」가 있는데도요.
 * 그래서 알려진 보이스를 품질순으로 채점해 가장 좋은 것을 고릅니다.
 *
 * 오프라인이면 네트워크 보이스(Google 계열, localService=false)는 소리가 나지 않으므로
 * 큰 감점을 주어 기기 내장 보이스로 자동 폴백합니다 — 비행기 모드 시연 보장.
 */
function scoreKoreanVoice(v: SpeechSynthesisVoice): number {
  if (!v.lang.toLowerCase().startsWith("ko")) return -1000;
  const n = v.name.toLowerCase();
  let s = 1; // ko 매칭 기본점
  if (/sunhi|injoon|bongjin|seoyeon|jisu|gook|hyunsu/.test(n)) s += 60; // Edge 뉴럴 계열
  if (n.includes("google")) s += 50; // 크롬 네트워크 보이스 — 자연스러움
  if (/yuna|유나|sora|소라/.test(n)) s += 40; // Apple 계열
  if (/neural|natural|online/.test(n)) s += 30;
  if (/heami|해미/.test(n)) s -= 40; // Windows 레거시 — 최후순위
  if (typeof navigator !== "undefined" && !navigator.onLine && !v.localService) s -= 500;
  return s;
}

/**
 * 한국어 보이스 중 품질 점수가 가장 높은 것을 고른다.
 * 전부 감점 보이스뿐이어도(레거시 Heami만 있는 기기 등) 한국어 보이스인 이상 뽑는다 —
 * 아무것도 안 고르면 브라우저 기본(영어 보이스일 수 있음)이 한국어를 읽게 된다.
 */
function pickKoreanVoice(): SpeechSynthesisVoice | undefined {
  const voices = loadVoices();
  let best: SpeechSynthesisVoice | undefined;
  let bestScore = -999;
  for (const v of voices) {
    const s = scoreKoreanVoice(v);
    if (s > bestScore) {
      best = v;
      bestScore = s;
    }
  }
  return best;
}

/**
 * 보이스 목록을 미리 데워 둔다. 첫 재생이 무음으로 나가는 브라우저 대응.
 * 레이아웃 마운트 시 한 번 호출하면 충분하다.
 *
 * @example
 * useEffect(() => { primeVoices(); }, []);
 */
export function primeVoices(): void {
  const w = getWindow();
  const synth = w?.speechSynthesis;
  if (!synth) return;
  loadVoices();
  if (voicesCache.length === 0) {
    synth.onvoiceschanged = () => {
      loadVoices();
    };
  }
}

/**
 * 진행 중인 발화를 멈춘다.
 *
 * @example
 * stopSpeaking();
 */
export function stopSpeaking(): void {
  // 아직 재생되지 않은 예약분까지 무효로 만든다.
  speakGeneration += 1;
  const w = getWindow();
  const synth = w?.speechSynthesis;
  if (!synth) return;
  try {
    synth.cancel();
  } catch {
    /* 무시 */
  }
}

/**
 * 문장을 읽어 준다. 진행 중인 발화는 취소하고 새로 재생한다.
 * 미지원 환경에서는 즉시 resolve하는 no-op이다(자막은 화면에 그대로 남는다).
 *
 * @example
 * await speak("어르신, 지금 어디 가시려고요?");
 */
export function speak(text: string, opts: SpeakOptions = {}): Promise<void> {
  const w = getWindow();
  const synth = w?.speechSynthesis;
  if (!synth || typeof SpeechSynthesisUtterance === "undefined") return Promise.resolve();
  const content = (text ?? "").trim();
  if (content.length === 0) return Promise.resolve();

  const generation = (speakGeneration += 1);

  return new Promise<void>((resolve) => {
    try {
      synth.cancel();
    } catch {
      /* 무시 */
    }

    const utterance = new SpeechSynthesisUtterance(content);
    utterance.lang = opts.lang ?? LANG;
    // rate를 주지 않으면 사용자가 고른 「음성 빠르기」를 쓴다(설정이 없으면 표준 0.95).
    utterance.rate = opts.rate ?? getSpeechRateValue();
    utterance.pitch = opts.pitch ?? 1;
    utterance.volume = opts.volume ?? 1;
    const voice = pickKoreanVoice();
    if (voice) utterance.voice = voice;

    let settled = false;
    const done = (): void => {
      if (settled) return;
      settled = true;
      resolve();
    };
    utterance.onend = done;
    utterance.onerror = done;

    // cancel() 직후 곧바로 speak()하면 일부 브라우저에서 재생되지 않아 한 틱 미룬다.
    // 그 사이에 다음 speak()·stopSpeaking()이 들어왔으면(세대 불일치) 조용히 물러난다.
    window.setTimeout(() => {
      if (generation !== speakGeneration) {
        done();
        return;
      }
      try {
        synth.speak(utterance);
      } catch {
        done();
      }
    }, 60);
  });
}
