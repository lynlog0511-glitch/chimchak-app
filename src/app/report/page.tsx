import type { Metadata } from "next";
import { InlineDisclaimer, PageShell, ScreenHeader, SourceChip } from "@/components";
import { SOURCE_DOCS } from "@/data/docs";
import { ReportWizard } from "./_components/ReportWizard";

export const metadata: Metadata = {
  title: "돌봄 기록 만들기",
  description:
    "말하거나 적은 돌봄 내용을 기기 안에서 가리고, 확인한 기록만 이 기기에 저장합니다.",
};

/**
 * `/report` — 기능③ 음성 보고 → 기록 코칭 (v4 언어).
 *
 * 3단계 위저드: ① 말하기·쓰기 → ② 가리기 확인 → ③ 기록 초안 확정.
 * 전 과정이 브라우저 안에서 끝나며 외부 호출이 0건입니다.
 *
 * 이 화면의 사용자 문면은 **「가리기」 한 낱말로 통일**합니다(2026-08-25 · 페르소나 현직 P1).
 * 「가명처리」는 법령의 말이라 화면마다 섞여 있으면, 그 말을 모르는 분이 「내 이름이 어떻게
 * 되는 건가」를 화면에서 끝내 알 수 없습니다. 법 개념이 필요한 자리(동의 문안·저장 항목 고지)는
 * `/legal`과 `/safety`가 원문 그대로 들고 있고, 여기서는 지우지 않고 **말만** 바꿉니다.
 *
 * 화면 문법(시안 6e): 22px 제목 바로 아래에 「① 말하기 ✓ — ② 가리기 — ③ 확인」 한 줄이 붙습니다.
 * 서버 고지는 제목과 단계 사이를 벌리지 않도록 화면 끝 접힘 행으로 내렸습니다 —
 * 문구는 한 글자도 지우지 않고 자리만 옮겼습니다.
 */
export default function ReportPage() {
  return (
    <PageShell sourceDocs={SOURCE_DOCS} className="chim-report-shell">
      {/* 시안 6e — 제목과 단계 인디케이터 사이는 10px. 사이에 아무것도 끼우지 않습니다. */}
      <ScreenHeader title="돌봄 기록 만들기" className="pb-[10px]" />

      <ReportWizard />

      {/* 고지는 존재하되 조용히. 첫 문장만 보이고 나머지는 펼쳐서 봅니다. */}
      <details className="group mt-6 border-y border-line">
        <summary className="flex min-h-[48px] cursor-pointer list-none items-center gap-2 rounded-field px-[2px] text-[0.7813rem] leading-[1.45] font-bold text-ink-soft transition-colors duration-150 active:bg-paper-2 [&::-webkit-details-marker]:hidden">
          <span
            aria-hidden
            className="text-[0.9375rem] leading-[1.3] text-ink-ghost transition-transform duration-150 group-open:rotate-90"
          >
            ›
          </span>
          침착 서버로는 아무것도 보내지 않습니다.
        </summary>

        <div className="pb-4 pl-[22px]">
          <p className="text-[0.7813rem] leading-[1.6] text-ink-muted">
            가리기와 초안 만들기는 기기 안에서 하고, 확정한 가린 문장만 이 기기에
            남습니다. 음성 인식은 브라우저 내장 기능을 씁니다. 브라우저·기기에 따라 인식
            처리가 제조사 서버를 경유할 수 있고, 타이핑 입력은 네트워크 없이 동작합니다.
          </p>
          <div className="mt-2">
            <SourceChip docId="DOC-NOTI-002" />
          </div>
          <InlineDisclaimer size="md" tone="readable" className="mt-4" />
        </div>
      </details>
    </PageShell>
  );
}
