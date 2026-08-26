/**
 * 침착(ChimChak) 가명처리 엔진.
 *
 * 학습자 발화·보고문에서 개인을 식별할 수 있는 요소를 찾아 고정 토큰으로 치환한다.
 * 전부 브라우저 안에서 도는 결정론 규칙이며 외부 호출이 0건이다.
 * 경량 LLM(교체형 어댑터)을 붙이더라도, 반드시 이 함수를 통과한 결과만 넘긴다.
 *
 * ⚠ 좌표 규약: MaskResult.spans 의 start/end 는 **결과 문자열(masked) 기준**이다.
 *    원문 좌표가 필요하면 maskSpansOnOriginal() 을 쓴다.
 *
 * @example
 * maskText("박 어르신이 010-1234-5678로 전화하셨어요")
 * // → { masked: "[대상자]이 [번호]로 전화하셨어요", spans: [{ start: 0, end: 5, kind: "성명", replaced: "[대상자]" }, ...] }
 */

import type { MaskResult, MaskSpan } from "@/types";

export type MaskKind = MaskSpan["kind"];

/** 화면에 붙일 종류 라벨 (report 화면의 하이라이트 범례용) */
export const MASK_KIND_LABELS: Record<MaskKind, string> = {
  성명: "성명",
  번호: "번호",
  기관명: "기관명",
  주소: "주소",
  생년: "생년",
};

/** 왜 가렸는지 — 화면에 그대로 노출해도 되는 존댓말 설명 */
export const MASK_KIND_REASONS: Record<MaskKind, string> = {
  성명: "개인을 특정할 수 있는 이름이라 가렸습니다.",
  번호: "연락처·식별번호로 쓰일 수 있어 가렸습니다.",
  기관명: "이용 기관이 드러나면 개인이 좁혀지므로 가렸습니다.",
  주소: "거주지가 드러나면 개인이 특정되므로 가렸습니다.",
  생년: "생년월일은 민감한 식별 정보라 가렸습니다.",
};

/** 치환 토큰 */
export const MASK_TOKENS: Record<MaskKind, string> = {
  성명: "[대상자]",
  번호: "[번호]",
  기관명: "[기관]",
  주소: "[주소]",
  생년: "[생년]",
};

/* ── 사전 ──────────────────────────────────────────────── */

/**
 * 한국 성씨(통계청 인구총조사 빈도 상위 60성 수준) — 문자 클래스로 사용.
 *
 * 사전이 얇으면 가명처리가 조용히 새는데, 화면은 아무 일도 없었던 것처럼 돌아간다.
 * 실제로 「유 어르신」·「천말숙 님」·「엄 씨가」·「지·진·표·방·현 + 어르신」이 통째로
 * 남아 있었다. 성씨 한 글자를 빠뜨린 대가가 실명 노출이므로 상위 성씨를 넉넉히 채운다.
 * (한 글자만 보고 사람이라고 단정하지 않는 장치는 아래 accept·예외어가 맡는다.)
 */
const SURNAMES =
  "김이박최정강조윤장임한오서신권황안송류유전홍고문양손배백허남심노하곽성차주우구원진지엄채천방공현함변염여추도소석선설마길위표민나";

/** 등장인물 표기에 붙는 호칭 (성 + 호칭) */
const CHARACTER_TITLES = "어르신|할머님|할아버님|할머니|할아버지|여사님|여사|선생님|씨";

/** 성씨+이름 뒤에 붙어 사람임을 드러내는 표지 */
const NAME_MARKERS = "님|씨|어르신|할머님|할아버님|할머니|할아버지|보호자|선생님|께서|에게|한테|께";

/**
 * 이름 뒤에 바로 붙는 **일반 조사**.
 *
 * "김영수는 저녁 식사를 거부하셨습니다"처럼 호칭 없이 이름만 부른 문장이 그대로 새고 있었다.
 * 다만 조사는 사람 표지가 아니라 문장 성분 표지라, 같은 규칙을 NAME_MARKERS에 그냥 얹으면
 * "오늘 기분이 좋으셨습니다"까지 이름으로 읽는다. 그래서 조사 규칙은 별도 규칙(name-josa)으로
 * 두고 **성 1자 + 이름 2자(세 글자 이름)** 로만 좁혔다. 한국 성명의 대다수가 세 글자다.
 */
const NAME_JOSA = "은|는|이|가|을|를|과|와|도|의";

/**
 * 이름 뒤에 붙는 **친족·직함 호칭** — NAME_MARKERS와 규칙을 따로 세운다.
 *
 * 현장 발화에는 "김영수 아드님이 오셨어요"·"정미숙 간호사에게 알렸습니다"처럼 이름 뒤에 님·씨가
 * 아니라 관계나 직함이 오는 꼴이 흔한데, 이것이 통째로 새고 있었다.
 *
 * **NAME_MARKERS에 그냥 얹지 않는 이유**가 이 주석의 전부다. 그 규칙은 성 + 1~3자를 받으므로
 * "주간보호 간호사"가 「[대상자] 간호사」가 되고 "방문 간호사"도 같은 꼴이다(뒤쪽은 예외어가
 * 받지만 앞쪽은 받지 못한다). 그래서 이 목록은 **성 1자 + 이름 2자**로 좁힌 별도 규칙
 * (name-title)에만 건다. "주간보호"는 성씨로 시작하지 않아 애초에 걸리지 않고, "우리 아드님"·
 * "방문 간호사"는 예외어(`NAME_STOPWORDS`)에서 걸린다.
 *
 * 검사는 `acceptMarkedName`이다 — 앞 경계와 예외어 두 겹뿐이고 이름 음절 사전은 걸지 않는다.
 * 뒤에 오는 호칭이 이미 사람 표지이고, 사전을 함께 걸었더니 이 규칙이 겨냥한 인구(직원·보호자)의
 * 이름이 통째로 새는 것을 실측했다(`acceptMarkedName` 주석).
 */
const NAME_TITLES =
  "아드님|따님|어머님|아버님|며느님|사위|간호사|요양보호사|사회복지사|물리치료사|영양사|팀장|과장|실장";

/**
 * 이름 **앞**에 서는 표지 — "환자명 김영수 확인했습니다"·"보호자분 성함이 김영수 맞으시죠".
 *
 * 뒤에 아무 표지가 없어도(맨이름 규칙의 종결·구두점 경계도 아니어도) 앞에 이 말이 서 있으면
 * 뒤따르는 세 글자는 사람 이름이다. 소비하지 않는 후방탐색(lookbehind)이라 표지 자체는 남는다.
 * 검사는 name-title과 같은 `acceptMarkedName`을 나눠 쓴다 — 표지가 이미 선 자리이므로 이름 음절
 * 사전은 걸지 않는다(사유와 실측은 그 주석).
 */
const NAME_LEAD_MARKERS = "성함|환자명|대상자|수급자|보호자";

