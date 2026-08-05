import type { Metadata } from "next";
import { PageShell, SourceChip } from "@/components";
import { IconChevronDown } from "@/components/icons";
import { SOURCE_DOCS } from "@/data/docs";
import { ReportWizard } from "./_components/ReportWizard";

export const metadata: Metadata = {
  title: "음성 보고 → 기록 코칭",
  description:
    "말로 보고하면 기기 안에서 가명처리하고, 급여제공기록지 5요소 초안을 만들어 드립니다. 확정은 사용자가 직접 누릅니다.",
};

/**
 * `/report` — 기능③ 음성 보고 → 기록 코칭.
 *
 * 3단계 위저드: ① 말하기·쓰기 → ② 가명처리 확인 → ③ 기록 초안 확정.
 * 전 과정이 브라우저 안에서 끝나며 외부 호출이 0건입니다.
 *
 * 레이아웃(v3 §5·§6): 상단 고지는 카드가 아니라 옅은 면 위 한 줄로 두고,
 * 뒤에 이어지는 설명은 기본 접힘입니다 — 문구는 한 글자도 지우지 않고 자리만 옮겼습니다.
 */
export default function ReportPage() {
  return (
    <PageShell
      eyebrow="기록 코칭"
      title="말로 보고하면, 기록의 뼈대가 남습니다"
      description="퇴근 뒤에 기억을 짜내며 기록지를 채우지 않아도 되도록, 말한 내용을 기기 안에서 가명처리하고 급여제공기록지 5요소로 나눠 드립니다. 저장은 확정 버튼을 누르실 때만 일어납니다."
      sourceDocs={SOURCE_DOCS}
      wide
    >
      {/* 고지는 존재하되 조용히(§5). 첫 문장만 보이고 나머지는 펼쳐서 봅니다(§6). */}
      <details className="group mb-8 rounded-card bg-paper-2 px-4 py-1 md:px-5">
        <summary className="chim-meta flex min-h-[48px] cursor-pointer list-none items-center gap-2 font-semibold text-ink-soft [&::-webkit-details-marker]:hidden">
          <IconChevronDown className="h-[18px] w-[18px] shrink-0 text-ink-muted transition-transform duration-150 group-open:rotate-180" />
          침착 서버로는 아무것도 보내지 않습니다.
        </summary>

        <div className="pb-4 md:pl-[26px]">
          <p className="chim-caption max-w-3xl leading-relaxed text-ink-muted">
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
    </PageShell>
  );
}
