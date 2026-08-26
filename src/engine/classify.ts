/**
 * 침착(ChimChak) 발화 분류기.
 *
 * 시나리오 데이터(CueDef)의 분기 패턴만 보고 결정론적으로 분류한다. 외부 호출 0건.
 * 나중에 경량 LLM(교체형 어댑터)을 붙이더라도 이 함수의 시그니처를 그대로 유지하고,
 * 패턴 미일치 구간만 어댑터에 넘기면 된다.
 *
 * 판정 순서
 * 1) 버튼으로 분기를 직접 지정했으면(branchId) 그 분기가 최우선 — 데이터의 판단을 그대로 따른다.
 * 2) ⚑CF 플래그가 붙은 분기의 패턴을 먼저 검사한다 (안전 판정 우선).
 * 2.5) CUE에 elementJudge가 선언돼 있으면(보고 CUE) **요소 개수**로 먼저 가른다.
 *      한 조각이 걸렸는지가 아니라 몇 가지가 들어 있는지로 판정한다. 0개면 채택하지 않고 3)으로 넘긴다.
 *      다만 채택 **직전에** 사다리 밖 갈래를 한 번 대조한다(아래 「사다리 밖 선행 대조」).
 * 3) 나머지 분기를 부분 문자열로 대조하고(공백 제거·소문자화), **걸린 분기를 모두 모아**
 *    심각도가 높은 쪽을 채택한다(아래 「심각도 순위」). 같은 순위면 배열 순서를 따른다.
 * 4) 그래도 못 찾으면 defaultBranchId.
 *
 * 대조 전에 한글 수사로 말한 시각을 숫자로 맞춘다("네 시 사십 분" → "4시 40분").
 * 발화와 표지 **양쪽**에 같은 변환을 걸어, 어느 쪽이 한글로 적혀 있어도 만나게 한다.
 */

import type { BranchDef, CueDef } from "@/types";
import { expandKoreanTimeNumerals, hasExceptionNear, indexOfPattern, isNegated, normalize } from "./rules";
import { isMet, lowestScore } from "./scoring";

export type ClassifySource = "button" | "criticalPattern" | "pattern" | "default";

/**
 * 부정 문맥을 건너뛸지 분기 데이터가 직접 켜는 옵트인 플래그.
 *
 * `BranchDef`(src/types/index.ts)는 리드 소유라 여기서 넓히지 않고, 있으면 읽는 형태로만
 * 받는다. 타입에 필드가 추가되면 그날부터 분기 데이터가 규칙 엔진과 같은 넓은 부정 창을
 * 켤 수 있고, 그전까지는 아래 isDirectlyNegated()가 모든 일반 분기에 좁게 적용된다.
 */
type NegationAwareBranch = BranchDef & { skipNegated?: boolean };

/**
 * 부정이 **그 동사에 바로 붙었는지** 볼 때 사이에 끼어도 되는 글자 (활용 어미).
 * 새 동사가 끼어들면("아무것도 **하**지 않고") 부정이 향하는 곳이 달라진다.
 */
const CONJUGATION_FILLERS = new Set([..."지리으이히기게려어아여라러서는도를을시"]);

const DIRECT_NEGATION_MARKERS = ["않", "지마", "지말", "마세", "말고", "말아"];
const DIRECT_NEGATION_WINDOW = 5;

/**
 * 매치된 패턴 **자신**이 부정된 꼴인지 ("두드" + "리지 않겠습니다").
 *
 * ⚑CF 분기는 예전부터 부정 문맥을 건너뛰었지만 일반 분기는 그러지 않아서,
 * "등을 두드리지 않겠습니다"가 「등을 세게 두드림」(D1-f)으로 분류돼 하지 않겠다고 말한
 * 사람이 감점을 받았다. 다만 규칙 엔진과 같은 넓은 창(10글자)을 그대로 쓰면 이번엔
 * 「아무것도 하지 않고 지켜봅니다」·「따로 남기지 않겠습니다」처럼 **부정 자체가 잘못인**
 * 분기가 전부 빠져나간다. 그래서 일반 분기에는 활용 어미만 사이에 둔 직접 부정만 본다.
 */
