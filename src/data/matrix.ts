/**
 * 시나리오 12종 매트릭스 (유형 4 × 난이도 3) — 설계서 §9.1 확장 로드맵 그대로.
 *
 * 열린 것은 5종(A01·A02·B02·C01·C02)이며, 나머지 7종은 잠금 상태로 표시합니다.
 * 이 가운데 A01·B02·C01은 알파 감수를 지난 3종이고, A02·C02는 같은 루브릭·규칙 사전 위에
 * **데이터만 더해** 이어 붙인 알파 초안(현직 감수 대기)입니다 — 확장이 코드 변경 없이
 * 데이터로 끝난다는 것을 실물로 보이는 자리입니다.
 * 유형④(위험 판단)는 동작 교정으로 오인될 위험을 알파 단계에서 통제할 수 없다고 판단해
 * 베타로 이연했습니다. (설계서 §2.4 알파 제외 결정 / §6.1 R-09)
 *
 * 확장 원가: 시나리오 1종당 스크립트 4h + 현직 감수 1h + 근거 문서 매핑 1h + 구현 2h ≈ 8h.
 * 루브릭 30항목은 재사용하므로 확장 원가가 선형이 아니라 체감합니다.
 */

import type { MatrixCell } from "@/types";

export const SCENARIO_MATRIX: MatrixCell[] = [
  /* ① BPSD */
  { typeLabel: "① BPSD", level: 1, title: "A01 현관 앞 귀가 요구", scenarioId: "CHK-A01" },
  { typeLabel: "① BPSD", level: 2, title: "A02 야간 배회 + 보호자 부재", scenarioId: "CHK-A02" },
  { typeLabel: "① BPSD", level: 3, title: "A03 흥분·공격성 + 낙상 위험 동반" },

  /* ② 응급 */
  { typeLabel: "② 응급", level: 1, title: "B01 낙상 후 의식 있음 — 관찰·보고" },
  { typeLabel: "② 응급", level: 2, title: "B02 질식·사레 — 자세 확보·119", scenarioId: "CHK-B02" },
  { typeLabel: "② 응급", level: 3, title: "B03 의식 저하·경련 — 신고 판단" },

  /* ③ 갈등 */
  { typeLabel: "③ 갈등", level: 1, title: "C00 업무 외 요구 정중한 경계 설정" },
  { typeLabel: "③ 갈등", level: 2, title: "C01 폭언·인격 무시 대응", scenarioId: "CHK-C01" },
  {
    typeLabel: "③ 갈등",
    level: 3,
    title: "C02 사고 책임 추궁·계약 해지 위협",
    scenarioId: "CHK-C02",
  },

  /* ④ 위험 판단 (베타 이연) */
  { typeLabel: "④ 위험 판단", level: 1, title: "D01 위험 요인 사전 점검 순서" },
  { typeLabel: "④ 위험 판단", level: 2, title: "D02 혼자 할지 도움 요청할지 판단" },
  { typeLabel: "④ 위험 판단", level: 3, title: "D03 사고 발생 시 보고·기록 절차" },
];

/** 매트릭스 세로축 4유형 (표시 순서). */
export const MATRIX_TYPE_LABELS: string[] = [
  "① BPSD",
  "② 응급",
  "③ 갈등",
  "④ 위험 판단",
];

/** 매트릭스 가로축 3난이도. */
export const MATRIX_LEVEL_LABELS: { level: 1 | 2 | 3; label: string }[] = [
  { level: 1, label: "초급" },
  { level: 2, label: "중급" },
  { level: 3, label: "고급" },
];

/** 유형별 알파 편성 종수와 이연 사유 (매트릭스 표 우측 열). */
export const MATRIX_TYPE_NOTES: Record<string, string> = {
  "① BPSD": "2종 열림 (초급 감수 완료 · 중급 초안)",
  "② 응급": "1종 열림 (감수 완료)",
  "③ 갈등": "2종 열림 (중급 감수 완료 · 고급 초안)",
  "④ 위험 판단": "베타 이연 — 동작 교정 오인 위험을 알파에서 통제할 수 없어 판단·절차 훈련으로 변환 후 편성합니다.",
};

/** 특정 유형의 매트릭스 행을 난이도 순으로 돌려줍니다. */
export function getMatrixRow(typeLabel: string): MatrixCell[] {
  return SCENARIO_MATRIX.filter((cell) => cell.typeLabel === typeLabel).sort(
    (a, b) => a.level - b.level,
  );
}
