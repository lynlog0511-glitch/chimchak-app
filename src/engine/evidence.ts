/**
 * 침착(ChimChak) 근거 가드.
 *
 * 화면은 「근거를 찾지 못하면 생성을 중단하고 확인 안내로 넘긴다」고 적어 두었다.
 * 알파에는 검색(retrieval)이 없고 모든 분기·규칙이 사전 매핑된 문서 id를 들고 있으므로,
 * 그 문장이 실제로 성립하려면 **id가 화이트리스트 밖일 때 멈추는 지점**이 코드에 있어야 한다.
 * 이 파일이 그 지점이다.
 *
 * 고정 문구는 여기서 만들지 않는다 — 화이트리스트도 문구도 데이터(src/data/docs.ts)에서
 * 받아 온다. 엔진이 화면 문구를 지어내면 「문구 변경 금지」 규율이 두 곳으로 갈라진다.
 *
 * 가드를 넘기지 않으면 아무것도 막지 않는다(기존 동작 그대로).
 */

export interface EvidenceGuard {
  /** 인용해도 되는 근거 문서 id (화이트리스트) */
  allowedDocIds: readonly string[];
  /** 목록 밖이면 판정 대신 그대로 띄울 고정 문구 */
  notFoundMessage: string;
}

export interface EvidenceCheck {
  /** 이 근거를 화면에 인용해도 되는지 */
  allowed: boolean;
  /** 화면에 붙일 근거 문서 id — 막히면 붙이지 않는다 */
  docId?: string;
  /** 막혔을 때 판정 대신 띄울 고정 문구 */
  notice?: string;
}

/**
 * 근거 문서 id가 화이트리스트 안인지 확인한다.
 *
 * 근거를 아예 달지 않은 판정(칭찬 분기 등)은 인용 자체가 없으므로 막지 않는다 —
 * 이 가드가 막는 것은 **목록 밖 문서를 근거라고 내미는 경우**다.
 *
 * @example
 * checkEvidence("DOC-LAW-003", guard).allowed; // true
 * checkEvidence("DOC-UNKNOWN-999", guard).allowed; // false — notice에 고정 문구가 담긴다
 */
export function checkEvidence(docId: string | undefined, guard?: EvidenceGuard): EvidenceCheck {
  if (!guard) return { allowed: true, docId };
  if (docId === undefined || docId.length === 0) return { allowed: true };
  if (guard.allowedDocIds.includes(docId)) return { allowed: true, docId };
  return { allowed: false, notice: guard.notFoundMessage };
}
