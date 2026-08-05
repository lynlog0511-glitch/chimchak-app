"use client";

import { useCallback, useEffect, useState } from "react";
import { BigButton } from "@/components";
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

/**
 * 행 바탕 — 항목이 일곱 개라 보더로 두르지 않고 hairline으로만 나눕니다(v4 §2).
 * 무대 직전 30초 안에 눈에 걸려야 하는 것은 "확인 필요" 한 줄뿐이라 그 행만 옅은 면을 깝니다.
 */
const STATUS_ROW: Record<CheckStatus, string> = {
  ok: "",
  fail: "rounded-[10px] bg-danger-soft",
  unknown: "",
  loading: "",
};

const STATUS_TEXT: Record<CheckStatus, string> = {
  ok: "text-ok-ink",
  fail: "text-danger-ink",
  unknown: "text-ink-soft",
  loading: "text-ink-muted",
};

function CheckRow({ result }: { result: CheckResult }) {
  return (
    <li
      className={cx("px-[10px] py-[12px]", STATUS_ROW[result.status])}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <StatusMark kind={STATUS_MARK[result.status]} size="sm" />
        <span className="text-[14px] leading-[1.45] font-bold text-ink">{result.title}</span>
        <span className={cx("text-[12px] leading-[1.4] font-bold", STATUS_TEXT[result.status])}>
          {STATUS_LABEL[result.status]}
        </span>
      </div>

      <p className="mt-[3px] pl-[24px] text-[12.5px] leading-[1.6] text-ink-soft">
        {result.detail}
      </p>

      {result.fix && (
        <p className="mt-[3px] pl-[24px] text-[12.5px] leading-[1.6] font-semibold text-ink">
          조치: {result.fix}
        </p>
      )}
    </li>
  );
}

/**
 * 무대 직전 30초 점검 화면 (발표자 전용).
 *
 * 프로덕션 빌드·서비스워커·응급 캐시·TTS 보이스·음성 인식·localStorage·네트워크를
 * 한 번에 훑어봅니다. 전부 브라우저에서만 확인 가능하므로 마운트 전에는 항상
 * "확인 중" 플레이스홀더만 그려 SSR과 첫 클라이언트 렌더가 어긋나지 않게 합니다.
 *
 * 크기: 발표자 도구이므로 전 요소가 UI 크롬 크기(11.5~14px)입니다.
 * 코어 콘텐츠 확대 규칙(대사·자막·CTA 18px+)은 이 화면에 적용되지 않습니다 —
 * 여기서 필요한 것은 큰 글자가 아니라 한눈에 훑히는 밀도입니다.
 * (「다시 검사」 버튼만 터치 48px·17px 라벨을 그대로 지킵니다.)
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
      <div className="mt-[14px] rounded-[14px] bg-warn-soft px-[15px] py-[13px]">
        <p className="text-[13.5px] leading-[1.45] font-extrabold text-warn-ink">
          발표자 전용 점검 화면입니다 · 심사 화면 아님
        </p>
        <p className="mt-[5px] text-[12px] leading-[1.6] text-ink-soft">
          무대에 올라가시기 전, 오프라인 시연에 필요한 조건을 한 번에 훑어보는 화면입니다. 이
          화면 자체는 어디에도 링크되어 있지 않습니다.
        </p>
      </div>

      <div className="mt-[16px] flex items-center gap-3">
        <p aria-live="polite" className="min-w-0 flex-1 text-[13.5px] leading-[1.5] text-ink">
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

      <ul aria-live="polite" className="chim-hairline mt-[10px] border-y border-line">
        {results.map((result) => (
          <CheckRow key={result.id} result={result} />
        ))}
      </ul>
    </div>
  );
}

export default CheckClient;
