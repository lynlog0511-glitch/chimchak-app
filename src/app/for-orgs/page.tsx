import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { BigButton, EyebrowLabel, InlineDisclaimer, PageShell, ScreenHeader } from "@/components";
import { SOURCE_DOCS } from "@/data/docs";
import { SCENARIO_MATRIX } from "@/data/matrix";
import { PROTOCOLS } from "@/data/protocols";
import { SCENARIOS } from "@/data/scenarios";
import { OrgLiveNumbers } from "./_components/OrgLiveNumbers";

export const metadata: Metadata = {
  title: "기관 도입 안내",
  description:
    "기관 담당자용 한 장 안내입니다. 가격 대신, 앱이 이미 재고 있는 값으로 무엇이 줄고 무엇이 서류로 남는지와 파일럿 절차를 적었습니다.",
};

/* 화면에 적는 수치는 데이터에서 세어 옵니다 — 편성표가 늘면 이 문장도 같이 바뀝니다. */
const ACTIVE_SCENARIOS = SCENARIOS.filter((scenario) => scenario.active);
const ACTIVE_COUNT = ACTIVE_SCENARIOS.length;
const TOTAL_COUNT = SCENARIO_MATRIX.length;
const PROTOCOL_COUNT = PROTOCOLS.length;
const ACTIVE_MINUTES = ACTIVE_SCENARIOS.reduce((sum, scenario) => sum + scenario.durationMin, 0);
/** 12종이 다 열렸을 때의 시수는 **추정치**입니다 — 열린 3종의 소요를 그대로 곱한 값입니다. */
const PROJECTED_MINUTES = Math.round((ACTIVE_MINUTES / ACTIVE_COUNT) * TOTAL_COUNT);

/**
 * 「계획」 표 — /safety가 미구현 설계에 다는 것과 같은 표기입니다.
 * 이 화면은 구매 판단 자료라, 지금 되는 것과 설계까지만 한 것이 같은 말투로 섞이면 안 됩니다.
 */
function PlanMark() {
  return (
    <span className="mr-[6px] inline-flex items-center rounded-chip border border-line-strong px-[7px] py-[1px] align-[2px] text-[0.7188rem] leading-[1.5] font-bold whitespace-nowrap text-ink-soft">
      계획
    </span>
  );
}

function Section({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-7">
      <h2 className="text-[1.0625rem] leading-[1.4] font-bold text-ink">{title}</h2>
      {lead && <p className="mt-[6px] text-[0.8438rem] leading-[1.7] text-ink-soft">{lead}</p>}
      {children}
    </section>
  );
}

/** 지금 되는 것 / 아직 아닌 것 한 줄. */
function StateRow({ title, desc, plan }: { title: string; desc: string; plan?: boolean }) {
  return (
    <li className="py-[11px]">
      <p className="text-[0.875rem] leading-[1.45] font-bold text-ink">
        {plan && <PlanMark />}
        {title}
      </p>
      <p className="mt-[3px] text-[0.8438rem] leading-[1.7] text-ink-soft">{desc}</p>
    </li>
  );
}

/**
 * `/for-orgs` — 기관 담당자용 안내 한 장.
 *
 * 학습자용 화면은 전부 요양보호사 2인칭으로 말하므로, 결재 라인에 올릴 사람을 향해 말하는 자리가
 * 한 곳도 없었습니다. 이 화면이 그 자리입니다.
 *
 * 규칙 세 가지.
 *  1. **가격·계약 조건은 적지 않습니다** — /safety와 같은 원칙입니다. 대신 앱이 이미 재고 있는
 *     값(이수 시수·기록 작성 소요·외부 요청 수)만 놓고 「무엇이 줄고 무엇이 서류로 남는가」에 답합니다.
 *  2. **없는 기능은 「계획」으로 적습니다** — 관리자 콘솔·기관 연동은 설계까지입니다.
 *  3. 탭바에 넣지 않습니다 — 학습자 동선을 늘리지 않고, /safety와 이수 확인서에서만 들어옵니다.
 */