function isDirectlyNegated(normalized: string, end: number): boolean {
  const tail = normalized.slice(end, end + DIRECT_NEGATION_WINDOW);
  for (const marker of DIRECT_NEGATION_MARKERS) {
    const at = tail.indexOf(marker);
    if (at < 0) continue;
    if ([...tail.slice(0, at)].every((char) => CONJUGATION_FILLERS.has(char))) return true;
  }
  return false;
}

export interface ClassifyResult {
  branch: BranchDef;
  source: ClassifySource;
  /** 어떤 패턴에 걸렸는지 (디버깅·설명용) */
  matchedPattern?: string;
  /** 요소 개수 판정에서 실제로 걸린 요소 이름 (예: ["시각", "행위·조치", "현재 상태"]) */
  matchedElements?: string[];
}

/* ── 심각도 순위 ────────────────────────────────────────────
   한 발화가 여러 분기에 걸릴 때 **무엇을 채택하는가**의 규칙입니다.

   예전에는 배열에서 먼저 만난 분기를 그대로 썼습니다. 그러면 앞에 공감 한 마디만 붙이면
   뒤에 정반대 말을 해도 충족이 됩니다 — "마음이 급하신 건 알지만, 여기가 어머님 댁이에요"는
   D1-c(감정 인정)의 넓은 조각 「마음이」에 먼저 걸려 초록 체크와 칭찬을 받았고, 정작 이
   시나리오가 잡으려는 실수(사실 반박)는 뒤 절반에 그대로 남아 있었습니다(교육생 검증 실측).
   되는 화법으로 배우고 나면, 나중에 그것이 틀린 화법임을 알게 된 순간 다른 충족 판정까지
   함께 못 믿게 됩니다.

   그래서 걸린 분기를 모두 모아 **가장 심각한 쪽**을 채택합니다. ⚑CF는 이미 위(2단)에서
   먼저 걸러지므로 여기서 가르는 것은 감점 · 중립 · 충족 셋입니다.

   ▸ 감점을 우선하는 조건에 **게이지를 올리는 분기**를 함께 둔 이유
     감점 분기에는 성격이 다른 두 갈래가 섞여 있습니다.
      ① 잘못한 말이 **있어서** 감점인 분기 — 사실 반박(D1-a)·지시 제지(D1-b)처럼 그 말을
         한 것 자체가 어르신을 더 초조하게 만듭니다. 데이터에 gaugeDelta > 0으로 적혀 있습니다.
      ② 갖춰야 할 것이 **없어서** 감점인 분기 — 부분 보고(R1-b)·추상적 제안(R2-b)처럼
         빠뜨린 것으로 판정합니다. 게이지는 움직이지 않습니다(gaugeDelta 0).
     ②까지 우선하면 반대쪽 사고가 납니다. 전 시나리오의 표지·보기 문구를 그대로 발화로
     넣어 재분류해 본 실측이 있습니다(2,733건). ②를 포함하면 9건이 바뀌는데 그중 7건이
     **모범 답안의 강등**이었습니다 — CHK-A01 R1-a의 「귀가 요구」와 보기 문구(5요소를 다
     담은 보고)가 「나가시려고」 한 조각 때문에 R1-b 부분 보고로, CHK-C02 K-a의
     「법으로 허용되지 않」(옳은 거절)이 K-b로 내려갔습니다. 있는 것을 없다고 판정하는 셈입니다.
     ①만 우선하면 바뀌는 것은 2건이고 둘 다 이 검증이 잡으려던 자리입니다
     (CHK-A01·A02 CUE-2의 "어두워서 안 돼요" — D2-b「환경 요인 확인」의 넓은 조각
     「어두워서」에 걸려 충족이던 것이 D2-d「논리적 설득」 감점으로 바로잡힙니다).
     「덧붙인 잘못은 이긴다, 갖춘 것을 못 갖췄다고 하지는 않는다」가 이 규칙이 지키는 선입니다. */

