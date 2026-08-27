/**
 * 판정 골든 코퍼스 재생성 — `node scripts/regen-golden.mjs`
 *
 * tests/fixtures/judgmentGolden.json의 branch·source를 **지금 코드가 내는 판정**으로 다시
 * 채웁니다. 발화(utterance)·계열(family)·순서는 손대지 않습니다.
 *
 * ▸ 언제 돌리는가
 *   판정선을 **의도해서** 움직였을 때만입니다. tests/judgmentGolden.test.ts가 깨졌는데 왜 그
 *   문장이 옮겨 갔는지 설명할 수 없다면 그것은 회귀입니다 — 이 스크립트를 돌리지 말고 코드를
 *   고치십시오. 이 스크립트는 검사를 통과시키는 도구가 아니라 **사람이 diff로 승인하는 절차**의
 *   앞 단계입니다.
 *
 * ▸ 절차
 *   1) node scripts/regen-golden.mjs
 *   2) git diff tests/fixtures/judgmentGolden.json  ← 한 줄씩 읽고, 옮겨 간 문장마다
 *      「이 이동을 내가 의도했는가」에 답합니다.
 *   3) 답하지 못하는 줄이 하나라도 있으면 되돌리고(git checkout) 코드를 고칩니다.
 *
 * 판정은 검사와 **같은 코드 경로**로 냅니다 — 여기서 분류기를 따로 부르면 스크립트와 검사가
 * 갈라져, 재생성한 값이 검사에서 다시 틀리는 일이 생깁니다. 그래서 이 파일이 하는 일은
 * 갱신 모드로 vitest를 한 번 돌리는 것뿐입니다.
 */

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const result = spawnSync("npx", ["vitest", "run", "tests/judgmentGolden.test.ts"], {
  cwd: ROOT,
  env: { ...process.env, GOLDEN_UPDATE: "1" },
  stdio: "inherit",
  shell: true,
});

if (result.status !== 0) {
  console.error("\n재생성에 실패했습니다 — fixture는 그대로입니다.");
  process.exit(result.status ?? 1);
}

console.log(
  [
    "",
    "tests/fixtures/judgmentGolden.json을 다시 채웠습니다.",
    "",
    "다음은 사람이 하는 일입니다:",
    "  git diff tests/fixtures/judgmentGolden.json",
    "옮겨 간 줄마다 「이 이동을 의도했는가」에 답하십시오.",
    "답하지 못하는 줄이 하나라도 있으면 되돌리고(git checkout) 코드를 고치십시오.",
    "",
  ].join("\n"),
);
