import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import {
  AiBadge,
  BigButton,
  Card,
  FeedbackCard,
  Gauge,
  PageShell,
  SourceChip,
  cx,
} from "@/components";
import { FirstVisitHint } from "./_components/FirstVisitHint";
import {
  IconArrowRight,
  IconChat,
  IconChevronDown,
  IconHeartHand,
  IconNote,
  IconSiren,
  StatusMark,
  STATUS_MARK_LABEL,
  type IconProps,
} from "@/components/icons";
import { ScaleBarChart, ShareBarChart } from "@/components/illustrations";

/* ── 랜딩 전용 소형 조각들 ─────────────────────────────────────
   v3 §1-2에 따라 이 파일에는 왼쪽 액센트 바·색 규칙선이 하나도 없습니다.
   구분은 (1) 지면/카드의 면 차이, (2) 여백, (3) 타이포 크기 차이로만 합니다.
   크기 체계(§3): 히어로 44→56 · 섹션 제목 32→40 · 소제목 20 · 리드 17 ·
   본문 16 · 보조 15 · 메타 14 · 캡션 13. 대사·CTA 같은 코어 콘텐츠만 18px 이상.
   ─────────────────────────────────────────────────────────── */

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
      <h2 className="chim-h1 mt-2.5 text-ink">{title}</h2>
      {lead && (
        <p className="mt-4 max-w-2xl text-[1.0625rem] leading-[1.7] text-ink-soft">{lead}</p>
      )}
    </div>
  );
}

/**
 * 어르신·학습자 말풍선 — 꼬리는 모서리 하나만 줄여 표현합니다.
 * v3 §5: 보더를 쓰지 않고 면으로만 구분합니다 — 인물 흰 면, 학습자 옅은 틸 면.
 */
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
        "rounded-card px-4 py-3.5 md:px-5 md:py-4",
        side === "ai" ? "rounded-tl-sm bg-white" : "rounded-tr-sm bg-brand-50",
        className,
      )}
    >
      {children}
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

