import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import { AiBadge, Badge, BigButton, Card, Gauge, PageShell, SourceChip, cx } from "@/components";
import {
  IconArrowRight,
  IconChat,
  IconHeartHand,
  IconNote,
  IconSiren,
  StatusMark,
  STATUS_MARK_LABEL,
  type IconProps,
} from "@/components/icons";
import { ScaleBarChart, ShareBarChart } from "@/components/illustrations";

/* ── 랜딩 전용 소형 조각들 ─────────────────────────────────── */

function SectionHead({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="chim-meta font-bold tracking-[0.02em] text-brand-700">{eyebrow}</p>
      <h2 className="chim-h1 mt-3 text-ink">{title}</h2>
      {lead && <p className="chim-lead mt-4 text-ink-soft">{lead}</p>}
    </div>
  );
}

/** 어르신·학습자 말풍선 — 꼬리는 모서리 하나만 줄여 표현합니다(그림자 없음). */
function Bubble({
  side,
  children,
  className,
}: {
  side: "ai" | "learner";
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-card border px-4 py-3.5 md:px-5 md:py-4",
        side === "ai"
          ? "rounded-tl-sm border-brand-200 bg-brand-50"
          : "rounded-tr-sm border-line bg-paper-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * 랜딩 미리보기 전용 판정 표시.
 * 세션 화면의 `FeedbackCard`와 같은 의미 체계(충족/코칭 2단계 + 코칭 한 문장 + 근거 칩)를
 * 쓰되, 랜딩에서는 카드 대신 왼쪽 마크선으로 두어 발화 말풍선과 형태를 확실히 구분합니다.
 * 점수·등급은 어떤 경우에도 표시하지 않습니다.
 */
function Verdict({
  ok,
  label,
  message,
  docId,
}: {
  ok: boolean;
  label: string;
  message: string;
  docId: string;
}) {
  return (
    <div className={cx("border-l-[3px] pl-5", ok ? "border-ok" : "border-line-strong")}>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <StatusMark
          kind={ok ? "met" : "coach"}
          label={ok ? STATUS_MARK_LABEL.met : STATUS_MARK_LABEL.coach}
          size="sm"
        />
        <span className="chim-caption font-semibold text-ink-muted">{label}</span>
      </div>
      <p className="mt-2 text-base leading-relaxed text-ink">{message}</p>
      <div className="mt-3">
        <SourceChip docId={docId} />
      </div>
    </div>
  );
}

/** 계층별 AI 생성 관여도 — 세 칸 중 채워진 칸 수로만 보여 줍니다(점수 아님). */
function AiShare({ filled, tone }: { filled: 0 | 1 | 2 | 3; tone: "brand" | "warn" | "danger" }) {
  const fill = tone === "brand" ? "bg-brand-500" : tone === "warn" ? "bg-warn" : "bg-danger";
  return (
    <div>
      <p className="chim-caption font-semibold text-ink-muted">AI 생성 관여</p>
      <span className="mt-2 flex max-w-[9rem] gap-1.5" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span key={i} className={cx("h-2 flex-1 rounded-chip", i < filled ? fill : "bg-line")} />
        ))}
      </span>
    </div>
  );
}

/** 에디토리얼 숫자 밴드의 한 칸 — 카드가 아니라 hairline으로 나눕니다. */
function StatCell({
  value,
  unit,
  label,
  note,
  tone = "ink",
}: {
  value: string;
  unit?: string;
  label: string;
  note?: string;
  tone?: "ink" | "warn" | "danger";
}) {
  const color =
    tone === "warn" ? "text-warn-ink" : tone === "danger" ? "text-danger-ink" : "text-ink";
  return (
    <div className="border-b border-line py-7 pr-6 md:py-8">
      <p className={cx("chim-stat text-[2.1rem] md:text-[2.4rem]", color)}>
        {value}
        {unit && <span className="ml-1 text-xl font-bold">{unit}</span>}
      </p>
      <p className="mt-3 text-base font-extrabold text-ink">{label}</p>
      {note && <p className="chim-caption mt-1.5 leading-relaxed text-ink-muted">{note}</p>}
    </div>
  );
}

