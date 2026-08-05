import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BigButton, InlineDisclaimer, PageShell, ScreenHeader, cx } from "@/components";
import { StatusMark } from "@/components/icons";
import { DocWhitelist } from "./_components/DocWhitelist";
import { EvidenceFlow } from "./_components/EvidenceFlow";
import { LiveMeterPanel } from "./_components/LiveMeterPanel";
import { LiveProofPanel } from "./_components/LiveProofPanel";
import { MaskingPipeline } from "./_components/MaskingPipeline";
import { PlanTag } from "./_components/PlanTag";
import { ReviewLedger } from "./_components/ReviewLedger";
import { RubricAllList } from "./_components/RubricAllList";
import { RuleEngineProof } from "./_components/RuleEngineProof";
import { SafetyToc, type TocItem } from "./_components/SafetyToc";
import { TierShareDiagram } from "./_components/TierShareDiagram";

export const metadata: Metadata = {
  title: "안전·개인정보 설계",
  description:
    "3계층 생성통제, 기록 코칭 개인정보 경로, 폴백 매트릭스, 근거 문서 화이트리스트, 의료기기 경계, 접근권한 3등급, 루브릭 30항목과 감수 이력",
};

/* ── 안전 설계 = 시안 7b ───────────────────────────────────────
   위에서부터: 제목 + 목차 칩(가로 스크롤·활성 잉크 채움)
     → 「위험할수록 AI의 지분이 줄어듭니다」 지분 막대
     → 「지금 이 기기에서 — 실시간 계측」 두 칸
     → 「개인정보가 움직이는 길 — 한 줄뿐입니다」 3칩
     → 그 아래로 상세(3계층 표·개인정보 경로·폴백·화이트리스트·의료기기 경계·접근권한
       ·루브릭 30항목과 감수 이력) → 기관 담당자용 요약 한 장.

   화면이 「지금 되는 것」과 「설계까지 한 것」을 같은 말투로 섞지 않도록,
   아직 구현하지 않은 항목에는 「계획」 배지를 답니다(접근권한 표의 두 행·가명처리 6단의 저장).

   상세는 하나도 지우지 않았습니다 — 목차 칩이 가리키는 여섯 항목으로 자리만 옮겼고,
   길이가 부담스러운 흐름도만 접어 두었습니다(펼치면 그대로 있습니다).
   px·색은 시안의 인라인 값 그대로입니다.
   ─────────────────────────────────────────────────────────── */

/** 목차 칩 — 시안 7b의 다섯 개. 「의료기기 경계」는 근거 문서 다음에 이어서 읽히므로 칩을 따로 두지 않습니다. */
const TOC: readonly TocItem[] = [
  { id: "tiers", label: "3계층" },
  { id: "privacy", label: "데이터" },
  { id: "fallback", label: "폴백" },
  { id: "docs", label: "근거 문서" },
  { id: "access", label: "접근권한" },
];

