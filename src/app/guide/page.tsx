import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  BigButton,
  EyebrowLabel,
  InlineDisclaimer,
  ListRow,
  ListRows,
  PageShell,
  ScreenHeader,
} from "@/components";
import { CALL_119_CAPTION } from "@/app/emergency/_components/Call119Bar";
import { SOURCE_DOCS } from "@/data/docs";
import { PROTOCOLS } from "@/data/protocols";
import { CHK_A01, getActiveScenarios } from "@/data/scenarios";
import { DocCloseButton } from "../_components/DocCloseButton";
import { GUIDE_PRIVACY_FAQ_ID } from "../_components/guideAnchors";

export const metadata: Metadata = {
  title: "처음 오신 분께",
  description:
    "네 화면이 하루 어디에 놓이는지, 첫 훈련을 시작하기까지 세 걸음, 그리고 자주 묻는 다섯 가지를 한 장에 적었습니다.",
};

/* 화면에 적는 숫자는 데이터에서 세어 옵니다 — 시나리오·프로토콜이 늘면 이 문장도 함께 바뀝니다.
   손으로 적어 두면 편성표가 늘어난 날 이 화면만 옛 숫자를 말하게 됩니다. */
const ACTIVE_SCENARIOS = getActiveScenarios();
const ACTIVE_COUNT = ACTIVE_SCENARIOS.length;
const PROTOCOL_COUNT = PROTOCOLS.length;

/** 한 판이 몇 분인지 — 열린 시나리오의 실제 소요 폭입니다(한 종뿐이면 「약 N분」). */
const DURATIONS = ACTIVE_SCENARIOS.map((scenario) => scenario.durationMin);
const MIN_MINUTES = Math.min(...DURATIONS);
const MAX_MINUTES = Math.max(...DURATIONS);
const DURATION_TEXT =
  MIN_MINUTES === MAX_MINUTES ? `약 ${MIN_MINUTES}분` : `${MIN_MINUTES}~${MAX_MINUTES}분`;

/** 첫 연습으로 여는 시나리오 — 홈 히어로 CTA와 같은 자리로 보냅니다(두 곳이 갈리지 않게). */
const FIRST_SCENARIO = CHK_A01;
const FIRST_SCENARIO_HREF = `/train/${FIRST_SCENARIO.id.toLowerCase()}`;

/**
 * 첫 화면 고정 문구 — 안전 규칙(브리프 §3-3)에 걸린 문장입니다. 한 글자도 바꾸지 마세요.
 * 홈(`app/page.tsx`)의 히어로와 같은 문장이며, 처음 오신 분이 홈을 지나쳐 이 화면으로 바로
 * 들어오셔도 같은 약속을 먼저 읽으시게 두는 자리입니다.
 */
const PRACTICE_LINE = "정답을 맞히는 시험이 아니라, 말이 나오게 만드는 연습입니다.";

function Section({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-7">
      <h2 className="text-[1.0625rem] leading-[1.4] font-bold text-ink">{title}</h2>
      {lead && <p className="mt-[6px] text-[0.8438rem] leading-[1.7] text-ink-soft">{lead}</p>}
      {children}
    </section>
  );
}

/** 하루의 어느 자리에서 여는 화면인지 — 시간 순서 그대로 놓습니다. */
const WHEN_ROWS: readonly { when: string; title: string; desc: string; href: string }[] = [
  {
    when: "근무 전",
    title: "훈련 — 말이 나오는지 미리 한 번",
    desc: `어르신 역은 AI가 맡고, 옳고 그름은 법령·공단 지침이 봅니다. 지금 열린 상황은 ${ACTIVE_COUNT}종이고 한 판이 ${DURATION_TEXT}입니다.`,
    href: "/train",
  },
  {
    when: "근무 중",
    title: "응급 안내 — 손이 급할 때 목소리로",
    desc: `검수된 고정 문구 ${PROTOCOL_COUNT}종을 음성과 큰 자막으로 읽어 드립니다. 통신이 끊긴 자리에서도 열리고, 신체 술기는 119 상황실이 목소리로 직접 지도합니다.`,
    href: "/emergency",
  },
  {
    when: "근무 후",
    title: "보고 — 말로 하면 기록 초안까지",
    desc: "말이나 타이핑으로 상황을 보고하시면 기기 안에서 가려야 할 곳을 표시하고, 급여제공기록지 5요소 초안을 만들어 드립니다. 확정은 직접 누르십니다.",
    href: "/report",
  },
  {
    when: "이따금",
    title: "내 이력 — 해 본 것과 다시 볼 것",
    desc: "지나온 훈련과 확정하신 기록이 모입니다. 기관에 낼 이수 확인서도 이 화면에서 만드십니다.",
    href: "/history",
  },
];

