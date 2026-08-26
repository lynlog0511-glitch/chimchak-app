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

/**
 * 걷는 확장자 — `.tsx` **와 `.ts`·`.css`**다.
 *
 * 2026-08-26까지는 `.tsx`만 걸었다. 그 한 줄 때문에 그물 밖에 있던 것들이 실제로 있었다:
 *   · `globals.css`의 `.chim-core { font-size: 1.125rem }` — 사다리에 없는 18px을,
 *     같은 파일이 「눈금은 11/12.5/13.5/15/17/19/22」라고 적어 둔 채로 선언하고 있었다.
 *   · `train/_components/constants.ts`의 `"bg-ok-soft text-brand-700"` — 클래스 문자열이
 *     `.ts`에 살면 화면 검사를 통째로 비껴간다(델타 칩 4.41:1, AA 미달).
 * 화면에 나가는 값이 어느 확장자에 적혀 있는지는 규칙과 아무 상관이 없다(3차 페르소나 디자이너 P0).
 */
const SCANNED = [".tsx", ".ts", ".css"];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (SCANNED.some((ext) => entry.endsWith(ext))) out.push(path);
  }
  return out;
}

/**
 * 주석을 **같은 길이의 공백**으로 지운다(줄 번호와 열 위치가 그대로 남게).
 *
 * 이 코드베이스는 규칙을 주석으로 설명한다 — 「`leading-tight`는 1.25라 3단 밖입니다」처럼
 * **금지된 낱말을 그대로 적어야** 다음 사람이 이유를 안다. 원문을 그대로 세면 그 설명들이
 * 전부 위반으로 잡혀, 게이트를 통과시키려면 설명을 지워야 하는 뒤집힌 상태가 된다.
 * 그래서 세는 것은 **출고되는 코드**뿐이다.
 *
 * 문자열·템플릿 리터럴 안은 건드리지 않는다 — 클래스 이름이 사는 곳이 바로 거기다.
 */
function stripComments(source: string): string {
  const out: string[] = [];
  type Mode = "code" | "line" | "block" | "'" | '"' | "`";
  let mode: Mode = "code";

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];

    if (mode === "code") {
      if (ch === "/" && next === "/") {
        mode = "line";
        out.push("  ");
        i += 1;
      } else if (ch === "/" && next === "*") {
        mode = "block";
        out.push("  ");
        i += 1;
      } else if (ch === "'" || ch === '"' || ch === "`") {
        mode = ch;
        out.push(ch);
      } else {
        out.push(ch);
      }
      continue;
    }

    if (mode === "line") {
      if (ch === "\n") {
        mode = "code";
        out.push("\n");
      } else {
        out.push(" ");
      }
      continue;
    }

    if (mode === "block") {
      if (ch === "*" && next === "/") {
        mode = "code";
        out.push("  ");
        i += 1;
      } else {
        out.push(ch === "\n" ? "\n" : " ");
      }
      continue;
    }

    // 문자열 안 — 이스케이프를 건너뛰며 닫는 따옴표까지 원문 그대로 옮긴다.
    out.push(ch);
    if (ch === "\\" && next !== undefined) {
      out.push(next);
      i += 1;
    } else if (ch === mode) {
      mode = "code";
    }
  }

  return out.join("");
}

const FILES = walk(SRC).map((path) => {
  const source = readFileSync(path, "utf8");
  return {
    /** 저장소 기준 경로 — 실패 메시지에 그대로 싣는다. */
    rel: path.slice(ROOT.length + 1).replaceAll("\\", "/"),
    source,
    /** 주석을 지운 사본 — 모든 검사는 이쪽을 센다. */
    code: stripComments(source),
  };
});

/** 규칙을 어긴 자리를 「파일:줄 — 내용」으로 모은다(0건이 아닐 때 어디를 고칠지 바로 보이게). */
function hits(pattern: RegExp, skip: (rel: string) => boolean = () => false): string[] {
  const found: string[] = [];
  for (const file of FILES) {
    if (skip(file.rel)) continue;
    file.code.split("\n").forEach((line, i) => {
      const matches = line.match(new RegExp(pattern.source, "g"));
      if (matches) found.push(`${file.rel}:${i + 1} ${matches.join(" ")}`);
    });
  }
  return found;
}

