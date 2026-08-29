/**
 * 검증 계단 ①~④ — 설계 문서 표1의 네 계단을 화면이 그대로 인용하는 자리입니다.
 *
 * 규칙 하나: **숫자를 지어내지 않습니다.**
 *  - ① 은 이 기기에서 버튼 한 번으로 다시 돌릴 수 있는 실행입니다(경계 케이스가 저장소에 있습니다).
 *  - ②·③ 은 앱 **밖** 하네스에서 잰 기록을 옮겨 적은 값입니다 — 이 화면에서 잰 값이 아닙니다.
 *  - ④ 는 아직 재지 않았습니다. 결과 칸에는 상태와 「무엇을 미리 정해 두었는지」만 적고,
 *    추정치·목표치는 한 칸도 넣지 않습니다.
 *
 * 어디서 잰 값인지는 `origin`이 들고 있고, 화면은 그 값에 따라 문장을 다르게 답니다 —
 * 「지금 잰 값」과 「옮겨 적은 값」이 같은 말투로 섞이면 계단 전체가 인용문이 되어 버립니다.
 */

/** 계단 하나의 상태 — 실측이 끝났는지, 아직 진행 중인지. */
export type LadderState = "measured" | "running";

/**
 * 값의 출처.
 * - `in-app` 이 기기에서 다시 실행할 수 있습니다.
 * - `external` 앱 밖 하네스 실행 기록을 옮겨 적었습니다.
 * - `not-yet` 아직 재지 않았습니다(계획 표기를 답니다).
 */
export type LadderOrigin = "in-app" | "external" | "not-yet";

export interface LadderStep {
  /** 계단 번호 — 설계 문서 표1 표기 그대로 */
  no: string;
  /** 앵커·슬롯 식별자 */
  id: string;
  /** 계단 이름 */
  title: string;
  /** 무엇을 가정했는가 */
  hypothesis: string;
  /** 검증 결과 — 재지 않은 계단에는 상태만 적습니다 */
  result: string;
  origin: LadderOrigin;
  /** 실측 일자 — 재지 않았으면 없습니다 */
  measuredAt?: string;
  /** 남은 과제 */
  remaining: string;
  state: LadderState;
}

/** 출처별로 화면이 붙이는 한 줄 — 문장을 데이터 쪽에 두어 화면마다 갈리지 않게 합니다. */
export const LADDER_ORIGIN_NOTE: Record<LadderOrigin, string> = {
  "in-app": "이 기기에서 같은 케이스를 지금 다시 돌려 보실 수 있습니다.",
  external: "앱 밖 하네스 실행 기록을 옮겨 적은 값입니다 — 이 화면에서 잰 값이 아닙니다.",
  "not-yet": "아직 재지 않았습니다. 잴 항목만 미리 적어 두었습니다.",
};

export const VERIFICATION_LADDER: readonly LadderStep[] = [
  {
    no: "①",
    id: "rules",
    title: "안전은 규칙으로",
    hypothesis:
      "안전 직결 항목을 확률 모델에서 떼어 내 결정론 규칙으로 판정해도 같은 입력에 같은 판정이 나옵니다.",
    result: "경계 케이스 전수 통과 · 판정 지연은 밀리초 단위였습니다.",
    origin: "in-app",
    measuredAt: "2026. 7. 27.",
    /* 이 줄만 상수 숫자를 들고 있었습니다 — 바로 위 버튼이 「지금 이 브라우저에서 380건
       돌려보기」인데 여기만 「100건을 넘겼습니다」라, 심사위원이 380과 100을 나란히 보고
       「둘 중 어느 게 맞나」를 잠깐 계산해야 했습니다(이 화면에서 유일하게 안 써도 될 인지 비용).
       숫자를 새로 박는 대신 **세는 자리를 가리킵니다** — 재실행 칸이 그 자리에서 실제로 셉니다. */
    remaining:
      "경계 케이스는 그 뒤로 계속 늘어, 정확한 수는 위 재실행 칸이 그 자리에서 셉니다. 파일럿 실사례로 계속 보강합니다.",
    state: "measured",
  },
  {
    no: "②",
    id: "guard",
    title: "근거는 가드로",
    hypothesis:
      "경량 LLM이 내놓은 인용을 허용된 공식 문서 목록과 대조해 내보내기 전에 확인하면, 목록 밖 인용을 구조적으로 막을 수 있습니다.",
    result:
      "같은 모델·같은 50문항을 두 조건으로 재어, 목록 밖 인용이 72%에서 0%로 내려갔습니다. 대가는 검증 형식을 맞추지 못해 폐기된 1건이었습니다.",
    origin: "external",
    measuredAt: "2026. 8. 8.",
    remaining: "문항을 100개로 늘리고, 현직 감수로 교차검증합니다.",
    state: "measured",
  },
  {
    no: "③",
    id: "dialect",
    title: "현장 언어까지",
    hypothesis: "사투리가 섞인 입력에서도 판정과 근거 구조가 똑같이 움직입니다.",
    result:
      "위 50문항 안에 경상·전라 사투리 10문항을 넣어 확인했습니다 — 글자로 입력한 문장 기준이며, 근거 가드는 동일하게 작동했습니다.",
    origin: "external",
    measuredAt: "2026. 8. 8.",
    remaining: "소음·사투리가 섞인 실제 발화의 음성 인식은 아직 재지 않았습니다.",
    state: "measured",
  },
  {
    no: "④",
    id: "pilot",
    title: "효과는 사람에게",
    hypothesis: "훈련을 하고 나면 같은 상황에서의 대응이 실제로 달라집니다.",
    result:
      "8월 파일럿이 진행 중입니다. 1차 결과는 확보되는 대로 이 자리에 게시합니다 — 지금은 잴 항목만 미리 정해 두었습니다. 사후 측정은 훈련에 쓰지 않은 홀드아웃 시나리오 1종으로 하고, 단일군 사전-사후 비교라 성숙·검사 효과를 배제할 수 없다는 한계도 결과와 같은 자리에 적습니다.",
    origin: "not-yet",
    remaining: "현직 교차 채점과 1차 결과 집계가 남아 있습니다.",
    state: "running",
  },
];

