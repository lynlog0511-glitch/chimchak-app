/**
 * 판정 골든 코퍼스 게이트 (2026-08-27 신설).
 *
 * ▸ 무엇을 지키는가
 *   전 시나리오 주요 CUE의 **대표 발화**를 실제 분류기에 넣어 나온 분기 id를 fixture에 굳혀
 *   둡니다. 판정선이 한 칸이라도 움직이면 이 검사가 diff로 그것을 보여 줍니다.
 *
 * ▸ 왜 이 그물이 필요한가
 *   라운드마다 같은 사고가 반복됐습니다 — 표지 하나를 고치면 **의도한 문장 말고 다른 문장이
 *   조용히 옮겨 갔습니다**. 6차가 요소 판정 앞에 한 겹을 세우자 낡은 표지에 새 힘이 실려
 *   「나중에」·「밤새」가 5요소 보고를 강등했고(7차 high 둘), 그전 라운드에는 예외어를 좁히자
 *   옳게 말한 문장이 ⚑CF로 섰습니다. 매번 사람이 눈으로 찾아냈고, 매번 다음 라운드에
 *   다른 자리에서 다시 났습니다. 개별 회귀 단언(judgmentBatch4·5·6)은 **이미 아는 자리**만
 *   지킵니다. 이 파일이 지키는 것은 **아직 모르는 자리**입니다.
 *
 * ▸ 갱신 절차 (중요)
 *   판정선을 **의도해서** 움직였을 때만 `node scripts/regen-golden.mjs`를 돌려 fixture를 다시
 *   만들고, 나온 diff를 사람이 한 줄씩 보고 승인합니다. 검사가 깨졌는데 왜 그 문장이 옮겨
 *   갔는지 설명할 수 없다면 그것이 회귀입니다 — 재생성하지 말고 코드를 고치십시오.
 *   fixture에서 손으로 적는 자리는 발화(utterance)와 계열(family)이고, branch·source는
 *   스크립트가 채웁니다.
 *
 * ▸ 코퍼스를 고르는 기준
 *   시나리오당 15±5문장. 계열(모범·부분·감점·⚑CF·미분류)을 고루 담되, **기존 경계 케이스와
 *   batch 검사에 이미 든 문장은 피하고** 현장에서 실제로 나올 말씨를 씁니다.
 *   7차 회귀 두 건의 실패 문장(A01-14 「…보호자께는 나중에 말씀드리겠습니다」·
 *   A02-13 「…밤새 곁에서 함께 걸었습니다」)과 R1-e 과열 문장(A02-15)은 반드시 포함합니다.
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Scenario } from "@/types";
import { SCENARIOS } from "@/data/scenarios";
import { classifyInput } from "@/engine/classify";
import { checkAdvisory, checkCritical } from "@/engine/rules";

export const GOLDEN_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "judgmentGolden.json",
);

interface GoldenCase {
  id: string;
  scenario: string;
  turn: string;
  cue: string;
  family: string;
  utterance: string;
  branch: string;
  source: string;
  rule: string;
  advisory: string;
}

interface GoldenFile {
  purpose: string;
  howToUpdate: string;
  fields: Record<string, string>;
  cases: GoldenCase[];
}

const golden = JSON.parse(readFileSync(GOLDEN_PATH, "utf8")) as GoldenFile;

/** 갱신 모드 — scripts/regen-golden.mjs가 이 환경 변수를 켜고 부릅니다. */
const UPDATE = process.env.GOLDEN_UPDATE === "1";

function scenarioOf(id: string): Scenario {
  const found = SCENARIOS.find((s) => s.id === id);
  if (!found) throw new Error(`골든 코퍼스: 시나리오 ${id}를 찾지 못했습니다`);
  return found;
}

/**
 * 판정선 **둘 다** 굳힙니다 — 분기 판정(classify)과 규칙 사전(rules).
 *
 * 자유 발화는 세션에서 규칙 사전을 **먼저** 지나므로(engine/session.ts), 분기 id만 굳혀 두면
 * 실제 화면 판정의 절반만 지키는 그물이 됩니다: "팔을 잡아 끌고 가겠습니다"는 분기로는
 * 미분류지만 화면에서는 ⚑CF로 멈춰 섭니다. 예외어를 좁히고 넓히는 손질이 라운드마다 있었던
 * 자리도 이쪽이라, 같은 파일에서 함께 봅니다.
 */
