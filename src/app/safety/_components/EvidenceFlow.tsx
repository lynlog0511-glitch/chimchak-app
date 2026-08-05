import { IconAlert, IconCheckCircle } from "@/components/icons";

/**
 * 근거 확인 흐름도.
 *
 * 팀 시안(AI Safety Architecture)의 구도를 그대로 따르되, 표현은 1.5px 스트로크
 * 라인 다이어그램으로 옮겼습니다. 색은 잉크·틸·주황 3색만 씁니다.
 *
 * 구성
 *  - md 이상: SVG 다이어그램 한 장 (720×600 좌표계 = md 폭에서 1:1로 그려집니다).
 *    좌표계를 md 본문 폭(720px)에 맞춰 두었기 때문에, 가장 좁은 표시 폭에서도
 *    SVG 안 글자가 15px 아래로 내려가지 않습니다. 큰 화면에서는 880px까지만 키웁니다
 *    (그 이상 키우면 다이어그램 글자가 본문보다 커져 위계가 뒤집힙니다 — v3 §1-7).
 *  - md 미만: 같은 내용을 세로 스텝 목록으로 보여 줍니다(가로 스크롤 없음).
 *
 * v3 반영
 *  - 모바일 스텝의 왼쪽 세로줄·색 점, 분기 블록의 왼쪽 4px 바를 전부 걷어냈습니다(§1-2).
 *    구분은 번호·hairline 행·옅은 면과 [아이콘+라벨] 한 줄로만 만듭니다.
 *  - 다이어그램 안 인용 앞 세로 막대도 옅은 면으로 바꿨습니다.
 *
 * 접근성
 *  - SVG는 role="img" + title/desc로 흐름 전체를 한 문장으로 읽어 줍니다.
 *  - 모바일 목록은 실제 텍스트라 확대·낭독에 그대로 대응합니다.
 *  - 애니메이션 없음.
 */

/* ── 내용 ──────────────────────────────────────────────────── */

interface FlowNode {
  key: string;
  title: string;
  /** 세로 스텝 목록(모바일)에서 읽히는 한 문장 */
  caption: string;
  /** 다이어그램 안 두 줄 — 한 줄 11자 안쪽으로 유지합니다(상자 안쪽 폭 192). */
  lines: readonly [string, string];
}

const INPUT_NODES: readonly FlowNode[] = [
  {
    key: "say",
    title: "사용자 대응",
    caption: "실제 상황처럼 직접 말합니다.",
    lines: ["실제 상황처럼", "직접 말합니다"],
  },
  {
    key: "stt",
    title: "음성 인식",
    caption: "말한 내용을 글로 바꿉니다. 음성 원본은 서버로 보내지 않습니다.",
    lines: ["말을 글로 바꿉니다", "원본은 보내지 않습니다"],
  },
  {
    key: "search",
    title: "근거 검색",
    caption: "화이트리스트에 등재된 문서 안에서만 근거를 찾습니다.",
    lines: ["화이트리스트 문서에서", "근거를 찾습니다"],
  },
];

const YES_NODES: readonly FlowNode[] = [
  {
    key: "rubric",
    title: "루브릭 판정",
    caption: "현직 감수 루브릭 30개 항목을 기준으로 판정합니다.",
    lines: ["현직 감수 루브릭 30개", "기준으로 판정합니다"],
  },
  {
    key: "feedback",
    title: "피드백 + 출처",
    caption: "잘한 점과 보완점을 근거 문서·음성 안내와 함께 보여 줍니다.",
    lines: ["잘한 점 · 보완점", "근거 문서 · 음성 안내"],
  },
];

const NO_NODES: readonly FlowNode[] = [
  {
    key: "halt",
    title: "생성 중단",
    caption: "근거 없는 답은 만들지 않습니다.",
    lines: ["근거 없는 답은", "만들지 않습니다"],
  },
  {
    key: "ask",
    title: "확인 안내",
    caption: "담당 간호사 또는 기관에 확인하도록 안내합니다.",
    lines: ["담당 간호사·기관에", "확인하도록 안내합니다"],
  },
];

