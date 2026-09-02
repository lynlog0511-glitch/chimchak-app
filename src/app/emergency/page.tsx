import type { Metadata } from "next";
import Link from "next/link";
import {
  ChevronGlyph,
  InlineDisclaimer,
  ListRow,
  ListRows,
  PageShell,
  ScreenHeader,
} from "@/components";
import { PROTOCOLS, PROTOCOL_NOTICE } from "@/data/protocols";
import { AudioUnlock } from "./_components/AudioUnlock";
import { Call119Bar } from "./_components/Call119Bar";
import { InstallHint } from "./_components/InstallHint";
import { OfflineStatus } from "./_components/OfflineStatus";
import { ProtocolAddressPanel } from "./_components/ProtocolAddressCard";

export const metadata: Metadata = {
  title: "응급 상황 도움",
  description:
    "실제 응급 상황에서 119 신고와 관찰·확인 절차를 큰 글자와 음성으로 안내합니다.",
};

const SITUATION_LABELS: Record<string, string> = {
  "P-01": "넘어지셨어요",
  "P-02": "목에 걸려 말을 못 해요",
  "P-03": "불러도 반응이 없어요",
  "P-04": "몸이 떨리고 굳어요",
  "P-05": "피가 멎지 않아요",
  "P-06": "문이 잠겼고 응답이 없어요",
};

export default function EmergencyPage() {
  return (
    <PageShell tabBar={false}>
      <AudioUnlock />

      <ScreenHeader
        title="지금 어떤 상황인가요?"
        subtitle={<OfflineStatus />}
        action={
          <Link
            href="/"
            className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-field px-1 text-[0.9375rem] font-bold text-ink-muted transition-colors duration-150 active:bg-paper-2"
          >
            홈
          </Link>
        }
      />

      <div className="sticky top-[var(--chim-safe-t)] z-30 -mx-[20px] border-b border-line bg-paper px-[20px] pt-4 pb-3">
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 top-0 mx-auto h-[var(--chim-safe-t)] max-w-[var(--chim-frame-w)] bg-paper"
        />
        <Call119Bar />
      </div>

      <ListRows className="mt-3">
        {PROTOCOLS.map((protocol) => {
          const label = SITUATION_LABELS[protocol.id] ?? protocol.title;
          return (
            <ListRow
              key={protocol.id}
              size="lg"
              href={`/emergency/${protocol.id.toLowerCase()}`}
              ariaLabel={`${label} 안내 열기`}
              title={label}
            />
          );
        })}
      </ListRows>

      <details className="group mt-5 rounded-card bg-paper-2">
        <summary className="flex min-h-[64px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[1rem] leading-[1.45] font-bold text-ink transition-colors duration-150 active:bg-neutral-line [&::-webkit-details-marker]:hidden">
          <span>미리 준비하기</span>
          <ChevronGlyph
            size="sm"
            className="flex-none text-ink-muted transition-transform duration-150 group-open:rotate-180"
          />
        </summary>
        <div className="border-t border-line px-4 py-4">
          <p className="text-[1rem] leading-[1.6] text-ink-soft">
            방문지 주소를 적어 두거나 이 화면을 홈 화면에 추가할 수 있어요.
          </p>
          <ProtocolAddressPanel className="mt-3" />
          <InstallHint className="mt-3" />
        </div>
      </details>

      <details className="group mt-3 border-y border-line">
        <summary className="flex min-h-[64px] cursor-pointer list-none items-center justify-between gap-3 py-3 text-[1rem] leading-[1.45] font-bold text-ink-soft transition-colors duration-150 active:bg-paper-2 [&::-webkit-details-marker]:hidden">
          <span>안내 범위 자세히 보기</span>
          <ChevronGlyph
            size="sm"
            className="flex-none text-ink-muted transition-transform duration-150 group-open:rotate-180"
          />
        </summary>
        <div className="border-t border-line py-4">
          <p className="text-[1rem] leading-[1.6] text-ink-soft">
            이 안내는 119 신고를 대체하지 않습니다. 신고 후 구급대가 도착할 때까지 관찰·확인과
            119 이양만 안내합니다.
          </p>
          <p className="mt-3 text-[1rem] leading-[1.6] text-ink-soft">
            {PROTOCOL_NOTICE} 신체 술기는 119 상황실이 목소리로 직접 지도합니다.
          </p>
          <InlineDisclaimer size="md" tone="readable" className="mt-4" />
        </div>
      </details>
    </PageShell>
  );
}
