import type { Metadata } from "next";
import Link from "next/link";
import { PageShell, ScreenHeader } from "@/components";
import { SOURCE_DOCS } from "@/data/docs";
import { ConsoleClient } from "./_components/ConsoleClient";

export const metadata: Metadata = {
  title: "기관 콘솔 미리보기",
  description:
    "파일럿 뒤에 연결할 기관 콘솔의 미리보기입니다. 직원분들의 이수 사실 파일을 이 기기에서 모아 직원별·과정별 이수 현황과 증빙 묶음을 만듭니다. 서버 없이 기기 안에서만 동작합니다.",
};

/**
 * `/console` — 기관 콘솔 미리보기.
 *
 * 기획서가 「파일럿 뒤에 이어 붙일 자리」라고 점선으로 그려 둔 칸이 이 화면입니다. 없는 기능을
 * 있다고 말하지 않으면서도, 담당자가 그 자리에서 무엇을 보게 되는지는 실물로 보여 드립니다.
 *
 * 세 가지를 지킵니다.
 *  1. 제목 자리에서 **미리보기라고 먼저 밝힙니다** — 화면을 다 읽기 전에 알아야 하는 사실입니다.
 *  2. 탭바에 넣지 않습니다 — 학습자 동선을 늘리지 않고, 기관 도입 안내에서만 들어옵니다
 *     (`/for-orgs`의 「아직 아닌 것 · 기관 관리자 콘솔」 한 줄).
 *  3. 인쇄 규칙은 `ConsoleClient`가 이 화면에서만 쓰는 `@media print`로 들고 있습니다 —
 *     전역 CSS는 건드리지 않습니다(이수 확인서 화면과 같은 방식입니다).
 */
export default function ConsolePage() {
  return (
    <PageShell sourceDocs={SOURCE_DOCS} tabBar={false}>
      <div data-noprint>
        <ScreenHeader
          title="기관 콘솔"
          subtitle="파일럿 뒤에 연결할 콘솔의 미리보기 · 이 기기 안에서만 동작합니다"
          action={
            <Link
              href="/for-orgs"
              className="flex min-h-[48px] items-center rounded-field px-1 text-[0.8438rem] font-semibold text-ink-muted transition-colors duration-150 active:bg-paper-2"
            >
              닫기
            </Link>
          }
        />
      </div>
      <ConsoleClient />
    </PageShell>
  );
}
