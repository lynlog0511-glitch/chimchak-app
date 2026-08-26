/**
 * 평가 루브릭 30항목 확정본 — 설계서 §4.3(행동지표·판정기·근거 문서) + §4.4(4점 척도 앵커) 전수.
 *
 * 구성: E1 상황 인지 및 분석력(SA) 8항목 · E2 절차 및 규정 준수(CO) 8항목
 *      · E3 대응 및 문제 해결력(RE) 9항목 · E4 마무리 및 피드백(CL) 5항목 = 30항목
 * 과정 19항목(63.3%) : 결과 11항목(36.7%)
 * ⚑CF 3항목(CO-01, CO-02, CO-03) — 신체 안전·법적 금지행위에만 적용하며 전부 규칙 엔진이 판정합니다.
 *
 * ※ 4점 척도는 내부 채점·훈련 이력·교차 채점 신뢰도 산출 전용입니다.
 *    화면에는 점수·등급·순위·백분위를 표시하지 않고 🟢 충족 / ⚪ 코칭 2단계와 코칭 문장,
 *    근거 출처 칩만 노출합니다.
 */

import type { RubricArea, RubricItem } from "@/types";

export const RUBRIC: RubricItem[] = [
  /* ── E1. 상황 인지 및 분석력 (Situation Awareness) — 8항목 ───────────── */
  {
    id: "SA-01",
    area: "SA",
    kind: "process",
    indicator:
      "대응을 시작하기 전에 안전 위험(이탈·낙상·기도폐쇄·화기) 유무를 확인하거나 소리 내어 언급했는가",
    judge: "both",
    docId: "DOC-GUIDE-001",
    anchors: {
      1: "위험 확인 없이 대화 시작",
      2: "대화 도중 뒤늦게 인지",
      3: "대응 전 위험 1개 확인",
      4: "위험 2개 이상 확인 + 우선순위 언급",
    },
  },
  {
    id: "SA-02",
    area: "SA",
    kind: "process",
    indicator:
      "행동의 미충족 욕구(배고픔·통증·배뇨·수면·불안) 중 1개 이상을 확인하려 질문했는가",
    judge: "llm",
    docId: "DOC-GUIDE-001",
    anchors: {
      1: "원인 탐색 없음",
      2: "1회 질문했으나 추상적",
      3: "구체적 욕구 1개 질문",
      4: "욕구 2개 이상 질문 + 확인 결과 반영",
    },
  },
  {
    id: "SA-03",
    area: "SA",
    kind: "process",
    indicator: "유발 환경 요인(조도·소음·온도·낯선 물건)을 1개 이상 확인했는가",
    judge: "llm",
    docId: "DOC-GUIDE-001",
    anchors: {
      1: "환경 언급 없음",
      2: "언급했으나 조치 없음",
      3: "요인 1개 확인",
      4: "확인 + 즉시 환경 조정",
    },
  },
  {
    id: "SA-04",
    area: "SA",
    kind: "outcome",
    indicator: "동시 발생 문제를 안전 확보 → 정서 안정 → 설득 순으로 처리했는가",
    judge: "rule",
    docId: "DOC-GUIDE-001",
    anchors: {
      1: "설득부터 시작",
      2: "순서 일부 뒤바뀜",
      3: "안전 → 정서 → 설득 준수",
      4: "순서 준수 + 판단 근거 발화",
    },
  },
  {
    id: "SA-05",
    area: "SA",
    kind: "process",
    indicator:
      "대상자 상태를 해석이 아닌 관찰어로 진술했는가 (예: \"괜찮아 보여요\"✗ / \"기침 하시고 목소리 나옵니다\"✓)",
    judge: "llm",
    docId: "DOC-GUIDE-004",
    anchors: {
      1: "상태 미진술",
      2: "해석 위주(\"괜찮아 보여요\")",
      3: "관찰어 1개 이상",
      4: "관찰어 3개 이상 + 시각 명시",
    },
  },
  {
    id: "SA-06",
    area: "SA",
    kind: "outcome",
    indicator: "응급/비응급을 60초 이내 분류하고 소리 내어 판정했는가",
    judge: "rule",
    docId: "DOC-GUIDE-004",
    anchors: {
      1: "미분류",
      2: "120초 초과",
      3: "60~120초 내 분류",
      4: "60초 이내 분류 + 근거 진술",
    },
  },
  {
    id: "SA-07",
    area: "SA",
    kind: "process",
    indicator: "혼자 처리 가능한지 / 도움을 요청해야 하는지를 명시적으로 판단했는가",
    judge: "llm",
    docId: "DOC-NOTI-002",
    anchors: {
      1: "한계 인식 없음",
      2: "모호한 도움 요청",
      3: "도움 필요 여부 명시",
      4: "명시 + 요청 대상·수단 특정",
    },
  },
  {
    id: "SA-08",
    area: "SA",
    kind: "process",
    indicator: "상대(어르신·보호자·상황실)의 핵심 요구를 요약해 되물어 확인했는가",
    judge: "llm",
    docId: "DOC-GUIDE-006",
    anchors: {
      1: "되묻지 않음",
      2: "단순 반문(\"네?\")",
      3: "요구를 요약해 재확인",
      4: "요약 재확인 + 상대 동의 획득",
    },
  },

  /* ── E2. 절차 및 규정 준수 (Compliance) — 8항목 ─────────────────────── */
  {
    id: "CO-01",
    area: "CO",
    kind: "outcome",
    indicator:
      "허용 범위 밖 행위(액체·음식 제공, 구강 내 조작, 흡인, 복부 압박, 투약 판단)를 시도하지 않았는가",
    judge: "rule",
    criticalFail: true,
    docId: "DOC-LAW-005",
    anchors: {
      1: "금지 행위 실행 ⚑",
      2: "시도했다가 철회",
      3: "금지 행위 없음",
      4: "없음 + \"이건 제가 할 수 없습니다\" 명시",
    },
  },
  {
    id: "CO-02",
    area: "CO",
    kind: "outcome",
    indicator:
      "신체 억제·물리적 제지·끌기·문 잠금 등 신체 자유 제한을 하지 않았는가",
    judge: "rule",
    criticalFail: true,
    docId: "DOC-LAW-003",
    anchors: {
      1: "억제·제지 실행 ⚑",
      2: "신체 접촉 후 철회",
      3: "억제 없음",
      4: "없음 + 동의 구한 후 손 잡기 등 대체",
    },
  },
  {
    id: "CO-03",
    area: "CO",
    kind: "outcome",
    indicator: "프로토콜상 신고 시점으로부터 90초 이내 119에 연결했는가",
    judge: "rule",
    criticalFail: true,
    docId: "DOC-GUIDE-004",
    anchors: {
      1: "미신고 ⚑",
      2: "180초 초과 신고",
      3: "90~180초 신고",
      4: "90초 이내 신고 + 주소 즉시 전달",
    },
  },
  {
    id: "CO-04",
    area: "CO",
    kind: "process",
    indicator:
      "사고·이상징후·갈등을 기관 보고 대상으로 판단하고 보고 의사를 표명했는가",
    judge: "llm",
    docId: "DOC-NOTI-002",
    anchors: {
      1: "보고 언급 없음",
      2: "\"나중에 말씀드릴게요\"",
      3: "보고 대상 판단 + 의사 표명",
      4: "표명 + 보고 시점·대상 특정",
    },
  },
  {
    id: "CO-05",
    area: "CO",
    kind: "process",
    indicator: "해당 사안이 급여제공기록지 기재 대상인지 판단했는가",
    judge: "llm",
    docId: "DOC-NOTI-002",
    anchors: {
      1: "기록 언급 없음",
      2: "기록 필요성만 인지",
      3: "기재 대상 판단",
      4: "판단 + 기재 항목 특정",
    },
  },
  {
    id: "CO-06",
    area: "CO",
    kind: "outcome",
    indicator:
      "업무 외 요구에 대해 계약·급여 범위를 근거로 설명했는가 (감정 호소 아님)",
    judge: "llm",
    docId: "DOC-GUIDE-006",
    anchors: {
      1: "근거 없이 수용/거절",
      2: "\"규정상 안 돼요\"만",
      3: "계약·급여 범위 근거 설명",
      4: "근거 설명 + 문서 위치 안내",
    },
  },
  {
    id: "CO-07",
    area: "CO",
    kind: "process",
    indicator: "반말·명령형·아동화 호칭 없이 존칭·설명·동의 절차를 지켰는가",
    judge: "both",
    docId: "DOC-LAW-003",
    anchors: {
      1: "반말·아동화 호칭 사용",
      2: "존칭이나 설명 생략",
      3: "존칭 + 행위 전 설명",
      4: "존칭 + 설명 + 동의 확인",
    },
  },
  {
    id: "CO-08",
    area: "CO",
    kind: "process",
    indicator: "제3자·타 수급자의 개인정보를 발화에 노출하지 않았는가",
    // 판정 근거는 개인정보보호법 제15조·제17조입니다. 부록 A 화이트리스트(RAG 소스) 문서가 아니므로
    // docId 를 부여하지 않고, 아래 RUBRIC_EXTRA_BASIS 에 법령명을 별도로 보관합니다.
    judge: "rule",
    anchors: {
      1: "제3자 실명·정보 노출",
      2: "간접 특정 가능 발화",
      3: "노출 없음",
      4: "없음 + 익명 표현 의식적 사용",
    },
  },

  /* ── E3. 대응 및 문제 해결력 (Response & Problem Solving) — 9항목 ───── */
  {
    id: "RE-01",
    area: "RE",
    kind: "process",
    indicator: "사실을 정정하기 전에 대상자의 정서를 언어로 인정했는가",
    judge: "both",
    docId: "DOC-GUIDE-001",
    anchors: {
      1: "정서 인정 없음",
      2: "형식적 공감어만",
      3: "정서를 언어로 인정",
      4: "인정 + 대상자 관점 재진술",
    },
  },
  {
    id: "RE-02",
    area: "RE",
    kind: "process",
    indicator:
      "현실 직면 강요(\"여기가 집이에요\", \"그런 사람 없어요\")를 하지 않았는가",
    judge: "rule",
    docId: "DOC-GUIDE-001",
    anchors: {
      1: "현실 직면 강요 2회↑",
      2: "1회",
      3: "없음",
      4: "없음 + 대상자 서사 수용",
    },
  },
  {
    id: "RE-03",
    area: "RE",
    kind: "process",
    indicator: "지시형 대신 2개 이하의 선택지를 제공했는가",
    judge: "llm",
    docId: "DOC-GUIDE-001",
    anchors: {
      1: "지시·명령형",
      2: "선택지 3개 이상 제시",
      3: "2개 이하 선택지",
      4: "2개 선택지 + 대상자 선택 존중",
    },
  },
  {
    id: "RE-04",
    area: "RE",
    kind: "process",
    indicator: "안전한 대체 행동·주의 전환으로 유도했는가",
    judge: "llm",
    docId: "DOC-GUIDE-001",
    anchors: {
      1: "전환 시도 없음",
      2: "시도했으나 부자연",
      3: "대체 행동 제시",
      4: "제시 + 대상자 관심사 반영",
    },
  },
  {
    id: "RE-05",
    area: "RE",
    kind: "outcome",
    indicator:
      "거절 시 3단 화법(공감 → 불가 사유 → 대안) 세 요소를 모두 사용했는가",
    judge: "llm",
    docId: "DOC-GUIDE-006",
    anchors: {
      1: "3요소 0~1개",
      2: "2개",
      3: "3요소 모두",
      4: "3요소 + 대안이 실행 가능",
    },
  },
  {
    id: "RE-06",
    area: "RE",
    kind: "process",
    indicator:
      "폭언에 감정적으로 맞대응하지 않고 중단 요청 → 거리 확보 → 보고로 이동했는가",
    judge: "both",
    docId: "DOC-LAW-007",
    anchors: {
      1: "맞대응·언성 상승",
      2: "사과만 반복",
      3: "중단 요청 or 거리 확보",
      4: "중단 요청 + 거리 확보 + 보고 이동",
    },
  },
  {
    id: "RE-07",
    area: "RE",
    kind: "outcome",
    indicator: "돌발 변수 발생 시 기존 대응을 수정했는가 (동일 발화 반복 여부로 판정)",
    judge: "rule",
    docId: "DOC-GUIDE-001",
    anchors: {
      1: "동일 발화 반복",
      2: "소극적 수정",
      3: "대응 방식 변경",
      4: "변경 + 변경 이유 진술",
    },
  },
  {
    id: "RE-08",
    area: "RE",
    kind: "process",
    indicator:
      "짧은 문장·낮은 톤·1문장 1정보 원칙을 지켰는가 (문장당 25자 이하, 정보 1개)",
    judge: "rule",
    docId: "DOC-GUIDE-001",
    anchors: {
      1: "장문·고음량",
      2: "일부 준수",
      3: "문장 25자 이하 유지",
      4: "유지 + 발화 사이 대기(pause) 확보",
    },
  },
  {
    id: "RE-09",
    area: "RE",
    kind: "outcome",
    indicator: "종료 시점에 대상자 안전이 확보된 상태였는가",
    judge: "rule",
    docId: "DOC-GUIDE-001",
    anchors: {
      1: "안전 미확보 종료",
      2: "불안정 상태 종료",
      3: "안전 확보",
      4: "확보 + 재발 위험 요인 제거",
    },
  },

  /* ── E4. 마무리 및 피드백 (Closure) — 5항목 ─────────────────────────── */
  {
    id: "CL-01",
    area: "CL",
    kind: "outcome",
    /* 2026-08-26 — 지표를 **실제 판정 기준**과 같은 말로 고쳤습니다(교육생 5차 med).
       예전 지표는 「보고에 5요소(누가·언제·무엇을·어떻게·현재상태)를 모두 포함했는가」였고,
       앵커 4점은 「5개 전부」였습니다. 그런데 이 항목이 4점으로 적립되는 자리(A01 CUE-4·
       A02 CUE-5의 요소 판정)의 채택선은 **3요소**입니다. 판정 접힘의 첫 줄이 이 지표 원문을
       그대로 옮겨 적으므로, 한 화면에 「5요소를 모두 포함하기」(기준) · 「3가지가 담겨 있어
       갈렸습니다」(경위) · 초록 「충족」(판정)이 나란히 섰습니다. 시각을 한 마디도 말하지
       않고 충족을 받는 경험을 하면 현장에서 시각을 빠뜨립니다.
       기록지 5요소를 가르친다는 목표는 그대로 두되, **몇 개를 채웠는지가 아니라 사실을
       그대로 남겼는지**를 재는 말로 적습니다(갈래 이름 「사실 중심 보고」와 같은 결).
       앵커는 담긴 요소 수를 그대로 적어, 어느 눈금에서 어떤 판정이 나오는지 숨기지 않습니다. */
    indicator:
      "기록지에 옮길 수 있게 보고했는가 (누가·언제·무엇을·어떻게·현재상태 중 담긴 것이 많을수록 좋습니다)",
    judge: "llm",
    docId: "DOC-NOTI-002",
    anchors: {
      1: "보고하지 않았거나 담긴 것이 없음",
      2: "일부만 담김 (부분 보고)",
      3: "대체로 담김",
      4: "이 장면이 재는 요소를 갖춰 담음",
    },
  },
  {
    id: "CL-02",
    area: "CL",
    kind: "process",
    indicator: "관찰 사실과 추정·감정을 구분해 진술했는가 (감정 형용사 미사용)",
    judge: "llm",
    docId: "DOC-NOTI-002",
    anchors: {
      1: "감정 형용사 위주",
      2: "사실·추정 혼재",
      3: "구분해 진술",
      4: "구분 + \"확인되지 않음\" 명시",
    },
  },
  {
    id: "CL-03",
    area: "CL",
    kind: "outcome",
    indicator: "기록 초안에 시각·행동·조치·결과가 누락 없이 기재되었는가",
    judge: "rule",
    docId: "DOC-NOTI-002",
    anchors: {
      1: "슬롯 충족 50% 미만",
      2: "50~74%",
      3: "75~99%",
      4: "100%",
    },
  },
  {
    id: "CL-04",
    area: "CL",
    kind: "process",
    indicator: "재발 방지책을 1건 이상 구체적으로 제안했는가",
    judge: "llm",
    docId: "DOC-GUIDE-001",
    anchors: {
      1: "제안 없음",
      2: "추상적 제안",
      3: "구체적 제안 1건",
      4: "2건 이상 + 실행 주체 특정",
    },
  },
  {
    id: "CL-05",
    area: "CL",
    kind: "process",
    indicator: "종료 후 스스로 개선점 1개를 언어화했는가",
    // 자기 성찰 항목 — 대응하는 근거 문서가 없습니다.
    judge: "llm",
    anchors: {
      1: "성찰 없음",
      2: "\"잘 못했어요\" 수준",
      3: "개선점 1개 언어화",
      4: "개선점 + 다음 행동 계획",
    },
  },
];