/** 근거를 찾지 못했을 때 화면에 그대로 나가는 고정 문구입니다(문구 변경 금지). */
const NO_SOURCE_LINES = [
  "「공식 지침에서 근거를 찾지 못했습니다.",
  "담당 간호사 또는 기관에 확인해 주세요.」",
] as const;

const L3_TITLE = "L3 실제 응급은 생성을 거치지 않습니다";
const L3_SUB = "검수된 고정 스크립트만 재생하고, 119 안내를 가장 먼저 띄웁니다";

const FLOW_DESC =
  "사용자 대응, 음성 인식, 근거 검색을 거쳐 근거 확인 단계에 이릅니다. " +
  "근거를 찾으면 루브릭 판정과 피드백·출처 표시로 이어지고, " +
  "찾지 못하면 생성을 중단하고 담당 간호사·기관 확인 안내로 넘어갑니다. " +
  "L3 실제 응급 구간은 생성을 거치지 않습니다.";

/* ── 다이어그램 기하 ───────────────────────────────────────── */

const BOX_W = 216;
const BOX_H = 96;
const COL_L = 6;
const COL_M = 252;
const COL_R = 498;
const ROW_1 = 10;
const ROW_3 = 272;
const ROW_4 = 396;
const DIA_CX = COL_M + BOX_W / 2; // 360
const DIA_CY = 190;
const DIA_HW = 108;
const DIA_HH = 50;

type Tone = "ink" | "warn";

function FlowBox({ x, y, node, tone = "ink" }: { x: number; y: number; node: FlowNode; tone?: Tone }) {
  const cx = x + BOX_W / 2;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={BOX_W}
        height={BOX_H}
        rx={12}
        strokeWidth={1.5}
        className={tone === "warn" ? "fill-white stroke-warn-ink" : "fill-white stroke-line-strong"}
      />
      <text
        x={cx}
        y={y + 34}
        textAnchor="middle"
        fontSize={17}
        fontWeight={700}
        className={tone === "warn" ? "fill-warn-ink" : "fill-ink"}
      >
        {node.title}
      </text>
      <text x={cx} y={y + 59} textAnchor="middle" fontSize={15} className="fill-ink-soft">
        {node.lines[0]}
      </text>
      <text x={cx} y={y + 80} textAnchor="middle" fontSize={15} className="fill-ink-soft">
        {node.lines[1]}
      </text>
    </g>
  );
}

