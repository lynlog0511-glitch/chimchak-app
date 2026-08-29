import { BigButton, InlineDisclaimer, PageShell, ScreenHeader } from "@/components";
import { PROTOCOLS } from "@/data/protocols";

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
        subtitle="주소가 바뀌었거나, 잘못 입력되었을 수 있습니다"
      />

      {/* 이 화면의 본문은 이 문단 하나뿐입니다 — 13.5px(보조 설명 단)에서 15px(읽는 단)로 올립니다.
          가이드 §7-8은 15px 미만의 「읽어야 하는 문장」을 막고 메타·각주만 예외로 두는데,
          길을 잃은 사람이 다음 행동을 고르려고 읽는 문장은 각주가 아닙니다.
          행간도 3단 사다리에 없던 1.65에서 본문 단 1.6으로 내려 다른 화면과 맞췄습니다. */}
      {/* 종수는 데이터에서 셉니다. 괄호 안 낱말은 목록 화면의 마커(낙·기·의·경·출·문)와 같은
          순서로 손으로 적은 것이라, 안내가 늘면 여기도 한 낱말 더해야 합니다 — 숫자만 늘고
          낱말이 그대로면 이 문단이 스스로와 어긋납니다. */}
      <div className="mt-[16px] rounded-card bg-paper-2 px-[15px] py-[14px]">
        <p className="text-[0.9375rem] leading-[1.6] text-ink">
          급하신 상황이라면 아래에서 응급 안내를 바로 여실 수 있습니다. 응급 안내{" "}
          {PROTOCOLS.length}종(낙상·기도폐쇄·의식 저하·경련·출혈·문 잠김)은 고정 문구로 되어
          있고, 연결이 끊겨도 열리도록 기기에 저장해 둡니다.
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
