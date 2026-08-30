/**
 * 자유 연습 화면이 쓰는 문구 한 자리 (`/practice` 전용).
 *
 * 모드 자체의 약속(무엇이 나가는가·무엇이 남지 않는가·왜 응급을 뺐는가)은 `src/lib/onlineFree.ts`가
 * 들고 있습니다 — 회귀 검사가 그 문장들을 직접 보기 때문입니다. 여기 있는 것은 **화면에서만**
 * 쓰는 말이고, 두 곳이 같은 뜻을 다른 문장으로 적지 않도록 서로 겹치지 않게 갈라 두었습니다.
 */

import { ONLINE_MODE_SHORT_LABEL } from "@/lib/settings";
// 열린 시나리오 수는 데이터에서 셉니다 — 7종이 열리던 날(2026-08-30) 이 화면만 「여섯」으로
// 손에 적혀 있던 것을 고친 자리입니다. 무게 없는 id 목록만 가져옵니다.
import { SCENARIO_IDS } from "@/data/scenarioIds";

/** 이 화면의 문체(한글 수사)로 세는 종수 — 12종 설계 상한까지의 수사만 압니다. */
const KOREAN_COUNT = ["", "한", "두", "세", "네", "다섯", "여섯", "일곱", "여덟", "아홉", "열", "열한", "열두"] as const;
const COUNT_KO = KOREAN_COUNT[SCENARIO_IDS.length] ?? String(SCENARIO_IDS.length);

/* ── 머리말 ────────────────────────────────────────────── */

export const PRACTICE_SUBTITLE = `검수된 ${COUNT_KO} 상황 밖에서, 판정 없이 말해 보는 자리`;

/**
 * 이 모드가 상황 훈련과 어떻게 다른가 — 한 문단.
 * 「무엇이 더 좋은가」가 아니라 「무엇을 맞바꿨는가」를 적습니다.
 */
export const PRACTICE_TRADEOFF =
  `상황 훈련은 검수된 시나리오 위에서 같은 입력에 같은 판정을 냅니다. 이 연습은 그 판정을 내려놓는 대신 상황을 넓힙니다. ${COUNT_KO} 종에 없는 장면을 그 자리에서 만들고, 인물이 즉흥으로 답합니다. 그래서 온라인에서만 열리고, 점수도 기록도 남기지 않습니다.`;

/* ── 문 앞에서 멈추는 자리 ─────────────────────────────── */

/* 문 앞의 낱말은 **설정에 적힌 낱말과 같아야** 합니다. 2026-08-28에 스위치가 둘로 갈리면서
   설정의 이름이 「온라인 모드」에서 「AI 코칭·자유 연습 — 하신 말씀이…」로 바뀌었고, 이 화면이
   옛 이름으로 안내하면 켜러 간 분이 그 이름의 항목을 찾지 못합니다. 뜻도 같이 좁힙니다 —
   이 문이 기다리는 것은 회선이 아니라 **발화 전송 동의**입니다.

   낫표 안은 이제 **상수를 그대로 끼웁니다**(`ONLINE_MODE_SHORT_LABEL`). 손으로 적어 두었을
   때는 낫표가 축자 인용을 뜻하는데도 상수 어디에도 없는 문자열을 인용하고 있었습니다
   — 설정의 전체 이름은 뒤에 성질을 적는 절이 붙어 있어 그 앞머리만 떼어 인용하던 자리입니다
   (15차 copy low). 이제 앞머리가 상수이고 전체 이름이 그것을 품으므로 갈라질 길이 없습니다. */

export const GATE_OFF_TITLE = "하신 말씀을 보내는 설정이 꺼져 있습니다";
export const GATE_OFF_BODY =
  `이 연습은 하신 말씀이 기기 밖으로 나가기 때문에, 설정에서 「${ONLINE_MODE_SHORT_LABEL}」을 켜셔야 열립니다. 켜지 않으셔도 상황 훈련 ${COUNT_KO} 종은 그대로 열리고, 회선 없이 끝까지 돌아갑니다.`;

export const GATE_OFFLINE_TITLE = "지금 오프라인입니다";
export const GATE_OFFLINE_BODY =
  `회선이 돌아오면 이 화면이 열립니다. 지금 하실 수 있는 연습은 상황 훈련 ${COUNT_KO} 종이고, 응급 안내도 저장돼 있어 그대로 열립니다.`;