/**
 * 같은 자리의 **약한 표지** — 「이름」 하나다. 규칙을 갈라 둔 이유가 이 주석이다.
 *
 * 「성함」·「환자명」·「수급자」는 사람에게만 쓰는 말이지만, 「이름」은 사물에도 쓴다 — 이 저장소만
 * 해도 「모델 이름」·「작업 이름」·「금지 행위의 이름이 나오는 것이 정상이고」가 있다. 그래서 이
 * 표지 뒤에서는 이름 음절 사전(`acceptBareName`)을 그대로 걸어 둔다. 실측으로 확인한 자리다 —
 * 표지 넷과 함께 사전을 뗐더니 「이름이 하나만 말하는 순간」·「이름 정하기 어렵습니다」·
 * 「모델 이름을 고르는 일은」이 전부 이름으로 읽혔다.
 *
 * 치르는 값도 적어 둔다: 「이름은 김민호입니다」처럼 **약한 표지 + 요즘 이름**은 여기서 놓친다.
 * 사전을 떼어 얻는 것(직원·보호자 이름)보다 잃는 것(이 앱의 화면 문장이 통째로 가려짐)이 큰
 * 자리라 이렇게 둔다.
 */
const NAME_LEAD_WEAK_MARKERS = "이름";

/**
 * 이름 뒤에 **아무것도 붙지 않는 자리** — 문장 끝·구두점·「입니다」류 앞.
 *
 * 조사 규칙(name-josa)은 조사를, 호칭 규칙(name-heuristic)은 호칭을 요구한다. 그런데 실무
 * 표기의 상당수는 둘 다 없다 — "성함은 김영수입니다" · "대상자: 김영수" · "김영수, 이순자" ·
 * "김영수 (85세)" · "보고 대상 김영수 / 이순자"가 전부 통째로 새고 있었다. 사람이 검토하는
 * 단계가 없는 경로(/practice 자유 연습)에서는 이 자동 체가 마지막이라, 종결·구두점 경계를
 * 조사와 **같은 무게**로 받는다.
 *
 * **소비하지 않는 전방탐색(lookahead)** 이라는 점이 목록 표기를 살린다 — "김영수, 이순자"에서
 * 쉼표를 삼키지 않으므로 정규식의 다음 탐색이 쉼표 바로 뒤에서 다시 시작하고, 두 번째 이름도
 * 그대로 걸린다(예전 규칙은 조사를 삼켜 뒤 이름이 밀려났다).
 *
 * **공백 하나만으로는 발동하지 않는다** — 이 경계를 넓게 잡으면 한국어 산문이 통째로 걸린다.
 * 실측으로 확인한 자리다: 이 앱의 화면·데이터 문장에 `\s`를 경계로 넣으면 「마무리」·「배우자」·
 * 「정신은 있으실 때」·「휠체어 이동은」·「조용한 데서」가 전부 이름으로 읽혔다(25건).
 * 그래서 공백은 **뒤에 여는 괄호나 목록 구분자가 따라올 때만** 경계로 친다("김영수 (85세)" ·
 * "보고 대상 김영수 / 이순자"). 하이픈·물결표는 넣지 않는다 — 번호 조각과 붙은 자리를
 * 이름으로 읽을 이유가 없다.
 */
const NAME_TAIL_BOUNDARY =
  "(?=$|[,.!?;:·「」『』)\\]}>\"'“”‘’]|\\s*[(（\\[［/]|입니다|이십니다|이라고|이라는)";

/**
 * 이름 두 번째·세 번째 글자로 흔히 쓰는 음절.
 *
 * 조사만 보고 이름이라고 하면 한국어 산문이 통째로 걸린다("여기에는"·"하는지를"·"고르시는"은
 * 전부 성씨 + 두 글자 + 조사 꼴이다). 그래서 조사 규칙은 **이름에 쓰는 음절로 된 두 글자**
 * 일 때만 발동한다. 목록은 이 앱이 마주하는 세대(1930~50년대생)의 이름 음절 쪽으로 기울여
 * 두었고, 「기·서·지」처럼 산문에서 조사·어미와 겹치는 음절은 일부러 뺐다.
 *
 * **이 사전을 거는 규칙은 둘뿐이다** — name-josa와 name-bare, 곧 문장에 사람 표지가 하나도 없어
 * 사전이 유일한 방어선인 자리다. 여기서 놓친 이름은 표지가 선 규칙들이 받는다: 성 + 어르신·님·씨
 * (name-character·name-heuristic), 이름 + 간호사·아드님(name-title), 성함·환자명 + 이름(name-lead).
 * 뒤의 두 규칙은 사전을 걸지 않는다 — 걸었더니 그 규칙들이 겨냥한 세대(직원·보호자)의 이름이
 * 정확히 사전과 어긋나 84문장이 통째로 샜다(`acceptMarkedName` 주석의 실측).
 */
const GIVEN_NAME_SYLLABLES = new Set(
  ("영수순자옥숙희미남만말복분삼상성세소송승신애양연열용원월윤은익인일임재정제종준중진찬창철" +
    "춘충태학한향헌현형혜호환효훈흥길대덕동두란례룡리명무문병보봉범석선설섭식실심아안" +
    "완우웅유육채천초필팔칠홍황회규").split(""),
);

/**
 * 위 사전에 **요즘 세대의 이름 음절**을 더한 것 — 표지가 선 규칙(name-title·name-lead)이
 * 「조사로 끝나는 후보」를 만났을 때만 본다(`acceptMarkedName`).
 *
 * 왜 목록을 하나 더 두는가: 위 사전은 이 앱이 마주하는 **어르신 세대**로 일부러 기울여 두었고
 * 그 기울기는 조사 규칙·맨이름 규칙에서 옳다(산문 오탐을 그것이 막는다). 그러나 「간호사」·
 * 「성함」 같은 표지가 붙는 자리에 오는 이름은 대개 직원·보호자, 곧 다른 세대다. 그 자리에까지
 * 어르신 사전을 걸었더니 「김민호 간호사」·「환자명 이지훈」류 84문장이 통째로 샜다.
 *
 * 「기·서·지」처럼 위 사전이 일부러 뺀 음절이 여기에는 들어 있다. 뺀 이유가 **표지 없는 규칙**의
 * 산문 오탐이었으므로, 표지가 이미 선 자리에서는 그 이유가 서지 않는다.
 */
const WIDE_GIVEN_NAME_SYLLABLES = new Set([
  ...GIVEN_NAME_SYLLABLES,
  ..."민지서하예나주기경건근다라로빈솔시온율담결겸린별봄새슬여혁흔".split(""),
]);