function Section({
  id,
  num,
  title,
  lead,
  children,
}: {
  id: string;
  num: string;
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    // 목차 칩이 위에 붙어 있으므로, 앵커로 뛰었을 때 제목이 칩 아래에 놓이도록 여백을 둡니다.
    <section id={id} className="scroll-mt-[68px]">
      <p className="chim-num text-[0.75rem] leading-[1.5] font-bold tracking-[0.06em] text-ink-muted">
        {num}
      </p>
      <h2 className="mt-[2px] text-[1.0625rem] leading-[1.4] font-extrabold tracking-[-0.01em] text-ink">
        {title}
      </h2>
      {lead && <p className="mt-[6px] text-[0.8438rem] leading-[1.65] text-ink-soft">{lead}</p>}
      <div className="mt-[14px]">{children}</div>
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

/** 제목 색 — 작은 글자라 대비 4.5:1을 넘는 `*-ink` 계열만 씁니다. */
const NOTE_HEAD: Record<NoteTone, string> = {
  brand: "text-brand-800",
  warn: "text-warn-ink",
  danger: "text-danger-ink",
  quiet: "text-ink",
};

/**
 * 강조 블록 — 면 하나 + (있으면) 제목 한 줄 + 본문. 보더·그림자·왼쪽 바 없음(v4 §2).
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
      <details className={cx("group rounded-[14px]", NOTE_SURFACE[tone], className)}>
        <summary className="flex min-h-[48px] cursor-pointer list-none items-center gap-2 px-[15px] py-[12px] [&::-webkit-details-marker]:hidden">
          <span className={cx("min-w-0 flex-1 text-[0.875rem] leading-[1.45] font-extrabold", headTone)}>
            {title}
          </span>
          <span
            aria-hidden
            className="flex-none text-[1.0625rem] leading-none text-faint transition-transform duration-150 ease-soft group-open:rotate-90"
          >
            ›
          </span>
        </summary>
        <div className="px-[15px] pb-[14px]">{children}</div>
      </details>
    );
  }

  return (
    <div className={cx("rounded-[14px] px-[15px] py-[14px]", NOTE_SURFACE[tone], className)}>
      {title && (
        <p className={cx("text-[0.875rem] leading-[1.45] font-extrabold", headTone)}>{title}</p>
      )}
      <div className={cx(title && "mt-[6px]")}>{children}</div>
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
          <li key={ri} className="py-[14px]">
            <p className="text-[0.9063rem] leading-[1.45] font-extrabold text-ink">{row.head}</p>
            <dl className="mt-[7px]">
              {row.cells.map((cell, ci) => (
                <div key={ci} className={ci > 0 ? "mt-[8px]" : undefined}>
                  <dt className="text-[0.7188rem] leading-[1.4] font-bold tracking-[0.04em] text-ink-muted">
                    {columns[ci]}
                  </dt>
                  <dd className="mt-[2px] text-[0.8438rem] leading-[1.6] text-ink">{cell}</dd>
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
  { step: "추론", desc: "학습에 쓰이지 않는 조건으로만 처리합니다." },
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
    d: "근거를 찾지 못하면 피드백 생성을 중단하고 확인 안내로 넘깁니다.",
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

      <SafetyToc items={TOC} className="mt-[12px]" />

      {/* 1. 지분 막대 — 이 화면의 주장을 한 장으로 줄인 그림입니다. */}
      <section aria-labelledby="tier-share-title" className="pt-[10px]">
        <h2
          id="tier-share-title"
          className="text-[1rem] leading-[1.4] font-extrabold tracking-[-0.01em] text-ink"
        >
          위험할수록 AI의 지분이 줄어듭니다
        </h2>
        <TierShareDiagram className="mt-[10px]" />
      </section>

      {/* 2. 실시간 계측 — 주장 다음에 곧바로 계측치를 놓습니다(상세는 「데이터」 항목 안에). */}
      <LiveMeterPanel className="mt-[14px]" />

      {/* 3. 개인정보 경로 3칩 — 길이 하나뿐이라는 사실을 세 칸으로 보입니다. */}
      <section aria-labelledby="privacy-path-title" className="mt-[16px]">
        <h2
          id="privacy-path-title"
          className="text-[0.7813rem] leading-[1.5] font-bold text-ink-muted"
        >
          개인정보가 움직이는 길 — 한 줄뿐입니다
        </h2>
        <ol className="mt-[7px] flex flex-wrap items-center gap-[7px]">
          {PATH_CHIPS.map((chip, i) => (
            <li key={chip.label} className="flex items-center gap-[7px]">
              <span
                className={cx(
                  "rounded-[8px] px-[10px] py-[7px] text-[0.7813rem] leading-[1.4] font-semibold",
                  chip.tint ? "bg-brand-tint text-brand-on-tint" : "bg-paper-2 text-ink-soft",
                )}
              >
                {chip.label}
              </span>
              {i < PATH_CHIPS.length - 1 && (
                <span aria-hidden className="text-[0.7813rem] leading-none text-faint">
                  ›
                </span>
              )}
            </li>
          ))}
        </ol>
        <p className="mt-[7px] text-[0.7188rem] leading-[1.6] text-tertiary">
          원문은 저장하지 않습니다 — 세션이 끝나면 사라집니다
        </p>
      </section>

      <p className="mt-[22px] text-[0.8438rem] leading-[1.65] text-ink-soft">
        침착은 공식 근거가 확인된 범위에서만 피드백하고, 근거가 부족하거나 실제 응급 상황에서는
        생성 대신 검수된 안내를 내보냅니다. 아래는 그 경계를 어디에 그었는지에 대한 기록입니다.
      </p>

      <div className="mt-[22px] space-y-[30px]">
        {/* 1. 3계층 생성통제 */}
        <Section
          id="tiers"
          num="01"
          title="3계층 생성통제 — 구간마다 잠근 범위가 다릅니다"
          lead="구간마다 AI가 할 수 있는 일의 범위를 다르게 잠갔습니다. 안전 직결 3항목(업무 범위를 벗어난 행위 · 신체 제한 · 119 지연)은 확률 모델이 아니라 규칙 엔진이 단독으로 판정합니다."
        >
          <DataRows
            caption="생성 통제 3계층"
            columns={["적용 구간", "AI가 하는 일", "AI가 하지 않는 일", "근거가 없을 때"]}
            rows={[
              {
                head: "L1 · 훈련",
                cells: [
                  "시나리오 대화",
                  "어르신·보호자 역 대사를 대본 범위 안에서 재생·변주합니다.",
                  "대본 밖 상황을 지어내지 않고, 실존 인물·기관을 언급하지 않습니다.",
                  "이탈이 감지되면 검수된 고정 대사로 되돌립니다.",
                ],
              },
              {
                head: "L2 · 채점",
                cells: [
                  "턴별 피드백",
                  "검색된 근거 문서 안에서만 코칭 문장을 만듭니다.",
                  "근거 없는 판정이나 추측을 내놓지 않습니다.",
                  "생성을 중단하고 「공식 지침에서 근거를 찾지 못했습니다. 담당 간호사 또는 기관에 확인해 주세요.」로 넘깁니다.",
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

          {/* 규칙 엔진 실행 로그 — 「규칙이 판정한다」는 주장 바로 아래에 그 검증 결과를 놓습니다. */}
          <RuleEngineProof className="mt-4" />

          {/* 흐름도 — 세로 스텝 목록은 그대로 보이고, 큰 다이어그램은 그 안에서 한 번 더 접힙니다. */}
          <div className="mt-6">
            <EvidenceFlow />
          </div>

          <Note tone="danger" className="mt-4">
            <p className="text-[0.8438rem] leading-[1.65] font-bold text-danger-ink">
              응급 화면에는 「이 안내는 사전 검수된 고정 문구입니다 · AI 생성 아님」을 상시
              표시하고, 119 버튼을 항상 노출합니다.
            </p>
            <p className="mt-[6px] text-[0.8438rem] leading-[1.65] text-ink">
              몸에 손이 닿는 술기는 화면으로 지도하지 않습니다. 해당 구간에서는 「이 부분은 119
              상황실이 목소리로 직접 지도합니다」로 넘깁니다.
            </p>
          </Note>
        </Section>

        {/* 2. 데이터 — 개인정보 경로 + 라이브 계측 상세 */}
        <Section
          id="privacy"
          num="02"
          title="털릴 데이터를 처음부터 만들지 않았습니다"
          lead="훈련에서 대화하는 상대는 전부 가상 인물이라, 훈련 단계에서는 개인정보 수집 자체가 일어나지 않습니다. 실제 어르신의 정보가 지나가는 길은 기록 코칭 하나뿐이고, 그 길에는 가명처리 관문이 두 개 있습니다."
        >
          <div className="space-y-[8px]">
            <div className="rounded-[14px] bg-paper-2 px-[15px] py-[14px]">
              <p className="text-[0.875rem] leading-[1.45] font-extrabold text-brand-800">훈련 경로</p>
              <p className="mt-[6px] text-[0.8438rem] leading-[1.65] text-ink">
                상대는 전부 가상 인물이고 개인정보 입력란이 존재하지 않습니다. 침착 서버로 보내는
                것 0건 · 음성 인식은 브라우저 내장 기능이라 기기·브라우저에 따라 제조사 서버를
                경유할 수 있으며, 원문은 저장하지 않습니다.
              </p>
              {/* 마이크를 아예 안 쓰는 길이 있다는 사실을 같은 자리에서 알려 드립니다. */}
              <p className="mt-[6px] text-[0.8125rem] leading-[1.6] text-ink-soft">
                타이핑·버튼으로만 하시면 네트워크를 전혀 쓰지 않고 끝까지 훈련하실 수 있습니다.
              </p>
            </div>
            <div className="rounded-[14px] bg-paper-2 px-[15px] py-[14px]">
              <p className="text-[0.875rem] leading-[1.45] font-extrabold text-ink">
                이 데모에서의 동작
              </p>
              <p className="mt-[6px] text-[0.8438rem] leading-[1.65] text-ink">
                세션 기록은 이 기기의 브라우저 저장소에만 남습니다. 발화 원문은 저장하지 않고,
                화면을 벗어나는 순간 사라집니다.
              </p>
            </div>
          </div>

          <p className="mt-6 text-[0.9063rem] leading-[1.45] font-extrabold text-ink">
            기록 코칭 경로 — 개인정보는 이 한 줄로만 움직입니다
          </p>

          <MaskingPipeline steps={PRIVACY_STEPS} className="mt-[10px]" />

          <Note tone="warn" title="외부 경계" className="mt-4">
            <p className="text-[0.8438rem] leading-[1.65] text-ink">
              이 선을 넘어가는 것은 가명처리 2단을 통과한 텍스트뿐입니다. 가명처리 대상은
              성명·연락처·인정번호·주소·생년·기관명 6종이며, 처리 후에도 가명정보로 취급합니다.
              확정 버튼을 누른 뒤에만 기관 시스템으로 보냅니다.
            </p>
          </Note>

          {/* 위 두 칸(외부 출처 요청·저장된 응급 안내)의 근거가 되는 상세 계측입니다. */}
          <LiveProofPanel className="mt-6 border-t border-line pt-5" />
        </Section>

        {/* 3. 폴백 매트릭스 */}
        <Section
          id="fallback"
          num="03"
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
                  "서버 의존은 기록 업로드뿐이라 로컬 큐에 저장했다가 자동 재전송합니다.",
                ],
              },
              {
                head: "개인정보 유출 정황",
                cells: [
                  "해당 키를 즉시 폐기하고 기록 코칭만 차단합니다. 훈련 기능은 정상 유지됩니다.",
                  "24시간 내 정보주체·기관 통지, 요건 충족 시 관계기관 신고, 접속기록 1년 보관.",
                ],
              },
            ]}
          />

          <Note tone="quiet" className="mt-4">
            <p className="text-[0.8438rem] leading-[1.65] text-ink">
              마이크가 없거나 음성 인식이 되지 않는 환경에서도 모든 훈련을 버튼만으로 끝까지 진행할
              수 있습니다. 버튼 폴백은 예비 수단이 아니라 1급 경로입니다.
            </p>
          </Note>
        </Section>

        {/* 4. 근거 문서 화이트리스트 */}
        <Section
          id="docs"
          num="04"
          title="근거 문서 화이트리스트"
          lead="피드백에 붙는 근거는 아래 목록 안에서만 나옵니다. 목록 밖 문서는 인용하지 않고, 근거를 찾지 못하면 답을 만들지 않습니다."
        >
          <DocWhitelist />

          <ol className="chim-hairline mt-6 border-y border-line">
            {DOC_RULES.map((r) => (
              <li key={r.t} className="py-[13px]">
                <p className="text-[0.875rem] leading-[1.45] font-extrabold text-ink">{r.t}</p>
                <p className="mt-[3px] text-[0.8125rem] leading-[1.6] text-ink-soft">{r.d}</p>
              </li>
            ))}
          </ol>

          <p className="mt-[10px] text-[0.7188rem] leading-[1.6] text-tertiary">
            화면에서는 피드백마다 근거 출처 칩이 붙습니다. 칩을 누르면 어떤 문서인지 확인할 수
            있습니다.
          </p>
        </Section>

        {/* 5. 의료기기 경계 */}
        <Section
          id="boundary"
          num="05"
          title="의료기기 경계는 표현이 아니라 기능으로 지킵니다"
          lead="문구로 피해 가는 대신, 구조적으로 그 판단이 생기지 않게 만들었습니다."
        >
          <dl className="chim-hairline border-y border-line">
            {NOT_MEDICAL.map((n) => (
              <div key={n.k} className="py-[13px]">
                <dt className="text-[0.875rem] leading-[1.45] font-extrabold text-brand-800">{n.k}</dt>
                <dd className="mt-[3px] text-[0.8438rem] leading-[1.6] text-ink">{n.v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 space-y-[8px]">
            <Note tone="warn" title="전 화면 고정 고지" collapsible>
              <p className="text-[0.8438rem] leading-[1.65] text-ink">
                「본 서비스는 훈련·교육 목적이며 119 신고 및 의료인의 진단·처방을 대체하지
                않습니다.」를 모든 화면에 표시합니다. 효과를 단정하는 표현, 임상 판정을 흉내 내는
                표현, 처치를 지시하는 표현 등 8종은 금지 표현 목록으로 정해 두고 화면 문구에서
                배제했습니다(알파는 작성 규율과 QA 점검으로 지키며, 노출 0건을 확인했습니다. 생성
                문구 후검증 필터는 베타에서 붙입니다).
              </p>
            </Note>
            <Note tone="quiet" title="오채점은 비대칭으로 다룹니다" collapsible>
              <p className="text-[0.8438rem] leading-[1.65] text-ink">
                맞는 대응에 {COACH}을 주는 것보다, 틀린 대응에 {MET}을 주는 쪽이 훨씬 위험합니다.
                후자는 0건을 목표로 합니다. 확신이 낮을 때 판정을 「보류」로 표시하는 단계는 설계에
                넣어 두었고, 알파에서는 아직 구현하지 않았습니다. 대신 알파는 근거를 찾지 못하면
                판정 대신 「공식 지침에서 근거를 찾지 못했습니다」를 띄웁니다.
              </p>
            </Note>
            <Note tone="brand">
              <p className="text-[0.8438rem] leading-[1.65] text-ink">
                화면에는 점수·등급·순위·백분위를 표시하지 않습니다. {MET}과 {COACH} 두 가지, 코칭 한
                문장, 근거 출처까지가 전부입니다.
              </p>
            </Note>
          </div>
        </Section>

        {/* 6. 접근권한 3등급 */}
        <Section
          id="access"
          num="06"
          title="접근권한 3등급"
          lead="내부 판정 결과가 인사평가로 흘러가면 아무도 솔직하게 실패하지 않습니다. 실패 없는 훈련은 효과가 0이 되기 때문에, 권한을 처음부터 나눠 두었습니다."
        >
          {/* 「지금 되는 것」과 「설계까지 한 것」을 표에 들어가기 전에 먼저 갈라 둡니다. */}
          <p className="mb-[12px] text-[0.8125rem] leading-[1.65] text-ink-soft">
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
                  "다른 사용자의 어떤 정보도 볼 수 없습니다.",
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

          <Note tone="quiet" className="mt-4">
            <p className="text-[0.8438rem] leading-[1.65] text-ink">
              비밀번호는 Argon2id로 해시해 저장합니다. 국내 리전 처리가 기본값이며, 국외 사업자를
              쓰게 되면 「개인정보 보호법」 제28조의8에 따라 이전 국가·항목·목적·보유기간을 명시해
              공개합니다.
            </p>
            <p className="mt-[8px] text-[0.7188rem] leading-[1.6] text-tertiary">
              대응 조항 · 「개인정보 보호법」 제16·21·26·28조의8·34조 · 「개인정보의 안전성 확보조치
              기준」 제5·6·8조 · AI 기본법상 고영향 AI 비해당.
            </p>
          </Note>

          {/* 센터장이 실제로 던지는 질문 하나에 대한 답 — 조문 번호가 아니라 주어와 시한으로. */}
          <Note tone="quiet" title="개인정보가 유출되면 누가 신고합니까" className="mt-[8px]">
            <p className="text-[0.8438rem] leading-[1.65] text-ink">
              유출 정황을 알게 되면 24시간 안에 정보주체와 기관에 알립니다. 요건에 해당하면
              개인정보보호위원회 또는 한국인터넷진흥원(KISA)에 신고하는데, 그 신고의 주체는
              개인정보처리자인 기관입니다. 침착은 처리를 위탁받은 쪽이라 사실 확인 자료와
              접속기록, 통지 문안 초안을 지체 없이 드리고 기술 조치를 함께 진행합니다.
            </p>
          </Note>
        </Section>

        {/* 7. 판정 기준과 감수 이력 — 「자산을 보여 달라」는 요청에 화면이 답하는 자리입니다. */}
        <Section
          id="rubric"
          num="07"
          title="루브릭 30항목과 감수 이력"
          lead="이 제품의 자산은 모델이 아니라 루브릭 30항목입니다. 감추고 믿어 달라고 하는 대신, 판정 기준 문장을 전부 펴 두고 누가 어디까지 감수했는지도 같이 적었습니다."
        >
          <RubricAllList />
          <ReviewLedger className="mt-[8px]" />
        </Section>
      </div>

      {/* 기관 담당자용 요약 — 화면의 주인공이 아니므로 작게 둡니다(가격·숫자는 적지 않습니다). */}
      <section
        aria-labelledby="institution-summary-title"
        className="mt-7 rounded-[14px] bg-paper-2 px-[15px] py-[14px]"
      >
        <h2
          id="institution-summary-title"
          className="text-[0.7813rem] leading-[1.5] font-bold text-ink-muted"
        >
          기관 도입 시 제공되는 것
        </h2>
        <ul className="chim-hairline mt-[8px] border-y border-line">
          {INSTITUTION_ITEMS.map((item) => (
            <li key={item.t} className="py-[10px]">
              <p className="text-[0.8438rem] leading-[1.45] font-bold text-ink">{item.t}</p>
              <p className="mt-[2px] text-[0.7813rem] leading-[1.6] text-ink-muted">{item.d}</p>
            </li>
          ))}
        </ul>
        <p className="mt-[9px] text-[0.8125rem] leading-[1.6] text-ink-soft">
          법정 보수교육 이수 인정은 아니며, 기관 내부 교육 기록·평가 대비 자료로 활용하실 수
          있습니다.
        </p>
      </section>

      {/* 하단 — 고정 문구를 다시 한 번 놓고 훈련·응급으로 내보냅니다. */}
      <div className="mt-7 rounded-[14px] bg-paper-2 px-[15px] py-[16px]">
        <p className="text-[0.9375rem] leading-[1.5] font-extrabold text-ink">
          정답을 맞히는 시험이 아니라, 말이 나오게 만드는 연습입니다.
        </p>
        <div className="mt-[14px] flex flex-col gap-2">
          <BigButton href="/train" size="lg" block>
            훈련 시작하기
          </BigButton>
          <BigButton href="/emergency" variant="secondary" block>
            응급 안내 열기
          </BigButton>
        </div>
      </div>

      <InlineDisclaimer size="md" tone="readable" className="mt-5 mb-6" />
    </PageShell>
  );
}
