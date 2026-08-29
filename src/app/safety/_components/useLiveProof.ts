"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 라이브 계측 훅 — "외부로 나간 요청 0건"을 문장이 아니라 계측치로 확인합니다.
 *
 * 시안 7b가 같은 값을 두 자리에서 씁니다(상단 요약 패널 2칸 · 「데이터」 항목 안 상세 목록).
 * 재는 방법이 두 벌이 되면 두 숫자가 갈라지므로, **계측은 이 훅 하나**로 모으고
 * 화면 조각은 그리기만 합니다.
 *
 * 브라우저 표준 API만 씁니다(백엔드 0건 · 새 패키지 0개).
 *  1. 요청 계측 — `PerformanceObserver('resource')` + `performance.getEntriesByType()`로
 *     이 화면이 열린 뒤 발생한 요청을 동일 출처 / 외부 출처로 나눠 셉니다.
 *     외부 출처가 0이 아니면 **감추지 않고 목록으로 그대로 돌려줍니다**(정직).
 *  2. 기기 저장 — `caches.keys()` + `cache.keys()`로 실제 저장된 화면·자산을 나열합니다.
 *     서비스워커가 등록되지 않은 실행(개발 서버)에서는 "저장된 항목 없음"을 사실대로 알립니다.
 *
 * 규칙
 *  - 서버 렌더 시점에는 알 수 없는 값이라 `mounted`가 참이 된 뒤에만 그립니다(수화 불일치 방지).
 *  - 이 훅은 어떤 네트워크 요청도 만들지 않습니다(측정이 측정을 오염시키지 않게).
 */

/* ── 지역 타입 (src/types/index.ts 는 수정하지 않습니다) ────────── */

export type OriginKind = "same" | "cross" | "device";

export interface CrossRow {
  key: string;
  host: string;
  initiatorType: string;
}

export interface Counts {
  same: number;
  cross: number;
  device: number;
}

export interface CacheGroup {
  /** 캐시 이름 (예: chimchak-<12자리 내용 해시>) */
  name: string;
  /** 화면·파일 단위로 저장된 주소 목록 */
  entries: string[];
  /** 화면 구동용 청크(/_next/...) 개수 — 목록이 길어져 개수로만 표기합니다. */
  assetCount: number;
}

export type CacheStatus = "measuring" | "unsupported" | "empty" | "stored";

export interface CacheState {
  status: CacheStatus;
  groups: CacheGroup[];
  swSupported: boolean;
  swActive: boolean;
}

export interface LiveProof {
  /** 마운트 이후인지 — 거짓이면 아직 아무 값도 그리지 않습니다. */
  mounted: boolean;
  /** 리소스 타이밍을 쓸 수 있는 브라우저인지 */
  timingSupported: boolean;
  counts: Counts;
  /** 외부 출처가 잡혔을 때 그대로 보여 줄 목록 */
  crossRows: CrossRow[];
  /** 관측 시작 후 경과 초 */
  elapsed: number;
  cache: CacheState;
  /** 지금 값을 다시 읽습니다(네트워크를 쓰지 않습니다). */
  refresh: () => void;
}

/* ── 상수 ──────────────────────────────────────────────────── */

/** 외부 출처가 잡혔을 때 화면에 나열할 최대 건수입니다. */
const MAX_CROSS_ROWS = 12;

/** 저장된 주소에 붙여 읽기 쉽게 만들 이름표입니다(`public/sw.js` precache 목록 기준). */
export const ROUTE_LABEL: Record<string, string> = {
  "/": "홈 화면",
  "/emergency": "응급 프로토콜 목록",
  "/emergency/p-01": "P-01 낙상 — 의식이 있을 때",
  "/emergency/p-02": "P-02 기도폐쇄",
  "/emergency/p-03": "P-03 의식 저하·무반응",
  "/emergency/p-04": "P-04 경련",
  "/emergency/p-05": "P-05 심한 출혈",
  "/emergency/p-06": "P-06 문 잠김 — 안에서 응답이 없을 때",
  "/manifest.webmanifest": "앱 설치 정보",
  "/icon.svg": "앱 아이콘",
};

