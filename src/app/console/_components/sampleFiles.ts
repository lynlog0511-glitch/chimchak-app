/**
 * 시연용 예시 이수 사실 파일 — 콘솔 미리보기에서 「올려 보실 파일」을 만드는 자리.
 *
 * 왜 두는가: 이 화면은 여러 사람의 이수 사실 파일을 모아 보는 화면인데, 무대에서는 그 파일이
 * 한 벌도 없습니다. 다른 기기 서너 대를 돌려 만들 시간이 없으므로, **앱이 내보내는 것과 같은
 * 서식**으로 예시 파일을 이 기기에서 만들어 두고 그것을 올려 시연합니다.
 *
 * 지키는 선 셋.
 *  1. 서식을 새로 만들지 않습니다 — `buildCompletionCsv`(저장소)를 그대로 부릅니다. 예시 파일이
 *     앱의 서식과 어긋나면 시연에서만 통하는 가짜가 되고, 대조 화면이 무엇을 검증하는지도 흐려집니다.
 *  2. 시나리오는 편성표에 실린 것만 씁니다(`SCENARIOS`) — 파서가 편성표 밖 번호를 거르므로,
 *     예시가 그 규칙을 비껴가는 특혜를 받지 않습니다.
 *  3. **예시라는 사실을 파일 이름에 적습니다** — `chimchak-sample-…`. 파일 안에는 예시 표시를
 *     넣을 칸이 없어서(서식 계약은 저장소가 들고 있습니다), 화면에서 그 한계를 함께 밝힙니다.
 *
 * 담기는 것은 발급번호·시나리오·이수 횟수·시수뿐이라, 예시에도 사람을 가리키는 값은 없습니다.
 */

import { SCENARIOS } from "@/data/scenarios";
import { buildCompletionCsv, type CompletionLine, type CompletionSummary } from "@/lib/storage";

/** 예시 한 줄 — 한 시나리오를 몇 회·몇 분 이수한 것으로 둘지. */
export interface SampleLineSpec {
  scenarioId: string;
  count: number;
  /** 이 줄의 이수 시수(분). 한 회차 30분 상한 안에서만 적습니다(파서가 그 위를 거릅니다). */
  minutes: number;
  /** 오늘로부터 며칠 전에 마친 것으로 둘지 */
  daysAgo: number;
  hour: number;
  minute: number;
}

/** 예시 파일 한 벌. */
export interface SampleFileSpec {
  /** 발급번호 — 앱이 만드는 것과 같은 서식(CHK-0000-0000)이어야 파서를 통과합니다. */
  number: string;
  /** 화면 버튼에 적는 이름 */
  label: string;
  /** 버튼 아래 한 줄 — 무엇이 담긴 파일인지 */
  note: string;
  lines: SampleLineSpec[];
}

/**
 * 예시 세 벌 — 한 팀에서 흔히 나오는 세 모양입니다.
 *
 * ① 고르게 이수한 사람, ② 응급·치매 쪽을 많이 돌린 사람, ③ 이제 막 시작한 사람.
 * 세 벌을 다 올리면 과정별 합계에 인원이 갈리는 줄과 한 사람만 이수한 줄이 함께 생겨,
 * 기관 관점 표가 무엇을 보여 주는 화면인지 한눈에 드러납니다.
 */
