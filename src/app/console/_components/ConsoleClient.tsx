"use client";

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { BigButton, InlineDisclaimer, cx } from "@/components";
import { formatTotalDuration } from "@/lib/duration";
import {
  completionImportMessage,
  parseCompletionCsv,
  type CompletionImportError,
  type CompletionParseResult,
} from "@/lib/storage";
import { formatDate } from "../../history/_components/format";
import { SampleCsvPanel } from "./SampleCsvPanel";
import {
  entryCourseCount,
  entryLastEndedAt,
  entrySeconds,
  summarizeEntries,
  type ConsoleEntry,
} from "./aggregate";

/**
 * 인쇄 전용 규칙 — 화면 껍데기(올리는 칸·버튼)를 빼고 증빙 묶음만 종이에 남깁니다.
 * 전역 CSS는 셸 팀 소유라 건드리지 않고, 이 화면에서만 쓰는 규칙을 여기 둡니다
 * (이수 확인서 화면이 쓰는 것과 같은 문법입니다 — 종이에 나가는 두 서류가 같은 모양이 되도록).
 */
const PRINT_CSS = `
@media print {
  @page { margin: 16mm; }
  html, body { background: #ffffff !important; }
  .chim-frame { background: #ffffff !important; }
  .chim-screen {
    max-width: none !important;
    min-height: 0 !important;
    border-inline: 0 !important;
  }
  .chim-pad { padding-inline: 0 !important; }
  [data-noprint] { display: none !important; }
  [data-print-sheet] {
    border: 0 !important;
    border-radius: 0 !important;
    /* 매 쪽 머리에 놓이는 표식 아래로 본문을 내립니다(표식과 첫 줄이 겹치지 않게). */
    padding: 9mm 0 0 !important;
    overflow: visible !important;
  }
  /* 가로 스크롤 상자는 종이에서 풀어 둡니다 — 그대로 두면 표 오른쪽이 잘립니다. */
  [data-print-wide] { overflow: visible !important; }
  [data-print-wide] table { min-width: 0 !important; }
  tr { break-inside: avoid; }
  /* 이 묶음이 무엇인지 매 쪽에 한 줄로 박습니다. position: fixed 상자는 페이지 미디어에서
     쪽마다 다시 그려지므로, 몇 쪽이 되든 같은 표식이 놓입니다(절대위치 상자는 복제되지 않습니다). */
  [data-preview-band] {
    display: block !important;
    position: fixed !important;
    top: 0;
    left: 0;
    right: 0;
    background: #ffffff !important;
    border-bottom: 0.4pt solid #000000;
    padding: 1mm 0 1.5mm;
    color: #000000 !important;
    font-size: 9pt;
    font-weight: 700;
    text-align: center;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
`;

/* ── 파일 읽기 ─────────────────────────────────────────── */

/**
 * 파일 바이트를 지정한 인코딩으로 읽습니다. 읽지 못하면 null입니다.
 * `fatal: false`라 깨진 바이트는 대체 문자로 남고 예외를 던지지 않습니다 — 성패는 파서가 판정합니다.
 */
function decodeWith(buffer: ArrayBuffer, encoding: string): string | null {
  if (typeof TextDecoder === "undefined") return null;
  try {
    return new TextDecoder(encoding, { fatal: false }).decode(buffer);
  } catch {
    return null;
  }
}

/** 인코딩이 원인일 수 있는 실패 사유 — 머리글이 깨지면 「서식이 다르다」나 빈 표로 보입니다. */
function mayBeEncoding(reason: CompletionImportError): boolean {
  return reason === "format" || reason === "empty";
}

/** 인코딩이 원인일 때 덧붙이는 한 줄 — 「우리 파일이 아니다」로 끝내지 않기 위해서입니다. */
const ENCODING_HINT =
  " 엑셀·한셀에서 다시 저장한 파일은 글자 인코딩이 바뀌어 읽지 못할 수 있습니다 — 직원분이 내려받은 원본 파일을 그대로 받아 주십시오.";

/**
 * 파일 하나를 읽어 판정까지 마칩니다.
 *
 * 내보내기는 UTF-8(BOM 포함)이지만 담당자가 엑셀·한셀로 한 번 열어 저장하면 CP949(EUC-KR)로
 * 바뀝니다. 그 파일을 UTF-8로만 읽으면 「이 앱 파일이 아닙니다」가 뜨는데 진짜 원인은 인코딩이라,
 * 이수 확인서 화면과 같은 규칙으로 한 번 더 시도합니다.
 */
