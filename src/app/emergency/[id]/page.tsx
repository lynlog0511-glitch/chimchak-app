import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, BigButton, PageShell } from "@/components";
import { IconChevronDown, IconChevronLeft, IconShield, IconX } from "@/components/icons";
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
          className="chim-label inline-flex min-h-[48px] items-center gap-1.5 font-bold text-brand-800"
        >
          <IconChevronLeft className="h-[18px] w-[18px]" /> 응급 프로토콜 목록
        </Link>
      </nav>

      <header className="mb-8">
        {/* 필은 프로토콜 번호와 검수 상태 둘까지 — 단계 수는 가운뎃점으로 이어 붙인 작은 텍스트입니다. */}
        <div className="chim-caption flex flex-wrap items-center gap-x-2 gap-y-1 font-bold text-ink-muted">
          {/* 색은 의미에만 씁니다(§2) — 프로토콜 번호는 상태가 아니므로 회색 필입니다. */}
          <Badge tone="neutral">{protocol.id}</Badge>
          <Badge tone={complete ? "ok" : "warn"}>{complete ? "감수 완료" : "알파 초안"}</Badge>
          <span className="chim-num">{protocol.steps.length}단계</span>
        </div>
        <h1 className="chim-h1 mt-3 text-ink">{protocol.title}</h1>
        <p className="chim-lead mt-3 max-w-3xl text-ink-soft">{protocol.situation}</p>
        <p className="chim-caption mt-2 text-ink-muted">검수 상태 · {protocol.reviewed}</p>
      </header>

      <ProtocolPlayer
        protocolId={protocol.id}
        title={protocol.title}
        steps={protocol.steps}
      />

      {/* 앱이 하지 않는 것 — 기본 접힘(§6). 보더 없이 옅은 보조 면 한 장으로 둡니다(§1-4). */}
      <details className="group mt-10 rounded-card bg-paper-2">
        <summary className="chim-core-sm flex min-h-[56px] cursor-pointer list-none items-center gap-3 px-5 py-4 font-bold text-ink [&::-webkit-details-marker]:hidden">
          <IconShield className="h-6 w-6 shrink-0 text-danger-ink" />
          <span className="flex-1">
            앱이 하지 않는 것 — 이 부분은 119 상황실이 목소리로 직접 지도합니다
          </span>
          <span className="chim-caption flex shrink-0 items-center gap-1.5 font-bold text-ink-muted">
            펼치기
            <IconChevronDown className="h-[18px] w-[18px] transition-transform duration-150 group-open:rotate-180" />
          </span>
        </summary>

        <div className="border-t border-line px-5 py-5">
          <p className="chim-meta text-ink-soft">
            아래 항목은 침착이 화면이나 음성으로 지도하지 않는 것들입니다. 하지 않는 이유와, 대신
            무엇을 하는지를 함께 적어 두었습니다.
          </p>

          {/* 항목마다 카드를 두지 않고 hairline으로만 나눕니다 — 위계가 낮은 목록입니다. */}
          <ul className="chim-hairline mt-4 border-t border-line">
            {protocol.notDoing.map((item) => (
              <li key={item.what} className="py-4">
                <p className="chim-label flex items-start gap-2 font-bold text-danger-ink">
                  <IconX className="mt-0.5 h-[18px] w-[18px] shrink-0" />
                  <span>{item.what}</span>
                </p>
                <dl className="mt-2 space-y-2 pl-6">
                  <div>
                    <dt className="chim-caption font-bold text-ink-muted">하지 않는 이유</dt>
                    <dd className="chim-meta mt-0.5 leading-relaxed text-ink">{item.why}</dd>
                  </div>
                  <div>
                    <dt className="chim-caption font-bold text-ink-muted">대신 하는 것</dt>
                    <dd className="chim-meta mt-0.5 leading-relaxed text-ink">{item.instead}</dd>
                  </div>
                </dl>
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
