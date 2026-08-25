import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  INLINE_DISCLAIMER_TEXT,
  InlineDisclaimer,
  ListRow,
  ListRows,
  PageShell,
  ScreenHeader,
} from "@/components";
import { PILOT_PREREGISTERED, PILOT_SCOPE } from "@/data/pilotResults";
import { ONLINE_MODE_LABEL } from "@/lib/settings";
import { MAX_ITEMS } from "@/lib/storage";

export const metadata: Metadata = {
  title: "약관·개인정보",
  description:
    "개인정보 처리방침·이용약관·파일럿 참여 동의 세 문서입니다. 지금 이 앱이 실제로 하는 일을 그대로 적었습니다.",
};

/* ── /legal — 세 문서를 한 장에 ────────────────────────────────
   이 화면이 지키는 규칙은 셋입니다.

   1. **문서 작성 과정 이야기는 화면에 쓰지 않습니다.** 이 문서들은 관련 법령(개인정보 보호법·
      약관규제법·의료기기법 등)을 조문 단위로 대조해 작성했고, 변호사 검토는 아직 받지 않았습니다 —
      그 사실은 사용자에게 필요한 정보가 아니라 팀의 진행 상태이므로, 화면이 아니라 발표
      문답카드(본선_예상질문_문답카드)가 맡습니다. 안 한 검토를 했다고 쓰는 것만 금지입니다.
   2. **적는 것은 코드가 하는 일뿐입니다.** 저장소 이름·건수 상한·나가는 칸의 목록은 전부
      실제 구현에서 옮겨 왔고, 값은 상수를 그대로 가져다 씁니다(MAX_ITEMS·PILOT_* 등).
      「대체로 안전합니다」류의 여지는 두지 않습니다 — 여지를 두면 화면이 앱보다 앞서갑니다.
   3. **아직 없는 기능은 없다고 적습니다.** 파일럿 제공사·창구처럼 아직 정해지지 않은 값은
      「정해지는 대로 이 절에 적습니다」로 자리를 밝혀 둡니다.

   법률 상투어(「기타 관계 법령에 따라」·「회사는 …할 수 있습니다」)는 쓰지 않습니다. 이 앱의
   다른 화면과 같은 목소리로, 짧은 문장에 사실만 적습니다. */

/** 절마다 맨 위에 붙는 시행일 — 문구의 단일 원천, 문서를 고친 날 함께 올립니다. */
const DRAFT_NOTE = "시행일 2026. 8. 25.";

/** 목차 칩 — 절 셋뿐이라 스크롤 추적 없이 앵커 링크만 둡니다. */
const TOC: readonly { id: string; label: string }[] = [
  { id: "privacy", label: "개인정보" },
  { id: "terms", label: "이용약관" },
  { id: "pilot", label: "파일럿 동의" },
];

/**
 * 시행일 표시.
 * `/for-orgs`·`/safety`의 「계획」 표기와 같은 문법입니다 — 색 면을 쓰지 않고 헤어라인 하나로만
 * 구분합니다(앰버는 「다시 볼 것」과 감정 상태 전용, 빨강은 119와 ⚑CF 전용).
 */
function DraftMark() {
  return (
    <span className="inline-flex items-center rounded-chip border border-line-strong px-[9px] py-[2px] text-[0.7813rem] leading-[1.5] font-bold whitespace-nowrap text-ink-soft">
      {DRAFT_NOTE}
    </span>
  );
}

/** 문서 한 벌(절). 제목 22px + 검토 상태 표시 + 안내 한 문단. */
function Doc({
  id,
  num,
  title,
  lead,
  children,
}: {
  id: string;
  num: string;
  title: string;
  lead: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-[16px] border-t border-line pt-7">
      <p className="chim-num text-[0.7813rem] leading-[1.5] font-bold tracking-[0.06em] text-ink-muted">
        {num}
      </p>
      <h2 className="mt-1 text-[1.375rem] leading-[1.3] font-extrabold tracking-[-0.02em] text-ink">
        {title}
      </h2>
      <p className="mt-[10px]">
        <DraftMark />
      </p>
      <p className="mt-[10px] text-[0.9375rem] leading-[1.65] text-ink-soft">{lead}</p>
      {children}
    </section>
  );
}

