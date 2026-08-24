import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { BigButton, InlineDisclaimer, PageShell, ScreenHeader, cx } from "@/components";
import { StatusMark } from "@/components/icons";
import { AiMap } from "./_components/AiMap";
import { CountedFacts } from "./_components/CountedFacts";
import { DocWhitelist } from "./_components/DocWhitelist";
import { EvidenceFlow } from "./_components/EvidenceFlow";
import { LiveMeterPanel } from "./_components/LiveMeterPanel";
import { LiveProofPanel } from "./_components/LiveProofPanel";
import { MaskingPipeline } from "./_components/MaskingPipeline";
import { MobileFold } from "./_components/MobileFold";
import { PlanTag } from "./_components/PlanTag";
import { ReviewLedger } from "./_components/ReviewLedger";
import { RubricAllList } from "./_components/RubricAllList";
import { RuleEngineProof } from "./_components/RuleEngineProof";
import { SafetyToc, type TocItem } from "./_components/SafetyToc";
import { TierShareDiagram } from "./_components/TierShareDiagram";
import { VerificationLadder } from "./_components/VerificationLadder";

export const metadata: Metadata = {
  title: "안전·개인정보 설계",
  description:
    "3계층 생성통제, AI가 쓰이는 다섯 자리, 기록 코칭 개인정보 경로, 폴백 매트릭스, 근거 문서 화이트리스트, 의료기기 경계, 접근권한 3등급, 루브릭 30항목과 감수 이력",
};

/* ── 안전 설계 = 시안 7b ───────────────────────────────────────
   이 화면은 앱의 증명서입니다. 그런데 길이가 13화면이라, 같은 크기의 회색 문단이
   이어지면 「읽는 문서」가 아니라 「인쇄물 스캔」으로 보입니다. 그래서 v4 §2 역할표의
   눈금만으로 위계를 다시 세웠습니다 — 장식·그라데이션·액센트 바는 여전히 0건입니다.

   [타입 눈금] 이 화면이 쓰는 크기는 다섯 종입니다(그 밖은 공유 조각이 정합니다).
     12.5 메타·eyebrow·표 컬럼 라벨 / 15 읽어야 하는 문장 전부 /
     17 패널·행 제목(공유 BigButton md와 같은 눈금) / 22 제목(페이지·섹션 h2) /
     40 실측 수치. 13·13.5·14·14.5·16px처럼 0.5~1px 차이로 갈라지던 단은 없앴습니다.

   [지면 리듬] 섹션마다 헤어라인 + 32px 들여쓰기로 쉼표를 찍고, 실측 패널과 닫는 블록만
   흰 지면에서 회색 면(paper-2)으로 전환합니다 — 13화면을 눈이 세 덩어리로 끊어 읽습니다.

   [주인공] 화면의 주장은 「우리가 적은 값이 아니라 지금 잰 값」입니다. 그래서 라이브 계측
   두 칸과 경계 케이스 전수 재실행 결과만 40px 숫자로 올리고(건수는 화면이 셉니다),
   기획서에서 옮겨 적은 인용치는
   작은 표로 남겨 둡니다 — 크기 자체가 「이건 실측, 저건 인용」을 말하게 했습니다.

   위에서부터: 제목 + 목차 칩(가로 스크롤·활성 잉크 채움)
     → 「위험할수록 AI의 지분이 줄어듭니다」 생성 허용 범위 막대(퍼센트 없음 — 순서만)
     → 「지금 이 기기에서 — 실시간 계측」 두 칸
     → 「개인정보가 움직이는 길 — 한 줄뿐입니다」 3칩
     → 그 아래로 상세(3계층 표·AI 지도·검증 계단 ①~④·개인정보 경로·폴백·화이트리스트
       ·의료기기 경계·접근권한·루브릭 30항목과 감수 이력) → 기관 담당자용 요약 한 장.

   [AI 지도] 02 절은 방향이 반대인 유일한 절입니다 — 무엇을 막았는지가 아니라 AI가 실제로
   닿는 다섯 자리를 폅니다. 화면 곳곳의 「생성 호출 0건」이 기본 빌드 기준이라는 사실과,
   설정에서 온라인 코칭을 켰을 때 달라지는 한 자리를 그 표가 스스로 밝힙니다.

   [검증 계단] 이 화면에는 성격이 다른 값이 셋 섞여 있습니다 — 지금 이 기기에서 잰 것,
   앱 밖 하네스에서 재어 옮겨 적은 것, 아직 재지 않은 것. 구분 없이 늘어놓으면 셋 다 같은
   무게로 읽히므로, 03 절에서 계단 ①~④로 세우고 칸마다 출처를 문장으로 답니다.
   ④(파일럿)에는 숫자가 한 칸도 없습니다 — 잴 항목만 미리 적어 둡니다.

   화면이 「지금 되는 것」과 「설계까지 한 것」을 같은 말투로 섞지 않도록,
   아직 구현하지 않은 항목에는 「계획」 배지를 답니다(접근권한 표의 두 행·가명처리 6단의
   저장과 추론·폴백 표의 재전송과 유출 대응·확인서 위조 방지·검증 계단 ④).

   [모바일 접힘] 상세는 하나도 지우지 않았습니다. 대신 430px에서는 섹션 제목이 그대로
   접이식 손잡이가 되고(`MobileFold`), 기본 펼침은 실측 패널·3계층 막대·검증 계단뿐입니다.
   목차 칩을 누르면 그 항목이 먼저 펴진 뒤 앵커로 이동합니다. 데스크톱은 예전 그대로입니다.
   ─────────────────────────────────────────────────────────── */

