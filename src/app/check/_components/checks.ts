/**
 * 발표자 전용 무대 직전 점검 로직.
 *
 * 여기 함수들은 React에 의존하지 않는 순수 비동기 함수입니다. 전부 브라우저 전역
 * (`navigator`, `caches`, `window` 등)이 있을 때만 실제로 검사하고, 없으면 "확인 불가"로
 * 조용히 물러납니다(SSR·미지원 브라우저 가드). 심사에 보여주는 화면이 아니라 발표자가
 * 무대 직전 30초 안에 훑어보는 화면이므로, 여기서 실패해도 앱의 다른 어떤 상태도 바꾸지
 * 않습니다(읽기 전용 점검 + localStorage 쓰기 테스트 키 하나만 예외).
 *
 * 예외가 하나 더 있습니다 — `primeMicrophonePermission()`은 마이크 권한 창을 일부러 띄웁니다.
 * 자동 검사에는 들어가지 않고, 발표자가 직접 부를 때만 도는 함수입니다.
 */

import { runEngineSelfCheck } from "@/engine";
import {
  AI_DIALOGUE_FIXED_LABEL,
  AI_DIALOGUE_LABEL,
  AI_DIALOGUE_VARIED_LABEL,
  loadSettings,
} from "@/lib/settings";
import {
  canPlayWithoutGesture,
  createRecognizer,
  isRecognitionSupported,
  isSpeechPlaybackSupported,
} from "@/lib/speech";
import { EVIDENCE_GUARD } from "@/data/evidenceGuard";
import { SCENARIO_MATRIX } from "@/data/matrix";
import { PROTOCOLS } from "@/data/protocols";
// 시나리오 본문까지 번들에 실리지만, /check는 발표자 전용 로컬 페이지라 무게보다
// 「감수 대기 라벨이 무대 카드에 노출되는가」를 한 화면에서 아는 쪽을 택했습니다(8/24).
import { SCENARIOS } from "@/data/scenarios";
import {
  CALL_DELAY_BOUNDARY_CASES,
  DIALECT_BOUNDARY_CASE_IDS,
  EVIDENCE_BOUNDARY_CASES,
  RULE_BOUNDARY_CASES,
} from "@/data/ruleBoundaryCases";

/** 개별 항목 상태. ok=정상, fail=확인 필요, unknown=확인 불가(참고용), loading=검사 중 */
export type CheckStatus = "ok" | "fail" | "unknown" | "loading";

export interface CheckResult {
  /** 안정적인 식별자 (리스트 key 용) */
  id: string;
  /** 항목 제목 */
  title: string;
  status: CheckStatus;
  /** 현재 상태를 한 줄로 설명 */
  detail: string;
  /** 실패(또는 확인 불가) 시 보여줄 한 줄 조치 안내. 정상이면 생략 */
  fix?: string;
}

function loadingResult(id: string, title: string): CheckResult {
  return { id, title, status: "loading", detail: "확인 중…" };
}

/** 1. 프로덕션 빌드 여부 — 오프라인 시연은 프로덕션 빌드에서만 성립합니다. */
export async function checkBuildEnv(): Promise<CheckResult> {
  const isProd = process.env.NODE_ENV === "production";
  return {
    id: "build",
    title: "프로덕션 빌드 여부",
    status: isProd ? "ok" : "fail",
    detail: isProd
      ? "지금 프로덕션 빌드로 실행되고 있습니다."
      : "지금 개발 모드(npm run dev)로 실행되고 있습니다.",
    fix: isProd ? undefined : "오프라인 시연 불가: npm run build && npm start로 다시 띄우세요.",
  };
}

/** 2. 서비스워커 등록·활성 여부 — /emergency 오프라인 동작의 전제조건입니다. */
export async function checkServiceWorker(): Promise<CheckResult> {
  const id = "sw";
  const title = "서비스워커 등록·활성";
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return {
      id,
      title,
      status: "unknown",
      detail: "이 브라우저는 서비스워커를 지원하지 않아 확인할 수 없습니다.",
      fix: "Chrome 등 서비스워커 지원 브라우저로 다시 확인해 주세요.",
    };
  }
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const active = Boolean(registration?.active);
    return {
      id,
      title,
      status: active ? "ok" : "fail",
      detail: active
        ? "서비스워커가 등록되어 활성 상태입니다."
        : "서비스워커가 아직 등록되지 않았거나 활성 상태가 아닙니다.",
      fix: active
        ? undefined
        : "프로덕션 빌드(npm run build && npm start)로 새로고침한 뒤 다시 검사해 주세요.",
    };
  } catch {
    return {
      id,
      title,
      status: "unknown",
      detail: "서비스워커 상태를 확인하는 중 오류가 났습니다.",
      fix: "새로고침 후 다시 검사해 주세요.",
    };
  }
}

/**
 * 오프라인 상태여도 열려야 하는 화면 목록 — public/sw.js의 PRECACHE_URLS와 같은 것을 봅니다.
 *
 * 목록을 손으로 옮겨 적지 않고 데이터에서 만듭니다. 시나리오·프로토콜이 늘 때 여기를 고치는 것을
 * 잊으면, 저장되지 않은 화면을 두고 「전부 저장됨」이라고 말하는 점검이 됩니다.
 * sw.js는 번들 밖 정적 파일이라 이 목록을 import할 수 없어, 그쪽과의 대조는
 * tests/swPrecache.test.ts가 맡습니다.
 */
