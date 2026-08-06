/**
 * 발표자 전용 무대 직전 점검 로직.
 *
 * 여기 함수들은 React에 의존하지 않는 순수 비동기 함수입니다. 전부 브라우저 전역
 * (`navigator`, `caches`, `window` 등)이 있을 때만 실제로 검사하고, 없으면 "확인 불가"로
 * 조용히 물러납니다(SSR·미지원 브라우저 가드). 심사에 보여주는 화면이 아니라 발표자가
 * 무대 직전 30초 안에 훑어보는 화면이므로, 여기서 실패해도 앱의 다른 어떤 상태도 바꾸지
 * 않습니다(읽기 전용 점검 + localStorage 쓰기 테스트 키 하나만 예외).
 */

import { runEngineSelfCheck } from "@/engine";
import { canPlayWithoutGesture, isSpeechPlaybackSupported } from "@/lib/speech";
import { EVIDENCE_GUARD } from "@/data/evidenceGuard";
import {
  CALL_DELAY_BOUNDARY_CASES,
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

/** 오프라인 상태여도 열려야 하는 화면 목록 — public/sw.js의 PRECACHE_URLS와 같습니다. */
const EMERGENCY_ROUTES = [
  "/emergency",
  "/emergency/p-01",
  "/emergency/p-02",
  "/emergency/p-03",
  "/emergency/p-04",
  "/emergency/p-05",
];

/** 3. 응급 안내 5종(+목록) 캐시 존재 여부. */
export async function checkEmergencyCache(): Promise<CheckResult> {
  const id = "cache";
  const title = "응급 안내 5종 캐시";
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
      EMERGENCY_ROUTES.map(async (url) => {
        try {
          const hit = await caches.match(url, { ignoreSearch: true });
          return Boolean(hit);
        } catch {
          return false;
        }
      }),
    );
    const hitCount = hits.filter(Boolean).length;
    const total = EMERGENCY_ROUTES.length;
    const allCached = hitCount === total;
    return {
      id,
      title,
      status: allCached ? "ok" : "fail",
      detail: `${hitCount} / ${total}개 응급 화면이 기기에 저장되어 있습니다.`,
      fix: allCached
        ? undefined
        : "프로덕션 빌드로 홈 화면을 한 번 열어 서비스워커 설치가 끝나길 기다린 뒤 다시 검사해 주세요.",
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
 * 4. 낭독 경로 — **이 기기에서 소리를 낼 수 있는가**를 봅니다.
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
 * 5. 이 탭에서 소리를 자동으로 낼 수 있는가 — **무대에서 실제로 시연을 죽이는 것**입니다.
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

/** 6. 음성 인식(STT) 지원 여부. */
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

/** 7. localStorage 쓰기 가능 여부. */
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
 * 8. 규칙 엔진 경계 케이스 — **지금 이 브라우저에서** 돌려 통과 건수와 판정 지연을 잽니다.
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

/** 9. 네트워크 상태 — 참고용. 오프라인이어도 응급 화면은 정상 동작하므로 실패로 다루지 않습니다. */
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

/** 화면에 이 순서 그대로 나열합니다. */
export const CHECK_RUNNERS: Array<() => Promise<CheckResult>> = [
  checkBuildEnv,
  checkServiceWorker,
  checkEmergencyCache,
  checkTtsVoices,
  checkAutoplay,
  checkSttSupport,
  checkLocalStorage,
  checkRuleEngine,
  checkNetwork,
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
    loadingResult("tts", "낭독 경로(동봉 음성·TTS)"),
    loadingResult("autoplay", "이 탭에서 소리 자동 재생"),
    loadingResult("stt", "음성 인식(마이크) 지원"),
    loadingResult("storage", "기기 저장소(localStorage) 쓰기"),
    loadingResult("rules", "규칙 엔진 경계 케이스"),
    loadingResult("net", "네트워크 상태 (참고용)"),
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
