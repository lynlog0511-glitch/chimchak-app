"use client";

import { useEffect, useState } from "react";
import { BigButton } from "@/components";
import { SAMPLE_FILES, buildSampleFile, type SampleFileSpec } from "./sampleFiles";

/** 만들어 둔 예시 한 벌 — 번호 표시와 내려받기가 같은 값을 쓰게 붙잡아 둡니다. */
type BuiltSample = ReturnType<typeof buildSampleFile>;

/**
 * 예시 이수 사실 파일을 내려받는 칸 — 시연 때 위 칸에 올려 보실 파일을 여기서 만듭니다.
 *
 * 파일은 브라우저 안에서 만들고 주소도 `blob:`이라 **밖으로 나가는 요청이 없습니다.**
 * 담기는 것은 발급번호·시나리오·이수 횟수·시수뿐이고, 사람을 가리키는 값은 들어가지 않습니다.
 */

/**
 * 만든 문자열을 파일로 내려보냅니다.
 *
 * 폐기를 1초 미루는 이유는 이수 확인서 화면과 같습니다 — 브라우저는 `click()`이 돌아온 **뒤에**
 * 이 주소를 읽어 가므로, 같은 태스크에서 주소를 거두면 일부 브라우저에서 아무 일도 일어나지
 * 않습니다. 문서에 잠깐 붙였다가 떼는 것도 같은 이유입니다.
 */
function downloadText(text: string, filename: string): void {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}

export function SampleCsvPanel() {
  /** 방금 만든 파일 이름 — 「눌러도 아무 일이 없다」로 읽히지 않게 화면에 남깁니다. */
  const [madeName, setMadeName] = useState("");
  /**
   * 예시 세 벌을 마운트 뒤에 한 번 만들어 둡니다. 발급번호가 내용(상대 날짜)에서 계산되어
   * 서버 렌더와 클라이언트 값이 다를 수 있으므로, 화면에 적는 번호는 마운트 뒤 값만 씁니다.
   */
  const [built, setBuilt] = useState<Record<string, BuiltSample>>({});

  useEffect(() => {
    const now = new Date();
    const next: Record<string, BuiltSample> = {};
    for (const spec of SAMPLE_FILES) next[spec.key] = buildSampleFile(spec, now);
    setBuilt(next);
  }, []);

  const handleDownload = (spec: SampleFileSpec): void => {
    const file = built[spec.key] ?? buildSampleFile(spec);
    downloadText(file.csv, file.filename);
    setMadeName(file.filename);
  };

  return (
    <section
      data-noprint
      aria-labelledby="console-sample-title"
      className="mt-4 rounded-[14px] bg-paper-2 px-4 py-[14px]"
    >
      <h2 id="console-sample-title" className="text-[0.9375rem] leading-[1.45] font-bold text-ink">
        올려 보실 예시 파일 만들기
      </h2>
      <p className="mt-[4px] text-[0.8438rem] leading-[1.7] text-ink-soft">
        직원 세 분이 각자 기기에서 내려받았다고 가정한 이수 사실 파일입니다. 앱이 실제로 내보내는
        것과 <b className="font-bold text-ink">같은 서식</b>으로 이 기기에서 만들고, 위 칸에 그대로
        올리시면 됩니다.
      </p>

      <div className="mt-[12px] flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {SAMPLE_FILES.map((spec) => (
          <BigButton
            key={spec.key}
            variant="secondary"
            onClick={() => handleDownload(spec)}
            ariaLabel={`${spec.label} 이수 사실 파일 내려받기 — ${spec.note}`}
          >
            {spec.label} 내려받기
          </BigButton>
        ))}
      </div>

      <ul className="mt-[10px]">
        {SAMPLE_FILES.map((spec) => (
          <li key={spec.key} className="text-[0.7813rem] leading-[1.7] text-ink-soft">
            <span className="font-bold text-ink">{spec.label}</span>
            {built[spec.key] && (
              <>
                {" "}
                · <span className="chim-num">{built[spec.key]?.number}</span>
              </>
            )}{" "}
            — {spec.note}
          </li>
        ))}
      </ul>

      <div role="status" aria-live="polite">
        {madeName.length > 0 && (
          <p className="mt-[10px] text-[0.8438rem] leading-[1.7] font-semibold text-ok-ink">
            내려받기를 시작했습니다 — 파일 이름{" "}
            <span className="font-bold break-all">{madeName}</span>. 기기의 「다운로드」 폴더에서
            찾으실 수 있습니다.
          </p>
        )}
      </div>

      <p className="mt-[10px] text-[0.7813rem] leading-[1.7] text-ink-soft">
        이 파일은 체험용 예시입니다. 서식이 실제 파일과 같아서, 이수 확인서 화면에서 가져오시면 이
        기기의 이수 누계에 예시 회차가 더해집니다. 확인이 끝나면 지워 주십시오. 파일 안에 예시
        표시를 넣을 칸은 없습니다. 이름 앞에 붙는{" "}
        <span className="chim-num">chimchak-sample-</span>이 예시라는 표시입니다.
      </p>
    </section>
  );
}

export default SampleCsvPanel;
