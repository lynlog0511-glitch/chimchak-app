/**
 * 침착(ChimChak) 엔진 배럴.
 * 개별 모듈을 직접 import해도 되고(`@/engine/session`), 여기서 한 번에 가져와도 된다.
 *
 * 구성
 * - session : 시나리오 그래프를 걷는 상태 머신
 * - classify: 발화 → 분기 분류
 * - rules   : ⚑CF·코칭 결정론 규칙 사전
 * - scoring : 루브릭 누적과 화면 표시 변환(🟢/⚪)
 * - masking : 가명처리
 * - record  : 보고 발화 → 급여제공기록지 5요소 초안
 */

export * from "./session";
export * from "./classify";
export * from "./rules";
export * from "./scoring";
export * from "./masking";
export * from "./record";
