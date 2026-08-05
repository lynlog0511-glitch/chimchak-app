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
import { ResumeCard, type ResumeScenario } from "./_components/ResumeCard";

/* ── 홈 = 시안 5a ──────────────────────────────────────────────
   랜딩 페이지가 아니라 **앱의 첫 화면**입니다(v4 §0·§3).
   위에서부터: 상단바 → 고정 문구 히어로 → CTA 둘 → 하던 훈련 → 세 가지를 합니다 → 계층 카드.
   v3의 마케팅 섹션(숫자 밴드·차트·안전 소개·푸터)은 홈에서 걷어냈습니다 —
   안전·개인정보는 맨 아래 작은 텍스트 링크 하나로만 남습니다(/safety에 전문이 있습니다).
   px·색은 시안의 인라인 값 그대로입니다. 크기를 줄이지 말아야 하는 곳은 주석으로 표시해 뒀습니다.
   ─────────────────────────────────────────────────────────── */

/** 첫 화면 고정 문구 — 안전 규칙에 걸린 문장입니다. 한 글자도 바꾸지 마세요. */
const PRACTICE_LINE_A = "정답을 맞히는 시험이 아니라,";
const PRACTICE_LINE_B = "말이 나오게 만드는 연습입니다.";

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

/** 생성 통제 3계층 — 막대는 장식이고(aria-hidden) 뜻은 아래 텍스트가 전합니다. */
const TIERS: readonly { label: string; bar: string }[] = [
  { label: "L1 대화", bar: "bg-brand-600" },
  { label: "L2 채점", bar: "bg-brand-300" },
  { label: "L3 응급 · 생성 0건", bar: "bg-line-strong" },
];

/** 체크포인트는 시나리오 id만 저장합니다 — 제목·경로는 여기서 붙여 넘깁니다. */
const RESUME_SCENARIOS: readonly ResumeScenario[] = SCENARIOS.map((scenario) => ({
  id: scenario.id,
  title: scenario.title,
  href: scenarioPath(scenario.id),
}));

export default function Home() {
  return (
    <PageShell>
      {/* 상단 바 — 로고 17px w800 딥틸 + 「설정」 13.5px. 전역 헤더는 v4에서 사라졌습니다(§0). */}
      <header className="flex items-center pt-2 pb-1">
        <span className="text-[17px] leading-none font-extrabold tracking-[-0.01em] text-brand-800">
          침착
        </span>
        <SettingsMenu className="ml-auto" />
      </header>

      {/* 히어로 — 고정 문구가 이 화면의 주인공입니다. 큰 글자는 이것 하나뿐입니다. */}
      <section className="pt-[22px] pb-5">
        <h1 className="text-[23px] leading-[1.45] font-extrabold tracking-[-0.02em] text-ink">
          {PRACTICE_LINE_A}
          <br />
          {PRACTICE_LINE_B}
        </h1>
        <p className="mt-2 text-[14px] leading-[1.6] text-ink-muted">
          돌보는 사람을 위한 상황 훈련 — 판정은 AI가 아니라 법령·공단 지침이 합니다.
        </p>

        {/* CTA 둘. 주인공은 위 하나입니다(56px 채움) — 아래는 회색 면 48px로 물러섭니다.
            라벨 크기는 BigButton의 코어 콘텐츠 하한(lg 18px · md 17px)을 따릅니다. */}
        <div className="mt-[18px] flex flex-col gap-2">
          <BigButton href={scenarioPath(FIRST_SCENARIO_ID)} size="lg" block className="font-bold">
            첫 상황 연습하기 · 약 4분
          </BigButton>
          <BigButton href="/emergency" variant="secondary" block>
            응급 안내 미리 저장해 두기
          </BigButton>
        </div>
      </section>

      {/* 하던 훈련 — 체크포인트가 있을 때만 나타납니다(없으면 이 자리가 통째로 비어 있습니다). */}
      <ResumeCard scenarios={RESUME_SCENARIOS} />

      {/* 세 가지를 합니다 — 아이콘 없이 [제목 + 부제] + `›` (v4 §2) */}
      <section className="pt-5" aria-labelledby="home-things">
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

      {/* 생성 통제 3계층 — 홈에서는 막대 3개와 한 줄 제목까지만. 전문은 /safety에 있습니다. */}
      <section
        aria-labelledby="home-tiers"
        className="mt-[14px] rounded-[14px] bg-paper-2 px-[15px] py-[14px]"
      >
        <h2 id="home-tiers" className="text-[13px] leading-[1.5] font-bold text-ink">
          위험할수록 AI의 지분을 줄입니다
        </h2>
        <ul className="mt-[9px] flex items-center gap-[6px]">
          {TIERS.map((tier) => (
            <li key={tier.label} className="flex-1 text-center">
              <span aria-hidden className={`block h-[6px] rounded-[3px] ${tier.bar}`} />
              <span className="mt-[5px] block text-[11.5px] leading-[1.4] font-semibold text-ink-soft">
                {tier.label}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* 화면 맨 아래 — 안전·개인정보 설계로 가는 작은 링크 하나와 인라인 고지 한 줄(v4 §0).
          이 화면의 유일한 고지라 faint(#b6bcb9) 대신 읽히는 톤을 씁니다. */}
      <div className="mt-6 pb-3">
        <p className="text-center">
          <Link
            href="/safety"
            className="inline-flex min-h-[48px] items-center justify-center px-2 text-[12.5px] font-semibold text-ink-muted underline underline-offset-4 transition-colors duration-150 hover:text-brand-800"
          >
            안전·개인정보 설계
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