/* ── 부가 상수 (설계서 §4.1·§4.5·§4.6·§5.2) ──────────────────────────── */

/** 화이트리스트 문서로 등재하지 않는 판정 근거 법령. (SourceChip 대상 아님) */
export const RUBRIC_EXTRA_BASIS: Record<string, string> = {
  "CO-08": "개인정보보호법 제15조·제17조",
};

/** ⚑CF 3항목 — 신체 안전·법적 금지행위에만 적용하며 1건이라도 발생하면 종합판정 '재훈련' 고정. */
export const CRITICAL_FAIL_ITEM_IDS: string[] = ["CO-01", "CO-02", "CO-03"];

/**
 * §5.2 판정기 분담 — 규칙 엔진 12항목 (450ms 예산 내 판정).
 * ⚑CF 3항목이 전부 규칙 엔진에 배치된 것은 의도적입니다. 치명적 판정은 언어모델에 맡기지 않습니다.
 *
 * ⚠ 이 12/18은 **공동 판정 4항목(judge: "both")을 어느 쪽에 세었는가**에 따른 실행
 * 배정표입니다. 기획서의 판정 주체 구분(15/11/4)과는 **축이 다릅니다** — 항목별 주체는
 * RUBRIC 각 항목의 `judge` 필드가 정본이고(그 셈이 기획서와 일치함을 확인했습니다),
 * 이 배열은 그 위에서 공동 항목을 실행 주체로 갈라 담은 결과입니다.
 * 공동 4항목은 SA-01·RE-01·RE-06·CO-07이며, CO-07만 규칙 쪽(11 + 1 = 12),
 * 나머지 셋은 LLM 쪽(15 + 3 = 18)으로 세었습니다.
 * 두 표를 한 문장에 섞어 적으면 숫자가 서로를 반박하므로, 화면은 어느 축인지 밝히고 씁니다.
 */