function FlowDiagram() {
  return (
    <svg
      viewBox="0 0 720 600"
      role="img"
      aria-labelledby="sfy-flow-title sfy-flow-desc"
      className="mx-auto h-auto w-full max-w-[880px]"
    >
      <title id="sfy-flow-title">근거 확인 흐름도</title>
      <desc id="sfy-flow-desc">{FLOW_DESC}</desc>

      <defs>
        <marker
          id="sfy-arrow-ink"
          viewBox="0 0 12 12"
          refX="10"
          refY="6"
          markerWidth="8"
          markerHeight="8"
          orient="auto-start-reverse"
        >
          <path
            d="M 2.5 2.5 L 10 6 L 2.5 9.5"
            fill="none"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-ink-muted"
          />
        </marker>
        <marker
          id="sfy-arrow-teal"
          viewBox="0 0 12 12"
          refX="10"
          refY="6"
          markerWidth="8"
          markerHeight="8"
          orient="auto-start-reverse"
        >
          <path
            d="M 2.5 2.5 L 10 6 L 2.5 9.5"
            fill="none"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-brand-600"
          />
        </marker>
        <marker
          id="sfy-arrow-warn"
          viewBox="0 0 12 12"
          refX="10"
          refY="6"
          markerWidth="8"
          markerHeight="8"
          orient="auto-start-reverse"
        >
          <path
            d="M 2.5 2.5 L 10 6 L 2.5 9.5"
            fill="none"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-warn-ink"
          />
        </marker>
      </defs>

      {/* 1행 — 입력 사슬 */}
      <FlowBox x={COL_L} y={ROW_1} node={INPUT_NODES[0]!} />
      <FlowBox x={COL_M} y={ROW_1} node={INPUT_NODES[1]!} />
      <FlowBox x={COL_R} y={ROW_1} node={INPUT_NODES[2]!} />

      <path
        d="M 222 58 H 252"
        fill="none"
        strokeWidth={1.5}
        className="stroke-ink-muted"
        markerEnd="url(#sfy-arrow-ink)"
      />
      <path
        d="M 468 58 H 498"
        fill="none"
        strokeWidth={1.5}
        className="stroke-ink-muted"
        markerEnd="url(#sfy-arrow-ink)"
      />

      {/* 근거 검색 → 근거 확인 */}
      <path
        d="M 606 106 V 128 H 360 V 140"
        fill="none"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-ink-muted"
        markerEnd="url(#sfy-arrow-ink)"
      />

      {/* 판단 — 근거 확인 */}
      <polygon
        points={`${DIA_CX},${DIA_CY - DIA_HH} ${DIA_CX + DIA_HW},${DIA_CY} ${DIA_CX},${DIA_CY + DIA_HH} ${DIA_CX - DIA_HW},${DIA_CY}`}
        strokeWidth={1.5}
        strokeLinejoin="round"
        className="fill-white stroke-brand-600"
      />
      <text
        x={DIA_CX}
        y={DIA_CY + 7}
        textAnchor="middle"
        fontSize={19}
        fontWeight={800}
        className="fill-brand-800"
      >
        근거 확인
      </text>

      {/* 예 — 근거를 찾았을 때 */}
      <path
        d="M 360 240 V 272"
        fill="none"
        strokeWidth={1.5}
        strokeLinecap="round"
        className="stroke-brand-600"
        markerEnd="url(#sfy-arrow-teal)"
      />
      <text x={372} y={262} fontSize={16} fontWeight={700} className="fill-brand-700">
        예
      </text>

      <FlowBox x={COL_M} y={ROW_3} node={YES_NODES[0]!} />
      <FlowBox x={COL_R} y={ROW_3} node={YES_NODES[1]!} />
      <path
        d="M 468 320 H 498"
        fill="none"
        strokeWidth={1.5}
        className="stroke-brand-600"
        markerEnd="url(#sfy-arrow-teal)"
      />

      {/* 아니오 — 근거를 찾지 못했을 때 */}
      <path
        d="M 252 190 H 114 V 272"
        fill="none"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-warn-ink"
        markerEnd="url(#sfy-arrow-warn)"
      />
      <text x={244} y={178} textAnchor="end" fontSize={16} fontWeight={700} className="fill-warn-ink">
        아니오
      </text>

      <FlowBox x={COL_L} y={ROW_3} node={NO_NODES[0]!} tone="warn" />
      <path
        d="M 114 368 V 396"
        fill="none"
        strokeWidth={1.5}
        strokeLinecap="round"
        className="stroke-warn-ink"
        markerEnd="url(#sfy-arrow-warn)"
      />
      <FlowBox x={COL_L} y={ROW_4} node={NO_NODES[1]!} tone="warn" />

      {/* 확인 안내로 나가는 고정 문구 — 앞 세로 막대 대신 옅은 면으로 묶습니다(§1-2). */}
      <text x={COL_M} y={416} fontSize={15} className="fill-ink-muted">
        근거를 찾지 못하면 이렇게 답합니다
      </text>
      <rect x={COL_M} y={428} width={462} height={72} rx={12} className="fill-paper-2" />
      <text x={COL_M + 18} y={458} fontSize={16} className="fill-ink">
        {NO_SOURCE_LINES[0]}
      </text>
      <text x={COL_M + 18} y={482} fontSize={16} className="fill-ink">
        {NO_SOURCE_LINES[1]}
      </text>

      {/* L3 밴드 — 이 다이어그램에서 색 면은 여기 하나뿐입니다(§1-3). */}
      <rect x={6} y={524} width={708} height={68} rx={12} className="fill-brand-50" />
      <text
        x={DIA_CX}
        y={556}
        textAnchor="middle"
        fontSize={19}
        fontWeight={800}
        className="fill-brand-900"
      >
        {L3_TITLE}
      </text>
      <text x={DIA_CX} y={580} textAnchor="middle" fontSize={15} className="fill-ink-soft">
        {L3_SUB}
      </text>
    </svg>
  );
}