/**
 * 낱말 끝에 붙은 **조사·어미**로 흔한 글자 — 「조절은 간호사」를 이름으로 읽지 않기 위한 자리.
 *
 * 표지가 선 규칙에서 음절 사전을 떼자 「용량 조절은 간호사님께」·「사용 여부는 간호사님께」처럼
 * **앞 문장 성분 + 직함**이 이름으로 읽혔다(실측). 이름은 조사를 달고 호칭 앞에 서지 않으므로,
 * 후보가 이 글자로 끝날 때만 사전(`WIDE_GIVEN_NAME_SYLLABLES`)을 한 번 본다.
 * 「최하은 간호사」처럼 이름 자체가 그 글자로 끝나는 경우는 그 사전이 받는다.
 */
const JOSA_TAIL_SYLLABLES = new Set(
  ["은", "는", "이", "가", "을", "를", "과", "와", "도", "만", "의", "에", "로", "고", "서", "며", "면"],
);

/**
 * "씨"/"여사" 바로 뒤에 붙어도 사람 지칭을 깨지 않는 조사의 첫 글자.
 * ("김 씨가 오셨습니다"는 가려야 하고 "박 씨앗을 심었습니다"는 남겨야 한다.
 *  다음 글자가 조사면 지칭, 아니면 다른 낱말의 일부로 본다 — 과하게 가리는 쪽이 안전.)
 */
const TITLE_JOSA = new Set([
  "가", "는", "도", "를", "만", "와", "과", "께", "랑", "에", "한", "의", "보", "부", "까", "조", "마", "처",
]);

/**
 * 성씨로 시작하지만 사람 이름이 아닌 말 — 성명 휴리스틱에서 제외.
 *
 * 성씨 사전(60성)과 조사 규칙을 함께 넓히면 "마지막을"·"현관문을"처럼 성씨로 시작하는
 * 세 글자 낱말이 전부 이름으로 보인다. 과하게 가리는 쪽이 안전하다는 원칙은 유지하되,
 * 화면에 그대로 보이는 보고문이 걸레가 되지 않도록 **현장에서 실제로 쓰는 말**만 추린다.
 * (두 글자 항목은 성+호칭 규칙용, 세 글자 항목은 조사 규칙용이다.)
 */
const NAME_STOPWORDS = new Set([
  "이모",
  "이모부",
  "고모",
  "장모",
  "이사",
  "이장",
  "이용자",
  "고객",
  "주임",
  "원장",
  /*
   * ── 기관 직함 호칭 — **판정 규칙과 같은 목록을 본다** ──
   *
   * 「소장님께 보고드렸습니다」가 「[대상자]께 보고드렸습니다」가 되고 있었다. 「소」가 성씨
   * 사전에 있어 호칭 규칙(name-heuristic)이 "소장" + "님"으로 갈랐고, 예외어에는 「원장」·
   * 「이장」·「차장」만 있었기 때문이다. 하필 같은 커밋이 이 호칭들을 **정답 발화**로 판정
   * 규칙에 넣었으므로(src/data/scenarios/chk-a01.ts의 기관 보고 패턴), 훈련이 시키는 모범
   * 발화가 가림 화면에서 「성명 1건」으로 세어지던 자리다.
   *
   * 활용형(소장님·소장께·소장에게·소장한테)은 따로 적지 않는다 — 호칭 규칙이 표지를 떼고
   * 두 글자만 후보로 넘기고, `isCommonWord`가 꼬리(님)를 한 번 더 벗겨 대조하기 때문이다.
   * 새 호칭을 판정 규칙에 넣을 때 이 목록도 함께 보라는 규칙은 tests/masking.test.ts가 지킨다
   * (시나리오 데이터의 호칭 패턴을 읽어 성명으로 가려지지 않는지 확인한다).
   */
  "소장",
  "센터장",
  "시설장",
  "차장",
  "구청장",
  "정부",
  "우리",
  "조카",
  "남편",
  "임시",
  "안내",
  "전화",
  "정말",
  "최근",
  "하나",
  "오늘",
  "오전",
  "오후",
  "서로",
  "신경",
  "문제",
  "양해",
  "심장",
  "노인",
  "하루",
  "주말",
  "구조",
  "원인",
  "안전",
  "안심",
  "성함",
  "차이",
  "배려",
  "문의",
  "백번",
  "고생",
  "홍보",
  "송구",
  "황당",
  "권리",
  "박수",
  "강조",
  "조금",
  "장소",
  "김치",
  "전달",
  "정도",
  "이번",
  "이야",
  "이분",
  "저분",
  // ── 성씨 사전을 60성으로 넓히며 함께 늘린 두 글자 예외어 ──
  "함께",
  "선생",
  "여기",
  "저기",
  "거기",
  "지금",
  "방금",
  "마음",
  "도움",
  "소리",
  "진짜",
  "천천",
  "나중",
  "위험",
  "현관",
  "방문",
  "표정",
  "설명",
  "소변",
  "대변",
  "식사",
  "복도",
  "화장",
  // ── 조사 규칙(name-josa)이 잡는 세 글자 낱말 ──
  "현관문",
  "신발장",
  "문고리",
  "손잡이",
  "손가락",
  "구급대",
  "구급차",
  "지팡이",
  "진정제",
  "진료실",
  "정신과",
  "오전에",
  "오후에",
  "주간에",
  "주무시",
  "마지막",
  "나머지",
  "나중에",
  "지난주",
  "도시락",
  "소독약",
  "소변량",
  "설거지",
  "선생님",
  "원장님",
  "여러분",
  "방문객",
  "방바닥",
  "고혈압",
  "양치질",
  "배설물",
  "심호흡",
  "하반신",
  "허벅지",
  "위험도",
  "전화기",
  "안내문",
  "노인정",
  "변비약",
  "최근에",
  "조리실",
  "서랍장",
  "한마디",
  "이야기",
  "임시로",
  "정상적",
  "정기적",
  "고정적",
  "구급대원",
  "정황",
  "하면",
  "전에",
  /*
   * ── 맨이름 규칙(name-bare)을 세우며 **실측으로** 추린 예외어 ──
   *
   * 종결·구두점 경계를 이름 경계로 받기 시작하면, 성씨로 시작하고 이름 음절 두 개가 이어지는
   * 보통 낱말이 문장 끝·쉼표 앞에서 이름으로 읽힌다. 아래는 이 저장소의 화면·데이터 문장을
   * 전수로 훑어(src/** · docs/**) 실제로 걸린 것과, 같은 꼴이라 곧 걸릴 것이 분명한 돌봄
   * 현장 낱말이다. 두 글자 항목은 뒤에 조사가 붙은 꼴까지 함께 막는다(isCommonWord).
   */
  "마무리",
  "배우자",
  "조용한",
  "유일한",
  "정리한",
  "배정한",
  "안심만",
  "이유만",
  "지우신",
  "지우실",
  "채우신",
  "채우실",
  "이수한",
  "이수일",
  "지연선",
  "최신순",
  "문자열",
  "하임리",
  "최소한",
  "최우선",
  "소중한",
  "정중한",
  "소심한",
  "노인분",
  "구성원",
  "정신",
  "이동",
  "이송",
  "고정",
  "설정",
  "표현",
  "표식",
  "원문",
  "유형",
  "지연",
  "문형",
]);

