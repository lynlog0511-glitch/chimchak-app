/**
 * 자유 연습 화면이 쓰는 문구 한 자리 (`/practice` 전용).
 *
 * 모드 자체의 약속(무엇이 나가는가·무엇이 남지 않는가·왜 응급을 뺐는가)은 `src/lib/onlineFree.ts`가
 * 들고 있습니다 — 회귀 검사가 그 문장들을 직접 보기 때문입니다. 여기 있는 것은 **화면에서만**
 * 쓰는 말이고, 두 곳이 같은 뜻을 다른 문장으로 적지 않도록 서로 겹치지 않게 갈라 두었습니다.
 */

/* ── 머리말 ────────────────────────────────────────────── */

export const PRACTICE_SUBTITLE = "검수된 여섯 상황 밖에서, 판정 없이 말해 보는 자리";

/**
 * 이 모드가 상황 훈련과 어떻게 다른가 — 한 문단.
 * 「무엇이 더 좋은가」가 아니라 「무엇을 맞바꿨는가」를 적습니다.
 */
export const PRACTICE_TRADEOFF =
  "상황 훈련은 검수된 시나리오 위에서 같은 입력에 같은 판정을 냅니다. 이 연습은 그 판정을 내려놓는 대신 상황을 넓힙니다 — 여섯 종에 없는 장면을 그 자리에서 만들고, 인물이 즉흥으로 답합니다. 그래서 온라인에서만 열리고, 점수도 기록도 남기지 않습니다.";

/* ── 문 앞에서 멈추는 자리 ─────────────────────────────── */

export const GATE_OFF_TITLE = "온라인 모드가 꺼져 있습니다";
export const GATE_OFF_BODY =
  "이 연습은 상황과 대사를 그 자리에서 만들기 때문에 회선이 필요합니다. 설정에서 온라인 모드를 켜고 서버가 연결되면 열립니다. 켜지 않으셔도 상황 훈련 여섯 종은 그대로 열립니다 — 그쪽은 회선 없이 끝까지 돌아갑니다.";

export const GATE_OFFLINE_TITLE = "지금 오프라인입니다";
export const GATE_OFFLINE_BODY =
  "회선이 돌아오면 이 화면이 열립니다. 지금 하실 수 있는 연습은 상황 훈련 여섯 종이고, 응급 안내도 저장돼 있어 그대로 열립니다.";

export const GATE_UNCONFIGURED_TITLE = "서버에 연결이 준비돼 있지 않습니다";
export const GATE_UNCONFIGURED_BODY =
  "온라인 모드는 켜져 있지만, 지금 서버에 AI 연결이 준비돼 있지 않아 외부 AI로는 아무것도 전달되지 않았습니다. 침착 서버까지 갔던 요청은 저장 없이 버려졌습니다. 상황 훈련은 그대로 열립니다.";

export const GATE_TRAIN_CTA = "상황 훈련으로 가기";
export const GATE_SETTINGS_HINT = "온라인 모드는 화면 오른쪽 위 「설정」에서 켜고 끄실 수 있습니다.";

/* ── 시드 고르기 ───────────────────────────────────────── */

export const SEED_TYPE_LABEL = "어떤 상황을 연습하시겠어요?";
export const SEED_LEVEL_LABEL = "얼마나 어렵게 할까요?";
export const SEED_HINT_LABEL = "상황 만들기 (비워 두셔도 됩니다)";
export const SEED_HINT_PLACEHOLDER = "예: 목욕을 한사코 거부하십니다";
export const SEED_HINT_NOTE =
  "적어 주신 한 줄이 장면을 만드는 데 그대로 쓰입니다. 실제 어르신의 성함·기관명은 적지 말아 주십시오.";
/**
 * 시작 버튼 — 이 버튼을 누르는 것이 **동의 의사를 표시하는 행위**입니다.
 * 바로 위에 선 고지 목록(`FREE_CONSENT_LINES`)을 읽고 누르는 자리이므로, 라벨이
 * 「상황 만들기」로만 적혀 있으면 동의 없이 첫 전송이 일어나는 화면이 됩니다.
 */
