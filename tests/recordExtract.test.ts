/**
 * 기록 코칭 엔진 회귀 검사 — src/engine/record.ts
 *
 * **이 모듈은 1,385건 회귀망에서 통째로 비어 있었습니다**(15차 감사 critic high).
 * 11개 export 중 테스트에서 이름이 언급되는 것이 0건이었고 간접 커버리지도 없었습니다.
 * (tests/reportDraft.test.ts는 이름이 비슷할 뿐 sessionStorage 슬롯 관리 모듈입니다.)
 *
 * 그 사이 실제로 나 있던 결함이 「N시간」을 시각으로 읽는 것이었습니다 —
 * "1시간 전부터 불안해하셨습니다"가 시각 칸에 「1시」로 들어갔고, 칸이 **채워졌으므로**
 * missing이 비어 위저드가 그 칸을 되묻지 못했습니다. 급여제공기록지 초안에 **없던 시각을
 * 적어 넣는** 자리라 F3 기록 코칭 시연에서 그대로 노출되는 결함이었습니다.
 */

import { describe, expect, it } from "vitest";
import {
  RECORD_SLOT_LABELS,
  extractDraft,
  extractTime,
  extractWho,
  formatDraft,
  isDraftComplete,
  recomputeMissing,
  slotFillRatio,
  splitSentences,
} from "@/engine/record";

describe("extractTime — 시각과 기간을 가른다", () => {
  const 시각: [string, string][] = [
    ["오후 4시 40분쯤 있었던 일입니다", "오후 4시 40분쯤"],
    ["16시 40분 현관에서", "16시 40분"],
    ["새벽 2시 10분에 복도에서", "새벽 2시 10분"],
    ["14:20에 있었던 일입니다", "14:20"],
    ["오늘 오전에 있었던 일입니다", "오늘 오전"],
  ];

  for (const [text, expected] of 시각) {
    it(`시각을 뽑는다 · ${text}`, () => {
      expect(extractTime(text)).toBe(expected);
    });
  }

  /** 「시」 뒤의 「간」은 시각이 아니라 기간입니다 — 시계에 없는 시각까지 만들던 자리입니다. */
  const 기간 = [
    "1시간 전부터 불안해하셨습니다",
    "3시간 동안 곁에서 지켜봤습니다",
    "48시간 동안 관찰이 필요합니다",
    "12시간 근무 중입니다",
    "30분간 곁에 있었습니다",
  ];

  for (const text of 기간) {
    it(`기간은 시각으로 읽지 않는다 · ${text}`, () => {
      expect(extractTime(text), text).toBe("");
    });
  }

  it("기간과 시각이 함께 있으면 시각만 뽑는다", () => {
    expect(extractTime("16시 40분부터 2시간 동안 곁에 있었습니다")).toBe("16시 40분");
  });

  it("한글 수사 시각은 이 모듈이 읽지 못한다 (문서화된 한계 — 판정 경로의 변환을 지나지 않는다)", () => {
    expect(extractTime("네 시 사십 분쯤이었습니다")).toBe("");
  });

  it("빈 입력·시간어 없음은 빈 문자열이다", () => {
    expect(extractTime("")).toBe("");
    expect(extractTime("어르신이 현관에 서 계셨습니다")).toBe("");
  });
});

describe("extractDraft — 빈 칸을 빈 칸이라고 말한다", () => {
  it("기간을 시각으로 채우지 않고 그 칸을 되묻는다", () => {
    const draft = extractDraft(
      "어르신이 1시간 전부터 불안해하셨습니다. 제가 곁에서 달래 드렸습니다. 지금은 안정되셨습니다.",
    );
    expect(draft.time).toBe("");
    expect(draft.missing).toContain(RECORD_SLOT_LABELS.time);
    expect(isDraftComplete(draft)).toBe(false);
  });

  it("5요소가 다 든 보고는 빈 칸이 없다", () => {
    const draft = extractDraft(
      "오후 4시 40분에 어르신이 현관에서 나가려 하셨습니다. 거실 불을 켜 드리고 화장실로 안내했습니다. 지금은 진정되어 소파에 앉아 계십니다.",
    );
    expect(draft.time).toBe("오후 4시 40분");
    expect(draft.who).toBe("어르신");
    expect(draft.missing).toEqual([]);
    expect(isDraftComplete(draft)).toBe(true);
    expect(slotFillRatio(draft)).toBe(1);
  });

  it("빈 입력은 다섯 칸을 모두 되묻는다", () => {
    const draft = extractDraft("");
    expect(draft.missing).toHaveLength(5);
    expect(slotFillRatio(draft)).toBe(0);
  });

  it("가명처리된 대상자 토큰도 읽는다", () => {
    expect(extractWho("[대상자]께서 현관 앞에 서 계셨습니다")).toBe("[대상자]");
    expect(extractWho("특이사항 없음")).toBe("");
  });
});

describe("보조 함수", () => {
  it("마침표 없이 말한 보고도 문장으로 끊는다", () => {
    expect(splitSentences("16시 40분에 어르신이 나가려 하셨습니다 거실 불을 켜 드렸습니다")).toEqual([
      "16시 40분에 어르신이 나가려 하셨습니다",
      "거실 불을 켜 드렸습니다",
    ]);
  });

  it("recomputeMissing은 사람이 고친 값을 그대로 다시 센다", () => {
    const draft = recomputeMissing({ time: "16시 40분", who: "", what: "", action: "", status: "", missing: [] });
    expect(draft.missing).toEqual([
      RECORD_SLOT_LABELS.who,
      RECORD_SLOT_LABELS.what,
      RECORD_SLOT_LABELS.action,
      RECORD_SLOT_LABELS.status,
    ]);
  });

  it("빈 칸은 초안 문자열에도 빈 칸으로 남는다", () => {
    const draft = extractDraft("어르신이 1시간 전부터 불안해하셨습니다.");
    expect(formatDraft(draft)).toContain(`${RECORD_SLOT_LABELS.time}: (비어 있음)`);
  });
});