/** 에디토리얼 숫자 밴드의 한 칸 — 카드가 아니라 hairline으로 나눕니다(§7). */
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
    <div className="border-b border-line py-6 pr-6 md:py-7">
      {/* 숫자만 큼(44→48px). 라벨 14 · 각주 13으로 내려 숫자 하나만 주인공으로 둡니다. */}
      <p className={cx("chim-stat text-[2.75rem] md:text-[3rem]", color)}>
        {value}
        {unit && <span className="ml-1 text-[1.25rem] font-bold">{unit}</span>}
      </p>
      <p className="chim-meta mt-2.5 font-extrabold text-ink">{label}</p>
      {note && <p className="chim-caption mt-1 leading-relaxed text-ink-muted">{note}</p>}
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
      {/* 1. 히어로 — 타이포가 주인공, 오른쪽은 실제 훈련 화면의 한 턴.
          섹션 구분선은 두지 않습니다: 지면(#fafbfb)과 흰 면의 교차 + 96px 여백으로만 나눕니다(§7). */}
      <section>
        <div className="chim-container chim-section">
          <div className="grid items-start gap-12 md:grid-cols-12 md:gap-10 lg:gap-14">
            <div className="md:col-span-7">
              <p className="chim-meta flex items-center gap-2 font-bold tracking-[0.02em] text-brand-700">
                <IconHeartHand className="h-[18px] w-[18px] shrink-0" />
                돌봄 현장 대응 훈련 시뮬레이터
              </p>

              {/* 이 페이지에서 유일한 초대형 타이포입니다(§1-7). */}
              <h1 className="chim-display mt-5 text-ink">
                돌봄받는 사람이 아니라,
                <br />
                <span className="text-brand-700">돌보는 사람</span>을 훈련시킵니다
              </h1>

              <p className="mt-6 max-w-[34rem] text-[1.0625rem] leading-[1.7] text-ink-soft md:text-[1.125rem]">
                치매·응급·갈등 상황을 AI와 반복 연습하고, 공식 대응 지침을 기준으로 즉시 피드백을
                받습니다. AI는 상대역만 맡고, 옳고 그름의 판정은 법령과 공단 지침이 합니다.
              </p>

              {/* 고정 문구 (안전 규칙 §3-3) — 틸 규칙선을 걷어내고 조용한 면 하나로 세웁니다(§1-2). */}
              <p className="mt-8 max-w-[34rem] rounded-card bg-paper-2 px-5 py-5 text-xl leading-snug font-extrabold text-ink md:px-6 md:py-6 md:text-2xl">
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

              <FirstVisitHint />

              <ul className="chim-meta mt-7 flex flex-wrap gap-x-4 gap-y-1.5 text-ink-muted">
                <li>설치 없이 브라우저에서 바로</li>
                <li aria-hidden="true">·</li>
                <li>마이크가 없어도 버튼만으로 완주</li>
                <li aria-hidden="true">·</li>
                <li>훈련에서 만나는 인물은 전원 가상 인물</li>
              </ul>
            </div>

            {/* 실제 화면 한 턴 — 그림 대신 제품 자체를 보여 줍니다.
                옅은 면 카드라 안쪽의 흰 말풍선이 보더 없이도 그대로 떠오릅니다(§5·§7). */}
            <div className="md:col-span-5">
              <Card tone="quiet" padded={false} className="overflow-hidden">
                <div className="px-5 pt-5">
                  <p className="chim-body font-extrabold text-ink">
                    배회 시나리오 「집에 가야 해」
                  </p>
                  <p className="chim-caption mt-1 text-ink-muted">약 90초</p>
                </div>

                <div className="space-y-4 px-5 pt-4 pb-5">
                  <div>
                    <div className="chim-meta flex flex-wrap items-center gap-2">
                      <span className="font-bold text-ink">박 어르신</span>
                      <AiBadge compact />
                    </div>
                    <Bubble side="ai" className="mt-1.5">
                      {/* 대사는 코어 콘텐츠 — 어떤 축소에서도 18px 아래로 내리지 않습니다(§3). */}
                      <p className="chim-core font-semibold text-ink">
                        「집에 가야 해. 애가 기다려.」
                      </p>
                      <p className="chim-meta mt-1 text-ink-muted italic">
                        (현관 앞에서 신발을 반쯤 신은 채)
                      </p>
                    </Bubble>
                  </div>

                  <div className="flex flex-col items-end">
                    <span className="chim-meta font-bold text-ink-soft">학습자 재시도</span>
                    <Bubble side="learner" className="mt-1.5">
                      <p className="chim-core text-ink">
                        「따님이 많이 보고 싶으시죠. 얘기 좀 들려주세요. 저랑 걸으면서요.」
                      </p>
                    </Bubble>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1">
                    <StatusMark kind="met" label={STATUS_MARK_LABEL.met} size="sm" />
                    <span className="chim-meta font-semibold text-ink-muted">감정 인정형</span>
                  </div>

                  <Gauge value={2} max={5} label="초조도" crisisAt={5} />
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* 2. 3기능 — 카드 3열 대신 비대칭 에디토리얼 리스트 */}
      <section className="bg-white">
        <div className="chim-container chim-section">
          <SectionHead
            eyebrow="사용자 흐름"
            title="배우고 → 일하고 → 성장하고"
            lead="사전 훈련부터 현장 대응, 사후 기록까지 하나의 순환으로 이어집니다."
          />

          <ul className="chim-hairline mt-9 border-t border-line md:mt-12">
            {FEATURES.map((f) => {
              const { Icon } = f;
              return (
                <li key={f.href} className="grid gap-4 py-8 md:grid-cols-12 md:gap-10 md:py-10">
                  <div className="md:col-span-4">
                    <p className="chim-meta flex items-center gap-2 font-bold text-brand-700">
                      <Icon className="h-[18px] w-[18px] shrink-0" />
                      {f.step} {f.kicker}
                    </p>
                    {/* 소제목 20px — 섹션 제목(32~40)과 본문(16) 사이의 한 단 */}
                    <h3 className="chim-h3 mt-2 text-ink">{f.title}</h3>
                  </div>

                  <div className="md:col-span-8">
                    <p className="chim-body text-ink-soft">{f.lead}</p>

                    <ul className="mt-4 space-y-2">
                      {f.bullets.map((b, i) => (
                        <li
                          key={i}
                          className="flex gap-2.5 text-[0.9375rem] leading-relaxed text-ink-soft"
                        >
                          {/* 불릿은 목록 표식일 뿐이라 브랜드 색을 쓰지 않습니다(§1-2). */}
                          <span
                            aria-hidden="true"
                            className="mt-[0.6rem] h-1 w-1 shrink-0 rounded-chip bg-ink-muted"
                          />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-1">
                      {/* CTA 라벨은 코어 콘텐츠 — 17px 아래로 내리지 않습니다(§3). */}
                      <Link
                        href={f.href}
                        className="chim-core-sm inline-flex min-h-[48px] items-center gap-1.5 font-bold text-brand-700 underline underline-offset-4 hover:text-brand-800"
                      >
                        {f.cta}
                        <IconArrowRight className="h-5 w-5 shrink-0" />
                      </Link>
                      {f.extra && (
                        <Link
                          href={f.extra.href}
                          className="inline-flex min-h-[48px] items-center text-[0.9375rem] font-semibold text-ink-soft underline underline-offset-4 hover:text-brand-800"
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

      {/* 3. 90초 훈련 미리보기 — 카드로 감싸지 않고 지면 위에 그대로 놓습니다.
          면 4종(흰 말풍선 / 옅은 틸 말풍선 / 코칭 면 / 충족 면)만으로 화자와 판정이 갈립니다. */}
      <section>
        <div className="chim-container chim-section">
          <SectionHead
            eyebrow="90초 훈련의 실제"
            title="배회 시나리오 「집에 가야 해」"
            lead="같은 상황이 내 말에 따라 갈립니다. 대본 재생이 아니라 초조도 상태에 따른 분기입니다."
          />

          {/* 필을 늘리지 않으려고 시나리오 메타는 14px 한 줄로만 둡니다(§1-5). */}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-x-8 gap-y-4 md:mt-10">
            <p className="chim-meta font-semibold text-ink-muted">
              치매 행동심리증상 · 초급 · 약 90초
            </p>
            <div className="w-full max-w-[15rem]">
              <Gauge value={3} max={5} label="초조도" crisisAt={5} />
            </div>
          </div>

          <div className="mt-8 max-w-2xl space-y-5">
            {/* AI 대사 */}
            <div>
              <div className="chim-meta flex flex-wrap items-center gap-2">
                <span className="font-bold text-ink">박 어르신</span>
                <AiBadge />
              </div>
              <Bubble side="ai" className="mt-1.5">
                <p className="chim-core font-semibold text-ink">
                  「집에 가야 해. 애가 기다려.」
                </p>
                <p className="chim-meta mt-1.5 text-ink-muted italic">
                  (현관 앞에서 신발을 반쯤 신은 채)
                </p>
              </Bubble>
            </div>

            {/* 첫 시도 */}
            <div className="flex flex-col items-end">
              <span className="chim-meta font-bold text-ink-soft">학습자 첫 시도</span>
              <Bubble side="learner" className="mt-1.5">
                <p className="chim-core text-ink">
                  「어르신, 여기가 어르신 집이에요. 따님은 지난주에 다녀가셨잖아요.」
                </p>
              </Bubble>
            </div>

            {/* 판정은 세션 화면과 같은 컴포넌트를 그대로 씁니다 — 왼쪽 액센트 바 없음(§5). */}
            <FeedbackCard
              ok={false}
              label="사실 확인형"
              message="사실부터 반박하면 초조도가 올라갑니다. 부정하기 전에 그리운 마음을 먼저 말로 인정해 주세요."
              docId="DOC-GUIDE-001"
            />

            {/* 재시도 */}
            <div className="flex flex-col items-end">
              <span className="chim-meta font-bold text-ink-soft">학습자 재시도</span>
              <Bubble side="learner" className="mt-1.5">
                <p className="chim-core text-ink">
                  「따님이 많이 보고 싶으시죠. 얘기 좀 들려주세요. 저랑 걸으면서요.」
                </p>
              </Bubble>
            </div>

            <FeedbackCard
              ok
              label="감정 인정형"
              message="감정을 먼저 인정하셨습니다. 다음은 배회의 계기(배고픔·통증·화장실·불안)를 확인하는 질문입니다."
              docId="DOC-GUIDE-001"
            />

            {/* 색 면을 한 뷰포트에 2개 이하로 유지하려고, 경고는 면 대신 글자색으로만 둡니다(§1-3). */}
            <div className="pt-3">
              <p className="chim-core-sm font-bold text-warn-ink">
                재시도도 반박이면 초조도가 한 칸 더 올라가고 「배회 발생」 상태로 넘어갑니다. 목표가
                설득에서 안전 확보로 바뀝니다.
              </p>
              <div className="mt-4 max-w-[15rem]">
                <Gauge value={5} max={5} label="초조도" crisisAt={5} />
              </div>
            </div>

            <p className="pt-2 text-[0.9375rem] leading-relaxed text-ink-muted">
              화면에는 점수도 등급도 표시하지 않습니다.{" "}
              <StatusMark kind="met" label={STATUS_MARK_LABEL.met} size="sm" />과{" "}
              <StatusMark kind="coach" label={STATUS_MARK_LABEL.coach} size="sm" /> 두 가지, 그리고
              코칭 한 문장과 근거 출처만 보여 줍니다. 대사는 현직 감수본 기준이며 등장인물은 전원
              가상 인물입니다.
            </p>

            <div className="pt-2">
              <BigButton href="/train" size="lg">
                직접 해 보기
              </BigButton>
            </div>
          </div>
        </div>
      </section>

      {/* 4. 안전 설계 3계층 — 카드 3열 대신 hairline 표(§7이 허용한 행 구분) */}
      <section className="bg-white">
        <div className="chim-container chim-section">
          <SectionHead
            eyebrow="안전 설계"
            title="위험할수록 AI의 지분을 줄입니다"
            lead="잘 답하는 AI보다 안전하게 멈추는 AI가 필요합니다. 구간마다 AI가 할 수 있는 일의 범위를 다르게 잠갔습니다."
          />

          <div className="chim-hairline mt-9 border-t border-line md:mt-12">
            {TIERS.map((t) => {
              const toneText =
                t.tone === "brand"
                  ? "text-brand-700"
                  : t.tone === "warn"
                    ? "text-warn-ink"
                    : "text-danger-ink";
              return (
                <div key={t.tier} className="grid gap-3 py-7 md:grid-cols-12 md:gap-8 md:py-8">
                  <div className="md:col-span-3">
                    <p className="flex items-baseline gap-2">
                      <span
                        className={cx(
                          "chim-num text-[1.375rem] font-extrabold tracking-[-0.02em]",
                          toneText,
                        )}
                      >
                        {t.tier}
                      </span>
                      <span className="chim-core-sm font-extrabold text-ink">{t.name}</span>
                    </p>
                    <p className={cx("chim-caption mt-1.5 font-bold", toneText)}>{t.badge}</p>
                  </div>

                  <div className="md:col-span-6">
                    <p className="chim-body text-ink">{t.what}</p>
                    <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-soft">{t.guard}</p>
                  </div>

                  <div className="md:col-span-3">
                    <AiShare filled={t.share} tone={t.tone} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 max-w-3xl">
            <p className="chim-body text-ink">
              치명적 실패 3항목(업무 범위를 벗어난 행위 · 신체 제한 · 119 지연)은 확률 모델이 아니라
              규칙 엔진이 단독으로 판정합니다. 근거를 찾지 못하면 이렇게 답합니다 —
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
      <section>
        <div className="chim-container chim-section">
          <SectionHead
            eyebrow="왜 지금인가"
            title="자격증은 304만 개, 현장에 선 사람은 10명 중 2명입니다"
            lead="사람이 부족한 것이 아니라, 현장에 남을 수 있는 조건이 부족합니다."
          />

          <div className="mt-9 grid border-t border-line sm:grid-cols-2 md:mt-12 lg:grid-cols-3">
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
                {/* 차트 안 숫자가 주인공이라 제목은 17px로 물러섭니다. */}
                <h3 className="text-[1.0625rem] font-extrabold text-ink">
                  자격 취득 대비 활동 비율
                </h3>
              </figcaption>
              <ShareBarChart
                className="mt-4"
                percent={22.9}
                fillLabel="22.9% · 698,521명"
                markPercent={24.8}
                markLabel="점선 24.8%"
                baseNote="가로축 0~100% · 100%는 자격 취득 3,044,230명(누적 2025.6) · 점선은 내려오기 전 값입니다."
              />
            </figure>

            <figure className="m-0">
              <figcaption>
                <h3 className="text-[1.0625rem] font-extrabold text-ink">
                  활동 인원과 2028년 부족 전망
                </h3>
              </figcaption>
              <ScaleBarChart
                className="mt-4"
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

          {/* 긴 출처 문단은 기본 접힘(§6) — 문구는 한 글자도 바꾸지 않고 자리만 옮겼습니다. */}
          <details className="group mt-10">
            <summary className="chim-caption inline-flex min-h-[48px] cursor-pointer list-none items-center gap-1.5 font-bold text-ink-muted [&::-webkit-details-marker]:hidden">
              <IconChevronDown className="h-4 w-4 shrink-0 transition-transform duration-150 group-open:rotate-180" />
              출처
            </summary>
            <p className="chim-caption max-w-3xl leading-relaxed text-ink-muted">
              보건복지부 제출자료(2025.6, 국회 보건복지위원회) · 국민건강보험공단 건강보험연구원
              부족 전망 · 2024년 요양보호사 양성지침(보건복지부) · 「노인장기요양보험법」
              제23조제2항 및 같은 법 시행령 제11조의2 · 요양보호사 보수교육
              운영지침(국민건강보험공단) · 침착 규칙 엔진 실행 로그(2026.7.27).
            </p>
          </details>

          {/* 마무리 — 틸 3px 규칙선을 걷어내고 hairline 하나와 여백으로만 단락을 나눕니다. */}
          <div className="mt-12 border-t border-line pt-10 md:mt-14">
            <p className="chim-h2 max-w-3xl font-extrabold text-ink">
              침착이 만드는 것은 앱이 아니라, 사람이 현장에 남을 수 있는 조건입니다.
            </p>
            <p className="mt-4 max-w-2xl text-[1.0625rem] leading-[1.7] text-ink-soft">
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
                <span className="chim-h3 text-brand-800">침착</span>
                <span className="chim-caption font-semibold text-ink-muted">ChimChak</span>
              </p>
              <p className="mt-3 max-w-sm text-[0.9375rem] leading-relaxed text-ink-soft">
                돌봄받는 사람이 아니라 돌보는 사람을 훈련시키는 AI 시뮬레이터입니다.
              </p>
            </div>

            <nav aria-label="바로가기" className="md:col-span-3">
              <p className="chim-label font-bold text-ink">바로가기</p>
              <ul className="mt-1">
                {FOOTER_LINKS.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="inline-flex min-h-[48px] items-center text-[0.9375rem] font-semibold text-brand-700 underline underline-offset-4 hover:text-brand-800"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="md:col-span-4">
              <p className="chim-label font-bold text-ink">고지</p>
              <p className="chim-meta mt-3 leading-relaxed text-ink-soft">
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
