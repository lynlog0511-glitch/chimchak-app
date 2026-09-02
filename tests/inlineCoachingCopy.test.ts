import { describe, expect, it } from "vitest";
import { splitCoachingMessage } from "@/app/train/_components/coachingCopy";

describe("최신 코칭 한 문장", () => {
  it("첫 문장만 기본 화면에 두고 나머지를 상세 설명으로 보낸다", () => {
    expect(
      splitCoachingMessage("마음을 먼저 알아드렸습니다. 이제 선택지를 하나만 제안해 보세요."),
    ).toEqual({
      lead: "마음을 먼저 알아드렸습니다.",
      detail: "이제 선택지를 하나만 제안해 보세요.",
    });
  });

  it("한 문장은 그대로 유지한다", () => {
    expect(splitCoachingMessage("좋은 대응입니다")).toEqual({
      lead: "좋은 대응입니다",
      detail: "",
    });
  });
});
