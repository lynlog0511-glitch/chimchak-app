/**
 * 근거 확인 흐름도.
 *
 * 구성 (v4 — 화면은 430px 앱 프레임입니다)
 *  - 본체: 세로 스텝 목록. 실제 텍스트라 확대·낭독에 그대로 대응하고 가로 스크롤이 없습니다.
 *  - 접이식: 같은 내용을 담은 SVG 라인 다이어그램(720×600 좌표계, 700px로 그립니다).
 *    프레임 폭에 맞춰 줄이면 안의 글자가 10px 아래로 내려가므로 원래 크기로 두고
 *    그 상자 안에서만 가로로 스크롤합니다.
 *
 * 표현
 *  - 1.5px 스트로크 라인, 색은 잉크·틸·주황 3색. 색 면은 L3 밴드 하나뿐입니다.
 *  - 아이콘·왼쪽 액센트 바를 쓰지 않고 번호·hairline 행·옅은 면으로만 구분합니다(v4 §2).
 *
 * 접근성
 *  - SVG는 role="img" + title/desc로 흐름 전체를 한 문장으로 읽어 줍니다.
 *  - 애니메이션 없음.
 */

import { PlanTag } from "./PlanTag";

/* ── 내용 ──────────────────────────────────────────────────── */

interface FlowNode {
  key: string;
  title: string;
  /** 세로 스텝 목록(모바일)에서 읽히는 한 문장 */
  caption: string;
  /** 다이어그램 안 두 줄 — 한 줄 11자 안쪽으로 유지합니다(상자 안쪽 폭 192). */
  lines: readonly [string, string];
  /** 알파에 없는 단계 — 제목 옆에 「계획」을 답니다 */
  plan?: boolean;
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
    // 알파에는 검색(retrieval)이 없습니다 — 분기·규칙이 사전 매핑된 문서 id를 들고 있습니다.
    // 그 사실을 「계획」 배지와 함께 이 자리에서 먼저 밝힙니다.
    caption:
      "알파는 분기·규칙에 사전 매핑된 근거를 씁니다. 화이트리스트를 실제로 검색하는 단계는 베타에서 붙입니다.",
    lines: ["알파는 사전 매핑", "베타는 목록 검색"],
    plan: true,
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
    title: "판정 중단",
    // 알파에서 실제로 걸리는 조건을 그대로 적습니다(engine/evidence.ts의 화이트리스트 가드).
    caption: "근거 문서가 화이트리스트 밖이면 그 판정을 내지 않습니다.",
    lines: ["목록 밖 근거는", "판정하지 않습니다"],
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
  "근거 검색은 알파에서는 사전 매핑이고 화이트리스트 검색은 베타 계획입니다. " +
  "근거가 화이트리스트 안이면 루브릭 판정과 피드백·출처 표시로 이어지고, " +
  "목록 밖이면 판정을 중단하고 담당 간호사·기관 확인 안내로 넘어갑니다. " +
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

/**
 * 접이식 흐름도. **여기 글자만 px 고정입니다**(앱의 나머지는 rem — 설정 글자 크기에 연동).
 * 720×600 좌표계 위에 선과 상자를 손으로 놓은 그림이라, 글자만 커지면 상자 밖으로 넘칩니다.
 * 대신 같은 내용이 바로 위 `FlowSteps`에 **실제 텍스트**로 먼저 나오고 그쪽은 설정을 그대로 따릅니다 —
 * 확대해서 읽으실 분이 못 읽는 문장은 없습니다.
 *
 * 크기는 px이지만 **눈금은 화면과 같습니다** — 15(본문) · 17(상자 제목) · 20(판단·L3 밴드) 셋뿐입니다.
 * 예전에는 16·19가 섞여 있어 그림 안에서만 다섯 단이 됐습니다.
 */
function FlowDiagram() {
  return (
    <svg
      viewBox="0 0 720 600"
      role="img"
      aria-labelledby="sfy-flow-title sfy-flow-desc"
      className="h-auto w-[700px] max-w-none"
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
        fontSize={20}
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
      <text x={372} y={262} fontSize={15} fontWeight={700} className="fill-brand-700">
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
      <text x={244} y={178} textAnchor="end" fontSize={15} fontWeight={700} className="fill-warn-ink">
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
      <text x={COL_M + 18} y={458} fontSize={15} className="fill-ink">
        {NO_SOURCE_LINES[0]}
      </text>
      <text x={COL_M + 18} y={482} fontSize={15} className="fill-ink">
        {NO_SOURCE_LINES[1]}
      </text>

      {/* L3 밴드 — 이 다이어그램에서 색 면은 여기 하나뿐입니다(§1-3). */}
      <rect x={6} y={524} width={708} height={68} rx={12} className="fill-brand-50" />
      <text
        x={DIA_CX}
        y={556}
        textAnchor="middle"
        fontSize={20}
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

/** 번호 + 제목 + 한 문장. 아이콘·세로줄 없이 hairline 행으로만 나눕니다(v4 §2). */
function StepRow({ index, node }: { index: number; node: FlowNode }) {
  return (
    <li className="flex gap-3 border-t border-line py-4">
      <span
        aria-hidden
        className="chim-num w-[1rem] flex-none text-[0.9375rem] leading-[1.4] font-extrabold text-brand-700"
      >
        {index}
      </span>
      <div className="min-w-0">
        <p className="text-[1.0625rem] leading-[1.4] font-extrabold text-ink">
          {node.title}
          {node.plan && <PlanTag className="ml-2" />}
        </p>
        <p className="mt-1 text-[0.9375rem] leading-[1.6] text-ink-muted">{node.caption}</p>
      </div>
    </li>
  );
}

/** 분기 안의 항목 — 번호를 다시 매기지 않고 제목·설명만 둡니다. */
function BranchStep({ node }: { node: FlowNode }) {
  return (
    <li>
      <p className="text-[0.9375rem] leading-[1.45] font-bold text-ink">{node.title}</p>
      <p className="mt-1 text-[0.9375rem] leading-[1.6] text-ink-soft">{node.caption}</p>
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
          <span
            aria-hidden
            className="chim-num w-[1rem] flex-none text-[0.9375rem] leading-[1.4] font-extrabold text-brand-700"
          >
            {INPUT_NODES.length + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[1.0625rem] leading-[1.4] font-extrabold text-brand-800">근거 확인</p>
            <p className="mt-1 text-[0.9375rem] leading-[1.6] text-ink-muted">
              여기서 길이 갈립니다. 근거를 찾았는지에 따라 다음이 달라집니다.
            </p>

            {/* 분기 — 라벨 한 줄 + 옅은 면. 아이콘은 쓰지 않습니다. */}
            <div className="mt-3 space-y-2">
              <div className="rounded-card bg-paper-2 p-4">
                <p className="text-[0.9375rem] leading-[1.45] font-extrabold text-brand-800">
                  예 · 근거를 찾았을 때
                </p>
                <ol className="mt-2 space-y-2">
                  {YES_NODES.map((n) => (
                    <BranchStep key={n.key} node={n} />
                  ))}
                </ol>
              </div>

              <div className="rounded-card bg-warn-soft p-4">
                <p className="text-[0.9375rem] leading-[1.45] font-extrabold text-warn-ink">
                  아니오 · 근거가 화이트리스트 밖일 때
                </p>
                <ol className="mt-2 space-y-2">
                  {NO_NODES.map((n) => (
                    <BranchStep key={n.key} node={n} />
                  ))}
                </ol>
                <p className="mt-3 text-[0.9375rem] leading-[1.6] font-bold text-ink">
                  「공식 지침에서 근거를 찾지 못했습니다. 담당 간호사 또는 기관에 확인해 주세요.」
                </p>
                <p className="mt-2 text-[0.9375rem] leading-[1.6] text-ink-soft">
                  알파도 이 갈래를 실제로 들고 있습니다 — 판정에 붙은 근거 문서 id가 목록 밖이면
                  엔진이 점수를 매기지 않고 이 문장만 내보냅니다. /check의 「규칙 엔진 경계
                  케이스」 검사가 매번 이 동작을 확인합니다.
                </p>
              </div>
            </div>
          </div>
        </li>
      </ol>

      <div className="mt-5 rounded-card bg-brand-tint p-4">
        <p className="text-[1.0625rem] leading-[1.4] font-extrabold text-brand-900">{L3_TITLE}</p>
        <p className="mt-1 text-[0.9375rem] leading-[1.6] text-ink-soft">{L3_SUB}</p>
      </div>
    </div>
  );
}

/* ── 본체 ──────────────────────────────────────────────────── */

/**
 * 근거 확인 흐름도 — 세로 스텝 목록이 본체이고, 라인 다이어그램은 펼쳐서 봅니다.
 *
 * v4에서 화면 폭이 430px 앱 프레임으로 고정됐습니다. 720px 좌표계의 다이어그램을 그 폭에
 * 맞춰 줄이면 안의 글자가 10px 아래로 내려가 읽히지 않으므로, **읽는 순서는 스텝 목록**이
 * 맡고 다이어그램은 접이식 안에서 원래 크기(700px)로 가로 스크롤해 봅니다.
 * 지면 자체는 옆으로 밀리지 않습니다(스크롤은 그 상자 안에서만 일어납니다).
 *
 * @example <EvidenceFlow />
 */
export function EvidenceFlow() {
  return (
    <figure className="m-0">
      <FlowSteps />

      <details className="group mt-5 rounded-card bg-paper-2">
        <summary className="flex min-h-[48px] cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1 text-[1.0625rem] leading-[1.4] font-extrabold text-ink">
            같은 내용을 흐름도 한 장으로 보기
          </span>
          <span
            aria-hidden
            className="flex-none text-[1.0625rem] leading-none text-ink-ghost transition-transform duration-150 ease-soft group-open:rotate-90"
          >
            ›
          </span>
        </summary>
        {/* 가로 스크롤은 이 상자 안에서만 — 지면은 밀리지 않습니다. */}
        <div className="overflow-x-auto px-4 pb-4">
          <FlowDiagram />
        </div>
      </details>

      <figcaption className="mt-3 text-[0.7813rem] leading-[1.6] text-ink-faint">
        그림 · 근거가 확인된 범위 안에서만 피드백이 나갑니다. 근거 문서가 화이트리스트 밖이면
        판정을 멈추고 확인 안내로 넘어갑니다.
      </figcaption>
    </figure>
  );
}

export default EvidenceFlow;
