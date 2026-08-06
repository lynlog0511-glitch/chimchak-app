#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Pretendard Variable 서브셋 생성기 — public/fonts/PretendardVariable.subset.woff2

왜 만드나
---------
동봉한 Pretendard Variable 원본은 2.0MB입니다. 첫 화면이 글자를 그리기 전에 그 2.0MB를
전부 받아야 하고, 서비스워커는 설치 시점에 같은 2.0MB를 한 번 더 받습니다.
현장 시연은 행사장 Wi-Fi나 테더링에서 돌아갑니다 — 여기서 2MB는 첫 글자가 뜨는 시각을
초 단위로 밀어냅니다.

무엇을 담나 (합집합)
--------------------
  1. `src/**` 안 모든 텍스트 파일에 실제로 쓰인 글자
  2. `public/audio/manifest.json`의 키(= 사전 합성 음성 대사 원문)와 값
  3. `public/manifest.webmanifest` (PWA 설치 이름)
  4. ASCII 0x20–0x7E 전부
  5. 한글 호환 자모 U+3130–U+318F (IME 조합 중간 글자·자음 단독 표기)
  6. KS X 1001 완성형 한글 2,350자
     → 사용자가 신고서·자유 입력란에 **직접 타이핑**하는 글자를 받아 내기 위한 몫입니다.
       현대 한국어 문장의 대부분이 이 2,350자 안에서 끝납니다.
  7. 안전 여백 문자 몇 개(줄바꿈 없는 공백, 대체 문자 등)

그래도 빠지는 글자가 오면
-------------------------
`src/app/globals.css`의 @font-face가 2단 구조입니다.
  1순위 "Pretendard Variable"      = 이 서브셋
  2순위 "Pretendard Variable Full" = 원본 2.0MB, unicode-range로 한국어/라틴 영역만
서브셋에 없는 글자를 그려야 하는 순간에만 브라우저가 2순위 파일을 내려받습니다.
평소에는 한 바이트도 받지 않습니다.

실행
----
  pip install fonttools brotli
  npm run font

