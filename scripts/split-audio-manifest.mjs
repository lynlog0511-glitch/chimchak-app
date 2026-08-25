/**
 * 음성 매니페스트 분할 — `node scripts/split-audio-manifest.mjs`
 *
 * 무엇을 하는가: `public/audio/manifest.json`(전체 217건)에서 **응급 프로토콜 대사 14건**
 * (`e: 1`)만 추려 `public/audio/manifest.emergency.json`으로 씁니다. 원본은 손대지 않습니다.
 *
 * 왜 필요한가: `src/lib/speech.ts`가 전체 매니페스트를 정적 import하던 시절, 웹팩이 그것을
 * SettingsMenu와 같은 청크에 인라인해 **모든 라우트**에 실어 보냈습니다. 소리를 한 번도 내지
 * 않는 /legal·/guide가 훈련 대사 203건의 파일명 사전을 받았습니다. 그렇다고 전체를 지연 로딩으로
 * 돌리면, 응급 안내의 자동 진행이 「첫 발화 전에 fetch를 기다리지 않는다」는 보증을 잃습니다.
 * 그래서 **보증이 필요한 14건만 정적으로 남기고 나머지는 훈련 화면에서 받습니다.**
 *
 * 합성 스크립트(`synthesize-audio.py`)는 지금처럼 manifest.json 하나만 만듭니다 — 파이프라인을
 * 바꾸지 않고 빌드 앞단에서 갈라 두는 편이, 진실의 출처를 하나로 두는 데 유리합니다.
 * 두 파일이 어긋나면 `npm run audio:verify`가 잡습니다(scripts/verify-audio-manifest.mjs).
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FULL_PATH = path.join(ROOT, "public/audio/manifest.json");
const EMERGENCY_PATH = path.join(ROOT, "public/audio/manifest.emergency.json");

/** 응급 프로토콜 대사만 추립니다 — 키 순서를 고정해 빌드마다 같은 파일이 나오게 합니다. */
export function emergencySubset(manifest) {
  const out = {};
  for (const key of Object.keys(manifest).sort()) {
    const entry = manifest[key];
    if (entry && entry.e === 1) out[key] = entry;
  }
  return out;
}

const manifest = JSON.parse(readFileSync(FULL_PATH, "utf8"));
const subset = emergencySubset(manifest);
const text = `${JSON.stringify(subset, null, 2)}\n`;

let before = "";
try {
  before = readFileSync(EMERGENCY_PATH, "utf8");
} catch {
  /* 아직 없는 상태 — 아래에서 만듭니다. */
}

if (before === text) {
  console.log(`응급 매니페스트 ${Object.keys(subset).length}건 — 이미 최신입니다.`);
} else {
  writeFileSync(EMERGENCY_PATH, text, "utf8");
  console.log(
    `응급 매니페스트를 새로 썼습니다: ${Object.keys(subset).length}건 / 전체 ${Object.keys(manifest).length}건`,
  );
}