/* ── 계측 유틸 ─────────────────────────────────────────────── */

/** 요청 주소를 동일 출처 / 외부 출처 / 기기 안(data:·blob:)으로 나눕니다. */
function classifyOrigin(name: string, selfOrigin: string): OriginKind | null {
  if (!name) return null;
  if (name.startsWith("data:") || name.startsWith("blob:") || name.startsWith("filesystem:")) {
    return "device";
  }
  let url: URL;
  try {
    url = new URL(name, selfOrigin);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return "device";
  return url.origin === selfOrigin ? "same" : "cross";
}

/** 화면 구동용 청크인지 — 목록 대신 개수로만 표기할 대상입니다. */
function isBulkAsset(pathname: string): boolean {
  return pathname.startsWith("/_next/");
}

function entryInitiator(entry: PerformanceEntry): string {
  if ("initiatorType" in entry) {
    const value = (entry as PerformanceResourceTiming).initiatorType;
    if (typeof value === "string") return value;
  }
  return entry.entryType;
}

export function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}초`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}분 ${s}초`;
}

/**
 * 기기에 저장된 **응급 안내가 몇 종인지** 셉니다 (시안 7b 상단 2칸 중 오른쪽).
 * 프로토콜 화면 주소(`/emergency/p-0*`)만 세고, 캐시가 여럿이면 중복을 지웁니다.
 */
export function countStoredProtocols(cache: CacheState): number {
  const found = new Set<string>();
  for (const group of cache.groups) {
    for (const path of group.entries) {
      if (/^\/emergency\/p-\d+$/.test(path)) found.add(path);
    }
  }
  return found.size;
}

/** 기기에 실제로 저장된 항목을 읽습니다. 실패·미지원은 조용히 처리합니다. */
async function readCacheState(): Promise<CacheState> {
  const swSupported = typeof navigator !== "undefined" && "serviceWorker" in navigator;
  let swActive = false;
  if (swSupported) {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      swActive = Boolean(registration?.active);
    } catch {
      swActive = false;
    }
  }

  if (typeof caches === "undefined") {
    return { status: "unsupported", groups: [], swSupported, swActive };
  }

  try {
    const names = await caches.keys();
    const groups = await Promise.all(
      names.map(async (name): Promise<CacheGroup> => {
        try {
          const cache = await caches.open(name);
          const requests = await cache.keys();
          const entries: string[] = [];
          let assetCount = 0;
          for (const request of requests) {
            let pathname: string;
            try {
              pathname = new URL(request.url).pathname;
            } catch {
              continue;
            }
            if (isBulkAsset(pathname)) {
              assetCount += 1;
              continue;
            }
            if (!entries.includes(pathname)) entries.push(pathname);
          }
          entries.sort();
          return { name, entries, assetCount };
        } catch {
          return { name, entries: [], assetCount: 0 };
        }
      }),
    );

    const stored = groups.some((g) => g.entries.length > 0 || g.assetCount > 0);
    return { status: stored ? "stored" : "empty", groups, swSupported, swActive };
  } catch {
    return { status: "unsupported", groups: [], swSupported, swActive };
  }
}

/* ── 훅 ────────────────────────────────────────────────────── */

