# 침착(ChimChak) 웹앱 — 공통 브리프 v1

> 모든 구현 에이전트는 작업 전에 이 문서 전체와 `src/types/index.ts`를 읽는다.
> 원본 근거: `C:\Users\lyn\해커톤_침착\예훈님\침착_알파시나리오_루브릭_v1.0.md` (시나리오·루브릭 명세),
> `C:\Users\lyn\AppData\Local\Temp\claude\C--Users-lyn-------\62f4de75-aadd-46c9-a7c9-8746f4657b78\scratchpad\plan_text.txt` (기획서 10p 전문 추출).

## 1. 서비스 한 줄

돌봄받는 사람이 아니라 **돌보는 사람(요양보호사)** 을 훈련시키는 AI 시뮬레이터.
AI는 어르신 역만 맡고, 옳고 그름의 판정은 **한국 법령·공단 지침**이 한다.

- 지원 대상 심사기준 4개: 참신성 / 구현가능성 / 현장실효성 / **보안성**
- MVP 3기능: ① AI 상황 시뮬레이터(즉시 채점) ② 핸즈프리 응급 음성 가이드 ③ 음성 보고→기록 코칭
- 본선 확정 시연 범위: **시나리오 3종 + 응급 5종 + 규칙 채점**

## 2. 기술·구조 원칙

- Next.js 15 App Router + TypeScript strict + Tailwind v4 (`@theme` 토큰은 `src/app/globals.css`)
- **전부 클라이언트 사이드 결정론 동작** — 외부 API 호출 0건. 데모는 네트워크 없이 완주 가능해야 한다.
- 시나리오는 **코드가 아니라 데이터** (`src/data/`). 엔진(`src/engine/`)은 시나리오 그래프를 걷는 범용 상태 머신.
- LLM 자리는 어댑터 패턴으로 비워 둔다: 역할 발화는 데이터의 앵커 대사를 그대로 재생하고, 주석과 README에 "경량 LLM(교체형 어댑터) 연결 지점"만 명시. **특정 LLM 회사·모델명을 코드 주석·UI 어디에도 쓰지 않는다** (예: "GPT", "Claude", "Gemini" 금지 — "경량 LLM"이라고만 표기).
- 음성: Web Speech API 래퍼(`src/lib/speech.ts`). STT 불가 환경(권한 거부·미지원)에서는 **버튼 폴백이 1급 시민** — 모든 CUE는 버튼만으로 완주 가능해야 한다. TTS는 모든 대사·안내에 제공하되 항상 **자막(화면 텍스트) 동반**.
- 세션 기록은 localStorage(`chimchak.sessions.v1`)만 사용. 발화 원문은 저장하지 않는다(세션 메모리 내에서만).

## 3. 안전·표기 규칙 (위반 시 QA 게이트에서 리젝)

1. **점수·등급·순위·백분위를 어떤 화면에도 표시하지 않는다.** 표시는 🟢 충족(3~4점) / ⚪ 코칭(1~2점) 2단계 + 코칭 1문장 + 근거 출처 칩만.
2. 전 화면 하단 고정 고지: **"본 서비스는 훈련·교육 목적이며 119 신고 및 의료인의 진단·처방을 대체하지 않습니다."**
3. 첫 화면(홈·훈련 시작 전) 고정 문구: **"정답을 맞히는 시험이 아니라, 말이 나오게 만드는 연습입니다."**
4. AI 대사에는 항상 **"AI 생성" 배지** + "가상 인물" 고지.
5. 응급(L3) 구간: 생성 호출 자체가 없음을 UI에 명시("이 안내는 사전 검수된 고정 문구입니다 · AI 생성 아님"), **119 버튼 상시 노출**.
6. 신체 술기(하임리히·가슴압박·이물 제거 등) **동작 지도 문구 절대 금지**. "이 부분은 119 상황실이 목소리로 직접 지도합니다"로 이양.
7. 근거 미확인 시 문구: **"공식 지침에서 근거를 찾지 못했습니다. 담당 간호사 또는 기관에 확인해 주세요."**
8. 금지 표현(어느 화면·문구에도 금지): "증상 완화", "인지 개선", "위험도 판정", "조기 발견", "선별", "AI 주치의", "이렇게 처치하세요", "임상적으로 검증된".
9. 가상 인물 고지: 시나리오 시작 화면에 "등장인물은 전원 가상 인물이며 실존 인물·기관과 무관합니다."

## 4. 접근성 규칙 (고령 사용자)

