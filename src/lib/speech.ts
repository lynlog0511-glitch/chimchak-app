/**
 * 침착(ChimChak) 음성 라이브러리 — 사전 합성 오디오 + Web Speech API 얇은 래퍼.
 *
 * 원칙
 * - 브라우저 내장 API와 **앱에 동봉한 오디오 파일**만 쓴다. **침착 서버로는 아무것도 보내지 않는다.**
 *   다만 음성 인식(STT)은 브라우저 내장 기능이며, 브라우저·기기에 따라 인식 처리가
 *   제조사 서버를 경유할 수 있다(webkitSpeechRecognition 계열). 이 파일은 그 사실을 숨기지 않고,
 *   타이핑 입력만으로도 전 구간을 완주할 수 있게 두는 것으로 경계를 지킨다.
 * - 미지원·권한 거부 환경에서는 조용히 no-op이고 supported=false를 돌려준다.
 *   훈련 화면은 언제나 **버튼 폴백만으로 완주 가능**해야 하므로, 이 파일이 실패해도 앱은 멈추지 않는다.
 * - TTS는 항상 자막(화면 텍스트)과 함께 쓴다. 소리만 있는 안내는 만들지 않는다.
 * - SSR 가드: 서버 렌더링 중에는 window가 없으므로 전부 안전하게 빠져나간다.
 * - 낭독 속도는 사용자 설정(설정 메뉴 「음성 빠르기」)을 따른다. 호출부는 아무것도 바꾸지 않아도 되고,
 *   특정 문장만 다른 속도로 읽어야 할 때만 opts.rate로 덮어쓴다.
 *
 * ── 사전 합성 오디오 ──────────────────────────────────────────────
 * 이 앱의 대사는 **전부 사전 검수된 고정 문구**다. 런타임에 지어내는 문장이 없으므로,
 * 빌드 전에 미리 합성해 `/audio/*.mp3`로 동봉해 두었다(`scripts/synthesize-audio.py`).
 * speak()는 문장을 먼저 매니페스트에서 찾아 그 파일을 재생하고, 없을 때만 브라우저 TTS로 간다.
 *
 * - 런타임 외부 호출은 여전히 0건이다. 재생하는 것은 같은 출처의 정적 파일뿐이다.
 * - 서비스워커가 응급 프로토콜 음성을 사전 캐시하므로 **비행기 모드에서도 소리가 난다**
 *   (브라우저 TTS의 네트워크 보이스는 오프라인에서 무음이 되는 기기가 있다).
 * - **speechSynthesis가 아예 없는 기기(구형 웹뷰·일부 안드로이드)에서도 오디오 경로는 그대로 동작한다.**
 *   그래서 `isSpeechSynthesisSupported()`가 false여도 speak()는 소리를 낼 수 있다 —
 *   이 함수는 「브라우저 TTS 폴백을 쓸 수 있는가」를 뜻할 뿐이다.
 * - 매니페스트는 정적 import다(약 10KB). 첫 발화 전에 fetch를 기다리지 않아,
 *   L3 프로토콜의 자동 진행이 네트워크 상태와 무관하게 같은 박자로 흐른다.
 * - 재생에 쓰는 **오디오 요소는 모듈 스코프에 하나뿐**이고 src만 갈아 끼운다(웹킷의 요소 단위
 *   제스처 해제 대응). 첫 탭에서 `unlockAudio()`를 부르면 이후 자동 진행 낭독까지 함께 풀린다.
 * - `speak()`는 **어떤 경우에도 매듭지어진다** — 끝났다는 신호가 오지 않아도 워치독이 상한에서
 *   풀어 준다. 응급 프로토콜의 자동 진행이 이 프라미스를 기다리므로, 이 보증이 곧 안내의 생명선이다.
 */

import manifestJson from "../../public/audio/manifest.json";
import { getSettings, getSpeechRateValue, type SpeechRate } from "./settings";

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

