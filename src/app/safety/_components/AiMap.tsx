"use client";

import { useEffect, useState } from "react";
import { cx } from "@/components/utils";
import { getSettings, isOnlineCoachingActive, subscribeSettings } from "@/lib/settings";

/**
 * AI가 쓰이는 자리 — **다섯 자리를 한 장에 폅니다.**
 *
 * 이 화면의 다른 절은 「무엇을 막았는가」를 말합니다. 이 절만 방향이 반대입니다 —
 * 「AI가 실제로 어디에 있는가」를 자리마다 이름을 붙여 적습니다. 다섯 자리 가운데
 * 지금 이 빌드에서 문장을 만드는 자리는 **한 곳도 없고**, 온라인 코칭을 켜면 딱 한 자리
 * (코칭)가 열립니다. 그 한 자리를 흐리지 않고 가운데 칸에 그대로 적는 것이 이 표의 일입니다.
 *
 * 화면 곳곳의 「생성 호출 0건」은 **기본 빌드(온라인 코칭 꺼짐) 기준**입니다. 이 표는 그
 * 기준을 숨기지 않고 맨 아래에 적어 두고, 켠 경우 무엇이 달라지는지를 같은 표 안에서 밝힙니다.
 * 지금 이 기기의 상태는 설정을 그대로 읽어 첫 줄에 표시합니다 — 표와 실제가 어긋날 자리를
 * 없애려는 것입니다.
 *
 * 첫 줄이 말하는 것은 **사용자가 무엇을 허락했는가**입니다. 상류 연결이 서버에 준비돼 있는지는
 * 브라우저가 알 방법이 없고(주소도 모델 이름도 키도 서버에만 있습니다), 준비돼 있지 않으면
 * 켜 두어도 아무것도 나가지 않습니다 — 그 사실도 같은 줄에 적습니다.
 */

export interface AiMapProps {
  className?: string;
}

interface MapRow {
  /** 자리 이름 */
  place: string;
  /** 지금 이 빌드 (온라인 코칭 꺼짐) */
  now: string;
  /** 온라인 코칭을 켰을 때 */
  online: string;
  /** 파일럿 로드맵 */
  next: string;
  /** 온라인 코칭이 이 자리를 바꾸는가 — 가운데 칸의 무게를 갈라 줍니다 */
  changes?: boolean;
}

const COLUMNS = ["지금 이 빌드", "온라인 코칭을 켰을 때", "파일럿 로드맵"] as const;

const ROWS: readonly MapRow[] = [
  {
    place: "음성 인식 — 말을 글자로",
    now: "브라우저에 들어 있는 기능을 그대로 씁니다. 기기·브라우저에 따라 제조사 서버를 경유할 수 있습니다. 타이핑·버튼으로만 하시면 네트워크를 전혀 쓰지 않습니다.",
    online: "달라지지 않습니다.",
    next: "현장 소음과 사투리가 섞인 실제 말소리에서 얼마나 알아듣는지 잽니다.",
  },
  {
    place: "음성 합성 — 글자를 소리로",
    now: "미리 합성해 동봉한 음성 파일과 브라우저 낭독 기능을 씁니다. 문장을 새로 만들지 않습니다.",
    online: "달라지지 않습니다.",
    next: "동봉 음성의 적용 범위를 넓혀, 낭독이 막히는 기기를 줄입니다.",
  },
  {
    place: "어르신 대사",
    now: "검수된 시나리오 문장을 그대로 재생합니다. 지어내는 문장이 없습니다.",
    online: "달라지지 않습니다 — 온라인 코칭은 대사를 만들지 않습니다.",
    next: "대본 범위 안에서의 변주를 검토합니다. 대본 이탈을 잡아내는 장치를 먼저 붙인 뒤의 일입니다.",
  },
  {
    place: "판정 — 충족 · 코칭 · 즉시 중단",
    now: "규칙 사전·시나리오 규칙표·시간 규칙이 판정합니다. 같은 입력에는 같은 판정이 나옵니다.",
    online: "달라지지 않습니다. 온라인 코칭은 분기도 게이지도 기록도 건드리지 못합니다 — 계약에 분기 자체가 없습니다.",
    next: "채점표 30항목 가운데 AI로 배정한 항목을 근거 가드 통과 구간부터 하나씩 엽니다.",
  },
  {
    place: "코칭 문장",
    now: "갈래마다 미리 검수해 둔 문장을 그대로 보여 드립니다. 문장을 만드는 호출이 없습니다.",
    online:
      "어느 판정 신호에도 걸리지 않아 미분류로 넘어간 턴에 한해, 가명처리를 지난 발화가 침착 서버를 거쳐 경량 LLM에 닿고 1~2문장이 돌아옵니다. 브라우저가 접속하는 곳은 침착 서버 한 곳뿐이고, 제공사 주소와 키는 서버에만 있습니다. 돌아온 문장은 기기 안에서 형식·근거 목록·표현·길이 네 단을 지나야 하고, 지나지 못하면 화면에 나가지 못한 채 「공식 지침에서 근거를 찾지 못했습니다…」로 바뀝니다.",
    next: "덧붙인 문장이 실제로 도움이 되었는지, 잘못 짚은 비율은 얼마인지를 현직과 함께 셉니다.",
    changes: true,
  },
];