const EMERGENCY_ROUTES = [
  "/emergency",
  ...PROTOCOLS.map((protocol) => `/emergency/${protocol.id.toLowerCase()}`),
];

/** 훈련 한 바퀴 — 고르고, 한 판 돌고, 보고를 적고, 기록을 확인하는 데까지의 화면입니다. */
const TRAINING_ROUTES = [
  "/train",
  ...SCENARIO_MATRIX.filter((cell) => cell.scenarioId).map(
    (cell) => `/train/${(cell.scenarioId ?? "").toLowerCase()}`,
  ),
  "/report",
  "/history",
];

const CACHE_FIX =
  "프로덕션 빌드로 홈 화면을 한 번 열어 서비스워커 설치가 끝나길 기다린 뒤 다시 검사해 주세요.";

/** 라우트 묶음이 기기에 저장되어 있는지 세어 한 줄로 만듭니다. */
async function checkRoutesCached(
  id: string,
  title: string,
  routes: readonly string[],
  noun: string,
): Promise<CheckResult> {
  if (typeof caches === "undefined") {
    return {
      id,
      title,
      status: "unknown",
      detail: "이 브라우저는 캐시 저장소를 지원하지 않아 확인할 수 없습니다.",
      fix: "Chrome 등 캐시 저장소 지원 브라우저로 다시 확인해 주세요.",
    };
  }
  try {
    const hits = await Promise.all(
      routes.map(async (url) => {
        try {
          const hit = await caches.match(url, { ignoreSearch: true });
          return Boolean(hit);
        } catch {
          return false;
        }
      }),
    );
    const hitCount = hits.filter(Boolean).length;
    const total = routes.length;
    const allCached = hitCount === total;
    return {
      id,
      title,
      status: allCached ? "ok" : "fail",
      detail: `${hitCount} / ${total}개 ${noun}이 기기에 저장되어 있습니다.`,
      fix: allCached ? undefined : CACHE_FIX,
    };
  } catch {
    return {
      id,
      title,
      status: "unknown",
      detail: "캐시 상태를 확인하는 중 오류가 났습니다.",
      fix: "새로고침 후 다시 검사해 주세요.",
    };
  }
}

/** 3. 응급 안내 5종(+목록) 캐시 존재 여부. */
export async function checkEmergencyCache(): Promise<CheckResult> {
  return checkRoutesCached("cache", "응급 안내 5종 캐시", EMERGENCY_ROUTES, "응급 화면");
}

/**
 * 4. 훈련 한 바퀴 캐시 — 회선이 끊긴 자리에서도 훈련을 끝까지 돌 수 있는지.
 *
 * 응급 화면만 저장되어 있으면, 오프라인에서 /train 주소를 열었을 때 서비스워커의 마지막
 * 폴백이 응급 화면을 대신 내놓습니다. 화면은 뜨니 아무도 실패라고 느끼지 못한 채
 * 「인터넷이 끊겨도 훈련 한 바퀴」만 어긋납니다. 그 어긋남을 여기서 먼저 봅니다.
 *
 * 저장되는 것은 화면과 화면이 쓰는 청크입니다 — 훈련 대사의 동봉 음성은 담기지 않으므로,
 * 오프라인에서는 낭독이 기기 음성 합성으로 넘어가거나 자막만 남습니다(자막은 항상 있습니다).
 */
export async function checkTrainingCache(): Promise<CheckResult> {
  return checkRoutesCached("train-cache", "훈련 한 바퀴 캐시", TRAINING_ROUTES, "훈련 화면");
}

/** voiceschanged를 기다려 보이스 목록을 한 번 얻습니다. 최대 1.2초만 기다립니다. */
function getVoicesOnce(synth: SpeechSynthesis): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const initial = synth.getVoices();
    if (initial.length > 0) {
      resolve(initial);
      return;
    }
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      synth.onvoiceschanged = null;
      resolve(synth.getVoices());
    };
    synth.onvoiceschanged = finish;
    window.setTimeout(finish, 1200);
  });
}

/**
 * 5. 낭독 경로 — **이 기기에서 소리를 낼 수 있는가**를 봅니다.
 *
 * 이 앱의 1순위 경로는 동봉한 사전 합성 mp3이고, 브라우저 TTS는 그것이 없을 때의 폴백입니다.
 * 그래서 판정 기준은 `isSpeechPlaybackSupported()`입니다 — ko 보이스가 없어도 동봉 음성으로
 * 소리가 나는 기기에 빨간 실패를 띄우면, 발표자가 없는 문제를 고치러 OS 설정으로 들어갑니다.
 * ko 보이스 개수는 「폴백이 있는지」를 알려 주는 부가 정보로만 적습니다.
 */