type BranchRank = 0 | 1 | 2;
/** 감점 — 그 말을 한 것 자체가 상황을 나쁘게 만든 분기 */
const RANK_PENALTY: BranchRank = 0;
/** 중립 — 루브릭 적립도 감점도 없는 분기 */
const RANK_NEUTRAL: BranchRank = 1;
/** 충족 — 루브릭이 3점 이상으로 적립되는 분기 */
const RANK_MET: BranchRank = 2;

function branchRank(branch: BranchDef): BranchRank {
  const low = lowestScore(branch.rubricHits);
  const met = low === undefined ? branch.gaugeDelta <= 0 && !branch.coaching : isMet(low);
  // 못 갖춘 것으로 내리는 감점(gaugeDelta 0)은 충족 분기를 이기지 않습니다 — 위 주석 ②.
  if (!met) return branch.gaugeDelta > 0 ? RANK_PENALTY : RANK_MET;
  return low === undefined ? RANK_NEUTRAL : RANK_MET;
}

/** 데이터가 비어 있을 때만 쓰는 안전망 분기 (next가 빈 문자열이면 세션은 같은 턴에 머문다) */
const NEUTRAL_BRANCH: BranchDef = {
  id: "__none",
  label: "미분류",
  patterns: [],
  gaugeDelta: 0,
  aiReaction: "",
  rubricHits: [],
  next: "",
};

/**
 * CUE 안에서 분기 id로 찾는다.
 *
 * @example
 * findBranch(cue, "D1-c")?.label; // "감정 인정형"
 */
export function findBranch(cue: CueDef, branchId: string): BranchDef | undefined {
  return cue.branches.find((b) => b.id === branchId);
}

/**
 * 무응답·미분류 시 적용할 기본 분기.
 *
 * @example
 * defaultBranch(cue).id; // cue.defaultBranchId
 */
export function defaultBranch(cue: CueDef): BranchDef {
  return findBranch(cue, cue.defaultBranchId) ?? cue.branches[0] ?? NEUTRAL_BRANCH;
}

/**
 * 버튼 폴백으로 노출할 분기 목록 (fallbackOption이 있는 분기만).
 * 마이크 없이도 완주할 수 있어야 하므로 훈련 화면은 이 목록을 상시 노출한다.
 *
 * @example
 * fallbackBranches(cue).map(b => b.fallbackOption);
 */
export function fallbackBranches(cue: CueDef): BranchDef[] {
  return cue.branches.filter((b) => typeof b.fallbackOption === "string" && b.fallbackOption.length > 0);
}

/**
 * 분기 패턴 대조.
 *
 * - 정규화 후 2글자 미만이 되는 패턴은 무시한다.
 *   ("음…", "어…" 처럼 구두점이 지워지면 한 글자만 남아 사실상 모든 발화를 삼킨다.)
 * - 패턴이 '-시'로 끝나면 존경 선어말어미 활용형(-신/-셨/-세…)까지 받는다.
 * - `skipNegated`면 "밀어내지 않고", "억지로 하지 않고"처럼 부정 문맥 안의 매치는
 *   건너뛴다. 규칙 엔진(rules.ts)과 같은 기준이며, 어느 분기가 이걸 켜는지는
 *   isNegationAware()가 정한다.
 * - `except`가 있으면 매치 주변(앞뒤 6글자)에 그 말이 있는 매치를 건너뛴다.
 *   규칙 사전과 **같은 함수**(rules.hasExceptionNear)를 쓴다 — 창과 대조기가 갈라지면
 *   같은 문장이 게이트에서는 통과하고 분기에서는 ⚑CF가 된다.
 */
