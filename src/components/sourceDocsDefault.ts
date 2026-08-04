/**
 * `PageShell`이 기본으로 주입하는 근거 문서 목록.
 *
 * 진실은 data 에이전트의 `src/data/docs.ts` 한 곳에만 둡니다.
 * 컴포넌트 쪽에 자체 매핑 상수를 두지 않는 이유이기도 합니다.
 *
 * 이 목록이 비어 있더라도 화면은 깨지지 않습니다 —
 * `SourceChip`이 title prop 또는 docId로 안전하게 대체 표기합니다.
 */
export { SOURCE_DOCS as DEFAULT_SOURCE_DOCS } from "@/data/docs";
