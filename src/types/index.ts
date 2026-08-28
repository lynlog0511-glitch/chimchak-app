/**
 * 침착(ChimChak) 공유 타입 계약.
 * 모든 모듈(데이터·엔진·UI)이 이 파일을 기준으로 맞춘다.
 * 이 파일은 리드가 관리한다 — 에이전트는 수정하지 말고, 부족한 타입은 자기 모듈 안에 지역 타입으로 추가할 것.
 */

/* ── 시나리오 분류 ───────────────────────────────────────── */

export type ScenarioType = "BPSD" | "EMERGENCY" | "CONFLICT" | "RISK";
export type Tier = "L1" | "L2" | "L3";
export type RubricArea = "SA" | "CO" | "RE" | "CL";

/* ── 루브릭 ─────────────────────────────────────────────── */

export interface RubricItem {
  id: string; // "RE-01"
  area: RubricArea;
  kind: "process" | "outcome";
  indicator: string; // 행동지표 (관찰 가능 서술)
  judge: "rule" | "llm" | "both";
  criticalFail?: boolean; // ⚑CF (CO-01, CO-02, CO-03만 true)
  docId?: string; // 근거 문서 ID
  anchors: { 1: string; 2: string; 3: string; 4: string }; // 4점 척도 앵커
}

export interface SourceDoc {
  id: string; // "DOC-GUIDE-001"
  title: string;
  kind: "법령" | "고시" | "공공 매뉴얼" | "공단 지침" | "공공 지침";
  note?: string;
}

/* ── 시나리오 데이터 (턴 그래프) ─────────────────────────── */

export interface RubricHit {
  itemId: string;
  score: 1 | 2 | 3 | 4;
}

/**
 * 학습자 응답 분기. next는 다음 턴 id 또는 "end:<endingId>".
 */
export interface BranchDef {
  id: string; // "D1-c"
  label: string; // 분기 유형명 (예: "감정 인정형")
  patterns: string[]; // 판정 신호 — 발화에 포함되면 이 분기로 분류 (부분 문자열, 우선순위는 배열 순서)
  skipNegated?: boolean; // 부정 문맥(「~하지 않고」)에서는 이 분기 매치를 건너뜀 — 감점 분기 옵트인 (classify.ts NegationAwareBranch가 읽음)
  /**
   * 매치 주변(±창)에 이 말이 있으면 그 매치를 건너뜀.
   * 규칙 사전(rules.ts)의 예외어와 **같은 배열**을 참조해 두 판정선이 갈라지지 않게 한다.
   * 예: ⚑CF 억제 분기가 RESTRAINT_EXCEPT_TERMS를 받아 "제 팔 붙잡으세요"(권하는 대안)를 통과시킨다.
   */
  except?: string[];
  /**
   * 발화 **어디에든** 이 말이 있으면 이 분기는 서지 않음 (부재 조건 — classify.ts가 읽음).
   * `except`가 매치 **주변 창**을 보는 것과 다르다. 같은 문장의 다른 자리에서 이미 옳은
   * 행동을 말했으면 이 감점 갈래가 성립하지 않는 자리에 쓴다.
   * 예: B02 D3-b「말 걸기만」 — 같은 문장에서 119를 부르겠다고 했으면 「~만」이 아니다.
   */
  unlessPatterns?: string[];
  /** 이 분기 중 하나를 지나온 세션에서만 열림 (선행 조건 게이트 — session.ts가 읽음) */
  requiresPriorBranchIds?: string[];
  /** requiresPriorBranchIds 미충족 시 대신 적용할 분기 id */
  unmetBranchId?: string;
  fallbackOption?: string; // 버튼 폴백으로 노출할 문구 (없으면 버튼 미노출 분기)
  gaugeDelta: number; // 초조도/긴장도 변동 (▲)
  aiReaction: string; // AI(어르신·보호자 등) 반응 대사
  aiReactionNote?: string; // 지문 (목소리 커짐 등)
  rubricHits: RubricHit[];
  coaching?: string; // ⚪ 코칭 1문장 (2점 이하일 때 표시)
  praise?: string; // 🟢 강화 문구 (3점 이상일 때 표시)
  docId?: string; // 근거 출처 칩
  criticalFail?: boolean; // ⚑CF 분기 — 즉시 인터럽트
  cfMessage?: string; // ⚑CF 인터럽트 고정 문구
  cfAlternatives?: string[]; // 대안 행동 제시
  retrainAdvice?: boolean; // 재훈련 권고 조건 (⚑CF 아님 — 존엄·관계 위반)
  triggerId?: string; // 이 분기가 발동시키는 트리거
  next: string; // 다음 턴 id 또는 "end:E-성공"
}

