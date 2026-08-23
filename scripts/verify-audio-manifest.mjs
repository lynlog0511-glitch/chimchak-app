/**
 * 매니페스트 적중률 검사 — `node scripts/verify-audio-manifest.mjs`
 *
 * 합성 스크립트(정규식 파서)와 **다른 길**로 진실을 구합니다.
 * 여기서는 TypeScript 컴파일러로 데이터 모듈을 실제로 트랜스파일해 실행한 뒤,
 * 화면 코드가 speak()에 넘기는 것과 똑같은 문자열을 뽑아 매니페스트 키와 맞춰 봅니다.
 * (파서가 틀리면 두 결과가 어긋나므로, 파서의 실수를 파서로 검산하는 함정을 피합니다.)
 *
 * speak() 호출부는 네 곳입니다.
 *   TrainSession        speak(lastLine.text)      ← 턴의 text / 분기의 aiReaction
 *   useProtocolPlayback speak(text)               ← step.voice.trim() (자동 진행)
 *   useProtocolPlayback speak(text)               ← step.voice.trim() (다시 듣기)
 *   SettingsMenu        speak(SAMPLE_TEXT, {...})
 */

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import ts from "typescript";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * 데이터 모듈 로더 — 값 import까지 따라갑니다.
 *
 * 시나리오 파일이 순수 데이터이던 시절에는 트랜스파일 한 번이면 됐지만,
 * chk-c02가 규칙 사전(`@/engine/rules`)을 값으로 import하면서(목록 단일화)
 * `@/` 별칭과 상대 경로를 여기서도 풀어야 합니다. tsconfig의 `@/* → src/*` 규칙을
 * 그대로 따르고, 그 밖(노드 내장·패키지)은 진짜 require에 넘깁니다.
 */
const moduleCache = new Map();

function resolveSpec(spec, fromRel) {
  if (spec.startsWith("@/")) return `src/${spec.slice(2)}`;
  if (spec.startsWith(".")) {
    const dir = path.posix.dirname(fromRel.replace(/\\/g, "/"));
    return path.posix.normalize(`${dir}/${spec}`);
  }
  return null; // 노드 내장·패키지 — 진짜 require가 처리
}

function loadModule(relPath) {
  const norm = relPath.endsWith(".ts") ? relPath : `${relPath}.ts`;
  if (moduleCache.has(norm)) return moduleCache.get(norm).exports;
  const source = readFileSync(path.join(ROOT, norm), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: norm,
  });
  const module = { exports: {} };
  moduleCache.set(norm, module);
  const localRequire = (spec) => {
    const resolved = resolveSpec(spec, norm);
    return resolved ? loadModule(resolved) : require(spec);
  };
  // eslint-disable-next-line no-new-func
  new Function("exports", "require", "module", "__filename", "__dirname", outputText)(
    module.exports,
    localRequire,
    module,
    norm,
    ROOT,
  );
  return module.exports;
}

/** 런타임에 speak()로 들어가는 문자열 전부 (중복 포함하지 않고 모읍니다). */
function collectSpoken() {
  const spoken = new Map(); // text -> 출처 목록

  const add = (text, origin) => {
    const key = String(text ?? "").trim();
    if (key.length === 0) return;
    if (!spoken.has(key)) spoken.set(key, []);
    spoken.get(key).push(origin);
  };

  for (const file of ["chk-a01", "chk-a02", "chk-b02", "chk-c01", "chk-c02"]) {
    const mod = loadModule(`src/data/scenarios/${file}.ts`);
    const scenario = Object.values(mod).find((v) => v && typeof v === "object" && v.turns);
    for (const turn of scenario.turns) {
      // TrainSession은 로그의 마지막 line 항목을 화자와 무관하게 읽어 줍니다.
      add(turn.text, `${scenario.id}/${turn.id}/text`);
      for (const branch of turn.cue?.branches ?? []) {
        add(branch.aiReaction, `${scenario.id}/${turn.id}/${branch.id}/aiReaction`);
      }
    }
  }

  const { PROTOCOLS } = loadModule("src/data/protocols.ts");
  for (const protocol of PROTOCOLS) {
    for (const step of protocol.steps) add(step.voice, `${protocol.id}/${step.id}/voice`);
  }

  const menu = readFileSync(path.join(ROOT, "src/components/SettingsMenu.tsx"), "utf8");
  const sample = menu.match(/const SAMPLE_TEXT\s*=\s*"((?:[^"\\]|\\.)*)"/);
  if (sample) add(sample[1], "SettingsMenu/SAMPLE_TEXT");
  else console.log("[주의] SettingsMenu의 SAMPLE_TEXT를 찾지 못했습니다.");

  return spoken;
}

const spoken = collectSpoken();
const manifest = JSON.parse(readFileSync(path.join(ROOT, "public/audio/manifest.json"), "utf8"));

const misses = [];
for (const [text, origins] of spoken) {
  if (!manifest[text]) misses.push({ text, origins });
}
const extra = Object.keys(manifest).filter((key) => !spoken.has(key));

const hit = spoken.size - misses.length;
console.log(`speak() 입력 문자열 ${spoken.size}개 · 매니페스트 ${Object.keys(manifest).length}개`);
console.log(`적중 ${hit}/${spoken.size} (${((hit / spoken.size) * 100).toFixed(1)}%)`);

for (const miss of misses) console.log(`  [미적중] ${miss.origins[0]} :: ${miss.text}`);
for (const key of extra) console.log(`  [잉여] 매니페스트에만 있는 문장 :: ${key}`);

process.exit(misses.length === 0 ? 0 : 1);
