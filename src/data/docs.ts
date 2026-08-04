/**
 * 근거 문서 화이트리스트 (RAG 소스) — 설계서 부록 A 8건 전수.
 *
 * 원칙: 근거 문서는 팀이 등록한 화이트리스트로 한정하며 실시간 크롤링을 수행하지 않습니다.
 * 문서 추가 시 저작권 이용 조건을 확인하고 본 목록에 등재한 뒤에만 인덱싱합니다.
 *
 * 화면 표기: `SourceChip({ docId })` 가 title 을 칩으로 보여 주고, note 를 설명 팝오버로 보여 줍니다.
 */

import type { SourceDoc } from "@/types";

export const SOURCE_DOCS: SourceDoc[] = [
  {
    id: "DOC-LAW-003",
    title: "노인복지법 제39조의9 (금지행위)",
    kind: "법령",
    note: "노인의 신체에 폭행을 가하거나 상해를 입히는 행위, 정서적 학대, 자유를 제한하는 행위를 금지하는 조항입니다. ⚑CF 항목 CO-02(신체 억제·물리적 제지)와 존엄 보호 항목 CO-07의 판정 근거입니다.",
  },
  {
    id: "DOC-LAW-005",
    title: "의료법 제27조 (무면허 의료행위 금지)",
    kind: "법령",
    note: "의료인이 아니면 의료행위를 할 수 없도록 정한 조항입니다. ⚑CF 항목 CO-01(허용 범위 밖 행위)의 경계선을 정하는 근거이며, 침착이 신체 술기를 지도하지 않는 이유이기도 합니다.",
  },
  {
    id: "DOC-LAW-007",
    title: "산업안전보건법 제41조 (고객응대근로자 보호조치)",
    kind: "법령",
    note: "고객의 폭언 등으로부터 응대 근로자를 보호하기 위한 사업주의 조치 의무를 정한 조항입니다. RE-06(폭언 대응)과 CO-04(기관 보고)의 판정 근거입니다.",
  },
  {
    id: "DOC-NOTI-002",
    title: "장기요양급여 제공기준 및 급여비용 산정방법 등에 관한 고시",
    kind: "고시",
    note: "급여 제공 범위와 급여제공기록지 기재·보고 기준을 정한 고시입니다. CO-04·CO-05(보고·기록 판단), CL-01·CL-02·CL-03(보고 구조와 기록 초안)의 판정 근거입니다.",
  },
  {
    id: "DOC-GUIDE-001",
    title: "중앙치매센터 치매환자 행동심리증상 대응 매뉴얼",
    kind: "공공 매뉴얼",
    note: "배회·초조 등 행동심리증상에 대한 비약물적 대응 원칙을 담은 공개 매뉴얼입니다. RE-01~RE-04, RE-07~RE-09, SA-01~SA-04, CL-04의 판정 근거입니다.",
  },
  {
    id: "DOC-GUIDE-004",
    title: "소방청·응급의료정보센터 일반인 응급처치 안내",
    kind: "공공 지침",
    note: "일반인이 응급 상황에서 확인할 수 있는 관찰 항목과 신고 기준을 담은 공개 지침입니다. SA-05·SA-06(관찰 진술과 응급 감별), CO-01·CO-03(허용 범위와 신고 시점)의 판정 근거입니다.",
  },
  {
    id: "DOC-GUIDE-006",
    title: "국민건강보험공단 방문요양 급여 제공 안내",
    kind: "공단 지침",
    note: "방문요양의 업무 범위와 급여 외 행위를 정리한 공단 안내입니다. CO-06(업무 외 요구 대응), RE-05(3단 화법), SA-08(요구 재확인)의 판정 근거입니다.",
  },
  {
    id: "DOC-EDU-000",
    title: "요양보호사 표준교재",
    kind: "공공 매뉴얼",
    note: "공공누리 제4유형(상업적 이용금지·변형금지)이므로 본문 인용에 사용하지 않습니다. 교과 편성 근거로만 참조하며, 인용 가능한 근거는 법령·고시·공단 지침·중앙치매센터 공개 매뉴얼로 한정합니다.",
  },
];

/** 인용 가능 문서 ID 집합 (표준교재 제외 7건). 피드백 문장에 붙일 수 있는 출처는 이 집합뿐입니다. */
export const CITABLE_DOC_IDS: string[] = [
  "DOC-LAW-003",
  "DOC-LAW-005",
  "DOC-LAW-007",
  "DOC-NOTI-002",
  "DOC-GUIDE-001",
  "DOC-GUIDE-004",
  "DOC-GUIDE-006",
];

/** 인용 금지 문서 ID (교과 편성 근거로만 참조). */
export const NON_CITABLE_DOC_IDS: string[] = ["DOC-EDU-000"];

/** 근거를 찾지 못했을 때 화면에 그대로 표시하는 고정 문구입니다. */
export const NO_SOURCE_MESSAGE =
  "공식 지침에서 근거를 찾지 못했습니다. 담당 간호사 또는 기관에 확인해 주세요.";

/** docId 로 문서를 찾습니다. 화이트리스트 밖 ID 는 undefined 를 돌려줍니다. */
export function getSourceDoc(docId: string | undefined): SourceDoc | undefined {
  if (!docId) return undefined;
  return SOURCE_DOCS.find((doc) => doc.id === docId);
}

/** 인용 가능한 문서인지 확인합니다. (피드백 출처 칩 부착 전 후검증용) */
export function isCitable(docId: string | undefined): boolean {
  if (!docId) return false;
  return CITABLE_DOC_IDS.includes(docId);
}