export const RULE_JUDGED_ITEM_IDS: string[] = [
  "RE-02",
  "RE-08",
  "CO-01",
  "CO-02",
  "CO-03",
  "CO-07",
  "CO-08",
  "SA-04",
  "SA-06",
  "RE-07",
  "RE-09",
  "CL-03",
];

/**
 * §5.2 판정기 분담 — 경량 LLM(교체형 어댑터) 판정기 18항목.
 * 위 RULE_JUDGED_ITEM_IDS와 같은 축의 **실행 배정표**입니다(기획서의 15/11/4와 다른 축 —
 * 공동 판정 4항목 중 SA-01·RE-01·RE-06을 여기에 세었습니다).
 */
export const LLM_JUDGED_ITEM_IDS: string[] = [
  "SA-01",
  "SA-02",
  "SA-03",
  "SA-05",
  "SA-07",
  "SA-08",
  "CO-04",
  "CO-05",
  "CO-06",
  "RE-01",
  "RE-03",
  "RE-04",
  "RE-05",
  "RE-06",
  "CL-01",
  "CL-02",
  "CL-04",
  "CL-05",
];

/** 4대 영역 한글 표기. */
export const AREA_LABELS: Record<RubricArea, string> = {
  SA: "상황 인지 및 분석력",
  CO: "절차 및 규정 준수",
  RE: "대응 및 문제 해결력",
  CL: "마무리 및 피드백",
};