/** 절 안의 조항 한 칸 — 제목 17px + 본문. */
function Article({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-6">
      <h3 className="text-[1.0625rem] leading-[1.4] font-extrabold text-ink">{title}</h3>
      <div className="mt-2">{children}</div>
    </div>
  );
}

/** 읽는 눈금(15px)의 본문 한 문단. */
function P({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-[0.9375rem] leading-[1.65] text-ink ${className ?? ""}`.trim()}>
      {children}
    </p>
  );
}

/** 짧은 항목 나열 — 가운뎃점 하나로 줄을 엽니다(아이콘·이모지 없음). */
function Bullets({ items }: { items: readonly ReactNode[] }) {
  return (
    <ul className="mt-2 flex flex-col gap-[7px]">
      {items.map((item, index) => (
        <li key={index} className="flex gap-2 text-[0.9375rem] leading-[1.65] text-ink">
          <span aria-hidden className="flex-none text-ink-ghost">
            ·
          </span>
          <span className="min-w-0 flex-1">{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** 이름 + 설명 목록 — 저장 항목·측정 항목처럼 「무엇이 무엇인지」를 세울 때 씁니다. */
function DefRows({ rows }: { rows: readonly { t: string; d: ReactNode }[] }) {
  return (
    <ul className="chim-hairline mt-3 border-y border-line">
      {rows.map((row) => (
        <li key={row.t} className="py-[14px]">
          <p className="text-[1.0625rem] leading-[1.4] font-extrabold text-ink">{row.t}</p>
          <p className="mt-[6px] text-[0.9375rem] leading-[1.65] text-ink-soft">{row.d}</p>
        </li>
      ))}
    </ul>
  );
}

/**
 * 기기 안에 남는 것 — 실제 저장소 항목을 그대로 옮겨 적습니다.
 * 항목이 늘거나 줄면 이 목록도 같은 날 함께 고칩니다
 * (`src/lib/storage.ts`·`src/lib/settings.ts`·`src/lib/stageMode.ts`).
 */
const STORED_ITEMS: readonly { t: string; d: string }[] = [
  {
    t: "훈련 이력",
    d: "훈련한 시각·시나리오·턴마다의 판정 결과와 코칭 문구가 남습니다. 하신 말씀 원문은 담기지 않습니다.",
  },
  {
    t: "확정한 보고 기록",
    d: "가명처리를 지난 본문과 급여제공기록지 5요소 초안이 남습니다. 가리기 전 원문은 저장하지 않습니다.",
  },
  {
    t: "이어서 하기",
    d: "중간에 그만두신 자리를 되찾기 위한 표시입니다. 판정된 분기 번호와 게이지·횟수뿐이고, 말은 담기지 않습니다.",
  },
  {
    t: "이수 누계",
    d: "시나리오별 이수 횟수와 이수 시수입니다. 이수 확인서가 이 값을 씁니다.",
  },
  {
    t: "설정",
    d: `글자 크기·음성 빠르기, 그리고 「${ONLINE_MODE_LABEL}」 스위치 한 칸입니다. 예전에는 여기에 주소·키가 함께 담겼지만 지금은 서버로 옮겼고, 이 기기에는 어떤 키도 두지 않습니다.`,
  },
  {
    t: "체험용 예시 표시",
    d: "화면 확인을 위해 예시 기록을 심었는지 여부만 담는 쪽지입니다.",
  },
  {
    t: "시연 표시",
    d: "발표·시연 때만 켜는 화면 스위치의 켜짐/꺼짐 한 칸입니다. 개인 정보는 담기지 않습니다.",
  },
  {
    t: "이수 파일 가져오기 기록",
    d: "다른 기기에서 만든 이수 파일을 두 번 더하지 않기 위한 발급번호와 합계입니다. 사람을 가리키는 값은 없습니다.",
  },
  {
    t: "자유 연습 횟수",
    d: "자유 연습을 몇 번 마쳤는지 숫자 하나입니다. 대화 내용은 어디에도 저장하지 않습니다.",
  },
  {
    t: "주간 목표",
    d: "한 주에 몇 번 연습할지 정해 두신 숫자입니다.",
  },
  {
    t: "첫 방문·안내 표시",
    d: "첫 화면 안내와 마이크 첫 사용 안내를 이미 보셨는지 여부만 담는 쪽지 둘입니다.",
  },
];

/**
 * `/legal` — 약관·개인정보 세 문서.
 *
 * 왜 한 장인가: 세 문서를 라우트 셋으로 나누면 「어느 것을 읽었는지」가 흩어지고, 파일럿
 * 안내문에서 링크 하나만 걸 자리가 없어집니다. 절마다 앵커를 두어 링크는 셋으로 걸되,
 * 화면은 하나로 둡니다.
 *
 * 탭바에는 넣지 않습니다 — 매일 쓰는 이동 경로가 아니라 한 번 읽고 닫는 화면입니다
 * (`/guide`·`/safety`·`/for-orgs`와 같은 취급). 진입은 `/guide`의 링크와 홈 하단 링크입니다.
 */
export default function LegalPage() {
  return (
    <PageShell tabBar={false}>
      <ScreenHeader
        title="약관·개인정보"
        subtitle="개인정보 처리방침 · 이용약관 · 파일럿 참여 동의"
        action={
          <Link
            href="/guide"
            className="flex min-h-[48px] items-center rounded-field px-1 text-[0.8438rem] font-semibold text-ink-muted transition-colors duration-150 active:bg-paper-2"
          >
            닫기
          </Link>
        }
      />

      <p className="mt-4 text-[0.9063rem] leading-[1.75] text-ink">
        아래 세 문서는 <b className="font-bold">지금 이 앱이 실제로 하는 일만</b> 적었습니다.
        저장 항목·건수 상한·기기 밖으로 나가는 데이터 목록은 전부 실제 구현에서 옮겨 왔고, 아직
        없는 기능은 없다고 적었습니다. 앱이 바뀌면 이 문서도 같은 날 함께 바뀝니다.
      </p>

      <nav aria-label="문서 바로가기" className="mt-4 flex flex-wrap gap-2">
        {TOC.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className="inline-flex min-h-[48px] items-center rounded-chip border border-line-strong px-4 text-[0.9375rem] font-bold text-ink-soft transition-colors duration-150 active:bg-paper-2"
          >
            {item.label}
          </a>
        ))}
      </nav>

      {/* ── ① 개인정보 처리방침 ───────────────────────────── */}
      <Doc
        id="privacy"
        num="01"
        title="개인정보 처리방침"
        lead="이 앱에는 회원가입도 로그인도 없습니다. 그래서 아래에는 모은 것을 어떻게 다루는지보다, 왜 모을 자리가 없는지를 주로 적었습니다."
      >
        <Article title="1. 수집하는 항목 — 없습니다">
          <Bullets
            items={[
              "계정을 만들지 않습니다. 성명·연락처·생년월일을 입력받는 칸이 앱 어디에도 없습니다.",
              "훈련에서 대화하는 인물은 전원 가상 인물입니다. 실제 대상자의 정보를 훈련 화면에 넣지 마십시오.",
              "이용 통계를 수집하는 코드를 넣지 않았습니다. 쿠키로 이용자를 알아보지도 않습니다.",
              "카메라와 위치는 앱이 한 번도 요청하지 않고, 응답 헤더로 아예 잠가 두었습니다. 열어 둔 것은 마이크 하나뿐이고, 그것도 버튼을 누르는 동안만 켜집니다.",
            ]}
          />
        </Article>

        <Article title="2. 기기 안에 남는 것">
          <P>
            아래 항목들이 이 기기의 브라우저 저장소에만 남습니다. 침착 서버로 올라가는 경로가
            없습니다.
          </P>
          <DefRows rows={STORED_ITEMS} />
          <P className="mt-3">
            훈련 이력과 보고 기록은 각각 최근 {MAX_ITEMS}건까지만 남고, 넘으면 오래된 것부터
            지워집니다.
          </P>
        </Article>

        <Article title="3. 지우는 방법">
          <Bullets
            items={[
              <>
                내 이력 화면 아래 <b className="font-bold text-ink">「이 기기의 기록 지우기」</b>
                를 누르시면 훈련 이력·확정 기록·이수 누계, 그리고 이수 파일 가져오기 기록이
                지워집니다. 되돌릴 수 없습니다.
              </>,
              "이어서 하기 표시·설정값·자유 연습 횟수·주간 목표·안내 표시·체험용 예시 표시·시연 표시는 그 버튼으로 지워지지 않습니다. 전부 지우시려면 브라우저의 사이트 데이터 삭제를 쓰십시오.",
              "지운 기록은 되살릴 수 없습니다. 남기실 이수 사실이 있으면 먼저 이수 확인서를 인쇄하거나 파일로 내려받아 두십시오.",
            ]}
          />
        </Article>

        <Article title="4. 기기 밖으로 나가는 경우 — 셋뿐입니다">
          <P>
            아래 셋 말고는 이 앱이 기기 밖으로 보내는 것이 없습니다. 화면 코드가 다른 도메인으로
            요청을 보내지 못하도록 응답 헤더(콘텐츠 보안 정책)로 막아 두었습니다. 다만 (1)의 음성
            인식은 화면 코드가 아니라 브라우저가 자기 기능으로 처리하는 구간이라, 이 잠금이 닿지
            않습니다.
          </P>

          <p className="mt-5 text-[0.9375rem] leading-[1.4] font-extrabold text-ink">
            (1) 음성 인식 — 마이크를 쓰실 때만
          </p>
          <P className="mt-2">
            브라우저에 들어 있는 기능을 그대로 씁니다. 기기·브라우저에 따라 브라우저 제조사 서버를
            경유할 수 있고, 그 구간은 침착이 통제하지 못합니다. 버튼과 타이핑만 쓰시면 이 구간이
            아예 없습니다.
          </P>

          <p className="mt-5 text-[0.9375rem] leading-[1.4] font-extrabold text-ink">
            (2) 온라인 모드 — 켜신 경우에만
          </p>
          <P className="mt-2">
            설정 메뉴의 스위치 한 칸이고 <b className="font-bold">기본은 꺼짐</b>입니다. 켜는 것도
            끄는 것도 사용자 손에 있습니다. 켜신 경우 상황 훈련에서는 아래 두 자리에서만 문장이
            나가고, 자유 연습에서는 대화가 오갑니다 — 자유 연습은 아래 (3)에 따로 적습니다.
          </P>
          <Bullets
            items={[
              <>
                <b className="font-bold text-ink">코칭 문장</b> — 어느 판정 신호에도 걸리지 않아
                미분류로 넘어간 턴에 한해, 가명처리를 지난 말(최대 500자)과 시나리오 요약·질문·
                행동지표·인용 가능 문서 목록이 나갑니다.
              </>,
              <>
                <b className="font-bold text-ink">어르신·보호자 대사 변주</b> — 시나리오 요약·인물
                프로필·검수해 둔 대사·직전 인물 대사만 나갑니다. 학습자의 말은 실리지 않습니다.
                요청 형식에 그 칸 자체가 없습니다.
              </>,
              "브라우저가 접속하는 곳은 침착 서버 한 곳뿐입니다. 외부 AI 제공사의 주소와 키는 서버에만 있고 브라우저에는 두지 않습니다.",
              "침착 서버는 보낸 말과 받은 문장을 저장하지 않고 로그로도 남기지 않습니다. 세는 것은 접속 IP 기준의 호출 횟수뿐이고, 그것도 메모리 안 계수기라 디스크·로그에는 남지 않습니다.",
              "제공사 쪽에서 무엇을 얼마나 보관하는지는 그 제공사의 정책을 따릅니다. 파일럿에서 쓰는 제공사와 그 정책은 파일럿 안내문에 적습니다.",
              "이 전송의 근거는 이용자의 동의입니다. 위의 가명처리는 노출을 줄이기 위한 안전장치이지, 법이 정한 가명정보 처리 특례를 주장하기 위한 것이 아닙니다.",
            ]}
          />

          <p className="mt-5 text-[0.9375rem] leading-[1.4] font-extrabold text-ink">
            (3) 자유 연습 — 온라인 모드를 켠 경우에만
          </p>
          <P className="mt-2">
            정해진 시나리오 없이 대화하며 연습하는 화면입니다. 이 화면에서는{" "}
            <b className="font-bold">주고받는 대화가 위 (2)와 같은 경로(침착 서버 한 곳)로
            전송됩니다.</b>{" "}
            보내기 전에 하신 말씀과 상황 한 줄은 기기 안 가명처리(성명·번호·기관명·주소·생년)를
            지나고, 모든 표현을 빠짐없이 찾는다고 보증하지는 않습니다. 대화는 어디에도 저장하지
            않습니다. 화면을 벗어나면 연습 횟수 숫자 하나만 남습니다.
            시작 화면이 같은 내용을 다시 알려 드리고, 동의하신 뒤에만 대화가 시작됩니다.
          </P>
        </Article>

        <Article title="5. 오프라인 저장(서비스워커)">
          <P>
            회선이 끊겨도 화면이 열리도록, 응급 안내와 훈련 한 바퀴에 필요한 화면·파일·음성을 기기에
            미리 저장해 둡니다. 개인정보가 담길 수 있는 요청은 저장하지 않습니다. 브라우저의 사이트
            데이터를 지우시면 이 저장분도 함께 사라집니다.
          </P>
        </Article>

        {/* 확정 전에 정해야 할 것이 하나 남아 있습니다 — **위탁인가 제공인가**입니다.
            제공사 약관에서 입력을 제공사가 자기 목적으로 이용·학습하는지 확인해, 이용하지
            않으면 이 절을 「처리위탁」으로 바꿔 수탁자와 위탁 업무를 공개하고, 이용하면
            제공·국외 이전 동의로 설계합니다. 어느 쪽인지가 정해져야 어느 법정 요건이
            적용되는지가 정해지므로, 제공사가 정해지기 전에는 아래 예고 한 줄만 둡니다. */}
        <Article title="6. 제3자 제공·국외 이전">
          <P>
            온라인 모드를 켜지 않으시면 제3자에게 가는 것이 없습니다. 켜신 경우 위 4-(2)에 적은
            것만 외부 AI 제공사에 닿습니다. 광고나 분석 목적으로 제공하는 곳은 없습니다.
          </P>
          <P className="mt-2">
            제공사의 명칭·연락처와 소재 국가, 이전되는 항목과 그 시기·방법, 받는 자의 이용 목적과
            보유 기간, 그리고 거부하시는 방법과 그 효과는 파일럿에서 쓸 제공사가 정해지는 대로 이
            절에 적습니다.
          </P>
        </Article>

        <Article title="7. 문의와 삭제 요청">
          <P>
            받는 곳은 <b className="font-bold">파일럿 안내문에 기재</b>합니다. 파일럿마다 창구가
            달라, 이 화면에는 담당자 연락처를 적지 않습니다.
          </P>
          <P className="mt-2">
            열람·정정·삭제·처리정지를 요구하시는 방법과 개인정보 보호 책임 연락처는 파일럿 창구가
            정해지는 대로 이 절에 적습니다.
          </P>
        </Article>
      </Doc>

      {/* ── ② 이용약관 ────────────────────────────────────── */}
      <Doc
        id="terms"
        num="02"
        title="이용약관"
        lead="이 앱이 무엇을 하는 도구이고 무엇을 하는 도구가 아닌지, 그 경계를 적었습니다."
      >
        <Article title="1. 목적과 성격">
          <P>
            <b className="font-bold">{INLINE_DISCLAIMER_TEXT}.</b> 모든 화면 아래에 같은 문장이 한
            줄로 붙어 있습니다.
          </P>
          <P className="mt-2">
            침착은 돌봄받는 분이 아니라 돌보는 분을 훈련시키는 시뮬레이터입니다. 어르신 역은 AI가
            맡고, 옳고 그름은 법령과 공단 지침을 옮긴 규칙이 봅니다.
          </P>
          <P className="mt-2">
            침착은 「의료기기법」 제2조의 의료기기가 아니며, 질병의 진단·치료·처치를 목적으로 하지
            않습니다. 응급 안내는 119 신고와 관찰·확인 절차의 교육용 안내이고, 신체에 대한 처치는
            지도하지 않습니다.
          </P>
        </Article>

        <Article title="2. 판정과 이수 확인서의 효력">
          <Bullets
            items={[
              "화면에 붙는 「충족 · 코칭 · 즉시 중단」은 교육적 피드백입니다. 자격을 주거나 사람을 평가하는 결과가 아닙니다.",
              "점수·등급·순위는 만들지 않습니다. 남는 것은 해 본 것과 다시 볼 것까지입니다.",
              "이수 확인서에는 이수 사실만 담깁니다. 앱 기록 기반이며 법정 보수교육 이수 인정이 아니고, 기관 자체 직무교육·정기평가 내부 증빙용입니다.",
              "확인서의 발급번호는 같은 기록이면 늘 같은 값이라 중복 제출을 걸러내는 데 씁니다. 위조를 막는 장치는 아니며, 확인자 서명이 효력을 만듭니다.",
            ]}
          />
        </Article>

        <Article title="3. 이용자의 책임">
          <Bullets
            items={[
              "실제 대상자의 성명·연락처·주소를 훈련 화면에 입력하지 마십시오. 훈련 상대는 전원 가상 인물입니다.",
              "보고 화면이 만들어 드리는 것은 초안입니다. 기관 서식과 담당자 확인을 거쳐 쓰십시오. 확정 버튼은 이용자가 직접 누릅니다.",
              "실제 응급 상황에서는 119가 먼저입니다. 몸에 손이 닿는 술기는 앱이 지도하지 않고, 119 상황실이 목소리로 직접 지도합니다.",
            ]}
          />
        </Article>

        <Article title="4. 기록에 대한 책임">
          <Bullets
            items={[
              "기록은 이 기기에만 있습니다. 서버 사본이 없어, 브라우저 데이터를 지우거나 기기를 바꾸거나 잃어버리시면 되살릴 수 없습니다.",
              "남기셔야 할 이수 사실은 확인서 인쇄나 파일 내려받기로 미리 옮겨 두십시오.",
              "백업은 이용자와 기관의 몫입니다. 앱이 대신 보관해 드리지 않습니다.",
            ]}
          />
        </Article>

        <Article title="5. 보증하지 않는 것">
          <Bullets
            items={[
              "있는 그대로 제공합니다. 특정한 결과가 나온다고 보증하지 않습니다.",
              "음성 인식과 소리로 읽어 주는 기능은 브라우저 기능이라 기기에 따라 동작하지 않을 수 있습니다. 그때도 버튼과 타이핑만으로 완주하실 수 있습니다.",
              "오프라인 동작은 한 번 열어 두신 기기 기준입니다. 처음 여는 기기에서는 회선이 필요합니다.",
              "온라인 모드는 연결이 준비돼 있지 않거나 한도를 넘으면 외부 AI에는 아무것도 전달되지 않고, 검수해 둔 문장이 그대로 나옵니다. 이때 침착 서버까지 갔던 요청은 저장 없이 버려집니다.",
            ]}
          />
        </Article>

        <Article title="6. 근거 문서와 인용">
          <Bullets
            items={[
              "판정 근거는 공식 문서 목록 안의 문서만 씁니다. 목록 밖 문서는 근거로 쓰지 않습니다.",
              "근거를 찾지 못하면 판정을 멈추고 「공식 지침에서 근거를 찾지 못했습니다. 담당 간호사 또는 기관에 확인해 주세요.」로 넘깁니다.",
              "표준교재는 공공누리 제4유형(변경금지)이라 원문을 인용하지 않고 대응 원칙만 참고했습니다.",
              "훈련 대사는 가상 인물의 문장이며 실존 인물·기관과 무관합니다.",
            ]}
          />
        </Article>

        <Article title="7. 이 문서의 변경">
          <P>
            이 화면은 앱의 현재 동작을 따라 바뀌고, 고친 날짜를 시행일로 함께 올립니다. 내용을 바꿀
            때는 적용 7일 전까지, 이용자께 불리한 변경은 30일 전까지 이 화면과 파일럿 창구로
            알립니다.
          </P>
          <P className="mt-2">
            제공 주체(운영 팀 또는 기관)의 명칭과 대표 연락처는 파일럿 계약이 정해지는 대로 이
            화면에 적습니다.
          </P>
        </Article>
      </Doc>

      {/* ── ③ 파일럿 참여 동의 ─────────────────────────────── */}
      <Doc
        id="pilot"
        num="03"
        title="파일럿 참여 동의"
        lead={`기관에서 파일럿을 여실 때 참여자께 드리는 안내입니다. 범위는 ${PILOT_SCOPE}입니다.`}
      >
        <Article title="1. 참여는 자발적입니다">
          <Bullets
            items={[
              "참여하지 않으셔도 됩니다. 참여 여부를 인사·평가 자료로 쓰지 않습니다.",
              "참여하셔도 언제든 그만두실 수 있습니다. 이유를 밝히지 않으셔도 됩니다.",
              "그만두신다고 이미 하신 훈련 기록이 지워지지는 않습니다. 그 기록은 기기 안에 그대로 남고, 지우실지는 참여자가 정하십니다.",
            ]}
          />
        </Article>

        <Article title="2. 무엇을 재는지 — 미리 정해 두었습니다">
          <P>
            결과를 보고 유리한 지표를 고르는 일이 없도록, 잴 항목을 먼저 적어 화면에 걸어 두었습니다.
            아래 두 가지 밖의 항목을 새로 재려면 다시 알려 드리고 다시 여쭙습니다.
          </P>
          <DefRows rows={PILOT_PREREGISTERED} />
          <P className="mt-3">
            아직 재지 않았습니다. 1차 결과가 나오면 안전·개인정보 설계 화면의 검증 계단에 그대로
            게시합니다.
          </P>
        </Article>

        <Article title="3. 무엇이 제출되는지">
          <Bullets
            items={[
              "기기 안 기록은 참여자 본인의 것입니다. 앱이 자동으로 어딘가로 보내는 경로가 없습니다.",
              "제출은 참여자가 고르신 것만 — 이수 확인서 인쇄본이나 내려받은 파일 형태입니다.",
              "훈련 중 하신 말씀 원문은 기기에도 저장되지 않습니다. 그래서 교차 채점은 참여자가 그 자리에서 따로 적어 주신 응답으로만 하고, 그 응답도 가명처리를 지난 뒤 사람이 봅니다.",
            ]}
          />
          <P className="mt-3">
            제출하신 자료는 파일럿 결과 정리 후 정해 둔 기간 안에 파기하고, 여러 사람의 자료를 합친
            통계만 남습니다. 구체적인 기간은 파일럿 안내문에 확정해 적습니다.
          </P>
        </Article>

        <Article title="4. 관리자에게 보이는 것">
          <P>
            이수 여부와 이수 시수까지입니다. 대화 내용과 턴마다의 판정은 관리자에게 공개하지
            않습니다.
          </P>
        </Article>

        <Article title="5. 그만두시는 방법과 문의">
          <Bullets
            items={[
              "담당자에게 말씀하시면 그날로 측정이 멈춥니다.",
              "이미 제출하신 자료를 빼 달라고 하실 수 있습니다. 다만 여러 사람의 자료를 합쳐 통계를 낸 뒤에는 개별 자료만 되돌려 빼지 못하는 경우가 있어, 그 경계도 파일럿 안내문에 함께 적습니다.",
              "창구는 파일럿 안내문에 기재합니다.",
              "파일럿 결과를 기관 밖에 공표하는 연구로 진행하는 경우에 한해, 시작 전에 기관생명윤리위원회의 심의 또는 심의 면제 확인을 받습니다.",
            ]}
          />
        </Article>

        <Article title="6. 예상되는 위험과 이득">
          <P>
            이 파일럿으로 예상되는 위험은 훈련에 쓰시는 시간과 훈련 중 느끼실 수 있는 심리적 부담
            정도이며, 신체적 위험은 없습니다. 참여에 따른 보상이 있는지는 파일럿 안내문에 적습니다.
          </P>
        </Article>
      </Doc>

      <section className="mt-7 border-t border-line pt-7">
        <h2 className="text-[1.0625rem] leading-[1.4] font-bold text-ink">함께 보실 화면</h2>
        <p className="mt-[6px] text-[0.8438rem] leading-[1.7] text-ink-soft">
          위 문서가 말로 적은 것을, 아래 화면은 지금 이 기기에서 재서 보여 드립니다.
        </p>
        <div className="mt-[8px]">
          <ListRows>
            <ListRow
              href="/safety"
              title="안전·개인정보 설계"
              subtitle="3계층 생성통제 · AI가 쓰이는 여섯 자리 · 가명처리가 지나는 길 · 지금 이 기기에서 재는 실시간 계측"
            />
            <ListRow
              href="/guide"
              title="처음 오신 분께"
              subtitle="네 화면이 하루 어디에 놓이는지 · 시작까지 세 걸음 · 자주 묻는 다섯 가지"
            />
          </ListRows>
        </div>
      </section>

      <InlineDisclaimer size="md" tone="readable" className="mt-6 mb-3" />
    </PageShell>
  );
}