/**
 * 타이포 사다리 — 화면이 쓰는 열두 값(가이드 §9-7).
 *   40 · 29 · 23 · 22 · 19 · 17 · 16 · 15 · 13.5 · 12.5 · 11.5 · 11px
 * 화면 쪽 `text-[Xrem]`과 CSS의 `font-size` 선언이 **같은 목록**을 본다.
 */
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

/** 행간 3단 — 1.3(제목) · 1.45(밀집) · 1.6(본문). 예외는 /report 1.85와 40px 수치 1.05뿐. */
const LINE_HEIGHTS = new Set(["1.3", "1.45", "1.6"]);

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
       `@media print` 블록 안의 `pt`·`mm`은 애초에 이 검사의 대상이 아니다(종이의 단위다).

       사다리 목록(`LADDER`)은 이 파일 위쪽에 있다 — 아래 「CSS 선언」 검사가 같은 목록을 본다. */

    /** 파일별로 열어 둔 눈금 밖 값 — 가이드 §9-7의 예외 목록과 같은 값이다. */
    const ALLOWED_EXCEPTIONS: Record<string, string[]> = {
      "src/app/history/certificate/_components/CertificateSheet.tsx": ["0.75", "0.8125", "1.75"],
      "src/app/console/_components/ConsoleClient.tsx": ["0.75", "0.8125"],
      "src/app/train/_components/EndingPanel.tsx": ["1.5"],
    };

    const found: string[] = [];
    for (const file of FILES) {
      const allowed = ALLOWED_EXCEPTIONS[file.rel] ?? [];
      file.code.split("\n").forEach((line, i) => {
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
    const found = overlay?.code.match(/\b(?:sm|md|lg|xl|2xl):(?=[a-z-])/g) ?? [];
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

  it("행간은 Tailwind 프리셋으로도 3단 밖을 쓰지 않는다", () => {
    /* 위 「행간은 1.3 / 1.45 / 1.6 세 단만」은 **임의값**(`leading-[1.25]`)만 셌다.
       그래서 같은 값을 프리셋 클래스로 적으면 그물을 통과했다 — 2026-08-26 실측에서
       `TierIndicator`의 네 줄이 `leading-tight`(1.25)·`leading-relaxed`(1.625)로 나가고 있었다.
       하필 그 넷은 `.chim-caption`(line-height 1.45)을 쓰면서 유틸리티 레이어가 뒤라
       선언을 이기고 있었으므로, 파일만 읽어서는 1.45로 보이고 브라우저에서만 달랐다.

       프리셋 값: tight 1.25 · snug 1.375 · normal 1.5 · relaxed 1.625 · loose 2.
       1.25는 1.3에서 0.05, 1.625는 1.6에서 0.025 떨어져 있다 — globals.css가
       「0.05 차이는 지각 역치 아래라 위계를 만들지 못하고 편차만 만듭니다」라고 적은 바로 그 구간이다. */
    expect(hits(/\bleading-(?:tight|snug|normal|relaxed|loose)\b/)).toEqual([]);
  });

  it("장식 루프를 쓰지 않는다 — animate-pulse 0건", () => {
    /* 가이드 §6은 「금지: 장식 루프」이고 globals.css의 등장 모션은 **240ms·180ms 두 단뿐**이다.
       Tailwind의 `animate-pulse`는 2s 무한 반복이라 그 목록에 없는 셋째 어휘다.
       2026-08-26 실측: `/history` 스켈레톤 주석이 「`animate-pulse`를 쓰지 않는 것은 이 앱의
       모션 최소 규율」이라고 선언하는 그 순간 `TierIndicator`의 L2 칩이 그것으로 무한 점멸하고
       있었다 — 주석이 다음 사람의 근거로 읽히는 코드베이스에서 정반대를 말하는 두 문장은
       값이 틀린 코드보다 오래 해롭다(3차 페르소나 디자이너 low). 이제 문장이 아니라 여기서 센다.
       기다리는 화면(스켈레톤)은 **움직이지 않는 회색 면**이다 — 깜빡이면 중고령 사용자에게
       「고장」으로 읽힌다. reduced-motion 가드가 있어도 예외로 열지 않는다(가드는 설정하신
       분에게만 닿고, 대부분은 설정하지 않은 채 그 점멸을 본다). */
    expect(hits(/\banimate-pulse\b/)).toEqual([]);
  });

  it("leading-none은 단일 글리프 자리에만 있고, 그 자리와 개수가 목록과 같다", () => {
    /* `leading-none`(line-height: 1)은 3단 사다리의 예외로 **열어 둔다** — 줄이 하나뿐인
       글리프(셰브론 `›`·화살표·54px 원 안의 `✓`)에서는 행간이 위아래 여백으로만 남아
       도형을 세로 중앙에서 밀어내기 때문이다. 다만 열어 두기만 하면 「행간을 없애는 클래스」가
       문장에도 번진다. 그래서 `sm:` 오버레이 예외와 **같은 방식**으로 파일과 개수를 못 박는다.

       목록을 늘리려면 여기와 가이드 §9-10을 함께 고쳐야 하고, 그 마찰이 이 예외가 조용히
       넓어지는 것을 막는다. 줄이 둘 이상인 글자라면 예외를 늘리지 말고 `.chim-*` 단이나
       `leading-[1.3|1.45|1.6]`을 쓰면 된다. */
    const ALLOWED_LEADING_NONE: Record<string, number> = {
      "src/app/history/_components/ReportList.tsx": 1, // 펼침 셰브론
      "src/app/history/certificate/_components/CertificateSheet.tsx": 1, // 예시 워터마크 한 줄
      "src/app/safety/_components/EvidenceFlow.tsx": 1, // 접힘 셰브론
      "src/app/safety/_components/MobileFold.tsx": 1, // 접힘 셰브론
      "src/app/safety/_components/RubricAllList.tsx": 1, // 접힘 셰브론
      "src/app/safety/page.tsx": 2, // 접힘 셰브론 · 목록 `·`
      "src/app/train/_components/BriefingPanel.tsx": 1, // 되돌아가기 화살표 줄
      "src/app/train/_components/EndingPanel.tsx": 1, // 54px 원 안 `✓`/`↺`
      "src/app/train/page.tsx": 2, // 카드 CTA 셰브론 둘(연습하기 › · 열어 보기 ›)
      "src/components/BackGlyph.tsx": 1, // `‹`
    };

    const counted: Record<string, number> = {};
    for (const file of FILES) {
      const n = file.code.match(/\bleading-none\b/g)?.length ?? 0;
      if (n > 0) counted[file.rel] = n;
    }
    expect(counted).toEqual(ALLOWED_LEADING_NONE);
  });

  it("CSS가 선언하는 글자 크기·행간도 같은 사다리 안이다", () => {
    /* 화면 쪽 `text-[Xrem]`은 허용 목록으로 잠갔는데 **CSS 선언은 아무도 세지 않았다**.
       그 사이로 `globals.css`의 `.chim-core { font-size: 1.125rem }`(18px)가 살아남았고,
       같은 파일이 두 문단 위에서 「눈금은 11/12.5/13.5/15/17/19/22입니다」라고 적고 있었다 —
       공용 규격이 게이트가 금지한 값을 권하는 상태였다(3차 페르소나 디자이너 low).

       단위는 **rem만** 받는다. px로 선언하면 앱의 「글자 크기」 3단(루트 백분율 100/112.5/125%)이
       그 글자만 비껴간다 — 이 제품에서 「아주 크게」는 예외가 아니라 주된 상황이다.
       (인쇄면이 `pt`를 써야 하는 날이 오면 그때 이 검사에 `@media print` 예외를 함께 적는다.
        지금 `globals.css`의 print 블록에는 글자 크기 선언이 없다.) */
    const badSize: string[] = [];
    const badLine: string[] = [];

    for (const file of FILES) {
      if (!file.rel.endsWith(".css")) continue;
      file.code.split("\n").forEach((line, i) => {
        for (const match of line.matchAll(/font-size:\s*([0-9.]+)(rem|px|em|pt)/g)) {
          const [value, unit] = [match[1], match[2]];
          if (unit !== "rem" || !LADDER.has(value)) {
            badSize.push(`${file.rel}:${i + 1} ${match[0]}`);
          }
        }
        for (const match of line.matchAll(/line-height:\s*([0-9.]+)\s*;/g)) {
          if (!LINE_HEIGHTS.has(match[1])) badLine.push(`${file.rel}:${i + 1} ${match[0]}`);
        }
      });
    }

    expect(badSize).toEqual([]);
    expect(badLine).toEqual([]);
  });

  it("brand-700 글자를 색 면 위에 얹지 않는다", () => {
    /* **brand-700(#157f75)은 지면 조건부다.** 흰 지면에서만 AA(4.86:1)이고 색 면에서는 전부 미달:
         paper-2 4.49 · ok-soft 4.41 · warn-soft 4.37 · brand-tint 4.31 · danger-soft 4.31
       (AA 하한 4.5:1 · 2026-08-26 실측). 값이 다섯이라 외울 수 없으므로 규칙 한 줄로 기억한다 —
       **흰 지면이 아니면 brand-800**(같은 다섯 면에서 6.27 · 6.16 · 6.10 · 6.02 · 6.02).

       이 규칙은 2026-08-25에 globals.css 주석·가이드 §9-8·홈 주석 **세 곳에 적혔는데도**
       실코드는 이름을 댄 두 자리만 고쳐졌고, 정작 그 주석이 대표 사례로 든 「이어서 ›」와
       /train 카드 CTA 7장·델타 칩·/check 발표자 도구 4자리가 그대로 샜다
       (3차 페르소나 디자이너 med · UI/UX low). 그래서 문장이 아니라 여기서 센다.

       ── 두 겹으로 센다 ────────────────────────────────────────
       ① 같은 className 문자열 안의 동거 — 예외 없이 0건. (`.ts`의 클래스 문자열도 포함된다.)
       ② 색 면과 `text-brand-700`이 **같은 파일 안에** 있으면, 그 파일은 아래 허용 목록에
          등재돼 있어야 한다. 정규식으로는 「이 글자가 그 면 **안**에 있는가」를 알 수 없다 —
          ResumeCard는 면이 86행, 글자가 107행이라 ①로는 잡히지 않는다. 그래서 파일 단위로
          사람을 한 번 세우고, 흰 지면임을 확인한 자리만 목록에 남긴다.

       변형 접두(`active:`·`hover:`)가 붙은 면은 세지 않는다 — 그 자리의 **정본 지면은 흰색**이고
       색 면은 손끝 아래 150ms다. (그 상태에서도 brand-800이 더 안전한 것은 사실이라,
       새로 만드는 링크는 처음부터 brand-800으로 적는 편이 낫다.)
       `bg-brand-700`(흰 글자를 얹는 채움)은 이 규칙의 대상이 아니다 — 대상은 `text-brand-700`뿐이다. */
    const SURFACE = "paper-2|brand-tint|ok-soft|warn-soft|danger-soft";
    const surfaceRe = new RegExp(`(?<![\\w:-])bg-(?:${SURFACE})\\b`);
    const inkRe = /\btext-brand-700\b/;

    /** ① 같은 문자열 안 동거 — 0건. */
    const sameString: string[] = [];
    for (const file of FILES) {
      file.code.split("\n").forEach((line, i) => {
        if (surfaceRe.test(line) && inkRe.test(line)) {
          sameString.push(`${file.rel}:${i + 1} ${line.trim()}`);
        }
      });
    }
    expect(sameString).toEqual([]);

    /**
     * ② 파일 안 동거 — 흰 지면임을 사람이 확인한 자리만 등재한다.
     * 등재할 때는 **어디가 흰 지면인지**를 함께 적는다(다음 사람이 다시 재지 않아도 되게).
     */
    const ALLOWED_WHITE_GROUND: Record<string, string> = {
      "src/app/for-orgs/page.tsx":
        "「콘솔 미리보기 열어 보기 ›」는 paper-2 카드(145~168행)가 닫힌 뒤 흰 지면에 선다",
      "src/app/history/certificate/_components/CertificateSheet.tsx":
        "「기관 담당자용 안내 보기 ›」는 인쇄면 밖 `data-noprint` 블록의 흰 지면에 선다",
      "src/app/history/_components/HistoryBoard.tsx":
        "빈 상태 링크 셋과 IconSprout는 헤어라인 행(흰 지면)이다 — 면 카드 안에는 brand-700이 없다",
      "src/app/history/_components/TrainingRow.tsx":
        "「다시 ›」는 행 자체(흰 지면)에 있고, paper-2 패널은 그 아래 펼침 안이다",
      "src/app/safety/_components/EvidenceFlow.tsx":
        "번호 글리프 둘은 `border-t` 행(흰 지면)이고, paper-2 카드는 그 아래 다른 블록이다",
      "src/app/train/page.tsx":
        "「처음 오신 분께 ›」는 카드 목록 밖 고지 줄(흰 지면)에 선다",
    };

    const pairs = FILES.filter(
      (file) => surfaceRe.test(file.code) && inkRe.test(file.code),
    ).map((file) => file.rel);
    expect(pairs.sort()).toEqual(Object.keys(ALLOWED_WHITE_GROUND).sort());
  });
});
