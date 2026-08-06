/**
 * 침착(ChimChak) 엔진 배럴.
 * 개별 모듈을 직접 import해도 되고(`@/engine/session`), 여기서 한 번에 가져와도 된다.
 *
 * 구성
 * - session : 시나리오 그래프를 걷는 상태 머신
 * - classify: 발화 → 분기 분류
 * - rules   : ⚑CF·코칭 결정론 규칙 사전
 * - timing  : CO-03 119 지연 — 문장이 아니라 경과 시간으로 내리는 결정론 판정
 * - evidence: 근거 문서 화이트리스트 가드 (목록 밖이면 판정을 멈춘다)
 * - coverage: 규칙 엔진이 단독 판정하는 항목 목록 (화면 단언이 세는 곳)
 * - scoring : 루브릭 누적과 화면 표시 변환(🟢/⚪)
 * - masking : 가명처리
 * - record  : 보고 발화 → 급여제공기록지 5요소 초안
 * - boundaryCheck : 경계 케이스를 지금 이 브라우저에서 돌려 보는 자가 점검 러너
 */

export * from "./session";
export * from "./classify";
export * from "./rules";
export * from "./timing";
export * from "./evidence";
export * from "./coverage";
export * from "./scoring";
export * from "./masking";
export * from "./record";
export * from "./boundaryCheck";