- 본문 18px 이상(html font-size 18px 기본), 주요 버튼 터치 타겟 **min-height 48px** 이상, 핵심 CTA는 56px+.
- 명도 대비 WCAG AA. 아이콘 단독 금지 — 항상 텍스트 라벨 동반.
- 이모지 아이콘 사용 가능(🟢⚪🔴 등). 외부 아이콘 라이브러리 설치 금지.
- 폰트: 시스템 스택 (globals.css `--font-sans`). 외부 폰트 CDN 추가 금지(오프라인 데모 보장).

## 5. 디자인 토큰 (globals.css 확정값 사용)

- 배경 `paper #F7FAF9` / 본문 잉크 `ink #1F3D3B` / 브랜드 틸 `brand-600 #17948A` 계열
- 상태색: ok `#1E9E6A`, warn `#E8833A`, danger `#D64545`
- 카드: 흰 배경, radius 16~20px, 은은한 그림자, 여백 넉넉히 — 참고 스타일: 팀 디자인 시안(틸/민트, 부드러운 카드, 따뜻한 돌봄 톤)
- 게이지(초조도): 0~5, 낮음=틸/높음=주황→빨강 그라데이션

## 6. 라우트 맵과 소유권

| 라우트 | 내용 | 담당 |
|---|---|---|
| `/` | 랜딩: 히어로(서비스 한 줄+고정 문구), 3기능 카드(배우고/일하고/성장하고), 안전 설계 섹션(3계층 L1/L2/L3), 심사 포인트용 신뢰 요소 | design |
| `/train` | 시나리오 선택: 활성 3종 카드 + 12종 매트릭스(잠금 표시), 시작 전 가상 인물 고지 | train |
| `/train/[id]` | 훈련 세션: 대화 UI·게이지·마이크/버튼 폴백·턴별 🟢/⚪ 피드백·⚑CF 인터럽트·엔딩 요약 | train |
| `/emergency` | 응급 프로토콜 5종 목록 + 오프라인 동작 안내 + 119 버튼 | emergency |
| `/emergency/[id]` | 프로토콜 단계별 음성+자막 재생 (P-02 등), "앱이 하지 않는 것" 명시 | emergency |
| `/report` | 음성/타이핑 보고 → 가명처리 하이라이트 → 급여제공기록지 초안(5요소 슬롯) → 확정(로컬 저장) | report |
| `/history` | 성장 기록: 세션 이력 카드, 유형 커버리지, 🟢 충족 목록·⚪ 코칭 요약 (점수 없음) | report |
| `/safety` | 안전·개인정보 설계 페이지: 3계층 생성통제, 가명처리 경로, 폴백 매트릭스, 근거 문서 화이트리스트 | design |

공유 파일 소유권:
- `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`, `src/components/*` → **design 에이전트만 수정**
- `src/types/index.ts` → 수정 금지 (리드 소유)
- `src/data/*` → data 에이전트, `src/engine/*`·`src/lib/*` → engine 에이전트
- 각 라우트 폴더는 담당 에이전트만 생성·수정. 페이지 전용 컴포넌트는 자기 라우트 폴더 안에 둔다(`src/app/train/_components/` 등).

## 7. 공유 컴포넌트 계약 (design 에이전트가 구현, 나머지는 import)

`src/components/` 에 최소 다음을 export (props는 아래와 호환되게, 추가 옵션 자유):

- `TopNav`·`TabBar` — 상단 네비(데스크톱)와 모바일 하단 탭바(홈/훈련/응급/보고/성장). (8/6 정리: 구 `AppHeader`는 렌더 0건으로 삭제)
- `InlineDisclaimer` — 인라인 고지 한 줄. (8/6 정리: 고정 바 `DisclaimerBar`는 v4 §4.11 「고정 바 폐지」에 따라 삭제)
- `PageShell({ title?, children })` — 헤더+본문 컨테이너 래퍼(고지는 인라인으로 포함)
- `BigButton({ children, onClick?, href?, variant?: "primary"|"secondary"|"danger"|"ghost", size?: "md"|"lg", disabled?, type? })` — 48px+ 터치 타겟
- `Card({ children, className? })`
- (8/6 정리: `Badge`·`AiBadge`는 렌더 0건 — 배지 대신 문장·타이포로 말하는 v4 원칙에 따라 삭제. 가상 인물 고지는 말풍선 이름 줄이 담당)
- `SourceChip({ docId })` — 근거 출처 칩. `src/data/docs.ts`의 문서 제목 표시, 클릭 시 문서 설명 팝오버/모달
- (8/6 정리: `Gauge`·`FeedbackCard`는 렌더 0건으로 삭제 — 게이지는 SessionRail이 직접 그리고, 판정 표시는 `InlineCoaching`+`StatusMark`가 담당. 판정어는 「충족/코칭/즉시 중단」 세 낱말)
- `Call119Button` — 붉은 대형 119 버튼 (tel:119 링크 + 캡션 "누르면 전화 앱이 열립니다 — 훈련 중에는 누르지 마세요". 8/6 교정: tel: 링크는 실제로 전화 앱을 열므로 「발신되지 않습니다」라고 적지 않는다 — 없는 안전장치를 있다고 말하지 않는 원칙)
- `SwRegister` — 서비스워커 등록 클라이언트 컴포넌트 (design은 no-op 스텁 생성, emergency 에이전트가 실구현으로 교체)

