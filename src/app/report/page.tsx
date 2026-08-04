import type { Metadata } from "next";
import { Card, PageShell, SourceChip } from "@/components";
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
      <Card tone="quiet" className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-base leading-relaxed font-bold text-ink">
            침착 서버로는 아무것도 보내지 않습니다. 가명처리와 초안 만들기는 기기 안에서
            일어나고, 확정한 가명처리 텍스트만 이 기기에 남습니다. 음성 인식은 브라우저 내장
            기능을 쓰므로 브라우저·기기에 따라 인식 처리가 제조사 서버를 경유할 수 있으며,
            타이핑 입력은 네트워크 없이 동작합니다.
          </p>
          <SourceChip docId="DOC-NOTI-002" />
        </div>
      </Card>

      <ReportWizard />
    </PageShell>
  );
}
