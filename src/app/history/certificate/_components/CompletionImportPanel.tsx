"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { countDemoRecords } from "@/lib/demoSeed";
import { importCompletionCsv, loadCompletionImports, type CompletionImport } from "@/lib/storage";
import { formatDateTime } from "../../_components/format";

/**
 * 다른 기기의 이수 사실 파일을 이 기기로 가져오는 칸.
 *
 * 왜 필요한가: 이 앱은 기관 안내와 확인서 두 곳에서 「기기를 바꾸실 때 옮겨 두시면 됩니다」라고
 * 적어 두었는데, 정작 되돌려 넣는 경로가 없었습니다. 4주 파일럿 중 기기를 바꾸면 이수 시수가
 * 통째로 사라지는 구조였으므로, 적어 둔 문장을 지키는 쪽으로 경로를 만듭니다.
 *
 * 지키는 선 넷.
 *  1. **무기명 그대로** — 파일에도 이 화면에도 성명·소속을 넣지 않습니다. 누구의 것인지는 인쇄
 *     직전 기입란과 확인자 서명이 담당합니다.
 *  2. **같은 파일을 두 번 세지 않습니다** — 발급번호를 대조해 이미 가져온 번호와 이 기기가 방금
 *     만든 번호를 막습니다.
 *  3. **예시가 섞인 기기에는 넣지 않습니다** — 증빙과 시연이 한 누계에서 섞이면 되돌릴 수 없습니다.
 *  4. **실패하면 실패했다고 적습니다** — 무엇이 어긋났는지 사유를 그대로 보여 주고, 반쯤 넣지 않습니다.
 *
 * 합쳐지는 것은 시나리오별 이수 횟수와 이수 시수뿐입니다. 대화·판정은 파일에 애초에 없으므로
 * 가져온 회차의 상세는 이 기기에 생기지 않고, 확인서에서는 합계 안에 들어간 사실만 밝힙니다.
 */

interface Notice {
  tone: "ok" | "warn";
  text: string;
}

/**
 * 파일 바이트를 지정한 인코딩으로 읽습니다. 읽지 못하면 null입니다.
 * `fatal: false`라 깨진 바이트는 대체 문자로 남고 예외를 던지지 않습니다 —
 * 성패는 파서가 머리글로 판정합니다.
 */
function decodeWith(buffer: ArrayBuffer, encoding: string): string | null {
  if (typeof TextDecoder === "undefined") return null;
  try {
    return new TextDecoder(encoding, { fatal: false }).decode(buffer);
  } catch {
    return null;
  }
}

/**
 * 인코딩이 원인일 수 있는 실패 사유.
 * 머리글이 깨지면 파서는 「서식이 다르다」로 떨어지고, 빈 표로 보이기도 합니다.
 */
function mayBeEncoding(reason: string): boolean {
  return reason === "format" || reason === "empty";
}

/** 인코딩이 원인일 때 덧붙이는 한 줄 — 「우리 파일이 아니다」로 끝내지 않기 위해서입니다. */
const ENCODING_HINT =
  " 엑셀·한셀에서 다시 저장한 파일은 글자 인코딩이 바뀌어 읽지 못할 수 있습니다 — 내려받은 원본 파일을 그대로 골라 주십시오.";

export interface CompletionImportPanelProps {
  /** 가져오기가 성공해 이수 누계가 바뀐 뒤 — 부모가 요약을 다시 읽게 합니다. */
  onImported: () => void;
}