/** 목차 칩 — 「의료기기 경계」는 근거 문서 다음에 이어서 읽히므로 칩을 따로 두지 않습니다. */
const TOC: readonly TocItem[] = [
  { id: "tiers", label: "3계층" },
  { id: "ai-map", label: "AI 지도" },
  { id: "ladder", label: "검증" },
  { id: "privacy", label: "데이터" },
  { id: "fallback", label: "폴백" },
  { id: "docs", label: "근거 문서" },
  { id: "access", label: "접근권한" },
];

/**
 * 번호 붙은 본문 섹션.
 *
 * 섹션 사이의 쉼표는 여백이 아니라 **헤어라인 + 32px**입니다 — 3,000px씩 이어지던 구간에
 * 눈이 멈출 자리를 만듭니다. 제목은 페이지 제목과 같은 22px 한 단으로 통일했습니다
 * (예전에는 같은 위계의 h2가 12.5·16·17px 세 크기로 갈라져 있었습니다).
 *
 * **모바일에서는 제목 줄이 그대로 접이식 손잡이가 됩니다**(`MobileFold`). 430px 폭에서
 * 이 화면은 19화면 길이라, 목차 칩만으로는 「어디까지 있는지」가 손에 잡히지 않았습니다.
 * 기본 펼침으로 두는 것은 화면의 주장에 해당하는 칸(검증 계단)뿐입니다 —
 * 그 위의 실측 패널과 3계층 막대는 애초에 섹션 밖이라 언제나 펴져 있습니다.
 * 번호 줄이 `<span>`인 이유는 `<summary>` 안에 문단을 넣을 수 없기 때문입니다.
 */
function Section({
  id,
  num,
  title,
  lead,
  alwaysOpen,
  children,
}: {
  id: string;
  num: string;
  title: string;
  lead?: string;
  /** 모바일에서도 접지 않을 섹션 */
  alwaysOpen?: boolean;
  children: ReactNode;
}) {
  return (
    // 목차 칩이 위에 붙어 있으므로, 앵커로 뛰었을 때 제목이 칩 아래에 놓이도록 여백을 둡니다.
    <section id={id} className="scroll-mt-[68px] border-t border-line pt-8">
      <MobileFold
        id={id}
        alwaysOpen={alwaysOpen}
        handle={
          <>
            <span className="chim-num block text-[0.7813rem] leading-[1.5] font-bold tracking-[0.06em] text-ink-muted">
              {num}
            </span>
            <h2 className="mt-1 text-[1.375rem] leading-[1.3] font-extrabold tracking-[-0.02em] text-ink">
              {title}
            </h2>
          </>
        }
      >
        {lead && <p className="text-[0.9375rem] leading-[1.65] text-ink-soft">{lead}</p>}
        <div className={lead ? "mt-5" : undefined}>{children}</div>
      </MobileFold>
    </section>
  );
}

type NoteTone = "brand" | "warn" | "danger" | "quiet";

/** 강조 블록의 바탕 — 색 면은 정말 위험한 것에만 쓰고 나머지는 surface(#f5f6f6)로 둡니다. */
const NOTE_SURFACE: Record<NoteTone, string> = {
  brand: "bg-paper-2",
  warn: "bg-warn-soft",
  danger: "bg-danger-soft",
  quiet: "bg-paper-2",
};

/** 제목 색 — 대비 4.5:1을 넘는 `*-ink` 계열만 씁니다. */
const NOTE_HEAD: Record<NoteTone, string> = {
  brand: "text-brand-800",
  warn: "text-warn-ink",
  danger: "text-danger-ink",
  quiet: "text-ink",
};

/**
 * 강조 블록 — 면 하나 + (있으면) 제목 한 줄 + 본문. 보더·그림자·왼쪽 바 없음(v4 §2).
 * 제목은 패널 제목 눈금(17px), 본문은 읽는 눈금(15px)입니다.
 * `collapsible`을 켜면 제목이 그대로 접이식 손잡이가 되고, 손잡이 높이는 48px을 지킵니다.
 */