export async function checkTtsVoices(): Promise<CheckResult> {
  const id = "tts";
  const title = "낭독 경로(동봉 음성·TTS)";
  const playable = isSpeechPlaybackSupported();
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return {
      id,
      title,
      status: playable ? "ok" : "fail",
      detail: playable
        ? "동봉 음성으로 재생됩니다 — 이 브라우저에는 음성 합성이 없어 폴백은 쓰지 않습니다."
        : "이 브라우저에서는 동봉 음성도 음성 합성도 쓸 수 없습니다.",
      fix: playable
        ? undefined
        : "자막만으로 진행됩니다 — 음성 시연이 필요하면 다른 브라우저로 열어 주세요.",
    };
  }
  const voices = await getVoicesOnce(window.speechSynthesis);
  const koreanVoices = voices.filter((v) => v.lang.toLowerCase().startsWith("ko"));
  const hasVoice = koreanVoices.length > 0;
  return {
    id,
    title,
    status: playable ? "ok" : "fail",
    detail: playable
      ? hasVoice
        ? `동봉 음성으로 재생되며, 폴백용 한국어 음성 ${koreanVoices.length}개도 있습니다.`
        : "동봉 음성으로 재생됩니다 — 이 기기에는 폴백용 한국어 음성이 없습니다."
      : "이 기기에서는 낭독 소리를 낼 수 없습니다.",
    fix: playable
      ? undefined
      : "자막만으로 진행됩니다 — 음성 시연이 필요하면 다른 브라우저·기기로 열어 주세요.",
  };
}

/**
 * 6. 이 탭에서 소리를 자동으로 낼 수 있는가 — **무대에서 실제로 시연을 죽이는 것**입니다.
 *
 * 응급 안내는 사용자가 아무것도 누르지 않아도 단계가 자동으로 넘어가며 읽힙니다. 그런데 브라우저는
 * 아직 화면을 건드리지 않은 탭의 재생을 거부합니다(PWA 바로가기·새 탭으로 곧바로 연 경우).
 * 재생기 화면은 그 상태에서 자막만 흐르게 물러나지만, 발표자는 무대에 올라가기 전에 알아야 합니다.
 * 재생과 **같은 요소**로 재므로 여기서 정상이면 실제 낭독도 정상입니다.
 */
export async function checkAutoplay(): Promise<CheckResult> {
  const id = "autoplay";
  const title = "이 탭에서 소리 자동 재생";
  if (typeof window === "undefined" || typeof Audio === "undefined") {
    return { id, title, status: "unknown", detail: "확인할 수 없습니다." };
  }
  const allowed = await canPlayWithoutGesture();
  return {
    id,
    title,
    status: allowed ? "ok" : "fail",
    detail: allowed
      ? "누르지 않아도 소리가 시작됩니다 — 응급 안내가 자동으로 읽힙니다."
      : "아직 이 탭에서 소리를 자동으로 시작할 수 없습니다 — 응급 안내가 자막만으로 진행됩니다.",
    fix: allowed
      ? undefined
      : "화면을 한 번 탭(또는 클릭)하신 뒤 다시 검사해 주세요. 시연 전에 응급 화면을 한 번 열어 두시면 그 탭에서는 풀립니다.",
  };
}

/** 7. 음성 인식(STT) 지원 여부. */
export async function checkSttSupport(): Promise<CheckResult> {
  const id = "stt";
  const title = "음성 인식(마이크) 지원";
  if (typeof window === "undefined") {
    return { id, title, status: "unknown", detail: "확인할 수 없습니다." };
  }
  const w = window as unknown as {
    webkitSpeechRecognition?: unknown;
    SpeechRecognition?: unknown;
  };
  const supported = Boolean(w.webkitSpeechRecognition ?? w.SpeechRecognition);
  return {
    id,
    title,
    status: supported ? "ok" : "fail",
    detail: supported
      ? "이 브라우저에서 음성 인식을 지원합니다."
      : "이 브라우저는 음성 인식을 지원하지 않습니다.",
    fix: supported
      ? undefined
      : "마이크 시연 대신 버튼 폴백으로 진행해 주세요 — 모든 화면은 버튼만으로도 완주됩니다.",
  };
}

/* ── 마이크 권한 ───────────────────────────────────────── */

/** 권한 상태 — 이름을 모르는 브라우저(파이어폭스 등)에서는 undefined입니다. */
type MicPermission = PermissionState | undefined;

async function readMicPermission(): Promise<MicPermission> {
  if (typeof navigator === "undefined" || !navigator.permissions) return undefined;
  try {
    // 표준 타입 목록에 "microphone"이 없는 정의가 있어 이름만 넘겨 캐스팅합니다.
    const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
    return status.state;
  } catch {
    // 이름을 모르는 브라우저는 여기서 TypeError를 던집니다 — 상태를 모르는 것이지 실패가 아닙니다.
    return undefined;
  }
}

/**
 * 8. 마이크 권한 상태 — **OS 권한 창이 무대에서 처음 뜨는 일**을 막기 위한 항목입니다.
 *
 * 권한 창은 브라우저 화면 위가 아니라 OS 위에 뜨고, 발표자가 그것을 찾아 누르는 몇 초는
 * 그대로 시연 시간입니다. 미리 한 번 소비해 두면 무대에서는 뜨지 않습니다.
 * 권한이 없어도 훈련은 버튼만으로 완주되므로, 여기서 막히는 것은 시연 흐름이지 기능이 아닙니다.
 */
