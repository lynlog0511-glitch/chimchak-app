/**
 * 엔진에 넘기는 근거 가드 — 화이트리스트와 고정 문구를 한 곳에서 묶습니다.
 *
 * 엔진(src/engine/evidence.ts)은 목록도 문구도 스스로 들고 있지 않습니다. 「공식 지침에서
 * 근거를 찾지 못했습니다…」는 문구 변경 금지 대상이라 출처가 둘로 갈라지면 안 되고,
 * 화이트리스트도 docs.ts 하나만 보게 두어야 합니다. 이 파일이 그 둘을 엔진 계약 모양으로
 * 옮겨 주는 유일한 자리입니다.
 */

import type { EvidenceGuard } from "@/engine";
import { NO_SOURCE_MESSAGE, SOURCE_DOCS } from "./docs";

/** 판정에 붙는 근거는 이 목록 안에서만 나옵니다. 밖이면 판정을 멈춥니다. */
export const EVIDENCE_GUARD: EvidenceGuard = {
  allowedDocIds: SOURCE_DOCS.map((doc) => doc.id),
  notFoundMessage: NO_SOURCE_MESSAGE,
};