function Note({
  tone = "brand",
  title,
  collapsible = false,
  children,
  className,
}: {
  tone?: NoteTone;
  title?: string;
  collapsible?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const headTone = NOTE_HEAD[tone];

  if (title && collapsible) {
    return (
      <details className={cx("group rounded-card", NOTE_SURFACE[tone], className)}>
        <summary className="flex min-h-[48px] cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <span
            className={cx("min-w-0 flex-1 text-[1.0625rem] leading-[1.4] font-extrabold", headTone)}
          >
            {title}
          </span>
          <span
            aria-hidden
            className="flex-none text-[1.0625rem] leading-none text-ink-ghost transition-transform duration-150 ease-soft group-open:rotate-90"
          >
            ›
          </span>
        </summary>
        <div className="px-4 pb-4">{children}</div>
      </details>
    );
  }

  return (
    <div className={cx("rounded-card p-4", NOTE_SURFACE[tone], className)}>
      {title && (
        <p className={cx("text-[1.0625rem] leading-[1.4] font-extrabold", headTone)}>{title}</p>
      )}
      <div className={cx(title && "mt-2")}>{children}</div>
    </div>
  );
}

interface DataRow {
  /** 행의 이름 — 표의 첫 칸에 해당합니다(「L1 · 훈련」·「서버 전면 장애」). */
  head: ReactNode;
  /** `columns`와 같은 길이의 값들 */
  cells: ReactNode[];
}

/**
 * 표 — 430px 앱 프레임에서는 열을 가로로 펼치지 않고 **행마다 세워** 읽습니다.
 * 가로 스크롤이 생기지 않으므로 지면이 옆으로 밀리지 않습니다.
 *
 * 행 이름은 패널 제목 눈금(17px), 컬럼 라벨은 eyebrow 눈금(12.5px), 값은 읽는 눈금(15px)입니다 —
 * 세 층이 크기로 갈라져 있어야 표가 「행 → 항목 → 내용」으로 읽힙니다.
 */
function DataRows({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: string[];
  rows: DataRow[];
}) {
  return (
    <div>
      <p className="sr-only">{caption}</p>
      <ul className="chim-hairline border-y border-line">
        {rows.map((row, ri) => (
          <li key={ri} className="py-4">
            <p className="text-[1.0625rem] leading-[1.4] font-extrabold text-ink">{row.head}</p>
            <dl className="mt-2">
              {row.cells.map((cell, ci) => (
                <div key={ci} className={ci > 0 ? "mt-3" : undefined}>
                  <dt className="text-[0.7813rem] leading-[1.4] font-bold tracking-[0.04em] text-ink-muted">
                    {columns[ci]}
                  </dt>
                  <dd className="mt-1 text-[0.9375rem] leading-[1.6] text-ink">{cell}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── 데이터 ────────────────────────────────────────────────── */

/** 개인정보가 지나가는 길 — 시안 7b는 이 세 칸으로 요약합니다(상세 6단은 「데이터」 항목 안에). */
const PATH_CHIPS: readonly { label: string; tint?: boolean }[] = [
  { label: "말한 원문" },
  { label: "기기에서 가리기", tint: true },
  { label: "가려진 글만 저장" },
];

const PRIVACY_STEPS = [
  { step: "마이크", desc: "버튼을 누르는 동안만 켜집니다. 상시 청취는 없습니다." },
  {
    step: "기기 안 처리",
    desc: "가명처리·추론은 기기 안에서 합니다. 침착 서버로는 아무것도 보내지 않습니다. 음성 인식은 브라우저 내장 기능이라 브라우저·기기에 따라 제조사 서버를 경유할 수 있고, 타이핑 입력은 네트워크 없이 동작합니다.",
  },
  {
    step: "1차 가명처리",
    desc: "성명·연락처·인정번호·주소·생년·기관명 6종을 지웁니다.",
  },
  {
    step: "추론",
    desc: "학습에 쓰이지 않는 조건으로만 처리합니다.",
    plan: "알파에는 추론 구간 자체가 없습니다 — 경량 LLM 연결 시 이 조건으로 계약합니다.",
  },
  { step: "2차 가명처리", desc: "저장 직전에 한 번 더 검사합니다." },
  {
    step: "저장",
    desc: "확정한 텍스트만 남습니다(이 데모에서는 이 기기의 브라우저 저장소).",
    plan: "기관 연동 시 전송 TLS 1.3 · 저장 AES-256으로 설계했습니다 — 이 데모에는 기관 연동 자체가 없습니다.",
  },
];

const NOT_MEDICAL = [
  { k: "대상", v: "환자가 아니라 돌봄 제공자입니다." },
  { k: "데이터", v: "훈련에서 다루는 인물은 전원 가상 인물입니다." },
  { k: "출력", v: "진단이나 처방이 아니라 교육적 피드백입니다." },
  {
    k: "응급",
    v: "고정 스크립트만 재생하므로 개별 대상자에 대한 판단이 구조적으로 생기지 않습니다.",
  },
];

const DOC_RULES = [
  {
    t: "① 목록 밖은 인용하지 않습니다",
    d: "화이트리스트에 없는 문서는 근거로 쓰지 않습니다.",
  },
  {
    t: "② 없으면 멈춥니다",
    d: "근거 문서가 이 목록 밖이면 판정을 멈추고 확인 안내로 넘깁니다(엔진 가드 — engine/evidence.ts).",
  },
  {
    t: "③ 표준교재는 인용하지 않습니다",
    d: "공공누리 제4유형(변경금지)이라 원문을 쓰지 않고 대응 원칙만 참고했습니다.",
  },
];

/**
 * 기관 담당자가 「그래서 우리한테 뭐가 나옵니까」에 답을 찾는 자리 — 세 줄이면 충분합니다.
 * 가격·계약 조건은 여기에 적지 않습니다(이 화면은 안전 설계 문서이지 견적서가 아닙니다).
 */
const INSTITUTION_ITEMS: readonly { t: string; d: string }[] = [
  {
    t: "훈련 이력 증빙",
    d: "누가 어떤 상황을 언제 훈련했는지 이수 확인서로 정리해 드립니다.",
  },
  {
    t: "기록 초안",
    d: "말로 보고하면 가명처리된 기록 초안이 나옵니다 — 기록에 드는 시간이 줄어듭니다.",
  },
  {
    t: "관리자에게는 이수 여부만",
    d: "점수와 대화 내용은 관리자에게 공개하지 않습니다(위 접근권한 3등급).",
  },
];

/* 판정 표기 — 이모지 대신 표준 마크를 문장 안에 그대로 놓습니다. */
const MET = <StatusMark kind="met" label="충족" size="sm" quiet />;
const COACH = <StatusMark kind="coach" label="코칭" size="sm" quiet />;

/* ── 페이지 ────────────────────────────────────────────────── */

export default function SafetyPage() {
  return (
    <PageShell>
      <ScreenHeader title="안전 설계" subtitle="판정은 지침이, 응급은 119가 합니다" />

      <SafetyToc items={TOC} className="mt-3" />

      {/* 1. 주장 → 2. 계측 → 3. 경로. 이 세 덩어리가 화면의 첫 인상입니다. */}
      <section aria-labelledby="tier-share-title" className="pt-3">
        <h2
          id="tier-share-title"
          className="text-[1.375rem] leading-[1.3] font-extrabold tracking-[-0.02em] text-ink"
        >
          위험할수록 AI의 지분이 줄어듭니다
        </h2>
        <TierShareDiagram className="mt-4" />
      </section>

      {/* 실측 패널만 지면을 흰색에서 회색 면으로 바꿉니다 — 이 화면의 주인공이라는 표시입니다.
          좌우로 화면 폭까지 넓히는 값(20px)은 PageShell의 `--chim-pad-x`와 같은 값입니다. */}
      <div className="-mx-[20px] mt-6 bg-paper-2 px-[20px] py-6">
        <LiveMeterPanel />
      </div>

      <section aria-labelledby="privacy-path-title" className="mt-6">
        <h3
          id="privacy-path-title"
          className="text-[1.0625rem] leading-[1.4] font-extrabold text-ink"
        >
          개인정보가 움직이는 길 — 한 줄뿐입니다
        </h3>
        <ol className="mt-3 flex flex-wrap items-center gap-2">
          {PATH_CHIPS.map((chip, i) => (
            <li key={chip.label} className="flex items-center gap-2">
              <span
                className={cx(
                  "rounded-field px-3 py-2 text-[0.9375rem] leading-[1.4] font-semibold",
                  chip.tint ? "bg-brand-tint text-brand-on-tint" : "bg-paper-2 text-ink-soft",
                )}
              >
                {chip.label}
              </span>
              {i < PATH_CHIPS.length - 1 && (
                <span aria-hidden className="text-[0.9375rem] leading-none text-ink-ghost">
                  ›
                </span>
              )}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-[0.7813rem] leading-[1.6] text-ink-faint">
          원문은 저장하지 않습니다 — 세션이 끝나면 사라집니다
        </p>
      </section>

      <p className="mt-6 text-[0.9375rem] leading-[1.65] text-ink-soft">
        침착은 공식 근거가 확인된 범위에서만 피드백하고, 근거가 부족하거나 실제 응급 상황에서는
        생성 대신 검수된 안내를 내보냅니다. 아래는 그 경계를 어디에 그었는지에 대한 기록입니다.
      </p>

      <div className="mt-8 space-y-8">
        {/* 1. 3계층 생성통제 */}
        <Section
          id="tiers"
          num="01"
          title="3계층 생성통제 — 구간마다 잠근 범위가 다릅니다"
          lead="구간마다 AI가 할 수 있는 일의 범위를 다르게 잠갔습니다. 안전 직결 3항목(업무 범위를 벗어난 행위 · 신체 제한 · 119 지연)은 확률 모델이 아니라 결정론 규칙이 판정합니다 — 직접 말씀하신 문장은 규칙 사전이, 보기 버튼으로 고른 턴은 검수된 시나리오 규칙표가, 119 지연은 시간 규칙이 신고 시점부터 연결까지의 경과 초로 잽니다. 코칭의 「판정:」 줄에 어느 규칙이 판정했는지 그대로 적습니다."
        >
          <DataRows
            caption="생성 통제 3계층"
            columns={["적용 구간", "AI가 하는 일", "AI가 하지 않는 일", "근거가 없을 때"]}
            rows={[
              {
                head: "L1 · 훈련",
                cells: [
                  "시나리오 대화",
                  // 알파에 생성 호출이 0건이라는 사실을 「하는 일」 칸에서 먼저 밝힙니다.
                  // 「변주」는 경량 LLM(교체형 어댑터)이 붙는 베타의 일이라 계획 배지를 답니다.
                  <>
                    검수된 고정 대사를 그대로 재생합니다. 알파에는 생성 호출이 0건이고, 경량
                    LLM(교체형 어댑터) 연결 지점만 비워 두었습니다. 대본 범위 안의 변주{" "}
                    <PlanTag />
                  </>,
                  "대본 밖 상황을 지어내지 않고, 실존 인물·기관을 언급하지 않습니다.",
                  <>
                    알파는 고정 대사만 재생하므로 대본 이탈이 생기지 않습니다. 이탈 감지 후 되돌리기{" "}
                    <PlanTag />
                  </>,
                ],
              },
              {
                head: "L2 · 채점",
                cells: [
                  "턴별 피드백",
                  <>
                    알파는 사전 매핑된 근거 문서에 묶인 검수 문장을 씁니다. 화이트리스트 검색{" "}
                    <PlanTag />
                  </>,
                  "근거 없는 판정이나 추측을 내놓지 않습니다.",
                  "근거 문서가 화이트리스트 밖이면 판정을 멈추고 「공식 지침에서 근거를 찾지 못했습니다. 담당 간호사 또는 기관에 확인해 주세요.」로 넘깁니다.",
                ],
              },
              {
                head: "L3 · 실전 응급",
                cells: [
                  "응급 프로토콜",
                  "없습니다. 생성 호출이 0건입니다.",
                  "생성·요약·변형을 전부 하지 않습니다.",
                  "해당 없음 — 처음부터 사전 검수된 고정 스크립트만 재생하고 119 안내를 최우선으로 띄웁니다.",
                ],
              },
            ]}
          />

          {/* 「규칙이 판정한다」의 증거는 바로 아래 절(검증 계단 ①)로 옮겼습니다 —
              같은 성격의 검증 넷을 한자리에 세워야 「어디까지 재 봤는가」가 한눈에 읽힙니다. */}
          <p className="mt-5 text-[0.9375rem] leading-[1.65] text-ink-soft">
            이 주장은 아래 <b className="font-bold text-ink">검증 계단 ①</b>에서 경계 문장으로
            때려 본 기록과 함께 다시 나옵니다. 같은 케이스를 이 기기에서 지금 다시 돌려 보실 수
            있습니다.
          </p>
          {/* 표가 「알파에는 생성 호출이 0건」이라고 적었으니, 그 말이 무엇을 기준으로 한
              것인지도 같은 자리에서 밝혀 둡니다 — 바로 다음 절이 그 기준을 폅니다. */}
          <p className="mt-2 text-[0.9375rem] leading-[1.65] text-ink-soft">
            위 「생성 호출 0건」은 <b className="font-bold text-ink">기본 빌드 기준</b>입니다.
            설정에서 온라인 코칭(실험)을 켜면 코칭 문장 한 자리가 열리는데, 어느 자리가 어떻게
            달라지는지는 바로 아래 <b className="font-bold text-ink">AI 지도</b>가 그대로 적어
            둡니다.
          </p>

          {/* 흐름도 — 세로 스텝 목록은 그대로 보이고, 큰 다이어그램은 그 안에서 한 번 더 접힙니다. */}
          <div className="mt-6">
            <EvidenceFlow />
          </div>

          <Note tone="danger" className="mt-5">
            <p className="text-[0.9375rem] leading-[1.65] font-bold text-danger-ink">
              응급 화면에는 「이 안내는 사전 검수된 고정 문구입니다 · AI 생성 아님」을 상시
              표시하고, 119 버튼을 항상 노출합니다.
            </p>
            <p className="mt-2 text-[0.9375rem] leading-[1.65] text-ink">
              몸에 손이 닿는 술기는 화면으로 지도하지 않습니다. 해당 구간에서는 「이 부분은 119
              상황실이 목소리로 직접 지도합니다」로 넘깁니다.
            </p>
          </Note>
        </Section>

        {/* 2. AI 지도 — 3계층이 「무엇을 잠갔는가」라면, 이 절은 「AI가 어디에 있는가」입니다.
            둘을 붙여 두어야 잠근 자리와 열린 자리가 한 번에 읽힙니다. */}
        <Section
          id="ai-map"
          num="02"
          title="AI가 쓰이는 자리 — 다섯 곳뿐입니다"
          lead="「AI 시뮬레이터」라고 소개해 놓고 화면에는 「생성 호출 0건」이라 적혀 있으면, 둘 중 하나는 거짓말로 읽힙니다. 그래서 AI가 닿는 자리 다섯 곳을 이름 붙여 세우고, 자리마다 지금 무엇이 돌고 있는지·설정에서 온라인 코칭을 켜면 무엇이 달라지는지·파일럿에서 무엇을 이어 붙일지를 나란히 적었습니다."
        >
          <AiMap />
        </Section>

        {/* 3. 검증 계단 — 「무엇을 어디까지 재 봤는가」. 이 화면에서 유일하게 모바일에서도 펴 두는 절입니다. */}
        <Section
          id="ladder"
          num="03"
          title="검증 계단 — 어디까지 재 봤는지"
          lead="「잘 될 겁니다」 대신 네 계단을 쌓았습니다. 칸마다 어디서 잰 값인지를 함께 적었습니다 — ①은 이 기기에서 지금 다시 돌릴 수 있고, ②·③은 앱 밖 하네스 실행 기록을 옮겨 적은 값이며, ④는 아직 재지 않았습니다. 재지 않은 칸에는 숫자를 넣지 않습니다."
          alwaysOpen
        >
          <VerificationLadder proof={<RuleEngineProof className="mt-4" />} />
          <CountedFacts className="mt-6" />
        </Section>

        {/* 4. 데이터 — 개인정보 경로 + 라이브 계측 상세 */}
        <Section
          id="privacy"
          num="04"
          title="털릴 데이터를 처음부터 만들지 않았습니다"
          lead="훈련에서 대화하는 상대는 전부 가상 인물이라, 훈련 단계에서는 개인정보 수집 자체가 일어나지 않습니다. 실제 어르신의 정보가 지나가는 길은 기록 코칭 하나뿐이고, 그 길에는 가명처리 관문이 두 개 있습니다."
        >
          <div className="space-y-2">
            <div className="rounded-card bg-paper-2 p-4">
              <p className="text-[1.0625rem] leading-[1.4] font-extrabold text-brand-800">
                훈련 경로
              </p>
              <p className="mt-2 text-[0.9375rem] leading-[1.65] text-ink">
                상대는 전부 가상 인물이고 개인정보 입력란이 존재하지 않습니다. 침착 서버로 보내는
                것 0건 · 음성 인식은 브라우저 내장 기능이라 기기·브라우저에 따라 제조사 서버를
                경유할 수 있으며, 원문은 저장하지 않습니다.
              </p>
              {/* 마이크를 아예 안 쓰는 길이 있다는 사실을 같은 자리에서 알려 드립니다. */}
              <p className="mt-2 text-[0.9375rem] leading-[1.65] text-ink-soft">
                타이핑·버튼으로만 하시면 네트워크를 전혀 쓰지 않고 끝까지 훈련하실 수 있습니다.
              </p>
            </div>
            <div className="rounded-card bg-paper-2 p-4">
              <p className="text-[1.0625rem] leading-[1.4] font-extrabold text-ink">
                이 데모에서의 동작
              </p>
              <p className="mt-2 text-[0.9375rem] leading-[1.65] text-ink">
                세션 기록은 이 기기의 브라우저 저장소에만 남습니다. 발화 원문은 저장하지 않고,
                화면을 벗어나는 순간 사라집니다.
              </p>
            </div>
          </div>

          <p className="mt-6 text-[1.0625rem] leading-[1.4] font-extrabold text-ink">
            기록 코칭 경로 — 개인정보는 이 한 줄로만 움직입니다
          </p>

          <MaskingPipeline steps={PRIVACY_STEPS} className="mt-3" />

          <Note tone="warn" title="외부 경계" className="mt-5">
            <p className="text-[0.9375rem] leading-[1.65] text-ink">
              이 데모에서는 확정본도 기기 밖으로 나가지 않습니다. 기관 시스템 연동(계획)이
              붙더라도 이 선을 넘어가는 것은 가명처리 2단을 통과한 텍스트뿐이도록 설계했습니다 —
              대상은 성명·연락처·인정번호·주소·생년·기관명 6종이며, 처리 후에도 가명정보로
              취급하고, 전달은 확정 버튼을 누른 뒤에만 일어납니다.
            </p>
          </Note>

          {/* 위 두 칸(외부 출처 요청·저장된 응급 안내)의 근거가 되는 상세 계측입니다. */}
          <LiveProofPanel className="mt-6 border-t border-line pt-6" />

          {/* 세는 것과 막는 것은 다른 일입니다 — 계측 바로 아래에서 그 차이를 한 줄로 밝힙니다. */}
          <p className="mt-4 text-[0.9375rem] leading-[1.65] text-ink">
            세는 데서 그치지 않습니다 — 외부 요청은 응답 헤더(콘텐츠 보안 정책, CSP)로 브라우저가
            차단하도록 못 박았습니다.
          </p>
        </Section>

        {/* 5. 폴백 매트릭스 */}
        <Section
          id="fallback"
          num="05"
          title="어느 구간이 죽어도 훈련은 멈추지 않습니다"
          lead="장애는 일어난다고 보고 설계했습니다. 각 구간이 멈췄을 때 세션을 유지하는 방법을 미리 정해 두었습니다."
        >
          <DataRows
            caption="폴백 매트릭스 요약"
            columns={["즉시 폴백 (세션 유지)", "복구 · 검증"]}
            rows={[
              {
                head: "음성 인식 · 역할 대사 생성 장애",
                cells: [
                  <>
                    버튼 UI로 전환합니다. 규칙 판정은 독립 경로라 {MET}·{COACH} 표시와 고정 대사가
                    계속 나옵니다.
                  </>,
                  "음성 재시도, 교체형 어댑터로 즉시 우회합니다.",
                ],
              },
              {
                head: "근거 검색 실패",
                cells: [
                  "생성을 중단합니다. 근거 없는 답변은 내보내지 않습니다.",
                  "근거 커버리지를 재점검한 뒤 재개합니다.",
                ],
              },
              {
                head: "서버 전면 장애",
                cells: [
                  "훈련과 응급은 브라우저 캐시로 무중단 동작합니다. 119 버튼은 상시 노출됩니다.",
                  // 큐도 재전송도 이 데모에는 없습니다 — 있는 척하면 폴백 표 전체가 인용문이 됩니다.
                  <>
                    서버에 기대는 것은 기록 업로드뿐인데, 이 데모에는 업로드 경로 자체가 없습니다.
                    끊긴 동안 기기에 담아 두었다가 자동으로 다시 보내도록 설계했습니다{" "}
                    <PlanTag />
                  </>,
                ],
              },
              {
                head: "개인정보 유출 정황",
                cells: [
                  <>
                    기록 코칭만 차단하고 훈련 기능은 그대로 둡니다. 이 데모에는 서버도 키도 없어
                    폐기할 대상이 없습니다 — 기관 연동이 붙으면 해당 키를 즉시 폐기하도록
                    설계했습니다 <PlanTag />
                  </>,
                  <>
                    24시간 안에 정보주체와 기관에 알리고, 요건에 해당하면 관계기관에 신고합니다.
                    접속기록 1년 보관은 서버가 생기는 시점의 절차입니다 <PlanTag />
                  </>,
                ],
              },
            ]}
          />

          <Note tone="quiet" className="mt-5">
            <p className="text-[0.9375rem] leading-[1.65] text-ink">
              마이크가 없거나 음성 인식이 되지 않는 환경에서도 모든 훈련을 버튼만으로 끝까지 진행할
              수 있습니다. 버튼 폴백은 예비 수단이 아니라 1급 경로입니다.
            </p>
          </Note>
        </Section>

        {/* 6. 근거 문서 화이트리스트 */}
        <Section
          id="docs"
          num="06"
          title="근거 문서 화이트리스트"
          lead="피드백에 붙는 근거는 아래 목록 안에서만 나옵니다. 목록 밖 문서는 인용하지 않고, 목록 밖 문서를 근거로 든 판정은 엔진이 멈춰 세웁니다."
        >
          <DocWhitelist />

          <ol className="chim-hairline mt-6 border-y border-line">
            {DOC_RULES.map((r) => (
              <li key={r.t} className="py-3">
                <p className="text-[1.0625rem] leading-[1.4] font-extrabold text-ink">{r.t}</p>
                <p className="mt-1 text-[0.9375rem] leading-[1.6] text-ink-soft">{r.d}</p>
              </li>
            ))}
          </ol>

          <p className="mt-3 text-[0.7813rem] leading-[1.6] text-ink-faint">
            화면에서는 피드백마다 근거 출처 칩이 붙습니다. 칩을 누르면 어떤 문서인지 확인할 수
            있습니다.
          </p>
        </Section>

        {/* 7. 의료기기 경계 */}
        <Section
          id="boundary"
          num="07"
          title="의료기기 경계는 표현이 아니라 기능으로 지킵니다"
          lead="문구로 피해 가는 대신, 구조적으로 그 판단이 생기지 않게 만들었습니다."
        >
          <dl className="chim-hairline border-y border-line">
            {NOT_MEDICAL.map((n) => (
              <div key={n.k} className="py-3">
                <dt className="text-[1.0625rem] leading-[1.4] font-extrabold text-brand-800">
                  {n.k}
                </dt>
                <dd className="mt-1 text-[0.9375rem] leading-[1.6] text-ink">{n.v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-5 space-y-2">
            <Note tone="warn" title="전 화면 고정 고지" collapsible>
              <p className="text-[0.9375rem] leading-[1.65] text-ink">
                「본 서비스는 훈련·교육 목적이며 119 신고 및 의료인의 진단·처방을 대체하지
                않습니다.」를 모든 화면에 표시합니다. 효과를 단정하는 표현, 임상 판정을 흉내 내는
                표현, 처치를 지시하는 표현 등 8종은 금지 표현 목록으로 정해 두고 화면 문구에서
                배제했습니다(알파는 작성 규율과 QA 점검으로 지키며, 노출 0건을 확인했습니다. 생성
                문구 후검증 필터는 베타에서 붙입니다).
              </p>
            </Note>
            <Note tone="quiet" title="오채점은 비대칭으로 다룹니다" collapsible>
              <p className="text-[0.9375rem] leading-[1.65] text-ink">
                맞는 대응에 {COACH}을 주는 것보다, 틀린 대응에 {MET}을 주는 쪽이 훨씬 위험합니다.
                후자는 0건을 목표로 합니다. 확신이 낮을 때 판정을 「보류」로 표시하는 단계는 설계에
                넣어 두었고, 알파에서는 아직 구현하지 않았습니다. 대신 알파는 근거 문서가
                화이트리스트 밖이면 판정을 멈추고 「공식 지침에서 근거를 찾지 못했습니다」를
                띄웁니다 — 이 가드는 /check의 「규칙 엔진 경계 케이스」 검사에서 매번 함께
                돌아갑니다.
              </p>
            </Note>
            <Note tone="brand">
              <p className="text-[0.9375rem] leading-[1.65] text-ink">
                화면에는 점수·등급·순위·백분위를 표시하지 않습니다. {MET}과 {COACH} 두 가지, 코칭 한
                문장, 근거 출처까지가 전부입니다.
              </p>
            </Note>
          </div>
        </Section>

        {/* 8. 접근권한 3등급 */}
        <Section
          id="access"
          num="08"
          title="접근권한 3등급"
          lead="내부 판정 결과가 인사평가로 흘러가면 아무도 솔직하게 실패하지 않습니다. 실패 없는 훈련은 효과가 0이 되기 때문에, 권한을 처음부터 나눠 두었습니다."
        >
          {/* 「지금 되는 것」과 「설계까지 한 것」을 표에 들어가기 전에 먼저 갈라 둡니다. */}
          <p className="mb-4 text-[0.9375rem] leading-[1.65] text-ink-soft">
            이 데모에서 실제로 동작하는 것은 「사용자」 행 하나입니다. 기관 관리자 콘솔과 기관
            시스템 연동은 설계까지 끝냈고 아직 구현하지 않았습니다 — 아래 표에 「계획」으로
            표시해 두었습니다.
          </p>

          <DataRows
            caption="접근권한 3등급"
            columns={["볼 수 있는 것", "볼 수 없는 것", "추가 통제"]}
            rows={[
              {
                head: "사용자",
                cells: [
                  <>
                    본인의 훈련 이력, {MET}·{COACH} 요약, 본인이 확정한 기록
                  </>,
                  // 기록이 기기에 남는 구조라, 한 기기를 여럿이 돌려 쓰면 이 문장이 성립하지 않습니다.
                  "다른 사용자의 어떤 정보도 볼 수 없습니다(1인 1기기 사용 기준).",
                  "발화 원문은 세션 안에서만 존재하고 저장되지 않습니다.",
                ],
              },
              {
                head: (
                  <>
                    기관 관리자{" "}
                    <PlanTag />
                  </>
                ),
                cells: [
                  "소속 인원의 이수 여부와 이수 일시",
                  "내부 판정 결과, 대화 전문, 발화 원문",
                  "인사평가 연동 금지를 계약으로 명시합니다.",
                ],
              },
              {
                head: (
                  <>
                    운영자{" "}
                    <PlanTag />
                  </>
                ),
                cells: [
                  "장애 대응에 필요한 최소 범위",
                  "개인을 식별할 수 있는 원문",
                  "전건 접근 기록 + 2단계 인증. 접속기록 1년 보관.",
                ],
              },
            ]}
          />

          <Note tone="quiet" className="mt-5">
            <p className="text-[0.9375rem] leading-[1.65] text-ink">
              비밀번호는 Argon2id로 해시해 저장합니다. 국내 리전 처리가 기본값이며, 국외 사업자를
              쓰게 되면 「개인정보 보호법」 제28조의8에 따라 이전 국가·항목·목적·보유기간을 명시해
              공개합니다.
            </p>
            <p className="mt-3 text-[0.7813rem] leading-[1.6] text-ink-faint">
              대응 조항 · 「개인정보 보호법」 제16·21·26·28조의8·34조 · 「개인정보의 안전성 확보조치
              기준」 제5·6·8조 · AI 기본법상 고영향 AI 비해당.
            </p>
          </Note>

          {/* 센터장이 실제로 던지는 질문 하나에 대한 답 — 조문 번호가 아니라 주어와 시한으로. */}
          <Note tone="quiet" title="개인정보가 유출되면 누가 신고합니까" className="mt-2">
            <p className="text-[0.9375rem] leading-[1.65] text-ink">
              유출 정황을 알게 되면 24시간 안에 정보주체와 기관에 알립니다. 요건에 해당하면
              개인정보보호위원회 또는 한국인터넷진흥원(KISA)에 신고하는데, 그 신고의 주체는
              개인정보처리자인 기관입니다. 침착은 처리를 위탁받은 쪽이라 사실 확인 자료와
              접속기록, 통지 문안 초안을 지체 없이 드리고 기술 조치를 함께 진행합니다.
            </p>
          </Note>
        </Section>

        {/* 9. 판정 기준과 감수 이력 — 「자산을 보여 달라」는 요청에 화면이 답하는 자리입니다. */}
        <Section
          id="rubric"
          num="09"
          title="루브릭 30항목과 감수 이력"
          lead="이 제품의 자산은 모델이 아니라 루브릭 30항목입니다. 감추고 믿어 달라고 하는 대신, 판정 기준 문장을 전부 펴 두고 누가 어디까지 감수했는지도 같이 적었습니다."
        >
          <RubricAllList />
          <ReviewLedger className="mt-2" />
        </Section>
      </div>

      {/* 기관 담당자용 요약 — 화면의 주인공이 아니므로 패널 눈금(17px)에 머무릅니다. */}
      <section
        aria-labelledby="institution-summary-title"
        className="mt-8 rounded-card bg-paper-2 p-4"
      >
        <h3
          id="institution-summary-title"
          className="text-[1.0625rem] leading-[1.4] font-extrabold text-ink"
        >
          기관 도입 시 제공되는 것
        </h3>
        <ul className="chim-hairline mt-3 border-y border-line">
          {INSTITUTION_ITEMS.map((item) => (
            <li key={item.t} className="py-3">
              <p className="text-[0.9375rem] leading-[1.45] font-bold text-ink">{item.t}</p>
              <p className="mt-1 text-[0.9375rem] leading-[1.6] text-ink-muted">{item.d}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[0.9375rem] leading-[1.6] text-ink-soft">
          법정 보수교육 이수 인정은 아니며, 기관 내부 교육 기록·평가 대비 자료로 활용하실 수
          있습니다.
        </p>
        {/* 확인서가 자기 한계를 적어 두었으니, 그 한계를 언제 없앨지도 같은 무게로 적습니다. */}
        <p className="mt-3 text-[0.9375rem] leading-[1.6] text-ink-soft">
          <PlanTag className="mr-2" />
          이수 확인서의 발급번호는 같은 기록을 가리키는 대조용 번호이지 위조 방지 장치가
          아닙니다. 위조 방지는 기관 연동 시 서버 발급·서명으로 이관합니다.
        </p>
        <Link
          href="/for-orgs"
          className="mt-3 inline-block min-h-[48px] content-center text-[0.9375rem] leading-[1.5] font-bold text-brand-800 underline underline-offset-4"
        >
          기관 담당자용 안내 보기
        </Link>
      </section>

      {/* 하단 — 고정 문구를 다시 한 번 놓고 훈련·응급으로 내보냅니다.
          지면을 한 번 더 회색 면으로 바꿔 「문서가 여기서 끝난다」를 눈으로도 알립니다. */}
      <div className="-mx-[20px] mt-8 bg-paper-2 px-[20px] py-6">
        <p className="text-[1.0625rem] leading-[1.45] font-extrabold text-ink">
          정답을 맞히는 시험이 아니라, 말이 나오게 만드는 연습입니다.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          <BigButton href="/train" size="lg" block>
            훈련 시작하기
          </BigButton>
          <BigButton href="/emergency" variant="secondary" block>
            응급 안내 열기
          </BigButton>
        </div>
      </div>

      <InlineDisclaimer size="md" tone="readable" className="mt-6 mb-6" />
    </PageShell>
  );
}
