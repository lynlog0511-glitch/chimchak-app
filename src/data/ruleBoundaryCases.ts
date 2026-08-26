/**
 * 규칙 엔진 경계 케이스 — **저장소에 커밋된 검증 데이터**입니다.
 *
 * 기획서 검증 계단 ①의 「경계 케이스 30/30 전수 통과」는 지금까지 화면에 옮겨 적은 인용치였습니다.
 * 그 문장이 증빙이 되려면 케이스가 코드 옆에 있고 아무 때나 다시 돌아가야 합니다 — 이 파일이
 * 그 목록이고, `runEngineSelfCheck`(src/engine/boundaryCheck.ts)가 브라우저에서 그대로 돌립니다.
 * (인용치 30건은 2026-07-27 실행 시점의 건수입니다. 그 뒤 사투리·사유어 우회·파이썬 검증셋
 *  이식분을 더해 목록이 늘었으므로, 화면은 건수를 문장에 적지 말고 배열에서 세어 옵니다.)
 *
 * 고르는 기준은 「걸려야 하는 문장」이 아니라 **걸리면 안 되는 문장**입니다. 훈련 도중 옳은
 * 답을 ⚑CF로 잘못 멈춰 세우는 쪽이 놓치는 쪽보다 나쁘기 때문에, 부정 표현·예외어·유형 게이트
 * ·국면 게이트·적용 항목표 게이트를 쌍으로 넣었습니다 — 같은 문장을 조건만 바꿔 두 번 넣은
 * 짝(bc-10/11 · bc-12/13 · bc-29/30 · bc-02/05 · bc-54/55 · 국면 게이트의 bc-124/125)과,
 * **부정 표지·예외어를 넓힐 때마다 함께 넣는 공격 짝**(bc-152/153 · bc-154/155 · bc-183/185 …)이
 * 그것입니다. 짝의 수는 세지 마십시오 — 늘어날 때마다 이 줄이 낡습니다.
 *
 * ▸ 넓힐 때의 규칙 — 사전이든 부정 표지든, **넓힌 쪽만 케이스로 넣지 마십시오.**
 *   표지를 넓히면 오탐이 줄고 미탐이 늘며, 사전을 넓히면 그 반대입니다. 한쪽만 검사하면
 *   반대쪽이 조용히 무너집니다. 새 신호마다 「해소되는 문장」과 「그 신호를 쓴 공격」을
 *   나란히 넣어 주십시오. tests/rules.test.ts의 「걸리면 안 되는 문장이 절반을 넘는다」가
 *   그 균형을 강제합니다.
 *
 * ▸ 활용형을 넣을 때의 규칙 — **홑 활용형으로 넣지 마십시오.** 3라운드에 「묶겠」·「잠그겠」
 *   ·「고정하겠」을 홑으로 넣었더니 미탐 몇 건을 메우는 대신 "쓰레기 봉투를 묶겠습니다"·
 *   "가스 밸브를 잠그겠습니다"·"침대 바퀴를 고정해 두겠습니다"가 전부 ⚑CF가 되었고,
 *   재발 방지 CUE의 **유도 정답**이 막혔습니다(실측: 유도 정답 6건 · 현장 발화 47건).
 *   누구를·어디에·무엇을과 함께 적는 것이 이 사전의 원래 지혜입니다(bc-225~bc-246).
 *
 * ▸ 잡지 **못하는** 것도 케이스로 적습니다 — bc-180·bc-181·bc-355~bc-357이 그렇습니다.
 *   한계를 비워 두면 다음 사람이 「이건 잡히겠지」로 읽고 그 오해 위에 단언을 쌓습니다.
 *   rules.ts 머리주석의 한계 ①~⑩과 짝을 이룹니다.
 *
 * ▸ 구성 — 자가 점검은 세 묶음입니다
 *   규칙 사전 경계 문장(이 파일 RULE_BOUNDARY_CASES · 그중 사투리 10건)
 *   + 119 지연 시간 규칙(CALL_DELAY_BOUNDARY_CASES) + 근거 화이트리스트 가드(EVIDENCE_BOUNDARY_CASES).
 *   기획서가 약속한 100건은 **하한**이고, 실제 건수는 배열에서 세어 옵니다(/check가 셉니다).
 *   규칙 사전 경계 문장 중 `cf: false`(옳은 발화가 막히지 않는지 보는 쪽)가 절반을 넘습니다.
 *   숫자를 문장에 적어 두지 마십시오 — 목록이 늘면 이 주석부터 낡습니다.
 *
 * ▸ 파이썬 검증셋(침착_엔진_v0.1/testcases.json 24건) 중 **이식하지 않은 16건**
 *   문장 하나로는 판정할 수 없어(세션 맥락이 있어야 해서) 이 파일에 옮기지 않았습니다.
 *   - A01-D2d 논리적 설득 → RE-02 2점 · 점수 눈금이라 cf/코칭 두 갈래로 환원되지 않습니다
 *   - SA-01 2건(안전 위험 선·후 언급) · RE-07 2건(돌발 변수 후 반복·수정) · 발화 **순서** 비교
 *   - RE-08 2건(긴 문장·짧은 문장) · 발화 길이 지표
 *   - CO-08 1건 · CL-03 2건(기록 4슬롯) · 세션의 report_text가 있어야 합니다
 *   - A01 신체접촉 버튼 선택(TOUCH_BODY) · 발화가 없는 액션 경로입니다
 *   - B02 CO-03 3건(신속·지연·미연결) · SA-06 1건 · 응급 개시 후 **경과 시간**이 필요합니다
 *     (시간 축은 CALL_DELAY_BOUNDARY_CASES가 따로 맡습니다)
 *   - C01 정상 경로 종합 1건 · 5개 항목 최종 점수를 한꺼번에 보는 케이스입니다
 */

import type { CallDelayBoundaryCase, EvidenceBoundaryCase, RuleBoundaryCase } from "@/engine";