export async function checkMicPermission(): Promise<CheckResult> {
  const id = "micperm";
  const title = "마이크 권한 상태";
  if (!isRecognitionSupported()) {
    return {
      id,
      title,
      status: "unknown",
      detail: "이 브라우저는 음성 인식을 지원하지 않아 마이크 권한을 쓰지 않습니다.",
      fix: "버튼 폴백으로 진행해 주세요 — 모든 화면은 버튼만으로도 완주됩니다.",
    };
  }
  const state = await readMicPermission();
  if (state === "granted") {
    return {
      id,
      title,
      status: "ok",
      detail: "마이크 권한이 허용되어 있습니다 — 무대에서 권한 창이 뜨지 않습니다.",
    };
  }
  if (state === "denied") {
    return {
      id,
      title,
      status: "fail",
      detail: "마이크 권한이 차단되어 있습니다 — 마이크 버튼은 눌러도 인식이 시작되지 않습니다.",
      fix: "주소창의 자물쇠에서 마이크를 허용으로 바꾸시거나, 버튼 폴백으로 진행해 주세요.",
    };
  }
  if (state === "prompt") {
    return {
      id,
      title,
      status: "fail",
      detail: "아직 권한을 묻지 않은 상태입니다 — 무대에서 마이크를 처음 누를 때 권한 창이 뜹니다.",
      fix: "아래 「지금 권한 받아 두기」를 눌러 권한 창을 미리 받아 두세요.",
    };
  }
  return {
    id,
    title,
    status: "unknown",
    detail: "이 브라우저에서는 마이크 권한 상태를 확인할 수 없습니다.",
    fix: "훈련 화면에서 마이크 버튼을 한 번 눌러 권한 창이 뜨는지 미리 확인해 주세요.",
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * OS 권한 창을 **무대에 올라가기 전에** 한 번 소비합니다.
 *
 * 인식을 짧게 시작해 창을 띄우고, 발표자가 창을 누를 때까지(최대 12초) 기다렸다가 멈춥니다.
 * 발화는 받지도 저장하지도 않습니다 — 결과 콜백이 아무 일도 하지 않습니다.
 * 상태를 읽을 수 없는 브라우저에서는 창이 뜰 시간만 두고 물러납니다.
 *
 * @example const next = await primeMicrophonePermission(); // 눌러 받은 뒤의 상태
 */
export async function primeMicrophonePermission(): Promise<CheckResult> {
  const recognizer = createRecognizer({ onResult: () => undefined, onError: () => undefined });
  if (!recognizer.supported) return checkMicPermission();
  try {
    recognizer.start();
    const deadline = Date.now() + 12_000;
    while (Date.now() < deadline) {
      await wait(300);
      const state = await readMicPermission();
      if (state === undefined) {
        await wait(1200);
        break;
      }
      if (state !== "prompt") break;
    }
  } finally {
    recognizer.stop();
  }
  return checkMicPermission();
}

/** 9. localStorage 쓰기 가능 여부. */
export async function checkLocalStorage(): Promise<CheckResult> {
  const id = "storage";
  const title = "기기 저장소(localStorage) 쓰기";
  if (typeof window === "undefined" || !("localStorage" in window)) {
    return { id, title, status: "unknown", detail: "확인할 수 없습니다." };
  }
  const key = "chimchak.check.v1";
  try {
    window.localStorage.setItem(key, "1");
    const readOk = window.localStorage.getItem(key) === "1";
    window.localStorage.removeItem(key);
    return {
      id,
      title,
      status: readOk ? "ok" : "fail",
      detail: readOk
        ? "기기 저장소에 쓸 수 있습니다."
        : "기기 저장소에 썼지만 값을 다시 읽지 못했습니다.",
      fix: readOk ? undefined : "브라우저 저장소 설정을 확인한 뒤 다시 검사해 주세요.",
    };
  } catch {
    return {
      id,
      title,
      status: "fail",
      detail: "기기 저장소에 쓰지 못했습니다.",
      fix: "시크릿/프라이빗 모드가 아닌지 확인한 뒤 다시 검사해 주세요.",
    };
  }
}

/**
 * 10. 규칙 엔진 경계 케이스 — **지금 이 브라우저에서** 돌려 통과 건수와 판정 지연을 잽니다.
 *
 * 다른 항목들은 환경을 봅니다. 이 항목만 제품의 주장을 봅니다 — 「경계 케이스 전수 통과」와
 * 「119 지연은 규칙 엔진이 판정」과 「근거가 목록 밖이면 멈춘다」가 지금 이 빌드에서도 참인지,
 * 무대에 올라가기 전에 한 번 확인합니다. 케이스는 저장소에 있고(src/data/ruleBoundaryCases.ts)
 * 러너는 순수 함수라(engine/boundaryCheck.ts) 앱 상태를 바꾸지 않습니다.
 */
export async function checkRuleEngine(): Promise<CheckResult> {
  const id = "rules";
  const title = "규칙 엔진 경계 케이스";
  const result = runEngineSelfCheck({
    ruleCases: RULE_BOUNDARY_CASES,
    callDelayCases: CALL_DELAY_BOUNDARY_CASES,
    evidenceCases: EVIDENCE_BOUNDARY_CASES,
    evidenceGuard: EVIDENCE_GUARD,
  });
  const allPassed = result.passed === result.total;
  const groups = result.groups.map((g) => `${g.label} ${g.passed}/${g.total}`).join(" · ");
  const p95 = result.p95Ms >= 0.005 ? `${result.p95Ms.toFixed(2)} ms` : "0.01 ms 미만";
  return {
    id,
    title,
    status: allPassed ? "ok" : "fail",
    detail: `${result.passed} / ${result.total}건 통과 (${groups}) · 판정 지연 p95 ${p95}`,
    fix: allPassed
      ? undefined
      : `기대와 다르게 판정된 케이스: ${result.groups.flatMap((g) => g.failures).join(" / ")}`,
  };
}

/**
 * 11. 사투리 말씨 경계 문항 — 판정선이 **말씨를 타지 않는지** 그 자리에서 다시 봅니다.
 *
 * 규칙 사전은 표준어로 쓰였습니다. 그대로 두면 사전은 현장 말씨로 말하는 분들에게만 관대해지고,
 * 그 관대함은 「덜 걸린다」가 아니라 「그분들만 코칭을 못 받는다」로 나타납니다.
 * 문항은 위 규칙 엔진 항목과 같은 목록에서 id로 골라 옵니다(src/data/ruleBoundaryCases.ts) —
 * 따로 복사해 두면 한쪽만 고쳐지는 날이 옵니다.
 */
export async function checkDialectCases(): Promise<CheckResult> {
  const id = "dialect";
  const title = "사투리 말씨 경계 문항";
  const wanted = new Set(DIALECT_BOUNDARY_CASE_IDS);
  const cases = RULE_BOUNDARY_CASES.filter((testCase) => wanted.has(testCase.id));
  if (cases.length !== DIALECT_BOUNDARY_CASE_IDS.length) {
    return {
      id,
      title,
      status: "fail",
      detail: `사투리 문항 목록과 케이스 목록이 어긋납니다 (${cases.length} / ${DIALECT_BOUNDARY_CASE_IDS.length}건).`,
      fix: "src/data/ruleBoundaryCases.ts의 DIALECT_BOUNDARY_CASE_IDS를 케이스 id와 맞춰 주세요.",
    };
  }

  const result = runEngineSelfCheck({
    ruleCases: cases,
    callDelayCases: [],
    evidenceCases: [],
    evidenceGuard: EVIDENCE_GUARD,
  });
  const allPassed = result.passed === result.total;
  return {
    id,
    title,
    status: allPassed ? "ok" : "fail",
    detail: allPassed
      ? `${result.passed} / ${result.total}문항 통과 — 경상·전라 말씨 문장에서도 판정선이 같습니다.`
      : `${result.passed} / ${result.total}문항 통과 — 말씨에 따라 판정이 갈리는 문항이 있습니다.`,
    fix: allPassed
      ? undefined
      : `기대와 다르게 판정된 문항: ${result.groups.flatMap((group) => group.failures).join(" / ")}`,
  };
}

/* ── 어르신 말투 설정 ─────────────────────────────────── */

/**
 * 13. 「어르신 말투」 설정 — 시연에서 보여 줄 「변주」가 이 값 하나에 걸려 있습니다.
 *
 * 왜 있는가: 시연 동선은 「검수 문장 그대로」로 한 번 돌아 대본을 보이고, 「매번 조금씩
 * 다르게」로 되돌려 다시 돌아 차이를 보입니다. 앞 순서 뒤에 되돌리는 것을 잊으면 그때부터
 * 모든 동선에서 어르신 대사가 검수 문장 그대로만 나오는데, 화면만 봐서는 그 상태를 알 길이
 * 없습니다 — 「변주」 표기는 붙을 때만 붙고, 안 붙는 화면은 그냥 조용합니다. 15차 감사가
 * 「/check 15항목 중 이 성립 여부를 재는 항목이 0건」을 짚어 만든 자리입니다.
 *
 * 재는 것은 저장된 설정 값까지입니다. 변주가 실제로 도착하는지는 아래 「온라인 코칭 서버」
 * 항목(서버 준비)과 훈련 화면 한 턴(실제 왕복)으로만 알 수 있고, 그 한계도 문장에 적습니다.
 * 세션 변주 보관소는 훈련 화면의 메모리에만 살아 이 페이지에서는 읽을 수 없습니다.
 */
export async function checkAiDialogueSetting(): Promise<CheckResult> {
  const id = "ai-dialogue";
  const title = `「${AI_DIALOGUE_LABEL}」 설정`;
  if (typeof window === "undefined") {
    return { id, title, status: "unknown", detail: "이 환경에서는 확인할 수 없습니다." };
  }
  const varied = loadSettings().aiDialogue.enabled !== false;
  if (varied) {
    return {
      id,
      title,
      status: "ok",
      detail: `「${AI_DIALOGUE_VARIED_LABEL}」로 되어 있습니다. 실제로 변주가 서는지는 아래 「온라인 코칭 서버」 항목과, 훈련 화면에서 한 턴 돌려 「변주」 표기가 붙는지로 확인합니다(응급 상황 훈련은 원래 제외입니다).`,
    };
  }
  return {
    id,
    title,
    status: "fail",
    detail: `「${AI_DIALOGUE_FIXED_LABEL}」로 되어 있습니다 — 어르신 대사가 전부 검수 문장 그대로 나오고, 「변주」 표기는 한 번도 붙지 않습니다.`,
    fix: `대본과의 차이를 보여 주는 시연이라면 설정에서 「${AI_DIALOGUE_VARIED_LABEL}」로 되돌려 주세요. 「검수 문장 그대로」로 한 번 돈 뒤 되돌림을 잊기 쉬운 자리라, 이 항목이 무대 직전에 그것을 잡습니다.`,
  };
}

/* ── 온라인 코칭 서버 ─────────────────────────────────── */

/**
 * 14. 온라인 코칭 서버 연결 — **시연 최대 무기의 전제조건**입니다.
 *
 * 마이크 권한처럼 사소한 것까지 무대 전에 잡아 주면서 정작 이 항목이 없으면, 「완주하면
 * 안전하다」고 믿게 만드는 체크리스트가 가장 큰 구멍 하나를 통과시킵니다. 지금까지 미설정
 * 상태를 알아챌 길은 /practice에 직접 들어가 게이트 문구를 읽는 우회로뿐이었습니다.
 *
 * ※ 2026-08-28: 이 주소가 없을 때 함께 죽는 것은 코칭·자유 연습만이 아닙니다. **기본으로 켜져
 *   있는 어르신 대사 변주**가 같은 주소를 쓰므로(`onlineVary.ts`), 미설정 배포에서는 무대 위
 *   상황 훈련이 통째로 검수 고정 대사로 돕니다 — 지정과제 서사에서 보여 줄 AI 그 자체입니다.
 *   항목 이름은 「온라인 코칭 서버」 그대로 두되, 결과 문장이 세 가지를 다 말합니다.
 *
 * 상류를 부르지 않습니다 — 라우트의 `task: "ping"` 분기가 서버 환경변수(주소·모델)가 채워져
 * 있는지만 보고 답합니다. 그래서 이 점검은 요금을 만들지 않고 **예산 통도 쓰지 않습니다**
 * (IP당 분당 계수 한 칸만 씁니다 — 계수기 밖의 무제한 분기를 남겨 두지 않으려는 자리이고,
 * 그 값은 사람이 한 화면에서 누를 수 있는 횟수보다 훨씬 큽니다).
 * 확인하는 것은 「서버가 준비돼 있는가」까지이고, 상류가 실제로 답하는지는 훈련 화면에서
 * 한 턴 돌려 보는 것이 유일한 확인입니다(그 사실도 아래 문장에 적습니다).
 */
export async function checkCoachServer(): Promise<CheckResult> {
  const id = "coach";
  const title = "온라인 코칭 서버";
  if (typeof fetch !== "function") {
    return { id, title, status: "unknown", detail: "이 브라우저에서는 확인할 수 없습니다." };
  }

  let payload: unknown;
  try {
    const response = await fetch("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: "ping" }),
    });
    if (!response.ok) {
      return {
        id,
        title,
        status: "fail",
        detail: `점검 요청이 ${response.status}로 막혔습니다.`,
        fix: "프로덕션 빌드에서 앱과 같은 주소로 열었는지 확인해 주세요(다른 출처의 요청은 서버가 받지 않습니다).",
      };
    }
    payload = await response.json();
  } catch {
    return {
      id,
      title,
      status: "fail",
      detail: "점검 요청이 서버에 닿지 못했습니다 — 지금 오프라인이거나 서버가 응답하지 않습니다.",
      fix: "오프라인이라면 정상입니다(대사 변주·온라인 코칭 모두 회선이 있을 때만 씁니다. 오프라인에서는 검수 대사가 그대로 나옵니다). 온라인인데도 막히면 배포 상태를 확인해 주세요.",
    };
  }

  const status =
    typeof payload === "object" && payload !== null
      ? (payload as { status?: unknown }).status
      : undefined;

  if (status === "ok") {
    return {
      id,
      title,
      status: "ok",
      detail:
        "서버에 주소·모델이 설정되어 있습니다. 기본으로 켜져 있는 대사 변주가 이 자리를 쓰고, 설정 화면에서 켜면 온라인 코칭·자유 연습도 돕니다.",
      fix: undefined,
    };
  }
  if (status === "unconfigured") {
    return {
      id,
      title,
      status: "fail",
      detail:
        "서버에 상류 주소·모델이 없습니다. 기본으로 켜져 있는 대사 변주가 함께 접혀 어르신 대사가 검수 문장 그대로 나오고, 자유 연습은 잠기며 코칭은 결정론만 돕니다.",
      fix: "환경변수 COACH_BASE_URL·COACH_MODEL(·COACH_API_KEY)을 채우고 다시 배포한 뒤 검사해 주세요. 미설정이면 무대에서 AI가 문장을 만드는 자리가 한 곳도 남지 않습니다(판정·응급은 원래 규칙과 고정 문구만 씁니다).",
    };
  }
  /*
   * 점검 요청이 **분당 한도**에 걸린 자리입니다.
   *
   * ping은 예산 통을 쓰지 않지만 IP당 분당 계수 한 칸은 씁니다(계수기 밖의 무제한 분기를 남겨
   * 두지 않으려는 자리). 그 한도는 IP 하나를 여럿이 나눠 쓰는 자리(행사장 공용 와이파이·기관
   * NAT)에서 **방 전체의 몫**이라, 옆에서 자유 연습 한 판이 돌면 이 점검이 그 몫에 걸릴 수
   * 있습니다. 서버 설정과는 무관한 상태이므로 붉히지 않고 참고용으로 둡니다 — 그리고
   * 「새로고침」을 권하지 않습니다. 새로고침으로는 풀리지 않고 다음 분까지 기다려야 합니다.
   */
  if (status === "rate_limited") {
    return {
      id,
      title,
      status: "unknown",
      detail: "지금 이 회선에서 요청이 몰려 점검이 잠시 막혔습니다 — 서버 설정과는 무관합니다.",
      fix: "1분 뒤 다시 검사해 주세요. 새로고침으로는 풀리지 않습니다(같은 인터넷을 쓰는 기기들이 분당 몫을 나눠 씁니다).",
    };
  }
  return {
    id,
    title,
    status: "unknown",
    detail: `서버가 낯선 답을 돌려주었습니다(${String(status ?? "응답 없음")}).`,
    fix: "새로고침 후 다시 검사해 주세요.",
  };
}

/* ── 빌드 표식 ─────────────────────────────────────────── */

/** 서비스워커 캐시 이름에서 빌드 해시만 뽑습니다. 못 뽑으면 `undefined`(확인 불가로 물러납니다). */
function readBuildStamp(source: string): string | undefined {
  const match = /const CACHE_NAME = "chimchak-([^"]*)"/.exec(source);
  const stamp = match?.[1]?.trim();
  // 치환되지 않은 플레이스홀더는 「빌드 표식이 없다」와 같습니다(개발 서버가 그렇습니다).
  if (!stamp || stamp.includes("__")) return undefined;
  return stamp;
}

