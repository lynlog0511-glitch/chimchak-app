import type { Metadata } from "next";
import Link from "next/link";
import { Badge, BigButton, Card, IconArrowRight, PageShell, cx } from "@/components";
import { PROTOCOLS } from "@/data/protocols";
import { OfflineStatus } from "./_components/OfflineStatus";
import { getProtocolIcon } from "./_components/ProtocolIcons";
import { StickyCallBar } from "./_components/StickyCallBar";

export const metadata: Metadata = {
  title: "응급 음성 가이드",
  description:
    "사전 검수된 응급 프로토콜 5종. 생성 호출 없이 고정 문구만 재생하며, 네트워크가 끊겨도 열립니다.",
};

/** 검수 상태 문구에서 앞머리 표기만 뽑습니다. 예: "감수 완료 · 고정 문구…" → "감수 완료" */
function reviewedLabel(reviewed: string): string {
  const head = reviewed.split("·")[0];
  return head ? head.trim() : reviewed;
}

function isReviewComplete(reviewed: string): boolean {
  return reviewed.startsWith("감수 완료");
}

/** 목록 카드에서 상황 설명이 너무 길면 첫 문장까지만 보여 줍니다. */
function firstSentence(text: string): string {
  const idx = text.indexOf(". ");
  if (idx === -1) return text;
  return `${text.slice(0, idx + 1)}`;
}

export default function EmergencyPage() {
  return (
    <PageShell>
      <StickyCallBar />

      <header className="mb-7">
        <p className="mb-2 text-sm font-bold tracking-wide text-danger-ink uppercase">
          응급 음성 가이드
        </p>
        <h1 className="text-2xl font-extrabold text-ink md:text-4xl">
          손이 바쁠 때, 화면 대신 목소리가 안내합니다
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-ink-soft md:text-lg">
          이 구간에서는 AI가 문장을 만들지 않습니다. 사전에 검수된 고정 문구를 순서대로 읽어
          주고, 판단과 지도는 119 상황실로 넘깁니다. 몸에 손이 닿는 술기는 어떤 경우에도
          화면으로 지도하지 않습니다.
        </p>
      </header>

      {/* 오프라인 안내 — 배지는 하나뿐입니다.
          기기 저장 여부를 실측해 OfflineStatus 가 초록(저장 완료) 또는 주황(아직 준비 전) 중
          하나만 표시합니다. 확인 전에 "서버가 죽어도 열립니다"라고 미리 단정하지 않습니다. */}
      <div className="mb-6">
        <OfflineStatus />
      </div>

      {/* 프로토콜 5종 */}
      <section aria-labelledby="protocol-list-heading">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="protocol-list-heading" className="text-xl font-extrabold text-ink md:text-2xl">
            응급 프로토콜 5종
          </h2>
          <p className="text-sm font-semibold text-ink-muted">
            카드의 배지는 검수 상태입니다 · 안내 문구는 변형되지 않습니다
          </p>
        </div>

        <ul className="grid gap-4 md:grid-cols-2">
          {PROTOCOLS.map((protocol) => {
            const href = `/emergency/${protocol.id.toLowerCase()}`;
            const complete = isReviewComplete(protocol.reviewed);
            const ProtocolIcon = getProtocolIcon(protocol.id);
            return (
              <li key={protocol.id}>
                <Link
                  href={href}
                  className="block h-full rounded-card focus-visible:outline-3"
                  aria-label={`${protocol.title} 안내 열기`}
                >
                  {/* 검수 상태는 채운 배지 대신 hairline 색 코드(왼쪽 선 + 테두리형 배지)로만
                      구분합니다 — 감수 완료는 ok, 초안은 warn. */}
                  <Card
                    hoverable
                    className={cx(
                      "flex h-full flex-col border-l-4",
                      complete ? "border-l-ok-line" : "border-l-warn-line",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-field border border-line bg-paper-2 text-ink">
                        <ProtocolIcon className="h-6 w-6" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold tracking-wide text-ink-muted">
                          {protocol.id} · {protocol.steps.length}단계
                        </p>
                        <h3 className="mt-1 text-2xl font-extrabold tracking-[-0.02em] text-ink">
                          {protocol.title}
                        </h3>
                      </div>
                    </div>

                    <p className="mt-3 flex-1 text-base leading-relaxed text-ink-soft">
                      {firstSentence(protocol.situation)}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge tone={complete ? "ok" : "warn"} variant="outline">
                        {reviewedLabel(protocol.reviewed)}
                      </Badge>
                      <p className="text-sm leading-relaxed text-ink-muted">
                        검수 상태 · {protocol.reviewed}
                      </p>
                    </div>

                    <p className="mt-4 flex items-center gap-1 text-base font-extrabold text-brand-800">
                      음성 안내 열기 <IconArrowRight className="h-5 w-5" />
                    </p>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* 이 화면의 경계 */}
      <section aria-labelledby="boundary-heading" className="mt-10">
        <h2 id="boundary-heading" className="text-xl font-extrabold text-ink md:text-2xl">
          이 화면이 하는 일과 하지 않는 일
        </h2>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Card tone="brand" className="h-full">
            <p className="text-base font-extrabold text-brand-800">하는 일</p>
            <ul className="mt-3 space-y-2 text-base leading-relaxed text-ink">
              <li>· 「지금 119를 누르세요」를 가장 먼저 안내합니다.</li>
              <li>· 검수된 고정 문구를 음성과 큰 자막으로 순서대로 재생합니다.</li>
              <li>· 무엇을 보고 무엇을 119에 말씀드릴지 관찰 항목만 여쭙습니다.</li>
              <li>· 네트워크가 끊겨도 기기에 저장된 화면으로 그대로 동작합니다.</li>
            </ul>
          </Card>

          <Card tone="danger" className="h-full">
            <p className="text-base font-extrabold text-danger-ink">하지 않는 일</p>
            <ul className="mt-3 space-y-2 text-base leading-relaxed text-ink">
              <li>· 몸에 손이 닿는 술기의 동작을 지도하지 않습니다.</li>
              <li>· 상태나 중증도를 판정하는 문장을 만들지 않습니다.</li>
              <li>· 약을 드리라는 안내를 하지 않습니다.</li>
              <li>
                · 이 부분은 119 상황실이 목소리로 직접 지도합니다.
              </li>
            </ul>
          </Card>
        </div>
      </section>

      {/* 하단 이동 */}
      <Card tone="quiet" className="mt-10">
        <p className="text-base leading-relaxed text-ink">
          실제 상황이 아니라 연습이 필요하시다면, 응급 상황을 다루는 훈련 시나리오에서 같은
          프로토콜을 미리 겪어 보실 수 있습니다.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <BigButton href="/train" size="lg" variant="secondary">
            훈련 시나리오 보기
          </BigButton>
          <BigButton href="/safety" size="lg" variant="ghost">
            안전 설계 확인하기
          </BigButton>
        </div>
      </Card>
    </PageShell>
  );
}