async function readAndParse(file: File): Promise<CompletionParseResult | null> {
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
    return null;
  }

  let result = parseCompletionCsv(text);
  if (!result.ok && buffer && mayBeEncoding(result.reason)) {
    const legacy = decodeWith(buffer, "euc-kr");
    if (legacy && legacy !== text) {
      const retry = parseCompletionCsv(legacy);
      // 두 번째 시도가 성공했거나 사유가 인코딩과 무관해졌다면 그쪽이 더 정확한 사실입니다.
      if (retry.ok || !mayBeEncoding(retry.reason)) result = retry;
    }
  }
  return result;
}

/** 표에 올리지 못한 파일 한 줄 — 무엇이 어긋났는지 사실대로 적습니다. */
interface ConsoleReject {
  fileName: string;
  message: string;
}

/* ── 표 조각 ───────────────────────────────────────────── */

function Th({
  children,
  numeric = false,
  noPrint = false,
}: {
  children: ReactNode;
  numeric?: boolean;
  noPrint?: boolean;
}) {
  return (
    <th
      scope="col"
      data-noprint={noPrint ? "" : undefined}
      className={cx(
        "py-[8px] text-[0.7813rem] leading-[1.45] font-bold tracking-[0.06em] text-ink-muted",
        numeric ? "pl-3 text-right" : "pr-3 text-left",
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  numeric = false,
  noPrint = false,
}: {
  children: ReactNode;
  numeric?: boolean;
  noPrint?: boolean;
}) {
  return (
    <td
      data-noprint={noPrint ? "" : undefined}
      className={cx(
        "py-[11px] align-top text-[0.9375rem] leading-[1.45] text-ink",
        numeric ? "pl-3 text-right whitespace-nowrap" : "pr-3 text-left",
      )}
    >
      {children}
    </td>
  );
}

/**
 * 인쇄되는 기입 칸 — 값이 있으면 값을, 없으면 빈 밑줄을 인쇄합니다.
 * 비워 두고 손으로 적으실 수 있도록 밑줄은 언제나 남깁니다(이수 확인서와 같은 문법).
 */
function FillField({ label, value, className }: { label: string; value?: string; className?: string }) {
  const filled = (value ?? "").trim();
  return (
    <span className={cx("flex min-w-0 items-baseline gap-[8px]", className)}>
      <span className="flex-none text-[0.7813rem] leading-[1.45] font-bold text-ink-muted">{label}</span>
      <span className="min-w-[80px] flex-1 border-b border-ink-muted pb-[3px] text-[0.9375rem] leading-[1.45] font-bold text-ink">
        {filled.length > 0 ? filled : " "}
      </span>
    </span>
  );
}

/* ── 화면 ─────────────────────────────────────────────── */

/**
 * 기관 콘솔 미리보기.
 *
 * 기획서 그림 4의 오른쪽 점선이 이 화면입니다 — 파일럿 뒤에 이어 붙일 자리를 지금 실물로
 * 보여 드리되, **연결한 척하지 않습니다.** 서버도 계정도 없고, 직원분들이 각자 내려받은 이수
 * 사실 파일을 담당자가 모아서 이 기기에 올리는 방식입니다.
 *
 * 지키는 선 넷.
 *  1. **서버 0 · 전부 이 기기 안** — 올린 파일은 화면 상태로만 있고 저장소에도 쓰지 않습니다.
 *     새로 고치면 목록이 사라집니다. 이 기기에 남아 있는 본인 이수 기록도 읽지 않습니다.
 *  2. **개인정보 0** — 파일에 성명·소속 칸이 없으므로 표에 오르는 것은 발급번호까지입니다.
 *     파일 이름은 화면 대조용으로만 쓰고 인쇄물에는 싣지 않습니다(이름에 성함이 있을 수 있습니다).
 *  3. **대조는 저장소의 규칙 그대로** — `parseCompletionCsv`가 보는 것만 봅니다. 콘솔이 자체
 *     판정을 더하지 않으므로, 확인서 화면에서 걸리는 파일은 여기서도 똑같이 걸립니다.
 *  4. **못 하는 것을 적습니다** — 발급번호는 대조용이고 위조 방지 장치가 아닙니다.
 */
export function ConsoleClient() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<ConsoleEntry[]>([]);
  const [rejects, setRejects] = useState<ConsoleReject[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  /** 인쇄에만 실리는 값 — 저장하지 않습니다(화면을 닫으면 사라집니다). */
  const [orgName, setOrgName] = useState("");
  /**
   * 묶음을 만든 시각 — 파일이 실제로 올라온 순간에 잡습니다.
   *
   * 화면이 열린 시각으로 잡으면 두 가지가 어긋납니다. 서버에서 그린 시각과 이 기기의 시각이
   * 달라 첫 화면이 흔들릴 수 있고, 발표 준비 중에 열어 둔 화면으로 인쇄하면 종이의 날짜가
   * 실제로 모은 날과 달라집니다.
   */
  const [madeAt, setMadeAt] = useState("");

  const totals = useMemo(() => summarizeEntries(entries), [entries]);

  const handleFiles = useCallback(
    async (files: File[]) => {
      const accepted: ConsoleEntry[] = [];
      const failed: ConsoleReject[] = [];
      const seen = new Set(entries.map((entry) => entry.number));

      for (const file of files) {
        const result = await readAndParse(file);
        if (result === null) {
          failed.push({ fileName: file.name, message: "파일을 읽지 못했습니다." });
          continue;
        }
        if (!result.ok) {
          const hint = mayBeEncoding(result.reason) ? ENCODING_HINT : "";
          failed.push({
            fileName: file.name,
            message: `${completionImportMessage(result.reason)}${hint}`,
          });
          continue;
        }
        const { file: parsed } = result;
        if (seen.has(parsed.number)) {
          failed.push({
            fileName: file.name,
            message:
              "이미 올라온 발급번호입니다. 같은 파일을 두 번 세지 않습니다. 다른 분의 파일인지 확인해 주십시오.",
          });
          continue;
        }
        seen.add(parsed.number);
        accepted.push({
          number: parsed.number,
          fileName: file.name,
          issuedAt: parsed.issuedAt,
          totalCount: parsed.totalCount,
          totalMinutes: parsed.totalMinutes,
          lines: parsed.lines,
        });
      }

      if (accepted.length > 0) {
        setEntries((prev) => [...prev, ...accepted]);
        setMadeAt(new Date().toISOString());
      }
      setRejects(failed);
      setNotice(
        failed.length === 0
          ? `파일 ${accepted.length}벌을 표에 더했습니다.`
          : accepted.length === 0
            ? `${failed.length}벌 모두 표에 올리지 않았습니다. 사유는 아래에 있습니다.`
            : `${accepted.length}벌을 표에 더했고, ${failed.length}벌은 대조에서 걸렀습니다. 사유는 아래에 있습니다.`,
      );
    },
    [entries],
  );

  const runImport = useCallback(
    async (files: File[]) => {
      setNotice("");
      setRejects([]);
      setBusy(true);
      try {
        await handleFiles(files);
      } finally {
        setBusy(false);
      }
    },
    [handleFiles],
  );

  const removeEntry = useCallback((number: string) => {
    setEntries((prev) => prev.filter((entry) => entry.number !== number));
    setNotice(`발급번호 ${number}를 표에서 뺐습니다.`);
    setRejects([]);
  }, []);

  const clearAll = useCallback(() => {
    setEntries([]);
    setRejects([]);
    setNotice("올린 파일을 모두 비웠습니다. 이 화면은 아무것도 저장하지 않으므로 남는 값이 없습니다.");
  }, []);

  const hasEntries = entries.length > 0;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      {/* 이 화면의 정체를 맨 위에서 한 번 더 — 제목 아래 부제만으로는 「연결된 콘솔」로 읽힙니다. */}
      <div data-noprint className="mt-4 rounded-card bg-paper-2 px-4 py-[14px]">
        <p className="text-[0.9375rem] leading-[1.6] text-ink">
          기관 콘솔은 <b className="font-bold">파일럿 뒤에 연결할 자리</b>이고, 이 화면은 그 자리를
          지금 실물로 보여 드리는 미리보기입니다. 서버도 계정도 없이 이 기기 안에서만 동작합니다.
          직원분들이 각자 내려받은 이수 사실 파일을 담당자가 모아서 올리시는 방식입니다.
        </p>
        <p className="mt-[8px] text-[0.8438rem] leading-[1.6] text-ink-soft">
          지금은 파일을 손으로 모으지만, 콘솔 연결 뒤에는 이수 사실만 자동으로 올라옵니다. 대화
          내용과 판정 결과는 그때도 올라가지 않습니다.
        </p>
        <p className="mt-[8px] text-[0.8438rem] leading-[1.6] text-ink-soft">
          올리신 파일은 <b className="font-bold text-ink">이 기기에도 저장하지 않습니다</b>. 새로
          고치시면 목록이 사라집니다. 이 기기에 남아 있는 본인의 이수 기록도 읽지 않습니다.
        </p>
      </div>

      {/* ── 파일 올리는 칸 ───────────────────────────────── */}
      <section
        data-noprint
        aria-labelledby="console-upload-title"
        className="mt-5 border-t border-line pt-5"
      >
        <h2 id="console-upload-title" className="text-[1.0625rem] leading-[1.45] font-bold text-ink">
          이수 사실 파일 올리기
        </h2>
        <p className="mt-[6px] text-[0.8438rem] leading-[1.6] text-ink-soft">
          직원분이 이수 확인서 화면에서 내려받은 파일(CSV)을 여러 개 한 번에 고르실 수 있습니다. 한
          벌이 한 분이고, 같은 발급번호는 두 번 세지 않습니다.
        </p>

        <label
          htmlFor="console-files"
          aria-disabled={busy}
          className={
            busy
              ? "mt-[12px] inline-flex min-h-[48px] cursor-not-allowed items-center justify-center gap-2 rounded-card border border-line-strong bg-white px-5 py-2.5 text-[1.0625rem] font-semibold text-ink opacity-45"
              : "mt-[12px] inline-flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-card border border-line-strong bg-white px-5 py-2.5 text-[1.0625rem] font-semibold text-ink focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-brand-700"
          }
        >
          {busy ? "파일을 읽는 중입니다…" : "이수 사실 파일 고르기"}
          <input
            ref={inputRef}
            id="console-files"
            type="file"
            accept=".csv,text/csv"
            multiple
            disabled={busy}
            className="sr-only"
            onChange={(event) => {
              const picked = Array.from(event.target.files ?? []);
              // 같은 파일을 다시 고르실 수 있도록 값을 비웁니다(두 번째 선택이 조용히 무시되지 않게).
              if (inputRef.current) inputRef.current.value = "";
              if (picked.length > 0) void runImport(picked);
            }}
          />
        </label>

        <div role="status" aria-live="polite">
          {notice.length > 0 && (
            <p className="mt-[10px] text-[0.8438rem] leading-[1.6] font-semibold text-ink">{notice}</p>
          )}
        </div>

        {rejects.length > 0 && (
          <div className="mt-[10px] rounded-card bg-warn-soft px-4 py-[12px]">
            <p className="text-[0.9375rem] leading-[1.45] font-bold text-warn-ink">
              표에 올리지 않은 파일 <span className="chim-num">{rejects.length}</span>벌
            </p>
            <ul className="mt-[6px]">
              {rejects.map((row) => (
                <li
                  key={`${row.fileName}-${row.message}`}
                  className="mt-[4px] text-[0.8438rem] leading-[1.6] text-warn-ink"
                >
                  <b className="font-bold break-all">{row.fileName}</b> — {row.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <SampleCsvPanel />

      {/* ── 대조 규칙과 그 한계 ───────────────────────────── */}
      <section
        data-noprint
        aria-labelledby="console-verify-title"
        className="mt-6 border-t border-line pt-5"
      >
        <h2 id="console-verify-title" className="text-[1.0625rem] leading-[1.45] font-bold text-ink">
          이 화면이 파일에서 대조하는 것
        </h2>
        <p className="mt-[6px] text-[0.8438rem] leading-[1.6] text-ink-soft">
          콘솔이 따로 판정하지 않고 앱과 같은 검사를 씁니다. 이수 확인서 화면에서 걸리는
          파일은 여기서도 똑같이 걸립니다.
        </p>
        <ul className="chim-hairline mt-[8px] border-y border-line">
          <li className="py-[10px] text-[0.8438rem] leading-[1.6] text-ink-soft">
            <b className="font-bold text-ink">머리글이 앱 서식과 같은가</b> — 열 이름과 열 수가 한
            글자라도 다르면 받지 않습니다.
          </li>
          <li className="py-[10px] text-[0.8438rem] leading-[1.6] text-ink-soft">
            <b className="font-bold text-ink">발급번호가 한 파일에 하나인가</b> — 서식은
            「CHK-0000-0000」 하나뿐이고, 행마다 다른 번호가 섞이면 받지 않습니다.
          </li>
          <li className="py-[10px] text-[0.8438rem] leading-[1.6] text-ink-soft">
            <b className="font-bold text-ink">편성표에 있는 시나리오인가</b> — 이 앱에 없는 번호로
            행을 늘린 파일은 받지 않습니다.
          </li>
          <li className="py-[10px] text-[0.8438rem] leading-[1.6] text-ink-soft">
            <b className="font-bold text-ink">숫자가 앱이 만들 수 있는 값인가</b> — 줄 값의 합이
            파일에 적힌 합계와 맞아야 하고, 한 회차는 30분까지만 셉니다.
          </li>
        </ul>
        <p className="mt-[10px] text-[0.8438rem] leading-[1.6] text-ink">
          다만 여기까지가 한계입니다. <b className="font-bold">발급번호는 대조용</b>이며,
          위조 방지는 콘솔 연결 시 서버 서명으로 이관합니다. 지금 이 묶음의 효력은 확인자 서명이
          만듭니다.
        </p>
      </section>

      {/* ── 증빙 묶음 (인쇄물) ────────────────────────────── */}
      {hasEntries ? (
        <>
          <div data-noprint className="mt-6 border-t border-line pt-5">
            <h2 className="text-[1.0625rem] leading-[1.45] font-bold text-ink">증빙 묶음</h2>
            <p className="mt-[6px] text-[0.8438rem] leading-[1.6] text-ink-soft">
              아래 표가 그대로 인쇄됩니다. 기관명은 인쇄에만 실리고{" "}
              <b className="font-bold text-ink">저장되지 않습니다</b>. 비워 두시면 빈 밑줄로
              인쇄되어 손으로 적으실 수 있습니다.
            </p>
            <div className="mt-[12px] max-w-[360px]">
              <label htmlFor="console-org" className="text-[0.8438rem] leading-[1.45] font-bold text-ink">
                기관명
              </label>
              <input
                id="console-org"
                type="text"
                value={orgName}
                onChange={(event) => setOrgName(event.target.value)}
                autoComplete="off"
                placeholder="예) ○○주야간보호센터"
                className="mt-[6px] min-h-[48px] w-full rounded-card border border-line-strong bg-white px-[13px] text-[0.9375rem] leading-[1.6] text-ink placeholder:text-tertiary focus:border-brand-400"
              />
            </div>
          </div>

          <section
            data-print-sheet
            aria-labelledby="console-sheet-title"
            className="mt-4 rounded-card border border-line-strong px-4 py-[18px]"
          >
            {/* 인쇄 전용 머리줄 — 이 묶음이 콘솔 연결 전의 표라는 사실이 종이에도 남습니다. */}
            <p aria-hidden data-preview-band className="hidden">
              기관 콘솔 미리보기 — 이수 사실 파일을 이 기기에서 모아 만든 표 · 서버 서명 없음
            </p>

            <h2
              id="console-sheet-title"
              className="text-[1.125rem] leading-[1.3] font-extrabold text-ink"
            >
              기관 이수 현황 묶음
            </h2>
            <p className="mt-[3px] text-[0.7813rem] leading-[1.45] text-ink-soft">
              만든 날 {formatDate(madeAt)} · 이수 사실 파일{" "}
              <span className="chim-num">{entries.length}</span>벌을 이 기기에서 모아 만든 표입니다
            </p>

            <div className="mt-[14px] flex flex-col gap-[12px] border-t border-line pt-[14px] sm:flex-row sm:gap-[20px]">
              <FillField label="기관명" value={orgName} className="flex-1" />
              <FillField label="작성자" className="flex-1" />
            </div>

            <p className="mt-[14px] text-[0.8438rem] leading-[1.6] text-ink-soft">
              올라온 이수 사실 파일{" "}
              <span className="chim-num font-bold text-brand-800">{totals.people}</span>벌 · 이수
              회차 합계 <span className="chim-num font-bold text-brand-800">{totals.count}</span>회
              · 과정{" "}
              <span className="chim-num font-bold text-brand-800">{totals.courses.length}</span>
              종입니다.
            </p>
            <p className="mt-[6px] text-[0.8438rem] leading-[1.6] text-ink-soft">
              총 이수 시수{" "}
              <span className="chim-num font-bold text-brand-800">
                {formatTotalDuration(totals.seconds)}
              </span>
              입니다. 파일에 적힌 줄 값을 더한 값이며, 한 회차는 30분까지만 셉니다.
            </p>

            {/* 직원별 — 사람을 가리키는 값은 발급번호뿐입니다. */}
            <h3 className="mt-[18px] text-[0.9375rem] leading-[1.45] font-bold text-ink">
              직원별 이수 현황
            </h3>
            <p className="mt-[3px] text-[0.7813rem] leading-[1.6] text-ink-soft">
              성명 대신 파일의 발급번호로 구분합니다. 이수 사실 파일에는 성명·소속 칸이 없습니다.
              번호와 사람을 잇는 일은 기관의 명부와 확인자 서명이 합니다.
            </p>
            <div data-print-wide className="mt-[8px] overflow-x-auto">
              <table className="w-full min-w-[460px] border-collapse">
                <caption className="sr-only">
                  직원별 이수 현황 — 발급번호 · 이수 회차 · 이수 시수 · 과정 수 · 최근 완료
                </caption>
                <thead>
                  <tr className="border-b border-line-strong">
                    <Th>직원 · 발급번호</Th>
                    <Th numeric>이수 회차</Th>
                    <Th numeric>이수 시수</Th>
                    <Th numeric>과정</Th>
                    <Th>최근 완료</Th>
                    <Th noPrint>
                      <span className="sr-only">표에서 빼기</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, index) => (
                    <tr key={entry.number} className="border-b border-line">
                      <Td>
                        <span className="text-[0.75rem] leading-[1.45] text-ink-muted">
                          <span className="chim-num">{index + 1}</span>번
                        </span>
                        <span className="chim-num mt-[2px] block font-bold text-ink">
                          {entry.number}
                        </span>
                        {entry.issuedAt.length > 0 && (
                          <span className="mt-[2px] block text-[0.75rem] leading-[1.45] text-ink-muted">
                            파일 만든 시각 <span className="chim-num">{entry.issuedAt}</span>
                          </span>
                        )}
                        {/* 파일 이름은 화면에서만 — 이름에 성함이 들어 있을 수 있습니다. */}
                        <span
                          data-noprint
                          className="mt-[2px] block text-[0.75rem] leading-[1.45] break-all text-ink-muted"
                        >
                          {entry.fileName}
                        </span>
                      </Td>
                      <Td numeric>
                        <span className="chim-num font-bold">{entry.totalCount}</span>회
                      </Td>
                      <Td numeric>{formatTotalDuration(entrySeconds(entry))}</Td>
                      <Td numeric>
                        <span className="chim-num font-bold">{entryCourseCount(entry)}</span>종
                      </Td>
                      <Td>{formatDate(entryLastEndedAt(entry))}</Td>
                      <Td noPrint>
                        <button
                          type="button"
                          onClick={() => removeEntry(entry.number)}
                          aria-label={`발급번호 ${entry.number} 표에서 빼기`}
                          className="chim-press flex min-h-[48px] items-center rounded-field px-2 text-[0.8125rem] font-semibold text-ink-muted"
                        >
                          빼기
                        </button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 과정별 — 어느 훈련이 얼마나 돌았는지. */}
            <h3 className="mt-[18px] text-[0.9375rem] leading-[1.45] font-bold text-ink">
              과정별 이수 합계
            </h3>
            <div data-print-wide className="mt-[8px] overflow-x-auto">
              <table className="w-full min-w-[460px] border-collapse">
                <caption className="sr-only">
                  과정별 이수 합계 — 시나리오 · 이수 인원 · 이수 회차 · 이수 시수
                </caption>
                <thead>
                  <tr className="border-b border-line-strong">
                    <Th>과정</Th>
                    <Th numeric>이수 인원</Th>
                    <Th numeric>이수 회차</Th>
                    <Th numeric>이수 시수</Th>
                  </tr>
                </thead>
                <tbody>
                  {totals.courses.map((course) => (
                    <tr key={course.scenarioId} className="border-b border-line">
                      <Td>
                        <span className="text-[0.75rem] leading-[1.45] text-ink-muted">
                          <span className="chim-num">{course.scenarioId}</span>
                          {course.typeLabel.length > 0 && ` · ${course.typeLabel}`}
                        </span>
                        <span className="mt-[2px] block font-bold text-ink">{course.title}</span>
                      </Td>
                      <Td numeric>
                        <span className="chim-num font-bold">{course.people}</span>명
                      </Td>
                      <Td numeric>
                        <span className="chim-num font-bold">{course.count}</span>회
                      </Td>
                      <Td numeric>{formatTotalDuration(course.seconds)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 서명란 — 종이로 오가는 서식이라 확인자·일자 칸을 비워 인쇄합니다. */}
            <div className="mt-[18px] border-t border-line pt-[14px]">
              <p className="text-[0.8125rem] leading-[1.45] font-bold text-ink">
                위 이수 현황을 확인합니다
              </p>
              <p className="mt-[6px] text-[0.7813rem] leading-[1.6] text-ink-soft">
                이 묶음은 직원분들이 각자 기기에서 내려받은 이수 사실 파일을 담당자가 모아 만든
                표이며, 기관 확인자의 서명으로 효력이 생깁니다.
              </p>
              <div className="mt-[12px] flex flex-col gap-[14px] sm:flex-row sm:gap-[20px]">
                <FillField label="확인자 서명" className="flex-1" />
                <FillField label="일자" className="flex-1" />
              </div>
            </div>

            <div className="mt-[16px] border-t border-line pt-[12px]">
              <p className="text-[0.7813rem] leading-[1.6] font-bold text-ink">
                본 묶음은 앱 기록 기반이며 법정 보수교육 이수 인정이 아닙니다 — 기관 자체
                직무교육·정기평가 내부 증빙용입니다.
              </p>
              <p className="mt-[6px] text-[0.7813rem] leading-[1.6] text-ink-soft">
                발급번호는 대조용입니다 — 위조 방지는 콘솔 연결 시 서버 서명으로 이관합니다. 각
                파일은 앱 서식·합계·편성표 대조를 통과했고, 그 위의 검증은 지금 이 구조에 없습니다.
              </p>
              <p className="mt-[6px] text-[0.7813rem] leading-[1.6] text-ink-soft">
                이 묶음에는 이수 사실만 담습니다 — 판정 결과·대화 내용·발화 원문·성명·소속은 들어
                있지 않습니다. 파일을 올린 기기에도 아무것도 저장하지 않습니다.
              </p>
              <InlineDisclaimer size="md" tone="readable" className="mt-[10px]" />
            </div>
          </section>

          <div data-noprint>
            <BigButton onClick={() => window.print()} size="lg" block className="mt-4">
              증빙 묶음 인쇄 · PDF로 저장
            </BigButton>
            <p className="mt-[10px] text-center text-[0.8438rem] leading-[1.6] text-ink-soft">
              인쇄 창이 열리지 않으면 카카오톡·네이버 등 앱 안의 브라우저라 그렇습니다. 오른쪽 위
              메뉴에서 「다른 브라우저로 열기」를 고르신 뒤 다시 눌러 주십시오.
            </p>
            <BigButton onClick={clearAll} variant="secondary" block className="mt-2">
              올린 파일 모두 비우기
            </BigButton>
          </div>
        </>
      ) : (
        <div data-noprint>
          <div className="mt-6 rounded-card bg-paper-2 px-4 py-[14px]">
            <p className="text-[0.9375rem] leading-[1.45] font-bold text-ink">
              아직 올라온 파일이 없습니다
            </p>
            <p className="mt-[4px] text-[0.8438rem] leading-[1.6] text-ink-soft">
              이수 사실 파일을 한 벌이라도 올리시면 이 자리에 직원별 이수 현황과 과정별 합계가
              만들어지고, 그대로 인쇄하실 수 있습니다. 손에 파일이 없으시면 위 「올려 보실 예시 파일
              만들기」에서 세 벌을 내려받아 올려 보십시오.
            </p>
          </div>
          <InlineDisclaimer size="md" tone="readable" className="mt-6 mb-3" />
        </div>
      )}
    </>
  );
}

export default ConsoleClient;