export const GATE_UNCONFIGURED_TITLE = "서버에 연결이 준비돼 있지 않습니다";
export const GATE_UNCONFIGURED_BODY =
  "설정은 켜져 있지만 지금 서버에 AI 연결이 없습니다. 외부 AI로 나간 것은 없고, 침착 서버까지 갔던 요청은 저장 없이 버려졌습니다. 상황 훈련은 그대로 열립니다.";

export const GATE_TRAIN_CTA = "상황 훈련으로 가기";
/**
 * 오프라인·미설정처럼 **지금 켠다고 열리지 않는** 자리에서 쓰는 안내입니다.
 * 이 문장이 가리키는 「오른쪽 위 설정」은 실제로 이 화면 상단에 있습니다
 * (`app/practice/page.tsx`의 ScreenHeader action) — 예전에는 없는 컨트롤을 가리켰습니다.
 */
export const GATE_SETTINGS_HINT =
  `이 설정은 화면 오른쪽 위 「설정」의 「${ONLINE_MODE_SHORT_LABEL}」에서 켜고 끄실 수 있습니다.`;

/** 꺼져 있어서 막힌 자리 — 여기서 바로 켜실 수 있습니다. */
export const GATE_ENABLE_HINT =
  "아래 버튼으로 지금 켜실 수 있습니다. 화면 오른쪽 위 「설정」에서 언제든 다시 끄실 수 있습니다.";
export const GATE_ENABLE_CTA = "안내에 동의하고 켜기";

/* ── 시드 고르기 ───────────────────────────────────────── */

export const SEED_TYPE_LABEL = "어떤 상황을 연습하시겠어요?";
export const SEED_LEVEL_LABEL = "얼마나 어렵게 할까요?";

/**
 * 어르신 인지 단계 — 「치매 행동」을 고르셨을 때만 서는 칸입니다.
 *
 * 라벨이 질문 꼴이 아닌 이유가 있습니다. 위 둘은 연습을 어떻게 할지 묻는 말이고, 이 칸은
 * **인물의 설정값**입니다 — 「어느 단계로 하시겠어요?」로 물으면 사람의 상태를 고르는 화면처럼
 * 읽히는데, 여기서 정하는 것은 만들어진 가상 인물의 말투 하나입니다.
 *
 * 단계 서술 자체(초기·중기·말기가 어떤 말투인가)는 여기 두지 않습니다 — `onlineFree.ts`의
 * `FREE_COGNITION_STAGES`가 들고 있고, 화면과 연기 규칙이 그 한 원문을 함께 봅니다.
 */
export const SEED_STAGE_LABEL = "어르신 인지 단계";

/**
 * 출처 한 줄 — 이 설정이 현장 제언에서 왔다는 사실은 이 화면의 강점이라 그대로 둡니다.
 * 감수 상태(단계 서술 3종 · 첫 현직 감수 전)는 화면이 아니라 /safety 감수 원장이 말합니다 —
 * 2026-08-30 밤 팀장 결정(표면/깊이 분리)으로 이 문장에서 상태 문구를 뺐습니다. 상태의
 * 원천 기록은 원장 행과 문답카드 E절 35번에 그대로 있습니다.
 */
export const SEED_STAGE_NOTE = "현장 인터뷰 제언을 반영해 더한 설정입니다.";
export const SEED_HINT_LABEL = "상황 만들기 (비워 두셔도 됩니다)";
export const SEED_HINT_PLACEHOLDER = "예: 목욕을 한사코 거부하십니다";
export const SEED_HINT_NOTE =
  "적어 주신 한 줄이 장면을 만드는 데 그대로 쓰입니다. 실제 어르신의 성함·기관명은 적지 마세요.";

/* ── 시작 상황 프리셋 ──────────────────────────────────── */

