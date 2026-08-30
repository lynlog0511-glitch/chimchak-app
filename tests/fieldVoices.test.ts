/**
 * 현장의 말 — 인용이 개작되지 않는지, 참여자를 가리키는 표기가 화면으로 새지 않는지 못 박는다.
 *
 * 이 검사가 필요한 이유는 인용이 **고치기 쉬운 모양**을 하고 있기 때문이다. 「요양 보호사분들이」는
 * 맞춤법 검사기가 잡아 주는 자리이고, 말줄임 한 글자는 마침표 셋으로 바꾸기 쉬우며, 잘린 문장은
 * 다듬고 싶어진다. 그 손질이 한 번만 들어가도 화면은 「들은 말」이라고 적어 둔 채 우리가 쓴
 * 문장을 보여 주게 된다. 그래서 정본을 이 파일에 **따로 한 벌** 적어 둔다 — 데이터 파일만 고치면
 * 여기서 걸리고, 두 곳을 같이 고치려면 손이 한 번 더 멈춘다.
 *
 * 두 번째 절은 인용·맥락·바탕 문면에 사람을 가리키는 표기가 없는지 센다. 실명뿐 아니라
 * 「참여자 A」 같은 부호도 대상이다 — 부호는 익명처럼 보이지만 한 사람의 말을 한 이름으로 묶고,
 * 그 묶음은 다른 정보와 맞추면 좁혀진다.
 *
 * 브라우저를 띄우지 않는다. 상수를 직접 읽거나(앞 두 절), 화면 파일의 소스를 읽어 배선 한 줄을
 * 문자열로 확인한다(마지막 절 — `import`가 실제로 있는지까지만 보고, 렌더 결과는 보지 못한다).
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FIELD_VOICES, FIELD_VOICE_BASIS } from "@/data/fieldVoices";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ORG_PAGE = readFileSync(join(ROOT, "src/app/for-orgs/page.tsx"), "utf8");

/**
 * 녹취 축자 정본 — 인터뷰 기록에서 온 문자열이다.
 *
 * **코드 쪽 사정으로 고치지 않는다.** 검사가 빨간불이면 고칠 곳은 여기가 아니라
 * `src/data/fieldVoices.ts`다(둘이 갈라졌다는 뜻이고, 갈라진 쪽은 개작이다).
 */
const VERBATIM = [
  "요구를 하면 들어줘야 되는 성질이라… 두려움이 앞서 갖고 못 하고 있는 거예요",
  "요양 보호사분들이 실습생들을 접근을 못하게 해요. 대응이 안 되기 때문에",
] as const;

/** 화면에 나가는 문면 — 인용 · 맥락 · 바탕 한 줄. `id`는 화면에 나가지 않으므로 빼고 센다. */
const SHOWN = [
  ...FIELD_VOICES.flatMap((voice) => [voice.quote, voice.context]),
  FIELD_VOICE_BASIS,
];

describe("현장의 말 — 녹취 축자", () => {
  it("인용 2건이 정본과 한 글자도 다르지 않다", () => {
    expect(FIELD_VOICES.map((voice) => voice.quote)).toEqual([...VERBATIM]);
  });

  it("고치고 싶어지는 세 자리가 원문 그대로다", () => {
    /* 정본 비교가 이미 셋을 다 덮지만, 실패했을 때 **어디가 손질됐는지**를 검사 이름이
       말해 주도록 자리를 따로 못 박는다. 셋 다 실제로 손이 가는 자리다. */
    const [boundary, noPractice] = VERBATIM;

    // ① 말줄임은 한 글자(…)다 — 마침표 셋으로 펴면 축자가 아니다.
    expect(FIELD_VOICES[0]?.quote).toContain("성질이라… 두려움이");
    expect(FIELD_VOICES[0]?.quote).not.toContain("...");
    // ② 원문의 띄어쓰기 — 붙여 쓰는 것이 맞는 낱말이지만 들은 대로 둔다.
    expect(FIELD_VOICES[1]?.quote).toContain("요양 보호사분들이");
    expect(FIELD_VOICES[1]?.quote).not.toContain("요양보호사분들이");
    // ③ 끝을 다듬지 않는다 — 두 인용 모두 맺음말 없이 끊긴 채로 남는다.
    expect(boundary.endsWith("거예요")).toBe(true);
    expect(noPractice.endsWith("때문에")).toBe(true);
  });

  it("맥락 한 줄은 인용이 아니라 우리가 쓴 서술문이다", () => {
    /* 맥락 칸에 낫표가 들어가면 화면이 요지를 인용처럼 보여 주게 된다 — 낫표는 축자에만 쓴다. */
    for (const voice of FIELD_VOICES) {
      expect(voice.context.length).toBeGreaterThan(0);
      expect(voice.context).not.toContain("「");
      expect(voice.context).not.toContain("」");
      expect(voice.context).not.toContain(voice.quote);
    }
  });
});

describe("현장의 말 — 참여자 식별 표기", () => {
  it("화면 문면에 실명 꼴이 없다", () => {
    /* 「홍길동 씨」·「김 여사」처럼 사람을 부르는 꼴을 센다. 인터뷰 인용은 사람을 부를 일이
       없으므로, 이 꼴이 하나라도 생겼다면 화자나 등장인물이 이름으로 적혔다는 뜻이다. */
    const nameLike = /[가-힣]{1,3}\s*(?:씨|님|여사|선생|반장|팀장|원장)(?![가-힣])/;
    const hits = SHOWN.filter((text) => nameLike.test(text));
    expect(hits).toEqual([]);
  });

  it("화면 문면에 참여자 부호가 없다", () => {
    /* 부호는 두 갈래로 막는다.
       ① 「참여자 A」·「응답자 1」처럼 이름을 붙여 부르는 꼴.
       ② 라틴 문자 자체 — 이 문면은 전부 한글이라, 알파벳이 한 글자라도 서면 그것은 부호이거나
          코드가 새어 나온 것이다. 아직 모르는 표기까지 함께 막으려고 거부 목록 대신 이 쪽을 쓴다. */
    const participantCode = /(?:참여자|응답자|면담자|제보자|대상자|사례)\s*[A-Za-z0-9]/;
    expect(SHOWN.filter((text) => participantCode.test(text))).toEqual([]);
    expect(SHOWN.filter((text) => /[A-Za-z]/.test(text))).toEqual([]);
  });

  it("바탕 한 줄이 출처와 대표성 한계를 같은 자리에서 말한다", () => {
    expect(FIELD_VOICE_BASIS).toContain("서면 동의");
    expect(FIELD_VOICE_BASIS).toContain("익명");
    expect(FIELD_VOICE_BASIS).toContain("대표하지는 않습니다");
  });
});

describe("현장의 말 — 기관 화면 배선", () => {
  it("기관 화면이 축자를 손으로 옮겨 적지 않고 정본을 부른다", () => {
    /* 화면에 문자열을 다시 적으면 두 곳이 갈라지고, 갈라진 쪽은 더 이상 인용이 아니다.
       소스 문자열만 보는 검사라 렌더 결과까지는 보지 못한다 — 여기서 세는 것은
       「정본을 부르는가」와 「축자를 겹쳐 적지 않았는가」 둘뿐이다. */
    expect(ORG_PAGE).toContain("@/data/fieldVoices");
    expect(ORG_PAGE).toContain("FIELD_VOICES");
    expect(ORG_PAGE).toContain("FIELD_VOICE_BASIS");

    for (const quote of VERBATIM) expect(ORG_PAGE).not.toContain(quote);
    expect(ORG_PAGE).not.toContain(FIELD_VOICE_BASIS);
  });
});