/**
 * ④ 파일럿에서 잴 항목 — **측정 전에** 정해 둔 목록입니다.
 * 결과를 보고 유리한 지표를 고르는 일이 없도록, 항목을 먼저 적어 화면에 걸어 둡니다.
 *
 * 같은 결로 미리 정해 두는 설계가 하나 더 있습니다: **사후 측정은 훈련에 쓰지 않은 홀드아웃
 * 시나리오 1종으로 합니다** — 같은 문항을 다시 내면 「대본을 외웠다」와 「대응이 달라졌다」를
 * 가를 수 없어, 훈련한 문항으로 재는 사전-사후는 그 자체가 순환논증입니다.
 */
export const PILOT_PREREGISTERED: readonly { t: string; d: string }[] = [
  {
    t: "대응 행동 변화",
    d: "같은 상황에서 무엇을 먼저 확인하고 무엇을 말하는지를 훈련 전후로 비교합니다.",
  },
  {
    t: "현직 교차 채점",
    d: "같은 응답을 현직 요양보호사가 따로 채점해, 앱의 판정과 얼마나 어긋나는지 봅니다.",
  },
];

/** ④ 파일럿의 범위 — 기관 화면(`/for-orgs`)에 적어 둔 제안과 같은 값입니다. */
export const PILOT_SCOPE = "한 기관 한 팀(요양보호사 25명 안팎) · 기본 제안 4주";

/**
 * ② 근거 가드 실측의 조건표 — 설계 문서 각주의 원값을 그대로 옮깁니다.
 *
 * 「목록 밖 인용」은 존재하지 않는 문서·인용이 허용되지 않은 자료·출처 표기가 없는 경우를
 * 함께 셉니다. 이 표의 숫자는 **전부 옮겨 적은 값**이며, 이 화면에서 잰 값이 아닙니다.
 */
export interface GuardBenchmarkRow {
  condition: string;
  judged: string;
  /** 허용 목록 밖 인용 비율 — 0이어야 하는 칸입니다 */
  outside: string;
  /** 정답 근거를 고른 비율 */
  correct: string;
  /** 검증할 수 없어 폐기된 응답 */
  blocked: string;
}

export const GUARD_BENCHMARK: {
  measuredAt: string;
  questionCount: number;
  composition: string;
  rows: readonly GuardBenchmarkRow[];
  limit: string;
} = {
  measuredAt: "2026. 8. 8.",
  questionCount: 50,
  composition: "루브릭 30항목에서 항목당 1문항 + 사투리 변형 10 + 부정형 변형 10",
  rows: [
    {
      condition: "경량 LLM 단독",
      judged: "50문항",
      outside: "72%",
      correct: "6%",
      blocked: "없음 — 차단 장치가 없습니다",
    },
    {
      condition: "같은 모델 + 근거 가드",
      judged: "통과 49문항",
      outside: "0%",
      correct: "57%",
      blocked: "1건",
    },
  ],
  limit:
    "가드가 보장하는 것은 인용한 문서가 실재하고 허용 목록 안이라는 사실까지입니다. 목록 안에서 인접한 다른 공식 문서를 고른 43%는 남은 과제로 그대로 적어 둡니다.",
};
