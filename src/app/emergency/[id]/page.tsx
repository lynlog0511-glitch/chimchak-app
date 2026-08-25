import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EyebrowLabel, InlineDisclaimer, PageShell } from "@/components";
import { PROTOCOLS, getProtocol } from "@/data/protocols";
import { ProtocolPlayer } from "./_components/ProtocolPlayer";

interface PageParams {
  params: Promise<{ id: string }>;
}

/**
 * 「이럴 때 씁니다」를 사용자 말로 바꿔 다는 표시용 치환표입니다.
 *
 * 데이터(`src/data/protocols.ts`)의 P-02 설명 마지막 문장은 시나리오 코드와 계층 이름
 * (「CHK-B02 훈련의 L3 구간」)으로 적혀 있습니다. 사실은 맞지만, 응급 화면을 연 사람에게
 * CHK-B02도 L3도 아무것도 가리키지 못합니다 — 같은 사실을 그 사람이 아는 이름
 * (「점심 식사 중 사레」 훈련)으로 바꿔 답니다.
 *
 * **데이터는 건드리지 않습니다.** 검수를 거친 문구 파일이라 이 배치의 소유 범위 밖이고,
 * 바꾸는 것은 화면에 적히는 말뿐입니다. 원문이 바뀌면 이 치환은 조용히 지나가고
 * (`replace`가 못 찾으면 원문 그대로), 화면은 데이터가 적은 대로 나옵니다.
 */
const SITUATION_REWRITES: readonly { from: string; to: string }[] = [
  {
    from: "CHK-B02 훈련의 L3 구간에서 그대로 재생됩니다.",
    to: "「점심 식사 중 사레」 훈련에서 응급으로 번지면 이 안내가 그대로 나옵니다.",
  },
];

function situationText(situation: string): string {
  return SITUATION_REWRITES.reduce(
    (text, rewrite) => text.replace(rewrite.from, rewrite.to),
    situation,
  );
}

/**
 * 이 안내가 현직 감수를 마쳤는지 — **표시 전용 분기**입니다.
 *
 * 판정 기준은 /safety의 검수 계보 표(`ReviewLedger`)와 같습니다(`reviewed`가 「감수 완료」로
 * 시작하는가). 데이터의 `reviewed` 원문을 그대로 세우지 않는 이유는 두 가지입니다 —
 * 원문에는 화면 밖 진행 상태를 가리키는 내부 표기가 섞여 있고, 사용자가 알아야 할 것은
 * 「현직이 봤는가 · 아직인가」와 「어느 쪽이든 고정 문구다」 둘뿐입니다.
 *
 * **데이터는 건드리지 않습니다.** 위 치환표와 같은 규율입니다.
 */
function reviewLine(reviewed: string): string {
  return reviewed.startsWith("감수 완료")
    ? "현직 감수 완료 · 고정 문구 · 생성 호출 없음"
    : "초안 · 현직 감수 대기. 고정 문구·생성 0건 원칙은 그대로 적용됩니다";
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
    description: situationText(protocol.situation),
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

      {/* 이 안내를 언제 쓰는지 — 재생을 방해하지 않도록 아래에 조용히 둡니다.

          그 아래 한 줄은 **이 안내 하나의 감수 상태**입니다. 한때 이 자리에 있던 줄은
          다섯 종에 같은 문장을 달아 중복이었고, 그래서 지웠습니다. 지금 다시 세우는 줄은
          프로토콜마다 다릅니다 — 현직 감수를 마친 것은 아직 한 종뿐이고, 공통 각주
          (`PROTOCOL_NOTICE`)는 다섯 종 전부에 참인 것(고정 문구 재생·생성 호출 없음)만
          말하도록 감수 단언을 내려놓았기 때문입니다. 두 줄이 서로 다른 일을 하므로 중복이 아닙니다.
          검수 계보의 전문은 /safety 검증 계단이 그대로 들고 있습니다. */}
      <section className="mt-8">
        <EyebrowLabel>이럴 때 씁니다</EyebrowLabel>
        <p className="mt-1.5 text-[0.9375rem] leading-[1.6] text-ink-soft">
          {situationText(protocol.situation)}
        </p>
        <p className="mt-2.5 text-[0.8438rem] leading-[1.6] text-ink-muted">
          {reviewLine(protocol.reviewed)}
        </p>
      </section>

      {/* 앱이 하지 않는 것 — 기본 접힘. 보더 없이 면 한 장으로 둡니다. */}
      <details className="group mt-4 rounded-card bg-paper-2">
        <summary className="flex min-h-[56px] cursor-pointer list-none items-center gap-3 px-4 py-3 text-[0.9375rem] leading-[1.45] font-bold text-ink [&::-webkit-details-marker]:hidden">
          <span className="flex-1">
            앱이 하지 않는 것 — 119 상황실이 목소리로 직접 지도합니다
          </span>
          <span aria-hidden className="flex-none text-[0.7813rem] font-semibold text-ink-muted">
            <span className="group-open:hidden">펼치기</span>
            <span className="hidden group-open:inline">접기</span>
          </span>
        </summary>

        <div className="border-t border-line-strong px-4 py-4">
          <p className="text-[0.8438rem] leading-[1.6] text-ink-soft">
            아래는 침착이 화면이나 음성으로 지도하지 않는 항목입니다. 하지 않는 이유와 대신 하는
            것을 함께 적었습니다.
          </p>

          <ul className="chim-hairline mt-3 [&>li+li]:border-line-strong">
            {protocol.notDoing.map((item) => (
              <li key={item.what} className="py-3.5">
                <p className="text-[0.9375rem] leading-[1.45] font-bold text-danger-ink">
                  {item.what}
                </p>
                <dl className="mt-2 space-y-1.5">
                  <div>
                    <dt className="text-[0.7813rem] font-bold tracking-[0.04em] text-ink-muted">
                      하지 않는 이유
                    </dt>
                    <dd className="mt-[1px] text-[0.8438rem] leading-[1.6] text-ink">{item.why}</dd>
                  </div>
                  <div>
                    <dt className="text-[0.7813rem] font-bold tracking-[0.04em] text-ink-muted">
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
