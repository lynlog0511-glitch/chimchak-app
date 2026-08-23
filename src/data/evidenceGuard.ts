/**
 * 엔진에 넘기는 근거 가드 — 화이트리스트와 고정 문구를 한 곳에서 묶습니다.
 *
 * 엔진(src/engine/evidence.ts)은 목록도 문구도 스스로 들고 있지 않습니다. 「공식 지침에서
 * 근거를 찾지 못했습니다…」는 문구 변경 금지 대상이라 출처가 둘로 갈라지면 안 되고,
 * 화이트리스트도 docs.ts 하나만 보게 두어야 합니다. 이 파일이 그 둘을 엔진 계약 모양으로
 * 옮겨 주는 유일한 자리입니다.
 */

import type { EvidenceGuard } from "@/engine";
import { CITABLE_DOC_IDS, NO_SOURCE_MESSAGE } from "./docs";

/**
 * 판정에 붙는 근거는 이 목록 안에서만 나옵니다. 밖이면 판정을 멈춥니다.
 *
 * 화이트리스트는 `SOURCE_DOCS`(8건)가 아니라 **`CITABLE_DOC_IDS`(7건)** 입니다.
 * 표준교재(DOC-EDU-000)는 공공누리 제4유형이라 본문 인용에 쓰지 않기로 한 문서인데,
 * 8건을 그대로 넣으면 가드가 그 문서를 근거로 단 판정을 통과시킵니다 — 목록에 있다는 사실과
 * 인용해도 된다는 사실은 다릅니다.
 */
export const EVIDENCE_GUARD: EvidenceGuard = {
  allowedDocIds: CITABLE_DOC_IDS,
  notFoundMessage: NO_SOURCE_MESSAGE,
};