/**
 * 요소 개수 판정 (보고 CUE 전용).
 *
 * 보고는 「무엇이 들어 있는가」로 갈립니다. 한 조각만 걸려도 5요소 보고가 되던 자리를,
 * 그룹별로 세어 개수로 나눕니다. classify.ts가 버튼·⚑CF 다음, 패턴 대조 **앞**에서 봅니다.
 */
export interface ElementJudgeDef {
  groups: { id: string; label: string; patterns: string[] }[];
  /** minCount 내림차순 — 먼저 충족되는 단계를 채택 */
  tiers: { minCount: number; branchId: string }[];
}

export interface CueDef {
  id: string; // "CUE-1"
  prompt: string; // 학습자 지시문 (예: "첫 응답 — 무엇이라고 말하시겠습니까?")
  waitSec: number; // 응답 대기 상한 (8초, 응급 6초/4초)
  branches: BranchDef[];
  defaultBranchId: string; // 무응답·미분류 시 적용할 분기 id
  /** 요소 개수로 가르는 CUE(보고)만 선언합니다. 0개면 채택 없이 패턴 대조로 넘어갑니다. */
  elementJudge?: ElementJudgeDef;
}

export interface TurnDef {
  id: string; // "T1", "T-1" (트리거 턴 포함)
  speaker: "elder" | "guardian" | "dispatcher" | "system" | "protocol";
  speakerName: string; // "박 어르신", "보호자 김 씨", "119 상황실"
  text: string; // 대사 (앵커 대사 고정)
  stageDirection?: string; // 지문 (신발을 반쯤 신은 채…)
  isTrigger?: boolean; // 돌발 변수 턴 여부
  triggerName?: string; // "T-1 문고리"
  cue?: CueDef; // 이 턴 뒤 학습자 응답 지점 (없으면 자동 진행)
  autoNext?: string; // cue가 없을 때 다음 턴 id 또는 "end:..." 또는 "protocol:P-02"
}

export interface TriggerDef {
  id: string; // "T-1"
  name: string; // "문고리"
  condition: string; // 사람이 읽는 발동 조건 설명
  description: string;
}

export interface EndingDef {
  id: string; // "E-성공"
  title: string;
  verdict: "충족" | "부분 충족" | "재시도" | "재훈련" | "재훈련 권고";
  condition: string; // 사람이 읽는 조건 설명
  message: string; // 종료 화면 안내 문구
}

export interface PersonaDef {
  role: "care_recipient" | "guardian" | "learner" | "dispatcher";
  name: string; // "박 어르신 (가상 인물)"
  profile: string;
}

export interface GaugeDef {
  label: "초조도" | "긴장도";
  start: number; // 시작값
  max: number; // 5
  crisisAt: number; // 이 값 도달 시 위기 엔딩
  crisisEndingId: string; // "E-위기"
}

export interface Scenario {
  id: string; // "CHK-A01"
  title: string; // "현관 앞, 집에 가야 해요"
  type: ScenarioType;
  typeLabel: string; // "치매 행동심리증상"
  level: 1 | 2 | 3;
  levelLabel: string; // "초급"
  durationMin: number;
  tiers: Tier[];
  summary: string; // 목록 카드용 한 줄 설명
  objectives: string[]; // 학습 목표
  personas: PersonaDef[];
  context: string; // 상황 개시 시점 서술
  constraints: string[]; // 제약 조건
  gauge: GaugeDef;
  entryTurnId: string; // 시작 턴
  turns: TurnDef[];
  triggers: TriggerDef[];
  endings: EndingDef[];
  appliedRubric: string[]; // 적용 루브릭 item id 목록
  sourceDocs: string[]; // 근거 문서 id 목록
  reportCues?: string[]; // S4 보고·기록 단계 질문 (CUE-5~7)
  active: boolean; // false면 12종 매트릭스에서 잠금 표시
  reviewPending?: boolean; // true면 대사가 현직 감수 대기(알파 초안) — /train 카드 라벨·/check 감수 항목이 이 필드 하나를 셉니다. 감수 완료 시 이 표기만 지우면 됩니다.
}

