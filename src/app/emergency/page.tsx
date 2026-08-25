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
    "응급 상황에서 119 신고와 관찰·확인 절차를 음성과 큰 자막으로 차례로 안내합니다. 고정 문구만 재생하며, 연결이 끊겨도 열립니다.",
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

/**
 * 목록의 굵은 제목을 **현장 말**로 바꿔 다는 표시용 치환표입니다.
 *
 * 급할 때 눈이 먼저 가는 것은 굵은 제목인데, 거기 「기도폐쇄(질식)」이 서 있으면 사레 든
 * 어르신 앞에 선 분이 한 번 더 훑어야 합니다 — 그 순간 떠오르는 말은 「목에 걸렸다」입니다
 * (페르소나 현직 med). 그래서 현장 말을 앞에 세우고 의학 용어는 괄호로 뒤에 붙입니다.
 *
 * **데이터는 건드리지 않습니다.** `src/data/protocols.ts`의 `title`은 검수를 거친 문구이고
 * 상세 화면·부제·감수 계보가 같은 문자열을 씁니다. 여기서 바꾸는 것은 이 목록에 적히는
 * 말뿐이며, 표에 없는 id는 원문 제목이 그대로 나옵니다
 * (같은 규율의 선례: `emergency/[id]/page.tsx`의 `SITUATION_REWRITES`).
 */
const LIST_TITLE_REWRITES: Record<string, string> = {
  "P-01": "넘어지셨는데 정신은 있으실 때 (낙상)",
  "P-02": "목에 걸려 소리를 못 내실 때 (기도폐쇄)",
  "P-03": "불러도 반응이 없을 때 (의식 저하)",
  "P-04": "온몸이 떨리며 굳으실 때 (경련)",
  "P-05": "피가 멎지 않을 때 (심한 출혈)",
};

export default function EmergencyPage() {
  return (
    <PageShell>
      {/* 프로토콜을 고르시는 그 탭에서 오디오 잠금을 풀어 둡니다 — 다음 화면의 첫 문장이
          아이폰에서도 검수된 목소리로 나오게 하는 자리입니다(그리는 것은 없습니다). */}
      <AudioUnlock />

      {/* 제목 22px + 초록 점 한 줄. 저장 여부는 실측한 뒤에만 단정합니다(시안 5b). */}
      <ScreenHeader title="응급 안내" subtitle={<OfflineStatus />} />

      {/* 시안에서 119 버튼은 목록이 스크롤해도 자리를 지킵니다 — 안전 규칙 §3-5(상시 노출)와 같은 뜻입니다.
          바닥에 헤어라인 1px을 답니다: 지금까지는 `bg-paper`만 있어 경계가 없었고, 목록을 내리면
          아래 글자가 캡션 8px 밑으로 아무 구분 없이 파고들었습니다(페르소나 디자이너 med).
          좌우 음수 여백 덕에 이 선은 화면 폭 끝까지 그어집니다. */}
      <div className="sticky top-0 z-30 -mx-[20px] border-b border-line bg-paper px-[20px] pt-[14px] pb-2">
        <Call119Bar />
      </div>

      {/* 목록 앞에 있던 면책 한 문단(「이 안내는 119 신고를 대체하지 않습니다…」)은 아래 각주로
          내렸습니다. 이 화면이 존재하는 이유는 「다섯 개 중에 지금 상황 하나 고르기」인데,
          그 다섯 개에 닿기 전에 경고가 네 겹 쌓여 있었고 그중 둘은 같은 말을 두 번 하고
          있었습니다(페르소나 디자이너 med). 위에 남는 것은 119 버튼 캡션 한 줄뿐이라,
          가장 중요한 경고가 오히려 더 잘 읽힙니다. 문장은 한 글자도 지우지 않고 자리만 옮겼습니다. */}

      {/* 5종 — 카드가 아니라 선으로 나눈 목록입니다. 마커 한 글자로 눈이 먼저 찾습니다. */}
      <ListRows className="mt-[14px]">
        {PROTOCOLS.map((protocol) => {
          const mark = PROTOCOL_MARK[protocol.id] ?? protocol.title.slice(0, 1);
          const summary = ACTION_SUMMARY[protocol.id];
          const listTitle = LIST_TITLE_REWRITES[protocol.id] ?? protocol.title;
          return (
            <ListRow
              key={protocol.id}
              size="lg"
              href={`/emergency/${protocol.id.toLowerCase()}`}
              ariaLabel={`${listTitle} 안내 열기`}
              leading={<MarkerSquare>{mark}</MarkerSquare>}
              title={listTitle}
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

      {/* 하단 고지 — 위에서 내려온 순서 경계(119가 먼저)를 맨 앞에 두고, 그 아래에 원래 있던
          생성 통제·술기 경계 2줄을 그대로 잇습니다. 세 줄이 다 「이 앱이 무엇이 아닌지」라
          한자리에 모이는 편이 읽힙니다.
          「누르면 전화 앱이 열립니다」는 버튼 캡션에서 여기로 옮겨 온 사실 문장입니다 —
          캡션이 두 상황을 나란히 적는 쪽으로 바뀌면서 자리를 옮겼을 뿐, 화면에서 사라지지
          않습니다(없는 안전장치를 있다고 적지 않는다는 원칙 그대로). */}
      <p className="mt-[10px] text-center text-[0.7813rem] leading-[1.6] text-ink-muted">
        이 안내는 119 신고를 대체하지 않습니다. 신고 후 구급대가 도착할 때까지 관찰·확인·119
        이양만 안내합니다. 위 빨간 버튼을 누르면 전화 앱이 열립니다.
      </p>
      <p className="mt-[6px] text-center text-[0.7813rem] leading-[1.6] text-tertiary">
        {PROTOCOL_NOTICE}
        <br />
        신체 술기는 119 상황실이 목소리로 직접 지도합니다
      </p>

      <InlineDisclaimer size="md" tone="readable" className="mt-4 mb-6" />
    </PageShell>
  );
}
