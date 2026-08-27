import { CITABLE_DOC_IDS, SOURCE_DOCS } from "@/data/docs";
import { EyebrowLabel } from "@/components/EyebrowLabel";

/**
 * 근거 문서 화이트리스트 표시 — **목록의 출처는 `src/data/docs.ts` 하나뿐입니다.**
 *
 * 예전에는 컨텍스트로 내려온 목록이 비었을 때를 대비해 문서군 요약을 따로 들고 있었습니다.
 * 그런데 그 폴백에는 실제 화이트리스트에 없는 문서 제목이 섞여 있었고(양성지침·보수교육
 * 운영지침), 정작 도달할 일이 없는 코드라 아무도 어긋난 줄 몰랐습니다. 이 절은 「목록 밖은
 * 인용하지 않는다」를 증명하는 자리라, 그 자리에서 목록이 두 벌인 것 자체가 사고입니다.
 * 그래서 폴백을 지우고 데이터를 직접 읽습니다.
 *
 * 표준교재는 목록에 남기되 **인용 제외**를 눈으로 갈라 둡니다 — 목록에 있다는 사실과
 * 인용할 수 있다는 사실은 다른 이야기이고, 그 차이가 저작권 판단의 핵심이기 때문입니다.
 *
 * 목록 자체가 이 절의 근거라 카드로 감싸지 않고 hairline으로만 나눕니다(v4 §2).
 * 눈금은 이 화면의 것과 같습니다 — 종류 12.5(eyebrow) · 제목 17 · 설명 15.
 */
export function DocWhitelist() {
  const citable = SOURCE_DOCS.filter((doc) => CITABLE_DOC_IDS.includes(doc.id));
  const excluded = SOURCE_DOCS.filter((doc) => !CITABLE_DOC_IDS.includes(doc.id));

  return (
    <div>
      <EyebrowLabel>
        인용 가능 {citable.length}종
      </EyebrowLabel>
      <ul className="chim-hairline mt-1 border-y border-line">
        {citable.map((doc) => (
          <li key={doc.id} className="py-4">
            {/* 색 아이브로는 `tone="brand"`(=brand-800) 한 값입니다 — 700은 globals.css가
                「흰 지면 위 **링크**」로 역할을 못 박은 단이라, 누를 수 없는 이름표에 서면
                같은 화면에서 색이 뜻을 잃습니다(7차 페르소나 디자이너 low · §9-15). */}
            <EyebrowLabel tone="brand">
              {doc.kind}
            </EyebrowLabel>
            <p className="mt-1 text-[1.0625rem] leading-[1.45] font-extrabold text-ink">
              {doc.title}
            </p>
            {doc.note && (
              <p className="mt-1 text-[0.9375rem] leading-[1.6] text-ink-muted">{doc.note}</p>
            )}
          </li>
        ))}
      </ul>

      {excluded.length > 0 && (
        <>
          <EyebrowLabel className="mt-6">
            인용 제외 {excluded.length}종 · 저작권
          </EyebrowLabel>
          <ul className="chim-hairline mt-1 border-y border-line">
            {excluded.map((doc) => (
              <li key={doc.id} className="py-4">
                {/* 「인용 제외」는 장식이 아니라 이 문서를 쓸 수 없다는 사실이라,
                    종류 줄과 같은 자리에 같은 크기로 세웁니다(색 면은 쓰지 않습니다). */}
                <EyebrowLabel>
                  {doc.kind} · 인용 제외
                </EyebrowLabel>
                <p className="mt-1 text-[1.0625rem] leading-[1.45] font-extrabold text-ink-soft">
                  {doc.title}
                </p>
                {doc.note && (
                  <p className="mt-1 text-[0.9375rem] leading-[1.6] text-ink-muted">{doc.note}</p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default DocWhitelist;
