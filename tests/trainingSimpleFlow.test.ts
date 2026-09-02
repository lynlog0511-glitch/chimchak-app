import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function source(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

describe("큰 글씨용 상황 연습 핵심 흐름", () => {
  it("목록에서 시작을 약속하지 않고 연습 내용을 먼저 보여 준다", () => {
    expect(source("src/app/train/page.tsx")).toContain("연습 내용 보기");
  });

  it("브리핑은 두 줄 상황과 두 가지 연습 포인트를 보여 주고 실제 cue 수를 쓴다", () => {
    const briefing = source("src/app/train/_components/BriefingPanel.tsx");

    expect(briefing).toContain("scenario.situationLines.map");
    expect(briefing).toContain("scenario.practicePoints.map");
    expect(briefing).toContain("scenarioPracticeStepCount(scenario)");
    expect(briefing).toContain("약 {scenario.durationMin}분 · {steps}단계");
  });

  it("저장된 진행을 지우기 전에 한 번 더 확인한다", () => {
    const briefing = source("src/app/train/_components/BriefingPanel.tsx");

    expect(briefing).toContain("처음부터 할까요?");
    expect(briefing).toContain("저장된 진행이 지워집니다.");
    expect(briefing.match(/onStartOver\(\)/g)).toHaveLength(1);
  });

  it("안전 중단 화면에서 추천 문장을 한 번에 제출할 수 있다", () => {
    const interrupt = source("src/app/train/_components/CriticalInterrupt.tsx");

    expect(interrupt).toContain("onRetry: () => void");
    expect(interrupt).toContain("onRecommendedReply: (option: CriticalReplyOption) => void");
    expect(interrupt).toContain("이 문장으로 다시 답하기");
    expect(interrupt).toContain("onRecommendedReply(exit.option)");
  });

  it("종료 화면은 핵심 피드백 두 문장만 먼저 보여 준다", () => {
    const ending = source("src/app/train/_components/EndingPanel.tsx");

    expect(ending).toContain("잘한 점");
    expect(ending).toContain("다음에는");
    expect(ending).toContain("{mainGood}");
    expect(ending).toContain("{mainNext}");
    expect(ending).toContain("자세한 결과 보기");
  });
});