export const SAMPLE_FILES: readonly SampleFileSpec[] = [
  {
    number: "CHK-51A7-3C0E",
    label: "예시 ①",
    note: "고르게 이수한 경우 — 4회 · 3종",
    lines: [
      { scenarioId: "CHK-A01", count: 2, minutes: 9, daysAgo: 12, hour: 14, minute: 20 },
      { scenarioId: "CHK-B02", count: 1, minutes: 5, daysAgo: 6, hour: 12, minute: 35 },
      { scenarioId: "CHK-C01", count: 1, minutes: 6, daysAgo: 3, hour: 10, minute: 5 },
    ],
  },
  {
    number: "CHK-6D20-B48F",
    label: "예시 ②",
    note: "응급·치매를 여러 번 돌린 경우 — 6회 · 4종",
    lines: [
      { scenarioId: "CHK-A01", count: 1, minutes: 4, daysAgo: 15, hour: 9, minute: 40 },
      { scenarioId: "CHK-A02", count: 2, minutes: 10, daysAgo: 9, hour: 21, minute: 15 },
      { scenarioId: "CHK-B01", count: 1, minutes: 4, daysAgo: 5, hour: 16, minute: 50 },
      { scenarioId: "CHK-B02", count: 2, minutes: 9, daysAgo: 2, hour: 12, minute: 25 },
    ],
  },
  {
    number: "CHK-9F3B-1E07",
    label: "예시 ③",
    note: "이제 막 시작한 경우 — 2회 · 2종",
    lines: [
      { scenarioId: "CHK-B02", count: 1, minutes: 5, daysAgo: 4, hour: 13, minute: 10 },
      { scenarioId: "CHK-C02", count: 1, minutes: 6, daysAgo: 1, hour: 11, minute: 30 },
    ],
  },
];

/** 편성표에 실린 시나리오 — 제목·유형을 여기서 가져옵니다(예시에도 창작한 제목을 넣지 않습니다). */
const SCENARIO_BY_ID = new Map(SCENARIOS.map((scenario) => [scenario.id.toUpperCase(), scenario]));

/** 며칠 전 몇 시 — 기기 현지 시각입니다(파일의 시각 표기도 현지 시각입니다). */
function pastMoment(now: Date, daysAgo: number, hour: number, minute: number): Date {
  const at = new Date(now.getTime());
  at.setDate(at.getDate() - daysAgo);
  at.setHours(hour, minute, 0, 0);
  return at;
}

/**
 * 예시 한 벌을 이수 사실 요약으로 만듭니다 — 파일을 만드는 재료입니다.
 *
 * 시수는 줄마다 분 단위 그대로(초 = 분 × 60) 두고 합계는 줄 값의 합으로 잡습니다.
 * 파서가 「줄 값의 합 = 파일에 적힌 합계」를 대조하므로, 여기서 어긋나면 예시가 스스로
 * 걸러집니다 — 그 대조를 예시도 똑같이 통과해야 시연이 정직해집니다.
 */
export function buildSampleSummary(spec: SampleFileSpec, now: Date = new Date()): CompletionSummary {
  const lines: CompletionLine[] = spec.lines.map((line) => {
    const scenario = SCENARIO_BY_ID.get(line.scenarioId.toUpperCase());
    return {
      scenarioId: line.scenarioId.toUpperCase(),
      title: scenario?.title ?? line.scenarioId,
      typeLabel: scenario?.typeLabel ?? "",
      count: line.count,
      seconds: line.minutes * 60,
      lastEndedAt: pastMoment(now, line.daysAgo, line.hour, line.minute).toISOString(),
    };
  });

  const totalCount = lines.reduce((sum, line) => sum + line.count, 0);
  const totalSec = lines.reduce((sum, line) => sum + line.seconds, 0);

  return {
    number: spec.number,
    totalCount,
    totalSec,
    lines,
    hiddenCount: 0,
    importedCount: 0,
    importedSec: 0,
  };
}

/** 예시 파일 이름 — 시연용이라는 사실을 이름에 적어 둡니다. */
export function sampleFileName(spec: SampleFileSpec): string {
  return `chimchak-sample-${spec.number}.csv`;
}

/**
 * 예시 파일 한 벌의 내용(CSV 문자열)을 만듭니다.
 *
 * @example
 * const csv = buildSampleCsv(SAMPLE_FILES[0]);
 * parseCompletionCsv(csv).ok; // true
 */
export function buildSampleCsv(spec: SampleFileSpec, now: Date = new Date()): string {
  return buildCompletionCsv(buildSampleSummary(spec, now), now.toISOString());
}
