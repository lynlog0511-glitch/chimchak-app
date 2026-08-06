import { Fragment } from "react";
import Link from "next/link";
import {
  BigButton,
  EyebrowLabel,
  INLINE_DISCLAIMER_TEXT,
  InlineDisclaimer,
  ListRow,
  ListRows,
  PageShell,
  SettingsMenu,
} from "@/components";
import { SCENARIOS } from "@/data/scenarios";
import { FirstVisitHint } from "./_components/FirstVisitHint";
import { ResumeCard, type ResumeScenario } from "./_components/ResumeCard";
import { SessionPreviewCard } from "./_components/SessionPreviewCard";

/* ── 홈 = 시안 5a(모바일) · 7c(데스크톱) ────────────────────────
   랜딩 페이지가 아니라 **앱의 첫 화면**입니다(v4 §0·§3).

   모바일(<md)은 5a 그대로입니다 — 상단바 → 고정 문구 히어로 → CTA 둘 → 하던 훈련
   → 세 가지를 합니다 → 계층 카드. 한 줄도 바꾸지 않았습니다.

   데스크톱은 7c로 갈라집니다 — 상단바는 셸의 가로 네비가 대신하고(md↑),
   히어로가 2단이 됩니다: [왼쪽 고정 문구 40px + CTA 가로 둘 + 「배우고·일하고·성장하고」 한 줄]
   [오른쪽 360px 미리보기 카드 = 훈련 한 턴의 실물]. 그 아래 L1/L2/L3 가로 밴드와 고지.
   「세 가지를 합니다」 리스트는 그때 접습니다 — 같은 말을 히어로 한 줄이 이미 하고,
   이동 경로는 상단 네비가 갖고 있습니다.

   **2단으로 갈라지는 지점은 md(768)가 아니라 lg(1024)입니다.** 7c는 960px 프레임을 전제로 한
   구성인데(가이드 §5), 프레임이 960에 닿는 것은 뷰포트 1024부터입니다. 768에서 갈라 버리면
   좌측 칸이 280px밖에 남지 않아 40px 히어로가 글자당 한 줄로 무너집니다 —
   그래서 768~1023 구간은 셸만 데스크톱(상단 네비)이고 본문은 5a 구성을 읽기 폭으로 유지합니다.

   px·색은 시안의 인라인 값 그대로입니다.
   ─────────────────────────────────────────────────────────── */

/** 첫 화면 고정 문구 — 안전 규칙에 걸린 문장입니다. 한 글자도 바꾸지 마세요.
    줄바꿈만 화면 폭에 따라 다릅니다(모바일 2줄 · 데스크톱 3줄). */
const PRACTICE_LINE_A = "정답을 맞히는 시험이 아니라,";
const PRACTICE_LINE_B1 = "말이 나오게 만드는";
const PRACTICE_LINE_B2 = "연습입니다.";

/**
 * 가상 인물 고지 — 홈에는 대사가 없으므로 하단 고지에 함께 답니다.
 * 문구는 훈련 화면(`train/_components/constants.ts`의 `FICTION_NOTICE`)과 한 글자도 다르지 않습니다.
 */
const FICTION_NOTICE = "등장인물은 전원 가상 인물이며 실존 인물·기관과 무관합니다.";

/** 첫 연습으로 여는 시나리오 — CHK-A01 「현관 앞, 집에 가야 해요」 브리핑. */
const FIRST_SCENARIO_ID = "CHK-A01";

/** 라우트 파라미터는 소문자로 통일합니다(`/train/chk-a01`). */
function scenarioPath(id: string): string {
  return `/train/${id.toLowerCase()}`;
}

/** 「세 가지를 합니다」 — 카드가 아니라 리스트 3행입니다(v4 §2). 문구는 시안 5a 그대로입니다. */
const THINGS: readonly { title: string; subtitle: string; href: string }[] = [
  {
    title: "배우고 — 상황 훈련",
    subtitle: "어르신 역의 AI와 말로 연습, 턴마다 코칭",
    href: "/train",
  },
  {
    title: "일하고 — 응급 음성 안내",
    subtitle: "손을 못 쓸 때 목소리로, 오프라인에서도",
    href: "/emergency",
  },
  {
    title: "성장하고 — 보고·기록 코칭",
    subtitle: "말로 보고하면 가명처리해 기록 초안까지",
    href: "/report",
  },
];

/** 데스크톱 히어로 아래 한 줄 (시안 7c) — 같은 세 가지를 문장 하나로 줄인 것입니다. */
const THINGS_INLINE: readonly { lead: string; rest: string }[] = [
  { lead: "배우고", rest: "상황 훈련" },
  { lead: "일하고", rest: "응급 음성 안내" },
  { lead: "성장하고", rest: "기록 코칭" },
];