/**
 * 16. 이 화면의 빌드 표식 — **지금 눈앞의 배포본이 무엇인지** 기기에서 스스로 증명합니다.
 *
 * 왜 있는가: 다른 항목은 전부 「이 기기가 준비됐는가」를 봅니다. 이 항목만 「지금 열려 있는 것이
 * **어느 빌드인가**」를 봅니다. 배포가 최신인지는 지금까지 저장소 바깥의 절차(대시보드·수동 확인)로만
 * 말할 수 있었는데, 심사장에서는 그 절차를 보여 줄 수 없습니다. 서비스워커 캐시 이름에는 빌드마다
 * 달라지는 **내용 해시**가 이미 박혀 있으므로(`public/sw.js`의 `CACHE_NAME`, prebuild가 치환),
 * 그 값을 그대로 읽어 보여 주면 리허설에서 적어 둔 로컬 빌드 값과 눈으로 대조할 수 있습니다.
 *
 * 참고용입니다 — **어떤 경우에도 붉히지 않습니다.** 값을 못 읽는 자리가 정상적으로 있습니다:
 * 개발 서버(플레이스홀더가 그대로), 오프라인, 파일을 못 받는 상황. 그때는 「확인 불가」로 물러납니다.
 * 빌드가 낡았는지 여기서 판단하지 않는 이유도 같습니다 — 무엇과 대조할지는 사람이 압니다.
 *
 * 새 환경변수를 만들지 않습니다(`NEXT_PUBLIC_` 접두어를 하나도 늘리지 않는다는 규칙). 값은
 * 이미 배포에 들어 있는 정적 파일에서 옵니다.
 */
