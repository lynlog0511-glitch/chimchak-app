"use client";

import { BigButton } from "@/components/BigButton";
import { cx } from "@/components/utils";
import { ROUTE_LABEL, formatElapsed, useLiveProof } from "./useLiveProof";

/**
 * 라이브 계측 **상세** — 숫자 뒤에 무엇이 있는지 끝까지 열어 보이는 자리입니다.
 *
 * 시안 7b에서 화면 위쪽은 두 칸짜리 요약(`LiveMeterPanel`)이 맡고, 이 조각은
 * 「데이터」 항목 안으로 들어갑니다 — 동일 출처 요청 수, 외부 출처가 잡혔을 때의 목록,
 * 기기에 저장된 화면 목록, 직접 확인 방법까지.
 *
 * 계측 자체는 `useLiveProof` 하나가 합니다(요약과 상세가 같은 값을 봅니다).
 * 이 조각은 그리기만 하고, 어떤 네트워크 요청도 만들지 않습니다.
 */

export interface LiveProofPanelProps {
  className?: string;
}

/**
 * 계측 타일 — 이 패널의 주인공도 숫자입니다.
 * 화면 위쪽 요약과 **같은 눈금(40px tabular)**을 씁니다 — 크기가 다르면 같은 값을 두 번 잰
 * 것처럼 읽히기 때문입니다. 라벨 12.5 · 설명 15.
 * 보더·그림자는 쓰지 않고 면(r14)으로만 세웁니다(v4 §2).
 */
function MetricTile({
  label,
  value,
  unit,
  caption,
  tone,
}: {
  label: string;
  value: string;
  unit: string;
  caption: string;
  tone: "ok" | "danger" | "neutral";
}) {
  const box = tone === "ok" ? "bg-ok-soft" : tone === "danger" ? "bg-danger-soft" : "bg-paper-2";
  const numberTone =
    tone === "ok" ? "text-ok-ink" : tone === "danger" ? "text-danger-ink" : "text-brand-800";

  return (
    <div className={cx("rounded-card p-4", box)}>
      <p className="text-[0.7813rem] leading-[1.5] font-bold text-ink-soft">{label}</p>
      <p
        className={cx(
          "chim-num mt-1 text-[2.5rem] leading-[1.05] font-extrabold tracking-[-0.03em]",
          numberTone,
        )}
      >
        {value}
        <span className="text-[0.9375rem] font-semibold text-ink-muted"> {unit}</span>
      </p>
      <p className="mt-2 text-[0.7813rem] leading-[1.55] text-ink-muted">{caption}</p>
    </div>
  );
}