function matchPatternList(
  normalizedUtterance: string,
  patterns: string[],
  mode: "none" | "direct" | "full",
  except?: string[],
): string | undefined {
  for (const pattern of patterns) {
    // 발화와 **같은 변환**을 지나게 합니다 — 표지가 한글 수사로 적힌 자리("새벽 두 시")도
    // 숫자로 말한 발화("새벽 2시")와 만나야 합니다. 시나리오 데이터는 그대로 두고
    // 대조 직전에만 맞춥니다.
    const needle = normalize(expandKoreanTimeNumerals(pattern));
    if (needle.length < 2) continue;
    let from = 0;
    for (;;) {
      const idx = indexOfPattern(normalizedUtterance, needle, from);
      if (idx < 0) break;
      const end = idx + needle.length;
      const negated =
        mode === "full"
          ? isNegated(normalizedUtterance, idx, end)
          : mode === "direct" && isDirectlyNegated(normalizedUtterance, end);
      const excepted = !negated && hasExceptionNear(normalizedUtterance, except, idx, end);
      if (!negated && !excepted) return pattern;
      from = idx + 1;
    }
  }
  return undefined;
}

function matchPattern(
  normalizedUtterance: string,
  branch: BranchDef,
  mode: "none" | "direct" | "full" = "none",
): string | undefined {
  return matchPatternList(normalizedUtterance, branch.patterns, mode, branch.except);
}

/**
 * 요소 개수 판정 (보고 CUE 전용 — cue.elementJudge).
 *
 * 보고는 「어떤 조각이 걸렸는가」가 아니라 「몇 가지가 들어 있는가」로 갈립니다.
 * 예전에는 「귀가 요구」 한 마디만 있어도 5요소 보고가 됐고, 반대로 다 갖춘 보고가
 * 「나가시려고」 한 조각 때문에 부분 보고로 내려갔습니다.
 *
 * 그룹마다 표지를 하나라도 만나면 그 요소가 있는 것으로 세고, tiers를 위에서부터 내려가며
 * 처음 충족되는 분기를 채택합니다. 0개면 채택하지 않고 심각도 매칭으로 넘깁니다.
 */
function judgeElements(
  cue: CueDef,
  normalized: string,
): { branch: BranchDef; labels: string[]; topTier: boolean } | undefined {
  const judge = cue.elementJudge;
  if (!judge) return undefined;
  const labels: string[] = [];
  for (const group of judge.groups) {
    if (matchPatternList(normalized, group.patterns, "direct")) labels.push(group.label);
  }
  if (labels.length === 0) return undefined;
  for (const [index, tier] of judge.tiers.entries()) {
    if (labels.length < tier.minCount) continue;
    const branch = findBranch(cue, tier.branchId);
    if (branch) return { branch, labels, topTier: index === 0 };
  }
  return undefined;
}