export async function checkBuildStamp(): Promise<CheckResult> {
  const id = "build-stamp";
  const title = "이 화면의 빌드 표식 (참고용)";
  const unknownResult = (detail: string): CheckResult => ({
    id,
    title,
    status: "unknown",
    detail,
    fix: "프로덕션 빌드를 온라인에서 한 번 열면 표식이 보입니다 — 검사 실패가 아니라 참고용 항목입니다.",
  });

  if (typeof fetch !== "function") return unknownResult("이 브라우저에서는 확인할 수 없습니다.");

  try {
    // 쿼리를 붙여 저장본이 아니라 **지금 서버가 주는 파일**을 받습니다(서비스워커는 쿼리가 붙은
    // 응답을 저장하지 않습니다 — public/sw.js의 requestHasQuery).
    const response = await fetch(`/sw.js?stamp=${Date.now()}`, { cache: "no-store" });
    if (response.ok) {
      const stamp = readBuildStamp(await response.text());
      if (stamp) {
        return {
          id,
          title,
          status: "ok",
          detail: `이 화면의 빌드 표식: chimchak-${stamp} — 리허설에서 적어 둔 값과 같은지 대조하십시오.`,
        };
      }
      return unknownResult(
        "빌드 표식이 아직 박히지 않았습니다 — 개발 모드(npm run dev)에서는 정상입니다.",
      );
    }
  } catch {
    /* 오프라인이거나 파일을 받지 못했습니다 — 아래 저장본으로 물러납니다. */
  }

  // 회선이 없으면 이 기기에 설치된 서비스워커의 캐시 이름으로 물러납니다(같은 값이 들어 있습니다).
  if (typeof caches !== "undefined") {
    try {
      const installed = (await caches.keys()).find((key) => key.startsWith("chimchak-"));
      const stamp = installed?.slice("chimchak-".length);
      if (stamp && !stamp.includes("__")) {
        return {
          id,
          title,
          status: "ok",
          detail: `이 화면의 빌드 표식: chimchak-${stamp} (지금 오프라인이라 이 기기에 설치된 값입니다)`,
        };
      }
    } catch {
      /* 캐시 저장소를 못 읽는 브라우저 — 아래로 물러납니다. */
    }
  }
  return unknownResult("지금은 빌드 표식을 읽을 수 없습니다 — 오프라인이거나 파일을 받지 못했습니다.");
}

