/**
 * 디자인 눈금 게이트 — 가이드 §7의 grep 블랙리스트를 파일로 못 박는다.
 *
 * 이 검사가 있는 이유는 가이드가 이미 규칙을 적어 두었는데도 규칙이 깨졌기 때문이다.
 * globals.css는 「눈금은 11 / 12.5 / 13.5 / 15 / 17입니다. 새 값을 여기에 더하지 마세요」라고
 * 적어 두었고, 같은 파일이 행간 3단(1.3 / 1.45 / 1.6)까지 선언해 두었다. 그런데 2026-08-25
 * 실측에서 눈금 밖 폰트 56곳, 규칙 밖 행간 247곳(전체 행간 선언의 34%)이 나왔다.
 * 문서로만 있는 규칙은 다음 화면에서 다시 깨진다 — 그래서 여기서 센다.
 *
 * 브라우저를 띄우지 않는다. src 아래 소스를 읽어 문자열을 셀 뿐이다.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (entry.endsWith(".tsx")) out.push(path);
  }
  return out;
}

const FILES = walk(SRC).map((path) => ({
  /** 저장소 기준 경로 — 실패 메시지에 그대로 싣는다. */
  rel: path.slice(ROOT.length + 1).replaceAll("\\", "/"),
  source: readFileSync(path, "utf8"),
}));

/** 규칙을 어긴 자리를 「파일:줄 — 내용」으로 모은다(0건이 아닐 때 어디를 고칠지 바로 보이게). */
function hits(pattern: RegExp, skip: (rel: string) => boolean = () => false): string[] {
  const found: string[] = [];
  for (const file of FILES) {
    if (skip(file.rel)) continue;
    file.source.split("\n").forEach((line, i) => {
      const matches = line.match(new RegExp(pattern.source, "g"));
      if (matches) found.push(`${file.rel}:${i + 1} ${matches.join(" ")}`);
    });
  }
  return found;
}

describe("디자인 눈금 게이트", () => {
  it("데스크톱 시절 폭 제한이 남아 있지 않다", () => {
    /* 화면은 어느 뷰포트에서도 430px 앱 프레임이다(globals.css `--chim-frame-w`).
       `max-w-[600px]`·`max-w-[624px]` 같은 값은 절대 발동하지 않는 죽은 상수인데,
       프레임 폭을 바꾸는 날 갑자기 되살아나 그 화면만 다르게 접힌다.
       globals.css의 `--chim-desk-w`·`--chim-read-w`는 「참조 0건」으로 지웠지만 리터럴로
       박혀 있던 값들은 그 grep에 걸리지 않아 살아남았던 자리다. */
    expect(hits(/max-w-\[[5-9]\d\dpx\]/)).toEqual([]);
  });

  it("행간은 1.3 / 1.45 / 1.6 세 단만 쓴다", () => {
    /* 예외는 둘뿐이고 둘 다 이 패턴에 걸리지 않는다 —
       /report 가림 결과 문단 1.85와 40px 실측 수치 1.05. */
    expect(hits(/leading-\[1\.(?:2|35|4|5|55|65|7|75|8)\]/)).toEqual([]);
  });

  it("같은 값에 리터럴과 토큰을 함께 쓰지 않는다", () => {
    /* `--radius-card: 14px` · `--radius-field: 12px`가 이미 이름을 갖고 있다.
       리터럴이 섞여 있으면 토큰을 고쳐도 앱의 일부만 움직인다. */
    expect(hits(/rounded-\[1[24]px\]/)).toEqual([]);
  });

  it("글자 크기는 눈금(11 / 12.5 / 13.5 / 15 / 17 / 19 / 22) 안에 있다", () => {
    /* 12px(0.75rem) · 13px(0.8125rem) · 14px(0.875rem) · 14.5px(0.9063rem)은
       눈금 사이에 낀 값이고, 13.5와 14.5는 비율 1.07이라 지각 역치 아래여서
       위계를 만들지 못하고 편차만 남긴다.

       예외는 **종이에 실리는 두 자리**뿐이다 — 이수 확인서와 기관 콘솔의 증빙 묶음.
       그 값들은 430px 화면이 아니라 A4에 맞춰 잡혀 있어 화면 눈금과 다른 규칙을 따른다.
       (두 파일 전체를 여는 것이 아니라, 화면 쪽 문장은 이미 눈금으로 흡수해 두었다.) */
    const PRINT_SHEETS = [
      "src/app/history/certificate/_components/CertificateSheet.tsx",
      "src/app/console/_components/ConsoleClient.tsx",
    ];
    expect(
      hits(/text-\[0\.(?:75|8125|875|9063)rem\]/, (rel) => PRINT_SHEETS.includes(rel)),
    ).toEqual([]);
  });
});
