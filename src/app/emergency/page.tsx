import type { Metadata } from "next";
import {
  InlineDisclaimer,
  ListRow,
  ListRows,
  MarkerSquare,
  PageShell,
  ScreenHeader,
} from "@/components";
import { PROTOCOLS, PROTOCOL_NOTICE } from "@/data/protocols";
import { AudioUnlock } from "./_components/AudioUnlock";
import { Call119Bar } from "./_components/Call119Bar";
import { InstallHint } from "./_components/InstallHint";
import { OfflineStatus } from "./_components/OfflineStatus";

export const metadata: Metadata = {
  title: "응급 안내",
  description:
    "응급 상황에서 해야 할 일을 음성과 큰 자막으로 차례로 안내합니다. 고정 문구만 재생하며, 연결이 끊겨도 열립니다.",
};

/**
 * 한 글자 마커 — 시안 5b의 낙·기·의·경·출입니다.
 * 옆의 제목이 뜻을 전하므로 마커는 스캔용 장치일 뿐입니다(스크린리더에는 읽히지 않습니다).
 */
const PROTOCOL_MARK: Record<string, string> = {
  "P-01": "낙",
  "P-02": "기",
  "P-03": "의",
  "P-04": "경",
  "P-05": "출",
};

/**
 * 부제 앞머리의 **짧은 행동 요약**입니다.
 *
 * 각 프로토콜에서 **가장 먼저 지키는 원칙 한 줄**을 화면용으로 줄여 적은 페이지 상수이며,
 * 데이터 파일(`src/data/protocols.ts`)의 검수 문구는 한 글자도 건드리지 않았습니다.
 * 신체 술기를 연상시키는 표현은 쓰지 않습니다 — 그 부분은 119 상황실이 지도합니다.
 *   P-01 「옮기거나 일으키는 것은 119 지시가 있을 때까지 하지 않습니다」
 *   P-02 「소리를 낼 수 있는지 확인하세요」
 *   P-03 「이름을 부르고 반응이 있는지 확인하세요」
 *   P-04 「주변의 단단한 물건만 치워 주세요 · 시작된 시각을 보세요」
 *   P-05 「어디에서 피가 나는지, 언제부터인지 보신 그대로 119에 말씀하세요」
 */
const ACTION_SUMMARY: Record<string, string> = {
  "P-01": "일으키지 않고 확인부터",
  "P-02": "소리가 나는지부터",
  "P-03": "이름을 불러 반응부터",
  "P-04": "주변을 치우고 시간 재기",
  "P-05": "보이는 그대로 119에 전달",
};

export default function EmergencyPage() {
  return (
    <PageShell>
      {/* 프로토콜을 고르시는 그 탭에서 오디오 잠금을 풀어 둡니다 — 다음 화면의 첫 문장이
          아이폰에서도 검수된 목소리로 나오게 하는 자리입니다(그리는 것은 없습니다). */}
      <AudioUnlock />

      {/* 제목 22px + 초록 점 한 줄. 저장 여부는 실측한 뒤에만 단정합니다(시안 5b). */}
      <ScreenHeader title="응급 안내" subtitle={<OfflineStatus />} />

      {/* 시안에서 119 버튼은 목록이 스크롤해도 자리를 지킵니다 — 안전 규칙 §3-5(상시 노출)와 같은 뜻입니다. */}
      <div className="sticky top-0 z-30 -mx-[20px] bg-paper px-[20px] pt-[14px] pb-2">
        <Call119Bar />
      </div>

      {/* 이 다섯 가지가 무엇이고 무엇이 아닌지를 목록 앞에서 한 번 못박습니다.
          아래 각주(생성 통제·술기 경계)와 겹치지 않는, **순서**에 관한 경계입니다 — 119가 먼저입니다. */}
      <p className="mt-[6px] mb-[14px] text-[0.8438rem] leading-[1.6] text-ink-soft">
        이 안내는 119 신고를 대체하지 않으며, 신고 후 구급대 도착까지의 확인 절차를 돕습니다 — 안내
        내용은 관찰·확인·119 이양뿐입니다.
      </p>

      {/* 5종 — 카드가 아니라 선으로 나눈 목록입니다. 마커 한 글자로 눈이 먼저 찾습니다. */}
      <ListRows>
        {PROTOCOLS.map((protocol) => {
          const mark = PROTOCOL_MARK[protocol.id] ?? protocol.title.slice(0, 1);
          const summary = ACTION_SUMMARY[protocol.id];
          return (
            <ListRow
              key={protocol.id}
              size="lg"
              href={`/emergency/${protocol.id.toLowerCase()}`}
              ariaLabel={`${protocol.title} 안내 열기`}
              leading={<MarkerSquare>{mark}</MarkerSquare>}
              title={protocol.title}
              subtitle={
                summary
                  ? `${summary} · ${protocol.steps.length}단계`
                  : `${protocol.steps.length}단계`
              }
            />
          );
        })}
      </ListRows>

      {/* 홈 화면 추가 — 이 기기에서 실제로 되는 길이 있을 때만 그려집니다(없으면 조용히 사라집니다). */}
      <InstallHint className="mt-5" />

      {/* 하단 고지 2줄 — 생성 통제와 술기 경계를 이 화면에서 한 번 더 못박습니다. */}
      <p className="mt-[10px] text-center text-[0.7813rem] leading-[1.6] text-tertiary">
        {PROTOCOL_NOTICE}
        <br />
        신체 술기는 119 상황실이 목소리로 직접 지도합니다
      </p>

      <InlineDisclaimer size="md" tone="readable" className="mt-4 mb-6" />
    </PageShell>
  );
}