export const SEED_START = "안내에 동의하고 시작";
export const SEED_MAKING = "상황을 만들고 있습니다…";

/** 상황을 못 받았을 때 — 고정 장면을 대신 세우지 않고 못 만들었다고 적습니다. */
export const SETUP_FAILED = "상황을 만들지 못했습니다. 다시 한 번 눌러 주세요.";
export const SETUP_BLOCKED =
  "만들어진 장면이 기기 안 대조에 걸려 세우지 않았습니다. 다시 한 번 눌러 주세요.";

/* ── 대화 ──────────────────────────────────────────────── */

export const SCENE_SITUATION_LABEL = "상황";
export const SCENE_PERSONA_LABEL = "등장인물";
export const SCENE_FIRST_MOVE =
  "먼저 말을 건네 보세요. 정답을 맞히는 자리가 아니라, 말이 나오게 만드는 자리입니다.";

export const COMPOSER_PLACEHOLDER = "하실 말씀을 적어 주세요…";
export const COMPOSER_SEND = "보내기";
export const COMPOSER_MIC_LABEL = "누르고 있는 동안 말하기";
export const COMPOSER_WAITING = "인물이 말을 고르고 있습니다…";
export const COMPOSER_TURNS_LEFT = (left: number) => `남은 차례 ${left}`;
export const COMPOSER_TURNS_DONE =
  "열두 차례를 다 쓰셨습니다. 「마무리하기」를 누르시면 짧은 코칭을 청해 보겠습니다.";
export const COMPOSER_FINISH = "마무리하기";

export const TTS_ON = "대사 읽어 주기 켜짐";
export const TTS_OFF = "대사 읽어 주기 꺼짐";

/** 연결이 안 되었을 때 — 지어내지 않고 못 받았다고 적습니다. */
export const REPLY_FAILED = "답이 오지 않았습니다. 잠시 뒤 다시 보내 주세요.";
export const REPLY_RATE_LIMITED =
  "서버 호출 한도에 걸렸습니다. 잠시 기다렸다가 다시 보내 주세요.";
export const REPLY_UNCONFIGURED = "서버에 AI 연결이 준비돼 있지 않아 답을 받지 못했습니다.";

/* ── ⚑CF 인터럽트 ─────────────────────────────────────── */

export const CF_TITLE = "잠깐, 여기서 멈춥니다";
export const CF_NOT_SENT = "이 말씀은 서버로 보내지 않았습니다 — 기기 안에서 멈췄습니다.";
export const CF_NO_RECORD =
  "이 연습은 채점하지 않습니다. 멈춘 사실도 판정으로 기록되지 않고, 여기서 멈춘 이유만 보여 드립니다.";
export const CF_ALTERNATIVES_LABEL = "대신 이렇게 말해 볼 수 있어요";
export const CF_ALTERNATIVE_NOTE =
  "고르시면 아래 입력창에 그대로 놓아 드립니다. 그대로 보내셔도 되고, 고쳐 쓰셔도 됩니다.";
export const CF_RETRY = "다시 써 보기";
export const CF_LAW_SUMMARY = "법 근거 보기";

/* ── 마무리 ────────────────────────────────────────────── */

export const SUMMARY_TITLE = "여기까지 해 보셨습니다";
export const SUMMARY_EYEBROW = "자유 연습 · 채점 없음";
export const SUMMARY_COACH_LABEL = "다음에 해 보실 수 있는 것";
export const SUMMARY_FAILED_NOTE =
  "근거가 확인된 문장만 화면에 올리기 때문에, 이번에는 요약을 표시하지 않았습니다.";
export const SUMMARY_AGAIN = "다른 상황으로 한 번 더";
export const SUMMARY_TO_TRAIN = "상황 훈련으로 가기";
export const SUMMARY_GONE =
  "이 대화는 여기서 사라집니다. 기기에 남는 것은 연습 횟수 하나뿐이고, 성장 기록에는 올라가지 않습니다.";
export const SUMMARY_COUNT = (count: number) => `이 기기에서 자유 연습 ${count}번째`;