/* ── 사다리 밖 선행 대조 ──────────────────────────────────────
   요소 개수 판정(2.5단)은 채택하면 그 자리에서 끝나므로, 3단의 심각도 채택 규칙이
   보고 구간에서만 통째로 무효가 되어 있었습니다. 그래서 이런 일이 났습니다(교육생 5차 실측).

    · CHK-A01 CUE-4 "어르신이 치매라서 자꾸 나가시려고 하셔서 힘들었습니다. 지금은 소파에
      앉아 계십니다" → 대상·행위·현재 상태 3요소로 세어져 최고 갈래(R1-a)와 「보고 들은 것만
      사실대로 옮기셨습니다」 칭찬. 「치매라서」·「힘들었」을 잡으라고 만든 R1-c는 대조조차
      되지 않았습니다. 화면의 칭찬 문장이 사실과 다른 말을 하는 자리입니다.
    · CHK-A02 CUE-5 "…보호자께는 아침에 시설장님을 통해 알리겠습니다" → 2요소로 세어져
      부분 보고(R1-b)로 내려가고, R1-e(보호자 통보 경로 판단)의 SA-07·CO-05는 열리지 않았습니다.
      **덜 말하면 4점, 더 말하면 2점**이 되던 자리입니다(현직·교육생 5차).

   그래서 요소 판정을 채택하기 **직전에** 한 겹을 둡니다 — 「사다리에 이름이 오른 갈래」
   (elementJudge.tiers의 branchId)를 뺀 나머지 갈래를 대조하고, 걸리면 그쪽을 채택합니다.

   ▸ 왜 「사다리 밖」인가 — 사다리 위 갈래는 **개수가 정하는** 자리입니다. 그 갈래까지 다시
     표지로 대조하면 3차에 닫은 사고가 그대로 돌아옵니다: CHK-A01 R1-a의 보기 문구(요소를
     다 담은 보고)가 R1-b의 넓은 조각 「귀가」 하나에 걸려 부분 보고로 내려갑니다.
     「갖춘 것을 못 갖췄다고 하지는 않는다」(위 심각도 순위 주석 ②)가 여기서도 그대로 섭니다.
     사다리 밖 갈래가 말하는 것은 개수가 볼 수 없는 것들입니다 — 감정·추정(R1-c·V-b),
     미보고(R1-d), 통보 경로 판단(R1-e).

   ▸ 사다리 **최상단**에 닿은 발화는 「덧붙인 잘못」만 이깁니다 — 이 한 겹이 **또 하나의
     강등 통로가 되지 않게** 하는 선입니다. 요소를 다 갖춰 말하면서 통보 경로까지 정한 답이
     R1-e로 옮겨 가면 CL-01·02·03이 통째로 빠지고, 그러면 「더 말할수록 손해」가 자리만
     바꿔 되살아납니다. 그래서 최상단에서는 **루브릭이 충족선 아래로 적립되는 갈래**
     (감정·추정 R1-c·V-b, 미보고 R1-d)만 받고, 다른 축의 옳은 판단(R1-e)은 최상단을
     이기지 않습니다. 아래 단(부분 보고)에 떨어진 발화에는 그 제한이 없습니다 — 거기서
     R1-e가 서는 것이 이번에 되찾으려는 판정입니다.

   ▸ 여럿이 걸리면 — ① 게이지를 올리는 갈래(gaugeDelta > 0)가 가장 앞입니다. 3차의
     「심각도 우선은 감점 한정」과 같은 결입니다. ② 그다음은 루브릭이 **더 낮게** 적립되는
     쪽입니다. 보고 구간의 갈래는 전부 gaugeDelta 0이라(어르신이 앞에 계시지 않는 자리입니다)
     실제로 가르는 것은 ②이고, ①은 게이지를 움직이는 보고 CUE가 생기는 날을 위해 둡니다. */
function matchOutsideLadder(
  cue: CueDef,
  normalized: string,
  topTier: boolean,
): ClassifyResult | undefined {
  const judge = cue.elementJudge;
  if (!judge) return undefined;
  const ladder = new Set(judge.tiers.map((tier) => tier.branchId));
  let best: ClassifyResult | undefined;
  let bestWeight = Number.POSITIVE_INFINITY;
  for (const branch of cue.branches) {
    if (branch.criticalFail) continue; // 2단에서 이미 걸렀습니다
    if (ladder.has(branch.id)) continue;
    if (branch.id === cue.defaultBranchId) continue; // 미분류는 표지가 없는 자리입니다
    const low = lowestScore(branch.rubricHits);
    // 최상단에 닿은 발화는 「덧붙인 잘못」만 이깁니다 (위 주석)
    if (topTier && branch.gaugeDelta <= 0 && (low === undefined || isMet(low))) continue;
    const mode = (branch as NegationAwareBranch).skipNegated ? "full" : "direct";
    const matched = matchPattern(normalized, branch, mode);
    if (!matched) continue;
    const weight = branch.gaugeDelta > 0 ? -1 : (low ?? Number.MAX_SAFE_INTEGER);
    if (best === undefined || weight < bestWeight) {
      best = { branch, source: "pattern", matchedPattern: matched };
      bestWeight = weight;
    }
  }
  return best;
}

