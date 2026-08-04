"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/Badge";
import { Card } from "@/components/Card";

/**
 * 보안 라이브 증명 패널 — "외부로 나간 요청 0건"을 문장이 아니라 계측치로 보여 줍니다.
 *
 * 세 가지를 브라우저 표준 API로만 확인합니다(백엔드 0건, 새 패키지 0개).
 *  1. 요청 계측 — `PerformanceObserver('resource')` + `performance.getEntriesByType()`로
 *     이 화면이 열린 뒤 발생한 요청을 동일 출처 / 외부 출처로 나눠 셉니다.
 *     외부 출처가 0이 아니면 **감추지 않고 목록으로 그대로 보여 줍니다**(정직).
 *  2. 기기 저장 — `caches.keys()` + `cache.keys()`로 실제 저장된 화면·자산을 나열합니다.
 *     서비스워커가 등록되지 않은 실행(개발 서버)에서는 "저장된 항목 없음"을 사실대로 적습니다.
 *  3. 직접 확인 안내 — 개발자도구 네트워크 탭에서 같은 목록을 볼 수 있음을 알립니다.
 *
 * 규칙
 *  - 서버 렌더링 시점에는 알 수 없는 값이라 **마운트 이후에만** 값을 그립니다(수화 불일치 방지).
 *  - 미지원 브라우저에서는 해당 항목을 조용히 생략합니다. 둘 다 없으면 패널 자체를 그리지 않습니다.
 *  - 이 패널은 어떤 네트워크 요청도 만들지 않습니다(측정이 측정을 오염시키지 않게).
 */

/* ── 지역 타입 (src/types/index.ts 는 수정하지 않습니다) ────────── */

type OriginKind = "same" | "cross" | "device";

interface CrossRow {
  key: string;
  host: string;
  initiatorType: string;
}

interface Counts {
  same: number;
  cross: number;
  device: number;
}

interface CacheGroup {
  /** 캐시 이름 (예: chimchak-v2) */
  name: string;
  /** 화면·파일 단위로 저장된 주소 목록 */
  entries: string[];
  /** 화면 구동용 청크(/_next/...) 개수 — 목록이 길어져 개수로만 표기합니다. */
  assetCount: number;
}

type CacheStatus = "measuring" | "unsupported" | "empty" | "stored";

interface CacheState {
  status: CacheStatus;
  groups: CacheGroup[];
  swSupported: boolean;
  swActive: boolean;
}

/* ── 상수 ──────────────────────────────────────────────────── */

/** 외부 출처가 잡혔을 때 화면에 나열할 최대 건수입니다. */
const MAX_CROSS_ROWS = 12;

/** 저장된 주소에 붙여 읽기 쉽게 만들 이름표입니다(`public/sw.js` precache 목록 기준). */
const ROUTE_LABEL: Record<string, string> = {
  "/": "홈 화면",
  "/emergency": "응급 프로토콜 목록",
  "/emergency/p-01": "P-01 낙상 — 의식이 있을 때",
  "/emergency/p-02": "P-02 기도폐쇄",
  "/emergency/p-03": "P-03 의식 저하·무반응",
  "/emergency/p-04": "P-04 경련",
  "/emergency/p-05": "P-05 심한 출혈",
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

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}초`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}분 ${s}초`;
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

/* ── 화면 조각 ─────────────────────────────────────────────── */

function MetricTile({
  label,
  value,
  caption,
  tone,
}: {
  label: string;
  value: string;
  caption: string;
  tone: "ok" | "danger" | "neutral";
}) {
  const box =
    tone === "ok"
      ? "border-ok-line bg-ok-soft"
      : tone === "danger"
        ? "border-danger-line bg-danger-soft"
        : "border-line bg-white";
  const numberTone =
    tone === "ok" ? "text-ok-ink" : tone === "danger" ? "text-danger-ink" : "text-brand-800";

  return (
    <div className={`rounded-card border p-4 md:p-5 ${box}`}>
      <p className="text-base font-bold text-ink-soft">{label}</p>
      <p className={`mt-1 text-3xl leading-tight font-extrabold tabular-nums ${numberTone}`}>
        {value}
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{caption}</p>
    </div>
  );
}

/* ── 본체 ──────────────────────────────────────────────────── */