/** 기관 어미 앞에 오더라도 특정 기관으로 보기 어려운 말 */
const ORG_PREFIX_STOPWORDS = new Set(["우리", "저희", "동네", "근처", "지역", "인근", "해당", "종합", "큰", "작은", "일반"]);

/** 기관 어미 (긴 것 우선) */
const ORG_SUFFIX = [
  "치매안심센터",
  "노인복지관",
  "재가복지센터",
  "주간보호센터",
  "노인요양시설",
  "실버타운",
  "요양병원",
  "요양시설",
  "재가센터",
  "주간보호",
  "복지관",
  "요양원",
  "보건소",
  "데이케어",
  "병원",
  "의원",
  "센터",
  "재가",
].join("|");

/** 도로명 번지로 볼 수 없는 숫자 — 이 앱에서는 신고 번호가 압도적으로 많다 */
const EMERGENCY_NUMBERS = new Set(["119", "112", "911"]);

/** 숫자 뒤에 이런 단위가 붙으면 번지가 아니라 수량이다 */
const UNIT_AFTER_NUMBER = ["초", "분", "시", "개", "명", "건", "살", "년", "회", "번", "점", "단계", "쪽", "인"];

/**
 * 「○○동」으로 끝나지만 주소가 아닌 말 — 동(洞) 규칙에서 제외한다.
 * 낱말 끝이 이 목록으로 끝나면(「이상행동」·「야간활동」) 주소로 보지 않는다.
 */
const DONG_STOPWORD_TAILS = [
  "행동",
  "활동",
  "이동",
  "운동",
  "작동",
  "출동",
  "거동",
  "자동",
  "수동",
  "진동",
  "감동",
  "소동",
  "공동",
  "합동",
  "협동",
  "노동",
  "아동",
  "변동",
  "발동",
  "시동",
  "부동",
  "회동",
  "충동",
  "요동",
  "격동",
  "언동",
  "반동",
  "가동",
  "선동",
  "유동",
  "능동",
  "피동",
  "중동",
];

/* ── 규칙 정의 ─────────────────────────────────────────── */

interface MaskRule {
  id: string;
  kind: MaskKind;
  /** 전역 매칭용 정규식 (g 플래그는 내부에서 보장) */
  pattern: RegExp;
  /** 실제로 가릴 캡처 그룹 번호 (없으면 매치 전체) */
  group?: number;
  /** 낮을수록 우선 — 겹치면 우선순위가 높은 규칙이 이긴다 */
  priority: number;
  /** 추가 검증 — false면 후보에서 제외 */
  accept?: (matched: string, text: string, start: number, end: number) => boolean;
  /**
   * 이 규칙이 확정한 문자열을 **재등장 2차 패스의 씨앗**으로 쓸지 (`repeatNameCandidates`).
   *
   * 참으로 두는 규칙은 셋뿐이다 — 사람 표지가 **문장에 이미 적혀 있는** 자리(name-heuristic ·
   * name-title · name-lead). 표지 없이 사전으로만 판단하는 규칙(name-josa · name-bare)의 후보는
   * 씨앗이 되지 않는다: 그쪽 오탐(「서명란」·「권유형」)이 입력 전체로 번지기 때문이다.
   * name-character는 씨앗이 필요 없다 — 매치에 호칭이 함께 들어 있어 재등장도 같은 규칙이 잡는다.
   */
  repeatSeed?: boolean;
}

const HANGUL = /[가-힣]/;

function isHangulAt(text: string, index: number): boolean {
  if (index < 0 || index >= text.length) return false;
  return HANGUL.test(text.charAt(index));
}

/**
 * 이름 뒤가 아니라 낱말 뒤에 붙은 것으로 보이는 꼬리 — 벗겨서 예외어와 한 번 더 대조한다.
 * (「만」은 「하나만」·「안심만」처럼 예외어에 조사가 붙은 꼴을 낱개로 적어 두던 자리를 없앤다.)
 */
const TRIMMABLE_TAILS = ["님", "은", "는", "이", "가", "을", "를", "도", "의", "과", "와", "만"];

/**
 * 이름 후보가 사람 이름이 아니라 흔한 낱말인지.
 * 탐욕적 매칭이 존칭·조사까지 삼키는 경우("원장님께" → 캡처 "원장님",
 * "여기가 어르신" → 캡처 "여기가")가 있어 꼬리를 벗긴 형태도 함께 본다.
 */
function isCommonWord(candidate: string): boolean {
  if (NAME_STOPWORDS.has(candidate)) return true;
  const tail = TRIMMABLE_TAILS.find((t) => candidate.endsWith(t) && candidate.length > t.length);
  return tail !== undefined && NAME_STOPWORDS.has(candidate.slice(0, -tail.length));
}

/**
 * **표지가 이미 선 자리**의 이름 후보를 받아들일지 — 앞 경계와 예외어 두 겹만 본다.
 *
 * 쓰는 규칙은 name-title(뒤에 간호사·아드님 따위가 오는 자리)과 name-lead(앞에 성함·환자명이
 * 서는 자리)다. 두 규칙은 사람 표지가 **문장에 이미 적혀 있는** 자리만 열므로, 이름 음절
 * 사전을 한 겹 더 걸 이유가 없다.
 *
 * 왜 갈랐는가(실측): 사전(`GIVEN_NAME_SYLLABLES`)은 이 앱이 마주하는 세대의 이름 쪽으로 일부러
 * 기울여 두었는데, 이 두 규칙이 겨냥한 인구는 직원·보호자라 대개 젊은 세대다. 사전을 함께 걸었을
 * 때 「김민호 간호사에게 알렸습니다」·「환자명 이지훈 확인했습니다」류 **84문장이 전부 그대로
 * 나갔다**(현대식 이름 12종 × 이 두 규칙이 겨냥한 문틀 7종).
 *
 * 예외가 하나 있다 — **조사로 끝나는 후보**. 사전을 통째로 떼자 「용량 조절은 간호사님께」·
 * 「억제대 사용 여부는 간호사님께」의 앞 성분이 이름으로 읽혔다(저장소 문장 전수 스윕에서 11건).
 * 이름은 조사를 달고 호칭 앞에 서지 않으므로, 그 꼴일 때만 넓힌 사전을 한 번 본다. 그 한 겹을
 * 얹은 뒤 84문장은 모두 가려지고 스윕의 새 오탐은 0건이 되었다.
 */
function acceptMarkedName(matched: string, text: string, start: number): boolean {
  if (isHangulAt(text, start - 1)) return false;
  if (isCommonWord(matched)) return false;
  if (!JOSA_TAIL_SYLLABLES.has(matched.charAt(matched.length - 1))) return true;
  return [...matched.slice(1)].every((syllable) => WIDE_GIVEN_NAME_SYLLABLES.has(syllable));
}