/** 12종 매트릭스 항목 (잠금 포함) */
export interface MatrixCell {
  typeLabel: string; // "① 치매 행동심리증상"
  level: 1 | 2 | 3;
  title: string; // "야간 배회 · 보호자 부재"
  scenarioId?: string; // 활성 시나리오면 연결
}

/* ── 응급 프로토콜 (L3 — 생성 0%) ────────────────────────── */

export interface ProtocolStep {
  id: string; // "P-02-1"
  voice: string; // 고정 음성 문구 (변형 불가)
  screen?: string; // 화면 보조 문구 (사용자에게 그대로 보이는 문장)
  emphasize119?: boolean; // 119 버튼 확대
  address?: string; // 이 단계에서 크게 표시할 방문지 주소 (훈련 모드는 더미 주소)
}

export interface EmergencyProtocol {
  id: string; // "P-02"
  title: string; // "기도폐쇄(질식)"
  situation: string; // 언제 쓰는가
  reviewed: string; // 검수 상태 표기
  steps: ProtocolStep[];
  notDoing: { what: string; why: string; instead: string }[]; // 앱이 하지 않는 것
}

/* ── 세션 런타임 ────────────────────────────────────────── */

export type SessionStatus = "running" | "interrupted" | "protocol" | "ended";

export interface TurnFeedback {
  branchId: string;
  branchLabel: string;
  ok: boolean; // 🟢(3점 이상) / ⚪(2점 이하)
  criticalFail: boolean;
  message: string; // praise 또는 coaching
  docId?: string;
  gaugeDelta: number;
  rubricHits: RubricHit[];
}

export interface SessionEvent {
  turnId: string;
  cueId?: string;
  utterance?: string; // 음성/버튼 입력 원문 (세션 내 메모리만, 저장 안 함)
  viaButton: boolean;
  feedback?: TurnFeedback;
  at: number; // epoch ms
}

export interface SessionState {
  scenarioId: string;
  currentTurnId: string;
  gauge: number;
  status: SessionStatus;
  endingId?: string;
  events: SessionEvent[];
  scores: Record<string, 1 | 2 | 3 | 4>; // itemId → 최종 점수 (내부 전용, 화면 미표시)
  cfCount: number;
  retrainAdvice: boolean;
  retriesUsed: number;
  startedAt: number;
}

/* ── 세션 기록 (localStorage 보관, 성장 기록 화면용) ─────── */

export interface SessionRecord {
  id: string;
  scenarioId: string;
  scenarioTitle: string;
  typeLabel: string;
  startedAt: string; // ISO
  endedAt: string; // ISO
  /**
   * 이 회차의 **진행 시간(초)** — 이수 시수로 세는 값이다(`engine/timing.ts`의 `activeSeconds`).
   *
   * 턴 사이 구간의 합이고 정지 구간은 턴당 상한까지만 들어간다. 벽시계(`endedAt − startedAt`)와
   * 다른 값이며, **다른 값인 것이 이 칸을 둔 이유다** — 자리를 비운 시간이 증빙에 실리지 않게 한다.
   *
   * **선택 칸인 이유**: 이 규칙이 서기 전에 저장된 기록에는 이 값이 없다. 그 기록들은 다시
   * 계산하지 않는다 — 이미 인쇄돼 자료철에 들어간 확인서의 숫자를 앱이 뒤에서 바꾸면, 같은
   * 발급번호의 종이 두 장이 다른 시수를 말하게 된다. 없으면 `lib/storage.ts`의 `sessionSeconds`가
   * 예전 방식(벽시계 + 회차당 30분 상한)으로 세고, 새 회차부터 이 값이 쓰인다.
   */
  activeSec?: number;
  verdict: EndingDef["verdict"];
  endingTitle: string;
  greenChecks: string[]; // 🟢 충족 문구 목록
  coachingPoints: string[]; // ⚪ 코칭 문구 목록 (약점 요약)
  cfCount: number;
  retriesUsed: number;
  turnCount: number;
}

/* ── 기록 코칭 (기능③) ──────────────────────────────────── */

export interface MaskSpan {
  start: number;
  end: number;
  kind: "성명" | "번호" | "기관명" | "주소" | "생년";
  replaced: string; // "[대상자]" 등
}

export interface MaskResult {
  masked: string;
  spans: MaskSpan[];
}

export interface RecordDraft {
  time: string; // 시각
  who: string; // 누가
  what: string; // 무엇을
  action: string; // 어떻게(조치)
  status: string; // 현재 상태
  missing: string[]; // 비어 있는 슬롯 라벨 목록
}
