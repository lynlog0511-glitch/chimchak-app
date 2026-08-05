import type { Metadata } from "next";
import { InlineDisclaimer, PageShell, ScreenHeader } from "@/components";
import { CheckClient } from "./_components/CheckClient";

/**
 * 무대 직전 30초 점검 화면 (발표자 전용).
 *
 * 심사에 보여주는 화면이 아니므로 하단 탭바에도 링크를 넣지 않습니다.
 * 주소를 직접 입력해서만 들어옵니다: /check
 * (route indexing/robots.txt 는 이 프로젝트에 없어 검색엔진 노출 자체가 없는 오프라인 데모지만,
 *  혹시 배포되더라도 이 화면이 결과 페이지로 오인되지 않도록 noindex를 명시해 둡니다.)
 */
export const metadata: Metadata = {
  title: "무대 직전 점검",
  robots: { index: false, follow: false },
};

/**
 * 발표자 도구는 심사 화면이 아니라 도구이므로, 화면 전체가 한눈에 훑히도록
 * v4 §2 문법 중에서도 가장 조용한 쪽(22px 제목 + 12.5px 부제 + hairline 행)만 씁니다.
 * 문구는 그대로이고 위치·크기만 바뀝니다.
 */
export default function CheckPage() {
  return (
    <PageShell>
      <ScreenHeader
        title="무대 직전 30초 점검"
        subtitle="발표자 전용 — 오프라인 시연 조건을 한 번에 확인합니다. 심사 화면이 아닙니다"
      />

      <CheckClient />

      <InlineDisclaimer size="md" tone="readable" className="mt-5 mb-6" />
    </PageShell>
  );
}