export default function ForOrgsPage() {
  return (
    <PageShell sourceDocs={SOURCE_DOCS} tabBar={false}>
      <ScreenHeader
        title="기관 도입 안내"
        subtitle="가격이 아니라, 무엇이 줄고 무엇이 서류로 남는지"
        action={
          <Link
            href="/safety"
            className="flex min-h-[48px] items-center px-1 text-[0.8438rem] font-semibold text-ink-muted"
          >
            닫기
          </Link>
        }
      />

      <p className="mt-4 text-[0.9063rem] leading-[1.75] text-ink">
        이 화면은 견적서가 아닙니다. 가격과 계약 조건은 기관 사정에 따라 달라지므로 여기에 적지
        않고, 대신 앱이 <b className="font-bold">이미 재고 있는 값</b>만 놓았습니다. 아래 숫자는
        모두 지금 보고 계신 기기에서 잰 실측치이며, 없는 값은 없다고 적습니다.
      </p>

      <Section
        title="이 기기에서 잰 값"
        lead="새로 만든 지표가 아니라 이수 확인서·보고 확정 화면이 평소 쓰는 값 그대로입니다."
      >
        <OrgLiveNumbers />
      </Section>

      <Section
        title="무엇이 서류로 남는가"
        lead="서버도 계정도 없는 구조라, 남는 것은 종이와 파일입니다. 두 가지 다 이 앱 안에서 지금 만들 수 있습니다."
      >
        <ul className="chim-hairline mt-[8px] border-y border-line">
          <StateRow
            title="이수 확인서 (인쇄·PDF)"
            desc="발급번호·성명·소속 기입란·시나리오별 이수 횟수·총 이수 시수·확인자 서명란이 한 장에 들어갑니다. 발급번호는 같은 기록이면 재인쇄에도 같은 값이라 중복 제출을 걸러낼 수 있습니다 — 다만 위조를 막는 장치는 아니며, 확인자 서명이 효력을 만듭니다."
          />
          <StateRow
            title="이수 사실 파일 (CSV)"
            desc="한 행이 시나리오 하나인 평평한 표이고 맨 앞 칸이 발급번호라, 여러 사람의 파일을 엑셀에서 그대로 이어 붙여 집계하실 수 있습니다. 발급번호·시나리오·이수 횟수·이수 시수만 담기고 발화 원문·대화 내용·판정 결과·성명·소속은 들어가지 않습니다. 기기를 바꾸실 때는 새 기기의 이수 확인서 화면에서 이 파일을 가져오면 본인의 이수 누계에 합쳐집니다 — 같은 발급번호는 두 번 더하지 않으며, 여러 사람의 파일을 한 기기에 모으는 용도는 아닙니다."
          />
          <StateRow
            title="판정 근거 문서 목록"
            desc="루브릭 30항목과 근거 문서 화이트리스트를 화면에 펴 두었습니다. 기관 감사에서 「근거가 무엇이냐」는 질문에 그대로 답하실 수 있습니다."
          />
        </ul>
        <div className="mt-4 flex flex-col gap-2">
          <BigButton href="/history/certificate" variant="secondary" block>
            이수 확인서 보기
          </BigButton>
          <BigButton href="/safety" variant="secondary" block>
            안전·개인정보 설계 보기
          </BigButton>
        </div>
      </Section>

      <Section
        title="지금 되는 것과 아직 아닌 것"
        lead="파일럿에서 확인하실 수 있는 범위입니다. 설계까지만 끝난 항목에는 「계획」을 붙였습니다."
      >
        <EyebrowLabel className="mt-4 mb-[2px]">지금 되는 것</EyebrowLabel>
        <ul className="chim-hairline border-y border-line">
          <StateRow
            title={`훈련 시나리오 ${ACTIVE_COUNT}종 (전체 편성표 ${TOTAL_COUNT}종)`}
            desc={`열린 ${ACTIVE_COUNT}종을 한 번씩 마치면 1인당 약 ${ACTIVE_MINUTES}분입니다. 반복 이수도 시수로 셉니다. 지금 규모로는 직무교육 시수 요건을 채우는 데 쓰실 수 없고, 정기평가 대비 실습 기록으로 쓰시는 것이 맞습니다.`}
          />
          <StateRow
            title={`응급 안내 ${PROTOCOL_COUNT}종 · 오프라인 재생`}
            desc="검수된 고정 문구를 음성과 대형 자막으로 읽어 줍니다. 기기에 저장돼 있어 통신이 끊긴 자리에서도 열립니다. 신체 술기는 지도하지 않고 119 상황실로 넘깁니다."
          />
          <StateRow
            title="보고 초안 만들기"
            desc="말이나 타이핑으로 상황을 보고하면 기기 안에서 가명처리를 두 번 거쳐 5요소 초안을 만듭니다. 확정은 사용자가 직접 누릅니다."
          />
          <StateRow
            title="기기 안 처리 · 외부 요청 없음"
            desc="서버·계정·데이터베이스·외부 API가 없습니다. 위 계측 패널과 /safety의 실시간 계측에서 직접 확인하실 수 있습니다."
          />
        </ul>

        <EyebrowLabel className="mt-5 mb-[2px]">아직 아닌 것</EyebrowLabel>
        <ul className="chim-hairline border-y border-line">
          <StateRow
            plan
            title="기관 관리자 콘솔"
            desc="기관 단위로 이수 현황을 모아 보는 화면은 설계까지 마쳤고 구현하지 않았습니다. 지금은 각자 확인서를 인쇄하거나 이수 사실 파일을 내려받아 모으는 방식이며, 파일은 한 행이 시나리오 하나인 표라 표 계산 프로그램에서 그대로 이어 붙일 수 있습니다."
          />
          <StateRow
            plan
            title="기관 시스템 연동"
            desc="확정한 기록을 기관 시스템으로 보내는 경로는 아직 없습니다. 연동하게 되더라도 확정 버튼을 누르신 뒤에만 전달되도록 설계했습니다."
          />
          <StateRow
            plan
            title={`나머지 시나리오 ${TOTAL_COUNT - ACTIVE_COUNT}종`}
            desc={`전체 ${TOTAL_COUNT}종이 열리면 같은 방식으로 1인당 약 ${PROJECTED_MINUTES}분이 됩니다 — 열린 ${ACTIVE_COUNT}종의 소요를 그대로 곱한 추정치이지 실측치가 아닙니다. 위험 판단 유형은 동작 교정으로 오인될 위험을 통제하기 어려워 베타로 미뤘습니다.`}
          />
          <StateRow
            plan
            title="기관 정책으로 마이크 끄기"
            desc="음성 인식은 브라우저 내장 기능이라 기기·브라우저에 따라 제조사 서버를 경유할 수 있습니다. 지금도 타이핑과 버튼만으로 전 구간을 완주할 수 있고, 기관 차원에서 마이크 사용을 막는 설정은 아직 없습니다."
          />
        </ul>
      </Section>

      <Section
        title="직원 반발을 막는 선"
        lead="도입 자리에서 가장 먼저 나오는 질문이라 화면에 미리 적어 두었습니다."
      >
        <div className="mt-[10px] rounded-[14px] bg-paper-2 px-4 py-[14px]">
          <p className="text-[0.8438rem] leading-[1.7] text-ink">
            내부 판정 결과와 대화 내용은 기관 관리자에게 공개되지 않고 인사평가에 연동하지 않습니다.
            관리자에게 가는 것은 이수 여부와 이수 시수까지입니다. 이 경계는 위수탁 계약에 그대로
            적습니다.
          </p>
          <p className="mt-[8px] text-[0.8438rem] leading-[1.7] text-ink-soft">
            학습자 화면에도 같은 문장을 고정 노출하고 있어, 직원분들이 앱을 열자마자 확인하실 수
            있습니다.
          </p>
        </div>
      </Section>

      <Section
        title="파일럿에서 유상 전환까지"
        lead="가격은 협의 자리에서 다루고, 여기에는 순서와 조건만 적습니다."
      >
        <ol className="chim-hairline mt-[8px] border-y border-line">
          <li className="py-[12px]">
            <p className="text-[0.875rem] leading-[1.45] font-bold text-ink">
              <span className="chim-num">1</span>. 무상 파일럿 — 범위와 기간
            </p>
            <p className="mt-[3px] text-[0.8438rem] leading-[1.7] text-ink-soft">
              한 기관 한 팀(요양보호사 25명 안팎)이 알파 {ACTIVE_COUNT}종과 응급 {PROTOCOL_COUNT}종을
              각자 기기에서 씁니다. 계정을 만들지 않고 설치도 필요 없습니다. 기본 제안은 4주이며 기관
              일정에 맞춰 조정합니다.
            </p>
          </li>
          <li className="py-[12px]">
            <p className="text-[0.875rem] leading-[1.45] font-bold text-ink">
              <span className="chim-num">2</span>. 협의 자리에 드리는 문서
            </p>
            <p className="mt-[3px] text-[0.8438rem] leading-[1.7] text-ink-soft">
              위수탁 계약서(안) · 개인정보 처리방침(안) · 보안 점검표 · 운영 안내서 · 이수 확인서 서식
              견본. 앱 안에 들어 있는 문서가 아니라 협의 자리에서 서면으로 드리는 서류입니다.
            </p>
          </li>
          <li className="py-[12px]">
            <p className="text-[0.875rem] leading-[1.45] font-bold text-ink">
              <span className="chim-num">3</span>. 전환 조건
            </p>
            <p className="mt-[3px] text-[0.8438rem] leading-[1.7] text-ink-soft">
              파일럿이 끝나면 기간 중 쌓인 이수 시수와 기록 작성 소요를 정리해 드립니다. 가명처리가
              놓친 사례는 앱이 모으지 않으므로 파일럿 기간에 서면으로 받습니다. 그 자료를 보고 계속
              쓰실지 정하시고, 그때 범위·기간·계약 문서를 확정합니다.
            </p>
          </li>
        </ol>
        <p className="mt-[10px] text-[0.8438rem] leading-[1.7] text-ink-soft">
          파일럿이 끝나도 기기에 쌓인 이수 사실은 사라지지 않습니다 — 확인서로 인쇄하시거나 이수 사실
          파일로 내려받아 두시면 앱과 무관하게 남습니다. 반대로 기기에서 기록을 지우면 되살릴 수
          없으므로, 그 전에 남겨 두시는 편이 안전합니다.
        </p>
        <p className="mt-[8px] text-[0.8438rem] leading-[1.7] text-ink-soft">
          도입 문의 경로는 협의 단계에서 별도로 안내드립니다. 이 배포본은 시연용이라 연락처를 화면에
          싣지 않았습니다.
        </p>
      </Section>

      <div className="mt-7 rounded-[14px] bg-paper-2 px-4 py-[14px]">
        <p className="text-[0.8438rem] leading-[1.7] font-bold text-ink">
          이 앱의 기록과 이수 확인서는 법정 보수교육 이수 인정이 아닙니다 — 기관 자체
          직무교육·정기평가 내부 증빙용입니다.
        </p>
      </div>

      <InlineDisclaimer size="md" tone="readable" className="mt-6 mb-3" />
    </PageShell>
  );
}