/* ── 모바일 세로 스텝 ──────────────────────────────────────── */

/** 번호 + 제목 + 한 문장. 왼쪽 세로줄·색 점 없이 hairline 행으로만 나눕니다. */
function StepRow({ index, node }: { index: number; node: FlowNode }) {
  return (
    <li className="flex gap-3 border-t border-line py-4">
      <span className="chim-num chim-body shrink-0 font-extrabold text-brand-700">{index}</span>
      <div>
        <p className="chim-body font-extrabold text-ink">{node.title}</p>
        <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-soft">{node.caption}</p>
      </div>
    </li>
  );
}

/** 분기 안의 항목 — 번호를 다시 매기지 않고 제목·설명만 둡니다. */
function BranchStep({ node }: { node: FlowNode }) {
  return (
    <li>
      <p className="chim-body font-extrabold text-ink">{node.title}</p>
      <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-soft">{node.caption}</p>
    </li>
  );
}

function FlowSteps() {
  return (
    <div>
      <ol className="border-b border-line">
        {INPUT_NODES.map((n, i) => (
          <StepRow key={n.key} index={i + 1} node={n} />
        ))}
        <li className="flex gap-3 border-t border-line py-4">
          <span className="chim-num chim-body shrink-0 font-extrabold text-brand-700">
            {INPUT_NODES.length + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="chim-body font-extrabold text-brand-800">근거 확인</p>
            <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-soft">
              여기서 길이 갈립니다. 근거를 찾았는지에 따라 다음이 달라집니다.
            </p>

            {/* 분기 — 왼쪽 액센트 바 대신 옅은 면 + [아이콘 + 라벨] 한 줄로 구분합니다. */}
            <div className="mt-4 space-y-3">
              <div className="rounded-card bg-paper-2 p-4">
                <p className="chim-body flex items-center gap-2 font-extrabold text-brand-800">
                  <IconCheckCircle className="h-5 w-5 shrink-0" />
                  예 · 근거를 찾았을 때
                </p>
                <ol className="mt-2.5 space-y-3">
                  {YES_NODES.map((n) => (
                    <BranchStep key={n.key} node={n} />
                  ))}
                </ol>
              </div>

              <div className="rounded-card bg-warn-soft p-4">
                <p className="chim-body flex items-center gap-2 font-extrabold text-warn-ink">
                  <IconAlert className="h-5 w-5 shrink-0" />
                  아니오 · 근거를 찾지 못했을 때
                </p>
                <ol className="mt-2.5 space-y-3">
                  {NO_NODES.map((n) => (
                    <BranchStep key={n.key} node={n} />
                  ))}
                </ol>
                <p className="chim-body mt-3 font-bold text-ink">
                  「공식 지침에서 근거를 찾지 못했습니다. 담당 간호사 또는 기관에 확인해 주세요.」
                </p>
              </div>
            </div>
          </div>
        </li>
      </ol>

      <div className="mt-6 rounded-card bg-brand-50 p-5">
        <p className="chim-body font-extrabold text-brand-900">{L3_TITLE}</p>
        <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-soft">{L3_SUB}</p>
      </div>
    </div>
  );
}

/* ── 본체 ──────────────────────────────────────────────────── */

/**
 * 근거 확인 흐름도 — md 이상은 라인 다이어그램, 그 아래는 같은 내용의 세로 스텝 목록.
 *
 * @example <EvidenceFlow />
 */
export function EvidenceFlow() {
  return (
    <figure className="m-0">
      <div className="hidden md:block">
        <FlowDiagram />
      </div>
      <div className="md:hidden">
        <FlowSteps />
      </div>
      <figcaption className="chim-caption mt-5 text-ink-muted md:mt-6 md:text-center">
        그림 · 근거가 확인된 범위 안에서만 피드백이 나갑니다. 근거를 찾지 못하면 생성을 멈추고
        확인 안내로 넘어갑니다.
      </figcaption>
    </figure>
  );
}

export default EvidenceFlow;