/** §4.5 시나리오별 영역 가중치(%). 내부 산식 전용이며 화면에 표시하지 않습니다. */
export const AREA_WEIGHTS: Record<string, Record<RubricArea, number>> = {
  "CHK-A01": { SA: 25, CO: 25, RE: 35, CL: 15 },
  "CHK-B02": { SA: 30, CO: 35, RE: 15, CL: 20 },
  "CHK-C01": { SA: 10, CO: 30, RE: 40, CL: 20 },
  // 신작 2종(알파 초안)은 소속 유형의 가중치를 그대로 씁니다 — 런타임 산식도 유형 기준입니다.
  "CHK-A02": { SA: 25, CO: 25, RE: 35, CL: 15 },
  "CHK-C02": { SA: 10, CO: 30, RE: 40, CL: 20 },
};

/**
 * §4.6 종합 판정 산식의 임계값. 내부 전용입니다.
 * 정규화점수 = Σ(항목점수 × 영역가중치) ÷ (4 × Σ영역가중치) × 100
 * 1) ⚑CF 1건 이상 → 재훈련 (점수 무관)
 * 2) 재훈련 권고 조건 해당 → 재훈련 권고
 * 3) 85 이상 → 우수 / 4) 70~84 → 충족 / 5) 50~69 → 부분 충족 / 6) 50 미만 → 재시도 권장
 */