export function AiMap({ className }: AiMapProps) {
  /* 서버에서는 설정을 알 수 없으므로 「꺼짐」으로 그린 뒤, 마운트한 다음 실제 값으로 바꿉니다.
     기본값이 꺼짐이라 서버 렌더 결과와 첫 클라이언트 렌더가 어긋나지 않습니다. */
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(isOnlineCoachingActive(getSettings()));
    return subscribeSettings((settings) => setActive(isOnlineCoachingActive(settings)));
  }, []);

  return (
    <div className={className}>
      {/* 지금 이 기기의 상태 — 표보다 먼저 옵니다. 표가 말하는 두 기준 가운데
          어느 쪽에 지금 서 있는지부터 알려 드리는 편이 정직합니다. */}
      <p
        className={cx(
          "rounded-card px-4 py-3 text-[0.9375rem] leading-[1.6]",
          active ? "bg-warn-soft text-warn-ink" : "bg-paper-2 text-ink",
        )}
      >
        <span className="font-extrabold">
          지금 이 기기 · {active ? "온라인 코칭 켜짐" : "온라인 코칭 꺼짐"}
        </span>
        {active
          ? " — 미분류로 넘어간 턴의 발화가 가명처리를 거쳐 침착 서버로 전송됩니다. 아래 가운데 칸이 지금 참입니다. 서버에 연결이 준비돼 있지 않으면 아무것도 나가지 않고 검수 코칭만 남습니다."
          : " — 기기 밖으로 나가는 요청이 없습니다. 아래 왼쪽 칸이 지금 참입니다."}
      </p>

      <p className="sr-only">AI가 쓰이는 다섯 자리와 각 자리의 현재·조건부·계획</p>
      <ul className="chim-hairline mt-4 border-y border-line">
        {ROWS.map((row) => (
          <li key={row.place} className="py-4">
            <p className="text-[1.0625rem] leading-[1.4] font-extrabold text-ink">{row.place}</p>
            <dl className="mt-2">
              {[row.now, row.online, row.next].map((cell, index) => (
                <div key={COLUMNS[index]} className={index > 0 ? "mt-3" : undefined}>
                  <dt
                    className={cx(
                      "text-[0.7813rem] leading-[1.4] font-bold tracking-[0.04em]",
                      index === 1 && row.changes ? "text-warn-ink" : "text-ink-muted",
                    )}
                  >
                    {COLUMNS[index]}
                  </dt>
                  <dd className="mt-1 text-[0.9375rem] leading-[1.6] text-ink">{cell}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>

      {/* 화면 곳곳의 단언과 이 표가 어긋나 보이지 않도록, 기준을 여기서 못 박습니다. */}
      <p className="mt-4 text-[0.9375rem] leading-[1.65] text-ink-soft">
        이 화면과 훈련 화면이 적어 둔 「생성 호출 0건」은 <b className="font-bold text-ink">기본
        빌드 기준</b>입니다. 온라인 코칭은 기본이 꺼짐이고, 켜는 것도 끄는 것도 사용자 손에
        있습니다. 켜신 경우에 무엇이 달라지는지는 위 가운데 칸이 그대로 밝히고 있습니다 — 달라지는
        자리는 다섯 중 하나(코칭 문장)뿐입니다.
      </p>
      <p className="mt-2 text-[0.7813rem] leading-[1.6] text-ink-faint">
        켠 상태에서 나가는 발화는 가명처리를 먼저 지나고, 침착 서버를 거쳐 나갑니다 — 이 기기에는
        어떤 키도 저장하지 않습니다. 어떤 경우에도 판정·게이지·기록은 기기 안의 규칙이 내린 값
        그대로입니다.
      </p>
    </div>
  );
}

export default AiMap;