function judge(entry: GoldenCase): { branch: string; source: string; rule: string; advisory: string } {
  const scenario = scenarioOf(entry.scenario);
  const turn = scenario.turns.find((t) => t.id === entry.turn);
  const cue = turn?.cue;
  if (!cue) throw new Error(`골든 코퍼스: ${entry.id} — ${entry.scenario}/${entry.turn}에 CUE가 없습니다`);
  if (cue.id !== entry.cue) {
    throw new Error(`골든 코퍼스: ${entry.id} — CUE id가 ${entry.cue}에서 ${cue.id}로 바뀌었습니다`);
  }
  const result = classifyInput(cue, { utterance: entry.utterance });
  const opts = {
    // 세션이 넘기는 것과 **같은 문맥**을 넘깁니다 — 시나리오 id가 빠지면 보고 자리의
    // 과거 완료형 면제(rules.ts pastReportCues)가 그물 밖에 남습니다.
    scenarioType: scenario.type,
    scenarioId: scenario.id,
    cueId: cue.id,
    appliedRubric: scenario.appliedRubric,
  };
  const critical = checkCritical(entry.utterance, opts);
  const advisories = checkAdvisory(entry.utterance, opts).map((finding) => finding.ruleId);
  return {
    branch: result.branch.id,
    source: result.source,
    rule: critical.cf ? (critical.ruleId ?? "?") : "-",
    advisory: advisories.length > 0 ? advisories.join(",") : "-",
  };
}

/* ── 코퍼스 자체의 건강 검진 ────────────────────────────
   그물이 조용히 성글어지는 것을 막습니다 — 문장이 빠지거나 한 시나리오만 두꺼워지는 일. */

describe("골든 코퍼스 — 그물이 성글어지지 않는다", () => {
  it("전 시나리오가 15±5문장으로 덮여 있다", () => {
    for (const scenario of SCENARIOS) {
      const count = golden.cases.filter((c) => c.scenario === scenario.id).length;
      expect(count, scenario.id).toBeGreaterThanOrEqual(10);
      expect(count, scenario.id).toBeLessThanOrEqual(20);
    }
  });

  it("id·발화가 겹치지 않는다", () => {
    const ids = golden.cases.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    const said = golden.cases.map((c) => `${c.scenario}/${c.turn}/${c.utterance}`);
    expect(new Set(said).size).toBe(said.length);
  });

  it("갱신 절차가 파일 머리에 적혀 있다", () => {
    expect(golden.purpose.length).toBeGreaterThan(0);
    expect(golden.howToUpdate).toContain("regen-golden");
  });

  it("7차 회귀 두 건의 실패 문장이 들어 있다", () => {
    const all = golden.cases.map((c) => c.utterance).join("\n");
    expect(all).toContain("보호자께는 나중에 말씀드리겠습니다");
    expect(all).toContain("밤새 곁에서 함께 걸었습니다");
    expect(all).toContain("당직 간호팀장님께 알렸습니다");
  });
});

/* ── 스냅샷 대조 ───────────────────────────────────────
   한 건씩 세우지 않고 **한 덩어리로** 비교합니다 — 표지 한 줄이 여러 문장을 함께 옮겼을 때
   실패 메시지에 그 전부가 한 번에 보여야, 「의도한 이동인가」를 사람이 한눈에 판단합니다. */

describe("골든 코퍼스 — 판정선 스냅샷", () => {
  it("대표 발화의 분기 판정이 fixture와 같다", () => {
    const actual = golden.cases.map((entry) => {
      const { branch, source, rule, advisory } = judge(entry);
      return `${entry.id} ${entry.scenario}/${entry.cue} [${entry.family}] → ${branch} (${source}) 규칙 ${rule} 코칭 ${advisory} :: ${entry.utterance}`;
    });

    if (UPDATE) {
      const updated: GoldenFile = {
        ...golden,
        cases: golden.cases.map((entry) => ({ ...entry, ...judge(entry) })),
      };
      writeFileSync(GOLDEN_PATH, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
      return;
    }

    const expected = golden.cases.map(
      (entry) =>
        `${entry.id} ${entry.scenario}/${entry.cue} [${entry.family}] → ${entry.branch} (${entry.source}) 규칙 ${entry.rule} 코칭 ${entry.advisory} :: ${entry.utterance}`,
    );
    expect(actual).toEqual(expected);
  });

  it("스냅샷의 분기 id가 실제로 그 CUE에 있다 (고아 방지)", () => {
    if (UPDATE) return;
    for (const entry of golden.cases) {
      const scenario = scenarioOf(entry.scenario);
      const cue = scenario.turns.find((t) => t.id === entry.turn)?.cue;
      expect(cue?.branches.map((b) => b.id), entry.id).toContain(entry.branch);
    }
  });
});
