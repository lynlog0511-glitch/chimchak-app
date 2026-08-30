/**
 * 항목별 펼침 — **판정·저장 불변, 표시 계층 전용**입니다.
 * (2026-08-30 현장 인터뷰 제언 반영 · 첫 현직 감수 전 —
 *  「코칭 피드백이 지금 세 가지인데 더 세부적으로 가야 한다」는 제언에 대한 답입니다.)
 *
 * 세부화를 **새 판정이나 새 문장으로 만들지 않는 것**이 이 파일의 전제입니다.
 * 엔진은 이미 턴마다 어느 루브릭 항목이 걸렸는지를 이벤트에 적어 두는데(`feedback.rubricHits`),
 * 화면은 그 턴의 문장 한 줄만 폈습니다. 그래서 같은 문장이 「잘한 것 / 다시 볼 것」 두 목록에
 * 서는 동안, 그 문장이 **무엇을 보고 나온 판정인지**는 접힘 안에도 없었습니다.
 * 여기서 하는 일은 이미 있는 그 표시를 항목으로 다시 묶는 것뿐입니다 — 세는 것도, 재는 것도,
 * 문장을 짓는 것도 없습니다(결정론 · 부작용 0 · 시계를 보지 않습니다).
 *
 * 지키는 선 셋
 *  · **점수는 어떤 형태로도 나가지 않습니다.** 4점 척도는 내부 전용이고(브리프 §3-1),
 *    이 파일이 바깥으로 내보내는 것은 `rubric.ts`의 변환 규칙(3점 이상 충족 / 2점 이하 코칭)을
 *    지난 **낱말 두 개**뿐입니다. 1점과 2점은 여기서 구별되지 않습니다 — 구별되면 그 순간
 *    「몇 점인지」가 화면에 실립니다.
 *  · **저장 포맷(SessionRecord)은 건드리지 않습니다.** 세션 events에서 그때그때 셈하므로,
 *    이미 기기에 쌓인 기록의 모양이 바뀌지 않습니다.
 *  · **즉시 중단(⚑CF) 턴은 담지 않습니다.** 그 자리는 「다시 볼 장면」 카드가 그때의 규칙·근거·
 *    대안을 통째로 다시 펴는 전용 자리이고(EndingPanel), 판정 낱말도 「즉시 중단」이라
 *    충족/코칭 두 단계에 들어오지 않습니다. 엔진이 ⚑CF 점수를 `scores`에 굳히지 않는 것과
 *    같은 이유이기도 합니다 — 재시도하면 되돌아오는 판정입니다.
 *
 * @example
 * buildRubricBreakdown(session.events);
 * // [{ itemId: "RE-02", name: "현실 직면 강요…", areaLabel: "대응 및 문제 해결력",
 * //    statuses: ["충족", "코칭"], messages: ["…알아주셨습니다.", "…먼저 여쭤 주세요."] }]
 */

import { AREA_LABELS, getRubricItem, isMet } from "@/data/rubric";
import type { SessionEvent } from "@/types";

/**
 * 화면에 나가는 판정 낱말 — 표준 표기(`components/icons`의 STATUS_MARK_LABEL)와 같은 두 낱말입니다.
 * 타입을 낱말로 못 박아 두어, 여기에 셋째 단계(점수·등급·순위)가 끼어들 자리를 아예 두지 않습니다.
 */
export type RubricStatusWord = "충족" | "코칭";

/** 항목 한 줄. 화면은 이 다섯 칸만 읽고, 그 밖의 것은 알지 못합니다. */
export interface RubricBreakdownRow {
  /** 루브릭 항목 id — 목록 key와 검사에만 씁니다(화면에 내부 id를 세우지 않습니다). */
  itemId: string;
  /**
   * 항목 이름 — `rubric.ts`의 행동지표 문장 그대로입니다.
   * 항목에는 짧은 이름이 따로 없고, 사람이 읽어 자기 행동과 맞춰 볼 수 있는 말은 이 문장뿐입니다
   * (턴 판정 접힘(InlineCoaching)이 「기준」 줄에 쓰는 것과 같은 값입니다).
   */
  name: string;
  /** 축 라벨 — 4대 영역 한글 표기(SA·CO·RE·CL). 가중치·점수는 함께 나가지 않습니다. */
  areaLabel: string;
  /**
   * 이 항목에 붙었던 판정 낱말. 한 회차에서 같은 항목이 충족·코칭 양쪽에 걸릴 수 있어
   * **한 행에 두 낱말이 함께 섭니다** — 앞선 자리에서 해내신 것을 뒤의 한 번이 지우지 않게 하려는 것입니다.
   * 순서는 걸린 순서 그대로이고, 같은 낱말이 두 번 들어가지는 않습니다.
   */
  statuses: RubricStatusWord[];
  /** 그 항목이 걸린 턴에 드린 검수 문구들 — 데이터의 문장 그대로이고, 중복은 지웁니다. */
  messages: string[];
}

/**
 * 세션 events를 루브릭 항목별 행으로 폅니다.
 *
 * 행 순서는 **이번 회차에서 처음 걸린 순서**입니다. 루브릭 30항목의 원래 차례로 세우면
 * 지나오지도 않은 자리의 번호가 화면에 남아 「빠진 항목」처럼 읽힙니다 — 그래서 이번 회차가
 * 실제로 지난 항목만, 지난 순서대로 둡니다.
 *
 * 루브릭 표에 없는 항목 id는 담지 않습니다. 이름 없이 id만 남으면 화면에 내부 id가 서기 때문입니다.
 *
 * @example
 * buildRubricBreakdown([]); // []
 */
export function buildRubricBreakdown(events: readonly SessionEvent[]): RubricBreakdownRow[] {
  const rows: RubricBreakdownRow[] = [];
  const byItem = new Map<string, RubricBreakdownRow>();

  for (const event of events) {
    const feedback = event.feedback;
    if (!feedback || feedback.criticalFail) continue;
    const message = feedback.message.trim();

    for (const hit of feedback.rubricHits) {
      const item = getRubricItem(hit.itemId);
      if (!item) continue;

      let row = byItem.get(item.id);
      if (!row) {
        row = {
          itemId: item.id,
          name: item.indicator,
          areaLabel: AREA_LABELS[item.area],
          statuses: [],
          messages: [],
        };
        byItem.set(item.id, row);
        rows.push(row);
      }

      // 점수가 낱말로 바뀌는 자리는 여기 한 줄뿐입니다 — 숫자는 이 줄을 넘어가지 못합니다.
      const status: RubricStatusWord = isMet(hit.score) ? "충족" : "코칭";
      if (!row.statuses.includes(status)) row.statuses.push(status);
      if (message.length > 0 && !row.messages.includes(message)) row.messages.push(message);
    }
  }

  return rows;
}
