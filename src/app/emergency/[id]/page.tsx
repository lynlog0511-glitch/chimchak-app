import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EyebrowLabel, InlineDisclaimer, PageShell } from "@/components";
import { PROTOCOLS, getProtocol } from "@/data/protocols";
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
  if (!protocol) return { title: "응급 안내" };
  return {
    title: `${protocol.title} — 응급 안내`,
    description: protocol.situation,
  };
}

export default async function ProtocolPage({ params }: PageParams) {
  const { id } = await params;
  const protocol = getProtocol(id);
  if (!protocol) notFound();

  return (
    /* 재생기에서는 탭바를 접습니다(가이드 §4.10) — 나가는 문은 「‹ 안내 종료」 하나로 좁힙니다. */
    <PageShell tabBar={false}>
      {/* 화면에 보이는 제목은 재생기 상단의 「{프로토콜명} · N / M」 한 줄입니다(시안 6d).
          단계마다 바뀌는 줄을 h1으로 두면 보조기기에서 제목이 계속 흔들려, 문서 제목만 따로 둡니다. */}
      <h1 className="sr-only">{protocol.title} — 응급 안내</h1>

      <ProtocolPlayer title={protocol.title} steps={protocol.steps} backHref="/emergency" />

      {/* 이 안내를 언제 쓰는지 — 재생을 방해하지 않도록 아래에 조용히 둡니다. */}
      <section className="mt-8">
        <EyebrowLabel>이럴 때 씁니다</EyebrowLabel>
        <p className="mt-1.5 text-[0.9063rem] leading-[1.65] text-ink-soft">{protocol.situation}</p>
        <p className="mt-2 text-[0.75rem] leading-[1.6] text-tertiary">
          검수 상태 · {protocol.reviewed}
        </p>
      </section>

      {/* 앱이 하지 않는 것 — 기본 접힘. 보더 없이 면 한 장으로 둡니다. */}
      <details className="group mt-4 rounded-[14px] bg-paper-2">
        <summary className="flex min-h-[56px] cursor-pointer list-none items-center gap-3 px-4 py-3 text-[0.9375rem] leading-[1.45] font-bold text-ink [&::-webkit-details-marker]:hidden">
          <span className="flex-1">
            앱이 하지 않는 것 — 이 부분은 119 상황실이 목소리로 직접 지도합니다
          </span>
          <span aria-hidden className="flex-none text-[0.75rem] font-semibold text-ink-muted">
            <span className="group-open:hidden">펼치기</span>
            <span className="hidden group-open:inline">접기</span>
          </span>
        </summary>

        <div className="border-t border-line-strong px-4 py-4">
          <p className="text-[0.8125rem] leading-[1.6] text-ink-soft">
            아래 항목은 침착이 화면이나 음성으로 지도하지 않는 것들입니다. 하지 않는 이유와, 대신
            무엇을 하는지를 함께 적어 두었습니다.
          </p>

          <ul className="chim-hairline mt-3 [&>li+li]:border-line-strong">
            {protocol.notDoing.map((item) => (
              <li key={item.what} className="py-3.5">
                <p className="text-[0.9063rem] leading-[1.45] font-bold text-danger-ink">
                  {item.what}
                </p>
                <dl className="mt-2 space-y-1.5">
                  <div>
                    <dt className="text-[0.75rem] font-bold tracking-[0.04em] text-ink-muted">
                      하지 않는 이유
                    </dt>
                    <dd className="mt-[1px] text-[0.8438rem] leading-[1.6] text-ink">{item.why}</dd>
                  </div>
                  <div>
                    <dt className="text-[0.75rem] font-bold tracking-[0.04em] text-ink-muted">
                      대신 하는 것
                    </dt>
                    <dd className="mt-[1px] text-[0.8438rem] leading-[1.6] text-ink">
                      {item.instead}
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        </div>
      </details>

      {/* 각주 2줄(생성 통제 · 술기 경계)은 재생기 컨트롤 바로 아래에 있습니다 — 시안 6d 자리입니다. */}
      <InlineDisclaimer size="md" tone="readable" className="mt-6 mb-6" />
    </PageShell>
  );
}