/**
 * 발화를 분기로 분류한다 (엔진 계약 시그니처).
 *
 * @example
 * classifyUtterance(cue, "마음이 급하시겠어요").id; // "D1-c"
 * classifyUtterance(cue, "").id;                   // cue.defaultBranchId
 */
export function classifyUtterance(cue: CueDef, utterance: string): BranchDef {
  return classifyInput(cue, { utterance }).branch;
}

/**
 * 버튼 선택과 자유 발화를 함께 처리하는 분류기.
 *
 * @example
 * classifyInput(cue, { branchId: "D3-d" }).source;              // "button"
 * classifyInput(cue, { utterance: "밀어서라도" }).source;        // "criticalPattern" (⚑CF 분기 우선)
 * classifyInput(cue, { utterance: "음…" }).source;               // "default"
 */
export function classifyInput(cue: CueDef, input: { utterance?: string; branchId?: string }): ClassifyResult {
  // 1) 버튼으로 고른 분기가 최우선
  if (input.branchId) {
    const picked = findBranch(cue, input.branchId);
    if (picked) return { branch: picked, source: "button" };
  }

  const raw = (input.utterance ?? "").trim();
  if (raw.length === 0) return { branch: defaultBranch(cue), source: "default" };

  // 시각을 한글 수사로 말한 발화("네 시 사십 분")를 숫자로 맞춰 둔다 — 시나리오 데이터의
  // 표지는 숫자로 적혀 있고("16시"·"4시 4"), 현장에서는 한글이 먼저 나온다(현직 검증).
  // 데이터는 손대지 않고 발화 쪽만 맞춘다.
  const normalized = normalize(expandKoreanTimeNumerals(raw));
  if (normalized.length === 0) return { branch: defaultBranch(cue), source: "default" };

  // 2) ⚑CF 분기 우선 검사 (부정 표현은 제외 — "밀어내지 않고 119를 부르겠습니다")
  for (const branch of cue.branches) {
    if (!branch.criticalFail) continue;
    const matched = matchPattern(normalized, branch, "full");
    if (matched) return { branch, source: "criticalPattern", matchedPattern: matched };
  }

  // 2.5) 보고 CUE — 요소 개수로 먼저 가른다 (0개면 아래 심각도 매칭으로 넘어간다)
  const elements = judgeElements(cue, normalized);
  if (elements) {
    // 채택 직전 한 겹 — 사다리 밖 갈래가 걸리면 그쪽이 이긴다 (위 주석)
    const outside = matchOutsideLadder(cue, normalized, elements.topTier);
    if (outside) return outside;
    return {
      branch: elements.branch,
      source: "pattern",
      // 요소 이름 자체에 가운뎃점이 든 것("행위·조치")이 있어, 나열은 쉼표로 합니다.
      matchedPattern: `${elements.labels.join(", ")} (${elements.labels.length}요소)`,
      matchedElements: elements.labels,
    };
  }

  // 3) 걸린 분기를 **모두** 모아 심각도가 높은 쪽을 채택한다 (같은 순위면 배열 순서)
  let best: ClassifyResult | undefined;
  let bestRank: BranchRank = RANK_MET;
  for (const branch of cue.branches) {
    if (branch.criticalFail) continue;
    const mode = (branch as NegationAwareBranch).skipNegated ? "full" : "direct";
    const matched = matchPattern(normalized, branch, mode);
    if (!matched) continue;
    const rank = branchRank(branch);
    if (best === undefined || rank < bestRank) {
      best = { branch, source: "pattern", matchedPattern: matched };
      bestRank = rank;
    }
    if (bestRank === RANK_PENALTY) break; // 감점보다 앞설 순위가 남아 있지 않다
  }
  if (best) return best;

  // 4) 미일치
  return { branch: defaultBranch(cue), source: "default" };
}