/**
 * 호칭 없이 이름만 나온 후보를 받아들일지 — 조사 규칙(name-josa)과 맨이름 규칙(name-bare)이
 * **같은 검사**를 쓴다. 사전이 두 벌로 갈라지면 한쪽만 넓어지는 날이 온다.
 *
 * 위 검사에 **이름 음절 사전**을 한 겹 더 얹은 것이다. 이쪽 두 규칙은 문장에 사람 표지가
 * 하나도 없는 자리를 여는 규칙이라, 사전이 유일한 방어선이다.
 */
function acceptBareName(matched: string, text: string, start: number): boolean {
  if (!acceptMarkedName(matched, text, start)) return false;
  return [...matched.slice(1)].every((syllable) => GIVEN_NAME_SYLLABLES.has(syllable));
}

const MASK_RULES: MaskRule[] = [
  // 주민등록번호 형태
  {
    id: "no-rrn",
    kind: "번호",
    pattern: /\d{6}\s*[-–—]\s*\d{7}/g,
    priority: 1,
  },
  /*
   * 이메일 주소.
   *
   * 휴리스틱의 회색지대가 아니라 확정적인 범주다 — 정규식 하나면 끝나는데 규칙이 아예 없어
   * `kimyoungsu@naver.com`이 그대로 나가고 있었다. 종류는 「번호」로 둔다(연락처·식별자로
   * 쓰이는 값이고, 화면 범례에 새 이름을 하나 더 만들지 않는 편이 안내가 짧다).
   */
  {
    id: "contact-email",
    kind: "번호",
    pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
    priority: 1,
  },
  /*
   * 링크 — http(s) 주소와 도메인만 적은 형태(오픈채팅 초대 링크 포함).
   *
   * `https://open.kakao.com/o/abc123`처럼 링크 하나가 곧 연락 수단인 경우가 있어 이메일과 같은
   * 무게로 다룬다. 아래쪽 `www.`·`도메인/경로` 분기는 경로(`/…`)가 붙었을 때만 잡는다 —
   * "농협은행.kr" 같은 말은 없고, 경로 없는 낱말을 도메인으로 오인하면 문장이 걸레가 된다.
   */
  {
    id: "contact-url",
    kind: "번호",
    pattern:
      /(?:https?:\/\/|www\.)[A-Za-z0-9\-._~:/?#@!$&*+,;=%]*[A-Za-z0-9/]|[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.(?:com|net|org|kr|io|me|link)\/[A-Za-z0-9\-._~:/?#@!$&*+,;=%]*/g,
    priority: 1,
  },
  // 생년 표기 — "1948년생"과 현장에서 더 흔한 축약형("43년생")을 함께 받는다
  {
    id: "birth-year",
    kind: "생년",
    pattern: /(?:19|20)?\d{2}\s*년(?:\s*\d{1,2}\s*월\s*\d{1,2}\s*일)?\s*(?:생|출생)/g,
    priority: 2,
  },
  /*
   * 생년월일 — 「생/출생」이 뒤에 붙지 않는 표기.
   *
   * 위 규칙이 끝에 `생|출생`을 요구해서, **가장 흔한 표기인 「1948년 3월 2일」이 통과했다.**
   * 「생년」이라는 범주를 화면에 이름 붙여 두고 그 범주의 대표형을 놓치던 자리다.
   * 네 자리 연도를 요구하므로 "3년 5월"·"2년 뒤" 같은 말은 걸리지 않고, 연도 앞에 숫자가
   * 이어지는 경우(전화번호 조각 등)는 accept에서 제외한다.
   */
  {
    id: "birth-date",
    kind: "생년",
    pattern: /(?:19|20)\d{2}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일/g,
    priority: 2,
    accept: (_matched, text, start) => !/\d/.test(text.charAt(start - 1)),
  },
  // 전화번호 — 구분자로 붙임표 대신 줄표(–·—)를 쓴 표기도 같은 번호다
  {
    id: "no-phone",
    kind: "번호",
    pattern: /0\d{1,2}[-–—.\s]?\d{3,4}[-–—.\s]?\d{4}/g,
    priority: 3,
  },
  // 6자리 이상 연속 숫자
  {
    id: "no-long-digits",
    kind: "번호",
    pattern: /\d{6,}/g,
    priority: 4,
  },
  // 주소 — 시/도·구/군이 앞에 붙는 형태
  {
    id: "addr-full",
    kind: "주소",
    pattern:
      /(?:[가-힣○〇xX]{1,10}(?:시|도)\s*)?[가-힣○〇xX]{1,10}(?:구|군)\s*[가-힣0-9○〇xX]{1,10}(?:로|길|동)\s*\d{1,4}(?:-\d{1,4})?(?:번지|번길|호)?/g,
    priority: 5,
  },
  // 주소 — "○○로 12", "행복길 3-2"
  // 조사 "-(으)로" 뒤에 숫자가 오는 말("바로 119", "지표로 60초")이 도로명으로 잡히면
  // 보고문에서 「[주소]에 신고했습니다」가 된다. 도로명이 아닌 꼴을 아래에서 걸러 낸다.
  {
    id: "addr-street",
    kind: "주소",
    pattern: /[가-힣0-9○〇xX]{1,10}(?:로|길)\s*\d{1,4}(?:-\d{1,4})?(?:번지|번길)?/g,
    priority: 6,
    accept: (matched, text, start, end) => {
      if (isHangulAt(text, start - 1)) return false;
      const digits = /\d+/.exec(matched);
      const head = matched.slice(0, digits?.index ?? matched.length).trim();
      if (head.endsWith("으로")) return false;
      if (EMERGENCY_NUMBERS.has(digits?.[0] ?? "")) return false;
      // 숫자 뒤에 단위가 붙으면 번지가 아니라 수량이다("60초", "6단계")
      return !UNIT_AFTER_NUMBER.some((unit) => text.startsWith(unit, end));
    },
  },
  // 주소 — "○○동 123번지"
  {
    id: "addr-dong",
    kind: "주소",
    pattern: /[가-힣0-9○〇xX]{1,10}(?:동|리)\s*\d{1,4}\s*번지/g,
    priority: 6,
  },
  // 주소 — 공동주택 동·호수
  {
    id: "addr-apt",
    kind: "주소",
    pattern: /\d{1,4}\s*동\s*\d{1,4}\s*호/g,
    priority: 6,
  },
  // 주소 — 번지 없이 동 이름만 말한 경우("역삼동에 사십니다")
  // 법정동 이름은 대개 두 글자 이상이라 앞을 {2,4}로 묶어 "이동"·"행동"류를 애초에 비켜 간다.
  {
    id: "addr-dong-name",
    kind: "주소",
    pattern: /[가-힣]{2,4}동(?=$|[^가-힣]|[은는이가을를에의로와과도])/g,
    priority: 6,
    accept: (matched, text, start) => {
      if (isHangulAt(text, start - 1)) return false;
      return !DONG_STOPWORD_TAILS.some((tail) => matched.endsWith(tail));
    },
  },
  // 기관명
  {
    id: "org",
    kind: "기관명",
    pattern: new RegExp(`[가-힣A-Za-z0-9○〇]{1,10}(?:${ORG_SUFFIX})`, "g"),
    priority: 7,
    accept: (matched, text, start) => {
      if (isHangulAt(text, start - 1)) return false;
      const suffix = ORG_SUFFIX.split("|").find((s) => matched.endsWith(s));
      if (!suffix) return false;
      const prefix = matched.slice(0, matched.length - suffix.length);
      if (prefix.length === 0) return false;
      return !ORG_PREFIX_STOPWORDS.has(prefix);
    },
  },
  // 등장인물 표기 — 성 + 호칭 ("박 어르신", "김 씨")
  {
    id: "name-character",
    kind: "성명",
    pattern: new RegExp(`[${SURNAMES}]\\s?(?:${CHARACTER_TITLES})`, "g"),
    priority: 8,
    accept: (matched, text, start, end) => {
      if (isHangulAt(text, start - 1)) return false;
      // "씨"/"여사" 뒤에 다른 글자가 이어지면 오탐 후보("박 씨앗")지만,
      // 조사("김 씨가/는/를")까지 거르면 정상 지칭이 통째로 새므로 조사만 통과시킨다.
      if (
        (matched.endsWith("씨") || matched.endsWith("여사")) &&
        isHangulAt(text, end) &&
        !TITLE_JOSA.has(text[end] ?? "")
      )
        return false;
      return true;
    },
  },
  // 성씨 + 이름(1~3자) + 사람 표지 ("김영수 님", "박말순 어르신", "이영희에게")
  {
    id: "name-heuristic",
    kind: "성명",
    pattern: new RegExp(`([${SURNAMES}][가-힣]{1,3})\\s?(?:${NAME_MARKERS})`, "g"),
    group: 1,
    priority: 9,
    accept: (matched, text, start, end) => {
      if (isHangulAt(text, start - 1)) return false;
      if (isCommonWord(matched)) return false;
      // "도와드릴께요"처럼 '-ㄹ게요'를 '께요'로 적은 말은 사람을 부르는 "께"가 아니다.
      if (/^\s?께요/.test(text.slice(end, end + 4))) return false;
      return true;
    },
    repeatSeed: true,
  },
  // 성씨 + 이름 두 자 + 일반 조사 ("김영수는", "박말순이") — 호칭 없이 이름만 부른 문장
  {
    id: "name-josa",
    kind: "성명",
    pattern: new RegExp(`([${SURNAMES}][가-힣]{2})(?:${NAME_JOSA})(?![가-힣])`, "g"),
    group: 1,
    priority: 10,
    accept: acceptBareName,
  },
  /*
   * 성씨 + 이름 두 자 + **아무 표지 없음** ("성함은 김영수입니다", "대상자: 김영수", "김영수, 이순자").
   *
   * 위 조사 규칙과 사전·검사가 **같다**(acceptBareName 하나를 나눠 쓴다) — 다른 것은 뒤에 무엇이
   * 오는가 하나뿐이다. 규칙을 따로 세운 이유는 조사 규칙의 매치 폭을 한 글자도 건드리지 않기
   * 위해서다(조사를 선택적으로 만들면 기존 매치의 lastIndex가 함께 움직인다).
   * 과탐 방어선은 세 겹 그대로다 — 앞이 한글이면 제외 · 예외어면 제외 · 두 이름 글자가
   * 모두 GIVEN_NAME_SYLLABLES 안일 것.
   */
  {
    id: "name-bare",
    kind: "성명",
    pattern: new RegExp(`[${SURNAMES}][가-힣]{2}${NAME_TAIL_BOUNDARY}`, "g"),
    priority: 10,
    accept: acceptBareName,
  },
  /*
   * 성씨 + 이름 두 자 + **친족·직함 호칭** ("김영수 아드님", "정미숙 간호사", "박말순 따님").
   *
   * 호칭 규칙(name-heuristic)이 님·씨·어르신만 보던 자리다. 목록을 그쪽에 얹지 않고 규칙을
   * 따로 세운 이유는 NAME_TITLES 주석에 적어 두었다 — 그쪽은 성 + 1~3자를 받아 "주간보호
   * 간호사"까지 이름으로 읽는다. 여기서는 폭을 **성 1자 + 이름 2자**로 좁혀, 새로 여는 문이
   * 정확히 「이름 + 호칭」 한 꼴이 되게 한다.
   *
   * 검사는 `acceptMarkedName`이다 — 앞 경계와 예외어 두 겹뿐이고 **이름 음절 사전은 걸지
   * 않는다.** 뒤에 오는 호칭이 이미 사람 표지이고, 이 자리에 서는 이름은 대개 직원·보호자,
   * 곧 사전이 겨냥하지 않은 세대다(사유와 실측은 `acceptMarkedName` 주석).
   */
  {
    id: "name-title",
    kind: "성명",
    pattern: new RegExp(`([${SURNAMES}][가-힣]{2})\\s?(?:${NAME_TITLES})`, "g"),
    group: 1,
    priority: 9,
    accept: acceptMarkedName,
    repeatSeed: true,
  },
  /*
   * **앞**에 표지가 선 맨이름 ("환자명 김영수 확인했습니다", "성함이 김영수 맞으시죠").
   *
   * 뒤에 조사도 호칭도 종결도 없는 자리를 앞쪽 표지 하나로 받는다. 공백 경계를 통째로 넓히지
   * 않겠다는 판단(NAME_TAIL_BOUNDARY 주석의 오탐 25건 실측)은 그대로 두고, 그 판단이 정확히
   * 무엇을 놓치는지 아는 자리만 좁게 연다.
   *
   * 검사는 name-title과 같은 `acceptMarkedName`이다 — 앞에 「환자명」·「성함」이 서 있다는 사실
   * 자체가 증거라, 이름 음절 사전을 한 겹 더 걸면 겨냥한 이름만 빠져나간다(같은 실측 84문장).
   */
  {
    id: "name-lead",
    kind: "성명",
    pattern: new RegExp(
      `(?<=(?:${NAME_LEAD_MARKERS})(?:${NAME_JOSA})?\\s*[:：]?\\s*)[${SURNAMES}][가-힣]{2}(?![가-힣])`,
      "g",
    ),
    priority: 10,
    accept: acceptMarkedName,
    repeatSeed: true,
  },
  /*
   * 앞에 **약한 표지**(「이름」)가 선 맨이름 — 규칙이 하나 더 있는 이유는 `NAME_LEAD_WEAK_MARKERS`
   * 주석에 있다. 정규식은 위와 같고 검사만 다르다(사전을 그대로 건다).
   */
  {
    id: "name-lead-weak",
    kind: "성명",
    pattern: new RegExp(
      `(?<=(?:${NAME_LEAD_WEAK_MARKERS})(?:${NAME_JOSA})?\\s*[:：]?\\s*)[${SURNAMES}][가-힣]{2}(?![가-힣])`,
      "g",
    ),
    priority: 10,
    accept: acceptBareName,
  },
];

/**
 * 재등장 규칙의 우선순위 — **모든 규칙보다 뒤**다.
 *
 * 2차 패스가 만드는 후보는 이미 확정된 문자열의 사본이라, 원래 규칙이 잡은 자리와 겹치면
 * 언제나 원래 자리가 이겨야 한다("김영 님과 김영수 씨"에서 뒤쪽은 「김영수」로 남는다).
 */
const REPEAT_NAME_PRIORITY = 11;

/* ── 후보 수집 ─────────────────────────────────────────── */

interface Candidate {
  start: number;
  end: number;
  kind: MaskKind;
  replaced: string;
  priority: number;
  /** 재등장 2차 패스의 씨앗으로 쓸 수 있는 후보인지 (`MaskRule.repeatSeed`) */
  seed?: boolean;
}

function collectCandidates(text: string): Candidate[] {
  const found: Candidate[] = [];
  for (const rule of MASK_RULES) {
    const flags = rule.pattern.flags.includes("g") ? rule.pattern.flags : `${rule.pattern.flags}g`;
    const re = new RegExp(rule.pattern.source, flags);
    let m = re.exec(text);
    while (m !== null) {
      if (m[0].length === 0) {
        re.lastIndex += 1;
        m = re.exec(text);
        continue;
      }
      const whole = m[0];
      const groupText = rule.group !== undefined ? m[rule.group] : whole;
      if (groupText && groupText.length > 0) {
        const offset = rule.group !== undefined ? whole.indexOf(groupText) : 0;
        const start = m.index + (offset >= 0 ? offset : 0);
        const end = start + groupText.length;
        const ok = rule.accept ? rule.accept(groupText, text, start, end) : true;
        if (ok) {
          found.push({
            start,
            end,
            kind: rule.kind,
            replaced: MASK_TOKENS[rule.kind],
            priority: rule.priority,
            seed: rule.repeatSeed,
          });
        }
      }
      m = re.exec(text);
    }
  }
  return found;
}

/** 겹치는 후보 제거 — 우선순위(작은 값) → 길이(긴 것) → 앞선 위치 순으로 채택 */
function resolveOverlap(candidates: Candidate[]): Candidate[] {
  const sorted = [...candidates].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    const lenA = a.end - a.start;
    const lenB = b.end - b.start;
    if (lenA !== lenB) return lenB - lenA;
    return a.start - b.start;
  });
  const accepted: Candidate[] = [];
  for (const c of sorted) {
    const clash = accepted.some((a) => c.start < a.end && a.start < c.end);
    if (!clash) accepted.push(c);
  }
  return accepted.sort((a, b) => a.start - b.start);
}

