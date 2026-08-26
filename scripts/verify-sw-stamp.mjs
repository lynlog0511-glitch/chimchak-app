#!/usr/bin/env node
/**
 * 빌드가 끝난 뒤 **서비스워커에 캐시 이름이 실제로 박혔는지** 확인합니다. (`npm run build`의 postbuild)
 *
 * 왜 필요한가
 * -----------
 * `scripts/stamp-sw.mjs`가 prebuild에서 `chimchak-__CHIMCHAK_BUILD__`를 내용 해시로 갈아 끼웁니다.
 * 그런데 그 자리가 되돌려지는 일이 실제로 있었습니다 — 2026-08-25 저장소 상태가 그랬습니다:
 * `.next/BUILD_ID`가 19:39:00, `public/sw.js` mtime이 19:39:12로 **빌드 종료 12초 뒤에**
 * 플레이스홀더로 돌아가 있었고 `git status`는 깨끗했습니다(페르소나 FE med 실측).
 * 그 상태로 `npm start`를 누르면 캐시 이름이 빌드마다 고정된 서비스워커가 나가고,
 * activate의 낡은 캐시 청소가 영구히 무력해집니다 — 낡은 청크와 새 HTML이 섞여 화면은 뜨는데
 * 단계 자동 진행과 음성만 죽는, 시연 중 가장 알아채기 어려운 형태로 깨집니다.
 *
 * 역할 분담
 * ---------
 * · `tests/swPrecache.test.ts` = **소스 형식** 검사. 캐시 이름 줄이 stamp-sw.mjs가 찾는 모양인지만
 *   봅니다(플레이스홀더도 통과합니다 — 통과해야 합니다. 커밋된 소스의 정상 상태이니까요).
 * · 이 스크립트 = **산출물 값** 검사. 빌드가 끝난 시점에 실제로 서빙될 파일에 값이 들어 있는지 봅니다.
 * 둘은 보는 대상이 다르므로 어느 한쪽이 다른 쪽을 대신하지 못합니다.
 *
 * 무엇을 보는가
 * -------------
 * Next는 `public/`을 빌드 산출물로 복사하지 않고 **디스크에서 그대로 서빙**하므로, 지금 이
 * 저장소에서 실제로 나가는 파일은 `public/sw.js` 하나입니다. `output: "standalone"`처럼 복사본이
 * 생기는 구성으로 바뀌어도 그대로 동작하도록, 있으면 그 복사본들도 함께 봅니다.
 *
 * ※ 함정 하나: 파일 전체에서 `__CHIMCHAK_BUILD__`를 찾으면 **언제나 걸립니다** —
 *   sw.js 머리 주석이 그 이름을 설명하느라 문자열로 적어 두었기 때문입니다.
 *   그래서 캐시 이름 **줄의 값 자리만** 봅니다.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** 치환되지 않은 자리 표시 — `scripts/stamp-sw.mjs`가 이 자리를 내용 해시로 바꿉니다. */
export const PLACEHOLDER = "__CHIMCHAK_BUILD__";

/** 캐시 이름 줄 — stamp-sw.mjs의 CACHE_NAME_PATTERN과 같은 자리를 가리킵니다. */
export const CACHE_NAME_PATTERN = /const CACHE_NAME = "chimchak-([^"]*)";/;

/**
 * 서비스워커 원문 한 벌을 검사합니다.
 * 통과하면 `null`, 아니면 **사람이 읽고 바로 고칠 수 있는 사유**를 돌려줍니다.
 */
export function stampProblem(source) {
  const match = source.match(CACHE_NAME_PATTERN);
  if (!match) {
    return '캐시 이름 줄(`const CACHE_NAME = "chimchak-…";`)을 찾지 못했습니다 — 형식을 바꾸셨다면 scripts/stamp-sw.mjs도 함께 고쳐 주십시오.';
  }
  const stamp = match[1];
  if (stamp.length === 0) {
    return "캐시 이름이 비어 있습니다(chimchak-) — prebuild가 값을 넣지 못했습니다.";
  }
  if (stamp.includes(PLACEHOLDER)) {
    return `캐시 이름이 치환되지 않은 플레이스홀더 그대로입니다(chimchak-${PLACEHOLDER}) — prebuild가 돌지 않았거나, 빌드 뒤에 파일이 되돌려졌습니다.`;
  }
  return null;
}

/** 검사 대상 — 실제로 서빙될 수 있는 sw.js 전부(없는 경로는 건너뜁니다). */
export function swTargets(root = ROOT) {
  return [
    join(root, "public", "sw.js"),
    join(root, ".next", "standalone", "public", "sw.js"),
    join(root, ".next", "static", "sw.js"),
  ].filter((path) => existsSync(path));
}

function main() {
  const targets = swTargets();
  if (targets.length === 0) {
    console.error("[verify-sw-stamp] 검사할 sw.js를 찾지 못했습니다 — public/sw.js가 있어야 합니다.");
    process.exitCode = 1;
    return;
  }

  const problems = [];
  for (const path of targets) {
    const problem = stampProblem(readFileSync(path, "utf8"));
    if (problem) problems.push(`${relative(ROOT, path).split("\\").join("/")} — ${problem}`);
  }

  if (problems.length > 0) {
    console.error("[verify-sw-stamp] 서비스워커 캐시 이름이 빌드 값으로 박히지 않았습니다.");
    for (const line of problems) console.error(`  · ${line}`);
    console.error("  고치는 법: `node scripts/stamp-sw.mjs`를 다시 돌리고, 빌드 뒤에 이 파일을");
    console.error("  플레이스홀더로 되돌리는 단계(스크립트·훅·에디터 설정)가 없는지 확인하십시오.");
    process.exitCode = 1;
    return;
  }

  console.log(`[verify-sw-stamp] 캐시 이름 확인 — ${targets.length}곳 통과`);
}

/* 다른 모듈이 검사 함수만 가져다 쓸 때는 돌지 않습니다(단위 검사에서 가짜 원문을 넣어 씁니다). */
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
