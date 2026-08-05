import type { Metadata } from "next";
import Link from "next/link";
import { PageShell, ScreenHeader } from "@/components";
import { SOURCE_DOCS } from "@/data/docs";
import { CertificateSheet } from "./_components/CertificateSheet";

export const metadata: Metadata = {
  title: "이수 확인서",
  description:
    "이수 사실만 담은 인쇄용 확인서입니다. 시나리오·완료일·이수 횟수까지이며 판정과 대화 내용은 담기지 않습니다.",
};

/**
 * `/history/certificate` — 이수 확인서 (인쇄용 화면).
 *
 * 성장 기록의 「이수 확인서 만들기」에서 넘어옵니다. 인쇄 규칙은 `CertificateSheet`가
 * 이 화면에서만 쓰는 `@media print`로 들고 있습니다(전역 CSS는 건드리지 않습니다).
 * 인쇄 중에는 화면 껍데기(버튼·상단 바)가 빠지고 확인서만 종이에 남습니다.
 */
export default function CertificatePage() {
  return (
    <PageShell sourceDocs={SOURCE_DOCS} tabBar={false}>
      <div data-noprint>
        <ScreenHeader
          title="이수 확인서"
          subtitle="이수 사실만 담습니다 — 판정·대화 내용 없음"
          action={
            <Link
              href="/history"
              className="flex min-h-[48px] items-center px-1 text-[0.8438rem] font-semibold text-ink-muted"
            >
              닫기
            </Link>
          }
        />
      </div>
      <CertificateSheet />
    </PageShell>
  );
}