/* ── 재등장 2차 패스 ───────────────────────────────────── */

/**
 * 한 번 성명으로 확정된 문자열의 **같은 입력 안 재등장**을 함께 가린다.
 *
 * 왜 필요한가: 규칙은 저마다 자기 표지를 요구한다. 그래서 "김영수 님께 말씀드렸고 김영수 상태는
 * 안정적입니다"에서 앞쪽은 호칭 규칙이 잡고 뒤쪽은 그대로 남는다 — 같은 문장 안에서 **한 번은
 * 가리고 한 번은 노출하는** 결과인데, 이는 아예 못 가린 것과 위험이 같으면서 화면은 「가렸습니다」
 * 라고 말한다. 사람 검토가 없는 경로(/practice 자유 연습)에서는 이 자동 체가 마지막이다.
 *
 * **씨앗을 어디서 받는가**가 이 함수의 오탐 폭을 정한다. 받는 것은 `repeatSeed`가 붙은 규칙,
 * 곧 사람 표지가 **문장에 이미 적혀 있는** 자리를 잡은 후보뿐이다(name-heuristic·name-title·
 * name-lead). 표지 없이 사전으로만 판단하는 규칙(name-josa·name-bare)의 후보는 씨앗이 되지
 * 않는다 — 예전에는 모든 성명 후보를 씨앗으로 받아, 그쪽 오탐이 입력 전체로 번졌다
 * (「서명란에 서명을 받았습니다. 서명란은 비어 있었습니다.」가 1건→2건이 되던 자리다).
 * 정직하게 적어 둔다: 씨앗이 오탐이면 이 패스는 그 오탐을 **번지게 한다**. 그래서 여기서 하는
 * 일은 오탐을 안 만드는 것이 아니라, 씨앗의 출처를 「표지가 이미 선 자리」로 좁히는 것이다.
 *
 * 우선순위는 모든 규칙보다 뒤(`REPEAT_NAME_PRIORITY`)라, 원래 규칙이 잡은 더 긴 자리와 겹치면
 * 언제나 원래 자리가 이긴다.
 */
