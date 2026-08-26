/**
 * 확정 전 원문 임시 보관 — src/app/report/_components/reportDraft.ts
 *
 * 가장 지키고 싶은 것은 **어느 쪽 글도 잃지 않는다**는 보증이다.
 * 이 자리는 두 라운드 연속으로 「손실의 방향만 뒤집힌」 곳이다 — 한 칸을 두 회차가 다투는 동안,
 * 가드 한 줄의 방향이 맡아 둔 지난 글을 죽일지 지금 부르는 글을 죽일지 정했다. 칸을 둘로 나눈
 * 지금은 그 선택 자체가 없어야 하고, 그것을 사람이 손으로 밟지 않고도 확인할 수 있어야 한다.
 * (아래 첫 블록이 페르소나 FE가 적어 둔 재현 절차 그대로다.)
 *
 * 브라우저 환경(jsdom)을 끌어오지 않고 최소 sessionStorage 스텁만 심는다 — storage.test.ts와 같은 방식.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CURRENT_KEY,
  PENDING_KEY,
  clearDraftSlot,
  joinDrafts,
  promoteHeldDraft,
  readDraftSlot,
  writeDraftSlot,
} from "@/app/report/_components/reportDraft";

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  get size(): number {
    return this.map.size;
  }
}

const globalRef = globalThis as unknown as { window?: unknown };

beforeEach(() => {
  globalRef.window = { sessionStorage: new MemoryStorage() };
});

afterEach(() => {
  delete globalRef.window;
});

describe("재현 절차 — 카드를 고르지 않은 채 새 보고를 부른 경우(페르소나 FE med)", () => {
  it("맡아 둔 지난 글과 지금 부른 글이 **둘 다** 남는다", () => {
    // ① 1회차: 보고를 적다가 탭바로 화면을 벗어난다 → 「지금 적는 글」 칸에 남아 있다.
    writeDraftSlot(CURRENT_KEY, "1회차 원문");

    // ② 돌아온다 — 화면이 다시 열리면 지금 칸이 「맡아 둔 글」로 올라가고 카드가 선다.
    expect(promoteHeldDraft()).toBe("1회차 원문");
    expect(readDraftSlot(CURRENT_KEY)).toBe("");

    // ③ 카드를 **고르지 않고** 마이크로 새 보고를 부른다. 예전에는 이 구간이 통째로 무보호였다.
    writeDraftSlot(CURRENT_KEY, "2회차 원문");
    expect(readDraftSlot(CURRENT_KEY)).toBe("2회차 원문");
    expect(readDraftSlot(PENDING_KEY)).toBe("1회차 원문");

    // ④ 다시 화면을 벗어났다 돌아온다 — 두 글이 시간 순으로 한 칸에 담긴다(어느 쪽도 버리지 않는다).
    expect(promoteHeldDraft()).toBe("1회차 원문\n2회차 원문");
    expect(readDraftSlot(PENDING_KEY)).toBe("1회차 원문\n2회차 원문");
    expect(readDraftSlot(CURRENT_KEY)).toBe("");
  });

  it("반대 방향도 닫혀 있다 — 카드가 떠 있는 동안 한 글자를 쳐도 맡아 둔 글은 그대로다", () => {
    writeDraftSlot(PENDING_KEY, "말로 3분 부른 보고");
    // 쓰기는 언제나 「지금 적는 글」 칸으로만 간다.
    writeDraftSlot(CURRENT_KEY, "ㄱ");
    expect(readDraftSlot(PENDING_KEY)).toBe("말로 3분 부른 보고");
  });
});

describe("승격(promoteHeldDraft)", () => {
  it("여러 번 불러도 결과가 같다 — 개발 서버의 StrictMode 이중 실행", () => {
    writeDraftSlot(CURRENT_KEY, "적던 글");
    const first = promoteHeldDraft();
    const second = promoteHeldDraft();
    expect(second).toBe(first);
    expect(readDraftSlot(PENDING_KEY)).toBe("적던 글");
    expect(readDraftSlot(CURRENT_KEY)).toBe("");
  });

  it("두 칸이 다 비어 있으면 빈 문자열이고 칸도 남기지 않는다", () => {
    expect(promoteHeldDraft()).toBe("");
    expect(readDraftSlot(PENDING_KEY)).toBe("");
    expect(readDraftSlot(CURRENT_KEY)).toBe("");
  });

  it("공백뿐인 글은 맡아 두지 않는다 — 카드가 빈 글을 내밀지 않게", () => {
    writeDraftSlot(CURRENT_KEY, "   \n  ");
    expect(promoteHeldDraft()).toBe("");
    expect(readDraftSlot(PENDING_KEY)).toBe("");
  });
});

describe("카드의 두 갈래", () => {
  it("「새로 적기」는 맡아 둔 글만 지우고, 그동안 치신 글은 남긴다", () => {
    writeDraftSlot(PENDING_KEY, "지난 글");
    writeDraftSlot(CURRENT_KEY, "카드가 떠 있는 동안 친 글");

    clearDraftSlot(PENDING_KEY); // 「새로 적기」가 하는 일 전부

    expect(readDraftSlot(PENDING_KEY)).toBe("");
    expect(readDraftSlot(CURRENT_KEY)).toBe("카드가 떠 있는 동안 친 글");
  });

  it("「이어서 적기」는 맡아 둔 글 뒤에 지금 글을 잇는다", () => {
    expect(joinDrafts("지난 글", "지금 글")).toBe("지난 글\n지금 글");
  });

  it("확정하면 두 칸이 함께 사라진다", () => {
    writeDraftSlot(PENDING_KEY, "지난 글");
    writeDraftSlot(CURRENT_KEY, "확정한 글");

    clearDraftSlot(CURRENT_KEY);
    clearDraftSlot(PENDING_KEY);

    expect(readDraftSlot(CURRENT_KEY)).toBe("");
    expect(readDraftSlot(PENDING_KEY)).toBe("");
  });
});

describe("이음 규칙(joinDrafts)", () => {
  it("한쪽이 공백뿐이면 빈 줄을 남기지 않는다", () => {
    /* 예전 규칙(`text.length > 0`)은 스페이스 하나에도 「글이 있다」로 읽어,
       맡아 둔 글 뒤에 빈 줄과 공백을 붙인 채 가리기 단계로 넘겼다. */
    expect(joinDrafts("맡아 둔 글", "   \n ")).toBe("맡아 둔 글");
    expect(joinDrafts("  ", "지금 글")).toBe("지금 글");
    expect(joinDrafts("", "")).toBe("");
  });

  it("양쪽 끝의 공백만 다듬고, 글 안의 줄바꿈은 그대로 둔다", () => {
    expect(joinDrafts("  앞줄\n뒷줄  ", "  다음  ")).toBe("앞줄\n뒷줄\n다음");
  });
});