/**
 * 고르시면 위 「상황 만들기」 칸이 그 한 줄로 채워집니다. 그게 전부입니다 —
 * 유형·난이도·인지 단계는 고르신 그대로이고, 채우고 나서 고쳐 쓰셔도 됩니다.
 *
 * 세 줄 모두 2026년 8월 현장 인터뷰에서 실제로 나온 장면입니다. 다만 옮겨 온 것은
 * **상황의 꼴뿐**이고, 누가 어디서 겪었는지는 한 자도 담기지 않았습니다 — 인터뷰에 나온
 * 성함·기관·지역·시점은 어느 줄에도 없습니다. 세 줄이 이 자리에 선 이유는 현직 네 분이
 * 같은 세 장면을 각자 따로 꺼내 놓으셨기 때문입니다.
 *
 * **2026-08-30 — ①을 검수 훈련 C01과 겹치지 않는 장면으로 바꿨습니다**(적대 검증 L2).
 * 이 화면의 부제는 「검수된 N 상황 **밖**」인데, ①의 지문(「어르신이 반찬을 새로 해 달라고」)이
 * C01 「온 김에 반찬 좀」과 같은 소재라 부제가 첫 보기에서 곧바로 어긋났습니다. 같은 인터뷰
 * 구간에서 **C01이 다루지 않는 장면**을 대신 세웠습니다 — 김장을 하자며 배추를 사다 두시고,
 * 요구가 집 밖 식구(시집간 따님) 몫까지 넓어지는 자리입니다. C01은 보호자가 부엌에서 요구하고
 * 폭언·호칭 격하로 번지는 회차라, 요구하는 사람도 번지는 방향도 다릅니다.
 * ③(「거절이 입에서 안 나올 때」)은 그대로 둡니다 — 소재가 아니라 **말이 안 나오는 상태**를
 * 적은 줄이고, 그 상태는 어느 상황에서나 옵니다. 대신 겹침을 숨기지 않고 캡션 아래 한 줄로
 * 밝힙니다(`SEED_PRESET_OVERLAP_NOTE`).
 */
export const SEED_PRESET_LABEL = "현장에서 온 상황";
export const SEED_PRESET_NOTE = "2026년 8월 현장 인터뷰에서 나온 상황입니다.";

/**
 * 부제(「검수된 N 상황 밖」)와 프리셋 사이의 긴장을 숨기지 않고 적는 한 줄입니다.
 * 겹치는 주제를 아예 빼는 쪽도 있었지만, 그러면 현직이 가장 자주 꺼내 놓으신 장면이
 * 이 화면에서만 사라집니다. 겹친다는 사실을 적고, 무엇이 다른지를 함께 적습니다.
 */
export const SEED_PRESET_OVERLAP_NOTE =
  "검수 훈련(갈등 상황)과 겹치는 주제는 판정 없이 자유롭게 넓혀 보는 용도입니다.";

export const SEED_PRESETS: ReadonlyArray<{ id: string; label: string; hint: string }> = [
  {
    id: "chores",
    label: "요구가 식구 몫까지 늘어날 때",
    hint: "어르신이 김장을 하자며 배추를 사다 두셨습니다. 오늘 할 일은 따로 있는데, 시집간 따님 몫까지 해 놓으라고 하십니다.",
  },
  {
    id: "family",
    label: "가족 일까지 부탁하는 보호자",
    hint: "보호자가 어르신 일이 아닌 가족 식사와 빨래까지 부탁하십니다.",
  },
  {
    id: "refusal",
    label: "거절이 입에서 안 나올 때",
    hint: "해 드릴 수 없는 일인 줄 알면서도 거절하는 말이 입에서 나오지 않습니다.",
  },
];
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
  "만들어진 장면이 기기 안 대조에 걸려 쓰지 않았습니다. 다시 한 번 눌러 주세요.";

/* ── 대화 ──────────────────────────────────────────────── */

export const SCENE_SITUATION_LABEL = "상황";
export const SCENE_PERSONA_LABEL = "등장인물";
export const SCENE_FIRST_MOVE =
  "먼저 말을 건네 보세요. 정답을 맞히지 않아도 돼요. 말이 나오면 돼요.";

export const COMPOSER_PLACEHOLDER = "하실 말씀을 적어 주세요…";
export const COMPOSER_SEND = "보내기";
export const COMPOSER_MIC_LABEL = "누르고 있는 동안 말하기";
export const COMPOSER_WAITING = "인물이 말을 고르고 있습니다…";
export const COMPOSER_TURNS_LEFT = (left: number) => `남은 차례 ${left}`;
export const COMPOSER_TURNS_DONE =
  "열두 차례를 다 쓰셨습니다. 「마무리하기」를 누르시면 짧은 코칭을 받아 보실 수 있습니다.";
