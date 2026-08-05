import type { Metadata } from "next";
import { InlineDisclaimer, PageShell, ScreenHeader, SourceChip } from "@/components";
import { SOURCE_DOCS } from "@/data/docs";
import { ReportWizard } from "./_components/ReportWizard";

export const metadata: Metadata = {
  title: "음성 보고 → 기록 코칭",
  description:
    "말로 보고하면 기기 안에서 가명처리하고, 급여제공기록지 5요소 초안을 만들어 드립니다. 확정은 사용자가 직접 누릅니다.",
};

/**
 * `/report` — 기능③ 음성 보고 → 기록 코칭 (v4 언어).
 *
 * 3단계 위저드: ① 말하기·쓰기 → ② 가명처리 확인 → ③ 기록 초안 확정.
 * 전 과정이 브라우저 안에서 끝나며 외부 호출이 0건입니다.
 *
 * 화면 문법(v4 §0·§2): 22px 제목 상단 바 + 면 카드 + 하단 인라인 고지.
 * 상단 고지는 카드가 아니라 옅은 면 위 한 줄로 두고, 뒤에 이어지는 설명은 기본 접힘입니다 —
 * 문구는 한 글자도 지우지 않고 자리만 옮겼습니다.
 */
export default function ReportPage() {
  return (
    <PageShell sourceDocs={SOURCE_DOCS}>
      <ScreenHeader
        title="기록 코칭"
        subtitle="말로 보고하면 기록의 뼈대가 남습니다 — 저장은 확정 버튼을 누르실 때만"
      />

      {/* 고지는 존재하되 조용히. 첫 문장만 보이고 나머지는 펼쳐서 봅니다. */}
      <details className="group mt-4 rounded-[14px] bg-paper-2 px-4">
        <summary className="flex min-h-[48px] cursor-pointer list-none items-center gap-2 text-[12.5px] font-bold text-ink-soft [&::-webkit-details-marker]:hidden">
          <span
            aria-hidden
            className="text-[15px] leading-none text-faint transition-transform duration-150 group-open:rotate-90"
          >
            ›
          </span>
          침착 서버로는 아무것도 보내지 않습니다.
        </summary>

        <div className="pb-4 pl-[22px]">
          <p className="text-[12px] leading-[1.7] text-ink-muted">
            가명처리와 초안 만들기는 기기 안에서 일어나고, 확정한 가명처리 텍스트만 이 기기에
            남습니다. 음성 인식은 브라우저 내장 기능을 쓰므로 브라우저·기기에 따라 인식 처리가
            제조사 서버를 경유할 수 있으며, 타이핑 입력은 네트워크 없이 동작합니다.
          </p>
          <div className="mt-2">
            <SourceChip docId="DOC-NOTI-002" />
          </div>
        </div>
      </details>

      <ReportWizard />

      <InlineDisclaimer size="md" tone="readable" className="mt-6 mb-3" />
    </PageShell>
  );
}