/** 15. 네트워크 상태 — 참고용. 오프라인이어도 응급 화면은 정상 동작하므로 실패로 다루지 않습니다. */
export async function checkNetwork(): Promise<CheckResult> {
  const id = "net";
  const title = "네트워크 상태 (참고용)";
  if (typeof navigator === "undefined") {
    return { id, title, status: "unknown", detail: "확인할 수 없습니다." };
  }
  const online = navigator.onLine;
  return {
    id,
    title,
    status: online ? "ok" : "unknown",
    detail: online
      ? "지금 온라인입니다."
      : "지금 오프라인입니다 — 응급 화면 시연에는 지장이 없습니다.",
  };
}

/* ── 시나리오 감수 상태 ───────────────────────────────── */

/**
 * 12. 시나리오 감수 상태 — 감수 대기 라벨이 시연 카드에 노출되는지 무대 전에 확인합니다.
 * 원천은 시나리오 데이터의 `reviewPending` 필드 하나이고, /train 카드 라벨이 같은 필드를
 * 읽습니다. 감수가 끝나면 해당 시나리오 파일의 `reviewPending` 한 줄을 지우는 것으로
 * 라벨과 이 항목이 함께 내려갑니다.
 *
 * ※ 아래 안내 문장은 **사용자 화면에 실제로 뜨는 말**(「전문가 검토를 받고 있어요」)을 인용합니다.
 *   내부 문서 표기(「알파 초안 — 현직 감수 대기」)를 그대로 옮겨 적었더니, 발표자가 화면에서
 *   찾을 문자열과 안내가 달랐습니다.
 */