export function LiveProofPanel() {
  const [mounted, setMounted] = useState(false);
  const [timingSupported, setTimingSupported] = useState(false);
  const [counts, setCounts] = useState<Counts>({ same: 0, cross: 0, device: 0 });
  const [crossRows, setCrossRows] = useState<CrossRow[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [cacheState, setCacheState] = useState<CacheState>({
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
      if (alive.current) setCacheState(next);
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

  const handleRefresh = useCallback((): void => {
    sweep();
    refreshCaches({ current: true });
  }, [refreshCaches, sweep]);

  const cacheVisible = cacheState.status !== "unsupported";

  // 두 계측 모두 쓸 수 없는 환경에서는 패널을 통째로 생략합니다(빈 카드 방지).
  if (mounted && !timingSupported && !cacheVisible) return null;

  const clean = counts.cross === 0;

  return (
    <Card tone="quiet" className="border-brand-200">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Badge tone="brand">라이브 계측</Badge>
        <h2 className="text-xl font-extrabold text-ink md:text-2xl">
          말이 아니라 계측치로 — 이 페이지가 열려 있는 동안
        </h2>
      </div>
      <p className="mt-3 max-w-3xl text-base leading-relaxed text-ink-soft">
        아래 숫자는 저희가 적어 둔 값이 아니라, 지금 이 브라우저가 실제로 주고받은 요청을 세어
        보여 드리는 실측치입니다. 화면을 열어 두시는 동안 계속 갱신됩니다.
      </p>

      {/* 1. 요청 계측 */}
      {mounted && timingSupported && (
        <>
          <div
            className="mt-5 grid gap-3 sm:grid-cols-2"
            role="status"
            aria-label="요청 계측 결과"
          >
            <MetricTile
              label="외부 출처 요청"
              value={`${counts.cross}건`}
              caption="이 기기 밖(다른 주소)으로 나간 요청입니다."
              tone={clean ? "ok" : "danger"}
            />
            <MetricTile
              label="동일 출처 요청"
              value={`${counts.same}건`}
              caption="이 앱 자신을 불러오는 요청입니다(화면·스크립트·스타일)."
              tone="neutral"
            />
          </div>

          <p className="mt-2.5 text-sm text-ink-muted tabular-nums">
            관측 시작 후 {formatElapsed(elapsed)} 경과
            {counts.device > 0 && ` · 기기 안에서만 만든 자원 ${counts.device}건`}
          </p>

          {clean ? (
            <p className="mt-3 text-base leading-relaxed font-bold text-ok-ink">
              지금까지 이 화면에서 외부로 나간 요청은 없습니다. 판정·가명처리·기록은 전부 이
              기기에서 끝납니다.
            </p>
          ) : (
            <div className="mt-3 rounded-card border border-danger-line bg-danger-soft p-4">
              <p className="text-base leading-relaxed font-bold text-danger-ink">
                외부 출처 요청이 잡혔습니다. 감추지 않고 그대로 보여 드립니다.
              </p>
              <ul className="mt-2.5 space-y-1.5">
                {crossRows.map((row) => (
                  <li key={row.key} className="text-base leading-relaxed break-all text-ink">
                    {row.host}
                    <span className="ml-2 text-sm text-ink-muted">({row.initiatorType})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* 2. 기기 저장 목록 */}
      {mounted && cacheVisible && (
        <div className="mt-6 border-t border-line pt-5">
          <p className="text-base font-extrabold text-ink">
            <span aria-hidden="true">💾</span> 이 기기에 저장된 화면 — 서버가 죽어도 열리는 목록
          </p>

          {cacheState.status === "measuring" && (
            <p className="mt-2 text-base leading-relaxed text-ink-muted">확인하고 있습니다…</p>
          )}

          {cacheState.status === "empty" && (
            <p className="mt-2 text-base leading-relaxed text-ink">
              지금 이 실행에서는 기기에 저장된 항목이 없습니다. 응급 화면 저장은 프로덕션
              실행에서 이뤄집니다. 개발 서버에서는 화면이 낡은 채로 남는 것을 막으려고 일부러
              등록하지 않습니다.
            </p>
          )}

          {cacheState.status === "stored" && (
            <div className="mt-3 space-y-4">
              {cacheState.groups.map((group) => (
                <div key={group.name}>
                  <Badge tone="neutral">{group.name}</Badge>
                  {group.entries.length > 0 && (
                    <ul className="mt-2.5 space-y-1.5">
                      {group.entries.map((path) => (
                        <li key={path} className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-base leading-relaxed font-bold text-ink">
                            {ROUTE_LABEL[path] ?? path}
                          </span>
                          <span className="text-sm break-all text-ink-muted">{path}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {group.assetCount > 0 && (
                    <p className="mt-2 text-sm leading-relaxed text-ink-muted tabular-nums">
                      그리고 이 화면들을 실제로 움직이는 데 필요한 자산 {group.assetCount}건이 함께
                      저장되어 있습니다.
                    </p>
                  )}
                </div>
              ))}
              {cacheState.swSupported && !cacheState.swActive && (
                <p className="text-sm leading-relaxed text-ink-muted">
                  다만 지금 이 실행에서는 저장을 관리하는 서비스워커가 활성 상태가 아닙니다. 위
                  목록은 이전에 저장된 내용입니다.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. 직접 확인 안내 */}
      <p className="mt-6 rounded-card border border-brand-200 bg-white px-4 py-3 text-base leading-relaxed font-bold text-brand-800">
        직접 확인하실 수 있습니다 — 브라우저 개발자도구(F12) → 네트워크 탭을 열어 두고 이 앱을
        사용해 보세요. 같은 목록이 그대로 보입니다.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleRefresh}
          className="inline-flex min-h-12 items-center justify-center rounded-field border border-line-strong bg-white px-5 text-base font-bold text-ink transition-colors duration-200 ease-soft hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          지금 다시 측정하기
        </button>
        <span className="text-sm leading-relaxed text-ink-muted">
          이 버튼도 네트워크를 쓰지 않습니다. 브라우저가 이미 기록해 둔 값을 다시 읽을 뿐입니다.
        </span>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-ink-muted">
        ※ 세는 범위는 브라우저 표준 계측(리소스 타이밍)이 잡는 것 — 이 화면이 불러온
        문서·스크립트·스타일·이미지·글꼴과 fetch·XHR 요청입니다. 브라우저 내장 음성 인식처럼
        페이지 리소스가 아닌 경로는 여기에 잡히지 않아, 아래 개인정보 경로 항목에 따로 적어
        두었습니다.
      </p>
    </Card>
  );
}

export default LiveProofPanel;
