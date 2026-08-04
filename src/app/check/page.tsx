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

export default function CheckPage() {
  return (
    <PageShell
      eyebrow="발표자 전용"
      title="무대 직전 30초 점검"
      description="오프라인 시연에 필요한 조건을 한 번에 확인합니다. 심사 화면이 아닙니다."
    >
      <CheckClient />
    </PageShell>
  );
}
