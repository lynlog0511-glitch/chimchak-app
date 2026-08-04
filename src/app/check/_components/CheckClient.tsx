"use client";

import { useCallback, useEffect, useState } from "react";
import { BigButton, Card } from "@/components";
import { StatusMark, type StatusMarkKind } from "@/components/icons";
import { cx } from "@/components/utils";
import type { CheckResult, CheckStatus } from "./checks";
import { loadingResults, runAllChecks } from "./checks";

/** 판정 표기는 전 화면 공통 마크(StatusMark)로 통일합니다 — 이모지를 쓰지 않습니다. */
const STATUS_MARK: Record<CheckStatus, StatusMarkKind> = {
  ok: "met",
  fail: "stop",
  unknown: "coach",
  loading: "coach",
};

const STATUS_LABEL: Record<CheckStatus, string> = {
  ok: "정상",
  fail: "확인 필요",
  unknown: "확인 불가",
  loading: "확인 중",
};

/** 항목이 많으므로 색 배경 대신 보더로만 구분합니다(화면당 색 블록 2개 규칙). */
const STATUS_BOX: Record<CheckStatus, string> = {
  ok: "border-ok-line bg-white",
  fail: "border-danger-line bg-white",
  unknown: "border-line bg-white",
  loading: "border-line bg-paper-2",
};

const STATUS_TEXT: Record<CheckStatus, string> = {
  ok: "text-ok-ink",
  fail: "text-danger-ink",
  unknown: "text-ink-soft",
  loading: "text-ink-muted",
};

function CheckRow({ result }: { result: CheckResult }) {
  return (
    <li>
      <div className={cx("rounded-card border p-4 md:p-5", STATUS_BOX[result.status])}>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <StatusMark kind={STATUS_MARK[result.status]} size="sm" />
          <span className={cx("text-base font-extrabold", STATUS_TEXT[result.status])}>
            {result.title}
          </span>
          <span className="border-l border-line pl-2.5 text-sm font-semibold text-ink-muted">
            {STATUS_LABEL[result.status]}
          </span>
        </div>

        <p className="mt-2 text-base leading-relaxed text-ink">{result.detail}</p>

        {result.fix && (
          <p className="mt-2 text-base leading-relaxed font-semibold text-ink-soft">
            조치: {result.fix}
          </p>
        )}
      </div>
    </li>
  );
}

/**
 * 무대 직전 30초 점검 화면 (발표자 전용).
 *
 * 프로덕션 빌드·서비스워커·응급 캐시·TTS 보이스·음성 인식·localStorage·네트워크를
 * 한 번에 훑어봅니다. 전부 브라우저에서만 확인 가능하므로 마운트 전에는 항상
 * "확인 중" 플레이스홀더만 그려 SSR과 첫 클라이언트 렌더가 어긋나지 않게 합니다.
 */
export function CheckClient() {
  const [mounted, setMounted] = useState(false);
  const [results, setResults] = useState<CheckResult[]>(loadingResults());
  const [checking, setChecking] = useState(false);

  const runChecks = useCallback(() => {
    setChecking(true);
    setResults(loadingResults());
    void runAllChecks().then((next) => {
      setResults(next);
      setChecking(false);
    });
  }, []);

  useEffect(() => {
    setMounted(true);
    runChecks();
  }, [runChecks]);

  const failCount = mounted ? results.filter((r) => r.status === "fail").length : 0;
  const allOk = mounted && !checking && failCount === 0;

  return (
    <div>
      <Card tone="warn" className="mb-6">
        <p className="text-base leading-relaxed font-extrabold text-warn-ink">
          발표자 전용 점검 화면입니다 · 심사 화면 아님
        </p>
        <p className="mt-1 text-base leading-relaxed text-ink-soft">
          무대에 올라가시기 전, 오프라인 시연에 필요한 조건을 한 번에 훑어보는 화면입니다.
          이 화면 자체는 어디에도 링크되어 있지 않습니다.
        </p>
      </Card>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="text-base font-bold text-ink">
          {!mounted || checking
            ? "확인하는 중입니다…"
            : allOk
              ? "모든 항목이 정상입니다."
              : `확인이 필요한 항목이 ${failCount}개 있습니다.`}
        </p>
        <BigButton onClick={runChecks} variant="secondary" disabled={checking}>
          {checking ? "검사 중…" : "다시 검사"}
        </BigButton>
      </div>

      <ul aria-live="polite" className="space-y-3">
        {results.map((result) => (
          <CheckRow key={result.id} result={result} />
        ))}
      </ul>
    </div>
  );
}

export default CheckClient;
