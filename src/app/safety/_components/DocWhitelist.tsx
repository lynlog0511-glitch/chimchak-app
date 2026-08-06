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
 * 목록 자체가 이 절의 근거라 카드로 감싸지 않고 hairline으로만 나눕니다(v4 §2).
 * 눈금은 이 화면의 것과 같습니다 — 종류 12.5(eyebrow) · 제목 17 · 설명 15.
 * 색 마커 대신 무채색 불릿을 씁니다.
 */
export function DocWhitelist() {
  const docs = useSourceDocs();

  if (docs.length > 0) {
    return (
      <ul className="chim-hairline border-y border-line">
        {docs.map((d) => (
          <li key={d.id} className="py-4">
            <p className="text-[0.7813rem] leading-[1.4] font-bold tracking-[0.04em] text-brand-700">
              {d.kind}
            </p>
            <p className="mt-1 text-[1.0625rem] leading-[1.4] font-extrabold text-ink">{d.title}</p>
            {d.note && (
              <p className="mt-1 text-[0.9375rem] leading-[1.6] text-ink-muted">{d.note}</p>
            )}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="chim-hairline border-y border-line">
      {FALLBACK_GROUPS.map((g) => (
        <li key={g.kind} className="py-4">
          <p className="text-[0.7813rem] leading-[1.4] font-bold tracking-[0.04em] text-brand-700">
            {g.kind}
          </p>
          <ul className="mt-2 space-y-2">
            {g.items.map((it) => (
              <li key={it} className="flex gap-3 text-[0.9375rem] leading-[1.6] text-ink">
                <span
                  aria-hidden="true"
                  className="mt-[10px] h-[3px] w-[3px] flex-none rounded-chip bg-ink-ghost"
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
