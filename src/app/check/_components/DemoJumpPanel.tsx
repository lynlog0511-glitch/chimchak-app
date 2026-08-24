import Link from "next/link";

interface JumpRow {
  href: string;
  label: string;
  /** 어느 시나리오의 어느 지점인지 — 무대에서 고르기 전에 확인하는 한 줄입니다. */
  scene: string;
  detail: string;
}

/**
 * 무대에서 바로 띄울 세 장면.
 *
 * 프리셋 자체는 이미 구현돼 있었지만(`parseDemoPreset` · sessionMachine의 `demo` 액션)
 * 앱 어디에도 링크가 없어, 무대에서 보여 드리려면 주소창에 쿼리를 손으로 쳐야 했습니다.
 * 발표자 전용 화면인 여기가 그 링크의 자리입니다.
 *
 * 문구는 실제 동작 그대로입니다 — 프리셋은 장면 **직전**까지만 재생하고 마지막 선택은
 * 발표자가 직접 고릅니다(sessionMachine의 `demoStopsBefore`).
 */
const JUMP_ROWS: readonly JumpRow[] = [
  {
    href: "/train/chk-a01?demo=cf",
    label: "즉시 중단 장면",
    scene: "현관 앞, 집에 가야 해요 · 돌발 변수 직전",
    detail:
      "허용 범위 밖 선택지가 놓인 상황까지 재생하고 멈춥니다. 그 선택지를 고르시면 화면이 멈추고 대안 세 가지가 뜹니다.",
  },
  {
    href: "/train/chk-b02?demo=l3",
    label: "응급 안내 전환",
    scene: "점심 식사 중 사레 · 119 이양 직전",
    detail:
      "완전 기도폐쇄로 바뀐 직후의 판단 지점에서 멈춥니다. 119 연결을 고르시면 화면에서 생성이 빠지고 고정 스크립트 6단계로 넘어갑니다.",
  },
  {
    href: "/train/chk-a01?demo=end",
    label: "엔딩",
    scene: "현관 앞, 집에 가야 해요 · 마지막 상황 직전",
    detail: "마지막 상황까지 재생하고 멈춥니다. 한 번 고르시면 완주 화면이 열립니다.",
  },
];

/**
 * 바로 보여 주기 — 시연 프리셋(`?demo=`) 진입점 (발표자 전용).
 *
 * 정직성: 프리셋으로 연 세션은 성장 기록에도 체크포인트에도 저장되지 않습니다
 * (TrainSession의 `demoModeRef` — 자동 재생이 만든 「잘한 것」이 실사용 이력에 섞이지
 * 않게 하려는 것이며, 이 사실을 화면에도 한 줄로 적습니다).
 */
export function DemoJumpPanel() {
  return (
    <section
      aria-labelledby="demo-jump-title"
      className="mt-[18px] rounded-[14px] bg-paper-2 px-4 py-[14px]"
    >
      <h2 id="demo-jump-title" className="text-[0.8438rem] leading-[1.45] font-extrabold text-ink">
        바로 보여 주기
      </h2>

      <p className="mt-[5px] text-[0.7813rem] leading-[1.6] text-ink-soft">
        보여 드릴 장면 직전까지 자동으로 재생하고 손을 뗍니다. 마지막 선택은 발표자가 직접
        고르시는 것이라, 판정은 무대에서 엔진이 그 자리에서 합니다.
      </p>
      {/* 위 칸과 헷갈리기 쉬운 자리입니다 — 두 도구는 서로 아무 관계가 없습니다. */}
      <p className="mt-[6px] text-[0.7813rem] leading-[1.6] text-ink-soft">
        위 「시연용 예시 기록」과는 무관합니다 — 심지 않으셔도 이 세 경로는 그대로 열립니다. 예시
        시드는 성장 기록·이수 확인서를 채우는 도구이고, 여기는 훈련 장면 자체를 여는 도구입니다.
      </p>

      <ul className="chim-hairline mt-[10px] border-y border-line">
        {JUMP_ROWS.map((row) => (
          <li key={row.href}>
            <Link
              href={row.href}
              className="-mx-1.5 flex min-h-[48px] flex-col justify-center rounded-field px-1.5 py-[10px] transition-colors duration-150 active:bg-paper-2"
            >
              <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-[0.8438rem] leading-[1.45] font-bold text-brand-700">
                  {row.label} ›
                </span>
                <span className="text-[0.6875rem] leading-[1.45] text-ink-muted">{row.scene}</span>
              </span>
              <span className="mt-[3px] text-[0.7813rem] leading-[1.6] text-ink-soft">
                {row.detail}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-[10px] text-[0.7813rem] leading-[1.6] text-ink-soft">
        이 세 경로로 연 훈련은 성장 기록에도 체크포인트에도 저장되지 않습니다 — 리허설을 몇 번
        하셔도 이 기기의 이수 회차와 진행 상태는 그대로입니다. 자동으로 지나간 구간은 대화 맨 위에
        그대로 밝혀 둡니다.
      </p>
    </section>
  );
}

export default DemoJumpPanel;
