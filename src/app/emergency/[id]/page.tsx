import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, BigButton, Card, PageShell } from "@/components";
import { PROTOCOLS, getProtocol } from "@/data/protocols";
import { StickyCallBar } from "../_components/StickyCallBar";
import { ProtocolPlayer } from "./_components/ProtocolPlayer";

interface PageParams {
  params: Promise<{ id: string }>;
}

/** 프로토콜 5종을 정적 경로로 미리 만들어 둡니다(서비스워커 precache 목록과 동일). */
export function generateStaticParams(): Array<{ id: string }> {
  return PROTOCOLS.map((protocol) => ({ id: protocol.id.toLowerCase() }));
}

/** 목록에 없는 id는 404로 보냅니다 — 응급 화면에서는 만들어 낸 안내가 나오지 않아야 합니다. */
export const dynamicParams = false;

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { id } = await params;
  const protocol = getProtocol(id);
  if (!protocol) return { title: "응급 프로토콜" };
  return {
    title: `${protocol.title} — 응급 음성 가이드`,
    description: protocol.situation,
  };
}

export default async function ProtocolPage({ params }: PageParams) {
  const { id } = await params;
  const protocol = getProtocol(id);
  if (!protocol) notFound();

  const complete = protocol.reviewed.startsWith("감수 완료");

  return (
    <PageShell>
      <StickyCallBar />

      <nav aria-label="이동 경로" className="mb-4">
        <Link
          href="/emergency"
          className="inline-flex min-h-[48px] items-center gap-1 text-base font-bold text-brand-800"
        >
          <span aria-hidden="true">←</span> 응급 프로토콜 목록
        </Link>
      </nav>

      <header className="mb-7">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="danger">{protocol.id}</Badge>
          <Badge tone={complete ? "ok" : "warn"}>
            {complete ? "감수 완료" : "알파 초안"}
          </Badge>
          <Badge tone="neutral">{protocol.steps.length}단계</Badge>
        </div>
        <h1 className="mt-3 text-2xl font-extrabold text-ink md:text-4xl">{protocol.title}</h1>
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-ink-soft md:text-lg">
          {protocol.situation}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          검수 상태 · {protocol.reviewed}
        </p>
      </header>

      <ProtocolPlayer
        protocolId={protocol.id}
        title={protocol.title}
        steps={protocol.steps}
      />

      {/* 앱이 하지 않는 것 — 접이식 */}
      <details className="mt-8 rounded-card border-2 border-danger-line bg-white shadow-card">
        <summary className="flex min-h-[56px] cursor-pointer list-none items-center gap-3 px-5 py-4 text-lg font-extrabold text-danger-ink [&::-webkit-details-marker]:hidden">
          <span aria-hidden="true">🛡</span>
          <span className="flex-1">
            앱이 하지 않는 것 — 이 부분은 119 상황실이 목소리로 직접 지도합니다
          </span>
          <span aria-hidden="true" className="text-base font-bold text-ink-muted">
            펼치기 ▾
          </span>
        </summary>

        <div className="border-t border-danger-line px-5 py-5">
          <p className="text-base leading-relaxed text-ink">
            아래 항목은 침착이 화면이나 음성으로 지도하지 않는 것들입니다. 하지 않는 이유와, 대신
            무엇을 하는지를 함께 적어 두었습니다.
          </p>

          <ul className="mt-5 space-y-4">
            {protocol.notDoing.map((item) => (
              <li key={item.what}>
                <Card tone="quiet" className="h-full">
                  <p className="text-base font-extrabold text-danger-ink md:text-lg">
                    <span aria-hidden="true">✕</span> {item.what}
                  </p>
                  <dl className="mt-3 space-y-2">
                    <div>
                      <dt className="text-sm font-bold text-ink-muted">하지 않는 이유</dt>
                      <dd className="mt-0.5 text-base leading-relaxed text-ink">{item.why}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-bold text-ink-muted">대신 하는 것</dt>
                      <dd className="mt-0.5 text-base leading-relaxed text-ink">{item.instead}</dd>
                    </div>
                  </dl>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      </details>

      {/* 하단 이동 */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <BigButton href="/emergency" size="lg" variant="secondary">
          다른 프로토콜 보기
        </BigButton>
        <BigButton href="/safety" size="lg" variant="ghost">
          안전 설계 확인하기
        </BigButton>
      </div>
    </PageShell>
  );
}