export const COMPOSER_FINISH = "마무리하기";

export const TTS_ON = "대사 읽어 주기 켜짐";
export const TTS_OFF = "대사 읽어 주기 꺼짐";

/** 연결이 안 되었을 때 — 지어내지 않고 못 받았다고 적습니다. */
export const REPLY_FAILED = "답이 오지 않았습니다. 잠시 뒤 다시 보내 주세요.";
/**
 * 한도에 걸린 자리 — **「잠시」라고 말하지 않습니다** (2026-08-27).
 *
 * 서버는 원인 넷을 한 상태로 뭉쳐 돌려줍니다: IP당 분당(1분 뒤 풀림) · IP당 일당 · 배포 전체
 * 일당 · 무표식 작은 통. **넷 중 셋은 그날 안에 풀리지 않습니다.** 그래서 「잠시 기다렸다가
 * 다시 보내 주세요」는 원인 셋에서 거짓이고, 그 말을 믿은 분은 1분마다 다시 눌러 보다가
 * 연습을 놓칩니다(7차 페르소나 백엔드 low).
 *
 * 6차가 /check에서 정확히 이 종류를 고쳤습니다 — 「새로고침으로는 풀리지 않습니다(같은 인터넷을
 * 쓰는 기기들이 분당 몫을 나눠 씁니다)」. 그 정직함을 이 화면에도 같은 결로 옮깁니다:
 * 풀릴 수 있는 갈래(1분)와 아닌 갈래(오늘 몫)를 **함께 열어 두고**, 아니었을 때 할 수 있는 일을
 * 한 가지 답니다. 서버 계약(`{ status: "rate_limited" }` 한 칸)은 늘리지 않습니다 —
 * 원인을 실어 보내려면 어느 한도에 걸렸는지를 밖으로 알리는 셈이 됩니다.
 */
export const REPLY_RATE_LIMITED =
  "지금 이 회선에서 요청이 몰렸거나 오늘 몫을 다 썼습니다. 1분 뒤에 다시 보내 보시고, 그래도 같으면 오늘은 상황 훈련으로 이어 가 주세요 — 새로고침으로는 풀리지 않습니다.";
export const REPLY_UNCONFIGURED = "서버에 AI 연결이 준비돼 있지 않아 답을 받지 못했습니다.";

/* ── ⚑CF 인터럽트 ─────────────────────────────────────── */

export const CF_TITLE = "잠깐, 여기서 멈춥니다";
export const CF_NOT_SENT = "이 말씀은 서버로 보내지 않았습니다. 기기 안에서 멈췄습니다.";
export const CF_NO_RECORD =
  "이 연습은 채점하지 않습니다. 멈춘 사실도 판정으로 기록되지 않고, 여기서 멈춘 이유만 보여 드립니다.";
export const CF_ALTERNATIVES_LABEL = "대신 이렇게 말해 볼 수 있어요";
export const CF_ALTERNATIVE_NOTE =
  "고르시면 아래 입력창에 넣어 드립니다. 그대로 보내셔도 되고, 고쳐 쓰셔도 됩니다.";
export const CF_RETRY = "다시 써 보기";
export const CF_LAW_SUMMARY = "법 근거 보기";

/* ── 마무리 ────────────────────────────────────────────── */

export const SUMMARY_TITLE = "여기까지 해 보셨습니다";
export const SUMMARY_EYEBROW = "자유 연습 · 채점 없음";
export const SUMMARY_COACH_LABEL = "다음에 해 보실 수 있는 것";
export const SUMMARY_FAILED_NOTE =
  "이번에는 요약을 표시하지 않았습니다. 근거가 확인된 문장만 화면에 올립니다.";
export const SUMMARY_AGAIN = "다른 상황으로 한 번 더";
export const SUMMARY_TO_TRAIN = "상황 훈련으로 가기";
export const SUMMARY_GONE =
  "이 대화는 여기서 사라집니다. 기기에 남는 것은 연습 횟수 하나뿐이고, 내 이력에는 올라가지 않습니다.";
export const SUMMARY_COUNT = (count: number) => `이 기기에서 자유 연습 ${count}번째`;
