#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
침착(ChimChak) 사전 합성 오디오 빌더.

앱의 모든 대사는 **검수된 고정 문구**입니다. 런타임에 만들어 내는 문장이 하나도 없으므로,
빌드 시점에 미리 고품질로 합성해 동봉하면 다음이 동시에 지켜집니다.

  - 런타임 외부 호출 0건 (재생은 /audio/*.mp3 정적 파일)
  - 오프라인 동작 (서비스워커가 응급 프로토콜 음성을 사전 캐시)
  - 「생성 0%」 원칙 (합성 대상은 데이터 파일에 박혀 있는 고정 문자열뿐)

무엇을 합성하는가 — 기준은 **런타임에 speak()로 실제로 들어가는 문자열**입니다.
(speak() 호출부는 네 곳뿐입니다: TrainSession · useProtocolPlayback ×2 · SettingsMenu)

  1) src/data/scenarios/*.ts  턴의 `text`        → TrainSession이 로그 line 항목으로 낭독
  2) src/data/scenarios/*.ts  분기의 `aiReaction` → 같은 경로로 낭독 (빈 문자열 제외)
  3) src/data/protocols.ts    단계의 `voice`      → useProtocolPlayback이 낭독 (빈 문자열 = 침묵 단계, 제외)
  4) SettingsMenu의 예시 문장

TS 파싱은 정규식 + 간이 스캐너입니다(주석 제거 → 문자열 리터럴 추출 → 상수 해석).
과추출보다 정추출을 택합니다 — 빠뜨린 문장은 speech.ts가 브라우저 TTS로 폴백하므로 앱이 멈추지 않습니다.

출력
  public/audio/<sha1(text)[:10]>.mp3   일반 대사
  public/audio/p{번호}-{단계}.mp3       응급 프로토콜 (고정 이름 — 서비스워커가 이름으로 사전 캐시)
  public/audio/manifest.json           { "<정확한 텍스트>": { "f": "파일명", "e": 1(응급만) } }
  scripts/.audio-index.json            증분 빌드용 내부 색인 (파일명 → 텍스트·보이스 해시)

사용
  python scripts/synthesize-audio.py           # 증분 (바뀐 문장만 다시 합성)
  python scripts/synthesize-audio.py --force   # 전부 다시 합성
  python scripts/synthesize-audio.py --dry-run # 합성하지 않고 대상만 보고
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPT_DIR = Path(__file__).resolve().parent
SCENARIO_DIR = ROOT / "src" / "data" / "scenarios"
PROTOCOLS_TS = ROOT / "src" / "data" / "protocols.ts"
SETTINGS_MENU_TSX = ROOT / "src" / "components" / "SettingsMenu.tsx"
OUT_DIR = ROOT / "public" / "audio"
MANIFEST_PATH = OUT_DIR / "manifest.json"
INDEX_PATH = SCRIPT_DIR / ".audio-index.json"

MAX_RETRIES = 2
CONCURRENCY = 4


# ── 화자 배정 ────────────────────────────────────────────────────────────
#
# rate/pitch는 edge-tts 표기 그대로입니다. 어르신 두 분은 또박또박 들리도록 느리게,
# 119 상황실은 침착하되 늘어지지 않게, 프로토콜 안내는 차분하게 잡았습니다.

@dataclass(frozen=True)
class Voice:
    name: str
    rate: str = "+0%"
    pitch: str = "+0Hz"


SUNHI = "ko-KR-SunHiNeural"
INJOON = "ko-KR-InJoonNeural"

# CHK-A01 박 어르신(여 82세) · CHK-C01 어르신(여, 보호자 김 씨의 어머니)
ELDER_F = Voice(SUNHI, "-12%", "-4Hz")
# CHK-B02 이 어르신(남 79세)
ELDER_M = Voice(INJOON, "-12%", "-3Hz")
# 보호자 — 세 시나리오 모두 딸(여성)입니다
GUARDIAN = Voice(SUNHI)
# 119 상황실
DISPATCHER = Voice(INJOON, "-4%")
# 프로토콜 안내 · 상황 지문(system) · 응급 전환 안내(protocol)
NARRATION = Voice(SUNHI, "-6%")
# 설정 예시 문장
SAMPLE = Voice(SUNHI)

ELDER_BY_SCENARIO = {
    "chk-a01": ELDER_F,
    "chk-b02": ELDER_M,
    "chk-c01": ELDER_F,
}


def voice_for(scenario_key: str, speaker: str) -> Voice:
    """턴 화자 → 보이스. 알 수 없는 화자는 안전하게 안내 보이스로 떨어뜨립니다."""
    if speaker == "elder":
        return ELDER_BY_SCENARIO.get(scenario_key, ELDER_F)
    if speaker == "guardian":
        return GUARDIAN
    if speaker == "dispatcher":
        return DISPATCHER
    # "system"(상황 지문) · "protocol"(응급 전환 안내)
    #
    # 설계 초안에서는 이 둘을 합성 대상에서 빼려 했지만, 1단계 조사 결과
    # TrainSession은 **로그의 마지막 line 항목이면 화자를 가리지 않고** 낭독합니다.
    # 빼 두면 사람 대사만 뉴럴 음성이고 지문만 브라우저 TTS로 튀어, 한 화면 안에서
    # 목소리가 갈립니다. 그래서 지문도 같은 엔진의 차분한 안내 보이스로 함께 담습니다.
    return NARRATION


# ── TS 간이 파서 ─────────────────────────────────────────────────────────

def strip_comments(source: str) -> str:
    """
    주석을 공백으로 바꿉니다(오프셋이 어긋나지 않도록 길이는 보존).
    문자열·템플릿 리터럴 안의 `//`, `/*` 는 건드리지 않습니다.
    """
    out = list(source)
    i = 0
    n = len(source)
    while i < n:
        ch = source[i]
        if ch in "\"'`":
            quote = ch
            i += 1
            while i < n:
                if source[i] == "\\":
                    i += 2
                    continue
                if source[i] == quote:
                    i += 1
                    break
                i += 1
            continue
        if ch == "/" and i + 1 < n and source[i + 1] == "/":
            while i < n and source[i] != "\n":
                out[i] = " "
                i += 1
            continue
        if ch == "/" and i + 1 < n and source[i + 1] == "*":
            while i < n and not (source[i] == "*" and i + 1 < n and source[i + 1] == "/"):
                if source[i] != "\n":
                    out[i] = " "
                i += 1
            for _ in range(2):
                if i < n:
                    out[i] = " "
                    i += 1
            continue
        i += 1
    return "".join(out)


ESCAPES = {"n": "\n", "t": "\t", "r": "\r", "\\": "\\", '"': '"', "'": "'", "`": "`", "0": "\0"}


def _read_literal(src: str, i: int) -> tuple[str, int]:
    """i는 여는 따옴표 위치. (값, 닫는 따옴표 다음 인덱스)를 돌려줍니다."""
    quote = src[i]
    i += 1
    buf: list[str] = []
    n = len(src)
    while i < n:
        ch = src[i]
        if ch == "\\":
            nxt = src[i + 1] if i + 1 < n else ""
            if nxt == "u" and i + 5 < n:
                buf.append(chr(int(src[i + 2 : i + 6], 16)))
                i += 6
                continue
            if nxt == "\n":  # 줄 이음
                i += 2
                continue
            buf.append(ESCAPES.get(nxt, nxt))
            i += 2
            continue
        if ch == quote:
            return "".join(buf), i + 1
        buf.append(ch)
        i += 1
    raise ValueError("문자열 리터럴이 닫히지 않았습니다.")


IDENT_RE = re.compile(r"[A-Za-z_$][A-Za-z0-9_$]*")


def read_value(src: str, i: int, consts: dict[str, str]) -> str | None:
    """
    `key:` 뒤의 값을 읽습니다. 문자열 리터럴 · 상수 식별자 · `"a" + "b"` 연결까지만 다룹니다.
    그 밖의 형태(템플릿·함수 호출 등)는 None — 정추출 원칙에 따라 조용히 건너뜁니다.
    """
    n = len(src)
    parts: list[str] = []
    while True:
        while i < n and src[i] in " \t\r\n":
            i += 1
        if i >= n:
            break
        if src[i] in "\"'":
            value, i = _read_literal(src, i)
            parts.append(value)
        else:
            m = IDENT_RE.match(src, i)
            if not m:
                return None
            name = m.group(0)
            if name not in consts:
                return None
            parts.append(consts[name])
            i = m.end()
        # 이어 붙이기(+)가 있으면 계속 읽습니다.
        j = i
        while j < n and src[j] in " \t\r\n":
            j += 1
        if j < n and src[j] == "+":
            i = j + 1
            continue
        break
    return "".join(parts) if parts else None


CONST_RE = re.compile(r"^const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*", re.MULTILINE)


def collect_consts(src: str) -> dict[str, str]:
    """최상위 `const NAME = "..."` 문자열 상수를 모읍니다(선언 순서대로 해석)."""
    consts: dict[str, str] = {}
    for m in CONST_RE.finditer(src):
        try:
            value = read_value(src, m.end(), consts)
        except ValueError:
            value = None
        if value is not None:
            consts[m.group(1)] = value
    return consts


# ── 합성 대상 ────────────────────────────────────────────────────────────

@dataclass
class Item:
    text: str
    voice: Voice
    filename: str
    emergency: bool = False
    origin: str = ""


SPEAKER_RE = re.compile(r'\bspeaker\s*:\s*"(\w+)"')
TEXT_RE = re.compile(r"\btext\s*:\s*")
AI_REACTION_RE = re.compile(r"\baiReaction\s*:\s*")
IS_TRIGGER_RE = re.compile(r"\bisTrigger\s*:\s*true")
STEP_RE = re.compile(r'\bid\s*:\s*"(P-(\d+)-(\d+))"\s*,\s*voice\s*:\s*')
SAMPLE_TEXT_RE = re.compile(r'\bconst\s+SAMPLE_TEXT\s*=\s*')


def sha_name(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:10] + ".mp3"


def collect_scenarios(warnings: list[str]) -> list[Item]:
    """
    턴 `text` 와 분기 `aiReaction` 을 뽑습니다.

    턴 객체는 `speaker` 로 시작하는 블록이고, 그 턴의 cue·branches는 다음 `speaker` 가
    나오기 전까지 이어집니다. 그래서 `speaker` 위치로 소스를 잘라 블록 단위로 훑습니다.
    """
    items: list[Item] = []
    for path in sorted(SCENARIO_DIR.glob("chk-*.ts")):
        key = path.stem
        raw = path.read_text(encoding="utf-8")
        src = strip_comments(raw)
        consts = collect_consts(src)

        marks = list(SPEAKER_RE.finditer(src))
        if not marks:
            warnings.append(f"{path.name}: 턴을 찾지 못했습니다.")
            continue

        for idx, mark in enumerate(marks):
            speaker = mark.group(1)
            start = mark.end()
            end = marks[idx + 1].start() if idx + 1 < len(marks) else len(src)
            block = src[start:end]

            # 턴 본문 대사
            tm = TEXT_RE.search(block)
            if tm:
                value = read_value(block, tm.end(), consts)
                if value and value.strip():
                    items.append(
                        Item(
                            text=value.strip(),
                            voice=voice_for(key, speaker),
                            filename=sha_name(value.strip()),
                            origin=f"{key}:turn:{speaker}",
                        )
                    )
            else:
                warnings.append(f"{path.name}: speaker={speaker} 블록에 text가 없습니다.")

            # 반응 대사 — 화면 로직(reactionSpeaker)과 같은 규칙으로 화자를 정합니다.
            # 돌발 변수 턴(system + isTrigger)의 반응은 등장인물(어르신)의 말입니다.
            is_trigger = IS_TRIGGER_RE.search(block) is not None
            reaction_speaker = "elder" if (speaker == "system" and is_trigger) else speaker
            for am in AI_REACTION_RE.finditer(block):
                value = read_value(block, am.end(), consts)
                if not value or not value.strip():
                    continue
                items.append(
                    Item(
                        text=value.strip(),
                        voice=voice_for(key, reaction_speaker),
                        filename=sha_name(value.strip()),
                        origin=f"{key}:reaction:{reaction_speaker}",
                    )
                )
    return items


def collect_protocols(warnings: list[str]) -> list[Item]:
    """응급 프로토콜 단계의 `voice` — 파일 이름은 p{번호}-{단계}.mp3로 고정합니다."""
    raw = PROTOCOLS_TS.read_text(encoding="utf-8")
    src = strip_comments(raw)
    consts = collect_consts(src)

    items: list[Item] = []
    found = 0
    for m in STEP_RE.finditer(src):
        found += 1
        value = read_value(src, m.end(), consts)
        if value is None:
            warnings.append(f"protocols.ts: {m.group(1)} 의 voice 값을 읽지 못했습니다.")
            continue
        text = value.strip()
        if not text:
            continue  # 마지막 침묵 단계 — 재생하지 않습니다.
        items.append(
            Item(
                text=text,
                voice=NARRATION,
                filename=f"p{m.group(2)}-{m.group(3)}.mp3",
                emergency=True,
                origin=m.group(1),
            )
        )

    # 단계 수가 데이터와 어긋나면(형태가 바뀌면) 조용히 빠뜨리지 않고 알립니다.
    declared = len(re.findall(r"\bvoice\s*:\s*", src)) - len(
        re.findall(r"\bvoice\s*:\s*string", src)
    )
    if found < declared:
        warnings.append(f"protocols.ts: voice {declared}개 중 {found}개만 단계로 인식했습니다.")
    return items


def collect_sample(warnings: list[str]) -> list[Item]:
    """설정 메뉴 「음성 빠르기」 예시 문장."""
    src = strip_comments(SETTINGS_MENU_TSX.read_text(encoding="utf-8"))
    m = SAMPLE_TEXT_RE.search(src)
    if not m:
        warnings.append("SettingsMenu.tsx: SAMPLE_TEXT를 찾지 못했습니다.")
        return []
    value = read_value(src, m.end(), {})
    if not value or not value.strip():
        warnings.append("SettingsMenu.tsx: SAMPLE_TEXT 값을 읽지 못했습니다.")
        return []
    text = value.strip()
    return [Item(text=text, voice=SAMPLE, filename=sha_name(text), origin="SettingsMenu")]


def dedupe(items: list[Item], warnings: list[str]) -> list[Item]:
    """
    매니페스트는 텍스트로 찾습니다 — 같은 문장은 파일 하나로 모읍니다.
    (「지금 119를 누르세요.」는 P-01~P-05가 모두 씁니다. 먼저 나온 고정 이름 하나로 통일합니다.)
    """
    seen: dict[str, Item] = {}
    out: list[Item] = []
    for item in items:
        prev = seen.get(item.text)
        if prev is None:
            seen[item.text] = item
            out.append(item)
            continue
        # 같은 문장이 응급 단계로도 등장하면 응급으로 승격합니다(사전 캐시 대상).
        if item.emergency and not prev.emergency:
            prev.emergency = True
            prev.filename = item.filename
        if prev.voice != item.voice:
            warnings.append(
                f"같은 문장에 화자가 둘입니다 — 먼저 나온 쪽을 씁니다: "
                f"{prev.origin} / {item.origin} :: {item.text[:24]}…"
            )
    return out


# ── 합성 ─────────────────────────────────────────────────────────────────

def signature(item: Item) -> str:
    payload = f"{item.text} {item.voice.name} {item.voice.rate} {item.voice.pitch}"
    return hashlib.sha1(payload.encode("utf-8")).hexdigest()


async def synth_one(item: Item, sem: asyncio.Semaphore) -> int:
    """한 문장을 합성해 저장하고 바이트 수를 돌려줍니다. 실패는 예외로 올립니다."""
    import edge_tts

    target = OUT_DIR / item.filename
    tmp = target.with_suffix(".part")
    last: Exception | None = None
    async with sem:
        for attempt in range(MAX_RETRIES + 1):
            try:
                communicate = edge_tts.Communicate(
                    item.text,
                    item.voice.name,
                    rate=item.voice.rate,
                    pitch=item.voice.pitch,
                )
                with tmp.open("wb") as fp:
                    got_audio = False
                    async for chunk in communicate.stream():
                        if chunk["type"] == "audio":
                            fp.write(chunk["data"])
                            got_audio = True
                if not got_audio:
                    raise RuntimeError("오디오가 비어 있습니다.")
                tmp.replace(target)
                return target.stat().st_size
            except Exception as exc:  # noqa: BLE001 — 네트워크 오류 전부 재시도 대상
                last = exc
                tmp.unlink(missing_ok=True)
                if attempt < MAX_RETRIES:
                    await asyncio.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"{item.filename} 합성 실패: {last}") from last


async def run(items: list[Item], force: bool) -> tuple[int, int, list[str]]:
    index: dict[str, str] = {}
    if INDEX_PATH.exists() and not force:
        try:
            index = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            index = {}

    todo = [
        item
        for item in items
        if force
        or not (OUT_DIR / item.filename).exists()
        or index.get(item.filename) != signature(item)
    ]

    print(f"  합성 대상 {len(todo)}개 / 전체 {len(items)}개 (나머지는 기존 파일 재사용)")
    failures: list[str] = []
    if todo:
        sem = asyncio.Semaphore(CONCURRENCY)
        results = await asyncio.gather(
            *(synth_one(item, sem) for item in todo), return_exceptions=True
        )
        for item, result in zip(todo, results):
            if isinstance(result, BaseException):
                failures.append(f"{item.origin} :: {item.text[:30]} — {result}")
                continue
            index[item.filename] = signature(item)

    # 색인에는 지금 쓰이는 파일만 남깁니다.
    live = {item.filename for item in items}
    index = {name: sig for name, sig in index.items() if name in live}
    INDEX_PATH.write_text(
        json.dumps(index, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8"
    )
    return len(todo), len(todo) - len(failures), failures


def main() -> int:
    parser = argparse.ArgumentParser(description="침착 사전 합성 오디오 빌더")
    parser.add_argument("--force", action="store_true", help="전부 다시 합성")
    parser.add_argument("--dry-run", action="store_true", help="합성 없이 대상만 보고")
    args = parser.parse_args()

    warnings: list[str] = []
    items = collect_scenarios(warnings) + collect_protocols(warnings) + collect_sample(warnings)
    items = dedupe(items, warnings)

    print(f"수집 {len(items)}개 문장 (응급 {sum(1 for i in items if i.emergency)}개)")
    for w in warnings:
        print(f"  [주의] {w}")

    if args.dry_run:
        for item in items:
            flag = "E" if item.emergency else " "
            print(f"  {flag} {item.filename}  {item.voice.name} {item.voice.rate} {item.voice.pitch}  {item.text[:40]}")
        return 0

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    attempted, ok, failures = asyncio.run(run(items, args.force))

    # 파일이 실제로 있는 문장만 매니페스트에 올립니다 —
    # 없는 파일을 가리키면 재생이 404로 실패하고, 그때마다 폴백을 타느라 첫 소리가 늦어집니다.
    manifest: dict[str, dict[str, object]] = {}
    total_bytes = 0
    missing = 0
    for item in items:
        path = OUT_DIR / item.filename
        if not path.exists():
            missing += 1
            continue
        entry: dict[str, object] = {"f": item.filename}
        if item.emergency:
            entry["e"] = 1
        manifest[item.text] = entry
        total_bytes += path.stat().st_size

    MANIFEST_PATH.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
    )

    print(f"합성 {ok}/{attempted} 성공 · 매니페스트 {len(manifest)}개")
    print(f"오디오 총 용량 {total_bytes / 1024:.1f} KB · 매니페스트 {MANIFEST_PATH.stat().st_size / 1024:.1f} KB")
    if missing:
        print(f"  [주의] 파일이 없어 매니페스트에서 뺀 문장 {missing}개 (브라우저 TTS로 폴백됩니다)")
    for f in failures:
        print(f"  [실패] {f}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