async function checkScenarioReview(): Promise<CheckResult> {
  const id = "review";
  const title = "시나리오 감수 상태";
  const pending = SCENARIOS.filter((s) => s.reviewPending);
  if (pending.length === 0) {
    return {
      id,
      title,
      status: "ok",
      detail: `열린 ${SCENARIOS.length}종 모두 현직 감수를 마쳤습니다 — 카드에 초안 라벨이 없습니다.`,
    };
  }
  const names = pending.map((s) => s.id.replace("CHK-", "")).join("·");
  return {
    id,
    title,
    status: "fail",
    // 발표자가 화면에서 찾아야 할 문자열이므로 **/train 카드에 실제로 뜨는 라벨** 그대로 적습니다
    // (src/app/train/page.tsx의 REVIEW_PENDING_LABEL). 안내와 화면의 말이 다르면 무대 직전
    // 몇 초를 엉뚱한 데 씁니다.
    detail: `감수 대기 ${pending.length}종(${names}) — 훈련 카드에 「전문가 검토를 받고 있어요」 라벨이 그대로 노출됩니다.`,
    fix: "시연은 감수 완료 시나리오로 태우시고, 감수가 끝나면 해당 시나리오 데이터의 reviewPending 표기를 지워 주세요.",
  };
}

/** 화면에 이 순서 그대로 나열합니다. */
export const CHECK_RUNNERS: Array<() => Promise<CheckResult>> = [
  checkBuildEnv,
  checkServiceWorker,
  checkEmergencyCache,
  checkTrainingCache,
  checkTtsVoices,
  checkAutoplay,
  checkSttSupport,
  checkMicPermission,
  checkLocalStorage,
  checkRuleEngine,
  checkDialectCases,
  checkScenarioReview,
  checkAiDialogueSetting,
  checkCoachServer,
  checkNetwork,
  checkBuildStamp,
];

/**
 * 항목별 로딩 플레이스홀더 목록. 마운트 직후·재검사 시작 시 화면에 즉시 보여 줄 상태입니다.
 *
 * @example setResults(loadingResults());
 */
export function loadingResults(): CheckResult[] {
  return [
    loadingResult("build", "프로덕션 빌드 여부"),
    loadingResult("sw", "서비스워커 등록·활성"),
    loadingResult("cache", "응급 안내 5종 캐시"),
    loadingResult("train-cache", "훈련 한 바퀴 캐시"),
    loadingResult("tts", "낭독 경로(동봉 음성·TTS)"),
    loadingResult("autoplay", "이 탭에서 소리 자동 재생"),
    loadingResult("stt", "음성 인식(마이크) 지원"),
    loadingResult("micperm", "마이크 권한 상태"),
    loadingResult("storage", "기기 저장소(localStorage) 쓰기"),
    loadingResult("rules", "규칙 엔진 경계 케이스"),
    loadingResult("dialect", "사투리 말씨 경계 문항"),
    loadingResult("review", "시나리오 감수 상태"),
    loadingResult("ai-dialogue", `「${AI_DIALOGUE_LABEL}」 설정`),
    loadingResult("coach", "온라인 코칭 서버"),
    loadingResult("net", "네트워크 상태 (참고용)"),
    loadingResult("build-stamp", "이 화면의 빌드 표식 (참고용)"),
  ];
}

/**
 * 전 항목을 병렬로 검사합니다. 개별 항목이 예기치 않게 throw해도 전체가 죽지 않도록
 * 하나씩 감싸 "확인 불가"로 대체합니다.
 *
 * @example const results = await runAllChecks();
 */
export async function runAllChecks(): Promise<CheckResult[]> {
  return Promise.all(
    CHECK_RUNNERS.map(async (runner) => {
      try {
        return await runner();
      } catch {
        return {
          id: "unknown",
          title: "알 수 없는 항목",
          status: "unknown" as CheckStatus,
          detail: "검사 중 예기치 않은 오류가 났습니다.",
          fix: "다시 검사를 눌러 주세요.",
        };
      }
    }),
  );
}
