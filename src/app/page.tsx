import Link from "next/link";
import {
  AiBadge,
  Badge,
  BigButton,
  Card,
  FeedbackCard,
  Gauge,
  PageShell,
  SourceChip,
} from "@/components";

/* ── 랜딩 전용 소형 조각들 ─────────────────────────────────── */

function SectionHead({
  eyebrow,
  title,
  lead,
  align = "left",
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      <p className="text-sm font-bold tracking-wide text-brand-700">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-extrabold text-ink md:text-3xl">{title}</h2>
      {lead && <p className="mt-3 text-base leading-relaxed text-ink-soft md:text-lg">{lead}</p>}
    </div>
  );
}

function AiShare({ filled, tone }: { filled: 0 | 1 | 2 | 3; tone: "brand" | "warn" | "danger" }) {
  const fill =
    tone === "brand" ? "bg-brand-500" : tone === "warn" ? "bg-warn" : "bg-danger";
  return (
    <div className="mt-4 flex items-center gap-2">
      <span className="text-sm font-semibold text-ink-muted">AI 생성 관여</span>
      <span className="flex gap-1" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`h-2.5 w-7 rounded-chip ${i < filled ? fill : "bg-line"}`}
          />
        ))}
      </span>
    </div>
  );
}

function Stat({
  value,
  unit,
  label,
  note,
  tone = "brand",
}: {
  value: string;
  unit?: string;
  label: string;
  note?: string;
  tone?: "brand" | "warn" | "danger";
}) {
  const color =
    tone === "brand" ? "text-brand-700" : tone === "warn" ? "text-warn-ink" : "text-danger-ink";
  return (
    <Card className="h-full">
      <p className={`text-3xl leading-none font-extrabold ${color} md:text-4xl`}>
        {value}
        {unit && <span className="ml-1 text-xl font-bold md:text-2xl">{unit}</span>}
      </p>
      <p className="mt-3 text-base font-bold text-ink">{label}</p>
      {note && <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{note}</p>}
    </Card>
  );
}

/* ── 데이터 ────────────────────────────────────────────────── */

const FEATURES = [
  {
    step: "①",
    kicker: "배우고 · 훈련 모드",
    title: "AI 상황 시뮬레이터",
    lead: "AI가 어르신 역을 맡고, 말한 내용을 턴마다 짚어 줍니다.",
    bullets: [
      "시나리오와 난이도를 고르고 마이크를 누릅니다",
      "턴마다 🟢 충족 · ⚪ 코칭과 근거 문장이 바로 뜹니다",
      "초조도 변화를 보고 같은 상황을 다시 연습합니다",
    ],
    href: "/train",
    cta: "훈련 모드 열기",
  },
  {
    step: "②",
    kicker: "일하고 · 실전 모드",
    title: "핸즈프리 응급 음성 가이드",
    lead: "두 손을 쓸 수 없을 때, 검수된 고정 안내를 단계별로 읽어 줍니다.",
    bullets: [
      "응급 상황에서는 119 안내를 가장 먼저 띄웁니다",
      "이 구간에는 생성 호출이 없습니다 — 고정 스크립트만 재생합니다",
      "서버가 멈춰도 캐시로 계속 재생됩니다",
    ],
    href: "/emergency",
    cta: "응급 가이드 열기",
  },
  {
    step: "③",
    kicker: "성장하고 · 기록 · 이력",
    title: "음성 보고 → 기록 코칭",
    lead: "말로 보고하면 기록 초안이 만들어지고, 확인만 하면 됩니다.",
    bullets: [
      "이름·번호·기관명은 기기 안에서 먼저 가려집니다",
      "빠진 항목을 짚어 주고, 확정은 본인이 합니다",
      "훈련 이력이 쌓여 보수교육·정기평가 증빙이 됩니다",
    ],
    href: "/report",
    cta: "기록 코칭 열기",
    extra: { href: "/history", label: "성장 기록 보기" },
  },
] as const;