layout.tsx는 `<SwRegister />`를 포함할 것.

## 8. 데이터 계약 (data 에이전트)

`src/data/` 에 다음 파일 (전부 `src/types` 준수, named export):

- `rubric.ts` — `RUBRIC: RubricItem[]` 30항목 전수 (설계서 §4.3·§4.4 그대로: 행동지표·판정기·앵커 4단계·⚑CF 3항목)
- `docs.ts` — `SOURCE_DOCS: SourceDoc[]` 근거 문서 화이트리스트(부록 A 8건, 표준교재는 "인용 금지" note로 포함)
- `scenarios/chk-a01.ts`, `chk-b02.ts`, `chk-c01.ts` — 설계서 §3 그대로 턴 그래프로 인코딩. 대사·분기 패턴·▲값·⚑CF 문구·엔딩 조건을 원문 유지(요약·창작 금지). B02는 CUE-3의 D3-a에서 `autoNext: "protocol:P-02"`류로 L3 진입.
- `scenarios/index.ts` — `SCENARIOS: Scenario[]` (3종) + `getScenario(id)`
- `matrix.ts` — `SCENARIO_MATRIX: MatrixCell[]` 12종 (설계서 §9.1 제목 그대로, 3종만 scenarioId 연결)
- `protocols.ts` — `PROTOCOLS: EmergencyProtocol[]` 5종: P-01 낙상(의식 있음), **P-02 기도폐쇄(설계서 §3.2 F의 6단계 문구 그대로)**, P-03 의식 저하·무반응, P-04 경련, P-05 심한 출혈. P-02 외 4종도 같은 원칙(관찰·확인 질문·119 이양만, 신체 술기 지도 0건, "지금 119를 누르세요" 우선)으로 작성. 각 protocol에 `notDoing` 명시.

## 9. 엔진 계약 (engine 에이전트)

`src/engine/`:

- `session.ts` — `startSession(s: Scenario): SessionState`, `submitResponse(s, state, input: { utterance?: string; branchId?: string; viaButton: boolean }): { state: SessionState; feedback: TurnFeedback; interrupted: boolean }`, `advanceAfterCF(s, state)`(대안 확인 후 같은 CUE 재시도), `currentTurn(s, state)`, 게이지 위기 엔딩·"end:"·"protocol:" next 처리, 종료 시 `buildRecord(s, state): SessionRecord`
- `classify.ts` — `classifyUtterance(cue: CueDef, utterance: string): BranchDef` (패턴 부분일치, ⚑CF 분기 우선, 미일치 시 defaultBranchId)
- `rules.ts` — 결정론 규칙: 신체억제 동사 사전 8종, 금지행위 사전 15종, 현실 직면 패턴 12종, 존칭 위반(반말·"이모"·아동화 호칭), PII 노출 패턴. `checkCritical(utterance): { cf: boolean; reason?: string; docId?: string }` — classify보다 먼저 호출
- `scoring.ts` — 점수 누적(항목별 최저점 우선), 내부 종합판정 산식(§4.6 — 내부 전용), 화면 표시 변환(🟢/⚪)
- `masking.ts` — `maskText(text): MaskResult` — 성명→`[대상자]`(등장인물명+성씨 패턴), 6자리 이상 숫자→`[번호]`, 기관명 어미(센터·요양원·병원·재가·복지관)→`[기관]`, 주소 패턴(구·로·동+번지)→`[주소]`
- `record.ts` — `extractDraft(text): RecordDraft` — 보고 발화에서 시각·누가·무엇을·조치·현재상태 5슬롯 추출(키워드·정규식 휴리스틱), 빈 슬롯 missing 반환

`src/lib/`:

- `speech.ts` — `createRecognizer({ onResult, onError }): { start, stop, supported }` (webkitSpeechRecognition, lang ko-KR), `speak(text, opts?): Promise<void>` + `stopSpeaking()` (speechSynthesis, ko-KR, rate 0.95), 미지원 시 조용히 no-op + supported=false
- `storage.ts` — `saveSession(r: SessionRecord)`, `loadSessions(): SessionRecord[]`, `saveReport(...)`, `loadReports()` (localStorage, SSR 가드)

