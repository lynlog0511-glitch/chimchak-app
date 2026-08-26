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

  it("글자 크기는 사다리 열두 값 안에 있고, 예외는 가이드 §9-7에 적힌 자리뿐이다", () => {
    /* 예전에는 「끼어든 값 넷(12·13·14·14.5px)을 금지」하는 **거부 목록**이었다.
       거부 목록은 이미 아는 값만 막아서, 2026-08-25 실측에서 18px(확인서·콘솔 h2)과
       28px(워터마크)이 그 그물을 그대로 통과해 있었다. 그래서 **허용 목록**으로 뒤집는다 —
       사다리에 없는 값은 그것이 무엇이든 여기서 걸린다.

       사다리는 렌더된 13개 화면이 실제로 쓰는 열두 값이다(가이드 §9-7):
         40 · 29 · 23 · 22 · 19 · 17 · 16 · 15 · 13.5 · 12.5 · 11.5 · 11px

       예외 목록은 **가이드 §9-7과 같은 내용**이다. 늘리려면 두 곳을 함께 고쳐야 하고,
       그 마찰이 예외가 조용히 번지는 것을 막는다.
         · 확인서·콘솔 — 이 두 문서는 430px 화면이 아니라 **A4**에 맞춰 잡혀 있다.
           (화면 쪽 문장은 2026-08-25에 전부 사다리로 흡수했다: 경고 문단 14→15 ·
            기입값 14→15 · h2 18→19. 여기 남은 것은 종이 값뿐이다.)
         · 엔딩 한 글자 마커 24px — 54px 원 안의 `✓`/`↺`다. 읽는 글자가 아니라 도형이고
           `aria-hidden`이며, 뜻은 옆의 `sr-only` 라벨이 전한다.
       `@media print` 블록 안의 `pt`·`mm`은 애초에 이 검사의 대상이 아니다(종이의 단위다). */
    const LADDER = new Set([
      "0.6875", // 11
      "0.7188", // 11.5
      "0.7813", // 12.5
      "0.8438", // 13.5
      "0.9375", // 15
      "1", // 16
      "1.0625", // 17
      "1.1875", // 19
      "1.375", // 22
      "1.4375", // 23
      "1.8125", // 29
      "2.5", // 40
    ]);

    /** 파일별로 열어 둔 눈금 밖 값 — 가이드 §9-7의 예외 목록과 같은 값이다. */
    const ALLOWED_EXCEPTIONS: Record<string, string[]> = {
      "src/app/history/certificate/_components/CertificateSheet.tsx": ["0.75", "0.8125", "1.75"],
      "src/app/console/_components/ConsoleClient.tsx": ["0.75", "0.8125"],
      "src/app/train/_components/EndingPanel.tsx": ["1.5"],
    };

    const found: string[] = [];
    for (const file of FILES) {
      const allowed = ALLOWED_EXCEPTIONS[file.rel] ?? [];
      file.source.split("\n").forEach((line, i) => {
        for (const match of line.matchAll(/text-\[([0-9.]+)rem\]/g)) {
          const value = match[1];
          if (LADDER.has(value) || allowed.includes(value)) continue;
          found.push(`${file.rel}:${i + 1} ${match[0]}`);
        }
      });
    }
    expect(found).toEqual([]);
  });

  it("뷰포트 브레이크포인트(sm:·md:·lg:)를 쓰지 않는다", () => {
    /* 화면은 어느 뷰포트에서도 같은 앱이다 — 폭이 430px로 고정된 프레임 안이라,
       브레이크포인트가 보는 것은 **내용 폭이 아니라 창 폭**이다. 그래서 같은 428px 화면이
       브라우저 창 폭에 따라 다르게 접혔다: /console의 버튼 셋이 600px 뷰포트에서 각 348px
       전폭이다가, 1265px에서 각 189px로 **줄면서** 오른쪽에 159px 누더기 여백을 남겼다
       (2026-08-25 디자이너 실측). 창을 넓혔는데 버튼이 좁아지는, 아무도 예상하지 못하는 동작이고
       팀이 폰으로 확인하는 한 절대 걸리지 않는다 — 하필 심사는 노트북·프로젝터 폭에서 벌어진다.

       원인은 순서였다. 430px 고정 프레임 확정(8/25)이 하루 앞선 `sm:`(8/24)을 쓸고 가지 않았고,
       리터럴 max-w는 위 게이트에 걸렸지만 브레이크포인트는 grep 대상이 아니어서 살아남았다.
       같은 일이 다음 웨이브에 반복되지 않도록 여기서 센다.

       예외는 **전체 뷰포트 오버레이 한 곳**뿐이다(디자이너 판정). 종료 확인 모달은 `fixed inset-0`
       으로 프레임이 아니라 뷰포트를 덮으므로, 좁은 폭에서는 바텀시트(items-end)·넓은 폭에서는
       가운데(items-center)가 맞다 — 여기서는 창 폭이 곧 내용의 무대다.

       정규식 주의: 뒤에 클래스 문자가 **바로** 붙는 경우만 센다. `icons/glyphs.tsx`의
       `sm: 14`처럼 크기 변형 객체의 키는 콜론 뒤에 공백이 오므로 걸리지 않는다 —
       금지하려는 것은 Tailwind 접두이지 `sm`이라는 이름이 아니다. */
    const OVERLAY_EXCEPTION = "src/app/train/_components/TrainSession.tsx";
    expect(
      hits(/\b(?:sm|md|lg|xl|2xl):(?=[a-z-])/, (rel) => rel === OVERLAY_EXCEPTION),
    ).toEqual([]);
  });

  it("오버레이 예외는 한 곳뿐이고, 그 한 곳은 실제로 그 자리에 있다", () => {
    /* 위 예외를 파일 단위로 열어 두었으므로, 그 파일이 예외를 **실제로 쓰고 있는지**와
       쓰는 자리가 하나인지를 함께 못 박는다. 예외 목록이 「한때 필요했던 파일」로 남아
       조용히 넓어지는 것을 막는 자리다. */
    const overlay = FILES.find(
      (file) => file.rel === "src/app/train/_components/TrainSession.tsx",
    );
    const found = overlay?.source.match(/\b(?:sm|md|lg|xl|2xl):(?=[a-z-])/g) ?? [];
    expect(found).toEqual(["sm:"]);
  });

  it("한 값에 이름 하나 — 지운 별칭 토큰을 쓰지 않는다", () => {
    /* 같은 hex에 이름이 둘·셋씩 붙어 있고 사용이 거의 반반으로 갈려 있었다
       (#69716e → `tertiary` 28곳 vs `ink-faint` 29곳 · #e7f4f2 → `tint` 12 · `brand-tint` 7 ·
        `brand-100` 3). 화면에 시각적으로 틀린 것은 없었지만, 한 값에 두 이름이 붙어 있으면
       언젠가 한쪽만 바뀐다 — 그리고 이 혼란이 이미 사람을 헷갈리게 한 증거가 있었다:
       `TabBar.tsx`가 #9aa5a2를 `ink-faint`(그건 #69716e다)라고 잘못 적고 있었다.

       2026-08-25에 별칭 아홉을 globals.css에서 지우고 사용처 64곳을 정본으로 치환했다.
         tertiary → ink-faint · faint → ink-ghost · extra-faint → ink-disabled
         tint · brand-100 · mint-100 → brand-tint · deep → brand-on-tint
         neutral-soft · paper-rail → paper-2
       Tailwind v4는 없는 토큰을 조용히 무시하므로, 하나라도 되살아나면 그 요소만 색이
       빠진 채 출고된다. 그래서 이름을 지운 것으로 끝내지 않고 여기서 센다(가이드 §9-8).

       정규식 주의: 유틸리티 접두까지 통째로 잡는다. `text-ink-faint`·`bg-brand-tint`처럼
       **정본** 이름 안에 옛 낱말이 들어 있는 경우는 접두가 붙지 않아 걸리지 않는다. */
    const PREFIX = "text|bg|border|fill|stroke|ring|outline|divide|placeholder|from|via|to|shadow";
    const ALIAS = "tertiary|extra-faint|faint|tint|deep|neutral-soft|paper-rail|mint-100|brand-100";
    expect(hits(new RegExp(`\\b(?:${PREFIX})-(?:${ALIAS})\\b`))).toEqual([]);
    /* CSS 변수로 우회하는 길도 함께 막는다(`var(--color-tint)` 같은 인라인 style). */
    expect(hits(new RegExp(`var\\(--color-(?:${ALIAS})\\)`))).toEqual([]);
  });
});