/** 생성 통제 3계층 — 막대는 장식이고(aria-hidden) 뜻은 아래 텍스트가 전합니다.
    데스크톱은 가로 밴드라 자리가 넓어, 각 계층이 무엇을 하는지까지 한 줄에 적습니다(시안 7c). */
const TIERS: readonly { label: string; mobileTail?: string; deskTail: string; bar: string }[] = [
  { label: "L1 대화", deskTail: " — 역할 연기만", bar: "bg-brand-600" },
  { label: "L2 채점", deskTail: " — 규칙 사전", bar: "bg-brand-300" },
  {
    label: "L3 응급",
    mobileTail: " · 생성 0건",
    deskTail: " — 생성 0건, 119 먼저",
    bar: "bg-line-strong",
  },
];

/** 체크포인트는 시나리오 id만 저장합니다 — 제목·경로는 여기서 붙여 넘깁니다. */
const RESUME_SCENARIOS: readonly ResumeScenario[] = SCENARIOS.map((scenario) => ({
  id: scenario.id,
  title: scenario.title,
  href: scenarioPath(scenario.id),
}));

export default function Home() {
  return (
    /* lg↑에서 960 전폭 2단을 직접 짜므로 셸의 읽기 폭 제한은 끄고(모바일에는 영향 없음),
       그 사이 구간(md~lg)만 본문을 읽기 폭으로 모아 둡니다. */
    <PageShell narrow={false} className="md:mx-auto md:max-w-[600px] lg:max-w-none">
      {/* 상단 바 — 로고 17px w800 딥틸 + 「설정」 13.5px.
          md↑에서는 셸의 가로 네비(워드마크·메뉴·설정)가 이 역할을 이어받습니다. */}
      <header className="flex items-center pt-2 pb-1 md:hidden">
        <span className="text-[1.0625rem] leading-[1.3] font-extrabold tracking-[-0.01em] text-brand-800">
          침착
        </span>
        <SettingsMenu className="ml-auto" />
      </header>

      {/* 히어로 — 고정 문구가 이 화면의 주인공입니다. 큰 글자는 이것 하나뿐입니다.
          lg↑에서 왼쪽 문구 / 오른쪽 미리보기 카드로 갈라집니다(시안 7c). */}
      <section className="pt-[22px] pb-5 lg:flex lg:items-center lg:gap-12 lg:pt-14 lg:pb-12">
        <div className="lg:min-w-0 lg:flex-1">
          {/* 줄바꿈: 모바일은 시안 5a대로 두 줄로 끊고, lg↑에서는 그 <br>을 접어
              472px 칸 안에서 자연스럽게 세 줄로 앉게 둡니다(문장은 그대로입니다). */}
          <h1 className="text-[1.4375rem] leading-[1.45] font-extrabold tracking-[-0.02em] text-ink lg:text-[2.5rem] lg:leading-[1.32] lg:tracking-[-0.025em]">
            {PRACTICE_LINE_A}{" "}
            <br className="lg:hidden" />
            {PRACTICE_LINE_B1} {PRACTICE_LINE_B2}
          </h1>
          <p className="mt-2 text-[0.8438rem] leading-[1.6] text-ink-muted lg:mt-[14px] lg:max-w-[420px] lg:text-[1rem] lg:leading-[1.6]">
            돌보는 사람을 위한 상황 훈련 — 판정은 AI가 아니라 법령·공단 지침이 합니다.
          </p>

          {/* CTA 둘. 주인공은 위 하나입니다(56px 채움) — 아래는 회색 면 48px로 물러섭니다.
              라벨 크기는 BigButton의 코어 콘텐츠 하한(lg 18px · md 17px)을 따릅니다.
              md↑에서는 시안 7c대로 가로로 섭니다. */}
          <div className="mt-[18px] flex flex-col gap-2 lg:mt-[26px] lg:flex-row lg:gap-[10px]">
            <BigButton
              href={scenarioPath(FIRST_SCENARIO_ID)}
              size="lg"
              block
              className="font-bold lg:w-auto"
            >
              첫 상황 연습하기 · 약 4분
            </BigButton>
            <BigButton href="/emergency" variant="secondary" block className="lg:w-auto">
              응급 안내 미리 저장해 두기
            </BigButton>
          </div>

          {/* 「배우고·일하고·성장하고」 — 데스크톱 히어로의 마지막 한 줄(시안 7c).
              모바일에서는 아래 리스트 3행이 같은 일을 합니다. */}
          <ul className="mt-[26px] hidden flex-wrap items-center gap-x-[22px] gap-y-2 text-[0.8438rem] leading-[1.45] text-ink-soft lg:flex">
            {THINGS_INLINE.map((item, i) => (
              <Fragment key={item.lead}>
                <li>
                  <b className="font-bold text-ink">{item.lead}</b> {item.rest}
                </li>
                {i < THINGS_INLINE.length - 1 && (
                  <li aria-hidden className="text-line-strong">
                    ·
                  </li>
                )}
              </Fragment>
            ))}
          </ul>
        </div>

        {/* 실물 증거 — 훈련 한 턴을 그대로 세워 둡니다. 데스크톱에서만 자리가 납니다. */}
        <SessionPreviewCard className="hidden lg:block" />
      </section>

      {/* 처음 오신 분께만 — 「마이크 없이 버튼만으로 4분」을 시작 버튼 바로 아래에서 알려 드립니다.
          닫으시면 이 기기에 그 사실만 남고(chimchak.visited.v1) 다시 나타나지 않습니다.
          두 번째 방문부터는 이 자리가 통째로 비어 위아래 간격도 생기지 않습니다. */}
      <FirstVisitHint className="mb-3 lg:max-w-[560px]" />

      {/* 하던 훈련 — 체크포인트가 있을 때만 나타납니다(없으면 이 자리가 통째로 비어 있습니다). */}
      <ResumeCard scenarios={RESUME_SCENARIOS} className="lg:max-w-[560px]" />

      {/* 세 가지를 합니다 — 아이콘 없이 [제목 + 부제] + `›` (v4 §2)
          2단 히어로가 서는 폭에서는 히어로 한 줄과 상단 네비가 같은 일을 하므로 접습니다. */}
      <section className="pt-5 lg:hidden" aria-labelledby="home-things">
        <EyebrowLabel id="home-things" className="mb-[2px]">
          세 가지를 합니다
        </EyebrowLabel>
        <ListRows>
          {THINGS.map((thing) => (
            <ListRow
              key={thing.href}
              href={thing.href}
              title={thing.title}
              subtitle={thing.subtitle}
            />
          ))}
        </ListRows>
      </section>

      {/* 생성 통제 3계층 — 홈에서는 막대 3개와 한 줄 제목까지만. 전문은 /safety에 있습니다.
          md↑에서는 제목이 왼쪽에 서고 막대 셋이 가로 밴드가 됩니다(시안 7c). */}
      <section
        aria-labelledby="home-tiers"
        className="mt-[14px] rounded-[14px] bg-paper-2 px-[15px] py-[14px] lg:mt-6 lg:flex lg:items-center lg:gap-[14px] lg:px-5 lg:py-4"
      >
        <h2
          id="home-tiers"
          className="text-[0.8438rem] leading-[1.45] font-bold text-ink lg:flex-none lg:text-[0.8438rem]"
        >
          위험할수록 AI의 지분을 줄입니다
        </h2>
        <ul className="mt-[9px] flex items-center gap-[6px] lg:mt-0 lg:flex-1">
          {TIERS.map((tier) => (
            <li key={tier.label} className="min-w-0 flex-1 text-center lg:text-left">
              <span aria-hidden className={`block h-[6px] rounded-[3px] ${tier.bar}`} />
              {/* 지면이 넓어지는 lg에서 오히려 한 단 작아지던 자리입니다 —
                  메타 눈금(11~12.5) 위쪽으로 고정해 폭에 관계없이 같은 크기로 둡니다. */}
              <span className="mt-[5px] block text-[0.7813rem] leading-[1.45] font-semibold text-ink-soft lg:mt-1">
                {tier.label}
                {tier.mobileTail && <span className="lg:hidden">{tier.mobileTail}</span>}
                <span className="hidden lg:inline">{tier.deskTail}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* 화면 맨 아래 — 안전·개인정보 설계로 가는 작은 링크 하나와 인라인 고지 한 줄(v4 §0).
          이 화면의 유일한 고지라 faint(#b6bcb9) 대신 읽히는 톤을 씁니다. */}
      <div className="mt-6 pb-3 lg:mt-4">
        <p className="text-center">
          <Link
            href="/safety"
            className="inline-flex min-h-[48px] items-center justify-center rounded-field px-2 text-[0.7813rem] font-semibold text-ink-muted underline underline-offset-4 transition-colors duration-150 hover:text-brand-800 active:bg-paper-2"
          >
            안전·개인정보 설계
          </Link>
          <Link
            href="/for-orgs"
            className="inline-flex min-h-[48px] items-center justify-center rounded-field px-2 text-[0.7813rem] font-semibold text-ink-muted underline underline-offset-4 transition-colors duration-150 hover:text-brand-800 active:bg-paper-2"
          >
            기관 도입 안내
          </Link>
        </p>
        <InlineDisclaimer
          size="md"
          tone="readable"
          text={`${INLINE_DISCLAIMER_TEXT} · ${FICTION_NOTICE}`}
        />
      </div>
    </PageShell>
  );
}