export function CompletionImportPanel({ onImported }: CompletionImportPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [imported, setImported] = useState<CompletionImport[]>([]);

  useEffect(() => {
    setImported(loadCompletionImports());
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      if (countDemoRecords().total > 0) {
        setNotice({
          tone: "warn",
          text: "시연용 예시가 섞여 있는 동안에는 가져오지 않습니다 — 성장 기록 위쪽 안내줄에서 예시를 지우신 뒤에 다시 골라 주십시오.",
        });
        return;
      }

      /* 바이트로 먼저 받습니다 — 같은 파일을 두 인코딩으로 읽어 보기 위해서입니다.
         내보내기는 UTF-8(BOM 포함)이지만, 담당자가 엑셀·한셀로 한 번 열어 저장하면 파일이
         CP949(EUC-KR)로 바뀝니다. 그 파일을 UTF-8로만 읽으면 머리글이 깨져
         「이 앱에서 내려받은 파일이 아닙니다」가 뜨는데, 진짜 원인은 인코딩입니다. */
      let buffer: ArrayBuffer | null = null;
      let text = "";
      try {
        if (typeof file.arrayBuffer === "function") {
          buffer = await file.arrayBuffer();
          text = decodeWith(buffer, "utf-8") ?? (await file.text());
        } else {
          text = await file.text();
        }
      } catch {
        setNotice({ tone: "warn", text: "파일을 읽지 못했습니다. 다른 파일로 시도해 주십시오." });
        return;
      }

      let merged = importCompletionCsv(text);
      /* 실패해도 저장소에는 아무것도 쓰이지 않았으므로(파싱 단계에서 멈춥니다) 다시 시도해도
         같은 파일이 두 번 세어지지 않습니다. */
      if (!merged.ok && buffer && mayBeEncoding(merged.reason)) {
        const legacy = decodeWith(buffer, "euc-kr");
        if (legacy && legacy !== text) {
          const retry = importCompletionCsv(legacy);
          // 두 번째 시도가 성공했거나, 실패 사유가 인코딩과 무관해졌다면 그쪽이 더 정확한 사실입니다.
          if (retry.ok || !mayBeEncoding(retry.reason)) merged = retry;
        }
      }

      if (!merged.ok) {
        const hint = mayBeEncoding(merged.reason) ? ENCODING_HINT : "";
        setNotice({ tone: "warn", text: `가져오지 않았습니다 — ${merged.message}${hint}` });
        return;
      }

      setImported(loadCompletionImports());
      setNotice({
        tone: "ok",
        text: `발급번호 ${merged.number}의 이수 사실을 합쳤습니다 — 시나리오 ${merged.lineCount}종 · ${merged.addedCount}회가 이 기기의 이수 누계에 더해졌습니다.`,
      });
      onImported();
    },
    [onImported],
  );

  return (
    <section
      data-noprint
      aria-labelledby="completion-import-title"
      className="mt-4 rounded-[14px] bg-paper-2 px-4 py-[14px]"
    >
      <h2
        id="completion-import-title"
        className="text-[0.9375rem] leading-[1.45] font-bold text-ink"
      >
        다른 기기의 이수 사실 파일 가져오기
      </h2>
      <p className="mt-[4px] text-[0.8438rem] leading-[1.6] text-ink-soft">
        예전 기기에서 내려받아 두신 이수 사실 파일(CSV)을 고르시면, 시나리오별 이수 횟수와 이수
        시수가 이 기기의 누계에 합쳐집니다. 같은 발급번호는 두 번 더하지 않고, 이 기기에서 만든
        파일은 가져오지 않습니다.
      </p>

      <label
        htmlFor="completion-import-file"
        className="mt-[12px] inline-flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-[14px] border border-line-strong bg-white px-5 py-2.5 text-[1.0625rem] font-semibold text-ink focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-brand-700"
      >
        이수 사실 파일 고르기
        <input
          ref={inputRef}
          id="completion-import-file"
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            // 같은 파일을 다시 고르실 수 있도록 값을 비웁니다(두 번째 선택이 조용히 무시되지 않게).
            if (inputRef.current) inputRef.current.value = "";
            if (file) void handleFile(file);
          }}
        />
      </label>

      {notice && (
        <p
          aria-live="polite"
          className={
            notice.tone === "ok"
              ? "mt-[10px] text-[0.8438rem] leading-[1.6] font-semibold text-ok-ink"
              : "mt-[10px] text-[0.8438rem] leading-[1.6] font-semibold text-warn-ink"
          }
        >
          {notice.text}
        </p>
      )}

      {imported.length > 0 && (
        <div className="mt-[12px] border-t border-line pt-[10px]">
          <p className="text-[0.7813rem] leading-[1.45] font-bold tracking-[0.06em] text-ink-muted">
            가져온 이수 사실
          </p>
          <ul className="mt-[6px]">
            {imported.map((row) => (
              <li key={row.number} className="text-[0.7813rem] leading-[1.6] text-ink-soft">
                <span className="chim-num font-bold text-ink">{row.number}</span> ·{" "}
                <span className="chim-num">{row.count}</span>회 · 가져온 시각{" "}
                {formatDateTime(row.importedAt)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-[10px] text-[0.7813rem] leading-[1.6] text-ink-soft">
        합쳐지는 것은 이수 횟수와 이수 시수뿐입니다 — 대화 내용과 판정 결과는 파일에 담기지 않으므로
        가져온 회차의 상세는 이 기기에 생기지 않습니다. 본인이 쓰시던 기기를 바꾸실 때를 위한 칸이며,
        여러 사람의 파일을 한 기기에 모으는 용도가 아닙니다.
      </p>
    </section>
  );
}

export default CompletionImportPanel;