const TIERS = [
  {
    tier: "L1",
    name: "훈련",
    tone: "brand" as const,
    share: 3 as const,
    what: "어르신·보호자 역 대사를 대본 범위 안에서만 생성합니다.",
    guard: "대본에서 벗어나면 검수된 고정 대사로 되돌립니다.",
    badge: "대본 안에서만",
  },
  {
    tier: "L2",
    name: "채점",
    tone: "warn" as const,
    share: 1 as const,
    what: "검색된 근거 문서 안에서만 판정 문장을 만듭니다.",
    guard: "근거를 찾지 못하면 답을 만들지 않고 확인 안내로 넘깁니다.",
    badge: "근거 안에서만",
  },
  {
    tier: "L3",
    name: "실전 응급",
    tone: "danger" as const,
    share: 0 as const,
    what: "생성 호출 자체가 없습니다. 사전 검수된 고정 스크립트만 재생합니다.",
    guard: "119 안내가 언제나 가장 앞에 있고, 119 버튼이 상시 노출됩니다.",
    badge: "생성 0%",
  },
];

/* ── 페이지 ────────────────────────────────────────────────── */

export default function Home() {
  return (
    <PageShell bleed>
      {/* 1. 히어로 */}
      <section className="chim-hero-glow border-b border-line">
        <div className="chim-container py-12 md:py-20">
          <div className="max-w-3xl">
            <Badge tone="brand" size="md">
              돌봄 현장 대응 훈련 시뮬레이터
            </Badge>

            <h1 className="mt-5 text-[2rem] leading-tight font-extrabold text-ink md:text-5xl">
              돌봄받는 사람이 아니라,
              <br />
              <span className="text-brand-700">돌보는 사람</span>을 훈련시킵니다
            </h1>

            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-soft">
              치매·응급·갈등 상황을 AI와 반복 연습하고, 공식 대응 지침을 기준으로 즉시 피드백을
              받습니다. AI는 상대역만 맡고, 옳고 그름의 판정은 법령과 공단 지침이 합니다.
            </p>

            {/* 고정 문구 (안전 규칙 §3-3) */}
            <p className="mt-7 rounded-card border-l-[6px] border-brand-600 bg-white/90 px-5 py-4 text-lg font-bold text-brand-800 shadow-soft md:text-xl">
              정답을 맞히는 시험이 아니라, 말이 나오게 만드는 연습입니다.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <BigButton href="/train" size="lg">
                90초 훈련 시작하기
              </BigButton>
              <BigButton href="/emergency" size="lg" variant="secondary">
                응급 음성 가이드 보기
              </BigButton>
            </div>

            <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-base text-ink-muted">
              <li>설치 없이 브라우저에서 바로</li>
              <li aria-hidden="true">·</li>
              <li>마이크가 없어도 버튼만으로 완주</li>
              <li aria-hidden="true">·</li>
              <li>훈련에서 만나는 인물은 전원 가상 인물</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 2. 3기능 */}
      <section className="border-b border-line bg-white">
        <div className="chim-container py-12 md:py-16">
          <SectionHead
            eyebrow="사용자 흐름"
            title="배우고 → 일하고 → 성장하고"
            lead="사전 훈련부터 현장 대응, 사후 기록까지 하나의 순환으로 이어집니다."
          />

          <div className="mt-8 grid gap-5 md:grid-cols-3 md:gap-6">
            {FEATURES.map((f) => (
              <Card key={f.href} className="flex h-full flex-col" hoverable>
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 items-center justify-center rounded-chip bg-brand-100 text-lg font-extrabold text-brand-800"
                  >
                    {f.step}
                  </span>
                  <span className="text-sm font-bold text-brand-700">{f.kicker}</span>
                </div>

                <h3 className="mt-4 text-xl font-extrabold text-ink">{f.title}</h3>
                <p className="mt-2 text-base leading-relaxed text-ink-soft">{f.lead}</p>

                <ul className="mt-4 flex-1 space-y-2">
                  {f.bullets.map((b) => (
                    <li key={b} className="flex gap-2 text-base leading-relaxed text-ink">
                      <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-chip bg-brand-400" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 flex flex-col gap-2">
                  <BigButton href={f.href} variant="secondary" block>
                    {f.cta}
                  </BigButton>
                  {"extra" in f && f.extra && (
                    <Link
                      href={f.extra.href}
                      className="inline-flex min-h-[48px] items-center justify-center text-base font-semibold text-brand-700 underline underline-offset-4"
                    >
                      {f.extra.label}
                    </Link>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 3. 90초 훈련 미리보기 */}
      <section className="border-b border-line">
        <div className="chim-container py-12 md:py-16">
          <SectionHead
            eyebrow="90초 훈련의 실제"
            title="배회 시나리오 「집에 가야 해」"
            lead="같은 상황이 내 말에 따라 갈립니다. 대본 재생이 아니라 초조도 상태에 따른 분기입니다."
          />

          <Card className="mt-8" padded={false}>
            <div className="border-b border-line p-5 md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="brand">치매 행동심리증상</Badge>
                  <Badge tone="neutral">초급</Badge>
                  <Badge tone="neutral">약 90초</Badge>
                </div>
                <div className="w-full max-w-xs">
                  <Gauge value={3} max={5} label="초조도" crisisAt={5} />
                </div>
              </div>
            </div>

            <div className="space-y-5 p-5 md:p-6">
              {/* AI 대사 */}
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-bold text-ink">박 어르신</span>
                  <AiBadge />
                </div>
                <div className="mt-2 max-w-xl rounded-card rounded-tl-sm border border-line bg-paper-2 px-5 py-4">
                  <p className="text-lg leading-relaxed font-semibold text-ink">
                    「집에 가야 해. 애가 기다려.」
                  </p>
                  <p className="mt-1.5 text-base text-ink-muted italic">
                    (현관 앞에서 신발을 반쯤 신은 채)
                  </p>
                </div>
              </div>

              {/* 첫 시도 */}
              <div className="flex flex-col items-end">
                <span className="mb-2 text-base font-bold text-ink-soft">학습자 첫 시도</span>
                <div className="max-w-xl rounded-card rounded-tr-sm border border-brand-200 bg-brand-50 px-5 py-4">
                  <p className="text-lg leading-relaxed text-ink">
                    「어르신, 여기가 어르신 집이에요. 따님은 지난주에 다녀가셨잖아요.」
                  </p>
                </div>
              </div>

              <FeedbackCard
                ok={false}
                label="사실 확인형"
                message="사실부터 반박하면 초조도가 올라갑니다. 부정하기 전에 그리운 마음을 먼저 말로 인정해 주세요."
                docId="DOC-GUIDE-001"
              />

              {/* 재시도 */}
              <div className="flex flex-col items-end">
                <span className="mb-2 text-base font-bold text-ink-soft">학습자 재시도</span>
                <div className="max-w-xl rounded-card rounded-tr-sm border border-brand-200 bg-brand-50 px-5 py-4">
                  <p className="text-lg leading-relaxed text-ink">
                    「따님이 많이 보고 싶으시죠. 얘기 좀 들려주세요. 저랑 걸으면서요.」
                  </p>
                </div>
              </div>

              <FeedbackCard
                ok
                label="감정 인정형"
                message="감정을 먼저 인정하셨습니다. 다음은 배회의 계기(배고픔·통증·화장실·불안)를 확인하는 질문입니다."
                docId="DOC-GUIDE-001"
              />

              <div className="rounded-card border border-warn-line bg-warn-soft p-5">
                <p className="text-base leading-relaxed font-semibold text-warn-ink">
                  재시도도 반박이면 초조도가 한 칸 더 올라가고 「배회 발생」 상태로 넘어갑니다.
                  목표가 설득에서 안전 확보로 바뀝니다.
                </p>
                <div className="mt-4 max-w-xs">
                  <Gauge value={5} max={5} label="초조도" crisisAt={5} />
                </div>
              </div>

              <p className="text-base leading-relaxed text-ink-muted">
                화면에는 점수도 등급도 표시하지 않습니다. 🟢 충족과 ⚪ 코칭 두 가지, 그리고 코칭
                한 문장과 근거 출처만 보여 줍니다. 대사는 현직 감수본 기준이며 등장인물은 전원
                가상 인물입니다.
              </p>

              <BigButton href="/train" size="lg">
                직접 해 보기
              </BigButton>
            </div>
          </Card>
        </div>
      </section>

      {/* 4. 안전 설계 3계층 */}
      <section className="border-b border-line bg-white">
        <div className="chim-container py-12 md:py-16">
          <SectionHead
            eyebrow="안전 설계"
            title="위험할수록 AI의 지분을 줄입니다"
            lead="잘 답하는 AI보다 안전하게 멈추는 AI가 필요합니다. 구간마다 AI가 할 수 있는 일의 범위를 다르게 잠갔습니다."
          />

          <div className="mt-8 grid gap-5 md:grid-cols-3 md:gap-6">
            {TIERS.map((t) => (
              <Card key={t.tier} tone={t.tone === "danger" ? "danger" : "default"} className="h-full">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex h-10 items-center rounded-chip px-3.5 text-lg font-extrabold ${
                      t.tone === "brand"
                        ? "bg-brand-100 text-brand-800"
                        : t.tone === "warn"
                          ? "bg-warn-soft text-warn-ink"
                          : "bg-danger text-white"
                    }`}
                  >
                    {t.tier}
                  </span>
                  <span className="text-lg font-extrabold text-ink">{t.name}</span>
                </div>

                <p className="mt-4 text-base leading-relaxed text-ink">{t.what}</p>
                <p className="mt-2 text-base leading-relaxed text-ink-soft">{t.guard}</p>

                <div className="mt-4">
                  <Badge tone={t.tone === "brand" ? "brand" : t.tone === "warn" ? "warn" : "danger"}>
                    {t.badge}
                  </Badge>
                </div>

                <AiShare filled={t.share} tone={t.tone} />
              </Card>
            ))}
          </div>

          <Card tone="quiet" className="mt-6">
            <p className="text-base leading-relaxed text-ink">
              치명적 실패 3항목(업무 범위를 벗어난 행위 · 신체 제한 · 119 지연)은 확률 모델이
              아니라 규칙 엔진이 단독으로 판정합니다. 근거를 찾지 못하면 이렇게 답합니다 —
              <span className="font-bold text-ink">
                {" "}
                「공식 지침에서 근거를 찾지 못했습니다. 담당 간호사 또는 기관에 확인해 주세요.」
              </span>
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <SourceChip docId="DOC-NOTI-002" />
              <BigButton href="/safety" variant="secondary">
                안전·개인정보 설계 자세히 보기
              </BigButton>
            </div>
          </Card>
        </div>
      </section>

      {/* 5. 숫자 */}
      <section className="border-b border-line">
        <div className="chim-container py-12 md:py-16">
          <SectionHead
            eyebrow="왜 지금인가"
            title="자격증은 304만 개, 현장에 선 사람은 10명 중 2명입니다"
            lead="사람이 부족한 것이 아니라, 현장에 남을 수 있는 조건이 부족합니다."
          />

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Stat value="3,044,230" unit="명" label="요양보호사 자격 취득" note="누적 (2025.6)" />
            <Stat
              value="22.9"
              unit="%"
              label="활동률 · 698,521명"
              note="6년째 내려가는 중 (24.8% → 22.9%)"
              tone="warn"
            />
            <Stat
              value="116,784"
              unit="명"
              label="2028년 요양보호사 부족 전망"
              note="이 공백은 결국 가족이 떠안습니다"
              tone="danger"
            />
            <Stat
              value="+0"
              unit="시간"
              label="2024년 개정에서 늘지 않은 현장실습"
              note="이론 +46시간 · 실기 +34시간 · 현장실습 +0시간"
              tone="warn"
            />
            <Stat
              value="8"
              unit="시간"
              label="2년마다 보장되는 보수교육 전부"
              note="그중 온라인 수강 가능 시간은 최대 4시간"
              tone="warn"
            />
            <Stat
              value="30 / 30"
              label="규칙 엔진 경계 케이스 전수 통과"
              note="판정 지연 p95 0.11ms · 실행 로그 보유 (2026.7.27)"
            />
          </div>

          <p className="mt-6 text-sm leading-relaxed text-ink-muted">
            출처 · 보건복지부 제출자료(2025.6, 국회 보건복지위원회) · 국민건강보험공단
            건강보험연구원 부족 전망 · 2024년 요양보호사 양성지침(보건복지부) ·
            「노인장기요양보험법」 제23조제2항 및 같은 법 시행령 제11조의2 · 요양보호사 보수교육
            운영지침(국민건강보험공단) · 침착 규칙 엔진 실행 로그(2026.7.27).
          </p>

          <Card tone="brand" className="mt-8">
            <p className="text-lg leading-relaxed font-bold text-brand-900 md:text-xl">
              침착이 만드는 것은 앱이 아니라, 사람이 현장에 남을 수 있는 조건입니다.
            </p>
            <p className="mt-3 text-base leading-relaxed text-ink-soft">
              요양보호사 개인은 무료로 씁니다. 가족 돌봄자에게도 무료로 열립니다.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <BigButton href="/train" size="lg">
                훈련 시작하기
              </BigButton>
              <BigButton href="/safety" variant="secondary" size="lg">
                안전 설계 보기
              </BigButton>
            </div>
          </Card>
        </div>
      </section>

      {/* 6. 푸터 */}
      <footer className="bg-white">
        <div className="chim-container py-10 md:py-12">
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <p className="flex items-baseline gap-2">
                <span className="text-xl font-extrabold text-brand-800">침착</span>
                <span className="text-sm font-semibold text-ink-muted">ChimChak</span>
              </p>
              <p className="mt-3 max-w-sm text-base leading-relaxed text-ink-soft">
                돌봄받는 사람이 아니라 돌보는 사람을 훈련시키는 AI 시뮬레이터입니다.
              </p>
            </div>

            <nav aria-label="바로가기">
              <p className="text-base font-bold text-ink">바로가기</p>
              <ul className="mt-3 space-y-1.5">
                {[
                  { href: "/train", label: "훈련 모드" },
                  { href: "/emergency", label: "응급 음성 가이드" },
                  { href: "/report", label: "기록 코칭" },
                  { href: "/history", label: "성장 기록" },
                  { href: "/safety", label: "안전·개인정보 설계" },
                ].map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="inline-flex min-h-[48px] items-center text-base font-semibold text-brand-700 underline underline-offset-4"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div>
              <p className="text-base font-bold text-ink">고지</p>
              <p className="mt-3 text-base leading-relaxed text-ink-soft">
                본 서비스는 훈련·교육 목적이며 119 신고 및 의료인의 진단·처방을 대체하지 않습니다.
                훈련에 등장하는 인물은 전원 가상 인물이며 실존 인물·기관과 무관합니다.
              </p>
            </div>
          </div>

          <p className="mt-9 border-t border-line pt-5 text-sm text-ink-muted">
            침착(ChimChak) · 2026년 제8회 K-디지털 트레이닝 해커톤 출품작 · 데모 환경에서는 모든
            판정이 이 기기 안에서 이루어집니다.
          </p>
        </div>
      </footer>
    </PageShell>
  );
}