function repeatNameCandidates(text: string, accepted: readonly Candidate[]): Candidate[] {
  const names = new Set<string>();
  for (const c of accepted) {
    if (c.kind !== "성명" || c.seed !== true) continue;
    const value = text.slice(c.start, c.end);
    // 한 글자짜리 확정은 두지 않는다(성씨 한 자가 온 문장을 물어뜯는 일을 만들지 않는다).
    if (value.length >= 2) names.add(value);
  }

  const extra: Candidate[] = [];
  for (const name of names) {
    let from = 0;
    for (;;) {
      const at = text.indexOf(name, from);
      if (at < 0) break;
      from = at + name.length;
      // 다른 낱말 한가운데를 물지 않는다 — 원래 규칙들과 같은 앞 경계 검사다.
      if (isHangulAt(text, at - 1)) continue;
      extra.push({
        start: at,
        end: at + name.length,
        kind: "성명",
        replaced: MASK_TOKENS.성명,
        priority: REPEAT_NAME_PRIORITY,
      });
    }
  }
  return extra;
}

/**
 * 후보 수집 → 겹침 정리 → **재등장 2차 패스** → 다시 겹침 정리.
 *
 * `maskText`와 `maskSpansOnOriginal`이 이 함수 하나를 나눠 쓴다. 두 곳에 따로 적으면 어느 날
 * 한쪽만 넓어지고, 그때 화면의 하이라이트와 실제 치환 결과가 갈라진다.
 */
function maskCandidates(text: string): Candidate[] {
  const raw = collectCandidates(text);
  const first = resolveOverlap(raw);
  const extra = repeatNameCandidates(text, first);
  return extra.length === 0 ? first : resolveOverlap([...raw, ...extra]);
}

