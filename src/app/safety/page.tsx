import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Badge, BigButton, Card, PageShell } from "@/components";
import { DocWhitelist } from "./_components/DocWhitelist";

export const metadata: Metadata = {
  title: "안전·개인정보 설계",
  description:
    "3계층 생성통제, 기록 코칭 개인정보 경로, 폴백 매트릭스, 근거 문서 화이트리스트, 의료기기 경계, 접근권한 3등급",
};

/* ── 페이지 전용 조각 ──────────────────────────────────────── */

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
    <section id={id} className="scroll-mt-24 border-t border-line pt-9 first:border-t-0 first:pt-0">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-chip bg-brand-100 text-base font-extrabold text-brand-800"
        >
          {num}
        </span>
        <h2 className="text-xl font-extrabold text-ink md:text-2xl">{title}</h2>
      </div>
      {lead && <p className="mt-3 max-w-3xl text-base leading-relaxed text-ink-soft">{lead}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

/**
 * 반응형 표.
 * 모바일에서는 가로 스크롤 대신 항목별 카드로 쌓아 읽게 합니다(고령 사용자 배려).
 */
function DataTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: string[];
  rows: ReactNode[][];
}) {
  return (
    <>
      {/* 데스크톱 */}
      <div className="hidden overflow-hidden rounded-card border border-line bg-white shadow-card md:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="bg-paper-2">
              {columns.map((c) => (
                <th
                  key={c}
                  scope="col"
                  className="border-b border-line px-4 py-3 text-base font-extrabold text-ink"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri} className="align-top even:bg-paper/60">
                {r.map((cell, ci) => (
                  <td
                    key={ci}
                    className="border-b border-line px-4 py-4 text-base leading-relaxed text-ink last:border-b-0"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 모바일 */}
      <ul className="space-y-4 md:hidden">
        {rows.map((r, ri) => (
          <li key={ri}>
            <Card padded={false}>
              <dl className="divide-y divide-line">
                {r.map((cell, ci) => (
                  <div key={ci} className="px-4 py-3">
                    <dt className="text-sm font-bold text-ink-muted">{columns[ci]}</dt>
                    <dd className="mt-1 text-base leading-relaxed text-ink">{cell}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ── 데이터 ────────────────────────────────────────────────── */

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
    desc: "확정한 텍스트만 남습니다(이 데모에서는 이 기기의 브라우저 저장소). 기관 연동 시 전송 TLS 1.3 · 저장 AES-256으로 설계했습니다.",
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

/* ── 페이지 ────────────────────────────────────────────────── */

export default function SafetyPage() {
  return (
    <PageShell
      eyebrow="안전 설계"
      title="잘 답하는 AI보다, 안전하게 멈추는 AI"
      description="침착은 공식 근거가 확인된 범위에서만 피드백하고, 근거가 부족하거나 실제 응급 상황에서는 생성 대신 검수된 안내를 내보냅니다. 아래는 그 경계를 어디에 그었는지에 대한 기록입니다."
      wide
    >
      <div className="space-y-12">
        {/* 1. 3계층 생성통제 */}
        <Section
          id="tiers"
          num="1"
          title="3계층 생성통제 — 위험할수록 AI의 지분을 줄입니다"
          lead="구간마다 AI가 할 수 있는 일의 범위를 다르게 잠갔습니다. 안전 직결 3항목(업무 범위를 벗어난 행위 · 신체 제한 · 119 지연)은 확률 모델이 아니라 규칙 엔진이 단독으로 판정합니다."
        >
          <DataTable
            caption="생성 통제 3계층"
            columns={["계층", "적용 구간", "AI가 하는 일", "AI가 하지 않는 일", "근거가 없을 때"]}
            rows={[
              [
                <Badge key="l1" tone="brand">
                  L1 · 훈련
                </Badge>,
                "시나리오 대화",
                "어르신·보호자 역 대사를 대본 범위 안에서 재생·변주합니다.",
                "대본 밖 상황을 지어내지 않고, 실존 인물·기관을 언급하지 않습니다.",
                "이탈이 감지되면 검수된 고정 대사로 되돌립니다.",
              ],
              [
                <Badge key="l2" tone="warn">
                  L2 · 채점
                </Badge>,
                "턴별 피드백",
                "검색된 근거 문서 안에서만 코칭 문장을 만듭니다.",
                "근거 없는 판정이나 추측을 내놓지 않습니다.",
                "생성을 중단하고 「공식 지침에서 근거를 찾지 못했습니다. 담당 간호사 또는 기관에 확인해 주세요.」로 넘깁니다.",
              ],
              [
                <Badge key="l3" tone="danger">
                  L3 · 실전 응급
                </Badge>,
                "응급 프로토콜",
                "없습니다. 생성 호출이 0건입니다.",
                "생성·요약·변형을 전부 하지 않습니다.",
                "해당 없음 — 처음부터 사전 검수된 고정 스크립트만 재생하고 119 안내를 최우선으로 띄웁니다.",
              ],
            ]}
          />

          <Card tone="danger" className="mt-5">
            <p className="text-base leading-relaxed font-bold text-danger-ink">
              응급 화면에는 「이 안내는 사전 검수된 고정 문구입니다 · AI 생성 아님」을 상시
              표시하고, 119 버튼을 항상 노출합니다.
            </p>
            <p className="mt-2 text-base leading-relaxed text-ink">
              몸에 손이 닿는 술기는 화면으로 지도하지 않습니다. 해당 구간에서는 「이 부분은 119
              상황실이 목소리로 직접 지도합니다」로 넘깁니다.
            </p>
          </Card>
        </Section>

        {/* 2. 개인정보 경로 */}
        <Section
          id="privacy"
          num="2"
          title="털릴 데이터를 처음부터 만들지 않았습니다"
          lead="훈련에서 대화하는 상대는 전부 가상 인물이라, 훈련 단계에서는 개인정보 수집 자체가 일어나지 않습니다. 실제 어르신의 정보가 지나가는 길은 기록 코칭 하나뿐이고, 그 길에는 가명처리 관문이 두 개 있습니다."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Card tone="brand">
              <p className="text-base font-extrabold text-brand-800">훈련 경로</p>
              <p className="mt-2 text-base leading-relaxed text-ink">
                상대는 전부 가상 인물이고 개인정보 입력란이 존재하지 않습니다. 외부 전송 0건.
              </p>
            </Card>
            <Card tone="quiet">
              <p className="text-base font-extrabold text-ink">이 데모에서의 동작</p>
              <p className="mt-2 text-base leading-relaxed text-ink">
                세션 기록은 이 기기의 브라우저 저장소에만 남습니다. 발화 원문은 저장하지 않고,
                화면을 벗어나는 순간 사라집니다.
              </p>
            </Card>
          </div>

          <p className="mt-7 text-base font-extrabold text-ink">
            기록 코칭 경로 — 개인정보는 이 한 줄로만 움직입니다
          </p>

          <ol className="mt-4 grid gap-3 md:grid-cols-3">
            {PRIVACY_STEPS.map((s, i) => (
              <li key={s.step}>
                <Card className="h-full">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="flex h-8 w-8 items-center justify-center rounded-chip bg-brand-100 text-base font-extrabold text-brand-800"
                    >
                      {i + 1}
                    </span>
                    <span className="text-base font-extrabold text-ink">{s.step}</span>
                  </div>
                  <p className="mt-2.5 text-base leading-relaxed text-ink-soft">{s.desc}</p>
                </Card>
              </li>
            ))}
          </ol>

          <Card tone="warn" className="mt-5">
            <p className="text-base leading-relaxed font-bold text-warn-ink">
              외부 경계 — 이 선을 넘어가는 것은 가명처리 2단을 통과한 텍스트뿐입니다.
            </p>
            <p className="mt-2 text-base leading-relaxed text-ink">
              가명처리 대상은 성명·연락처·인정번호·주소·생년·기관명 6종이며, 처리 후에도
              가명정보로 취급합니다. 확정 버튼을 누른 뒤에만 기관 시스템으로 보냅니다.
            </p>
          </Card>
        </Section>

        {/* 3. 폴백 매트릭스 */}
        <Section
          id="fallback"
          num="3"
          title="어느 구간이 죽어도 훈련은 멈추지 않습니다"
          lead="장애는 일어난다고 보고 설계했습니다. 각 구간이 멈췄을 때 세션을 유지하는 방법을 미리 정해 두었습니다."
        >
          <DataTable
            caption="폴백 매트릭스 요약"
            columns={["장애 상황", "즉시 폴백 (세션 유지)", "복구 · 검증"]}
            rows={[
              [
                "음성 인식 · 역할 대사 생성 장애",
                "버튼 UI로 전환합니다. 규칙 판정은 독립 경로라 🟢·⚪ 표시와 고정 대사가 계속 나옵니다.",
                "음성 재시도, 교체형 어댑터로 즉시 우회합니다.",
              ],
              [
                "근거 검색 실패",
                "생성을 중단합니다. 근거 없는 답변은 내보내지 않습니다.",
                "근거 커버리지를 재점검한 뒤 재개합니다.",
              ],
              [
                "서버 전면 장애",
                "훈련과 응급은 브라우저 캐시로 무중단 동작합니다. 119 버튼은 상시 노출됩니다.",
                "서버 의존은 기록 업로드뿐이라 로컬 큐에 저장했다가 자동 재전송합니다.",
              ],
              [
                "개인정보 유출 정황",
                "해당 키를 즉시 폐기하고 기록 코칭만 차단합니다. 훈련 기능은 정상 유지됩니다.",
                "24시간 내 정보주체·기관 통지, 요건 충족 시 관계기관 신고, 접속기록 1년 보관.",
              ],
            ]}
          />

          <Card tone="quiet" className="mt-5">
            <p className="text-base leading-relaxed text-ink">
              마이크가 없거나 음성 인식이 되지 않는 환경에서도 모든 훈련을 버튼만으로 끝까지 진행할
              수 있습니다. 버튼 폴백은 예비 수단이 아니라 1급 경로입니다.
            </p>
          </Card>
        </Section>

        {/* 4. 근거 문서 화이트리스트 */}
        <Section
          id="docs"
          num="4"
          title="근거 문서 화이트리스트"
          lead="피드백에 붙는 근거는 아래 목록 안에서만 나옵니다. 목록 밖 문서는 인용하지 않고, 근거를 찾지 못하면 답을 만들지 않습니다."
        >
          <DocWhitelist />

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {[
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
            ].map((r) => (
              <Card key={r.t} tone="quiet" className="h-full">
                <p className="text-base font-extrabold text-ink">{r.t}</p>
                <p className="mt-2 text-base leading-relaxed text-ink-soft">{r.d}</p>
              </Card>
            ))}
          </div>

          <p className="mt-5 text-base leading-relaxed text-ink-soft">
            화면에서는 피드백마다 근거 출처 칩이 붙습니다. 칩을 누르면 어떤 문서인지 확인할 수
            있습니다.
          </p>
        </Section>

        {/* 5. 의료기기 경계 */}
        <Section
          id="boundary"
          num="5"
          title="의료기기 경계는 표현이 아니라 기능으로 지킵니다"
          lead="문구로 피해 가는 대신, 구조적으로 그 판단이 생기지 않게 만들었습니다."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {NOT_MEDICAL.map((n) => (
              <Card key={n.k} className="h-full">
                <p className="text-base font-extrabold text-brand-800">{n.k}</p>
                <p className="mt-2 text-base leading-relaxed text-ink">{n.v}</p>
              </Card>
            ))}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Card tone="warn">
              <p className="text-base font-extrabold text-warn-ink">전 화면 고정 고지</p>
              <p className="mt-2 text-base leading-relaxed text-ink">
                「본 서비스는 훈련·교육 목적이며 119 신고 및 의료인의 진단·처방을 대체하지
                않습니다.」를 모든 화면 하단에 상시 표시합니다. 효과를 단정하는 표현, 임상 판정을
                흉내 내는 표현, 처치를 지시하는 표현 등 8종은 금지 표현 목록으로 정해 두고 화면
                문구에서 배제했습니다(알파는 작성 규율과 QA 점검으로 지키며, 노출 0건을
                확인했습니다. 생성 문구 후검증 필터는 베타에서 붙입니다).
              </p>
            </Card>
            <Card tone="quiet">
              <p className="text-base font-extrabold text-ink">오채점은 비대칭으로 다룹니다</p>
              <p className="mt-2 text-base leading-relaxed text-ink">
                맞는 대응에 ⚪ 코칭을 주는 것보다, 틀린 대응에 🟢 충족을 주는 쪽이 훨씬
                위험합니다. 후자는 0건을 목표로 합니다. 확신이 낮을 때 판정을 「보류」로 표시하는
                단계는 설계에 넣어 두었고, 알파에서는 아직 구현하지 않았습니다. 대신 알파는
                근거를 찾지 못하면 판정 대신 「공식 지침에서 근거를 찾지 못했습니다」를 띄웁니다.
              </p>
            </Card>
          </div>

          <Card tone="brand" className="mt-5">
            <p className="text-base leading-relaxed text-ink">
              화면에는 점수·등급·순위·백분위를 표시하지 않습니다. 🟢 충족과 ⚪ 코칭 두 가지, 코칭
              한 문장, 근거 출처까지가 전부입니다.
            </p>
          </Card>
        </Section>

        {/* 6. 접근권한 3등급 */}
        <Section
          id="access"
          num="6"
          title="접근권한 3등급"
          lead="내부 판정 결과가 인사평가로 흘러가면 아무도 솔직하게 실패하지 않습니다. 실패 없는 훈련은 효과가 0이 되기 때문에, 권한을 처음부터 나눠 두었습니다."
        >
          <DataTable
            caption="접근권한 3등급"
            columns={["등급", "볼 수 있는 것", "볼 수 없는 것", "추가 통제"]}
            rows={[
              [
                <Badge key="u" tone="brand">
                  사용자
                </Badge>,
                "본인의 훈련 이력, 🟢 충족·⚪ 코칭 요약, 본인이 확정한 기록",
                "다른 사용자의 어떤 정보도 볼 수 없습니다.",
                "발화 원문은 세션 안에서만 존재하고 저장되지 않습니다.",
              ],
              [
                <Badge key="m" tone="neutral">
                  기관 관리자
                </Badge>,
                "소속 인원의 이수 여부와 이수 일시",
                "내부 판정 결과, 대화 전문, 발화 원문",
                "인사평가 연동 금지를 계약으로 명시합니다.",
              ],
              [
                <Badge key="o" tone="warn">
                  운영자
                </Badge>,
                "장애 대응에 필요한 최소 범위",
                "개인을 식별할 수 있는 원문",
                "전건 접근 기록 + 2단계 인증. 접속기록 1년 보관.",
              ],
            ]}
          />

          <Card tone="quiet" className="mt-5">
            <p className="text-base leading-relaxed text-ink">
              비밀번호는 Argon2id로 해시해 저장합니다. 국내 리전 처리가 기본값이며, 국외 사업자를
              쓰게 되면 「개인정보 보호법」 제28조의8에 따라 이전 국가·항목·목적·보유기간을 명시해
              공개합니다.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-ink-muted">
              대응 조항 · 「개인정보 보호법」 제16·21·26·28조의8·34조 · 「개인정보의 안전성 확보조치
              기준」 제5·6·8조 · AI 기본법상 고영향 AI 비해당.
            </p>
          </Card>
        </Section>
      </div>

      {/* 하단 CTA */}
      <Card tone="brand" className="mt-12">
        <p className="text-lg leading-relaxed font-extrabold text-brand-900">
          정답을 맞히는 시험이 아니라, 말이 나오게 만드는 연습입니다.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <BigButton href="/train" size="lg">
            훈련 시작하기
          </BigButton>
          <BigButton href="/emergency" size="lg" variant="secondary">
            응급 음성 가이드 보기
          </BigButton>
        </div>
      </Card>
    </PageShell>
  );
}
