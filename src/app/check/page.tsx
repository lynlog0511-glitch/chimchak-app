import type { Metadata } from "next";
import { PageShell } from "@/components";
import { CheckClient } from "./_components/CheckClient";

/**
 * 무대 직전 30초 점검 화면 (발표자 전용).
 *
 * 심사에 보여주는 화면이 아니므로 AppHeader 네비·모바일 탭바에는 링크를 넣지 않습니다.
 * 주소를 직접 입력해서만 들어옵니다: /check
 * (route indexing/robots.txt 는 이 프로젝트에 없어 검색엔진 노출 자체가 없는 오프라인 데모지만,
 *  혹시 배포되더라도 이 화면이 결과 페이지로 오인되지 않도록 noindex를 명시해 둡니다.)
 */
export const metadata: Metadata = {
  title: "무대 직전 점검",
  robots: { index: false, follow: false },
};

/**
 * 머리말은 PageShell 기본 크기(32~40px 페이지 제목) 대신 직접 그립니다.
 * 발표자 도구는 심사 화면이 아니라 도구이므로, 제목까지 UI 크롬 크기로 낮춰
 * 화면 전체가 한눈에 훑히게 두는 편이 맞습니다(v3 §3 — 큰 글자는 위계가 높은 곳에만).
 * 문구는 그대로이고 위치·크기만 바뀝니다.
 */
export default function CheckPage() {
  return (
    <PageShell>
      <header className="mb-6">
        <p className="chim-caption mb-1 font-bold tracking-wide text-brand-700">발표자 전용</p>
        <h1 className="chim-h2 text-ink">무대 직전 30초 점검</h1>
        <p className="chim-meta mt-2 max-w-2xl text-ink-soft">
          오프라인 시연에 필요한 조건을 한 번에 확인합니다. 심사 화면이 아닙니다.
        </p>
      </header>

      <CheckClient />
    </PageShell>
  );
}
