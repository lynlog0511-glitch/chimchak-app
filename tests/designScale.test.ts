/**
 * 디자인 눈금 게이트 — 가이드 §7의 grep 블랙리스트를 파일로 못 박는다.
 *
 * 이 검사가 있는 이유는 가이드가 이미 규칙을 적어 두었는데도 규칙이 깨졌기 때문이다.
 * globals.css는 「눈금은 11 / 12.5 / 13.5 / 15 / 17입니다. 새 값을 여기에 더하지 마세요」라고
 * 적어 두었고, 같은 파일이 행간 3단(1.3 / 1.45 / 1.6)까지 선언해 두었다. 그런데 2026-08-25
 * 실측에서 눈금 밖 폰트 56곳, 규칙 밖 행간 247곳(전체 행간 선언의 34%)이 나왔다.
 * 문서로만 있는 규칙은 다음 화면에서 다시 깨진다 — 그래서 여기서 센다.
 *
 * ── 거부 목록이 아니라 허용 목록 (2026-08-26 마무리) ─────────
 * 「아는 값을 막는」 거부 목록은 아직 모르는 값을 통과시킨다. 실제로 사다리 게이트가
 * 거부 목록이던 동안 18px·28px이 그대로 지나갔다. 그래서 사다리·브레이크포인트·leading-none·
 * brand-700을 차례로 뒤집었고, 마지막까지 거부 목록이던 **반지름·행간 임의값 둘**도
 * 2026-08-26에 뒤집었다(5차 페르소나 디자이너 low·P2). 지금 이 파일이 세는 **열다섯 규칙**
 * (검사는 열여섯이다 — 브레이크포인트만 예외 파일의 개수를 따로 한 번 더 센다) 중
 * 「모르는 값이 통과할 수 있는」 것은 없다.
 *
 * ── 미결 목록 (PENDING) ──────────────────────────────────────
 * 아래 몇몇 검사에는 `PENDING_*`이라는 별도 목록이 있다. 「사유가 있어 열어 둔 예외」가 아니라
 * **아직 안 고친 자리**이고, 다른 구역이 소유한 파일이라 이 커밋이 손대지 않은 것들이다.
 * 파일과 개수를 못 박아 두었으므로 늘어나면 실패한다. 고치는 쪽은 실코드를 고친 뒤
 * 이 목록에서 줄을 지우면 된다 — 목록이 비면 그 검사는 예외 없는 규칙이 된다.
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

/** 정규식이 잡은 것을 「파일 → 개수」로 센다(허용 목록과 통째로 비교하는 검사들이 쓴다). */
function countByFile(pattern: RegExp, only?: (rel: string) => boolean): Record<string, number> {
  const counted: Record<string, number> = {};
  for (const file of FILES) {
    if (only && !only(file.rel)) continue;
    const n = file.code.match(new RegExp(pattern.source, "g"))?.length ?? 0;
    if (n > 0) counted[file.rel] = n;
  }
  return counted;
}

/**
 * 타이포 사다리 — 화면이 쓰는 열두 값(가이드 §9-7).
 *   40 · 29 · 23 · 22 · 19 · 17 · 16 · 15 · 13.5 · 12.5 · 11.5 · 11px
 * 화면 쪽 `text-[Xrem]`과 CSS의 `font-size` 선언, SVG의 `fontSize` 속성이 **같은 목록**을 본다.
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

/** 같은 사다리를 px로 본 목록 — SVG `fontSize` 속성이 이쪽을 본다(rem을 못 받는 자리다). */
const LADDER_PX = new Set([11, 11.5, 12.5, 13.5, 15, 16, 17, 19, 22, 23, 29, 40]);