/**
 * 이 기기에서 **낭독 소리를 낼 수 있는지** — 동봉 오디오와 브라우저 TTS 중 하나라도 되면 true.
 *
 * 화면에 「음성을 지원하지 않습니다」라고 알릴지는 이 함수로 판단한다.
 * `isSpeechSynthesisSupported()`는 브라우저 TTS 하나만 보므로, speechSynthesis가 없는
 * 구형 웹뷰에서 **실제로는 동봉 오디오로 소리가 나는데도** 안 난다고 말하게 된다.
 *
 * @example
 * setVoiceSupported(isSpeechPlaybackSupported());
 */
export function isSpeechPlaybackSupported(): boolean {
  if (isSpeechSynthesisSupported()) return true;
  return typeof Audio !== "undefined" && Object.keys(AUDIO_MANIFEST).length > 0;
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
  /**
   * 사용자가 stop()을 부르기 전까지 참.
   *
   * 브라우저 인식기는 continuous=true여도 **말 고르는 침묵**에 스스로 끝나 버린다
   * (숨만 쉬어도 꺼진다는 제보가 정확히 이 동작이다). 마이크를 누르고 있는 동안은
   * 브라우저가 몇 번을 끝내든 다시 이어 붙이고, onEnd는 사용자가 멈췄을 때만 전달한다.
   */
  let active = false;

  const build = (): SpeechRecognitionLike => {
    const instance = new Ctor();
    instance.lang = LANG;
    instance.continuous = true;
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
      // 누르고 있는 동안의 「말소리 없음」은 오류가 아니라 침묵이다 — onend의 재시작에 맡긴다.
      if (active && event.error === "no-speech") return;
      // 그 밖의 오류(권한 거부·마이크 없음 등)는 재시작하면 무한 반복이 되므로 여기서 멈춘다.
      active = false;
      handlers.onError?.(messageFor(event.error), event.error);
    };

    instance.onend = () => {
      running = false;
      if (active) {
        // 침묵·내부 타임아웃으로 브라우저가 끝낸 것 — 손을 떼기 전까지 조용히 다시 잇는다.
        try {
          recognition = build();
          recognition.start();
          return;
        } catch {
          active = false;
        }
      }
      handlers.onEnd?.();
    };

    return instance;
  };

  return {
    supported: true,
    start: () => {
      try {
        if (running && recognition) return;
        active = true;
        recognition = build();
        recognition.start();
      } catch {
        active = false;
        running = false;
        handlers.onError?.("음성 인식을 시작하지 못했습니다. 아래 버튼으로 진행해 주세요.");
      }
    },
    stop: () => {
      active = false;
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
   *
   * **브라우저 TTS 경로에만 적용된다.** 사전 합성 오디오는 이미 화자별 속도로 합성돼 있고,
   * 사용자 설정만 재생 배속으로 반영한다(아래 AUDIO_PLAYBACK_RATE).
   */
  rate?: number;
  pitch?: number;
  volume?: number;
  lang?: string;
}

/* ── 사전 합성 오디오 ───────────────────────────────────── */

/** 매니페스트 한 줄 — f: 파일명, e: 1이면 응급 프로토콜(서비스워커 사전 캐시 대상) */
interface AudioEntry {
  f: string;
  e?: number;
}

/**
 * 문장 → 동봉 오디오 파일. 키는 **speak()에 실제로 들어오는 문자열(trim 후)** 그대로다.
 * `scripts/synthesize-audio.py`가 데이터 파일에서 뽑아 만든다.
 */
const AUDIO_MANIFEST = manifestJson as Record<string, AudioEntry>;

const AUDIO_DIR = "/audio/";

/**
 * 「음성 빠르기」 설정 → 오디오 재생 배속.
 * 합성 시점에 이미 화자별로 느리게 잡아 두었으므로, 설정은 그 위에 얹는 미세 조정이다.
 * (SpeechSynthesis의 0.8/0.95/1.1보다 폭이 좁다 — 배속을 크게 흔들면 뉴럴 음성이 상한다.)
 * preservesPitch는 건드리지 않는다(기본값 유지 — 배속을 바꿔도 목소리 높이는 그대로).
 */
const AUDIO_PLAYBACK_RATE: Record<SpeechRate, number> = {
  slow: 0.85,
  standard: 1,
  fast: 1.15,
};

/**
 * 1밀리초 무음(8kHz 8bit 모노 WAV).
 * 자동재생 정책을 **실제로 재생해 봐서** 확인하고, 사용자의 첫 탭에서 요소 잠금을 푸는 데만 씁니다.
 * `data:`라 네트워크 요청이 생기지 않고, 내용이 무음이라 아무 소리도 들리지 않습니다.
 */
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQgAAACAgICAgICAgA==";

/**
 * 이 파일이 쓰는 **오디오 요소는 하나뿐**입니다 — 문장마다 새로 만들지 않고 `src`만 갈아 끼웁니다.
 *
 * 웹킷(아이폰 사파리)은 자동재생 제한을 **미디어 요소 단위**로 풉니다. 사용자의 탭 안에서
 * `play()`가 불린 그 요소만 이후 스크립트 재생이 허용되므로, 문장마다 새 요소를 만들면
 * 동봉 음성 전 구간이 막히고 브라우저 TTS로 떨어집니다(검수한 목소리가 아닌 소리가 납니다).
 * 요소를 하나로 두면 첫 탭 한 번(`unlockAudio`)으로 이후 모든 문장이 같이 풀립니다.
 * 정책을 재는 프로브도 같은 요소를 쓰므로 **잰 것과 재생하는 것이 일치**합니다.
 */
let sharedAudio: HTMLAudioElement | null = null;
/** 사용자 제스처로 이 요소의 재생 잠금이 한 번이라도 풀렸는지. */
let audioUnlocked = false;

function getSharedAudio(): HTMLAudioElement | null {
  if (typeof Audio === "undefined") return null;
  if (sharedAudio) return sharedAudio;
  try {
    const audio = new Audio();
    audio.preload = "auto";
    sharedAudio = audio;
  } catch {
    return null;
  }
  return sharedAudio;
}

/** 이전 재생의 이벤트가 다음 재생으로 새지 않게, 손잡이를 전부 떼어 냅니다. */
function clearAudioHandlers(audio: HTMLAudioElement): void {
  audio.onended = null;
  audio.onerror = null;
  audio.onpause = null;
  audio.onloadedmetadata = null;
}

/** 지금 재생 중인 동봉 오디오와, 그 재생을 기다리는 쪽을 매듭지을 손잡이. */
let currentAudio: HTMLAudioElement | null = null;
let settleCurrentAudio: ((played: boolean) => void) | null = null;
/** 재생 순번 — 요소가 하나뿐이라 뒤늦은 이전 재생의 뒷정리가 지금 재생을 지우지 않게 한다. */
let playSeq = 0;

/**
 * 사용자의 첫 탭에서 오디오 요소의 재생 잠금을 풉니다 — **제스처 콜스택 안에서** 부르셔야 합니다.
 *
 * 「훈련 시작하기」·「응급 안내 시작하기」·재생 컨트롤처럼 사용자가 확실히 누르는 지점에서
 * 한 번 부르면, 이후 자동 진행이 스스로 시작하는 낭독까지 같은 요소로 허용됩니다.
 * 이미 풀렸거나 지금 재생 중이면 아무 일도 하지 않습니다(재생을 끊지 않습니다).
 *
 * @example
 * <button onClick={() => { unlockAudio(); setStarted(true); }}>응급 안내 시작하기</button>
 */
export function unlockAudio(): void {
  if (audioUnlocked) return;
  const audio = getSharedAudio();
  if (!audio) return;
  // 이미 소리가 나는 중이면 잠금은 풀린 뒤입니다 — 여기서 src를 갈아 끼우면 그 재생을 끊습니다.
  if (settleCurrentAudio) {
    audioUnlocked = true;
    return;
  }
  try {
    playSeq += 1;
    clearAudioHandlers(audio);
    audio.playbackRate = 1;
    audio.src = SILENT_WAV;
    const started = audio.play();
    if (started && typeof started.then === "function") {
      void started.then(
        () => {
          audioUnlocked = true;
          try {
            audio.pause();
            audio.currentTime = 0;
          } catch {
            /* 무시 */
          }
        },
        () => undefined,
      );
    } else {
      audioUnlocked = true;
    }
  } catch {
    /* 무시 — 잠금 해제는 되면 좋은 것이지, 실패해도 화면은 그대로 갑니다. */
  }
}

/**
 * 사용자가 화면을 건드리지 않은 상태에서 **지금** 소리를 낼 수 있는지 재 봅니다.
 *
 * 지원 여부(`isSpeechPlaybackSupported`)와 다른 질문입니다 — PWA 바로가기로 응급 화면을 곧바로
 * 열면 제스처가 없어 재생이 거부되는데, 그때 화면이 「읽어 주는 중」이라고 적으면
 * **소리가 안 나는데 난다고 말하는 것**이 됩니다.
 *
 * 자동재생 차단(NotAllowedError)만 「소리가 안 난다」로 셉니다 — 디코딩 실패 같은 다른 오류는
 * 판단 근거가 되지 못하므로 차단으로 단정하지 않습니다.
 * 실제 재생과 **같은 요소**로 재므로, 아이폰에서 「잰 요소 따로 재생 요소 따로」가 되지 않습니다.
 *
 * @example
 * const ok = await canPlayWithoutGesture(); // true
 */
export async function canPlayWithoutGesture(): Promise<boolean> {
  const audio = getSharedAudio();
  if (!audio) return true;
  // 재생 중이라면 이미 답이 나와 있습니다 — 다시 재려면 그 재생을 끊어야 하므로 재지 않습니다.
  if (settleCurrentAudio) return true;
  try {
    playSeq += 1;
    clearAudioHandlers(audio);
    audio.playbackRate = 1;
    audio.src = SILENT_WAV;
    await audio.play();
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {
      /* 무시 */
    }
    audioUnlocked = true;
    return true;
  } catch (error) {
    const name =
      typeof DOMException !== "undefined" && error instanceof DOMException ? error.name : "";
    return name !== "NotAllowedError";
  }
}

/**
 * 낭독이 어떤 이벤트도 내지 않을 때를 대비한 여유 시간.
 * 이 시간이 지나면 speak()는 「읽은 것으로」 매듭짓고 호출부의 자동 진행을 풀어 줍니다.
 */
const WATCHDOG_SLACK_MS = 4000;

/**
 * 문장 길이로 낭독 시간을 어림합니다(한국어 낭독 대략 5자/초 · 배속 반영).
 * 워치독 상한을 잡는 데만 쓰는 값이라 정확할 필요는 없고, **짧게 잡히지만 않으면** 됩니다.
 */
function estimateSpeechMs(text: string, rate: number): number {
  const base = 1200 + text.length * 200;
  return Math.min(60000, base / Math.max(0.5, rate));
}

/**
 * 재생 중인 동봉 오디오를 즉시 멈춘다.
 * 기다리던 speak()는 「재생을 마친 것」으로 매듭짓는다 — 중단됐다고 폴백으로 넘어가면
 * 멈추라고 했는데 브라우저 TTS가 대신 읽기 시작하는 사고가 난다.
 */
function stopAudio(): void {
  const audio = currentAudio;
  const settle = settleCurrentAudio;
  currentAudio = null;
  settleCurrentAudio = null;
  if (audio) {
    clearAudioHandlers(audio);
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {
      /* 무시 */
    }
  }
  settle?.(true);
}

/**
 * 동봉 오디오를 끝까지 재생한다.
 *
 * **끝났다는 신호가 오지 않아도 반드시 매듭짓는다.** HTMLMediaElement는 재생 중 인터럽트
 * (전화 수신·다른 앱 오디오·화면 잠금)에 `pause`만 내고 `ended`도 `error`도 내지 않으며,
 * 로딩이 정체되면 `stalled`만 온다. 응급 프로토콜의 자동 진행이 이 프라미스를 기다리므로,
 * 매듭짓지 못하면 안내가 1단계에서 영구 정지한다.
 *
 * @returns 재생을 맡았으면 true(끝까지 재생·중단·상한 도달), 재생하지 못했으면 false(폴백해야 함)
 */
function playPrepared(file: string, text: string): Promise<boolean> {
  const audio = getSharedAudio();
  if (!audio) return Promise.resolve(false);

  const rate = AUDIO_PLAYBACK_RATE[getSettings().speechRate];
  /**
   * 요소를 하나만 쓰므로 **뒤늦게 깨어난 이전 재생**이 지금 재생을 건드릴 수 있다.
   * (src를 갈아 끼우면 이전 play()의 프라미스가 AbortError로 거절되는데, 그 거절이
   *  다음 재생이 시작된 뒤에 도착한다.) 순번을 들고 있다가 자기 차례가 아니면 물러난다.
   */
  const token = (playSeq += 1);

  return new Promise<boolean>((resolve) => {
    let settled = false;
    let watchdogId = 0;
    /** play()가 실제로 시작된 뒤인지 — 시작 전의 pause 이벤트(src 교체 잔향)를 걸러 낸다. */
    let playing = false;

    const owned = (): boolean => playSeq === token;

    const settle = (played: boolean): void => {
      if (settled) return;
      settled = true;
      if (watchdogId) window.clearTimeout(watchdogId);
      watchdogId = 0;
      resolve(played);
    };

    const finish = (played: boolean): void => {
      if (owned()) {
        if (currentAudio === audio) {
          currentAudio = null;
          settleCurrentAudio = null;
        }
        clearAudioHandlers(audio);
      }
      settle(played);
    };

    /**
     * 워치독 — 상한에 닿으면 재생을 멈추고 「읽은 것으로」 매듭짓는다.
     * 여기서 브라우저 TTS로 넘기지 않는 이유: 소리가 아직 나는 중일 수 있어 두 목소리가 겹친다.
     */
    const armWatchdog = (ms: number): void => {
      if (settled) return;
      if (watchdogId) window.clearTimeout(watchdogId);
      watchdogId = window.setTimeout(() => {
        if (owned()) {
          try {
            audio.pause();
          } catch {
            /* 무시 */
          }
        }
        finish(true);
      }, ms);
    };

    try {
      clearAudioHandlers(audio);
      audio.src = AUDIO_DIR + file;
      audio.playbackRate = rate;
    } catch {
      settle(false);
      return;
    }

    currentAudio = audio;
    settleCurrentAudio = settle;

    audio.onended = () => finish(true);
    // 파일이 없거나(404) 디코딩에 실패하면 조용히 브라우저 TTS로 넘긴다.
    audio.onerror = () => finish(false);
    /* 우리가 멈춘 것이 아닌 일시정지 — 사용자 정지·전화 수신·다른 앱 오디오.
       브라우저 TTS로 넘기지 않는다: 멈추라고 한 순간에 대신 읽기 시작하는 사고가 난다.
       재생은 여기서 매듭짓고, 화면의 자막만 다음으로 넘어간다. */
    audio.onpause = () => {
      if (!playing || audio.ended) return;
      finish(true);
    };
    /* 길이를 알게 되면 어림값 대신 실제 길이로 상한을 다시 잡는다. */
    audio.onloadedmetadata = () => {
      const seconds = audio.duration;
      if (Number.isFinite(seconds) && seconds > 0) {
        armWatchdog((seconds * 1000) / Math.max(0.5, rate) + WATCHDOG_SLACK_MS);
      }
    };

    armWatchdog(estimateSpeechMs(text, rate) + WATCHDOG_SLACK_MS);

    try {
      const started = audio.play();
      // 자동재생 차단 등으로 시작하지 못하면 폴백한다.
      // 중단(stopAudio)으로 인한 거부는 이미 settled 상태라 아무 일도 일어나지 않는다.
      if (started && typeof started.then === "function") {
        void started.then(
          () => {
            playing = true;
            audioUnlocked = true;
          },
          () => finish(false),
        );
      } else {
        playing = true;
      }
    } catch {
      finish(false);
    }
  });
}

/* ── 브라우저 TTS ──────────────────────────────────────── */

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

/** 브라우저 TTS 큐를 비운다(예약분 포함). */
function cancelSynthesis(): void {
  const synth = getWindow()?.speechSynthesis;
  if (!synth) return;
  try {
    synth.cancel();
  } catch {
    /* 무시 */
  }
}

/**
 * 진행 중인 발화를 멈춘다 — 동봉 오디오와 브라우저 TTS 양쪽 다.
 *
 * @example
 * stopSpeaking();
 */
export function stopSpeaking(): void {
  // 아직 재생되지 않은 예약분까지 무효로 만든다.
  speakGeneration += 1;
  stopAudio();
  cancelSynthesis();
}

/**
 * 문장을 읽어 준다. 진행 중인 발화는 취소하고 새로 재생한다.
 *
 * 같은 문장의 사전 합성 오디오가 동봉돼 있으면 그것을 재생하고, 없거나 재생에 실패하면
 * 조용히 브라우저 TTS로 넘어간다. 둘 다 쓸 수 없는 환경에서는 즉시 resolve하는 no-op이다
 * (자막은 화면에 그대로 남는다).
 *
 * 어느 경로든 **재생이 끝나야 resolve한다** — L3 응급 프로토콜의 자동 진행이 이 약속에 기대고 있다.
 * 중간에 새 speak()나 stopSpeaking()이 들어오면 그 자리에서 멈추고 resolve한다.
 * 인터럽트(전화 수신·다른 앱 오디오)나 정체로 끝났다는 신호가 오지 않아도, 어림한 낭독 길이 +
 * 4초의 워치독이 반드시 resolve한다 — 안내가 한 단계에서 영구 정지하지 않게 하는 상한이다.
 *
 * @example
 * await speak("어르신, 지금 어디 가시려고요?");
 */
export function speak(text: string, opts: SpeakOptions = {}): Promise<void> {
  const content = (text ?? "").trim();
  if (content.length === 0) return Promise.resolve();

  const generation = (speakGeneration += 1);
  // 진행 중이던 소리는 경로를 가리지 않고 먼저 끊는다.
  stopAudio();
  cancelSynthesis();

  const entry = AUDIO_MANIFEST[content];
  if (!entry) return speakWithSynthesis(content, opts, generation);

  return playPrepared(entry.f, content).then((played) => {
    if (played) return undefined;
    // 재생에 실패한 사이에 다음 발화가 들어왔으면 조용히 물러난다.
    if (generation !== speakGeneration) return undefined;
    return speakWithSynthesis(content, opts, generation);
  });
}

/**
 * 브라우저 TTS로 읽는다(동봉 오디오가 없거나 재생하지 못했을 때의 폴백).
 * 호출 전에 이미 cancel()이 끝나 있다고 전제한다.
 */
function speakWithSynthesis(
  content: string,
  opts: SpeakOptions,
  generation: number,
): Promise<void> {
  const synth = getWindow()?.speechSynthesis;
  if (!synth || typeof SpeechSynthesisUtterance === "undefined") return Promise.resolve();

  return new Promise<void>((resolve) => {
    const utterance = new SpeechSynthesisUtterance(content);
    utterance.lang = opts.lang ?? LANG;
    // rate를 주지 않으면 사용자가 고른 「음성 빠르기」를 쓴다(설정이 없으면 표준 0.95).
    utterance.rate = opts.rate ?? getSpeechRateValue();
    utterance.pitch = opts.pitch ?? 1;
    utterance.volume = opts.volume ?? 1;
    const voice = pickKoreanVoice();
    if (voice) utterance.voice = voice;

    let settled = false;
    let watchdogId = 0;
    const done = (): void => {
      if (settled) return;
      settled = true;
      if (watchdogId) window.clearTimeout(watchdogId);
      watchdogId = 0;
      resolve();
    };
    utterance.onend = done;
    utterance.onerror = done;

    /* 워치독 — iOS 사파리는 제스처 없이 시작한 발화가 onend·onerror를 **아무것도** 내지 않는
       일이 있다. 그 한 번이 응급 자동 진행을 영구 정지시키므로 상한을 둔다. */
    watchdogId = window.setTimeout(
      () => {
        if (generation === speakGeneration) cancelSynthesis();
        done();
      },
      estimateSpeechMs(content, utterance.rate) + WATCHDOG_SLACK_MS + 60,
    );

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
