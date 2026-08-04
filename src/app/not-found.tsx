import { BigButton, Card, PageShell } from "@/components";

export const metadata = {
  title: "찾으시는 화면이 없습니다",
};

/**
 * 404 화면.
 *
 * Next 기본 404는 영문 문구이고 고정 고지 바가 붙지 않으므로 직접 둡니다.
 * PageShell로 감싸면 헤더와 하단 고정 고지(안전 규칙 §3-2)가 그대로 따라옵니다.
 * `/emergency/[id]`는 dynamicParams=false라 주소를 잘못 입력하면 곧바로 이 화면으로 옵니다.
 */
export default function NotFound() {
  return (
    <PageShell
      eyebrow="404"
      title="찾으시는 화면이 없습니다"
      description="주소가 바뀌었거나, 아직 준비되지 않은 화면일 수 있습니다. 급하신 상황이라면 아래에서 응급 안내를 바로 여실 수 있습니다."
    >
      <Card tone="quiet">
        <p className="text-base leading-relaxed text-ink">
          응급 안내 5종(낙상·기도폐쇄·의식 저하·경련·출혈)은 검수된 고정 문구로 되어 있고,
          연결이 끊겨도 열리도록 기기에 저장해 둡니다.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <BigButton href="/emergency" size="lg" variant="danger" block>
            응급 안내 열기
          </BigButton>
          <BigButton href="/" size="lg" variant="secondary" block>
            홈으로 돌아가기
          </BigButton>
        </div>
      </Card>
    </PageShell>
  );
}
