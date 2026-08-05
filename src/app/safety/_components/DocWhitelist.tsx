"use client";

import { useSourceDocs } from "@/components/SourceDocsContext";

/** 데이터가 아직 주입되지 않았을 때 보여 줄 문서군 요약 */
const FALLBACK_GROUPS = [
  {
    kind: "법령",
    items: [
      "「노인장기요양보험법」 및 같은 법 시행령",
      "「노인복지법」 시행규칙",
      "「개인정보 보호법」",
    ],
  },
  {
    kind: "고시",
    items: ["장기요양급여 제공기준 고시"],
  },
  {
    kind: "공단 지침",
    items: ["요양보호사 보수교육 운영지침", "요양보호사 양성지침"],
  },
  {
    kind: "공공 매뉴얼",
    items: ["중앙치매센터 치매 대응 매뉴얼", "공공 응급처치 안내 자료"],
  },
];

/**
 * 근거 문서 화이트리스트 표시.
 * `PageShell`이 내려 준 문서 목록이 있으면 문서 단위로, 없으면 문서군 요약으로 보여 줍니다.
 *
 * 위계가 낮은 목록이라 카드로 감싸지 않고 hairline으로만 나눕니다(v4 §2).
 * 크기: 종류 11.5px · 제목 14px w700 · 설명 12.5px. 색 마커 대신 무채색 불릿을 씁니다.
 */
export function DocWhitelist() {
  const docs = useSourceDocs();

  if (docs.length > 0) {
    return (
      <ul className="chim-hairline border-y border-line">
        {docs.map((d) => (
          <li key={d.id} className="py-[13px]">
            <p className="text-[11.5px] leading-[1.4] font-bold tracking-[0.04em] text-brand-700">
              {d.kind}
            </p>
            <p className="mt-[2px] text-[14px] leading-[1.45] font-bold text-ink">{d.title}</p>
            {d.note && (
              <p className="mt-[3px] text-[12.5px] leading-[1.6] text-ink-muted">{d.note}</p>
            )}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="chim-hairline border-y border-line">
      {FALLBACK_GROUPS.map((g) => (
        <li key={g.kind} className="py-[13px]">
          <p className="text-[11.5px] leading-[1.4] font-bold tracking-[0.04em] text-brand-700">
            {g.kind}
          </p>
          <ul className="mt-[6px] space-y-[5px]">
            {g.items.map((it) => (
              <li key={it} className="flex gap-2 text-[13px] leading-[1.6] text-ink">
                <span
                  aria-hidden="true"
                  className="mt-[9px] h-[3px] w-[3px] flex-none rounded-chip bg-faint"
                />
                <span>{it}</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

export default DocWhitelist;