/* ── 데이터 ────────────────────────────────────────────────── */

interface Feature {
  step: string;
  kicker: string;
  title: string;
  lead: string;
  Icon: ComponentType<IconProps>;
  bullets: ReactNode[];
  href: string;
  cta: string;
  extra?: { href: string; label: string };
}

const FEATURES: Feature[] = [
  {
    step: "①",
    kicker: "배우고 · 훈련 모드",
    title: "AI 상황 시뮬레이터",
    lead: "AI가 어르신 역을 맡고, 말한 내용을 턴마다 짚어 줍니다.",
    Icon: IconChat,
    bullets: [
      "시나리오와 난이도를 고르고 마이크를 누릅니다",
      <>
        턴마다 <StatusMark kind="met" label={STATUS_MARK_LABEL.met} size="sm" /> ·{" "}
        <StatusMark kind="coach" label={STATUS_MARK_LABEL.coach} size="sm" />과 근거 문장이 바로
        뜹니다
      </>,
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
    Icon: IconSiren,
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
    Icon: IconNote,
    bullets: [
      "이름·번호·기관명은 기기 안에서 먼저 가려집니다",
      "빠진 항목을 짚어 주고, 확정은 본인이 합니다",
      "훈련 이력이 쌓여 보수교육·정기평가 증빙이 됩니다",
    ],
    href: "/report",
    cta: "기록 코칭 열기",
    extra: { href: "/history", label: "성장 기록 보기" },
  },
];

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

const STATS = [
  {
    value: "3,044,230",
    unit: "명",
    label: "요양보호사 자격 취득",
    note: "누적 (2025.6)",
  },
  {
    value: "22.9",
    unit: "%",
    label: "활동률 · 698,521명",
    note: "6년째 내려가는 중 (24.8% → 22.9%)",
    tone: "warn" as const,
  },
  {
    value: "116,784",
    unit: "명",
    label: "2028년 요양보호사 부족 전망",
    note: "이 공백은 결국 가족이 떠안습니다",
    tone: "danger" as const,
  },
  {
    value: "+0",
    unit: "시간",
    label: "2024년 개정에서 늘지 않은 현장실습",
    note: "이론 +46시간 · 실기 +34시간 · 현장실습 +0시간",
    tone: "warn" as const,
  },
  {
    value: "8",
    unit: "시간",
    label: "2년마다 보장되는 보수교육 전부",
    note: "그중 온라인 수강 가능 시간은 최대 4시간",
    tone: "warn" as const,
  },
  {
    value: "30 / 30",
    label: "규칙 엔진 경계 케이스 전수 통과",
    note: "판정 지연 p95 0.11ms · 실행 로그 보유 (2026.7.27)",
  },
];

const FOOTER_LINKS = [
  { href: "/train", label: "훈련 모드" },
  { href: "/emergency", label: "응급 음성 가이드" },
  { href: "/report", label: "기록 코칭" },
  { href: "/history", label: "성장 기록" },
  { href: "/safety", label: "안전·개인정보 설계" },
];

/* ── 페이지 ────────────────────────────────────────────────── */

export default function Home() {
  return (
    <PageShell bleed>
      {/* 1. 히어로 — 타이포가 주인공, 오른쪽은 실제 훈련 화면의 한 턴 */}
      <section className="border-b border-line">
        <div className="chim-container chim-section">
          <div className="grid items-start gap-12 md:grid-cols-12 md:gap-10 lg:gap-14">
            <div className="md:col-span-7">
              <p className="flex items-center gap-2 text-base font-bold text-brand-700">
                <IconHeartHand className="h-5 w-5 shrink-0" />
                돌봄 현장 대응 훈련 시뮬레이터
              </p>

              <h1 className="mt-6 text-[2rem] leading-[1.12] font-extrabold tracking-[-0.03em] text-ink md:text-[2.67rem]">
                돌봄받는 사람이 아니라,
                <br />
                <span className="text-brand-700">돌보는 사람</span>을 훈련시킵니다
              </h1>

              <p className="chim-lead mt-6 max-w-2xl text-ink-soft">
                치매·응급·갈등 상황을 AI와 반복 연습하고, 공식 대응 지침을 기준으로 즉시 피드백을
                받습니다. AI는 상대역만 맡고, 옳고 그름의 판정은 법령과 공단 지침이 합니다.
              </p>

              {/* 고정 문구 (안전 규칙 §3-3) — 카드·그림자 대신 틸 규칙선 하나로 세웁니다. */}
              <p className="mt-8 border-l-[3px] border-brand-600 pl-5 text-xl leading-snug font-extrabold text-ink md:text-2xl">
                정답을 맞히는 시험이 아니라, 말이 나오게 만드는 연습입니다.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <BigButton href="/train" size="lg">
                  90초 훈련 시작하기
                </BigButton>
                <BigButton href="/emergency" size="lg" variant="secondary">
                  응급 음성 가이드 보기
                </BigButton>
              </div>

              <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-base text-ink-muted">
                <li>설치 없이 브라우저에서 바로</li>
                <li aria-hidden="true">·</li>
                <li>마이크가 없어도 버튼만으로 완주</li>
                <li aria-hidden="true">·</li>
                <li>훈련에서 만나는 인물은 전원 가상 인물</li>
              </ul>
            </div>

            {/* 실제 화면 한 턴 — 그림 대신 제품 자체를 보여 줍니다. */}
            <div className="md:col-span-5">
              <Card padded={false} className="overflow-hidden">
                <div className="border-b border-line px-5 py-4">
                  <p className="text-base font-extrabold text-ink">
                    배회 시나리오 「집에 가야 해」
                  </p>
                  <p className="chim-caption mt-1 text-ink-muted">약 90초</p>
                </div>

                <div className="space-y-4 px-5 py-5">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-bold text-ink">박 어르신</span>
                      <AiBadge compact />
                    </div>
                    <Bubble side="ai" className="mt-2">
                      <p className="text-base leading-relaxed font-semibold text-ink">
                        「집에 가야 해. 애가 기다려.」
                      </p>
                      <p className="chim-caption mt-1 text-ink-muted italic">
                        (현관 앞에서 신발을 반쯤 신은 채)
                      </p>
                    </Bubble>
                  </div>

                  <div className="flex flex-col items-end">
                    <span className="chim-caption font-bold text-ink-soft">학습자 재시도</span>
                    <Bubble side="learner" className="mt-1.5">
                      <p className="text-base leading-relaxed text-ink">
                        「따님이 많이 보고 싶으시죠. 얘기 좀 들려주세요. 저랑 걸으면서요.」
                      </p>
                    </Bubble>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-line pt-4">
                    <StatusMark kind="met" label={STATUS_MARK_LABEL.met} size="sm" />
                    <span className="chim-caption font-semibold text-ink-muted">감정 인정형</span>
                  </div>

                  <Gauge value={2} max={5} label="초조도" crisisAt={5} />
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* 2. 3기능 — 카드 3열 대신 비대칭 에디토리얼 리스트 */}
      <section className="border-b border-line bg-white">
        <div className="chim-container chim-section">
          <SectionHead
            eyebrow="사용자 흐름"
            title="배우고 → 일하고 → 성장하고"
            lead="사전 훈련부터 현장 대응, 사후 기록까지 하나의 순환으로 이어집니다."
          />

          <ul className="chim-hairline mt-10 border-t border-line md:mt-12">
            {FEATURES.map((f) => {
              const { Icon } = f;
              return (
                <li key={f.href} className="grid gap-5 py-8 md:grid-cols-12 md:gap-10 md:py-10">
                  <div className="md:col-span-4">
                    <p className="chim-meta flex items-center gap-2 font-bold text-brand-700">
                      <Icon className="h-5 w-5 shrink-0" />
                      {f.step} {f.kicker}
                    </p>
                    <h3 className="chim-h2 mt-3 text-ink">{f.title}</h3>
                  </div>

                  <div className="md:col-span-8">
                    <p className="chim-lead text-ink-soft">{f.lead}</p>

                    <ul className="mt-5 space-y-2.5">
                      {f.bullets.map((b, i) => (
                        <li key={i} className="flex gap-3 text-base leading-relaxed text-ink">
                          <span
                            aria-hidden="true"
                            className="mt-[0.65rem] h-1.5 w-1.5 shrink-0 rounded-chip bg-brand-400"
                          />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-6 flex flex-wrap items-center gap-x-7 gap-y-1">
                      <Link
                        href={f.href}
                        className="inline-flex min-h-[48px] items-center gap-2 text-base font-extrabold text-brand-700 underline underline-offset-4 hover:text-brand-800"
                      >
                        {f.cta}
                        <IconArrowRight className="h-5 w-5 shrink-0" />
                      </Link>
                      {f.extra && (
                        <Link
                          href={f.extra.href}
                          className="inline-flex min-h-[48px] items-center text-base font-semibold text-ink-soft underline underline-offset-4 hover:text-brand-800"
                        >
                          {f.extra.label}
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* 3. 90초 훈련 미리보기 */}
      <section className="border-b border-line">
        <div className="chim-container chim-section">
          <SectionHead
            eyebrow="90초 훈련의 실제"
            title="배회 시나리오 「집에 가야 해」"
            lead="같은 상황이 내 말에 따라 갈립니다. 대본 재생이 아니라 초조도 상태에 따른 분기입니다."
          />

          <Card className="mt-10 md:mt-12" padded={false}>
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

            <div className="space-y-6 p-5 md:p-6">
              {/* AI 대사 */}
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-bold text-ink">박 어르신</span>
                  <AiBadge />
                </div>
                <Bubble side="ai" className="mt-2 max-w-xl">
                  <p className="text-lg leading-relaxed font-semibold text-ink">
                    「집에 가야 해. 애가 기다려.」
                  </p>
                  <p className="mt-1.5 text-base text-ink-muted italic">
                    (현관 앞에서 신발을 반쯤 신은 채)
                  </p>
                </Bubble>
              </div>

              {/* 첫 시도 */}
              <div className="flex flex-col items-end">
                <span className="mb-2 text-base font-bold text-ink-soft">학습자 첫 시도</span>
                <Bubble side="learner" className="max-w-xl">
                  <p className="text-lg leading-relaxed text-ink">
                    「어르신, 여기가 어르신 집이에요. 따님은 지난주에 다녀가셨잖아요.」
                  </p>
                </Bubble>
              </div>

              <Verdict
                ok={false}
                label="사실 확인형"
                message="사실부터 반박하면 초조도가 올라갑니다. 부정하기 전에 그리운 마음을 먼저 말로 인정해 주세요."
                docId="DOC-GUIDE-001"
              />

              {/* 재시도 */}
              <div className="flex flex-col items-end">
                <span className="mb-2 text-base font-bold text-ink-soft">학습자 재시도</span>
                <Bubble side="learner" className="max-w-xl">
                  <p className="text-lg leading-relaxed text-ink">
                    「따님이 많이 보고 싶으시죠. 얘기 좀 들려주세요. 저랑 걸으면서요.」
                  </p>
                </Bubble>
              </div>

              <Verdict
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
                화면에는 점수도 등급도 표시하지 않습니다.{" "}
                <StatusMark kind="met" label={STATUS_MARK_LABEL.met} size="sm" />과{" "}
                <StatusMark kind="coach" label={STATUS_MARK_LABEL.coach} size="sm" /> 두 가지,
                그리고 코칭 한 문장과 근거 출처만 보여 줍니다. 대사는 현직 감수본 기준이며
                등장인물은 전원 가상 인물입니다.
              </p>

              <BigButton href="/train" size="lg">
                직접 해 보기
              </BigButton>
            </div>
          </Card>
        </div>
      </section>

      {/* 4. 안전 설계 3계층 — 카드 3열 대신 hairline 표 */}
      <section className="border-b border-line bg-white">
        <div className="chim-container chim-section">
          <SectionHead
            eyebrow="안전 설계"
            title="위험할수록 AI의 지분을 줄입니다"
            lead="잘 답하는 AI보다 안전하게 멈추는 AI가 필요합니다. 구간마다 AI가 할 수 있는 일의 범위를 다르게 잠갔습니다."
          />

          <div className="chim-hairline mt-10 border-t border-line md:mt-12">
            {TIERS.map((t) => (
              <div key={t.tier} className="grid gap-4 py-7 md:grid-cols-12 md:gap-8 md:py-8">
                <div className="md:col-span-3">
                  <p className="flex items-baseline gap-2.5">
                    <span
                      className={cx(
                        "chim-num text-2xl font-extrabold tracking-[-0.02em]",
                        t.tone === "brand"
                          ? "text-brand-700"
                          : t.tone === "warn"
                            ? "text-warn-ink"
                            : "text-danger-ink",
                      )}
                    >
                      {t.tier}
                    </span>
                    <span className="text-lg font-extrabold text-ink">{t.name}</span>
                  </p>
                  <p
                    className={cx(
                      "chim-caption mt-2 font-bold",
                      t.tone === "brand"
                        ? "text-brand-700"
                        : t.tone === "warn"
                          ? "text-warn-ink"
                          : "text-danger-ink",
                    )}
                  >
                    {t.badge}
                  </p>
                </div>

                <div className="md:col-span-6">
                  <p className="text-base leading-relaxed text-ink">{t.what}</p>
                  <p className="mt-1.5 text-base leading-relaxed text-ink-soft">{t.guard}</p>
                </div>

                <div className="md:col-span-3">
                  <AiShare filled={t.share} tone={t.tone} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 border-t border-line pt-8">
            <p className="max-w-3xl text-base leading-relaxed text-ink">
              치명적 실패 3항목(업무 범위를 벗어난 행위 · 신체 제한 · 119 지연)은 확률 모델이
              아니라 규칙 엔진이 단독으로 판정합니다. 근거를 찾지 못하면 이렇게 답합니다 —
              <span className="font-bold text-ink">
                {" "}
                「공식 지침에서 근거를 찾지 못했습니다. 담당 간호사 또는 기관에 확인해 주세요.」
              </span>
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <SourceChip docId="DOC-NOTI-002" />
              <BigButton href="/safety" variant="secondary">
                안전·개인정보 설계 자세히 보기
              </BigButton>
            </div>
          </div>
        </div>
      </section>

      {/* 5. 숫자 — 카드 그리드 대신 hairline 밴드 + 미니 차트 */}
      <section className="border-b border-line">
        <div className="chim-container chim-section">
          <SectionHead
            eyebrow="왜 지금인가"
            title="자격증은 304만 개, 현장에 선 사람은 10명 중 2명입니다"
            lead="사람이 부족한 것이 아니라, 현장에 남을 수 있는 조건이 부족합니다."
          />

          <div className="mt-10 grid border-t border-line sm:grid-cols-2 md:mt-12 lg:grid-cols-3">
            {STATS.map((s) => (
              <StatCell
                key={s.label}
                value={s.value}
                unit={s.unit}
                label={s.label}
                note={s.note}
                tone={s.tone}
              />
            ))}
          </div>

          <div className="mt-12 grid gap-10 md:grid-cols-2 md:gap-14">
            <figure className="m-0">
              <figcaption>
                <h3 className="chim-h2 text-ink">자격 취득 대비 활동 비율</h3>
              </figcaption>
              <ShareBarChart
                className="mt-5"
                percent={22.9}
                fillLabel="22.9% · 698,521명"
                markPercent={24.8}
                markLabel="점선 24.8%"
                baseNote="가로축 0~100% · 100%는 자격 취득 3,044,230명(누적 2025.6) · 점선은 내려오기 전 값입니다."
              />
            </figure>

            <figure className="m-0">
              <figcaption>
                <h3 className="chim-h2 text-ink">활동 인원과 2028년 부족 전망</h3>
              </figcaption>
              <ScaleBarChart
                className="mt-5"
                axisMax={800000}
                ticks={[0, 400000, 800000]}
                unit="명"
                bars={[
                  { label: "활동 요양보호사", value: 698521, tone: "brand" },
                  { label: "2028년 부족 전망", value: 116784, tone: "warn" },
                ]}
                baseNote="가로축 0~800,000명 · 두 막대는 같은 축을 씁니다."
              />
            </figure>
          </div>

          <p className="chim-caption mt-10 leading-relaxed text-ink-muted">
            출처 · 보건복지부 제출자료(2025.6, 국회 보건복지위원회) · 국민건강보험공단
            건강보험연구원 부족 전망 · 2024년 요양보호사 양성지침(보건복지부) ·
            「노인장기요양보험법」 제23조제2항 및 같은 법 시행령 제11조의2 · 요양보호사 보수교육
            운영지침(국민건강보험공단) · 침착 규칙 엔진 실행 로그(2026.7.27).
          </p>

          <div className="mt-12 border-t-[3px] border-brand-600 pt-8">
            <p className="max-w-3xl text-xl leading-snug font-extrabold text-ink md:text-2xl">
              침착이 만드는 것은 앱이 아니라, 사람이 현장에 남을 수 있는 조건입니다.
            </p>
            <p className="chim-lead mt-4 max-w-2xl text-ink-soft">
              요양보호사 개인은 무료로 씁니다. 가족 돌봄자에게도 무료로 열립니다.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <BigButton href="/train" size="lg">
                훈련 시작하기
              </BigButton>
              <BigButton href="/safety" variant="secondary" size="lg">
                안전 설계 보기
              </BigButton>
            </div>
          </div>
        </div>
      </section>

      {/* 6. 푸터 */}
      <footer className="bg-white">
        <div className="chim-container py-12 md:py-16">
          <div className="grid gap-10 md:grid-cols-12 md:gap-10">
            <div className="md:col-span-5">
              <p className="flex items-baseline gap-2">
                <span className="chim-title text-xl font-extrabold text-brand-800">침착</span>
                <span className="chim-caption font-semibold text-ink-muted">ChimChak</span>
              </p>
              <p className="mt-3 max-w-sm text-base leading-relaxed text-ink-soft">
                돌봄받는 사람이 아니라 돌보는 사람을 훈련시키는 AI 시뮬레이터입니다.
              </p>
            </div>

            <nav aria-label="바로가기" className="md:col-span-3">
              <p className="text-base font-bold text-ink">바로가기</p>
              <ul className="mt-2">
                {FOOTER_LINKS.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="inline-flex min-h-[48px] items-center text-base font-semibold text-brand-700 underline underline-offset-4 hover:text-brand-800"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="md:col-span-4">
              <p className="text-base font-bold text-ink">고지</p>
              <p className="mt-3 text-base leading-relaxed text-ink-soft">
                본 서비스는 훈련·교육 목적이며 119 신고 및 의료인의 진단·처방을 대체하지 않습니다.
                훈련에 등장하는 인물은 전원 가상 인물이며 실존 인물·기관과 무관합니다.
              </p>
            </div>
          </div>

          <p className="chim-caption mt-10 border-t border-line pt-5 leading-relaxed text-ink-muted">
            침착(ChimChak) · 2026년 제8회 K-디지털 트레이닝 해커톤 출품작 · 데모 환경에서는 모든
            판정이 이 기기 안에서 이루어집니다.
          </p>
        </div>
      </footer>
    </PageShell>
  );
}