export const VERDICT_THRESHOLDS = {
  excellent: 85,
  met: 70,
  partial: 50,
} as const;

/** 4점 척도 공통 정의 (내부 전용 — 화면에는 점수를 표시하지 않습니다). */
export const SCALE_DEFINITIONS: { score: 1 | 2 | 3 | 4; name: string; meaning: string; display: string }[] = [
  {
    score: 4,
    name: "우수",
    meaning: "기대 행동을 수행했고, 왜 그렇게 했는지의 근거·순서까지 드러났습니다.",
    display: "🟢 충족 + 강화 문구",
  },
  { score: 3, name: "충족", meaning: "기대 행동을 수행했습니다.", display: "🟢 충족" },
  {
    score: 2,
    name: "부분",
    meaning: "시도했으나 시점이 늦거나 내용이 불완전합니다.",
    display: "⚪ 코칭 문장 1개",
  },
  {
    score: 1,
    name: "미흡",
    meaning: "수행하지 않았거나 반대 방향으로 행동했습니다.",
    display: "⚪ 코칭 문장 1개 + 근거 출처 칩",
  },
];

/** itemId 로 루브릭 항목을 찾습니다. */
export function getRubricItem(itemId: string): RubricItem | undefined {
  return RUBRIC.find((item) => item.id === itemId);
}

/** 영역별 루브릭 항목을 돌려줍니다. */
export function getRubricByArea(area: RubricArea): RubricItem[] {
  return RUBRIC.filter((item) => item.area === area);
}

/** 3점 이상이면 🟢 충족, 2점 이하면 ⚪ 코칭입니다. (화면 표시 2단계 변환) */
export function isMet(score: 1 | 2 | 3 | 4): boolean {
  return score >= 3;
}