/** 규칙 사전 경계 문장 — bc-01~bc-30이 최초 30건, 그 뒤는 실측으로 뚫린 자리를 메운 추가분입니다. */
export const RULE_BOUNDARY_CASES: readonly RuleBoundaryCase[] = [
  /* ── ⚑CF 신체 자유 제한 (CO-02) ─────────────────────────── */
  {
    id: "bc-01",
    utterance: "어르신, 손목을 잡고 못 나가시게 하겠습니다.",
    why: "손목 제지는 신체 자유 제한입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-02",
    utterance: "현관문을 잠그겠습니다.",
    why: "문 잠그기는 신체 자유 제한입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-03",
    utterance: "도어락을 잠가 두겠습니다.",
    why: "「잠가」 활용형까지 잡아야 합니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-04",
    utterance: "몸으로 막아서 나가지 못하게 하겠습니다.",
    why: "몸으로 가로막는 것도 제지입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-19",
    utterance: "팔을 잡아끌어 방으로 데려가겠습니다.",
    why: "끌기 활용형(잡아끌)을 잡아야 합니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },

  /* ── 부정·예외 — 걸리면 안 되는 문장 ────────────────────── */
  {
    id: "bc-05",
    utterance: "문을 잠그지 않겠습니다.",
    why: "부정문을 ⚑CF로 잡으면 옳은 답을 멈춰 세웁니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-06",
    utterance: "붙잡지 않고 곁에 서 있겠습니다.",
    why: "「붙잡지 않고」는 모범 대응입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-07",
    utterance: "밀치는 대신 손을 잡아 드리겠습니다.",
    why: "「대신」 뒤의 대체 행동은 제지가 아닙니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-08",
    utterance: "휠체어를 밀어서 방으로 모시겠습니다.",
    why: "휠체어 이동은 예외어로 걸러야 합니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-09",
    utterance: "손을 잡아 드리고 곁에 서 있겠습니다.",
    why: "동의를 구한 손잡기는 대안 행동입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-18",
    utterance: "이끌고 나가겠습니다.",
    why: "「이끌고」가 「끌고」로 잘못 잡히면 안 됩니다",
    cf: false,
    noAdvisory: true,
  },

  /* ── ⚑CF 허용 범위 밖 행위 (CO-01) · 유형·국면 게이트 ──── */
  {
    id: "bc-10",
    utterance: "물 한 잔 드릴까요?",
    why: "기도폐쇄 상황에서 액체 제공은 ⚑CF입니다",
    scenarioType: "EMERGENCY",
    cf: true,
    ruleId: "CF-FLUID",
  },
  {
    id: "bc-11",
    utterance: "물 한 잔 드릴까요?",
    why: "같은 문장이라도 치매 행동 상황에서는 좋은 전환 제안입니다",
    scenarioType: "BPSD",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-12",
    utterance: "식사 전에 물을 드린 사실도 기록하겠습니다.",
    why: "응급이 끝난 보고 구간의 회고 진술은 액체 제공이 아닙니다",
    scenarioType: "EMERGENCY",
    cueId: "CUE-5",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-13",
    utterance: "식사 전에 물을 드린 사실도 기록하겠습니다.",
    why: "같은 문장이라도 응급 진행 중(CUE-3)이면 멈춰 세워야 합니다",
    scenarioType: "EMERGENCY",
    cueId: "CUE-3",
    cf: true,
    ruleId: "CF-FLUID",
  },
  {
    id: "bc-14",
    utterance: "입안에 손을 넣어 확인하겠습니다.",
    why: "구강 내 조작은 유형과 무관하게 ⚑CF입니다",
    cf: true,
    ruleId: "CF-ORAL",
  },
  {
    id: "bc-15",
    utterance: "하임리히법을 하겠습니다.",
    why: "신체 술기는 안내하지 않고 119로 이양합니다",
    cf: true,
    ruleId: "CF-ABDOMINAL",
  },
  {
    id: "bc-17",
    utterance: "제 차로 병원에 모시고 가겠습니다.",
    why: "임의 이송은 이동 중 악화를 감당할 수 없습니다",
    cf: true,
    ruleId: "CF-TRANSPORT",
  },
  {
    id: "bc-16",
    utterance: "등을 세게 두드리겠습니다.",
    why: "⚑CF는 아니지만 코칭으로 남아야 합니다",
    cf: false,
    advisory: ["CO-01"],
  },

  /* ── 현실 직면 강요 (RE-02) ─────────────────────────────── */
  {
    id: "bc-20",
    utterance: "여기가 집이에요, 어머니.",
    why: "사실 정정이 먼저 나오면 저항이 커집니다",
    cf: false,
    advisory: ["RE-02"],
  },
  {
    id: "bc-21",
    utterance: "아버님 생각이 많이 나시나 봐요.",
    why: "감정을 먼저 알아주는 문장은 걸리면 안 됩니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-22",
    utterance: "정신 차리세요!",
    why: "각성 요구도 현실 직면 강요입니다",
    cf: false,
    advisory: ["RE-02"],
  },

  /* ── 호칭·존칭 (CO-07) ──────────────────────────────────── */
  {
    id: "bc-23",
    utterance: "이모, 여기 앉으세요.",
    why: "「이모」는 호칭 위반입니다",
    cf: false,
    advisory: ["CO-07"],
  },
  {
    id: "bc-24",
    utterance: "이모님 말고 선생님이라고 불러 주세요.",
    why: "호칭을 바로잡아 달라는 요청은 오히려 모범 대응입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-25",
    utterance: "할머니, 저기 앉아.",
    why: "반말 종결은 존칭 위반으로 잡아야 합니다",
    cf: false,
    advisory: ["CO-07"],
  },
  {
    id: "bc-26",
    utterance: "저기 앉으시겠어요?",
    why: "존댓말 청유형을 반말로 잡으면 안 됩니다",
    cf: false,
    noAdvisory: true,
  },

  /* ── 개인정보 노출 (CO-08) ──────────────────────────────── */
  {
    id: "bc-27",
    utterance: "보호자 연락처는 010-1234-5678입니다.",
    why: "전화번호를 그대로 말하면 가려서 전달하도록 코칭합니다",
    cf: false,
    advisory: ["CO-08"],
  },
  {
    id: "bc-28",
    utterance: "보호자께 연락드리겠습니다.",
    why: "번호 없이 연락 의사만 밝히는 문장은 걸리면 안 됩니다",
    cf: false,
    noAdvisory: true,
  },

  /* ── 적용 항목표 게이트 (설계서 §4.5 · §3.3 판정선 분리) ── */
  {
    id: "bc-29",
    utterance: "문을 잠그겠습니다.",
    why: "CO-02가 배정되지 않은 시나리오에서는 인터럽트 대신 코칭으로 남깁니다",
    appliedRubric: ["RE-01"],
    cf: false,
    advisory: ["CO-02"],
  },
  {
    id: "bc-30",
    utterance: "문을 잠그겠습니다.",
    why: "CO-02가 배정된 시나리오에서는 그대로 멈춰 세웁니다",
    appliedRubric: ["CO-02"],
    cf: true,
    ruleId: "CF-RESTRAINT",
  },

  /* ── 사투리 (경상·전라) — bc-31~bc-40 ─────────────────────
     표준어만 아는 사전은 현장 말씨로 말하는 분들에게만 관대해집니다. 걸려야 하는 문장과
     걸리면 안 되는 문장을 절반씩 두어, 판정선이 말씨를 타지 않는지 봅니다.
     걸리면 안 되는 쪽 다섯 문장은 팀이 근거 인용 실측에 쓴 사투리 문항의 발화 원문입니다
     (실측_인용정확도/questions_50.json Q31·Q33·Q37·Q38·Q40). */
  {
    id: "bc-31",
    utterance: "몬 나가게 막아뿌겠심더.",
    why: "「몬 나가게 막아뿌」는 표준어 「못 나가게 막」과 같은 행위입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-32",
    utterance: "가마이 안 있으면 문 걸어 잠가뿌리께예.",
    why: "「잠가뿌리」 어미가 붙어도 문 잠그기입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-33",
    utterance: "팔 잡아가 몬 가게 하겠심더.",
    why: "조사가 빠진 「팔 잡아가」도 신체 제지입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-34",
    utterance: "묶어뿌리겠습니더.",
    why: "「묶어뿌리」도 결박입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-35",
    utterance: "약 반 알로 줄이뿌께예.",
    why: "용량 조절은 말씨와 무관하게 의료인의 영역입니다",
    cf: true,
    ruleId: "CF-DOSE",
  },
  {
    id: "bc-36",
    utterance: "어무이, 밖에 억수로 춥심더. 계단도 미끄러운데 내가 먼저 나가 볼게예.",
    why: "안전 위험을 먼저 말한 모범 대응이 사투리라고 걸리면 안 됩니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-37",
    utterance: "애기 밥 챙기주야 되겠구마. 마음이 억수로 급하시겠심더.",
    why: "감정을 먼저 알아주는 문장입니다 — 「애기」가 아동화 호칭으로 잡히면 안 됩니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-38",
    utterance: "그 맴은 알겄는디요, 식구들 반찬까지는 계약된 급여에 없어라. 센터에 여쭤보고 알려드릴게라.",
    why: "전라 말씨의 3단 화법도 모범 대응입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-39",
    utterance: "어무이, 옷이 젖었는데 갈아입으시면 좋겠심더. 제가 도와드려도 되겠능교?",
    why: "설명하고 동의를 구하는 문장입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-40",
    utterance:
      "오후 3시 20분에 어무이가 거실서 미끄러져 넘어지셨심더. 부축해가 앉히고 출혈 확인했고예, 지금은 소파에서 안정 중입니더.",
    why: "낙상 보고 문장입니다 — 「앉히고」가 억제로 잡히면 사실 보고가 벌을 받습니다",
    cf: false,
    noAdvisory: true,
  },

  /* ── 사유어를 앞세운 우회 — bc-41~bc-47 ───────────────────
     「위험」·「큰일」을 부정 표지로 두었더니, 행위를 정당화하는 말이 전부 ⚑CF를 빠져나갔습니다.
     조건 연접형(「~면 위험」)만 부정으로 읽도록 좁힌 뒤의 양쪽 경계입니다. */
  {
    id: "bc-41",
    utterance: "붙잡아서 위험을 막을게요.",
    why: "「위험을 막는다」는 붙잡기를 하겠다는 말입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-42",
    utterance: "문을 잠가야 큰일을 막지요.",
    why: "「큰일을 막는다」도 문 잠그기의 사유일 뿐입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-43",
    utterance: "일단 붙잡을게요, 위험하니까요.",
    why: "사유를 뒤에 붙여도 행위는 그대로입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-44",
    utterance: "문을 잠그면 위험하지 않겠죠.",
    why: "부정이 붙은 말은 「위험하다」이지 「잠근다」가 아닙니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-45",
    utterance: "못 나가시게 문을 걸어 두겠습니다.",
    why: "「걸어 두겠다」는 완곡어도 문 잠그기입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-46",
    utterance: "문을 잠그면 위험합니다.",
    why: "조건 연접형은 하지 않겠다는 뜻이라 멈춰 세우면 안 됩니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-47",
    utterance: "위험하지 않게 부축해 드릴게요.",
    why: "부축은 제지가 아닙니다 — 사유어를 좁힌 뒤에도 정상 발화는 조용해야 합니다",
    cf: false,
    noAdvisory: true,
  },

  /* ── 파이썬 검증셋 이식 — bc-48~bc-53 ─────────────────────
     침착_엔진_v0.1/testcases.json 의 발화 단위 케이스 중, 세션 맥락 없이 문장만으로
     판정할 수 있는 것들입니다. 두 구현이 같은 문장에 같은 답을 내는지 여기서 고정합니다. */
  {
    id: "bc-48",
    utterance: "일단 제가 끌고 들어갈게요.",
    why: "A01-D3d — 끌고 들어가기는 신체 자유 제한입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-49",
    utterance: "혈압약을 반 알로 줄여 드릴게요.",
    why: "C01 — 용량 판단은 의료인의 영역입니다",
    cf: true,
    ruleId: "CF-DOSE",
  },
  {
    id: "bc-50",
    utterance: "물을 드리겠습니다.",
    why: "B02 — 사레 중 액체 제공입니다",
    scenarioType: "EMERGENCY",
    cf: true,
    ruleId: "CF-FLUID",
  },
  {
    id: "bc-51",
    utterance: "제 손 잡고 같이 가실래요?",
    why: "A01 동의 절차 확인 — 손잡기 제안은 대안 행동입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-52",
    utterance: "가만있어. 앉아.",
    why: "A01 반말 명령형 — CO-07 코칭으로 남습니다",
    cf: false,
    advisory: ["CO-07"],
  },
  {
    id: "bc-53",
    utterance: "계약된 급여 범위에는 없습니다.",
    why: "C01 정상 경로 — 급여 범위를 설명하는 문장은 걸리면 안 됩니다",
    cf: false,
    noAdvisory: true,
  },

  /* ── 응급 종료 후 회고 진술 — bc-54~bc-55 ─────────────────
     구급대에 인계한 뒤의 보고 구간에서 「무엇을 했는지」 사실대로 적는 문장이 술기 규칙에
     걸리면, 규칙이 「기록을 남기지 말라」는 신호가 됩니다. */
  {
    id: "bc-54",
    utterance: "구급대원이 흡인기를 사용했습니다.",
    why: "보고 구간의 회고 진술은 요양보호사의 행위가 아닙니다",
    scenarioType: "EMERGENCY",
    cueId: "CUE-5",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-55",
    utterance: "흡인기를 대 보겠습니다.",
    why: "같은 낱말이라도 응급 진행 중이면 업무 범위 밖 의료행위입니다",
    scenarioType: "EMERGENCY",
    cueId: "CUE-3",
    cf: true,
    ruleId: "CF-SUCTION",
  },

  /* ── 신체 억제의 완곡한 말 — bc-56~bc-61 ─────────────────
     현장에서 억제는 "묶겠습니다"라고 말해지지 않습니다. 문고리를 걸고, 자물쇠를 달고,
     보호대로 고정하고, 앞을 막고 섭니다. 완곡해진 말이 사전을 빠져나가면 사전은 말솜씨를
     시험하는 장치가 됩니다. */
  {
    id: "bc-56",
    utterance: "나가시지 못하게 현관을 막고 서 있겠습니다.",
    why: "몸으로 앞을 막고 서는 것도 신체 자유 제한입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-57",
    utterance: "문고리를 걸어 두고 잠시 지켜보겠습니다.",
    why: "「문고리를 걸어」는 문 잠그기의 완곡어입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-58",
    utterance: "자물쇠를 하나 달아 두겠습니다.",
    why: "잠그는 도구를 말해도 같은 행위입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-59",
    utterance: "침대에 보호대로 고정해 두겠습니다.",
    why: "「보호대」라는 이름을 붙여도 억제대입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-60",
    utterance: "떠밀지는 않겠습니다만, 앞을 막고 서 있겠습니다.",
    why: "부정은 앞 동사에만 걸립니다 — 뒤에 남은 행위는 그대로 멈춰 세워야 합니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-61",
    utterance: "손목 잡고 방으로 모시겠습니다.",
    why: "조사가 빠진 「손목 잡」도 제지입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },

  /* ── 억제의 반대 방향 — bc-62~bc-66 ───────────────────────
     같은 낱말을 쓰면서 「하지 않겠다」고 말하는 문장이 훈련에서 가장 많습니다. */
  {
    id: "bc-62",
    utterance: "가로막지 않고 옆에서 함께 걷겠습니다.",
    why: "부정문을 잡으면 모범 대응이 벌을 받습니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-63",
    utterance: "억제대는 쓰지 않겠습니다.",
    why: "도구 이름이 나왔다는 이유만으로 잡으면 안 됩니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-64",
    utterance: "문을 잠그는 대신 현관 등을 켜 두겠습니다.",
    why: "「대신」 뒤의 대체 행동은 억제가 아닙니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-65",
    utterance: "보행기를 밀어서 화장실까지 함께 가겠습니다.",
    why: "보행 보조기구를 미는 것은 예외어로 걸러야 합니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-66",
    utterance: "밀치거나 붙잡지 않고, 옆에서 기다리겠습니다.",
    why: "한 문장에 두 동사가 있어도 둘 다 부정 문맥입니다",
    cf: false,
    noAdvisory: true,
  },

  /* ── 투약·용량 판단 — bc-67~bc-73 ─────────────────────────
     용량 조절은 "반 알"·"용량을 조절"·"빼고"처럼 일상어로 말해집니다. 반대로 간호(조무)사에게
     묻겠다는 문장은 정확히 우리가 바라는 대응이라 조용해야 합니다. */
  {
    id: "bc-67",
    utterance: "혈압약 용량을 조절해 드리겠습니다.",
    why: "용량 조절 판단은 의료인의 영역입니다",
    cf: true,
    ruleId: "CF-DOSE",
  },
  {
    id: "bc-68",
    utterance: "오늘은 약을 빼고 드리겠습니다.",
    why: "빼는 것도 용량을 조절하는 판단입니다",
    cf: true,
    ruleId: "CF-DOSE",
  },
  {
    id: "bc-69",
    utterance: "잠이 안 오신다니 두 알 드리겠습니다.",
    why: "늘리는 쪽도 같은 판단입니다 — 앞의 「안」이 부정으로 새면 안 됩니다",
    cf: true,
    ruleId: "CF-DOSE",
  },
  {
    id: "bc-70",
    utterance: "소화제를 드시게 하겠습니다.",
    why: "약의 필요 여부를 정하는 것은 업무 범위 밖입니다",
    cf: true,
    ruleId: "CF-MEDICATION",
  },
  {
    id: "bc-71",
    utterance: "약은 제가 임의로 드리지 않고 간호사님께 여쭙겠습니다.",
    why: "판단을 넘기는 문장이 약을 말했다는 이유로 막히면 안 됩니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-72",
    utterance: "약 봉지에 적힌 대로 그대로 드시게 돕겠습니다.",
    why: "처방대로 돕는 것은 허용 범위 안입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-73",
    utterance: "진통제가 필요한지는 간호사님께 여쭤보겠습니다.",
    why: "약 이름을 말하며 판단을 넘기는 문장은 모범 대응입니다",
    cf: false,
    noAdvisory: true,
  },

  /* ── 무면허 의료행위(구강·흡인·복부) — bc-74~bc-80 ────────
     술기는 이 앱이 지도하지 않고 119 상황실로 넘깁니다. 반대로 "하지 않겠다"는 문장은
     그 이양을 스스로 해낸 답이라 조용해야 합니다. */
  {
    id: "bc-74",
    utterance: "입을 벌려 안을 들여다보겠습니다.",
    why: "입안을 확인하려는 시도도 구강 내 조작입니다",
    cf: true,
    ruleId: "CF-ORAL",
  },
  {
    id: "bc-75",
    utterance: "석션으로 빨아내 보겠습니다.",
    why: "흡인은 업무 범위 밖 의료행위입니다",
    cf: true,
    ruleId: "CF-SUCTION",
  },
  {
    id: "bc-76",
    utterance: "명치를 눌러 보겠습니다.",
    why: "복부 압박은 신체 술기라 안내하지 않습니다",
    cf: true,
    ruleId: "CF-ABDOMINAL",
  },
  {
    id: "bc-77",
    utterance: "배를 밀어 올려 보겠습니다.",
    why: "이름을 대지 않아도 복부 압박입니다",
    cf: true,
    ruleId: "CF-ABDOMINAL",
  },
  {
    id: "bc-78",
    utterance: "입안은 제가 들여다보지 않고 상황실 안내를 기다리겠습니다.",
    why: "119로 이양하는 문장이 「입안」이라는 낱말 때문에 막히면 안 됩니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-79",
    utterance: "석션은 제가 하지 않고 간호사님을 부르겠습니다.",
    why: "업무 범위를 스스로 그은 문장입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-80",
    utterance: "배를 누르지 않고 기침을 계속하시도록 격려하겠습니다.",
    why: "술기를 하지 않겠다고 밝힌 뒤의 대체 행동은 정답입니다",
    cf: false,
    noAdvisory: true,
  },

  /* ── 현실 직면 어간 확장 — bc-81~bc-84 ────────────────────
     ① A01 CUE-1의 첫 폴백("어머님, 여기가 어머님 댁이에요")은 사이에 호칭이 끼어 미탐이던
        자리입니다(파이썬 검증셋 A01-D1a). ② 사투리 변형은 실측 하네스 Q34 원문입니다
        (실측_인용정확도/questions_50.json). ③ 걸리면 안 되는 사투리 문장을 함께 둡니다. */
  {
    id: "bc-81",
    utterance: "어무이, 아까 밥 잡샀다 아입니꺼. 자꾸 그카시면 안 됩니더.",
    why: "실측 Q34 원문 — 말씨가 사투리라고 현실 직면 강요가 아닌 것은 아닙니다",
    cf: false,
    advisory: ["RE-02"],
  },
  {
    id: "bc-82",
    utterance: "어머님, 여기가 어머님 댁이에요.",
    why: "호칭이 사이에 끼어도 「여기가 댁」 계열입니다 (검증셋 A01-D1a)",
    cf: false,
    advisory: ["RE-02"],
  },
  {
    id: "bc-83",
    utterance: "여기가 댁이잖아요, 어디를 가시려고요.",
    why: "종결어미가 달라져도 같은 계열이라 어간으로 잡습니다",
    cf: false,
    advisory: ["RE-02"],
  },
  {
    id: "bc-84",
    utterance: "어무이, 시장하신가 봅니더. 어떤 걸 드시고 싶으신교?",
    why: "감정을 먼저 물은 사투리 문장은 코칭도 남기면 안 됩니다",
    cf: false,
    noAdvisory: true,
  },

  /* ── 보고 구간의 회고·인용 — bc-85~bc-87 ──────────────────
     사건이 끝난 뒤 「무슨 말을 들었고 무엇을 했는지」 사실대로 적는 문장이 규칙에 걸리면,
     규칙이 「기록을 남기지 말라」는 신호가 됩니다 — 옳게 말한 사람이 벌받는 구조입니다. */
  {
    id: "bc-85",
    utterance: "어르신이 여기가 자기 댁이 아니라고 하셨습니다.",
    why: "어르신이 하신 말씀을 옮겨 적는 문장은 강요가 아닙니다",
    scenarioType: "BPSD",
    cueId: "CUE-4",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-86",
    utterance: "어르신이 여기가 어머님 댁이 아니라고 하셔서, 그 말씀을 그대로 적겠습니다.",
    why: "어간을 넓힌 뒤에도 인용 어미(「아니라고」)가 붙으면 기록으로 읽어야 합니다",
    scenarioType: "BPSD",
    cueId: "CUE-4",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-87",
    utterance: "보호자께서 묶어 두라고 하신 요구도 그대로 기록하겠습니다.",
    why: "받았던 요구를 사실대로 적는 보고 구간 진술은 억제 행위가 아닙니다",
    scenarioType: "CONFLICT",
    cueId: "CUE-C4",
    cf: false,
    noAdvisory: true,
  },

  /* ── 남은 경계 두 개 — bc-88~bc-89 ────────────────────── */
  {
    id: "bc-88",
    utterance: "가둬 두는 방법은 쓰지 않겠습니다.",
    why: "「가둬」가 부정 창 안에 있으면 그대로 통과시켜야 합니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-89",
    utterance: "혀를 잡아 당겨 기도를 확보하겠습니다.",
    why: "기도 확보라는 명분이 붙어도 구강 내 조작입니다",
    cf: true,
    ruleId: "CF-ORAL",
  },

  /* ── 부정 어휘가 덮는 자리 — bc-94~bc-96 ──────────────────
     같은 낱말을 쓰면서 「하지 않는다」고 말하는 문장은 부정 표지가 매치 뒤 10글자 안에
     들어올 때만 통과합니다. 아래 셋은 그 창 안에서 표지가 잡히는 것을 고정합니다. */
  {
    id: "bc-94",
    utterance: "억제대는 사용이 금지되어 있습니다.",
    why: "「금지」가 부정 창 안에 들어옵니다 — 도구 이름을 화제로 놓고 금지를 설명하는 문장입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-95",
    utterance: "결박은 제가 해 드릴 수 없습니다.",
    why: "요구를 거절하는 갈등 시나리오의 모범 문형 — 「없」이 부정 창 안에 있습니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-96",
    utterance: "베란다를 잠그지 않고 말로 설득하겠습니다.",
    why: "목적어까지 적힌 신호(「베란다를 잠」)도 부정 창에서 그대로 통과해야 합니다",
    cf: false,
    noAdvisory: true,
  },

  /* ── 요구를 옮긴 말도, 문맥이 없으면 멈춰 세운다 — bc-97~bc-104 ─
     화자 의도(누가 요구했나)를 문자열 구조로 가르는 시도는 레드팀에서 양방향으로 무너졌습니다
     (우회 54 · 오탐 51). 그래서 전역 사전은 보수적으로 둡니다 — 문장 하나만 보고 화자가 그것을
     하려는지 거절하는지 가를 방법이 없기 때문입니다. 거절이 **과제인** 자리는 국면 게이트가
     따로 맡습니다(bc-124 이하). 아래는 게이트 밖에서 그대로 멈춰 세워야 하는 문형입니다. */
  {
    id: "bc-97",
    utterance: "문을 잠글 거라고 말씀드렸잖아요.",
    why: "「거라고」는 남의 요구가 아니라 자기 의지입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-98",
    utterance: "묶어 달라고 하셔서 묶어 두겠습니다.",
    why: "요구를 옮긴 뒤 그대로 하는 문형입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-99",
    utterance: "잠가 달라는 부탁대로 문을 잠갔습니다.",
    why: "인용 뒤에 실행이 붙으면 인용이 면죄부가 되지 않습니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-100",
    utterance: "억제대를 채우겠습니다.",
    why: "목적어로 쓴 도구는 그대로 행위 선언입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-101",
    utterance: "결박해서라도 막겠습니다.",
    why: "사유를 앞세워도 행위는 그대로입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-102",
    utterance: "억제대는 금지지만 오늘은 묶어 둘게요.",
    why: "앞 절이 부정이어도 뒤에 남은 행위 선언은 그대로 잡습니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-103",
    utterance: "베란다를 잠그겠습니다.",
    why: "「문을 잠」이 없는 자리 — 목적어를 함께 적은 신호가 메웁니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-104",
    utterance: "붙잡으라는 지시를 따르겠습니다.",
    why: "인용 뒤에 순응이 붙으면 실행 선언입니다 — 매치가 하나뿐이라 여기서 놓치면 끝입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },

  /* ── 참양성 기여 0인 용어를 걷어 낸 자리 — bc-105~bc-110 ───
     실측으로 「이 용어가 잡은 참양성이 한 건도 없고 오탐만 냈다」가 확인된 신호를 지웠습니다.
     지운 쪽(모범 발화)과 남긴 쪽(같은 규칙의 진짜 위반)을 나란히 둡니다. */
  {
    id: "bc-105",
    utterance: "약을 반드시 처방대로 드리겠습니다.",
    why: "홑 「약을 반」이 「반드시」를 삼켰습니다 — 처방대로 돕는 것은 모범 대응입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-106",
    utterance: "용량 조절은 간호사님께 여쭤보겠습니다.",
    why: "홑 「용량 조절」이 판단을 넘기는 문장을 삼켰습니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-107",
    utterance: "제 팔 잡아 보시겠어요?",
    why: "홑 「팔 잡아」가 이 앱 자신의 권장 대안을 삼켰습니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-108",
    utterance: "가방을 잠그고 함께 나가시겠어요?",
    why: "홑 「잠그」가 잠그는 대상을 가리지 않아 정상 발화를 삼켰습니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-109",
    utterance: "제가 잠그라고 지시했습니다.",
    why: "목적어가 빠져도 남에게 시키는 꼴(「잠그라」)은 그대로 지시입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-110",
    utterance: "어르신을 묶겠습니다.",
    why: "「묶어」·「묶고」만으로는 놓치던 활용형입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },

  /* ── 부정 어휘 보수 — bc-111~bc-123 ───────────────────────
     부정 창의 **폭(10)은 그대로 두고** 어휘만 넓혔습니다. 넓힌 쪽만 검사하면 진짜 선언이
     조용히 새어 나가므로, 해소되는 오탐과 유지되는 차단을 같은 자리에서 함께 봅니다.
     홑 「못」은 일부러 넣지 않았습니다 — "붙잡고 못 가시게 하겠습니다"를 면죄하기 때문입니다. */
  {
    id: "bc-111",
    utterance: "결박은 못 합니다.",
    why: "용언에 붙은 「못 합」은 하지 않겠다는 말입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-112",
    utterance: "억제대는 못 씁니다.",
    why: "「못 씁」도 같은 거절입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-113",
    utterance: "결박은 몬 합니더.",
    why: "경상 말씨의 「몬 합」도 같은 거절입니다 — 판정선이 말씨를 타면 안 됩니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-114",
    utterance: "결박 그런 거 안 헙니다잉.",
    why: "전라 말씨의 「안 헙」도 같은 거절입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-115",
    utterance: "제가 붙잡은 적은 없습니다.",
    why: "과거 부인 진술입니다 — 하지 않았다고 말한 사람을 벌하면 안 됩니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-116",
    utterance: "억제대 사용 없이 대응했다고 보고드립니다.",
    why: "「없이」는 그 행위를 하지 않았다는 보고입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-117",
    utterance: "억제대는 쓸 수 없습니다.",
    why: "「쓸 수 없」은 요구를 거절하는 말입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-118",
    utterance: "문을 잠근 사실이 없습니다.",
    why: "사실관계를 부인하는 보고 진술입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-119",
    utterance: "몬 붙잡습니더.",
    why: "매치 **앞**에 붙은 경상 말씨 부정어(「몬」)도 표준어 「못」과 같이 읽습니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-120",
    utterance: "붙잡고 못 가시게 하겠습니다.",
    why: "여기 「못」은 화자의 행위가 아니라 **어르신을** 못 가게 만들겠다는 말입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-121",
    utterance: "붙잡을 수밖에 없습니다.",
    why: "「수밖에 없」은 못 하겠다는 말이 아니라 하겠다는 체념입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-122",
    utterance: "손목을 잡는 것도 어쩔 수 없죠.",
    why: "「어쩔 수 없」도 같은 체념 — 「없」 하나로 면죄되면 안 됩니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-123",
    utterance: "가둬 둘 수밖에 없습니다.",
    why: "같은 문형을 다른 동사로 한 번 더 고정합니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    // 「못하」를 부정 표지로 넣자마자 bc-04가 조용히 뒤집혔던 자리입니다 — 사동을 지웁니다.
    id: "bc-146",
    utterance: "나가지 못하게 방문을 잠그겠습니다.",
    why: "「못하게 하겠다」는 화자가 못 하는 것이 아니라 어르신을 못 하게 만들겠다는 말입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },

  /* ── 국면 게이트 — 거절·보고·성찰이 과제인 자리 — bc-124~bc-133 ─
     C02 CUE-C1(요구 거절)·CUE-C3(같은 사실 재진술)·CUE-5·6·7(보고·재발 방지·성찰)에서는
     학습자에게 요구하는 **모범 답안 자체에** 금지 행위의 이름이 들어갑니다. 그 자리에서는
     사전을 끄지 않고 **명시적 순응 문형으로 좁힙니다**(rules.ts의 complyOnlyCues).
     같은 문장을 문맥 유무로 두 번 넣어, 게이트가 열리는 자리와 전역 기본값을 함께 고정합니다. */
  {
    id: "bc-124",
    utterance: "묶어 두라는 요구는 받아들이지 않겠습니다.",
    why: "요구를 거절하는 것이 과제인 자리(C02 CUE-C1)의 모범 발화입니다",
    scenarioType: "CONFLICT",
    cueId: "CUE-C1",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-125",
    utterance: "묶어 두라는 요구는 받아들이지 않겠습니다.",
    why: "같은 문장이라도 문맥이 없으면 보수적 기본값 — 거절 술어가 부정 창 밖입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-126",
    utterance: "붙잡고 싶은 마음이 들었지만 하지 않았습니다.",
    why: "성찰이 과제인 자리(CUE-7)에서 충동을 적는 문장은 행위가 아닙니다",
    scenarioType: "BPSD",
    cueId: "CUE-7",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-127",
    utterance: "붙잡고 싶은 마음이 들었지만 하지 않았습니다.",
    // 한때 이 자리는 「문맥이 없으면 보수적 기본값(⚑CF)」의 짝이었습니다. CUE-5·6·7을 국면
    // 게이트에서 빼면서(그 자리에는 좁힌 사전이 놓친 말을 받을 ⚑CF 분기가 없었습니다)
    // 이 문형을 게이트가 아니라 **부정 표지 「싶은」**이 받게 되었고, 표지는 문맥을 타지 않습니다.
    // 그래서 짝의 뜻이 바뀌었습니다 — 지금 이 두 줄이 고정하는 것은 「충동 서술은 어느
    // 자리에서든 행위가 아니다」입니다. 게이트 유무를 가르는 짝은 bc-124/125가 그대로 맡습니다.
    why: "충동을 적는 말은 문맥이 없어도 행위가 아닙니다 — 게이트가 아니라 부정 표지가 받습니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-128",
    utterance: "말씀대로 밤에는 방문을 잠가 두겠습니다.",
    why: "게이트 CUE에서도 **하겠다고 선언한 말**은 좁힌 사전이 그대로 잡습니다",
    scenarioType: "CONFLICT",
    cueId: "CUE-C1",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-129",
    utterance: "다음부터는 문을 잠그겠습니다.",
    why: "재발 방지 자리(CUE-6)의 앞으로의 행위 선언도 그대로 멈춰 세웁니다",
    scenarioType: "BPSD",
    cueId: "CUE-6",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-130",
    utterance:
      "아까 말씀드린 대로, 묶어 두거나 방문을 잠가 달라는 요구는 법으로 허용되지 않는다고 안내드렸습니다.",
    why: "같은 사실을 그대로 다시 말하는 것이 과제인 자리(C02 CUE-C3)의 모범 발화입니다",
    scenarioType: "CONFLICT",
    cueId: "CUE-C3",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-131",
    utterance: "새벽 2시 10분 현관 앞에 서 계셔서, 현관문 잠금 여부를 확인하고 곁에서 함께 걸었습니다.",
    why: "야간 일지 보고(CUE-5) — 잠금 **여부를 확인한** 것은 잠근 것이 아닙니다",
    scenarioType: "BPSD",
    cueId: "CUE-5",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-132",
    utterance: "가로막고 싶은 충동이 있었다는 점을 적어 두겠습니다.",
    why: "성찰(CUE-6)에서 충동을 적는 문장을 벌하면 돌아보기가 사라집니다",
    scenarioType: "BPSD",
    cueId: "CUE-6",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-133",
    utterance: "묶거나 방문을 잠그는 것은 법으로 금지된 신체 자유 제한이라 해 드릴 수 없습니다.",
    why: "C02 CUE-C1이 스스로 제시하는 모범 답안입니다 — 이것이 막히면 시나리오가 성립하지 않습니다",
    scenarioType: "CONFLICT",
    cueId: "CUE-C1",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-147",
    utterance: "붙잡지 않고 곁에서 함께 걸었다는 점을 일지에 남기겠습니다.",
    why: "야간 일지 보고(CUE-5) — 하지 않았다고 적는 문장입니다",
    scenarioType: "BPSD",
    cueId: "CUE-5",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-148",
    utterance: "억제대는 사용하지 않았음을 기록합니다.",
    why: "도구 이름이 나왔다는 이유만으로 보고를 막으면 기록이 흐려집니다",
    scenarioType: "BPSD",
    cueId: "CUE-5",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-149",
    utterance: "다음 밤에는 문을 잠그는 대신 야간 등을 켜 두겠습니다.",
    why: "재발 방지(CUE-6)의 대체 행동 제안 — 「대신」 뒤는 억제가 아닙니다",
    scenarioType: "BPSD",
    cueId: "CUE-6",
    cf: false,
    noAdvisory: true,
  },

  /* ── 레드팀 우회 회귀 — bc-134~bc-145 ─────────────────────
     화자 의도를 문자열로 가르려던 라운드에서 **실제로 뚫린** 54문장의 대표입니다.
     인용 어미 한 마디("…라고 지시했습니다"), 의지 명사("잠글 참이라고"), 뒤 문장의 무관한
     거절("…다만 그 밖의 요구는 들어드릴 수 없습니다") — 셋이 우회로의 전부였습니다.
     여기 못 박아 두면, 같은 계열의 판별이 다시 들어오는 순간 이 목록부터 깨집니다. */
  {
    id: "bc-134",
    utterance: "제가 신입 선생님한테 야간에는 문을 잠그라고 지시했습니다.",
    why: "남에게 시킨 것도 화자의 행위입니다 — 인용 어미가 면죄부가 되면 안 됩니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-135",
    utterance: "제가 침대에 묶어 두라고 지시했습니다.",
    why: "같은 계열 — 「…라고 지시했습니다」 한 마디로 사전을 빠져나가던 자리입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-136",
    utterance: "붙잡으라는 지시대로 하겠습니다.",
    why: "지시를 옮긴 뒤 그대로 하겠다는 말은 실행 선언입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-137",
    utterance: "묶어 두라는 원장님 지시대로 진행하겠습니다.",
    why: "누가 지시했든 하는 사람은 화자입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-138",
    utterance: "오늘부터 병실 문을 잠글 참이라고 보고했습니다.",
    why: "「잠글 참이라고」는 남의 요구가 아니라 자기 계획입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-139",
    utterance: "밤에는 묶어 둘 예정이라고 기록했습니다.",
    why: "「예정이라고」도 같은 자기 계획입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-140",
    utterance: "억제대는 채우겠습니다. 다만 보호자님 요구는 들어드릴 수 없습니다.",
    why: "뒤 문장의 **무관한 거절**이 앞 문장의 실행 선언을 면죄하면 안 됩니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-141",
    utterance: "가두는 건 오늘부터 시행합니다. 면회 요청은 들어드릴 수 없습니다.",
    why: "같은 계열 — 거절의 대상이 다른 요구입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-142",
    utterance: "결박은 계속하겠습니다. 보호자 다른 요구는 따를 수 없습니다.",
    why: "「결박은」이 화제처럼 보여도 술어가 「계속하겠습니다」면 행위입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-143",
    utterance: "자물쇠는 그대로 두겠습니다. 풀어 달라는 요구는 들어드릴 수 없습니다.",
    why: "잠근 상태를 유지하겠다는 말도 문 잠그기입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-144",
    utterance: "문 잠가뿌라고 했심더.",
    why: "사투리로 시켰다고 판정선이 느슨해지면 안 됩니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-145",
    utterance: "인슐린을 놓으라는 지시대로 하겠습니다.",
    why: "억제(CO-02)만이 아니라 무면허 의료행위(CO-01)에서도 같은 우회로가 열렸습니다",
    cf: true,
    ruleId: "CF-INJECTION",
  },

  /* ── 2라운드 레드팀 · 부정 표지를 넓힌 자리 — bc-150~bc-167 ─────
     CUE-5·6·7을 국면 게이트에서 뺀 뒤(그 자리에는 좁힌 사전이 놓친 말을 받을 ⚑CF 분기가
     없었습니다), 성찰·확인 문형의 오탐을 게이트가 아니라 **부정 표지**가 받습니다.
     표지 하나마다 **공격 짝**을 함께 둡니다 — 넓힌 쪽만 검사하면 진짜 선언이 조용히 샙니다. */
  {
    id: "bc-150",
    utterance: "묶고 싶은 마음에 어르신을 묶겠습니다.",
    why: "「싶은」은 앞 동사만 덮습니다 — 뒤에 남은 실행 선언은 두 번째 매치가 그대로 잡습니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-151",
    utterance: "묶고 싶으니 침대에 묶겠습니다.",
    why: "「싶으니」는 표지가 아닙니다 — 욕구를 사유로 삼은 말은 그대로 멈춰 세웁니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-152",
    utterance: "붙잡기보다 옆에서 같이 걷겠습니다.",
    why: "「~기보다」 뒤에 오는 것은 대체 행동입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-153",
    utterance: "말리기보다 붙잡겠습니다.",
    why: "같은 표지라도 대조의 뒤쪽이 금지 행위면 그대로 잡습니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-154",
    utterance: "문 잠금 여부를 먼저 살피겠습니다.",
    why: "잠갔는지 **확인하는** 것은 잠그는 것이 아닙니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-155",
    utterance: "잠글지 여부와 무관하게 잠급니다.",
    why: "「여부」를 끼워 넣어도 뒤의 실행 선언은 그대로입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-156",
    utterance: "문을 잠그셨는지 확인해 보겠습니다.",
    why: "야간 인수인계에서 가장 많이 하는 확인 문형입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-157",
    utterance: "묶었는지 확인하고 다시 묶어 두겠습니다.",
    why: "확인 뒤에 실행이 붙으면 확인이 면죄부가 되지 않습니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-158",
    utterance: "결박 요구를 받으면 즉시 센터에 보고하겠습니다.",
    why: "요구를 **받은 쪽**의 보고 계획입니다 — 하겠다는 말이 아닙니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-159",
    utterance: "결박 요구가 있어서 결박했습니다.",
    why: "「요구가 있어(서)」는 표지가 아닙니다 — 요구를 사유로 삼아 실행한 말입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-160",
    utterance: "붙잡으려던 순간을 멈춘 것이 오늘의 개선점입니다.",
    why: "성찰에서 가장 많이 쓰는 미완의 의도 문형입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-161",
    utterance: "붙잡으려던 대로 붙잡겠습니다.",
    why: "같은 표지 뒤에 실행 선언이 오면 두 번째 매치가 잡습니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-162",
    utterance: "다음엔 못 나가시게 하기 전에 어디가 불편하신지부터 여쭙겠습니다.",
    why: "A02 CUE-7의 모범 답안 원문 — 「~하기 전에 먼저」는 순서를 뒤집겠다는 말입니다",
    scenarioType: "BPSD",
    cueId: "CUE-7",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-163",
    utterance: "못 나가시게 하겠습니다.",
    why: "「못 ~하시게 하겠다」는 부정문이 아니라 사동입니다 — 목적어가 어르신입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-164",
    utterance: "묶어 놔서 못하시게 하겠습니다.",
    why: "존경 선어말어미가 끼어도 사동은 사동입니다 (「못하」 표지로 면죄되던 자리)",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-165",
    utterance: "가둬 놓으면 나가지 못합니다.",
    why: "여기 「못합니다」는 화자의 거절이 아니라 **가둔 결과**입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-166",
    utterance: "붙잡지 못합니다.",
    why: "같은 「못합」이라도 동사가 화자의 행위면 그대로 거절입니다 — 가르는 것은 동사입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-167",
    utterance: "결박 요구를 받았지만 거절했다는 점을 기록하겠습니다.",
    why: "보고(CUE-5)가 게이트 밖으로 나온 뒤에도 요구 수신 보고는 조용해야 합니다",
    scenarioType: "BPSD",
    cueId: "CUE-5",
    cf: false,
    noAdvisory: true,
  },

  /* ── 홑 「없」을 걷어 낸 자리 — bc-168~bc-175 ────────────────────
     「없」 한 글자를 부정 표지로 두었더니, **행위를 정당화하는 말**이 전부 빠져나갔습니다
     ("붙잡아 두면 사고가 없습니다"). 무엇이 없는지를 함께 적은 결합형으로 바꾼 뒤의
     양쪽 경계입니다 — 해소되는 거절·부인은 bc-95·115~118이 이미 고정하고 있습니다. */
  {
    id: "bc-168",
    utterance: "붙잡아 두면 사고가 없습니다.",
    why: "「없다」가 부정하는 것은 사고이지 붙잡기가 아닙니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-169",
    utterance: "묶어 두는 게 안전에 문제 없습니다.",
    why: "같은 계열 — 안전을 근거로 든 정당화입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-170",
    utterance: "붙잡아도 아무 일 없습니다.",
    why: "「일 없다」를 표지에 넣지 않은 이유가 이 문장입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-171",
    utterance: "억제대를 채우면 사고 날 일이 없죠.",
    why: "「일이 없다」까지 넓히면 곧바로 빠져나가는 자리입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-172",
    utterance: "손목을 잡는 것도 어쩔 수 없습니다.",
    why: "「어쩔 수 없」은 체념이지 거절이 아닙니다 — 「수없습」 표지를 먼저 지웁니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-173",
    utterance: "붙잡는 것 말고는 답이 없어요.",
    why: "「A 말고는」은 A를 하겠다는 말입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-174",
    utterance: "밀치지 말고 손을 잡아 드리겠습니다.",
    why: "보조사가 붙지 않은 「말고」는 그대로 대체 행동입니다 — 좁혀 지운 이유입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-175",
    utterance: "가둬 두는 게 어렵지 않습니다.",
    why: "부정되는 말이 행위가 아니라 난이도입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },

  /* ── 활용형 결손을 **목적어와 함께** 메운 자리 — bc-176~bc-186 ──────
     좁힌 사전에는 「묶을게」·「잠그겠」이 있는데 전역 사전에 그 활용형이 없어,
     **문맥이 없을수록 관대한** 뒤집힌 판정선이 있었습니다.
     3라운드에 홑 활용형(「묶겠」·「잠그겠」·「고정하겠」)으로 메웠더니 이번에는
     **유도 정답**이 막혔습니다 — 가스·수도 차단과 침대 바퀴 고정은 치매 가정의 표준
     권고 사항인데, 그 말을 한 학습자가 「신체 자유 제한」으로 멈춰 세워졌습니다(실측 6건).
     그래서 활용형은 **누구를·어디에·무엇을**과 함께만 받습니다. 목적어가 없거나
     사전 밖인 문형은 잡지 못하며(한계 ⑤ · bc-180·181), 그 경계도 케이스로 적어 둡니다. */
  {
    id: "bc-176",
    utterance: "어르신을 묶을게요.",
    why: "「묶을게」는 좁힌 사전에만 있던 활용형입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-177",
    utterance: "머리를 묶을게요.",
    why: "일상 목적어는 예외어로 가릅니다 — 목적어와 동사를 **함께** 적어 창을 좁혔습니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-178",
    utterance: "침대에 묶습니다.",
    why: "「묶습니다」도 같은 결손이었습니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-179",
    utterance: "어르신을 가둘게요.",
    why: "「가둘게」 역시 좁힌 사전에만 있었습니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-180",
    utterance: "셔터를 잠그겠습니다.",
    why: "**문서화된 한계 ⑤** — 비주거 목적어(셔터·게이트)의 잠금 선언은 잡지 못합니다. 홑 「잠그겠」을 넣으면 「가스 밸브를 잠그겠습니다」 같은 유도 정답이 함께 막힙니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-181",
    utterance: "제가 잠그겠습니다.",
    why: "**문서화된 한계 ⑤** — 목적어를 생략한 잠금 선언도 같은 자리입니다. 1라운드 사전도 잡지 못하던 문형이며, 목적어를 되찾는 값으로 내준 자리입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-181b",
    utterance: "출입구를 잠그겠습니다.",
    why: "목적어가 **드나드는 곳**이면 잠금 선언입니다 — 한계 ⑤가 어디서 끝나는지 함께 못 박습니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-181c",
    utterance: "안쪽에서 잠그겠습니다.",
    why: "목적어가 없어도 잠그는 **자리**가 적히면 어르신을 안에 두는 말입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-182",
    utterance: "베란다 창문은 잠그는 걸로 하고, 다른 요구는 받아들이지 않겠습니다.",
    why: "조사가 은/는인 꼴 — 「문 잠」으로는 미탐이던 자리이고, 뒤 문장의 거절은 다른 요구에 걸립니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-183",
    utterance: "약장은 잠그겠습니다.",
    why: "약장 잠금은 오히려 안전 관리입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-184",
    utterance: "가방을 잠그고 나가겠습니다.",
    why: "「잠그고」를 사전에 넣은 뒤에도 일상 발화는 조용해야 합니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-185",
    utterance: "가방을 챙기고 문을 잠그겠습니다.",
    why: "예외어가 창 안에 들어와도 **다른 신호**가 남습니다 — 끼워 넣기 우회를 막는 자리입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-186",
    utterance: "신발끈을 묶어 드릴까요?",
    why: "돌봄 현장의 일상 발화입니다",
    cf: false,
    noAdvisory: true,
  },

  /* ── 억제 도구는 「억제대」라고 불리지 않는다 — bc-187~bc-192 ────
     2라운드 레드팀이 억제 요구 자리(C02 CUE-C1)에서 뚫은 문형입니다. 현장에서 억제는
     「묶다」가 아니라 「고정한다」로 말해지고, 도구는 안전벨트·안전띠·조끼형 보호구
     ·손모아장갑이라는 이름을 답니다. 좁힌 사전과 전역 사전 **양쪽에** 넣었습니다. */
  {
    id: "bc-187",
    utterance: "억제대로 고정해 두겠습니다.",
    why: "거절이 과제인 자리에서도 하겠다고 선언하면 그대로 멈춰 세웁니다",
    scenarioType: "CONFLICT",
    cueId: "CUE-C1",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-188",
    utterance: "안전벨트로 침대에 고정하겠습니다.",
    why: "도구 이름이 「억제대」가 아닐 뿐 같은 물건입니다",
    scenarioType: "CONFLICT",
    cueId: "CUE-C1",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-189",
    utterance: "붙잡아서 방으로 모시겠습니다.",
    why: "게이트 구간의 ⚑CF 케이스가 문 잠그기에만 몰려 있어 「붙잡아서」가 비어 있었습니다",
    scenarioType: "CONFLICT",
    cueId: "CUE-C1",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-190",
    utterance: "야간에는 병실 밖으로 못 나오시게 하겠습니다.",
    why: "사투리 「몬 나오게」만 있고 표준어 꼴이 비어 있던 자리입니다",
    scenarioType: "CONFLICT",
    cueId: "CUE-C1",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-191",
    utterance: "네, 밤에는 방문을 잠가 두는 걸로 하겠습니다.",
    why: "결정 어미로 돌려 말해도 실행 선언입니다",
    scenarioType: "CONFLICT",
    cueId: "CUE-C1",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-192",
    utterance: "억제대 사용 여부를 센터에 확인해 보겠습니다.",
    why: "같은 자리에서 판단을 넘기는 문장은 조용해야 합니다",
    scenarioType: "CONFLICT",
    cueId: "CUE-C1",
    cf: false,
    noAdvisory: true,
  },

  /* ── 게이트에서 나온 보고·성찰 자리 — bc-193~bc-195 ─────────────
     CUE-5·6·7에서는 좁힌 사전이 놓친 말을 받아 줄 ⚑CF 분기가 **어느 시나리오에도 없었고**,
     그래서 앞으로의 행위 선언이 아무 되먹임 없이 통과했습니다(레드팀 실측 63건).
     지금은 전역 사전이 그대로 돕니다 — 그 자리가 살아 있는지 못 박아 둡니다. */
  {
    id: "bc-193",
    utterance: "다음엔 그냥 붙잡아야겠어요.",
    why: "성찰(CUE-7)의 결론이 재발 선언이면 멈춰 세워야 합니다",
    scenarioType: "BPSD",
    cueId: "CUE-7",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-194",
    utterance: "앞으로는 억제대를 채웁니다.",
    why: "보고(CUE-5) 자리의 앞으로의 행위 선언도 회고 진술이 아닙니다",
    scenarioType: "BPSD",
    cueId: "CUE-5",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-195",
    utterance: "다음엔 자물쇠를 답니다.",
    why: "재발 방지(CUE-6) 자리에서 도구를 달겠다는 말입니다",
    scenarioType: "BPSD",
    cueId: "CUE-6",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },

  /* ── 넓힌 사전의 반대쪽 — bc-196~bc-212 ─────────────────────────
     2라운드에 사전(활용형·억제 도구·사동 선언)과 부정 표지를 함께 넓혔습니다. 넓힌 쪽만
     케이스로 두면 목록이 「잡히는지」만 보게 되고, 이 파일이 고르는 기준(**걸리면 안 되는
     문장**)이 뒤집힙니다. 새로 넣은 신호마다 **하지 않겠다고 말한 문장**을 나란히 둡니다. */
  {
    id: "bc-196",
    utterance: "침대에 고정해 두지는 않겠습니다.",
    why: "「고정해 두」를 사전에 넣은 뒤에도 부정문은 그대로 통과해야 합니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-197",
    utterance: "안전띠로 고정하지는 않겠습니다.",
    why: "도구 이름이 나왔다는 이유만으로 잡으면 거절한 사람이 벌을 받습니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-198",
    utterance: "손모아장갑은 사용하지 않겠습니다.",
    why: "같은 계열 — 억제 기구를 화제로 놓고 쓰지 않겠다고 밝힌 문장입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-199",
    utterance: "조끼형 보호구는 쓰지 않고 야간 등을 켜 두겠습니다.",
    why: "대체 행동까지 얹은 모범 문형입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-200",
    utterance: "못 나가시게 막는 대신 함께 산책을 나가 보겠습니다.",
    why: "「못 ~하시게」를 사전에 넣은 뒤에도 「대신」 뒤의 대체 행동은 억제가 아닙니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-201",
    utterance: "묶는 것은 법이 금지한 행위라고 안내드렸습니다.",
    why: "「묶는」 활용형을 넣은 뒤에도 금지를 설명하는 문장은 조용해야 합니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-202",
    utterance: "잠그는 것은 하지 않고 야간 등을 켜 두겠습니다.",
    why: "「잠그는」도 마찬가지입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-203",
    utterance: "가둘 수 없다고 말씀드렸습니다.",
    why: "「~할 수 없다고 말씀드렸다」는 거절을 보고하는 문형입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-204",
    utterance: "가둬 두는 대신 거실에서 함께 있겠습니다.",
    why: "대체 행동 제안입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-205",
    utterance: "머리카락을 묶어 드리고 세수를 도와드리겠습니다.",
    why: "일상 돌봄 발화 — 예외어를 목적어와 함께 적어 가릅니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-206",
    utterance: "짐을 묶어 정리해 두겠습니다.",
    why: "같은 계열 — 「묶어」의 목적어가 사람이 아닙니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-207",
    utterance: "금고는 잠그고 나가겠습니다.",
    why: "귀중품 보관은 오히려 해야 하는 일입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-208",
    utterance: "서랍은 잠그는 걸로 하겠습니다.",
    why: "「잠그는 걸로」가 순응 문형이라도 목적어가 서랍이면 억제가 아닙니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-209",
    utterance: "휠체어 안전벨트는 이동 중에만 쓰고 도착하면 바로 풀어 드리겠습니다.",
    why: "이동 중 안전벨트는 억제가 아닙니다 — 「안전벨트로 고정」과 갈리는 자리입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-210",
    utterance: "억제대 사용 여부는 간호사님께 여쭤보겠습니다.",
    why: "판단을 넘기는 문장이 도구 이름 때문에 막히면 안 됩니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-211",
    utterance: "침대 난간은 한쪽만 올리고 나머지는 내려 두겠습니다.",
    why: "난간 전부 올리기(「다 올려」)와 한쪽만 올리기는 다른 행위입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-212",
    utterance: "붙잡으신 분이 있는지 확인하겠습니다.",
    why: "누가 붙잡았는지 **확인하는** 것은 붙잡는 것이 아닙니다",
    cf: false,
    noAdvisory: true,
  },

  /* ── 자체 레드팀이 다시 뚫은 자리 — bc-213~bc-224 ────────────────
     넓힌 표지·사전을 상대로 같은 라운드에서 한 번 더 공격해 얻은 문장들입니다.
     ① 「~실 수 없습니다」의 주어가 어르신인 꼴 ② 요구 수신을 사유로 삼은 꼴
     ③ 이름이 다른 억제 기구(복대·벨트) ④ 사동 「못 일어나시게」.
     닫으면서 새로 위태로워진 일상 발화(휠체어 브레이크·바지 벨트·사물함)를 나란히 둡니다. */
  {
    id: "bc-213",
    utterance: "가둬 두면 나가실 수 없습니다.",
    why: "「~실 수 없」의 주어는 화자가 아니라 어르신입니다 — 거절이 아니라 가둔 결과입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-214",
    utterance: "묶어 두면 일어나실 수 없습니다.",
    why: "같은 계열 — 「수없습」 표지가 화자의 거절인 줄 알고 면죄하던 자리입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-215",
    utterance: "묶어 달라는 요구를 받았고 그대로 묶었습니다.",
    why: "요구 수신 표지를 조건·대조 어미(받으면·받았지만)로 좁힌 이유가 이 문장입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-216",
    utterance: "복대를 채워 두겠습니다.",
    why: "복대도 억제 기구입니다 — 이름이 「억제대」가 아닐 뿐입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-217",
    utterance: "이불을 무겁게 덮어 못 일어나시게 하겠습니다.",
    why: "도구가 없어도 일어나지 못하게 만들면 신체 자유 제한입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-218",
    utterance: "휠체어에 앉으신 뒤 벨트를 채우겠습니다.",
    why: "예외어(「휠체어」)가 창 밖으로 밀려나면 벨트 채우기는 그대로 잡힙니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-219",
    utterance: "휠체어 브레이크를 잠그겠습니다.",
    why: "브레이크 잠금은 오히려 낙상 예방입니다 — 어간 활용형을 넣으며 새로 생긴 오탐입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-220",
    utterance: "바지 벨트를 채워 드리겠습니다.",
    why: "옷을 입혀 드리며 채우는 벨트는 억제 기구가 아닙니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-221",
    utterance: "허리띠를 채워 드리고 옷매무새를 살피겠습니다.",
    why: "같은 계열 — 「허리띠로 고정하겠습니다」와는 갈립니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-222",
    utterance: "사물함은 잠그는 걸로 하겠습니다.",
    why: "사람이 아닌 것을 잠그는 말은 조사가 은/는이어도 억제가 아닙니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-223",
    utterance: "복대는 사용하지 않겠습니다.",
    why: "새 도구 이름을 넣은 뒤에도 거절문은 그대로 통과해야 합니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-224",
    utterance: "못 일어나시게 하지 않고 곁에서 지켜보겠습니다.",
    why: "사동 신호를 넣은 뒤에도 「하지 않고」 뒤의 대체 행동은 억제가 아닙니다",
    cf: false,
    noAdvisory: true,
  },

  /* ── 3라운드 레드팀 · 목적어 결합 복원 — bc-225~bc-240 ────────────
     홑 활용형이 삼키던 **일상 돌봄 발화**를 되찾은 자리입니다. 되찾은 쪽만 넣으면 이 파일이
     다시 한쪽으로 기울므로, 같은 어간의 **억제 문형**을 짝으로 둡니다. */
  {
    id: "bc-225",
    utterance: "가스 밸브를 잠그겠습니다.",
    why: "가스 차단은 치매 가정의 표준 권고 사항입니다 — 「잠그겠」이 홑으로 있던 자리",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-226",
    utterance: "수도를 잠그고 나오겠습니다.",
    why: "같은 계열 — 잠그는 대상이 사람이 드나드는 곳이 아닙니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-227",
    utterance: "침대 바퀴를 고정해 두겠습니다.",
    why: "바퀴 고정은 오히려 낙상 예방입니다 — 「고정해 두」가 홑으로 있던 자리",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-228",
    utterance: "미끄럼 방지 매트를 고정하겠습니다.",
    why: "같은 계열 — 고정하는 대상이 어르신의 몸이 아닙니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-229",
    utterance: "붕대를 고정하겠습니다.",
    why: "드레싱 고정은 상처 관리입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-230",
    utterance: "수액 줄을 고정하겠습니다.",
    why: "같은 계열 — 줄이 빠지지 않게 두는 말입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-231",
    utterance: "쓰레기 봉투를 묶겠습니다.",
    why: "「묶겠」이 홑으로 있어 살림 발화를 삼키던 자리입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-232",
    utterance: "앞치마를 묶겠습니다.",
    why: "같은 계열 — 묶는 대상이 사람이 아닙니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-233",
    utterance: "환자복 끈을 묶어 드리겠습니다.",
    why: "옷 끈을 매어 드리는 것은 돌봄입니다 — 억제는 「끈으로 묶」·「끈으로 고정」입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-234",
    utterance: "차량 이송 중에는 안전벨트를 매 드립니다.",
    why: "차량 이송 중 착용은 요양보호사의 법정 업무입니다 — 「안전벨트를 매」가 홑으로 있던 자리",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-235",
    utterance: "묶을 끈도 없습니다.",
    why: "「묶을」이 홑으로 있어 **없다는 말**까지 잡던 자리입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-236",
    utterance: "가둘 생각은 없습니다.",
    why: "같은 계열 — 하지 않겠다는 말입니다",
    cf: false,
    noAdvisory: true,
  },
  /* 짝 — 같은 어간이 목적어·자리와 함께 오면 그대로 멈춰 세웁니다. */
  {
    id: "bc-237",
    utterance: "침대에 고정하겠습니다.",
    why: "고정하는 자리가 침대면 억제 기구입니다 — bc-227과 갈리는 선입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-238",
    utterance: "어르신 손목을 묶겠습니다.",
    why: "묶는 대상이 사람이면 신체 억제입니다 — bc-231과 갈리는 선입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-239",
    utterance: "침대에 안전벨트로 고정하겠습니다.",
    why: "같은 벨트라도 침대에 고정하면 억제입니다 — bc-234와 갈리는 선입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-240",
    utterance: "방문은 잠그는 걸로 하겠습니다.",
    why: "조사가 은/는이어도, 잠그는 대상이 드나드는 문이면 억제입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },

  /* ── 유도 정답이 막히던 자리 — bc-241~bc-246 ─────────────────────
     A01 CUE-5 · A02 CUE-6은 "다음에 같은 일이 생기지 않으려면 무엇을 바꿀까요"를 묻고,
     그 자리의 유도 정답 패턴이 조명·야간 순회·화장실 안내 같은 **환경 개선**입니다.
     학습자는 거기에 가스·수도 차단과 바퀴 고정을 얹어 말합니다 — 표준 권고 사항이기 때문입니다.
     그 문장이 ⚑CF로 멈춰 세워지면, 정답을 말한 사람이 벌을 받습니다. 자리째 못 박아 둡니다. */
  {
    id: "bc-241",
    utterance: "야간 순회 시간을 앞당기고 침대 바퀴를 고정해 두겠습니다.",
    why: "A02 CUE-6 재발 방지의 유도 정답입니다",
    scenarioType: "BPSD",
    cueId: "CUE-6",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-242",
    utterance: "복도 등을 켜 두고 미끄럼 방지 매트를 고정하겠습니다.",
    why: "같은 자리 — 조명과 매트는 낙상 예방의 표준 조치입니다",
    scenarioType: "BPSD",
    cueId: "CUE-6",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-243",
    utterance: "조명을 켜 두고 가스 밸브를 잠그겠습니다.",
    why: "같은 자리 — 가스 차단은 치매 가정 안전 점검의 첫 줄입니다",
    scenarioType: "BPSD",
    cueId: "CUE-6",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-244",
    utterance: "조명을 미리 켜 두고 수도를 잠그고 나오겠습니다.",
    why: "A01 CUE-5 재발 방지의 유도 정답입니다",
    scenarioType: "BPSD",
    cueId: "CUE-5",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-245",
    utterance: "15시 30분에 화장실 안내를 하고 가스 밸브를 잠가 두겠습니다.",
    why: "「잠가」는 1라운드부터 있던 신호입니다 — 목적어 예외어가 없으면 유도 정답이 막힙니다",
    scenarioType: "BPSD",
    cueId: "CUE-5",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-246",
    utterance: "야간 순회를 늘리고 현관 잠금 상태를 점검하겠습니다.",
    why: "잠금 **상태를 점검**하는 것은 잠그는 것이 아닙니다",
    scenarioType: "BPSD",
    cueId: "CUE-6",
    cf: false,
    noAdvisory: true,
  },

  /* ── 보고·성찰 게이트를 좁히기로 바꾼 자리 — bc-247~bc-254 ─────────
     C02 CUE-C4·CUE-C6은 규칙을 **통째로 껐던** 자리입니다. 그래서 "다음엔 그냥
     붙잡아야겠어요"처럼 앞으로의 행위를 선언해도 아무 되먹임이 없었습니다.
     지금은 순응 문형으로 좁힙니다 — 회고 진술은 통과하고 실행 선언만 멈춰 세웁니다. */
  {
    id: "bc-247",
    utterance:
      "밤에 침대에 묶어두거나 방문을 잠가 달라는 요구가 있어 법으로 허용되지 않는다고 말씀드렸습니다.",
    why: "C02 CUE-C4 모범 보고 원문입니다 — 받은 요구를 요구받은 말 그대로 적습니다",
    scenarioType: "CONFLICT",
    cueId: "CUE-C4",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-248",
    utterance: "묶어 두거나 방문을 잠가 달라는 요구가 있었고, 저는 안 된다고 말씀드렸습니다.",
    why: "같은 자리의 회고 진술 — 사실을 적는 문장이 막히면 「기록을 남기지 말라」가 됩니다",
    scenarioType: "CONFLICT",
    cueId: "CUE-C4",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-249",
    utterance: "다음엔 부인하기 전에 확인된 사실과 확인되지 않은 것을 먼저 나눠 말씀드리겠습니다.",
    why: "C02 CUE-C6 성찰 모범 답안입니다",
    scenarioType: "CONFLICT",
    cueId: "CUE-C6",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-250",
    utterance: "다음엔 그냥 붙잡아야겠어요.",
    why: "성찰 자리의 결론이 재발 선언이면 그 자리에서 멈춰 세워야 합니다 — 게이트를 끄면 비는 자리였습니다",
    scenarioType: "CONFLICT",
    cueId: "CUE-C6",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-251",
    utterance: "앞으로는 억제대를 채웁니다.",
    why: "보고 자리의 앞으로의 행위 선언도 회고 진술이 아닙니다",
    scenarioType: "CONFLICT",
    cueId: "CUE-C4",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-252",
    utterance: "다음엔 침대에 묶습니다.",
    why: "평서형 실행 선언 — 좁힌 사전이 의지 어미(~겠)에만 기대던 자리입니다",
    scenarioType: "CONFLICT",
    cueId: "CUE-C6",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-253",
    utterance: "앞으로는 가두기로 했습니다.",
    why: "결정 어미로 돌려 말해도 실행 선언입니다",
    scenarioType: "CONFLICT",
    cueId: "CUE-C4",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-254",
    utterance: "다음엔 못 나오시게 하겠습니다.",
    why: "사동 선언은 부정문처럼 보이지만 목적어가 어르신입니다",
    scenarioType: "CONFLICT",
    cueId: "CUE-C6",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },

  /* ── 응급 종료 게이트를 규칙별로 가른 자리 — bc-255~bc-261 ─────────
     술기·기구 5종은 좁히고(1인칭 의도형만 ⚑CF), 상황 의존 4종은 전면 오프를 유지합니다.
     가르는 기준은 「그 자리에서 그 말이 정답일 수 있는가」입니다. */
  {
    id: "bc-255",
    utterance: "앞으로는 제가 석션하겠습니다.",
    why: "보고·성찰 자리라도 흡인을 **내가 하겠다**는 말은 업무 범위 밖입니다",
    scenarioType: "EMERGENCY",
    cueId: "CUE-6",
    cf: true,
    ruleId: "CF-SUCTION",
  },
  {
    id: "bc-256",
    utterance: "구급대원이 흡인기를 사용했습니다.",
    why: "같은 자리의 3인칭·과거 보고입니다 — 사실을 적는 문장은 그대로 통과합니다",
    scenarioType: "EMERGENCY",
    cueId: "CUE-5",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-257",
    utterance: "다음엔 손가락 넣어서 빼내겠습니다.",
    why: "재발 방지 자리의 구강 내 조작 선언 — 게이트를 끄면 비던 자리입니다",
    scenarioType: "EMERGENCY",
    cueId: "CUE-7",
    cf: true,
    ruleId: "CF-ORAL",
  },
  {
    id: "bc-258",
    utterance: "119 상황실이 지도한 대로 따랐다고 기록하겠습니다.",
    why: "같은 자리의 회고 진술입니다",
    scenarioType: "EMERGENCY",
    cueId: "CUE-6",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-259",
    utterance: "다음엔 식사 중 물을 조금씩 드리겠습니다.",
    why: "재발 방지 자리에서 물을 나눠 드리는 것은 **정답**입니다 — 상황 의존 4종은 전면 오프를 유지합니다",
    scenarioType: "EMERGENCY",
    cueId: "CUE-7",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-260",
    utterance: "물 좀 드세요.",
    why: "기도 폐쇄가 진행 중인 실시간 구간은 게이트 밖입니다 — 같은 말이 그대로 ⚑CF입니다",
    scenarioType: "EMERGENCY",
    cueId: "CUE-1",
    cf: true,
    ruleId: "CF-FLUID",
  },
  {
    id: "bc-261",
    utterance: "다음엔 인공호흡을 하겠습니다.",
    why: "술기 선언은 보고 자리에서도 멈춰 세웁니다",
    scenarioType: "EMERGENCY",
    cueId: "CUE-6",
    cf: true,
    ruleId: "CF-RESCUE-BREATH",
  },

  /* ── 돌아보는 표지 + 실행 취소어 — bc-262~bc-275 ─────────────────
     「싶은/려던/기보다/여부/는지·요구를받으」는 하지 않은 일을 적는 말이라 면죄하지만,
     **뒤에 실행이 붙으면 뜻이 뒤집힙니다.** 3라운드 레드팀이 이 자리로 11문장을 뚫었습니다.
     표지마다 통과 짝과 공격 짝을 나란히 둡니다. */
  {
    id: "bc-262",
    utterance: "가두고 싶은 마음이 커서 오늘부터 그렇게 합니다.",
    why: "충동을 적은 것처럼 보이지만 결론이 실행입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-263",
    utterance: "붙잡고 싶은 마음이 들었지만 그렇게 하지 않았습니다.",
    why: "같은 표지·같은 취소어라도 그 자리에서 다시 부정되면 성찰입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-264",
    utterance: "붙잡고 싶은 마음이 들었지만 하지 않았습니다. 오늘부터 야간 등을 켜 두겠습니다.",
    why: "앞 문장에서 이미 부정으로 결론이 났으면, 뒤 문장의 「오늘부터」는 실행이 아닙니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-265",
    utterance: "묶어 두고 싶은 만큼만 그리 합니다.",
    why: "「그리 합니다」는 대용어로 적은 실행 선언입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-266",
    utterance: "붙잡기보다 확실한 게 없어서 그리 했습니다.",
    why: "「기보다」 뒤가 대체 행동이 아니라 실행이면 대조가 아닙니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-267",
    utterance: "가두기보다 나은 수가 없어 그대로 갑니다.",
    why: "같은 계열 — 「그대로 갑니다」도 실행입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-268",
    utterance: "잠글지 여부는 이미 정했고 오늘 밤부터입니다.",
    why: "「여부」는 판단을 미루는 말인데 이미 정했다고 적혀 있습니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-269",
    utterance: "묶을지 여부는 제가 알아서 하겠습니다.",
    why: "같은 계열 — 「알아서 하겠습니다」가 실행입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-270",
    utterance: "가두는지 확인만 하고 그대로 둡니다.",
    why: "확인 표지 뒤에 「그대로 둡니다」가 오면 확인이 면죄부가 되지 않습니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-271",
    utterance: "문 잠금 여부는 제가 판단해서 그리 합니다.",
    why: "같은 계열입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-272",
    utterance: "묶어 달라는 요구를 받으면 그대로 해 드리겠습니다.",
    why: "조건형 「요구를 받으면」도 뒤에 순응이 붙으면 보고가 아닙니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-273",
    utterance: "가둬 달라는 요구를 받으면 그날부터 시행합니다.",
    why: "같은 계열 — 시점을 적은 실행 선언입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-274",
    utterance: "가두려던 대로 진행합니다.",
    why: "동사가 되풀이되지 않아도 「~하려던 대로」는 미완의 의도를 되살린 말입니다 (「묶으려던 대로」는 어간이 남지 않아 한계 ⑤입니다)",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-275",
    utterance: "붙잡으려던 대로 하지 않았습니다.",
    why: "같은 「려던 대로」라도 뒤가 부정이면 그대로 성찰입니다",
    cf: false,
    noAdvisory: true,
  },

  /* ── 확인·점검 문형과 「없」 결합형 — bc-276~bc-284 ────────────────
     확인 술어는 확인·점검·여쭤봄·살펴봄으로 갈리는데, 어미 한 마디가 어긋날 때마다
     옳은 답이 막혔습니다. 넓힌 값은 실행 취소어가 치릅니다. */
  {
    id: "bc-276",
    utterance: "문 잠금 상태를 점검하겠습니다.",
    why: "잠금 **상태를 점검**하는 것은 잠그는 것이 아닙니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-277",
    utterance: "잠금장치가 걸려 있는지 보겠습니다.",
    why: "「는지 확인」만 알던 표지가 「는지 보」에서 어긋나 막히던 자리입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-278",
    utterance: "누가 붙잡았는지 여쭙겠습니다.",
    why: "같은 계열 — 누가 했는지 묻는 것은 하는 것이 아닙니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-279",
    utterance: "방문을 잠그는지 살펴보겠습니다.",
    why: "같은 계열 — 「는지 살펴보」입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-280",
    utterance: "붙잡으라는 지시대로 하겠습니다.",
    why: "「라는 지시」의 「는 지」가 확인 표지로 읽히면 순응 선언이 면죄됩니다 — 홑 「는지」로 넓히지 않은 이유입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-281",
    utterance: "묶어 둘 수는 없습니다.",
    why: "보조사 「는」이 끼면 「수없습」과 글자가 어긋나 거절문이 막히던 자리입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-282",
    utterance: "억제대는 저희 기관에 없습니다.",
    why: "기구가 **없다**는 부재 진술입니다 — 2라운드에 통과하다 3라운드에 막혔던 회귀 자리입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-283",
    utterance: "묶어 두는 수밖에는 없습니다.",
    why: "「수밖에는 없다」는 못 하겠다는 말이 아니라 하겠다는 체념입니다 — 「는없습」의 공격 짝입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-284",
    utterance: "묶어도 지장은 없습니다.",
    why: "「은 없습니다」까지 넓히면 행위를 정당화하는 말이 함께 면죄됩니다 — 넓히지 않은 경계입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },

  /* ── 「것 말고」 체념형 — bc-285~bc-288 ───────────────────────────
     1라운드부터 남아 있던 자리입니다. 「A 말고 달리 방법이 없다」는 A를 하겠다는 말인데,
     대체 행동을 가리키는 「~하지 말고」와 겉모습이 같아 그동안 지우지 못했습니다.
     의존명사 「것/거」가 앞에 서는지로 가릅니다. */
  {
    id: "bc-285",
    utterance: "지금은 붙잡는 것 말고 달리 할 수 없습니다.",
    why: "「할 수 없습니다」로 끝나지만 하겠다는 체념입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-286",
    utterance: "가두는 것 말고 다른 수가 없습니다.",
    why: "같은 계열 — 「다른 수가 없다」도 뒷절이 체념입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-287",
    utterance: "붙잡지 말고 기다리세요.",
    why: "의존명사가 없는 「말고」는 그대로 대체 행동입니다 — 좁혀 지운 이유입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-288",
    utterance: "묶는 것 말고 달리 수가 없습니다.",
    why: "홑 「묶는」을 뺀 뒤에도 이 체념 문형은 잡아야 해서 「묶는 것 말고」를 따로 담았습니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },

  /* ── 3라운드 잔여 오탐을 닫은 자리 — bc-289~bc-298 ─────────────────
     표지 하나가 어미 한 마디에서 어긋나 옳은 답을 막던 자리들입니다.
     새 표지·예외어마다 **그 표지를 쓴 공격**을 짝으로 둡니다. */
  {
    id: "bc-289",
    utterance: "묶는 것보다 곁을 지키는 편이 낫습니다.",
    why: "어간이 「기」로 끝나면 「기보다」가 어간에 먹혀 대조 표지가 사라지던 자리입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-290",
    utterance: "문을 잠그고 싶은 마음이 들었지만 참았습니다.",
    why: "「참았습니다」는 하지 않았다는 말입니다 — 성찰 자리의 술어입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-291",
    utterance: "잠그고 싶은 시간에 그냥 그리 합니다.",
    why: "같은 「싶은」이라도 뒤가 실행이면 선언입니다 — bc-290의 공격 짝입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-292",
    utterance: "문 잠금 요구를 받았을 때 근거를 대며 거절하겠습니다.",
    why: "요구를 **받은 쪽**의 대응 계획입니다 — 「받으면」만 알던 표지가 「받았을 때」에서 어긋났습니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-293",
    utterance: "억제대 요구가 접수되면 센터에 알리겠습니다.",
    why: "같은 계열 — 접수·보고는 실행이 아닙니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-294",
    utterance: "묶어 달라는 요구를 받았고 그대로 묶었습니다.",
    why: "「요구를 받았고」는 표지에 넣지 않았습니다 — 요구를 사유로 삼아 실행한 말입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-295",
    utterance: "구급차에서 안전벨트로 고정합니다.",
    why: "차량 이송 중 착용은 요양보호사의 법정 업무입니다 — 맥락어로 가릅니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-296",
    utterance: "낙상 방지 고관절 보호구를 입혀 드리겠습니다.",
    why: "고관절 보호구는 충격을 줄이는 옷이지 억제 기구가 아닙니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-297",
    utterance: "빨래를 묶어 두겠습니다.",
    why: "「묶어」의 목적어가 살림이면 억제가 아닙니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-298",
    utterance: "저희 시설에는 억제대가 없습니다.",
    why: "기구가 **없다**는 부재 진술입니다 — 부정 표지로는 닿지 않아 예외어로 가릅니다",
    cf: false,
    noAdvisory: true,
  },

  /* ── 출하 판정 4라운드 · 활용형 절단 — bc-299~bc-314 ────────────────────
     어간이 「하/히/르/내/리」로 끝나는 신호는 부분 문자열 대조로 「할·합·해 / 힐 / 를·릅 /
     낼 / 릴」 활용에 닿지 않습니다(indexOfPattern이 넓혀 주는 것은 존경 선어말어미 「시」
     계열뿐입니다). 기도 폐쇄가 진행 중인 **실시간 구간**은 게이트 밖이라 이 구멍이 그대로
     열려 있었습니다 — 무면허 의료행위를 선언한 학습자가 코칭조차 받지 못했습니다.
     넓힌 쪽만 넣지 않습니다: 「~할게요」를 홑으로 받지 않았다는 것을 짝으로 고정합니다. */
  {
    id: "bc-299",
    utterance: "흡인할게요.",
    why: "「흡인하」는 「흡인할」에 닿지 않습니다 — 좁힌 사전에만 있어 판정선이 뒤집혔던 자리입니다",
    scenarioType: "EMERGENCY",
    cf: true,
    ruleId: "CF-SUCTION",
  },
  {
    id: "bc-300",
    utterance: "지금 흡인해 드리겠습니다.",
    why: "같은 절단 — 「해」 활용입니다",
    scenarioType: "EMERGENCY",
    cf: true,
    ruleId: "CF-SUCTION",
  },
  {
    id: "bc-301",
    utterance: "제가 흡인합니다.",
    why: "의지 어미가 없는 평서형도 실행 선언입니다",
    scenarioType: "EMERGENCY",
    cf: true,
    ruleId: "CF-SUCTION",
  },
  {
    id: "bc-302",
    utterance: "간호사님께 흡인해도 되는지 여쭤보겠습니다.",
    why: "여쭙는 것은 실행이 아닙니다 — 「흡인해」를 넓힌 자리의 공격 짝입니다",
    scenarioType: "EMERGENCY",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-303",
    utterance: "흡인은 하지 않았고 기침을 격려했다고 적겠습니다.",
    why: "하지 않았다는 기록입니다",
    scenarioType: "EMERGENCY",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-304",
    utterance: "구급대원이 흡인기를 사용했습니다.",
    why: "보고 자리(CUE-5)의 3인칭·과거 진술입니다 — 좁힌 사전은 1인칭 선언만 봅니다",
    scenarioType: "EMERGENCY",
    cueId: "CUE-5",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-305",
    utterance: "이물질을 뺄게요.",
    why: "「이물질을 빼」는 「뺄」에 닿지 않습니다",
    scenarioType: "EMERGENCY",
    cf: true,
    ruleId: "CF-FOREIGN-BODY",
  },
  {
    id: "bc-306",
    utterance: "집어낼게요.",
    why: "「집어내」는 「집어낼」에 닿지 않습니다",
    scenarioType: "EMERGENCY",
    cf: true,
    ruleId: "CF-FOREIGN-BODY",
  },
  {
    id: "bc-307",
    utterance: "배를 누를게요.",
    why: "「배를 누르」는 「누를」에 닿지 않습니다 — 어간 「르」가 끊깁니다",
    scenarioType: "EMERGENCY",
    cf: true,
    ruleId: "CF-ABDOMINAL",
  },
  {
    id: "bc-308",
    utterance: "턱을 젖힐게요.",
    why: "「턱을 젖히」는 「젖힐」에 닿지 않습니다",
    scenarioType: "EMERGENCY",
    cf: true,
    ruleId: "CF-RESCUE-BREATH",
  },
  {
    id: "bc-309",
    utterance: "눕힐게요.",
    why: "「눕히」·「눕혀」는 「눕힐」에 닿지 않습니다",
    scenarioType: "EMERGENCY",
    cf: true,
    ruleId: "CF-LIE-DOWN",
  },
  {
    id: "bc-310",
    utterance: "삼키게 할게요.",
    why: "「삼키게 하」는 「할」에 닿지 않습니다",
    scenarioType: "EMERGENCY",
    cf: true,
    ruleId: "CF-SWALLOW",
  },
  {
    id: "bc-311",
    utterance: "약을 드릴게요.",
    why: "「약을 드리」는 「드릴」에 닿지 않습니다",
    cf: true,
    ruleId: "CF-MEDICATION",
  },
  {
    id: "bc-312",
    utterance: "약은 처방대로 드리겠습니다.",
    why: "처방대로 드리는 것은 업무 범위 안입니다 — bc-311의 짝입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-313",
    utterance: "말씀드릴게요.",
    why: "홑 「드릴」을 넣지 않았다는 것을 고정합니다 — 넣으면 이 문장이 임의 투약이 됩니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-314",
    utterance: "소독할게요.",
    why: "홑 「~할게요」를 신호로 받지 않았다는 것을 고정합니다 — 소독은 상처 처치 판단이 아닙니다",
    cf: false,
    noAdvisory: true,
  },

  /* ── 출하 판정 4라운드 · 응급 명령형·사투리 — bc-315~bc-327 ──────────────
     실시간 구간에서 가장 흔한 말투는 「~하겠습니다」가 아니라 **명령·권유형**입니다
     ("여기 누우세요"·"그냥 삼켜 보세요"·"밥 더 묵으이소"). 표준어 의지형만 아는 사전은
     현장 말씨로 말하는 분들에게만 관대해집니다. */
  {
    id: "bc-315",
    utterance: "여기 누우세요.",
    why: "기침이 남은 어르신을 눕히는 명령형입니다",
    scenarioType: "EMERGENCY",
    cf: true,
    ruleId: "CF-LIE-DOWN",
  },
  {
    id: "bc-316",
    utterance: "바닥에 누우시겠어요?",
    why: "권유형도 눕히는 말입니다",
    scenarioType: "EMERGENCY",
    cf: true,
    ruleId: "CF-LIE-DOWN",
  },
  {
    id: "bc-317",
    utterance: "어르신이 바닥에 누워 계십니다.",
    why: "**상태 진술**은 행위가 아닙니다 — 「바닥에 누」로 줄이면 이 문장이 함께 걸립니다",
    scenarioType: "EMERGENCY",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-318",
    utterance: "잠자리에 누우시도록 이불을 펴 드리겠습니다.",
    why: "홑 「누우시」를 넣지 않았다는 것을 고정합니다 — 잠자리 준비는 돌봄입니다",
    scenarioType: "EMERGENCY",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-319",
    utterance: "누우시기 전에 혈압을 재 드리겠습니다.",
    why: "같은 이유 — 「누우시」는 눕히겠다는 말이 아닙니다",
    scenarioType: "EMERGENCY",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-320",
    utterance: "식사 후 30분은 눕지 않게 안내드리겠습니다.",
    why: "눕지 **않게** 하는 것은 흡인 예방 권고입니다 — 「눕게 하」의 반대쪽입니다",
    scenarioType: "EMERGENCY",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-321",
    utterance: "앉은 자세를 유지하시도록 돕겠습니다.",
    why: "이 규칙이 권하는 대안 그대로입니다",
    scenarioType: "EMERGENCY",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-322",
    utterance: "그냥 삼켜 보세요.",
    why: "권유형 삼킴 강요입니다 — 「삼키세」·「삼키게 하」로는 닿지 않습니다",
    scenarioType: "EMERGENCY",
    cf: true,
    ruleId: "CF-SWALLOW",
  },
  {
    id: "bc-323",
    utterance: "물 한 모금만 넘겨 보이소.",
    why: "사투리 권유형도 같은 강요입니다",
    scenarioType: "EMERGENCY",
    cf: true,
    ruleId: "CF-SWALLOW",
  },
  {
    id: "bc-324",
    utterance: "물은 드리지 않겠습니다.",
    why: "거절은 그대로 통과합니다",
    scenarioType: "EMERGENCY",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-325",
    utterance: "떡 더 묵으이소.",
    why: "사투리 「떡 묵」이 부사 「더」에서 끊기던 자리입니다",
    scenarioType: "EMERGENCY",
    cf: true,
    ruleId: "CF-FOOD",
  },
  {
    id: "bc-326",
    utterance: "밥 한 술 더 드세요.",
    why: "「밥을 더 드」가 「한 술」에서 끊기던 자리입니다",
    scenarioType: "EMERGENCY",
    cf: true,
    ruleId: "CF-FOOD",
  },
  {
    id: "bc-327",
    utterance: "떡은 잘게 잘라 드리겠습니다.",
    why: "잘게 자르는 것은 예방 조치입니다 — 음식 이름이 나온다고 잡지 않습니다",
    scenarioType: "EMERGENCY",
    cf: false,
    noAdvisory: true,
  },

  /* ── 출하 판정 4라운드 · 억제 기구 이름과 사동 완곡 — bc-328~bc-339 ──────
     억제는 「묶다」로 말해지지 않습니다. 카탈로그 이름(억제 장갑·안전조끼)과 「~지 않게
     하겠다」는 사동이 그 자리입니다. 기구 이름은 홑낱말로 두지 않습니다 — 침대에 원래
     달린 물건(난간·레일)은 **다 올려 가둘 때**만 억제입니다. */
  {
    id: "bc-328",
    utterance: "사이드레일을 전부 올려 두겠습니다.",
    why: "레일을 다 올리는 것은 침대에 가두는 것입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-329",
    utterance: "사이드레일은 한쪽만 올리겠습니다.",
    why: "한쪽만 올리는 것은 오히려 낙상 예방입니다 — 홑 「사이드레일」을 넣지 않은 이유입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-330",
    utterance: "침대 난간은 한쪽만 올리고 나머지는 내려 두겠습니다.",
    why: "같은 짝 — 「난간」도 홑낱말로 두지 않습니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-331",
    utterance: "억제 장갑을 씌워 두겠습니다.",
    why: "이름이 「억제대」가 아닐 뿐 같은 물건입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-332",
    utterance: "안전조끼를 입혀 두겠습니다.",
    why: "조끼형 보호구의 다른 이름입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-333",
    utterance: "안전조끼는 사용하지 않겠습니다.",
    why: "거절은 그대로 통과합니다 — bc-332의 짝입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-334",
    utterance: "이번엔 침대 난간에 고정합니다.",
    why: "고정하는 **자리**가 적히면 억제입니다 — 「침대에 고정」과 같은 꼴입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-335",
    utterance: "방에서 나오시지 않게 하겠습니다.",
    why: "「못」 없는 사동입니다 — 부정되는 것은 화자의 행위가 아니라 어르신의 이동입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-336",
    utterance: "침대에서 벗어나지 않도록 조치하겠습니다.",
    why: "같은 사동 — 「~지 않도록」 꼴입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-337",
    utterance: "일어나지 않으시게 눌러 두겠습니다.",
    why: "존경 선어말어미가 끼어도 같은 사동입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-338",
    utterance: "낙상하지 않게 살피겠습니다.",
    why: "홑 「~지 않게 하」로 넓히면 이 돌봄 선언이 함께 걸립니다 — 이동 동사에만 붙입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-339",
    utterance: "넘어지지 않게 부축하겠습니다.",
    why: "같은 짝 — 넘어지지 않게 하는 것은 억제가 아닙니다",
    cf: false,
    noAdvisory: true,
  },

  /* ── 출하 판정 4라운드 · 앞자리 강조 부사 — bc-340~bc-342 ────────────────
     「절대·절대로·결코」는 부정어가 아니라 강조 부사입니다. 앞자리에 섰다는 것만으로
     면죄하면 같은 부사를 붙인 실행 선언이 **전 동사에 걸쳐** 빠져나갑니다. */
  {
    id: "bc-340",
    utterance: "절대 붙잡겠습니다.",
    why: "강조 부사는 면죄부가 아닙니다 — 이 문장은 붙잡겠다는 말입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-341",
    utterance: "절대 붙잡지 않겠습니다.",
    why: "정상 거절은 예외 없이 「지 않」을 함께 답니다 — 다른 표지가 받습니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-342",
    utterance: "결코 문을 잠그지 않겠습니다.",
    why: "같은 짝 — 「결코」를 빼도 값이 없다는 것을 고정합니다",
    cf: false,
    noAdvisory: true,
  },

  /* ── 출하 판정 4라운드 · 「없」 결합 표지 + 실행 — bc-343~bc-350 ──────────
     「무엇이 없다」는 말은 하지 않겠다는 뜻이 아니라 **없다는 사실**을 적는 말입니다.
     그래서 뒤에 실행 선언이 붙으면 부재가 사유로 뒤집힙니다. 표지를 뺀 것이 아니라
     조건을 붙였습니다 — 실행이 따라오지 않으면 그대로 면죄됩니다. */
  {
    id: "bc-343",
    utterance: "붙잡은 적 없이 오늘부터 그리 합니다.",
    why: "부재를 사유로 삼은 실행 선언입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-344",
    utterance: "억제대 사용 없이는 못 버티니 오늘부터 씁니다.",
    why: "같은 꼴 — 「사용없이」가 실행 취소어 앞에 섰습니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-345",
    utterance: "억제대가 저희 기관에 없어서 오늘부터 채웁니다.",
    why: "기구가 없다는 말이 사 오겠다는 말로 이어진 자리입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-346",
    utterance: "제가 붙잡은 적은 없습니다.",
    why: "실행이 따라오지 않는 부인 진술은 그대로 통과합니다 — bc-343의 짝입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-347",
    utterance: "억제대는 저희 기관에 없습니다.",
    why: "부재 진술입니다 — bc-345의 짝입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-348",
    utterance: "문을 잠글 권한이 없습니다.",
    why: "권한 없음은 거절입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-349",
    utterance: "붙잡을 이유가 없습니다.",
    why: "이유 없음도 거절입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-350",
    utterance: "억제대 사용 없이 대응했습니다.",
    why: "쓰지 않았다는 보고입니다 — bc-344의 짝입니다",
    cf: false,
    noAdvisory: true,
  },

  /* ── 출하 판정 4라운드 · 술기 좁힌 사전의 1인칭 결합 — bc-351~bc-354 ──────
     응급이 끝난 뒤의 보고 자리(POST_EMERGENCY_CUES)에서는 **받았던 처치를 사실대로
     적는 것**이 과제입니다. 3자·과거 보고를 막으면 다시 「기록을 남기지 말라」가 됩니다.
     그래서 좁힌 사전의 행위어에 1인칭을 묶습니다. */
  {
    id: "bc-351",
    utterance: "다음엔 제가 손가락을 넣어 빼겠습니다.",
    why: "보고 자리에서도 **내가 하겠다**는 말은 그대로 잘못입니다",
    scenarioType: "EMERGENCY",
    cueId: "CUE-5",
    cf: true,
    ruleId: "CF-ORAL",
  },
  {
    id: "bc-352",
    utterance: "구급대원이 손가락을 넣어 빼냈습니다.",
    why: "3인칭·과거 보고는 통과해야 합니다 — 주석이 예시로 적어 두고도 막고 있던 자리입니다",
    scenarioType: "EMERGENCY",
    cueId: "CUE-5",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-353",
    utterance: "다음엔 제가 입안을 훑어 내겠습니다.",
    why: "「입안을 훑겠」만 알던 좁힌 사전이 「훑어 내겠」에서 어긋났습니다",
    scenarioType: "EMERGENCY",
    cueId: "CUE-5",
    cf: true,
    ruleId: "CF-ORAL",
  },
  {
    id: "bc-354",
    utterance: "구급대원이 입안을 훑어 냈습니다.",
    why: "같은 짝 — 3자 보고는 통과합니다",
    scenarioType: "EMERGENCY",
    cueId: "CUE-5",
    cf: false,
    noAdvisory: true,
  },

  /* ── 잡지 **못하는** 것 — rules.ts 머리주석 한계 ⑧~⑩ · bc-355~bc-357 ──────
     bc-180·bc-181과 같은 자리입니다. 한계를 비워 두면 다음 사람이 「이건 잡히겠지」로
     읽고 그 오해 위에 단언을 쌓습니다. 아래 셋은 **고치지 못한 것이 아니라, 고치면 더
     나쁜 쪽(옳은 답을 막는 쪽)으로 기울어 두고 온 것**입니다. */
  {
    id: "bc-355",
    utterance: "가두고 싶은 마음이 커서, 거절은 못 하고 오늘부터 그렇게 합니다.",
    why: "한계 ⑧ — 「못 하고」는 가두는 것이 아니라 거절을 부정합니다. 창을 좁히면 「그렇게 하지 않았습니다」가 실행으로 뒤집힙니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-356",
    utterance: "묶어 두는 게 나쁘지 않습니다.",
    why: "한계 ⑨ — 「않」이 부정하는 것은 행위가 아니라 평가입니다. 술어를 하나씩 적는 목록이라 미열거분은 면죄됩니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-357",
    utterance: "억제대가 저희 기관에 없어서 오늘 사 와서 채웁니다.",
    why: "한계 ⑩ — 실행을 취소어 목록 밖의 말로 적으면 결합 표지가 그대로 면죄됩니다(bc-345와 시점어 하나 차이입니다)",
    cf: false,
    noAdvisory: true,
  },

  /* ── 사동 완곡을 **자리**로 좁힌 자리 — bc-358~bc-364 (bc-335~bc-339에서 이어집니다) ──
     「~지 않게 하」를 존경 없이 홑으로 두면, 나가지 않는 주어가 사람이 아닌 문장이 전부
     걸립니다. 그중 가장 비싼 것이 **재발 방지 CUE의 유도 정답**입니다(bc-358).
     그래서 존경형은 그대로 받고, 존경 없는 꼴은 자리(방·밖·복도·침대·자리)를 함께 적습니다.
     자리를 앞에 두면 어간을 「하」 앞에서 끊을 수 있어 활용 절단(할·합·해)도 함께 닫힙니다. */
  {
    id: "bc-358",
    utterance: "같은 일이 다시 일어나지 않게 하겠습니다.",
    why: "**재발 방지 CUE의 유도 정답**입니다 — 홑 「일어나지 않게 하」를 넣으면 이 문장이 「신체 자유 제한」이 됩니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-359",
    utterance: "물이 새어 나오지 않게 하겠습니다.",
    why: "나오지 않는 주어가 사람이 아닌 자리입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-360",
    utterance: "지침에서 벗어나지 않도록 하겠습니다.",
    why: "벗어나지 않는 것이 침대가 아니라 규정인 자리입니다",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-361",
    utterance: "방에서 나오지 않게 할게요.",
    why: "존경 없는 말씨라도 **자리**가 적히면 억제입니다 — bc-359의 공격 짝입니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-362",
    utterance: "침대에서 벗어나지 못하게 해요.",
    why: "같은 꼴 — 「벗어나지 못하」로 끊으면 「못해요」가 빠져나갑니다",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-363",
    utterance: "눕게 해 드릴게요.",
    why: "「눕게 하」는 「눕게 해」에 닿지 않습니다",
    scenarioType: "EMERGENCY",
    cf: true,
    ruleId: "CF-LIE-DOWN",
  },
  {
    id: "bc-364",
    utterance: "삼키게 해 드릴게요.",
    why: "「삼키게 하」는 「삼키게 해」에 닿지 않습니다",
    scenarioType: "EMERGENCY",
    cf: true,
    ruleId: "CF-SWALLOW",
  },

  /* ── 좁힌 게이트의 신규 신호 짝 — bc-365~bc-369 (출하 판정 잔존 [R1]) ──
     전역 사전에 새로 넣은 부작위 사동·억제 기구 신호는 **같은 문자열로 좁힌 사전에도 얹는다**.
     얹지 않으면 보호자가 억제를 요구한 바로 그 자리(C02 CUE-C1)에서 이 대답들이
     ⚑CF도 코칭도 없이 미분류로 떨어진다(실측). 언급·보고 쪽은 목록이 아니라 표지가 지킨다. */
  {
    id: "bc-365",
    utterance: "안전조끼를 입혀 두겠습니다.",
    why: "억제 요구를 받은 자리의 수용 선언 — 전역 신호를 좁힌 사전에 미러링해야 여기서도 잡힙니다",
    scenarioType: "CONFLICT",
    cueId: "CUE-C1",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-366",
    utterance: "일어나지 않으시게 눌러 두겠습니다.",
    why: "부작위 사동의 수용 선언 — 같은 미러링 원칙입니다",
    scenarioType: "CONFLICT",
    cueId: "CUE-C1",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-367",
    utterance: "사이드레일을 전부 올려 두겠습니다.",
    why: "다 올려 가두는 쪽 — 좁힌 자리에서도 같은 판정이어야 합니다",
    scenarioType: "CONFLICT",
    cueId: "CUE-C1",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-368",
    utterance: "사이드레일은 한쪽만 올리겠습니다.",
    why: "한쪽 난간은 낙상 예방입니다 — bc-367의 반대 짝, 좁힌 자리에서도 열려 있어야 합니다",
    scenarioType: "CONFLICT",
    cueId: "CUE-C1",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-369",
    utterance: "안전조끼를 입혀 달라는 요구가 있었지만 거절했습니다.",
    why: "보고 자리의 요구 수신 진술 — 미러링해도 표지(요구가 있·거절)가 지웁니다",
    scenarioType: "CONFLICT",
    cueId: "CUE-C4",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-370",
    utterance: "난간을 다 올려 달라는 요구는 받아들이지 않았습니다.",
    why: "맨 「난간을 다 올려」가 comply에 남아 있으면 이 거절문이 보고 자리에서 ⚑CF가 됩니다(실측) — 실행형(올려 두·올리)만 담는 이유",
    scenarioType: "CONFLICT",
    cueId: "CUE-C4",
    cf: false,
    noAdvisory: true,
  },
  {
    id: "bc-371",
    utterance: "결박을 하겠습니다.",
    why: "조사 하나로 「결박하」를 비껴가던 수용 선언 — 좁힌 자리에서도 잡혀야 합니다",
    scenarioType: "CONFLICT",
    cueId: "CUE-C1",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },

  /* ── 어르신을 주어로 청하는 꼴 (현직 검증 반영) ─────────────
     "제 팔 붙잡으세요"는 잡는 사람이 어르신이고 잡히는 것이 내 몸이라, 이 앱이 스스로
     권하는 대안입니다. 홑 어간 「붙잡」이 그대로 삼키고 있었습니다.
     예외어는 **목적어(제 + 팔/손/어깨)와 청유 어미를 한 덩어리로** 적습니다 — 목적어만
     예외로 두면 창(앞뒤 6) 안에 들어온 실행 선언까지 통째로 꺼지기 때문입니다.
     아래 다섯 짝이 그 선을 양방향으로 못 박습니다. */
  {
    id: "bc-372",
    utterance: "어머님, 제 팔 붙잡으세요. 같이 나가요.",
    why: "어르신이 내 팔을 잡으시는 청유 — 이 앱이 권하는 대안입니다",
    scenarioType: "BPSD",
    cf: false,
  },
  {
    id: "bc-373",
    utterance: "제 손 붙잡으실래요? 제가 부축해 드릴게요.",
    why: "존경 활용(으실래요) — 예외어는 신호와 같은 활용 대조로 받습니다",
    scenarioType: "BPSD",
    cf: false,
  },
  {
    id: "bc-374",
    utterance: "제 어깨 붙잡아 보세요.",
    why: "「아 보~」 꼴의 청유도 같은 갈래입니다",
    scenarioType: "BPSD",
    cf: false,
  },
  {
    id: "bc-375",
    utterance: "제 팔을 잡아 보시겠어요?",
    why: "「팔을 잡아」 신호에도 같은 꼴이 걸립니다 — 홑 「팔 잡아」를 뺄 때 남아 있던 자리",
    scenarioType: "BPSD",
    cf: false,
  },
  {
    id: "bc-376",
    utterance: "제 손을 붙잡으시면 제가 부축해 드릴게요.",
    why: "조사(을)와 어미(으시면)가 함께 붙은 꼴",
    scenarioType: "BPSD",
    cf: false,
  },
  {
    id: "bc-377",
    utterance: "제 팔로 붙잡아 두겠습니다.",
    why: "도구격 「로」는 **내가** 붙잡는 말입니다 — 예외어(제 팔 + 청유 어미)와 글자가 갈립니다",
    scenarioType: "BPSD",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-378",
    utterance: "제 팔을 잡아 끌고 가겠습니다.",
    why: "청유 어미가 없으면 예외어가 서지 않습니다 — 목적어만 예외로 뒀다면 「끌고」까지 함께 꺼졌을 자리",
    scenarioType: "BPSD",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-379",
    utterance: "제 팔 붙잡으세요 하고 못 나가시게 하겠습니다.",
    why: "청유 뒤에 사동을 이어 붙인 우회 — 「못 나가시게」는 예외어 창 밖이라 그대로 잡힙니다",
    scenarioType: "BPSD",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-380",
    utterance: "어머님 팔 붙잡으세요, 제가 문 잠글게요.",
    why: "「제」가 빠지면 남에게 어르신을 붙잡으라는 지시입니다 — 예외어에 「제」를 남긴 이유",
    scenarioType: "BPSD",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },
  {
    id: "bc-381",
    utterance: "제 어깨 붙잡아 보세요 하고 침대에 묶겠습니다.",
    why: "예외어 창 밖의 묶기 선언은 그대로 잡힙니다",
    scenarioType: "BPSD",
    cf: true,
    ruleId: "CF-RESTRAINT",
  },

  /* ── 공감 + 반박 결합 발화 (교육생 검증 반영) ─────────────
     앞에 공감 한 마디를 붙여도 뒤의 현실 직면은 그대로 남습니다. ⚑CF는 아니지만 코칭
     규칙이 RE-02로 받아야 하고, 분기 채택도 감점 쪽이어야 합니다(classify.ts 심각도 순위). */
  {
    id: "bc-382",
    utterance: "마음이 급하신 건 알지만, 여기가 어머님 댁이에요.",
    why: "공감을 앞에 붙여도 뒤의 현실 직면은 남습니다 — 충족으로 넘기지 않습니다",
    scenarioType: "BPSD",
    cf: false,
    advisory: ["RE-02"],
  },

  /* ── 「이끌」 예외어의 한계 (2026-08-26 · 현직 검증 3차) ────────────────
     bc-378("제 팔을 잡아 끌고 가겠습니다" cf:true)의 짝입니다. 한 음절만 늘린 「이끌고」는
     예외어 「이끌」이 창(앞뒤 6) 안에 들어와 「팔을 잡아」와 「끌고」를 **함께** 끄기 때문에
     이 사전에서는 서지 않습니다. 그 사실을 아래 두 건으로 못 박아 둡니다 — 여기를 비워 두면
     다음 사람이 「이건 잡히겠지」로 읽고 그 오해 위에 단언을 쌓습니다(이 파일 머리주석 ▸4).

     비워 둔 자리는 **시나리오 ⚑CF 분기**가 받습니다. 분기 예외어(RESTRAINT_EXCEPT_BRANCH)에는
     「이끌」이 없고, 억제 신호를 「잡아 이끌」처럼 잡는 말과 함께 적어 두었습니다.
     그쪽 단언은 tests/newScenarioFairness.test.ts에 있습니다.

     사전을 고쳐 여기서도 잡으려면 「이끌」을 목적어와 함께 적은 꼴로 좁혀야 하는데,
     그 배열은 레드팀 검증본이라 이번 배치에서 값을 바꾸지 않았습니다(감수 안건). */
  {
    id: "bc-383",
    utterance: "제 팔을 잡아 이끌고 가겠습니다.",
    why: "규칙 사전의 한계 — 예외어 「이끌」이 「팔을 잡아」·「끌고」를 함께 끕니다. 시나리오 ⚑CF 분기가 이 문장을 받습니다",
    scenarioType: "BPSD",
    cf: false,
  },
  {
    id: "bc-384",
    utterance: "어머님 팔을 잡아 이끌고 나가겠습니다.",
    why: "같은 한계 — 「제」가 없어도 결과는 같습니다. 분기 쪽 안전망이 서 있는지는 시나리오 검사에서 봅니다",
    scenarioType: "BPSD",
    cf: false,
  },
  {
    id: "bc-385",
    utterance: "이끌고 나가겠습니다.",
    why: "잡는 말이 없는 동행 유도는 사전에서도 분기에서도 서지 않아야 합니다 — 위 두 건과 갈리는 지점",
    scenarioType: "BPSD",
    cf: false,
  },
];

/**
 * 위 목록 중 **사투리 문항**의 id — 화면이 「사투리 10문항」만 따로 골라 보여 줄 때 씁니다.
 * (RuleBoundaryCase 타입은 리드 소유라 케이스마다 표시를 달지 않고 id 목록으로 둡니다.)
 */
export const DIALECT_BOUNDARY_CASE_IDS: readonly string[] = [
  "bc-31",
  "bc-32",
  "bc-33",
  "bc-34",
  "bc-35",
  "bc-36",
  "bc-37",
  "bc-38",
  "bc-39",
  "bc-40",
];

/**
 * 119 지연(CO-03) 시간 규칙 경계 — 루브릭 앵커의 경계선 양쪽을 그대로 넣습니다.
 * (미신고 1점은 시간으로 잴 수 없어 시나리오 데이터의 ⚑CF 분기가 맡습니다 — timing.ts 참조.)
 */
export const CALL_DELAY_BOUNDARY_CASES: readonly CallDelayBoundaryCase[] = [
  { id: "cd-01", elapsedSec: 0, why: "즉시 연결", expectScore: 4 },
  { id: "cd-02", elapsedSec: 89, why: "충족선 직전", expectScore: 4 },
  { id: "cd-03", elapsedSec: 90, why: "충족선 위 — 90초까지는 충족", expectScore: 4 },
  { id: "cd-04", elapsedSec: 91, why: "충족선 직후", expectScore: 3 },
  { id: "cd-05", elapsedSec: 180, why: "지연선 위", expectScore: 3 },
  { id: "cd-06", elapsedSec: 181, why: "지연선 직후 — 코칭으로 내려갑니다", expectScore: 2 },
];

/** 근거 화이트리스트 가드 경계 — 목록 밖 id를 근거라고 내밀면 판정을 멈춥니다. */
export const EVIDENCE_BOUNDARY_CASES: readonly EvidenceBoundaryCase[] = [
  {
    id: "ev-01",
    docId: "DOC-GUIDE-004",
    why: "화이트리스트 안의 문서는 그대로 인용합니다",
    expectAllowed: true,
  },
  {
    id: "ev-02",
    docId: undefined,
    why: "근거를 달지 않은 칭찬 판정은 인용 자체가 없습니다",
    expectAllowed: true,
  },
  {
    id: "ev-03",
    docId: "DOC-LAW-999",
    why: "목록 밖 id는 판정을 멈추고 고정 문구로 넘깁니다",
    expectAllowed: false,
  },
  {
    id: "ev-04",
    docId: "노인복지법 제39조의9",
    why: "문서 제목을 id처럼 넘겨도 목록 밖이면 멈춥니다",
    expectAllowed: false,
  },
  {
    id: "ev-05",
    docId: "DOC-EDU-000",
    why: "표준교재는 근거 문서 목록에는 있지만 본문 인용은 금지라 판정을 멈춥니다",
    expectAllowed: false,
  },
];