엔진은 UI 없음·React 의존 없음·순수 함수 지향. 단위 실행 가능한 자기검증 스크립트(`src/engine/__selfcheck__.ts`는 만들지 말 것 — 대신 각 함수에 JSDoc 예시).

## 10. 페이지 요구 (기능 에이전트)

### train
- `/train`: 활성 3종 카드(유형 배지·난이도·소요·계층 L1/L2/L3 칩·한 줄 요약) + 12종 매트릭스 표(잠금 🔒) + "정답을 맞히는 시험이 아니라…" 문구 + 가상 인물 고지.
- `/train/[id]`: 세션 화면. 필수 요소:
  - 상단: 시나리오 제목, 게이지(`Gauge`), 상황 지문
  - 대화 로그: AI 대사(스피커명+`AiBadge`+지문 이탤릭) / 학습자 발화 말풍선
  - CUE 응답: 마이크 버튼(누르는 동안 인식 표시) + **버튼 폴백 상시 노출**(`fallbackOption` 있는 분기들 + 자유 타이핑 입력)
  - 대기 타이머 표시(waitSec 카운트다운, 초과 시 defaultBranch 처리하지 말고 버튼 폴백 강조만 — 데모 배려)
  - 턴 피드백: `FeedbackCard`(🟢/⚪ + 근거 칩), 게이지 변동 애니메이션
  - ⚑CF: 🔴 전면 인터럽트 모달 — cfMessage + 근거 + 대안 3개 + "다시 해보기"(같은 CUE 재시도)
  - B02 L3 진입: "여기서부터 AI가 화면에서 빠집니다" 전환 연출 후 `/emergency/p-02?from=train` 이동 또는 인라인 프로토콜 재생(선택은 자유, 인라인 권장 — 세션 흐름 유지 후 S4 보고로 복귀)
  - 엔딩: verdict별 화면(충족/부분/재시도/재훈련) — 🟢 충족 목록, ⚪ 코칭(약점) 최대 2개 강조, "재시도 1회 무벌점" 제공, 세션을 `SessionRecord`로 저장
  - TTS: AI 대사 자동 낭독 토글(기본 ON, 항상 자막 존재)
- 시나리오 시작 전 브리핑 화면: 페르소나·상황·제약 조건 카드 + "등장인물 전원 가상 인물" 고지 + 시작 버튼.

### emergency
- `/emergency`: 5종 카드 + "서버가 죽어도 이 화면은 열립니다 — 오프라인 저장됨" 배지 + `Call119Button` 상단 고정.
- `/emergency/[id]`: 단계 자동 진행 음성 재생(각 단계 TTS+대형 자막, 이전/다음/일시정지), P-02는 첫 단계에서 119 버튼 60% 확대 연출, "이 안내는 사전 검수된 고정 문구입니다 · AI 생성 아님" 상시 표시, `notDoing` 접이식 섹션("앱이 하지 않는 것").
- PWA: `public/manifest.webmanifest`(name 침착, theme #17948A, 아이콘은 inline SVG data URI 또는 public/icon.svg 직접 제작), `public/sw.js`(설치 시 `/emergency` 관련 라우트+정적 자산 precache, 네비게이션 fetch는 cache-first→network fallback), `SwRegister` 실구현 교체.

### report
- `/report`: 마이크/타이핑으로 상황 보고 입력 → `maskText` 결과를 **하이라이트로 시각화**(무엇이 왜 가려졌는지 kind 라벨) → `extractDraft` 5슬롯 초안 카드(빈 슬롯은 "채워 주세요" 안내) → 사용자가 수정 → "확정" 시 localStorage 저장 + "기기 밖으로 나가는 것은 가명처리된 텍스트뿐입니다" 안내. 예시 문장 채우기 버튼 제공(데모 배려).
- `/history`: `loadSessions()` 이력 카드(시각·시나리오·verdict 배지·🟢 목록·⚪ 코칭), 유형 커버리지(BPSD/응급/갈등/위험판단 4칸), 확정한 기록 목록, 비었을 때 친절한 빈 상태 + 훈련 유도 CTA. **점수·등급 표기 금지.**

## 11. 완료 기준 (전 에이전트 공통)

- `npm run build` 통과(타입 에러 0). 콘솔 에러 0.
- 마우스만으로(마이크 없이) 3개 시나리오 완주 가능.
- 모든 문자열 한국어, 존댓말. 이모지 남용 금지(상태 표시용만).
- 파일 생성 목록과 특이사항을 최종 텍스트로 보고.