export function LiveProofPanel({ className }: LiveProofPanelProps) {
  const { mounted, timingSupported, counts, crossRows, elapsed, cache, refresh } = useLiveProof();

  const cacheVisible = cache.status !== "unsupported";

  // 두 계측 모두 쓸 수 없는 환경에서는 패널을 통째로 생략합니다(빈 카드 방지).
  if (mounted && !timingSupported && !cacheVisible) return null;

  const clean = counts.cross === 0;

  return (
    <div className={className}>
      <p className="text-[0.7813rem] leading-[1.5] font-bold tracking-[0.06em] text-ink-muted">
        라이브 계측 상세
      </p>
      <h3 className="mt-1 text-[1.0625rem] leading-[1.4] font-extrabold text-ink">
        말이 아니라 계측치로 — 이 페이지가 열려 있는 동안
      </h3>
      <p className="mt-2 text-[0.9375rem] leading-[1.65] text-ink-soft">
        아래 숫자는 저희가 적어 둔 값이 아니라, 지금 이 브라우저가 실제로 주고받은 요청을 세어
        보여 드리는 실측치입니다. 화면을 열어 두시는 동안 계속 갱신됩니다.
      </p>

      {/* 1. 요청 계측 */}
      {mounted && timingSupported && (
        <>
          <div className="mt-4 grid gap-2" role="status" aria-label="요청 계측 결과">
            <MetricTile
              label="외부 출처 요청"
              value={String(counts.cross)}
              unit="건"
              caption="이 기기 밖(다른 주소)으로 나간 요청입니다."
              tone={clean ? "ok" : "danger"}
            />
            <MetricTile
              label="동일 출처 요청"
              value={String(counts.same)}
              unit="건"
              caption="이 앱 자신을 불러오는 요청입니다(화면·스크립트·스타일)."
              tone="neutral"
            />
          </div>

          <p className="chim-num mt-3 text-[0.7813rem] leading-[1.55] text-ink-muted">
            관측 시작 후 {formatElapsed(elapsed)} 경과
            {counts.device > 0 && ` · 기기 안에서만 만든 자원 ${counts.device}건`}
          </p>

          {clean ? (
            <p className="mt-3 text-[0.9375rem] leading-[1.65] font-bold text-ok-ink">
              지금까지 이 화면에서 외부로 나간 요청은 없습니다. 판정·가명처리·기록은 전부 이
              기기에서 끝납니다.
            </p>
          ) : (
            <div className="mt-3 rounded-card bg-danger-soft p-4">
              <p className="text-[0.9375rem] leading-[1.65] font-bold text-danger-ink">
                외부 출처 요청이 잡혔습니다. 감추지 않고 그대로 보여 드립니다.
              </p>
              <ul className="mt-2 space-y-1">
                {crossRows.map((row) => (
                  <li key={row.key} className="text-[0.9375rem] leading-[1.6] break-all text-ink">
                    {row.host}
                    <span className="ml-2 text-[0.7813rem] text-ink-muted">
                      ({row.initiatorType})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* 2. 기기 저장 목록 */}
      {mounted && cacheVisible && (
        <div className="mt-6 border-t border-line pt-4">
          <p className="text-[1.0625rem] leading-[1.4] font-extrabold text-ink">
            이 기기에 저장된 화면 — 서버가 죽어도 열리는 목록
          </p>

          {cache.status === "measuring" && (
            <p className="mt-2 text-[0.9375rem] leading-[1.6] text-ink-muted">확인하고 있습니다…</p>
          )}

          {cache.status === "empty" && (
            <p className="mt-2 text-[0.9375rem] leading-[1.6] text-ink-soft">
              지금 이 실행에서는 기기에 저장된 항목이 없습니다. 응급 화면 저장은 프로덕션
              실행에서 이뤄집니다. 개발 서버에서는 화면이 낡은 채로 남는 것을 막으려고 일부러
              등록하지 않습니다.
            </p>
          )}

          {cache.status === "stored" && (
            <div className="mt-3 space-y-4">
              {cache.groups.map((group) => (
                <div key={group.name}>
                  <p className="text-[0.7813rem] leading-[1.4] font-bold tracking-[0.04em] text-ink-muted">
                    {group.name}
                  </p>
                  {group.entries.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {group.entries.map((path) => (
                        <li key={path}>
                          <span className="text-[0.9375rem] leading-[1.55] font-bold text-ink">
                            {ROUTE_LABEL[path] ?? path}
                          </span>
                          <span className="ml-2 text-[0.7813rem] break-all text-ink-muted">
                            {path}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {group.assetCount > 0 && (
                    <p className="chim-num mt-2 text-[0.7813rem] leading-[1.55] text-ink-muted">
                      그리고 이 화면들을 실제로 움직이는 데 필요한 자산 {group.assetCount}건이 함께
                      저장되어 있습니다.
                    </p>
                  )}
                </div>
              ))}
              {cache.swSupported && !cache.swActive && (
                <p className="text-[0.7813rem] leading-[1.55] text-ink-muted">
                  다만 지금 이 실행에서는 저장을 관리하는 서비스워커가 활성 상태가 아닙니다. 위
                  목록은 이전에 저장된 내용입니다.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. 직접 확인 안내 — 보더 없이 옅은 면으로만 묶습니다(v4 §2). */}
      <div className="mt-6 rounded-card bg-paper-2 p-4">
        <p className="text-[0.9375rem] leading-[1.65] font-bold text-brand-800">
          직접 확인하실 수 있습니다 — 브라우저 개발자도구(F12) → 네트워크 탭을 열어 두고 이 앱을
          사용해 보세요. 같은 목록이 그대로 보입니다.
        </p>
      </div>

      <div className="mt-3">
        <BigButton onClick={refresh} variant="secondary" block>
          지금 다시 측정하기
        </BigButton>
        <p className="mt-2 text-[0.7813rem] leading-[1.6] text-ink-faint">
          이 버튼도 네트워크를 쓰지 않습니다. 브라우저가 이미 기록해 둔 값을 다시 읽을 뿐입니다.
        </p>
      </div>

      <p className="mt-3 text-[0.7813rem] leading-[1.6] text-ink-faint">
        ※ 세는 범위는 브라우저 표준 계측(리소스 타이밍)이 잡는 것 — 이 화면이 불러온
        문서·스크립트·스타일·이미지·글꼴과 fetch·XHR 요청입니다. 브라우저 내장 음성 인식처럼
        페이지 리소스가 아닌 경로는 여기에 잡히지 않아, 아래 개인정보 경로 항목에 따로 적어
        두었습니다.
      </p>
    </div>
  );
}

export default LiveProofPanel;
