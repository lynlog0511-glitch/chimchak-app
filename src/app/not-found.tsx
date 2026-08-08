import { BigButton, InlineDisclaimer, PageShell, ScreenHeader } from "@/components";

export const metadata = {
  title: "찾으시는 화면이 없습니다",
};

/**
 * 404 화면.
 *
 * Next 기본 404는 영문 문구이고 고지가 붙지 않으므로 직접 둡니다.
 * v4에서 전역 헤더·전역 고정 고지 바가 사라졌으므로 이 화면도 자기 상단 바(`ScreenHeader`)와
 * 인라인 고지(`InlineDisclaimer`)를 직접 가집니다 — 전역 조각에 기대지 않습니다.
 * `/emergency/[id]`는 dynamicParams=false라 주소를 잘못 입력하면 곧바로 이 화면으로 옵니다.
 */
export default function NotFound() {
  return (
    <PageShell>
      <ScreenHeader
        title="찾으시는 화면이 없습니다"
        subtitle="주소가 바뀌었거나, 아직 준비되지 않은 화면일 수 있습니다"
      />

      <div className="mt-[16px] rounded-[14px] bg-paper-2 px-[15px] py-[14px]">
        <p className="text-[0.8438rem] leading-[1.65] text-ink">
          급하신 상황이라면 아래에서 응급 안내를 바로 여실 수 있습니다. 응급 안내
          5종(낙상·기도폐쇄·의식 저하·경련·출혈)은 고정 문구로 되어 있고, 연결이 끊겨도
          열리도록 기기에 저장해 둡니다.
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <BigButton href="/emergency" size="lg" variant="danger" block>
          응급 안내 열기
        </BigButton>
        <BigButton href="/" variant="secondary" block>
          홈으로 돌아가기
        </BigButton>
      </div>

      <InlineDisclaimer size="md" tone="readable" className="mt-6 mb-6" />
    </PageShell>
  );
}