주의
----
서브셋을 다시 만들면 파일 이름은 그대로인데 내용이 바뀝니다.
next.config.ts가 /fonts/* 에 1년 immutable을 걸어 두었으므로,
**내용이 바뀌면 파일 이름의 버전을 함께 올려야 합니다**(스크립트가 끝에 다시 알립니다).
"""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "src"
FONT_DIR = ROOT / "public" / "fonts"
SOURCE_FONT = FONT_DIR / "PretendardVariable.woff2"
OUTPUT_FONT = FONT_DIR / "PretendardVariable.subset.woff2"

AUDIO_MANIFEST = ROOT / "public" / "audio" / "manifest.json"
WEB_MANIFEST = ROOT / "public" / "manifest.webmanifest"

# 훑을 텍스트 파일 확장자 — 화면에 글자로 나갈 수 있는 것만.
TEXT_SUFFIXES = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".css", ".json", ".md", ".svg", ".txt"}

# 안전 여백 — 코드에 직접 안 보여도 런타임에 튀어나올 수 있는 글자들.
EXTRA_CODEPOINTS = {
    0x00A0,  # NO-BREAK SPACE
    0x200B,  # ZERO WIDTH SPACE
    0x2013,  # –
    0x2014,  # —
    0x2018,
    0x2019,
    0x201C,
    0x201D,
    0x2026,  # …
    0x00B7,  # ·
    0x00D7,  # ×
    0xFFFD,  # 대체 문자
}


def read_text(path: Path) -> str:
    """UTF-8로 읽되, 어떤 파일도 스크립트를 죽이지 않게 합니다."""
    try:
        return path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return ""


def collect_from_tree(root: Path) -> set[int]:
    found: set[int] = set()
    if not root.exists():
        return found
    for path in root.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in TEXT_SUFFIXES:
            continue
        found.update(ord(ch) for ch in read_text(path))
    return found


def collect_from_audio_manifest(path: Path) -> set[int]:
    """
    음성 매니페스트의 키는 실제 발화 대사 원문입니다.
    화면 자막이 이 문장을 그대로 그리므로 서브셋에 반드시 들어가야 합니다.
    """
    found: set[int] = set()
    if not path.exists():
        return found
    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return found
    for key, value in manifest.items():
        found.update(ord(ch) for ch in str(key))
        if isinstance(value, dict):
            for inner in value.values():
                found.update(ord(ch) for ch in str(inner))
    return found


def ksx1001_hangul() -> set[int]:
    """
    KS X 1001 완성형 한글 2,350자.

    표를 손으로 들고 다니지 않고 EUC-KR 인코딩으로 판별합니다 —
    KS X 1001 한글 영역은 선두 바이트 0xB0–0xC8, 후속 바이트 0xA1–0xFE입니다.
    (파이썬 euc_kr 코덱은 UHC 확장까지 받아 주므로 바이트 범위로 한 번 더 거릅니다.)
    """
    found: set[int] = set()
    for cp in range(0xAC00, 0xD7A4):
        try:
            encoded = chr(cp).encode("euc_kr")
        except UnicodeEncodeError:
            continue
        if len(encoded) == 2 and 0xB0 <= encoded[0] <= 0xC8 and 0xA1 <= encoded[1] <= 0xFE:
            found.add(cp)
    return found


def font_stats(path: Path) -> tuple[int, int, bool]:
    """(파일 크기, cmap 코드포인트 수, 가변축 유지 여부)"""
    from fontTools.ttLib import TTFont

    size = path.stat().st_size
    font = TTFont(str(path), lazy=True)
    try:
        cmap = font.getBestCmap()
        return size, len(cmap), "fvar" in font
    finally:
        font.close()


def main() -> int:
    if not SOURCE_FONT.exists():
        print(f"[실패] 원본 폰트를 찾을 수 없습니다: {SOURCE_FONT}", file=sys.stderr)
        return 1

    from_src = collect_from_tree(SRC_DIR)
    from_audio = collect_from_audio_manifest(AUDIO_MANIFEST)
    from_web = set(ord(ch) for ch in read_text(WEB_MANIFEST))
    ascii_set = set(range(0x20, 0x7F))
    jamo = set(range(0x3130, 0x3190))
    wanseong = ksx1001_hangul()

    codepoints = (
        from_src | from_audio | from_web | ascii_set | jamo | wanseong | EXTRA_CODEPOINTS
    )

    print("── 수집 ──────────────────────────────────")
    print(f"  src/**                 {len(from_src):>6}자")
    print(f"  audio/manifest.json    {len(from_audio):>6}자")
    print(f"  manifest.webmanifest   {len(from_web):>6}자")
    print(f"  ASCII                  {len(ascii_set):>6}자")
    print(f"  한글 호환 자모          {len(jamo):>6}자")
    print(f"  KS X 1001 완성형       {len(wanseong):>6}자")
    print(f"  합집합                 {len(codepoints):>6}자")

    # 원본 cmap에 없는 코드포인트는 넘겨도 무시되지만, 몇 자가 빠지는지는 알아야 합니다.
    from fontTools.ttLib import TTFont

    source = TTFont(str(SOURCE_FONT), lazy=True)
    try:
        source_cmap = set(source.getBestCmap().keys())
    finally:
        source.close()
    missing = sorted(cp for cp in codepoints if cp not in source_cmap)
    if missing:
        preview = " ".join(f"U+{cp:04X}({chr(cp)})" for cp in missing[:12])
        print(f"  · 원본 폰트에 없는 글자 {len(missing)}자는 건너뜁니다: {preview}")

    with tempfile.NamedTemporaryFile(
        "w", suffix=".txt", delete=False, encoding="utf-8"
    ) as handle:
        handle.write("\n".join(f"{cp:04X}" for cp in sorted(codepoints)))
        unicodes_file = handle.name

    args = [
        sys.executable,
        "-m",
        "fontTools.subset",
        str(SOURCE_FONT),
        f"--unicodes-file={unicodes_file}",
        f"--output-file={OUTPUT_FONT}",
        "--flavor=woff2",
        # layout-features는 pyftsubset 기본값을 씁니다.
        # 기본값이 이미 ccmp·liga·calt·kern·mark·mkmk를 담고 있어 한국어 조판에 모자람이 없고,
        # `*`(전부)로 올리면 쓰지 않는 세로쓰기·라틴 전용 기능까지 붙어 22KB가 더 붙습니다.
        # 가변축(wght 45~920)은 반드시 살아 있어야 하므로 인스턴싱(--instance)은 하지 않습니다.
        "--drop-tables+=DSIG",
        "--notdef-outline",
        "--recalc-bounds",
    ]

    print("\n── 서브셋 ────────────────────────────────")
    result = subprocess.run(args, capture_output=True, text=True)
    Path(unicodes_file).unlink(missing_ok=True)
    if result.returncode != 0:
        print(result.stdout, file=sys.stderr)
        print(result.stderr, file=sys.stderr)
        print("[실패] pyftsubset이 오류로 끝났습니다.", file=sys.stderr)
        return result.returncode

    before_size, before_glyphs, before_var = font_stats(SOURCE_FONT)
    after_size, after_glyphs, after_var = font_stats(OUTPUT_FONT)

    print(f"  원본   {SOURCE_FONT.name:<34} {before_size / 1024:>8.1f}KB · {before_glyphs:>6}자")
    print(f"  서브셋 {OUTPUT_FONT.name:<34} {after_size / 1024:>8.1f}KB · {after_glyphs:>6}자")
    print(f"  절감   {(before_size - after_size) / 1024:>8.1f}KB ({100 - after_size * 100 / before_size:.1f}%)")
    print(f"  가변축(fvar) 유지: 원본 {before_var} → 서브셋 {after_var}")

    if not after_var:
        print(
            "\n[실패] 서브셋에서 가변축이 사라졌습니다 — 굵기 45~920이 죽습니다.",
            file=sys.stderr,
        )
        return 1

    print(
        "\n※ 내용을 바꿔 다시 만드셨다면 next.config.ts의 1년 immutable 때문에\n"
        "   파일 이름 버전을 올리고 globals.css·layout.tsx·public/sw.js의 경로도 함께 고쳐야 합니다."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