/** 첫 훈련을 시작하기까지 — 화면에서 실제로 누르시는 순서 그대로입니다. */
const STEPS: readonly { title: string; desc: string }[] = [
  {
    title: "상황을 고릅니다",
    desc: "훈련 화면에서 카드 하나를 누르시면 됩니다. 처음이시라면 「현관 앞, 집에 가야 해요」를 권해 드립니다.",
  },
  {
    title: "브리핑을 읽고 시작합니다",
    desc: "어떤 분이고 무슨 상황인지 한 장으로 먼저 보여 드립니다. 등장인물은 전원 가상 인물이며 실존 인물·기관과 무관합니다.",
  },
  {
    title: "말이나 버튼으로 답합니다",
    desc: "마이크를 꾹 누른 채 말씀하셔도 되고, 아래 제안 버튼이나 직접 입력만 쓰셔도 됩니다. 한 번 답할 때마다 그 자리에서 코칭 한 줄이 붙습니다.",
  },
];

/**
 * 자주 묻는 다섯 가지.
 *
 * 답은 **지금 코드가 하는 일**만 적습니다 — 「곧 됩니다」·「대체로 안전합니다」류의 여지를 두면
 * 이 화면이 앱보다 앞서가 버립니다. 각 항목은 실제로 확인하실 수 있는 화면으로 보냅니다.
 */
const FAQ: readonly { id?: string; q: string; a: ReactNode; href: string; linkLabel: string }[] = [
  {
    q: "마이크가 안 되면 훈련을 못 하나요?",
    a: (
      <>
        하실 수 있습니다. 마이크는 거들 뿐이고, <b className="font-bold text-ink">제안 버튼과 직접
        입력만으로 처음부터 끝까지 완주</b>하도록 만들었습니다. 마이크 버튼을 처음 누르시면
        브라우저가 사용 허용을 묻는데, 허용하지 않으셔도 훈련은 그대로 이어집니다. 소리로 읽어
        주는 기능이 없는 기기에서도 안내 문구는 화면 자막으로 전부 보실 수 있습니다.
      </>
    ),
    href: "/train",
    linkLabel: "훈련 화면 열기",
  },
  {
    q: "인터넷이 끊기면 어떻게 되나요?",
    a: (
      <>
        한 번 여신 적이 있는 기기라면 응급 안내 {PROTOCOL_COUNT}종과 훈련 한 바퀴가 기기에 저장돼
        있어 그대로 열립니다. 이 앱은 판정도 기록도 전부 기기 안에서 하기 때문에, 회선이 끊겨도
        멈추는 곳이 없습니다. 다만 <b className="font-bold text-ink">음성 인식만은 브라우저 내장
        기능</b>이라 기기·브라우저에 따라 제조사 서버를 경유할 수 있고, 끊긴 자리에서는 동작하지
        않을 수 있습니다. 그때도 버튼과 타이핑은 그대로 됩니다.
      </>
    ),
    href: "/emergency",
    linkLabel: "응급 안내 미리 저장해 두기",
  },
  {
    /* 홈의 「안전 설계 보기」가 이 항목으로 들어옵니다 — 안심하려고 누른 분이 3계층 설명서
       대신 자기 말로 된 답을 먼저 만나시게 하는 자리입니다(페르소나 현직 med). */
    id: GUIDE_PRIVACY_FAQ_ID,
    q: "제가 말한 내용은 어디로 가나요?",
    a: (
      <>
        <b className="font-bold text-ink">기본 상태에서는 이 기기 밖으로 나가지 않습니다.</b>{" "}
        계정이 없고, 하신 말씀 원문은 저장하지 않습니다. 훈련이 끝나면 남는 것은 해 본
        상황과 코칭 요약까지입니다. 설정에서 온라인 모드를 켜신 경우에만 가명처리를 지난 말이 침착
        서버를 거쳐 나가며, 무엇이 나가는지는 안전·개인정보 설계와 약관·개인정보에 그대로 적혀
        있습니다. 보고 화면에서는 성명·번호·기관명·주소·생년을 가린 뒤에야 저장되고,
        확정 버튼은 직접 누르십니다. 기기에서 기록을 지우시면 되살릴 수 없습니다.
      </>
    ),
    href: "/safety",
    linkLabel: "안전·개인정보 설계 보기",
  },
  {
    q: "왜 점수가 없나요?",
    a: (
      <>
        점수를 두면 점수를 올리는 연습이 되기 쉬워서, 처음부터 만들지 않았습니다. 대신 한 번
        답하실 때마다{" "}
        <b className="font-bold text-ink">「충족 · 코칭 · 즉시 중단」 세 낱말</b>과 코칭 한 문장,
        그리고 무슨 문서를 근거로 그렇게 봤는지를 붙입니다. 내 이력에도 등급·순위·백분위는
        만들지 않고, 해 본 것과 다시 볼 것만 남습니다.
      </>
    ),
    href: "/history",
    linkLabel: "내 이력 보기",
  },
  {
    q: "빨간 119 버튼을 눌러도 되나요?",
    a: (
      <>
        훈련 중에는 누르지 마십시오. 그 버튼은 시늉이 아니라 실제 전화 앱을 여는 링크입니다.
        버튼 아래에도{" "}
        <b className="font-bold text-ink">「{CALL_119_CAPTION}」</b>라고 적혀 있습니다. 실제 상황이라면 망설이지 말고
        먼저 누르십시오. 응급 안내는 119보다 앞서지 않고, 119에 알리는 것을 언제나 먼저 놓습니다.
      </>
    ),
    href: "/emergency",
    linkLabel: "응급 안내 화면 열기",
  },
];