export function useLiveProof(): LiveProof {
  const [mounted, setMounted] = useState(false);
  const [timingSupported, setTimingSupported] = useState(false);
  const [counts, setCounts] = useState<Counts>({ same: 0, cross: 0, device: 0 });
  const [crossRows, setCrossRows] = useState<CrossRow[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [cache, setCache] = useState<CacheState>({
    status: "measuring",
    groups: [],
    swSupported: false,
    swActive: false,
  });

  /** 이미 센 항목을 다시 세지 않도록 기억해 둡니다. */
  const seen = useRef<Set<string>>(new Set());

  const ingest = useCallback((entries: PerformanceEntry[]): void => {
    const selfOrigin = window.location.origin;
    let same = 0;
    let cross = 0;
    let device = 0;
    const added: CrossRow[] = [];

    for (const entry of entries) {
      const key = `${entry.name}|${entry.startTime.toFixed(3)}`;
      if (seen.current.has(key)) continue;
      seen.current.add(key);

      const kind = classifyOrigin(entry.name, selfOrigin);
      if (kind === "same") same += 1;
      else if (kind === "device") device += 1;
      else if (kind === "cross") {
        cross += 1;
        let host = entry.name;
        try {
          host = new URL(entry.name, selfOrigin).host;
        } catch {
          /* 주소를 읽지 못하면 원문을 그대로 보여 줍니다. */
        }
        added.push({ key, host, initiatorType: entryInitiator(entry) });
      }
    }

    if (same > 0 || cross > 0 || device > 0) {
      setCounts((prev) => ({
        same: prev.same + same,
        cross: prev.cross + cross,
        device: prev.device + device,
      }));
    }
    if (added.length > 0) {
      setCrossRows((prev) => [...prev, ...added].slice(0, MAX_CROSS_ROWS));
    }
  }, []);

  /** 지금 시점의 리소스 목록을 다시 읽어 반영합니다(버튼·초기 측정 공용). */
  const sweep = useCallback((): void => {
    if (typeof performance === "undefined" || typeof performance.getEntriesByType !== "function") {
      return;
    }
    try {
      ingest(performance.getEntriesByType("navigation"));
      ingest(performance.getEntriesByType("resource"));
    } catch {
      /* 계측 실패는 조용히 넘깁니다. */
    }
  }, [ingest]);

  const refreshCaches = useCallback((alive: { current: boolean }): void => {
    void readCacheState().then((next) => {
      if (alive.current) setCache(next);
    });
  }, []);

  /* 마운트 이후에만 값을 그립니다(서버 렌더 결과와 첫 렌더를 일치시켜 수화 불일치 방지). */
  useEffect(() => {
    setMounted(true);

    const supported =
      typeof performance !== "undefined" && typeof performance.getEntriesByType === "function";
    setTimingSupported(supported);
    if (supported) sweep();

    let observer: PerformanceObserver | undefined;
    let poll: ReturnType<typeof setInterval> | undefined;

    if (supported && typeof PerformanceObserver !== "undefined") {
      try {
        observer = new PerformanceObserver((list) => {
          ingest(list.getEntries());
        });
        observer.observe({ type: "resource", buffered: true });
      } catch {
        observer = undefined;
      }
    }
    // 관측기를 쓸 수 없는 브라우저에서도 화면이 멈춰 보이지 않게 주기적으로 다시 읽습니다.
    if (supported && !observer) {
      poll = setInterval(sweep, 3000);
    }

    return () => {
      observer?.disconnect();
      if (poll) clearInterval(poll);
    };
  }, [ingest, sweep]);

  /* 저장 목록 — 서비스워커 저장이 끝나는 순간에도 다시 확인합니다. */
  useEffect(() => {
    const alive = { current: true };
    const run = (): void => refreshCaches(alive);
    run();

    const sw = typeof navigator !== "undefined" ? navigator.serviceWorker : undefined;
    sw?.addEventListener("controllerchange", run);
    return () => {
      alive.current = false;
      sw?.removeEventListener("controllerchange", run);
    };
  }, [refreshCaches]);

  /* "이 페이지가 열려 있는 동안"을 눈에 보이게 하는 경과 시간입니다. */
  useEffect(() => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const refresh = useCallback((): void => {
    sweep();
    refreshCaches({ current: true });
  }, [refreshCaches, sweep]);

  return { mounted, timingSupported, counts, crossRows, elapsed, cache, refresh };
}
