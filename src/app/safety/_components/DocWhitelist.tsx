"use client";

import { Badge } from "@/components/Badge";
import { Card } from "@/components/Card";
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
 */
export function DocWhitelist() {
  const docs = useSourceDocs();

  if (docs.length > 0) {
    return (
      <ul className="grid gap-3 md:grid-cols-2">
        {docs.map((d) => (
          <li key={d.id}>
            <Card className="h-full" padded={false}>
              <div className="p-5">
                <Badge tone="brand">{d.kind}</Badge>
                <p className="mt-2.5 text-base font-bold text-ink">{d.title}</p>
                {d.note && (
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{d.note}</p>
                )}
              </div>
            </Card>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {FALLBACK_GROUPS.map((g) => (
        <li key={g.kind}>
          <Card className="h-full">
            <Badge tone="brand">{g.kind}</Badge>
            <ul className="mt-3 space-y-1.5">
              {g.items.map((it) => (
                <li key={it} className="flex gap-2 text-base leading-relaxed text-ink">
                  <span
                    aria-hidden="true"
                    className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-chip bg-brand-400"
                  />
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export default DocWhitelist;