/* ── 공개 API ──────────────────────────────────────────── */

/**
 * 가명처리 실행.
 *
 * @param text 원문 (마이크 인식 결과 또는 타이핑 입력)
 * @returns masked = 치환된 문자열, spans = **masked 기준** 좌표
 *
 * @example
 * const r = maskText("행복요양원 김영수 님이 서울시 강남구 행복로 12에 사십니다");
 * r.masked; // "[기관] [대상자] 님이 [주소]에 사십니다"
 * r.spans.map(s => s.kind); // ["기관명", "성명", "주소"]
 */
export function maskText(text: string): MaskResult {
  if (!text) return { masked: "", spans: [] };
  const accepted = maskCandidates(text);
  let masked = "";
  let cursor = 0;
  const spans: MaskSpan[] = [];
  for (const c of accepted) {
    masked += text.slice(cursor, c.start);
    const start = masked.length;
    masked += c.replaced;
    spans.push({ start, end: masked.length, kind: c.kind, replaced: c.replaced });
    cursor = c.end;
  }
  masked += text.slice(cursor);
  return { masked, spans };
}

/**
 * 같은 규칙을 원문 좌표로 돌려준다. 원문 위에 하이라이트를 그릴 때 쓴다.
 *
 * @example
 * maskSpansOnOriginal("박 어르신께"); // [{ start: 0, end: 5, kind: "성명", replaced: "[대상자]" }]
 */
export function maskSpansOnOriginal(text: string): MaskSpan[] {
  if (!text) return [];
  return maskCandidates(text).map((c) => ({
    start: c.start,
    end: c.end,
    kind: c.kind,
    replaced: c.replaced,
  }));
}

/**
 * 가려진 것이 있는지만 빠르게 확인한다.
 *
 * @example
 * hasSensitive("오늘 기분이 좋으셨습니다"); // false
 */
export function hasSensitive(text: string): boolean {
  return maskSpansOnOriginal(text).length > 0;
}

/**
 * 종류별 개수 — 화면 안내 문구("성명 1건, 번호 1건을 가렸습니다")에 쓴다.
 *
 * @example
 * countByKind(maskText("박 어르신 010-1234-5678").spans); // { 성명: 1, 번호: 1 }
 */
export function countByKind(spans: MaskSpan[]): Partial<Record<MaskKind, number>> {
  const out: Partial<Record<MaskKind, number>> = {};
  for (const s of spans) {
    out[s.kind] = (out[s.kind] ?? 0) + 1;
  }
  return out;
}

/* ── 부분 가림 감지 ────────────────────────────────────── */

/**
 * 부분 가림을 알리는 **한 문장** — 이 판정을 쓰는 화면이 전부 같은 말을 한다.
 *
 * 지금 쓰는 곳은 둘이다: 사람이 검토하는 /report 2단계와, 사람 검토가 없는 /practice의 전송
 * 직전. 뒤쪽이 더 중요한 자리다 — 거기서 문자열이 기기 밖으로 나간다.
 */
export const MASK_PARTIAL_NOTICE = "일부만 가려졌을 수 있어요. 한 번 확인해 주세요.";

/** 치환 토큰 **바로 앞**에 붙은 조각 — 숫자·붙임표·로마자 한 글자("110-123-[번호]", "L[번호]") */
const LEFTOVER_BEFORE = /[0-9A-Za-z\-–—]$/;

/** 치환 토큰 **바로 뒤**에 붙은 조각 — 숫자·붙임표("[번호]-4567") */
const LEFTOVER_AFTER = /^[0-9\-–—]/;

/** 토큰과 공백 하나를 사이에 두고 남은 번지·번호 꼴("[주소] 12-3", "110-123 [번호]") */
const SPACED_FRAGMENT_AFTER = /^\s\d{1,4}\s*[-–—]\s*\d{1,4}/;
const SPACED_FRAGMENT_BEFORE = /\d{1,4}\s*[-–—]\s*\d{1,4}\s$/;

/**
 * **일부만 가려졌는지** — 치환 토큰에 숫자·붙임표 조각이 맞붙어 남았는지 본다.
 *
 * 왜 세는 것으로 부족한가: `countByKind`는 가린 자리의 **개수**만 센다. 그런데 규칙이 값의
 * 일부만 물고 지나가는 자리가 실제로 있다 — "계좌 110-123-456789"는 "110-123-[번호]"가 되고,
 * "역삼동 12-3"은 "[주소] 12-3"이 되며, "인정번호 L0123456789"는 "L[번호]"가 된다. 화면이
 * 「1건 가렸습니다」라고만 말하면 사용자는 다 가려진 줄 안다. 남은 조각이 있다는 사실은
 * 개수보다 훨씬 쓸모 있는 정보라, 화면이 그 한 줄을 세울 수 있게 여기서 판정한다.
 *
 * 순수 함수다 — 문자열을 고치지 않고 참·거짓만 돌려준다. 가리는 일 자체는 손대지 않는다
 * (규칙을 넓히는 것과 「남았을 수 있다」고 말하는 것은 다른 판단이고, 뒤쪽이 훨씬 정직하다).
 *
 * @example
 * hasPartialMask(maskText("계좌 110-123-456789"));   // true  ("110-123-[번호]")
 * hasPartialMask(maskText("어르신 댁은 역삼동 12-3")); // true  ("[주소] 12-3")
 * hasPartialMask(maskText("박 어르신께 전해 드렸습니다")); // false
 */
export function hasPartialMask(result: MaskResult): boolean {
  for (const span of result.spans) {
    const before = result.masked.slice(0, span.start);
    const after = result.masked.slice(span.end);
    if (LEFTOVER_BEFORE.test(before)) return true;
    if (LEFTOVER_AFTER.test(after)) return true;
    if (SPACED_FRAGMENT_BEFORE.test(before)) return true;
    if (SPACED_FRAGMENT_AFTER.test(after)) return true;
  }
  return false;
}

/**
 * masked 문자열을 하이라이트용 조각으로 쪼갠다. UI가 span 계산을 다시 하지 않도록 돕는다.
 *
 * @example
 * splitMasked(maskText("박 어르신께"));
 * // [{ text: "[대상자]", masked: true, kind: "성명" }, { text: "께", masked: false }]
 */
export function splitMasked(result: MaskResult): { text: string; masked: boolean; kind?: MaskKind }[] {
  const parts: { text: string; masked: boolean; kind?: MaskKind }[] = [];
  let cursor = 0;
  for (const s of result.spans) {
    if (s.start > cursor) parts.push({ text: result.masked.slice(cursor, s.start), masked: false });
    parts.push({ text: result.masked.slice(s.start, s.end), masked: true, kind: s.kind });
    cursor = s.end;
  }
  if (cursor < result.masked.length) parts.push({ text: result.masked.slice(cursor), masked: false });
  return parts;
}