/** 행간 3단 — 1.3(제목) · 1.45(밀집) · 1.6(본문). */
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

  it("행간 임의값은 3단뿐이고, 예외 둘은 파일·개수까지 목록과 같다", () => {
    /* 2026-08-26에 **허용 목록으로 뒤집었다.** 예전에는 아홉 값을 이름으로 거부하는
       거부 목록(`leading-[1.2|1.35|…]`)이라 `leading-[1.15]`·`leading-[1.9]`·`leading-[2]`처럼
       아직 모르는 값이 그대로 통과했다. 사다리를 뒤집은 것과 같은 이유이고, 뒤집는 시점의
       위반이 0건이라 회귀 위험도 0이었다(5차 페르소나 디자이너 low).

       globals.css가 인정한 예외는 둘뿐인데 그동안 **어디에도 등재돼 있지 않았다** —
       정규식이 못 잡아서 지나갔을 뿐이다. 같은 성격의 `leading-none`은 파일·개수를 못 박은
       목록을 갖는데 이쪽만 무기록이었다. 이제 둘도 같은 방식으로 못 박는다.
         · 1.05 — 40px 실측 수치(라이브 계측 패널 셋). 숫자 한 줄이라 행간이 위아래 여백으로만
           남고, 3단을 주면 40px 글자가 칸 밖으로 밀린다.
         · 1.85 — /report 가림 결과 문단. 문장 사이에 인라인 칩이 서는 자리라, 칩이 윗줄을
           건드리지 않으려면 본문 1.6보다 한 단 넓어야 한다(가이드 §4.9). */
    const EXCEPTIONS: Record<string, Record<string, number>> = {
      "leading-[1.05]": {
        "src/app/safety/_components/LiveMeterPanel.tsx": 1,
        "src/app/safety/_components/LiveProofPanel.tsx": 1,
        "src/app/safety/_components/RuleEngineProof.tsx": 1,
      },
      "leading-[1.85]": {
        "src/app/report/_components/MaskReview.tsx": 2,
      },
    };

    const offLadder: string[] = [];
    const counted: Record<string, Record<string, number>> = {};
    for (const file of FILES) {
      file.code.split("\n").forEach((line, i) => {
        for (const match of line.matchAll(/leading-\[([0-9.]+)\]/g)) {
          if (LINE_HEIGHTS.has(match[1]!)) continue;
          if (!(match[0]! in EXCEPTIONS)) {
            offLadder.push(`${file.rel}:${i + 1} ${match[0]}`);
            continue;
          }
          const per = (counted[match[0]!] ??= {});
          per[file.rel] = (per[file.rel] ?? 0) + 1;
        }
      });
    }

    /** 3단 밖이면서 예외 목록에도 없는 값 — 이름을 모르는 값도 여기서 걸린다. */
    expect(offLadder).toEqual([]);
    /** 예외 둘은 자리와 개수까지 목록과 같아야 한다(조용히 번지는 것을 막는 자리). */
    expect(counted).toEqual(EXCEPTIONS);
  });

  it("반지름은 토큰 클래스이고, 리터럴은 목록에 등재된 것뿐이다", () => {
    /* 2026-08-26에 **허용 목록으로 뒤집었다.** 예전에는 `rounded-[12px]`·`rounded-[14px]`만
       거부해서, 토큰이 있는 값인 16px(`--radius-panel`)과 18px이 그대로 통과했다 —
       실제로 /report 녹음 패널이 `rounded-[16px]`, /practice 컴포저가 `rounded-[18px]`이었고,
       뒤쪽은 「rem 높이 + px 반지름」이라 「아주 크게」에서 양 끝이 반원이 아니었다
       (5차 페르소나 디자이너 low). 둘 다 이번에 토큰 클래스로 고쳤다.

       지금 규칙: `rounded-*`는 **토큰 클래스**이거나, 아래 목록에 **사유와 개수까지** 등재된
       리터럴이어야 한다. 목록에 없는 임의값은 그것이 무엇이든 여기서 걸린다.

       토큰(globals.css @theme): card 14 · panel 16 · field 12 · chip 999.
       `rounded-full`은 Tailwind 기본값이지만 **원형 도형 전용**으로 남긴다 — 아바타·점·마이크는
       「알약(chip)」이 아니라 「원」이고, 둘을 한 이름으로 묶으면 pill의 999px을 바꾸는 날
       원까지 따라온다. (`--radius-bubble` 18px은 2026-08-26에 지웠다 — 말풍선은 네 모서리가
       서로 다른 값이라 단일 토큰으로 적을 수 없고, 실제 사용이 0건이었다.) */
    const TOKEN_RADIUS = /^rounded-(?:[trbl]{1,2}-)?(?:card|panel|field|chip|full|none)$/;

    /** 등재된 리터럴 — 「클래스 문자열 → 전체 개수」. 사유는 각 줄 옆에 적는다. */
    const ALLOWED_RADIUS_LITERALS: Record<string, number> = {
      "rounded-t-[22px]": 3, // 바텀시트 상단(가이드 §3) — 시트 셋: CF·규칙 예시·자유 연습 중단
      "rounded-[4px_18px_18px_18px]": 4, // 인물 말풍선 — 발화 방향 모서리만 4px(가이드 §4.3)
      "rounded-[18px_4px_18px_18px]": 2, // 학습자 말풍선 — 같은 규칙의 좌우 대칭
      "rounded-[10px]": 1, // /check 실패 마크 — 한 글자 사각 마커의 작은 변형
      "rounded-[9px]": 1, // 응급 재생기 단계 번호 — 7×7 정사각 안 글리프
      "rounded-[6px]": 5, // 가림 인라인 칩(가이드 §4.9가 6px으로 지정) — /report 넷 · /history 하나
      "rounded-[5px]": 2, // 코칭 델타 칩 — 11px 글자에 6px은 과해 한 단 아래
      "rounded-[2px]": 1, // 세션 진행 막대(3px 높이) — 토큰은 전부 이보다 크다
      "rounded-[1px]": 2, // 파형 막대(3px 폭) — 끝을 죽이지 않을 만큼만
    };

    const offList: string[] = [];
    const counted: Record<string, number> = {};
    for (const file of FILES) {
      file.code.split("\n").forEach((line, i) => {
        for (const match of line.matchAll(/\brounded-(?:[a-z]+-)?(?:\[[^\]]+\]|[a-z0-9]+)/g)) {
          const cls = match[0]!;
          if (TOKEN_RADIUS.test(cls)) continue;
          if (!(cls in ALLOWED_RADIUS_LITERALS)) {
            offList.push(`${file.rel}:${i + 1} ${cls}`);
            continue;
          }
          counted[cls] = (counted[cls] ?? 0) + 1;
        }
      });
    }

    expect(offList).toEqual([]);
    expect(counted).toEqual(ALLOWED_RADIUS_LITERALS);
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

       사다리 목록(`LADDER`)은 이 파일 위쪽에 있다 — 아래 「CSS 선언」·「SVG 속성」 검사가
       같은 목록을 본다. */

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
          const value = match[1]!;
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

       정규식 주의: 뒤에 클래스 문자가 **바로** 붙는 경우만 센다. 크기 변형 객체의 키처럼
       콜론 뒤에 공백이 오는 자리는 걸리지 않는다 —
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

  it("한 값에 이름 하나 — 지운 별칭 토큰과 `white`를 쓰지 않는다", () => {
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

       ── `white`가 여기 있는 이유 (2026-08-26) ──────────────────
       별칭 아홉을 정리하면서 정작 **가장 큰 사례**를 세지 않았다. #ffffff의 정본은
       `--color-paper`인데 실측은 `bg-white` 39곳 대 `bg-paper` 28곳, `text-white` 17곳 대
       `text-paper` 0곳으로, 별칭 정리의 명분이던 28:29와 **같은 모양**이었다.
       갈라지는 자리가 하필 규칙을 세우는 쪽이었다 — 면 카드의 정본을 정하는 `Card.tsx`가
       `paper: "bg-white"`였고, 한 className 문자열 안에 `bg-paper … active:bg-white`가
       함께 선 자리도 있었다(5차 페르소나 디자이너 med).
       `white`는 지운 토큰이 아니라 **Tailwind 내장 이름**이라 「지웠으니 안 쓴다」가 통하지
       않는다 — 그래서 규칙을 목록에 넣어 여기서 센다. 값이 같아 시각 결과는 0이다. */
    const PREFIX = "text|bg|border|fill|stroke|ring|outline|divide|placeholder|from|via|to|shadow";
    const ALIAS =
      "tertiary|extra-faint|faint|tint|deep|neutral-soft|paper-rail|mint-100|brand-100|white";
    const aliasRe = new RegExp(`\\b(?:${PREFIX})-(?:${ALIAS})\\b`);

    /**
     * 아직 안 고친 자리 — 이 커밋이 소유하지 않은 파일들이다(다른 구역이 편집 중).
     * 값이 같아 화면 결함은 없고, 고치는 쪽은 `bg-white`→`bg-paper`·`text-white`→`text-paper`로
     * 바꾼 뒤 여기서 줄을 지우면 된다. **늘어나면 실패한다.**
     */
    /* 6차 리드 정리로 잔여 13곳 전부 `paper` 정본으로 치환 — 목록이 비었고, 비어 있어야 한다. */
    const PENDING_WHITE: Record<string, number> = {};

    expect(hits(aliasRe, (rel) => rel in PENDING_WHITE)).toEqual([]);
    expect(
      countByFile(
        new RegExp(`\\b(?:${PREFIX})-white\\b`),
        (rel) => rel in PENDING_WHITE,
      ),
    ).toEqual(PENDING_WHITE);
    /* CSS 변수로 우회하는 길도 함께 막는다(`var(--color-tint)` 같은 인라인 style). */
    expect(hits(new RegExp(`var\\(--color-(?:${ALIAS})\\)`))).toEqual([]);
  });

  it("생 hex `#ffffff`는 토큰 이름을 쓸 수 없는 자리에만 있다", () => {
    /* 위 검사가 클래스 이름(`bg-white`)을 막는다면 이 검사는 **값 자체**를 막는다.
       둘 다 필요하다 — 이름을 못 쓰게 하면 생 hex로 우회하는 길이 열리기 때문이다.
       등재된 넷은 전부 「Tailwind 클래스가 닿지 않는 자리」라는 같은 성격을 갖는다.
       (#ffffff만 센다. 다른 hex는 globals.css의 토큰 정의와 인쇄면 검정뿐이라 다투는 이름이 없다.) */
    const ALLOWED_RAW_WHITE: Record<string, { count: number; why: string }> = {
      "src/app/globals.css": {
        count: 1,
        why: "`--color-paper: #ffffff` — 정본 정의 그 자체. 값이 사는 유일한 자리다.",
      },
      "src/app/global-error.tsx": {
        count: 1,
        why: "루트 레이아웃을 대체하는 화면이라 globals.css가 적용되지 않는다 — 상수 이름은 `PAPER`다.",
      },
      "src/app/console/_components/ConsoleClient.tsx": {
        count: 3,
        why: "인쇄용 `<style>` 문자열의 `!important` — @media print에서 지면을 흰색으로 되돌린다.",
      },
      "src/app/history/certificate/_components/CertificateSheet.tsx": {
        count: 3,
        why: "같은 이유(이수 확인서 인쇄면).",
      },
    };

    const expected = Object.fromEntries(
      Object.entries(ALLOWED_RAW_WHITE).map(([rel, entry]) => [rel, entry.count]),
    );
    expect(countByFile(/#ffffff/i)).toEqual(expected);
  });

  it("행간은 Tailwind 프리셋으로도 3단 밖을 쓰지 않는다", () => {
    /* 위 「행간 임의값」 검사는 임의값(`leading-[1.25]`)만 셌다.
       그래서 같은 값을 프리셋 클래스로 적으면 그물을 통과했다 — 2026-08-26 실측에서
       `TierIndicator`의 네 줄이 `leading-tight`(1.25)·`leading-relaxed`(1.625)로 적혀 있었다.
       **다만 그 파일은 임포트가 0건이라 화면에 나간 적이 없다**(5차 페르소나 디자이너 med) —
       규칙은 옳고, 근거는 「출고되던 것을 껐다」가 아니라 「출고되기 전에 막았다」다.
       그 컴포넌트는 같은 날 파일째 지웠다.

       프리셋 값: tight 1.25 · snug 1.375 · normal 1.5 · relaxed 1.625 · loose 2.
       1.25는 1.3에서 0.05, 1.625는 1.6에서 0.025 떨어져 있다 — globals.css가
       「0.05 차이는 지각 역치 아래라 위계를 만들지 못하고 편차만 만듭니다」라고 적은 바로 그 구간이다. */
    expect(hits(/\bleading-(?:tight|snug|normal|relaxed|loose)\b/)).toEqual([]);
  });

  it("장식 루프를 쓰지 않는다 — animate-pulse 0건", () => {
    /* 가이드 §6은 「금지: 장식 루프」이고 globals.css의 등장 모션은 **240ms·180ms 두 단뿐**이다.
       Tailwind의 `animate-pulse`는 2s 무한 반복이라 그 목록에 없는 셋째 어휘다.
       기다리는 화면(스켈레톤)은 **움직이지 않는 회색 면**이다 — 깜빡이면 중고령 사용자에게
       「고장」으로 읽힌다. reduced-motion 가드가 있어도 예외로 열지 않는다(가드는 설정하신
       분에게만 닿고, 대부분은 설정하지 않은 채 그 점멸을 본다).
       2026-08-26 실측: 저장소에 한 자리 남아 있었고(`TierIndicator`의 L2 칩) 그 파일은
       렌더 0건이었다 — 화면에 나가기 전에 규칙으로 막은 경우다. 지금은 파일도 없다. */
    expect(hits(/\banimate-pulse\b/)).toEqual([]);
  });

  it("leading-none은 단일 글리프 자리에만 있고, 그 자리와 개수가 목록과 같다", () => {
    /* `leading-none`(line-height: 1)은 3단 사다리의 예외로 **열어 둔다** — 줄이 하나뿐인
       글리프(셰브론 `›`·화살표·54px 원 안의 `✓`)에서는 행간이 위아래 여백으로만 남아
       도형을 세로 중앙에서 밀어내기 때문이다. 다만 열어 두기만 하면 「행간을 없애는 클래스」가
       문장에도 번진다. 그래서 `sm:` 오버레이 예외와 **같은 방식**으로 파일과 개수를 못 박는다.

       목록을 늘리려면 여기와 가이드 §9-11을 함께 고쳐야 하고, 그 마찰이 이 예외가 조용히
       넓어지는 것을 막는다. 줄이 둘 이상인 글자라면 예외를 늘리지 말고 `.chim-*` 단이나
       `leading-[1.3|1.45|1.6]`을 쓰면 된다.

       ※ 세는 대상은 **출고되는 코드**다(주석은 위 `stripComments`가 지운다). 가이드 §9-11도
         같은 수를 적는다 — 2026-08-26까지 문서가 「13곳」이라고 적었는데 그중 하나는
         globals.css의 주석 언급이었다(5차 페르소나 디자이너 low). 지금은 양쪽 다 12곳이다. */
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

    expect(countByFile(/\bleading-none\b/)).toEqual(ALLOWED_LEADING_NONE);
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
          const [value, unit] = [match[1]!, match[2]!];
          if (unit !== "rem" || !LADDER.has(value)) {
            badSize.push(`${file.rel}:${i + 1} ${match[0]}`);
          }
        }
        for (const match of line.matchAll(/line-height:\s*([0-9.]+)\s*;/g)) {
          if (!LINE_HEIGHTS.has(match[1]!)) badLine.push(`${file.rel}:${i + 1} ${match[0]}`);
        }
      });
    }

    expect(badSize).toEqual([]);
    expect(badLine).toEqual([]);
  });

  it("SVG가 속성으로 적는 글자 크기도 같은 사다리 안이다", () => {
    /* 게이트는 `text-[Xrem]`과 CSS `font-size:` 둘만 봤다. 그래서 `/safety` 근거 확인 흐름도의
       글자들이 **어느 검사에도 걸리지 않았다** — SVG는 `fontSize={17}`처럼 속성으로 적기
       때문이다. 실제로 그 그림 안에만 20px이 살아 있었고, 20은 사다리 열두 값에 없다
       (5차 페르소나 디자이너 low — 「앱에서 유일한 타이포 섬」).

       SVG는 rem을 받지 못하므로 **px 숫자를 사다리와 비교한다.** 그 숫자가 화면에서 실제
       몇 px이 되는지는 바깥 폭이 정하는데, 그 그림은 폭을 viewBox와 1:1(45rem = 720px)로
       맞춰 두어 좌표 1이 곧 1px이고 루트가 커지면 함께 커진다(`EvidenceFlow` 주석 참조).

       ※ 인라인 `style={{ fontSize: 17 }}` 객체는 이 검사의 대상이 아니다. 그 문법을 쓰는 곳은
         `global-error.tsx` 한 곳뿐이고, 그 화면은 globals.css가 무너진 뒤 뜨는 자리라
         px 고정이 **의도**임을 파일 머리말이 적어 두었다. */
    const found: string[] = [];
    for (const file of FILES) {
      file.code.split("\n").forEach((line, i) => {
        for (const match of line.matchAll(/fontSize=\{([0-9.]+)\}/g)) {
          if (!LADDER_PX.has(Number(match[1]))) found.push(`${file.rel}:${i + 1} ${match[0]}`);
        }
      });
    }
    expect(found).toEqual([]);
  });

  it("brand-700 글자를 색 면 위에 얹지 않는다 — 눌림 면도 색 면이다", () => {
    /* **brand-700(#157f75)은 지면 조건부다.** 흰 지면에서만 AA(4.86:1)이고 색 면에서는 전부 미달:
         paper-2 4.49 · ok-soft 4.41 · warn-soft 4.37 · brand-tint 4.31 · danger-soft 4.31
       (AA 하한 4.5:1 · 2026-08-26 실측). 값이 다섯이라 외울 수 없으므로 규칙 한 줄로 기억한다 —
       **흰 지면이 아니면 brand-800**(같은 다섯 면에서 6.27 · 6.16 · 6.10 · 6.02 · 6.02).

       이 규칙은 2026-08-25에 globals.css 주석·가이드 §9-8·홈 주석 **세 곳에 적혔는데도**
       실코드는 이름을 댄 두 자리만 고쳐졌고, 정작 그 주석이 대표 사례로 든 「이어서 ›」와
       /train 카드 CTA 7장·델타 칩·/check 발표자 도구 4자리가 그대로 샜다
       (3차 페르소나 디자이너 med · UI/UX low). 그래서 문장이 아니라 여기서 센다.

       ── 눌림 면 (2026-08-26 교정) ────────────────────────────
       8/26에는 「변형 접두(`active:`·`hover:`)가 붙은 면은 세지 않는다」였다. 그런데 같은 날
       globals.css와 가이드 §9-8은 「**눌림 면까지 따라옵니다**」를 새로 적었고, 실코드에는
       그 틈에 `text-brand-700 … active:bg-paper-2`가 다섯 자리 있었다 — 문서·게이트·실코드가
       셋 다 다른 말을 하는 상태였다(5차 페르소나 디자이너 low).
       **규칙을 하나로 정한다: 지면이 흰색이 아닌 순간이 있으면 brand-800이다.**
       눌림은 손끝 아래 150ms이지만 그 150ms가 4.49를 만드는 순간이고, 고치는 값은 낱말 다섯 개다.
       그래서 이 검사는 이제 변형 접두가 붙은 면도 **함께 센다**.

       ── 두 겹으로 센다 ────────────────────────────────────────
       ① 같은 className 문자열 안의 동거 — 예외 없이 0건. (`.ts`의 클래스 문자열도 포함된다.)
       ② 색 면과 `text-brand-700`이 **같은 파일 안에** 있으면, 그 파일은 아래 허용 목록에
          등재돼 있어야 한다. 정규식으로는 「이 글자가 그 면 **안**에 있는가」를 알 수 없다 —
          홈 `ResumeCard`는 면이 86행, 글자가 107행이라 ①로는 잡히지 않았다. 그래서 파일 단위로
          사람을 한 번 세우고, 흰 지면임을 확인한 자리만 목록에 남긴다.

       `bg-brand-700`(흰 글자를 얹는 채움)은 이 규칙의 대상이 아니다 — 대상은 `text-brand-700`뿐이다. */
    const SURFACE = "paper-2|brand-tint|ok-soft|warn-soft|danger-soft";
    const surfaceRe = new RegExp(`(?<![\\w-])(?:[a-z][\\w-]*:)*bg-(?:${SURFACE})\\b`);
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
        "「콘솔 미리보기 열어 보기 ›」는 paper-2 카드가 닫힌 뒤 흰 지면에 선다",
      "src/app/history/certificate/_components/CertificateSheet.tsx":
        "「기관 담당자용 안내 보기 ›」는 인쇄면 밖 `data-noprint` 블록의 흰 지면에 선다",
      "src/app/safety/_components/EvidenceFlow.tsx":
        "번호 글리프 둘은 `border-t` 행(흰 지면)이고, paper-2 카드는 그 아래 다른 블록이다",
    };

    const pairs = FILES.filter(
      (file) => surfaceRe.test(file.code) && inkRe.test(file.code),
    ).map((file) => file.rel);
    expect(pairs.sort()).toEqual(Object.keys(ALLOWED_WHITE_GROUND).sort());
  });

  it("아이브로는 한 벌이다 — 손수 사본은 문단을 넣을 수 없는 자리뿐이다", () => {
    /* 섹션 아이브로(12.5px / 700 / +.06em / ink-muted)는 `components/EyebrowLabel.tsx`가 정본이다.
       그런데 실측에서 손수 사본이 컴포넌트와 맞먹었고(사용 46 대 손수 36), 더 나쁘게는
       **자간이 두 값으로 갈려 있었다** — `.06em` 19줄 · `.04em` 17줄. 같은 역할의 이름표가
       화면마다 다른 굵기·자간으로 서고, 한 파일이 같은 낱말을 한 번은 컴포넌트로 한 번은
       손으로 적는 자리까지 있었다(5차 페르소나 디자이너 med).
       2026-08-26에 자간을 **.06em 한 값**으로 정하고 손수 `<p>` 스물여덟을 컴포넌트로 흡수했다.

       남는 것은 **문단(`<p>`)을 넣을 수 없는 자리**뿐이다 — 링크·`<summary>` 안의 `<span>`,
       `<dl>`의 `<dt>`, 표의 `<th>`. 그 자리들은 같은 값을 인라인으로 적고 사유를 주석으로 남긴다.
       여기서 파일·개수를 못 박아, 「예외라서 손으로 적었다」가 다시 늘지 않게 한다. */
    const eyebrowRe = /text-\[0\.7813rem\][^"]*tracking-\[0\.0\d+em\]/;

    const ALLOWED_INLINE_EYEBROW: Record<string, number> = {
      "src/components/EyebrowLabel.tsx": 1, // 정본 그 자체
      "src/app/console/_components/ConsoleClient.tsx": 1, // 표 머리 `<th>`
      "src/app/guide/page.tsx": 1, // 링크 제목 안 `<span>`
      "src/app/history/_components/HistoryBoard.tsx": 1, // 추천 카드 링크 안 `<span>`
      "src/app/safety/page.tsx": 2, // `<summary>` 안 절 번호 · `<dl>`의 `<dt>`
      "src/app/safety/_components/AiMap.tsx": 1, // `<dl>`의 `<dt>`
      "src/app/emergency/[id]/page.tsx": 2, // `<dl>`의 `<dt>` — 아래 PENDING 참조
    };

    expect(countByFile(eyebrowRe)).toEqual(ALLOWED_INLINE_EYEBROW);

    /**
     * 자간 .04em은 **한 자리도 남지 않아야 한다.** 아래 둘만 아직 안 고쳤다 —
     * 다른 구역이 소유한 파일이라 이 커밋이 손대지 않았고, 고치는 쪽은 `.04em`을 `.06em`으로
     * 바꾼 뒤 이 목록을 비우면 된다. 그러면 이 줄은 `toEqual({})`가 된다.
     * (줄 번호가 아니라 파일·개수로 적는다 — 같은 파일을 다른 사람이 편집해도 흔들리지 않게.)
     */
    /* 6차 리드 정리로 응급 상세 `<dt>` 두 자리를 .06em+행간으로 통일 — 비어 있어야 한다. */
    const PENDING_TRACKING_04: Record<string, number> = {};
    expect(countByFile(/tracking-\[0\.04em\]/)).toEqual(PENDING_TRACKING_04);
  });

  it("짧은 라벨 액션은 높이만이 아니라 48px 폭도 갖는다", () => {
    /* 48px은 이 앱이 스스로 세운 터치 타깃 하한이다(`TabBar.tsx`). 그런데 규칙이 `min-h`로만
       적혀 있어서 **폭이 빠진 자리**가 라운드마다 새로 나왔다 — 3차에 「닫기」 넷, 5차에
       MaskReview 「닫기」와 /console 「빼기」가 같은 방식으로 남았다. 두 번 다 사람이 손으로
       세었고 두 번 다 형제 하나를 놓쳤다(5차 페르소나 UI/UX low — 「고치는 단위가 그 줄」).
       그래서 여기서 센다.

       ── 어떻게 세는가 ────────────────────────────────────────
       라벨이 길면 폭은 저절로 48px을 넘으므로, 규칙의 대상은 **짧은 라벨**이다.
       그래서 「글자 수」 같은 어림수 대신 폭을 실제로 어림한다:
         폭 ≈ 글자 크기 × (한글 글자 수 + 0.55 × 그 밖의 글자 수) + 좌우 `px-*`
       한글은 전각이라 글자 크기와 거의 같은 폭을 차지하고, 라틴·숫자는 그 절반쯤이다.
       13.5px 두 글자면 27px, `px-2`(16px)를 더해도 43px이라 48px에 못 미친다 — 실제로
       /console에서 39×48px으로 실측된 그 자리다. 세 글자면 56px이라 그냥 통과한다.

       48px에 못 미치면 `min-w-[48px]`가 있거나, 폭이 부모에 의해 늘어나는 것이
       클래스에 적혀 있어야 한다(`w-full`·`flex-1`·`flex-[…]`·`grow`·`self-stretch`).

       ── 못 세는 자리 ─────────────────────────────────────────
       이 검사는 **여는 태그 바로 뒤에 글자가 오는 경우**만 읽는다. 라벨이 표현식이면
       그 안의 문자열 리터럴 중 가장 짧은 것을 라벨로 보고, 리터럴이 없으면(변수·함수 호출)
       건너뛴다. 클래스가 공용 상수로 빠져 있는 자리도 라벨이 쓰는 쪽에 있어 여기서는 못 센다 —
       아래 `UNREADABLE`에 그 자리를 적어 두어, 「못 세는 자리」가 조용히 늘어나면 알게 한다. */
    const CJK = /[ᄀ-ᇿ㄰-㆏가-힣　-〿㐀-鿿＀-￯]/g;
    const STRETCH = ["min-w-[48px]", "w-full", "flex-1", "flex-[", "flex-auto", "grow", "self-stretch"];

    function fontPx(cls: string): number {
      const arbitrary = /text-\[([0-9.]+)rem\]/.exec(cls);
      if (arbitrary) return Number(arbitrary[1]) * 16;
      if (cls.includes("chim-caption")) return 13.5;
      if (cls.includes("chim-label")) return 15;
      if (cls.includes("chim-core-sm")) return 17;
      return 16; // 선언이 없으면 본문 단을 상속한다고 본다(가장 너그러운 가정).
    }

    function padPx(cls: string): number {
      const literal = /(?<![\w-])px-\[(\d+)px\]/.exec(cls);
      if (literal) return 2 * Number(literal[1]);
      const step = /(?<![\w-])px-([0-9.]+)/.exec(cls);
      if (step) return 2 * Number(step[1]) * 4; // Tailwind 한 단 = 0.25rem = 4px
      return 0;
    }

    /**
     * 아직 안 고친 자리 — 다른 구역이 소유한 파일이다(「종료」 두 글자, 약 43px).
     * 고치는 쪽은 `min-w-[48px] justify-center`를 더한 뒤 이 목록을 비우면 된다.
     * 줄 번호가 아니라 파일·개수로 적는다 — 같은 파일을 다른 사람이 편집해도 흔들리지 않게.
     */
    /* 6차 리드 정리로 세션 「종료」에 min-w 부여 — 비어 있어야 한다. */
    const PENDING_NARROW: Record<string, number> = {};

    /**
     * 클래스가 공용 상수로 빠져 라벨을 못 읽는 자리 — **늘어나면 알아야 한다.**
     * (라벨이 쓰는 쪽에 있어 이 검사로는 폭을 어림할 수 없다.)
     */
    const UNREADABLE: Record<string, number> = {
      "src/app/emergency/_components/PlayerParts.tsx": 1, // 재생기 컨트롤 공통 클래스
      "src/app/report/_components/VoiceInput.tsx": 1, // 보조 버튼 공통 클래스
      "src/components/BigButton.tsx": 1, // 크기 변형 표(md)
      "src/components/ListRow.tsx": 1, // 행 공통 클래스
    };

    const narrow: string[] = [];
    const pending: Record<string, number> = {};
    const unreadable: Record<string, number> = {};

    for (const file of FILES) {
      if (!file.rel.endsWith(".tsx")) continue;
      const code = file.code;
      for (const match of code.matchAll(/min-h-\[48px\]/g)) {
        const at = match.index;
        const line = code.slice(0, at).split("\n").length;

        // 여는 태그의 끝(`>`)을 찾는다. 그 전에 `<`가 나오면 태그 안이 아니다(공용 클래스 상수).
        let cursor = at + match[0].length;
        while (cursor < code.length && code[cursor] !== "<" && code[cursor] !== ">") cursor += 1;
        if (cursor >= code.length || code[cursor] === "<") {
          unreadable[file.rel] = (unreadable[file.rel] ?? 0) + 1;
          continue;
        }

        const textEnd = code.indexOf("<", cursor);
        let label = code.slice(cursor + 1, textEnd === -1 ? undefined : textEnd).trim();
        if (label.includes("{") || label.includes("}")) {
          const literals = [...label.matchAll(/"([^"\n]*)"/g)]
            .map((m) => m[1]!.trim())
            .filter(Boolean);
          if (literals.length === 0) continue; // 변수·함수 라벨 — 여기서는 못 센다
          label = literals.reduce((a, b) => (a.length <= b.length ? a : b));
        }
        if (!label) continue;

        const cls = code.slice(code.lastIndexOf("<", at), cursor);
        const cjk = label.match(CJK)?.length ?? 0;
        const other = label.replace(/ /g, "").length - cjk;
        const width = fontPx(cls) * (cjk + 0.55 * other) + padPx(cls);
        if (width >= 48) continue;
        if (STRETCH.some((token) => cls.includes(token))) continue;
        if (file.rel in PENDING_NARROW) {
          pending[file.rel] = (pending[file.rel] ?? 0) + 1;
          continue;
        }
        narrow.push(`${file.rel}:${line} 「${label}」 ≈${Math.round(width)}px`);
      }
    }

    expect(narrow).toEqual([]);
    expect(pending).toEqual(PENDING_NARROW);
    expect(unreadable).toEqual(UNREADABLE);
  });
});