/**
 * `/guide` — 처음 오신 분께.
 *
 * 왜 별도 화면인가: 홈은 「지금 한 판 하러 왔다」는 분의 화면이라 설명을 얹을수록 첫 CTA가
 * 뒤로 밀립니다. 그렇다고 설명이 아무 데도 없으면, 앱을 처음 여신 분이 네 화면 중 어디부터
 * 눌러야 하는지를 스스로 알아내셔야 합니다. 그 설명만 이 한 장으로 빼 두었습니다.
 *
 * 규칙 셋.
 *  1. **탭바에 넣지 않습니다** — 탭 5칸은 매일 쓰는 이동 경로이고, 이 화면은 한 번 읽고 나면
 *     다시 오지 않는 곳입니다(/for-orgs·/safety와 같은 취급).
 *  2. **여기서 끝내지 않습니다** — 모든 항목이 실제 화면으로 나갑니다. 읽기만 하고 닫는 화면이
 *     되면 「말이 나오게 만드는 연습」이 한 번도 시작되지 않습니다.
 *  3. **지금 되는 것만 적습니다** — 답은 전부 현재 코드가 하는 일이고, 되지 않는 것은 되지
 *     않는다고 적습니다(마이크·오프라인 항목의 단서 문장).
 */
export default function GuidePage() {
  return (
    <PageShell sourceDocs={SOURCE_DOCS} tabBar={false}>
      <ScreenHeader
        title="처음 오신 분께"
        subtitle="네 화면이 하루 어디에 놓이는지 · 시작까지 세 걸음 · 자주 묻는 다섯 가지"
        action={
          <DocCloseButton
            fallbackHref="/"
            className="flex min-h-[48px] items-center rounded-field px-1 text-[0.8438rem] font-semibold text-ink-muted transition-colors duration-150 active:bg-paper-2"
          />
        }
      />

      {/* 리드 문단은 이 화면에서 처음 읽는 문장입니다 — 14.5px은 가이드 §7-8의 가독 하한
          (읽어야 하는 문장 15px)을 어기는 값이라 한 단 올렸습니다(페르소나 디자이너 high). */}
      <p className="mt-4 text-[0.9375rem] leading-[1.75] text-ink">
        <b className="font-bold">{PRACTICE_LINE}</b> 그래서 이 앱에는 시험도 등수도 없습니다. 매일
        여실 화면은 네 개뿐이고, 각각이 하루의 어느 자리에 놓이는지만 알고 계시면 됩니다.
      </p>

      <Section
        title="네 화면이 하루 어디에 놓이는지"
        lead="한 번에 다 보실 필요는 없습니다. 오늘은 근무 전 한 판만 하셔도 됩니다."
      >
        <div className="mt-[8px]">
          <ListRows>
            {WHEN_ROWS.map((row) => (
              <ListRow
                key={row.href}
                href={row.href}
                title={
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[0.7813rem] leading-[1.45] font-bold tracking-[0.06em] text-ink-muted">
                      {row.when}
                    </span>
                    <span>{row.title}</span>
                  </span>
                }
                subtitle={<span className="leading-[1.6] text-ink-soft">{row.desc}</span>}
                ariaLabel={`${row.when} — ${row.title}`}
              />
            ))}
          </ListRows>
        </div>
      </Section>

      <Section
        title="첫 훈련까지 세 걸음"
        lead="처음 한 판은 마이크 없이 버튼만으로도 끝납니다."
      >
        <ol className="chim-hairline mt-[8px] border-y border-line">
          {STEPS.map((step, index) => (
            <li key={step.title} className="py-[12px]">
              <p className="text-[0.875rem] leading-[1.45] font-bold text-ink">
                <span className="chim-num">{index + 1}</span>. {step.title}
              </p>
              <p className="mt-[3px] text-[0.8438rem] leading-[1.7] text-ink-soft">{step.desc}</p>
            </li>
          ))}
        </ol>

        <div className="mt-4 flex flex-col gap-2">
          <BigButton href={FIRST_SCENARIO_HREF} size="lg" block className="font-bold">
            첫 상황 연습하기 · 약 {FIRST_SCENARIO.durationMin}분
          </BigButton>
          <BigButton href="/train" variant="secondary" block>
            다른 상황 먼저 둘러보기
          </BigButton>
        </div>
        <p className="mt-[10px] text-center text-[0.8125rem] leading-[1.6] text-ink-soft">
          「{FIRST_SCENARIO.title}」 — {FIRST_SCENARIO.typeLabel}. 중간에 그만두셔도 이어서 하실 수
          있습니다.
        </p>
      </Section>

      <Section title="자주 묻는 다섯 가지">
        <div className="mt-[10px] flex flex-col gap-[10px]">
          {FAQ.map((item) => (
            <div
              key={item.q}
              {...(item.id ? { id: item.id } : {})}
              className="scroll-mt-4 rounded-[14px] bg-paper-2 px-4 py-[14px]"
            >
              <h3 className="text-[0.9375rem] leading-[1.45] font-bold text-ink">{item.q}</h3>
              <p className="mt-[6px] text-[0.8438rem] leading-[1.7] text-ink-soft">{item.a}</p>
              <p className="mt-[2px]">
                <Link
                  href={item.href}
                  className="inline-flex min-h-[48px] items-center rounded-field text-[0.8438rem] font-bold text-brand-700 transition-colors duration-150 hover:text-brand-800"
                >
                  {item.linkLabel} ›
                </Link>
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="더 자세히 보고 싶으시다면"
        lead="여기까지 읽지 않으셔도 훈련에는 아무 지장이 없습니다."
      >
        <EyebrowLabel className="mt-4 mb-[2px]">두 화면</EyebrowLabel>
        <ListRows>
          <ListRow
            href="/safety"
            title="안전·개인정보 설계"
            subtitle="위험할수록 AI의 지분을 줄이는 3계층, 가명처리가 지나는 길, 지금 이 기기에서 재는 실시간 계측"
          />
          <ListRow
            href="/for-orgs"
            title="기관 도입 안내"
            subtitle="기관 담당자용 한 장 — 무엇이 서류로 남고, 무엇이 아직 아닌지"
          />
        </ListRows>
      </Section>

      {/* 약관·개인정보는 「더 자세히」 목록에 섞지 않고 제목을 그대로 세워 둡니다 —
          「약관」이라는 낱말을 찾아 내려오신 분이 헤딩에서 바로 보시게 하려는 자리입니다. */}
      <Section
        title="약관·개인정보"
        lead="개인정보 처리방침·이용약관·파일럿 참여 동의. 지금 이 앱이 실제로 하는 일만 적혀 있습니다."
      >
        <div className="mt-[8px]">
          <ListRows>
            <ListRow
              href="/legal"
              title="개인정보 처리방침 · 이용약관 · 파일럿 참여 동의"
              subtitle="무엇이 기기 안에만 남는지, 기기 밖으로 나가는 경우 셋, 그리고 파일럿에 참여하실 때의 약속"
            />
          </ListRows>
        </div>
      </Section>

      {/* 이 화면에는 탭바가 없습니다. 끝까지 읽고 내려오신 분이 바닥에서 만나는 것이 고지 한
          줄뿐이면, 나가려고 읽은 만큼을 도로 올라가야 합니다 — 바닥에도 문 하나를 둡니다
          (페르소나 UI/UX med). */}
      <p className="mt-7 border-t border-line pt-4 text-center">
        <Link
          href="/"
          className="inline-flex min-h-[48px] items-center rounded-field px-2 text-[0.8438rem] font-semibold text-ink-muted underline underline-offset-4 transition-colors duration-150 active:bg-paper-2"
        >
          홈으로
        </Link>
      </p>

      <InlineDisclaimer size="md" tone="readable" className="mt-2 mb-3" />
    </PageShell>
  );
}