describe("칸 이름", () => {
  it("지금 적는 글은 옛 이름을 그대로 쓴다 — 이미 열려 있던 탭의 글이 그대로 승격되게", () => {
    /* 이름을 바꾸면 배포 순간 열려 있던 탭의 원문이 어느 칸에도 안 잡힌다.
       그 칸의 뜻은 처음부터 「지금 적는 글」이었으므로 이름을 유지한다. */
    expect(CURRENT_KEY).toBe("chimchak.report.draft.v1");
    expect(PENDING_KEY).not.toBe(CURRENT_KEY);
  });
});

describe("저장소가 막힌 브라우저", () => {
  it("읽기·쓰기·지우기 어느 것도 화면을 죽이지 않는다", () => {
    globalRef.window = {
      get sessionStorage(): never {
        throw new Error("사생활 보호 모드");
      },
    };
    expect(() => writeDraftSlot(CURRENT_KEY, "글")).not.toThrow();
    expect(readDraftSlot(CURRENT_KEY)).toBe("");
    expect(() => clearDraftSlot(CURRENT_KEY)).not.toThrow();
    expect(promoteHeldDraft()).toBe("");
  });

  it("서버 렌더링 중에는 조용히 빈 값으로 동작한다", () => {
    delete globalRef.window;
    expect(readDraftSlot(CURRENT_KEY)).toBe("");
    expect(() => writeDraftSlot(CURRENT_KEY, "글")).not.toThrow();
    expect(promoteHeldDraft()).toBe("");
  });
});
